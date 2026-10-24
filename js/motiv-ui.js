/* myTraining — motivação: celebração do treino concluído, resumo reconsultável no Histórico, «A tua semana» e Conquistas na Evolução.
   Só apresentação: os dados e as regras estão em motiv.js (lê o que já existe; só escreve ST.motiv). Uma única folha por treino,
   com todas as conquistas agrupadas; nada de pop-ups sucessivos. */
import { celebrate, dismissPending, earnedAchievements, lockedAchievements, messageFor, pendingCelebration, sessionSummary, weekSummary } from './motiv.js';
import { onSessionDone } from './session.js';
import { openOverlay, closeOverlay } from './overlay.js';
import { esc } from './state.js';
import { render } from './ui.js';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
let V = null;          /* vista aberta: {summary, achievements, message, celebration, details} */
let WEEK_OFF = 0;      /* 0 = esta semana, 1 = a anterior */

const fmtDate = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8)}/${d.slice(5, 7)}` : '');
const fmtKg = n => (Math.round(n * 10) / 10).toLocaleString('pt-PT');
const fmtMin = ms => (ms < 60000 ? '<1 min' : `${Math.round(ms / 60000)} min`);
const setTxt = b => (b ? `${fmtKg(b.w)} kg × ${b.r}` : '');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function sheet() {
  let bg = document.getElementById('mvBg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'mvBg'; bg.className = 'sheet-bg mv-bg';
    bg.innerHTML = '<div class="sheet mv-sheet" role="dialog" aria-modal="true" aria-labelledby="mvTitle"><div class="sheet-grip" aria-hidden="true"></div><div id="mvBody"></div></div>';
    document.body.appendChild(bg);
  }
  return bg;
}

/* os 2–3 indicadores mais relevantes: só os que existem de facto */
function kpisOf(s) {
  const k = [];
  if (s.durationMs != null) k.push([fmtMin(s.durationMs), 'duração']);
  if (s.totals.sets > 0) k.push([String(s.totals.sets), s.totals.sets === 1 ? 'série registada' : 'séries registadas']);
  if (s.totals.volume != null && s.totals.volume > 0) k.push([`${fmtKg(s.totals.volume)} kg`, 'volume']);
  else if (s.totals.exercises > 0) k.push([String(s.totals.exercises), s.totals.exercises === 1 ? 'exercício' : 'exercícios']);
  return k.slice(0, 3);
}

function highlightsHTML(s) {
  const rows = [];
  for (const p of s.prs.slice(0, 2)) rows.push(`<li><span aria-hidden="true">🏅</span><span>Novo recorde${p.kind === '1rm' ? ' (1RM estimado)' : ' de carga'}: <b>${esc(p.name)}</b> · ${esc(setTxt(p))}</span></li>`);
  if (!s.prs.length) for (const i of s.improvements.slice(0, 2)) rows.push(`<li><span aria-hidden="true">📈</span><span><b>${esc(i.name)}</b>: ${esc(setTxt(i.from))} → ${esc(setTxt(i.to))}</span></li>`);
  return rows.length ? `<ul class="mv-hl">${rows.join('')}</ul>` : '';
}

function achievementsHTML(list) {
  if (!list.length) return '';
  return `<div class="mv-new"><div class="mv-new-t">${list.length === 1 ? 'Nova conquista' : 'Novas conquistas'}</div>
    ${list.map(a => `<div class="mv-ach"><span class="mv-ico" aria-hidden="true">${esc(a.icon)}</span><span><b>${esc(a.name)}</b><br><small>${esc(a.desc)}</small></span></div>`).join('')}</div>`;
}

function detailsHTML(s) {
  if (!s.exercises.length) return '<p class="mv-none">Sem séries com carga registadas neste treino.</p>';
  return `<ul class="mv-det">${s.exercises.map(e => `<li><b>${esc(e.name)}</b>
    <span>${plural(e.sets, 'série', 'séries')} · ${plural(e.reps, 'repetição', 'repetições')}${e.best ? ` · melhor ${esc(setTxt(e.best))}` : ''}${e.pr ? ' · 🏅' : e.improved ? ' · 📈' : ''}</span></li>`).join('')}</ul>`;
}

function paint() {
  const body = document.getElementById('mvBody');
  if (!body || !V) return;
  const s = V.summary, kinds = { rapido: 'Treino rápido', retoma: 'Retoma', personalizado: 'Treino personalizado' };
  const title = V.celebration ? 'Treino concluído' : (kinds[s.kind] || s.label || 'Treino');
  const sub = [V.celebration ? (kinds[s.kind] || s.label) : '', fmtDate(s.date), s.reduced ? 'versão reduzida' : ''].filter(Boolean).map(esc).join(' · ');
  const kp = kpisOf(s);
  body.innerHTML = `<div class="mv-hero"><div class="mv-badge-big" aria-hidden="true">${V.celebration ? '✨' : '💪'}</div>
    <h2 class="mv-title" id="mvTitle">${esc(title)}</h2>${sub ? `<div class="mv-sub">${sub}</div>` : ''}</div>
    <p class="mv-msg">${esc(V.message)}</p>
    ${kp.length ? `<div class="mv-kpis">${kp.map(([v, l]) => `<div class="mv-kpi"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : ''}
    ${highlightsHTML(s)}${V.celebration ? achievementsHTML(V.achievements) : ''}
    ${V.details ? detailsHTML(s) : ''}
    <div class="mv-acts"><button type="button" class="reset-btn btn-secondary" onclick="mvDetails()" aria-expanded="${V.details}">${V.details ? 'Esconder detalhes' : 'Ver detalhes'}</button>
    <button type="button" class="start-wo btn-primary" onclick="mvClose()">${V.celebration ? 'Concluir' : 'Fechar'}</button></div>`;
}

function open(next) {
  V = { ...next, details: false };
  const bg = sheet();
  paint();
  if (!bg.classList.contains('show')) openOverlay(bg, { initial: '.btn-primary', onClose: mvClose });
}

/* chamado depois de o treino estar gravado: o guiado fecha primeiro, a folha abre por cima do Hoje */
function offer(id) {
  setTimeout(() => {
    try {
      if (V) return;                                   /* já há uma apresentação: a pendente fica para a retomar */
      const r = celebrate(id);
      if (r) open({ ...r, celebration: true });
    } catch (e) { console.error('celebrate', e); }
  }, 0);
}

/* arranque: uma celebração pendente (a app fechou antes de tocar em Concluir) volta a abrir uma vez */
function resumeCelebration() {
  try {
    if (V) return;
    const r = pendingCelebration();
    if (r) open({ ...r, celebration: true });
  } catch (e) { console.error('pending celebration', e); }
}

onSessionDone(s => offer(s.id));
document.addEventListener('training-done', e => { if (e.detail && SAFE_ID.test(e.detail.id)) offer(e.detail.id); });

/* Histórico: reabre o resumo de um treino, sem gravar nada nem criar celebrações */
function mvOpen(id) {
  if (!SAFE_ID.test(String(id)) || V) return;
  const s = sessionSummary(id);
  if (!s) return;
  open({ summary: s, achievements: [], message: messageFor(s), celebration: false });
}

function mvDetails() { if (V) { V = { ...V, details: !V.details }; paint(); } }

function mvClose() {
  const wasCelebration = !!(V && V.celebration);
  if (wasCelebration) dismissPending();
  V = null;
  closeOverlay(sheet());
  if (wasCelebration) render('__hoje');
}

/* ── Evolução: A tua semana ── */
const histBtn = (id, label) => (SAFE_ID.test(String(id)) ? `<button type="button" class="reset-btn btn-ghost" onclick="mvOpen('${esc(id)}')">${label}</button>` : '');

function weekCardHTML() {
  const now = new Date(), ref = new Date(now);
  ref.setHours(12, 0, 0, 0); ref.setDate(ref.getDate() - 7 * WEEK_OFF);   /* dias civis, não 168 h (mudança de hora) */
  const w = weekSummary(ref, now);
  if (!w) return '';
  const chips = [];
  const total = w.trainings + w.reduced;   /* os treinos em versão reduzida também contam */
  if (total) chips.push(`🏋️ ${plural(total, 'treino', 'treinos')}${w.reduced ? ` (${w.reduced} em versão reduzida)` : ''}`);
  if (w.classes) chips.push(`🧘 ${plural(w.classes, 'aula', 'aulas')}${w.classMin ? ` · ${w.classMin} min` : ''}`);
  if (w.goal != null && w.goal > 0 && !w.empty) chips.push(`🎯 ${Math.min(total, w.goal)} de ${w.goal} treinos do plano`);
  const imp = w.improvements.map(i => `<li><span aria-hidden="true">📈</span><span><b>${esc(i.name)}</b>: ${esc(setTxt(i.from))} → ${esc(setTxt(i.to))}</span></li>`).join('');
  const ach = w.achievements.map(a => `<li><span aria-hidden="true">${esc(a.icon)}</span><span>${esc(a.name)}</span></li>`).join('');
  return `<div class="mv-week"><div class="nsec-title">${WEEK_OFF ? 'Semana passada' : 'A tua semana'}</div>
    ${chips.length ? `<div class="mv-chips">${chips.map(c => `<span class="mv-chip">${esc(c)}</span>`).join('')}</div>` : ''}
    <p class="mv-msg">${esc(w.message)}</p>
    ${imp || ach ? `<ul class="mv-hl">${imp}${ach}</ul>` : ''}
    <button type="button" class="reset-btn btn-ghost" onclick="mvWeek(${WEEK_OFF ? 0 : 1})">${WEEK_OFF ? '‹ Esta semana' : 'Ver semana passada ›'}</button></div>`;
}

function mvWeek(off) { WEEK_OFF = off ? 1 : 0; render('__perfil'); }

/* ── Evolução: Conquistas ── */
function badgesHTML() {
  const got = earnedAchievements(), left = lockedAchievements();
  if (!got.length && !left.length) return '';
  const done = got.map(a => `<div class="mv-bdg"><span class="mv-ico" aria-hidden="true">${esc(a.icon)}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}${a.date ? ` · ${esc(fmtDate(a.date))}` : ''}</small></div>`).join('');
  const todo = left.map(a => `<div class="mv-bdg off"><span class="mv-ico" aria-hidden="true">${esc(a.icon)}</span><b>${esc(a.name)}</b><small>${esc(a.hint)}</small></div>`).join('');
  return `<div class="mv-badges"><div class="nsec-title">Conquistas · ${got.length} de ${got.length + left.length}</div>
    ${got.length ? `<div class="mv-grid">${done}</div>` : '<p class="mv-none">Ainda sem conquistas. A primeira chega com o teu primeiro treino concluído.</p>'}
    ${left.length ? `<details class="mv-more"><summary>Por conseguir (${left.length})</summary><div class="mv-grid">${todo}</div></details>` : ''}</div>`;
}

function motivEvolutionHTML() { return weekCardHTML() + badgesHTML(); }

export { resumeCelebration, motivEvolutionHTML, histBtn, mvOpen, mvDetails, mvClose, mvWeek };
