/* myTraining — proteção dos dados antes de mexer na estrutura.
   · snapshot(): cópia do estado inteiro, VERIFICADA (relida e comparada) antes de se confiar nela.
   · migrate(): repetível. Acrescenta ids em falta e decide se o acolhimento se aplica.
     Só corre depois de existir uma cópia verificada do estado original (`PRE_KEY`, escrita uma vez
     e nunca substituída). Se a cópia falhar, NADA é alterado e o utilizador é avisado. */
import { DEFAULT_DAYS } from './data.js';
import { uid } from './ids.js';
import { ensureWeek } from './schedule.js';
import { ST, save, setST } from './state.js';

const SNAP_KEY = 'treino_v2_snap';          /* última cópia antes de uma alteração grande (plano novo) */
const PRE_KEY = 'treino_v2_premigration';   /* estado original, antes da 1.ª migração; nunca substituído */
const SCHEMA = 2;

const countsOf = s => ({
  log: Object.keys((s && s.log) || {}).length,
  workouts: ((s && s.workouts) || []).length,
  sessions: ((s && s.sessions) || []).length,
  days: Object.keys((s && s.routine) || {}).length,
  measures: ((s && s.measures) || []).length,
});

function notify(msg) {
  try { document.dispatchEvent(new CustomEvent('app-notice', { detail: { msg, kind: 'error' } })); } catch (_) { /* sem DOM (testes) */ }
}

/* Escreve a cópia e lê-a de volta. ok só se o que ficou guardado é idêntico ao que se quis guardar. */
function writeVerified(key, reason) {
  try {
    const payload = JSON.stringify({ v: 1, at: new Date().toISOString(), reason, counts: countsOf(ST), state: ST });
    localStorage.setItem(key, payload);
    const back = localStorage.getItem(key);
    if (back !== payload) return { ok: false, error: 'A cópia de segurança não ficou igual ao original.' };
    const parsed = JSON.parse(back);
    const a = countsOf(ST), b = countsOf(parsed.state);
    if (JSON.stringify(a) !== JSON.stringify(b)) return { ok: false, error: 'A cópia de segurança está incompleta.' };
    return { ok: true, counts: a, at: parsed.at };
  } catch (e) {
    return { ok: false, error: 'Sem espaço para a cópia de segurança. Liberta espaço ou exporta os dados (Mais).' };
  }
}

function snapshot(reason) { return writeVerified(SNAP_KEY, reason); }

function readSlot(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
function snapshotInfo() {
  const s = readSlot(SNAP_KEY);
  return s && s.state ? { at: s.at, reason: s.reason, counts: s.counts } : null;
}

/* Repõe uma cópia. Guarda antes o estado atual no mesmo lugar, para o "repor" também se poder desfazer. */
function restoreSnapshot(which = 'snap') {
  const slot = readSlot(which === 'pre' ? PRE_KEY : SNAP_KEY);
  if (!slot || !slot.state || typeof slot.state !== 'object' || !slot.state.routine) return { ok: false, error: 'Não há cópia para repor.' };
  const current = JSON.stringify({ v: 1, at: new Date().toISOString(), reason: 'antes de repor', counts: countsOf(ST), state: ST });
  try { localStorage.setItem(SNAP_KEY, current); } catch (_) { return { ok: false, error: 'Sem espaço para guardar o estado atual antes de repor.' }; }
  const prev = ST;
  setST(slot.state);
  ensureWeek();   /* uma cópia de outra semana não pode trazer marcas e treinos "feitos" dessa semana */
  if (!save({rolledBack:true})) { setST(prev); return { ok: false, error: 'Não foi possível guardar o estado reposto. Nada foi alterado.' }; }
  return { ok: true, counts: countsOf(slot.state) };
}

function missingIds() {
  return Object.values(ST.routine || {}).some(d => !d.id || (d.ex || []).some(e => !e.id));
}

function ensureIds() {
  const routine = {};
  for (const [day, d] of Object.entries(ST.routine || {})) {
    routine[day] = { ...d, id: d.id || uid(), ex: (d.ex || []).map(e => (e.id ? e : { ...e, id: uid() })) };
  }
  ST.routine = routine;
}

/* "Existente" = tem histórico, ou já mexeu na rotina original. Só então o acolhimento não é imposto. */
function isExistingUser() {
  if (Object.keys(ST.log || {}).length || (ST.workouts || []).length || (ST.sessions || []).length) return true;
  const sig = r => JSON.stringify(Object.entries(r || {}).map(([k, d]) => [k, d.label, (d.ex || []).map(e => e.name)]));
  return sig(ST.routine) !== sig(DEFAULT_DAYS);
}

/* Garante ST.onb (estados importados de backups antigos não o trazem): histórico ou rotina própria → dispensado. */
function ensureOnb() {
  if (!ST.onb || typeof ST.onb !== 'object') ST.onb = isExistingUser() ? { done: true, legacy: true, step: 0, draft: {} } : { done: false, step: 0, draft: {} };
  return ST.onb;
}

function migrate() {
  const needs = !ST.meta || ST.meta.schema < SCHEMA || missingIds() || !ST.onb;
  if (!needs) return { changed: false };
  if (!readSlot(PRE_KEY)) {
    const r = writeVerified(PRE_KEY, 'antes da migração v2');
    if (!r.ok) { notify(`Não foi possível proteger os teus dados: ${r.error} A app continua como estava.`); return { changed: false, error: r.error }; }
  }
  ensureOnb();
  ensureIds();
  ST.meta = { ...(ST.meta || {}), schema: SCHEMA, deviceId: (ST.meta && ST.meta.deviceId) || uid(), migratedAt: new Date().toISOString() };
  return { changed: true, saved: save() };
}

export { SCHEMA, PRE_KEY, SNAP_KEY, countsOf, snapshot, snapshotInfo, restoreSnapshot, isExistingUser, ensureOnb, ensureIds, missingIds, migrate };
