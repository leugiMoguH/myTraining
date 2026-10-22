/* Planeador, migração protegida, aplicar plano, reorganizar e recuperação — sem browser. npm run test:plan */
const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };
const clone = v => JSON.parse(JSON.stringify(v));

/* DOM mínimo + localStorage controlável (para simular quota cheia) */
const store = new Map();
let quotaFull = false;
let failKey = null;   /* falha só a gravação principal (a cópia cabe) */
const notices = [];
globalThis.window = globalThis;
globalThis.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}),
  addEventListener() {}, body: {}, hidden: false, visibilityState: 'hidden',
  dispatchEvent(e) { if (e && e.type === 'app-notice') notices.push(e.detail); return true; },
};
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (quotaFull || k === failKey) throw new Error('QuotaExceededError'); store.set(k, String(v)); },
  removeItem: k => store.delete(k),
};
Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true, writable: true });
globalThis.alert = () => {}; globalThis.confirm = () => true; globalThis.addEventListener = () => {};

/* utilizador existente: histórico + rotina própria, gravado ANTES de os módulos arrancarem */
const HIST = {
  'Leg press': [{ date: '2026-09-01', ts: '2026-09-01T10:00:00.000Z', w: 100, r: 10, sets: [{ w: 100, r: 10, ts: 'x', k: 'Segunda:0' }] }],
  'Supino reto': [{ date: '2026-09-02', ts: '2026-09-02T10:00:00.000Z', w: 60, r: 8 }],
};
const existing = { day: 'Segunda', sets: {}, done: {}, log: HIST, prog: { 'Leg press': { scheme: 'double', step: 5 } }, measures: [{ date: '2026-09-01', weight: 80 }], workouts: [{ id: 'w1', day: 'Segunda', date: '2026-09-01' }], sessions: [] };
store.set('treino_v2', JSON.stringify(existing));

const { DAYS } = await import('../js/routine.js');   /* 1.º: a ordem de import dos ciclos é a da app */
const { proposePlan, normalizePrefs, POOL, WEEK, MINS, DEFAULT_DAYS_BY_COUNT } = await import('../js/planner.js');
const S = await import('../js/state.js');
const { setST } = S;
Object.defineProperty(globalThis, 'ST', { get: () => S.ST });   /* binding vivo: setST troca o objeto */
const M = await import('../js/migrate.js');
const P = await import('../js/plan.js');
const { weekKey } = await import('../js/schedule.js');

/* ── 1. planeador: propriedades em todas as combinações ─────────────────── */
let combos = 0;
for (const n of [2, 3, 4, 5]) for (const mins of MINS) for (const place of ['gym', 'casa', 'ambos']) for (const pref of ['maq', 'livres', 'corpo'])
  for (const limits of [[], ['joelhos'], ['costas'], ['ombros'], ['joelhos', 'costas', 'ombros']]) for (const goal of ['forma', 'forca', 'gordura']) {
    combos++;
    const p = proposePlan({ goal, days: DEFAULT_DAYS_BY_COUNT[n], mins, exp: 'inicio', place, pref, limits });
    const tag = JSON.stringify({ n, mins, place, pref, limits, goal });
    check(p.week.length === 7 && p.week.every((d, i) => d.day === WEEK[i]), `semana incompleta ${tag}`);
    check(p.week.filter(d => !d.rest).length === n, `nº de treinos errado ${tag}`);
    for (const d of p.week.filter(x => !x.rest)) {
      const names = d.ex.map(e => e.name);
      check(d.ex.length >= 1, `treino vazio ${d.day} ${tag}`);
      check(new Set(names).size === names.length, `exercício repetido numa sessão ${d.day} ${tag}`);
      for (const e of d.ex) {
        const item = POOL.find(x => x.name === e.name);
        if (!item) continue;   /* Cardio final */
        check(!item.avoid.some(a => limits.includes(a)), `${e.name} desrespeita limitação ${tag}`);
        if (place === 'casa') check(item.eq !== 'maq', `máquina em casa: ${e.name} ${tag}`);
      }
    }
    check(JSON.stringify(p) === JSON.stringify(proposePlan({ goal, days: DEFAULT_DAYS_BY_COUNT[n], mins, exp: 'inicio', place, pref, limits })), `não determinista ${tag}`);
  }
