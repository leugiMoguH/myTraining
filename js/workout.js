/* myTraining — módulo extraído de index.html (Fase 0). */
import { gifUrlFor } from './catalog.js';
import { MUSCLES, bodySVG } from './charts.js';
import { CUSTOM_DAY, DAYS } from './routine.js';
import { openInfo } from './guide.js';
import { DEMOS, demoUrl } from './media.js';
import { configOf, progHint } from './progression.js';
import { ACTIVE, PAUSED, completeSession, currentSession, fmtDur, isLive, notifySession, pauseSession, resumeSession, sessionState, setSessionPos, startSession, timeStats, touchSession } from './session.js';
import { addSetLog, esc, getLog, getSets, lastSetOf, logDate, logSet, toggleSet } from './state.js';
import { cuFinish } from './custom.js';
import { timerDismiss } from './timer.js';
import { render } from './ui.js';
import { acquireWake, releaseWake, wakeWanted } from './wake.js';

/* ═══════════ TREINO DE HOJE (guiado) ═══════════ */
const WO={day:null,idx:0,clock:null};
const clockTxt=()=>fmtDur(timeStats().duration);
/* o relógio é a duração (medida); o resto vem discriminado, nunca somado às escondidas */
function statsTxt(){ const t=timeStats(); return `pausa ${fmtDur(t.paused)} · confirmado ${fmtDur(t.confirmed)} · sem registo ${fmtDur(t.unknown)}`; }
function startWorkout(day){
  if(!DAYS[day] || !DAYS[day].ex.length) return;
  const live=isLive()?currentSession():null;
  /* nunca duas sessões: com outro treino em curso, oferece-se retomá-lo em vez de misturar registos */
  if(live && live.day!==day){
    if(confirm(`Já tens o treino de ${live.day} em curso. Retomá-lo?`)) openWorkout(live.day, live.pos);
    return;
  }
  if(!live) startSession(day,DAYS[day].label);   /* só um toque do utilizador inicia a sessão */
  openWorkout(day, isLive() && currentSession().day===day ? currentSession().pos : 0);
}
/* abre a vista guiada sem tocar na sessão (também usada para retomar após refresh) */
function openWorkout(day, idx=0){
  if(!DAYS[day] || !DAYS[day].ex.length) return false;
  WO.day=day; WO.idx=Math.max(0,Math.min(DAYS[day].ex.length-1,idx|0));
  setSessionPos(WO.idx);
  touchSession(Date.now(),false);   /* o utilizador está presente; o intervalo anterior não se confirma */
  document.getElementById('woBg').classList.add('show'); acquireWake(); woRender();
  clearInterval(WO.clock); WO.clock=setInterval(()=>{ const c=document.getElementById('wo-clock'); if(c){ c.textContent=clockTxt(); const x=document.getElementById('wo-stats'); if(x) x.textContent=statsTxt(); } },1000);
  notifySession();
  return true;
}
/* fechar a vista não toca na sessão: continua ACTIVE/PAUSED */
function closeWorkout(){ clearInterval(WO.clock); document.getElementById('woBg').classList.remove('show'); if(!wakeWanted) releaseWake(); render(WO.day); notifySession(); }
function woGo(d){ const ex=DAYS[WO.day].ex; WO.idx=Math.max(0,Math.min(ex.length-1,WO.idx+d)); setSessionPos(WO.idx); woRender(); }
function woToggle(si){ toggleSet(WO.day,WO.idx,si); woRender(); }
function woSaveLoad(){
  const w=document.getElementById('wo-w').value, r=document.getElementById('wo-r').value;
  if(logSet(DAYS[WO.day].ex[WO.idx].name,w,r,WO.day===CUSTOM_DAY,WO.day)){ const b=document.querySelector('#woBody .load-save'); if(b){ b.textContent='✓'; setTimeout(()=>{b.textContent='Registar';},900); } }
  else alert('Indica kg e reps válidos.');
}
/* ajuste rápido: kg usa o salto do exercício, reps ±1 */
function woStep(field,dir){
  const el=document.getElementById(field==='w'?'wo-w':'wo-r'); if(!el) return;
  const step=field==='w'?(configOf(DAYS[WO.day].ex[WO.idx].name).inc||2.5):1;
  el.value=Math.max(0,Math.round(((parseFloat(el.value)||0)+dir*step)*100)/100)||'';
}
/* um toque: marca a próxima série, regista kg×reps (pré-preenchidos) e arranca o descanso */
let lastTap=0;
function woDoSet(){
  if(sessionState()!==ACTIVE || Date.now()-lastTap<400) return;   /* duplo toque acidental */
  lastTap=Date.now();
  const ex=DAYS[WO.day].ex[WO.idx], sets=getSets(WO.day,WO.idx), total=typeof ex.s==='number'?ex.s:0;
  const si=Array.from({length:total},(_,j)=>j).find(j=>!sets.includes(j));
  if(si===undefined) return;
  const w=document.getElementById('wo-w').value, r=document.getElementById('wo-r').value;
  if(!addSetLog(ex.name,w,r,WO.day===CUSTOM_DAY,`${WO.day}:${si}`,WO.day)){ alert('Indica kg e reps válidos.'); return; }
  toggleSet(WO.day,WO.idx,si);
  touchSession();
  woRender();
}
/* desfaz a última série EXECUTADA (a de registo mais recente), não a de maior índice */
function woUndo(){
  const ex=DAYS[WO.day].ex[WO.idx], sets=getSets(WO.day,WO.idx); if(!sets.length) return;
  const t=getLog(ex.name).find(e=>e.date===logDate(WO.day)), pre=`${WO.day}:`;
  const L=t&&t.sets?[...t.sets].reverse().find(x=>x.k&&x.k.startsWith(pre)&&sets.includes(+x.k.slice(pre.length))):null;
  let si=L?+L.k.slice(pre.length):NaN;
  if(!sets.includes(si)) si=Math.max(...sets);
  toggleSet(WO.day,WO.idx,si);
  timerDismiss(); woRender();
}
function woPause(){ if(sessionState()===ACTIVE) pauseSession(); else resumeSession(); woRender(); }
function woFinish(){
  if(!confirm('Terminar o treino? Fica guardado no histórico.')) return;
  /* o personalizado tem o seu próprio fecho (regista a sessão e substitui o treino do dia) */
  if(WO.day===CUSTOM_DAY){ closeWorkout(); cuFinish(); return; }
  completeSession(); closeWorkout();
}
function woRender(){
  const day=WO.day, i=WO.idx, ex=DAYS[day].ex[i], total=DAYS[day].ex.length;
  /* mesma regra dos cartões: exercício do catálogo traz o GIF e os músculos consigo */
  const mm=MUSCLES[ex.name] || (ex.mus && ex.mus.p && ex.mus.p.length ? ex.mus : null);
  const dmo=DEMOS[ex.name];
  const media=ex.catalogId&&ex.m
    ? `<img class="wo-img cat-gif" src="${gifUrlFor(ex.catalogId,ex.m)}" alt="" onerror="this.style.display='none'">`
    : (dmo?`<img class="wo-img" src="${demoUrl(dmo,0)}" alt="" onerror="this.style.display='none'">`:(mm?bodySVG(mm.p,mm.s):''));
  const sets=getSets(day,i), totalSets=typeof ex.s==='number'?ex.s:0;
  const setBtns=totalSets?Array.from({length:totalSets},(_,si)=>`<button class="wo-set${sets.includes(si)?' on':''}" onclick="woToggle(${si})" aria-label="Série ${si+1}">${si+1}</button>`).join(''):'';
  const last=lastSetOf(ex.name,day), hint=progHint(ex.name);
  const st=sessionState(), paused=st===PAUSED, allDone=totalSets>0&&sets.length>=totalSets;
  const nextEx=DAYS[day].ex[i+1];
  let main='';
  if(totalSets){
    if(paused) main=`<button class="wo-main" onclick="woPause()">▶ Retomar treino</button>`;
    else if(allDone) main=`<button class="wo-main next" onclick="${i>=total-1?'woFinish()':'woGo(1)'}">${i>=total-1?'Terminar treino ✓':'Próximo: '+esc(nextEx.name)+' ›'}</button>`;
    else main=`<button class="wo-main" onclick="woDoSet()">✓ Série ${sets.length+1} de ${totalSets}</button>`;
  }
  document.getElementById('woBody').innerHTML=`
    <div class="wo-top"><span class="wo-count">${i+1}/${total}</span><span class="wo-day">${day} · ${DAYS[day].label}</span>
      <span class="wo-clock${paused?' paused':''}"><span id="wo-clock">${clockTxt()}</span>${paused?' ⏸':''}</span></div>
    <div class="wo-stats" id="wo-stats">${statsTxt()}</div>
    <div class="wo-media">${media}</div>
    <div class="wo-name">${esc(ex.name)}</div>
    <div class="wo-meta">${ex.s} séries · ${ex.r} reps</div>
    ${totalSets?`<div class="wo-sets">${setBtns}</div>`:''}
    ${totalSets?`<div class="wo-load">
      <button class="wo-step" onclick="woStep('w',-1)" aria-label="Menos peso">−</button><input id="wo-w" class="load-in" type="number" inputmode="decimal" placeholder="kg" value="${last?last.w:''}" aria-label="Peso (kg)"><button class="wo-step" onclick="woStep('w',1)" aria-label="Mais peso">+</button>
      <span class="load-x">×</span>
      <button class="wo-step" onclick="woStep('r',-1)" aria-label="Menos reps">−</button><input id="wo-r" class="load-in" type="number" inputmode="numeric" placeholder="reps" value="${last?last.r:''}" aria-label="Repetições"><button class="wo-step" onclick="woStep('r',1)" aria-label="Mais reps">+</button></div>`:''}
    ${main}
    <div class="wo-row2">
      ${sets.length?`<button class="wo-navbtn" onclick="woUndo()">↶ Desfazer série</button>`:''}
      ${st===ACTIVE?`<button class="wo-navbtn" onclick="woPause()">⏸ Pausa</button>`:''}
      <button class="wo-navbtn" onclick="woFinish()">■ Terminar</button>
    </div>
    ${hint?`<div class="wo-hint">${hint}</div>`:''}
    ${ex.tip?`<div class="tip">💡 ${esc(ex.tip)}</div>`:''}
    <button class="wo-info" onclick="openInfo('${ex.name.replace(/'/g,"\\'")}','${ex.catalogId||''}')">ℹ Ficha técnica</button>
    <div class="wo-nav">
      <button class="wo-navbtn" ${i===0?'disabled':''} onclick="woGo(-1)">‹ Anterior</button>
      <button class="wo-navbtn" ${i>=total-1?'disabled':''} onclick="woGo(1)">Próximo ›</button>
    </div>`;
}

/* a sessão pode mudar por fora (ex.: pausada ao reabrir): repinta a vista se estiver aberta */
function refreshWorkout(){ if(WO.day && document.getElementById('woBg').classList.contains('show')) woRender(); }

export { WO, startWorkout, openWorkout, refreshWorkout, closeWorkout, woGo, woToggle, woSaveLoad, woRender, woStep, woDoSet, woUndo, woPause, woFinish };
