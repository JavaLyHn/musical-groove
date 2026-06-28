import { app, BrowserWindow, desktopCapturer, Menu, nativeImage, screen, session, systemPreferences, Tray } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAppServer } from './server.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');

// Packaged app: the now-playing bridge's perl script + framework live under Resources/
// (electron-builder extraResources), not the repo's vendor/. Point the bridge there before the
// server (which reads these envs) starts. In dev these stay unset -> repo paths are used.
if (app.isPackaged) {
  const adapterBase = join(process.resourcesPath, 'mediaremote-adapter');
  process.env.NOWPLAYING_SCRIPT = join(adapterBase, 'bin', 'mediaremote-adapter.pl');
  process.env.NOWPLAYING_FRAMEWORK = join(adapterBase, 'build', 'MediaRemoteAdapter.framework');
}

// The visualizer auto-connects system audio with no user gesture, so Web Audio must be allowed to
// start without one -> otherwise the AudioContext stays suspended and the analyser reads silence.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** @type {Awaited<ReturnType<typeof createAppServer>> | null} */
let server = null;
/** @type {BrowserWindow | null} */
let win = null;
let tray = null;

// 16x16 monochrome "equalizer bars" template PNG (alpha = shape; macOS recolors it).
const TRAY_IMG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR42mNgGKzgPxIepgYQtID+BqALDD4DCFowagAFBgAAkBR0jNF3Gp4AAAAASUVORK5CYII=';

async function cmd(id) {
  try { if (server) await fetch(`${server.url}/__cmd?id=${id}`); } catch { /* ignore */ }
}

function buildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: '上一首', click: () => cmd(5) },
    { label: '播放 / 暂停', click: () => cmd(2) },
    { label: '下一首', click: () => cmd(4) },
    { type: 'separator' },
    { label: '开机自启', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (mi) => app.setLoginItemSettings({ openAtLogin: mi.checked }) },
    { type: 'separator' },
    { label: '退出 Musical Groove（⌘Q）', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  if (tray) return;
  try {
    const img = nativeImage.createFromBuffer(Buffer.from(TRAY_IMG_B64, 'base64'));
    img.setTemplateImage(true);
    tray = new Tray(img);
    tray.setTitle('♪');
    tray.setToolTip('Musical Groove');
    buildTrayMenu();
  } catch (e) { console.log('[tray] createTray failed:', e && e.message ? e.message : e); }
}

async function createWindow() {
  server = await createAppServer({ distDir: DIST, log: (m) => console.log('[server]', m) });

  // Electron denies getUserMedia/getDisplayMedia by default; the visualizer needs the system-audio
  // loopback to react. Grant media; macOS still shows its own TCC prompt.
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'audioCapture');
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'audioCapture');
  // System-audio loopback via ScreenCaptureKit (needs macOS Screen Recording permission). Auto-pick
  // the primary screen + request the audio loopback track; the renderer drops the video track and
  // feeds only the audio to the analyser.
  ses.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (!sources.length) { console.log('[loopback] no screen sources — grant Screen Recording, then relaunch'); callback({}); return; }
      callback({ video: sources[0], audio: 'loopback' });
    }, (err) => { console.log('[loopback] getSources failed (Screen Recording not granted?):', err && err.message ? err.message : err); callback({}); });
  }, { useSystemPicker: false });

  const disp = screen.getPrimaryDisplay();
  const { bounds } = disp;
  // Top safe-inset (menu-bar / notch height) passed to the page as a fallback for
  // env(safe-area-inset-top), so the centered now-playing card never hides under the camera notch.
  const safeTop = Math.max(0, disp.workArea.y - disp.bounds.y);
  win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, resizable: false, movable: false, backgroundColor: '#0B1330',
    webPreferences: { preload: join(HERE, 'preload.js'), contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' },
  });
  // TRUE FULLSCREEN foreground display: the animation fills the ENTIRE screen (over the menu bar +
  // Dock, which simple-fullscreen hides), in the CURRENT Space — a real fullscreen visualizer, not a
  // behind-everything wallpaper. The whole window is interactive (the now-playing card just works),
  // and we never touch the user's desktop icons / widgets / wallpaper. Quit with ⌘Q, the Dock icon,
  // or the tray; ⌘-Tab switches to other apps (they overlay it) and switching back returns here.
  win.setSimpleFullScreen(true);

  win.webContents.on('console-message', (e) => { if (e && e.message) console.log('[renderer]', e.message); });

  // macOS: explicitly request mic access from the main process (some setups won't surface the TCC
  // prompt from the renderer alone). The Electron audio path uses the screen loopback, not the mic,
  // so this is best-effort and non-fatal.
  try {
    const before = systemPreferences.getMediaAccessStatus('microphone');
    if (before !== 'granted') await systemPreferences.askForMediaAccess('microphone');
  } catch (err) { console.log('[mic] askForMediaAccess error:', err && err.message ? err.message : err); }
  console.log('[screen] TCC status:', systemPreferences.getMediaAccessStatus('screen'));

  win.loadURL(`${server.url}/?autoaudio&safetop=${safeTop}`);
  win.webContents.once('did-finish-load', () => createTray());
  win.on('closed', () => { win = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.whenReady().then(() => createWindow());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', async () => { if (server) await server.close(); });
}
