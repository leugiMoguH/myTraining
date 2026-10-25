import { confirmDialog } from './dialog.js';
/* myTraining — cinco destinos globais e faixa de sessão. */
import { show } from './notice.js';
import { DAYS } from './routine.js';
import { agenda } from './schedule.js';
import { ACTIVE, PAUSED, abandonSession, completeSession, currentSession, durationMs, finishedToday, fmtDur, idleMs, isIdle, isLive, onSessionChange, pauseSession, resumeSession, sessionState, touchSession } from './session.js';
import { ST } from './state.js';
import { render, syncHeaderTimer } from './ui.js';
import { openSheet } from './backup.js';
import { closeWorkout, openWorkout, refreshWorkout, startWorkout } from './workout.js';

const SIDE = [
  { id: '__hoje',   icon: '🏠', label: 'Hoje' },
  { id: '__semana', icon: '📅', label: 'Semana' },
  { id: '__perfil', icon: '📈', label: 'Evolução' },   /* id antigo = ecrã Evolução; Perfil = '__eu', Plano = '__plano' (via Opções) */
  { id: '__nutri', icon: '🥗', label: 'Nutrição' },
  { id: 'opts',     icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>', label: 'Mais'  },
];
const HEARTBEAT_S = 15;

const openable = s => !!(DAYS[s.day] && DAYS[s.day].ex && DAYS[s.day].ex.length);

/* Sessão que o plano atual já não consegue mostrar (dia sem exercícios, personalizado desfeito): nada se
   perde nem se fecha sozinho. As cargas já estão em ST.log; o utilizador escolhe, com confirmação. */
async function recoverBlocked(s) {
  const id = s.id;
  const decision = await confirmDialog({ title:'Treino indisponível', message:`O treino de ${s.day} (${s.date}) já não existe no plano atual. Encerrar guarda-o no histórico com as cargas registadas.`, confirmLabel:'Encerrar', altLabel:'Descartar', danger:true });
  const live = currentSession();
  if (!live || live.id !== id || openable(live)) return;
  if (decision === true) completeSession();
  else if (decision === 'alt') abandonSession();
}

async function openLive() {
  const s = currentSession();
  if (!s) return;
  if (!openable(s)) { return recoverBlocked(s); }
  openWorkout(s.day, s.pos);
}

/* Botão do cartão Hoje: inicia ou abre a sessão do dia, com confirmação se já terminou. */
async function heroStart(day) {
  if (isLive()) { const s = currentSession(); if (s.day === day) return openLive(); return startWorkout(day); }
  const context = JSON.stringify([ST.view, ST.day, DAYS[day], ST.custom]);
  if (finishedToday(day) && !await confirmDialog({title:'Iniciar outro treino', confirmLabel:'Iniciar outro', message:`O treino de ${day} já terminou hoje. Iniciar outro?`})) return;
  if (isLive() || !DAYS[day] || context !== JSON.stringify([ST.view, ST.day, DAYS[day], ST.custom])) return;
  return startWorkout(day);
}

function navOpts() { document.querySelector('#sheetBg .sheet').scrollTop = 0; openSheet(); }

const hhmm = ts => new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

/* encerrar à hora da última atividade: decisão explícita, o tempo seguinte não conta */
async function navEnd() {
  const s = currentSession(); if (!s) return;
  const { id, seenAt } = s;
  if (await confirmDialog({title:'Encerrar treino', message:`Encerrar o treino às ${hhmm(seenAt)} (última atividade)? O tempo depois dessa hora não conta.`, confirmLabel:'Encerrar'})) {
    if (currentSession()?.id === id) completeSession(seenAt);
  }
}
async function navAbandon() {
  const id = currentSession()?.id; if (!id) return;
  if (await confirmDialog({title:'Descartar treino', message:'Descartar este treino? As séries e cargas já registadas ficam guardadas.', danger:true, confirmLabel:'Descartar'})) {
    if (currentSession()?.id === id) abandonSession();
  }
}

function buildNav() {
  const row = document.getElementById('navRow');
  row.innerHTML = '';
  SIDE.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nb'; b.dataset.day = it.id;
    b.innerHTML = `<span class="nb-i" aria-hidden="true">${it.icon}</span><span class="nb-l">${it.label}</span>`;
    b.onclick = it.id === 'opts' ? navOpts : () => render(it.id);
    row.appendChild(b);
  });
  document.getElementById('navLive').onclick = () => openLive().catch(() => show('Não foi possível atualizar o treino.', 'error'));
  document.getElementById('navPause').onclick = () => {
    if (sessionState() === ACTIVE) pauseSession();
    else if (sessionState() === PAUSED) resumeSession();
  };
  document.getElementById('navEnd').onclick = () => navEnd().catch(() => show('Não foi possível atualizar o treino.', 'error'));
  document.getElementById('navDrop').onclick = () => navAbandon().catch(() => show('Não foi possível atualizar o treino.', 'error'));
  document.getElementById('navEnd').title = 'Encerrar à hora da última atividade';
  document.getElementById('navDrop').title = 'Descartar treino';
  syncNav();
}

