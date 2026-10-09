/* myTraining — histórico detalhado por exercício: recordes, evolução, sessões e correções.
   Ecrã próprio (`ST.view = '__ex'`, exercício em `ST.hx`), aberto a partir do cartão do exercício e do Histórico.
   Nada aqui entra no treino guiado. Os dados vêm de records.js (leitura) e logedit.js (escrita). */
import { chartSVG } from './charts.js';
import { METRICS, frequencyOf, exercisesWithLog, recordsOf, seriesOf, sessionsOf } from './records.js';
import { addSet, checkDate, deleteEntry, deleteSet, editSet, moveEntry } from './logedit.js';
import { ST, esc, save, todayStr } from './state.js';
import { render } from './ui.js';

const HX = { metric: 'carga', period: '6m', edit: null, date: null, adding: false };
const PERIODS = { '3m': ['3 meses', 92], '6m': ['6 meses', 183], all: ['Tudo', 0] };
const fmtD = d => String(d).split('-').reverse().join('/');
const num = v => String(Math.round(v * 100) / 100).replace('.', ',');
const val = id => (document.getElementById(id) || {}).value;

/* ── aviso discreto de recorde (e de erros): não interrompe, não pede toque ─────────────────────────── */
let toastTimer = 0;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
}
document.addEventListener('pr', e => {
  const d = e.detail || {};
  const parts = [d.load ? `Novo recorde de carga: ${num(d.w)} kg × ${d.r}` : '', d.e1rm ? `Novo 1RM estimado: ~${d.est} kg` : ''].filter(Boolean);
  toast(`🏆 ${parts.join(' · ')}`);
});

/* ── navegação ─────────────────────────────────────────────────────────────────────────────────── */
function hxOpen(name) { Object.assign(HX, { edit: null, date: null, adding: false }); ST.hx = String(name); render('__ex'); window.scrollTo(0, 0); }
function hxBack() { render('__hist'); }
function hxMetric(m) { if (METRICS[m]) { HX.metric = m; render('__ex'); } }
function hxPeriod(p) { if (PERIODS[p]) { HX.period = p; render('__ex'); } }

/* ── lista de exercícios no Histórico ───────────────────────────────────────────────────────────── */
function exerciseListHTML() {
  const list = exercisesWithLog();
  if (!list.length) return '';
  return `<div class="cu-title">Evolução por exercício</div><div class="week-list">${list.map(x => `
    <button class="wk-row hx-row" data-n="${esc(x.name)}" onclick="hxOpen(this.dataset.n)">
      <div class="wk-row-main"><div class="wk-row-day">${esc(x.name)}</div>
      <div class="wk-row-sub">${x.n} ${x.n === 1 ? 'sessão' : 'sessões'} · última ${fmtD(x.last)}</div></div><div class="wk-row-st">›</div></button>`).join('')}</div>`;
}

/* ── ecrã do exercício ──────────────────────────────────────────────────────────────────────────── */
function recordsHTML(sessions) {
  const { load, e1rm } = recordsOf(ST.hx, sessions);
  if (!load) return '<div class="hx-card"><div class="lc-empty">Ainda sem séries válidas.</div></div>';
  const f = frequencyOf(sessions, todayStr());
  return `<div class="hx-card">
    <div class="hx-rec"><span class="hx-k">🏆 Carga levantada</span><b>${num(load.w)} kg × ${load.r}</b><span class="hx-s">${fmtD(load.date)}</span></div>
    ${e1rm ? `<div class="hx-rec"><span class="hx-k">1RM estimado</span><b>~${e1rm.v} kg</b><span class="hx-s">estimativa a partir de ${num(e1rm.w)} × ${e1rm.r}, ${fmtD(e1rm.date)} — não é um levantamento real</span></div>` : ''}
    <div class="hx-rec"><span class="hx-k">Frequência</span><b>${f.total} ${f.total === 1 ? 'sessão' : 'sessões'}</b><span class="hx-s">${f.last4w} nas últimas 4 semanas</span></div>
  </div>`;
}

