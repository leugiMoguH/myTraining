/* Smoke test dos módulos ES (Fase 0) — corre com: npm run smoke
   Não substitui o teste no browser; apanha o que falha em silêncio:
   ciclos de import mal ordenados, símbolos em falta e handlers inline sem ponte. */
import { readFileSync, readdirSync } from 'node:fs';

const JS = new URL('../js/', import.meta.url);
const read = f => readFileSync(new URL(f, JS), 'utf8');
const files = readdirSync(JS).filter(f => f.endsWith('.js'));
const fail = [];

/* ── 1. DOM mínimo, só o suficiente para os módulos avaliarem ───────────── */
const el = () => new Proxy(function () {}, {
  get(_, p) {
    if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
    if (p === 'style' || p === 'dataset') return {};
    if (p === 'value' || p === 'textContent' || p === 'innerHTML') return '';
    if (p === 'hidden') return true;
    if (p === Symbol.toPrimitive) return () => '';
    return el();
  },
  set: () => true,
  apply: () => el(),
});
const store = new Map();
globalThis.window = globalThis;
globalThis.document = {
  getElementById: el, querySelector: el, querySelectorAll: () => [],
  createElement: el, addEventListener() {}, visibilityState: 'hidden', body: el(),
};
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
Object.defineProperty(globalThis, 'navigator', {
  value: { vibrate() {}, mediaDevices: undefined }, configurable: true, writable: true,
});
globalThis.alert = () => {};
globalThis.confirm = () => false;
globalThis.prompt = () => null;

/* ── 2. avaliar o grafo inteiro a partir do ponto de entrada ─────────────── */
try {
  await import(new URL('app.js', JS));
} catch (e) {
  fail.push(`app.js não avaliou: ${e.message}`);
}

/* ── 3. percorrer os ecrãs principais: apanha erros dentro dos render ────── */
const { DAYS } = await import(new URL('routine.js', JS));
const screens = ['__hoje', '__semana', ...Object.keys(DAYS), '__perfil', '__nutri'];
for (const s of screens) {
  try { globalThis.render(s); } catch (e) { fail.push(`render('${s}') rebentou: ${e.message}`); }
}
const actions = [
  ['openSheet', () => globalThis.openSheet()],
  ['timerStart', () => globalThis.timerStart(60)],
  ['timerDismiss', () => globalThis.timerDismiss()],
  ['openInfo', () => globalThis.openInfo('Supino reto')],
  ['startWorkout', () => globalThis.startWorkout('Segunda')],
  ['woGo', () => globalThis.woGo(1)],
  ['closeWorkout', () => globalThis.closeWorkout()],
  ['toggleChart', () => globalThis.toggleChart(0, 'Supino reto')],
  ['setMetric', () => globalThis.setMetric('weight')],
];
for (const [name, run] of actions) {
  try { run(); } catch (e) { fail.push(`${name}() rebentou: ${e.message}`); }
}

