/* myTraining — avisos curtos e visíveis (ex.: erro de gravação). Ouve o evento 'app-notice'.
   Quem avisa não precisa de importar a UI: document.dispatchEvent(new CustomEvent('app-notice', { detail:{ msg, kind } })). */
const seen = new Map();   /* `once` → instante do último aviso, para não repetir a cada gravação */
let hideTimer = 0;

function show(msg, kind) {
  const host = document.getElementById('notice');
  if (!host) return;
  host.textContent = msg;
  host.className = `notice show ${kind === 'error' ? 'err' : 'ok'}`;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => host.classList.remove('show'), kind === 'error' ? 9000 : 3500);
}

function initNotice() {
  document.addEventListener('app-notice', e => {
    const d = (e && e.detail) || {};
    if (d.once) {
      const last = seen.get(d.once) || 0;
      if (Date.now() - last < 10000) return;
      seen.set(d.once, Date.now());
    }
    show(String(d.msg || ''), d.kind);
  });
}

export { initNotice, show };
