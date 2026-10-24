import assert from 'node:assert/strict';
const store=new Map(); let quota=false;
globalThis.window=globalThis;
globalThis.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({}),addEventListener(){},dispatchEvent(){},body:{},hidden:false,visibilityState:'hidden'};
globalThis.localStorage={getItem:k=>store.get(k)||null,setItem(k,v){if(quota)throw Error('quota');store.set(k,String(v));},removeItem:k=>store.delete(k)};
Object.defineProperty(globalThis,'navigator',{value:{vibrate(){}},configurable:true});
globalThis.addEventListener=()=>{};
await import('../js/routine.js');
const S=await import('../js/state.js'), C=await import('../js/classes.js'), Q=await import('../js/schedule.js');
const st=()=>S.ST, copy=()=>JSON.stringify(st());
const now='2026-10-21', day='Quarta';
const base={kind:'yoga',name:'Yoga',day,time:'10:00',min:45,intensity:1,weekly:true};
function reset(){S.setST({day,classes:[],classLog:{},sets:{},done:{},log:{x:[{date:now,w:10,r:5}]},workouts:[{id:'w'}],routine:Object.fromEntries(['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].map(d=>[d,{label:d,ex:[{name:'x',s:3}]}])),sched:{week:Q.weekKey(new Date(now+'T12:00:00')),done:{},replaced:{}}});}
reset();
for(const patch of [{day:'bad'},{time:'24:00'},{time:'9:00'},{min:4},{min:45.5},{intensity:4},{weekly:'yes'},{weekly:false,date:'2026-02-30'}])assert.equal(C.addClass({...base,...patch},now).ok,false);
const a=C.addClass(base,now).cls.id,b=C.addClass({...base,name:'Outra'},now).cls.id;
assert.equal(C.occurrencesOn(now,now).length,2);
assert.equal(C.occurrences('2026-10-14',now).length,0);
assert.equal(C.occurrences('2026-10-28',now).length,2);
const one=C.addClass({...base,weekly:false,date:now},now).cls.id;
assert.equal(C.occurrences('2026-10-28',now).length,2);
const protectedData=JSON.stringify([st().log,st().workouts,st().sets,st().sched]);
assert(C.markClass(a,now,'done',{now}).ok);assert(C.markClass(a,now,'done',{now}).ok);
assert.equal(Object.keys(st().classLog).length,1);
assert.equal(C.markClass(a,'2026-10-28','done',{now}).ok,false);
assert.equal(JSON.stringify([st().log,st().workouts,st().sets,st().sched]),protectedData);
assert(C.updateClass(a,{name:'Changed',day:'Sexta'},now).ok);
assert.equal(C.occurrencesOn(now,now).find(o=>o.cls.id===a).cls.name,'Yoga');
assert(C.removeClass(a,now).ok); assert.equal(C.recentClasses(10,now)[0].cls.name,'Yoga');
assert(C.reopenClass(a,now,now).ok);assert.equal(C.occurrencesOn(now,now).find(o=>o.cls.id===a).status,'planned');
assert(C.setReplaceIntent(b,now,day,now).ok);assert.deepEqual(st().sched.replaced,{});
st().session={id:'s',state:'ACTIVE',day,startedAt:1,pausedMs:0};
assert.equal(C.markClass(b,now,'done',{now}).ok,false);assert.equal(C.setReplaceIntent(one,now,day,now).ok,false);assert.equal(C.applyMove(day,'Sexta',now,now).ok,false);
delete st().session; st().sets[day+':99']=[0]; assert.equal(C.markClass(b,now,'done',{now}).ok,false);st().sets={};
const before=copy();quota=true;assert.equal(C.markClass(b,now,'done',{now}).ok,false);assert.equal(copy(),before);assert.equal(C.addClass(base,now).ok,false);assert.equal(copy(),before);quota=false;
assert(C.markClass(b,now,'done',{now}).ok);assert.equal(st().sched.replaced[day],now);
assert(C.setReplaceIntent(one,now,day,now).ok);assert.equal(C.markClass(one,now,'done',{now}).ok,false);
assert(C.reopenClass(one,now,now).ok);assert.equal(st().sched.replaced[day],now);
assert(C.markClass(b,now,'cancelled',{now}).ok);assert.equal(st().sched.replaced[day],undefined);
assert(C.markClass(b,now,'done',{now}).ok);st().sched.replaced[day]='2026-10-20';assert(C.reopenClass(b,now,now).ok);assert.equal(st().sched.replaced[day],'2026-10-20');
assert(C.markClass(one,now,'replaced',{now}).ok);assert.equal(C.recentClasses(10,now).some(o=>o.status==='replaced'),true);
assert(C.markClass(a,now,'done',{now}).ok);assert.equal(C.weekActivity(now,now).classes,1);assert.equal(C.weekActivity(now,now).classMin,45);
const exported=JSON.parse(copy());assert(C.validateClassState(exported.classes,exported.classLog).ok);S.setST(exported);assert(C.validateClassState().ok);
for(const [classes,log] of [[null,{}],[{},{}],[[...exported.classes,exported.classes[0]],{}],[[],[]],[[],{bad:{}}],[[],{...exported.classLog,bad:Object.values(exported.classLog)[0]}]])assert.equal(C.validateClassState(classes,log).ok,false);
for(const patch of [{snap:{}},{date:'2026-02-30'},{status:'bad'},{ts:'bad'},{replacesDay:'bad'}]){const [key,entry]=Object.entries(exported.classLog)[0]; assert.equal(C.validateClassState([],{[key]:{...entry,...patch}}).ok,false);}
assert.equal(C.dateOfDay('Segunda','2026-10-25'),'2026-10-19');assert.equal(C.dateOfDay('Segunda','2026-10-26'),'2026-10-26');
assert.equal(C.dateOfDay('Domingo','2026-12-31'),'2027-01-03');assert.equal(C.dateOfDay('Segunda','2027-01-03'),'2026-12-28');
assert.equal(C.dateOfDay('Segunda','2026-03-29'),'2026-03-23');assert.equal(C.dateOfDay('Domingo','2026-03-30'),'2026-04-05');
reset();const m=C.addClass(base,now).cls.id;assert(C.conflictFor(base,now,now));assert(C.applyMove(day,'Sexta',now,now).ok);
/* revisão final: intenção liga o treino (move recusado), «manter ambos» não deixa rasto, ids hostis recusados */
reset();const h=C.addClass(base,now).cls.id;
assert(C.setReplaceIntent(h,now,day,now).ok);assert.equal(C.applyMove(day,'Sexta',now,now).ok,false);
assert(C.setReplaceIntent(h,now,null,now).ok);assert.equal(st().classLog[`${h}@${now}`],undefined);assert(C.applyMove(day,'Sexta',now,now).ok);
const hostile=id=>C.validateClassState([{...st().classes[0],id}],{}).ok;
assert.equal(hostile('x"><img src=x onerror=window.__x=1>'),false);assert.equal(hostile("a'b"),false);assert.equal(hostile(h),true);
console.log('OK classes: critérios 1–6, snapshots, intenção, propriedade, quota/reversão, datas civis e move.');
/* Exercita o importBackup real com dependências de UI substituídas, sem browser. */
const {readFileSync}=await import('node:fs');
const source=readFileSync(new URL('../js/backup.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('async function importBackup('),source.indexOf('/* ── EXPORTAÇÃO CSV'));
const messages=[];
let accepted=0;
const deps={get ST(){return S.ST;},REST_SEC:60,setST:S.setST,validateClassState:C.validateClassState,
 document:{getElementById:()=>({classList:{contains:()=>false},textContent:''})},
 confirmDialog:async()=>{accepted++;return true;},snapshot:()=>({ok:true}),setRest(){},migrate:()=>({saved:true}),save:S.save,
 clearDrafts(){},timerDismiss(){},closeSheet(){},render(){},show:m=>messages.push(m),DEFAULT_DAYS:{Segunda:{ex:[]}},DAYS:{Segunda:{},Quarta:{}}};
const runImport=Function('deps',`with(deps){let importOperation=0;${body};return importBackup;}`)(deps);
async function load(state){const file={text:async()=>JSON.stringify({state})};await runImport({target:{files:[file],value:'x'}});}
const original=copy();await load({...st(),classes:[{id:'bad'}]});assert.equal(copy(),original);assert.equal(accepted,0);assert(messages.at(-1).includes('estrutura interna invalida'));
const backup=JSON.parse(copy());await load(backup);assert.deepEqual(st().classes,backup.classes);assert.deepEqual(st().classLog,backup.classLog);await load(backup);assert.deepEqual(st().classes,backup.classes);assert.deepEqual(st().classLog,backup.classLog);
await load({day:'Segunda',sets:{},done:{}});assert.deepEqual(st().classes,[]);assert.deepEqual(st().classLog,{});
console.log('OK importBackup real: inválido recusado sem alteração/confirmação; antigo aceite; reimportação sem duplicados.');
