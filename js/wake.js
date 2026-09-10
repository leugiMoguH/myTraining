/* myTraining — módulo extraído de index.html (Fase 0). */
import { TM, timerTick } from './timer.js';

/* ═══════════════ WAKE LOCK (ecrã ligado) ════════════ */
let wakeLock=null;
let wakeWanted = localStorage.getItem('wake_on')==='1';
async function acquireWake(){
  if(!wakeWanted || !('wakeLock' in navigator) || document.visibilityState!=='visible') return;
  try{ wakeLock = await navigator.wakeLock.request('screen'); }
  catch(_){ /* o browser pode rejeitar */ }
}
async function releaseWake(){ try{ if(wakeLock) await wakeLock.release(); }catch(_){} wakeLock=null; }
function toggleWake(){
  wakeWanted=!wakeWanted;
  localStorage.setItem('wake_on', wakeWanted?'1':'0');
  if(wakeWanted) acquireWake(); else releaseWake();
  syncWakeUI();
}
function syncWakeUI(){
  const sw=document.getElementById('wakeSw'); if(sw) sw.classList.toggle('on',wakeWanted);
  const note=document.getElementById('wakeNote');
  if(note) note.textContent = ('wakeLock' in navigator) ? '' : '⚠ O teu browser não suporta manter o ecrã ligado.';
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ acquireWake(); if(TM.on) timerTick(); } });

export { wakeLock, wakeWanted, acquireWake, releaseWake, toggleWake, syncWakeUI };
