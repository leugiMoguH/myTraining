import { confirmDialog } from './dialog.js';
import { show } from './notice.js';
/* myTraining — acolhimento + proposta de plano + reorganizar a semana (ecrã sobreposto #onbBg).
   Retomável: cada escolha grava logo em ST.onb.draft e o passo em ST.onb.step.
   Usado de duas formas: 1.ª utilização (automático) e "Rever o meu plano" no Perfil (sem repetir o acolhimento). */
import { applyPlan, estimateMin, getPrefs, hasPlan, isTraining, swapDays } from './plan.js';
import { ensureOnb, isExistingUser, restoreSnapshot, snapshotInfo } from './migrate.js';
import { GOAL_TEXT, WEEK, normalizePrefs, proposePlan } from './planner.js';
import { ST, esc, save } from './state.js';
import { render } from './ui.js';

const el = id => document.getElementById(id);
const SHORT = { Segunda: 'Seg', Terça: 'Ter', Quarta: 'Qua', Quinta: 'Qui', Sexta: 'Sex', Sábado: 'Sáb', Domingo: 'Dom' };
const STEPS = 4;
let SCREEN = 'steps';   /* steps | proposal | reorg */
let PICK = null;        /* reorganizar: 1.º dia escolhido */
let MSG = '';           /* erro/aviso visível no ecrã */
let OPENER = null;      /* quem abriu o overlay: recebe o foco ao fechar */

const draft = () => ({ ...normalizePrefs({}), ...(ST.onb && ST.onb.draft) });
function patch(p) { ST.onb = { ...ST.onb, draft: { ...draft(), ...p } }; save(); }
function step(n) { ST.onb = { ...ST.onb, step: n }; save(); }

/* ── blocos ─────────────────────────────────────── */
const opt = (js, on, emoji, title, sub) =>
  `<button class="ob-opt${on ? ' on' : ''}" onclick="${js}" aria-pressed="${on}"><span class="ob-e">${emoji}</span><span class="ob-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
const chip = (js, on, text) => `<button class="ob-chip${on ? ' on' : ''}" onclick="${js}" aria-pressed="${on}">${text}</button>`;
const bar = n => `<div class="ob-prog" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS + 1}" aria-valuenow="${n + 1}"><i style="width:${(n + 1) / (STEPS + 1) * 100}%"></i></div>`;
const msg = () => (MSG ? `<div class="sched-note warn" role="alert">${esc(MSG)}</div>` : '');

function stepHTML(n, d) {
  if (n === 0) {
    const goals = [['forma', '💪', 'Melhorar a condição física'], ['forca', '🏋️', 'Ganhar força ou massa muscular'], ['gordura', '🔥', 'Reduzir gordura corporal'], ['saude', '🧘', 'Melhorar a saúde e a mobilidade'], ['rotina', '📅', 'Criar uma rotina']];
    return `<h1>O que queres alcançar?</h1><p class="ob-p">Escolhe o que mais se aproxima. Podes mudar quando quiseres.</p>${goals.map(g => opt(`obSet('goal','${g[0]}')`, d.goal === g[0], g[1], g[2])).join('')}`;
  }
  if (n === 1) {
    return `<h1>Quando consegues treinar?</h1><p class="ob-p">É melhor 2 dias que cumpres do que 5 que falhas. Escolhe de 2 a 5 dias.</p>
      <div class="ob-days">${WEEK.map(w => chip(`obDay('${w}')`, d.days.includes(w), SHORT[w])).join('')}</div>
      <p class="ob-p" aria-live="polite">${d.days.length} ${d.days.length === 1 ? 'dia' : 'dias'} por semana</p>
      <h2>Tempo por sessão</h2><div class="ob-row">${[30, 45, 60].map(m => chip(`obSet('mins',${m})`, d.mins === m, `${m} min`)).join('')}</div>`;
  }
  if (n === 2) {
    return `<h1>Como treinas?</h1>
      <h2>Experiência</h2><div class="ob-row">${chip("obSet('exp','inicio')", d.exp === 'inicio', 'A começar')}${chip("obSet('exp','regresso')", d.exp === 'regresso', 'A regressar')}${chip("obSet('exp','regular')", d.exp === 'regular', 'Já treino')}</div>
      <h2>Onde</h2><div class="ob-row">${chip("obSet('place','gym')", d.place === 'gym', 'Ginásio')}${chip("obSet('place','casa')", d.place === 'casa', 'Em casa')}${chip("obSet('place','ambos')", d.place === 'ambos', 'Ambos')}</div>
      <h2>Preferes</h2><div class="ob-row">${chip("obSet('pref','maq')", d.pref === 'maq', 'Máquinas')}${chip("obSet('pref','livres')", d.pref === 'livres', 'Pesos livres')}${chip("obSet('pref','corpo')", d.pref === 'corpo', 'Peso corporal')}</div>
      ${d.place === 'casa' && d.pref === 'maq' ? '<p class="ob-p">Em casa não há máquinas: usamos exercícios com o peso do corpo.</p>' : ''}`;
  }
  const L = [['joelhos', 'Joelhos'], ['costas', 'Costas'], ['ombros', 'Ombros']];
  return `<h1>Algo a evitar?</h1><p class="ob-p">Opcional. Evitamos exercícios que sobrecarreguem essas zonas. Não pedimos diagnósticos.</p>
    <div class="ob-row">${L.map(l => chip(`obLimit('${l[0]}')`, d.limits.includes(l[0]), l[1])).join('')}</div>
    <h2>Como te chamamos? <small>(opcional)</small></h2>
    <input class="ob-input" type="text" maxlength="30" autocomplete="given-name" placeholder="Nome" value="${esc(d.name)}" oninput="obName(this.value)" aria-label="Nome">
    <div class="sched-note">🔒 Fica guardado neste dispositivo. Podes exportar ou apagar tudo em Opções.</div>`;
}

