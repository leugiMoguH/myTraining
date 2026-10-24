/* Aulas: modelos e ocorrencias civis, sem DOM. */
import { ST, save, setST } from './state.js';
import { weekKey, isRest, effectiveTrainingOn } from './schedule.js';
import { swapDays, isTraining } from './plan.js';
import { liveDay } from './session.js';
import { dayNames, getDay } from './routine.js';
import { uid } from './ids.js';
const DAYS=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const MODALITIES=[['pilates','Pilates','mente-corpo',1],['yoga','Yoga','mente-corpo',1],['spinning','Spinning','cardio',3],['zumba','Zumba','dança',2],['body-pump','Body Pump','força',2],['hiit','HIIT','cardio',3],['cross-training','Cross Training','força',3],['gap','GAP','força',2],['step','Step','cardio',2],['hidroginastica','Hidroginástica','cardio',1],['alongamentos','Alongamentos','mente-corpo',1],['combat','Boxe/Combat','cardio',3],['funcional','Funcional','força',2],['custom','Outra','outro',2]].map(([id,label,type,intensity])=>({id,label,type,intensity}));
const obj=o=>!!o && typeof o==='object' && !Array.isArray(o);
const civil=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const validDate=d=>typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && civil(new Date(`${d}T12:00:00`))===d;
const clock=n=>n instanceof Date ? new Date(n) : new Date(validDate(n)?`${n}T12:00:00`:n);
const err=error=>({ok:false,error});
/* ids entram em atributos inline (onclick): só [A-Za-z0-9_-]; uid() já cumpre */
const safeId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(s);
const text=s=>typeof s==='string' && s.trim().length>0;
const snapOK=s=>obj(s)&&text(s.name)&&typeof s.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)&&Number.isInteger(s.min)&&s.min>=5&&s.min<=240&&[1,2,3].includes(s.intensity)&&MODALITIES.some(m=>m.id===s.kind)&&(s.place===undefined||typeof s.place==='string');
function validClass(c){
  return obj(c)&&safeId(c.id)&&snapOK(c)&&DAYS.includes(c.day)&&typeof c.weekly==='boolean'&&(c.date===undefined||validDate(c.date))&&(c.weekly||validDate(c.date)&&DAYS[(clock(c.date).getDay()+6)%7]===c.day)&&typeof c.createdAt==='string'&&validDate(c.createdAt.slice(0,10))&&!isNaN(Date.parse(c.createdAt)) ? {ok:true} : err('Aula inválida: verifica dia, hora, duração e data.');
}
function validateClassState(classes=[],classLog={}){
  if(!Array.isArray(classes)||!obj(classLog)||classes.some(c=>!validClass(c).ok)||new Set(classes.map(c=>c.id)).size!==classes.length) return err('estrutura interna invalida');
  for(const [k,o] of Object.entries(classLog)) if(!obj(o)||!safeId(o.classId)||!validDate(o.date)||k!==`${o.classId}@${o.date}`||!['planned','done','cancelled','replaced'].includes(o.status)||!snapOK(o.snap)||!(typeof o.ts==='string'&&!isNaN(Date.parse(o.ts)))||(o.changes!==undefined&&(!Array.isArray(o.changes)||o.changes.some(c=>!obj(c)||!['planned','done','cancelled','replaced'].includes(c.from)||!['planned','done','cancelled','replaced'].includes(c.to)||typeof c.ts!=='string'||isNaN(Date.parse(c.ts)))))||(o.replacesDay!==undefined&&!DAYS.includes(o.replacesDay))||(o.replacesDayId!==undefined&&!safeId(o.replacesDayId))) return err('estrutura interna invalida');
  return {ok:true};
}
function commit(fn){const prev=JSON.stringify(ST); try{fn(); if(save()) return {ok:true};}catch(e){setST(JSON.parse(prev)); return err(e.message);} setST(JSON.parse(prev)); return err('Não foi possível guardar. Nada foi alterado.');}
function classList(){return [...(ST.classes||[])].map(c=>({...c}));}
function addClass(input,now=new Date()){
  const n=clock(now), c={...input,id:uid(),createdAt:civil(n)};
  const v=validClass(c); if(!v.ok)return v;
  const r=commit(()=>{ST.classes=[...classList(),c];}); return {...r,...(r.ok?{cls:c}:{})};
}
function updateClass(id,patch,now=new Date()){
  const old=classList().find(c=>c.id===id); if(!old)return err('Aula inexistente.');
  const c={...old,...patch,id,createdAt:old.createdAt}, v=validClass(c); if(!v.ok)return v;
  return commit(()=>{ST.classes=classList().map(x=>x.id===id?c:x);});
}
function removeClass(id,now=new Date()){if(!classList().some(c=>c.id===id))return err('Aula inexistente.'); return commit(()=>{ST.classes=classList().filter(c=>c.id!==id);});}
function dateOfDay(day,ref=new Date()){
  if(!DAYS.includes(day))throw new Error('Dia inválido.');
  const d=clock(ref); if(isNaN(d))throw new Error('Data inválida.');
  d.setDate(d.getDate()-(d.getDay()+6)%7+DAYS.indexOf(day)); return civil(d);
}
const snapshot=c=>Object.fromEntries(['name','time','min','intensity','kind','place'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]]));
function row(id,d,c,status,now){return {key:`${id}@${d}`,cls:{...c,id},date:d,day:DAYS[(clock(d).getDay()+6)%7],status,pastDue:status==='planned'&&(d<civil(now)||d===civil(now)&&c.time<`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`)};}
function occurrences(weekRef=new Date(),now=new Date()){
  const n=clock(now), start=dateOfDay('Segunda',weekRef), end=dateOfDay('Domingo',weekRef), out=new Map();
  for(const c of classList()){const d=c.weekly?dateOfDay(c.day,weekRef):c.date; if(d>=start&&d<=end&&d>=c.createdAt.slice(0,10))out.set(`${c.id}@${d}`,row(c.id,d,c,'planned',n));}
  for(const [k,o] of Object.entries(ST.classLog||{}))if(o.date>=start&&o.date<=end)out.set(k,{...row(o.classId,o.date,o.snap,o.status,n),...(o.replacesDay?{replacesDay:intentDay(o)||o.replacesDay,...(o.replacesDayId?{replacesDayId:o.replacesDayId}:{})}:{})});
  return [...out.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.cls.time.localeCompare(b.cls.time)||a.key.localeCompare(b.key));
}
function occurrencesOn(date,now=new Date()){if(!validDate(date))return []; return occurrences(date,now).filter(o=>o.date===date);}
function find(id,d,now){return occurrencesOn(d,now).find(o=>o.cls.id===id);}
function intentDay(o){
  if(!o)return null;
  if(o.replacesDayId)return dayNames().find(d=>getDay(d)?.id===o.replacesDayId)||null;
  return o.status==='done'?o.replacesDay||null:null;
}
function own(o){return o?.status==='done'&&intentDay(o)&&ST.sched?.replaced?.[intentDay(o)]===o.date&&ST.sched?.week===weekKey(clock(o.date));}
function undo(o){if(own(o)){const r={...ST.sched.replaced};delete r[intentDay(o)];ST.sched={...ST.sched,replaced:r};}}
/* Leitura sem sched(): validar ou resumir nunca deve inicializar/mutar a agenda. */
function trainingState(day){
  if(isRest(day))return 'rest';
  const ex=getDay(day)?.ex||[], marks=ex.filter((_,i)=>ST.done?.[`${day}:${i}`]).length;
  if(ST.sched?.done?.[day]||ex.length>0&&marks===ex.length)return 'done';
  if(ST.sched?.replaced?.[day])return 'swapped';
  return marks>0?'partial':'todo';
}
function replaceError(day,d,now,old){
  if(d>civil(now)||dateOfDay(day,d)>civil(now))return 'Não podes substituir num dia futuro.';
  if(weekKey(clock(d))!==weekKey(now)||ST.sched?.week&&ST.sched.week!==weekKey(now))return 'Só podes substituir na semana atual.';
  if(liveDay()===day)return 'Esse dia tem um treino em curso.';
  if(!isTraining(day)||isRest(day))return 'Esse dia não tem treino.';
  if(Object.entries(ST.sets||{}).some(([k,v])=>k.startsWith(`${day}:`)&&Array.isArray(v)&&v.length))return 'Esse dia tem séries marcadas.';
  if(trainingState(day)==='done'||ST.sched?.done?.[day]||ST.sched?.replaced?.[day]&&!own(old))return 'Esse treino já está feito ou substituído.';
  if(Object.values(ST.classLog||{}).some(o=>o!==old&&o.status==='done'&&intentDay(o)===day&&o.date===d))return 'Esse treino pertence a outra aula.';
  return null;
}
function setReplaceIntent(classId,date,replacesDay,now=new Date()){
  const n=clock(now), o=find(classId,date,n); if(!o)return err('Ocorrência inexistente.');
  if(o.status!=='planned')return err('Reabre a aula antes de escolher substituir.');
  if(replacesDay!==null&&!DAYS.includes(replacesDay))return err('Dia inválido.');
  if(replacesDay&&!safeId(getDay(replacesDay)?.id))return err('Escolhe um treino com identidade válida.');
  if(replacesDay&&liveDay()===replacesDay)return err('Esse dia tem um treino em curso.');
  if(!replacesDay&&!ST.classLog?.[o.key])return {ok:true};
  return commit(()=>{const log={...(ST.classLog||{})};if(replacesDay)log[o.key]={classId,date,status:'planned',ts:n.toISOString(),snap:snapshot(o.cls),replacesDay,replacesDayId:getDay(replacesDay)?.id};else delete log[o.key];ST.classLog=log;});   /* sem intenção, planned não guarda nada */
}
function markClass(classId,date,status,opts={}){
  const n=clock(opts.now??new Date()), o=find(classId,date,n); if(!o||!['done','cancelled','replaced'].includes(status))return err('Ocorrência ou estado inválido.');
  if(status==='done'&&date>civil(n))return err('Não podes marcar uma aula futura como feita.');
  const old=ST.classLog?.[o.key], day=intentDay(old);
  const warning=status==='done'&&old?.replacesDay&&!day?'A ligação ao treino mudou; escolhe de novo para substituir.':null;
  if(status==='done'&&day){const e=replaceError(day,date,n,old);if(e)return err(e);}
  const result=commit(()=>{undo(old);if(status==='done'&&day)ST.sched={...(ST.sched||{}),week:weekKey(n),replaced:{...(ST.sched?.replaced||{}),[day]:date}};ST.classLog={...(ST.classLog||{}),[o.key]:{classId,date,status,ts:n.toISOString(),snap:snapshot(o.cls),...(old?.replacesDay&&(day||old.replacesDayId)?{replacesDay:day||old.replacesDay,...(old.replacesDayId?{replacesDayId:old.replacesDayId}:{})}:{})}};});
  return {...result,...(warning?{warning}:{})};
}
function reopenClass(classId,date,now=new Date()){
  const o=find(classId,date,clock(now));if(!o)return err('Ocorrência inexistente.');
  const old=ST.classLog?.[o.key];if(!old)return {ok:true};
  return commit(()=>{undo(old);ST.classLog={...ST.classLog,[o.key]:{...old,status:'planned',ts:clock(now).toISOString()}};});
}
function conflictFor(cls,date,now=new Date()){
  if(!validDate(date))return null;
  const linked=ST.classLog?.[`${cls.id}@${date}`];
  const day=intentDay(linked)||effectiveTrainingOn(DAYS[(clock(date).getDay()+6)%7],clock(now));
  if(!day||!isTraining(day)||isRest(day))return null;
  const trainingStatus=trainingState(day);if(['done','swapped','rest'].includes(trainingStatus))return null;
  return {day,label:getDay(day)?.label||day,trainingStatus,options:['keep','replace','move'],advice:cls.intensity===3||cls.min>=75?'Considera substituir ou mover só esta semana.':'Manter ambos é adequado.'};
}
function applyMove(day,targetDay,date,now=new Date()){
  if(!validDate(date))return err('Data inválida.');
  const wk=weekKey(clock(now));
  if(Object.values(ST.classLog||{}).some(o=>(o.status==='done'||o.status==='planned')&&[day,targetDay].includes(intentDay(o))&&weekKey(clock(o.date))===wk))return err('Uma aula está ligada ao treino desses dias. Reabre-a antes de os trocar.');
  return swapDays(day,targetDay);
}
function weekActivity(weekRef = new Date(), now = new Date()) {
  const all = occurrences(weekRef, now);
  const done = all.filter(o => o.status === 'done');
  const sameWeek = ST.sched?.week === weekKey(clock(weekRef));
  const trainings = sameWeek ? DAYS.filter(d => getDay(d) && trainingState(d) === 'done') : [];
  return {
    trainings: trainings.filter(d => !ST.sched?.quick?.[d]).length,
    reduced: trainings.filter(d => ST.sched?.quick?.[d]).length,
    classes: done.length,
    classMin: done.reduce((sum, o) => sum + o.cls.min, 0),
    planned: all.filter(o => o.status === 'planned').length,
  };
}
function recentClasses(n=10,now=new Date()){
  return Object.values(ST.classLog||{}).filter(o=>o.status!=='planned').sort((a,b)=>b.date.localeCompare(a.date)||b.ts.localeCompare(a.ts)).slice(0,n).map(o=>({...row(o.classId,o.date,o.snap,o.status,clock(now)),ts:o.ts,changes:o.changes||[],...(o.replacesDay?{replacesDay:intentDay(o)||o.replacesDay,...(o.replacesDayId?{replacesDayId:o.replacesDayId}:{})}:{})}));
}

/* Corrigir uma semana passada preserva o snapshot e nunca reabre a agenda. */
function setPastStatus(classId, date, status, now = new Date()) {
  const n = clock(now);
  if (!validDate(date) || date >= dateOfDay('Segunda', n) ||
      !['planned', 'done', 'cancelled', 'replaced'].includes(status)) return err('Escolhe uma data de uma semana passada e um estado válido.');
  const key = `${classId}@${date}`;
  const old = ST.classLog?.[key];
  const model = classList().find(c => c.id === classId);
  if (!old && (!model || (model.weekly ? dateOfDay(model.day, date) !== date : model.date !== date))) return err('Ocorrência inexistente.');
  return commit(() => {
    const ts = n.toISOString();
    ST.classLog = { ...(ST.classLog || {}), [key]: {
      ...(old || {}), classId, date, status, ts, snap: old?.snap || snapshot(model),
      changes: [...(old?.changes || []), { ts, from: old?.status || 'planned', to: status }],
    } };
  });
}

export { intentDay, setPastStatus, MODALITIES, classList, validClass, addClass, updateClass, removeClass, dateOfDay, occurrences, occurrencesOn, markClass, reopenClass, setReplaceIntent, conflictFor, applyMove, weekActivity, recentClasses, validateClassState };