/* ── 4. catálogo: dados gerados + pesquisa/filtros (ainda sem UI) ────────── */
globalThis.fetch = async url => {
  const p = new URL('../' + String(url), import.meta.url);
  try { return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(p, 'utf8')) }; }
  catch { return { ok: false, status: 404, json: async () => null }; }
};
try {
  const cat = await import(new URL('catalog.js', JS));
  const { meta } = await cat.loadCatalog();
  if (cat.all().length < 1000) fail.push(`catálogo com só ${cat.all().length} exercícios`);
  if (!/^[0-9a-f]{40}$/.test(meta.sha || '')) fail.push('meta.sha do catálogo não é um commit fixado');

  const bench = cat.search('bench press', { limit: 0 });
  if (bench.length < 30) fail.push(`search("bench press") só deu ${bench.length} resultados`);
  if (!bench.every(e => e.k.includes('bench') && e.k.includes('press')))
    fail.push('search devolveu resultados sem todos os termos');
  if (!cat.search('squat')[0].n.toLowerCase().startsWith('squat'))
    fail.push(`ranking mau: search("squat") deu "${cat.search('squat')[0].n}" primeiro`);
  if (cat.search('SQUAT').length !== cat.search('squat').length) fail.push('search não é insensível a maiúsculas');
  if (!cat.search('', { equipment: 'dumbbell', limit: 0 }).every(e => e.e === 'dumbbell'))
    fail.push('filtro de equipamento deixou passar outros');

  const f = cat.facets();
  if (f.b.length !== 10 || f.e.length !== 28 || f.t.length !== 19)
    fail.push(`facets inesperados: ${f.b.length} grupos / ${f.e.length} equip / ${f.t.length} alvos`);
  if (f.b.some(x => !x.label)) fail.push('há grupos musculares sem tradução PT');

  const ex = cat.all()[0];
  if (!cat.thumbUrl(ex).endsWith('.jpg') || !cat.gifUrl(ex).endsWith('.gif')) fail.push('URLs de media mal formadas');
  if (!cat.thumbUrl(ex).includes(meta.sha)) fail.push('URL de media não usa o SHA fixado');
  if (cat.MEDIA_BASE !== meta.media) fail.push('MEDIA_BASE em catalog.js está dessincronizado do catálogo gerado');

  await cat.loadInstructions();
  if (cat.instructionOf(ex.id).length < 20) fail.push(`sem instruções EN para ${ex.id}`);

  const semMusculo = cat.all().filter(e => !cat.muscleIdsOf(e).p.length);
  if (semMusculo.some(e => e.t !== 'cardiovascular system'))
    fail.push('há exercícios não-cardio sem músculo primário no bodySVG');
} catch (e) {
  fail.push(`catálogo rebentou: ${e.message}`);
}

/* ── 5. rotina: editar exercícios sem baralhar o progresso ───────────────── */
try {
  const R = await import(new URL('routine.js', JS));
  const { ST, key } = await import(new URL('state.js', JS));
  const D = 'Segunda';
  const nomes = () => R.exercisesOf(D).map(e => e.name);

  if (R.exercisesOf(D).length !== 6) fail.push(`rotina semeada com ${R.exercisesOf(D).length} exercícios (esperado 6)`);

  /* marcar séries no 1.º e no 3.º, depois mexer na lista à volta deles */
  ST.sets[key(D, 0)] = [0, 1];
  ST.sets[key(D, 2)] = [0];
  ST.done[key(D, 0)] = true;
  const [a, , c] = nomes();

  R.moveExercise(D, 0, 1);                      /* 1.º passa a 2.º */
  if (nomes()[1] !== a) fail.push('moveExercise não trocou a ordem');
  if (!ST.done[key(D, 1)] || ST.done[key(D, 0)]) fail.push('moveExercise não levou o "feito" com o exercício');
  if (String(ST.sets[key(D, 1)]) !== '0,1') fail.push('moveExercise não levou as séries com o exercício');

  R.removeExercise(D, 0);                        /* apagar o que ficou em 1.º */
  if (nomes()[0] !== a) fail.push('removeExercise apagou o exercício errado');
  if (!ST.done[key(D, 0)]) fail.push('removeExercise não reindexou o progresso');
  if (R.exercisesOf(D).length !== 5) fail.push('removeExercise não encurtou a lista');

  const antes = R.exercisesOf(D).length;
  R.addExercise(D, { name: 'Teste smoke', s: 3, r: '8-12', catalogId: '0001' });
  if (R.exercisesOf(D).length !== antes + 1) fail.push('addExercise não acrescentou');
  if (!R.isCustom(D, antes)) fail.push('exercício do catálogo não é reconhecido como tal');
  if (ST.sets[key(D, antes)]) fail.push('exercício novo herdou séries de outro');

  R.updateExercise(D, 0, { s: 5, r: '3-5' });
  if (R.exercisesOf(D)[0].s !== 5) fail.push('updateExercise não gravou as séries');
  if (R.exercisesOf(D)[0].name !== a) fail.push('updateExercise mexeu no nome (perderia o histórico)');

  R.removeExercise(D, R.exercisesOf(D).length - 1);
  R.resetRoutine();
  if (R.exercisesOf(D).length !== 6) fail.push('resetRoutine não repôs o plano original');
  if (Object.keys(ST.done).length) fail.push('resetRoutine deixou progresso para trás');
  if (nomes()[2] !== c) fail.push('resetRoutine repôs uma ordem diferente da original');
} catch (e) {
  fail.push(`rotina rebentou: ${e.message}`);
}

