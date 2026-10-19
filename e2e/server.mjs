// Server for the Playwright suite, started by playwright.config.ts: the production setup (built client served
// by the API, tables created from the generated schema) with a fresh demo database in e2e/.data on every run.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('../server/', import.meta.url));
const clientDist = fileURLToPath(new URL('../client/dist/', import.meta.url));
const data = fileURLToPath(new URL('.data/', import.meta.url));

rmSync(data, { recursive: true, force: true });
mkdirSync(`${data}uploads`, { recursive: true });
const schema = execSync('npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script', { cwd: serverDir, encoding: 'utf8' });
writeFileSync(`${data}schema.sql`, schema);

const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    JWT_SECRET: 'e2e-secret',
    PORT: process.env.E2E_PORT ?? '4300',
    DATABASE_URL: `file:${data}e2e.db`,
    UPLOAD_DIR: `${data}uploads`,
    SCHEMA_FILE: `${data}schema.sql`,
    CLIENT_DIR: clientDist,
    SEED_DEMO: '1',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
