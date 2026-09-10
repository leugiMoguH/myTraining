/* myTraining — arranque da app: constrói os separadores e faz o primeiro render.
   Ponto de entrada (<script type="module" src="js/app.js">). */
import './bridge.js';
import { DAYS } from './data.js';
import { ST, getProgress } from './state.js';
import { REST_SEC } from './timer.js';
import { render } from './ui.js';
import { acquireWake, syncWakeUI } from './wake.js';

const tabsEl=document.getElementById('tabs');
Object.keys(DAYS).forEach(day=>{
  const t=document.createElement('div');
  t.className='tab'+(day===ST.day?' active':'');
  t.dataset.day=day;
  const {done,total}=getProgress(day);
  t.innerHTML=`${day}<span class="tab-badge" style="display:${done>0?'':'none'}">${done>0?done+'/'+total:''}</span>`;
  t.onclick=()=>render(day);
  tabsEl.appendChild(t);
});

const perfilTab=document.createElement('div');
perfilTab.className='tab'+(ST.day==='__perfil'?' active':'');
perfilTab.dataset.day='__perfil';
perfilTab.innerHTML='👤 Perfil';
perfilTab.onclick=()=>render('__perfil');
tabsEl.appendChild(perfilTab);

const nutriTab=document.createElement('div');
nutriTab.className='tab'+(ST.day==='__nutri'?' active':'');
nutriTab.dataset.day='__nutri';
nutriTab.innerHTML='🥗 Nutrição';
nutriTab.onclick=()=>render('__nutri');
tabsEl.appendChild(nutriTab);

render(ST.day);
document.getElementById('restLabel').textContent = REST_SEC + 's';

/* ═══════════════ PWA + WAKE INIT ════════════════════ */
syncWakeUI();
acquireWake();
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}

