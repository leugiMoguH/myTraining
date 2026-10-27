/* Persistence status is independent of the application module graph. */
const status = { storageOk:true, pending:false, since:null, failures:0, loadProblem:null };
let blocked = false;
let initialNotice = '';
let noticesReady = false;
const getSaveState = () => ({...status});
function emit(type, detail) {
  try { document.dispatchEvent(new CustomEvent(type,{detail})); } catch (_) {}
}
function notice(msg, kind='error') { emit('app-notice',{msg,kind}); }
function change(patch) {
  const before=JSON.stringify(status);
  Object.assign(status,patch);
  if(before!==JSON.stringify(status)) emit('save-state',getSaveState());
}
function failure(rolledBack=false) {
  const wasOk=status.storageOk;
  const pending=rolledBack ? status.pending : true;
  change({storageOk:false,pending,since:pending ? status.since || Date.now() : null,failures:status.failures+1});
  if(wasOk) {
    const msg=rolledBack ? 'Não foi possível guardar; alteração desfeita' : 'Não foi possível guardar as alterações neste dispositivo.';
    if(!noticesReady && !initialNotice) initialNotice=msg;
    notice(msg);
  }
  return false;
}
function loadStored() {
  let raw;
  try { raw=localStorage.getItem('treino_v2'); }
  catch (_) {
    blocked=true;
    initialNotice='Armazenamento indisponível. A app está a funcionar em memória.';
    change({storageOk:false,loadProblem:'unavailable'});
    return {};
  }
  if(raw===null) return {};
  try {
    const value=JSON.parse(raw);
    if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('object');
    return value;
  } catch (_) {
    try {
      const key='treino_v2_unreadable', previous=localStorage.getItem(key);
      if(previous===null) localStorage.setItem(key,raw);
      if(localStorage.getItem(key)!==raw) throw Error('readback');
      initialNotice='Os dados guardados não puderam ser lidos; foi guardada uma cópia bruta';
      change({loadProblem:'copied'});
    } catch (_) {
      blocked=true;
      initialNotice='Não foi possível preservar os dados ilegíveis. Exporta uma cópia antes de fechar a app.';
      change({storageOk:false,pending:true,since:Date.now(),loadProblem:'blocked'});
    }
    return {};
  }
}
function persist(state, {rolledBack=false}={}) {
  if(blocked) return failure(rolledBack);
  try {
    const raw=JSON.stringify(state);
    localStorage.setItem('treino_v2',raw);
    if(localStorage.getItem('treino_v2')!==raw) throw Error('readback');
    const pending=status.pending;
    change({storageOk:true,pending:false,since:null,failures:0});
    if(!status.loadProblem) initialNotice='';
    if(pending) notice('Guardado ✓','ok');
    return true;
  } catch (_) { return failure(rolledBack); }
}
function announceLoadProblem() { noticesReady=true; if(initialNotice) { notice(initialNotice); initialNotice=''; } }
export { loadStored, persist, getSaveState, announceLoadProblem };
