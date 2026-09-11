/* Agenda semanal — o plano deixa de ser "hoje é Terça, logo treino de Terça".

   O treino atual é o **primeiro dia da semana ainda por fazer**. Se falhaste a
   Segunda, ela fica pendente e é o que aparece na Terça: o plano desliza, não
   salta. Os dias marcados como descanso são ignorados pela fila.

   A semana é de Segunda a Domingo e faz reset sozinha quando muda de semana
   (Domingo à meia-noite): limpa as séries marcadas e repõe as trocas temporárias.
   O histórico de cargas (ST.log) nunca é tocado — é ele que guarda o progresso
   a sério.

   ST.sched = {
     week:  '2026-W37',              semana a que o progresso pertence
     done:  { 'Segunda': '2026-09-08' },   treinos dados por concluídos
     swaps: { 'Segunda:2': {…} },    exercício original de uma troca "só esta semana"
   } */
import { dayNames, getDay, exercisesOf, routine } from './routine.js';
import { ST, key, save, todayStr, getProgress } from './state.js';

/* getDay() em PT: o índice bate certo com Date#getDay() (0 = Domingo). */
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SHORT = { Segunda: 'Seg', Terça: 'Ter', Quarta: 'Qua', Quinta: 'Qui', Sexta: 'Sex', Sábado: 'Sáb', Domingo: 'Dom' };

const STATUS_ICON = { done: '✓', partial: '◐', todo: '·', rest: '😴' };

/* Semana ISO (começa à Segunda): '2026-W37'. Duas datas da mesma semana dão a
   mesma chave, e a chave muda sozinha na passagem de Domingo para Segunda. */
function weekKey(date) {
  const d = date ? new Date(date) : new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);   /* quinta-feira desta semana */
  const firstThu = new Date(t.getFullYear(), 0, 4);
  firstThu.setDate(firstThu.getDate() - ((firstThu.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((t - firstThu) / (7 * 86400000));
  return `${t.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function sched() {
  if (!ST.sched || typeof ST.sched !== 'object') ST.sched = { week: weekKey(), done: {}, swaps: {} };
  if (!ST.sched.done || typeof ST.sched.done !== 'object') ST.sched.done = {};
  if (!ST.sched.swaps || typeof ST.sched.swaps !== 'object') ST.sched.swaps = {};
  return ST.sched;
}

/* Nome do dia de hoje tal como está na rotina. Se a rotina não tiver esse dia
   (só pode acontecer com dados manipulados), cai no primeiro dia que existir. */
function todayName() {
  const n = WEEKDAYS[new Date().getDay()];
  return getDay(n) ? n : (dayNames()[0] || n);
}

function shortName(day) { return SHORT[day] || String(day).slice(0, 3); }

/* ── descanso ─────────────────────────────────────────────────────────────── */

/* A flag `rest` manda. Sem ela, deduz-se: um dia vazio ou com "Descanso" na
   etiqueta (é assim que o plano original marca o Domingo) não entra na fila.
   Deduzir em vez de semear evita que "repor plano original" perca a marcação. */
function isRest(day) {
  const d = getDay(day);
  if (!d) return false;
  if (d.rest !== undefined) return !!d.rest;
  return exercisesOf(day).length === 0 || /descanso/i.test(d.label || '');
}

function setRest(day, rest) {
  const d = getDay(day);
  if (!d) return false;
  ST.routine = { ...routine(), [day]: { ...d, rest: !!rest } };
  save();
  return true;
}

/* ── estado de cada dia ───────────────────────────────────────────────────── */

/* rest | done | partial | todo. Um treino conta como feito quando todas as
   séries estão marcadas, ou quando o utilizador carrega em "Concluir". */
function dayStatus(day) {
  if (isRest(day)) return 'rest';
  if (sched().done[day]) return 'done';
  const { total, done } = getProgress(day);
  if (total > 0 && done >= total) return 'done';
  return done > 0 ? 'partial' : 'todo';
}

function completeDay(day) {
  if (!getDay(day)) return false;
  sched().done = { ...sched().done, [day]: todayStr() };
  save();
  return true;
}

function reopenDay(day) {
  const done = { ...sched().done };
  delete done[day];
  sched().done = done;
  save();
  return true;
}

/* O treino a fazer agora: primeiro dia de treino da semana ainda não concluído. */
function currentDay() {
  return dayNames().find(d => {
    const s = dayStatus(d);
    return s !== 'rest' && s !== 'done';
  }) || null;
}

/* Tudo o que o ecrã "Hoje" precisa, calculado num sítio só. */
function agenda() {
  const hoje = todayName();
  const cur = currentDay();
  const days = dayNames().map(day => ({
    day,
    short: shortName(day),
    label: (getDay(day) || {}).label || '',
    status: dayStatus(day),
    icon: STATUS_ICON[dayStatus(day)],
    isToday: day === hoje,
    isCurrent: day === cur,
  }));
  const order = dayNames();
  return {
    days,
    today: hoje,
    current: cur,
    restToday: isRest(hoje),
    allDone: cur === null,
    /* o treino pendente é de um dia que já passou */
    late: !!cur && order.indexOf(cur) < order.indexOf(hoje),
    pending: days.filter(d => d.status !== 'rest' && d.status !== 'done').length,
  };
}

/* ── trocas "só esta semana" ──────────────────────────────────────────────── */

/* Guarda o exercício original antes de uma troca temporária. Guarda-se o
   primeiro: trocar duas vezes seguidas continua a repor o que lá estava. */
function rememberSwap(day, i, original) {
  const k = key(day, i);
  if (sched().swaps[k]) return;
  sched().swaps = { ...sched().swaps, [k]: original };
  save();
}

function swapOriginal(day, i) { return sched().swaps[key(day, i)] || null; }

/* Repõe todos os originais. Não mexe em ST.sets: quem chama (o reset semanal)
   limpa-os logo a seguir, e uma reposição manual quer manter o índice. */
function restoreSwaps() {
  const swaps = sched().swaps;
  const entries = Object.keys(swaps);
  if (!entries.length) return 0;
  let next = routine();
  for (const k of entries) {
    const sep = k.lastIndexOf(':');
    const day = k.slice(0, sep), i = +k.slice(sep + 1);
    const d = next[day];
    if (!d || !d.ex[i]) continue;
    next = { ...next, [day]: { ...d, ex: d.ex.map((e, j) => (j === i ? swaps[k] : e)) } };
  }
  ST.routine = next;
  sched().swaps = {};
  save();
  return entries.length;
}

/* ── reset semanal ────────────────────────────────────────────────────────── */

/* Chamado no arranque. Devolve true se limpou uma semana antiga.
   Na primeira execução só regista a semana atual — não apaga progresso que já
   existia antes desta funcionalidade. */
function ensureWeek() {
  const wk = weekKey();
  const first = !ST.sched;
  const s = sched();
  if (first || !s.week) { s.week = wk; save(); return false; }
  if (s.week === wk) return false;

  restoreSwaps();
  ST.sets = {};
  ST.done = {};
  ST.sched = { week: wk, done: {}, swaps: {} };
  save();
  return true;
}

export {
  WEEKDAYS, SHORT, STATUS_ICON,
  weekKey, todayName, shortName,
  isRest, setRest, dayStatus, currentDay, agenda,
  completeDay, reopenDay,
  rememberSwap, swapOriginal, restoreSwaps,
  ensureWeek,
};
