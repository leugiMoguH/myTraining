/* myTraining — motor de propostas de plano. PURO: sem ST, sem DOM, sem aleatoriedade.
   Mesmas respostas → mesmo plano, por isso é testável e explicável.

   Poucos modelos, regras claras:
     · corpo inteiro (2–3 dias): A / B / C, cada sessão toca os padrões principais
     · superior/inferior (4–5 dias): Superior A, Inferior A, Superior B, Inferior B (+ corpo inteiro)
   A cada sessão: padrões de movimento por prioridade, cortados ao tempo disponível.
   Cada exercício leva `pat` (padrão de movimento): é o que a troca por equivalência vai usar. */

const WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const GOALS = ['forma', 'forca', 'gordura', 'saude', 'rotina'];
const EXPS = ['inicio', 'regresso', 'regular'];
const PLACES = ['gym', 'casa', 'ambos'];
const EQUIPS = ['maq', 'livres', 'corpo'];
const LIMITS = ['joelhos', 'costas', 'ombros'];
const MINS = [30, 45, 60];

/* eq: onde se faz · avoid: limitações que o desaconselham · pat: padrão de movimento */
const POOL = [
  { name: 'Leg press', pat: 'squat', eq: 'maq', avoid: ['joelhos'], tip: 'Pés à largura dos ombros. Não bloqueies os joelhos.', alt: 'Agachamento goblet' },
  { name: 'Agachamento goblet', pat: 'squat', eq: 'livres', avoid: ['joelhos'], tip: 'Haltere junto ao peito, costas direitas, desce até onde conseguires com controlo.', alt: 'Leg press' },
  { name: 'Agachamento corporal', pat: 'squat', eq: 'corpo', avoid: ['joelhos'], tip: 'Pés à largura dos ombros, anca para trás, joelhos na direção dos pés.', alt: 'Ponte de glúteos' },
  { name: 'Passada', pat: 'lunge', eq: 'livres', avoid: ['joelhos'], tip: 'Passo à frente, joelho de trás quase no chão, tronco direito.', alt: 'Agachamento goblet' },
  { name: 'Cadeira extensora', pat: 'quad', eq: 'maq', avoid: ['joelhos'], tip: 'Extensão completa. Pausa de 1 s no topo.', alt: 'Passada' },
  { name: 'Mesa flexora', pat: 'hinge', eq: 'maq', avoid: [], tip: 'Contrai os isquiotibiais no topo. Desce de forma controlada.', alt: 'Ponte de glúteos' },
  { name: 'Stiff', pat: 'hinge', eq: 'livres', avoid: ['costas'], tip: 'Costas direitas, empurra a anca para trás, halteres rente às pernas.', alt: 'Mesa flexora' },
  { name: 'Ponte de glúteos', pat: 'hinge', eq: 'corpo', avoid: [], tip: 'Deitado, pés no chão, sobe a anca e aperta os glúteos 1 s no topo.', alt: 'Mesa flexora' },
  { name: 'Supino na máquina', pat: 'push-h', eq: 'maq', avoid: [], tip: 'Costas apoiadas, empurra sem bloquear os cotovelos.', alt: 'Supino com halteres' },
  { name: 'Supino com halteres', pat: 'push-h', eq: 'livres', avoid: ['ombros'], tip: 'Escápulas juntas. Desce até aos lados do peito, sem bater os halteres.', alt: 'Supino na máquina' },
  { name: 'Flexões inclinadas', pat: 'push-h', eq: 'corpo', avoid: [], tip: 'Mãos num banco ou mesa firme, corpo em linha reta.', alt: 'Flexões' },
  { name: 'Flexões', pat: 'push-h', eq: 'corpo', avoid: ['ombros'], tip: 'Corpo em linha reta, cotovelos a ~45° do tronco.', alt: 'Flexões inclinadas' },
  { name: 'Desenvolvimento na máquina', pat: 'push-v', eq: 'maq', avoid: ['ombros'], tip: 'Costas apoiadas, empurra para cima sem arquear.', alt: 'Desenvolvimento' },
  { name: 'Desenvolvimento', pat: 'push-v', eq: 'livres', avoid: ['ombros'], tip: 'Halteres ao nível das orelhas, empurra para cima sem arquear as costas.', alt: 'Desenvolvimento na máquina' },
  { name: 'Puxada alta', pat: 'pull-v', eq: 'maq', avoid: [], tip: 'Puxa a barra à altura do peito, cotovelos para baixo.', alt: 'Remada sentado' },
  { name: 'Remada sentado', pat: 'pull-h', eq: 'maq', avoid: [], tip: 'Peito aberto, puxa até ao abdómen e junta as omoplatas.', alt: 'Remada unilateral' },
  { name: 'Remada unilateral', pat: 'pull-h', eq: 'livres', avoid: ['costas'], tip: 'Mão e joelho no banco, puxa o haltere em direção à anca.', alt: 'Remada sentado' },
  { name: 'Remada invertida', pat: 'pull-h', eq: 'corpo', avoid: ['ombros'], tip: 'Debaixo de uma mesa firme ou barra baixa. Corpo em linha reta.', alt: 'Superman' },
  { name: 'Superman', pat: 'pull-h', eq: 'corpo', avoid: ['costas'], tip: 'Deitado de barriga para baixo, eleva braços e pernas 2 s.', alt: 'Remada invertida' },
  { name: 'Prancha', pat: 'core', eq: 'corpo', avoid: [], tip: 'Corpo em linha reta, abdómen firme, sem deixar a anca cair.', alt: 'Abdominal', s: 3, r: '30 s' },
  { name: 'Abdominal', pat: 'core', eq: 'corpo', avoid: ['costas'], tip: 'Sobe só os ombros, sem puxar o pescoço.', alt: 'Prancha', r: '12-15' },
  { name: 'Panturrilha', pat: 'calf', eq: 'corpo', avoid: [], tip: 'Amplitude completa. Aguenta 2 s no ponto máximo.', alt: 'Panturrilha sentado ou no leg press', r: '15' },
  { name: 'Elevação lateral', pat: 'delt', eq: 'livres', avoid: ['ombros'], tip: 'Cotovelos ligeiramente fletidos. Sem usar balanço.', alt: 'Elevação lateral no cabo' },
  { name: 'Tríceps corda', pat: 'arms', eq: 'maq', avoid: [], tip: 'Cotovelos fixos ao corpo. Abre a corda no final.', alt: 'Tríceps francês' },
  { name: 'Rosca alternada', pat: 'arms', eq: 'livres', avoid: [], tip: 'Cotovelos junto ao corpo, sobe sem balançar.', alt: 'Rosca polia' },
];

