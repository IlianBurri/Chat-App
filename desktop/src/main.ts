import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  Notification,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { existsSync } from 'node:fs';
import pkg from '../package.json' with { type: 'json' };
import { autostartEnabled, setAutostart, startedHidden } from './autostart';
import { format, stringsFor, type Strings } from './i18n';
import { buildMenu } from './menu';
import { checkServer, insecureOriginToAllow, lanAddresses, normalizeServerUrl } from './net';
import { paths } from './paths';
import { databaseFile, serverLogFile, serverRunning, ServerStartError, startServer, stopServer } from './server';
import { isValidPort, loadSettings, saveSettings, type SetupInput } from './settings';
import { createTray, type TrayState } from './tray';
import { backgroundColor, createMainWindow, guardNavigation, isLocalPage, secureSession } from './window';

/** Must match `appId` in electron-builder.yml; Windows ties notifications and taskbar pins to it. */
const APP_ID = 'app.hallo.desktop';
const appName = pkg.productName;

type Status =
  | { kind: 'starting'; firstStart: boolean }
  | { kind: 'connecting'; url: string }
  | { kind: 'error'; message: string; details: string; canOpenLog: boolean };

app.setName(appName);
// Separate data folder, e.g. for tests or a second profile; otherwise the OS default for the app name.
if (process.env.DESKTOP_DATA_DIR) app.setPath('userData', process.env.DESKTOP_DATA_DIR);
let settings = loadSettings(paths.settingsFile);

// Has to happen before the app is ready; a later change of server restarts the app (see setup:save).
const allowedInsecureOrigin = insecureOriginToAllow(settings.mode === 'connect' ? settings.serverUrl : null);
if (allowedInsecureOrigin) app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', allowedInsecureOrigin);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  void app.whenReady().then(ready);
}

let t: Strings;
let win: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;
let tray: ReturnType<typeof createTray> | null = null;
/** Origin of the web app in the main window; permissions and navigation are limited to it. */
let appOrigin: string | null = null;
let status: Status = { kind: 'starting', firstStart: false };
let unread = 0;
let quitting = false;
let launchRun = 0;

const persist = () => saveSettings(paths.settingsFile, settings);

/** Address colleagues type into their app; null when the server only listens on this computer. */
function shareAddress() {
  if (settings.mode !== 'host' || !settings.lan) return null;
  const [ip] = lanAddresses();
  return ip ? `http://${ip}:${settings.port}` : null;
}

function ready() {
  t = stringsFor(app.getLocale(), appName);
  app.setAppUserModelId(app.isPackaged ? APP_ID : process.execPath);

  app.on('web-contents-created', (_e, contents) => guardNavigation(contents, () => appOrigin));
  secureSession(session.defaultSession, () => appOrigin, () => win);

  win = createMainWindow(settings.window, appName, (bounds) => {
    settings.window = bounds;
    persist();
  });
  const hidden = startedHidden() && settings.mode !== null;
  win.once('ready-to-show', () => {
    if (!hidden) win?.show();
  });
  win.on('focus', () => win?.flashFrame(false));
  win.on('close', (event) => {
    if (quitting) return;
    if (process.platform !== 'darwin' && !settings.closeToTray) return;
    event.preventDefault();
    win?.hide();
    if (process.platform !== 'darwin' && !settings.trayHintShown && Notification.isSupported()) {
      new Notification({
        title: t['tray.hiddenTitle'],
        body: settings.mode === 'host' ? t['tray.hiddenBodyServer'] : t['tray.hiddenBody'],
        icon: paths.asset('icon.png'),
      }).show();
      settings.trayHintShown = true;
      persist();
    }
  });
  win.webContents.on('page-title-updated', (_e, title) => setUnread(Number(/^\((\d+)\)/.exec(title)?.[1] ?? 0)));
  win.webContents.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
    // -3 is an aborted load, e.g. when another navigation replaced it.
    if (!isMainFrame || code === -3 || !appOrigin || !url.startsWith(appOrigin)) return;
    showError('unreachable', `${description} (${code})`, false);
  });

  tray = createTray(appName, t, {
    open: showWindow,
    copyAddress: copyAddress,
    toggleAutostart: (enabled) => {
      settings.autostart = enabled;
      setAutostart(enabled);
      persist();
      refreshChrome();
    },
    settings: openSettings,
    quit: () => app.quit(),
  });
  registerIpc();
  refreshChrome();

  if (settings.mode === null) void win.loadFile(paths.ui('setup.html'));
  else void launch();
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function copyAddress() {
  const address = shareAddress();
  if (address) clipboard.writeText(address);
}

