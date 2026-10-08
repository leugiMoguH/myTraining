/* myTraining — arranque da app: constrói os separadores e faz o primeiro render.
   Ponto de entrada (<script type="module" src="js/app.js">). */
import './bridge.js';
import { initNav } from './nav.js';
import { expireCustom } from './custom.js';
import { DAYS } from './routine.js';
import { ensureWeek, weekKey } from './schedule.js';
import { abandonSession, currentSession, isLive, reconcileSession, staleSession } from './session.js';
import { ST } from './state.js';
import { REST_SEC, restoreTimer } from './timer.js';
import { render } from './ui.js';
import { openWorkout } from './workout.js';
import { acquireWake, syncWakeUI } from './wake.js';

/* Reset semanal antes do primeiro render: a semana nova começa limpa. */
/* Primeiro o tempo (pausa no último sinal de vida), depois qualquer descarte automático: assim uma
   sessão fechada durante horas nunca fica com esse tempo contabilizado. */
reconcileSession();
/* Um personalizado de ontem caduca já (e leva a sessão consigo), seja qual for o 1.º ecrã. */
expireCustom();
/* Sessão viva de uma semana anterior: o reset semanal apaga as séries marcadas, já não dá para a
   retomar com fidelidade. Descarta-se (ABANDONED, nunca COMPLETED); as cargas ficam em ST.log. */
if(isLive() && weekKey(new Date(currentSession().date+'T12:00:00'))!==weekKey()) abandonSession();
ensureWeek();

/* ST.view guarda o ecrã; ST.day continua a ser um dia real da rotina. */
const start = ST.view && String(ST.view).startsWith('__') && ST.view!=='__dia' ? ST.view : '__hoje';
render(start);
document.getElementById('restLabel').textContent = REST_SEC + 's';
restoreTimer();

/* Navegação inferior e recuperação: uma sessão ACTIVE/PAUSED reabre a vista guiada no exercício
   onde ficou (as séries marcadas e o descanso já vêm do estado persistido). Só uma sessão de
   outro dia, esquecida, fica em faixa para o utilizador decidir — nada é concluído sozinho. */
initNav();
reconcileSession();
/* treino que já não existe (ex.: personalizado caducado) não se pode retomar */
if(isLive() && !(DAYS[currentSession().day] && DAYS[currentSession().day].ex)) abandonSession();
if(isLive() && !staleSession()){ const s=currentSession(); openWorkout(s.day, s.pos); }

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

