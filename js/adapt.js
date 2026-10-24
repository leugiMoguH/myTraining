/* Adaptação pontual: decisões explícitas, sem alterar a rotina ou o histórico. */
import { ST, save, setST } from './state.js';
import { dayNames, getDay, exercisesOf } from './routine.js';
import { weekKey, dayStatus, isRest, currentDay, plannedIdx, moveOf } from './schedule.js';
import { dateOfDay, occurrences, occurrencesOn } from './classes.js';
import { liveDay } from './session.js';
import { REST_SEC } from './timer.js';
import { uid } from './ids.js';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const modes = ['quick', 'retoma'];
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const safe = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const clock = n => new Date(typeof n === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n) ? `${n}T12:00:00` : n);
const civil = n => {
  const d = clock(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && civil(d) === d;
const timestamp = t => typeof t === 'string' && !isNaN(Date.parse(t));
const error = message => ({ ok: false, error: message });
const marks = day => Object.entries(ST.sets || {}).some(([k, v]) => k.startsWith(`${day}:`) && Array.isArray(v) && v.length);
const customAlive = now => ST.custom && Array.isArray(ST.custom.ex) && validDate(ST.custom.date) && ST.custom.stage !== 'done' &&
  (ST.custom.date === civil(now) || liveDay() === 'Personalizado');

function validateAdaptState(a) {
  if (a === undefined) return { ok: true };
  if (!object(a) || !object(a.moves) || !object(a.dismissed) || !Array.isArray(a.hist) ||
      a.hist.length > 60 || Object.keys(a.dismissed).length > 100 || Object.keys(a.moves).length > 27) return error('Adaptação inválida.');
  const days = new Set(), targets = new Set();
  for (const [id, m] of Object.entries(a.moves)) {
    if (!object(m) || id !== m.id || !safe(id) || !safe(m.dayId) ||
        !(m.planId === '' || safe(m.planId)) || !DAYS.includes(m.day) || !DAYS.includes(m.to) || m.day === m.to ||
        !/^\d{4}-W\d{2}$/.test(m.wk) || !validDate(m.date) || weekKey(clock(m.date)) !== m.wk ||
        dateOfDay(m.to, m.date) !== m.date || !timestamp(m.ts) || !['missed', 'class', 'manual'].includes(m.reason) ||
        days.has(`${m.wk}:${m.day}`) || targets.has(`${m.wk}:${m.to}`)) return error('Move inválido.');
    days.add(`${m.wk}:${m.day}`);
    targets.add(`${m.wk}:${m.to}`);
  }
  if (Object.entries(a.dismissed).some(([k, v]) => k.length > 200 || !timestamp(v)) ||
      a.hist.some(e => !object(e) || !timestamp(e.ts) || !['move', 'undo', 'dismiss', 'quick'].includes(e.type) ||
        (e.day !== undefined && !DAYS.includes(e.day)) || (e.to !== undefined && !DAYS.includes(e.to)) ||
        (e.key !== undefined && (typeof e.key !== 'string' || e.key.length > 200)))) return error('Histórico de adaptação inválido.');
  return { ok: true };
}

function adaptState() {
  const source = ST.adapt;
  if (!source || !object(source)) {
    ST.adapt = { moves: {}, dismissed: {}, hist: [] };
    return ST.adapt;
  }
  const wk = weekKey();
  const moves = Object.entries(object(source.moves) ? source.moves : {});
  const current = moves.filter(([, m]) => m?.wk === wk);
  const old = moves.filter(([, m]) => m?.wk !== wk).sort(([, a], [, b]) => String(a?.ts).localeCompare(String(b?.ts))).slice(-20);
  const hist = Array.isArray(source.hist) ? source.hist.slice(-60) : [];
  for (const [, m] of old) {
    if (m && !hist.some(e => e.type === 'move' && e.ts === m.ts && e.day === m.day)) {
      hist.push({ type: 'move', ts: m.ts, day: m.day, to: m.to });
    }
  }
  const candidate = { moves: Object.fromEntries([...old, ...current]),
    dismissed: object(source.dismissed) ? Object.fromEntries(Object.entries(source.dismissed).slice(-100)) : {}, hist: hist.slice(-60) };
  ST.adapt = validateAdaptState(candidate).ok ? candidate : { moves: {}, dismissed: {}, hist: [] };
  return ST.adapt;
}

function commit(fn) {
  const previous = JSON.stringify(ST);
  try {
    fn();
    if (save()) return { ok: true };
  } catch (e) {
    setST(JSON.parse(previous));
    return error(e.message);
  }
  setST(JSON.parse(previous));
  return error('Não foi possível guardar. Nada foi alterado.');
}

function record(type, now, fields = {}) {
  const a = adaptState();
  ST.adapt = { ...a, hist: [...a.hist, { type, ts: clock(now).toISOString(), ...fields }].slice(-60) };
}

function lastActivityDate(now = new Date()) {
  const dates = [
    ...(ST.workouts || []).filter(w => w.state === 'COMPLETED').map(w => w.date),
    ...(ST.sessions || []).map(s => s.date), ...Object.values(ST.sched?.done || {}),
    ...Object.values(ST.log || {}).flat().map(e => e.date),
  ];
  return dates.filter(d => validDate(d) && d <= civil(now)).sort().pop() || null;
}

function moveCandidates(day, now = new Date()) {
  const n = clock(now), today = civil(n);
  const classes = occurrences(n, n).filter(o => ['planned', 'done'].includes(o.status));
  return DAYS.filter(d => d !== day && dateOfDay(d, n) >= today).map(target => {
    const date = dateOfDay(target, n), reasons = [];
    if (!getDay(target) || !isRest(target)) reasons.push(`${target} tem treino`);
    if (dayNames().some(d => d !== day && moveOf(d, n)?.to === target)) reasons.push(`${target} já recebe outro treino`);
    const intense = classes.filter(o => o.date === date && (o.cls.intensity === 3 || o.cls.min >= 75));
    intense.forEach(o => reasons.push(`${target} tem uma aula intensa (${o.cls.name})`));
    const occupied = new Set(dayNames().filter(d => d !== day && !isRest(d) &&
      !['swapped', 'skipped'].includes(dayStatus(d))).map(d => plannedIdx(d, n)));
    classes.filter(o => o.cls.intensity === 3 || o.cls.min >= 75).forEach(o => occupied.add(DAYS.indexOf(o.day)));
    occupied.add(DAYS.indexOf(target));
    let run = 0, longest = 0;
    for (let i = 0; i < 7; i++) {
      run = occupied.has(i) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    if (longest > 3) reasons.push(`ficavas com ${longest} dias seguidos`);
    const light = classes.filter(o => o.date === date && !intense.includes(o));
    return { day: target, date, ok: !reasons.length, reasons,
      ...(light.length ? { note: `Também tens ${light.map(o => o.cls.name).join(', ')} (aula leve).` } : {}) };
  });
}

function pendingError(day) {
  if (!getDay(day) || dayStatus(day) !== 'todo') return 'Esse treino já não está pendente.';
  if (marks(day)) return 'Esse treino tem séries marcadas.';
  if (liveDay() === day) return 'Esse treino tem uma sessão em curso.';
  return null;
}

function moveDay(day, to, reason = 'manual', now = new Date()) {
  const n = clock(now), problem = pendingError(day);
  if (problem) return error(problem);
  if (!safe(getDay(day).id)) return error('O dia do plano não tem uma identidade válida.');
  if (!['manual', 'missed', 'class'].includes(reason)) return error('Motivo inválido.');
  if (Object.values(ST.classLog || {}).some(o => ['planned', 'done'].includes(o.status) &&
      o.replacesDay === day && weekKey(clock(o.date)) === weekKey(n))) return error('Uma aula está ligada a esse treino.');
  const previous = moveOf(day, n);
  if (previous?.to === to) return { ok: true, id: previous.id };
  if (!moveCandidates(day, n).some(c => c.day === to && c.ok)) return error('Esse dia não está disponível nesta semana.');
  const id = uid();
  const result = commit(() => {
    const a = adaptState();
    const moves = Object.fromEntries(Object.entries(a.moves).filter(([, m]) => m.day !== day));
    moves[id] = { id, day, to, wk: weekKey(n), date: dateOfDay(to, n), ts: n.toISOString(), reason,
      dayId: getDay(day).id, planId: ST.plan?.id || '' };
    ST.adapt = { ...a, moves };
    record('move', n, { day, to });
  });
  return { ...result, ...(result.ok ? { id } : {}) };
}

function undoMove(id) {
  const m = ST.adapt?.moves?.[id];
  if (!m) return { ok: true };
  const problem = pendingError(m.day);
  if (problem) return error(problem);
  return commit(() => {
    const a = adaptState(), moves = { ...a.moves };
    delete moves[id];
    ST.adapt = { ...a, moves };
    record('undo', new Date(), { day: m.day, to: m.to });
  });
}

function suggestion(now = new Date()) {
  const n = clock(now), day = currentDay(n);
  if (liveDay() || customAlive(n) || !day || pendingError(day)) return null;
  const dismissed = ST.adapt?.dismissed || {}, last = lastActivityDate(n);
  const dayNumber = d => { const c = clock(d); return Date.UTC(c.getFullYear(), c.getMonth(), c.getDate()) / 86400000; };
  const gap = last ? dayNumber(n) - dayNumber(last) : 0;
  if (gap >= 14) {
    const key = `back:${last}`;
    if (dismissed[key]) return null;
    return { key, kind: 'back', day, gap, title: 'Uma opção para o regresso',
      what: `O último registo foi há ${gap} dias.`, why: 'Podes fazer uma retoma com até 2 séries por exercício; mantém o treino habitual se preferires.',
      accept: { type: 'quick', mode: 'retoma', day } };
  }
  const key = `missed:${weekKey(n)}:${day}`;
  if (dismissed[key] || moveOf(day, n) || plannedIdx(day, n) >= DAYS.indexOf(DAYS[(n.getDay() + 6) % 7])) return null;
  const candidates = moveCandidates(day, n), chosen = candidates.find(c => c.ok);
  const why = candidates.filter(c => !c.ok).flatMap(c => c.reasons).join('; ');
  return { key, kind: 'missed', day, title: 'Ajustar esta semana', what: `O treino de ${day} continua pendente.`,
    why: chosen ? `Podes passá-lo para ${chosen.day}, só esta semana. ${why}` : `Esta semana não há um dia livre sem sobrecarregar. O treino de ${day} continua pendente. ${why}`,
    accept: chosen ? { type: 'move', day, to: chosen.day } : null,
    ...(!chosen ? { limit: true, alt: { type: 'quick', mode: 'quick', day } } : {}) };
}

function dismiss(key, now = new Date()) {
  if (typeof key !== 'string' || key.length > 200) return error('Sugestáo inválida.');
  if (ST.adapt?.dismissed?.[key]) return { ok: true };
  return commit(() => {
    const a = adaptState(), n = clock(now);
    const dismissed = Object.fromEntries(Object.entries(a.dismissed).filter(([k, t]) =>
      n - new Date(t) <= 60 * 86400000 && (!k.startsWith('missed:') || k.startsWith(`missed:${weekKey(n)}:`))).slice(-99));
    ST.adapt = { ...a, dismissed: { ...dismissed, [key]: n.toISOString() } };
    record('dismiss', n, { key });
  });
}

function quickPlan(day, { budgetMin = 18, mode = 'quick', rest = REST_SEC, now = new Date() } = {}) {
  const original = exercisesOf(day);
  const eligible = original.map((ex, i) => ({ ex, i })).filter(({ i }) => !ST.sets?.[`${day}:${i}`]?.length);
  const selected = new Map(), patterns = new Set();
  let seconds = 0;
  function cost(ex, sets) {
    const time = String(ex.r || '').match(/(\d+)\s*(min|s)\b/i);
    return 60 + sets * (time ? +time[1] * (time[2].toLowerCase() === 'min' ? 60 : 1) + rest : 45 + rest);
  }
  function add(ex, i) {
    const sets = mode === 'retoma' ? Math.min(Number(ex.s) || 1, 2) : 1;
    const duration = cost(ex, sets);
    if (mode !== 'retoma' && seconds + duration > budgetMin * 60) {
      if (seconds + cost(ex, 1) > budgetMin * 60) return false;
      selected.set(i, { ...ex, s: 1 });
      seconds += cost(ex, 1);
    } else {
      selected.set(i, { ...ex, s: sets });
      seconds += duration;
    }
    return true;
  }
  for (const { ex, i } of eligible) {
    const pattern = ex.pat || `exercise:${i}`;
    if (mode !== 'retoma' && (patterns.has(pattern) || /min|s\b/i.test(String(ex.r)))) continue;
    if (add(ex, i)) patterns.add(pattern);
  }
  if (mode !== 'retoma') for (const { ex, i } of eligible) if (!selected.has(i)) add(ex, i);
  if (mode !== 'retoma') {
    for (const [i, ex] of selected) {
      const added = cost(ex, 2) - cost(ex, 1);
      if (Number(original[i].s) >= 2 && seconds + added <= budgetMin * 60) {
        selected.set(i, { ...ex, s: 2 });
        seconds += added;
      }
    }
  }
  const ex = [...selected.entries()].sort(([a], [b]) => a - b).map(([, e]) => e);
  return { ex, estMin: seconds / 60, plannedEx: original.length,
    plannedSets: original.reduce((sum, e) => sum + (Number(e.s) || 1), 0),
    skipped: original.filter((_, i) => !selected.has(i)).map(e => e.name),
    why: ex.length ? 'Só exercícios do teu plano, com volume reduzido.' : 'Não cabe um exercício disponível neste orçamento.' };
}

function startQuick(day, mode = 'quick', now = new Date()) {
  const n = clock(now), problem = pendingError(day);
  if (liveDay()) return error('Termina a sessão em curso antes de começar.');
  if (customAlive(n)) return error('Já tens um treino personalizado por terminar.');
  if (problem) return error(problem);
  if (!modes.includes(mode)) return error('Modo inválido.');
  const plan = quickPlan(day, { mode, now: n });
  if (!plan.ex.length) return error(plan.why);
  if (!safe(getDay(day).id)) return error('O dia do plano não tem uma identidade válida.');
  return commit(() => {
    const drop = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith('Personalizado:')));
    ST.sets = drop(ST.sets); ST.done = drop(ST.done);   /* marcas de um personalizado antigo não passam para o rápido */
    ST.custom = { date: civil(n), muscles: [], label: `${mode === 'retoma' ? 'Retoma' : 'Treino rápido'} · ${getDay(day).label}`,
      ex: plan.ex.map(e => ({ ...e, id: uid() })), stage: 'plan',
      quick: { from: day, mode, plannedEx: plan.plannedEx, plannedSets: plan.plannedSets, estMin: plan.estMin,
        dayId: getDay(day).id, planId: ST.plan?.id || '', wk: weekKey(n), date: civil(n) } };
    record('quick', n, { day });
  });
}

/* Não grava: o chamador inclui estas duas marcas na sua transação de conclusão. */
function finishQuick(custom, now = new Date()) {
  const q = custom?.quick, n = clock(now);
  if (!validDate(custom?.date) || !q || !modes.includes(q.mode) || q.date !== custom.date || q.wk !== weekKey(n) || q.dayId !== getDay(q.from)?.id ||
      q.planId !== (ST.plan?.id || '') || !['todo', 'partial'].includes(dayStatus(q.from))) return null;
  ST.sched = { ...(ST.sched || {}), done: { ...(ST.sched?.done || {}), [q.from]: custom.date },
    quick: { ...(ST.sched?.quick || {}), [q.from]: custom.date } };
  return q.from;
}

export { adaptState, validateAdaptState, lastActivityDate, moveCandidates, moveDay, undoMove,
  suggestion, dismiss, quickPlan, startQuick, finishQuick };
