/* Testes da camada de dados do histórico (records.js + logedit.js + gancho de PR em state.js) — npm run test:data
   Sem browser: DOM mínimo como no smoke. Cada caso parte de um ST.log limpo. */
const el = () => new Proxy(function () {}, { get(_, p) { if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false }; if (p === 'style' || p === 'dataset') return {}; if (p === 'value' || p === 'textContent' || p === 'innerHTML') return ''; if (p === 'hidden') return true; if (p === Symbol.toPrimitive) return () => ''; return el(); }, set: () => true, apply: () => el() });
const store = new Map(); const prs = [];
globalThis.window = globalThis;
globalThis.document = { getElementById: el, querySelector: el, querySelectorAll: () => [], createElement: el, addEventListener() {}, dispatchEvent: e => { if (e.type === 'pr') prs.push(e.detail); return true; }, hidden: false, visibilityState: 'hidden', body: el() };
globalThis.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } };
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {}, mediaDevices: undefined }, configurable: true, writable: true });
globalThis.alert = () => {}; globalThis.addEventListener = () => {}; globalThis.confirm = () => true; globalThis.prompt = () => null;
const J = f => import(new URL(`../js/${f}`, import.meta.url));
await J('app.js');
const S = await J('state.js'), R = await J('records.js'), E = await J('logedit.js'), P = await J('progression.js'), SE = await J('session.js'), RT = await J('routine.js');
const { ST } = S;

const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const today = S.todayStr();
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const N = 'Supino reto';
const reset = () => { ST.log = {}; ST.sets = {}; ST.done = {}; ST.session = null; ST.workouts = []; prs.length = 0; };
const entry = (date, sets, extra = {}) => { const b = S.bestSet(sets); return { date, ts: `${date}T10:00:00.000Z`, w: b.w, r: b.r, sets, ...extra }; };
const log = () => S.getLog(N);

/* 1. sem histórico */
reset(); ok(R.sessionsOf(N).length === 0 && R.recordsOf(N).load === null && R.lastBefore(N, today) === null, '1: sem histórico devia dar vazio/null');
S.addSetLog(N, 40, 10, false, 'Segunda:0', 'Segunda'); ok(prs.length === 0, '1: a primeira vez nunca é recorde');

/* 2. histórico antigo agregado: visível, sem séries inventadas nem volume */
reset(); ST.log[N] = [{ date: day(30), ts: 'x', w: 50, r: 8 }, { date: day(20), ts: 'x', w: 52.5, r: 6 }];
let ss = R.sessionsOf(N);
ok(ss.length === 2 && ss.every(s => !s.granular && s.volume === null && s.sets.length === 1), '2: agregado sem granularidade/volume');
ok(R.seriesOf(ss, 'volume').length === 0 && R.seriesOf(ss, 'carga').length === 2, '2: volume ausente mas carga presente');
ok(R.recordsOf(N).load.w === 52.5, '2: recorde de carga de agregados');
ok(ST.log[N][0].sets === undefined, '2: ler não inventa sets');

/* 3. sets completos */
reset(); ST.log[N] = [entry(day(10), [{ w: 60, r: 8 }, { w: 60, r: 7 }, { w: 55, r: 10 }])];
ss = R.sessionsOf(N);
ok(ss[0].granular && ss[0].volume === 60 * 8 + 60 * 7 + 550 && ss[0].best.w === 60 && ss[0].best.r === 8, '3: volume e melhor série (mais reps ao mesmo peso)');
ok(R.frequencyOf(ss, today).total === 1 && R.frequencyOf(ss, today).last4w === 1, '3: frequência');

/* 4. recorde de carga */
reset(); ST.log[N] = [entry(day(7), [{ w: 60, r: 8 }])];
S.addSetLog(N, 62.5, 5, false, 'Segunda:0', 'Segunda');
ok(prs.length === 1 && prs[0].load === true && prs[0].w === 62.5, '4: devia anunciar recorde de carga');
/* 11. mesmo exercício no mesmo dia: uma só entrada; série repetida não duplica nem volta a anunciar */
prs.length = 0; S.addSetLog(N, 62.5, 5, false, 'Segunda:0', 'Segunda');
ok(prs.length === 0, '4/11: repetir a mesma série não repete o aviso');
S.addSetLog(N, 62.5, 5, false, 'Segunda:1', 'Segunda');
ok(log().filter(e => e.date === today).length === 1 && log().find(e => e.date === today).sets.length === 2, '11: duas séries, uma entrada no dia');
ok(prs.length === 0, '11: igualar o recorde não é bater o recorde');

/* 5. recorde de 1RM estimado SEM recorde de carga */
reset(); ST.log[N] = [entry(day(7), [{ w: 60, r: 5 }])];       /* 1RM 70 */
S.addSetLog(N, 55, 12, false, 'Segunda:0', 'Segunda');          /* 55*(1+12/30)=77: 1RM novo, carga menor */
ok(prs.length === 1 && prs[0].e1rm === true && prs[0].load === false, `5: só 1RM devia ser recorde (${JSON.stringify(prs)})`);
/* 1RM só com ≤12 reps */
reset(); ST.log[N] = [entry(day(7), [{ w: 60, r: 5 }])]; S.addSetLog(N, 20, 40, false, 'Segunda:0', 'Segunda');
ok(prs.length === 0 && R.recordsOf(N).e1rm.w === 60, '5: séries com muitas reps não geram 1RM');

