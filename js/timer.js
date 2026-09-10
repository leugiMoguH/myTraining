/* myTraining — módulo extraído de index.html (Fase 0). */
import { maybeNotify } from './notify.js';

/* ═══════════════════════ TIMER ══════════════════════ */
let REST_SEC = parseInt(localStorage.getItem('rest_sec') || '60');
/* ESM: ver nota em state.js/setST. Usado pelo importBackup. */
function setRest(n) { REST_SEC = Math.max(15, Math.min(300, Math.round(n))); localStorage.setItem('rest_sec', REST_SEC); }

function adjustRest(d) {
  REST_SEC = Math.max(15, Math.min(300, REST_SEC + d));
  localStorage.setItem('rest_sec', REST_SEC);
  document.getElementById('restLabel').textContent = REST_SEC + 's';
  document.querySelectorAll('.rest-lbl').forEach(s => s.textContent = REST_SEC + 's');
}

const TM = { on:false, total:60, left:60, iv:null, end:0 };
const CIRC = 2*Math.PI*22; // stroke-dasharray

/* relógio de parede: left calculado de TM.end, não decrementado.
   Resiste a throttling/pausa do setInterval em 2º plano e auto-corrige ao voltar à app. */
function timerTick(){
  TM.left=Math.max(0, Math.round((TM.end-Date.now())/1000));
  if(TM.left<=0 && TM.on){
    TM.on=false; if(TM.iv) clearInterval(TM.iv); TM.iv=null;
    if(navigator.vibrate) navigator.vibrate([200,80,200,80,400]);
    maybeNotify();
  }
  renderTimer();
}
function timerStart(sec) {
  if(TM.iv) clearInterval(TM.iv);
  TM.total=sec; TM.end=Date.now()+sec*1000; TM.left=sec; TM.on=true;
  document.getElementById('timerBanner').classList.add('show');
  renderTimer();
  TM.iv=setInterval(timerTick,250);
}

function timerAdd(s) {
  if(!TM.on){ timerStart(s); return; }
  TM.end+=s*1000;
  TM.left=Math.round((TM.end-Date.now())/1000);
  TM.total=Math.max(TM.total,TM.left);
  renderTimer();
}

function timerDismiss() {
  if(TM.iv) clearInterval(TM.iv); TM.iv=null;
  TM.on=false;
  document.getElementById('timerBanner').classList.remove('show','warn');
}

function renderTimer() {
  const {left,total}=TM;
  const m=Math.floor(left/60), s=String(left%60).padStart(2,'0');
  const label=`${m}:${s}`;
  const pct = total>0 ? left/total : 0;
  const offset = CIRC*(1-pct);

  document.getElementById('tNum').textContent=label;
  document.getElementById('tBig').textContent=label;
  document.getElementById('tRingFill').style.strokeDashoffset=offset;

  const banner=document.getElementById('timerBanner');
  if(left<=10 && TM.on) banner.classList.add('warn');
  else banner.classList.remove('warn');
}

export { REST_SEC, setRest, adjustRest, TM, CIRC, timerTick, timerStart, timerAdd, timerDismiss, renderTimer };
