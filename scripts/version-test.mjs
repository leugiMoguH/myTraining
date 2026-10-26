import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { APP_VERSION } from '../js/version.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const sw=readFileSync(join(root,'sw.js'),'utf8');
assert.equal(APP_VERSION,/const CACHE = '(.*?)'/.exec(sw)[1]);
for(const name of ['version','about'])assert(sw.includes(`'./js/${name}.js'`));
let old=false, remoteMismatch=false;
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const path=u.pathname.replace(/^\/training\//,'');
 const f=join(root,path||'index.html');
 if(!existsSync(f)){res.writeHead(404).end();return;}
 let body=readFileSync(f);
 if(old&&['sw.js','js/version.js'].includes(path))body=Buffer.from(body.toString().replaceAll('treino-v49','treino-v46'));
 if(remoteMismatch&&path==='sw.js'&&u.search)body=Buffer.from(body.toString().replaceAll('treino-v49','treino-v50'));
 const etag='"'+createHash('sha256').update(body).digest('hex')+'"';
 res.setHeader('ETag',etag);res.setHeader('Cache-Control','max-age=600');
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(f)]||'application/octet-stream');
 if(req.headers['if-none-match']===etag){res.writeHead(304).end();return;}
 res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/training/`;
let browser;
const errors=[];
const setup=async theme=>{
 const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{errors.push('diálogo nativo');d.dismiss();});
 await page.addInitScript(()=>{if(!localStorage.getItem('treino_v2'))localStorage.setItem('treino_v2',JSON.stringify({onb:{done:true,skipped:true},versionMarker:'preservado'}));});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 return {ctx,page};
};
const about=async page=>{
 await page.locator('[data-day="opts"]').click();
 const entry=page.getByRole('button',{name:/Versão treino-v/});
 await entry.scrollIntoViewIfNeeded();await entry.click();
 await page.getByRole('dialog',{name:'Sobre',exact:true}).waitFor();
};
const coherent=async page=>{
 const d=page.getByRole('dialog',{name:'Sobre',exact:true});
 const text=await d.innerText();
 for(const line of [`Código em execução: ${APP_VERSION}`,`Service worker ativo: ${APP_VERSION}`,`No servidor: ${APP_VERSION}`,'Estado: Atualizada'])assert(text.includes(line),text);
 assert.equal(await d.getByRole('button',{name:'Repor ficheiros da app'}).count(),0);
};
/* a reposição recarrega a página duas vezes (a 2.ª depois de o novo SW estar pronto): repete avaliações cortadas por navegação */
const retry=async f=>{for(let i=0;i<15;i++){try{return await f();}catch(e){if(!/context was destroyed|navigation/i.test(e.message))throw e;await new Promise(r=>setTimeout(r,300));}}throw Error('retry esgotado');};
try {
 browser=await chromium.launch();
 for(const theme of ['light','dark']){
  const {ctx,page}=await setup(theme);
  await about(page);await coherent(page);
  for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert(await page.locator('.app-dialog').evaluate(e=>e.contains(document.activeElement)));}
  await page.keyboard.press('Escape');assert.equal(await page.locator('.app-dialog').count(),0);
  assert(await page.locator('[data-day="opts"]').evaluate(e=>e===document.activeElement));
  await about(page);await page.getByRole('button',{name:'Verificar atualização',exact:true}).click();
  await page.getByText('Já tens a versão mais recente',{exact:false}).waitFor();
  await page.keyboard.press('Escape');await ctx.close();
 }
 old=true;
 const {ctx,page}=await setup('light');
 await page.waitForFunction(async()=> (await caches.keys()).includes('treino-v46'));
 await page.reload({waitUntil:'networkidle'});
 old=false;
 // Um sinal persistente prova controllerchange na pagina anterior ao reload.
 await page.evaluate(()=>navigator.serviceWorker.addEventListener('controllerchange',()=>sessionStorage.setItem('version-controllerchange','sim')));
 await Promise.all([
  page.waitForEvent('load',{timeout:20000}),
  page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
 ]);
 await page.waitForFunction(async()=> (await caches.keys()).length===1&&(await caches.keys())[0]==='treino-v49');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('version-controllerchange')),'sim');
 await about(page);await coherent(page);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.treino_v2).versionMarker),'preservado');
 await page.keyboard.press('Escape');
 // Discrepancia apenas na leitura de diagnóstico: torna a reposição acessivel.
 remoteMismatch=true;await about(page);
 await page.getByRole('button',{name:'Repor ficheiros da app',exact:true}).click();
 await page.getByText('Os teus dados não são apagados',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('dialog',{name:'Sobre',exact:true}).waitFor();
 await page.getByRole('button',{name:'Repor ficheiros da app',exact:true}).click();
 // Inspecionar imediatamente antes de reload sem substituir a implementacao.
 await page.evaluate(()=>{
  const original=ServiceWorkerRegistration.prototype.unregister;
  ServiceWorkerRegistration.prototype.unregister=async function(){const result=await original.call(this);sessionStorage.setItem('version-unregistered',String((await navigator.serviceWorker.getRegistrations()).length));return result;};
  const remove=caches.delete.bind(caches);
  caches.delete=async key=>{const result=await remove(key);sessionStorage.setItem('version-caches',JSON.stringify(await caches.keys()));return result;};
 });
 remoteMismatch=false;
 await Promise.all([page.waitForEvent('load',{timeout:20000}),page.getByRole('button',{name:'Repor ficheiros da app',exact:true}).click()]);
 assert.equal(await retry(()=>page.evaluate(()=>sessionStorage.getItem('version-unregistered'))),'0');
 assert.equal(await retry(()=>page.evaluate(()=>sessionStorage.getItem('version-caches'))),'[]');
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert.equal(await retry(()=>page.evaluate(()=>JSON.parse(localStorage.treino_v2).versionMarker)),'preservado');
 await page.waitForFunction(()=>document.getElementById('appVersionLabel').textContent.includes('treino-v49'),null,{timeout:20000});
 await about(page);await coherent(page);await ctx.close();
 assert.deepEqual(errors,[]);
 console.log('OK - versões, Mais claro/escuro, foco/Esc, atualização Pages v46 -> v49 e reposição com dados preservados; sem erros de consola.');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
