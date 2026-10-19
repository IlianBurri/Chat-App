import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import type { Strings } from './i18n';

export interface MenuActions {
  settings: () => void;
  copyAddress: (() => void) | null;
  openLog: (() => void) | null;
  openData: () => void;
  website: () => void;
  guide: () => void;
  about: () => void;
}

export function buildMenu(t: Strings, actions: MenuActions) {
  const mac = process.platform === 'darwin';
  const settings: MenuItemConstructorOptions = { label: t['menu.settings'], accelerator: 'CmdOrCtrl+,', click: actions.settings };
  const serverItems: MenuItemConstructorOptions[] = [
    ...(actions.copyAddress ? [{ label: t['menu.copyAddress'], click: actions.copyAddress }] : []),
    ...(actions.openLog ? [{ label: t['menu.openLog'], click: actions.openLog }] : []),
    { label: t['menu.openData'], click: actions.openData },
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: app.getName(),
            submenu: [
              { label: t['menu.about'], click: actions.about },
              { type: 'separator' },
              settings,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: t['menu.quit'] },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: t['menu.file'],
      submenu: mac
        ? serverItems
        : [settings, { type: 'separator' }, ...serverItems, { type: 'separator' }, { role: 'quit', label: t['menu.quit'] }],
    },
    { role: 'editMenu', label: t['menu.edit'] },
    {
      label: t['menu.view'],
      submenu: [
        { role: 'reload', label: t['menu.reload'] },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' } as const]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu', label: t['menu.window'] },
    {
      role: 'help',
      label: t['menu.help'],
      submenu: [
        { label: t['menu.website'], click: actions.website },
        { label: t['menu.guide'], click: actions.guide },
        ...(mac ? [] : [{ type: 'separator' } as const, { label: t['menu.about'], click: actions.about }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
