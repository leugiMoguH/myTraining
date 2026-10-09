/* myTraining — treino guiado: um ecrã dedicado (não uma camada sobre o resto).
   Barra de cima: Sair da vista · exercício e tempo · Pausar/Retomar. Corpo: exercício, descanso (quando há) e,
   por baixo, ao alcance do polegar, kg × reps e UMA ação principal. Terminar a sessão é um botão à parte, discreto.
   Sair da vista NÃO termina a sessão. O descanso lê o relógio de timer.js (fim absoluto), não tem motor próprio. */
import { gifUrlFor } from './catalog.js';
import { CUSTOM_DAY, DAYS } from './routine.js';
import { cuFinish } from './custom.js';
import { openInfo } from './guide.js';
import { DEMOS, demoUrl } from './media.js';
import { configOf, progHint } from './progression.js';
import { ACTIVE, PAUSED, completeSession, currentSession, fmtDur, isLive, notifySession, pauseSession, resumeSession, sessionState, setSessionPos, startSession, timeStats, touchSession } from './session.js';
import { addSetLog, esc, getLog, getSets, lastSetOf, logDate, toggleSet } from './state.js';
import { TM, onTimerChange, timerDismiss } from './timer.js';
import { render } from './ui.js';
import { acquireWake, releaseWake, wakeWanted } from './wake.js';

const WO={day:null,idx:0,clock:null};
const el=id=>document.getElementById(id);
const guidedOpen=()=>el('woBg').classList.contains('show');
const clockTxt=()=>fmtDur(timeStats().duration);
/* com o guiado aberto o resto da app fica inerte (sem foco por teclado nem leitor de ecrã) */
function background(on){ for(const id of ['hdr','content','bnav']){ const e=el(id); if(e) e.inert=on; } }

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
/* abre o ecrã guiado sem tocar no estado da sessão (também usada para retomar após refresh) */
function openWorkout(day, idx=0){
  if(!DAYS[day] || !DAYS[day].ex.length) return false;
  WO.day=day; WO.idx=Math.max(0,Math.min(DAYS[day].ex.length-1,idx|0));
  setSessionPos(WO.idx);
  touchSession(Date.now(),false);   /* o utilizador está presente; o intervalo anterior não se confirma */
  document.body.classList.add('guided'); background(true);
  el('woBg').classList.add('show'); acquireWake(); woRender();
  clearInterval(WO.clock);
  WO.clock=setInterval(()=>{ const c=el('wo-clock'); if(c) c.textContent=clockTxt(); },1000);
  notifySession();
  return true;
}
/* Sair da vista: a sessão continua ACTIVE/PAUSED (a barra geral volta com a faixa "em curso") */
function closeWorkout(){
  clearInterval(WO.clock);
  el('woBg').classList.remove('show'); document.body.classList.remove('guided'); background(false);
  if(!wakeWanted) releaseWake();
  render(WO.day); notifySession();
}
function woGo(d){ const ex=DAYS[WO.day].ex; WO.idx=Math.max(0,Math.min(ex.length-1,WO.idx+d)); setSessionPos(WO.idx); woRender(); }
function woInfo(){ const ex=DAYS[WO.day].ex[WO.idx]; openInfo(ex.name, ex.catalogId||''); }

