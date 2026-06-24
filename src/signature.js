// @ts-check
// Fixed author signature "LyHN" in the top-left, set in an artistic script face with a
// cool→lavender gradient fill so it reads like a hand signature that matches the scene.
// Clicking it toggles the live control panel (lil-gui), which is lazily loaded on first
// open — so the signature itself stays featherweight.
/** @param {{ onToggle: () => void }} opts */
export function createSignature({ onToggle }) {
  const style = document.createElement('style');
  style.textContent = `
    .lyhn-sig{position:fixed;left:18px;top:10px;z-index:12;cursor:pointer;user-select:none;
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
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.className = 'lyhn-sig';
  el.title = '点击展开 / 收起调参面板';
  el.textContent = 'LyHN';
  el.addEventListener('click', () => { el.classList.toggle('active'); onToggle(); });
  document.body.appendChild(el);
  return el;
}