function refreshChrome() {
  const hosting = settings.mode === 'host';
  const address = shareAddress();
  buildMenu(t, {
    settings: openSettings,
    copyAddress: address ? copyAddress : null,
    openLog: hosting ? () => void shell.openPath(serverLogFile()) : null,
    openData: () => void shell.openPath(paths.data),
    website: () => void shell.openExternal(pkg.homepage),
    guide: () => void shell.openExternal(new URL('anleitung.html', pkg.homepage).href),
    about: showAbout,
  });
  const state: TrayState = { unread, hosting, serverAddress: address, autostart: settings.autostart };
  tray?.update(state);
}

function setUnread(count: number) {
  if (count === unread) return;
  if (count > unread && win && !win.isFocused()) win.flashFrame(true);
  unread = count;
  app.setBadgeCount(count);
  if (process.platform === 'win32' && win) {
    const badge = count > 0 ? nativeImage.createFromPath(paths.asset('badge.png')) : null;
    win.setOverlayIcon(badge, count > 0 ? format(t['tray.unread'], { count }) : '');
  }
  refreshChrome();
}

function showStatus(next: Status) {
  status = next;
  setUnread(0);
  void win?.loadFile(paths.ui('status.html'));
}

function errorMessage(code: string, url = settings.serverUrl) {
  const key = `error.${code}` as keyof Strings;
  return format(t[key] ?? t['error.server_exit'], { port: settings.port, url });
}

function showError(code: string, details: string, canOpenLog: boolean) {
  appOrigin = null;
  showStatus({ kind: 'error', message: errorMessage(code), details, canOpenLog });
  refreshChrome();
}

/** Starts the built-in server or checks the team's server, then loads the web app. */
async function launch() {
  const run = ++launchRun;
  appOrigin = null;
  if (settings.mode === 'host') {
    showStatus({ kind: 'starting', firstStart: !existsSync(databaseFile()) });
    try {
      await startServer(settings, (details) => showError('server_exit', details, true));
    } catch (error) {
      if (run !== launchRun) return;
      const e = error instanceof ServerStartError ? error : new ServerStartError('server_exit', String(error));
      return showError(e.code, e.details, true);
    }
    if (run !== launchRun) return;
    appOrigin = `http://127.0.0.1:${settings.port}`;
  } else {
    await stopServer();
    showStatus({ kind: 'connecting', url: settings.serverUrl });
    const check = await checkServer(settings.serverUrl);
    if (run !== launchRun) return;
    if (!check.ok) return showError(check.reason, '', false);
    appOrigin = settings.serverUrl;
  }
  refreshChrome();
  await win?.loadURL(appOrigin).catch(() => undefined);
}

function openSettings() {
  if (settings.mode === null) return showWindow();
  if (settingsWin) return settingsWin.focus();
  showWindow();
  settingsWin = new BrowserWindow({
    parent: win ?? undefined,
    modal: process.platform !== 'linux',
    width: 640,
    height: 740,
    minWidth: 520,
    minHeight: 560,
    show: false,
    title: t['setup.settingsTitle'],
    autoHideMenuBar: true,
    minimizable: false,
    backgroundColor: backgroundColor(),
    webPreferences: { preload: paths.preload, contextIsolation: true, sandbox: true },
  });
  settingsWin.setMenu(null);
  settingsWin.once('ready-to-show', () => settingsWin?.show());
  settingsWin.on('closed', () => (settingsWin = null));
  void settingsWin.loadFile(paths.ui('setup.html'));
}

function showAbout() {
  void dialog.showMessageBox(win ?? new BrowserWindow({ show: false }), {
    type: 'info',
    title: format(t['menu.about'], {}),
    message: appName,
    detail: format(t['about.detail'], {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    }),
    icon: nativeImage.createFromPath(paths.asset('icon.png')).resize({ width: 64 }),
  });
}

type SaveResult = { ok: true; restarting?: boolean } | { ok: false; field: 'port' | 'url'; message: string };

