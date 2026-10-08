/* myTraining — módulo extraído de index.html (Fase 0). */
import { DAYS } from './routine.js';
import { REST_SEC, timerStart } from './timer.js';
import { refreshCard, refreshProgress, render } from './ui.js';

/* ═══════════════════════ STATE ══════════════════════ */
const STORE_KEY = "treino_v2";
let ST = { day:"Segunda", sets:{}, done:{}, log:{}, prog:{}, nutri:{profile:null}, profile:{}, measures:[], intake:[], media:{} };
try { const s=localStorage.getItem(STORE_KEY); if(s) ST={...ST,...JSON.parse(s)}; } catch(_){}
if(!ST.profile || typeof ST.profile!=='object') ST.profile={};
if(!Array.isArray(ST.measures)) ST.measures=[];
if(!Array.isArray(ST.intake)) ST.intake=[];
if(!ST.media || typeof ST.media!=='object') ST.media={};
if(!ST.prog || typeof ST.prog!=='object') ST.prog={};
if(!Array.isArray(ST.workouts)) ST.workouts=[];   /* sessões de treino terminadas (session.js) */
if(!Array.isArray(ST.sessions)) ST.sessions=[];   /* treinos personalizados concluídos */
/* migração: dados do corpo da nutrição antiga → Perfil + 1ª medida */
if(!ST.profile.height && ST.nutri && ST.nutri.profile && ST.nutri.profile.height){
  const o=ST.nutri.profile;
  ST.profile={ sex:o.sex, age:o.age, height:o.height, goal:o.goal, activity:o.activity };
  if(o.weight>0 && !ST.measures.length) ST.measures=[{ date:todayStr(), weight:o.weight }];
  ST.nutri={ profile:{ meals:o.meals, cookTime:o.cookTime, fav:o.fav, restrictions:o.restrictions, supps:o.supps, avoid:o.avoid } };
}

/* ESM: um binding importado não pode ser reatribuído de fora. O import (backup.js)
   troca o objeto inteiro por aqui; os importadores veem o novo valor (live binding). */
function setST(next) { ST = next; }

function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(ST)); } catch(_){} }
function key(day,i) { return `${day}:${i}`; }
function getSets(day,i) { return ST.sets[key(day,i)] || []; }

/* progressão de carga (kg × reps), agregada por nome de exercício */
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function nowISO(){ return new Date().toISOString(); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtTime(ts){ if(!ts) return ''; const d=new Date(ts); return isNaN(d.getTime())?'':d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}); }
function fmtDateTime(ts){ if(!ts) return ''; const d=new Date(ts); return isNaN(d.getTime())?'':d.toLocaleDateString('pt-PT')+' '+d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}); }
function getLog(name){ return (ST.log && ST.log[name]) || []; }
function logSet(name,w,r,custom){
  w=parseFloat(w); r=parseInt(r,10);
  if(!(w>0) || !(r>0)) return false;
  const arr=getLog(name).slice();
  const t=todayStr();
  const idx=arr.findIndex(e=>e.date===t);
  const entry={date:t,ts:nowISO(),w,r};
  if(custom) entry.c=1;      /* feito num treino personalizado (distingue do programado no histórico) */
  if(idx>=0) arr[idx]=entry; else arr.push(entry);
  arr.sort((a,b)=> a.date<b.date?-1:(a.date>b.date?1:0));
  ST.log=Object.assign({}, ST.log, {[name]:arr});
  save();
  return true;
}
/* Séries individuais do dia: entry.sets=[{w,r,ts}]; entry.w/r = melhor série (mais peso, depois reps).
   Um só registo por exercício/dia, compatível com a progressão e com backups antigos. */
function bestSet(sets){ return sets.reduce((b,x)=> (!b || x.w>b.w || (x.w===b.w && x.r>b.r)) ? x : b, null); }
function putEntry(name,entry){
  const arr=getLog(name).filter(e=>e.date!==entry.date);
  arr.push(entry); arr.sort((a,b)=> a.date<b.date?-1:(a.date>b.date?1:0));
  ST.log=Object.assign({}, ST.log, {[name]:arr});
}
function addSetLog(name,w,r,custom){
  w=parseFloat(w); r=parseInt(r,10);
  if(!(w>0) || !(r>0)) return false;
  const t=todayStr(), old=getLog(name).find(e=>e.date===t);
  const sets=[...(old && old.sets ? old.sets : (old ? [{w:old.w,r:old.r,ts:old.ts}] : [])), {w,r,ts:nowISO()}];
  const b=bestSet(sets);
  putEntry(name,{...(old||{}), date:t, ts:nowISO(), w:b.w, r:b.r, sets, ...(custom?{c:1}:{})});
  save();
  return true;
}
function undoSetLog(name){
  const t=todayStr(), old=getLog(name).find(e=>e.date===t);
  if(!old || !old.sets || !old.sets.length) return false;
  const sets=old.sets.slice(0,-1);
  if(!sets.length) ST.log=Object.assign({}, ST.log, {[name]:getLog(name).filter(e=>e.date!==t)});
  else { const b=bestSet(sets); putEntry(name,{...old, w:b.w, r:b.r, sets}); }
  save();
  return true;
}
function est1RM(w,r){ return Math.round(w*(1+r/30)); }

/* Configuração de progressão por exercício (esquema, incremento). Indexada pelo
   nome, como o histórico — trocar de dia ou de ordem não a perde. */
function setProg(name,patch){
  if(!name) return false;
  const cur=(ST.prog && ST.prog[name])||{};
  ST.prog=Object.assign({}, ST.prog, {[name]:{...cur, ...patch}});
  save();
  return true;
}

function toggleSet(day,i,si) {
  const k=key(day,i), arr=getSets(day,i);
  const idx=arr.indexOf(si);
  if(idx>=0) arr.splice(idx,1); else arr.push(si);
  ST.sets[k]=arr;
  const ex=DAYS[day].ex[i];
  const total=typeof ex.s==='number'?ex.s:0;
  ST.done[k] = total>0 && arr.length>=total;
  save();
  refreshCard(day,i);
  refreshProgress();
  if(idx<0) timerStart(REST_SEC);
}

function markDone(day,i) {
  const k=key(day,i), ex=DAYS[day].ex[i];
  const total=typeof ex.s==='number'?ex.s:1;
  ST.sets[k]=Array.from({length:total},(_,j)=>j);
  ST.done[k]=true;
  save();
  refreshCard(day,i);
  refreshProgress();
}

function resetDay(day) {
  if(!confirm(`Resetar progresso de ${day}?`)) return;
  DAYS[day].ex.forEach((_,i)=>{ delete ST.sets[key(day,i)]; delete ST.done[key(day,i)]; });
  save(); render(day);
}

function getProgress(day) {
  const total=DAYS[day].ex.length;
  const done=DAYS[day].ex.filter((_,i)=>ST.done[key(day,i)]).length;
  return {total,done};
}

export { STORE_KEY, ST, setST, save, key, getSets, todayStr, nowISO, esc, fmtTime, fmtDateTime, getLog, logSet, addSetLog, undoSetLog, est1RM, setProg, toggleSet, markDone, resetDay, getProgress };
