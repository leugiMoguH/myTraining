/* myTraining — o plano semanal real: aplica uma proposta à rotina, reorganiza dias, estima a duração.
   Escreve em ST.routine (o motor de treino existente), nunca num sistema paralelo.
   ST.prefs  = respostas do acolhimento (editáveis depois, sem repetir o acolhimento)
   ST.plan   = { id, model, why, notes, createdAt } do último plano aplicado
   ST.onb    = { done, step, draft, legacy?, skipped? } progresso do acolhimento */
import { uid } from './ids.js';
import { WEEK, normalizePrefs, proposePlan } from './planner.js';
import { weekKey } from './schedule.js';
import { liveDay } from './session.js';
import { CUSTOM_DAY } from './routine.js';
import { ST, save, setST, todayStr, weekStartStr } from './state.js';
import { snapshot } from './migrate.js';
import { REST_SEC } from './timer.js';

const SET_SECONDS = 45;   /* tempo de execução de uma série; o descanso é o do utilizador */

/* Altera ST e grava; se não gravar, volta ao estado anterior (nada fica alterado só em memória). */
function commit(mutate) {
  const prev = JSON.stringify(ST);
  mutate();
  if (save()) return true;
  setST(JSON.parse(prev));
  return false;
}
const keepCustom = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k.startsWith(`${CUSTOM_DAY}:`)));

function getPrefs() { return ST.prefs ? normalizePrefs(ST.prefs) : null; }
function hasPlan() { return !!(ST.plan && ST.plan.id); }

/* Minutos aproximados de um dia: séries × (execução + descanso) + 1 min de troca por exercício;
   "10 min" de cardio conta pelo que diz. Só uma estimativa — mostra-se sempre com "~". */
function estimateMin(day) {
  const d = ST.routine && ST.routine[day];
  if (!d || !(d.ex || []).length) return 0;
  const sec = d.ex.reduce((t, e) => {
    const cardio = /(\d+)\s*min/i.exec(String(e.r || ''));
    if (typeof e.s !== 'number' && cardio) return t + (+cardio[1]) * 60;
    const s = typeof e.s === 'number' ? e.s : 1;
    return t + s * (SET_SECONDS + REST_SEC) + 60;
  }, 0);
  return Math.max(5, Math.round(sec / 300) * 5);
}

/* Constrói a rotina: sempre os 7 dias, na ordem da semana (a fila do treino segue essa ordem). */
function routineFrom(plan) {
  const routine = {};
  for (const d of plan.week) {
    routine[d.day] = d.rest
      ? { id: uid(), label: 'Descanso', rest: true, ex: [] }
      : { id: uid(), label: d.label, ex: d.ex.map(e => ({ ...e, id: uid() })) };
  }
  return routine;
}

/* Dias de treino do plano que já passaram nesta semana (e não foram feitos): ficam de fora da fila.
   Um plano criado a meio da semana não pode começar com "em atraso". */
function skippedBefore(plan) {
  const today = (new Date().getDay() + 6) % 7;
  const done = (ST.sched && ST.sched.done) || {};
  return Object.fromEntries(plan.week.filter((d, i) => !d.rest && i < today && !done[d.day]).map(d => [d.day, todayStr()]));
}

/* Aplica a proposta. Antes: cópia verificada; recusa se houver treino em curso ou se a cópia falhar.
   Mantém: ST.log, progressão (ST.prog), sessões, medidas, treinos feitos esta semana (ST.sched.done).
   Troca: a rotina. As marcas de séries da semana saem (os índices deixavam de bater certo). */
function applyPlan(plan, { reason = 'plano novo' } = {}) {
  if (liveDay()) return { ok: false, error: 'Tens um treino em curso. Termina-o ou descarta-o antes de mudar o plano.' };
  const snap = snapshot(reason);
  if (!snap.ok) return { ok: false, error: snap.error };
  const saved = commit(() => {
    ST.routine = routineFrom(plan);
    ST.sets = keepCustom(ST.sets);   /* o treino personalizado de hoje é à parte: as suas séries não se perdem */
    ST.done = keepCustom(ST.done);
    ST.sched = { ...(ST.sched || { week: weekKey(), done: {}, replaced: {} }), swaps: {}, skip: skippedBefore(plan) };
    ST.prefs = plan.prefs;
    ST.plan = { id: uid(), model: plan.model, why: plan.why, notes: plan.notes || [], createdAt: new Date().toISOString() };
    ST.onb = { ...(ST.onb || {}), done: true, step: 0, draft: {} };
    ST.view = '__hoje';
  });
  if (!saved) return { ok: false, error: 'Não foi possível guardar o plano (armazenamento cheio?). Nada foi alterado.' };
  return { ok: true, snapshot: snap };
}

function isTraining(day) { const d = ST.routine && ST.routine[day]; return !!d && !d.rest && (d.ex || []).length > 0; }

/* Troca o conteúdo de dois dias (um treino pode ir para um dia de descanso). Leva consigo as marcas de séries
   e o estado "feito/substituído". Recusa se um dos dias tem o treino em curso. */
function swapDays(a, b) {
  if (a === b || !ST.routine[a] || !ST.routine[b]) return { ok: false, error: 'Dias inválidos.' };
  const live = liveDay();
  if (live === a || live === b) return { ok: false, error: 'Esse dia tem um treino em curso. Termina-o primeiro.' };
  const ra = ST.routine[a], rb = ST.routine[b];
  const other = d => (d === a ? b : d === b ? a : d);
  const swapKeys = o => {
    const out = {};
    for (const [k, v] of Object.entries(o || {})) {
      const m = /^(.*):(\d+)$/.exec(k);
      out[m ? `${other(m[1])}:${m[2]}` : other(k)] = v;
    }
    return out;
  };
  /* as cargas desta semana ligadas às marcas (`k` = "dia:série") acompanham o treino, senão desmarcar deixava a carga no histórico */
  const wk = weekStartStr();
  const relink = log => Object.fromEntries(Object.entries(log || {}).map(([name, arr]) => [name, arr.map(e => (
    e.date >= wk && e.sets ? { ...e, sets: e.sets.map(x => (x.k ? { ...x, k: Object.keys(swapKeys({ [x.k]: 1 }))[0] } : x)) } : e))]));
  const ok = commit(() => {
    ST.routine = { ...ST.routine, [a]: rb, [b]: ra };
    ST.sets = swapKeys(ST.sets);
    ST.done = swapKeys(ST.done);
    ST.log = relink(ST.log);
    if (ST.sched) ST.sched = { ...ST.sched, done: swapKeys(ST.sched.done), replaced: swapKeys(ST.sched.replaced), swaps: swapKeys(ST.sched.swaps), skip: swapKeys(ST.sched.skip) };
  });
  return ok ? { ok: true } : { ok: false, error: 'Não foi possível guardar. Nada foi alterado.' };
}

function planSummary() {
  const p = getPrefs();
  const days = WEEK.filter(isTraining);
  return { prefs: p, days, plan: ST.plan || null };
}

export { getPrefs, hasPlan, estimateMin, routineFrom, applyPlan, swapDays, isTraining, planSummary, proposePlan };
