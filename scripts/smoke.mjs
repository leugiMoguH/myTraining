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
const { DAYS } = await import(new URL('data.js', JS));
const screens = [...Object.keys(DAYS), '__perfil', '__nutri'];
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

  await cat.loadInstructions();
  if (cat.instructionOf(ex.id).length < 20) fail.push(`sem instruções EN para ${ex.id}`);

  const semMusculo = cat.all().filter(e => !cat.muscleIdsOf(e).p.length);
  if (semMusculo.some(e => e.t !== 'cardiovascular system'))
    fail.push('há exercícios não-cardio sem músculo primário no bodySVG');
} catch (e) {
  fail.push(`catálogo rebentou: ${e.message}`);
}

/* ── 5. todos os handlers inline têm de existir no window (bridge.js) ────── */
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

/* ── 6. cada import resolve para um export real ──────────────────────────── */
const exportsOf = {};
for (const f of files) {
  const m = read(f).match(/^export \{ (.+) \};$/m);
  exportsOf[f] = new Set(m ? m[1].split(',').map(s => s.trim()) : []);
}
for (const f of files)
  for (const m of read(f).matchAll(/^import \{ (.+?) \} from '\.\/(.+?)';$/gm))
    for (const name of m[1].split(',').map(s => s.trim()))
      if (!exportsOf[m[2]]?.has(name)) fail.push(`${f}: importa "${name}" que ${m[2]} não exporta`);

/* ── resultado ───────────────────────────────────────────────────────────── */
if (fail.length) { console.error('FALHOU:\n  ' + fail.join('\n  ')); process.exit(1); }
console.log(`OK — ${files.length} módulos, ${screens.length} ecrãs, ${handlers.size} handlers, catálogo com ${(await import(new URL('catalog.js', JS))).all().length} exercícios.`);