/* ── 6. motor de progressão: subir, estagnar, deload ─────────────────────── */
try {
  const P = await import(new URL('progression.js', JS));
  const { ST } = await import(new URL('state.js', JS));

  const sessoes = (...pares) => pares.map(([w, r], i) => ({ date: `2026-01-0${i + 1}`, w, r }));
  const caso = (nome, log, ex, prog) => { ST.log = { ...ST.log, [nome]: log }; return P.evaluate(nome, ex, prog); };
  const supino = { name: 'x', r: '8-12', mus: { p: ['peito'], s: [] } };
  const agacha = { name: 'y', r: '8-12', mus: { p: ['quadriceps'], s: [] } };
  const check = (cond, msg) => { if (!cond) fail.push(`progressão: ${msg}`); };

  /* gamas de reps */
  check(P.parseRange('8-12').hi === 12, 'parseRange("8-12") errado');
  check(P.parseRange('5').lo === 5, 'parseRange("5") errado');
  check(P.parseRange('30-60s') === null, '"30-60s" devia ser tempo, não carga');
  check(P.parseRange('20-30 min') === null, '"20-30 min" devia ser tempo, não carga');

  /* incremento maior nas pernas */
  check(P.incrementFor(supino) === 2.5, 'incremento do tronco devia ser 2.5kg');
  check(P.incrementFor(agacha) === 5, 'incremento das pernas devia ser 5kg');

  /* sem histórico */
  check(caso('p1', [], supino).kind === 'first', 'sem registos devia pedir a primeira carga');

  /* exercício por tempo não progride por carga */
  check(caso('p2', sessoes([0, 45]), { r: '30-60s' }).kind === 'none', 'exercício por tempo não devia sugerir carga');

  /* dupla progressão: a meio da gama sobe uma repetição */
  const meio = caso('p3', sessoes([50, 10]), supino);
  check(meio.kind === 'hold' && meio.w === 50 && meio.r === 11, `dupla progressão a meio deu ${meio.kind} ${meio.w}x${meio.r}`);

  /* topo da gama: sobe o peso e as reps voltam ao fundo */
  const topo = caso('p4', sessoes([50, 12]), supino);
  check(topo.kind === 'up' && topo.w === 52.5 && topo.r === 8, `topo da gama deu ${topo.kind} ${topo.w}x${topo.r}`);

  /* pernas sobem 5kg */
  const pernas = caso('p5', sessoes([100, 12]), agacha);
  check(pernas.w === 105, `agachamento devia subir para 105, deu ${pernas.w}`);

  /* 2 falhas = aviso, 3 = deload de 10% */
  const duas = caso('p6', sessoes([50, 9], [50, 9]), supino);
  check(duas.kind === 'hold' && duas.stalls === 2, `2 falhas deram ${duas.kind}/${duas.stalls}`);
  const tres = caso('p7', sessoes([50, 9], [50, 9], [50, 9]), supino);
  check(tres.kind === 'deload' && tres.w === 45, `3 falhas deviam dar deload 45kg, deram ${tres.kind} ${tres.w}`);

  /* um sucesso pelo meio corta a contagem */
  const cortado = caso('p8', sessoes([50, 9], [50, 12], [50, 9]), supino);
  check(cortado.stalls === 1, `sucesso pelo meio devia repor a contagem, ficou ${cortado.stalls}`);

  /* mudar de peso também corta */
  const trocou = caso('p9', sessoes([45, 9], [45, 9], [50, 9]), supino);
  check(trocou.stalls === 1, `mudar de peso devia repor a contagem, ficou ${trocou.stalls}`);

  /* linear: alvo é o fundo da gama */
  const lin = caso('p10', sessoes([60, 8]), supino, { p10: { scheme: 'linear' } });
  check(lin.kind === 'up' && lin.w === 62.5, `linear com 8 reps devia subir, deu ${lin.kind} ${lin.w}`);

  /* greyskull: dobro do alvo = salto duplo */
  const gs = caso('p11', sessoes([60, 16]), supino, { p11: { scheme: 'greyskull' } });
  check(gs.kind === 'up' && gs.w === 65, `greyskull com 16 reps devia saltar 5kg (2x2.5), deu ${gs.w}`);
  const gs1 = caso('p12', sessoes([60, 9]), supino, { p12: { scheme: 'greyskull' } });
  check(gs1.w === 62.5, `greyskull com 9 reps devia subir 2.5kg, deu ${gs1.w}`);

  /* incremento à medida do utilizador ganha ao predefinido */
  const custom = caso('p13', sessoes([50, 12]), supino, { p13: { inc: 1 } });
  check(custom.w === 51, `incremento personalizado ignorado: deu ${custom.w}`);

  /* sem `prog` passado à mão, vale o que o utilizador escolheu em ST.prog */
  ST.log = { ...ST.log, p15: sessoes([60, 12]) };
  ST.prog = { p15: { scheme: 'greyskull', inc: 10 } };
  const guardado = P.evaluate('p15', supino);
  check(guardado.w === 70, `ST.prog ignorado: esperado 70kg, deu ${guardado.w}`);
  ST.prog = {};

  /* pesos sempre em múltiplos de 0,5kg */
  const meia = caso('p14', sessoes([47, 9], [47, 9], [47, 9]), supino);
  check(meia.w * 2 === Math.round(meia.w * 2), `peso de deload não arredondado: ${meia.w}`);
} catch (e) {
  fail.push(`progressão rebentou: ${e.message}`);
}

