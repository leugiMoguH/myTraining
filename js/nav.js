/* myTraining — navegação inferior + faixa "treino em curso".
   Cinco destinos: Início · Evolução · [Treino] · Semana · Opções.
   O botão central só controla a SESSÃO (iniciar / pausar / retomar), nunca o descanso.
   Tudo o que mostra deriva de ST.session e ST.view: não guarda estado próprio. */
import { CUSTOM_DAY, DAYS } from './routine.js';
import { agenda, dayStatus } from './schedule.js';
import { ACTIVE, PAUSED, abandonSession, activeMs, currentSession, finishedToday, fmtDur, isLive, onSessionChange, pauseSession, reconcileSession, resumeSession, sessionState, staleSession, touchSession } from './session.js';
import { ST } from './state.js';
import { render } from './ui.js';
import { openSheet } from './backup.js';
import { openWorkout, refreshWorkout, startWorkout } from './workout.js';

const SIDE = [
  { id: '__hoje',   icon: '🏠', label: 'Início' },
  { id: '__perfil', icon: '📈', label: 'Evolução' },
  { id: 'main' },
  { id: '__semana', icon: '📅', label: 'Semana' },
  { id: 'opts',     icon: '⚙️', label: 'Opções' },
];
const HEARTBEAT_MS = 15000;

/* Treino "selecionado": o dia que o utilizador está a ver, ou o da agenda. Nunca um arbitrário:
   sem nenhum (descanso, semana fechada) o botão encaminha para a Semana. */
function selectedDay() {
  if (ST.view === '__pers') { const c = DAYS[CUSTOM_DAY]; return c && c.ex && c.ex.length ? CUSTOM_DAY : null; }
  if (ST.view === '__dia' && DAYS[ST.day] && dayStatus(ST.day) !== 'rest') return ST.day;
  const a = agenda();
  return !a.allDone && a.current && !(a.restToday && !a.late) ? a.current : null;
}

function openLive() {
  const s = currentSession();
  if (s) openWorkout(s.day, s.pos);
}

function navMain() {
  const st = sessionState();
  if (st === ACTIVE) { pauseSession(); return; }
  if (st === PAUSED) { resumeSession(); openLive(); return; }
  const day = selectedDay();
  if (!day) { render('__semana'); return; }
  if (finishedToday(day)) { render('__hoje'); return; }   /* terminado hoje: nada de reiniciar sozinho */
  startWorkout(day);
}

function navOpts() { openSheet(); }

function navAbandon() {
  if (confirm('Descartar este treino por terminar? As séries já registadas ficam guardadas.')) abandonSession();
}

function mainFace() {
  const st = sessionState();
  if (st === ACTIVE) return { icon: '⏸', label: 'Pausar', cls: 'live' };
  if (st === PAUSED) return { icon: '▶', label: 'Retomar', cls: 'paused' };
  return selectedDay() ? { icon: '▶', label: 'Iniciar', cls: '' } : { icon: '▶', label: 'Treino', cls: '' };
}

function buildNav() {
  const row = document.getElementById('navRow');
  row.innerHTML = '';
  SIDE.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    if (it.id === 'main') {
      b.id = 'navMain'; b.className = 'nb nb-main';
      b.onclick = navMain;
    } else {
      b.className = 'nb'; b.dataset.day = it.id;
      b.innerHTML = `<span class="nb-i" aria-hidden="true">${it.icon}</span><span class="nb-l">${it.label}</span>`;
      b.onclick = it.id === 'opts' ? navOpts : () => render(it.id);
    }
    row.appendChild(b);
  });
  document.getElementById('navLive').onclick = openLive;
  document.getElementById('navDrop').onclick = navAbandon;
  syncNav();
}

function syncNav() {
  const f = mainFace();
  const main = document.getElementById('navMain');
  if (main) {
    main.className = `nb nb-main ${f.cls}`;
    main.setAttribute('aria-label', f.label === 'Treino' ? 'Escolher treino' : `${f.label} treino`);
    main.innerHTML = `<span class="nb-i" aria-hidden="true">${f.icon}</span><span class="nb-l">${f.label}</span>`;
  }
  /* o ecrã atual: um dia concreto conta como "Semana"; a Nutrição vive nas Opções */
  const at = ST.view === '__dia' ? '__semana' : ST.view === '__pers' ? '__hoje' : ST.view;
  document.querySelectorAll('.nb[data-day]').forEach(b => {
    const on = b.dataset.day === at;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const badge = agenda().pending;
  const home = document.querySelector('.nb[data-day="__hoje"] .nb-i');
  if (home) home.dataset.badge = badge ? String(badge) : '';

  /* faixa de sessão viva (só quando a vista guiada está fechada) */
  const live = document.getElementById('navLive');
  const viewOpen = document.getElementById('woBg').classList.contains('show');
  const show = isLive() && !viewOpen;
  live.hidden = !show;
  document.getElementById('navDrop').hidden = !(show && staleSession());
  if (show) {
    const s = currentSession(), stale = staleSession();
    const state = stale ? `⏳ Treino de ${s.date} por terminar` : s.state === PAUSED ? '⏸ Em pausa' : '● Em curso';
    live.querySelector('.nl-t').textContent = `${state} · ${s.day} · ${fmtDur(activeMs())}`;
  }
}

/* relógio da faixa + sinal de vida (usado para não contar como treino o tempo com a app morta) */
const isEditable = el => !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
/* Teclado virtual aberto = campo em foco E área visível bem mais baixa que a maior já vista com esta
   largura (reset ao rodar o ecrã). No desktop, sem teclado virtual, a barra nunca se esconde. */
let baseW = 0, baseH = 0;
function keyboardOpen() {
  const vv = window.visualViewport, h = vv ? vv.height : window.innerHeight;
  if (window.innerWidth !== baseW) { baseW = window.innerWidth; baseH = 0; }
  baseH = Math.max(baseH, h, window.innerHeight);
  return isEditable(document.activeElement) && h < baseH * 0.75;
}
function updateKb() { document.body.classList.toggle('kb', keyboardOpen()); }

let beat = 0;
function tick() {
  updateKb();
  if (isLive()) syncNav();
  if (!document.hidden && ++beat % (HEARTBEAT_MS / 1000) === 0) touchSession();
}

function initNav() {
  buildNav();
  onSessionChange(syncNav);
  setInterval(tick, 1000);
  const stamp = () => touchSession();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stamp(); else { reconcileSession(); refreshWorkout(); syncNav(); } });
  window.addEventListener('pagehide', stamp);
  /* teclado virtual aberto: esconde a barra em vez de a deixar a flutuar sobre os campos.
     Deriva de document.activeElement (não de eventos): se o campo for removido sem blur, a barra volta. */
  document.addEventListener('focusin', updateKb);
  document.addEventListener('focusout', () => setTimeout(updateKb, 0));
  window.addEventListener('resize', updateKb);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateKb);
}

export { selectedDay, navMain, navOpts, mainFace, buildNav, syncNav, initNav, openLive };
