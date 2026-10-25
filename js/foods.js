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


/* Validadores puros, sem mutação. Campos de estado ausentes são legados. */
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const nonnegative = v => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0;
const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const MEALS = ['pa','alm','jan','lan'];
function civilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value+'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}
function mealOf(entry) { return MEALS.includes(entry?.meal) ? entry.meal : null; }
function intakeForDate(list, date) { return list.filter(entry => entry.date === date); }
function validateIntakeList(list) {
  if (list === undefined) return {ok:true};
  if (!Array.isArray(list)) return {ok:false, reason:'Diário alimentar: esperada uma lista.'};
  const ids = new Set();
  for (const e of list) {
    if (!object(e) || typeof e.id !== 'string' || !e.id || ids.has(e.id) || !civilDate(e.date) || typeof e.name !== 'string' ||
        !['kcal','protein'].every(k => e[k] === undefined || nonnegative(e[k])) ||
        (e.n !== undefined && (!object(e.n) || Object.values(e.n).some(v => !nonnegative(v)))) ||
        (e.g !== undefined && !positive(e.g)) || (e.unit !== undefined && !['g','ml'].includes(e.unit)) ||
        (e.meal !== undefined && !MEALS.includes(e.meal)) ||
        ['ts','fid','src','note'].some(k => e[k] !== undefined && typeof e[k] !== 'string') ||
        (e.sid !== undefined && e.sid !== null && typeof e.sid !== 'string' && !(typeof e.sid === 'number' && Number.isFinite(e.sid))) ||
        (e.ver !== undefined && e.ver !== null && typeof e.ver !== 'string' && !(typeof e.ver === 'number' && Number.isFinite(e.ver))))
      return {ok:false, reason:'Diário alimentar: registo inválido ou id repetido.'};
    ids.add(e.id);
  }
  return {ok:true};
}
function validateCustomFoods(list) {
  if (list === undefined) return {ok:true};
  if (!Array.isArray(list)) return {ok:false, reason:'Alimentos pessoais: esperada uma lista.'};
  const ids = new Set();
  for (const f of list) {
    if (!object(f) || typeof f.id !== 'string' || !/^c[^\s:]+$/.test(f.id) || ids.has(f.id) ||
        typeof f.name !== 'string' || !f.name.trim() || !object(f.ref) || f.ref.amount !== 100 || !['g','ml'].includes(f.ref.unit) ||
        !object(f.nutrients) || Object.keys(f.nutrients).length !== NUTRIENTS.length || !NUTRIENTS.every(k => nonnegative(f.nutrients[k])) ||
        typeof f.createdTs !== 'string' || !Number.isFinite(Date.parse(f.createdTs)))
      return {ok:false, reason:'Alimentos pessoais: definição inválida ou id repetido.'};
    ids.add(f.id);
  }
  return {ok:true};
}
function validateFoodRecent(list) {
  return list === undefined || Array.isArray(list) && list.length <= 12 && new Set(list).size === list.length &&
    list.every(id => typeof id === 'string' && /^(fdc:\d+|c:c[^\s:]+|off:\d+)$/.test(id))
    ? {ok:true} : {ok:false, reason:'Alimentos recentes: lista inválida (máximo 12 ids únicos).'};
}
function recentFoods(ids, catalogue, custom) {
  const definitions = new Map([...catalogue.map(f => [f.id,f]), ...custom.map(f => ['c:'+f.id,f])]);
  return ids.map(id => definitions.get(id)).filter(Boolean);
}
/* newG: número na unidade original ou {g,unit}; unidade diferente/legado lança RangeError. */
function rescaleEntry(entry, newG) {
  const amount = object(newG) ? newG.g : newG;
  const unit = object(newG) ? newG.unit : entry.unit;
  if (!positive(entry.g) || !positive(amount) || !['g','ml'].includes(entry.unit) || unit !== entry.unit)
    throw new RangeError('Quantidade inválida ou unidade diferente; não é possível reescalar.');
  const ratio = amount/entry.g;
  const scale = v => v == null ? v : v*ratio;
  const next = {...entry, g:amount};
  for (const k of ['kcal','protein']) if (Object.hasOwn(entry,k)) next[k] = scale(entry[k]);
  if (entry.n) next.n = Object.fromEntries(Object.entries(entry.n).map(([k,v]) => [k,scale(v)]));
  if ([next.kcal,next.protein,...Object.values(next.n || {})].some(v => v != null && !nonnegative(v)))
    throw new RangeError('A quantidade produz valores fora do intervalo válido.');
  return next;
}
export { NUTRIENTS, nutrient, scaleFood, entryNutrients, sumEntries, parseOff, civilDate, mealOf, intakeForDate, validateIntakeList, validateCustomFoods, validateFoodRecent, recentFoods, rescaleEntry };
