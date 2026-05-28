#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const claspPath = resolve(projectRoot, '.clasp.json');
const manifestPath = resolve(projectRoot, 'appsscript.json');
const defaultAuthFile = process.env.CLASP_AUTH_FILE || `${process.env.HOME}/.clasprc.json`;
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const tokenInfoEndpoint = 'https://oauth2.googleapis.com/tokeninfo';
const scriptRunBase = 'https://script.googleapis.com/v1/scripts';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseArgs(argv) {
  const [command = 'check', ...rest] = argv;
  const options = {
    authFile: defaultAuthFile,
    mode: 'head',
    params: [],
    functionName: undefined,
    outputJson: false,
  };

  const positionals = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--head') {
      options.mode = 'head';
    } else if (arg === '--deployed' || arg === '--nondev') {
      options.mode = 'deployed';
    } else if (arg === '--auth-file') {
      options.authFile = rest[++i];
    } else if (arg === '--params-json') {
      options.params = JSON.parse(rest[++i]);
      if (!Array.isArray(options.params)) {
        throw new Error('--params-json must decode to a JSON array.');
      }
    } else if (arg === '--json') {
      options.outputJson = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (command === 'run') {
    options.functionName = positionals[0];
    if (!options.functionName) {
      throw new Error('Usage: node scripts/apps-script-api.mjs run [--head|--deployed] <functionName> [--params-json "[...]"]');
    }
  } else if (command === 'check') {
    options.functionName = positionals[0] || 'validateEnvironment';
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  return { command, options };
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, data };
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, data };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, data };
}

async function loadAuth(authFile) {
  const auth = readJson(authFile);
  const token = auth?.tokens?.default;
  if (!token?.refresh_token || !token?.client_id || !token?.client_secret) {
    throw new Error(`Auth file is missing refresh-token credentials: ${authFile}`);
  }

  const refresh = await postForm(tokenEndpoint, {
    client_id: token.client_id,
    client_secret: token.client_secret,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
  });
  if (!refresh.ok) {
    throw new Error(`Failed to refresh OAuth token (${refresh.status}): ${JSON.stringify(refresh.data)}`);
  }

  const accessToken = refresh.data.access_token;
  const scopesFromRefresh = typeof refresh.data.scope === 'string'
    ? refresh.data.scope.split(/\s+/).filter(Boolean)
    : [];

  const tokenInfo = await getJson(`${tokenInfoEndpoint}?access_token=${encodeURIComponent(accessToken)}`);
  const tokenScopes = tokenInfo.ok && typeof tokenInfo.data?.scope === 'string'
    ? tokenInfo.data.scope.split(/\s+/).filter(Boolean)
    : scopesFromRefresh;

  return {
    accessToken,
    tokenScopes,
    email: tokenInfo.data?.email || null,
    clientId: token.client_id,
  };
}

async function runScriptFunction({ scriptId, accessToken, functionName, params, mode }) {
  const devMode = mode === 'head';
  const response = await postJson(
    `${scriptRunBase}/${scriptId}:run`,
    {
      function: functionName,
      parameters: params,
      devMode,
    },
    { authorization: `Bearer ${accessToken}` },
  );

  return { ...response, devMode };
}

function summarizeRemoteError(response) {
  const err = response?.data?.error || {};
  const detail = Array.isArray(err.details) ? err.details[0] : null;
  return {
    code: err.code || response.status,
    status: err.status || null,
    message: err.message || 'Unknown error',
    scriptErrorMessage: detail?.errorMessage || null,
    scriptErrorType: detail?.errorType || null,
    scriptStackTrace: detail?.scriptStackTraceElements || [],
  };
}

