import { mkdirSync, rmSync, copyFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(process.cwd());
const distDir = resolve(root, 'dist');
const outfile = resolve(distDir, 'code.js');
const exposedFunctions = [
  'bootstrapProject',
  'validateEnvironment',
  'setInitialScriptProperties',
  'runCanonicalRefresh',
  'runFullRefresh',
  'runPublishAll',
  'runWritebackCollection',
  'dropOrphanStagingLineRegistration',
  'dropOrphanStagingFeedback',
  'installTriggers',
  'deleteManagedTriggers',
  'reinstallTriggers',
  'handlePublishTrigger',
  'handleWritebackTrigger',
  'handleDailyRefreshTrigger',
  'onOpen',
  'menuValidateEnvironment',
  'menuBootstrapProject',
  'menuRunCanonicalRefresh',
  'menuRunFullRefresh',
  'menuRunPublishAll',
  'menuRunWritebackCollection',
  'menuReinstallTriggers',
];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/gas-entry.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2019',
  outfile,
  charset: 'utf8',
  logLevel: 'info',
});

const wrapperSource = `\n\n${exposedFunctions
  .map((name) => `function ${name}() { return globalThis.__potex.${name}.apply(null, arguments); }`)
  .join('\n')}\n`;
appendFileSync(outfile, wrapperSource);
copyFileSync(resolve(root, 'appsscript.json'), resolve(distDir, 'appsscript.json'));
console.log('Built bundled GAS output in dist/.');
