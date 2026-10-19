import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  nativeTheme,
  screen,
  shell,
  systemPreferences,
  type Session,
  type WebContents,
} from 'electron';
import { pathToFileURL } from 'node:url';
import { paths } from './paths';
import type { WindowBounds } from './settings';

const ALLOWED_PERMISSIONS = new Set([
  'media',
  'display-capture',
  'notifications',
  'fullscreen',
  'clipboard-read',
  'clipboard-sanitized-write',
  'speaker-selection',
]);

const uiOrigin = pathToFileURL(paths.ui('')).href;

/** The shell's own pages (setup, status, screen picker); only they get the full bridge. */
export function isLocalPage(url: string) {
  return url.startsWith(uiOrigin);
}

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function openExternally(url: string) {
  if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url);
}

export function backgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#17171c' : '#ebebf3';
}

/** Restores the last size and position, but only onto a display that still exists. */
function visibleBounds(b: WindowBounds) {
  if (b.x === undefined || b.y === undefined) return { width: b.width, height: b.height };
  const onScreen = screen.getAllDisplays().some(({ workArea: a }) => {
    return b.x! < a.x + a.width - 100 && b.x! + b.width > a.x + 100 && b.y! >= a.y - 10 && b.y! < a.y + a.height - 100;
  });
  return onScreen ? { x: b.x, y: b.y, width: b.width, height: b.height } : { width: b.width, height: b.height };
}

export function createMainWindow(bounds: WindowBounds, title: string, onBoundsChange: (b: WindowBounds) => void) {
  const win = new BrowserWindow({
    ...visibleBounds(bounds),
    minWidth: 800,
    minHeight: 560,
    title,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: backgroundColor(),
    icon: paths.asset('icon.png'),
    webPreferences: {
      preload: paths.preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  if (bounds.maximized) win.maximize();

  let timer: NodeJS.Timeout | undefined;
  const remember = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized()) return;
      const maximized = win.isMaximized();
      const b = maximized ? win.getNormalBounds() : win.getBounds();
      onBoundsChange({ ...b, maximized });
    }, 500);
  };
  for (const event of ['resize', 'move', 'maximize', 'unmaximize'] as const) win.on(event as 'resize', remember);
  return win;
}

/** Keeps a window on the app's origin: other links open in the browser, popups of the app stay in-app. */
export function guardNavigation(contents: WebContents, appOrigin: () => string | null) {
  contents.on('will-navigate', (event, url) => {
    if (isLocalPage(url) || originOf(url) === appOrigin()) return;
    event.preventDefault();
    openExternally(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (originOf(url) === appOrigin()) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: backgroundColor(),
          webPreferences: { preload: paths.preload, contextIsolation: true, sandbox: true },
        },
      };
    }
    openExternally(url);
    return { action: 'deny' };
  });
}

/**
 * Permissions only for the app's own origin. macOS additionally asks the user once for camera and
 * microphone access; screen sharing goes through the system picker (macOS 15+) or the shell's own picker.
 */
export function secureSession(ses: Session, appOrigin: () => string | null, pickerParent: () => BrowserWindow | null) {
  const fromApp = (url: string | undefined) => !!url && originOf(url) === appOrigin();

  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && originOf(requestingOrigin) === appOrigin();
  });

  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    if (!ALLOWED_PERMISSIONS.has(permission) || !fromApp(details.requestingUrl)) return callback(false);
    if (permission !== 'media' || process.platform !== 'darwin') return callback(true);
    const types = 'mediaTypes' in details ? (details.mediaTypes ?? []) : [];
    void (async () => {
      let granted = true;
      if (types.includes('video')) granted &&= await systemPreferences.askForMediaAccess('camera');
      if (types.includes('audio')) granted &&= await systemPreferences.askForMediaAccess('microphone');
      callback(granted);
    })();
  });

  ses.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (!fromApp(request.securityOrigin)) return callback({});
      void pickSource(pickerParent()).then((source) => callback(source ? { video: source } : {}));
    },
    { useSystemPicker: true },
  );
}

export interface PickerSource {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  thumbnail: string;
}

let pickerOpen = false;

async function pickSource(parent: BrowserWindow | null) {
  if (pickerOpen) return null;
  pickerOpen = true;
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    });
    const ownWindows = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
    const list = sources.filter((s) => !ownWindows.has(s.id));
    const listed: PickerSource[] = list.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL(),
    }));

    const picker = new BrowserWindow({
      parent: parent ?? undefined,
      modal: !!parent,
      width: 760,
      height: 560,
      minWidth: 480,
      minHeight: 360,
      show: false,
      autoHideMenuBar: true,
      minimizable: false,
      backgroundColor: backgroundColor(),
      webPreferences: { preload: paths.preload, contextIsolation: true, sandbox: true },
    });
    picker.setMenu(null);
    const chosen = await new Promise<string | null>((resolve) => {
      const onSources = () => listed;
      const onChoose = (_e: unknown, id: unknown) => {
        resolve(typeof id === 'string' ? id : null);
        if (!picker.isDestroyed()) picker.close();
      };
      ipcMain.handle('picker:sources', onSources);
      ipcMain.once('picker:choose', onChoose);
      picker.once('closed', () => {
        ipcMain.removeHandler('picker:sources');
        ipcMain.removeListener('picker:choose', onChoose);
        resolve(null);
      });
      picker.once('ready-to-show', () => picker.show());
      void picker.loadFile(paths.ui('picker.html'));
    });
    return list.find((s) => s.id === chosen) ?? null;
  } finally {
    pickerOpen = false;
  }
}

