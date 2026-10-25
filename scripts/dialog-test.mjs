import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { skipOnboarding } from './_skip-onb.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const shots=join(root,'test-results'); mkdirSync(shots,{recursive:true});
const server=createServer((req,res)=>{
  const path=join(root,...decodeURIComponent(req.url.split('?')[0]).split('/').filter(s=>s && s!=='..'));
  const file=req.url==='/'?join(root,'index.html'):path;
  if(!existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage(); page.setDefaultTimeout(7000);
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>{errors.push(`Diálogo nativo: ${d.message()}`);d.dismiss();});
await skipOnboarding(page);
let count=0;
const test=async(name,fn)=>{await fn();count++;console.log(`OK ${name}`);};
const modal=()=>page.locator('.app-dialog-bg');
const choose=async name=>{const node=await modal().elementHandle();await modal().getByRole('button',{name,exact:true}).click();await page.waitForFunction(e=>!e.isConnected,node);await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));};
const policy=async danger=>{
  const card=modal().locator('form'), buttons=modal().locator('.app-dialog-actions button');
  assert.equal(await card.getAttribute('role'),danger?'alertdialog':'dialog');
  assert.equal(await buttons.first().innerText(),'Cancelar');
  assert.equal(await (danger?buttons.first():buttons.last()).evaluate(e=>e===document.activeElement),true);
};
const open=async(options={},prompt=false)=>{
  await page.evaluate(({options,prompt})=>{ window.result='pending'; (prompt?window.M.dialog.promptDialog(options):window.M.dialog.confirmDialog({title:'Confirmar',message:'Uma decisão explícita.',...options})).then(r=>{window.result=r;}); },{options,prompt});
  await modal().waitFor();
  if(!prompt) await policy(!!options.danger);
};
const result=()=>page.evaluate(()=>window.result);
const boot=async()=>{
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
    window.M={};
    for(const name of ['dialog','state','routine','workout','session','nav','custom','history','editor','profile','onboarding','migrate','nutrition','media','notice','timer']) window.M[name]=await import(`./js/${name}.js`);
    window.base=JSON.parse(JSON.stringify(window.M.state.ST));
  });
};
const reset=async()=>page.evaluate(()=>{
  const {M}=window;
  if(document.getElementById('woBg').classList.contains('show'))M.workout.closeWorkout();
  M.timer.timerDismiss(); M.state.setST(JSON.parse(JSON.stringify(window.base))); M.state.save();
  for(const id of ['infoBg','sheetBg','onbBg','mvBg']) document.getElementById(id)?.classList.remove('show');
  document.querySelectorAll('[inert]').forEach(e=>e.inert=false);
  window.render('__hoje');
});
const state=()=>page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('treino_v2')),(k,v)=>['seenAt','confirmedMs','pos'].includes(k)?undefined:v));
const run=async(fn,arg)=>page.evaluate(async({fn,arg})=>{
  window.action='pending';
  const f=(0,eval)(`(${fn})`);
  Promise.resolve(f(window.M,arg)).then(r=>{window.action=r;}).catch(e=>{window.action='error:'+e.message;});
},{fn:fn.toString(),arg});
const screenshot=async(name,theme='dark',width=390)=>page.screenshot({path:join(shots,`bloco3-${name}-${theme}-${width}.png`)});

