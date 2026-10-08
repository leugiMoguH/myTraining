/* myTraining — arranque da app: constrói os separadores e faz o primeiro render.
   Ponto de entrada (<script type="module" src="js/app.js">). */
import './bridge.js';
import { initNav } from './nav.js';
import { expireCustom } from './custom.js';
import { ensureWeek } from './schedule.js';
import { currentSession, isIdle, isLive } from './session.js';
import { ST } from './state.js';
import { REST_SEC, restoreTimer } from './timer.js';
import { render } from './ui.js';
import { openWorkout } from './workout.js';
import { acquireWake, syncWakeUI } from './wake.js';

/* Reset semanal antes do primeiro render: a semana nova começa limpa. */
/* Nada aqui fecha ou descarta uma sessão: mudar de semana/dia/plano só a preserva (ver session.js). */
ensureWeek();

/* ST.view guarda o ecrã; ST.day continua a ser um dia real da rotina. */
const start = ST.view && String(ST.view).startsWith('__') && ST.view!=='__dia' ? ST.view : '__hoje';
render(start);
document.getElementById('restLabel').textContent = REST_SEC + 's';
restoreTimer();

/* Navegação inferior e recuperação: uma sessão ACTIVE/PAUSED com sinal recente reabre a vista guiada no
   exercício onde ficou (séries marcadas e descanso já vêm do estado persistido). Sem sinal há muito
   (esquecida), fica numa faixa com opções explícitas: abrir, encerrar ou descartar. */
initNav();
if(isLive() && !isIdle()){ const s=currentSession(); openWorkout(s.day, s.pos); }

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

