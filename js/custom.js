/* Treino personalizado — "hoje não quero o programado, quero treinar X".

   Vale só para hoje e nunca toca no plano: o treino vive em ST.custom (um "dia"
   à parte, ver CUSTOM_DAY em routine.js), não em ST.routine nem na agenda. Ao
   concluir, ocupa o lugar do treino de hoje (ST.sched.replaced, ver schedule.js):
   esse dia sai da fila sem ficar "feito", e amanhã segue como antes.

   ST.custom = {
     date:    '2026-09-08',       só é válido no dia em que foi criado
     muscles: ['peito','triceps'],
     label:   'Peito + Tríceps',
     ex:      [ entrada de rotina… ],
     stage:   'plan' | 'active' | 'done',
     offline: true,               catálogo indisponível: só saíram exercícios do plano
   }
   As séries marcadas ficam em ST.sets / ST.done com a chave 'Personalizado:i'.
   Ao concluir, fica um registo em ST.sessions e as cargas ficam marcadas `c:1`
   em ST.log, para o histórico distinguir programado de personalizado. */
import { all, isLoaded, loadCatalog, muscleIdsOf, toRoutineEntry } from './catalog.js';
import { openCatalog } from './catalog-ui.js';
import { MUSCLES } from './charts.js';
import { CUSTOM_DAY, dayNames, exercisesOf, findExercise, removeExercise } from './routine.js';
import { EQUIPMENT, GROUPS, keyOf, recency, suggest } from './suggest.js';
import { replaceCurrent, slotToReplace } from './schedule.js';
import { ST, esc, getLog, getSets, save, todayStr } from './state.js';
import { buildCard, refreshProgress, render } from './ui.js';

/* Escolha em curso no ecrã de músculos. Não se guarda: abandonar não deixa rasto. */
const PICK = { sel: [], msg: '', busy: false, warmed: false };

/* ── estado ───────────────────────────────────────────────────────────────── */

const valid = c => !!c && typeof c === 'object' && Array.isArray(c.ex) && typeof c.date === 'string';

/* Há um treino personalizado de hoje por terminar. */
function isLive() { return valid(ST.custom) && ST.custom.date === todayStr() && ST.custom.stage !== 'done'; }

/* Tira só as séries do treino personalizado — as do plano ficam como estão. */
function clearCustomProgress() {
  const drop = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith(`${CUSTOM_DAY}:`)));
  ST.sets = drop(ST.sets);
  ST.done = drop(ST.done);
}

function dropCustom() { clearCustomProgress(); ST.custom = null; save(); }

/* De um dia para o outro (ou com dados estranhos) o treino personalizado caduca. */
function expireCustom() {
  if (ST.custom && !(valid(ST.custom) && ST.custom.date === todayStr())) dropCustom();
}

/* ── dados para a sugestão ────────────────────────────────────────────────── */

let byName = null;
function catalogByName() {
  if (!isLoaded()) return new Map();
  byName ||= new Map(all().map(e => [keyOf(e.n), e]));
  return byName;
}

/* Músculos primários (ids do bodySVG) de um exercício, venha ele do plano à mão,
   do catálogo guardado na rotina, ou do catálogo pelo nome (histórico antigo). */
function idsOf(name) {
  if (MUSCLES[name]) return MUSCLES[name].p;
  const inPlan = findExercise(name);
  if (inPlan && inPlan.mus && inPlan.mus.p) return inPlan.mus.p;
  const hit = catalogByName().get(keyOf(name));
  return hit ? muscleIdsOf(hit).p : [];
}

/* Primeiro o que já está no plano, depois o catálogo (com preferência pelo que já
   tens no histórico). O plano ganha: mesmo nome = fica a entrada do plano, com as
   suas séries, reps e dicas. */
