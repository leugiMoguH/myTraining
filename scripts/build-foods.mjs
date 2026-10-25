// Gera data/foods-pt.json a partir do USDA FoodData Central SR Legacy (domínio público) e de scripts/foods-curation.json.
// Uso: node scripts/build-foods.mjs <FoodData_Central_sr_legacy_food_json_2018-04.json> [--check]
// Descarregar o zip em https://fdc.nal.usda.gov/download-datasets (SR Legacy, JSON). Sem API nem chave.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
const check = process.argv.includes('--check');
if (!src) { console.error('indica o JSON do SR Legacy'); process.exit(1); }
const all = JSON.parse(readFileSync(src, 'utf8')).SRLegacyFoods;
const curation = JSON.parse(readFileSync(new URL('./foods-curation.json', import.meta.url), 'utf8'));

// número do nutriente FDC → campo
const NUM = { 208: 'kcal', 203: 'protein', 204: 'fat', 205: 'carbs', 291: 'fibre', 269: 'sugars', 307: 'sodiumMg' };
const isoDate = v => { const m = /^(\d+)\/(\d+)\/(\d{4})$/.exec(v || ''); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : (v || null); };
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// porções reais do USDA com rótulo PT; só as que têm tradução inequívoca
const PORTION_RULES = [
  [/^medium\b/i, 'unidade média'], [/^large\b/i, 'unidade grande'], [/^small\b/i, 'unidade pequena'],
  [/^slice\b/i, 'fatia'], [/^tbsp\b/i, 'colher de sopa'], [/^tsp\b/i, 'colher de chá'],
  [/^fillet\b/i, 'filete'], [/^piece\b/i, 'peça'], [/^cup$/i, 'chávena'], [/^cup \(\d/i, null],
];
function portionsOf(food, cat) {
  const out = [], seen = new Set();
  for (const [re, label] of PORTION_RULES) {
    if (!label || (/^(colher|chávena)/.test(label) && /^(Ovos|Carne|Peixe)$/.test(cat))) continue;
    for (const p of food.foodPortions || []) {
      const mod = String(p.modifier || '').trim(), g = p.gramWeight;
      if (!re.test(mod) || !(g > 0) || (p.amount && p.amount !== 1) || seen.has(label)) continue;
      seen.add(label); out.push({ label, g: round(g, 1) });
    }
  }
  return out.slice(0, 4);
}

const foods = [], problems = [];
for (const c of curation) {
  const re = new RegExp(c.d);
  const hits = all.filter(f => re.test(f.description));
  if (hits.length !== 1) { problems.push(`${c.pt} (${c.state}): ${hits.length} correspondências para ${c.d}${hits.length > 1 ? ' → ' + hits.slice(0, 4).map(h => h.fdcId + ' ' + h.description.slice(0, 60)).join(' | ') : ''}`); continue; }
  const r = hits[0], n = { kcal: null, protein: null, carbs: null, fat: null, fibre: null, sugars: null, salt: null };
  let sodiumMg = null;
  for (const fn of r.foodNutrients || []) {
    const field = NUM[Number(fn.nutrient && fn.nutrient.number)];
    if (!field || typeof fn.amount !== 'number') continue;
    if (field === 'sodiumMg') sodiumMg = fn.amount; else n[field] = round(fn.amount);
  }
  if (sodiumMg != null) n.salt = round(sodiumMg / 1000 * 2.5);
  if (check) console.log(`${c.pt} · ${c.state} ← ${r.fdcId} ${r.description.slice(0, 70)}  [${n.kcal}kcal ${n.protein}p]`);
  foods.push({
    id: 'fdc:' + r.fdcId, source: 'usda-fdc', sourceId: String(r.fdcId), version: isoDate(r.publicationDate),
    name: c.pt, state: c.state, cat: c.cat, syn: c.syn || [], aprox: c.aprox || null, usdaName: r.description,
    ref: { amount: 100, unit: 'g' }, nutrients: n, portions: portionsOf(r, c.cat),
  });
}
if (problems.length) { console.error('PROBLEMAS:\n' + problems.join('\n')); process.exit(1); }
if (!check) {
  writeFileSync(new URL('../data/foods-pt.json', import.meta.url), JSON.stringify({
    source: 'USDA FoodData Central, SR Legacy (abril 2018, publicado 2019-04-01)', license: 'domínio público (CC0)',
    notes: { carbs: 'por diferença (inclui fibra)', salt: 'calculado do sódio × 2,5', names: 'Nomes em português escolhidos manualmente; «aprox» assinala aproximações.' },
    foods,
  }) + '\n');
}
console.log(`${foods.length} alimentos${check ? ' (verificação)' : ' escritos'}`);
