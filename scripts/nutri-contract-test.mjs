import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { NUTRIENTS, validateIntakeList, validateCustomFoods, validateFoodRecent, recentFoods, rescaleEntry, mealOf, intakeForDate } from '../js/foods.js';
import { references } from '../js/nutri-calc.js';
import { daySummary } from '../js/nutri-summary.js';

const legacy = {id:'old',date:'2024-02-29',name:'Legado',kcal:0,protein:null};
const entry = {...legacy,id:'new',g:100,unit:'ml',meal:'pa',fid:'off:123',src:'off',sid:null,ver:null,ts:'2024-02-29T10:00:00Z',n:{carbs:1.123456789,fat:0,fibre:null,sugars:2,salt:0}};
assert.equal(validateIntakeList([legacy,entry]).ok,true);
assert.equal(validateIntakeList(undefined).ok,true);
for (const patch of [{id:''},{date:'2023-02-29'},{date:'2024-04-31'},{kcal:'2'},{protein:-1},{g:0},{g:Infinity},{unit:'kg'},{meal:null},{n:[]},{n:{fat:NaN}},{name:2}])
  assert.equal(validateIntakeList([{...entry,...patch}]).ok,false,JSON.stringify(patch));
assert.equal(validateIntakeList([legacy,legacy]).ok,false);
assert.equal(validateIntakeList([null]).ok,false);
const before=JSON.stringify(entry), scaled=rescaleEntry(entry,{g:137,unit:'ml'});
assert.equal(scaled.n.carbs,entry.n.carbs*1.37);
assert.equal(scaled.protein,null);assert.equal(scaled.kcal,0);assert.equal(scaled.n.fibre,null);
for (const key of ['id','ts','date','fid','src','sid','ver','meal']) assert.equal(scaled[key],entry[key]);
assert.equal(JSON.stringify(entry),before);assert.notEqual(scaled.n,entry.n);
for (const amount of [0,-1,Infinity,NaN,'100',{g:100,unit:'g'}]) assert.throws(()=>rescaleEntry(entry,amount),RangeError);
assert.throws(()=>rescaleEntry(legacy,100),RangeError);
assert.throws(()=>rescaleEntry({...entry,kcal:Number.MAX_VALUE},Number.MAX_VALUE),RangeError);
assert.equal(mealOf(legacy),null);assert.equal(mealOf(entry),'pa');
assert.deepEqual(intakeForDate([legacy,entry,{...legacy,date:'2024-03-01'}],'2024-02-29'),[legacy,entry]);
const custom={id:'c123',name:'Pessoal',ref:{amount:100,unit:'g'},nutrients:Object.fromEntries(NUTRIENTS.map(k=>[k,null])),createdTs:'2024-02-29T10:00:00Z'};
assert.equal(validateCustomFoods([custom]).ok,true);
for(const patch of [{id:'fdc:1'},{name:''},{ref:{amount:1,unit:'g'}},{nutrients:{}},{createdTs:'no'}]) assert.equal(validateCustomFoods([{...custom,...patch}]).ok,false);
assert.equal(validateCustomFoods([custom,custom]).ok,false);
assert.equal(validateFoodRecent(['fdc:1','c:c123','off:123']).ok,true);
for(const ids of [null,['bad'],['fdc:1','fdc:1'],Array.from({length:13},(_,i)=>'fdc:'+i)]) assert.equal(validateFoodRecent(ids).ok,false);
assert.deepEqual(recentFoods(['fdc:1','c:c123','fdc:2','off:123'],[{id:'fdc:1'}],[custom]),[{id:'fdc:1'},custom]);
const refs=references({sex:'m',activity:'mod',age:30,weight:80,height:180});
assert.deepEqual(references({age:30,weight:80,height:180}).missing,['sexo','atividade']);
assert.match(references(null).reason,/sexo/);
for(const [entries,state] of [[[],'vazio'],[[{kcal:null}],'desconhecido'],[[{kcal:0},{kcal:null}],'parcial'],[[{kcal:0}],'conhecido']]) {
 const s=daySummary(entries,refs).kcal;assert.equal(s.state,state);assert.equal(s.complete,state==='conhecido');
 if(state!=='conhecido'){assert.equal(s.position,undefined);assert.equal(s.margin,undefined);}
}
assert.equal(daySummary([{kcal:0}],{applicable:false}).kcal.position,undefined);
assert.match(daySummary([{kcal:0},{kcal:null}],refs).kcal.text,/total parcial \(\+ 1 sem dado\)/);
for(const [value,position] of [[127,'abaixo'],[128,'dentro'],[176,'dentro'],[177,'acima']]) assert.equal(daySummary([{protein:value}],refs).protein.position,position);
for(const [value,position] of [[4,'abaixo'],[5,'dentro'],[6,'acima']]) assert.equal(daySummary([{n:{salt:value}}],refs).salt.position,position);
const summary=daySummary([{n:{fibre:30,sugars:100}}],refs);
assert.equal(summary.fibre.position,undefined);assert.equal(summary.fibre.margin,undefined);assert.match(summary.fibre.referenceText,/referência 25 g/);
assert.equal(summary.sugars.position,undefined);assert.doesNotMatch(JSON.stringify(summary),/ainda podes comer|dia completo/);

