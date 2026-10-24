/* Prova de viabilidade Strava (SÓ local, não envia nada): mapeamento verificável + exportação JSON de exemplo + validador.
   node scripts/strava-prova.mjs  → escreve docs/strava-exemplo.json e docs/strava-mapeamento.md */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = new Set(readFileSync(root + 'docs/strava-exercise-types.txt', 'utf8').split('\n').filter(Boolean));   /* lista oficial copiada de developers.strava.com/docs/uploads (24-10-2026) */
const catalog = JSON.parse(readFileSync(root + 'data/catalog.json', 'utf8')).ex;

/* nivel: exato = o mesmo movimento e equipamento · aprox = movimento igual, variante/equipamento pode diferir (perde detalhe)
          generico = só a família (tipo *_GENERIC) · nenhum = sem tipo seguro (não vai para o JSON de séries) */
const E = 'exato', A = 'aprox', G = 'generico', N = 'nenhum';
const MAP = [
  /* POOL do planeador (PT) */
  ['Leg press', 'MACHINE_LEG_PRESS', E], ['Agachamento goblet', 'GOBLET_SQUAT', E], ['Agachamento corporal', 'AIR_SQUAT', E],
  ['Passada', 'LUNGE_GENERIC', G], ['Cadeira extensora', 'MACHINE_LEG_EXTENSION', E], ['Mesa flexora', 'LEG_CURL_GENERIC', G],
  ['Stiff', 'STRAIGHT_LEG_DEADLIFT', A], ['Ponte de glúteos', 'GLUTE_BRIDGE', E], ['Supino na máquina', 'MACHINE_CHEST_PRESS', E],
  ['Supino com halteres', 'DUMBBELL_BENCH_PRESS', E], ['Flexões inclinadas', 'INCLINE_PUSH_UP', E], ['Flexões', 'PUSH_UP_GENERIC', G],
  ['Desenvolvimento na máquina', 'MACHINE_SEATED_SHOULDER_PRESS', E], ['Desenvolvimento', 'SEATED_DUMBBELL_SHOULDER_PRESS', A],
  ['Puxada alta', 'LAT_PULLDOWN', E], ['Remada sentado', 'SEATED_CABLE_ROW', A], ['Remada unilateral', 'DUMBBELL_ROW', A],
  ['Remada invertida', 'INVERTED_ROW', E], ['Superman', 'SUPERMAN_FROM_FLOOR', E], ['Prancha', 'PLANK_GENERIC', G],
  ['Abdominal', 'CORE_GENERIC', G], ['Panturrilha', 'CALF_RAISE_GENERIC', G], ['Elevação lateral', 'LATERAL_RAISE_GENERIC', G],
  ['Tríceps corda', 'CABLE_TRICEPS_PUSHDOWN', A], ['Rosca alternada', 'STANDING_DUMBBELL_BICEPS_CURL', A],
  /* plano original (data.js) que o POOL não cobre */
  ['Arnold press', 'ARNOLD_PRESS', E], ['Supino inclinado', 'INCLINE_BARBELL_BENCH_PRESS', A], ['Supino reto', 'BARBELL_BENCH_PRESS', A], ['Supino', 'BENCH_PRESS_GENERIC', G],
  ['Crucifixo', 'FLYE_GENERIC', G], ['Tríceps francês', 'OVERHEAD_DUMBBELL_TRICEPS_EXTENSION', A], ['Puxada frente', 'LAT_PULLDOWN', E],
  ['Remada', 'ROW_GENERIC', G], ['Rosca martelo', 'DUMBBELL_HAMMER_CURL', E], ['Rosca polia', 'CABLE_BICEPS_CURL', E], ['Agachamento', 'BARBELL_BACK_SQUAT', A],
  ['Puxada alta (original)', 'LAT_PULLDOWN', E], ['Braços', null, N], ['Caminhada', null, N], ['Cardio final', 'CARDIO_GENERIC', G],
  /* amostra do catálogo (nomes EN do dataset) */
  ['barbell bench press', 'BARBELL_BENCH_PRESS', E], ['dumbbell incline bench press', 'INCLINE_DUMBBELL_BENCH_PRESS', E], ['barbell full squat', 'BARBELL_BACK_SQUAT', A],
  ['barbell deadlift', 'BARBELL_DEADLIFT', E], ['cable seated row', 'SEATED_CABLE_ROW', E], ['dumbbell biceps curl', 'STANDING_DUMBBELL_BICEPS_CURL', A],
  ['barbell curl', 'BARBELL_BICEPS_CURL', E], ['push-up', 'PUSH_UP_GENERIC', G], ['pull-up', 'PULL_UP_GENERIC', G], ['barbell lunge', 'BARBELL_LUNGE', E],
  ['dumbbell lunge', 'LUNGE_GENERIC', G], ['lever leg extension', 'MACHINE_LEG_EXTENSION', E], ['lever seated leg curl', 'MACHINE_LEG_CURL_SEATED', E],
  ['cable pushdown', 'CABLE_TRICEPS_PUSHDOWN', E], ['dumbbell fly', 'DUMBBELL_FLYE', E], ['smith squat', 'SMITH_MACHINE_SQUAT', E],
  ['cable lateral raise', 'CABLE_LATERAL_RAISE', E], ['dumbbell lateral raise', 'LATERAL_RAISE_GENERIC', G], ['kettlebell swing', 'KETTLEBELL_SWING', E],
  ['russian twist', 'RUSSIAN_TWIST', E], ['mountain climber', 'MOUNTAIN_CLIMBER', E], ['burpee', 'BURPEE', E], ['jump rope', 'JUMP_ROPE', E],
];
const mapByName = new Map(MAP.map(([n, t, nivel]) => [n, { tipo: t, nivel }]));

