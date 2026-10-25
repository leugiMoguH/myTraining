import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { skipOnboarding } from './_skip-onb.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
let malformed=false, oldWorker=false;
const server=createServer((req,res)=>{
 const path=decodeURIComponent(req.url.split('?')[0]);
 const file=join(root,...(path==='/'?'/index.html':path).split('/').filter(s=>s&&s!=='..'));
 if(!existsSync(file)){res.writeHead(404).end();return;}
 let body=readFileSync(file);
 if(path==='/data/foods-pt.json'&&malformed)body=Buffer.from('invalid json');
 if(path==='/sw.js'&&oldWorker)body=Buffer.from(body.toString().replaceAll('treino-v44','treino-v42'));
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`, browser=await chromium.launch(),errors=[];
mkdirSync(join(root,'test-results/nutri'),{recursive:true});
async function context(width=390,theme='dark',sw=true){
 const ctx=await browser.newContext({viewport:{width,height:900},isMobile:true,hasTouch:true,acceptDownloads:true,serviceWorkers:sw?'allow':'block'});
 await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.fulfill({status:200,body:''}));
 const page=await ctx.newPage();await skipOnboarding(page);
 await page.addInitScript(t=>localStorage.setItem('treino_theme',t),theme);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url,{waitUntil:'networkidle'});return {ctx,page};
}
const state=page=>page.evaluate(async()=>(await import('./js/state.js')).ST.intake);
async function capture(page,width,theme,name) {
 await page.evaluate(async()=>{
  const roots=[...document.querySelectorAll('#foodSheet,.app-dialog-bg')];
  await Promise.all(roots.flatMap(e=>e.getAnimations({subtree:true})).filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
 });
 const visual=await page.evaluate(()=>{
  const sheet=document.querySelector('.food-sheet'),dialog=document.querySelector('.app-dialog'),nav=document.getElementById('bnav');
  const red=color=>{const [r,g,b]=color.match(/[\d.]+/g).map(Number);return r>g*1.3 && r>b*1.3;};
  return {
   overflow:document.documentElement.scrollWidth>innerWidth,
   repeated:(document.querySelector('.diary-summary').textContent.match(/total dos registos/g)||[]).length,
   alarmBorder:red(getComputedStyle(document.querySelector('.diary-summary')).borderTopColor),
   alarmBars:[...document.querySelectorAll('.diary-bar span')].some(e=>red(getComputedStyle(e).backgroundColor)),
   alarmStates:[...document.querySelectorAll('.diary-total small')].some(e=>red(getComputedStyle(e).color)),
   sheet:sheet && {bottom:sheet.getBoundingClientRect().bottom,height:innerHeight,navInert:nav.inert,navHidden:getComputedStyle(nav).visibility==='hidden',overflow:sheet.scrollWidth>sheet.clientWidth},
   dialog:dialog && {opacity:getComputedStyle(dialog).opacity,background:getComputedStyle(dialog).backgroundColor,z:Number(getComputedStyle(dialog.parentElement).zIndex),sheetZ:Number(getComputedStyle(document.getElementById('foodSheet')).zIndex),animated:dialog.getAnimations().some(a=>a.playState==='running')}
  };
 });
 assert.equal(visual.overflow,false);assert.equal(visual.repeated,1,'total dos registos só no título');
 assert.equal(visual.alarmBorder,false);assert.equal(visual.alarmBars,false);assert.equal(visual.alarmStates,false);
 if(visual.sheet){assert(Math.abs(visual.sheet.bottom-visual.sheet.height)<=1,'folha encostada ao fundo');assert(visual.sheet.navInert);assert(visual.sheet.navHidden);assert.equal(visual.sheet.overflow,false);}
 if(visual.dialog){assert.equal(visual.dialog.opacity,'1');assert(!visual.dialog.background.startsWith('rgba('),'fundo sólido');assert(visual.dialog.z>visual.dialog.sheetZ);assert.equal(visual.dialog.animated,false);}
 await page.screenshot({path:join(root,`test-results/nutri/${width}-${theme}-${name}.png`),fullPage:name==='resumo'});
}
async function choose(page,meal,q){
 await page.locator(`[data-add="${meal}"]`).click();await page.locator('#food-query').fill(q);
 await page.locator('[data-result]').first().waitFor();await page.locator('[data-result]').first().click();
}
async function saveFood(page){await page.locator('#food-save').click();await page.locator('#foodSheet').waitFor({state:'detached'});}
async function totals(page){
 const expected=await page.evaluate(async()=>{const {ST,todayStr}=await import('./js/state.js');return (await import('./js/foods.js')).sumEntries(ST.intake.filter(e=>e.date===todayStr()));});
 for(const k of ['kcal','protein','carbs','fat','fibre','sugars','salt']){
  const text=await page.locator(`[data-nutrient="${k}"] b`).textContent();
  assert(text.startsWith(expected[k]===null?'—':String(Math.round(expected[k]*10)/10)),k+': '+text);
 }
}
try{
 for(const width of [320,360,390,412])for(const theme of ['light','dark']){
  const {ctx,page}=await context(width,theme);
  const baseline=await page.evaluate(async()=>{
   const {ST,todayStr,save}=await import('./js/state.js');
   ST.log={Exemplo:[{date:'2026-01-05',w:40,r:8,sets:[{w:40,r:8}]}]};ST.workouts=[{id:'preservar',state:'COMPLETED',date:'2026-01-05'}];
   ST.intake=[{id:'legacy',name:'Legado',date:todayStr(),ts:new Date().toISOString(),kcal:80,protein:4}];
   ST.profile={sex:'m',age:30,height:180,activity:'mod'};ST.measures=[{date:todayStr(),weight:80}];save();window.render('__nutri');
   return JSON.stringify([ST.log,ST.workouts,ST.routine,ST.sets]);
  });
  assert.equal(await page.locator('.nutri-preferences[open]').count(),0);
  assert(await page.locator('.diary-summary').evaluate(e=>e.compareDocumentPosition(document.querySelector('.nutri-preferences'))&Node.DOCUMENT_POSITION_FOLLOWING));
  assert.equal(await page.locator('[data-add]').count(),4);
  // Pesquisa real, origem por cima da folha e foco devolvido.
  await page.locator('[data-add="pa"]').click();await page.locator('#food-query').fill('banana');await page.locator('[data-result]').first().waitFor();
  assert.match(await page.locator('[data-result]').first().textContent(),/Banana.*crua/);
  await capture(page,width,theme,'pesquisa');
  await page.locator('[data-source]').first().click();await page.locator('.app-dialog').waitFor();
  assert.match(await page.locator('.app-dialog').textContent(),/Fonte: usda-fdc/);await capture(page,width,theme,'info');
  await page.keyboard.press('Escape');assert(await page.locator('[data-source]').first().evaluate(e=>e===document.activeElement));
  await page.locator('[data-result]').first().click();
  const portion=page.locator('[data-portion]').first();assert(await portion.count());await portion.click();
  assert.notEqual(await page.locator('#food-amount').inputValue(),'100');
  await page.locator('#food-amount').fill('150');assert.match(await page.locator('#food-preview').textContent(),/133.5/);
  assert.equal((await page.locator('#food-source').textContent()).trim(),'ⓘ');
  assert(await page.locator('.food-name h3').count());
  await capture(page,width,theme,'quantidade');
  // Dois eventos na mesma submissão não duplicam.
  await page.locator('#food-save').evaluate(b=>{b.click();b.click();});assert.equal((await state(page)).length,2);
  assert(await page.locator('[data-add="pa"]').evaluate(e=>e===document.activeElement));
  for(const [meal,q] of [['pa','maçã'],['alm','pão'],['alm','arroz cozido'],['jan','frango'],['jan','salmão']]){await choose(page,meal,q);await saveFood(page);}
  let entries=await state(page);assert.equal(entries.length,7);
  for(const e of entries.slice(1)){for(const key of ['id','ts','date','name','kcal','protein','n','g','unit','meal','fid','src','sid','ver','note'])assert(Object.hasOwn(e,key),key);}
  assert.equal(await page.locator('[aria-label="Pequeno-almoço"] [data-entry]').count(),2);
  assert.equal(await page.locator('[aria-label="Almoço"] [data-entry]').count(),2);assert.equal(await page.locator('[aria-label="Jantar"] [data-entry]').count(),2);
  await totals(page);
  const banana=entries[1];await page.locator(`[data-entry="${banana.id}"]`).click();await page.locator('#food-amount').fill('300');await page.locator('#food-meal').selectOption('lan');await saveFood(page);
  entries=await state(page);const edited=entries.find(e=>e.id===banana.id);assert.equal(edited.kcal,banana.kcal*2);assert.equal(edited.meal,'lan');assert.equal(edited.ts,banana.ts);assert.equal(edited.sid,banana.sid);await totals(page);
  await page.locator(`[data-entry="${entries[2].id}"]`).click();await page.locator('#food-delete').click();await totals(page);assert.equal((await state(page)).length,6);
  await page.locator('[data-estimate]').click();assert.match(await page.locator('.app-dialog').textContent(),/Mifflin.*Pressupostos.*Limites/s);await page.keyboard.press('Escape');
  for(const key of ['carbs','fat','fibre','sugars','salt']) {
   const row=page.locator(`[data-nutrient="${key}"]`),text=await row.locator('small').textContent();
   assert.match(text,/^parcial · \+1 sem dado/);assert.doesNotMatch(text,/Abaixo|Dentro|Acima|Até/);
   assert.equal(await row.locator('.diary-bar').count(),0);
   assert.match(text,key==='sugars'?/sem referência/:/ref\. [0-9]/);
  }
  await capture(page,width,theme,'resumo');
  // Manual desconhecido e custom fechado, sem valores inventados.
  await page.locator('[data-add="lan"]').click();await page.locator('#food-manual').click();await page.locator('#food-name').fill('Manual sem dados');
  assert.equal(await page.locator('#food-advanced[open]').count(),0);assert.match(await page.locator('#food-preview').textContent(),/— kcal.*— g/);
  await page.locator('#food-advanced summary').click();await page.locator('#food-reuse').check();await saveFood(page);
  const manual=(await state(page)).at(-1);assert.equal(manual.kcal,null);assert.equal(manual.n.sugars,null);assert.match(manual.fid,/^c:c/);
  assert.match(await page.locator('[data-nutrient="kcal"] small').textContent(),/^parcial · \+1 sem dado · ref\. [0-9]/);assert.equal(await page.locator('[data-nutrient="kcal"] .diary-bar').count(),0);await totals(page);
  // Legado mantém identidade e quantidade bloqueada; mover e eliminar são possíveis.
  const legacy=(await state(page))[0];await page.locator('[data-entry="legacy"]').click();assert(await page.locator('#food-amount').isDisabled());
  await page.locator('#food-meal').selectOption('alm');await saveFood(page);assert.deepEqual((await state(page))[0],{...legacy,meal:'alm'});assert.equal(await page.locator('[aria-label="Sem refeição"]').count(),0);
  // Perfil incompleto: explicação e acesso ao Perfil, diário continua primeiro.
  await page.evaluate(async()=>{const {ST}=await import('./js/state.js');delete ST.profile.sex;delete ST.profile.activity;window.render('__nutri');});
  assert.match(await page.locator('.diary-summary').textContent(),/Referência indisponível.*sexo.*atividade/s);assert.equal(await page.locator('[data-profile]').count(),1);
  await page.evaluate(async()=>{const {ST,save}=await import('./js/state.js');ST.profile.sex='m';ST.profile.activity='mod';save();});
  const beforeReload=await state(page);await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>window.render('__nutri'));assert.deepEqual(await state(page),beforeReload);
  // Exportação/importação reais, com os campos novos e definições custom.
  const dl=page.waitForEvent('download');await page.evaluate(()=>window.exportBackup());const download=await dl;const stream=await download.createReadStream();let raw='';for await(const chunk of stream)raw+=chunk;
  const payload=JSON.parse(raw);assert.deepEqual(payload.state.intake,beforeReload);assert(payload.state.foodsCustom.length);
  await page.evaluate(async()=>{const {ST}=await import('./js/state.js');ST.intake=[];ST.foodsCustom=[];ST.foodRecent=[];});
  await page.evaluate(raw=>{const file=new File([raw],'backup.json',{type:'application/json'});const input=document.createElement('input');input.type='file';input.id='nutri-import';const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;document.body.append(input);window.importBackup({target:input});},raw);
  await page.locator('.app-dialog').waitFor();await page.getByRole('button',{name:'Importar',exact:true}).click();await page.waitForFunction(async()=>!!(await import('./js/state.js')).ST.intake.length);
  assert.deepEqual(await state(page),beforeReload);await page.evaluate(()=>window.render('__nutri'));await totals(page);
  // Dia passado explícito, retenção de dia e data no título.
  await page.locator('[data-day="-1"]').click();const past=await page.locator('#diary-date').inputValue();
  await choose(page,'pa','banana');assert.match(await page.locator('#food-title').textContent(),new RegExp(past));await saveFood(page);assert.equal((await state(page)).at(-1).date,past);assert.equal(await page.locator('#diary-date').inputValue(),past);await page.locator('[data-today]').click();
  // Offline real: catálogo no CORE, pesquisa, edição e diário após reload.
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(async()=>!!(await (await caches.open('treino-v44')).match('data/foods-pt.json')));
  await page.reload({waitUntil:'networkidle'});await ctx.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>window.render('__nutri'));
  await choose(page,'pa','maçã');await saveFood(page);await totals(page);
  await page.locator('[data-add="pa"]').click();await page.locator('#foodSheet summary').click();await page.locator('#barcode').fill('12345678');await page.locator('#food-barcode button[type=submit]').click();assert.match(await page.locator('#barcode-status').textContent(),/Sem ligação.*manual/);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(async()=>{const {ST}=await import('./js/state.js');return JSON.stringify([ST.log,ST.workouts,ST.routine,ST.sets]);}),baseline);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await ctx.close();console.log(`OK ${width}/${theme}: pesquisa/porção/refeições/totais/editar/mover/eliminar/info/nulos/perfil/reload/backup/offline/duplo toque/legados/treino`);
 }
 // Falha transitória de catálogo: retry recupera; manual disponível enquanto falha.
 malformed=true;
 {
  const {ctx,page}=await context(390,'dark',false);await page.evaluate(()=>window.render('__nutri'));await page.locator('[data-add="pa"]').click();await page.locator('#food-retry').waitFor();
  malformed=false;await page.locator('#food-retry').click();await page.locator('#food-query').fill('banana');await page.locator('[data-result]').waitFor();
  await page.locator('#food-query').fill('zzzz inexistente');await page.waitForFunction(()=>document.querySelector('#food-results')?.textContent.includes('Sem resultados'));assert.equal(await page.locator('[data-result]').count(),0);
  await page.keyboard.press('Escape');
  // Falha de storage: rollback completo em criar/editar/eliminar, folha mantém campos.
  await page.evaluate(()=>{window.__storage=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='treino_v2')throw Error('quota');return window.__storage.call(this,k,v);};});
  await choose(page,'pa','banana');await page.locator('#food-amount').fill('155');const before=await state(page);await page.locator('#food-save').click();assert.deepEqual(await state(page),before);assert.match(await page.locator('#food-error').textContent(),/Não foi possível guardar/);assert.equal(await page.locator('#food-amount').inputValue(),'155');
  await page.evaluate(()=>{Storage.prototype.setItem=window.__storage;});await saveFood(page);
  const created=(await state(page))[0];await page.locator(`[data-entry="${created.id}"]`).click();await page.locator('#food-amount').fill('210');
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('quota');};});await page.locator('#food-save').click();assert.deepEqual((await state(page))[0],created);await page.locator('#food-delete').click();assert.deepEqual((await state(page))[0],created);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__storage;});await page.locator('#food-delete').click();assert.deepEqual(await state(page),[]);await ctx.close();console.log('OK erro/retry, sem resultados, rollback criar/editar/eliminar');
 }
 // Atualização real: worker v42 ativo → v43, remove cache anterior e funciona offline.
 oldWorker=true;
 {
  const {ctx,page}=await context();await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.waitForFunction(async()=>!!(await (await caches.open('treino-v42')).match('data/foods-pt.json')));
  oldWorker=false;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('treino-v44')&&!keys.includes('treino-v42');});
  await ctx.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>window.render('__nutri'));await choose(page,'pa','banana');await saveFood(page);await ctx.close();console.log('OK atualização SW v42 → v43 e offline');
 }
 assert.deepEqual(errors,[]);console.log('OK zero erros de consola');
}finally{await browser.close();await new Promise(r=>server.close(r));}
