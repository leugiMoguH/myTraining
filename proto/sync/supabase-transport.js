const SESSION='proto_sync_session';
export function createTransport({url,anonKey,storage,fetch:request=globalThis.fetch,now=()=>Date.now()}) {
  url=url.replace(/\/$/,''); let refreshing;
  const session=()=>JSON.parse(storage.getItem(SESSION)||'null');
  const save=s=>{if(s?.access_token) storage.setItem(SESSION,JSON.stringify({...s,expires_at:s.expires_at||Math.floor(now()/1000)+s.expires_in}));};
  async function raw(path,{method='GET',body,token,prefer}={}) {
    let r;
    try { r=await request(url+path,{method,headers:{apikey:anonKey,Authorization:`Bearer ${token||anonKey}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}); }
    catch(e) { e.network=true; throw e; }
    const text=await r.text(); let data; try { data=text?JSON.parse(text):null; } catch { throw Error('Invalid server response'); }
    if(!r.ok) { const e=Error(data?.message||data?.msg||`HTTP ${r.status}`);e.status=r.status;e.code=data?.code;throw e; }
    return data;
  }
  async function refresh() {
    if(!refreshing) refreshing=(async()=>{
      const s=session(); if(!s?.refresh_token) throw Error('No session');
      const next=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});
      if(session()?.refresh_token!==s.refresh_token) throw Error('Session changed'); save(next); return next;
    })().finally(()=>{refreshing=null;});
    return refreshing;
  }
  async function rest(path,opts={}) {
    let s=session(); if(!s) throw Error('No session');
    if(s.expires_at<=now()/1000+30) s=await refresh();
    return raw('/rest/v1/'+path,{...opts,token:s.access_token});
  }
  const filter=()=>`user_id=eq.${encodeURIComponent(session()?.user?.id||'')}`;
  return {
    getUserId:()=>session()?.user?.id||null,refresh,
    async signUp(email,password) {const s=await raw('/auth/v1/signup',{method:'POST',body:{email,password}});save(s);return s;},
    async signIn(email,password) {const s=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});save(s);return s;},
    async signOut() {const s=session();if(s) await raw('/auth/v1/logout',{method:'POST',token:s.access_token});storage.removeItem(SESSION);},
    async getRemote() {return (await rest(`user_state?${filter()}&select=*`))[0]||null;},
    async insertFirst(row) {try {return (await rest('user_state',{method:'POST',body:row,prefer:'return=representation'}))[0]||null;}catch(e){if(e.code==='23505') return null;throw e;}},
    async casUpdate(rev,row) {return (await rest(`user_state?${filter()}&rev=eq.${rev}`,{method:'PATCH',body:row,prefer:'return=representation'}))[0]||null;},
    async findPush(id) {for(const table of ['user_state','user_state_history']) {const rows=await rest(`${table}?${filter()}&push_id=eq.${encodeURIComponent(id)}&select=*`);if(rows.length) return rows[0];}return null;},
    rest
  };
}