/* ajuste rápido: kg usa o salto do exercício, reps ±1 */
function woStep(field,dir){
  const inp=el(field==='w'?'wo-w':'wo-r'); if(!inp) return;
  const step=field==='w'?(configOf(DAYS[WO.day].ex[WO.idx].name).inc||2.5):1;
  inp.value=Math.max(0,Math.round(((parseFloat(inp.value)||0)+dir*step)*100)/100)||'';
  inp.classList.remove('bad');
}
/* um toque: marca a próxima série, regista kg×reps (pré-preenchidos) e arranca o descanso */
let lastTap=0;
function woDoSet(){
  if(sessionState()!==ACTIVE || Date.now()-lastTap<400) return;   /* duplo toque acidental */
  const ex=DAYS[WO.day].ex[WO.idx], sets=getSets(WO.day,WO.idx), total=typeof ex.s==='number'?ex.s:0;
  const si=Array.from({length:total},(_,j)=>j).find(j=>!sets.includes(j));
  if(si===undefined) return;
  const w=el('wo-w').value, r=el('wo-r').value;
  if(!addSetLog(ex.name,w,r,WO.day===CUSTOM_DAY,`${WO.day}:${si}`,WO.day)){
    /* sem alertas: o campo em falta fica marcado e em foco */
    const bad=[['wo-w',parseFloat(w)],['wo-r',parseInt(r,10)]].filter(([,v])=>!(v>0)).map(([id])=>el(id));   /* mesma regra de addSetLog */
    bad.forEach(i=>i.classList.add('bad')); if(bad[0]) bad[0].focus();
    return;
  }
  lastTap=Date.now();
  toggleSet(WO.day,WO.idx,si);   /* marca a série e arranca o descanso (timer.js) */
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
  timerDismiss();
  woRender();
}
function woPause(){ if(sessionState()===ACTIVE) pauseSession(); else resumeSession(); woRender(true); }
function woFinish(){
  if(!confirm('Terminar o treino? Fica guardado no histórico.')) return;
  /* o personalizado tem o seu próprio fecho (regista a sessão e substitui o treino do dia) */
  if(WO.day===CUSTOM_DAY){ closeWorkout(); cuFinish(); return; }
  completeSession(); closeWorkout();
}

/* O que vem a seguir ao descanso: a próxima série (com a carga prevista) ou o próximo exercício. */
function nextText(){
  const ex=DAYS[WO.day].ex[WO.idx], sets=getSets(WO.day,WO.idx), total=typeof ex.s==='number'?ex.s:0;
  if(total && sets.length<total){ const l=lastSetOf(ex.name,WO.day); return `Série ${sets.length+1} de ${total}${l?` · ${l.w} kg × ${l.r}`:''}`; }
  const n=DAYS[WO.day].ex[WO.idx+1];
  return n?esc(n.name):'fim do treino';
}
/* Só a zona do descanso é repintada quando o relógio começa/acaba/é saltado: os campos kg × reps não se tocam,
   por isso nunca se perde o que se está a escrever. */
function woRestSync(){
  const box=el('woRest'); if(!box || !guidedOpen()) return;
  if(!TM.on){ box.hidden=true; box.innerHTML=''; return; }
  const m=Math.floor(TM.left/60), s=String(TM.left%60).padStart(2,'0');
  box.hidden=false;
  box.innerHTML=`<div class="wo-rest-lbl">Descanso</div>
    <div class="wo-rest-num t-live">${m}:${s}</div>
    <div class="wo-rest-bar"><i class="t-bar" style="width:${TM.total>0?Math.round(TM.left/TM.total*100):0}%"></i></div>
    <div class="wo-rest-next">A seguir: ${nextText()}</div>
    <div class="wo-rest-btns"><button class="wo-btn" onclick="timerAdd(30)">+30 s</button><button class="wo-btn" onclick="timerDismiss()">Saltar</button></div>`;
}
onTimerChange(woRestSync);
/* a sessão pode mudar por fora (ex.: pausada ao reabrir): repinta o ecrã se estiver aberto */
function refreshWorkout(){ if(WO.day && guidedOpen()) woRender(true); }

function thumbOf(ex){
  const dmo=DEMOS[ex.name];
  const src=ex.catalogId&&ex.m ? gifUrlFor(ex.catalogId,ex.m) : (dmo?demoUrl(dmo,0):'');
  return src?`<img class="wo-thumb" src="${src}" alt="" onerror="this.style.display='none'">`:'';
}