check(combos > 1000, 'cobertura de combinações baixa');
const junk = normalizePrefs({ days: ['Foo', 'Segunda', 'Segunda'], mins: 99, goal: 'x', limits: ['dedo'], name: 'a'.repeat(99) });
check(junk.days.length >= 2 && junk.mins === 45 && junk.goal === 'forma' && junk.limits.length === 0 && junk.name.length === 30, 'normalizePrefs não repõe valores válidos');
const lim = proposePlan({ days: DEFAULT_DAYS_BY_COUNT[3], limits: ['joelhos'], place: 'gym', pref: 'maq', mins: 45 });
check(/joelhos/.test(lim.why), 'a explicação não menciona a limitação');

/* ── 2. migração protegida (utilizador existente) ───────────────────────── */
const before = clone(ST);
const r1 = M.migrate();
check(r1.changed && r1.saved, 'migração devia ter alterado e gravado');
check(ST.onb && ST.onb.done && ST.onb.legacy, 'utilizador com histórico devia ficar com o acolhimento dispensado');
const pre = JSON.parse(store.get(M.PRE_KEY));
check(JSON.stringify(pre.state.log) === JSON.stringify(before.log) && pre.counts.log === 2, 'cópia pré-migração não guarda o histórico original');
check(JSON.stringify(ST.log) === JSON.stringify(before.log), 'a migração tocou no histórico');
check(Object.values(ST.routine).every(d => d.id && d.ex.every(e => e.id)), 'faltam ids na rotina');
const ids1 = JSON.stringify(Object.values(ST.routine).map(d => [d.id, d.ex.map(e => e.id)]));
const r2 = M.migrate();
check(!r2.changed, 'a 2.ª migração devia ser um no-op');
check(ids1 === JSON.stringify(Object.values(ST.routine).map(d => [d.id, d.ex.map(e => e.id)])), 'a migração repetida mudou ids');
const preText = store.get(M.PRE_KEY), stBefore2 = JSON.stringify(ST);
M.migrate(); M.migrate();
check(preText === store.get(M.PRE_KEY), 'a cópia original foi substituída');
check(stBefore2 === JSON.stringify(ST), 'migrar de novo mudou o estado (ids/meta)');

/* migração recusada se a cópia não puder ser verificada */
const fresh = clone(before); delete fresh.meta; delete fresh.onb;
setST(fresh); store.delete(M.PRE_KEY); quotaFull = true; notices.length = 0;
const r3 = M.migrate();
quotaFull = false;
check(!r3.changed && r3.error && !fresh.meta && !fresh.onb, 'sem cópia verificada a migração devia recusar sem alterar nada');
check(notices.some(n => n.kind === 'error'), 'a falha da cópia devia avisar o utilizador');

/* ── 3. utilizador novo ─────────────────────────────────────────────────── */
const novo = { day: 'Segunda', sets: {}, done: {}, log: {}, prog: {}, measures: [], routine: clone((await import('../js/data.js')).DEFAULT_DAYS) };
setST(novo); store.delete(M.PRE_KEY);
M.migrate();
check(ST.onb && ST.onb.done === false, 'utilizador novo devia ver o acolhimento');
check(M.isExistingUser() === false, 'rotina original sem histórico não é utilizador existente');

/* ── 4. aplicar plano ───────────────────────────────────────────────────── */
setST(clone({ ...existing, routine: novo.routine, ...{ onb: { done: true, legacy: true, draft: {} }, sched: { week: weekKey(), done: { Segunda: '2026-09-28' }, swaps: { 'Terça:1': { name: 'x' } }, replaced: {} } } }));
store.delete(M.PRE_KEY);
M.migrate();
const plan = proposePlan({ goal: 'forca', days: ['Segunda', 'Quarta', 'Sexta'], mins: 45, exp: 'inicio', place: 'gym', pref: 'maq', limits: [] });
ST.sets = { 'Segunda:0': [0] };

ST.session = { id: 's', day: 'Segunda', state: 'ACTIVE', startedAt: Date.now() };
const live = P.applyPlan(plan);
check(!live.ok && /em curso/.test(live.error), 'devia recusar com treino em curso');
check(Object.keys(ST.routine).length === 7 && ST.routine.Segunda.label !== 'Corpo inteiro A' || !ST.plan, 'a rotina mudou apesar da recusa');
delete ST.session;