/* 1. todos os tipos usados existem na lista oficial; nenhum nível «nenhum» tem tipo; nomes do catálogo existem mesmo */
for (const [n, t, nivel] of MAP) {
  assert.equal(nivel === N, t === null, `${n}: nível e tipo incoerentes`);
  if (t) assert(TYPES.has(t), `${n}: tipo inexistente na lista oficial: ${t}`);
}
const catNames = new Set(catalog.map(x => x.n));
const fromCatalog = MAP.filter(([n]) => /^[a-z]/.test(n));
for (const [n] of fromCatalog) assert(catNames.has(n), `catálogo não tem «${n}»`);
const count = lvl => MAP.filter(m => m[2] === lvl).length;

/* 2. conversão: sessão myTraining (só séries FEITAS) → JSON Strava */
const iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');
export function paraStrava(sessao, hr) {
  const sets = [];
  const avisos = [];
  for (const ex of sessao.exercicios) {
    const m = mapByName.get(ex.nome);
    if (!m || !m.tipo) { avisos.push(`sem correspondência segura: ${ex.nome} (${ex.series.length} séries ficam de fora)`); continue; }
    if (m.nivel === G) avisos.push(`tipo genérico: ${ex.nome} → ${m.tipo}`);
    if (m.nivel === A) avisos.push(`aproximado: ${ex.nome} → ${m.tipo}`);
    for (const s of ex.series.filter(x => x.done !== false)) {   /* só séries efetivamente concluídas */
      const o = { exercise_type: m.tipo, start_time: iso(s.ts) };
      if (s.dur) { o.duration = s.dur; if (s.r || s.w) avisos.push(`${ex.nome}: com duração, reps e carga não são enviadas`); } else { o.repetitions = s.r; if (s.w > 0) o.weight = s.w; }
      sets.push(o);
    }
  }
  const t0 = sessao.inicio, dur = Math.round((sessao.fim - t0) / 1000);
  const hrOk = hr.filter((h, i) => i === 0 || Math.round((h.ts - t0) / 1000) > Math.round((hr[i - 1].ts - t0) / 1000));
  const tempo = hrOk.map(h => Math.round((h.ts - t0) / 1000));
  return { avisos, json: {
    version: '1.0', start_time: iso(t0), utc_offset: sessao.utcOffset, elapsed_time: dur, active_time: sessao.activa,
    creator: { name: 'myTraining' },
    ...(hr.length ? { streams: { time: tempo, heartrate: hrOk.map(h => h.bpm) } } : {}),
    sets,
  } };
}

/* 3. validador local das regras da documentação oficial (versão, horas ISO com fuso, streams do mesmo tamanho, tipos válidos...) */
export function validar(j) {
  const erros = [];
  const isoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  if (j.version !== '1.0') erros.push('version deve ser "1.0"');
  if (!isoTz.test(j.start_time || '') || Number.isNaN(Date.parse(j.start_time))) erros.push('start_time ISO 8601 real com Z/offset');
  if (!Number.isInteger(j.utc_offset)) erros.push('utc_offset inteiro (segundos)');
  if (!Number.isInteger(j.elapsed_time) || j.elapsed_time <= 0) erros.push('elapsed_time inteiro > 0');
  if (j.active_time != null && (!Number.isInteger(j.active_time) || j.active_time < 0 || j.active_time > j.elapsed_time)) erros.push('active_time inteiro ≤ elapsed_time');
  if (!Array.isArray(j.sets) || !j.sets.length) erros.push('sets: pelo menos 1');
  const t0 = Date.parse(j.start_time), t1 = t0 + j.elapsed_time * 1000;
  (j.sets || []).forEach((s, i) => {
    if (!TYPES.has(s.exercise_type)) erros.push(`sets[${i}] tipo inválido ${s.exercise_type}`);
    if (s.repetitions != null && !(Number.isInteger(s.repetitions) && s.repetitions > 0)) erros.push(`sets[${i}] repetitions inteiro > 0`);
    if (s.weight != null && !(typeof s.weight === 'number' && s.weight > 0)) erros.push(`sets[${i}] weight (kg) número > 0`);
    if (s.duration != null && !(Number.isInteger(s.duration) && s.duration > 0)) erros.push(`sets[${i}] duration inteiro > 0`);
    if (s.repetitions == null && s.duration == null) erros.push(`sets[${i}] sem repetitions nem duration`);
    if (s.start_time != null) { const t = Date.parse(s.start_time); if (!isoTz.test(s.start_time) || Number.isNaN(t)) erros.push(`sets[${i}] start_time inválido`); else if (t < t0 || t + (s.duration || 0) * 1000 > t1) erros.push(`sets[${i}] fora da sessão (início ou fim)`); }
  });
  const st = j.streams;
  if (st && !Array.isArray(st.time)) erros.push('streams.time obrigatório');
  else if (st) {
    if (!Array.isArray(st.time) || !st.time.every(Number.isInteger)) erros.push('streams.time inteiros');
    for (const k of ['active', 'heartrate']) if (st[k] && st[k].length !== st.time.length) erros.push(`streams.${k} com tamanho ≠ time`);
    if (st.active && !st.active.every(v => typeof v === 'boolean')) erros.push('streams.active booleanos');
    if (st.time.some((v, i) => i && v <= st.time[i - 1])) erros.push('streams.time não crescente');
    if (st.time.some(v => v < 0 || v > j.elapsed_time)) erros.push('streams.time fora da sessão');
    if ((st.heartrate || []).some(v => !Number.isInteger(v) || v < 30 || v > 230)) erros.push('heartrate implausível');
  }
  return erros;
}