function buildDiagnosis({ mode, missingScopes, remoteError }) {
  const lines = [];
  if (missingScopes.length > 0) {
    lines.push(
      'Auth token is missing manifest scopes. Re-login with project scopes:',
      '  ./scripts/login-project-scopes.sh /absolute/path/to/oauth-client.json',
      'Then rerun this command.',
    );
  }

  if (remoteError?.code === 403 && mode === 'head') {
    lines.push(
      'HEAD/devMode execution was denied. In this repo that usually means the current OAuth token does not include the spreadsheet/script scopes from appsscript.json.',
    );
  }

  if (remoteError?.code === 404 && mode === 'deployed') {
    lines.push(
      'Deployed/nondev execution is not resolving to an API executable deployment. Check the script\'s linked GCP project, API Executable deployment, and clasp projectId linkage.',
    );
  }

  if (lines.length === 0) {
    lines.push('No extra diagnosis available. See the raw error payload.');
  }
  return lines;
}

function printHumanCheck(summary) {
  console.log(`Script ID: ${summary.scriptId}`);
  console.log(`Auth file: ${summary.authFile}`);
  console.log(`Signed-in user: ${summary.email || 'unknown'}`);
  console.log(`Check function: ${summary.functionName}`);
  console.log(`Manifest scopes: ${summary.manifestScopes.length}`);
  console.log(`Token scopes: ${summary.tokenScopes.length}`);
  if (summary.missingScopes.length > 0) {
    console.log('Missing token scopes:');
    for (const scope of summary.missingScopes) {
      console.log(`- ${scope}`);
    }
  } else {
    console.log('Missing token scopes: none');
  }

  for (const attempt of summary.attempts) {
    const label = attempt.mode === 'head' ? 'HEAD/devMode' : 'deployed/nondev';
    console.log(`\n[${label}]`);
    if (attempt.ok) {
      console.log('status: OK');
      console.log(JSON.stringify(attempt.data.response?.result ?? attempt.data, null, 2));
      continue;
    }
    console.log('status: FAILED');
    console.log(JSON.stringify(attempt.error, null, 2));
    for (const line of attempt.diagnosis) {
      console.log(line);
    }
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const clasp = readJson(claspPath);
  const manifest = readJson(manifestPath);
  const manifestScopes = Array.isArray(manifest.oauthScopes) ? manifest.oauthScopes : [];
  const auth = await loadAuth(options.authFile);
  const missingScopes = manifestScopes.filter((scope) => !auth.tokenScopes.includes(scope));

  if (command === 'check') {
    const attempts = [];
    for (const mode of ['head', 'deployed']) {
      const response = await runScriptFunction({
        scriptId: clasp.scriptId,
        accessToken: auth.accessToken,
        functionName: options.functionName,
        params: [],
        mode,
      });
      if (response.ok) {
        attempts.push({ mode, ok: true, data: response });
      } else {
        const error = summarizeRemoteError(response);
        attempts.push({
          mode,
          ok: false,
          error,
          diagnosis: buildDiagnosis({ mode, missingScopes, remoteError: error }),
        });
      }
    }

    const summary = {
      scriptId: clasp.scriptId,
      authFile: options.authFile,
      email: auth.email,
      functionName: options.functionName,
      manifestScopes,
      tokenScopes: auth.tokenScopes,
      missingScopes,
      attempts,
    };

    if (options.outputJson) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      printHumanCheck(summary);
    }

    const allOk = attempts.every((attempt) => attempt.ok);
    process.exit(allOk ? 0 : 1);
  }

  const response = await runScriptFunction({
    scriptId: clasp.scriptId,
    accessToken: auth.accessToken,
    functionName: options.functionName,
    params: options.params,
    mode: options.mode,
  });

  if (response.ok) {
    const result = {
      mode: options.mode,
      functionName: options.functionName,
      result: response.data.response?.result ?? null,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const remoteError = summarizeRemoteError(response);
  const failure = {
    mode: options.mode,
    functionName: options.functionName,
    missingScopes,
    error: remoteError,
    diagnosis: buildDiagnosis({ mode: options.mode, missingScopes, remoteError }),
  };
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