quotaFull = true;
const nq = P.applyPlan(plan);
quotaFull = false;
check(!nq.ok && !ST.plan, 'sem cópia verificada o plano não devia ser aplicado');

const logBefore = JSON.stringify(ST.log), progBefore = JSON.stringify(ST.prog), measBefore = JSON.stringify(ST.measures), wBefore = JSON.stringify(ST.workouts);
const routineBefore = JSON.stringify(ST.routine);
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : ['2026-10-22T12:00:00'])); } static now() { return new RealDate('2026-10-22T12:00:00').getTime(); } };   /* quinta-feira */
const ap = P.applyPlan(plan);
const { dayStatus, currentDay } = await import('../js/schedule.js');
const skipChecks = [dayStatus('Quarta'), currentDay(), JSON.stringify(ST.sched.skip), dayStatus('Segunda')];
globalThis.Date = RealDate;
check(skipChecks[0] === 'skipped' && skipChecks[1] === 'Sexta', `plano a meio da semana: Quarta devia ficar antes do plano e o treino atual ser Sexta (${skipChecks})`);
check(!JSON.parse(skipChecks[2]).Segunda && skipChecks[3] === 'done', 'um dia já feito não pode passar a "antes do plano"');
check(ap.ok, `aplicar plano falhou: ${ap.error}`);
check(JSON.stringify(ST.log) === logBefore && JSON.stringify(ST.prog) === progBefore && JSON.stringify(ST.measures) === measBefore && JSON.stringify(ST.workouts) === wBefore, 'o plano novo tocou em histórico, progressão, medidas ou treinos');
check(ST.sched.done.Segunda === '2026-09-28' && Object.keys(ST.sched.swaps).length === 0, 'treinos feitos devem ficar; trocas temporárias saem');
check(Object.keys(ST.routine).join() === WEEK.join(), 'a rotina devia ter os 7 dias por ordem');
check(ST.routine.Segunda.label === 'Corpo inteiro A' && ST.routine.Terça.rest === true, 'rotina não reflete a proposta');
check(Object.values(ST.routine).every(d => d.id && d.ex.every(e => e.id && e.pat)), 'ids/padrões em falta após aplicar');
check(DAYS.Quarta.ex.length === 5 && P.estimateMin('Quarta') > 20 && P.estimateMin('Terça') === 0, 'DAYS/estimativa incoerentes');
check(ST.plan && ST.plan.id && ST.prefs.goal === 'forca' && ST.onb.done, 'plano/preferências não guardados');
check(JSON.parse(store.get('treino_v2')).routine.Sexta.label === 'Corpo inteiro C', 'não ficou persistido');

/* ── 5. reorganizar ─────────────────────────────────────────────────────── */
ST.sets = { 'Quarta:1': [0, 1] }; ST.done = { 'Quarta:1': true };
const idQ = ST.routine.Quarta.id;
const sw = P.swapDays('Quarta', 'Terça');
check(sw.ok && ST.routine.Terça.id === idQ && ST.routine.Quarta.rest === true, 'trocar dia com descanso falhou');
check(JSON.stringify(ST.sets['Terça:1']) === '[0,1]' && ST.sets['Quarta:1'] === undefined && ST.done['Terça:1'] === true, 'as marcas de séries não acompanharam o treino');
ST.session = { id: 's', day: 'Sexta', state: 'ACTIVE', startedAt: Date.now() };
check(!P.swapDays('Sexta', 'Sábado').ok, 'não devia mover o dia do treino em curso');
delete ST.session;
check(!P.swapDays('Sexta', 'Sexta').ok && !P.swapDays('Sexta', 'Foo').ok, 'dias inválidos devem ser recusados');

/* ── 6. recuperação ─────────────────────────────────────────────────────── */
const rs = M.restoreSnapshot('snap');
check(rs.ok && JSON.stringify(ST.routine) === routineBefore, 'repor não devolveu a rotina anterior');
check(JSON.stringify(ST.log) === logBefore, 'repor perdeu o histórico');
const undo = M.restoreSnapshot('snap');
check(undo.ok && ST.routine.Segunda.label === 'Corpo inteiro A', 'repor devia poder desfazer-se');
const prePath = M.restoreSnapshot('pre');
check(prePath.ok && JSON.stringify(ST.log) === JSON.stringify(before.log), 'repor o estado original falhou');

