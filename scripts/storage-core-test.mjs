import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { validateBackupState, countsOf, checksumOf, buildBackup, verifyBackupText } from '../js/backup-core.js';
const good=()=>({ok:true}), validators=Object.fromEntries(['validateIntakeList','validateCustomFoods','validateFoodRecent','validateClassState','validateAdaptState','validateMotivState'].map(k=>[k,good]));
const empty={sets:{},done:{}};
assert.equal((await buildBackup(empty,{validators})).ok,false);
assert.equal((await buildBackup({sets:[]},{validators})).ok,false);
assert.equal((await buildBackup({sets:{},done:{},log:{x:[{sets:[null]}]}},{validators})).ok,false);
assert.equal(validateBackupState({...empty,intake:[{}]},{...validators,validateIntakeList:()=>({ok:false,reason:'bad food'})}).ok,false);
const {DEFAULT_DAYS}=await import('../js/data.js');
const seeded=JSON.parse(JSON.stringify(DEFAULT_DAYS));
for(const d of Object.values(seeded)){d.id='seed';for(const e of d.ex)e.id='seed';}
assert.equal((await buildBackup({...empty,routine:seeded},{validators})).ok,false);
const source={...empty,profile:{name:'João'},motiv:{bad:true},log:{x:[{date:'2026-01-01',sets:[{w:20,r:8}]}]}};
const before=JSON.stringify(source);
const warning=validateBackupState(source,{...validators,validateMotivState:()=>({ok:false})});
assert(warning.ok&&warning.reason);assert.equal(JSON.stringify(source),before);
const built=await buildBackup(source,{validators,now:'2026-01-01'});assert(built.ok);
assert.equal(JSON.stringify(source),before);
assert((await verifyBackupText(built.text,validators)).ok);
const invalidMotivCheck=await verifyBackupText(built.text,{...validators,validateMotivState:()=>({ok:false})});
assert(invalidMotivCheck.ok&&invalidMotivCheck.reason.includes('reposta'));
assert.equal(JSON.stringify(source),before);
const restored=JSON.parse(built.text).state;
assert.notEqual(restored,source);assert.deepEqual(countsOf(restored),countsOf(source));
assert.deepEqual(await checksumOf(JSON.stringify(restored),built.payload.checksum.alg),built.payload.checksum);
for(const text of [JSON.stringify(empty),JSON.stringify({state:empty}),JSON.stringify({app:'treino',v:2,state:empty})]) {
 const check=await verifyBackupText(text,validators);assert(check.ok&&!check.sealed);assert.match(check.reason,/sem selo/);
}
for(const text of ['', '  ',built.text.slice(0,-4)]) assert.equal((await verifyBackupText(text,validators)).ok,false);
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
for(const alg of ['fnv1a','sha256']) {
 const payload=JSON.parse(built.text);payload.checksum=await checksumOf(JSON.stringify(payload.state),alg);
 assert((await verifyBackupText(JSON.stringify(payload),validators)).ok);
 payload.state.profile.name='José'; // same UTF-8 length, different content
 assert.equal((await verifyBackupText(JSON.stringify(payload),validators)).ok,false);
 payload.checksum.value='00000000';assert.equal((await verifyBackupText(JSON.stringify(payload),validators)).ok,false);
}
const badCount=JSON.parse(built.text);badCount.counts.workouts++;assert.equal((await verifyBackupText(JSON.stringify(badCount),validators)).ok,false);
const badAlg=JSON.parse(built.text);badAlg.checksum.alg='unknown';assert.equal((await verifyBackupText(JSON.stringify(badAlg),validators)).ok,false);
Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});assert.equal((await checksumOf('abc')).alg,'fnv1a');assert.equal((await checksumOf('abc','fnv1a')).value,'1a47e90b');
await assert.rejects(()=>checksumOf('abc','sha256'));
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const freezing={...empty,profile:{name:'antes'}};const pending=buildBackup(freezing,{validators});freezing.profile.name='depois';assert.equal((await pending).payload.state.profile.name,'antes');
// Reuse only the smoke DOM setup; Node executes no browser or Playwright.
const setup=readFileSync(new URL('./smoke.mjs',import.meta.url),'utf8');
const begin=setup.indexOf('const el =');const end=setup.indexOf('/*',setup.indexOf('globalThis.prompt ='));
(0,eval)(setup.slice(begin,end));
await import('../js/app.js');
const h=await import('../js/storage-health.js');
assert.deepEqual(h.sizeOf('aç😀'),{chars:4,bytes:7});
const store=new Map();let writes=0;
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>{writes++;store.set(k,v);}};
store.set('treino_v2','aç😀');store.set('treino_drafts','12');
const health=await h.measureStorage();assert(health.ok);assert.deepEqual(health.total,{chars:6,bytes:9});assert.equal(writes,0);
store.set('treino_v2_snap','123');store.set('treino_v2_premigration','4');store.set('treino_v2_unreadable','56');
const allKeys=await h.measureStorage();assert.deepEqual(allKeys.total,{chars:12,bytes:15});assert.equal(Object.keys(allKeys.keys).length,5);assert.equal(writes,0);
const now=Date.parse('2026-10-27T12:00:00Z'), state={...empty,profile:{name:'A'}};
assert.equal((await h.backupAdvice({state,now,status:{storageOk:true}})).reason,'never');
const payload={state,exportedAt:new Date(now-15*86400000).toISOString(),counts:countsOf(state),checksum:await checksumOf(JSON.stringify(state))};
await h.recordPrepared(payload);
assert.equal(await h.backupAdvice({state,now,status:{storageOk:true}}),null);
state.profile.name='B';assert.equal((await h.backupAdvice({state,now,status:{storageOk:true}})).reason,'changed');
h.noteSaveFailure({storageOk:false},now-1000);
assert.equal((await h.backupAdvice({state,now,status:{storageOk:true}})).reason,'save-failure');
await h.recordPrepared(payload);assert(h.readBackupMeta().failureSince);
await h.recordPrepared({...payload,exportedAt:new Date(now).toISOString()});assert.equal(h.readBackupMeta().failureSince,null);
assert.equal(await h.backupAdvice({state:payload.state,now,status:{storageOk:false,since:now-1000}}),null);
h.noteSaveFailure({storageOk:false},now+1000);h.dismissBackupAdvice(now);
assert.equal(await h.backupAdvice({state,now,status:{storageOk:true}}),null);
assert.equal((await h.backupAdvice({state,now:now+8*86400000,status:{storageOk:true}})).reason,'save-failure');
globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
assert.equal((await h.measureStorage()).ok,false);assert.deepEqual(h.readBackupMeta(),{});assert.equal(h.updateBackupMeta({a:1}),false);
await h.recordPrepared(payload);assert((await buildBackup(state,{validators})).ok);
assert.equal((await h.backupAdvice({state,now,status:{storageOk:false}})).reason,'save-failure');
// Exercise the application export and file verifier as well as the pure contract.
const appState=await import('../js/state.js');
appState.ST.profile.height=180;
const appBackup=await import('../js/backup.js');
let downloaded, downloads=0;
const createURL=URL.createObjectURL, revokeURL=URL.revokeObjectURL;
URL.createObjectURL=blob=>{downloaded=blob;downloads++;return 'blob:test';};URL.revokeObjectURL=()=>{};
const appValidators={...(await import('../js/foods.js')),...(await import('../js/classes.js')),...(await import('../js/adapt.js')),...(await import('../js/motiv.js'))};
const appStore=new Map();
globalThis.localStorage={getItem:k=>appStore.get(k)??null,setItem:(k,v)=>appStore.set(k,v)};
await appBackup.exportBackup();assert.equal(downloads,1);
const appText=await downloaded.text();assert((await verifyBackupText(appText,appValidators)).ok);
assert(h.readBackupMeta().preparedAt&&h.readBackupMeta().downloadAt);
const unchanged=JSON.stringify(appState.ST);
const fileInput={files:[{text:async()=>appText}],value:'selected'};
await appBackup.verifyBackupFile({target:fileInput});
assert.equal(fileInput.value,'');assert.equal(JSON.stringify(appState.ST),unchanged);assert(h.readBackupMeta().verifiedAt);
const verifiedBefore=h.readBackupMeta().verifiedAt;
await appBackup.verifyBackupFile({target:{files:[{text:async()=>appText.slice(0,-2)}],value:'selected'}});
assert.equal(h.readBackupMeta().verifiedAt,verifiedBefore);assert.equal(JSON.stringify(appState.ST),unchanged);
globalThis.localStorage.setItem=()=>{throw Error('metadata blocked');};
await appBackup.exportBackup();assert.equal(downloads,2);
URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL;
function synthetic(n,meals=4000) {
 const date=i=>new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10);
 return {sets:{},done:{},workouts:Array.from({length:n},(_,i)=>({id:'w'+i,date:date(i),day:'Segunda',state:'COMPLETED',startedAt:1580000000000+i*86400000,endedAt:1580003600000+i*86400000,confirmedMs:3000000,pausedMs:0})),sessions:[],log:{Supino:Array.from({length:1000},(_,i)=>({date:date(i),w:40,r:8,sets:Array.from({length:3},()=>({w:40,r:8,sid:'w'+i}))}))},measures:Array.from({length:120},(_,i)=>({date:date(i*7),weight:80})),profile:{height:180},intake:Array.from({length:meals},(_,i)=>({id:'i'+i,date:date(i%1000),name:'Refeição sintética',g:100,kcal:200,protein:15,n:{carbs:20,fat:8}}))};
}
for(const n of [1000,300]) {
 const s=synthetic(n), b=await buildBackup(s,{validators});assert(b.ok);assert((await verifyBackupText(b.text,validators)).ok);
 assert.equal(countsOf(JSON.parse(b.text).state).intake,4000);
 console.log('SYNTHETIC',JSON.stringify({workouts:n,meals:4000,total:h.sizeOf(JSON.stringify(s)),groups:h.groupsOf(s)}));
}
console.log('OK - storage core: validation, seals, isolation, dimensions, advice and unavailable metadata');
process.exit(0);
