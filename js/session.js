/* myTraining — sessão de treino: máquina de estados persistida.
   NOT_STARTED → ACTIVE ⇄ PAUSED → COMPLETED | ABANDONED.
   Só o utilizador muda o estado: nada fecha, pausa ou descarta uma sessão sozinho
   (nem fechar a app, nem mudar de dia, de semana ou de plano).

   Tempo — quatro grandezas, nenhuma estimada sem o dizer, nenhum limiar escondido:
     decorrido   = fim (ou agora) − início                       medido (relógio)
     pausado     = soma das pausas pedidas pelo utilizador        medido
     duração     = decorrido − pausado                            medido: é "o tempo do treino"
     confirmado  = tempo ACTIVE com a app visível e a dar sinal   medido, é um mínimo: só soma ≤30 s
                   por sinal (batimento de 15 s, toques, séries), nunca o intervalo em que a app
                   esteve escondida ou fechada
     sem registo = duração − confirmado                           derivado: inclui descansos com o ecrã
                   bloqueado, mas também uma sessão esquecida. Mostra-se à parte, nunca se junta.
   Não há execução em segundo plano: o que a app não viu fica em "sem registo".

   Campos de ST.session: id, day, label, state, date (data civil de INÍCIO — é a data do treino, mesmo
   que passe a meia-noite; a semana do treino deriva dela), startedAt, endedAt, seenAt (último sinal),
   confirmedMs, pausedMs, pauseAt (início da pausa em curso), pos (exercício no guiado). */
import { ST, save, todayStr } from './state.js';

const NOT_STARTED = 'NOT_STARTED', ACTIVE = 'ACTIVE', PAUSED = 'PAUSED', COMPLETED = 'COMPLETED', ABANDONED = 'ABANDONED';
const KNOWN = new Set([ACTIVE, PAUSED, COMPLETED, ABANDONED]);
const MAX_KEPT = 300;
const CREDIT_CAP_MS = 30 * 1000;           /* teto de tempo confirmado por sinal */
/* Só para AVISAR ("sem atividade há…") e sugerir o fim ao terminar. Não altera nenhum dado. */
const IDLE_HINT_MS = 30 * 60 * 1000;

/* a interface regista aqui o que tem de reagir a uma mudança de estado */
const LISTENERS = [];
function onSessionChange(fn) { LISTENERS.push(fn); }
function emit() { for (const fn of LISTENERS) { try { fn(); } catch (e) { console.error('session listener', e); } } }
function notifySession() { emit(); }
/* quem guarda coisas só para a sessão (schedule.js: marcas e trocas que atravessaram a semana) limpa-as aqui */
const ENDERS = [];
function onSessionEnd(fn) { ENDERS.push(fn); }

/* Sessão guardada pela versão anterior (activeMs/resumedAt): converte-se sem perder o tempo. */
function normalize(s) {
  if (s.pausedMs !== undefined) return s;
  const ref = s.endedAt || Date.now();
  const closed = s.activeMs || 0;
  if (s.state === PAUSED) {                      /* a pausa em curso conta-se à parte (pauseAt), não em pausedMs */
    const pa = Math.min(ref, s.seenAt || ref);
    return { ...s, confirmedMs: 0, pauseAt: pa, pausedMs: Math.max(0, pa - s.startedAt - closed) };
  }
  const run = s.state === ACTIVE && s.resumedAt ? Math.max(0, ref - s.resumedAt) : 0;
  return { ...s, confirmedMs: 0, pauseAt: 0, pausedMs: Math.max(0, ref - s.startedAt - closed - run) };
}
/* um valor guardado malformado (backup antigo, edição manual) é ignorado, não rebenta */
function cur() { const s = ST.session; return s && typeof s === 'object' && KNOWN.has(s.state) && s.startedAt > 0 ? normalize(s) : null; }
function sessionState() { const s = cur(); return s ? s.state : NOT_STARTED; }
function isLive() { const s = sessionState(); return s === ACTIVE || s === PAUSED; }
function currentSession() { return cur(); }
/* dia do treino em curso (ou null): o que a agenda, o reset semanal e o personalizado têm de respeitar */
function liveDay() { return isLive() ? cur().day : null; }

function statsOf(s0, now = Date.now()) {
  const s = s0 && typeof s0 === 'object' && s0.startedAt > 0 ? normalize(s0) : null;   /* também para o histórico guardado no formato antigo */
  if (!s) return { elapsed: 0, paused: 0, duration: 0, confirmed: 0, unknown: 0 };
  const end = s.endedAt || now;
  const elapsed = Math.max(0, end - s.startedAt);
  const paused = Math.min(elapsed, (s.pausedMs || 0) + (s.state === PAUSED && s.pauseAt ? Math.max(0, end - s.pauseAt) : 0));
  const duration = elapsed - paused;
  const confirmed = Math.min(s.confirmedMs || 0, duration);
  return { elapsed, paused, duration, confirmed, unknown: duration - confirmed };
}
const timeStats = now => statsOf(cur(), now);
const durationMs = now => statsOf(cur(), now).duration;

