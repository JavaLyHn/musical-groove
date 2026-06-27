// @ts-check
// Version presets, rendered as chips for the console header strip. Reuses presets.js
// (snapshot/apply/storage) unchanged; this file owns only the chip DOM. Save = capture the
// current look under "版本 N"; click a chip to load (active gets a ✓); × deletes (with a
// confirm); rename inline. doLoad() calls onChange() so index re-syncs every control widget.
import { snapshot, applySnapshot, getPresets, setPresets, getLast, setLast } from '../presets.js';

/** @param {{ refs:any, onChange:()=>void }} opts */
export function createPresetsBar({ refs, onChange }) {
  let presets = getPresets();
  let active = getLast();

  const bar = document.createElement('div');
  bar.className = 'presets';
  const save = document.createElement('button');
  save.className = 'psave'; save.textContent = '＋ 保存当前为新版本';
  const list = document.createElement('div');
  list.className = 'chiplist';
  bar.append(save, list);

  /** @param {string} n */
  function makeChip(n) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (n === active ? ' on' : '');
    const label = document.createElement('span');
    label.className = 'clabel'; label.textContent = n; label.title = '载入「' + n + '」';
    label.addEventListener('click', () => doLoad(n));
    label.addEventListener('dblclick', (e) => { e.stopPropagation(); beginRename(chip, n); });
    const x = document.createElement('span');
    x.className = 'x'; x.textContent = '×'; x.title = '删除「' + n + '」';
    x.addEventListener('click', (e) => { e.stopPropagation(); doDelete(n); });
    chip.append(label, x);
    return chip;
  }

  function render() {
    list.innerHTML = '';
    const names = Object.keys(presets);
    if (!names.length) {
      const e = document.createElement('span');
      e.className = 'empty'; e.textContent = '还没有保存的版本 — 调好后点「＋ 保存」';
      list.appendChild(e);
      return;
    }
    for (const n of names) list.appendChild(makeChip(n));
  }

  function doSave() {
    let i = 1; while (presets['版本 ' + i]) i++;
    const name = '版本 ' + i;
    presets[name] = snapshot(refs); setPresets(presets);
    active = name; setLast(name);
    render();
  }
  /** @param {string} n */
  function doLoad(n) {
    if (!presets[n]) return;
    applySnapshot(refs, presets[n]);
    active = n; setLast(n);
    render();
    onChange();
  }
  /** @param {string} n */
  function doDelete(n) {
    if (!presets[n]) return;
    if (!confirm('删除版本「' + n + '」?')) return;
    delete presets[n]; setPresets(presets);
    if (active === n) { active = null; setLast(null); }
    render();
  }
  /** @param {HTMLElement} chip @param {string} oldName */
  function beginRename(chip, oldName) {
    const inp = document.createElement('input');
    inp.className = 'crename'; inp.type = 'text'; inp.maxLength = 24; inp.value = oldName;
    chip.replaceChildren(inp); inp.focus(); inp.select();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      const nn = inp.value.trim();
      if (nn && nn !== oldName && !presets[nn]) {
        /** @type {Record<string,any>} */ const rebuilt = {};
        for (const k of Object.keys(presets)) rebuilt[k === oldName ? nn : k] = presets[k];
        presets = rebuilt; setPresets(presets);
        if (active === oldName) { active = nn; setLast(nn); }
      }
      render();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { done = true; render(); }
    });
    inp.addEventListener('blur', commit);
  }

  save.addEventListener('click', doSave);
  render();
  return { el: bar, refresh: render };
}
