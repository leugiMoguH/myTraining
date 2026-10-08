/* myTraining — sessão de treino: máquina de estados persistida.
   NOT_STARTED → ACTIVE ⇄ PAUSED → COMPLETED | ABANDONED.
   Só o utilizador muda o estado: fechar a app nunca conclui nem abandona.
   O tempo é por timestamps (activeMs acumulado + troço em curso), por isso
   sobrevive a refresh, suspensão e fecho da PWA.
   Fica separado das séries (ST.sets) e do descanso (timer.js). */
import { ST, save, todayStr } from './state.js';

const NOT_STARTED = 'NOT_STARTED', ACTIVE = 'ACTIVE', PAUSED = 'PAUSED', COMPLETED = 'COMPLETED', ABANDONED = 'ABANDONED';
const MAX_KEPT = 300;

function cur() { return ST.session || null; }
function sessionState() { const s = cur(); return s ? s.state : NOT_STARTED; }
function isLive() { const s = sessionState(); return s === ACTIVE || s === PAUSED; }

/* tempo efetivo de treino (sem pausas) em ms */
function activeMs(now = Date.now()) {
  const s = cur();
  if (!s) return 0;
  return s.activeMs + (s.state === ACTIVE && s.resumedAt ? Math.max(0, now - s.resumedAt) : 0);
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
  ST.session = { id: `${now}`, day, label: label || '', state: ACTIVE, date: todayStr(), startedAt: now, resumedAt: now, activeMs: 0, endedAt: 0 };
  save();
  return true;
}

function pauseSession() {
  const s = cur();
  if (!s || s.state !== ACTIVE) return false;
  const now = Date.now();
  ST.session = { ...s, activeMs: activeMs(now), resumedAt: 0, state: PAUSED };
  save();
  return true;
}

function resumeSession() {
  const s = cur();
  if (!s || s.state !== PAUSED) return false;
  ST.session = { ...s, resumedAt: Date.now(), state: ACTIVE };
  save();
  return true;
}

function finish(state) {
  const s = cur();
  if (!s || (s.state !== ACTIVE && s.state !== PAUSED)) return false;
  const now = Date.now();
  const done = { ...s, activeMs: activeMs(now), resumedAt: 0, endedAt: now, state };
  ST.session = done;
  ST.workouts = [...(Array.isArray(ST.workouts) ? ST.workouts : []).filter(w => w.id !== done.id), done].slice(-MAX_KEPT);
  save();
  return true;
}
const completeSession = () => finish(COMPLETED);
const abandonSession = () => finish(ABANDONED);

/* a sessão que ficou ACTIVE/PAUSED de ontem não é concluída por magia: o utilizador decide */
function staleSession() { const s = cur(); return !!s && isLive() && s.date !== todayStr(); }

function fmtDur(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export { NOT_STARTED, ACTIVE, PAUSED, COMPLETED, ABANDONED, sessionState, isLive, activeMs, elapsedMs, startSession, pauseSession, resumeSession, completeSession, abandonSession, staleSession, fmtDur };
