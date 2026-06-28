const { contextBridge } = require('electron');
// The app runs as a true fullscreen foreground visualizer (see electron/main.js), so the window is
// fully interactive and there is no wallpaper / click-through / mode bridging to expose. The renderer
// only needs to know it's running inside Electron (to pick the system-audio loopback source).
contextBridge.exposeInMainWorld('__wallpaper__', { isElectron: true });
