// Общая оболочка панелей. Без сети: только DOM и localStorage для положения кнопки.
function lxEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function lxWin() {
  try {
    const fe = window.frameElement;
    if (fe && fe.ownerDocument) return fe.ownerDocument.defaultView || window;
  } catch (e) { /* фрагмент не в iframe */ }
  return window;
}

function lxDoc() {
  const w = lxWin();
  return w.document || document;
}

function lxInjectBase(doc) {
  if (doc.getElementById('lx-base-css')) return;
  const st = doc.createElement('style');
  st.id = 'lx-base-css';
  st.textContent = `
.lx-fab{position:fixed;z-index:99980;width:48px;height:48px;border-radius:16px;border:1px solid var(--lx-accent,#e0b15a);background:#1a1614;color:var(--lx-accent,#e0b15a);font:600 18px/1 "Palatino Linotype",Palatino,serif;cursor:grab;box-shadow:0 10px 28px rgba(0,0,0,.45);touch-action:none;padding:0}
.lx-back{position:fixed;inset:0;z-index:99990;background:rgba(12,9,7,.52)}
.lx-win{position:fixed;z-index:99991;left:50%;bottom:14px;transform:translateX(-50%);width:min(430px,calc(100vw - 16px));max-height:min(88vh,820px);display:flex;flex-direction:column;background:#241c18;color:#f3eadf;border:1px solid rgba(243,234,223,.16);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.55);font:14px/1.45 "Segoe UI",system-ui,sans-serif;overflow:hidden}
.lx-win *{box-sizing:border-box}
.lx-hd{display:flex;align-items:center;gap:8px;padding:10px 12px 8px;border-bottom:1px solid rgba(243,234,223,.1)}
.lx-title{flex:1;min-width:0}
.lx-kicker{font:600 10px/1.2 "Cascadia Mono",Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--lx-accent,#e0b15a)}
.lx-title h2{margin:2px 0 0;font:600 18px/1.15 "Palatino Linotype",Palatino,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lx-hd button,.lx-btn,.lx-icon{background:#1a1614;color:#f3eadf;border:1px solid rgba(243,234,223,.16);border-radius:12px;padding:8px 10px;font:600 13px/1.2 "Segoe UI",system-ui,sans-serif;cursor:pointer}
.lx-hd button{min-width:36px}
.lx-btn.primary{background:var(--lx-accent,#e0b15a);color:#1a1614;border-color:transparent}
.lx-btn:disabled{opacity:.45;cursor:default}
.lx-body{overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.lx-row{display:flex;gap:8px;align-items:center}
.lx-row > *{min-width:0}
.lx-grow{flex:1}
.lx-card{background:#1a1614;border:1px solid rgba(243,234,223,.1);border-radius:14px;padding:10px 12px}
.lx-card h3{margin:0 0 4px;font:600 16px/1.2 "Palatino Linotype",Palatino,serif}
.lx-muted{color:#b5a89a;font-size:12px}
.lx-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#b5a89a}
.lx-field input,.lx-field textarea,.lx-field select{width:100%;background:#120e0c;color:#f3eadf;border:1px solid rgba(243,234,223,.16);border-radius:10px;padding:8px 10px;font:14px/1.35 "Segoe UI",system-ui,sans-serif}
.lx-field textarea{min-height:88px;resize:vertical}
.lx-bar{height:7px;background:#120e0c;border-radius:99px;overflow:hidden}
.lx-bar > span{display:block;height:100%;background:var(--lx-accent,#e0b15a)}
.lx-toast{font:12px/1.35 "Cascadia Mono",Consolas,monospace;color:#e0b15a;min-height:1em}
.lx-list{display:flex;flex-direction:column;gap:6px}
.lx-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 8px;background:#120e0c;border:1px solid rgba(243,234,223,.12);font-size:12px}
.lx-empty{color:#b5a89a;padding:18px 8px;text-align:center}
.lx-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media (max-width:380px){.lx-grid{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.lx-fab,.lx-win{transition:none}}
`;
  (doc.head || doc.documentElement).appendChild(st);
}

function lxListen(win, key, type, fn, options) {
  const bag = win.__lxListen || (win.__lxListen = {});
  if (bag[key]) {
    try { win.removeEventListener(type, bag[key].fn, bag[key].options); } catch (e) {}
  }
  bag[key] = { fn: fn, options: options };
  win.addEventListener(type, fn, options);
}

