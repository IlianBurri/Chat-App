// Builds the desktop app into dist/:
//   main.cjs, preload.cjs – Electron main process and the preload for all windows
//   server/               – the bundled server (npm run bundle -w server) with schema.sql
//   client/               – the built web app (npm run build)
// `--main-only` rebuilds just main and preload, for quick iterations on the shell.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

const mainOnly = process.argv.includes('--main-only');
const repo = new URL('../../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);

if (!mainOnly) {
  const run = (command) => execSync(command, { cwd: repo, stdio: 'inherit' });
  run('npm run build');
  run('npm run bundle -w server');
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(new URL('server/dist/', repo), new URL('server/', dist), { recursive: true });
  cpSync(new URL('client/dist/', repo), new URL('client/', dist), { recursive: true });
} else if (!existsSync(new URL('server/server.mjs', dist))) {
  console.error('dist/server is missing – run `npm run build` once first.');
  process.exit(1);
}

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
  legalComments: 'none',
  logLevel: 'warning',
};
await build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.cjs' });
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.cjs' });
console.log(mainOnly ? 'Built main and preload' : 'Built desktop app into dist/');
