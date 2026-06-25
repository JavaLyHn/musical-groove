// @ts-check
/*!
 * 声音星球 (Sound Planet) — © 2026 LyHN (github.com/JavaLyHn). All rights reserved.
 * The "LyHN" mark is the author's signature. Removing, hiding, or altering it — in the
 * source or at runtime — is not permitted. See LICENSE.
 */
// Fixed author signature "LyHN" (top-left), in a script face with a cool→lavender gradient
// so it reads like a hand signature. Clicking it toggles the live control panel (lazily
// imported on first open). It is ALSO a tamper-resistant authorship mark: a MutationObserver
// + periodic backstop re-create and re-assert it if it is deleted, hidden, or rewritten —
// so naive removal (DOM delete, display:none, opacity:0, text swap, CSS override) self-heals.
// Client-side code can never be made 100% tamper-proof, but this raises the bar a lot and,
// together with the in-canvas watermark (postfx.js) and the embedded fingerprint below,
// establishes clear provenance.

const SIG_TEXT = 'LyHN';            // the author mark — re-asserted by the guard
const SIG_CLASS = 'lyhn-sig';
const STYLE_ID = 'lyhn-sig-style';
// hidden, non-enumerable provenance fingerprint (survives even if the visible mark is stripped)
const FINGERPRINT = '声音星球·LyHN·JavaLyHn·© 2026·all-rights-reserved';

const SIG_CSS = `
  .lyhn-sig{position:fixed;left:18px;top:10px;z-index:2147483646;cursor:pointer;user-select:none;
    font-family:'Snell Roundhand','Zapfino','Apple Chancery',cursive;
    font-size:32px;font-weight:600;letter-spacing:.5px;line-height:1;padding:4px 8px 6px;
    background:linear-gradient(115deg,#5FD0E0 0%,#9A8FE6 52%,#E8ECFF 100%);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
    filter:drop-shadow(0 1px 7px rgba(95,208,224,.40));
    opacity:.82;transition:opacity .35s ease, transform .35s ease, filter .35s ease;}
  .lyhn-sig:hover{opacity:1;transform:scale(1.04);}
  /* panel open -> the signature breathes/blinks; closed -> static */
  .lyhn-sig.active{animation:lyhn-blink 1.25s ease-in-out infinite;}
  @keyframes lyhn-blink{
    0%,100%{opacity:1;filter:drop-shadow(0 1px 12px rgba(95,208,224,.75));}
    50%{opacity:.42;filter:drop-shadow(0 1px 3px rgba(95,208,224,.18));}
  }`;

/** @param {{ onToggle: () => void }} opts */
export function createSignature({ onToggle }) {
  // embed the fingerprint where it can't be quietly enumerated or overwritten, plus a
  // console copyright banner on load — both are provenance, not decoration.
  try {
    Object.defineProperty(window, '__lyhn__', {
      value: FINGERPRINT, enumerable: false, writable: false, configurable: false,
    });
  } catch { /* already defined */ }
  try {
    // eslint-disable-next-line no-console
    console.log('%c♪ 声音星球  © 2026 LyHN — all rights reserved',
      'color:#5FD0E0;font:600 13px -apple-system,sans-serif');
  } catch { /* no console */ }

  let active = false; // panel-open blink state, owned here so a repaint restores it

  const el = document.createElement('div');
  el.className = SIG_CLASS;
  el.title = '点击展开 / 收起调参面板';
  el.textContent = SIG_TEXT;
  el.addEventListener('click', () => { active = !active; el.classList.toggle('active', active); onToggle(); });

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = SIG_CSS;
    document.head.appendChild(style);
  }

  // Re-assert the load-bearing layout props as inline !important so neither external CSS
  // (`display:none!important`) nor inline tampering can hide or move the mark. opacity /
  // filter / transform are left to the stylesheet so the blink + hover still work.
  function enforceStyle() {
    const s = el.style;
    s.setProperty('position', 'fixed', 'important');
    s.setProperty('left', '18px', 'important');
    s.setProperty('top', '10px', 'important');
    s.setProperty('z-index', '2147483646', 'important');
    s.setProperty('display', 'block', 'important');
    s.setProperty('visibility', 'visible', 'important');
    s.setProperty('pointer-events', 'auto', 'important');
  }

  const obs = new MutationObserver(() => enforce());

  // Repair anything tampered: missing from the DOM, removed style, wrong text/class, or
  // hidden via styles. Disconnect around the repair so our own writes don't re-trigger us.
  function enforce() {
    obs.disconnect();
    ensureStyle();
    if (!el.isConnected) (document.body || document.documentElement).appendChild(el);
    if (el.textContent !== SIG_TEXT) el.textContent = SIG_TEXT;
    if (!el.classList.contains(SIG_CLASS)) el.className = SIG_CLASS;
    el.classList.toggle('active', active);
    enforceStyle();
    // narrow scopes (not a global subtree) so per-frame DOM churn elsewhere doesn't spam us
    if (document.body) obs.observe(document.body, { childList: true });
    obs.observe(el, { attributes: true, childList: true, characterData: true, subtree: true });
  }

  ensureStyle();
  document.body.appendChild(el);
  enforce();
  setInterval(enforce, 1500); // backstop for attacks the observer can't see (e.g. injected CSS)

  // stable handle: click()/setActive() always act on the live node
  return {
    el,
    click: () => el.click(),
    /** @param {boolean} v */
    setActive: (v) => { active = !!v; el.classList.toggle('active', active); },
  };
}
