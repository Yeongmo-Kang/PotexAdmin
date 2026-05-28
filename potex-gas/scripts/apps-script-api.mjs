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
const deploymentsBase = 'https://script.googleapis.com/v1/projects';

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

function isExecutionApiDeployment(deployment) {
  return Array.isArray(deployment?.entryPoints)
    && deployment.entryPoints.some((entryPoint) => entryPoint?.entryPointType === 'EXECUTION_API');
}

function compareDeployments(a, b) {
  const aVersion = a?.deploymentConfig?.versionNumber ?? -1;
  const bVersion = b?.deploymentConfig?.versionNumber ?? -1;
  if (aVersion !== bVersion) return bVersion - aVersion;
  const aTime = Date.parse(a?.updateTime || '1970-01-01T00:00:00Z');
  const bTime = Date.parse(b?.updateTime || '1970-01-01T00:00:00Z');
  return bTime - aTime;
}

async function listDeployments({ scriptId, accessToken }) {
  const response = await getJson(`${deploymentsBase}/${scriptId}/deployments`, {
    authorization: `Bearer ${accessToken}`,
  });
  if (!response.ok) {
    const err = response?.data?.error || {};
    throw new Error(`Failed to list deployments (${response.status}): ${err.message || JSON.stringify(response.data)}`);
  }
  return Array.isArray(response.data?.deployments) ? response.data.deployments : [];
}

function selectDeployment(deployments) {
  const candidates = deployments
    .filter(isExecutionApiDeployment)
    .filter((deployment) => Number.isFinite(deployment?.deploymentConfig?.versionNumber));
  if (candidates.length === 0) return null;
  candidates.sort(compareDeployments);
  return candidates[0];
}