let drawn=-1;   /* exercício desenhado por último */
/* keep: repintar sem perder o que o utilizador escreveu em kg/reps, o foco nem a posição do scroll (pausa, regresso à app) */
function woRender(keep){
  const sc=document.querySelector('.wo-scroll'), top=keep&&sc?sc.scrollTop:0;
  const fid=keep&&document.activeElement?document.activeElement.id:'';
  const draft=keep&&drawn===WO.idx&&el('wo-w')?{w:el('wo-w').value,r:el('wo-r').value}:null;
  const day=WO.day, i=WO.idx, ex=DAYS[day].ex[i], total=DAYS[day].ex.length;
  const sets=getSets(day,i), totalSets=typeof ex.s==='number'?ex.s:0;
  const st=sessionState(), paused=st===PAUSED, allDone=totalSets>0&&sets.length>=totalSets;
  const last=lastSetOf(ex.name,day), hint=progHint(ex.name), nextEx=DAYS[day].ex[i+1], lastEx=i>=total-1;
  const dots=totalSets?`<div class="wo-dots" role="img" aria-label="${sets.length} de ${totalSets} séries feitas">${Array.from({length:totalSets},(_,si)=>`<i class="${sets.includes(si)?'on':''}"></i>`).join('')}</div>`:'';
  const advance=lastEx?'woFinish()':'woGo(1)', advanceTxt=lastEx?'Terminar treino ✓':`Próximo: ${esc(nextEx.name)} ›`;
  let main;
  if(paused) main=`<button class="wo-main resume" onclick="woPause()">▶ Retomar treino</button>`;
  else if(!totalSets||allDone) main=`<button class="wo-main next" onclick="${advance}">${totalSets?advanceTxt:(lastEx?'Feito · terminar ✓':'Feito · próximo ›')}</button>`;
  else main=`<button class="wo-main" onclick="woDoSet()">✓ Concluir série ${sets.length+1}</button>`;
  const field=(id,val,ph,lbl,f,aria)=>`<div class="wo-col"><div class="wo-field">
      <button class="wo-step" onclick="woStep('${f}',-1)" aria-label="Menos ${aria}">−</button>
      <input id="${id}" class="load-in" type="number" inputmode="${f==='w'?'decimal':'numeric'}" placeholder="${ph}" value="${val}">
      <button class="wo-step" onclick="woStep('${f}',1)" aria-label="Mais ${aria}">+</button></div>
      <label class="wo-lbl" for="${id}">${lbl}</label></div>`;
  const links=[
    sets.length?`<button onclick="woUndo()">↶ Desfazer</button>`:'',
    `<button onclick="woInfo()">ℹ Ficha</button>`,
    i>0?`<button onclick="woGo(-1)">‹ Anterior</button>`:'',
    (!lastEx&&!allDone&&totalSets)?`<button onclick="woGo(1)">Próximo ›</button>`:'',
  ].join('');
  el('woBody').innerHTML=`
    <header class="wo-bar">
      <button onclick="closeWorkout()" aria-label="Sair do treino guiado (o treino continua em curso)">‹ Sair</button>
      <div class="wo-prog"><span class="wo-count">${i+1}/${total}</span> · <span id="wo-clock">${clockTxt()}</span><small>${paused?'Em pausa':esc(DAYS[day].label)}</small></div>
      <button class="wo-pause${paused?' paused':''}" onclick="woPause()">${paused?'▶ Retomar':'⏸ Pausar'}</button>
    </header>
    <div class="wo-scroll">
      <div class="wo-title">${thumbOf(ex)}<div><div class="wo-name">${esc(ex.name)}</div><div class="wo-sub">${totalSets?`${ex.s} séries`:''}${totalSets&&ex.r?' · ':''}${ex.r?`${esc(String(ex.r))}${totalSets?' reps':''}`:''}</div></div></div>
      ${dots}
      <section id="woRest" class="wo-rest" aria-label="Descanso" hidden></section>
      ${hint?`<div class="wo-hint">${hint}</div>`:''}
      <button class="wo-end" onclick="woFinish()">Terminar treino</button>
    </div>
    <div class="wo-dock">
      ${totalSets?`<div class="wo-load">${field('wo-w',draft?draft.w:(last?last.w:''),'kg','kg','w','peso')}${field('wo-r',draft?draft.r:(last?last.r:''),'reps','reps','r','repetições')}</div>`:''}
      ${main}
      <div class="wo-links">${links}</div>
    </div>`;
  drawn=WO.idx;
  woRestSync();
  if(keep){ const s2=document.querySelector('.wo-scroll'); if(s2) s2.scrollTop=top; if(fid==='wo-w'||fid==='wo-r'){ const f=el(fid); if(f) f.focus(); } }
}

export { WO, startWorkout, openWorkout, closeWorkout, refreshWorkout, woGo, woInfo, woRender, woRestSync, woStep, woDoSet, woUndo, woPause, woFinish };
