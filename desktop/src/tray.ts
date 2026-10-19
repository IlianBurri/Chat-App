import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import { format, type Strings } from './i18n';
import { paths } from './paths';

export interface TrayState {
  unread: number;
  /** host mode: address colleagues use, or null when the server only listens locally */
  serverAddress: string | null;
  hosting: boolean;
  autostart: boolean;
}

export interface TrayActions {
  open: () => void;
  copyAddress: () => void;
  toggleAutostart: (enabled: boolean) => void;
  settings: () => void;
  quit: () => void;
}

/** macOS uses a monochrome template image in the menu bar; Windows and Linux use the coloured logo. */
function icon(unread: boolean) {
  if (process.platform === 'darwin') {
    const image = nativeImage.createFromPath(paths.asset(unread ? 'trayUnreadTemplate.png' : 'trayTemplate.png'));
    image.setTemplateImage(true);
    return image;
  }
  const image = nativeImage.createFromPath(paths.asset(unread ? 'tray-unread.png' : 'tray.png'));
  return process.platform === 'win32' ? image.resize({ width: 16, height: 16, quality: 'best' }) : image;
}

export function createTray(appName: string, t: Strings, actions: TrayActions) {
  const tray = new Tray(icon(false));
  let unreadShown = false;
  // Windows and most Linux desktops open the app on click; macOS shows the menu.
  if (process.platform !== 'darwin') tray.on('click', actions.open);

  const update = (state: TrayState) => {
    const hasUnread = state.unread > 0;
    if (hasUnread !== unreadShown) {
      tray.setImage(icon(hasUnread));
      unreadShown = hasUnread;
    }
    tray.setToolTip(hasUnread ? format(t['tray.unread'], { count: state.unread }) : appName);
    const items: MenuItemConstructorOptions[] = [{ label: t['tray.open'], click: actions.open }, { type: 'separator' }];
    if (state.hosting) {
      items.push({
        label: state.serverAddress ? format(t['tray.serverRunning'], { address: state.serverAddress }) : t['tray.serverLocal'],
        enabled: false,
      });
      if (state.serverAddress) items.push({ label: t['menu.copyAddress'], click: actions.copyAddress });
      items.push({ type: 'separator' });
    }
    items.push(
      { label: t['tray.autostart'], type: 'checkbox', checked: state.autostart, click: (item) => actions.toggleAutostart(item.checked) },
      { label: t['menu.settings'], click: actions.settings },
      { type: 'separator' },
      { label: t['menu.quit'], click: actions.quit },
    );
    tray.setContextMenu(Menu.buildFromTemplate(items));
  };

  return { tray, update };
}
