import { show } from './notice.js';

/* ═══════════ NOTIFICAÇÕES (descanso) ═══════════ */
function maybeNotify(){
  if(typeof Notification==='undefined' || Notification.permission!=='granted') return;
  try{ new Notification('Descanso terminou 💪',{body:'Hora da próxima série.',silent:false}); }catch(_){}
}
async function enableNotif(){
  if(typeof Notification==='undefined'){ show('Este browser não suporta notificações.', 'info'); return; }
  try { await Notification.requestPermission(); syncNotifUI(); }
  catch(_) { show('Não foi possível ativar as notificações.', 'error'); }
}
function syncNotifUI(){ const el=document.getElementById('notifSw'); if(el) el.classList.toggle('on', typeof Notification!=='undefined' && Notification.permission==='granted'); }

export { maybeNotify, enableNotif, syncNotifUI };
