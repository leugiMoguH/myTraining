import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { skipOnboarding } from './_skip-onb.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const fixture={source:'usda-fdc',license:'public domain',foods:[{id:'fixture',source:'usda-fdc',sourceId:'171477',version:'fixture-1',name:'Alimento de teste',state:'cozido',ref:{amount:100,unit:'g'},nutrients:{kcal:120,protein:10,carbs:15,fat:2,fibre:null,sugars:null,salt:0},notes:{carbs:'por diferença (inclui fibra)',salt:'calculado do sódio × 2,5'}}]};
let malformed=false;
const server=createServer((req,res)=>{
 const path=decodeURIComponent(req.url.split('?')[0]);
 if(path==='/data/foods-basic.json'){res.writeHead(200,{'Content-Type':'application/json'}).end(malformed?'invalid json':JSON.stringify(fixture));return;}
 const file=join(root,...(path==='/'?'/index.html':path).split('/').filter(s=>s&&s!=='..'));
 if(!existsSync(file)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'}).end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`, browser=await chromium.launch();
const errors=[];
try{
 for(const width of [360,412]){
  const ctx=await browser.newContext({viewport:{width,height:900},isMobile:true,hasTouch:true,acceptDownloads:true});
  // Nenhum pedido externo: as imagens não participam neste teste.
  await ctx.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.fulfill({status:200,body:''}));
  const page=await ctx.newPage();await skipOnboarding(page);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url,{waitUntil:'networkidle'});
  const baseline=await page.evaluate(async()=>{
   const {ST,todayStr}=await import('./js/state.js');
   ST.log={Exemplo:[{date:'2026-01-05',w:40,r:8,sets:[{w:40,r:8}]}]};ST.workouts=[{id:'preservar',state:'COMPLETED',date:'2026-01-05'}];
   ST.intake=[{id:'legacy',name:'Legado',date:todayStr(),ts:new Date().toISOString(),kcal:80,protein:4}];
   ST.profile={sex:'m',age:30,height:180,activity:'mod'};ST.measures=[{date:todayStr(),weight:80}];
   window.render('__nutri');
   return JSON.stringify([ST.log,ST.workouts,ST.routine,ST.sets]);
  });
  await page.locator('#basic-foods button').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'scroll horizontal');await page.locator('#basic-foods button').click();
  await page.locator('#i-grams').fill('150');assert.match(await page.locator('#i-preview').textContent(),/180/);
  await page.locator('button[onclick="addIntakeUI()"]').click();
  let entries=await page.evaluate(async()=>(await import('./js/state.js')).ST.intake);
  assert.equal(entries[1].kcal,180);assert.equal(entries[1].protein,15);assert.equal(entries[1].n.fibre,null);assert.equal(entries[1].g,150);assert.equal(entries[1].src,'usda-fdc');assert.equal(entries[1].sid,'171477');assert.equal(entries[1].ver,'fixture-1');assert.match(entries[1].note,/sódio/);
  assert.match(await page.locator('.ilist').textContent(),/Legado/);
  assert.match(await page.locator('#content').textContent(),/260/);
  // Editar o nome após seleção passa a manual, sem conservar a fonte USDA.
  await page.locator('#basic-foods button').click();await page.locator('#i-name').fill('Manual');
  await page.locator('#i-kcal').fill('');await page.locator('#i-prot').fill('');
  await page.locator('#i-grams').fill('50');
  assert.match(await page.locator('#i-preview').textContent(),/—/);
  await page.locator('button[onclick="addIntakeUI()"]').click();
  entries=await page.evaluate(async()=>(await import('./js/state.js')).ST.intake);
  assert.equal(entries[2].kcal,null);assert.equal(entries[2].protein,null);assert.equal(entries[2].src,'manual');assert.equal(entries[2].sid,null);
  assert.match(await page.locator('.ilist').textContent(),/— kcal/);
  assert.match(await page.locator('#content').textContent(),/1 sem dado/);
  const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>window.exportIntakeCSV());
  const download=await downloadPromise, stream=await download.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;
  assert.match(csv,/Legado/);assert.match(csv,/80/);assert.match(csv,/Manual/);assert.match(csv,/hidratos_g/);
  const manualRow=csv.split('\n').find(l=>l.includes('Manual')).trim().split(',');assert.equal(manualRow[3],'');assert.equal(manualRow[4],'');
  const legacyRow=csv.split('\n').find(l=>l.includes('Legado')).trim().split(',');assert.equal(legacyRow[3],'80');assert.equal(legacyRow[4],'4');
  for(const age of [17,66]){
   await page.evaluate(async age=>{const {ST}=await import('./js/state.js');ST.profile.age=age;window.render('__eu');},age);
   assert.match(await page.locator('#content').textContent(),/Estimativa não aplicável/);assert.doesNotMatch(await page.locator('#content').textContent(),/undefined|NaN/);
  }
  assert.equal(await page.evaluate(async()=>{const {ST}=await import('./js/state.js');return JSON.stringify([ST.log,ST.workouts,ST.routine,ST.sets]);}),baseline);
  // O servidor serve a fixture também ao CORE: confirmar cache real e recarregar offline.
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(async()=>!!(await (await caches.open('treino-v42')).match('data/foods-basic.json')));
  await ctx.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>window.render('__nutri'));
  await page.locator('#basic-foods button').waitFor();assert.equal(await page.locator('#basic-foods button').count(),1);
  assert.equal(await page.evaluate(async()=>{const {ST}=await import('./js/state.js');return JSON.stringify([ST.log,ST.workouts,ST.routine,ST.sets]);}),baseline);
  await ctx.close();console.log(`OK Nutrição ${width}: fixture, manual, desconhecidos, legados, CSV, Perfil, treino e offline`);
 }
 malformed=true;
 const ctx=await browser.newContext({serviceWorkers:'block'});await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.fulfill({status:200,body:''}));
 const page=await ctx.newPage();await skipOnboarding(page);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>window.render('__nutri'));await page.waitForLoadState('networkidle');
 assert.equal(await page.locator('#basic-foods button').count(),0);await page.locator('#i-name').fill('Sem base');await page.locator('button[onclick="addIntakeUI()"]').click();
 assert.match(await page.locator('.ilist').textContent(),/Sem base/);await ctx.close();
 assert.deepEqual(errors,[]);console.log('OK erro no JSON: lista vazia e entrada manual; zero erros de consola');
}finally{await browser.close();await new Promise(r=>server.close(r));}
