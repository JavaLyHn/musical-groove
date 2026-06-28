const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('__wallpaper__', {
  isElectron: true,
  onMode: (cb) => { ipcRenderer.on('wallpaper:mode', (_e, mode) => { try { cb(mode); } catch { /* */ } }); },
  exitSettings: () => ipcRenderer.send('wallpaper:exit-settings'),
  setInteractive: (on) => ipcRenderer.send('wallpaper:set-interactive', !!on),
  // Report the now-playing card's live viewport rect (CSS px) so the main process can poll the
  // global cursor against it and make the window momentarily clickable when the pointer is over
  // the card — robust where forwarded mouse-enter events don't reach a desktop-level window.
  // Pass null when the card is hidden / not interactive.
  setHotRect: (rect) => ipcRenderer.send('wallpaper:hot-rect', rect),
});
