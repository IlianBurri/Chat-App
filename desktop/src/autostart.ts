import { app } from 'electron';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Started by the login item: open straight into the tray instead of showing the window. */
export const HIDDEN_ARG = '--hidden';

/** In development Electron needs the app folder as argument; a packaged app is its own executable. */
function launchArgs() {
  return app.isPackaged ? [HIDDEN_ARG] : [app.getAppPath(), HIDDEN_ARG];
}

function linuxEntry() {
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(configHome, 'autostart', `${app.getName().toLowerCase()}.desktop`);
}

export function startedHidden() {
  return process.argv.includes(HIDDEN_ARG) || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAsHidden);
}

/** Electron covers Windows and macOS; on Linux the XDG autostart folder is the common way. */
export function setAutostart(enabled: boolean) {
  if (process.platform === 'linux') {
    const file = linuxEntry();
    if (!enabled) return rmSync(file, { force: true });
    // An AppImage runs from a temporary mount; APPIMAGE is the path of the file itself.
    const exec = [process.env.APPIMAGE ?? process.execPath, ...launchArgs()].map((a) => `"${a}"`).join(' ');
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(
      file,
      ['[Desktop Entry]', 'Type=Application', `Name=${app.getName()}`, `Exec=${exec}`, 'X-GNOME-Autostart-enabled=true', ''].join('\n'),
    );
    return;
  }
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled, args: launchArgs() });
}

export function autostartEnabled() {
  if (process.platform === 'linux') return existsSync(linuxEntry());
  return app.getLoginItemSettings({ args: launchArgs() }).openAtLogin;
}