/* 6. não é recorde */
reset(); ST.log[N] = [entry(day(7), [{ w: 60, r: 8 }])]; S.addSetLog(N, 50, 8, false, 'Segunda:0', 'Segunda');
ok(prs.length === 0, '6: série inferior não é recorde');

/* importações incompletas: lixo ignorado, sem recordes artificiais */
reset(); ST.log[N] = [{ date: day(5), w: 'abc', r: 5 }, { date: 'x', w: 500, r: 5 }, { date: day(4), w: 0, r: 8 }, { date: day(3), w: 80, r: 100000 }, entry(day(2), [{ w: 40, r: 10 }, { w: -5, r: 3 }, { w: 45 }])];
ok(R.sessionsOf(N).length === 1 && R.recordsOf(N).load.w === 40, '6b: entradas inválidas são ignoradas');

/* 7. edição que invalida um PR; PRs recalculam */
reset(); ST.log[N] = [entry(day(9), [{ w: 60, r: 8 }]), entry(day(2), [{ w: 70, r: 5 }])];
ok(R.recordsOf(N).load.w === 70, '7: PR antes da edição');
ok(E.editSet(N, day(2), 0, 55, 5).ok && R.recordsOf(N).load.w === 60 && log().find(e => e.date === day(2)).w === 55, '7: editar baixa o PR e recalcula o resumo');
ok(!E.editSet(N, day(2), 0, 'x', 5).ok && !E.editSet(N, day(2), 0, 50, 0).ok, '7: valores inválidos recusados');
reset(); ST.log[N] = [entry(day(2), [{ w: 50, r: 8, k: 'Segunda:0', sid: 's1', ts: 'T' }])]; E.editSet(N, day(2), 0, 52, 8);
ok(log()[0].sets[0].k === 'Segunda:0' && log()[0].sets[0].sid === 's1' && log()[0].sets[0].ts === 'T', '7: editar conserva k/sid/ts');
reset(); ST.log[N] = [{ date: day(20), ts: 'x', w: 50, r: 8 }]; E.editSet(N, day(20), 0, 52, 8);
ok(log()[0].sets === undefined && log()[0].w === 52, '7: agregado corrigido continua agregado');

/* 8. correção de data */
reset(); ST.log[N] = [entry(day(40), [{ w: 50, r: 8 }])];
ok(E.moveEntry(N, day(40), day(41)).ok && log().length === 1 && log()[0].date === day(41), '8: mover data, sem duplicar');
ok(!E.moveEntry(N, day(41), day(-3)).ok, '8: data futura recusada');
ok(!E.moveEntry(N, day(41), '2026-13-45').ok, '8: data inválida recusada');
ST.log[N] = [...log(), entry(day(50), [{ w: 45, r: 10 }])];
ok(E.moveEntry(N, day(41), day(50)).ok && log().length === 1 && log()[0].sets.length === 2, '8: mover para um dia com registo junta as séries');
ok(E.moveEntry(N, day(50), day(51)).ok && E.moveEntry(N, day(51), day(50)).ok && log()[0].sets.length === 2, '8: ida e volta sem perda');
reset(); ST.log[N] = [{ date: day(20), ts: 'x', w: 50, r: 8 }]; E.moveEntry(N, day(20), day(21));
ok(log()[0].sets === undefined && log()[0].date === day(21), '8: agregado movido continua agregado');
reset(); ST.log[N] = [entry(today, [{ w: 50, r: 8, k: 'Segunda:0' }])];
ok(!E.moveEntry(N, today, day(1)).ok, '8: série marcada da semana atual não muda de data');

/* 9. treino retroativo */
reset(); ST.log[N] = [entry(day(10), [{ w: 60, r: 8 }])];
ok(E.addSet(N, day(30), 50, 10).ok && log().length === 2 && log()[0].date === day(30) && log()[0].sets.length === 1, '9: retroativo cria o dia');
ok(E.addSet(N, day(30), 50, 9).ok && log()[0].sets.length === 2 && log().length === 2, '9: segunda série no mesmo dia retroativo');
ok(!E.addSet(N, day(-1), 50, 10).ok && !E.addSet(N, day(5), 0, 10).ok, '9: futuro e valores inválidos recusados');
ok(prs.length === 0 && ST.session === null, '9: retroativo não anuncia PR nem inicia sessão');
reset(); ST.log[N] = [{ date: day(20), ts: 'x', w: 50, r: 8 }]; E.addSet(N, day(20), 50, 7);
ok(log()[0].sets.length === 2 && log()[0].sets[0].r === 8, '9: acrescentar a um agregado conserva a série antiga');

