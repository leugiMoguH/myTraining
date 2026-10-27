import { ST } from './state.js';
import { getSaveState } from './save-state.js';
import { checksumOf, countsOf, hasUsefulContent } from './backup-core.js';
const META='treino_backup_meta';
let memoryFailure=null;
const storageKeys=['treino_v2','treino_v2_snap','treino_v2_premigration','treino_v2_unreadable','treino_drafts'];
function sizeOf(text) { return {chars:text.length,bytes:new TextEncoder().encode(text).length}; }
function groupsOf(state) {
  const groups=Object.fromEntries(['treinos','séries e cargas','alimentação','medidas','restante'].map(k=>[k,{chars:0,bytes:0}]));
  const names=[['treinos',['workouts','sessions','session']],['séries e cargas',['log','sets','done','prog']],['alimentação',['intake','foodsCustom','foodRecent','nutri']],['medidas',['measures','profile']]];
  for(const [k,v] of Object.entries(state)) {
    const group=names.find(([,keys])=>keys.includes(k))?.[0]||'restante';
    const n=sizeOf(JSON.stringify(v)); groups[group].chars+=n.chars; groups[group].bytes+=n.bytes;
  }
  return groups;
}
async function measureStorage() {
  try {
    const keys=Object.fromEntries(storageKeys.map(k=>[k,sizeOf(localStorage.getItem(k)||'')]));
    const total=Object.values(keys).reduce((a,v)=>({chars:a.chars+v.chars,bytes:a.bytes+v.bytes}),{chars:0,bytes:0});
    const groups=groupsOf(ST), counts=countsOf(ST);
    let estimate=null; try { estimate=await globalThis.navigator?.storage?.estimate?.(); } catch(_) {}
    return {ok:true,keys,total,groups,counts,estimate,localStorageLimit:'desconhecido'};
  } catch(_) { return {ok:false,reason:'Armazenamento indisponível'}; }
}
function readBackupMeta() { try { const m=JSON.parse(localStorage.getItem(META)||'{}'); return m&&typeof m==='object'&&!Array.isArray(m)?m:{}; } catch(_) { return {}; } }
function updateBackupMeta(patch) { try { localStorage.setItem(META,JSON.stringify({...readBackupMeta(),...patch})); return true; } catch(_) { return false; } }
async function relevantSignature(state=ST) {
  const relevant={}; for(const k of ['log','measures','intake','workouts','sessions','routine','profile','classLog','prefs']) relevant[k]=state[k];
  return checksumOf(JSON.stringify(relevant),'fnv1a');
}
function noteSaveFailure(status=getSaveState(),now=Date.now()) {
  if(status.storageOk) return;
  const meta=readBackupMeta();
  memoryFailure=meta.failureSince || memoryFailure || new Date(now).toISOString();
  if(!meta.failureSince) updateBackupMeta({failureSince:memoryFailure});
}
async function recordPrepared(payload) {
  // Signature uses the frozen exported state, never ST after an await.
  const sig=await relevantSignature(payload.state), meta=readBackupMeta();
  const failure=meta.failureSince || memoryFailure;
  const clears=failure && Date.parse(payload.exportedAt)>Date.parse(failure);
  if(clears) memoryFailure=null;
  updateBackupMeta({preparedAt:payload.exportedAt,counts:payload.counts,checksum:payload.checksum,sig, ...(clears?{failureSince:null}:{})});
}
function dismissBackupAdvice(now=Date.now()) { updateBackupMeta({dismissedUntil:new Date(now+7*86400000).toISOString()}); }
async function backupAdvice({state=ST,now=Date.now(),status=getSaveState()}={}) {
  const meta=readBackupMeta();
  if(!status.storageOk && (!meta.preparedAt || status.since && status.since>Date.parse(meta.preparedAt))) noteSaveFailure(status,status.since || now);
  if(Date.parse(meta.dismissedUntil)>now) return null;
  if(!hasUsefulContent(state)) return null;
  if(meta.failureSince || memoryFailure) return {reason:'save-failure',text:'Houve uma falha de gravação. Prepara uma cópia de segurança.'};
  if(!meta.preparedAt) return {reason:'never',text:'Ainda não preparaste uma cópia de segurança destes dados.'};
  if(now-Date.parse(meta.preparedAt)>14*86400000 && JSON.stringify(await relevantSignature(state))!==JSON.stringify(meta.sig)) return {reason:'changed',text:'Há dados alterados e a última cópia foi preparada há mais de 14 dias.'};
  return null;
}
try { document.addEventListener('save-state',e=>noteSaveFailure(e.detail)); } catch(_) {}

export { storageKeys, sizeOf, groupsOf, measureStorage, readBackupMeta, updateBackupMeta, relevantSignature, noteSaveFailure, recordPrepared, dismissBackupAdvice, backupAdvice };
