/* Rotina do utilizador — substitui o plano fixo que estava em js/data.js.

   `DAYS` continua a existir com a mesma forma ({ dia: { label, ex:[…] } }), mas
   agora lê de `ST.routine`, que o utilizador edita. É um Proxy só para os
   módulos antigos (ui, workout, volume, state) não terem de mudar nada.

   Cuidado: ST.sets / ST.done são indexados por `dia:índice`. Remover ou trocar
   a ordem de um exercício sem reindexar mudava o progresso de sítio — todas as
   alterações passam por setDayExercises(), que trata disso. */
import { DEFAULT_DAYS } from './data.js';
import { ST, key, save } from './state.js';

/* Clone profundo simples: só há objetos, arrays, strings e números aqui. */
const clone = v => JSON.parse(JSON.stringify(v));

/* Semear na primeira utilização, mantendo os nomes dos exercícios iguais aos do
   plano antigo — é o nome que liga ao histórico de cargas em ST.log. */
if (!ST.routine || typeof ST.routine !== 'object' || !Object.keys(ST.routine).length) {
  ST.routine = clone(DEFAULT_DAYS);
  save();
}

function routine() { return ST.routine; }
function dayNames() { return Object.keys(routine()); }
function getDay(day) { return routine()[day] || null; }
function exercisesOf(day) { const d = getDay(day); return d ? d.ex : []; }
function isCustom(day, i) { return !!(exercisesOf(day)[i] || {}).catalogId; }

/* Proxy para os módulos que ainda importam `DAYS`. Reencaminha leituras e
   Object.keys() para ST.routine, para continuarem a ver a rotina atual. */
const DAYS = new Proxy({}, {
  get: (_, k) => routine()[k],
  has: (_, k) => k in routine(),
  ownKeys: () => Reflect.ownKeys(routine()),
  getOwnPropertyDescriptor: (_, k) => ({ value: routine()[k], enumerable: true, configurable: true }),
});

/* Escreve a nova lista de exercícios de um dia e move o progresso com ela.
   `indexMap[novoÍndice] = índiceAntigo`, ou -1 se for um exercício novo. */
function setDayExercises(day, exercises, indexMap) {
  const d = getDay(day);
  if (!d) return false;

  const sets = { ...ST.sets };
  const done = { ...ST.done };
  for (let i = 0; i < d.ex.length; i++) { delete sets[key(day, i)]; delete done[key(day, i)]; }
  indexMap.forEach((oldI, newI) => {
    if (oldI < 0) return;
    const from = key(day, oldI), to = key(day, newI);
    if (ST.sets[from] !== undefined) sets[to] = ST.sets[from];
    if (ST.done[from] !== undefined) done[to] = ST.done[from];
  });

  ST.routine = { ...routine(), [day]: { ...d, ex: exercises } };
  ST.sets = sets;
  ST.done = done;
  save();
  return true;
}

function addExercise(day, entry) {
  const ex = exercisesOf(day);
  if (!entry || !entry.name) return false;
  return setDayExercises(day, [...ex, entry], [...ex.map((_, i) => i), -1]);
}

function removeExercise(day, i) {
  const ex = exercisesOf(day);
  if (i < 0 || i >= ex.length) return false;
  const keep = ex.map((_, k) => k).filter(k => k !== i);
  return setDayExercises(day, keep.map(k => ex[k]), keep);
}

/* dir = -1 sobe, +1 desce */
function moveExercise(day, i, dir) {
  const ex = exercisesOf(day);
  const j = i + dir;
  if (i < 0 || i >= ex.length || j < 0 || j >= ex.length) return false;
  const order = ex.map((_, k) => k);
  [order[i], order[j]] = [order[j], order[i]];
  return setDayExercises(day, order.map(k => ex[k]), order);
}

/* Só campos editáveis: name fica de fora porque é a chave do histórico. */
function updateExercise(day, i, patch) {
  const ex = exercisesOf(day);
  if (i < 0 || i >= ex.length) return false;
  const allowed = ['s', 'r', 'tip', 'alt'];
  const clean = {};
  for (const k of allowed) if (patch[k] !== undefined) clean[k] = patch[k];
  const next = ex.map((e, k) => (k === i ? { ...e, ...clean } : e));
  return setDayExercises(day, next, ex.map((_, k) => k));
}

function setDayLabel(day, label) {
  const d = getDay(day);
  if (!d) return false;
  ST.routine = { ...routine(), [day]: { ...d, label: String(label || '').slice(0, 40) } };
  save();
  return true;
}

/* Volta ao plano original de js/data.js. Apaga o progresso de séries (os
   índices deixam de bater certo), mas o histórico de cargas em ST.log fica. */
function resetRoutine() {
  ST.routine = clone(DEFAULT_DAYS);
  ST.sets = {};
  ST.done = {};
  save();
}

export {
  DAYS, routine, dayNames, getDay, exercisesOf, isCustom,
  addExercise, removeExercise, moveExercise, updateExercise,
  setDayExercises, setDayLabel, resetRoutine,
};