/* ── 7. agenda: fila que desliza, descanso e reset semanal ──────────────── */
try {
  const S = await import(new URL('schedule.js', JS));
  const R = await import(new URL('routine.js', JS));
  const { ST, key } = await import(new URL('state.js', JS));
  const check = (cond, msg) => { if (!cond) fail.push(`agenda: ${msg}`); };

  /* semana ISO: de Segunda a Domingo é a mesma; a Segunda seguinte já não */
  check(S.weekKey('2026-09-07') === S.weekKey('2026-09-13'), 'Segunda e Domingo deviam cair na mesma semana');
  check(S.weekKey('2026-09-13') !== S.weekKey('2026-09-14'), 'a semana devia mudar na Segunda');

  R.resetRoutine();
  ST.sched = { week: S.weekKey(), done: {}, swaps: {} };

  check(S.dayStatus('Domingo') === 'rest', 'Domingo ("Descanso Ativo") devia ser descanso sem configuração nenhuma');
  check(S.currentDay() === 'Segunda', `a fila devia começar na Segunda, deu ${S.currentDay()}`);

  S.completeDay('Segunda');
  check(S.currentDay() === 'Terça', 'concluída a Segunda, segue a Terça');

  /* o coração disto: falhar um dia não o salta — fica pendente */
  S.completeDay('Quarta');
  check(S.currentDay() === 'Terça', 'treino falhado devia ficar pendente, não ser saltado');

  ['Terça', 'Quinta', 'Sexta', 'Sábado'].forEach(d => S.completeDay(d));
  check(S.currentDay() === null, 'com tudo feito e o Domingo em descanso, a semana devia fechar');
  check(S.agenda().allDone === true, 'agenda() devia dar a semana como fechada');

  /* marcar todas as séries fecha o dia sem carregar em "Concluir" */
  ST.sched.done = {};
  R.exercisesOf('Segunda').forEach((_, i) => { ST.done[key('Segunda', i)] = true; });
  check(S.dayStatus('Segunda') === 'done', 'todas as séries feitas deviam fechar o dia');
  check(S.dayStatus('Terça') === 'todo', 'a Terça devia continuar por fazer');

  /* dia marcado como descanso sai da fila */
  S.setRest('Terça', true);
  check(S.currentDay() === 'Quarta', 'um dia de descanso devia ser ignorado pela fila');
  S.setRest('Terça', false);

  /* reset semanal */
  ST.sched.week = '2000-W01';
  check(S.ensureWeek() === true, 'uma semana antiga devia disparar o reset');
  check(Object.keys(ST.done).length === 0, 'o reset semanal devia limpar as séries feitas');
  check(S.currentDay() === 'Segunda', 'depois do reset a fila volta ao início');
  check(S.ensureWeek() === false, 'segundo ensureWeek na mesma semana não devia limpar nada');

  /* troca "só esta semana" é reposta no reset */
  const orig = R.exercisesOf('Segunda')[0];
  S.rememberSwap('Segunda', 0, orig);
  const lista = R.exercisesOf('Segunda');
  R.setDayExercises('Segunda', lista.map((e, i) => (i ? e : { ...e, name: 'Trocado' })), lista.map((_, i) => i));
  check(R.exercisesOf('Segunda')[0].name === 'Trocado', 'a troca não chegou a ser aplicada');
  ST.sched.week = '2000-W01';
  S.ensureWeek();
  check(R.exercisesOf('Segunda')[0].name === orig.name, 'o reset semanal devia repor o exercício original');

  /* substituição: fica com as séries/reps do plano e não herda o progresso */
  const antesLen = R.exercisesOf('Segunda').length;
  const alvo = R.exercisesOf('Segunda')[1];
  ST.sets[key('Segunda', 1)] = [0, 1];
  ST.done[key('Segunda', 1)] = true;
  R.replaceExercise('Segunda', 1, { name: 'Substituto', s: 99, r: '1', catalogId: '0002' });
  const novo = R.exercisesOf('Segunda')[1];
  check(novo.name === 'Substituto', 'replaceExercise não trocou o exercício');
  check(novo.s === alvo.s && novo.r === alvo.r, 'a troca devia manter as séries e reps do plano');
  check(!ST.done[key('Segunda', 1)] && !ST.sets[key('Segunda', 1)], 'o exercício trocado herdou o progresso do antigo');
  check(R.exercisesOf('Segunda').length === antesLen, 'replaceExercise mudou o tamanho do dia');
  check(R.exercisesOf('Segunda')[0].name === orig.name, 'replaceExercise mexeu no exercício errado');

  S.rememberSwap('Segunda', 1, alvo);
  S.forgetSwap('Segunda', 1);
  check(S.swapOriginal('Segunda', 1) === null, 'forgetSwap não esqueceu o original (troca permanente)');
} catch (e) {
  fail.push(`agenda rebentou: ${e.message}`);
}