/* Padrões por sessão, por ordem de prioridade (cortam-se pelo fim). Padrão repetido = 2.ª escolha. */
const SESSIONS = {
  A: { label: 'Corpo inteiro A', pats: ['squat', 'push-h', 'pull-v', 'hinge', 'core', 'calf'] },
  B: { label: 'Corpo inteiro B', pats: ['hinge', 'push-v', 'pull-h', 'squat', 'core', 'calf'] },
  C: { label: 'Corpo inteiro C', pats: ['squat', 'push-h', 'pull-h', 'push-v', 'core', 'calf'] },
  SA: { label: 'Superior A', pats: ['push-h', 'pull-v', 'push-v', 'pull-h', 'arms', 'core'] },
  IA: { label: 'Inferior A', pats: ['squat', 'hinge', 'quad', 'calf', 'core'] },
  SB: { label: 'Superior B', pats: ['push-v', 'pull-h', 'push-h', 'pull-v', 'arms', 'core'] },
  IB: { label: 'Inferior B', pats: ['hinge', 'lunge', 'squat', 'calf', 'core'] },
};
const TEMPLATES = {
  2: ['A', 'B'],
  3: ['A', 'B', 'C'],
  4: ['SA', 'IA', 'SB', 'IB'],
  5: ['SA', 'IA', 'SB', 'IB', 'C'],
};
const DEFAULT_DAYS_BY_COUNT = {
  2: ['Segunda', 'Quinta'],
  3: ['Segunda', 'Quarta', 'Sexta'],
  4: ['Segunda', 'Terça', 'Quinta', 'Sexta'],
  5: ['Segunda', 'Terça', 'Quarta', 'Sexta', 'Sábado'],
};
const EX_BY_MINS = { 30: 4, 45: 5, 60: 6 };
const REPS = { forca: '8-10', gordura: '12-15', forma: '10-12', saude: '10-12', rotina: '10-12' };
const GOAL_TEXT = {
  forma: 'melhorar a condição física',
  forca: 'ganhar força e massa muscular',
  gordura: 'reduzir gordura corporal',
  saude: 'melhorar a saúde e a mobilidade',
  rotina: 'criar uma rotina',
};
const LIMIT_TEXT = { joelhos: 'os joelhos', costas: 'as costas', ombros: 'os ombros' };

const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

/* Repõe valores válidos sem inventar: o que falta ganha o valor predefinido, o que sobra desaparece. */
function normalizePrefs(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let days = (Array.isArray(r.days) ? r.days : []).filter(d => WEEK.includes(d));
  days = WEEK.filter(d => days.includes(d));            /* ordem da semana, sem repetidos */
  if (days.length < 2) days = DEFAULT_DAYS_BY_COUNT[3].slice();
  if (days.length > 5) days = days.slice(0, 5);
  return {
    name: String(r.name || '').trim().slice(0, 30),
    goal: pick(r.goal, GOALS, 'forma'),
    days,
    mins: pick(+r.mins, MINS, 45),
    exp: pick(r.exp, EXPS, 'inicio'),
    place: pick(r.place, PLACES, 'gym'),
    pref: pick(r.pref, EQUIPS, 'maq'),
    limits: (Array.isArray(r.limits) ? r.limits : []).filter(l => LIMITS.includes(l)),
  };
}