/* ── 6b. defeitos apanhados na revisão independente ───────────────────── */
{
  /* cargas desta semana acompanham o treino quando se reorganiza (desmarcar tem de retirar a carga) */
  const today = new RealDate().toISOString().slice(0, 10);
  const first = Object.keys(ST.routine).find(d => ST.routine[d].ex.length), rest = Object.keys(ST.routine).find(d => d !== first && ST.routine[d].ex.length);
  ST.log = { ...ST.log, Teste: [{ date: today, ts: 'x', w: 10, r: 10, sets: [{ w: 10, r: 10, ts: 'x', k: `${first}:0` }] }] };
  ST.sets = { [`${first}:0`]: [0] }; ST.done = {};
  check(P.swapDays(first, rest).ok, 'swapDays (relink) falhou');
  check(ST.log.Teste[0].sets[0].k === `${rest}:0` && ST.sets[`${rest}:0`], 'a carga não acompanhou a marca ao reorganizar');

  /* gravação principal falha: nada fica alterado em memória */
  const snapR = JSON.stringify(ST.routine), snapSets = JSON.stringify(ST.sets);
  failKey = 'treino_v2';
  const swFail = P.swapDays(first, rest);
  const apFail = P.applyPlan(plan);
  const rsFail = M.restoreSnapshot('snap');
  failKey = null;
  check(!swFail.ok && !apFail.ok && !rsFail.ok, 'com a gravação a falhar, as operações deviam recusar');
  check(JSON.stringify(ST.routine) === snapR && JSON.stringify(ST.sets) === snapSets, 'a gravação falhada deixou o estado alterado em memória');

  /* o personalizado de hoje não perde as séries ao aplicar um plano */
  ST.custom = { ex: [{ name: 'Extra', s: 3, r: '10' }], label: 'Personalizado' };
  ST.sets = { 'Personalizado:0': [0, 1], [`${rest}:0`]: [0] };
  ST.done = { 'Personalizado:0': false };
  check(P.applyPlan(plan).ok && JSON.stringify(ST.sets) === JSON.stringify({ 'Personalizado:0': [0, 1] }), 'aplicar plano apagou as séries do personalizado (ou não limpou as do plano)');
  delete ST.custom; ST.sets = {}; ST.done = {};

  /* repor uma cópia de outra semana não traz marcas/feitos dessa semana */
  const old = clone(ST); old.sched = { week: '2020-W01', done: { Segunda: '2020-01-01' }, swaps: {}, replaced: {} }; old.sets = { 'Segunda:0': [0] };
  store.set(M.SNAP_KEY, JSON.stringify({ v: 1, at: 'x', reason: 'teste', counts: M.countsOf(old), state: old }));
  check(M.restoreSnapshot('snap').ok && !ST.sched.done.Segunda && !Object.keys(ST.sets).length, 'repor uma semana antiga trouxe marcas/feitos antigos');

  /* estado importado de um backup antigo (sem onb/meta) fica utilizável */
  const legado = clone(ST); delete legado.onb; delete legado.meta; setST(legado);
  M.migrate();
  check(ST.onb && ST.onb.done && ST.meta && ST.meta.schema === 2, 'um estado sem onb/meta devia ser completado por migrate()');
  const noOnb = clone(ST); delete noOnb.onb; setST(noOnb);
  check(M.ensureOnb().done === true, 'ensureOnb devia criar o estado em falta');
}

/* ── 7. erro de gravação visível ────────────────────────────────────────── */
const { save } = await import('../js/state.js');
notices.length = 0; quotaFull = true;
const saved = save();
quotaFull = false;
check(saved === false && notices.some(n => n.kind === 'error' && /guardar/.test(n.msg)), 'save() devia devolver false e avisar');
check(save() === true, 'save() devia voltar a funcionar');

if (fail.length) { console.error(`FALHOU (${fail.length}):\n  ` + fail.slice(0, 25).join('\n  ')); process.exit(1); }
console.log(`OK — planeador (${combos} combinações), migração protegida, plano, reorganizar, recuperação e erros de gravação.`);
