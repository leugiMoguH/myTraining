import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
process.env.TZ = 'Europe/Lisbon';
const store = new Map();
let quota = false;
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), addEventListener() {}, dispatchEvent() {}, body: {}, hidden: false, visibilityState: 'hidden' };
globalThis.localStorage = { getItem: k => store.get(k) || null, setItem(k, v) { if (quota) throw Error('quota'); store.set(k, String(v)); }, removeItem: k => store.delete(k) };
Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true });
globalThis.addEventListener = () => {};
await import('../js/routine.js');
const S = await import('../js/state.js');
const Q = await import('../js/schedule.js');
const A = await import('../js/adapt.js');
const C = await import('../js/classes.js');
const P = await import('../js/progression.js');
const Plan = await import('../js/plan.js');
const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const now = '2026-10-21';
const st = () => S.ST;
const copy = () => JSON.stringify(st());
function reset() {
  S.setST({ day: 'Segunda', sets: {}, done: {}, log: {}, workouts: [], sessions: [], classes: [], classLog: {}, plan: { id: 'plan' },
    routine: Object.fromEntries(days.map((d, i) => [d, { id: `d${i}`, label: d, rest: ![0, 4].includes(i), ex: [0, 1, 2].map(j => ({ id: `e${i}_${j}`, name: `ex${j}`, s: 3, r: '8-12', pat: j < 2 ? 'push' : 'pull' })) }])),
    sched: { week: Q.weekKey(new Date(now + 'T12:00:00')), done: {}, replaced: {}, skip: {}, swaps: {} } });
}
reset();
assert.equal(Q.currentDay(new Date(now)), 'Segunda');
assert.equal(Q.agenda(new Date(now)).late, true);
const protectedData = () => JSON.stringify([st().routine, st().sets, st().done, st().log, st().workouts]);
const original = protectedData();
const sug = A.suggestion(now);
assert.equal(sug.kind, 'missed');
assert.equal(sug.accept.to, 'Quarta');
assert(sug.why.includes('Sexta tem treino'));
const moved = A.moveDay('Segunda', 'Quarta', 'missed', now);
assert(moved.ok);
assert.equal(A.moveDay('Segunda', 'Quarta', 'missed', now).id, moved.id);
assert.equal(Object.keys(st().adapt.moves).length, 1);
assert.equal(Q.moveOf('Segunda', new Date(now)).to, 'Quarta');
assert.equal(Q.effectiveTrainingOn('Segunda', new Date(now)), null);
assert.equal(Q.effectiveTrainingOn('Quarta', new Date(now)), 'Segunda');
assert(A.validateAdaptState(st().adapt).ok);
assert(A.undoMove(moved.id).ok);
assert.equal(protectedData(), original);
assert(A.dismiss(sug.key, now).ok);
assert.equal(A.suggestion(now), null);
assert.equal(A.suggestion('2026-10-28').kind, 'missed');
console.log('OK 1–4: fila, sugestão, recusas, idempotência e dados preservados.');

reset();
for (const state of ['ACTIVE', 'PAUSED']) {
  st().session = { id: 'live', day: 'Segunda', state, date: now, startedAt: 1, pausedMs: 0 };
  assert.equal(A.moveDay('Segunda', 'Quarta', 'manual', now).ok, false);
  assert.equal(A.startQuick('Segunda', 'quick', now).ok, false);
  assert.equal(A.suggestion(now), null);
}
delete st().session;
st().sets['Segunda:0'] = [0];
assert.equal(A.suggestion(now), null);
assert.equal(A.startQuick('Segunda', 'quick', now).ok, false);
assert(!A.quickPlan('Segunda').ex.some(e => e.name === 'ex0'));
st().sets = {};
const before = copy(); quota = true;
assert.equal(A.moveDay('Segunda', 'Quarta', 'manual', now).ok, false);
assert.equal(copy(), before);
assert.equal(A.startQuick('Segunda', 'quick', now).ok, false);
assert.equal(copy(), before); quota = false;
const cls = { name: 'Spinning', kind: 'spinning', day: 'Quarta', weekly: true, time: '10:00', min: 45, intensity: 3 };
const id = C.addClass(cls, now).cls.id;
assert.equal(A.moveCandidates('Segunda', now).find(c => c.day === 'Quarta').ok, false);
assert(C.markClass(id, now, 'cancelled', { now }).ok);
assert.equal(A.moveCandidates('Segunda', now).find(c => c.day === 'Quarta').ok, true);
assert(C.reopenClass(id, now, now).ok);
assert(C.updateClass(id, { intensity: 1, name: 'Leve' }, now).ok);
// A ocorrência já registada conserva o snapshot intenso.
assert.equal(A.moveCandidates('Segunda', now).find(c => c.day === 'Quarta').ok, false);
st().classLog = {};
assert(A.moveCandidates('Segunda', now).find(c => c.day === 'Quarta').note);
assert(C.setReplaceIntent(id, now, 'Segunda', now).ok);
assert.equal(A.moveDay('Segunda', 'Quarta', 'class', now).ok, false);
console.log('OK guardas ACTIVE/PAUSED, marcas, quota/reversão, aulas intensas/leves/canceladas/ligadas.');