/* Executa o import/export real com portas de I/O substituídas, sem DOM/rede. */
const source=readFileSync(new URL('../js/backup.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export .*;\r?$/gm,'');
let state={sets:{},done:{},intake:[legacy]}, replacements=0, confirmations=0, message='', csv;
const context={validateIntakeList,validateCustomFoods,validateFoodRecent,JSON,Date,Number,Array,Object,Set,Error,
 document:{getElementById:()=>({classList:{contains:()=>false}})},
 confirmDialog:async()=>{confirmations++;return true;},snapshot:()=>({ok:true}),
 setST:next=>{state=next;context.ST=next;replacements++;},ST:state,REST_SEC:60,setRest(){},
 validateClassState:()=>({ok:true}),validateAdaptState:()=>({ok:true}),validateMotivState:()=>({ok:true}),
 DAYS:{Segunda:{}},DEFAULT_DAYS:{Segunda:{ex:[]}},migrate:()=>({}),save:()=>true,ensureMotiv(){},clearDrafts(){},timerDismiss(){},render(){},
 show:msg=>{message=msg;},todayStr:()=>legacy.date,fmtTime:()=>'',closeOverlay(){}};
runInNewContext(source,context);
const importState=async incoming=>{const file={text:async()=>JSON.stringify({state:incoming})};await context.importBackup({target:{files:[file],value:'x'}});};
for(const incoming of [{sets:{},done:{},intake:[{...entry,meal:'bad'}]},{sets:{},done:{},foodsCustom:[{}]},{sets:{},done:{},foodRecent:['bad']}]) {
 const original=JSON.stringify(state);await importState(incoming);assert.equal(JSON.stringify(state),original);assert.equal(replacements,0);assert.equal(confirmations,0);assert.match(message,/Não foi possível importar/);
}
await importState({sets:{},done:{},intake:[legacy,entry],foodsCustom:[custom],foodRecent:['c:c123']});
assert.equal(replacements,1);assert.deepEqual(JSON.parse(JSON.stringify(state.intake)),[legacy,entry]);assert.equal(state.foodsCustom[0].id,custom.id);
context.csvDownload=(_name,rows)=>{csv=rows;};context.closeSheet=()=>{};context.exportIntakeCSV();
assert.deepEqual(Array.from(csv[0].slice(-3)),['refeicao','id_alimento','id_registo']);
assert.equal(csv[0].length,19);assert.equal(csv[1].length,19);assert.equal(csv[2].length,19);
assert(csv.some(row=>row.at(-1)==='new' && row.at(-2)==='off:123' && row.at(-3)==='pa'));
await importState({sets:{},done:{},intake:[legacy]});assert.equal(state.foodsCustom.length,0);assert.equal(state.foodRecent.length,0);
console.log('OK contratos: validação, rejeição atómica, legados, roundtrip, CSV, recentes, reescala e resumo');
