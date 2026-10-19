/**
 * One preload for every window. The shell's own pages (file://…/ui/) get the setup/status/picker bridge;
 * the web app — possibly served by a remote server — only gets `halloDesktop` with harmless calls.
 * The main process checks the sender of every message again.
 */
import { contextBridge, ipcRenderer } from 'electron';

if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('shell', {
    init: () => ipcRenderer.invoke('ui:init'),
    testServer: (url: string) => ipcRenderer.invoke('setup:test', url),
    saveSetup: (input: unknown) => ipcRenderer.invoke('setup:save', input),
    cancelSetup: () => ipcRenderer.send('setup:cancel'),
    retry: () => ipcRenderer.send('status:retry'),
    openSettings: () => ipcRenderer.send('status:settings'),
    openLog: () => ipcRenderer.send('status:log'),
    pickerSources: () => ipcRenderer.invoke('picker:sources'),
    choose: (id: string | null) => ipcRenderer.send('picker:choose', id),
  });
} else {
  contextBridge.exposeInMainWorld('halloDesktop', {
    platform: process.platform,
    /** Brings the window to the front, also out of the tray (e.g. after a notification click). */
    focus: () => ipcRenderer.send('app:focus'),
  });
}