function chartHTML(sessions) {
  const since = PERIODS[HX.period][1] ? new Date(Date.now() - PERIODS[HX.period][1] * 864e5).toISOString().slice(0, 10) : '';
  const pts = seriesOf(sessions, HX.metric, since), m = METRICS[HX.metric];
  const chips = (obj, cur, fn) => Object.keys(obj).map(k => `<button class="cat-chip${cur === k ? ' on' : ''}" onclick="${fn}('${k}')">${esc(Array.isArray(obj[k]) ? obj[k][0] : obj[k].label)}</button>`).join('');
  let body;
  if (!pts.length) body = `<div class="lc-empty">${HX.metric === 'volume' ? 'Sem séries individuais neste período: os registos antigos só guardam a melhor série, por isso não há volume.' : 'Sem registos neste período.'}</div>`;
  else if (pts.length === 1) body = `<div class="lc-empty">Só um registo (${fmtD(pts[0].date)}: ${num(pts[0].v)} ${m.unit}) — ainda não há evolução para comparar.</div>`;
  else {
    const a = pts[0], z = pts[pts.length - 1], d = Math.round((z.v - a.v) * 100) / 100;
    body = chartSVG(pts.map(p => p.v)) + `<div class="lc-meta"><span>${fmtD(a.date)}: <b>${num(a.v)}</b> ${m.unit}</span><span>→ ${fmtD(z.date)}: <b>${num(z.v)}</b> ${m.unit}</span>
      <span class="lc-range">${d === 0 ? 'sem alteração' : (d > 0 ? '+' : '') + num(d) + ' ' + m.unit}</span></div>`;
  }
  return `<div class="hx-card"><div class="cat-chips">${chips(METRICS, HX.metric, 'hxMetric')}</div>${body}
    <div class="cat-chips hx-per">${chips(PERIODS, HX.period, 'hxPeriod')}</div></div>`;
}

function setRowHTML(s, i, date, granular) {
  const ed = HX.edit && HX.edit.date === date && HX.edit.i === i;
  if (ed) return `<div class="hx-set hx-editing"><input id="hx-w" type="number" inputmode="decimal" step="0.5" value="${s.w}" aria-label="Peso"> kg ×
    <input id="hx-r" type="number" inputmode="numeric" value="${s.r}" aria-label="Repetições">
    <button class="hx-b ok" onclick="hxSaveSet('${date}',${i})" aria-label="Guardar">✓</button><button class="hx-b" onclick="hxCancel()" aria-label="Cancelar">✕</button></div>`;
  return `<div class="hx-set"><span>${granular ? `Série ${i + 1} · ` : ''}<b>${num(s.w)}</b> kg × <b>${s.r}</b></span>
    <span><button class="hx-b" onclick="hxEditSet('${date}',${i})" aria-label="Corrigir">✎</button><button class="hx-b" onclick="hxDelSet('${date}',${i})" aria-label="Eliminar">🗑</button></span></div>`;
}

function dayHTML(s) {
  const d = s.date, dateEd = HX.edit && HX.edit.date === d && HX.edit.i === 'date';
  const head = dateEd
    ? `<div class="hx-day-h"><input id="hx-d" type="date" max="${todayStr()}" value="${d}" aria-label="Nova data"><span><button class="hx-b ok" onclick="hxSaveDate('${d}')" aria-label="Guardar data">✓</button><button class="hx-b" onclick="hxCancel()" aria-label="Cancelar">✕</button></span></div>`
    : `<div class="hx-day-h"><b>${fmtD(d)}</b>${s.custom ? ' <small>personalizado</small>' : ''}<span><button class="hx-b" onclick="hxEditDate('${d}')" aria-label="Mudar data">📅</button><button class="hx-b" onclick="hxAddOpen('${d}')" aria-label="Acrescentar série">＋</button><button class="hx-b" onclick="hxDelDay('${d}')" aria-label="Eliminar dia">🗑</button></span></div>`;
  const rows = s.sets.map((x, i) => setRowHTML(x, i, d, s.granular)).join('');
  const foot = s.granular
    ? `<div class="hx-foot">Melhor: ${num(s.best.w)} kg × ${s.best.r} · Volume: ${num(s.volume)} kg</div>`
    : '<div class="hx-foot">Registo antigo: só a melhor série (sem séries individuais nem volume).</div>';
  return `<div class="hx-day">${head}${rows}${foot}</div>`;
}

