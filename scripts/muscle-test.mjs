/* Testes de músculos (muscles.js), sugestão de carga (advice.js) e RIR (logedit.js) — npm run test:muscle
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
const MU = await J('muscles.js'), AD = await J('advice.js'), SG = await J('suggest.js');
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const reset = () => { ST.log = {}; ST.sets = {}; ST.done = {}; ST.session = null; ST.workouts = []; ST.prog = {}; };
const entry = (date, sets, extra = {}) => { const b = S.bestSet(sets); return { date, ts: `${date}T10:00:00.000Z`, w: b.w, r: b.r, sets, ...extra }; };
const rep = (n, w, r, extra = {}) => Array.from({ length: n }, () => ({ w, r, ...extra }));
const M = (days = 7, id) => { const s = MU.muscleStats(days, today); return id ? s.muscles[id] : s; };
const BENCH = 'Supino reto', SQ = 'Agachamento';

/* ── Mapa / volume ─────────────────────────────────────────────────────────────── */
/* 1. sem histórico: ausência de DADOS, nunca "treinou zero" */
reset(); const s0 = M(7);
ok(!s0.any && Object.values(s0.muscles).every(m => m.status === 'incerto' && m.direct === 0 && m.lastDirect === ''), '1: sem histórico = incerto');
/* 2. séries recentes: diretas nos primários, indiretas nos secundários, separadas */
reset(); ST.log[BENCH] = [entry(day(1), rep(3, 60, 10))];
let pe = M(7, 'peito'); const om = M(7, 'ombro');
ok(pe.status === 'dados' && pe.direct === 3 && pe.indirect === 0 && pe.directDays === 1 && pe.lastDirect === day(1), `2: peito ${JSON.stringify(pe)}`);
ok(om.direct === 0 && om.indirect === 3 && om.lastIndirect === day(1) && om.lastDirect === '', '6: secundário só indireto');
ok(pe.exercises[0].volume === 1800 && pe.exercises[0].role === 'direct', '2: volume por exercício = soma w×r');
ok(M(7, 'dorsais').status === 'nenhum', '2: há registos mapeados e nenhum toca as costas = nenhum (≠ incerto)');
/* 3/4. janelas */
reset(); ST.log[BENCH] = [entry(day(10), rep(4, 60, 8)), entry(day(1), rep(2, 60, 8))];
ok(M(7, 'peito').direct === 2 && M(28, 'peito').direct === 6, '3/4: 7 dias só vê 2 séries, 28 dias vê 6');
ok(M(7, 'peito').lastDirect === day(1) && M(28, 'peito').directDays === 2, '4: frequência 2 dias em 28');
reset(); ST.log[BENCH] = [entry(day(6), rep(1, 60, 8))]; ok(M(7, 'peito').direct === 1, '3: dia 6 atrás ainda cabe em 7 dias');
reset(); ST.log[BENCH] = [entry(day(7), rep(1, 60, 8))];
ok(M(7, 'peito').direct === 0 && M(7, 'peito').lastDirect === day(7) && M(7, 'peito').status === 'incerto', '3: dia 7 atrás fora; último estímulo conta todo o histórico; janela sem registos = incerto');
/* 5. composto: cada primário recebe a série inteira, sem percentagens */
reset(); ST.log[SQ] = [entry(day(2), rep(4, 80, 6))];
ok(M(7, 'quadriceps').direct === 4 && M(7, 'gluteos').direct === 4 && M(7, 'isquios').indirect === 4 && M(7, 'isquios').direct === 0, '5: composto sem repartição');
/* 7. dados antigos agregados: sem séries nem volume, mas há data e frequência */
reset(); ST.log[BENCH] = [{ date: day(3), ts: 'x', w: 50, r: 8 }];
pe = M(7, 'peito');
ok(pe.status === 'agregado' && pe.direct === 0 && pe.directDays === 1 && pe.lastDirect === day(3) && pe.exercises[0].aggregated && pe.exercises[0].volume === 0, `7: agregado ${JSON.stringify(pe)}`);
ok(ST.log[BENCH][0].sets === undefined, '7: ler não inventa sets');
/* 8. série eliminada / 9. editada: recalcula */
reset(); ST.log[BENCH] = [entry(day(2), rep(3, 60, 10))];
E.deleteSet(BENCH, day(2), 1); ok(M(7, 'peito').direct === 2, '8: eliminar uma série reduz');
E.editSet(BENCH, day(2), 0, 70, 5); ok(M(7, 'peito').direct === 2 && M(7, 'peito').exercises[0].volume === 70 * 5 + 600, '9: editar muda o volume');
E.deleteEntry(BENCH, day(2)); ok(M(7, 'peito').exercises.length === 0, '8: eliminar o dia retira tudo');
/* 10. treino retroativo */
reset(); E.addSet(BENCH, day(4), 60, 8); ok(M(7, 'peito').direct === 1 && M(7, 'peito').lastDirect === day(4), '10: retroativo conta na data certa');
E.moveEntry(BENCH, day(4), day(12)); ok(M(7, 'peito').direct === 0 && M(28, 'peito').direct === 1, '10: mover o dia move o estímulo');
/* 11. exercício substituído/sem mapeamento: não conta, é declarado; nada fica "nenhum" por engano */
reset(); ST.log['Exercício Fantasma'] = [entry(day(1), rep(3, 20, 10))]; ST.log[BENCH] = [entry(day(1), rep(3, 60, 10))];
const st11 = M(7);
ok(st11.unmapped.join() === 'Exercício Fantasma' && st11.muscles.dorsais.status === 'incerto' && st11.muscles.peito.status === 'dados', '11: sem mapeamento -> declarado e incerto');
/* 12. personalizado: entradas c:1 contam como as outras */
reset(); ST.log[BENCH] = [entry(day(0), rep(2, 50, 10), { c: 1 })]; ok(M(7, 'peito').direct === 2, '12: personalizado conta');
/* 13. sessão que atravessa a meia-noite: fica na data de INÍCIO */
reset(); ST.session = { id: 'sx', state: 'ACTIVE', day: 'Segunda', date: day(1) };
S.addSetLog(BENCH, 60, 8, false, 'Segunda:0', 'Segunda'); S.addSetLog(BENCH, 60, 8, false, 'Segunda:1', 'Segunda');
ok(M(7, 'peito').direct === 2 && M(7, 'peito').lastDirect === day(1) && M(7, 'peito').directDays === 1, '13: meia-noite = um dia, o do início');
/* séries inválidas e futuras ficam de fora */
reset(); ST.log[BENCH] = [entry(day(1), [{ w: 60, r: 8 }, { w: 0, r: 8 }, { w: 60, r: 'x' }]), entry(day(-2), rep(3, 60, 8))];
ok(M(7, 'peito').direct === 1, 'inválidas e futuras não contam');
/* resumo por grupo do personalizado + escala */
reset(); ST.log[BENCH] = [entry(day(1), rep(5, 60, 8))]; ST.log['Rosca direta'] = [entry(day(1), rep(2, 20, 8))];
const gs = MU.groupSummary(M(7), SG.GROUPS);
ok(gs.peito.sets === 5 && gs.biceps.sets === 2 && gs.peito.last === day(1) && gs.costas.sets === 0, '12: resumo por grupo');
const hf = MU.heatFill(M(7));
ok(hf('peito') === MU.RAMP[3] && hf('biceps') !== hf('peito') && hf('dorsais') === MU.FILL.none && hf('ombro') === MU.FILL.indirect, `escala: ${hf('peito')} ${hf('biceps')}`);
/* 20. backup: round-trip JSON dá os mesmos números (RIR incluído) */
reset(); ST.log[BENCH] = [entry(day(1), [{ w: 60, r: 8, rir: 2 }, { w: 60, r: 8 }])];
const before = JSON.stringify(M(7)); ST.log = JSON.parse(JSON.stringify(ST.log)); ok(JSON.stringify(M(7)) === before && ST.log[BENCH][0].sets[0].rir === 2, '20: backup novo mantém tudo');