/* ── 7b. treino personalizado: só hoje, plano intacto, histórico à parte ─── */
try {
  const R = await import(new URL('routine.js', JS));
  const S = await import(new URL('schedule.js', JS));
  const C = await import(new URL('custom.js', JS));
  const G = await import(new URL('suggest.js', JS));
  const { ST, todayStr, logSet, getProgress } = await import(new URL('state.js', JS));
  const check = (cond, msg) => { if (!cond) fail.push(`personalizado: ${msg}`); };
  const CD = R.CUSTOM_DAY;
  const keysCustom = () => [...Object.keys(ST.sets), ...Object.keys(ST.done)].filter(k => k.startsWith(`${CD}:`));

  R.resetRoutine();
  ST.sched = { week: S.weekKey(), done: {}, swaps: {}, replaced: {} };
  ST.custom = null; ST.sessions = []; ST.log = {}; ST.view = '__hoje';
  const plano = JSON.stringify(ST.routine);
  const fila = S.currentDay();
  const prox = R.dayNames().find(d => d !== fila && S.dayStatus(d) !== 'rest');
  const diaReal = ST.day;
  ST.sets['Segunda:0'] = [0]; ST.done['Segunda:0'] = false;

  /* sugestão (função pura sobre o pool real: plano + catálogo) */
  const pool = C.buildPool();
  const nomes = l => l.map(e => e.name);
  const peito = G.suggest(['peito'], pool);
  check(peito.length === 5, `1 grupo devia dar 5 exercícios, deu ${peito.length}`);
  check(peito.every(e => C.idsOf(e.name).includes('peito')), 'um exercício sugerido não treina peito');
  check(peito.filter(e => R.findExercise(e.name)).length >= 4, 'o plano tem 4 exercícios de peito: deviam vir primeiro');
  check(G.suggest(['gemeos'], pool).some(e => !R.findExercise(e.name)), 'gémeos tem 1 no plano: o resto devia vir do catálogo');
  const duo = G.suggest(['peito', 'triceps'], pool);
  check(duo.length === 6 && new Set(nomes(duo)).size === 6, 'peito+tríceps devia dar 6 exercícios sem repetições');
  const pernas = G.suggest(['quadriceps', 'gluteos'], pool);
  check(new Set(nomes(pernas)).size === pernas.length, 'exercício de vários grupos repetido');
  check(nomes(pernas).filter(n => n === 'Agachamento').length === 1, 'o Agachamento (quadríceps+glúteos) devia entrar uma só vez');
  check(G.suggest(['peito', 'triceps', 'biceps', 'costas', 'core'], pool).length === 5, '5 grupos devia dar 1 exercício por grupo');
  check(G.suggest([], pool).length === 0 && G.suggest(['xx'], pool).length === 0, 'sem grupos válidos devia dar lista vazia');
  check(JSON.stringify(G.suggest(['costas', 'ombros'], pool)) === JSON.stringify(G.suggest(['ombros', 'costas'], pool)),
    'a sugestão devia ser determinística e independente da ordem da escolha');
  check(G.suggest(['peito'], pool.filter(c => c.known === 2)).length > 0, 'sem catálogo ainda devia sair algo do plano');
  check(G.suggest(['peito'], pool.filter(c => c.ids.includes('peito')).slice(0, 2)).length === 2, 'com poucos exercícios devia devolver só os que existem');
  const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  check(G.recency({ 'Supino reto': [{ date: ontem }] }, C.idsOf, todayStr()).peito === 1, 'recência: peito treinado ontem devia dar 1 dia');

  /* fluxo: escolher → sugerir → rever */
  globalThis.openCustom();
  check(ST.view === '__pers' && R.getDay(ST.day), 'o ecrã personalizado não pode mexer em ST.day');
  await globalThis.cuSuggest();
  check(!ST.custom && C.PICK.msg, 'sem músculos escolhidos não devia criar treino');
  globalThis.cuToggle('peito'); globalThis.cuToggle('triceps');
  await globalThis.cuSuggest();
  check(ST.custom && ST.custom.stage === 'plan' && ST.custom.ex.length === 6, 'a sugestão devia ficar em ST.custom (6 exercícios)');
  check(JSON.stringify(ST.routine) === plano, 'o plano normal foi alterado pela sugestão');
  check(!R.dayNames().includes(CD) && S.currentDay() === fila, 'o treino personalizado não pode entrar na agenda');

  /* reabertura da app: o estado sobrevive a JSON e continua válido */
  const volta = JSON.parse(JSON.stringify(ST.custom));
  check(C.valid(volta) && volta.date === todayStr(), 'ST.custom não sobrevive a uma ida e volta por JSON');
  globalThis.render('__pers');
  check(ST.custom.stage === 'plan', 'reabrir o ecrã não devia perder a revisão');

  /* rever: remover, adicionar, trocar */
  globalThis.cuRemove(0);
  check(ST.custom.ex.length === 5, 'cuRemove devia tirar um exercício');
  R.addExercise(CD, { name: 'Extra', s: 3, r: '8-12' });
  check(ST.custom.ex.length === 6 && ST.custom.ex[5].name === 'Extra', 'addExercise no dia personalizado não chegou a ST.custom');
  check(JSON.stringify(ST.routine) === plano, 'editar o personalizado alterou o plano normal');
  R.replaceExercise(CD, 5, { name: 'Outro', s: 9, r: '1' });
  check(ST.custom.ex[5].name === 'Outro' && ST.custom.ex[5].s === 3, 'replaceExercise no personalizado falhou');
  S.rememberSwap(CD, 5, { name: 'x' });
  check(Object.keys(ST.sched.swaps).length === 0, 'trocas do personalizado não podem entrar nas trocas semanais');

  /* treinar */
  globalThis.cuBegin();
  check(ST.custom.stage === 'active', 'cuBegin devia passar a ativo');
  globalThis.toggleSet(CD, 0, 0);
  check(getProgress(CD).total === 6 && ST.sets[`${CD}:0`].length === 1, 'as séries do personalizado não foram registadas');
  logSet('Supino reto', 60, 8, true);
  check(ST.log['Supino reto'].slice(-1)[0].c === 1, 'a carga do personalizado devia ficar marcada c:1');
  logSet('Remada', 40, 10);
  check(ST.log['Remada'].slice(-1)[0].c === undefined, 'a carga do programado não devia levar c:1');
  globalThis.render('Personalizado');
  check(ST.view === '__pers' && ST.day === diaReal, 'render("Personalizado") devia ir para o ecrã próprio sem mexer em ST.day');

  /* concluir */
  globalThis.cuFinish();
  check(ST.custom.stage === 'done' && ST.sessions.length === 1, 'concluir devia gravar uma sessão');
  check(ST.sessions[0].kind === 'custom' && ST.sessions[0].sets === 1 && ST.sessions[0].ex.length === 1, 'sessão gravada com dados errados (só os exercícios com séries marcadas)');
  check(ST.sessions[0].replaced === fila, 'a sessão devia registar o dia que substituiu');
  check(keysCustom().length === 0, 'concluir devia limpar as séries do personalizado');
  globalThis.cuFinish();
  check(ST.sessions.length === 1, 'concluir duas vezes não devia duplicar a sessão');
  check(JSON.stringify(ST.routine) === plano, 'o plano normal mudou depois do treino personalizado');
  /* o personalizado ocupou o lugar do dia: não o marca feito, não o desloca */
  check(S.dayStatus(fila) === 'swapped' && ST.sched.replaced[fila] === todayStr(), `${fila} devia ficar substituído`);
  check(!ST.sched.done[fila], 'o programado não pode ficar marcado como feito');
  check(S.currentDay() === prox, `a seguir devia vir ${prox}, veio ${S.currentDay()}`);
  check(S.agenda().pending === R.dayNames().filter(d => S.dayStatus(d) !== 'rest').length - 1, 'a semana devia ter menos um treino pendente');
  check(JSON.stringify(ST.sets['Segunda:0']) === '[0]', 'o progresso do plano normal foi tocado');
  ST.custom = { date: todayStr(), muscles: ['peito'], label: 'Peito', ex: [{ name: 'A', s: 3, r: '8' }], stage: 'active' };
  ST.sets[`${CD}:0`] = [0];
  globalThis.cuFinish();
  check(ST.sessions.length === 2 && S.currentDay() === prox && ST.sched.replaced[prox] === undefined, 'um 2.º personalizado no mesmo dia não pode ocupar outro lugar');
  ST.sessions = ST.sessions.slice(0, 1);
  ST.custom = { date: '2000-01-01', muscles: ['peito'], label: 'Peito', ex: [{ name: 'A', s: 3, r: '8' }], stage: 'active' };
  ST.sets[`${CD}:0`] = [0];
  const antes = JSON.stringify(ST.sched.replaced);
  globalThis.cuFinish();
  check(JSON.stringify(ST.sched.replaced) === antes && ST.sessions[1].replaced === null, 'um treino de outro dia não pode ocupar o lugar de hoje');
  ST.sessions = ST.sessions.slice(0, 1);
  S.reopenDay(fila);
  check(S.currentDay() === fila && S.dayStatus(fila) !== 'swapped', 'reabrir devia desfazer a substituição');
  const ant = JSON.stringify(ST.sched);
  ST.sched = JSON.parse(JSON.stringify({ ...JSON.parse(ant), week: '2000-W01', replaced: { [fila]: '2000-01-03' } }));
  check(S.ensureWeek() && Object.keys(ST.sched.replaced).length === 0, 'o reset semanal devia limpar as substituições');
  delete ST.sched.replaced;
  check(S.dayStatus(fila) === 'todo' && ST.sched.replaced && Object.keys(ST.sched.replaced).length === 0, 'backup antigo (sem replaced) devia normalizar-se');
  S.replaceCurrent();   /* repõe o estado do resto do teste (o reset semanal limpou as séries) */
  ST.sets['Segunda:0'] = [0]; ST.done['Segunda:0'] = false;

  /* abandonar antes de começar, e caducar no dia seguinte */
  globalThis.openCustom();
  check(!ST.custom, 'depois de concluído, abrir de novo devia dar um ecrã de escolha limpo');
  globalThis.cuToggle('costas');
  await globalThis.cuSuggest();
  check(ST.custom && ST.custom.ex.length === 5, 'costas devia dar 5 exercícios');
  globalThis.cuDiscard();
  check(ST.custom === null && keysCustom().length === 0 && ST.sessions.length === 1, 'cancelar devia largar tudo sem registar sessão');

  ST.custom = { date: '2000-01-01', muscles: ['peito'], label: 'Peito', ex: [{ name: 'A', s: 3, r: '8' }], stage: 'active' };
  ST.sets[`${CD}:0`] = [0];
  check(!C.isLive(), 'um treino de outro dia não devia estar ativo');
  globalThis.render('__pers');
  check(ST.custom === null && keysCustom().length === 0, 'o treino de ontem devia caducar e levar as séries');
  ST.custom = 'lixo';
  globalThis.render('__pers');
  check(ST.custom === null, 'estado inválido devia ser descartado sem rebentar');
  check(ST.sets['Segunda:0'] && JSON.stringify(ST.routine) === plano, 'caducar tocou no plano normal');

  ST.custom = null; ST.sets = {}; ST.done = {}; ST.log = {}; ST.sessions = []; ST.view = '__hoje';
  globalThis.render('__hoje');
} catch (e) {
  fail.push(`personalizado rebentou: ${e.stack || e.message}`);
}

