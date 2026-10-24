/* myTraining — aulas de ginásio: cartões (Hoje, Semana, Histórico), secção do Plano e folha de criar/editar.
   Toda a lógica e os dados estão em classes.js; aqui só há apresentação e handlers (registados em bridge.js). */
import { MODALITIES, addClass, applyMove, classList, conflictFor, dateOfDay, markClass, occurrences, occurrencesOn, recentClasses, reopenClass, removeClass, setReplaceIntent, updateClass } from './classes.js';
import { confirmDialog } from './dialog.js';
import { show } from './notice.js';
import { closeOverlay, openOverlay } from './overlay.js';
import { WEEK } from './planner.js';
import { SHORT } from './schedule.js';
import { ST, esc, todayStr } from './state.js';
import { render } from './ui.js';

const STATUS_LABEL = { planned: 'Planeada', done: 'Feita', cancelled: 'Cancelada', replaced: 'Substituída' };
const INTENSITY = [[1, 'Leve'], [2, 'Moderada'], [3, 'Intensa']];
const modality = id => MODALITIES.find(m => m.id === id) || MODALITIES[MODALITIES.length - 1];
const fmtDate = d => String(d).split('-').reverse().slice(0, 2).join('/');

/* ── cartões ─────────────────────────────────────────────────────────────── */

function actionsHTML(o) {
  const a = `'${o.cls.id}','${o.date}'`;
  if (o.status !== 'planned') return `<button class="reset-btn btn-ghost" onclick="clReopen(${a})">Reabrir</button>`;
  if (o.date > todayStr()) return '';   /* aula futura: ainda não há nada a assinalar */
  return `<button class="reset-btn btn-secondary" onclick="clMark(${a},'done')">✓ Fiz</button>
    <button class="reset-btn btn-ghost" onclick="clMark(${a},'cancelled')">Cancelada</button>
    <button class="reset-btn btn-ghost" onclick="clMark(${a},'replaced')">Substituída</button>`;
}

function rowHTML(o, withDay) {
  const c = o.cls, place = c.place ? ` · ${esc(c.place)}` : '';
  const sub = `${withDay ? `${SHORT[o.day]} ${fmtDate(o.date)} · ` : ''}${esc(c.time)} · ${c.min} min${place}`;
  const note = o.replacesDay ? `<small class="cl-note">${o.status === 'done' ? 'Substituiu' : 'Vai substituir'} o treino de ${esc(o.replacesDay)}</small>` : '';
  return `<div class="cl-row s-${o.status}" data-class="${esc(c.id)}">
    <div class="cl-main"><div class="cl-name">🧘 ${esc(c.name)}</div><small>${sub}</small>${note}</div>
    <div class="cl-st">${STATUS_LABEL[o.status]}${o.pastDue ? ' · por assinalar' : ''}</div>
    <div class="cl-acts">${actionsHTML(o)}</div></div>`;
}

/* Hoje: as aulas de hoje e as anteriores da semana ainda por assinalar. */
function todayClassesHTML() {
  const t = todayStr();
  const list = occurrences().filter(o => o.date === t || (o.date < t && o.status === 'planned'));
  return list.length ? `<div class="cl-card"><div class="cu-title">Aulas</div>${list.map(o => rowHTML(o, o.date !== t)).join('')}</div>` : '';
}

/* Semana: todas as aulas desta semana, em linhas próprias (fora dos botões de treino). */
function weekClassesHTML() {
  const list = occurrences();
  return list.length ? `<div class="cu-title">Aulas desta semana</div><div class="cl-card">${list.map(o => rowHTML(o, true)).join('')}</div>` : '';
}

function recentClassesHTML() {
  const list = recentClasses(8);
  if (!list.length) return '';
  return `<div class="cu-title">Aulas recentes</div><div class="week-list">${list.map(o => `<div class="wk-row"><div class="wk-row-main">
    <div class="wk-row-day">${fmtDate(o.date)} · 🧘 ${esc(o.cls.name)}</div><div class="wk-row-sub">${esc(o.cls.time)} · ${o.cls.min} min</div></div>
    <div class="wk-row-st">${STATUS_LABEL[o.status]}</div></div>`).join('')}</div>`;
}

/* chips da semana: dias com aula levam um ponto (o estado do treino não muda) */
function classDayMarks() { return new Set(occurrences().filter(o => o.status !== 'cancelled').map(o => o.day)); }

