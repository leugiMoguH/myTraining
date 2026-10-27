/* Pure backup contract: no application state, storage or DOM. */
import { DEFAULT_DAYS } from './data.js';
function validateBackupState(incoming, validators={}) {
  const {validateIntakeList,validateCustomFoods,validateFoodRecent,validateClassState,validateAdaptState,validateMotivState}=Object.fromEntries(['validateIntakeList','validateCustomFoods','validateFoodRecent','validateClassState','validateAdaptState','validateMotivState'].map(k=>[k,validators[k] || (()=>({ok:true}))]));
  try {
      const isObj=o=>!!o && typeof o==='object' && !Array.isArray(o);
      if(!isObj(incoming) || !isObj(incoming.sets) || !isObj(incoming.done))
        throw new Error('estrutura inválida');
      // Campos ausentes continuam compativeis com copias antigas; tipos presentes devem ser validos.
      const optional=(key,valid)=>incoming[key]===undefined || valid(incoming[key]);
      const records=a=>Array.isArray(a) && a.every(isObj);
      const validLog=o=>isObj(o) && Object.values(o).every(a=>records(a) && a.every(e=>e.sets===undefined || records(e.sets)));
      if(!Object.values(incoming.sets).every(Array.isArray) ||
         !optional('log',validLog) || !optional('workouts',records) || !optional('measures',records) ||
         !optional('sessions',records) || !optional('intake',records) ||
         !['profile','prefs','media','nutri'].every(k=>optional(k,isObj)) ||
         !optional('routine',o=>o===null || isObj(o) && Object.values(o).every(d=>isObj(d) && records(d.ex))))
        throw new Error('estrutura interna invalida');
      for (const result of [validateIntakeList(incoming.intake), validateCustomFoods(incoming.foodsCustom), validateFoodRecent(incoming.foodRecent)]) {
        if (!result.ok) throw new Error(result.reason);
      }
      if(!validateClassState(incoming.classes, incoming.classLog).ok) throw new Error('estrutura interna invalida');
      if (!validateAdaptState(incoming.adapt).ok) throw new Error('estrutura interna invalida');
      const warning=incoming.motiv!==undefined&&!validateMotivState(incoming.motiv).ok ? 'Motivação inválida; será reposta ao importar.' : '';
      const civilDate = value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const d = new Date(`${value}T12:00:00`);
        return !isNaN(d) && d.getFullYear() === +value.slice(0, 4) && d.getMonth() + 1 === +value.slice(5, 7) && d.getDate() === +value.slice(8, 10);
      };
      const safe = value => typeof value === 'string' && /^[A-Za-z0-9_À-ÿ -]{1,64}$/.test(value);
      const quick = incoming.custom?.quick;
      if (incoming.sched?.quick !== undefined && (!isObj(incoming.sched.quick) ||
          Object.entries(incoming.sched.quick).some(([day, date]) => !safe(day) || !civilDate(date)))) throw new Error('estrutura interna invalida');
      if (quick !== undefined && (!isObj(quick) || !safe(quick.from) || !['quick', 'retoma'].includes(quick.mode) ||
          !/^[A-Za-z0-9_-]{1,64}$/.test(quick.dayId || '') || !(quick.planId === '' || /^[A-Za-z0-9_-]{1,64}$/.test(quick.planId || '')) ||
          !/^\d{4}-W\d{2}$/.test(quick.wk || '') || !civilDate(quick.date) ||
          !['plannedEx', 'plannedSets', 'estMin'].every(k => Number.isFinite(quick[k]) && quick[k] >= 0))) throw new Error('estrutura interna invalida');
      if (incoming.session?.quick !== undefined && !['quick', 'retoma'].includes(incoming.session.quick)) throw new Error('estrutura interna invalida');
    return {ok:true, reason:warning, state:incoming};
  } catch(e) { return {ok:false,reason:e.message,state:incoming}; }
}
function countsOf(s) {
  const entries=Object.values(s.log||{}).flat();
  return {workouts:(s.workouts||[]).length,sessions:(s.sessions||[]).length,logEntries:entries.length,logSets:entries.reduce((n,e)=>n+(e.sets||[]).length,0),intake:(s.intake||[]).length,measures:(s.measures||[]).length,routineDays:Object.keys(s.routine||{}).length};
}
async function checksumOf(text, alg) {
  alg=alg || (globalThis.crypto?.subtle ? 'sha256':'fnv1a');
  const bytes=new TextEncoder().encode(text);
  if(alg==='fnv1a') { let h=0x811c9dc5; for(const b of bytes) h=Math.imul(h^b,0x01000193)>>>0; return {alg,value:h.toString(16).padStart(8,'0')}; }
  if(alg!=='sha256') throw Error('Algoritmo de selo desconhecido: '+alg);
  if(!globalThis.crypto?.subtle) throw Error('SHA-256 indisponível neste navegador; não foi possível verificar o selo.');
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return {alg,value:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
}
function hasUsefulContent(s) {
  const c=countsOf(s);
  return !!(c.workouts+c.sessions+c.logEntries+c.intake+c.measures || Object.values(s.profile||{}).some(v=>v!==null&&v!==''&&v!==undefined) || (c.routineDays && JSON.stringify(s.routine,(k,v)=>k==='id'?undefined:v)!==JSON.stringify(DEFAULT_DAYS,(k,v)=>k==='id'?undefined:v)));
}
async function buildBackup(state,{rest_sec,appVersion,now=new Date(),validators={}}={}) {
  try {
    // Clone synchronously before the first await: edits during hashing cannot leak in.
    const frozen=JSON.parse(JSON.stringify(state));
    const check=validateBackupState(frozen,validators);
    if(!check.ok) return {ok:false,reason:check.reason};
    if(!hasUsefulContent(frozen)) return {ok:false,reason:'Sem dados úteis para preparar uma cópia.'};
    const payload={app:'treino',v:2,exportedAt:new Date(now).toISOString(),appVersion,rest_sec,counts:countsOf(frozen),state:frozen};
    payload.checksum=await checksumOf(JSON.stringify(frozen));
    return {ok:true,text:JSON.stringify(payload,null,2),payload};
  } catch(e) { return {ok:false,reason:e.message}; }
}
async function verifyBackupText(text,validators) {
  try {
    if(!text.trim()) throw Error('Ficheiro vazio.');
    const p=JSON.parse(text), state=p?.state || p;
    const check=validateBackupState(state,validators);
    if(!check.ok) return {...check,sealed:false};
    const counts=countsOf(state), sealed=p.checksum!==undefined;
    let alg;
    if(sealed) {
      if(!p.checksum || typeof p.checksum.alg!=='string' || typeof p.checksum.value!=='string') throw Error('Selo inválido.');
      alg=p.checksum.alg;
      const actual=await checksumOf(JSON.stringify(state),alg);
      if(actual.value!==p.checksum.value) throw Error('Selo incorreto: conteúdo alterado ou corrompido.');
    }
    if(p.counts!==undefined && (!p.counts || Object.keys(counts).some(k=>p.counts[k]!==counts[k]))) throw Error('Contagens incorretas.');
    return {ok:true,reason:[sealed?'Selo verificado.':'sem selo',check.reason].filter(Boolean).join(' '),counts,sealed,alg};
  } catch(e) { return {ok:false,reason:e.message,sealed:false}; }
}

export { validateBackupState, countsOf, checksumOf, hasUsefulContent, buildBackup, verifyBackupText };
