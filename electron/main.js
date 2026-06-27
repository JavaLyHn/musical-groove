import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, nativeImage, screen, session, systemPreferences, Tray } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
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

// Hide/show ALL macOS desktop clutter for a clean wallpaper canvas: Finder icons/files
// (com.apple.finder CreateDesktop) AND desktop widgets (com.apple.WindowManager
// Standard/StageManagerHideWidgets — widgets are a separate process, not Finder). The wallpaper
// hides them by default; the tray toggles it; quitting restores the user's ORIGINAL settings
// (captured once below) so nothing is left altered. Global system settings; macOS only.
/** @param {string} domain @param {string} key @param {string} fallback */
function readDefault(domain, key, fallback) {
  try { return execSync(`defaults read ${domain} ${key} 2>/dev/null`).toString().trim(); }
  catch { return fallback; }
}
const _origDesktop = {
  icons: readDefault('com.apple.finder', 'CreateDesktop', '1'),                 // unset/1 = icons shown
  stdWidgets: readDefault('com.apple.WindowManager', 'StandardHideWidgets', '0'),
  stageWidgets: readDefault('com.apple.WindowManager', 'StageManagerHideWidgets', '0'),
};
let desktopHidden = false;
function setDesktopHidden(hidden) {
  desktopHidden = hidden;
  const b = (/** @type {boolean} */ v) => (v ? 'true' : 'false');
  try {
    if (hidden) {
      execSync('defaults write com.apple.finder CreateDesktop -bool false');               // hide icons/files
      execSync('defaults write com.apple.WindowManager StandardHideWidgets -bool true');     // hide desktop widgets
      execSync('defaults write com.apple.WindowManager StageManagerHideWidgets -bool true');
    } else { // restore exactly what the user had
      execSync(`defaults write com.apple.finder CreateDesktop -bool ${b(_origDesktop.icons !== '0')}`);
      execSync(`defaults write com.apple.WindowManager StandardHideWidgets -bool ${b(_origDesktop.stdWidgets === '1')}`);
      execSync(`defaults write com.apple.WindowManager StageManagerHideWidgets -bool ${b(_origDesktop.stageWidgets === '1')}`);
    }
    execSync('killall Finder');        // relaunch Finder so icon change applies now
    execSync('killall WindowManager'); // relaunch WindowManager so widget change applies now
  } catch (e) { console.log('[clean-desktop] toggle failed:', e && e.message ? e.message : e); }
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
// 16x16 monochrome "equalizer bars" template PNG (alpha = shape; macOS recolors it). A real
// branded icon is a later optional task. A ♪ title is shown next to it as well.
const TRAY_IMG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR42mNgGKzgPxIepgYQtID+BqALDD4DCFowagAFBgAAkBR0jNF3Gp4AAAAASUVORK5CYII=';

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
  const cur = mode; // capture build-time mode so a blur between build and click can't race the toggle
  const menu = Menu.buildFromTemplate([
    { label: cur === 'settings' ? '✓ 设置模式（点此返回壁纸）' : '设置…',
      click: () => setMode(cur === 'settings' ? 'wallpaper' : 'settings') },
    { type: 'separator' },
    { label: '上一首', click: () => cmd(5) },
    { label: '播放 / 暂停', click: () => cmd(2) },
    { label: '下一首', click: () => cmd(4) },
    { type: 'separator' },
    { label: '开机自启', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (mi) => app.setLoginItemSettings({ openAtLogin: mi.checked }) },
    { label: '隐藏桌面图标和小组件', type: 'checkbox', checked: desktopHidden,
      click: () => { setDesktopHidden(!desktopHidden); buildTrayMenu(); } },
    { label: '退出 Musical Groove', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  if (tray) return; // defensive: only one tray for the app's lifetime
  try {
    const img = nativeImage.createFromBuffer(Buffer.from(TRAY_IMG_B64, 'base64'));
    img.setTemplateImage(true);
    console.log('[tray] image empty?', img.isEmpty(), 'size', JSON.stringify(img.getSize()));
    tray = new Tray(img);
    tray.setTitle('♪');
    tray.setToolTip('Musical Groove');
    buildTrayMenu();
    console.log('[tray] created');
  } catch (e) {
    console.log('[tray] createTray failed:', e && e.message ? e.message : e);
  }
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
  ipcMain.on('wallpaper:exit-settings', () => { if (mode === 'settings') setMode('wallpaper'); });
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
  win.webContents.once('did-finish-load', () => { console.log('[tray] did-finish-load → createTray'); setWallpaperLevel(win); createTray(); });
  win.on('blur', () => { if (mode === 'settings') setMode('wallpaper'); });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.whenReady().then(() => { createWindow(); setDesktopHidden(true); }); // clean canvas: hide desktop icons + widgets by default
  app.on('window-all-closed', () => { /* keep running (wallpaper); quit via tray */ });
  app.on('before-quit', async () => { setDesktopHidden(false); if (server) await server.close(); }); // restore the desktop on exit
}