/* ── Progressão ────────────────────────────────────────────────────────────────── */
const EX = { name: BENCH, s: 3, r: '8-12', mus: { p: ['peito'], s: [] } }, EXL = { name: SQ, s: 3, r: '8-12', mus: { p: ['quadriceps'], s: [] } };
const adv = (ex = EX, o = {}) => AD.adviceFor(ex.name, { exercise: ex, today, ...o });
const seed = (name, ...sess) => { ST.log[name] = sess.map(([d, sets]) => entry(day(d), sets)); };
/* 14. todas completas, 2 sessões */
reset(); seed(BENCH, [8, rep(3, 60, 12)], [2, rep(3, 60, 12)]);
let a = adv(); ok(a.kind === 'up' && a.w === 62.5 && /duas sessões/.test(a.msg) && a.evidence.length === 2, `14: ${JSON.stringify(a)}`);
/* PR isolado não chega */
reset(); seed(BENCH, [8, rep(3, 60, 10)], [2, rep(3, 70, 12)]);
a = adv(); ok(a.kind === 'hold', `PR de uma sessão ao peso novo: ${a.kind}`);
reset(); seed(BENCH, [2, rep(3, 60, 12)]); a = adv(); ok(a.kind === 'insufficient', '16: uma sessão = insuficiente');
/* 15. falhas */
reset(); seed(BENCH, [8, [{ w: 60, r: 8 }, { w: 60, r: 7 }, { w: 60, r: 6 }]], [2, [{ w: 60, r: 8 }, { w: 60, r: 6 }, { w: 60, r: 6 }]]);
a = adv(); ok(a.kind === 'review', `15: ${a.kind}`);
reset(); seed(BENCH, [8, rep(3, 60, 12)], [2, [{ w: 60, r: 12 }, { w: 60, r: 10 }, { w: 60, r: 9 }]]);
a = adv(); ok(a.kind === 'hold' && /12\/10\/9/.test(a.msg), `15: parcial = manter (${a.msg})`);
/* treino incompleto não penaliza nem conta */
reset(); seed(BENCH, [12, rep(3, 60, 12)], [8, rep(3, 60, 12)], [2, rep(1, 60, 3)]);
a = adv(); ok(a.kind === 'up', `incompleto ignorado: ${a.kind}`);
/* dados insuficientes: agregados, fora do plano, cargas variáveis */
reset(); ST.log[BENCH] = [{ date: day(5), ts: 'x', w: 60, r: 12 }, { date: day(2), ts: 'x', w: 60, r: 12 }];
ok(adv().kind === 'insufficient', '16: agregados não bastam');
reset(); seed(BENCH, [8, rep(3, 60, 12)], [2, rep(3, 60, 12)]);
ok(AD.adviceFor('Outro nome', { exercise: { name: 'Outro nome', r: '8-12' }, today }).kind === 'insufficient', '16: sem séries previstas');
reset(); seed(BENCH, [8, [{ w: 50, r: 12 }, { w: 60, r: 12 }, { w: 70, r: 12 }]], [2, [{ w: 50, r: 12 }, { w: 60, r: 12 }, { w: 70, r: 12 }]]);
ok(adv().kind === 'insufficient', '16: cargas diferentes entre séries = insuficiente');
/* ausência não é perda de força; carga mudou */
reset(); seed(BENCH, [60, rep(3, 60, 12)], [50, rep(3, 60, 12)]); a = adv(); ok(a.kind === 'hold' && /dias/.test(a.msg), `longa pausa = manter: ${a.msg}`);
reset(); seed(BENCH, [8, rep(3, 57.5, 12)], [2, rep(3, 60, 12)]); ok(adv().kind === 'hold', 'carga mudou = manter');
/* 17. Greyskull e tempo: precedência do protocolo */
reset(); seed(BENCH, [8, rep(3, 60, 12)], [2, rep(3, 60, 12)]); ST.prog = { [BENCH]: { scheme: 'greyskull' } };
ok(adv() === null, '17: greyskull -> nada genérico');
reset(); ok(AD.adviceFor('Prancha', { exercise: { name: 'Prancha', s: 3, r: '30-60s' }, today }) === null, 'tempo -> nada');
/* 18. incrementos de equipamento */
reset(); seed(SQ, [8, rep(3, 100, 12)], [2, rep(3, 100, 12)]); ok(adv(EXL).w === 105, '18: pernas +5');
ST.prog = { [SQ]: { inc: 2 } }; ok(adv(EXL).w === 102, '18: salto do utilizador');
/* 19. RIR */
reset(); ST.log[BENCH] = [entry(day(8), rep(3, 60, 12)), entry(day(2), rep(3, 60, 12, { rir: 0 }))];
ok(adv().kind === 'hold' && /falha/.test(adv().msg), '19: RIR 0 trava a subida');
ST.log[BENCH] = [entry(day(8), rep(3, 60, 12)), entry(day(2), rep(3, 60, 12, { rir: 2 }))]; ok(adv().kind === 'up', '19: RIR>0 não trava');
ST.log[BENCH] = [entry(day(8), rep(3, 60, 12)), entry(day(2), [{ w: 60, r: 12, rir: 0 }, ...rep(2, 60, 12)])]; ok(adv().kind === 'hold', '19: um RIR 0 numa série já trava');
ST.log[BENCH] = [entry(day(8), rep(3, 60, 12)), entry(day(2), [{ w: 60, r: 12, rir: 1 }, ...rep(2, 60, 12)])]; ok(adv().kind === 'up', '19: RIR 1 parcial não trava');
/* RIR: gravar, validar, conservar, limpar, compatível */
reset(); E.addSet(BENCH, day(3), 60, 8, 2);
ok(S.getLog(BENCH)[0].sets[0].rir === 2, 'RIR gravado');
E.addSet(BENCH, day(3), 60, 8); ok(S.getLog(BENCH)[0].sets[1].rir === undefined, 'sem RIR = campo ausente');
ok(E.editSet(BENCH, day(3), 0, 62.5, 8).ok && S.getLog(BENCH)[0].sets[0].rir === 2, 'editar peso conserva o RIR');
ok(!E.editSet(BENCH, day(3), 0, 60, 8, '9').ok && !E.editSet(BENCH, day(3), 0, 60, 8, '1.5').ok && !E.addSet(BENCH, day(3), 60, 8, 'x').ok, 'RIR inválido recusado');
ok(E.editSet(BENCH, day(3), 0, 62.5, 8, '').ok && !('rir' in S.getLog(BENCH)[0].sets[0]), 'RIR "" limpa');
ok(E.editSet(BENCH, day(3), 1, 60, 8, '0').ok && S.getLog(BENCH)[0].sets[1].rir === 0, 'RIR 0 é válido (≠ vazio)');
/* 20. backup antigo (sem rir, sem sets) lê-se sem erros */
reset(); ST.log = { [BENCH]: [{ date: day(2), ts: 'x', w: 60, r: 8 }, entry(day(1), rep(2, 60, 8))] };
ok(M(7, 'peito').direct === 2 && M(7, 'peito').aggregated === 1 && adv().kind === 'insufficient', '20: backup antigo');

if (fail.length) { console.error(`FALHOU (${fail.length}):\n  ` + fail.join('\n  ')); process.exit(1); }
console.log('OK - músculos (janelas, diretos/indiretos, agregados, editar/eliminar/retroativo, meia-noite), sugestão de carga, RIR, backups.');
process.exit(0);
