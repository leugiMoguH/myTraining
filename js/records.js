/* myTraining — leitura do histórico de cargas: sessões por exercício, recordes e referências.
   Só lê ST.log (fonte de verdade); não guarda nada. Tudo é recalculado a cada chamada, por isso uma correção
   ao histórico corrige também os recordes.

   Uma entrada de ST.log é um dia de um exercício: { date, w, r, sets?: [{w,r,k?,sid?}], c? }.
   - Com `sets`: séries individuais reais ("granular").
   - Sem `sets` (registo antigo): só w/r = UMA série realmente executada ("agregado"). Não se inventam séries
     nem volume para estes registos.

   Recordes — dois conceitos separados, ambos só de séries reais e válidas:
   - carga: o maior peso efetivamente levantado (desempate: mais reps);
   - 1RM estimado: est1RM(w,r) da melhor série, só com ≤12 reps (a fórmula deixa de ser fiável acima disso).
     É uma estimativa, nunca um levantamento real. */
import { ST, est1RM, getLog } from './state.js';

const E1RM_MAX_REPS = 12;
const MAX_REPS = 100;                       /* acima disto é lixo de importação, não uma série */

const validSet = s => !!s && Number.isFinite(+s.w) && Number.isFinite(+s.r) && +s.w > 0 && +s.r > 0 && +s.r <= MAX_REPS;
const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
/* melhor série (para mostrar e para recordes): maior peso e, nesse peso, MAIS reps. Não é o resumo w/r de ST.log,
   que é conservador (menos reps) por causa da progressão — esse não se altera. */
const bestOf = sets => sets.reduce((b, x) => (!b || x.w > b.w || (x.w === b.w && x.r > b.r)) ? x : b, null);

/* séries válidas de uma entrada e se são individuais */
function setsOf(e) {
  if (!e || !validDate(e.date)) return { sets: [], granular: false };
  if (Array.isArray(e.sets) && e.sets.length) {
    const sets = e.sets.filter(validSet).map(s => ({ ...s, w: +s.w, r: +s.r }));
    return { sets, granular: true };
  }
  return validSet(e) ? { sets: [{ w: +e.w, r: +e.r }], granular: false } : { sets: [], granular: false };
}

/* uma linha por dia, da mais antiga para a mais recente; dias sem nenhuma série válida ficam de fora */
function sessionsOf(name) {
  return getLog(name).map(e => {
    const { sets, granular } = setsOf(e);
    if (!sets.length) return null;
    const best = bestOf(sets);
    const e1 = sets.filter(s => s.r <= E1RM_MAX_REPS).map(s => est1RM(s.w, s.r));
    return {
      date: e.date, entry: e, sets, granular, best, custom: !!e.c,
      volume: granular ? sets.reduce((n, s) => n + s.w * s.r, 0) : null,   /* volume só com séries individuais */
      e1rm: e1.length ? Math.max(...e1) : null,
    };
  }).filter(Boolean).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

/* recordes do exercício (ou só das sessões dadas) */
function recordsOf(name, sessions = sessionsOf(name)) {
  let load = null, e1rm = null;
  for (const s of sessions) for (const x of s.sets) {
    if (!load || x.w > load.w || (x.w === load.w && x.r > load.r)) load = { w: x.w, r: x.r, date: s.date };
    if (x.r <= E1RM_MAX_REPS) { const v = est1RM(x.w, x.r); if (!e1rm || v > e1rm.v) e1rm = { v, w: x.w, r: x.r, date: s.date }; }
  }
  return { load, e1rm };
}

/* Esta série (w×r em `date`), ainda por gravar, bate um recorde? Só conta se já havia uma sessão ANTERIOR a `date`
   (a primeira vez que se faz um exercício não é um "recorde") e só com estritamente mais do que existe.
   Corre antes da escrita; repetir a mesma série (mesmos valores) nunca volta a dar recorde. */
function newPR(name, w, r, date) {
  w = +w; r = +r;
  if (!validSet({ w, r })) return { load: false, e1rm: false };
  const all = sessionsOf(name);
  if (!all.some(s => s.date < date)) return { load: false, e1rm: false };
  const cur = recordsOf(name, all);
  return {
    load: !!cur.load && w > cur.load.w,
    e1rm: r <= E1RM_MAX_REPS && !!cur.e1rm && est1RM(w, r) > cur.e1rm.v,
  };
}

/* melhor série da última sessão ANTERIOR a `date` (referência "última vez"); null sem histórico fiável */
function lastBefore(name, date) {
  const prev = sessionsOf(name).filter(s => s.date < date);
  return prev.length ? { ...prev[prev.length - 1].best, date: prev[prev.length - 1].date } : null;
}

const ymdMs = d => new Date(`${d}T12:00:00`).getTime();
/* frequência: sessões no total e nas últimas 4 semanas */
function frequencyOf(sessions, today) {
  const t = ymdMs(today), win = 28 * 864e5;
  return { total: sessions.length, last4w: sessions.filter(s => { const d = t - ymdMs(s.date); return d >= 0 && d < win; }).length };
}

const METRICS = {
  carga: { label: 'Carga', unit: 'kg', of: s => s.best.w },
  e1rm: { label: '1RM est.', unit: 'kg', of: s => s.e1rm },
  volume: { label: 'Volume', unit: 'kg', of: s => s.volume },   /* null nos registos agregados: ficam de fora */
};
/* pontos de um gráfico: só sessões com valor real para a métrica */
function seriesOf(sessions, metric, sinceDate) {
  const f = METRICS[metric].of;
  return sessions.filter(s => (!sinceDate || s.date >= sinceDate)).map(s => ({ date: s.date, v: f(s), granular: s.granular }))
    .filter(p => p.v != null && Number.isFinite(p.v));
}

/* nomes com histórico válido, o mais recente primeiro */
function exercisesWithLog() {
  return Object.keys(ST.log || {}).map(n => { const s = sessionsOf(n); return s.length ? { name: n, last: s[s.length - 1].date, n: s.length } : null; })
    .filter(Boolean).sort((a, b) => a.last < b.last ? 1 : a.last > b.last ? -1 : a.name.localeCompare(b.name));
}

export { E1RM_MAX_REPS, METRICS, validSet, validDate, setsOf, sessionsOf, recordsOf, newPR, lastBefore, frequencyOf, seriesOf, exercisesWithLog, bestOf };
