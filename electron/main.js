import { app, BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAppServer } from './server.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');

/** @type {Awaited<ReturnType<typeof createAppServer>> | null} */
let server = null;
/** @type {BrowserWindow | null} */
let win = null;

async function createWindow() {
  server = await createAppServer({ distDir: DIST, log: (m) => console.log('[server]', m) });
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, resizable: false, movable: false, fullscreenable: false,
    backgroundColor: '#0B1330',
    skipTaskbar: true,
    webPreferences: { preload: join(HERE, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(server.url + '/');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { /* keep running (wallpaper); quit via tray in Task 6 */ });
  app.on('before-quit', async () => { if (server) await server.close(); });
}
