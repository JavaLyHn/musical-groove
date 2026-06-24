// Minimal one-time control to connect real audio (browser audio permission
// needs a user gesture). It fades out after connecting so the wallpaper stays
// clean. onConnect must return a promise resolving to a short status label.
export function createAudioControls({ onConnect }) {
  const style = document.createElement('style');
  style.textContent = `
    .audio-ctl{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:10;
      display:flex;gap:12px;align-items:center;
      font-family:-apple-system,"PingFang SC",system-ui,sans-serif;transition:opacity .8s ease}
    .audio-ctl.hide{opacity:0;pointer-events:none}
    .audio-ctl button{appearance:none;border:1px solid rgba(150,160,230,.35);
      background:rgba(20,28,60,.55);color:#cdd3f0;font-size:13px;letter-spacing:.04em;
      padding:9px 16px;border-radius:999px;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
    .audio-ctl button:hover{background:rgba(40,52,100,.7)}
    .audio-ctl button:disabled{opacity:.6;cursor:default}
    .audio-ctl .status{font-size:12px;color:#8b93c0;max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'audio-ctl';
  const btn = document.createElement('button');
  btn.textContent = '▶ 连接系统声音';
  const status = document.createElement('span');
  status.className = 'status';
  wrap.append(btn, status);
  document.body.appendChild(wrap);

  async function connect() {
    btn.disabled = true;
    status.textContent = '连接中…';
    try {
      const label = await onConnect();
      btn.textContent = '● 已连接';
      status.textContent = label || '';
      setTimeout(() => wrap.classList.add('hide'), 3500);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '▶ 连接系统声音';
      status.textContent = '失败：' + (e && e.message ? e.message : e);
    }
  }

  btn.addEventListener('click', connect);
  return { wrap, connect, hide: () => wrap.classList.add('hide') };
}
