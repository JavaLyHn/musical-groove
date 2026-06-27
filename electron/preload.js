const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('__wallpaper__', {
  isElectron: true,
  onMode: (cb) => { ipcRenderer.on('wallpaper:mode', (_e, mode) => { try { cb(mode); } catch { /* */ } }); },
  exitSettings: () => ipcRenderer.send('wallpaper:exit-settings'),
  setInteractive: (on) => ipcRenderer.send('wallpaper:set-interactive', !!on),
});
