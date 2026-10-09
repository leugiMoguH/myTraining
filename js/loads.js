/* myTraining — módulo extraído de index.html (Fase 0). */
import { chartSVG } from './charts.js';
import { CUSTOM_DAY } from './routine.js';
import { SCHEMES, configOf, evaluate, progHint } from './progression.js';
import { ST, esc, est1RM, fmtDateTime, getLog, logSet, setProg } from './state.js';

/* ═══════════════ CARGA / PROGRESSÃO (UI) ════════════ */
function saveLoad(i,name){
  const wEl=document.getElementById(`w-${i}`), rEl=document.getElementById(`r-${i}`);
  if(!wEl||!rEl) return;
  const btn=document.querySelector(`#load-${i} .load-save`);
  if(logSet(name, wEl.value, rEl.value, ST.view==='__pers', ST.view==='__pers' ? CUSTOM_DAY : ST.day)){
    if(btn){ btn.textContent='✓'; btn.classList.add('ok'); setTimeout(()=>{ btn.textContent='Registar'; btn.classList.remove('ok'); },900); }
    const lc=document.getElementById(`lc-${i}`);
    if(lc && !lc.hidden) lc.innerHTML=loadChart(name,i);
  } else if(btn){
    btn.textContent='kg × reps?'; setTimeout(()=>{ btn.textContent='Registar'; },1100);
  }
}

function toggleChart(i,name){
  const lc=document.getElementById(`lc-${i}`);
  if(!lc) return;
  if(lc.hidden){ lc.innerHTML=loadChart(name,i); lc.hidden=false; }
  else lc.hidden=true;
}


/* Escolher o esquema e o salto de peso, por exercício. Fica em ST.prog[nome],
   indexado pelo nome como o histórico. */
function progScheme(i,name,scheme){ if(setProg(name,{scheme})) repaint(i,name); }

function progInc(i,name,value){
  const n=parseFloat(value);
  setProg(name, { inc: n>0 ? n : 0 });      /* 0 ou lixo → volta ao predefinido */
  repaint(i,name);
}

function repaint(i,name){
  const lc=document.getElementById(`lc-${i}`);
  if(lc && !lc.hidden) lc.innerHTML=loadChart(name,i);
}

function progPanel(name,i){
  const cfg=configOf(name);
  const e=evaluate(name);
  const js=String(name).replace(/'/g,"\\'");
  if(e.kind==='none') return `<div class="lc-prog"><div class="lc-prog-m">${e.msg}</div></div>`;
  return `
    <div class="lc-prog">
      <div class="lc-prog-t">Esquema de progressão</div>
      <div class="cat-chips">${Object.keys(SCHEMES).map(k=>
        `<button class="cat-chip${cfg.scheme===k?' on':''}" onclick="progScheme(${i},'${js}','${k}')">${esc(SCHEMES[k])}</button>`).join('')}</div>
      <label class="lc-inc">Salto de peso
        <input type="number" min="0" step="0.5" value="${cfg.inc}" onchange="progInc(${i},'${js}',this.value)"> kg
      </label>
      <div class="lc-prog-m">${e.msg}</div>
    </div>`;
}

function loadChart(name,i){
  const data=getLog(name);
  if(!data.length) return '<div class="lc-empty">Sem registos. Regista a carga (kg × reps) para veres a evolução.</div>'+progPanel(name,i);
  const ws=data.map(e=>e.w), min=Math.min(...ws), max=Math.max(...ws), n=data.length, last=data[n-1];
  return chartSVG(ws)+`
    <div class="lc-meta">
      <span><b>${last.w}</b>kg × ${last.r}</span>
      <span class="lc-1rm">1RM ~${est1RM(last.w,last.r)}kg</span>
      <span class="lc-range">${n} ${n===1?'registo':'registos'} · ${min}–${max}kg</span>
      ${last.ts?`<span class="lc-when">últ. ${fmtDateTime(last.ts)}</span>`:''}
    </div>
    <button class="reset-btn hx-link" data-n="${esc(name)}" onclick="hxOpen(this.dataset.n)">Histórico detalhado ›</button>
    ${progHint(name)?`<div class="lc-next">${progHint(name)} <span class="lc-next-s">— progressão sugerida</span></div>`:''}
    ${progPanel(name,i)}`;
}

export { saveLoad, toggleChart, loadChart, progPanel, progScheme, progInc };
