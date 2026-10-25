/* Modelo puro: null significa dado desconhecido, incluindo nos registos legados. */
const NUTRIENTS = ['kcal','protein','carbs','fat','fibre','sugars','salt'];
function nutrient(value) {
  if (!['number','string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null;
}
function scaleFood(food, amount) {
  const g = nutrient(amount), base = nutrient(food?.ref?.amount);
  return Object.fromEntries(NUTRIENTS.map(k => { const n = nutrient(food?.nutrients?.[k]); return [k, n === null || g === null || !base ? null : n*g/base]; }));
}
function entryNutrients(entry) {
  return Object.fromEntries(NUTRIENTS.map(k => [k,nutrient(k === 'kcal' || k === 'protein' ? entry[k] : entry.n?.[k])]));
}
function sumEntries(list) {
  const totals = {}, missing = {};
  for (const k of NUTRIENTS) {
    const values = list.map(x => entryNutrients(x)[k]);
    missing[k] = values.filter(x => x === null).length;
    const known = values.filter(x => x !== null);
    totals[k] = known.length ? known.reduce((a,b) => a+b,0) : null;
  }
  return {...totals, missing};
}
function parseOff(json) {
  if (json?.status !== 1 || !json.product) return null;
  const p = json.product, n = p.nutriments || {}, nutrients = {};
  const fields = ['energy-kcal','proteins','carbohydrates','fat','fiber','sugars','salt'];
  NUTRIENTS.forEach((k,i) => { nutrients[k] = nutrient(n[fields[i]+'_100g']); });
  let note = '';
  if (nutrients.salt === null) {
    let sodium = nutrient(n.sodium_100g);
    if (sodium !== null) {
      if (n.sodium_unit === 'mg') sodium /= 1000;
      nutrients.salt = sodium*2.5; note = 'Sal calculado do sódio.';
    }
  }
  const unit = p.product_quantity_unit === 'ml' || p.nutrition_data_per === '100ml' ? 'ml' : 'g';
  return {id:'off:'+ (p.code || json.code || ''),source:'off',sourceId:String(p.code || json.code || ''),version:p.last_modified_t ?? null,name:p.product_name || p.generic_name || 'Produto',state:'',ref:{amount:100,unit},nutrients,notes:note};
}

export { NUTRIENTS, nutrient, scaleFood, entryNutrients, sumEntries, parseOff };
