import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type Mode = 'host' | 'connect';

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface Settings {
  /** null until the setup wizard is finished */
  mode: Mode | null;
  /** connect: origin of the team's server */
  serverUrl: string;
  /** host: port of the built-in server */
  port: number;
  /** host: listen on all interfaces so colleagues can connect */
  lan: boolean;
  /** host: fill an empty database with demo data */
  demo: boolean;
  /** host: signs session cookies; generated once so sign-ins survive restarts */
  jwtSecret: string;
  closeToTray: boolean;
  autostart: boolean;
  /** The "keeps running in the background" hint was shown once */
  trayHintShown: boolean;
  window: WindowBounds;
}

/** What the setup page may change; everything else stays under the shell's control. */
export type SetupInput = Pick<Settings, 'mode' | 'serverUrl' | 'port' | 'lan' | 'demo' | 'closeToTray' | 'autostart'>;

export const DEFAULT_PORT = 4000;

export function defaultSettings(): Settings {
  return {
    mode: null,
    serverUrl: '',
    port: DEFAULT_PORT,
    lan: true,
    demo: false,
    jwtSecret: randomBytes(48).toString('base64url'),
    closeToTray: true,
    autostart: false,
    trayHintShown: false,
    window: { width: 1280, height: 820, maximized: false },
  };
}

export function isValidPort(port: unknown): port is number {
  return Number.isInteger(port) && (port as number) >= 1024 && (port as number) <= 65535;
}

/** Fills gaps and drops invalid values, so a hand-edited or older settings file never breaks the start. */
export function normalizeSettings(raw: unknown): Settings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Record<keyof Settings, unknown>>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const w = (r.window ?? {}) as Partial<Record<keyof WindowBounds, unknown>>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);
  return {
    mode: r.mode === 'host' || r.mode === 'connect' ? r.mode : null,
    serverUrl: typeof r.serverUrl === 'string' ? r.serverUrl : '',
    port: isValidPort(r.port) ? r.port : base.port,
    lan: bool(r.lan, base.lan),
    demo: bool(r.demo, base.demo),
    jwtSecret: typeof r.jwtSecret === 'string' && r.jwtSecret.length >= 32 ? r.jwtSecret : base.jwtSecret,
    closeToTray: bool(r.closeToTray, base.closeToTray),
    autostart: bool(r.autostart, base.autostart),
    trayHintShown: bool(r.trayHintShown, base.trayHintShown),
    window: {
      x: num(w.x),
      y: num(w.y),
      width: Math.max(800, num(w.width) ?? base.window.width),
      height: Math.max(560, num(w.height) ?? base.window.height),
      maximized: bool(w.maximized, false),
    },
  };
}

export function loadSettings(file: string): Settings {
  if (!existsSync(file)) return defaultSettings();
  try {
    return normalizeSettings(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return defaultSettings();
  }
}

/** Writes via a temporary file, so a crash mid-write cannot leave a half-written settings file. */
export function saveSettings(file: string, settings: Settings) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(settings, null, 2));
  renameSync(`${file}.tmp`, file);
}
