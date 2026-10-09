/* myTraining — correções ao histórico de cargas (ST.log). Única porta de escrita para editar o passado.
   Nunca inicia, retoma nem toca na sessão atual; nunca apaga em silêncio (quem chama confirma antes de eliminar).
   Cada função devolve { ok:true } ou { ok:false, msg } — a interface mostra a mensagem, nada rebenta.

   Regras de integridade:
   - editar peso/reps conserva `k`, `sid` e `ts` da série (a ligação ao treino e à marca não se perde);
   - uma entrada antiga sem `sets` (só w/r) continua agregada ao ser corrigida: não se inventam séries;
   - série do treino EM CURSO (sid vivo) não se elimina nem se muda de data aqui: desfaz-se no treino;
   - eliminar uma série da semana atual que tem marca em ST.sets desmarca-a também (senão ficava a marca sem carga);
   - a data não muda em registos do treino personalizado (o resumo em ST.sessions tem a data) nem em séries ligadas
     a marcas (k) da semana atual, porque desmarcar procura a carga por semana;
   - não há datas futuras; mudar para um dia que já tem registo junta as séries sem duplicar;
   - o resumo `w/r` da entrada é sempre recalculado a partir das séries. */
import { DAYS } from './routine.js';
import { currentSession, isLive } from './session.js';
import { ST, bestSet, getLog, key, nowISO, putEntry, save, todayStr, weekStartStr } from './state.js';
import { validDate, validSet } from './records.js';

const fail = msg => ({ ok: false, msg });
const OK = { ok: true };
const entryOf = (name, date) => getLog(name).find(e => e.date === date);
const baseSets = e => e.sets && e.sets.length ? e.sets : [{ w: e.w, r: e.r, ts: e.ts }];
const liveId = () => (isLive() ? currentSession().id : null);
const isLiveSet = s => !!s.sid && s.sid === liveId();
const isoNoon = date => (date === todayStr() ? nowISO() : new Date(`${date}T12:00:00`).toISOString());

function checkDate(date) {
  if (!validDate(date) || isNaN(new Date(`${date}T12:00:00`).getTime())) return 'Data inválida.';
  if (date > todayStr()) return 'A data não pode ser no futuro.';
  return '';
}
function checkSet(w, r) {
  w = parseFloat(w); r = parseInt(r, 10);
  return validSet({ w, r }) ? '' : 'Peso e repetições têm de ser números maiores que zero.';
}

/* a série tinha marca no treino desta semana ("dia:série" em ST.sets): tira-a, como o botão desfazer */
function unmarkSlot(name, k, date) {
  if (!k || date < weekStartStr()) return;
  const at = k.lastIndexOf(':'), day = k.slice(0, at), si = +k.slice(at + 1), d = DAYS[day];
  if (!d) return;
  const i = d.ex.findIndex(e => e.name === name);
  if (i < 0) return;
  const kk = key(day, i), arr = (ST.sets[kk] || []).filter(x => x !== si);
  ST.sets = { ...ST.sets, [kk]: arr };
  const total = typeof d.ex[i].s === 'number' ? d.ex[i].s : 0;
  ST.done = { ...ST.done, [kk]: total > 0 && arr.length >= total };
}

function put(name, old, sets) {
  const b = bestSet(sets);
  putEntry(name, { ...old, w: b.w, r: b.r, sets });
  save();
}
function drop(name, date) { ST.log = { ...ST.log, [name]: getLog(name).filter(e => e.date !== date) }; }

function editSet(name, date, idx, w, r) {
  const e = entryOf(name, date), m = checkSet(w, r);
  if (!e) return fail('Registo não encontrado.');
  if (m) return fail(m);
  w = parseFloat(w); r = parseInt(r, 10);
  if (!e.sets || !e.sets.length) { putEntry(name, { ...e, w, r }); save(); return OK; }   /* agregado: continua agregado */
  if (!e.sets[idx]) return fail('Série não encontrada.');
  put(name, e, e.sets.map((s, j) => j === idx ? { ...s, w, r } : s));
  return OK;
}

function addSet(name, date, w, r) {
  const m = checkDate(date) || checkSet(w, r);
  if (m) return fail(m);
  w = parseFloat(w); r = parseInt(r, 10);
  const e = entryOf(name, date), sets = [...(e ? baseSets(e) : []), { w, r, ts: isoNoon(date) }];
  put(name, e || { date, ts: isoNoon(date) }, sets);
  return OK;
}

function deleteSet(name, date, idx) {
  const e = entryOf(name, date);
  if (!e) return fail('Registo não encontrado.');
  if (!e.sets || e.sets.length <= 1) return deleteEntry(name, date);
  const s = e.sets[idx];
  if (!s) return fail('Série não encontrada.');
  if (isLiveSet(s)) return fail('Esta série é do treino em curso: desfaz-a no treino.');
  unmarkSlot(name, s.k, date);
  put(name, e, e.sets.filter((_, j) => j !== idx));
  return OK;
}

function deleteEntry(name, date) {
  const e = entryOf(name, date);
  if (!e) return fail('Registo não encontrado.');
  const sets = e.sets || [];
  if (sets.some(isLiveSet)) return fail('Este dia tem séries do treino em curso: desfaz-as no treino.');
  sets.forEach(s => unmarkSlot(name, s.k, date));
  drop(name, date);
  save();
  return OK;
}

function moveEntry(name, from, to) {
  const e = entryOf(name, from), m = checkDate(to);
  if (!e) return fail('Registo não encontrado.');
  if (m) return fail(m);
  if (from === to) return OK;
  const sets = baseSets(e);
  if (e.c) return fail('Treino personalizado: a data não se muda.');
  if (sets.some(isLiveSet)) return fail('Este dia tem séries do treino em curso.');
  if (sets.some(s => s.k) && (from >= weekStartStr() || to >= weekStartStr())) return fail('Séries marcadas nesta semana: a data só muda depois da semana acabar.');
  const t = entryOf(name, to);
  if (t && t.c) return fail('Esse dia é de um treino personalizado.');
  if (!t && !(e.sets && e.sets.length)) { drop(name, from); putEntry(name, { ...e, date: to }); save(); return OK; }   /* agregado sozinho: continua agregado */
  const have = t ? baseSets(t) : [];
  const same = (a, b) => a.ts === b.ts && a.w === b.w && a.r === b.r && a.k === b.k;
  const merged = [...have, ...sets.filter(s => !have.some(h => same(h, s)))];
  drop(name, from);
  put(name, t || { ...e, date: to }, merged);
  return OK;
}

export { editSet, addSet, deleteSet, deleteEntry, moveEntry, checkDate };
