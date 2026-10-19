// electron-builder hook: puts better-sqlite3's prebuilt binary for the target platform and architecture
// into desktop/node_modules (e.g. darwin-x64 on an arm64 Mac). Returning false skips electron-builder's own
// rebuild, which would also touch the repository root's copy (see scripts/native.mjs).
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

exports.default = async function beforeBuild(context) {
  execFileSync(
    process.execPath,
    [join(__dirname, 'native.mjs'), '--platform', context.platform.nodeName, '--arch', context.arch],
    { stdio: 'inherit' },
  );
  return false;
};
