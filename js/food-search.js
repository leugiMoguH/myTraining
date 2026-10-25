/* Pesquisa pura: todos os termos, estados distintos e ordem determinística. */
function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function searchFoods(list, query, {recentIds = [], limit = 30} = {}) {
  const terms = norm(query).split(' ').filter(Boolean);
  if (!terms.length) return recentIds.map(id => list.find(f => f.id === id)).filter(Boolean).slice(0, limit);
  return list.map(food => {
    const name = norm(food.name), synonyms = norm((food.syn || []).join(' '));
    const all = [name, synonyms, norm(food.state), norm(food.cat)].join(' ');
    if (!terms.every(t => all.includes(t))) return null;
    const score = terms.reduce((n,t) => n + (name.startsWith(t) ? 0 : name.split(' ').some(w => w.startsWith(t)) ? 1 : name.includes(t) ? 2 : synonyms.includes(t) ? 3 : 4), 0);
    return {food, score, length:name.length};
  }).filter(Boolean).sort((a,b) => a.score-b.score || a.length-b.length || a.food.name.localeCompare(b.food.name,'pt')).slice(0,limit).map(x => x.food);
}

export { norm, searchFoods };