/* dados FICTÍCIOS: 2 séries do supino ficaram por fazer (não vão no JSON), a 3.ª de remada falhou */
const T0 = Date.parse('2026-10-26T18:30:00Z');   /* Lisboa já está em UTC+0 a 26-10-2026 (fim da hora de verão a 25-10) */
let t = T0 + 90e3;
const serie = (w, r, extra = {}) => { const o = { w, r, ts: t, ...extra }; t += 150e3; return o; };
const sessao = {
  inicio: T0, fim: T0 + 52 * 60e3, utcOffset: 0, activa: 41 * 60,
  exercicios: [
    { nome: 'Supino com halteres', series: [serie(22, 10), serie(24, 8), serie(24, 7)] },         /* planeado 4×8-10; fez 3 */
    { nome: 'Puxada alta', series: [serie(50, 10), serie(55, 8), serie(55, 8)] },
    { nome: 'Remada unilateral', series: [serie(20, 10), serie(20, 10)] },
    { nome: 'Prancha', series: [serie(0, 0, { dur: 45 }), serie(0, 0, { dur: 40 })] },
    { nome: 'Braços', series: [serie(10, 12)] },                                                   /* superset sem correspondência */
  ],
};
const hr = Array.from({ length: 27 }, (_, i) => ({ ts: T0 + i * 120e3, bpm: 78 + Math.round(40 * Math.sin(i / 4) ** 2) + (i % 3) }));
const { json, avisos } = paraStrava(sessao, hr);
const erros = validar(json);
assert.deepEqual(erros, [], erros.join('\n'));
assert.equal(json.sets.length, 10, 'só séries feitas e mapeáveis');
assert(!json.sets.some(s => s.exercise_type === undefined));
/* o validador tem de apanhar erros reais */
assert(validar({ ...json, version: '2' }).length && validar({ ...json, sets: [{ exercise_type: 'SUPINO', repetitions: 5 }] }).length
  && validar({ ...json, streams: { time: [0, 60], heartrate: [80] } }).length && validar({ ...json, start_time: '2026-10-26T18:30:00' }).length
  && validar({ ...json, start_time: '2026-13-45T18:30:00Z' }).length && validar({ ...json, active_time: -1 }).length
  && validar({ ...json, streams: { time: [0, 60], active: [42, true] } }).length && validar({ ...json, streams: { heartrate: [80] } }).length
  && validar({ ...json, sets: [{ exercise_type: 'PLANK_GENERIC', duration: 99999, start_time: json.start_time }] }).length);
writeFileSync(root + 'docs/strava-exemplo.json', JSON.stringify(json, null, 2) + '\n');

const linhas = ['# Mapeamento myTraining → Strava (amostra verificada)', '',
  `Gerado por \`scripts/strava-prova.mjs\`. Cada tipo foi verificado contra a lista oficial (${TYPES.size} tipos, \`docs/strava-exercise-types.txt\`). **${MAP.length}** exercícios: **${count(E)}** exatos · **${count(A)}** aproximados (perde detalhe) · **${count(G)}** só tipo genérico · **${count(N)}** sem correspondência segura.`, '',
  '| Exercício | Tipo Strava | Nível |', '|---|---|---|', ...MAP.map(([n, tp, l]) => `| ${n} | ${tp || '—'} | ${l} |`), '',
  'Avisos do exemplo: ' + (avisos.join('; ') || 'nenhum')];
writeFileSync(root + 'docs/strava-mapeamento.md', linhas.join('\n') + '\n');
console.log(`OK — ${MAP.length} mapeamentos (${count(E)} exatos, ${count(A)} aprox., ${count(G)} genéricos, ${count(N)} nenhum); JSON de exemplo válido com ${json.sets.length} séries.`);
console.log('Avisos:', avisos);
