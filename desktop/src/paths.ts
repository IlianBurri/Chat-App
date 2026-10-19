import { app } from 'electron';
import { join } from 'node:path';

/**
 * Everything ships inside the app folder (no asar, see electron-builder.yml): the server bundle has to
 * find the native better-sqlite3 module in node_modules next to it, which an asar archive would hide.
 */
const root = app.getAppPath();

export const paths = {
  root,
  serverEntry: join(root, 'dist', 'server', 'server.mjs'),
  schemaFile: join(root, 'dist', 'server', 'schema.sql'),
  clientDir: join(root, 'dist', 'client'),
  preload: join(root, 'dist', 'preload.cjs'),
  ui: (page: string) => join(root, 'ui', page),
  asset: (name: string) => join(root, 'build', name),
  get data() {
    return app.getPath('userData');
  },
  get settingsFile() {
    return join(app.getPath('userData'), 'settings.json');
  },
};
