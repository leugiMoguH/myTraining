/* myTraining — mapa muscular na Evolução: séries registadas por músculo em 7 ou 28 dias.
   Só lê ST.log (muscles.js). Não indica recuperação, fadiga nem risco: mostra o que foi registado e quando. */
import { MUSCLE_NAMES, bodySVG } from './charts.js';
import { isLoaded, loadCatalog } from './catalog.js';
import { MUSCLE_IDS, daysBetween, heatFill, muscleStats } from './muscles.js';
import { esc, todayStr } from './state.js';

const MM = { days: 7, sel: null };
const fmtD = d => String(d).split('-').reverse().join('/');
const num = v => String(Math.round(v)).replace('.', ',');
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const ago = (d, today) => { const n = daysBetween(d, today); return n === 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`; };

const STATUS_TXT = {
  nenhum: 'Sem treino registado neste período.',
  incerto: 'Sem dados suficientes: não há registos neste período, ou há exercícios sem músculos associados.',
  agregado: 'Só registos antigos (apenas a melhor série): contam como treino, mas não têm séries nem volume.',
};

function detailHTML(st, id) {
  const m = st.muscles[id], today = st.to;
  const last = m.lastDirect ? `último direto ${fmtD(m.lastDirect)} (${ago(m.lastDirect, today)})`
    : m.lastIndirect ? `sem estímulo direto registado; último indireto ${fmtD(m.lastIndirect)}` : 'sem estímulo registado';
  const rows = m.exercises.map(x => `<div class="mm-ex"><span>${esc(x.name)} <small>${x.role === 'direct' ? 'direto' : 'indireto'}</small></span>
    <span>${x.aggregated ? 'registo antigo' : `${plural(x.sets, 'série', 'séries')}${x.volume ? ` · ${num(x.volume)} kg` : ''}`}</span></div>`).join('');
  return `<div class="hx-card mm-detail"><b>${esc(MUSCLE_NAMES[id])}</b>
    <div class="mm-sum">${plural(m.direct, 'série direta', 'séries diretas')} · ${plural(m.indirect, 'indireta', 'indiretas')} · ${plural(m.directDays, 'dia', 'dias')} com trabalho direto</div>
    <div class="mm-sum">${last}</div>
    ${STATUS_TXT[m.status] ? `<div class="mm-sum">${STATUS_TXT[m.status]}</div>` : ''}${rows}
    ${rows ? '<div class="ndisc">O volume (kg) é por exercício e não se compara entre exercícios.</div>' : ''}</div>`;
}

function innerHTML() {
  const st = muscleStats(MM.days, todayStr());
  const sel = MM.sel && st.muscles[MM.sel] ? MM.sel : null;
  const order = [...MUSCLE_IDS].sort((a, b) => st.muscles[b].direct - st.muscles[a].direct || st.muscles[b].indirect - st.muscles[a].indirect || MUSCLE_NAMES[a].localeCompare(MUSCLE_NAMES[b]));
  const chip = id => {
    const m = st.muscles[id], v = m.status === 'dados' ? m.direct : m.status === 'nenhum' ? '0' : '—';
    return `<button class="cat-chip mm-chip${sel === id ? ' on' : ''}" aria-pressed="${sel === id}" onclick="mmSel('${id}')">${esc(MUSCLE_NAMES[id])} <small>${v}</small></button>`;
  };
  return `<div class="cat-chips mm-days">${[7, 28].map(n => `<button class="cat-chip${MM.days === n ? ' on' : ''}" aria-pressed="${MM.days === n}" onclick="mmDays(${n})">${n} dias</button>`).join('')}</div>
    <div role="img" aria-label="Mapa do corpo com as séries diretas registadas por músculo">${bodySVG([], [], heatFill(st))}</div>
    <div class="ndisc">Mais claro = mais séries diretas registadas (relativo ao músculo mais trabalhado). Cinzento azulado = só estímulo indireto. Não indica recuperação, fadiga nem risco.</div>
    <div class="cat-chips mm-chips">${order.map(chip).join('')}</div>
    ${!st.any ? '<div class="sched-note">Sem registos neste período.</div>' : ''}
    ${st.unmapped.length ? `<div class="ndisc">Sem músculos associados (não contam): ${st.unmapped.map(esc).join(', ')}.</div>` : ''}
    ${sel ? detailHTML(st, sel) : '<div class="ndisc">Toca num músculo para ver os exercícios que contaram.</div>'}`;
}

const paint = () => { const el = document.getElementById('mmap'); if (el) el.innerHTML = innerHTML(); };
function mmDays(n) { if (n === 7 || n === 28) { MM.days = n; paint(); } }
function mmSel(id) { MM.sel = MM.sel === id ? null : id; paint(); }

function muscleMapHTML() {
  return `<div class="nsec-title">Músculos trabalhados</div><div id="mmap" class="mm">${innerHTML()}</div>`;
}
/* o catálogo (lazy) é o que associa músculos a exercícios que já saíram do plano */
function muscleMapWarm() {
  if (!isLoaded()) loadCatalog().then(paint).catch(() => {});
}

export { muscleMapHTML, muscleMapWarm, mmDays, mmSel };
