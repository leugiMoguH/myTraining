import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createTransport} from '../proto/sync/supabase-transport.js';
import {memory,rlsMatrix,scenarios} from './sync-matrix.mjs';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
if(!url||!key) {console.log('SKIP: remoto não configurado');process.exit(0);}
const transports=[];
try {
  for(let i=0;i<2;i++) {
    const t=createTransport({url,anonKey:key,storage:memory()});transports.push(t);
    const s=await t.signUp(`sync-${randomBytes(12).toString('hex')}@example.test`,randomBytes(32).toString('base64url'));
    if(!s.access_token) throw Error('Test project must disable email confirmation');
  }
  const [a,b]=transports.map(t=>t.getUserId());
  const map=new Map([[a,transports[0]],[b,transports[1]]]);
  async function execute(user,table,method,body={},filters={}) {
    const query=Object.entries(filters).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join('&');
    const path=`${table}?${query}`;
    if(user) return map.get(user).rest(path,{method,...(['POST','PATCH'].includes(method)?{body}:{}),prefer:'return=representation'});
    const r=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},...(['POST','PATCH'].includes(method)?{body:JSON.stringify(body)}:{})});
    if(!r.ok)throw Error(`Anonymous HTTP ${r.status}`);return r.json();
  }
  // The expired-payload fixture also has an invalid signature: it cannot prove expiry validation alone.
  for(const token of ['invalid','eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjEsInN1YiI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMCJ9.invalid']) {
    const r=await fetch(`${url}/rest/v1/user_state?select=*`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});assert(!r.ok);
  }
  const h={a,b,execute,transport:u=>map.get(u)};
  await rlsMatrix(h);await scenarios(h);
} finally {
  const errors=[];
  for(const t of transports) if(t.getUserId()) {try {await t.rest('user_state',{method:'DELETE',prefer:'return=representation'});await t.signOut();}catch(e){errors.push(e);}}
  if(errors.length) throw new AggregateError(errors,'Remote test cleanup failed');
}
console.log('PASS: remote RLS matrix + sync scenarios (real JWT/PostgREST); signed expired JWT not independently validated');
