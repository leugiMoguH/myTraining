/* myTraining — sugestão de carga conservadora e explicável (só leitura; nunca altera cargas nem o plano).

   Independente do "Próximo" do treino guiado (progression.js, que continua a mandar lá): esta é uma segunda
   opinião, mais prudente, mostrada no ecrã do exercício. Cada resultado traz a evidência usada.

   Regras (todas sobre séries realmente executadas, em sessões COMPARÁVEIS):
   - Greyskull LP e exercícios por tempo: não há sugestão genérica (o protocolo tem as suas regras, ver progression.js).
   - Sessão comparável = séries individuais, com pelo menos as séries previstas no plano, todas ao mesmo peso.
     Sessões incompletas ou antigas (só w/r) NÃO contam nem a favor nem contra: ausência de dados ≠ falha.
   - Precisa de 2 sessões comparáveis; menos = dados insuficientes.
   - Última sessão há mais de GAP_DAYS dias: não se infere perda de força — manter a carga registada e reavaliar.
   - Pesos diferentes nas duas sessões: acabou de mudar de carga — manter e confirmar.
   - Mesmo peso W nas duas:
       todas as séries ≥ alvo de reps em ambas  -> considerar +salto (o do exercício, ST.prog[nome].inc ou o predefinido);
       alguma série < mínimo da gama em ambas   -> rever carga ou objetivo de reps;
       caso contrário                           -> manter.
   - RIR (opcional): só trava. Se na última sessão todas as séries têm RIR e alguma foi até à falha (RIR 0), não se sobe.
   Um recorde isolado nunca chega: é preciso o mesmo desempenho em duas sessões completas. */
import { configOf, roundKg, targetReps } from './progression.js';
import { sessionsOf } from './records.js';
import { findExercise } from './routine.js';
import { todayStr } from './state.js';
import { daysBetween } from './muscles.js';

const SESSIONS_NEEDED = 2;
const GAP_DAYS = 28;

const out = (kind, msg, extra = {}) => ({ kind, msg, ...extra });
const num = v => String(Math.round(v * 100) / 100).replace('.', ',');
const fmtD = d => String(d).split('-').reverse().join('/');
const repsTxt = s => s.sets.map(x => x.r).join('/');

function adviceFor(name, { today = todayStr(), exercise, prog } = {}) {
  const ex = exercise || findExercise(name), cfg = configOf(name, ex, prog);
  if (cfg.scheme === 'greyskull' || !cfg.range) return null;
  const planned = ex && typeof ex.s === 'number' ? ex.s : 0;
  if (!planned) return out('insufficient', 'Este exercício já não está no plano (ou não tem séries previstas): sem referência para sugerir.');
  const gran = sessionsOf(name).filter(s => s.granular);
  if (!gran.length) return out('insufficient', 'Só há registos antigos com a melhor série: não permitem avaliar todas as séries.');
  const comp = gran.filter(s => s.sets.length >= planned && s.sets.every(x => x.w === s.sets[0].w));
  if (comp.length < SESSIONS_NEEDED) {
    return out('insufficient', `Preciso de ${SESSIONS_NEEDED} sessões completas (${planned} séries ao mesmo peso) para sugerir; tens ${comp.length}.`);
  }
  const [a, b] = comp.slice(-SESSIONS_NEEDED), W = b.sets[0].w, target = targetReps(cfg), lo = cfg.range.lo;
  const evidence = [a, b].map(s => ({ date: s.date, w: s.sets[0].w, reps: s.sets.map(x => x.r) }));
  const gap = daysBetween(b.date, today);
  if (gap > GAP_DAYS) return out('hold', `Última sessão completa há ${gap} dias (${fmtD(b.date)}, ${num(W)} kg). Retoma com essa carga e reavalia.`, { evidence });
  if (a.sets[0].w !== W) return out('hold', `Mudaste de ${num(a.sets[0].w)} para ${num(W)} kg: mantém e confirma em mais uma sessão.`, { evidence });
  const both = (f) => [a, b].every(s => f(s));
  const dates = `${fmtD(a.date)} e ${fmtD(b.date)}`;
  if (both(s => s.sets.every(x => x.r >= target))) {
    const rirAll = b.sets.every(x => Number.isFinite(x.rir));
    if (rirAll && Math.min(...b.sets.map(x => x.rir)) === 0) {
      return out('hold', `Fizeste todas as séries com ${num(W)} kg, mas a última sessão teve séries até à falha (RIR 0): mantém.`, { evidence });
    }
    const w = roundKg(W + cfg.inc);
    return out('up', `Completaste todas as séries previstas (≥ ${target} reps) nas últimas duas sessões com ${num(W)} kg (${dates}). Podes considerar +${num(cfg.inc)} kg (${num(w)} kg).`, { w, evidence });
  }
  if (both(s => s.sets.some(x => x.r < lo))) {
    return out('review', `Nas últimas duas sessões com ${num(W)} kg houve séries abaixo de ${lo} reps (${dates}). Considera manter, reduzir a carga ou rever o objetivo de reps.`, { evidence });
  }
  return out('hold', `Mantém ${num(W)} kg: ainda não chegaste a ${target} reps em todas as séries (última sessão: ${repsTxt(b)}).`, { evidence });
}

export { SESSIONS_NEEDED, GAP_DAYS, adviceFor };
