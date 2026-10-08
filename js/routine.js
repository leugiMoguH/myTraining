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

/* Treino personalizado de hoje: um "dia" à parte, guardado em ST.custom. Responde ao
   mesmo contrato de um dia da rotina ({ label, ex }) para os cartões, o treino
   guiado e as séries funcionarem sem mudanças — mas não está em ST.routine nem em
   dayNames(), por isso a agenda e o plano normal nunca o veem. */
const CUSTOM_DAY = 'Personalizado';
function customDay() {
  const c = ST.custom;
  return c && Array.isArray(c.ex) ? { label: c.label || 'Personalizado', ex: c.ex, custom: true } : undefined;
}

function routine() { return ST.routine; }
function dayNames() { return Object.keys(routine()); }
function getDay(day) { return (day === CUSTOM_DAY ? customDay() : routine()[day]) || null; }
function exercisesOf(day) { const d = getDay(day); return d ? d.ex : []; }
function isCustom(day, i) { return !!(exercisesOf(day)[i] || {}).catalogId; }

/* Primeira entrada com este nome, em qualquer dia. O histórico de cargas é por
   nome, por isso a progressão precisa de encontrar a gama de reps sem saber o dia. */
function findExercise(name) {
  for (const day of dayNames()) {
    const hit = exercisesOf(day).find(e => e.name === name);
    if (hit) return hit;
  }
  return ((customDay() || {}).ex || []).find(e => e.name === name) || null;
}

/* Proxy para os módulos que ainda importam `DAYS`. Reencaminha leituras e
   Object.keys() para ST.routine, para continuarem a ver a rotina atual. */
const DAYS = new Proxy({}, {
  get: (_, k) => (k === CUSTOM_DAY ? customDay() : routine()[k]),
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

  if (day === CUSTOM_DAY) ST.custom = { ...ST.custom, ex: exercises };
  else ST.routine = { ...routine(), [day]: { ...d, ex: exercises } };
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

/* Troca o exercício da posição i por outro. As séries marcadas não vêm com ele
   (é outro exercício, com outro histórico), por isso o índice entra como novo.
   Séries e reps do plano ficam: a prescrição é do utilizador, não do catálogo. */
function replaceExercise(day, i, entry) {
  const ex = exercisesOf(day);
  if (i < 0 || i >= ex.length || !entry || !entry.name) return false;
  const keep = { ...entry, s: ex[i].s, r: ex[i].r };
  return setDayExercises(day, ex.map((e, k) => (k === i ? keep : e)), ex.map((_, k) => (k === i ? -1 : k)));
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
  CUSTOM_DAY, DAYS, routine, dayNames, getDay, exercisesOf, isCustom, findExercise,
  addExercise, removeExercise, moveExercise, updateExercise, replaceExercise,
  setDayExercises, setDayLabel, resetRoutine,
};