/* 10. eliminar série / dia */
reset(); ST.log[N] = [entry(day(10), [{ w: 60, r: 8 }, { w: 60, r: 7 }, { w: 55, r: 10 }])];
ok(E.deleteSet(N, day(10), 1).ok && log()[0].sets.length === 2 && log()[0].r === 8, '10: série eliminada, resumo recalculado');
ok(E.deleteSet(N, day(10), 0).ok && E.deleteSet(N, day(10), 0).ok && log().length === 0, '10: última série elimina o dia');
reset(); ST.log[N] = [entry(day(3), [{ w: 50, r: 8 }]), entry(day(2), [{ w: 50, r: 8 }])]; E.deleteEntry(N, day(3));
ok(log().length === 1 && log()[0].date === day(2), '10: eliminar um dia não toca nos outros');
/* eliminar uma série da semana atual desmarca-a em ST.sets */
reset(); const exName = RT.DAYS['Segunda'].ex[0].name;
ST.sets = { 'Segunda:0': [0, 1] }; ST.done = { 'Segunda:0': false };
ST.log = { [exName]: [entry(today, [{ w: 50, r: 8, k: 'Segunda:0' }, { w: 50, r: 8, k: 'Segunda:1' }])] };
E.deleteSet(exName, today, 1);
ok(JSON.stringify(ST.sets['Segunda:0']) === '[0]', `10: eliminar série desmarca (${JSON.stringify(ST.sets)})`);
/* série do treino em curso: protegida */
reset(); SE.startSession('Segunda', 'x'); ST.log[N] = [entry(today, [{ w: 50, r: 8, sid: ST.session.id }, { w: 50, r: 8, sid: ST.session.id }])];
ok(!E.deleteSet(N, today, 0).ok && !E.deleteEntry(N, today).ok && !E.moveEntry(N, today, day(1)).ok && log()[0].sets.length === 2, '10: séries do treino em curso protegidas');
ok(E.editSet(N, today, 0, 52, 8).ok && SE.currentSession().state === 'ACTIVE', '10: editar não mexe na sessão');

/* 12. treino que atravessa a meia-noite: a data é a de início da sessão */
reset(); SE.startSession('Segunda', 'x'); ST.session = { ...ST.session, date: day(1) };
S.addSetLog(N, 50, 8, false, 'Segunda:0', 'Segunda');
ok(log().length === 1 && log()[0].date === day(1), '12: carga fica na data de início da sessão');

/* 13. personalizado */
reset(); ST.log[N] = [entry(day(3), [{ w: 50, r: 8 }], { c: 1 })];
ok(!E.moveEntry(N, day(3), day(4)).ok, '13: personalizado não muda de data');
ok(E.editSet(N, day(3), 0, 52, 8).ok && log()[0].c === 1, '13: corrigir conserva a marca de personalizado');
ok(R.sessionsOf(N)[0].custom === true, '13: personalizado visível no histórico');

/* 14. Greyskull/progressão continuam a ler o log (sets e agregados) */
reset(); ST.log[N] = [entry(day(14), [{ w: 50, r: 5 }, { w: 50, r: 9 }]), { date: day(7), ts: 'x', w: 50, r: 8 }];
const ev = P.evaluate(N, undefined, { [N]: { scheme: 'greyskull' } });
ok(ev && ev.kind !== undefined, `14: evaluate corre sobre log misto (${JSON.stringify(ev).slice(0, 80)})`);
E.editSet(N, day(14), 1, 50, 10); ok(P.evaluate(N, undefined, { [N]: { scheme: 'greyskull' } }), '14: evaluate corre depois de editar');

/* 15. round-trip JSON do estado */
reset(); ST.log[N] = [entry(day(10), [{ w: 60, r: 8, k: 'Segunda:0', sid: 'a' }]), { date: day(30), ts: 'x', w: 50, r: 8 }, entry(day(3), [{ w: 50, r: 8 }], { c: 1 })];
ST.workouts = [{ id: 'a', day: 'Segunda', state: 'COMPLETED', startedAt: 1, date: day(10) }];
const rt = JSON.parse(JSON.stringify({ app: 'treino', v: 2, state: ST })).state;
ok(JSON.stringify(rt.log) === JSON.stringify(ST.log) && JSON.stringify(rt.workouts) === JSON.stringify(ST.workouts), '15: round-trip do estado sem perda');

/* 17. sem duplicação em ST.log / ST.workouts depois de uma sessão inteira */
reset(); SE.startSession('Segunda', 'x'); S.addSetLog(N, 50, 8, false, 'Segunda:0', 'Segunda'); S.addSetLog(N, 50, 8, false, 'Segunda:0', 'Segunda'); SE.completeSession();
ok(log().length === 1 && log()[0].sets.length === 1 && ST.workouts.length === 1, '17: sem duplicados em log/workouts');

if (fail.length) { console.error(`FALHOU (${fail.length}):\n  ` + fail.join('\n  ')); process.exit(1); }
console.log('OK - dados do histórico: sessões, recordes (carga e 1RM), edição, datas, retroativo, eliminar, protegidas, round-trip.');
process.exit(0);
