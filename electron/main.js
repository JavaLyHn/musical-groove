import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, nativeImage, screen, session, systemPreferences, Tray } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createAppServer } from './server.js';

const require = createRequire(import.meta.url);
let nativeWallpaper = null;
try { nativeWallpaper = require('../build/Release/wallpaper.node'); }
catch (e) { console.log('[wallpaper] native addon unavailable:', e && e.message ? e.message : e); }

function setWallpaperLevel(w) {
  try { if (nativeWallpaper) nativeWallpaper.setDesktopLevel(w.getNativeWindowHandle()); }
  catch (e) { console.log('[wallpaper] setDesktopLevel failed:', e && e.message ? e.message : e); }
  // Click-through to the Finder desktop/icons, but FORWARD mouse-move so the renderer can detect
  // when the pointer is over the now-playing card and request a momentary clickable region.
  w.setIgnoreMouseEvents(true, { forward: true });
}
function setNormalLevel(w) {
  try { if (nativeWallpaper) nativeWallpaper.setNormalLevel(w.getNativeWindowHandle()); }
  catch (e) { console.log('[wallpaper] setNormalLevel failed:', e && e.message ? e.message : e); }
  w.setIgnoreMouseEvents(false);
  w.focus();
}

// Hide macOS desktop clutter (Finder icons/files via com.apple.finder CreateDesktop AND desktop
// widgets via com.apple.WindowManager Standard/StageManagerHideWidgets) for a clean wallpaper
// canvas, and ALWAYS put it back. These are GLOBAL system settings that outlive the app, so the
// restore must be bulletproof: we persist the user's TRUE originals to a flag file the instant we
// hide, restore on every exit path (quit / Ctrl-C / SIGTERM), and if a run ever dies without
// restoring, the next launch reads the flag (not our own hidden state) and restores from it.
// macOS only.
function readDefault(/** @type {string} */ domain, /** @type {string} */ key, /** @type {string} */ fallback) {
  try { return execSync(`defaults read ${domain} ${key} 2>/dev/null`).toString().trim(); }
  catch { return fallback; }
}
let _flagPath = '';   // userData/desktop-restore.json — exists iff WE currently have the desktop hidden
let _orig = { icons: '1', stdWidgets: '0', stageWidgets: '0' }; // user's true originals
let desktopHidden = false;
let _restored = true; // guards restore so the several exit signals each run it at most once

