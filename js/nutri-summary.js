import { NUTRIENTS, sumEntries } from './foods.js';

/* Totais dos registos, nunca uma afirmação de que o dia está completo.
   position/margin só existem com total conhecido e referência aplicável.
   A fibra é uma referência de ingestão adequada, não um teto. */
function daySummary(entries, refs = {}) {
  const totals = sumEntries(entries);
  return Object.fromEntries(NUTRIENTS.map(key => {
    const total = totals[key], missing = totals.missing[key];
    const state = !entries.length ? 'vazio' : total === null ? 'desconhecido' : missing ? 'parcial' : 'conhecido';
    const result = {total, missing, complete:state === 'conhecido', state,
      text:state === 'vazio' ? 'Sem registos' : state === 'desconhecido' ? 'Sem dado nos registos'
        : state === 'parcial' ? `total parcial (+ ${missing} sem dado)` : 'total dos registos'};
    const ref = refs?.[key === 'kcal' ? 'energy' : key];
    if (state !== 'conhecido' || !refs?.applicable || !ref || key === 'sugars') return [key,result];
    const valid = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
    if (['protein','carbs','fat'].includes(key) && Array.isArray(ref.range) && ref.range.length === 2 && ref.range.every(valid) && ref.range[0] <= ref.range[1]) {
      result.position = total < ref.range[0] ? 'abaixo' : total > ref.range[1] ? 'acima' : 'dentro';
      result.referenceText = {abaixo:'Abaixo do intervalo', dentro:'Dentro do intervalo', acima:'Acima do intervalo'}[result.position];
    } else if (valid(ref.value)) {
      if (key === 'fibre') {
        result.referenceText = `Valor registado · referência ${ref.value} g`;
      } else if (key === 'kcal' || key === 'salt') {
        result.position = total < ref.value ? 'abaixo' : total > ref.value ? 'acima' : 'dentro';
        result.margin = ref.value-total;
        result.referenceText = key === 'salt' ? (total > ref.value ? 'Ultrapassa a referência de sal' : 'Não ultrapassa a referência de sal')
          : total > ref.value ? 'Acima da referência estimada' : 'Até à referência estimada';
      }
    }
    return [key,result];
  }));
}

export { daySummary };
