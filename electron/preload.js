const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('__wallpaper__', {
  isElectron: true,
  onMode: (cb) => {
    ipcRenderer.on('wallpaper:mode', (_e, mode) => { try { cb(mode); } catch { /* */ } });
  },
});
