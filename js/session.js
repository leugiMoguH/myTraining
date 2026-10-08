/* myTraining — sessão de treino: máquina de estados persistida.
   NOT_STARTED → ACTIVE ⇄ PAUSED → COMPLETED | ABANDONED.
   Só o utilizador muda o estado: fechar a app nunca conclui nem abandona.
   O tempo é por timestamps (activeMs acumulado + troço em curso), por isso
   sobrevive a refresh, suspensão e fecho da PWA.
   Fica separado das séries (ST.sets) e do descanso (timer.js).

   Campos de ST.session: id, day, label, state, date, startedAt, resumedAt (início do
   troço ACTIVE em curso), activeMs (troços já fechados), endedAt, pos (índice do
   exercício no treino guiado), seenAt (último sinal de vida, ver reconcileSession). */
import { ST, save, todayStr } from './state.js';

const NOT_STARTED = 'NOT_STARTED', ACTIVE = 'ACTIVE', PAUSED = 'PAUSED', COMPLETED = 'COMPLETED', ABANDONED = 'ABANDONED';
const KNOWN = new Set([ACTIVE, PAUSED, COMPLETED, ABANDONED]);
const MAX_KEPT = 300;
/* Sem sinal de vida durante tanto tempo = a app esteve fechada/morta, não a treinar. */
const IDLE_GAP_MS = 30 * 60 * 1000;

/* a interface regista aqui o que tem de reagir a uma mudança de estado */
const LISTENERS = [];
function onSessionChange(fn) { LISTENERS.push(fn); }
function notifySession() { emit(); }
function emit() { for (const fn of LISTENERS) { try { fn(); } catch (e) { console.error('session listener', e); } } }

/* um valor guardado malformado (backup antigo, edição manual) é ignorado, não rebenta */
function cur() { const s = ST.session; return s && typeof s === 'object' && KNOWN.has(s.state) && s.startedAt > 0 ? s : null; }
function sessionState() { const s = cur(); return s ? s.state : NOT_STARTED; }
function isLive() { const s = sessionState(); return s === ACTIVE || s === PAUSED; }
function currentSession() { return cur(); }

/* tempo efetivo de treino (sem pausas) em ms */
function activeMs(now = Date.now()) {
  const s = cur();
  if (!s) return 0;
  return (s.activeMs || 0) + (s.state === ACTIVE && s.resumedAt ? Math.max(0, now - s.resumedAt) : 0);
}
/* tempo total desde o início até ao fim (ou agora) em ms */
function elapsedMs(now = Date.now()) {
  const s = cur();
  if (!s) return 0;
  return Math.max(0, (s.endedAt || now) - s.startedAt);
}

function startSession(day, label) {
  if (isLive()) return false;                 /* nunca duas sessões ao mesmo tempo */
  const now = Date.now();
  ST.session = { id: `${now}-${Math.random().toString(36).slice(2, 6)}`, day, label: label || '', state: ACTIVE, date: todayStr(), startedAt: now, resumedAt: now, seenAt: now, activeMs: 0, endedAt: 0, pos: 0 };
  save(); emit();
  return true;
}

function pauseSession() {
  const s = cur();
  if (!s || s.state !== ACTIVE) return false;
  const now = Date.now();
  ST.session = { ...s, activeMs: activeMs(now), resumedAt: 0, seenAt: now, state: PAUSED };
  save(); emit();
  return true;
}

function resumeSession() {
  const s = cur();
  if (!s || s.state !== PAUSED) return false;
  const now = Date.now();
  ST.session = { ...s, resumedAt: now, seenAt: now, state: ACTIVE };
  save(); emit();
  return true;
}

function finish(state) {
  const s = cur();
  if (!s || (s.state !== ACTIVE && s.state !== PAUSED)) return false;
  const now = Date.now();
  const done = { ...s, activeMs: activeMs(now), resumedAt: 0, endedAt: now, state };
  ST.session = done;
  ST.workouts = [...(Array.isArray(ST.workouts) ? ST.workouts : []).filter(w => w.id !== done.id), done].slice(-MAX_KEPT);
  save(); emit();
  return true;
}
const completeSession = () => finish(COMPLETED);
const abandonSession = () => finish(ABANDONED);
/* fecha a sessão viva SE for deste dia (ex.: o treino personalizado acabou) */
function endSessionOf(day, completed) { const s = cur(); if (s && isLive() && s.day === day) finish(completed ? COMPLETED : ABANDONED); }

/* exercício do treino guiado onde o utilizador está (para retomar no sítio certo) */
function setSessionPos(idx) {
  const s = cur();
  if (!s || !isLive() || s.pos === idx) return;
  ST.session = { ...s, pos: idx };
  save();
}

/* sinal de vida: chamado em intervalos e quando a página fica escondida */
function touchSession(now = Date.now()) {
  const s = cur();
  if (!s || s.state !== ACTIVE) return;
  ST.session = { ...s, seenAt: now };
  save();
}

/* Ao abrir a app: se esteve ACTIVE mas sem sinal de vida há muito, o tempo parado não é treino.
   Pausa-se no último sinal de vida (reversível por "Retomar"); nunca se conclui nada. */
function reconcileSession(now = Date.now()) {
  const s = cur();
  if (!s || s.state !== ACTIVE || !s.seenAt || now - s.seenAt <= IDLE_GAP_MS) return false;
  ST.session = { ...s, activeMs: (s.activeMs || 0) + Math.max(0, s.seenAt - (s.resumedAt || s.seenAt)), resumedAt: 0, state: PAUSED };
  save(); emit();
  return true;
}

/* sessão que ficou viva de outro dia: o utilizador decide, nada é concluído por magia */
function staleSession(now = Date.now()) { const s = cur(); return !!s && isLive() && s.date !== todayStr() && now - (s.seenAt || s.startedAt) > IDLE_GAP_MS; }

/* treino deste dia já terminado hoje (concluído ou abandonado): não se reinicia sozinho */
function finishedToday(day) {
  const s = cur();
  return !!s && (s.state === COMPLETED || s.state === ABANDONED) && s.day === day && s.date === todayStr();
}

function fmtDur(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export { NOT_STARTED, ACTIVE, PAUSED, COMPLETED, ABANDONED, IDLE_GAP_MS, onSessionChange, notifySession, currentSession, sessionState, isLive, activeMs, elapsedMs, startSession, pauseSession, resumeSession, completeSession, abandonSession, endSessionOf, setSessionPos, touchSession, reconcileSession, staleSession, finishedToday, fmtDur };