reset();
assert(A.moveDay('Segunda', 'Quarta', 'manual', now).ok);
st().plan = { id: 'other' };
assert.equal(Q.moveOf('Segunda', new Date(now)), null);
st().plan = { id: 'plan' };
assert(Plan.swapDays('Segunda', 'Quarta').ok);
assert.equal(Q.moveOf('Segunda', new Date(now)), null);
reset();
assert(A.moveDay('Segunda', 'Quarta', 'manual', now).ok);
// Personalizado normal continua a substituir pela posição efetiva.
assert.equal(Q.plannedIdx('Segunda', new Date(now)), 2);
assert.equal(Q.moveOf('Segunda', new Date('2026-10-26T12:00:00')), null);
console.log('OK identidade do plano, swapDays e expiração semanal.');

reset();
for (const budgetMin of [1, 3, 7, 18]) {
  const p = A.quickPlan('Segunda', { budgetMin, rest: 60 });
  assert(p.estMin <= budgetMin);
  assert(p.ex.every(e => e.s >= 1 && e.s <= 2 && st().routine.Segunda.ex.some(x => x.name === e.name)));
}
assert.equal(A.quickPlan('Segunda', { mode: 'retoma', budgetMin: 0 }).ex.length, 3);
assert(A.startQuick('Segunda', 'quick', now).ok);
assert.equal(A.startQuick('Segunda', 'quick', now).ok, false);
const quick = structuredClone(st().custom);
assert.equal(A.finishQuick(quick, now), 'Segunda');
assert.equal(A.finishQuick(quick, now), null);
assert.equal(C.weekActivity(now, now).reduced, 1);
assert.equal(C.weekActivity(now, now).trainings, 0);
Q.reopenDay('Segunda');
assert.equal(st().sched.quick.Segunda, undefined);
assert.equal(Q.dayStatus('Segunda'), 'todo');
assert.equal(A.finishQuick(quick, '2026-10-26'), null);
st().plan.id = 'new';
assert.equal(A.finishQuick(quick, now), null);
console.log('OK 5: orçamento, reduzido, reabrir, duplo toque e domingo→segunda.');

reset();
st().log.ex0 = [{ date: '2026-10-01', w: 60, r: 12 }];
assert.equal(A.suggestion(now).kind, 'back');
assert(A.dismiss('back:2026-10-01', now).ok);
assert.equal(A.suggestion(now), null);
assert.equal(P.evaluate('ex0', { r: '8-12' }, {}, new Date(now)).kind, 'return');
assert.equal(P.explain('ex0', { r: '8-12' }, {}, new Date(now)).basis, 'último registo: 60 kg × 12 reps (01/10)');
assert.equal(P.explain('empty', { r: '8-12' }).conservative, true);
st().log.ex0 = [{ date: now, w: 60, r: 12, q: 1 }];
assert.equal(P.evaluate('ex0', { r: '8-12' }, {}, new Date(now)).kind, 'hold');
assert.equal(P.countStalls([{ w: 60, r: 1, q: 1 }], P.configOf('ex0', { r: '8-12' })), 0);
S.addSetLog('qload', 20, 10, 'q', 'Personalizado:0', 'Personalizado');
assert.equal(st().log.qload[0].q, 1);
assert.equal(st().log.qload[0].c, undefined);
const kept = JSON.stringify(st().log.qload);
S.addSetLog('normal', 30, 8, false, 'Segunda:0', 'Segunda');
assert.equal(JSON.stringify(st().log.qload), kept);
console.log('OK 6–7: regresso, explain real, q sem subida/estagnação e cargas separadas.');

