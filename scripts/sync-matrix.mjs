import assert from 'node:assert/strict';
import {canonicalStringify,hashOf} from '../proto/sync/sync-core.js';
import {createEngine} from '../proto/sync/sync-engine.js';
export const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
let serial=0;
export const nextId=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
export async function payload(user,state={profile:{name:'fixture'}}) {return {user_id:user,rev:1,schema_v:2,state:canonicalStringify(state),state_hash:await hashOf(state),push_id:nextId(),device_id:'test'};}
export async function pgliteHarness() {
  const {PGlite}=await import('@electric-sql/pglite');
  const {readFile}=await import('node:fs/promises');
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  const sql=await readFile(new URL('../supabase/migrations/20261027000000_user_state.sql',import.meta.url),'utf8');
  await db.exec(sql); await db.exec(sql);
  const a=nextId(),b=nextId();
  async function execute(user,table,method,body={},filters={},minimal=false) {
    return db.transaction(async tx=>{
      await tx.exec(`set local role ${user?'authenticated':'anon'}`);
      await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(user?{sub:user}:{})]);
      const vals=[],param=v=>{vals.push(v);return '$'+vals.length;};
      const where=Object.entries(filters).map(([k,v])=>`${k}=${param(v)}`).join(' and ');
      let q;
      if(method==='GET') q=`select * from public.${table}${where?' where '+where:''}`;
      if(method==='DELETE') q=`delete from public.${table}${where?' where '+where:''} returning *`;
      if(method==='POST') {const keys=Object.keys(body);q=`insert into public.${table} (${keys.join(',')}) values (${keys.map(k=>param(body[k])).join(',')})${minimal?'':' returning *'}`;}
      if(method==='PATCH') q=`update public.${table} set ${Object.keys(body).map(k=>`${k}=${param(body[k])}`).join(',')}${where?' where '+where:''} returning *`;
      return (await tx.query(q,vals)).rows;
    });
  }
  function transport(user) {return {
    getUserId:()=>user,
    getRemote:async()=> (await execute(user,'user_state','GET',{}, {user_id:user}))[0]||null,
    insertFirst:async row=>{try{return (await execute(user,'user_state','POST',row))[0]||null;}catch(e){if(e.code==='23505')return null;throw e;}},
    casUpdate:async(rev,row)=>(await execute(user,'user_state','PATCH',row,{user_id:user,rev}))[0]||null,
    findPush:async id=>{for(const t of ['user_state','user_state_history']){const rows=await execute(user,t,'GET',{}, {push_id:id});if(rows.length)return rows[0];}return null;}
  };}
  return {a,b,execute,transport,close:()=>db.close()};
}
export async function rlsMatrix(h) {
  const {a,b,execute:x}=h;
  const pa=await payload(a),pb=await payload(b);
  assert.equal((await x(b,'user_state','GET')).length,0,'B initially empty');
  assert.equal((await x(a,'user_state','POST',pa)).length,1);
  assert.equal((await x(b,'user_state','POST',pb)).length,1);
  assert.deepEqual((await x(a,'user_state','GET')).map(r=>r.user_id),[a]);
  assert.equal((await x(a,'user_state','GET',{}, {user_id:b})).length,0);
  assert.equal((await x(a,'user_state','PATCH',{state:'stolen'},{user_id:b})).length,0);
  assert.equal((await x(a,'user_state','DELETE',{}, {user_id:b})).length,0);
  await assert.rejects(()=>x(a,'user_state','POST',pb));
  await assert.rejects(()=>x(a,'user_state','POST',{...pb,user_id:'00000000-0000-0000-0000-0000000000c3'}),/row-level security/);
  await assert.rejects(()=>x(a,'user_state','POST',{...pb,user_id:'00000000-0000-0000-0000-0000000000c3'},{},true),/row-level security/);
  await assert.rejects(()=>x(a,'user_state','PATCH',{user_id:b},{user_id:a}));
  for(const method of ['GET','POST','PATCH','DELETE']) await assert.rejects(()=>x(null,'user_state',method,method==='POST'?pa:{state:'anon'},{user_id:a}));
  for(const method of ['GET','POST','PATCH','DELETE']) await assert.rejects(()=>x(null,'user_state_history',method,method==='POST'?pa:{state:'anon'},{user_id:a}));
  assert.equal((await x(a,'user_state','PATCH',{rev:900},{user_id:a,rev:1}))[0].rev,2);
  await assert.rejects(()=>x(a,'user_state','PATCH',{rev:1},{user_id:a}));
  assert.equal((await x(a,'user_state','PATCH',{state:'stale'},{user_id:a,rev:1})).length,0);
  for(const method of ['POST','PATCH','DELETE']) await assert.rejects(()=>x(a,'user_state_history',method,method==='POST'?pa:{state:'tamper'},{user_id:a}));
  assert.equal((await x(a,'user_state_history','GET')).length,1);
  assert.equal((await x(b,'user_state_history','GET',{}, {user_id:a})).length,0);
  assert.equal((await x(b,'user_state','GET'))[0].state,pb.state);
  assert.equal((await x(a,'user_state','GET'))[0].state,pa.state);
  assert.equal((await x(a,'user_state','DELETE',{}, {user_id:a})).length,1);
  assert.equal((await x(a,'user_state_history','GET')).length,0);
  await assert.rejects(()=>x(a,'user_state','POST',{...pa,rev:3}));
  assert.equal((await x(b,'user_state','DELETE',{}, {user_id:b})).length,1);
}
export async function scenarios(h) {
  const user=h.a,base=h.transport(user);
  function device(seed={meta:{schema:2},profile:{name:'old'},workouts:[{id:'old'},{id:'new'}]}) {
    let state=structuredClone(seed),account=user,offline=false,lost=false,hook,backup=true;
    const t={getUserId:()=>account};
    for(const k of ['getRemote','insertFirst','casUpdate','findPush']) t[k]=async(...args)=>{
      if(offline) throw Object.assign(Error('offline'),{network:true});
      if(hook){const f=hook;hook=null;await f();}
      const r=await base[k](...args);
      if(lost&&['insertFirst','casUpdate'].includes(k)){lost=false;throw Object.assign(Error('lost response'),{network:true});}return r;
    };
    const engine=createEngine({storage:memory(),transport:t,getState:()=>state,applyState:s=>{state=s;return true;},backupBeforeApply:async()=>backup,newId:nextId,now:()=>123});
    return {engine,get state(){return state;},edit:f=>{f(state);engine.markDirty();},offline:v=>offline=v,lost:()=>lost=true,account:v=>account=v,hook:f=>hook=f,backup:v=>backup=v};
  }
  const one=device(); assert.equal((await one.engine.syncNow()).status,'ok');
  const two=device({meta:{schema:2}});assert.equal((await two.engine.syncNow()).status,'ok');assert.deepEqual(two.state.profile,one.state.profile);
  one.offline(true);one.edit(s=>s.profile.name='offline');assert.equal((await one.engine.syncNow()).status,'offline');assert(one.engine.getMeta().dirty);
  one.offline(false);assert.equal((await one.engine.syncNow()).status,'ok');const rev=(await base.getRemote()).rev;assert.equal((await one.engine.syncNow()).status,'ok');assert.equal((await base.getRemote()).rev,rev);
  two.edit(s=>s.profile.name='parallel');assert.equal((await two.engine.syncNow()).status,'conflict');assert.equal(two.state.profile.name,'parallel');assert.equal(JSON.parse((await base.getRemote()).state).profile.name,'offline');
  two.backup(false);assert.equal((await two.engine.resolve({profile:'theirs'})).status,'blocked');assert.equal(two.state.profile.name,'parallel');
  two.backup(true);assert.equal((await two.engine.resolve({profile:'theirs'})).status,'ok');assert.equal(two.state.profile.name,'offline');
  // Retention cuts propagate as deletions; union would explicitly resurrect them.
  one.edit(s=>s.workouts=s.workouts.slice(1));assert.equal((await one.engine.syncNow()).status,'ok');assert.equal((await two.engine.syncNow()).status,'ok');assert.deepEqual(two.state.workouts,[{id:'new'}]);
  one.edit(s=>s.profile.name='lost');one.lost();assert.equal((await one.engine.syncNow()).status,'offline');const applied=(await base.getRemote()).rev;assert.equal((await one.engine.syncNow()).status,'ok');assert.equal((await base.getRemote()).rev,applied);
  one.edit(s=>s.profile.name='archived-response');one.lost();assert.equal((await one.engine.syncNow()).status,'offline');
  assert.equal((await two.engine.syncNow()).status,'ok');two.edit(s=>s.profile.name='after-archive');assert.equal((await two.engine.syncNow()).status,'ok');
  const archiveRev=(await base.getRemote()).rev;assert.equal((await one.engine.syncNow()).status,'ok');assert.equal((await base.getRemote()).rev,archiveRev);assert.equal(one.state.profile.name,'after-archive');
  one.account(h.b);assert.equal((await one.engine.syncNow()).status,'blocked');one.account(user);
  one.edit(s=>s.profile.name='before-await');one.hook(()=>one.edit(s=>s.profile.name='during-await'));assert.equal((await one.engine.syncNow()).status,'ok');assert(one.engine.getMeta().dirty);assert.equal(JSON.parse((await base.getRemote()).state).profile.name,'before-await');assert.equal((await one.engine.syncNow()).status,'ok');
  const current=await base.getRemote();await base.casUpdate(current.rev,{...current,schema_v:99,push_id:nextId()});assert.equal((await one.engine.syncNow()).reason,'schema');
  await h.execute(user,'user_state','DELETE',{}, {user_id:user});assert.equal((await two.engine.syncNow()).reason,'remote-deleted');
  const legacy=device({log:{old:[{date:'2020-01-01',w:10,r:5}]}});legacy.lost();assert.equal((await legacy.engine.syncNow()).status,'offline');assert.equal((await legacy.engine.syncNow()).status,'ok');assert.equal((await base.getRemote()).rev,1);assert.equal('workouts' in legacy.state,false);
  assert.equal(await h.transport(h.b).getRemote(),null);
  await h.execute(user,'user_state','DELETE',{}, {user_id:user});
}
