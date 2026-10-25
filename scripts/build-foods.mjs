// Gera data/foods-basic.json a partir do USDA FoodData Central (SR Legacy, domínio público).
// Uso: node scripts/build-foods.mjs   (FDC_API_KEY opcional; sem ela usa DEMO_KEY, limitada)
import { writeFileSync } from 'node:fs';

const KEY = process.env.FDC_API_KEY || 'DEMO_KEY';
const FOODS = [
  { id: 171477, name: 'Frango, peito sem pele, assado', state: 'cozinhado' },
  { id: 171986, name: 'Atum em água, escorrido', state: 'em conserva' },
  { id: 173424, name: 'Ovo inteiro, cozido', state: 'cozinhado' },
  { id: 168878, name: 'Arroz branco, cozido', state: 'cozinhado' },
  { id: 169737, name: 'Massa, cozida', state: 'cozinhado' },
  { id: 168483, name: 'Batata-doce, assada com pele', state: 'cozinhado' },
  { id: 173904, name: 'Aveia em flocos, seca', state: 'cru' },
];
// número do nutriente FDC → campo (kcal=208, proteína=203, gordura=204, hidratos por diferença=205, fibra=291, açúcares totais=269, sódio mg=307)
const NUM = { 208: 'kcal', 203: 'protein', 204: 'fat', 205: 'carbs', 291: 'fibre', 269: 'sugars', 307: 'sodiumMg' };

const url = `https://api.nal.usda.gov/fdc/v1/foods?api_key=${KEY}&format=full&fdcIds=${FOODS.map(f => f.id).join(',')}`;
const res = await fetch(url);
if (!res.ok) { console.error('FDC respondeu', res.status); process.exit(1); }
const rows = await res.json();

const isoDate = v => { const m = /^(\d+)\/(\d+)\/(\d{4})$/.exec(v || ''); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : (v || null); };
const out = FOODS.map(f => {
  const r = rows.find(x => x.fdcId === f.id);
  if (!r) throw new Error('fdcId em falta: ' + f.id);
  const n = { kcal: null, protein: null, carbs: null, fat: null, fibre: null, sugars: null, salt: null };
  let sodiumMg = null;
  for (const fn of r.foodNutrients || []) {
    const field = NUM[Number(fn.nutrient && fn.nutrient.number)];
    if (!field || typeof fn.amount !== 'number') continue;
    if (field === 'sodiumMg') sodiumMg = fn.amount; else n[field] = fn.amount;
  }
  if (sodiumMg != null) n.salt = Math.round(sodiumMg / 1000 * 2.5 * 100) / 100;
  return {
    id: 'fdc:' + f.id, source: 'usda-fdc', sourceId: String(f.id), version: isoDate(r.publicationDate || r.publishedDate),
    name: f.name, state: f.state, usdaName: r.description, ref: { amount: 100, unit: 'g' }, nutrients: n,
    notes: { carbs: 'por diferença (inclui fibra)', salt: 'calculado do sódio × 2,5' },
  };
});
writeFileSync(new URL('../data/foods-basic.json', import.meta.url), JSON.stringify({ source: 'USDA FoodData Central, SR Legacy', license: 'domínio público (CC0)', foods: out }, null, 1) + '\n');
console.log('escritos', out.length, 'alimentos');
