/* Smoke test dos módulos ES (Fase 0) — corre com: npm run smoke
   Não substitui o teste no browser; apanha o que falha em silêncio:
   ciclos de import mal ordenados, símbolos em falta e handlers inline sem ponte. */
import { readFileSync, readdirSync } from 'node:fs';

const JS = new URL('../js/', import.meta.url);
const read = f => readFileSync(new URL(f, JS), 'utf8');
const files = readdirSync(JS).filter(f => f.endsWith('.js'));
const fail = [];
for(const file of files) {
  if(/\b(?:alert|confirm|prompt)\s*\(/.test(read(file))) fail.push(`${file}: diálogo nativo`);
}

/* ── 1. DOM mínimo, só o suficiente para os módulos avaliarem ───────────── */
const el = () => new Proxy(function () {}, {
  get(_, p) {
    if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
    if (p === 'style' || p === 'dataset') return {};
    if (p === 'value' || p === 'textContent' || p === 'innerHTML') return '';
    if (p === 'hidden') return true;
    if (p === Symbol.toPrimitive) return () => '';
    return el();
  },
  set: () => true,
  apply: () => el(),
});
const store = new Map();
globalThis.window = globalThis;
globalThis.document = {
  getElementById: el, querySelector: el, querySelectorAll: () => [],
  createElement: el, addEventListener() {}, hidden: false, visibilityState: 'hidden', body: el(),
};
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
Object.defineProperty(globalThis, 'navigator', {
  value: { vibrate() {}, mediaDevices: undefined }, configurable: true, writable: true,
});
globalThis.sessionStorage = { getItem: () => null };

globalThis.alert = () => {};
globalThis.addEventListener = () => {};
globalThis.confirm = () => false;
globalThis.prompt = () => null;

/* ── 2. avaliar o grafo inteiro a partir do ponto de entrada ─────────────── */
const assert=(await import('node:assert/strict')).default;
const events=[];
globalThis.CustomEvent=class { constructor(type,opts){this.type=type;this.detail=opts?.detail;} };
document.dispatchEvent=e=>{events.push(e);return true;};
let seq=0;
async function fresh(raw=null, options={}) {
  events.length=0;
  const data=new Map(raw===null?[]:[['treino_v2',raw]]);
  globalThis.localStorage={getItem(k){if(options.unavailable)throw Error('blocked');return data.get(k)??null;},setItem(k,v){if(options.copyFail&&k==='treino_v2_unreadable')throw Error('quota');data.set(k,v);}};
  const api=await import(`../js/save-state.js?case=${seq++}`);
  return {api,data,options};
}
let {api}=await fresh();
const memory={log:{test:[{w:25,r:8}]}};
assert.equal(api.persist(memory),true);
assert.equal(api.getSaveState().pending,false);
const originalSet=localStorage.setItem;
localStorage.setItem=()=>{const e=Error('quota');e.name='QuotaExceededError';throw e;};
events.length=0;
assert.equal(api.persist(memory),false);
assert.equal(api.getSaveState().pending,true);
assert.equal(events.filter(e=>e.type==='save-state').length,1);
assert.equal(events.filter(e=>e.type==='app-notice').length,1);
api.persist(memory);
assert.equal(events.filter(e=>e.type==='app-notice').length,1);
assert.deepEqual(memory,{log:{test:[{w:25,r:8}]}});
localStorage.setItem=originalSet;
assert.equal(api.persist(memory),true);
assert.equal(api.getSaveState().pending,false);
assert.equal(events.at(-1).detail.msg,'Guardado ✓');
localStorage.setItem=()=>{throw Error('quota');};
assert.equal(api.persist(memory,{rolledBack:true}),false);
assert.equal(api.getSaveState().pending,false);
assert.equal(events.at(-1).detail.msg,'Não foi possível guardar; alteração desfeita');
({api}=await fresh());
localStorage.getItem=()=>'{"x":2}';
assert.equal(api.persist({x:1}),false,'same length readback mismatch');
({api}=await fresh());
localStorage.getItem=()=>{throw Error('readback');};
assert.equal(api.persist(memory),false);
let test=await fresh('{broken');
assert.deepEqual(test.api.loadStored(),{});
assert.equal(test.data.get('treino_v2_unreadable'),'{broken');
assert.equal(test.data.get('treino_v2'),'{broken');
assert.equal(test.api.getSaveState().loadProblem,'copied');
test=await fresh('{broken');
const copyGet=localStorage.getItem;
localStorage.getItem=k=>k==='treino_v2_unreadable' ? 'different' : copyGet(k);
test.api.loadStored();
assert.equal(test.api.persist(memory),false,'unverified raw copy blocks writes');
assert.equal(test.data.get('treino_v2'),'{broken');
test=await fresh('[]');test.data.set('treino_v2_unreadable','older');test.api.loadStored();
assert.equal(test.data.get('treino_v2_unreadable'),'older');
assert.equal(test.api.persist(memory),false,'a different older copy cannot protect the current raw data');
test=await fresh('{broken',{copyFail:true});test.api.loadStored();
assert.equal(test.api.persist(memory),false);
assert.equal(test.data.get('treino_v2'),'{broken');
assert.equal(test.api.getSaveState().pending,true);
assert.equal(test.api.getSaveState().loadProblem,'blocked');
test=await fresh(null,{unavailable:true});test.api.loadStored();
assert.equal(test.api.getSaveState().storageOk,false);
assert.equal(test.api.getSaveState().pending,false);
assert.equal(test.api.persist(memory),false);
await fresh();
await import('../js/app.js');
const state=await import('../js/state.js');
state.setST({day:'Segunda',sets:{},done:{},log:{},profile:{}});
localStorage.setItem=()=>{throw Error('quota');};
assert.equal(state.logSet('Teste',25,8,false,'Segunda'),true);
assert.equal(state.getSaveState().pending,true);
assert.equal(state.ST.log.Teste[0].w,25);
state.setST({sets:{},done:{},log:{}});
assert.equal(state.getSaveState().pending,true);   /* setST/rollback não esconde alterações por guardar */
assert.equal(state.addSetLog('Teste',25,8,false,'Segunda:0','Segunda'),true);
assert.equal(state.ST.log.Teste[0].sets.length,1);
assert.equal(state.getSaveState().pending,true);
const {DEFAULT_DAYS}=await import('../js/data.js');
state.setST({day:'Segunda',sets:{},done:{},log:{},workouts:[],routine:structuredClone(DEFAULT_DAYS)});
const session=await import('../js/session.js');
session.startSession('Segunda','Teste');
assert.equal(session.completeSession(),false);
assert.equal(state.ST.session.state,'COMPLETED');
assert.equal(state.ST.workouts.length,1);
localStorage.setItem=(k,v)=>store.set(k,String(v));
localStorage.getItem=k=>store.get(k)??null;
assert.equal(state.save(),true);
assert.equal(state.ST.workouts.length,1);
console.log('OK — persistence, recovery, rollback, exact readback and in-memory state');
process.exit(0);