function buildPool() {
  const pool = new Map();
  const put = c => { if (!pool.has(c.key)) pool.set(c.key, c); };
  for (const day of dayNames()) {
    for (const e of exercisesOf(day)) {
      const ids = idsOf(e.name);
      if (!ids.length) continue;
      const m = MUSCLES[e.name] || e.mus || {};
      put({ key: keyOf(e.name), ids, known: 2, sec: (m.s || []).length, equip: '', entry: JSON.parse(JSON.stringify(e)) });
    }
  }
  for (const e of all()) {
    if (!EQUIPMENT.includes(e.e)) continue;
    const ids = muscleIdsOf(e).p;
    if (!ids.length) continue;
    put({ key: keyOf(e.n), ids, known: getLog(e.n).length ? 1 : 0, sec: (e.s || []).length, equip: e.e, entry: toRoutineEntry(e) });
  }
  return [...pool.values()];
}

/* ── ações ────────────────────────────────────────────────────────────────── */

function openCustom() {
  expireCustom();
  if (ST.custom && ST.custom.stage === 'done') { ST.custom = null; save(); }   /* já ficou no histórico */
  if (!valid(ST.custom)) { PICK.sel = []; PICK.msg = ''; PICK.busy = false; }
  render('__pers');
}

function cuToggle(id) {
  PICK.sel = PICK.sel.includes(id) ? PICK.sel.filter(x => x !== id) : [...PICK.sel, id];
  PICK.msg = '';
  render('__pers');
}

async function cuSuggest() {
  if (PICK.busy) return;
  if (!PICK.sel.length) { PICK.msg = 'Escolhe pelo menos um músculo.'; render('__pers'); return; }
  PICK.busy = true; PICK.msg = 'A preparar…'; render('__pers');

  try { await loadCatalog(); } catch (_) { /* offline sem cache: segue só com o plano */ }
  PICK.busy = false;
  if (ST.view !== '__pers') return;                    /* saiu do ecrã enquanto carregava */

  const groups = GROUPS.filter(g => PICK.sel.includes(g.id));
  const ex = suggest(groups.map(g => g.id), buildPool());
  if (!ex.length) {
    PICK.msg = isLoaded() ? 'Não encontrei exercícios para estes músculos.' : 'Sem catálogo (offline) e nada no teu plano para estes músculos.';
    render('__pers');
    return;
  }
  clearCustomProgress();
  ST.custom = { date: todayStr(), muscles: groups.map(g => g.id), label: groups.map(g => g.label).join(' + '), ex, stage: 'plan', offline: !isLoaded() };
  save();
  render('__pers');
}

function cuRemove(i) { if (removeExercise(CUSTOM_DAY, i)) render('__pers'); }
function cuAdd() { openCatalog(CUSTOM_DAY); }

function cuBegin() {
  if (!valid(ST.custom) || !ST.custom.ex.length) return;
  ST.custom = { ...ST.custom, stage: 'active' };
  save();
  render('__pers');
}

function cuHome() { render('__hoje'); }

function cuDiscard(force) {
  const started = valid(ST.custom) && ST.custom.ex.some((_, i) => getSets(CUSTOM_DAY, i).length);
  if (started && !force && !confirm('Descartar o treino personalizado? As séries marcadas perdem-se.')) return;
  dropCustom();
  render('__hoje');
}

/* Concluir regista a sessão uma única vez (stage passa a 'done'). */
function cuFinish() {
  const c = ST.custom;
  if (!valid(c) || c.stage === 'done') return;
  const sets = c.ex.reduce((n, _, i) => n + getSets(CUSTOM_DAY, i).length, 0);
  if (!sets) {
    if (confirm('Nenhuma série marcada. Descartar este treino personalizado?')) cuDiscard(true);
    return;
  }
  /* só ocupa o lugar do treino de hoje se ainda for hoje (ecrã deixado aberto da véspera: não) */
  const replaced = c.date === todayStr() ? replaceCurrent() : null;
  const ex = c.ex.map(e => e.name).filter((_, i) => getSets(CUSTOM_DAY, i).length);
  ST.sessions = [...ST.sessions, { date: c.date, kind: 'custom', label: c.label, muscles: c.muscles, ex, sets, replaced }].slice(-200);
  clearCustomProgress();
  ST.custom = { ...c, stage: 'done', sets, replaced };
  save();
  render('__pers');
}