async function runScriptFunction({ targetId, accessToken, functionName, params, devMode }) {
  const response = await postJson(
    `${scriptRunBase}/${targetId}:run`,
    {
      function: functionName,
      parameters: params,
      devMode,
    },
    { authorization: `Bearer ${accessToken}` },
  );

  return { ...response, devMode, targetId };
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

function buildDiagnosis({ mode, missingScopes, remoteError, selectedDeployment }) {
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

  if (remoteError?.code === 404 && mode === 'deployed-raw') {
    if (selectedDeployment?.deploymentId) {
      lines.push(
        'Raw scriptId nondev resolution failed, but this repo should prefer the explicit deployment-ID route.',
        `Selected deployment: ${selectedDeployment.deploymentId} (version ${selectedDeployment.deploymentConfig?.versionNumber ?? 'unknown'})`,
      );
    } else {
      lines.push('Raw scriptId nondev resolution failed and no versioned EXECUTION_API deployment was found.');
    }
  }

  if (remoteError?.code === 404 && mode === 'deployed-explicit') {
    lines.push(
      'Explicit deployment-ID execution failed. Check the deployment metadata, linked GCP project, and whether the selected deployment is still API executable.',
    );
  }

  if (lines.length === 0) {
    lines.push('No extra diagnosis available. See the raw error payload.');
  }
  return lines;
}

function labelForMode(mode) {
  if (mode === 'head') return 'HEAD/devMode';
  if (mode === 'deployed-explicit') return 'deployed/nondev via explicit deploymentId';
  if (mode === 'deployed-raw') return 'deployed/nondev via raw scriptId';
  return mode;
}

function printHumanCheck(summary) {
  console.log(`Script ID: ${summary.scriptId}`);
  console.log(`Auth file: ${summary.authFile}`);
  console.log(`Signed-in user: ${summary.email || 'unknown'}`);
  console.log(`Check function: ${summary.functionName}`);
  console.log(`Manifest scopes: ${summary.manifestScopes.length}`);
  console.log(`Token scopes: ${summary.tokenScopes.length}`);
  if (summary.selectedDeployment) {
    console.log(`Selected deployment: ${summary.selectedDeployment.deploymentId} @${summary.selectedDeployment.deploymentConfig?.versionNumber ?? 'HEAD'}${summary.selectedDeployment.deploymentConfig?.description ? ` - ${summary.selectedDeployment.deploymentConfig.description}` : ''}`);
  } else {
    console.log('Selected deployment: none');
  }
  if (summary.missingScopes.length > 0) {
    console.log('Missing token scopes:');
    for (const scope of summary.missingScopes) {
      console.log(`- ${scope}`);
    }
  } else {
    console.log('Missing token scopes: none');
  }

  for (const attempt of summary.attempts) {
    console.log(`\n[${labelForMode(attempt.mode)}]`);
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
  const deployments = await listDeployments({ scriptId: clasp.scriptId, accessToken: auth.accessToken });
  const selectedDeployment = selectDeployment(deployments);

  if (command === 'check') {
    const attempts = [];
    const probes = [
      { mode: 'head', targetId: clasp.scriptId, devMode: true },
      { mode: 'deployed-explicit', targetId: selectedDeployment?.deploymentId, devMode: false, skipIfMissing: true },
      { mode: 'deployed-raw', targetId: clasp.scriptId, devMode: false },
    ];

    for (const probe of probes) {
      if (probe.skipIfMissing && !probe.targetId) {
        attempts.push({
          mode: probe.mode,
          ok: false,
          error: {
            code: 0,
            status: 'NO_DEPLOYMENT',
            message: 'No versioned EXECUTION_API deployment found.',
            scriptErrorMessage: null,
            scriptErrorType: null,
            scriptStackTrace: [],
          },
          diagnosis: ['Create or select a versioned EXECUTION_API deployment before using deployed/nondev execution.'],
        });
        continue;
      }

      const response = await runScriptFunction({
        targetId: probe.targetId,
        accessToken: auth.accessToken,
        functionName: options.functionName,
        params: [],
        devMode: probe.devMode,
      });
      if (response.ok) {
        attempts.push({ mode: probe.mode, ok: true, data: response, targetId: probe.targetId });
      } else {
        const error = summarizeRemoteError(response);
        attempts.push({
          mode: probe.mode,
          ok: false,
          error,
          targetId: probe.targetId,
          diagnosis: buildDiagnosis({ mode: probe.mode, missingScopes, remoteError: error, selectedDeployment }),
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
      selectedDeployment: selectedDeployment ? {
        deploymentId: selectedDeployment.deploymentId,
        deploymentConfig: selectedDeployment.deploymentConfig,
        updateTime: selectedDeployment.updateTime,
      } : null,
      attempts,
    };

    if (options.outputJson) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      printHumanCheck(summary);
    }

    const durableModes = attempts.filter((attempt) => ['head', 'deployed-explicit'].includes(attempt.mode));
    const allOk = durableModes.length > 0 && durableModes.every((attempt) => attempt.ok);
    process.exit(allOk ? 0 : 1);
  }

  const targetId = options.mode === 'deployed'
    ? selectedDeployment?.deploymentId
    : clasp.scriptId;
  if (!targetId) {
    throw new Error('No versioned EXECUTION_API deployment found for --deployed run.');
  }

  const response = await runScriptFunction({
    targetId,
    accessToken: auth.accessToken,
    functionName: options.functionName,
    params: options.params,
    devMode: options.mode === 'head',
  });

  if (response.ok) {
    const result = {
      mode: options.mode,
      functionName: options.functionName,
      targetId,
      selectedDeployment: options.mode === 'deployed' && selectedDeployment ? {
        deploymentId: selectedDeployment.deploymentId,
        versionNumber: selectedDeployment.deploymentConfig?.versionNumber ?? null,
        description: selectedDeployment.deploymentConfig?.description ?? null,
      } : null,
      result: response.data.response?.result ?? null,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const remoteError = summarizeRemoteError(response);
  const failure = {
    mode: options.mode,
    functionName: options.functionName,
    targetId,
    selectedDeployment: selectedDeployment ? {
      deploymentId: selectedDeployment.deploymentId,
      versionNumber: selectedDeployment.deploymentConfig?.versionNumber ?? null,
      description: selectedDeployment.deploymentConfig?.description ?? null,
    } : null,
    missingScopes,
    error: remoteError,
    diagnosis: buildDiagnosis({
      mode: options.mode === 'deployed' ? 'deployed-explicit' : options.mode,
      missingScopes,
      remoteError,
      selectedDeployment,
    }),
  };
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