function proposalHTML(plan) {
  const d = plan.prefs;
  const strip = plan.week.map(w => `<div class="ob-d${w.rest ? ' rest' : ''}"><small>${SHORT[w.day]}</small><b>${w.rest ? '·' : w.label.replace(/^Corpo inteiro /, '').replace(/^Superior /, 'S').replace(/^Inferior /, 'I')}</b></div>`).join('');
  const cards = plan.week.filter(w => !w.rest).map(w => `<details class="ob-card"><summary><b>${SHORT[w.day]} · ${w.label}</b><small>${w.ex.length} exercícios</small></summary>
    <ul>${w.ex.map(e => `<li>${esc(e.name)} <small>${typeof e.s === 'number' ? `${e.s}×${esc(e.r)}` : esc(e.r)}</small></li>`).join('')}</ul></details>`).join('');
  const hello = d.name ? `${esc(d.name)}, e` : 'E';
  return `<h1>${hello}sta é a tua semana</h1><p class="ob-p">Proposta inicial. Confirma, ou muda as respostas.</p>
    <div class="ob-week">${strip}</div>
    <div class="ob-card why"><b>Porquê assim?</b><p class="ob-p">${esc(plan.why)}</p>${plan.notes.map(n => `<p class="ob-p">⚠ ${esc(n)}</p>`).join('')}</div>
    ${cards}`;
}

function reorgHTML() {
  const rows = WEEK.map(w => {
    const day = ST.routine[w], t = isTraining(w);
    const on = PICK === w;
    return `<button class="ob-row-day${on ? ' on' : ''}" onclick="obPick('${w}')" aria-pressed="${on}"><b>${w}</b><span>${t ? `${esc(day.label)} · ~${estimateMin(w)} min` : 'Descanso'}</span></button>`;
  }).join('');
  return `<h1>Reorganizar a semana</h1><p class="ob-p">${PICK ? `Escolhe com que dia queres trocar <b>${PICK}</b>.` : 'Toca num dia e depois no dia com que queres trocá-lo. Um treino pode ir para um dia de descanso.'}</p>${msg()}${rows}`;
}

/* ── ecrã ───────────────────────────────────────── */
const FOCUSABLE = 'button, input, summary';