reset();
for (const ref of ['2026-03-31', '2026-10-27', '2027-01-03']) {
  const monday = C.dateOfDay('Segunda', ref);
  assert.equal(Q.weekKey(new Date(monday + 'T12:00:00')), Q.weekKey(new Date(ref + 'T12:00:00')));
}
assert.equal(Q.weekKey(new Date('2027-01-03T12:00:00')), '2026-W53');
assert.equal(A.validateAdaptState({ moves: { 'bad\"': {} }, dismissed: {}, hist: [] }).ok, false);
const source = readFileSync(new URL('../js/backup.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('async function importBackup('), source.indexOf('/* ── EXPORTAÇÃO CSV'));
let confirmations = 0;
const deps={...(await import('../js/foods.js')), ensureMotiv:(await import('../js/motiv.js')).ensureMotiv, validateMotivState:(await import('../js/motiv.js')).validateMotivState, get ST() { return S.ST; }, validateAdaptState: A.validateAdaptState, validateClassState: C.validateClassState, setST: S.setST, REST_SEC: 60,
  document: { getElementById: () => ({ classList: { contains: () => false } }) }, confirmDialog: async () => { confirmations++; return true; },
  snapshot: () => ({ ok: true }), setRest() {}, migrate: () => ({ saved: true }), save: S.save, clearDrafts() {}, timerDismiss() {}, closeSheet() {}, render() {}, show() {}, DEFAULT_DAYS: st().routine, DAYS: st().routine };
const load = Function('deps', `with(deps){let importOperation=0;${body};return importBackup;}`)(deps);
async function importing(state) { const file = { text: async () => JSON.stringify({ state }) }; await load({ target: { files: [file] } }); }
for (const patch of [{ adapt: { moves: { hostile: {} }, dismissed: {}, hist: [] } }, { sched: { quick: { Segunda: '2026-02-30' } } }, { custom: { quick: {} } }, { session: { quick: 'bad' } }]) {
  const prev = copy(), count = confirmations;
  await importing({ ...st(), ...patch });
  assert.equal(copy(), prev); assert.equal(confirmations, count);
}
st().session = { state: 'ACTIVE', day: 'Segunda', id: 'live' };
const exported = structuredClone(st());
await importing(exported); assert.deepEqual(st().session, exported.session);
await importing({ day: 'Segunda', sets: {}, done: {} }); assert.equal(st().adapt, undefined);
console.log('OK 8–10: import real antigo/inválido/sessão viva, datas civis Lisboa e ano ISO.');

reset();
// O orçamento dá prioridade a dois exercícios antes de acrescentar séries.
assert.equal(A.quickPlan('Segunda', { budgetMin: 6, rest: 60 }).ex.length, 2);
st().routine.Segunda.ex = [{ name: 'Tempo', s: 1, r: '20 min' }];
assert.equal(A.quickPlan('Segunda', { budgetMin: 18 }).ex.length, 0);
assert.equal(A.quickPlan('Segunda', { budgetMin: 23 }).ex.length, 1);
reset();
for (const d of ['Terça', 'Quarta', 'Quinta']) st().routine[d] = { ...st().routine[d], rest: false };
assert(A.moveCandidates('Segunda', now).find(c => c.day === 'Sábado').reasons.some(r => r.includes('dias seguidos')));
reset();
const lastSunday = '2026-10-25', monday = '2026-10-26';
assert(A.startQuick('Segunda', 'quick', lastSunday).ok);
const sundayCustom = structuredClone(st().custom);
st().session = { id: 'cross', day: 'Personalizado', label: 'Rápido', state: 'ACTIVE', date: lastSunday,
  startedAt: new Date(lastSunday + 'T23:50:00').getTime(), pausedMs: 0, seenAt: 1, confirmedMs: 0 };
st().sets['Personalizado:0'] = [0];
S.addSetLog('crossLoad', 25, 8, 'q', 'Personalizado:0', 'Personalizado');
Q.ensureWeek(new Date(monday + 'T12:00:00'));
assert.equal(st().sets['Personalizado:0'].length, 1);
const sessionModule = await import('../js/session.js');
// Executa a conclusão real do personalizado com o relógio da agenda injetado.
const customSource = readFileSync(new URL('../js/custom.js', import.meta.url), 'utf8');
const finishBody = customSource.slice(customSource.indexOf('function finishQuickWorkout('), customSource.indexOf('const nameOf'));
const finishDeps = { uid:(await import('../js/ids.js')).uid, get ST() { return S.ST; }, setST: S.setST, save: S.save, CUSTOM_DAY: 'Personalizado',
  finishQuick: c => A.finishQuick(c, monday), getSets: S.getSets,
  clearCustomProgress() { S.ST.sets = {}; S.ST.done = {}; }, endSessionOf: sessionModule.endSessionOf, liveDay: sessionModule.liveDay, render() {} };
const finish = Function('deps', `with(deps){${finishBody};return finishQuickWorkout;}`)(finishDeps);
const loadsBefore = JSON.stringify(st().log);
assert(finish(sundayCustom, 1));
assert.equal(st().sessions[0].quick.closed, null);
assert.equal(st().sessions[0].date, lastSunday);
assert.equal(st().workouts[0].state, 'COMPLETED');
assert.equal(st().workouts[0].date, lastSunday);
assert.equal(st().sched.done.Segunda, undefined);
assert.equal(JSON.stringify(st().log), loadsBefore);
assert.equal(finish(st().custom, 1), false);   /* toque repetido */
assert.equal(st().sessions.length, 1);
assert(finish({ ...sundayCustom, stage: 'plan' }, 1), 'segundo rápido manual não herda o id da sessão terminada');
assert.equal(st().sessions.length, 2);
// Desmarcar uma carga retira apenas a série correspondente.
reset();
S.addSetLog('preserved', 30, 8, 'q', 'Personalizado:0', 'Personalizado');
S.addSetLog('preserved', 35, 6, 'q', 'Personalizado:1', 'Personalizado');
S.removeSetLog('preserved', 'Personalizado:1', 'Personalizado');
assert.equal(st().log.preserved[0].w, 30);
assert.equal(st().log.preserved[0].q, 1);
console.log('OK extras: tempo real, limite de dias seguidos, conclusão real domingo→segunda com histórico/cargas preservados e desmarcar.');

reset();
const noSlot = A.suggestion('2026-10-25');
// Domingo ainda é um descanso livre neste plano; ocupá-lo torna o limite observável.
st().routine.Domingo = { ...st().routine.Domingo, rest: false };
const limit = A.suggestion('2026-10-25');
assert.equal(limit.limit, true);
assert.equal(limit.accept, null);
assert.equal(limit.alt.type, 'quick');
for (const day of ['Segunda', 'Sexta', 'Domingo']) st().sched.skip[day] = now;
assert.equal(A.suggestion(now), null);
reset();
// Um personalizado normal usa o destino do move, sem consumir um dia futuro.
assert(A.moveDay('Segunda', 'Quarta', 'manual', now).ok);
const RealDate = globalThis.Date;
class Wednesday extends RealDate {
  constructor(...args) { super(...(args.length ? args : [now + 'T12:00:00'])); }
  static now() { return new RealDate(now + 'T12:00:00').getTime(); }
}
try {
  globalThis.Date = Wednesday;
  assert.equal(Q.replaceCurrent(), 'Segunda');
  assert.equal(st().sched.replaced.Segunda, now);
  assert.equal(st().sched.done.Segunda, undefined);
} finally { globalThis.Date = RealDate; }
reset();
const good = A.moveDay('Segunda', 'Quarta', 'manual', now);
const valid = structuredClone(st().adapt);
for (const patch of [{ dayId: 'bad\"' }, { planId: '../bad' }, { wk: '2026-W99' }, { date: '2026-02-30' }, { to: 'Quinta' }]) {
  assert.equal(A.validateAdaptState({ ...valid, moves: { [good.id]: { ...valid.moves[good.id], ...patch } } }).ok, false);
}
st().log.ex0 = [{ date: now, w: 60, r: 5 }, { date: now, w: 60, r: 5 }, { date: now, w: 60, r: 5 }, { date: now, w: 40, r: 12, q: 1 }];
assert.equal(P.evaluate('ex0', { r: '8-12' }, {}, new Date(now)).kind, 'hold');
/* marcas de um personalizado da véspera não passam para o treino rápido */
reset();
st().custom = { date: '2026-10-20', muscles: [], label: 'Velho', ex: [{ name: 'Velho', s: 3, r: '8' }], stage: 'active' };
st().sets['Personalizado:0'] = [{ w: 1, r: 1 }]; st().done['Personalizado:0'] = 1;
assert.equal(A.startQuick('Segunda', 'quick', new Date(now + 'T12:00:00')).ok, true);
assert.deepEqual(Object.keys(st().sets).filter(k => k.startsWith('Personalizado:')).concat(Object.keys(st().done).filter(k => k.startsWith('Personalizado:'))), []);
console.log('OK limites/skip, personalizado normal após move, import com identidade/data/destino hostis e q após estagnação.');
// Correction A: only the consecutive block containing the proposal counts, across weeks.
reset();
st().routine = Object.fromEntries(days.map((d,i)=>[d,{id:`d${i}`,label:i===4?'Treino':'Descanso',rest:i!==4,ex:i===4?[{name:'X',s:3}]:[]}]));
st().workouts = ['2026-10-23','2026-10-24','2026-10-25'].map((date,i)=>({id:`past${i}`,date,state:'COMPLETED'}));
assert.equal(A.moveCandidates('Sexta','2026-10-26').find(c=>c.day==='Segunda').ok,false);
reset();
st().routine = Object.fromEntries(days.map((d,i)=>[d,{id:`d${i}`,label:i===0?'Treino':'Descanso',rest:i!==0,ex:i===0?[{name:'X',s:3}]:[]}]));
st().workouts = ['2026-10-22','2026-10-23','2026-10-24'].map((date,i)=>({id:`past${i}`,date,state:'COMPLETED'}));
assert.equal(A.moveCandidates('Segunda','2026-10-25').find(c=>c.day==='Domingo').ok,false);
reset();
st().routine.Segunda.rest=true;st().routine.Segunda.label='Descanso';
for(const d of ['Quinta','Sexta','Sábado','Domingo']){st().routine[d].rest=false;st().routine[d].label='Treino';}
assert.equal(A.moveCandidates('Domingo','2026-10-19').find(c=>c.day==='Segunda').ok,true);
// Future Monday extends a Thursday-Friday-Saturday proposal across Sunday.
reset();
for(const d of days){st().routine[d].rest=!['Segunda','Sexta','Sábado'].includes(d);st().routine[d].label=st().routine[d].rest?'Descanso':'Treino';}
assert.equal(A.moveCandidates('Quarta','2026-10-23').find(c=>c.day==='Domingo').ok,false);
console.log('OK A: blocos reais na semana anterior, sequência futura e proposta longe de bloco longo.');
// The adaptation blocker resolves the identity after a permanent swap too.
reset();const linkedClass=C.addClass({kind:'yoga',name:'Yoga',day:'Quarta',time:'10:00',min:45,intensity:1,weekly:true},now).cls;
assert(C.setReplaceIntent(linkedClass.id,now,'Segunda',now).ok);
assert(Plan.swapDays('Segunda','Quarta').ok);
assert.equal(A.moveDay('Quarta','Quinta','manual',now).ok,false);
st().routine.Quarta.id='replacement';
assert.equal(C.intentDay(Object.values(st().classLog)[0]),null);
assert.equal(A.moveDay('Quarta','Quinta','manual',now).ok,true);
// A done intense class is real past activity; a merely planned past class is not.
reset();for(const d of days){st().routine[d].rest=d!=='Sexta';st().routine[d].label=d==='Sexta'?'Treino':'Descanso';}
for(const [day,date] of [['Sexta','2026-10-23'],['Sábado','2026-10-24'],['Domingo','2026-10-25']]){
 const cls=C.addClass({kind:'hiit',name:'HIIT',day,time:'10:00',min:45,intensity:3,weekly:true},date).cls;
 assert(C.markClass(cls.id,date,'done',{now:date}).ok);
}
assert.equal(A.moveCandidates('Sexta','2026-10-26').find(c=>c.day==='Segunda').ok,false);
for(const o of Object.values(st().classLog))o.status='planned';
assert.equal(A.moveCandidates('Sexta','2026-10-26').find(c=>c.day==='Segunda').ok,true);
console.log('OK identidade nos bloqueios adapt.moveDay e aulas intensas reais no passado.');
