// @ts-check
// Bridges the Electron wallpaper/settings mode into the page: in wallpaper mode the
// control panel is hidden and overlays are click-through; in settings mode they're live.
// No-op outside Electron (plain browser / dev), so the web build is unaffected.

/** @param {{ openPanel: () => void, closePanel: () => void }} refs */
export function initElectronMode(refs) {
  const api = /** @type {any} */ (window).__wallpaper__;
  if (!api || !api.isElectron) return; // plain browser: nothing to do

  const style = document.createElement('style');
  style.textContent = `
    body.wp-wallpaper .lyhn-lyrics,
    body.wp-wallpaper .np { pointer-events: none !important; }
    body.wp-wallpaper .lil-gui.lyhn-gui { display: none !important; }`;
  document.head.appendChild(style);

  /** @param {'wallpaper'|'settings'} mode */
  function apply(mode) {
    if (mode === 'settings') { document.body.classList.remove('wp-wallpaper'); refs.openPanel(); }
    else { document.body.classList.add('wp-wallpaper'); refs.closePanel(); }
  }
  apply('wallpaper');          // default
  api.onMode(apply);
}