async function validate(raw: unknown): Promise<{ input: SetupInput } | { error: SaveResult }> {
  const r = (raw ?? {}) as Partial<Record<keyof SetupInput, unknown>>;
  const mode = r.mode === 'host' || r.mode === 'connect' ? r.mode : null;
  if (!mode) return { error: { ok: false, field: 'url', message: errorMessage('invalid_url') } };
  const port = Number(r.port);
  if (mode === 'host' && !isValidPort(port)) return { error: { ok: false, field: 'port', message: errorMessage('invalid_port') } };
  let serverUrl = settings.serverUrl;
  if (mode === 'connect') {
    const origin = normalizeServerUrl(String(r.serverUrl ?? ''));
    if (!origin) return { error: { ok: false, field: 'url', message: errorMessage('invalid_url') } };
    const check = await checkServer(origin);
    if (!check.ok) return { error: { ok: false, field: 'url', message: errorMessage(check.reason, origin) } };
    serverUrl = origin;
  }
  return {
    input: {
      mode,
      serverUrl,
      port: mode === 'host' ? port : settings.port,
      lan: mode === 'host' ? r.lan === true : settings.lan,
      demo: mode === 'host' ? r.demo === true : settings.demo,
      closeToTray: r.closeToTray !== false,
      autostart: r.autostart === true,
    },
  };
}

function registerIpc() {
  const fromShell = (e: IpcMainEvent | IpcMainInvokeEvent) => !!e.senderFrame && isLocalPage(e.senderFrame.url);

  ipcMain.handle('ui:init', (e) => {
    if (!fromShell(e)) return null;
    return {
      appName,
      version: app.getVersion(),
      platform: process.platform,
      strings: t,
      firstRun: settings.mode === null,
      settings: {
        mode: settings.mode,
        serverUrl: settings.serverUrl,
        port: settings.port,
        lan: settings.lan,
        demo: settings.demo,
        closeToTray: settings.closeToTray,
        autostart: settings.mode === null ? settings.autostart : autostartEnabled(),
      },
      databaseExists: existsSync(databaseFile()),
      lanAddresses: lanAddresses(),
      status,
    };
  });

  ipcMain.handle('setup:test', async (e, url: unknown) => {
    if (!fromShell(e)) return null;
    const origin = normalizeServerUrl(String(url ?? ''));
    if (!origin) return { ok: false, message: errorMessage('invalid_url') };
    const check = await checkServer(origin);
    return check.ok
      ? { ok: true, origin, message: format(t['setup.ok'], { url: origin }) }
      : { ok: false, message: errorMessage(check.reason, origin) };
  });

  ipcMain.handle('setup:save', async (e, raw: unknown): Promise<SaveResult | null> => {
    if (!fromShell(e)) return null;
    const result = await validate(raw);
    if ('error' in result) return result.error;
    const before = { ...settings };
    settings = { ...settings, ...result.input };
    if (settings.autostart !== before.autostart || before.mode === null) setAutostart(settings.autostart);
    persist();

    const needsOrigin = insecureOriginToAllow(settings.mode === 'connect' ? settings.serverUrl : null);
    if (needsOrigin !== allowedInsecureOrigin) {
      app.relaunch();
      setImmediate(() => app.quit());
      return { ok: true, restarting: true };
    }
    settingsWin?.close();
    const connectionChanged =
      before.mode !== settings.mode ||
      (settings.mode === 'host' && (before.port !== settings.port || before.lan !== settings.lan)) ||
      (settings.mode === 'connect' && before.serverUrl !== settings.serverUrl);
    if (connectionChanged) void launch();
    refreshChrome();
    return { ok: true };
  });

  ipcMain.on('setup:cancel', (e) => {
    if (fromShell(e)) settingsWin?.close();
  });
  ipcMain.on('status:retry', (e) => {
    if (fromShell(e)) void launch();
  });
  ipcMain.on('status:settings', (e) => {
    if (fromShell(e)) openSettings();
  });
  ipcMain.on('status:log', (e) => {
    if (fromShell(e)) void shell.openPath(serverLogFile());
  });
  ipcMain.on('app:focus', (e) => {
    const target = BrowserWindow.fromWebContents(e.sender);
    if (target === win) showWindow();
    else target?.focus();
  });
}

app.on('activate', () => showWindow());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  quitting = true;
  if (!serverRunning()) return;
  // Stop the server cleanly so SQLite is closed before the app goes away.
  event.preventDefault();
  void stopServer().finally(() => app.quit());
});
