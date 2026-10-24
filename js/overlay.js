/* Foco e teclado das folhas sobrepostas (Definições, ficha técnica): abre com foco dentro, o resto da app fica inerte,
   Tab não sai, Esc fecha só a do topo e o foco volta a quem abriu. Os diálogos de confirmação (dialog.js) tratam do seu
   próprio Esc em captura, por isso ganham sempre; o treino guiado e o acolhimento já isolam o fundo por conta própria. */
const BACKGROUND = ['hdr', 'content', 'bnav', 'timerBanner', 'woBg'];
const stack = [];
const locks = new Map();
function lock(e) {
  const held = locks.get(e);
  if (held) held.count++;
  else locks.set(e, { count: 1, was: e.inert });
  e.inert = true;
}
function unlock(e) {
  const held = locks.get(e);
  if (held && !--held.count) { e.inert = held.was; locks.delete(e); }
}

const usable = e => e && e.isConnected && !e.disabled && !e.closest('[inert]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
/* só os pontos de paragem do Tab: num grupo de rádios conta apenas o marcado (ou o primeiro, se nenhum) */
const tabStop = (e, root) => e.type !== 'radio' || (e.checked ? true : !root.querySelector(`input[type="radio"][name="${e.name}"]:checked`) && root.querySelector(`input[type="radio"][name="${e.name}"]`) === e);
const controls = root => [...root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter(e => usable(e) && tabStop(e, root));

function openOverlay(bg, { initial, onClose }) {
  if (stack.some(o => o.bg === bg)) return;
  const inert = [...new Set([...BACKGROUND.map(id => document.getElementById(id)), ...stack.map(o => o.bg)])].filter(e => e && e !== bg);
  const origin = document.activeElement;
  inert.forEach(lock);
  stack.push({ bg, origin, inert, onClose });
  bg.classList.add('show');
  const first = (initial && bg.querySelector(initial)) || controls(bg)[0];
  if (first) {
    first.focus({ preventScroll: true });
    /* a ficha só fica visível após a transição: tenta de novo se o foco não pegou */
    const retry = () => { if (stack[stack.length - 1]?.bg === bg && !bg.contains(document.activeElement)) first.focus({ preventScroll: true }); };
    bg.addEventListener('transitionend', retry, { once: true });
    setTimeout(retry, 220);
  }
}

/* devolve o foco ao controlo de origem (se ainda existir e for utilizável) */
function closeOverlay(bg) {
  const i = stack.findIndex(o => o.bg === bg);
  bg.classList.remove('show');
  if (i < 0) return;
  const [{ origin, inert }] = stack.splice(i, 1);
  inert.forEach(unlock);
  const top = stack[stack.length - 1];
  const target = usable(origin) && (!top || top.bg.contains(origin)) ? origin : top && controls(top.bg)[0];
  if (target) target.focus({ preventScroll: true });
}

document.addEventListener('keydown', e => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); top.onClose(); return; }
  if (e.key !== 'Tab') return;
  const list = controls(top.bg);
  if (!list.length) { e.preventDefault(); return; }
  const at = list.indexOf(document.activeElement);
  if (at < 0 || (e.shiftKey && at === 0) || (!e.shiftKey && at === list.length - 1)) {
    e.preventDefault(); list[e.shiftKey ? list.length - 1 : 0].focus();
  }
});

export { openOverlay, closeOverlay };