/* nav = mudou de passo/ecrã → foco no título; senão (escolher uma opção) o foco e o scroll ficam onde estavam */
function paint(nav = false) {
  const bg = el('onbBg'), body = el('onbBody');
  if (!bg || !body) return;
  ensureOnb();
  const n = ST.onb.step | 0, d = draft();
  const prev = document.activeElement, idx = body.contains(prev) ? [...body.querySelectorAll(FOCUSABLE)].indexOf(prev) : -1;
  const scroll = body.querySelector('.ob-wrap') ? body.querySelector('.ob-wrap').scrollTop : 0;
  let html, foot;
  if (SCREEN === 'reorg') {
    html = reorgHTML();
    foot = `<button class="ob-btn" onclick="obClose()">Pronto</button>`;
  } else if (SCREEN === 'proposal') {
    html = bar(STEPS) + msg() + proposalHTML(proposePlan(d));
    foot = `<button class="ob-btn" onclick="obApply()">Confirmar e começar</button><button class="ob-btn sec" onclick="obBack()">Mudar respostas</button>`;
  } else {
    const ok = n !== 1 || (d.days.length >= 2 && d.days.length <= 5);
    html = bar(n) + msg() + stepHTML(n, d);
    foot = `<button class="ob-btn" onclick="obNext()"${ok ? '' : ' disabled'}>${n === STEPS - 1 ? 'Ver a minha proposta' : 'Continuar'}</button>
      ${n > 0 ? '<button class="ob-btn ghost" onclick="obBack()">Voltar</button>' : `<button class="ob-btn ghost" onclick="obSkip()">${hasPlan() || isExistingUser() ? 'Cancelar' : 'Saltar — usar o plano que já existe'}</button>`}`;
  }
  body.innerHTML = `<div class="ob-wrap">${html}</div><div class="ob-foot">${foot}</div>`;
  const items = [...body.querySelectorAll(FOCUSABLE)];
  if (!nav && idx >= 0 && items[idx] && !items[idx].disabled) {
    const w = body.querySelector('.ob-wrap'); if (w) w.scrollTop = scroll;
    items[idx].focus({ preventScroll: true });
  } else {
    const h = body.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
}

/* tudo o resto fica inerte (inclui o descanso): o foco por teclado não sai do diálogo */
function lock(on) { for (const id of ['hdr', 'content', 'bnav', 'timerBanner']) { const e = el(id); if (e) e.inert = on; } }

function open() { OPENER = document.activeElement; el('onbBg').classList.add('show'); lock(true); paint(true); }
function close() {
  el('onbBg').classList.remove('show'); lock(false); SCREEN = 'steps'; PICK = null; MSG = '';
  if (OPENER && document.contains(OPENER) && OPENER.focus) { try { OPENER.focus({ preventScroll: true }); } catch (_) { /* sem foco */ } }
  OPENER = null;
}

/* Entrada: 'auto' (1.ª utilização), 'edit' (Perfil), 'reorg'. */
function obOpen(mode) {
  ensureOnb();
  MSG = ''; PICK = null;
  if (mode === 'reorg') { SCREEN = 'reorg'; open(); return; }
  if (mode === 'edit') { ST.onb = { ...ST.onb, step: 0, draft: getPrefs() || draft() }; save(); }
  SCREEN = 'steps';
  open();
}
function maybeOpenOnboarding() { if (ensureOnb() && !ST.onb.done) obOpen('auto'); }

/* ── handlers (ponte: bridge.js) ─────────────────── */
function obSet(k, v) { patch({ [k]: v }); MSG = ''; paint(); }
function obDay(day) {
  const cur = draft().days;
  if (!cur.includes(day) && cur.length >= 5) { MSG = 'No máximo 5 dias.'; paint(); return; }
  patch({ days: cur.includes(day) ? cur.filter(x => x !== day) : WEEK.filter(w => cur.includes(w) || w === day) });
  MSG = ''; paint();
}
function obLimit(l) { const cur = draft().limits; patch({ limits: cur.includes(l) ? cur.filter(x => x !== l) : [...cur, l] }); paint(); }
function obName(v) { patch({ name: String(v).slice(0, 30) }); }
function obNext() {
  const n = ST.onb.step | 0;
  if (n === 1 && draft().days.length < 2) { MSG = 'Escolhe pelo menos 2 dias.'; paint(); return; }
  if (n >= STEPS - 1) { SCREEN = 'proposal'; MSG = ''; paint(true); return; }
  step(n + 1); MSG = ''; paint(true);
}
function obBack() {
  MSG = '';
  if (SCREEN === 'proposal') { SCREEN = 'steps'; step(STEPS - 1); paint(true); return; }
  step(Math.max(0, (ST.onb.step | 0) - 1)); paint(true);
}
/* Sem acolhimento: não obriga. 1.ª utilização → marca como feito e mantém a rotina que existe. */
function obSkip() {
  if (!hasPlan() && !isExistingUser()) { ST.onb = { ...ST.onb, done: true, skipped: true, draft: {} }; save(); }
  close(); render('__hoje');
}
async function obApply() {
  const signature=()=>JSON.stringify([draft(), ST.routine, ST.prefs, ST.plan]);
  const before=signature();
  const replacing = isExistingUser() || hasPlan();
  if (replacing && !await confirmDialog({title:'Substituir rotina', confirmLabel:'Substituir', message:'Isto substitui a tua rotina atual pelo plano proposto.\n\nO histórico de cargas, os recordes e as medidas ficam. Fazemos antes uma cópia de segurança e podes repor o estado anterior no Perfil.\n\nContinuar?'})) return;
  if(before!==signature()) return;
  const r = applyPlan(proposePlan(draft()), { reason: replacing ? 'antes de aplicar plano novo' : 'plano inicial' });
  if (!r.ok) { MSG = r.error; paint(); return; }
  close(); render('__hoje');
  document.dispatchEvent(new CustomEvent('app-notice', { detail: { msg: 'Plano criado ✓ Já podes começar o treino de hoje.', kind: 'ok' } }));
}
function obClose() { close(); render(ST.view && ST.view.startsWith('__') ? ST.view : '__hoje'); }
function obPick(day) {
  MSG = '';
  if (!PICK) { PICK = day; paint(); return; }
  if (PICK === day) { PICK = null; paint(); return; }
  const r = swapDays(PICK, day);
  PICK = null;
  if (!r.ok) MSG = r.error;
  paint();
}
async function obUndoPlan() {
  if(document.getElementById('woBg').classList.contains('show')) { document.dispatchEvent(new CustomEvent('app-notice',{detail:{msg:'Sai do treino guiado antes de repor uma cópia.',kind:'info'}})); return; }
  const raw=localStorage.getItem('treino_v2_snap');
  const info = snapshotInfo();
  if (!info || !await confirmDialog({title:'Repor estado anterior', confirmLabel:'Repor', message:`Repor o estado de ${new Date(info.at).toLocaleString('pt-PT')}?\n\nO que fizeste depois dessa data (treinos, cargas) deixa de aparecer. O estado atual fica guardado para poderes voltar atrás.`})) return;
  if(raw!==localStorage.getItem('treino_v2_snap') || document.getElementById('woBg').classList.contains('show')) return;
  const r = restoreSnapshot('snap');
  if (!r.ok) { show(r.error || 'Não foi possível repor.', 'error'); return; }
  render('__perfil');
}

/* ── cartão "O meu plano" (Perfil) ──────────────── */
function planCardHTML() {
  const p = getPrefs(), info = snapshotInfo();
  const days = WEEK.filter(isTraining);
  const resume = days.length
    ? `${days.length} treinos por semana · ${days.map(d => SHORT[d]).join(', ')}${p && hasPlan() ? ` · objetivo: ${GOAL_TEXT[p.goal]}` : ''}`
    : 'Sem treinos na semana.';
  const intro = hasPlan() ? '' : '<p class="ob-p">Tens o teu plano. Podes criar um novo a partir de algumas perguntas — o histórico não se perde.</p>';
  const bak = info ? `<p class="ob-p">Cópia de segurança de ${esc(new Date(info.at).toLocaleString('pt-PT'))}${info.counts.log || info.counts.workouts ? ` (${info.counts.log} exercícios com histórico, ${info.counts.workouts} treinos)` : ''}.</p>` : '';
  return `<div class="ob-plan"><div class="nplan-hdr"><div><div class="day-hdr-name">📋 O meu plano</div><div class="day-hdr-sub">${esc(resume)}</div></div></div>${intro}
    <div class="ob-plan-btns">
      <button class="reset-btn btn-secondary" onclick="obOpen('edit')">✎ ${hasPlan() ? 'Rever objetivos e plano' : 'Criar plano novo'}</button>
      <button class="reset-btn btn-secondary" onclick="obOpen('reorg')">↔ Reorganizar a semana</button>
      <button class="reset-btn btn-ghost" onclick="exportBackup()">⬇ Guardar cópia em ficheiro</button>
      ${info ? '<button class="reset-btn btn-ghost" onclick="obUndoPlan()">↩ Repor o estado anterior</button>' : ''}
    </div>${bak}</div>`;
}

export { obOpen, maybeOpenOnboarding, planCardHTML, obSet, obDay, obLimit, obName, obNext, obBack, obSkip, obApply, obClose, obPick, obUndoPlan };
