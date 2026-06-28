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
    body.wp-wallpaper .lyhn-lyrics { pointer-events: none !important; }
    body.wp-wallpaper .np:not(.show) { pointer-events: none !important; }
    body.wp-wallpaper .mg-console { display: none !important; }`;
  document.head.appendChild(style);

  const canvas = document.getElementById('app');
  /** @param {MouseEvent} e */
  function onDocClick(e) {
    // only a click on the bare wallpaper (canvas / body) exits; panel + now-playing card stay interactive
    if (e.target === canvas || e.target === document.body) { if (api.exitSettings) api.exitSettings(); }
  }

  // In wallpaper mode the window is click-through; the main process polls the cursor against the
  // now-playing card's rect (reported here) and makes the window momentarily clickable while the
  // pointer is over it — so the card's controls (expand / seek / prev-pause-next) work, then it
  // returns to click-through. Settings mode is already fully clickable, so we report no hot rect
  // there. We re-report on every appear / expand / collapse / move so the rect stays exact.
  const np = /** @type {HTMLElement|null} */ (document.querySelector('.np'));
  function reportHot() {
    if (!np || typeof api.setHotRect !== 'function') return;
    if (curMode !== 'wallpaper' || !np.classList.contains('show')) { api.setHotRect(null); return; }
    if (np.classList.contains('expanded')) {
      // While the card is open, make the WHOLE window clickable so a click anywhere reaches the page
      // and the existing click-outside handler collapses it — matching the in-browser behaviour
      // (otherwise an off-card click goes straight to the desktop and the card never closes).
      api.setHotRect({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
      return;
    }
    const r = np.getBoundingClientRect();
    api.setHotRect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  if (np && typeof ResizeObserver === 'function') {
    new ResizeObserver(reportHot).observe(np);                                  // card grows/shrinks on expand
    new MutationObserver(reportHot).observe(np, { attributes: true, attributeFilter: ['class'] }); // show / expand toggles
    window.addEventListener('resize', reportHot);
  }

  let curMode = 'wallpaper';
  /** @param {'wallpaper'|'settings'} mode */
  function apply(mode) {
    curMode = mode;
    if (mode === 'settings') {
      document.body.classList.remove('wp-wallpaper');
      refs.openPanel();
      document.addEventListener('click', onDocClick);
    } else {
      document.body.classList.add('wp-wallpaper');
      refs.closePanel();
      document.removeEventListener('click', onDocClick);
    }
    reportHot(); // mode change flips whether the card is a hot (clickable) region
  }
  apply('wallpaper');          // default
  api.onMode(apply);
}