/* ── 8. todos os handlers inline têm de existir no window (bridge.js) ────── */
const NOISE = new Set(['add', 'click', 'closest', 'getElementById', 'remove', 'replace',
  'setTimeout', 'stopPropagation', 'preventDefault', 'focus', 'blur', 'submit', 'load', 'forEach', 'play']);
const sources = [readFileSync(new URL('../index.html', import.meta.url), 'utf8'), ...files.map(read)];
const handlers = new Set();
for (const src of sources)
  for (const m of src.matchAll(/\bon(?:click|change|input|submit|error|keyup|keydown)\s*=\s*(["'])(.*?)\1/g))
    for (const c of m[2].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g))
      if (!NOISE.has(c[1])) handlers.add(c[1]);
for (const h of handlers)
  if (typeof globalThis[h] !== 'function') fail.push(`handler inline sem ponte em bridge.js: ${h}()`);

/* ── 9. cada import resolve para um export real ──────────────────────────── */
const exportsOf = {};
for (const f of files) {
  const m = read(f).match(/^export \{([\s\S]*?)\};$/m);   /* o bloco pode ocupar várias linhas */
  exportsOf[f] = new Set(m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []);
}
for (const f of files)
  for (const m of read(f).matchAll(/^import \{([\s\S]*?)\} from '\.\/(.+?)';$/gm))
    for (const name of m[1].split(',').map(s => s.trim()).filter(Boolean))
      if (!exportsOf[m[2]]?.has(name)) fail.push(`${f}: importa "${name}" que ${m[2]} não exporta`);

/* ── resultado ───────────────────────────────────────────────────────────── */
if (fail.length) { console.error('FALHOU:\n  ' + fail.join('\n  ')); process.exit(1); }
console.log(`OK — ${files.length} módulos, ${screens.length} ecrãs, ${handlers.size} handlers, catálogo com ${(await import(new URL('catalog.js', JS))).all().length} exercícios.`);
