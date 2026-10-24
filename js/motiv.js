import { ST, save, est1RM } from './state.js';
import { validDate, validSet, sessionsOf, recordsOf, bestOf } from './records.js';
import { statsOf } from './session.js';
import { weekKey } from './schedule.js';
import { dateOfDay, occurrences } from './classes.js';

const ACHIEVEMENTS = [
 ['primeiro-treino','Primeiro treino','Concluir um dia de treino.','🌱'],
 ['cinco-treinos','Cinco dias','Concluir cinco dias de treino.','🖐'],
 ['dez-treinos','Dez dias','Concluir dez dias de treino.','⭐'],
 ['primeiro-recorde','Primeiro recorde','Superar uma carga ou um 1RM estimado anterior.','🏅'],
 ['primeira-melhoria','Primeira melhoria','Melhorar uma série face à sessão anterior.','🌿'],
 ['semana-completa','Semana completa','Cumprir os dias da meta semanal guardada.','📅'],
 ['regresso','Regresso','Concluir um treino após pelo menos 14 dias civis.','👋'],
 ['primeira-aula','Primeira aula','Marcar uma aula como feita.','🎵'],
].map(([id,name,desc,icon])=>({id,name,desc,icon}));
// Delivery deduplication only for this runtime. At startup/import ensureMotiv absorbs
// existing completions; pending is the only persisted presentation, never another history.
const acknowledged = new WeakMap();
const acknowledgements = () => {if(!acknowledged.has(ST))acknowledged.set(ST,new Set());return acknowledged.get(ST);};
const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const ids = new Set(ACHIEVEMENTS.map(a=>a.id));
const civil = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const clock = d => new Date(validDate(d)?`${d}T12:00:00`:d);
const dayNo = d => Date.parse(`${d}T00:00:00Z`)/86400000;
const wk = d => weekKey(clock(d));
const pair = s => ({w:s.w,r:s.r});
const timestamp = t => typeof t==='number'?t:typeof t==='string'?Date.parse(t):NaN;
function completed(exclude) {
 const w=(ST.workouts||[]).filter(s=>s.state==='COMPLETED');
 return [...w,...(ST.sessions||[]).filter(s=>!w.some(x=>x.id===s.id||x.id===s.sid))]
  .filter(s=>validDate(s.date)&&(!exclude||s.id!==exclude&&s.sid!==exclude)).sort((a,b)=>a.date.localeCompare(b.date)||(timestamp(a.startedAt)||0)-(timestamp(b.startedAt)||0));
}
function dates(exclude) {
 const all=[...(ST.workouts||[]),...(ST.sessions||[])].filter(s=>validDate(s.date));
 const first=all.map(s=>s.date).sort()[0];
 const legacy=Object.values(ST.log||{}).flat().filter(e=>validDate(e.date)&&(!first||e.date<first)&&
  !(e.sets||[]).some(s=>s.sid)&& (e.sets?.some(validSet)||validSet(e))).map(e=>e.date);
 return [...new Set([...completed(exclude).map(s=>s.date),...legacy])].sort();
}
function goal() {
 if(obj(ST.routine)&&Object.keys(ST.routine).length) return Object.values(ST.routine).filter(d=>!d.rest&&!/descanso/i.test(d.label||'')&&d.ex?.length).length;
 return ST.prefs?.days?.length||0;
}
function validateMotivState(m) {
 const stamp=t=>typeof t==='string'&&Number.isFinite(Date.parse(t));
 const ok=obj(m)&&m.v===1&&obj(m.seen)&&obj(m.goals)&&Object.keys(m).every(k=>['v','seen','goals','pending'].includes(k))&&
 Object.entries(m.seen).every(([k,v])=>ids.has(k)&&stamp(v))&&Object.entries(m.goals).every(([k,v])=>/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=7)&&
 (m.pending===null||obj(m.pending)&&typeof m.pending.id==='string'&&m.pending.id.length>0&&Array.isArray(m.pending.ach)&&new Set(m.pending.ach).size===m.pending.ach.length&&m.pending.ach.every(a=>ids.has(a)));
 return ok?{ok:true}:{ok:false,error:'Estado de motivação inválido.'};
}
function persist(m) {
 const old=ST.motiv, had=Object.hasOwn(ST,'motiv');
 ST.motiv=m;
 try { if(save()) return true; } catch {}
 if(had) ST.motiv=old; else delete ST.motiv;
 return false;
}
function ensureMotiv(now=new Date()) {
 const m=validateMotivState(ST.motiv).ok?structuredClone(ST.motiv):{v:1,seen:{},goals:{},pending:null};
 const key=weekKey(clock(now));
 if(!Object.hasOwn(m.goals,key)) m.goals[key]=goal();
 // Compute against the candidate snapshot without publishing an intermediate state.
 for(const a of earnedWithGoals(m.goals)) if(!m.seen[a.id]) m.seen[a.id]=clock(now).toISOString();
 if(JSON.stringify(m)===JSON.stringify(ST.motiv)||persist(m)) completed().forEach(s=>acknowledgements().add(s.id));
}
function sessionSummary(id) {
 const s=(ST.workouts||[]).find(s=>s.id===id)||(ST.sessions||[]).find(s=>s.id===id);
 if(!s||s.state&&s.state!=='COMPLETED'||!validDate(s.date)) return null;
 const guided=(ST.workouts||[]).find(w=>w.id===(s.sid||id)&&w.state==='COMPLETED');
 const sid=guided?.id||s.sid||id, quick=s.quick?.mode||s.quick||guided?.quick;
 const kind=quick==='retoma'?'retoma':quick==='quick'||s.kind==='quick'?'rapido':s.kind==='custom'||s.day==='Personalizado'?'personalizado':'treino';
 const exercises=[],prs=[],improvements=[];
 for(const name of Object.keys(ST.log||{})) {
  const rows=sessionsOf(name), current=rows.flatMap(e=>e.sets.filter(x=>x.sid===sid));
  if(!current.length) continue;
  const prior=rows.map(e=>({...e,sets:e.sets.filter(x=>x.sid!==sid&&(e.date<s.date||e.date===s.date&&Number.isFinite(timestamp(x.ts))&&timestamp(x.ts)>0&&timestamp(x.ts)<timestamp(guided?.startedAt)))})).filter(e=>e.sets.length);
  const rec=recordsOf(name,prior), best=bestOf(current);
  if(rec.load&&best.w>rec.load.w) prs.push({name,kind:'carga',...pair(best)});
  const rm=bestOf(current.filter(x=>x.r<=12).map(x=>({...x,score:est1RM(x.w,x.r)})).sort((a,b)=>b.score-a.score).slice(0,1));
  if(rm&&rec.e1rm&&est1RM(rm.w,rm.r)>rec.e1rm.v) prs.push({name,kind:'1rm',...pair(rm)});
  const last=prior.at(-1);
  const latest=last?.sets.reduce((a,b)=>(timestamp(b.ts)||0)>(timestamp(a.ts)||0)?b:a,last.sets[0]);
  const from=last&&bestOf(latest?.sid?last.sets.filter(x=>x.sid===latest.sid):last.sets);
  const improved=from&&(best.w>from.w||best.w===from.w&&best.r>from.r)?pair(from):null;
  if(improved) improvements.push({name,from:improved,to:pair(best)});
  exercises.push({name,sets:current.length,reps:current.reduce((n,x)=>n+x.r,0),best:pair(best),volume:current.reduce((n,x)=>n+x.w*x.r,0),pr:prs.find(p=>p.name===name)?.kind||null,improved});
 }
 const ds=dates(), i=ds.indexOf(s.date), duration=guided&&Number.isFinite(timestamp(guided.endedAt))&&timestamp(guided.endedAt)>0?statsOf({...guided,startedAt:timestamp(guided.startedAt),endedAt:timestamp(guided.endedAt)}).duration:0;
 return {id,date:s.date,day:s.day||'Personalizado',label:s.label||s.day||'Treino personalizado',kind,reduced:['rapido','retoma'].includes(kind),durationMs:duration>0?duration:null,exercises,
 totals:{exercises:exercises.length||(Array.isArray(s.ex)?s.ex.length:(+s.ex||0)),sets:exercises.reduce((n,e)=>n+e.sets,0)||(+s.sets||0),reps:exercises.reduce((n,e)=>n+e.reps,0),volume:exercises.length?exercises.reduce((n,e)=>n+e.volume,0):null},prs,improvements:improvements.slice(0,2),trainingNumber:i+1,comeback:i>0&&dayNo(s.date)-dayNo(ds[i-1])>=14};
}
function earnedWithGoals(goals,exclude) {
 const ds=dates(exclude), facts={}, put=(id,date)=>{if(date&&(!facts[id]||date<facts[id]))facts[id]=date;};
 for(const [n,id] of [[1,'primeiro-treino'],[5,'cinco-treinos'],[10,'dez-treinos']]) put(id,ds[n-1]);
 ds.forEach((d,i)=>{if(i&&dayNo(d)-dayNo(ds[i-1])>=14)put('regresso',d);});
 for(const s of completed(exclude)) {const sum=sessionSummary(s.id);if(sum?.prs.length)put('primeiro-recorde',s.date);if(sum?.improvements.length)put('primeira-melhoria',s.date);}
 for(const [key,g] of Object.entries(goals||{})) {const days=ds.filter(d=>wk(d)===key);if(g>=1&&days.length>=g)put('semana-completa',days[g-1]);}
 Object.values(ST.classLog||{}).filter(o=>o.status==='done'&&validDate(o.date)).forEach(o=>put('primeira-aula',o.date));
 return ACHIEVEMENTS.filter(a=>facts[a.id]).map(a=>({...a,date:facts[a.id]}));
}
function earnedAchievements({exclude}={}) {return earnedWithGoals(ST.motiv?.goals,exclude);}
function lockedAchievements() {const earned=new Set(earnedAchievements().map(a=>a.id));return ACHIEVEMENTS.filter(a=>!earned.has(a.id)).map(a=>({...a,hint:a.desc}));}
function messageFor(s,ctx={}) {
 if(!s)return '';
 const variants=s.comeback?['Bem-vindo de volta. Um treino de cada vez.','Hoje voltaste a reservar tempo para ti.']: [1,5,10].includes(s.trainingNumber)?['Mais um dia de treino concluído.','Este dia faz parte do teu percurso.']:s.prs.length?['Há um novo recorde nas séries registadas.','As séries registadas mostram um novo recorde.']:s.improvements.length?['As séries registadas mostram uma melhoria.','Hoje há uma melhoria registada.']:s.reduced?['Fizeste o que cabia hoje.','Uma versão mais curta também conta.']:ST.prefs?.goal?['Hoje deste tempo ao teu objetivo.','Mais um treino no teu percurso.']:['Treino concluído. Reserva um momento para recuperar.','Hoje reservaste tempo para ti.'];
 let h=0;for(const c of String(s.id)+s.trainingNumber)h=(h*31+c.charCodeAt(0))>>>0;return variants[h%variants.length];
}
function celebrate(id,now=new Date()) {
 const summary=sessionSummary(id);if(!summary||!validateMotivState(ST.motiv).ok||ST.motiv.pending?.id===id||acknowledgements().has(id))return null;
 const m=structuredClone(ST.motiv), key=wk(summary.date||now);
 if(!Object.hasOwn(m.goals,key)) m.goals[key]=goal();
 const all=earnedWithGoals(m.goals), before=new Set(earnedWithGoals(m.goals,id).map(a=>a.id));
 const achievements=all.filter(a=>!before.has(a.id)&&!m.seen[a.id]);
 const ts=clock(now).toISOString();all.forEach(a=>{m.seen[a.id] ||= ts;});
 m.pending={id,ach:achievements.map(a=>a.id)};
 if(!persist(m))return null;
 acknowledgements().add(id);
 return {summary,achievements,message:messageFor(summary)};
}
function pendingCelebration() {
 if(!validateMotivState(ST.motiv).ok||!ST.motiv.pending)return null;
 const summary=sessionSummary(ST.motiv.pending.id);if(!summary)return null;
 return {summary,achievements:earnedAchievements().filter(a=>ST.motiv.pending.ach.includes(a.id)),message:messageFor(summary)};
}
function dismissPending() {if(ST.motiv?.pending)persist({...ST.motiv,pending:null});}
function weekSummary(weekRef=new Date(),now=new Date()) {
 const start=dateOfDay('Segunda',weekRef),end=dateOfDay('Domingo',weekRef),current=wk(start)===weekKey(clock(now));
 const sessions=completed().filter(s=>s.date>=start&&s.date<=end), summaries=sessions.map(s=>sessionSummary(s.id)).filter(Boolean);
 const days=dates().filter(d=>d>=start&&d<=end), reduced=new Set(summaries.filter(s=>s.reduced).map(s=>s.date));
 const full=new Set(summaries.filter(s=>!s.reduced).map(s=>s.date));
 const classes=occurrences(weekRef,now).filter(o=>o.status==='done');
 return {start,end,current,trainings:days.filter(d=>!reduced.has(d)||full.has(d)).length,reduced:[...reduced].filter(d=>!full.has(d)).length,classes:classes.length,classMin:classes.reduce((n,o)=>n+o.cls.min,0),goal:ST.motiv?.goals?.[wk(start)]??(current?goal():null),improvements:summaries.flatMap(s=>s.improvements).slice(0,2),achievements:earnedAchievements().filter(a=>a.date>=start&&a.date<=end),message:days.length||classes.length?'Cada momento de atividade faz parte do teu percurso.':'Há espaço para treinar ao teu ritmo.',empty:!days.length&&!classes.length};
}

export { ACHIEVEMENTS, ensureMotiv, validateMotivState, earnedAchievements, lockedAchievements, sessionSummary, messageFor, celebrate, dismissPending, pendingCelebration, weekSummary };
