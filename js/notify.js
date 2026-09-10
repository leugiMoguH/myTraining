/* myTraining — módulo extraído de index.html (Fase 0). */

/* ═══════════ NOTIFICAÇÕES (descanso) ═══════════ */
function maybeNotify(){
  if(typeof Notification==='undefined' || Notification.permission!=='granted') return;
  try{ new Notification('Descanso terminou 💪',{body:'Hora da próxima série.',silent:false}); }catch(_){}
}
function enableNotif(){
  if(typeof Notification==='undefined'){ alert('Este browser não suporta notificações.'); return; }
  Notification.requestPermission().then(syncNotifUI);
}
function syncNotifUI(){ const el=document.getElementById('notifSw'); if(el) el.classList.toggle('on', typeof Notification!=='undefined' && Notification.permission==='granted'); }

export { maybeNotify, enableNotif, syncNotifUI };