// Capture the user's originals: prefer a leftover flag (a prior run hid + maybe didn't restore, so
// the live system state could be OUR hidden state, not theirs); otherwise read the live state.
function loadDesktopOriginals() {
  try { _orig = JSON.parse(readFileSync(_flagPath, 'utf8')); return; } catch { /* no flag */ }
  _orig = {
    icons: readDefault('com.apple.finder', 'CreateDesktop', '1'),                 // unset/1 = icons shown
    stdWidgets: readDefault('com.apple.WindowManager', 'StandardHideWidgets', '0'),
    stageWidgets: readDefault('com.apple.WindowManager', 'StageManagerHideWidgets', '0'),
  };
}
function applyDesktop(/** @type {boolean} */ hidden) {
  const b = (/** @type {boolean} */ v) => (v ? 'true' : 'false');
  try {
    if (hidden) {
      execSync('defaults write com.apple.finder CreateDesktop -bool false');               // hide icons/files
      execSync('defaults write com.apple.WindowManager StandardHideWidgets -bool true');     // hide desktop widgets
      execSync('defaults write com.apple.WindowManager StageManagerHideWidgets -bool true');
    } else { // restore exactly what the user had
      execSync(`defaults write com.apple.finder CreateDesktop -bool ${b(_orig.icons !== '0')}`);
      execSync(`defaults write com.apple.WindowManager StandardHideWidgets -bool ${b(_orig.stdWidgets === '1')}`);
      execSync(`defaults write com.apple.WindowManager StageManagerHideWidgets -bool ${b(_orig.stageWidgets === '1')}`);
    }
    execSync('killall Finder');        // relaunch Finder so the icon change applies now
    execSync('killall WindowManager'); // relaunch WindowManager so the widget change applies now
  } catch (e) { console.log('[clean-desktop] apply failed:', e && e.message ? e.message : e); }
}
function setDesktopHidden(/** @type {boolean} */ hidden) {
  desktopHidden = hidden;
  if (hidden) {
    try { writeFileSync(_flagPath, JSON.stringify(_orig)); } catch (e) { console.log('[clean-desktop] flag write failed:', e && e.message ? e.message : e); }
    _restored = false;
    applyDesktop(true);
  } else {
    restoreDesktop();
  }
}
// Idempotent: restores the user's originals and clears the flag, at most once per hidden session.
function restoreDesktop() {
  if (_restored) return;
  _restored = true;
  applyDesktop(false);
  try { rmSync(_flagPath, { force: true }); } catch { /* */ }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');

// In the packaged app the now-playing bridge's perl script + framework live under Resources/
// (electron-builder extraResources), not the repo's vendor/. Point the bridge there before the
// server (which reads these envs) starts. In dev these stay unset → repo paths are used.
if (app.isPackaged) {
  const adapterBase = join(process.resourcesPath, 'mediaremote-adapter');
  process.env.NOWPLAYING_SCRIPT = join(adapterBase, 'bin', 'mediaremote-adapter.pl');
  process.env.NOWPLAYING_FRAMEWORK = join(adapterBase, 'build', 'MediaRemoteAdapter.framework');
}

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
let hotRect = null;        // now-playing card rect (CSS px, viewport-relative) or null when hidden
let hotInteractive = false;// tracks whether the poll currently has the window clickable
let hotPoll = null;        // cursor-poll interval handle

// Make the window clickable only while the global cursor is over the reported card rect; otherwise
// keep it click-through (forwarding move events). Wallpaper mode only.
function pollHotRect() {
  if (!win || win.isDestroyed() || mode !== 'wallpaper') return;
  let inside = false;
  if (hotRect) {
    const b = win.getBounds();
    const p = screen.getCursorScreenPoint();
    inside = p.x >= b.x + hotRect.x && p.x <= b.x + hotRect.x + hotRect.w &&
             p.y >= b.y + hotRect.y && p.y <= b.y + hotRect.y + hotRect.h;
  }
  if (inside === hotInteractive) return; // only flip on a real change
  hotInteractive = inside;
  win.setIgnoreMouseEvents(!inside, { forward: true });
}
// 16x16 monochrome "equalizer bars" template PNG (alpha = shape; macOS recolors it). A real
// branded icon is a later optional task. A ♪ title is shown next to it as well.
const TRAY_IMG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR42mNgGKzgPxIepgYQtID+BqALDD4DCFowagAFBgAAkBR0jNF3Gp4AAAAASUVORK5CYII=';

function setMode(next) {
  if (!win) return;
  mode = next;
  hotInteractive = false; // the level fns just (re)set the ignore state; keep the poll's tracking in sync
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
  // In wallpaper mode, let the renderer make the window momentarily clickable while the pointer is
  // over an interactive overlay (the now-playing card); otherwise keep click-through. No-op in
  // settings mode, where the whole window is already interactive.
  ipcMain.on('wallpaper:set-interactive', (_e, on) => {
    if (win && mode === 'wallpaper') win.setIgnoreMouseEvents(!on, { forward: true });
  });
  // Robust click-through toggle: the renderer reports the now-playing card's viewport rect (CSS px,
  // or null when hidden); we poll the GLOBAL cursor against it and flip the window between
  // click-through and clickable. This doesn't depend on the window receiving forwarded mouse-move
  // events (which a desktop-level window may not), so the card is reliably clickable in wallpaper
  // mode. No-op in settings mode, where the whole window is already interactive.
  ipcMain.on('wallpaper:hot-rect', (_e, rect) => { hotRect = rect || null; });
  if (!hotPoll) hotPoll = setInterval(pollHotRect, 90);
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
  win.on('closed', () => { win = null; if (hotPoll) { clearInterval(hotPoll); hotPoll = null; } });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.whenReady().then(() => {
    _flagPath = join(app.getPath('userData'), 'desktop-restore.json');
    loadDesktopOriginals();   // capture true originals, or recover them from a leftover flag
    createWindow();
    setDesktopHidden(true);   // clean canvas: hide desktop icons + widgets by default
  });
  app.on('window-all-closed', () => { /* keep running (wallpaper); quit via tray */ });
  // Restore on EVERY exit path so a hidden desktop is never left behind.
  app.on('before-quit', async () => { if (hotPoll) { clearInterval(hotPoll); hotPoll = null; } restoreDesktop(); if (server) await server.close(); });
  app.on('will-quit', () => restoreDesktop());
  // Ctrl-C in the dev terminal / `kill` send a signal that skips before-quit — restore then exit.
  const onSignal = () => { restoreDesktop(); process.exit(0); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('SIGHUP', onSignal);
}
