/* Motor de progressão de carga.

   Três esquemas clássicos de ginásio (métodos públicos, não copiados de lado nenhum):

   - dupla progressão (`double`)  — sobe as reps dentro da gama (ex. 8–12); ao chegar
     ao topo em todas as séries, sobe o peso e as reps voltam ao fundo da gama.
     É o mais adequado a gamas de hipertrofia, por isso é o predefinido.
   - linear (`linear`)            — alvo de reps fixo; se o atinges, sobes o peso na
     sessão seguinte.
   - Greyskull LP (`greyskull`)   — última série até à falha: bater o dobro do alvo
     vale um salto duplo de peso.

   Falhar o alvo 3 sessões seguidas ao mesmo peso = estagnação -> deload de 10%.

   Os "stalls" não são guardados em lado nenhum: são contados a partir de ST.log,
   por isso não há um contador que possa ficar dessincronizado do histórico. */
import { findExercise } from './routine.js';
import { ST, getLog } from './state.js';

const STALLS_TO_DELOAD = 3;
const DELOAD_PCT = 0.10;

/* Incremento por sessão: os grandes grupos das pernas aguentam saltos maiores. */
const INC_LOWER = 5;
const INC_UPPER = 2.5;
const LOWER = ['quadriceps', 'isquios', 'gluteos'];

const SCHEMES = {
  double: 'Dupla progressão',
  linear: 'Linear',
  greyskull: 'Greyskull LP',
};
const DEFAULT_SCHEME = 'double';

/* Discos de ginásio: 1,25 kg por lado é o mais pequeno comum -> 0,5 kg de resolução. */
const roundKg = kg => Math.round(kg * 2) / 2;

/* "8-12" -> {lo:8, hi:12}. "30-60s" e "20-30 min" -> null (tempo, não progride por carga). */
function parseRange(r) {
  const s = String(r == null ? '' : r).trim();
  if (/[a-z]/i.test(s)) return null;
  const m = s.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
  if (!m) return null;
  const lo = +m[1];
  const hi = m[2] ? +m[2] : lo;
  return hi >= lo && lo > 0 ? { lo, hi } : null;
}

function incrementFor(exercise) {
  const p = (exercise && exercise.mus && exercise.mus.p) || [];
  return p.some(id => LOWER.includes(id)) ? INC_LOWER : INC_UPPER;
}

/* Configuração de um exercício: o que o utilizador escolheu, ou o predefinido.
   `prog` só é passado nos testes; a app lê o que está guardado em ST.prog. */
function configOf(name, exercise, prog) {
  const ex = exercise || findExercise(name);
  const saved = ((prog || ST.prog || {})[name]) || {};
  const range = parseRange(ex && ex.r);
  const scheme = SCHEMES[saved.scheme] ? saved.scheme : DEFAULT_SCHEME;
  const inc = saved.inc > 0 ? +saved.inc : incrementFor(ex);
  return { scheme, inc, range, name };
}

/* Reps a atingir para a sessão contar como sucesso. */
function targetReps(cfg) {
  if (!cfg.range) return null;
  return cfg.scheme === 'double' ? cfg.range.hi : cfg.range.lo;
}

/* Reps que contam para a sessão: normalmente as da série representativa (w/r); no Greyskull
   a última série é a série até à falha, é essa que decide. */
function repsOf(entry, cfg) {
  if (cfg.scheme === 'greyskull' && entry.sets && entry.sets.length) return entry.sets[entry.sets.length - 1].r;
  return entry.r;
}

/* Sessões seguidas, ao peso atual, em que não se atingiu o alvo. */
function countStalls(log, cfg) {
  const target = targetReps(cfg);
  if (target == null || !log.length) return 0;
  const w = log[log.length - 1].w;
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].w !== w) break;
    if (repsOf(log[i], cfg) >= target) break;
    n++;
  }
  return n;
}

/* O cálculo todo num sítio só. Não muda estado nenhum — dá-se-lhe o histórico,
   devolve o que fazer a seguir. */
function evaluate(name, exercise, prog) {
  const cfg = configOf(name, exercise, prog);
  const log = getLog(name);
  const target = targetReps(cfg);

  if (!cfg.range) return { kind: 'none', cfg, msg: 'Exercício por tempo — sem progressão de carga.' };
  if (!log.length) return { kind: 'first', cfg, target, msg: 'Regista a primeira carga para começares a progressão.' };

  const last = log[log.length - 1];
  const stalls = countStalls(log, cfg);

  if (stalls >= STALLS_TO_DELOAD) {
    const w = roundKg(last.w * (1 - DELOAD_PCT));
    return {
      kind: 'deload', cfg, stalls, w, r: cfg.range.lo, target,
      msg: `${stalls} sessões sem chegar a ${target} reps. Baixa 10% e volta a subir.`,
    };
  }

  const lastReps = repsOf(last, cfg);
  if (lastReps >= target) {
    /* Greyskull: bater o dobro do alvo vale salto duplo. */
    const jump = cfg.scheme === 'greyskull' && lastReps >= target * 2 ? cfg.inc * 2 : cfg.inc;
    return {
      kind: 'up', cfg, stalls: 0, w: roundKg(last.w + jump), r: cfg.range.lo, target,
      msg: jump > cfg.inc ? `Bateste ${lastReps} reps — salto duplo de ${jump}kg.` : `Alvo atingido. Sobe ${jump}kg.`,
    };
  }

  /* Dupla progressão: mesmo peso, mais uma repetição. Os outros repetem a sessão. */
  const r = cfg.scheme === 'double' ? Math.min(last.r + 1, cfg.range.hi) : target;
  return {
    kind: 'hold', cfg, stalls, w: last.w, r, target,
    msg: stalls ? `${stalls} de ${STALLS_TO_DELOAD} sessões sem chegar a ${target} reps.` : `Repete o peso e chega a ${target} reps.`,
  };
}

/* Compatibilidade com quem já chamava nextTarget(name). */
function nextTarget(name, exercise, prog) {
  const r = evaluate(name, exercise, prog);
  return r.w > 0 ? { w: r.w, r: r.r } : null;
}

const ICON = { up: '⬆', hold: '🎯', deload: '⬇', first: '💡', none: '⏱' };

function progHint(name, exercise, prog) {
  const e = evaluate(name, exercise, prog);
  if (e.kind === 'none' || e.kind === 'first') return '';
  return `${ICON[e.kind]} Próximo: <b>${e.w}</b>kg × ${e.r}`;
}

export {
  SCHEMES, DEFAULT_SCHEME, STALLS_TO_DELOAD, DELOAD_PCT,
  parseRange, incrementFor, configOf, targetReps, countStalls,
  evaluate, nextTarget, progHint, roundKg,
};
