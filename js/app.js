/* myTraining — arranque da app: constrói os separadores e faz o primeiro render.
   Ponto de entrada (<script type="module" src="js/app.js">). */
import './bridge.js';
import { agenda, ensureWeek } from './schedule.js';
import { ST } from './state.js';
import { REST_SEC, restoreTimer } from './timer.js';
import { render } from './ui.js';
import { acquireWake, syncWakeUI } from './wake.js';

/* Reset semanal antes do primeiro render: a semana nova começa limpa. */
ensureWeek();

/* Quatro separadores fixos. Os 7 dias saíram daqui para a tira da semana —
   o que interessa é o treino de hoje, não a lista toda. */
const TABS=[
  { id:'__hoje',   html:()=>{ const a=agenda(); return `📅 Hoje${a.pending?`<span class="tab-badge">${a.pending}</span>`:''}`; } },
  { id:'__semana', html:()=>'📋 Semana' },
  { id:'__perfil', html:()=>'👤 Perfil' },
  { id:'__nutri',  html:()=>'🥗 Nutrição' },
];

const tabsEl=document.getElementById('tabs');
TABS.forEach(({id,html})=>{
  const t=document.createElement('div');
  t.className='tab';
  t.dataset.day=id;
  t.innerHTML=html();
  t.onclick=()=>render(id);
  tabsEl.appendChild(t);
});

/* ST.view guarda o ecrã; ST.day continua a ser um dia real da rotina. */
const start = ST.view && String(ST.view).startsWith('__') && ST.view!=='__dia' ? ST.view : '__hoje';
render(start);
document.getElementById('restLabel').textContent = REST_SEC + 's';
restoreTimer();

/* ═══════════════ PWA + WAKE INIT ════════════════════ */
syncWakeUI();
acquireWake();
/* Atualizações: o sw.js faz skipWaiting+claim, mas a página já carregou os módulos
   antigos da cache. Sem isto, uma PWA instalada (que nunca fecha) fica presa na versão
   antiga. Recarrega uma vez quando um SW novo assume o controlo — nunca na 1ª visita. */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    const tinhaControlo = !!navigator.serviceWorker.controller;
    let aRecarregar = false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!tinhaControlo || aRecarregar) return;
      aRecarregar = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(reg=>{
      /* a app instalada volta do background sem navegar: força a verificação */
      document.addEventListener('visibilitychange',()=>{
        if(!document.hidden) reg.update().catch(()=>{});
      });
    }).catch(()=>{});
  });
}