/* ── ecrãs ────────────────────────────────────────────────────────────────── */

/* Botão no ecrã "Hoje": começar um treino personalizado, ou retomar o de hoje. */
function customEntryHTML() {
  if (isLive()) {
    return `<div class="sched-note cu-entry">🎯 Treino personalizado ${ST.custom.stage === 'active' ? 'em curso' : 'por começar'}:
      <b>${esc(ST.custom.label)}</b>
      <button class="cat-chip on" onclick="openCustom()">Continuar</button></div>`;
  }
  return `<button class="reset-btn cu-entry" onclick="openCustom()">🎯 Fazer treino personalizado hoje</button>`;
}

function setHeader(sub, pct = 0) {
  document.getElementById('hdrSub').textContent = sub;
  document.getElementById('progFill').style.width = `${pct}%`;
}

function headHTML(sub, buttons = '') {
  return `<div class="day-hdr">
    <div class="day-hdr-text">
      <div class="day-hdr-name">🎯 Treino personalizado</div>
      <div class="day-hdr-sub">${sub}</div>
    </div>
    <div class="day-hdr-btns">${buttons}</div>
  </div>`;
}

function hintOf(days) {
  if (days === undefined) return '';
  return days === 0 ? 'hoje' : days === 1 ? 'ontem' : days <= 6 ? `há ${days} d` : '';
}

function renderPicker(content) {
  setHeader('Treino personalizado');
  /* o catálogo melhora as dicas e a sugestão; pedi-lo já poupa tempo no passo seguinte */
  if (!PICK.warmed && !isLoaded()) {
    PICK.warmed = true;
    loadCatalog().then(() => { if (ST.view === '__pers' && !valid(ST.custom)) render('__pers'); }).catch(() => {});
  }
  const rec = recency(ST.log, idsOf, todayStr());
  const chips = GROUPS.map(g => {
    const hint = hintOf(rec[g.id]);
    const recent = rec[g.id] !== undefined && rec[g.id] <= 1;
    return `<button class="cat-chip cu-chip${PICK.sel.includes(g.id) ? ' on' : ''}${recent ? ' recent' : ''}" onclick="cuToggle('${g.id}')">
      ${g.label}${hint ? `<small>${hint}</small>` : ''}</button>`;
  }).join('');
  const past = ST.sessions.slice(-3).reverse().map(s =>
    `<div class="cu-past">${esc(s.date)} · ${esc(s.label)} · ${s.sets} séries</div>`).join('');

  content.innerHTML = `<div class="full">
    ${headHTML('Só para hoje — o plano normal não muda.')}
    <div class="cu-title">Que músculos queres treinar?</div>
    <div class="cu-chips">${chips}</div>
    ${PICK.msg ? `<div class="sched-note warn">${esc(PICK.msg)}</div>` : ''}
    <div class="cu-actions">
      <button class="start-wo wide" onclick="cuSuggest()"${PICK.busy ? ' disabled' : ''}>Sugerir treino</button>
      <button class="reset-btn" onclick="cuHome()">← Treino programado</button>
    </div>
    ${past ? `<div class="cu-title">Últimos personalizados</div>${past}` : ''}
  </div>`;
}

function labelOf(ex) {
  const ids = idsOf(ex.name);
  const g = GROUPS.find(x => ids.some(id => x.ids.includes(id)));
  return g ? g.label : '';
}

