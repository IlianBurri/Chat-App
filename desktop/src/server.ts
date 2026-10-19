import { utilityProcess, type UtilityProcess } from 'electron';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { paths } from './paths';
import type { Settings } from './settings';

export type ServerErrorCode = 'port_in_use' | 'server_exit' | 'server_timeout';

export class ServerStartError extends Error {
  constructor(
    readonly code: ServerErrorCode,
    readonly details = '',
  ) {
    super(code);
  }
}

const READY_TIMEOUT_MS = 90_000;

let child: UtilityProcess | null = null;
let stopping = false;

export const databaseFile = () => join(paths.data, 'hallo.db');
export const serverLogFile = () => join(paths.data, 'logs', 'server.log');

function portIsFree(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const probe = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });
}

function logTail(lines = 30) {
  try {
    return readFileSync(serverLogFile(), 'utf8').trimEnd().split(/\r?\n/).slice(-lines).join('\n');
  } catch {
    return '';
  }
}

/**
 * Starts the bundled server (the same build as a standalone install) in an Electron utility process,
 * so a server crash does not take the window down. Resolves once the API answers.
 */
export async function startServer(settings: Settings, onUnexpectedExit: (details: string) => void): Promise<void> {
  await stopServer();
  const host = settings.lan ? '0.0.0.0' : '127.0.0.1';
  if (!(await portIsFree(settings.port, host))) throw new ServerStartError('port_in_use');

  const logFile = serverLogFile();
  mkdirSync(join(paths.data, 'logs'), { recursive: true });
  mkdirSync(join(paths.data, 'uploads'), { recursive: true });
  if (existsSync(logFile)) renameSync(logFile, `${logFile}.old`);
  const log = createWriteStream(logFile, { flags: 'a' });

  const proc = utilityProcess.fork(paths.serverEntry, [], {
    serviceName: 'Hallo Server',
    stdio: 'pipe',
    // The server reads a .env from its working directory; the data folder has none.
    cwd: paths.data,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(settings.port),
      HOST: host,
      DATABASE_URL: `file:${databaseFile()}`,
      UPLOAD_DIR: join(paths.data, 'uploads'),
      SCHEMA_FILE: paths.schemaFile,
      CLIENT_DIR: paths.clientDir,
      SEED_DEMO: settings.demo ? '1' : '0',
      JWT_SECRET: settings.jwtSecret,
    },
  });
  child = proc;
  stopping = false;
  proc.stdout?.pipe(log, { end: false });
  proc.stderr?.pipe(log, { end: false });

  let ready = false;
  let exited = false;
  proc.once('exit', (code) => {
    exited = true;
    log.end(`\n[desktop] server exited with code ${code}\n`);
    if (child === proc) child = null;
    if (!stopping && ready) onUnexpectedExit(logTail());
  });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!ready) {
    if (exited) throw new ServerStartError('server_exit', logTail());
    if (Date.now() > deadline) {
      await stopServer();
      throw new ServerStartError('server_timeout', logTail());
    }
    try {
      const res = await fetch(`http://127.0.0.1:${settings.port}/api/health`, { signal: AbortSignal.timeout(2000) });
      ready = res.ok;
    } catch {
      // not listening yet
    }
    if (!ready) await sleep(250);
  }
}

export async function stopServer() {
  const proc = child;
  if (!proc) return;
  stopping = true;
  child = null;
  const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
  proc.kill();
  await Promise.race([exited, sleep(5000)]);
}

export const serverRunning = () => child !== null;
