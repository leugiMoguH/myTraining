/* myTraining — ecrã Plano ('__plano'): a rotina planeada (consultar, editar um dia) e a gestão do plano.
   Distinto da Semana (Histórico), que é a agenda e o progresso desta semana. Sem estado próprio: lê ST.routine. */
import { isEditing, stopEdit, toggleEdit } from './editor.js';
import { planClassesHTML } from './classes-ui.js';
import { planCardHTML } from './onboarding.js';
import { estimateMin, isTraining } from './plan.js';
import { WEEK } from './planner.js';
import { DAYS } from './routine.js';
import { esc } from './state.js';
import { render, setBack } from './ui.js';

function dayRowHTML(w) {
  if (!isTraining(w)) return `<div class="wk-row s-rest"><div class="wk-row-main"><div class="wk-row-day">${w}</div><div class="wk-row-sub">Descanso</div></div></div>`;
  const d = DAYS[w];
  return `<details class="ob-card pl-day" data-day="${w}"><summary><b>${w} · ${esc(d.label)}</b><small>${d.ex.length} exercícios · ~${estimateMin(w)} min</small></summary>
    <ul>${d.ex.map(e => `<li>${esc(e.name)} <small>${typeof e.s === 'number' ? `${e.s}×${esc(e.r)}` : esc(e.r)}</small></li>`).join('')}</ul>
    <button class="reset-btn btn-secondary" onclick="planEdit('${w}')">✎ Editar ${w}</button></details>`;
}

function renderPlan(content) {
  content = content || document.getElementById('content');
  document.getElementById('hdrSub').textContent = 'Plano';
  document.getElementById('progFill').style.width = '0%';
  content.innerHTML = `<div class="nutri-wrap"><button class="reset-btn btn-ghost hx-back" onclick="render('__hoje')">‹ Início</button>${planCardHTML()}
    <div class="nsec-title">Rotina da semana</div>${WEEK.map(dayRowHTML).join('')}
    ${planClassesHTML()}
    <div class="ndisc">A agenda desta semana e o que já fizeste estão em Histórico.</div></div>`;
}

/* editar um dia a partir do Plano: o ecrã do dia mostra «‹ Plano» para voltar */
function planEdit(day) {
  setBack('__plano', 'Plano', day);
  if (isEditing(day)) render(day); else toggleEdit(day);
}
function planBack() { stopEdit(); render('__plano'); }

export { renderPlan, planEdit, planBack };