/* Plano: a lista de aulas (modelos) e o botão de adicionar. */
function planClassesHTML() {
  const rows = classList().sort((a, b) => WEEK.indexOf(a.day) - WEEK.indexOf(b.day) || a.time.localeCompare(b.time)).map(c =>
    `<button type="button" class="wk-row" onclick="clOpen('${c.id}')"><div class="wk-row-main">
      <div class="wk-row-day">🧘 ${esc(c.name)}</div>
      <div class="wk-row-sub">${c.day} ${esc(c.time)} · ${c.min} min · ${c.weekly ? 'todas as semanas' : 'só esta semana'}</div></div>
      <div class="wk-row-st">Editar ›</div></button>`).join('');
  return `<div class="nsec-title">Aulas</div>${rows || '<div class="ndisc">Ainda não tens aulas. Adiciona as do teu ginásio para o calendário as ter em conta.</div>'}
    <button class="reset-btn btn-secondary" onclick="clOpen()">＋ Adicionar aula</button>`;
}

/* ── folha de criar/editar ───────────────────────────────────────────────── */

let F = null;   /* rascunho do formulário; null = fechada */

function sheet() {
  let bg = document.getElementById('classBg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'classBg'; bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet cl-sheet" role="dialog" aria-modal="true" aria-labelledby="clTitle"><div class="sheet-grip" aria-hidden="true"></div><div id="clBody"></div></div>';
    document.body.appendChild(bg);
  }
  return bg;
}
const chip = (js, on, text) => `<button type="button" class="ob-chip${on ? ' on' : ''}" onclick="${js}" aria-pressed="${on}">${text}</button>`;

function formHTML() {
  const m = modality(F.kind);
  return `<h2 class="sheet-title" id="clTitle">${F.id ? 'Editar aula' : 'Nova aula'}</h2>
    <div class="cl-lbl" id="clKind">Modalidade</div>
    <div class="ob-row" role="group" aria-labelledby="clKind">${MODALITIES.map(x => chip(`clSet('kind','${x.id}')`, F.kind === x.id, x.label)).join('')}</div>
    ${F.kind === 'custom' ? `<label class="cl-lbl" for="clName">Nome da aula</label><input id="clName" class="cl-in" type="text" maxlength="40" value="${esc(F.name)}" oninput="clText('name',this.value)">` : ''}
    <div class="cl-lbl" id="clDayL">Dia</div>
    <div class="ob-row" role="group" aria-labelledby="clDayL">${WEEK.map(d => chip(`clSet('day','${d}')`, F.day === d, SHORT[d])).join('')}</div>
    <div class="cl-two"><div><label class="cl-lbl" for="clTime">Hora</label><input id="clTime" class="cl-in" type="time" value="${esc(F.time)}" oninput="clText('time',this.value)"></div>
    <div><label class="cl-lbl" for="clMin">Duração (min)</label><input id="clMin" class="cl-in" type="number" inputmode="numeric" min="5" max="240" value="${esc(F.min)}" oninput="clText('min',this.value)"></div></div>
    <label class="cl-lbl" for="clPlace">Local (opcional)</label><input id="clPlace" class="cl-in" type="text" maxlength="40" value="${esc(F.place)}" oninput="clText('place',this.value)">
    <div class="cl-lbl" id="clInt">Intensidade</div>
    <div class="ob-row" role="group" aria-labelledby="clInt">${INTENSITY.map(([v, t]) => chip(`clSet('intensity',${v})`, F.intensity === v, t)).join('')}</div>
    <div class="ob-row">${chip(`clSet('weekly',${!F.weekly})`, F.weekly, 'Repete todas as semanas').replace('ob-chip', 'ob-chip multi')}</div>
    <div class="inline-error" id="clErr" role="alert"></div>
    <button class="start-wo btn-primary" onclick="clSave()">Guardar aula</button>
    ${F.id ? '<button class="reset-btn btn-ghost" onclick="clDelete()">Apagar aula</button>' : ''}
    <button class="reset-btn btn-ghost" onclick="clClose()">Cancelar</button>
    <small class="cl-note">${esc(m.type)} · intensidade típica: ${INTENSITY[m.intensity - 1][1].toLowerCase()}</small>`;
}

function conflictHTML() {
  const c = F.c, moving = F.step === 'move';
  if (moving) return `<h2 class="sheet-title" id="clTitle">Mudar o treino de ${esc(c.day)}</h2>
    <p class="ob-p">Escolhe o dia para onde vai o treino. A troca é <b>permanente</b> na rotina (os dois dias trocam de lugar).</p>
    <div class="ob-row">${WEEK.filter(d => d !== c.day).map(d => chip(`clMove('${d}')`, false, SHORT[d])).join('')}</div>
    <button class="reset-btn btn-ghost" onclick="clConflict()">‹ Voltar</button>`;
  return `<h2 class="sheet-title" id="clTitle">Aula e treino no mesmo dia</h2>
    <p class="ob-p">${esc(c.day)} já tem o treino «${esc(c.label)}». ${esc(c.advice)} Nada muda no teu plano sem escolheres.</p>
    <button class="sheet-item" onclick="clKeep()"><span>Manter ambos</span><span class="sheet-arrow">›</span></button>
    <button class="sheet-item" onclick="clReplace()"><span>A aula substitui o treino de ${esc(c.day)}</span><span class="sheet-arrow">›</span></button>
    <button class="sheet-item" onclick="clMoveStep()"><span>Mudar o treino para outro dia</span><span class="sheet-arrow">›</span></button>`;
}