/* Equipamento admitido, pela ordem de preferência. Em casa não há máquinas. */
function allowedEquip(p) {
  const order = [p.pref, ...EQUIPS.filter(e => e !== p.pref)];
  const allowed = p.place === 'casa' ? (p.pref === 'livres' ? ['livres', 'corpo'] : ['corpo']) : EQUIPS;
  return order.filter(e => allowed.includes(e));
}

/* Candidatos de um padrão: sem limitações, já pela ordem de equipamento. */
function candidates(pat, p, equip) {
  return POOL.filter(x => x.pat === pat && equip.includes(x.eq) && !x.avoid.some(a => p.limits.includes(a)))
    .sort((a, b) => equip.indexOf(a.eq) - equip.indexOf(b.eq));
}

function prescription(item, p) {
  const s = item.s || (p.exp === 'inicio' && p.mins === 30 ? 2 : 3);
  const r = item.r || REPS[p.goal];
  return { name: item.name, s, r, tip: item.tip, alt: item.alt, pat: item.pat };
}

function buildSession(code, p, equip) {
  const spec = SESSIONS[code];
  const n = EX_BY_MINS[p.mins];
  const used = new Set();
  const ex = [];
  /* sessões B/C começam na 2.ª escolha de cada padrão: varia sem aleatoriedade */
  const offset = code.endsWith('B') || code === 'C' ? 1 : 0;
  for (const pat of spec.pats) {
    if (ex.length >= n) break;
    const fresh = candidates(pat, p, equip).filter(x => !used.has(x.name));
    if (!fresh.length) continue;
    const item = fresh[offset % fresh.length];
    used.add(item.name);
    ex.push(prescription(item, p));
  }
  if (p.goal === 'gordura' && p.mins >= 45) {
    ex.push({ name: 'Cardio final', s: '-', r: '10 min', tip: 'Caminhada rápida, bicicleta ou elíptica a um ritmo em que ainda consegues falar.', alt: 'Bicicleta ou elíptica, mesma duração', pat: 'cardio' });
  }
  return { code, label: spec.label, ex };
}

function whyText(p, model, skippedFor) {
  const n = p.days.length;
  const parts = [`Com ${n} dias por semana e cerca de ${p.mins} min por treino, para ${GOAL_TEXT[p.goal]}`];
  parts.push(model === 'fullbody'
    ? 'o treino de corpo inteiro dá mais prática a cada movimento e dá tempo de recuperar entre sessões.'
    : 'dividir em superior e inferior permite treinar mais vezes sem sobrecarregar os mesmos músculos.');
  let t = parts.join(', ');
  if (p.exp === 'inicio') t += ' Como estás a começar, as cargas são ligeiras e o foco é a técnica.';
  if (p.exp === 'regresso') t += ' Como estás a regressar, começa leve e sobe aos poucos.';
  if (p.place === 'casa') t += ' Só incluímos exercícios que se fazem em casa.';
  if (skippedFor.length) t += ` Evitámos exercícios que sobrecarregam ${skippedFor.map(l => LIMIT_TEXT[l]).join(' e ')}.`;
  return t;
}

/* Devolve { model, why, notes, prefs, week:[{ day, rest, code?, label, ex }] } — sempre os 7 dias da semana. */
function proposePlan(raw) {
  const p = normalizePrefs(raw);
  const n = p.days.length;
  const codes = TEMPLATES[n];
  const model = n <= 3 ? 'fullbody' : 'upperlower';
  const equip = allowedEquip(p);
  const sessions = codes.map(c => buildSession(c, p, equip));
  const week = WEEK.map(day => {
    const i = p.days.indexOf(day);
    return i < 0 ? { day, rest: true, label: 'Descanso', ex: [] } : { day, rest: false, code: sessions[i].code, label: sessions[i].label, ex: sessions[i].ex };
  });
  const short = week.filter(d => !d.rest && d.ex.length < 3).length;
  const notes = short ? ['Com estas escolhas há poucos exercícios disponíveis em alguns treinos. Podes acrescentar mais do catálogo depois de confirmar.'] : [];
  return { model, why: whyText(p, model, p.limits), notes, prefs: p, week };
}

export { WEEK, GOALS, EXPS, PLACES, EQUIPS, LIMITS, MINS, POOL, DEFAULT_DAYS_BY_COUNT, GOAL_TEXT, normalizePrefs, proposePlan };
