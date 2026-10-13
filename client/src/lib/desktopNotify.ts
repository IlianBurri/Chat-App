import { navigateTo } from './links';
import { previewText } from './format';

export interface AlertContext {
  /** The user switched desktop notifications on in the settings */
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  /** Own status is "Do not disturb" */
  doNotDisturb: boolean;
  /** The chat or channel is muted */
  muted: boolean;
  /** The content mentions the user (breaks through muting) */
  mentioned: boolean;
  /** The window has focus and shows this very chat or channel */
  watching: boolean;
}

/** Whether new content should pop up as a desktop notification. */
export function shouldAlert(c: AlertContext): boolean {
  if (!c.enabled || c.permission !== 'granted' || c.doNotDisturb || c.watching) return false;
  return !c.muted || c.mentioned;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** Whether the window has focus and shows the given route (pathname, without query). */
export function isWatching(pathname: string) {
  return document.visibilityState === 'visible' && document.hasFocus() && window.location.pathname === pathname;
}

/** Plain "@Name" mention of a person in markdown content (the composer inserts full names). */
export function mentionsName(content: string, name: string) {
  const at = content.toLocaleLowerCase().indexOf(`@${name.toLocaleLowerCase()}`);
  if (at < 0) return false;
  const after = content[at + name.length + 1] ?? '';
  return !/[\p{L}\p{N}_]/u.test(after);
}

/** Shows a desktop notification; clicking it focuses the app and opens `path`. */
export function showDesktopNotification(input: { title: string; body: string; tag: string; path: string }) {
  try {
    const notification = new Notification(input.title, {
      body: previewText(input.body).slice(0, 180),
      tag: input.tag,
      icon: '/favicon.svg',
    });
    notification.onclick = () => {
      window.focus();
      navigateTo(input.path);
      notification.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker; badges still work there.
  }
}
