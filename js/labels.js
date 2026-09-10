/* Traduções PT da taxonomia do exercises-dataset + ponte para o mapa muscular.

   O dataset é em inglês (não tem PT). Estas tabelas cobrem os 10 grupos, 28
   equipamentos e 19 alvos que existem nos 1324 exercícios — ver
   scripts/build-catalog.mjs para os regenerar caso o dataset mude. */

const BODY_PART_PT = {
  'back': 'Costas', 'cardio': 'Cardio', 'chest': 'Peito', 'lower arms': 'Antebraços',
  'lower legs': 'Gémeos', 'neck': 'Pescoço', 'shoulders': 'Ombros',
  'upper arms': 'Braços', 'upper legs': 'Pernas', 'waist': 'Core',
};

const EQUIPMENT_PT = {
  'assisted': 'Assistido', 'band': 'Elástico', 'barbell': 'Barra', 'body weight': 'Peso do corpo',
  'bosu ball': 'Bosu', 'cable': 'Cabo', 'dumbbell': 'Halteres', 'elliptical machine': 'Elíptica',
  'ez barbell': 'Barra W', 'hammer': 'Martelo', 'kettlebell': 'Kettlebell',
  'leverage machine': 'Máquina', 'medicine ball': 'Bola medicinal', 'olympic barbell': 'Barra olímpica',
  'resistance band': 'Banda elástica', 'roller': 'Rolo', 'rope': 'Corda', 'skierg machine': 'SkiErg',
  'sled machine': 'Trenó', 'smith machine': 'Smith', 'stability ball': 'Bola suíça',
  'stationary bike': 'Bicicleta', 'stepmill machine': 'Escadas', 'tire': 'Pneu',
  'trap bar': 'Trap bar', 'upper body ergometer': 'Ergómetro de braços', 'weighted': 'Com peso',
  'wheel roller': 'Roda abdominal',
};

const TARGET_PT = {
  'abductors': 'Abdutores', 'abs': 'Abdominais', 'adductors': 'Adutores', 'biceps': 'Bíceps',
  'calves': 'Gémeos', 'cardiovascular system': 'Cardiovascular', 'delts': 'Deltoides',
  'forearms': 'Antebraços', 'glutes': 'Glúteos', 'hamstrings': 'Isquiotibiais', 'lats': 'Dorsais',
  'levator scapulae': 'Elevador da omoplata', 'pectorals': 'Peitorais', 'quads': 'Quadríceps',
  'serratus anterior': 'Serrátil anterior', 'spine': 'Coluna / Lombar', 'traps': 'Trapézio',
  'triceps': 'Tríceps', 'upper back': 'Costas altas',
};

/* nome de músculo do dataset → id do bodySVG (js/charts.js, 15 grupos).
   Sem entrada = não pintado no boneco (ex.: sistema cardiovascular). */
const MUSCLE_ID = {
  // alvos
  'abductors': 'gluteos', 'abs': 'abdominal', 'adductors': 'quadriceps', 'biceps': 'biceps',
  'calves': 'gemeos', 'delts': 'ombro', 'forearms': 'antebraco', 'glutes': 'gluteos',
  'hamstrings': 'isquios', 'lats': 'dorsais', 'levator scapulae': 'trapezio',
  'pectorals': 'peito', 'quads': 'quadriceps', 'serratus anterior': 'oblique',
  'spine': 'lombar', 'traps': 'trapezio', 'triceps': 'triceps', 'upper back': 'dorsais',
  // secundários
  'abdominals': 'abdominal', 'ankle stabilizers': 'gemeos', 'ankles': 'gemeos', 'back': 'dorsais',
  'brachialis': 'biceps', 'chest': 'peito', 'core': 'abdominal', 'deltoids': 'ombro',
  'feet': 'gemeos', 'grip muscles': 'antebraco', 'groin': 'quadriceps', 'hands': 'antebraco',
  'hip flexors': 'quadriceps', 'inner thighs': 'quadriceps', 'latissimus dorsi': 'dorsais',
  'lower abs': 'abdominal', 'lower back': 'lombar', 'obliques': 'oblique',
  'quadriceps': 'quadriceps', 'rear deltoids': 'posterior', 'rhomboids': 'trapezio',
  'rotator cuff': 'ombro', 'shins': 'gemeos', 'shoulders': 'ombro', 'soleus': 'gemeos',
  'sternocleidomastoid': 'trapezio', 'trapezius': 'trapezio', 'upper chest': 'peito',
  'wrist extensors': 'antebraco', 'wrist flexors': 'antebraco', 'wrists': 'antebraco',
};

/* Fallback = o próprio termo em inglês, para nada aparecer vazio se o dataset
   ganhar valores novos. */
const bodyPartPT = v => BODY_PART_PT[v] || v || '';
const equipmentPT = v => EQUIPMENT_PT[v] || v || '';
const targetPT = v => TARGET_PT[v] || v || '';

/* Exercício do catálogo → { p: primários, s: secundários } no formato do bodySVG. */
function muscleIdsOf(ex) {
  const p = MUSCLE_ID[ex.t] ? [MUSCLE_ID[ex.t]] : [];
  const s = [];
  for (const name of ex.s || []) {
    const id = MUSCLE_ID[name];
    if (id && !p.includes(id) && !s.includes(id)) s.push(id);
  }
  return { p, s };
}

export { BODY_PART_PT, EQUIPMENT_PT, TARGET_PT, MUSCLE_ID, bodyPartPT, equipmentPT, targetPT, muscleIdsOf };
