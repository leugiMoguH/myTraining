/* Sugestão do treino personalizado — lógica pura, sem DOM nem estado.

   Um "grupo" é o que o utilizador escolhe (Peito, Costas…). Cada um agrega ids do
   bodySVG (js/charts.js), que é a língua comum entre os exercícios do plano
   (MUSCLES / `mus`) e os do catálogo (muscleIdsOf). Um exercício com vários
   músculos primários (ex.: Agachamento = quadríceps + glúteos) pertence a todos
   os grupos que os contenham, mas só é escolhido uma vez.

   O pool é uma lista de { key, ids, known, sec, equip, entry }:
     known  2 = já está na rotina · 1 = tem histórico de cargas · 0 = só catálogo
     sec    nº de músculos secundários (mais = mais composto)
   A ordem é determinística: o mesmo pool e a mesma escolha dão sempre o mesmo treino. */

const GROUPS = [
  { id: 'peito',      label: 'Peito',         ids: ['peito'] },
  { id: 'costas',     label: 'Costas',        ids: ['dorsais', 'trapezio', 'lombar'] },
  { id: 'ombros',     label: 'Ombros',        ids: ['ombro', 'posterior'] },
  { id: 'biceps',     label: 'Bíceps',        ids: ['biceps'] },
  { id: 'triceps',    label: 'Tríceps',       ids: ['triceps'] },
  { id: 'quadriceps', label: 'Quadríceps',    ids: ['quadriceps'] },
  { id: 'isquios',    label: 'Isquiotibiais', ids: ['isquios'] },
  { id: 'gluteos',    label: 'Glúteos',       ids: ['gluteos'] },
  { id: 'gemeos',     label: 'Gémeos',        ids: ['gemeos'] },
  { id: 'core',       label: 'Core',          ids: ['abdominal', 'oblique'] },
];

/* Não há preferência de equipamento guardada na app: assume-se um ginásio comum.
   A ordem é também a preferência (carga livre e máquinas antes do peso do corpo, que
   no catálogo é onde moram os alongamentos e os movimentos exóticos). */
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'leverage machine', 'smith machine', 'ez barbell', 'body weight'];

/* Quantos exercícios por grupo: poucos grupos = mais volume em cada um. */
function perGroup(n) { return n <= 1 ? 5 : n === 2 ? 3 : n <= 4 ? 2 : 1; }

const groupById = id => GROUPS.find(g => g.id === id) || null;
const keyOf = name => String(name == null ? '' : name).trim().toLowerCase();
const equipRank = e => { const i = EQUIPMENT.indexOf(e); return i < 0 ? EQUIPMENT.length : i; };

function rank(a, b) {
  return (b.known - a.known) || (equipRank(a.equip) - equipRank(b.equip)) || (b.sec - a.sec) || a.key.localeCompare(b.key);
}

/* Devolve as entradas de rotina sugeridas. Ids de grupo desconhecidos ou repetidos
   são ignorados; sem candidatos para um grupo, esse grupo fica sem exercícios. */
function suggest(groupIds, pool) {
  const wanted = GROUPS.filter(g => (groupIds || []).includes(g.id));
  const per = perGroup(wanted.length);
  const taken = new Set();
  const out = [];
  for (const g of wanted) {
    const mine = pool
      .filter(c => !taken.has(c.key) && c.ids.some(id => g.ids.includes(id)))
      .sort(rank)
      .slice(0, per);
    for (const c of mine) { taken.add(c.key); out.push(c.entry); }
  }
  return out;
}

/* Dias desde o último treino de cada grupo, a partir do histórico de cargas.
   `idsOf(nome)` devolve os músculos primários de um exercício (ou []).
   Só é uma dica para o ecrã — não altera a sugestão. */
function recency(log, idsOf, today) {
  const t = Date.parse(`${today}T00:00:00`);
  const out = {};
  for (const name of Object.keys(log || {})) {
    const ids = idsOf(name);
    if (!ids.length) continue;
    for (const e of log[name] || []) {
      const days = Math.round((t - Date.parse(`${e.date}T00:00:00`)) / 86400000);
      if (!(days >= 0)) continue;
      for (const g of GROUPS) if (ids.some(id => g.ids.includes(id))) out[g.id] = Math.min(out[g.id] ?? days, days);
    }
  }
  return out;
}

export { GROUPS, EQUIPMENT, perGroup, groupById, keyOf, suggest, recency };
