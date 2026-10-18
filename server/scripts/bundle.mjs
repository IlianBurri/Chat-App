// Builds the server as one file for the desktop app and other installs without the dev toolchain:
//   dist/server.mjs  – API + Socket.IO + Prisma client (only the native better-sqlite3 stays external)
//   dist/schema.sql  – CREATE statements, applied by the server to an empty database (see lib/bootstrap.ts)
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const outDir = new URL('../dist/', import.meta.url);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['better-sqlite3'],
  legalComments: 'none',
  // Some bundled CommonJS dependencies use require/__dirname, which ESM does not provide.
  banner: {
    js: [
      "import { createRequire as __hallo_createRequire } from 'node:module';",
      "import { fileURLToPath as __hallo_fileURLToPath } from 'node:url';",
      "import { dirname as __hallo_dirname } from 'node:path';",
      'const require = __hallo_createRequire(import.meta.url);',
      'const __filename = __hallo_fileURLToPath(import.meta.url);',
      'const __dirname = __hallo_dirname(__filename);',
    ].join('\n'),
  },
  logLevel: 'warning',
});

const sql = execSync('npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script', { encoding: 'utf8' });
writeFileSync(new URL('schema.sql', outDir), sql);
console.log('Bundled server to dist/server.mjs and dist/schema.sql');
