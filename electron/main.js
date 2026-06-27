import { app, BrowserWindow, desktopCapturer, Menu, nativeImage, screen, session, systemPreferences, Tray } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { createAppServer } from './server.js';

const require = createRequire(import.meta.url);
let nativeWallpaper = null;
try { nativeWallpaper = require('../build/Release/wallpaper.node'); }
catch (e) { console.log('[wallpaper] native addon unavailable:', e && e.message ? e.message : e); }

function setWallpaperLevel(w) {
  try { if (nativeWallpaper) nativeWallpaper.setDesktopLevel(w.getNativeWindowHandle()); }
  catch (e) { console.log('[wallpaper] setDesktopLevel failed:', e && e.message ? e.message : e); }
  w.setIgnoreMouseEvents(true); // clicks pass through to the Finder desktop/icons
}
function setNormalLevel(w) {
  try { if (nativeWallpaper) nativeWallpaper.setNormalLevel(w.getNativeWindowHandle()); }
  catch (e) { console.log('[wallpaper] setNormalLevel failed:', e && e.message ? e.message : e); }
  w.setIgnoreMouseEvents(false);
  w.focus();
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');

// The wallpaper auto-connects system audio with no user to click, so Web Audio must be
// allowed to start without a gesture — otherwise the AudioContext stays suspended and the
// analyser reads silence (pillars don't react).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** @type {Awaited<ReturnType<typeof createAppServer>> | null} */
let server = null;
/** @type {BrowserWindow | null} */
let win = null;

let tray = null;
let mode = 'wallpaper';
// 1x1 transparent PNG — the visible tray mark is the ♪ title; a real icon is a later optional task.
const TRAY_IMG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function setMode(next) {
  if (!win) return;
  mode = next;
  if (next === 'settings') setNormalLevel(win); else setWallpaperLevel(win);
  win.webContents.send('wallpaper:mode', next);
  buildTrayMenu();
}

async function cmd(id) {
  try { if (server) await fetch(`${server.url}/__cmd?id=${id}`); } catch { /* ignore */ }
}

function buildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: mode === 'settings' ? '✓ 设置模式（点此返回壁纸）' : '设置…',
      click: () => setMode(mode === 'settings' ? 'wallpaper' : 'settings') },
    { type: 'separator' },
    { label: '上一首', click: () => cmd(5) },
    { label: '播放 / 暂停', click: () => cmd(2) },
    { label: '下一首', click: () => cmd(4) },
    { type: 'separator' },
    { label: '开机自启', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (mi) => app.setLoginItemSettings({ openAtLogin: mi.checked }) },
    { label: '退出声音星球', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  const img = nativeImage.createFromBuffer(Buffer.from(TRAY_IMG_B64, 'base64'));
  img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setTitle('♪');
  tray.setToolTip('声音星球');
  buildTrayMenu();
}

async function createWindow() {
  server = await createAppServer({ distDir: DIST, log: (m) => console.log('[server]', m) });
  // Electron denies getUserMedia by default; the wallpaper needs the mic (system audio via
  // a BlackHole loopback device) to react. Grant media; macOS still shows its own TCC prompt.
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'audioCapture');
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'audioCapture');
  // System-audio loopback via ScreenCaptureKit: auto-select the primary screen source and
  // request the audio loopback track — no picker shown. The renderer drops the video track
  // immediately; only the audio loopback feeds the analyser. Requires macOS Screen Recording
  // permission (TCC), which the OS prompts for on first use.
  ses.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (!sources.length) {
        console.log('[loopback] no screen sources — grant Screen Recording to Electron in System Settings, then relaunch');
        callback({});
        return;
      }
      callback({ video: sources[0], audio: 'loopback' }); // system audio loopback (macOS ScreenCaptureKit)
    }, (err) => {
      console.log('[loopback] getSources failed (Screen Recording likely not granted):', err && err.message ? err.message : err);
      callback({});
    });
  }, { useSystemPicker: false });
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, resizable: false, movable: false, fullscreenable: false,
    backgroundColor: '#0B1330',
    skipTaskbar: true,
    webPreferences: { preload: join(HERE, 'preload.js'), contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.webContents.on('console-message', (e) => { if (e && e.message) console.log('[renderer]', e.message); });
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
  console.log('[screen] TCC status:', systemPreferences.getMediaAccessStatus('screen'));
  win.loadURL(server.url + '/?autoaudio');
  win.webContents.once('did-finish-load', () => { setWallpaperLevel(win); createTray(); });
  win.on('blur', () => { if (mode === 'settings') setMode('wallpaper'); });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { /* keep running (wallpaper); quit via tray in Task 6 */ });
  app.on('before-quit', async () => { if (server) await server.close(); });
}
