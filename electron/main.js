import { app, BrowserWindow, screen, session, systemPreferences } from 'electron';
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
  // Electron denies getUserMedia by default; the wallpaper needs the mic (system audio via
  // a BlackHole loopback device) to react. Grant media; macOS still shows its own TCC prompt.
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'audioCapture');
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'audioCapture');
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, resizable: false, movable: false, fullscreenable: false,
    backgroundColor: '#0B1330',
    skipTaskbar: true,
    webPreferences: { preload: join(HERE, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.on('console-message', (event, level, message) => {
    const text = (message !== undefined) ? message : (event && event.message);
    if (text !== undefined) console.log('[renderer]', text);
  });
  // macOS: explicitly request mic access from the main process — the renderer's getUserMedia
  // alone often won't trigger the TCC prompt. Logs the status so we can diagnose.
  try {
    const before = systemPreferences.getMediaAccessStatus('microphone');
    console.log('[mic] TCC status before:', before);
    if (before !== 'granted') {
      const ok = await systemPreferences.askForMediaAccess('microphone');
      console.log('[mic] askForMediaAccess ->', ok, '| status now:', systemPreferences.getMediaAccessStatus('microphone'));
    }
  } catch (err) {
    console.log('[mic] askForMediaAccess error:', err && err.message ? err.message : err);
  }
  win.loadURL(server.url + '/?autoaudio');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { /* keep running (wallpaper); quit via tray in Task 6 */ });
  app.on('before-quit', async () => { if (server) await server.close(); });
}
