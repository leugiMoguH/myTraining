/* myTraining — adaptação do plano: cartão de sugestão no Hoje, nota «treino movido · Desfazer» e botão «Tenho pouco tempo».
   Regras e dados em adapt.js; aqui só apresentação e handlers (registados em bridge.js). Uma sugestão de cada vez, sempre com Recusar. */
import { dismiss, moveDay, startQuick, suggestion, undoMove } from './adapt.js';
import { isLive } from './custom.js';
import { show } from './notice.js';
import { dayNames } from './routine.js';
import { currentDay, dayStatus, moveOf } from './schedule.js';
import { liveDay } from './session.js';
import { ST, esc } from './state.js';
import { render } from './ui.js';

const hasMarks = day => Object.entries(ST.sets || {}).some(([k, v]) => k.startsWith(`${day}:`) && Array.isArray(v) && v.length);

/* O treino rápido só se oferece quando nada está em curso nesse dia e ainda não há séries marcadas. */
function canQuick(day) {
  return !!day && liveDay() === null && !isLive() && dayStatus(day) === 'todo' && !hasMarks(day);
}

function quickButtonHTML(day) {
  return canQuick(day)
    ? '<button class="reset-btn btn-secondary ad-quick" onclick="adQuick()">⏱ Hoje tenho pouco tempo</button>'
    : '';
}

/* treinos movidos «só esta semana»: aviso persistente com Desfazer (enquanto o treino não começar) */
function movedNoteHTML() {
  return dayNames().map(day => ({ day, m: moveOf(day) })).filter(x => x.m).map(({ day, m }) =>
    `<div class="sched-note ad-note"><span>↪ O treino de <b>${esc(day)}</b> passou para <b>${esc(m.to)}</b> (só esta semana).</span>
      <button class="reset-btn btn-ghost" onclick="adUndo('${esc(m.id)}')">Desfazer</button></div>`).join('');
}

function cardHTML(s) {
  const act = s.accept
    ? `<button class="start-wo btn-primary ad-yes" onclick="adAccept('${esc(s.key)}')">${esc(s.acceptLabel || 'Aceitar')}</button>` : '';
  const alt = s.alt ? `<button class="reset-btn btn-secondary" onclick="adAlt('${esc(s.key)}')">⏱ Versão rápida hoje</button>` : '';
  return `<div class="ad-card" role="region" aria-label="Sugestão">
    <div class="ad-what">${esc(s.what)}</div>
    <div class="ad-rec"><b>${esc(s.title)}</b></div>
    ${s.why ? `<div class="ad-why">${esc(s.why)}</div>` : ''}
    <div class="ad-acts">${act}${alt}<button class="reset-btn btn-ghost" onclick="adDismiss('${esc(s.key)}')">${s.accept ? 'Agora não' : 'Percebi'}</button></div></div>`;
}

function adaptCardHTML() {
  const s = suggestion();
  return movedNoteHTML() + (s ? cardHTML(s) : '');
}

const again = () => render('__hoje');

/* Revalida sempre: a sugestão pode ter ficado desatualizada entre ser mostrada e ser aceite. */
function adAccept(key) {
  const s = suggestion();
  if (!s || s.key !== key || !s.accept) { again(); return; }
  const a = s.accept;
  const r = a.type === 'move' ? moveDay(a.day, a.to, 'missed') : startQuick(a.day, a.mode || 'quick');
  if (!r.ok) { show(r.error, 'error'); again(); return; }
  if (a.type === 'move') { again(); show(`Treino de ${a.day} passou para ${a.to}. Podes desfazer em Hoje.`, 'ok'); } else render('__pers');
}

function adAlt(key) {
  const s = suggestion();
  if (!s || s.key !== key || !s.alt) { again(); return; }
  const r = startQuick(s.alt.day, s.alt.mode || 'quick');
  if (!r.ok) { show(r.error, 'error'); again(); return; }
  render('__pers');
}

function adDismiss(key) { dismiss(key); again(); }

function adUndo(id) {
  const r = undoMove(id);
  if (!r.ok) show(r.error, 'error');
  again();
}

function adQuick() {
  const r = startQuick(currentDay(), 'quick');
  if (!r.ok) { show(r.error, 'error'); again(); return; }
  render('__pers');
}

export { canQuick, quickButtonHTML, movedNoteHTML, adaptCardHTML, adAccept, adAlt, adDismiss, adUndo, adQuick };