try {
  await boot();
  await test('foco, Tab, Shift+Tab, Escape e restauro exato de inert/scroll',async()=>{
    await page.locator('#navMain').focus();
    await page.evaluate(()=>{document.getElementById('sheetBg').setAttribute('inert','previous');document.body.style.overflow='clip';});
    await open({danger:true});
    assert.equal(await modal().getByRole('button',{name:'Cancelar'}).evaluate(e=>e===document.activeElement),true);
    assert.equal(await page.evaluate(()=>[...document.body.children].filter(e=>!e.matches('.app-dialog-bg')).every(e=>e.inert)),true);
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await modal().getByRole('button',{name:'Confirmar'}).evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Tab');
    assert.equal(await modal().getByRole('button',{name:'Cancelar'}).evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape'); assert.equal(await result(),false);
    assert.equal(await page.evaluate(()=>document.getElementById('sheetBg').getAttribute('inert')),'previous');
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'clip');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'navMain');
    await page.evaluate(()=>{document.body.style.overflow='';document.getElementById('sheetBg').inert=false;});
  });
  await test('notificações acrescentadas ao body recuperam inert ao fechar',async()=>{
    await page.evaluate(()=>{window.noticeInert=document.getElementById('notice').getAttribute('inert');});
    await open();
    await page.evaluate(()=>{
      const notice=document.getElementById('notice');
      notice.remove(); document.body.append(notice);
      const toast=document.createElement('div'); toast.id='dialog-test-toast'; document.body.append(toast);
    });
    await page.waitForFunction(()=>document.getElementById('dialog-test-toast').inert);
    assert.equal(await page.locator('#notice').evaluate(e=>e.inert),true);
    await choose('Cancelar');
    assert.equal(await page.locator('#notice').getAttribute('inert'),await page.evaluate(()=>window.noticeInert));
    assert.equal(await page.locator('#dialog-test-toast').getAttribute('inert'),null);
    await page.locator('#dialog-test-toast').evaluate(e=>e.remove());
  });
  await test('confirmar, cancelar, fundo e preenchimento do prompt',async()=>{
    await open();await choose('Confirmar');assert.equal(await result(),true);
    await open();await choose('Cancelar');assert.equal(await result(),false);
    await open();await modal().click({position:{x:1,y:1}});assert.equal(await result(),false);
    await open({danger:true});await modal().click({position:{x:1,y:1}});assert.equal(await result(),'pending');await choose('Cancelar');
    await open({title:'URL',label:'URL'},true);assert.equal(await modal().locator('input').evaluate(e=>e===document.activeElement),true);
    await modal().locator('input').fill('texto');await modal().click({position:{x:1,y:1}});assert.equal(await result(),'pending');
    await modal().locator('input').press('Enter');assert.equal(await result(),'texto');
  });
  await test('segundo pedido recusado, duplo clique e diálogo sucessivo',async()=>{
    await open();assert.equal(await page.evaluate(()=>M.dialog.confirmDialog({title:'Segundo'})),false);
    assert.equal(await page.evaluate(()=>M.dialog.promptDialog({title:'Segundo',label:'Texto'})),null);
    await page.evaluate(()=>{window.decisions=0; const b=document.querySelector('.app-dialog .btn-primary'); b.click(); b.click();});
    assert.equal(await result(),true);
    await page.evaluate(()=>{window.chain=[];M.dialog.confirmDialog({title:'Um'}).then(async r=>{chain.push(r);chain.push(await M.dialog.confirmDialog({title:'Dois'}));});});
    await choose('Confirmar');await modal().waitFor();await choose('Cancelar');
    assert.deepEqual(await page.evaluate(()=>chain),[true,false]);
  });
  await test('Escape não fecha ficha; guiado conserva inert e relógio',async()=>{
    await reset();await run(M=>M.workout.startWorkout('Segunda'));await page.locator('.wo-name').waitFor();
    const origin=await page.evaluate(()=>Object.fromEntries([...document.body.children].map(e=>[e.id,e.getAttribute('inert')])));
    await page.evaluate(()=>window.openInfo('Leg press',''));
    await open({danger:true});await page.keyboard.press('Escape');
    assert.equal(await page.locator('#infoBg').evaluate(e=>e.classList.contains('show')),true);
    await page.evaluate(()=>window.closeInfo());
    for(const [id,value]of Object.entries(origin))if(id)assert.equal(await page.locator(`#${id}`).getAttribute('inert'),value);
    await open();const t=await page.locator('#wo-clock').innerText();await page.waitForTimeout(1200);assert.notEqual(await page.locator('#wo-clock').innerText(),t);await choose('Cancelar');
    await reset();
  });

  // Cada confirmação crítica tem cancelamento sem mutações e aprovação efetiva.
  const critical=[
    ['terminar guiado',M=>{M.workout.startWorkout('Segunda');},M=>M.workout.woFinish(),M=>M.state.ST.session.state==='COMPLETED'],
    ['retomar outra sessão',M=>{M.workout.startWorkout('Segunda');M.workout.closeWorkout();},M=>M.workout.startWorkout('Terça'),()=>document.getElementById('woBg').classList.contains('show')],
    ['remover exercício',()=>{},M=>M.editor.edRemove('Segunda',0),M=>M.routine.exercisesOf('Segunda').length===6],
    ['repor rotina',M=>{M.routine.updateExercise('Segunda',0,{s:9});},M=>M.editor.edReset('Segunda'),M=>M.routine.exercisesOf('Segunda')[0].s===4],
    ['reset dia',M=>{M.state.ST.sets={'Segunda:0':[0]};M.state.save();},M=>M.state.resetDay('Segunda'),M=>!M.state.ST.sets['Segunda:0']],
    ['apagar medida',M=>{M.state.ST.measures=[{date:'2026-01-01',weight:80}];M.state.save();},M=>M.profile.delMeasure('2026-01-01'),M=>!M.state.ST.measures.length],
    ['apagar série',M=>{M.state.ST.hx='Leg press';M.state.ST.log={'Leg press':[{date:'2026-01-01',w:20,r:10,sets:[{w:20,r:10},{w:25,r:8}]}]};M.state.save();},M=>M.history.hxDelSet('2026-01-01',0),M=>M.state.ST.log['Leg press'][0].sets.length===1],
    ['apagar dia histórico',M=>{M.state.ST.hx='Leg press';M.state.ST.log={'Leg press':[{date:'2026-01-01',w:20,r:10}]};M.state.save();},M=>M.history.hxDelDay('2026-01-01'),M=>!M.state.ST.log['Leg press'].length],
    ['descartar personalizado',M=>{M.state.ST.custom={date:M.state.todayStr(),label:'Teste',stage:'active',ex:[{name:'Leg press',s:4,r:'10'}]};M.state.ST.sets={'Personalizado:0':[0]};M.state.save();},M=>M.custom.cuDiscard(),M=>!M.state.ST.custom],
    ['personalizado vazio',M=>{M.state.ST.custom={date:M.state.todayStr(),label:'Teste',stage:'active',ex:[{name:'Leg press',s:4,r:'10'}]};M.workout.startWorkout('Personalizado');},M=>M.workout.woFinish(),M=>!M.state.ST.custom && !document.getElementById('woBg').classList.contains('show')],
    ['recuperar sessão indisponível',M=>{M.session.startSession('Personalizado','Teste');},M=>M.nav.openLive(),M=>M.state.ST.session.state==='COMPLETED'],
    ['iniciar concluído (cartão)',M=>{M.session.startSession('Segunda','Teste');M.session.completeSession();window.render('Segunda');},M=>M.nav.heroStart('Segunda'),M=>M.state.ST.session.state==='ACTIVE'],
    ['iniciar concluído (barra)',M=>{M.session.startSession('Segunda','Teste');M.session.completeSession();window.render('Segunda');},M=>M.nav.navMain(),M=>M.state.ST.session.state==='ACTIVE'],
    ['encerrar última atividade',M=>{M.session.startSession('Segunda','Teste');M.state.ST.session.seenAt=Date.now()-7200000;M.state.save();M.nav.syncNav();},()=>document.getElementById('navEnd').click(),M=>M.state.ST.session.state==='COMPLETED'],
    ['descartar sessão',M=>{M.session.startSession('Segunda','Teste');M.nav.syncNav();},()=>document.getElementById('navDrop').click(),M=>M.state.ST.session.state==='ABANDONED'],
  ];
  for(const [name,prepare,action,check]of critical)await test(`confirmação: ${name}`,async()=>{
    await reset();await run(prepare);const before=await state();await run(action);await modal().waitFor();await policy(!['terminar guiado','retomar outra sessão','iniciar concluído (cartão)','iniciar concluído (barra)','encerrar última atividade'].includes(name));await choose('Cancelar');assert.equal(await state(),before,name);
    if(name==='personalizado vazio')assert.equal(await page.locator('#woBg.show').count(),1);
    await run(action);await modal().waitFor();await choose(await modal().locator('.app-dialog-actions button').last().innerText());
    assert.equal(await page.evaluate(({fn})=>(0,eval)(`(${fn})`)(M),{fn:check.toString()}),true,name);
  });
  await test('revalidação: sessão substituída e exercício removido',async()=>{
    await reset();await run(M=>M.workout.startWorkout('Segunda'));await run(M=>M.workout.woFinish());await modal().waitFor();
    await run(M=>{M.session.abandonSession();M.session.startSession('Terça','Outra');});
    const before=await state();await choose('Terminar');assert.equal(await state(),before);
    await reset();await run(M=>M.editor.edRemove('Segunda',0));await modal().waitFor();
    await run(M=>M.routine.removeExercise('Segunda',0));const removed=await state();await choose('Remover');assert.equal(await state(),removed);
    await reset();await run(M=>{M.state.ST.custom={date:M.state.todayStr(),stage:'active',ex:[{name:'Leg press',s:4}]};M.workout.startWorkout('Personalizado');});
    await run(M=>M.workout.woFinish());await modal().waitFor();await run(M=>{M.state.ST.sets['Personalizado:0']=[0];M.state.save();});
    const marked=await state();await choose('Descartar');assert.equal(await state(),marked);assert.equal(await page.locator('#woBg.show').count(),1);
  });
  await test('perfil: erro inline, foco, associação e rascunhos',async()=>{
    await reset();await page.evaluate(()=>window.render('__eu'));await page.locator('#p-age').fill('35');await page.locator('#p-height').fill('');await page.getByRole('button',{name:'Guardar dados',exact:true}).click();
    assert.equal(await page.locator('#p-height').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('#p-height').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#p-age').inputValue(),'35');
    await page.getByRole('button',{name:'Guardar dados',exact:true}).click();
    await screenshot('perfil-inline');await page.locator('#p-height').fill('180');assert.equal(await page.locator('#p-height').getAttribute('aria-invalid'),null);assert.equal(await page.locator('#p-height').getAttribute('aria-describedby'),null);
    await page.evaluate(()=>window.render('__perfil'));await page.locator('#m-form summary').click();await page.locator('#m-weight').fill('');await page.getByRole('button',{name:'Registar medidas de hoje'}).click();assert.equal(await page.locator('#m-weight').getAttribute('aria-invalid'),'true');
  });
  await test('nutrição: entrada manual, inválido, sem produto, offline e resposta antiga',async()=>{
    await reset();await page.evaluate(()=>window.render('__nutri'));
    await page.locator('[data-add="pa"]').click();
    await page.locator('#foodSheet summary').click();
    await page.locator('#barcode').fill('abc');await page.locator('#barcode').press('Enter');assert.equal(await page.locator('#barcode').getAttribute('aria-invalid'),'true');
    await page.route('**/api/v0/product/**',r=>r.fulfill({json:{status:0}}));
    await page.locator('#barcode').fill('12345678');await page.locator('#barcode').press('Enter');await page.locator('#barcode-status').filter({hasText:'não encontrado'}).waitFor();
    await page.locator('#food-barcode').scrollIntoViewIfNeeded();await screenshot('nutricao-codigo');await page.evaluate(()=>window.setThemePref('light'));await screenshot('nutricao-codigo','light');await page.evaluate(()=>window.setThemePref('dark'));await page.unroute('**/api/v0/product/**');await page.route('**/api/v0/product/**',r=>r.abort());
    await page.locator('#barcode').press('Enter');await page.locator('#barcode-status').filter({hasText:'Sem ligação'}).waitFor();
    await page.unroute('**/api/v0/product/**');let release;const gate=new Promise(r=>{release=r;});
    await page.route('**/api/v0/product/**',async r=>{await gate;r.fulfill({json:{status:1,product:{product_name:'Antigo'}}});});
    await page.locator('#barcode').press('Enter');await page.locator('#barcode').fill('87654321');release();await page.waitForTimeout(200);assert.equal(await page.locator('#food-query').inputValue(),'');assert.equal(await page.locator('#food-amount').count(),0);await page.unroute('**/api/v0/product/**');
    await page.getByRole('button',{name:'Ler código de barras',exact:true}).click();assert.equal(await page.locator('#barcode').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#foodSheet').count(),0);
  });
  await test('media: validação inline, Enter guarda, Escape cancela',async()=>{
    await reset();await run(M=>M.media.addMedia('Leg press'));await modal().waitFor();await modal().locator('input').fill('inválido');await modal().locator('input').press('Enter');assert.equal(await modal().locator('input').getAttribute('aria-invalid'),'true');await screenshot('prompt-url');
    await modal().locator('input').fill('images/test.svg');await modal().locator('input').press('Enter');await modal().waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>M.state.ST.media['Leg press']),['images/test.svg']);
  });
  await test('avisos não roubam foco nem bloqueiam navegação',async()=>{
    await reset();await page.locator('#navMain').focus();
    for(const kind of ['ok','error','info']){await page.evaluate(kind=>M.notice.show(`Aviso ${kind}`,kind),kind);assert.equal(await page.evaluate(()=>document.activeElement.id),'navMain');await screenshot(`notice-${kind}`);}
    assert.equal(await page.locator('#notice').getAttribute('role'),'status');assert.equal(await page.locator('#notice').getAttribute('aria-live'),'polite');await page.evaluate(()=>window.render('__eu'));assert.equal(await page.locator('#p-height').count(),1);
  });
  await test('temas, Auto, movimento reduzido e larguras 320/360/390/412/1280',async()=>{
    await reset();
    for(const width of [320,360,390,412,1280])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:width===320?568:844});await page.evaluate(theme=>window.setThemePref(theme),theme);
      for(const danger of [false,true]){
        await open({danger});await page.waitForTimeout(200);
        const audit=await modal().evaluate(e=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...e.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return r.width>=44 && r.height>=44 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;})}));
        assert.equal(audit.overflow,false);assert(audit.buttons.every(Boolean));await screenshot(danger?'confirmar-destrutiva':'confirmar-normal',theme,width);await choose('Cancelar');
      }
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.setThemePref('auto'));
    for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme,reducedMotion:'reduce'});await open();assert.equal(await modal().locator('form').evaluate(e=>getComputedStyle(e).animationName),'none');await choose('Cancelar');}
  });
  await test('SW v32 em cache abre modal offline',async()=>{
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.reload({waitUntil:'networkidle'});await page.evaluate(async()=>{window.M={dialog:await import('./js/dialog.js')};});
    assert((await page.evaluate(()=>caches.keys())).includes('treino-v44'));
    await context.setOffline(true);await open();await choose('Confirmar');assert.equal(await result(),true);await context.setOffline(false);
  });
  assert.deepEqual(errors,[]);
  console.log(`OK — ${count} grupos de testes de diálogos`);
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
