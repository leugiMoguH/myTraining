/* Foco e teclado das folhas sobrepostas (Definições, ficha técnica): abre com foco dentro, o resto da app fica inerte,
   Tab não sai, Esc fecha só a do topo e o foco volta a quem abriu. Os diálogos de confirmação (dialog.js) tratam do seu
   próprio Esc em captura, por isso ganham sempre; o treino guiado e o acolhimento já isolam o fundo por conta própria. */
const BACKGROUND = ['hdr', 'content', 'bnav', 'timerBanner', 'woBg'];
const stack = [];

const usable = e => e && e.isConnected && !e.disabled && !e.closest('[inert]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
/* só os pontos de paragem do Tab: num grupo de rádios conta apenas o marcado (ou o primeiro, se nenhum) */
const tabStop = (e, root) => e.type !== 'radio' || (e.checked ? true : !root.querySelector(`input[type="radio"][name="${e.name}"]:checked`) && root.querySelector(`input[type="radio"][name="${e.name}"]`) === e);
const controls = root => [...root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter(e => usable(e) && tabStop(e, root));

function openOverlay(bg, { initial, onClose }) {
  if (stack.some(o => o.bg === bg)) return;
  const inert = BACKGROUND.map(id => document.getElementById(id)).filter(Boolean).map(e => [e, e.inert]);
  inert.forEach(([e]) => { e.inert = true; });
  stack.push({ bg, origin: document.activeElement, inert, onClose });
  bg.classList.add('show');
  const first = (initial && bg.querySelector(initial)) || controls(bg)[0];
  if (first) {
    first.focus({ preventScroll: true });
    /* a ficha só fica visível após a transição: tenta de novo se o foco não pegou */
    if (!bg.contains(document.activeElement)) setTimeout(() => { if (stack.some(o => o.bg === bg)) first.focus({ preventScroll: true }); }, 60);
  }
}

/* devolve o foco ao controlo de origem (se ainda existir e for utilizável) */
function closeOverlay(bg) {
  const i = stack.findIndex(o => o.bg === bg);
  bg.classList.remove('show');
  if (i < 0) return;
  const [{ origin, inert }] = stack.splice(i, 1);
  inert.forEach(([e, was]) => { e.inert = was; });
  if (usable(origin)) origin.focus({ preventScroll: true });
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