function lxMount(opts) {
  const win = lxWin();
  const doc = lxDoc();
  lxInjectBase(doc);
  const id = String(opts.id || 'app');
  const oldFab = doc.getElementById('lx-fab-' + id);
  const oldBack = doc.getElementById('lx-back-' + id);
  const oldWin = doc.getElementById('lx-win-' + id);
  if (oldFab) oldFab.remove();
  if (oldBack) oldBack.remove();
  if (oldWin) oldWin.remove();

  const fab = doc.createElement('button');
  fab.type = 'button';
  fab.id = 'lx-fab-' + id;
  fab.className = 'lx-fab';
  fab.textContent = opts.glyph || '•';
  fab.setAttribute('aria-label', opts.label || opts.title || id);
  fab.style.setProperty('--lx-accent', opts.accent || '#e0b15a');

  const back = doc.createElement('div');
  back.id = 'lx-back-' + id;
  back.className = 'lx-back';
  back.hidden = true;

  const panel = doc.createElement('section');
  panel.id = 'lx-win-' + id;
  panel.className = 'lx-win';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.hidden = true;
  panel.style.setProperty('--lx-accent', opts.accent || '#e0b15a');
  panel.innerHTML =
    '<header class="lx-hd">' +
      '<button type="button" data-lx="back" hidden aria-label="Назад">←</button>' +
      '<div class="lx-title"><div class="lx-kicker"></div><h2></h2></div>' +
      '<button type="button" data-lx="close" aria-label="Закрыть">×</button>' +
    '</header>' +
    '<div class="lx-toast" data-lx="toast"></div>' +
    '<div class="lx-body"></div>';

  const host = doc.documentElement || doc.body;
  host.appendChild(fab);
  host.appendChild(back);
  host.appendChild(panel);

  const body = panel.querySelector('.lx-body');
  const kicker = panel.querySelector('.lx-kicker');
  const h2 = panel.querySelector('h2');
  const backBtn = panel.querySelector('[data-lx="back"]');
  const toast = panel.querySelector('[data-lx="toast"]');
  let backFn = null;

  function placeFab() {
    let pos = null;
    try { pos = JSON.parse(win.localStorage.getItem('lx-fab-' + id) || 'null'); } catch (e) { pos = null; }
    if (pos && Number.isFinite(pos.x)) {
      fab.style.left = pos.x + 'px';
      fab.style.top = pos.y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    } else {
      fab.style.right = (opts.right || 16) + 'px';
      fab.style.bottom = (opts.bottom || 96) + 'px';
    }
  }
  placeFab();

  let drag = false;
  let moved = false;
  let sx = 0; let sy = 0; let ox = 0; let oy = 0;
  function down(e) {
    drag = true; moved = false;
    const p = e.touches ? e.touches[0] : e;
    const r = fab.getBoundingClientRect();
    ox = r.left; oy = r.top; sx = p.clientX; sy = p.clientY;
    fab.style.cursor = 'grabbing';
  }
  function move(e) {
    if (!drag) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - sx; const dy = p.clientY - sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    const W = win.innerWidth || 360; const H = win.innerHeight || 640;
    const nx = Math.max(4, Math.min(W - 52, ox + dx));
    const ny = Math.max(8, Math.min(H - 52, oy + dy));
    fab.style.left = nx + 'px';
    fab.style.top = ny + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    if (e.cancelable && moved) e.preventDefault();
  }
  function up() {
    if (!drag) return;
    drag = false;
    fab.style.cursor = 'grab';
    if (moved) {
      const r = fab.getBoundingClientRect();
      try { win.localStorage.setItem('lx-fab-' + id, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch (e) {}
    } else if (opts.onOpen) opts.onOpen();
    else api.open();
  }
  fab.addEventListener('pointerdown', down);
  lxListen(win, 'move-' + id, 'pointermove', move);
  lxListen(win, 'up-' + id, 'pointerup', up);

  const api = {
    body,
    esc: lxEsc,
    setTitle(k, t) { kicker.textContent = k || ''; h2.textContent = t || ''; },
    setBack(fn) { backFn = fn; backBtn.hidden = !fn; },
    toast(msg) { toast.textContent = msg || ''; },
    open() { back.hidden = false; panel.hidden = false; fab.style.visibility = 'hidden'; if (opts.onShow) opts.onShow(); },
    close() { back.hidden = true; panel.hidden = true; fab.style.visibility = 'visible'; },
  };
  back.addEventListener('click', () => api.close());
  panel.querySelector('[data-lx="close"]').addEventListener('click', () => api.close());
  backBtn.addEventListener('click', () => { if (backFn) backFn(); });
  lxListen(win, 'key-' + id, 'keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) api.close(); });
  return api;
}

const LocalShell = { esc: lxEsc, win: lxWin, doc: lxDoc, mount: lxMount, listen: lxListen };
globalThis.LocalShell = LocalShell;
export { LocalShell };
