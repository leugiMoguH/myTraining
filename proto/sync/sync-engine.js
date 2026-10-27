import {pickSynced,keyHashes,hashOf,canonicalStringify,classify3,applyRemote,resolveKeys} from './sync-core.js';
const KEY='proto_sync_meta',copy=v=>JSON.parse(JSON.stringify(v));
export function createEngine({storage,transport,getState,applyState,now=()=>Date.now(),newId=()=>crypto.randomUUID(),backupBeforeApply}) {
  let generation=0,busy=false;
  const read=()=>JSON.parse(storage.getItem(KEY)||'null');
  const write=m=>storage.setItem(KEY,JSON.stringify(m));
  const account=()=>transport.getUserId();
  function markDirty() { generation++; const m=read(); if(m) write({...m,dirty:true}); }
  async function checkedApply(next,user,g) {
    if(!backupBeforeApply || await backupBeforeApply(copy(getState()))!==true) throw Error('Verified backup required');
    if(account()!==user || generation!==g) throw Error('State changed during backup');
    if(await applyState(next)===false) throw Error('Apply failed');
  }
  async function run(choices) {
    const full=copy(getState()),snapshot=pickSynced(full),user=account(),g=generation,initial=read();
    const schema=full.meta?.schema||1;
    if(busy) return {status:'blocked',reason:'busy'};
    if(!user || initial && initial.user_id!==user) return {status:'blocked',reason:'account'};
    busy=true;
    let m=initial||{user_id:user,base_rev:0,base_hashes:null,dirty:true,inflight:null,conflict:null};
    write(m);
    const valid=()=>{if(account()!==user) throw Error('Account changed');};
    try {
      const snapshotHash=await hashOf(snapshot); valid();
      if(m.inflight) {
        const found=await transport.findPush(m.inflight.push_id); valid();
        if(found) {
          if(found.schema_v>schema) return {status:'blocked',reason:'schema'};
          if(found.user_id!==user || found.state_hash!==m.inflight.snapshot_hash) return {status:'blocked',reason:'inflight-mismatch'};
          const sent=JSON.parse(found.state);
          m={...m,base_rev:found.rev,base_hashes:await keyHashes(sent),inflight:null,dirty:canonicalStringify(snapshot)!==canonicalStringify(sent),conflict:null}; write(m);
        } else { m={...m,inflight:null}; write(m); }
      }
      const row=await transport.getRemote(); valid();
      if(row && row.schema_v>schema) return {status:'blocked',reason:'schema'};
      if(!row && m.base_rev>0) return {status:'blocked',reason:'remote-deleted'};
      const remote=row?JSON.parse(row.state):{};
      if(row && await hashOf(remote)!==row.state_hash) return {status:'blocked',reason:'hash'};
      const classes=await classify3(m.base_hashes,snapshot,remote); valid();
      const keys=Object.keys(classes).filter(k=>['conflict','delete-vs-edit'].includes(classes[k]));
      if(keys.length && !choices) { m={...m,conflict:{rev:row?.rev||0,keys},dirty:true}; write(m); return {status:'conflict',keys}; }
      if(choices && (!m.conflict || m.conflict.rev!==(row?.rev||0) || keys.some(k=>!choices[k]))) return {status:'blocked',reason:'stale-resolution'};
      let merged=applyRemote(snapshot,remote,Object.keys(classes).filter(k=>classes[k]==='remote'));
      if(choices) merged=resolveKeys(merged,remote,choices);
      const changed=canonicalStringify(merged)!==canonicalStringify(snapshot);
      if(changed) {
        if(generation!==g || canonicalStringify(pickSynced(getState()))!==canonicalStringify(snapshot)) return {status:'blocked',reason:'local-changed'};
        await checkedApply(applyRemote(getState(),merged),user,g); valid();
      }
      const hashes=await keyHashes(merged); valid();
      if(row && canonicalStringify(merged)===canonicalStringify(remote)) {
        m={...m,base_rev:row.rev,base_hashes:hashes,dirty:generation!==g||canonicalStringify(pickSynced(getState()))!==canonicalStringify(merged),inflight:null,conflict:null}; write(m); return {status:'ok'};
      }
      const push_id=newId(),state_hash=changed?await hashOf(merged):snapshotHash;
      valid();
      const payload={user_id:user,rev:row?.rev||1,schema_v:schema,state:canonicalStringify(merged),state_hash,push_id,device_id:full.meta?.deviceId||'prototype'};
      m={...m,dirty:true,inflight:{push_id,base_rev:row?.rev||0,snapshot_hash:state_hash,user_id:user,started_at:now()}}; write(m);
      const result=row?await transport.casUpdate(row.rev,payload):await transport.insertFirst(payload); valid();
      if(!result) {
        const latest=await transport.getRemote(); valid();
        if(latest?.schema_v>schema) return {status:'blocked',reason:'schema'};
        const divergence=await classify3(m.base_hashes,snapshot,latest?JSON.parse(latest.state):{});
        const keys=Object.keys(divergence).filter(k=>['conflict','delete-vs-edit'].includes(divergence[k]));
        m={...m,conflict:{rev:latest?.rev||0,keys},dirty:true};write(m);
        return {status:'conflict',keys};
      }
      m={...m,base_rev:result.rev,base_hashes:hashes,dirty:generation!==g||canonicalStringify(pickSynced(getState()))!==canonicalStringify(merged),inflight:null,conflict:null}; write(m);
      return {status:'ok'};
    } catch(error) {
      if(account()===user) write({...m,dirty:true});
      return {status:error.network?'offline':'blocked',reason:error.message};
    } finally { busy=false; }
  }
  return {syncNow:()=>run(),resolve:choices=>run(choices),markDirty,getMeta:read};
}