/* 'há 3 h 05' / 'há 12 min' — nunca '3:00', que parece um cronómetro */
function fmtIdle(ms) { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; }

function liveText(s) {
  const d = fmtDur(durationMs());
  if (isIdle()) return `⏳ Sem atividade há ${fmtIdle(idleMs())} · ${s.day} ${s.date.slice(5).split('-').reverse().join('/')}`;
  return `${s.state === PAUSED ? '⏸ Em pausa' : '● Em curso'} · ${s.day} · ${d}`;
}

function syncNav() {
  const destinations = { __hoje:'__hoje', __pers:'__hoje', __semana:'__semana', __dia:'__semana', __perfil:'__perfil', __ex:'__perfil', __hist:'__perfil', __nutri:'__nutri', __plano:'opts', __eu:'opts' };
  const at = destinations[ST.view];
  document.querySelectorAll('.nb[data-day]').forEach(b => {
    const on = b.dataset.day === at;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const badge = agenda().pending;
  const home = document.querySelector('.nb[data-day="__hoje"] .nb-i');
  if (home) {
    home.dataset.badge = badge ? String(badge) : '';
    home.setAttribute('aria-label', `${badge} treinos por fazer`);
  }

  /* faixa de sessão viva (só quando a vista guiada está fechada) */
  const live = document.getElementById('navLive');
  const viewOpen = document.getElementById('woBg').classList.contains('show');
  const show = isLive() && !viewOpen;
  live.hidden = !show;
  const pause = document.getElementById('navPause');
  pause.hidden = !show;
  const paused = sessionState() === PAUSED;
  const face = paused ? 'paused' : 'active';
  if (show && pause.dataset.face !== face) {
    pause.dataset.face = face;
    const label = paused ? 'Retomar treino' : 'Pausar treino';
    pause.setAttribute('aria-label', label);
    pause.title = label;
    pause.textContent = paused ? '▶' : '⏸';
  }
  const idle = show && isIdle();
  document.getElementById('navEnd').hidden = !idle;     /* encerrar na última atividade: só se esteve parado */
  document.getElementById('navDrop').hidden = !show;    /* descartar: sempre explícito, sempre à mão */
  if (show) { const t = live.querySelector('.nl-t'), txt = liveText(currentSession()); if (t.textContent !== txt) t.textContent = txt; }
}

/* relógio da faixa + sinal de vida. O sinal só conta com a app visível e SEM longa ausência: depois de
   uma ausência longa é o utilizador (abrir/retomar/registar) que o reativa, nunca o temporizador. */
let beat = 0;
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

function tick() {
  updateKb();
  if (isLive()) syncNav();
  if (!document.hidden && !isIdle() && ++beat % HEARTBEAT_S === 0) touchSession();
}

function initNav() {
  buildNav();
  onSessionChange(() => { syncNav(); syncHeaderTimer(); });
  setInterval(tick, 1000);
  /* escondida: último sinal (com crédito). De volta: sem crédito pelo intervalo, e só se não esteve parado muito tempo */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) touchSession();
    else {
      /* ausência longa: a vista guiada fecha-se para a faixa oferecer, de forma explícita, abrir/encerrar/descartar */
      if (isIdle()) { if (document.getElementById('woBg').classList.contains('show')) closeWorkout(); }
      else touchSession(Date.now(), false);
      refreshWorkout(); syncNav();
    }
  });
  window.addEventListener('pagehide', () => touchSession());
  /* teclado virtual aberto: esconde a barra em vez de a deixar a flutuar sobre os campos.
     Deriva de document.activeElement (não de eventos): se o campo for removido sem blur, a barra volta. */
  document.addEventListener('focusin', updateKb);
  document.addEventListener('focusout', () => setTimeout(updateKb, 0));
  window.addEventListener('resize', updateKb);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateKb);
}

export { heroStart, navOpts, buildNav, syncNav, initNav, openLive };
