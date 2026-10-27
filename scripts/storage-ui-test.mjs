import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=createServer((req,res)=>{const f=join(root,...decodeURIComponent(req.url.split('?')[0]).split('/').filter(x=>x&&x!=='..'));const p=req.url==='/'?join(root,'index.html'):f;if(!existsSync(p)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json'})[extname(p)]||'application/octet-stream');res.end(readFileSync(p));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch();
try {
  for(const width of [320,360,412]) for(const theme of ['light','dark']) {
    const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
    const page=await ctx.newPage(), errors=[], dialogs=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss();});
    await page.addInitScript(theme=>{
      localStorage.setItem('treino_theme',theme);
      localStorage.setItem('treino_v2',JSON.stringify({onb:{done:true,skipped:true}}));
    },theme);
    await page.goto(url,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#saveBanner').count(),0);
    await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);if(e.defaultPrevented)throw Error('unexpected prompt');});
    await page.evaluate(async()=>{
      const s=await import('./js/state.js');
      window.storageSet=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){if(k==='treino_v2')throw new DOMException('quota','QuotaExceededError');return window.storageSet.call(this,k,v);};
      s.save({rolledBack:true});
      const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);if(e.defaultPrevented)throw Error('rollback prompt');
      s.ST.profile.test='memory';s.save();
      const pending=new Event('beforeunload',{cancelable:true});window.dispatchEvent(pending);if(!pending.defaultPrevented)throw Error('missing pending prompt');
    });
    const banner=page.locator('#saveBanner');await banner.waitFor({state:'visible'});
    assert.equal(await banner.getAttribute('role'),'alert');
    assert((await banner.innerText()).includes('Alterações NÃO guardadas'));
    assert(await banner.locator('button').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&parseFloat(getComputedStyle(e).fontSize)>=12;})));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.evaluate(async()=>{const {ST}=await import('./js/state.js');await window.startWorkout(ST.day);});
    assert(await banner.isVisible());
    assert(await banner.evaluate(e=>{const r=e.getBoundingClientRect(),d=document.querySelector('.wo-dock').getBoundingClientRect();return r.bottom<=d.top&&document.elementFromPoint(r.left+4,r.top+4)?.closest('#saveBanner')===e;}));
    await page.evaluate(()=>window.openSheet());
    assert(await banner.evaluate(e=>!e.closest('[inert]')&&document.querySelector('#sheetBg').contains(e)));
    await page.evaluate(()=>window.closeSheet());
    await banner.getByRole('button',{name:'Tentar de novo'}).click();
    assert(await banner.isVisible());
    const download=page.waitForEvent('download');
    await banner.getByRole('button',{name:'Exportar cópia'}).click();
    assert.match((await download).suggestedFilename(),/^treino-copia-recuperacao-.*\.json$/);
    await page.evaluate(()=>{Storage.prototype.setItem=window.storageSet;});
    await banner.getByRole('button',{name:'Tentar de novo'}).click();
    assert.equal(await banner.count(),0);
    await page.reload({waitUntil:'networkidle'});
    assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);
    await ctx.close();
  }
  console.log('OK — storage banner, themes, guided, overlays, retry, export and unload');
} finally {await browser.close();await new Promise(r=>server.close(r));}
