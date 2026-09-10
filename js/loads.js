/* myTraining — módulo extraído de index.html (Fase 0). */
import { chartSVG } from './charts.js';
import { progHint } from './progression.js';
import { est1RM, fmtDateTime, getLog, logSet, save } from './state.js';

/* ═══════════════ CARGA / PROGRESSÃO (UI) ════════════ */
function saveLoad(i,name){
  const wEl=document.getElementById(`w-${i}`), rEl=document.getElementById(`r-${i}`);
  if(!wEl||!rEl) return;
  const btn=document.querySelector(`#load-${i} .load-save`);
  if(logSet(name, wEl.value, rEl.value)){
    if(btn){ btn.textContent='✓'; btn.classList.add('ok'); setTimeout(()=>{ btn.textContent='Registar'; btn.classList.remove('ok'); },900); }
    const lc=document.getElementById(`lc-${i}`);
    if(lc && !lc.hidden) lc.innerHTML=loadChart(name);
  } else if(btn){
    btn.textContent='kg × reps?'; setTimeout(()=>{ btn.textContent='Registar'; },1100);
  }
}

function toggleChart(i,name){
  const lc=document.getElementById(`lc-${i}`);
  if(!lc) return;
  if(lc.hidden){ lc.innerHTML=loadChart(name); lc.hidden=false; }
  else lc.hidden=true;
}


function loadChart(name){
  const data=getLog(name);
  if(!data.length) return '<div class="lc-empty">Sem registos. Regista a carga (kg × reps) para veres a evolução.</div>';
  const ws=data.map(e=>e.w), min=Math.min(...ws), max=Math.max(...ws), n=data.length, last=data[n-1];
  return chartSVG(ws)+`
    <div class="lc-meta">
      <span><b>${last.w}</b>kg × ${last.r}</span>
      <span class="lc-1rm">1RM ~${est1RM(last.w,last.r)}kg</span>
      <span class="lc-range">${n} ${n===1?'registo':'registos'} · ${min}–${max}kg</span>
      ${last.ts?`<span class="lc-when">últ. ${fmtDateTime(last.ts)}</span>`:''}
    </div>
    ${progHint(name)?`<div class="lc-next">${progHint(name)} <span class="lc-next-s">— progressão sugerida</span></div>`:''}`;
}

export { saveLoad, toggleChart, loadChart };
