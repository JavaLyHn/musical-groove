// @ts-check
// The app now runs as a TRUE FULLSCREEN foreground visualizer (see electron/main.js): the window
// covers the whole screen and is fully interactive, so there is no wallpaper / click-through /
// settings-mode / menu-bar handling left to do. Kept as a no-op so callers don't need to change.
/** @param {{ openPanel?: () => void, closePanel?: () => void }} [_refs] */
export function initElectronMode(_refs) { /* no-op: fullscreen foreground needs no special handling */ }