/* Antes de começar: que treino programado este vai ocupar (informação, não decisão). */
function slotNote() {
  const slot = slotToReplace();
  return slot
    ? `Ao concluir, ocupa o lugar de <b>${esc(slot)}</b> (não conta como feito). O plano não é alterado.`
    : 'Hoje não ocupa nenhum treino do plano, que não é alterado.';
}

function renderReview(content, c) {
  setHeader('Treino personalizado · a rever');
  const rows = c.ex.map((ex, i) => `
    <div class="cu-row">
      <span class="cu-n">${i + 1}</span>
      <span class="cu-info"><b>${esc(ex.name)}</b><small>${esc(ex.s)} × ${esc(ex.r)}${labelOf(ex) ? ` · ${esc(labelOf(ex))}` : ''}</small></span>
      <button class="reset-btn" onclick="openSwap('${CUSTOM_DAY}',${i})" aria-label="Trocar" title="Trocar por um equivalente">🔄</button>
      <button class="reset-btn" onclick="cuRemove(${i})" aria-label="Remover">✕</button>
    </div>`).join('');
  content.innerHTML = `<div class="full">
    ${headHTML(`${esc(c.label)} · só hoje`)}
    ${c.offline ? '<div class="sched-note warn">Sem catálogo (offline): só saíram exercícios do teu plano.</div>' : ''}
    ${rows || '<div class="cat-msg">Sem exercícios. Adiciona algum ou cancela.</div>'}
    <div class="cu-actions">
      <button class="start-wo wide" onclick="cuBegin()"${c.ex.length ? '' : ' disabled'}>▶ Começar treino</button>
      <button class="reset-btn" onclick="cuAdd()">＋ Exercício</button>
      <button class="reset-btn" onclick="cuDiscard()">✕ Cancelar</button>
    </div>
    <div class="cu-note">${slotNote()}</div>
  </div>`;
}

function renderActive(content, c) {
  content.innerHTML = headHTML(`${esc(c.label)} · só hoje`, `
      <button class="start-wo" onclick="startWorkout('${CUSTOM_DAY}')">▶ Guiado</button>
      <button class="reset-btn" onclick="cuAdd()">＋</button>
      <button class="reset-btn" onclick="cuDiscard()">✕ Descartar</button>`);
  c.ex.forEach((ex, i) => content.appendChild(buildCard(CUSTOM_DAY, ex, i)));
  const foot = document.createElement('div');
  foot.className = 'day-foot';
  foot.innerHTML = `<button class="start-wo wide" onclick="cuFinish()">✓ Concluir treino</button>`;
  content.appendChild(foot);
  refreshProgress();
}

function renderDone(content, c) {
  setHeader('Treino personalizado · concluído', 100);
  content.innerHTML = `<div class="full"><div class="rest-card">
    <div class="rest-emoji">🎉</div>
    <div class="rest-title">Treino personalizado concluído</div>
    <div class="rest-sub">${esc(c.label)} · ${c.ex.length} exercício${c.ex.length === 1 ? '' : 's'} · ${c.sets || 0} séries.
      Ficou no histórico como personalizado. ${c.replaced
        ? `Ocupou o lugar de <b>${esc(c.replaced)}</b>; o resto da semana segue igual.`
        : 'Não ocupou nenhum treino do plano.'}</div>
    <button class="start-wo" onclick="cuHome()">← Voltar a Hoje</button>
  </div></div>`;
}

function renderCustom(content) {
  expireCustom();
  content.innerHTML = '';
  const c = ST.custom;
  if (!valid(c)) return renderPicker(content);
  if (c.stage === 'done') return renderDone(content, c);
  if (c.stage === 'active') return renderActive(content, c);
  return renderReview(content, c);
}

export {
  PICK, isLive, valid, clearCustomProgress, expireCustom, idsOf, buildPool,
  openCustom, cuToggle, cuSuggest, cuRemove, cuAdd, cuBegin, cuHome, cuDiscard, cuFinish,
  customEntryHTML, renderCustom,
};
