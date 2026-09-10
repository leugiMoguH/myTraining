/* Modo de edição de um dia: reordenar, apagar, mudar séries/reps, adicionar do catálogo. */
import { openCatalog } from './catalog-ui.js';
import { exercisesOf, moveExercise, removeExercise, updateExercise, resetRoutine, setDayLabel, getDay } from './routine.js';
import { esc } from './state.js';
import { render } from './ui.js';

const ED = { day: null };

function isEditing(day) { return ED.day === day; }
function toggleEdit(day) { ED.day = isEditing(day) ? null : day; render(day); }
function stopEdit() { ED.day = null; }

function edMove(day, i, dir) { if (moveExercise(day, i, dir)) render(day); }

function edRemove(day, i) {
  const ex = exercisesOf(day)[i];
  if (!ex || !confirm(`Remover "${ex.name}" de ${day}?\n\nO histórico de cargas deste exercício não se perde.`)) return;
  if (removeExercise(day, i)) render(day);
}

/* Séries vazio ou 0 = exercício sem contagem (cardio, mobilidade) → guarda "-". */
function edField(day, i, field, value) {
  if (field === 's') {
    const n = parseInt(value, 10);
    updateExercise(day, i, { s: n > 0 ? Math.min(n, 12) : '-' });
  } else {
    updateExercise(day, i, { r: String(value).slice(0, 20) });
  }
  render(day);
}

function edLabel(day, value) { if (setDayLabel(day, value)) render(day); }

function edReset(day) {
  if (!confirm('Repor o plano original?\n\nPerdes os exercícios que acrescentaste e as séries marcadas. O histórico de cargas fica.')) return;
  resetRoutine();
  stopEdit();
  render(day);
}

function edAdd(day) { openCatalog(day); }

function editorHTML(day) {
  const d = getDay(day);
  const ex = exercisesOf(day);
  const rows = ex.map((e, i) => `
    <div class="ed-row">
      <div class="ed-ord">
        <button class="ed-btn" ${i === 0 ? 'disabled' : ''} onclick="edMove('${day}',${i},-1)" aria-label="Subir">▲</button>
        <button class="ed-btn" ${i === ex.length - 1 ? 'disabled' : ''} onclick="edMove('${day}',${i},1)" aria-label="Descer">▼</button>
      </div>
      <div class="ed-main">
        <div class="ed-name">${esc(e.name)}${e.catalogId ? '<span class="ed-tag">catálogo</span>' : ''}</div>
        <div class="ed-fields">
          <label>Séries<input type="number" min="0" max="12" value="${typeof e.s === 'number' ? e.s : 0}"
            onchange="edField('${day}',${i},'s',this.value)"></label>
          <label>Reps<input type="text" value="${esc(e.r)}" onchange="edField('${day}',${i},'r',this.value)"></label>
        </div>
      </div>
      <button class="ed-btn ed-del" onclick="edRemove('${day}',${i})" aria-label="Remover">✕</button>
    </div>`).join('');

  return `
    <div class="ed-wrap">
      <label class="ed-label">Nome do dia
        <input type="text" value="${esc(d ? d.label : '')}" onchange="edLabel('${day}',this.value)">
      </label>
      ${rows || '<div class="cat-msg">Este dia está vazio. Acrescenta exercícios do catálogo.</div>'}
      <button class="ed-add" onclick="edAdd('${day}')">＋ Adicionar exercício do catálogo</button>
      <button class="ed-reset" onclick="edReset('${day}')">↺ Repor plano original</button>
      <div class="ndisc">Reordenar ou remover leva o progresso das séries com o exercício. Mudar de nome
      não é possível de propósito: é o nome que liga ao histórico de cargas.</div>
    </div>`;
}

export { isEditing, toggleEdit, stopEdit, edMove, edRemove, edField, edLabel, edReset, edAdd, editorHTML };
