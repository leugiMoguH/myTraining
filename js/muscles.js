/* myTraining — estímulo por grupo muscular a partir de ST.log (fonte única; nada é guardado, tudo recalculado).

   Três conceitos, nunca somados entre si:
   A. séries válidas      — séries individuais (sets[]) com peso e reps válidos. Séries por fazer, apagadas ou
                            ilegíveis não existem no log, por isso não contam.
   B. volume de carga     — peso × reps, SÓ por exercício (e só com séries individuais). Nunca se soma entre
                            exercícios nem por músculo: máquinas, halteres e barras não são comparáveis.
   C. estímulo por músculo — contagem de séries por papel: DIRETO (músculo primário do exercício) e INDIRETO
                            (secundário). Sem percentagens: cada série conta 1 em cada músculo a que está associada.

   Registos antigos (só w/r, sem sets) são UM registo de que houve treino nesse dia: contam para a data e para a
   frequência, nunca para séries nem volume (não se inventa o que não foi guardado).

   Estado de cada músculo na janela:
     dados      há séries individuais;
     agregado   só registos antigos sem séries;
     nenhum     há registos mapeados na janela e nenhum toca este músculo (ausência de treino);
     incerto    sem registos na janela, ou há exercícios sem músculos associados (ausência de dados). */
import { MUSCLES, MUSCLE_NAMES } from './charts.js';
import { all, isLoaded } from './catalog.js';
import { muscleIdsOf } from './labels.js';
import { setsOf } from './records.js';
import { findExercise } from './routine.js';
import { ST, todayStr } from './state.js';
import { keyOf } from './suggest.js';

const MUSCLE_IDS = Object.keys(MUSCLE_NAMES);

let byName = null;
const catalogHit = name => {
  if (!isLoaded()) return null;
  byName ||= new Map(all().map(e => [keyOf(e.n), e]));
  return byName.get(keyOf(name)) || null;
};

/* { p, s } do exercício: tabela manual, entrada do plano/personalizado, catálogo pelo nome; null se não se sabe */
function musclesOf(name) {
  if (MUSCLES[name]) return MUSCLES[name];
  const inPlan = findExercise(name);
  if (inPlan && inPlan.mus && inPlan.mus.p && inPlan.mus.p.length) return { p: inPlan.mus.p, s: inPlan.mus.s || [] };
  const hit = catalogHit(name);
  if (hit) { const m = muscleIdsOf(hit); if (m.p.length) return m; }
  return null;
}

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function shiftDay(date, n) { const [y, m, d] = date.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);

const blank = id => ({ id, status: 'incerto', direct: 0, indirect: 0, directDays: 0, indirectDays: 0, aggregated: 0, lastDirect: '', lastIndirect: '', exercises: [] });

/* Janela de `days` dias civis que acaba em `today` (inclusive): 7 = hoje e os 6 anteriores.
   A data de cada entrada é a da sessão (uma sessão que passa a meia-noite fica no dia em que começou).
   `log`/`mapOf` só se injetam nos testes. */
function muscleStats(days, today = todayStr(), log = ST.log, mapOf = musclesOf) {
  const from = shiftDay(today, -(days - 1));
  const out = Object.fromEntries(MUSCLE_IDS.map(id => [id, blank(id)]));
  const dDates = {}, iDates = {}, unmapped = new Set();
  let any = false;
  for (const [name, arr] of Object.entries(log || {})) {
    for (const e of arr || []) {
      const { sets, granular } = setsOf(e);
      if (!sets.length || e.date > today) continue;
      const m = mapOf(name), inWin = e.date >= from;
      if (!m) { if (inWin) { unmapped.add(name); any = true; } continue; }
      const n = granular ? sets.length : 0, vol = granular ? sets.reduce((v, s) => v + s.w * s.r, 0) : null;
      const touch = (id, role) => {
        const r = out[id]; if (!r) return;
        const key = role === 'direct' ? 'lastDirect' : 'lastIndirect';
        if (e.date > r[key]) r[key] = e.date;                       /* último estímulo: em todo o histórico */
        if (!inWin) return;
        any = true;
        r[role] += n;
        if (!granular) r.aggregated++;
        (role === 'direct' ? dDates : iDates)[id] = ((role === 'direct' ? dDates : iDates)[id] || new Set()).add(e.date);
        let x = r.exercises.find(q => q.name === name && q.role === role);
        if (!x) r.exercises.push(x = { name, role, sets: 0, volume: 0, legacy: 0, dates: [] });
        x.sets += n; x.dates.push(e.date);
        if (granular) x.volume += vol; else x.legacy++;
      };
      (m.p || []).forEach(id => touch(id, 'direct'));
      (m.s || []).forEach(id => { if (!(m.p || []).includes(id)) touch(id, 'indirect'); });
    }
  }
  for (const r of Object.values(out)) {
    r.directDays = (dDates[r.id] || new Set()).size;
    r.indirectDays = (iDates[r.id] || new Set()).size;
    r.exercises.sort((a, b) => (a.role === b.role ? b.sets - a.sets : a.role === 'direct' ? -1 : 1) || a.name.localeCompare(b.name));
    r.status = r.direct + r.indirect > 0 ? 'dados' : r.exercises.length ? 'agregado' : (any && !unmapped.size ? 'nenhum' : 'incerto');
  }
  return { days, from, to: today, any, unmapped: [...unmapped].sort(), muscles: out };
}

/* Resumo para os grupos do treino personalizado (suggest.js GROUPS): séries diretas na janela e último estímulo direto.
   Uma série que toca dois músculos do grupo (ex.: remada = dorsais + trapézio) conta UMA vez no grupo. */
function groupSummary(stats, groups) {
  return Object.fromEntries(groups.map(g => {
    const ms = g.ids.map(id => stats.muscles[id]).filter(Boolean), byEx = {};
    ms.forEach(m => m.exercises.forEach(x => { if (x.role === 'direct') byEx[x.name] = Math.max(byEx[x.name] || 0, x.sets); }));
    return [g.id, { sets: Object.values(byEx).reduce((n, v) => n + v, 0), last: ms.reduce((l, m) => (m.lastDirect > l ? m.lastDirect : l), '') }];
  }));
}

/* Escala de cor da vista: azul, mais claro = mais séries diretas, relativo ao músculo mais trabalhado da janela.
   Não é uma meta nem um sinal de recuperação. */
const RAMP = ['#3f7fc0', '#5b9bdc', '#8ab8ea', '#cfe5fb'];
const FILL = { none: '#2b2b3a', indirect: '#4a5670', aggregated: '#555568' };
function heatFill(stats) {
  const max = Math.max(0, ...Object.values(stats.muscles).map(m => m.direct));
  return id => {
    const m = stats.muscles[id];
    if (!m) return FILL.none;
    if (m.direct > 0) return RAMP[Math.max(1, Math.ceil(m.direct / max * 4)) - 1];
    if (m.indirect > 0) return FILL.indirect;
    return m.status === 'agregado' ? FILL.aggregated : FILL.none;
  };
}

export { MUSCLE_IDS, RAMP, FILL, musclesOf, muscleStats, groupSummary, heatFill, shiftDay, daysBetween };
