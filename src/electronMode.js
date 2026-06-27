// @ts-check
// Bridges the Electron wallpaper/settings mode into the page: in wallpaper mode the
// control panel is hidden and overlays are click-through; in settings mode they're live
// and clicking the bare wallpaper background returns to wallpaper. No-op outside Electron.

/** @param {{ openPanel: () => void, closePanel: () => void }} refs */
export function initElectronMode(refs) {
  const api = /** @type {any} */ (window).__wallpaper__;
  if (!api || !api.isElectron) return; // plain browser: nothing to do

  const style = document.createElement('style');
  style.textContent = `
    body.wp-wallpaper .lyhn-lyrics,
    body.wp-wallpaper .np { pointer-events: none !important; }
    body.wp-wallpaper .mg-console { display: none !important; }`;
  document.head.appendChild(style);

  const canvas = document.getElementById('app');
  /** @param {MouseEvent} e */
  function onDocClick(e) {
    // only a click on the bare wallpaper (canvas / body) exits; panel + now-playing card stay interactive
    if (e.target === canvas || e.target === document.body) { if (api.exitSettings) api.exitSettings(); }
  }

  /** @param {'wallpaper'|'settings'} mode */
  function apply(mode) {
    if (mode === 'settings') {
      document.body.classList.remove('wp-wallpaper');
      refs.openPanel();
      document.addEventListener('click', onDocClick);
    } else {
      document.body.classList.add('wp-wallpaper');
      refs.closePanel();
      document.removeEventListener('click', onDocClick);
    }
  }
  apply('wallpaper');          // default
  api.onMode(apply);
}
