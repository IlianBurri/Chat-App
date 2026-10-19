// Installs better-sqlite3's prebuilt binary for Electron into desktop/node_modules only.
// `electron-builder install-app-deps` would also rebuild the repository root's copy (used by the dev
// server under plain Node) and break it, so this script does the one thing needed itself.
//   node scripts/native.mjs [--arch x64|arm64] [--platform win32|darwin|linux]
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const arch = arg('arch', process.arch);
const platform = arg('platform', process.platform);
const electron = require('electron/package.json').version;
const moduleDir = dirname(require.resolve('better-sqlite3/package.json'));
const prebuildInstall = require.resolve('prebuild-install/bin.js');

execFileSync(
  process.execPath,
  [prebuildInstall, '--runtime', 'electron', '--target', electron, '--arch', arch, '--platform', platform, '--force'],
  { cwd: moduleDir, stdio: 'inherit' },
);
console.log(`better-sqlite3 for Electron ${electron} (${platform}-${arch})`);
