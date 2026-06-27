// Filled in Task 5. Kept minimal so the window can reference it now.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('__wallpaper__', { mode: 'wallpaper' });