/* sinal de vida: batimentos, toques e séries. `credit` falso = a app acaba de voltar de escondida/fechada,
   o intervalo anterior NÃO se confirma. */
function touchSession(now = Date.now(), credit = true) {
  const s = cur();
  if (!s || (s.state !== ACTIVE && s.state !== PAUSED)) return;
  const add = s.state === ACTIVE && credit ? Math.max(0, Math.min(now - (s.seenAt || now), CREDIT_CAP_MS)) : 0;
  ST.session = { ...s, seenAt: now, confirmedMs: (s.confirmedMs || 0) + add };
  save();
}
/* há quanto tempo não há sinal (só para avisar o utilizador) */
function idleMs(now = Date.now()) { const s = cur(); return s && isLive() ? Math.max(0, now - (s.seenAt || s.startedAt)) : 0; }
function isIdle(now = Date.now()) { return idleMs(now) > IDLE_HINT_MS; }

function startSession(day, label) {
  if (isLive()) return false;                 /* nunca duas sessões ao mesmo tempo */
  const now = Date.now();
  ST.session = { id: `${now}-${Math.random().toString(36).slice(2, 6)}`, day, label: label || '', state: ACTIVE, date: todayStr(), startedAt: now, seenAt: now, confirmedMs: 0, pausedMs: 0, pauseAt: 0, endedAt: 0, pos: 0 };
  save(); emit();
  return true;
}

function pauseSession() {
  const s = cur();
  if (!s || s.state !== ACTIVE) return false;
  touchSession();
  const now = Date.now();
  ST.session = { ...cur(), state: PAUSED, pauseAt: now, seenAt: now };
  save(); emit();
  return true;
}

function resumeSession() {
  const s = cur();
  if (!s || s.state !== PAUSED) return false;
  const now = Date.now();
  ST.session = { ...s, state: ACTIVE, pausedMs: (s.pausedMs || 0) + Math.max(0, now - (s.pauseAt || now)), pauseAt: 0, seenAt: now };
  save(); emit();
  return true;
}

/* `endAt` permite encerrar na hora da última atividade (decisão explícita do utilizador, ver workout.js) */
function finish(state, endAt) {
  const s0 = cur();
  if (!s0 || (s0.state !== ACTIVE && s0.state !== PAUSED)) return false;
  if (endAt === undefined) touchSession();
  const s = cur();
  const now = Date.now();
  const paused = s.state === PAUSED && s.pauseAt;
  const end = Math.min(now, Math.max(s.startedAt, paused ? Math.max(s.pauseAt, endAt || now) : (endAt || now)));
  const done = { ...s, state, endedAt: end, pausedMs: (s.pausedMs || 0) + (paused ? Math.max(0, end - s.pauseAt) : 0), pauseAt: 0 };
  ST.session = done;
  ST.workouts = [...(Array.isArray(ST.workouts) ? ST.workouts : []).filter(w => w.id !== done.id), done].slice(-MAX_KEPT);
  save();
  for (const fn of ENDERS) { try { fn(done); } catch (e) { console.error('session end', e); } }
  emit();
  return true;
}
const completeSession = endAt => finish(COMPLETED, endAt);
const abandonSession = () => finish(ABANDONED);
/* fecha a sessão viva SE for deste dia (ex.: o treino personalizado acabou por decisão do utilizador) */
function endSessionOf(day, completed) { const s = cur(); if (s && isLive() && s.day === day) finish(completed ? COMPLETED : ABANDONED); }

/* O utilizador reiniciou o progresso deste dia: a sessão DELE (viva ou já terminada hoje) deixa de ser a sessão
   atual. A viva não vai para o histórico nem fica ABANDONED; a terminada continua em ST.workouts, mas já não
   bloqueia o Play (`finishedToday`). Devolve a sessão retirada (ou null). */
function dropSessionOf(day) {
  const s = cur();
  if (!s || s.day !== day) return null;
  const live = isLive();
  ST.session = null;
  save();
  if (live) for (const fn of ENDERS) { try { fn(s); } catch (e) { console.error('session end', e); } }
  emit();
  return s;
}

/* exercício do treino guiado onde o utilizador está (para retomar no sítio certo) */
function setSessionPos(idx) {
  const s = cur();
  if (!s || !isLive() || s.pos === idx) return;
  ST.session = { ...s, pos: idx };
  save();
}

const ymd = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/* treino deste dia já terminado hoje (concluído ou abandonado): não se reinicia sozinho */
function finishedToday(day) {
  const s = cur();
  return !!s && (s.state === COMPLETED || s.state === ABANDONED) && s.day === day && (s.date === todayStr() || (s.endedAt && ymd(s.endedAt) === todayStr()));
}

function fmtDur(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export { NOT_STARTED, ACTIVE, PAUSED, COMPLETED, ABANDONED, IDLE_HINT_MS, CREDIT_CAP_MS, onSessionChange, onSessionEnd, notifySession, statsOf, currentSession, liveDay, sessionState, isLive, timeStats, durationMs, touchSession, idleMs, isIdle, startSession, pauseSession, resumeSession, completeSession, abandonSession, endSessionOf, dropSessionOf, setSessionPos, finishedToday, fmtDur };
