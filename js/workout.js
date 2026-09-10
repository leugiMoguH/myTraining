/* myTraining — módulo extraído de index.html (Fase 0). */
import { MUSCLES, bodySVG } from './charts.js';
import { DAYS } from './data.js';
import { openInfo } from './guide.js';
import { DEMOS, demoUrl } from './media.js';
import { progHint } from './progression.js';
import { esc, getLog, getSets, logSet, save, toggleSet } from './state.js';
import { render } from './ui.js';
import { acquireWake, releaseWake, wakeWanted } from './wake.js';

/* ═══════════ TREINO DE HOJE (guiado) ═══════════ */
const WO={day:null,idx:0};
function startWorkout(day){ WO.day=day; WO.idx=0; document.getElementById('woBg').classList.add('show'); acquireWake(); woRender(); }
function closeWorkout(){ document.getElementById('woBg').classList.remove('show'); if(!wakeWanted) releaseWake(); render(WO.day); }
function woGo(d){ const ex=DAYS[WO.day].ex; WO.idx=Math.max(0,Math.min(ex.length-1,WO.idx+d)); woRender(); }
function woToggle(si){ toggleSet(WO.day,WO.idx,si); woRender(); }
function woSaveLoad(){
  const w=document.getElementById('wo-w').value, r=document.getElementById('wo-r').value;
  if(logSet(DAYS[WO.day].ex[WO.idx].name,w,r)){ const b=document.querySelector('#woBody .load-save'); if(b){ b.textContent='✓'; setTimeout(()=>{b.textContent='Registar';},900); } }
  else alert('Indica kg e reps válidos.');
}
function woRender(){
  const day=WO.day, i=WO.idx, ex=DAYS[day].ex[i], total=DAYS[day].ex.length;
  const mm=MUSCLES[ex.name], dmo=DEMOS[ex.name];
  const media=dmo?`<img class="wo-img" src="${demoUrl(dmo,0)}" alt="" onerror="this.style.display='none'">`:(mm?bodySVG(mm.p,mm.s):'');
  const sets=getSets(day,i), totalSets=typeof ex.s==='number'?ex.s:0;
  const setBtns=totalSets?Array.from({length:totalSets},(_,si)=>`<button class="wo-set${sets.includes(si)?' on':''}" onclick="woToggle(${si})">${si+1}</button>`).join(''):'';
  const last=getLog(ex.name).slice(-1)[0], hint=progHint(ex.name);
  document.getElementById('woBody').innerHTML=`
    <div class="wo-top"><span class="wo-count">${i+1}/${total}</span><span class="wo-day">${day} · ${DAYS[day].label}</span></div>
    <div class="wo-media">${media}</div>
    <div class="wo-name">${esc(ex.name)}</div>
    <div class="wo-meta">${ex.s} séries · ${ex.r} reps</div>
    ${totalSets?`<div class="wo-sets">${setBtns}</div>`:''}
    ${totalSets?`<div class="wo-load"><input id="wo-w" class="load-in" type="number" inputmode="decimal" placeholder="kg" value="${last?last.w:''}"><span class="load-x">×</span><input id="wo-r" class="load-in" type="number" inputmode="numeric" placeholder="reps" value="${last?last.r:''}"><button class="load-save" onclick="woSaveLoad()">Registar</button></div>`:''}
    ${hint?`<div class="wo-hint">${hint}</div>`:''}
    ${ex.tip?`<div class="tip">💡 ${esc(ex.tip)}</div>`:''}
    <button class="wo-info" onclick="openInfo('${ex.name.replace(/'/g,"\\'")}')">ℹ Ficha técnica</button>
    <div class="wo-nav">
      <button class="wo-navbtn" ${i===0?'disabled':''} onclick="woGo(-1)">‹ Anterior</button>
      <button class="wo-navbtn next" onclick="${i>=total-1?'closeWorkout()':'woGo(1)'}">${i>=total-1?'Terminar ✓':'Próximo ›'}</button>
    </div>`;
}

export { WO, startWorkout, closeWorkout, woGo, woToggle, woSaveLoad, woRender };
