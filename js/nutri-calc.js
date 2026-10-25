/* Estimativas para adultos saudáveis de 18–65 anos; sem ajuste por objetivo. */
function inScope(p = {}) {
  return !!p && ['m','f'].includes(p.sex) && [p.age,p.weight,p.height].every(x => typeof x === 'number' && Number.isFinite(x) && x > 0) && p.age >= 18 && p.age <= 65;
}
function bmrMifflin(p) {
  return inScope(p) ? 10*p.weight + 6.25*p.height - 5*p.age + (p.sex === 'm' ? 5 : -161) : null;
}
function energyEstimate(p) {
  const ree = bmrMifflin(p), factors = {sed:1.2,leve:1.375,mod:1.55,alto:1.725};
  const factor = Object.hasOwn(factors,p?.activity) ? factors[p.activity] : null;
  return ree === null || !factor ? null : ree * factor;
}
function references(p) {
  const energy = energyEstimate(p);
  if (energy === null) return { applicable:false, reason:'Estimativa não aplicável: requer dados válidos de adultos saudáveis dos 18 aos 65 anos.' };
  const ref = (value, fonte, nota) => ({value, fonte, nota});
  return { applicable:true,
    energy:ref(energy,'Mifflin–St Jeor, 1990','Repouso (REE) × fator de atividade; fatores convencionais de uso comum, não da fórmula de Mifflin. Estimativa de manutenção.'),
    protein:{range:[1.6*p.weight,2.2*p.weight],fonte:'Morton et al., 2018',nota:'1,6–2,2 g/kg/dia · orientação prática para quem treina força (adultos saudáveis); não é requisito individual.'},
    fat:{range:[energy*.20/9,energy*.35/9],fonte:'EFSA, 2010',nota:'20–35 % da energia de manutenção.'},
    carbs:{range:[energy*.45/4,energy*.60/4],fonte:'EFSA, 2010',nota:'45–60 % da energia de manutenção. Os intervalos não são combinações que somam a mesma energia.'},
    fibre:ref(25,'EFSA, 2010','Ingestão adequada, g/dia.'),
    water:ref(p.sex === 'm' ? 2.5 : 2,'EFSA, 2010','Ingestão adequada total, L/dia (inclui alimentos).'),
    salt:ref(5,'OMS, 2012','Menos de 5 g de sal/dia (sódio <2 g).'),
    sugars:ref(null,'OMS, 2015','Açúcares livres: menos de 10 % da energia. O diário regista açúcares totais; não compara com este limite.') };
}

export { inScope, bmrMifflin, energyEstimate, references };
