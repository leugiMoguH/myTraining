/* myTraining — navegação inferior + faixa "treino em curso".
   Cinco destinos: Início · Evolução · [Treino] · Histórico · Opções.
   O botão central só controla a SESSÃO (iniciar / pausar / retomar), nunca o descanso.
   Tudo o que mostra deriva de ST.session e ST.view: não guarda estado próprio. */
import { CUSTOM_DAY, DAYS } from './routine.js';
import { agenda, dayStatus } from './schedule.js';
import { ACTIVE, PAUSED, abandonSession, completeSession, currentSession, durationMs, finishedToday, fmtDur, idleMs, isIdle, isLive, onSessionChange, pauseSession, resumeSession, sessionState, touchSession } from './session.js';
import { ST } from './state.js';
import { render } from './ui.js';
import { openSheet } from './backup.js';
import { closeWorkout, openWorkout, refreshWorkout, startWorkout } from './workout.js';

const SIDE = [
  { id: '__hoje',   icon: '🏠', label: 'Início' },
  { id: '__perfil', icon: '📈', label: 'Evolução' },
  { id: 'main' },
  { id: '__hist',   icon: '📅', label: 'Histórico' },
  { id: 'opts',     icon: '⚙️', label: 'Opções' },
];
const HEARTBEAT_S = 15;

/* Treino "selecionado": o dia que o utilizador está a ver, ou o da agenda. Nunca um arbitrário:
   sem nenhum (descanso, semana fechada) o botão encaminha para o Histórico (onde está a Semana). */
function selectedDay() {
  if (ST.view === '__pers') { const c = DAYS[CUSTOM_DAY]; return c && c.ex && c.ex.length ? CUSTOM_DAY : null; }
  if (ST.view === '__dia' && DAYS[ST.day] && dayStatus(ST.day) !== 'rest') return ST.day;
  const a = agenda();
  return !a.allDone && a.current && !(a.restToday && !a.late) ? a.current : null;
}

const openable = s => !!(DAYS[s.day] && DAYS[s.day].ex && DAYS[s.day].ex.length);

/* Sessão que o plano atual já não consegue mostrar (dia sem exercícios, personalizado desfeito): nada se
   perde nem se fecha sozinho. As cargas já estão em ST.log; o utilizador escolhe, com confirmação. */
function recoverBlocked(s) {
  const quando = `${s.day} (${s.date})`;
  if (confirm(`O treino de ${quando} já não existe no plano atual e não pode ser retomado.\n\nEncerrar guarda-o no histórico com as cargas já registadas. Encerrar agora?`)) { completeSession(); return; }
  if (confirm(`Descartar o treino de ${quando}? Fica marcado como descartado; as cargas registadas ficam no histórico.`)) abandonSession();
}

function openLive() {
  const s = currentSession();
  if (!s) return;
  if (!openable(s)) { recoverBlocked(s); return; }
  openWorkout(s.day, s.pos);
}

function navMain() {
  const st = sessionState();
  if (st === ACTIVE) { pauseSession(); return; }
  if (st === PAUSED) { resumeSession(); return; }   /* uma ação = uma transição; abrir o guiado é a faixa "Abrir" */
  const day = selectedDay();
  if (!day) { render('__hist'); return; }
  /* terminado hoje: nada de reiniciar sozinho. Um personalizado é um treino novo de cada vez: só o concluído bloqueia
     (o descartado deixou uma sessão ABANDONED do dia, mas o treino novo é outro). */
  if (day === CUSTOM_DAY ? ST.custom && ST.custom.stage === 'done' : finishedToday(day)) { render('__hoje'); return; }
  startWorkout(day);
}

function navOpts() { openSheet(); }

const hhmm = ts => new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

/* encerrar à hora da última atividade: decisão explícita, o tempo seguinte não conta */
function navEnd() {
  const s = currentSession();
  if (s && confirm(`Encerrar o treino às ${hhmm(s.seenAt)} (última atividade)? O tempo depois dessa hora não conta.`)) completeSession(s.seenAt);
}
function navAbandon() {
  if (confirm('Descartar este treino? Fica marcado como descartado; as séries e cargas já registadas ficam guardadas.')) abandonSession();
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
  document.getElementById('navEnd').onclick = navEnd;
  document.getElementById('navDrop').onclick = navAbandon;
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
  const f = mainFace();
  const main = document.getElementById('navMain');
  /* Só se toca no botão quando o seu aspeto muda. Reescrevê-lo todos os segundos (o relógio da faixa chama
     syncNav) trocava o nó debaixo do dedo a meio de um toque. */
  const face = `${f.cls}|${f.icon}|${f.label}`;
  if (main && main.dataset.face !== face) {
    main.dataset.face = face;
    main.className = `nb nb-main ${f.cls}`;
    main.setAttribute('aria-label', f.label === 'Treino' ? 'Escolher treino' : `${f.label} treino`);
    main.innerHTML = `<span class="nb-i" aria-hidden="true">${f.icon}</span><span class="nb-l">${f.label}</span>`;
  }
  /* o ecrã atual: um dia concreto conta como Histórico (vem da Semana); a Nutrição vive nas Opções */
  const at = ST.view === '__dia' || ST.view === '__semana' ? '__hist' : ST.view === '__pers' ? '__hoje' : ST.view;
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
  onSessionChange(syncNav);
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

export { selectedDay, navMain, navOpts, mainFace, buildNav, syncNav, initNav, openLive };