function addFormHTML() {
  if (!HX.adding) return `<button class="reset-btn hx-add" onclick="hxAddOpen()">＋ Registar treino passado</button>`;
  return `<div class="hx-card hx-form"><div class="hx-k">Registar série num dia passado</div>
    <input id="hx-ad" type="date" max="${todayStr()}" value="${HX.date || todayStr()}" aria-label="Data">
    <div class="hx-set"><input id="hx-w" type="number" inputmode="decimal" step="0.5" placeholder="kg" aria-label="Peso"> kg ×
    <input id="hx-r" type="number" inputmode="numeric" placeholder="reps" aria-label="Repetições"></div>
    <div class="hx-act"><button class="start-wo" onclick="hxAddSave()">Guardar</button><button class="reset-btn" onclick="hxCancel()">Cancelar</button></div>
    <div class="hx-foot">Não inicia nenhum treino. Para mais séries nesse dia, volta a guardar com a mesma data.</div></div>`;
}

function renderExercise(content) {
  const name = ST.hx;
  const sessions = name ? sessionsOf(name) : [];
  content.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'full hx';
  box.innerHTML = `<button class="reset-btn hx-back" onclick="hxBack()">‹ Histórico</button>
    <div class="cu-title hx-name">${esc(name || '')}</div>
    ${sessions.length ? recordsHTML(sessions) : ''}
    ${sessions.length ? chartHTML(sessions) : '<div class="sched-note">Sem registos para este exercício. Podes registar um treino passado abaixo.</div>'}
    ${addFormHTML()}
    ${sessions.length ? '<div class="cu-title">Sessões</div>' : ''}${[...sessions].reverse().map(dayHTML).join('')}`;
  content.appendChild(box);
}

/* ── correções ─────────────────────────────────────────────────────────────────────────────────── */
const done = r => { if (!r.ok) toast(r.msg); else { HX.edit = null; HX.adding = false; } render('__ex'); };
function hxEditSet(date, i) { HX.edit = { date, i }; render('__ex'); }
function hxEditDate(date) { HX.edit = { date, i: 'date' }; render('__ex'); }
function hxCancel() { HX.edit = null; HX.adding = false; render('__ex'); }
function hxSaveSet(date, i) { done(editSet(ST.hx, date, i, val('hx-w'), val('hx-r'))); }
function hxSaveDate(date) { done(moveEntry(ST.hx, date, val('hx-d'))); }
function hxDelSet(date, i) {
  if (!confirm(`Eliminar esta série de ${fmtD(date)}? Não se pode desfazer.`)) return;
  done(deleteSet(ST.hx, date, i));
}
function hxDelDay(date) {
  if (!confirm(`Eliminar todos os registos de ${ST.hx} em ${fmtD(date)}? Não se pode desfazer.`)) return;
  done(deleteEntry(ST.hx, date));
}
function hxAddOpen(date) { HX.adding = true; HX.date = date || null; HX.edit = null; render('__ex'); }
function hxAddSave() {
  const d = val('hx-ad'), bad = checkDate(d);
  if (bad) { toast(bad); return; }
  HX.date = d; done(addSet(ST.hx, d, val('hx-w'), val('hx-r')));
}

export { hxOpen, hxBack, hxMetric, hxPeriod, hxEditSet, hxEditDate, hxCancel, hxSaveSet, hxSaveDate, hxDelSet, hxDelDay, hxAddOpen, hxAddSave, exerciseListHTML, renderExercise, toast };
