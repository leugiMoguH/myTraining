// state.js: logs, progression, nutrition, body data, media and completed sessions; lazy modules add plan/classes/motiv.
// onb contains the resumable draft; custom is today's live workout draft. Both stay local with session/UI/meta/adapt.
export const SYNCED_KEYS=Object.freeze(['log','prog','nutri','profile','measures','intake','foodsCustom','foodRecent','media','workouts','sessions','routine','sched','prefs','plan','classes','classLog','motiv']);
export function canonicalStringify(value) {
  return JSON.stringify(value,(_,v)=>v && typeof v==='object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
}
export async function hashOf(value) {
  const bytes=new TextEncoder().encode(canonicalStringify(value));
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
const clone=v=>JSON.parse(JSON.stringify(v));
export function pickSynced(s) { return clone(Object.fromEntries(SYNCED_KEYS.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]))); }
export async function keyHashes(s) {
  const frozen=pickSynced(s);
  return Object.fromEntries(await Promise.all(SYNCED_KEYS.map(async k=>[k,k in frozen ? await hashOf(frozen[k]) : null])));
}
export async function classify3(base,local,remote) {
  const [l,r]=await Promise.all([keyHashes(local),keyHashes(remote)]);
  return Object.fromEntries(SYNCED_KEYS.map(k=>{
    const b=base?.[k]??null;
    const v=l[k]===r[k] ? (l[k]===b?'same':'both-same') : l[k]===b?'remote':r[k]===b?'local':(l[k]===null || r[k]===null)&&b!==null?'delete-vs-edit':'conflict';
    return [k,v];
  }));
}
export function applyRemote(local,remote,keys=SYNCED_KEYS) {
  const next=clone(local);
  for(const k of keys) { if(!SYNCED_KEYS.includes(k)) throw Error('Unknown key'); if(remote[k]===undefined) delete next[k]; else next[k]=clone(remote[k]); }
  return next;
}
export function resolveKeys(local,remote,choices) {
  let next=clone(local);
  for(const [k,choice] of Object.entries(choices)) {
    if(!SYNCED_KEYS.includes(k)) throw Error('Unknown key');
    if(choice==='theirs') next=applyRemote(next,remote,[k]);
    else if(choice==='union') {
      const a=local[k],b=remote[k],valid=x=>Array.isArray(x)&&x.every(v=>v&&typeof v==='object'&&!Array.isArray(v)&&['string','number'].includes(typeof v.id))&&new Set(x.map(v=>v.id)).size===x.length;
      if(!valid(a)||!valid(b)) throw Error('Union requires unique object ids');
      const map=new Map(a.map(v=>[v.id,v]));
      for(const v of b) { if(map.has(v.id)&&canonicalStringify(map.get(v.id))!==canonicalStringify(v)) throw Error('Union has divergent id'); map.set(v.id,v); }
      next[k]=clone([...map.values()]); // Explicit union can resurrect deleted records.
    } else if(choice!=='mine') throw Error('Unknown choice');
  }
  return next;
}