function paint() { document.getElementById('clBody').innerHTML = F.step ? conflictHTML() : formHTML(); }
function again() { render(ST.view && ST.view.startsWith('__') && ST.view !== '__dia' ? ST.view : '__hoje'); }

function clOpen(id) {
  const c = id ? classList().find(x => x.id === id) : null;
  F = c ? { id, kind: c.kind, name: c.kind === 'custom' ? c.name : '', day: c.day, time: c.time, min: String(c.min), place: c.place || '', weekly: c.weekly, intensity: c.intensity, date: c.date }
    : { kind: 'pilates', name: '', day: WEEK[(new Date().getDay() + 6) % 7], time: '18:00', min: '60', place: '', weekly: true, intensity: 1 };
  sheet();
  paint();
  openOverlay(sheet(), { onClose: clClose });
}
function clClose() { F = null; closeOverlay(sheet()); }

function clSet(k, v) {
  F[k] = v;
  if (k === 'day' || k === 'weekly') F.date = undefined;   /* reagendar é uma escolha explícita; guardar sem mexer conserva a data */
  if (k === 'kind') { F.intensity = modality(v).intensity; if (v !== 'custom') F.name = ''; }
  paint();
}
function clText(k, v) { F[k] = v; }

function clSave() {
  const m = modality(F.kind), name = F.kind === 'custom' ? F.name.trim() : m.label;
  const input = { kind: F.kind, name, day: F.day, time: F.time, min: Number(F.min), intensity: F.intensity, weekly: F.weekly, place: F.place.trim() || undefined, date: F.weekly ? undefined : (F.date || dateOfDay(F.day)) };
  const old = F.id && classList().find(x => x.id === F.id);
  if (old && (old.day !== F.day || old.weekly !== F.weekly)) setReplaceIntent(old.id, old.weekly ? dateOfDay(old.day) : old.date, null);   /* a intenção era do dia antigo */
  const r = F.id ? updateClass(F.id, input) : addClass(input);
  if (!r.ok) { document.getElementById('clErr').textContent = r.error; return; }
  const cls = r.cls || classList().find(x => x.id === F.id);
  const date = cls.weekly ? dateOfDay(cls.day) : cls.date, logged = occurrencesOn(date).some(o => o.cls.id === cls.id && o.status !== 'planned');
  const conflict = logged ? null : conflictFor(cls, date);
  if (!conflict) { clClose(); again(); return; }
  F = { ...F, step: 'conflict', c: { ...conflict, clsId: cls.id, date } };
  paint(); again();
}
function clConflict() { F.step = 'conflict'; paint(); }
function clKeep() {
  const r = setReplaceIntent(F.c.clsId, F.c.date, null);   /* «manter ambos» desfaz uma substituição escolhida antes */
  if (!r.ok) { show(r.error, 'error'); return; }
  clClose(); again();
}
function clMoveStep() { F.step = 'move'; paint(); }

function clReplace() {
  const { clsId, date, day } = F.c, r = setReplaceIntent(clsId, date, day);
  if (!r.ok) { show(r.error, 'error'); return; }
  clClose(); again();
  show(`Quando marcares a aula como feita, o treino de ${day} fica substituído.`, 'ok');
}

async function clMove(target) {
  const { day, date } = F.c;
  if (!await confirmDialog({ title: 'Mudar o treino de dia', message: `${day} e ${target} trocam de treino de forma permanente na rotina. Continuar?`, confirmLabel: 'Trocar' })) return;
  const r = applyMove(day, target, date);
  clClose(); again();
  show(r.ok ? `Treino mudado: ${day} ↔ ${target}.` : r.error, r.ok ? 'ok' : 'error');
}

async function clDelete() {
  if (!await confirmDialog({ title: 'Apagar aula', message: 'As aulas já assinaladas ficam no histórico. Apagar esta aula do calendário?', danger: true, confirmLabel: 'Apagar' })) return;
  const r = removeClass(F.id);
  if (!r.ok) { document.getElementById('clErr').textContent = r.error; return; }
  clClose(); again();
}

function clMark(id, date, status) {
  const r = markClass(id, date, status);
  if (!r.ok) show(r.error, 'error');
  again();
}
function clReopen(id, date) {
  const r = reopenClass(id, date);
  if (!r.ok) show(r.error, 'error');
  again();
}

export {
  todayClassesHTML, weekClassesHTML, recentClassesHTML, planClassesHTML, classDayMarks,
  clOpen, clClose, clSet, clText, clSave, clConflict, clKeep, clMoveStep, clReplace, clMove, clDelete, clMark, clReopen,
};
