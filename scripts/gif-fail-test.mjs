import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const server=createServer((req,res)=>{const p=join(process.cwd(),req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!existsSync(p)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(p)]||'application/octet-stream');res.end(readFileSync(p));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch(); const page=await browser.newPage({serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('treino_v2',JSON.stringify({onb:{done:true}})));
 await page.route('**/*',route=>route.request().resourceType()==='image'?route.fulfill({status:404,body:''}):route.continue());
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async()=>{
  const U=await import('./js/ui.js');await import('./js/bridge.js');
  const name=`Farmer's "walk" <img src=x onerror=window.__x=1>`;
  const card=U.buildCard('Segunda',{name,s:3,r:'10',catalogId:'missing',m:'missing',dia:['missing.gif" onerror="window.__x=1']},919);
  document.body.append(card);card.querySelector('.card-details').hidden=false;
  for(const img of card.querySelectorAll('img'))img.loading='eager';
  const naked=document.createElement('img');U.slideFail(naked);
 });
 await page.waitForFunction(()=>document.querySelectorAll('#card-919 .no-img').length>=3);
 const result=await page.evaluate(()=>({x:window.__x,title:document.querySelector('#card-919 .card-title').textContent,names:[...document.querySelectorAll('#card-919 .no-img span:last-child')].map(e=>e.textContent),injected:document.querySelectorAll('#card-919 img[src="x"]').length}));
 assert.equal(result.x,undefined);assert.equal(result.injected,0);assert.equal(result.title,`Farmer's "walk" <img src=x onerror=window.__x=1>`);assert(result.names.every(n=>n===result.title));assert.deepEqual(errors,[]);
 console.log('OK giffail: falha real de imagem, nome literal, src/markup escapados, sem execução, slide ausente.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
