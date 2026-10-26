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
const browser=await chromium.launch();const errors=[];
try {
for(const [width,height] of [[320,568],[360,640],[390,844],[412,915]]) for(const theme of ['light','dark']) {
 const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(theme=>{localStorage.setItem('treino_theme',theme);localStorage.setItem('treino_v2',JSON.stringify({onb:{done:true,skipped:true}}));},theme);
 await page.clock.install({time:new Date('2026-10-21T10:00:00')});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.evaluate(async()=>{const {ST,save}=await import('./js/state.js');const {applyPlan}=await import('./js/plan.js');const {normalizePrefs,proposePlan}=await import('./js/planner.js');const result=applyPlan(proposePlan(normalizePrefs({goal:'forca',days:['Segunda','Quarta','Sexta'],mins:60,exp:'regular',place:'gym',equip:['maq','livres'],limits:[],name:'Rita'})),{reason:'teste'});if(!result.ok)throw new Error(result.error);ST.measures=[{date:'2026-09-01',weight:80},{date:'2026-09-20',weight:79}];ST.log={'Supino reto':[{date:'2026-09-01',w:20,r:8},{date:'2026-09-20',w:25,r:8}]};save();window.render('__hoje');});
 const scan=async()=>{const bad=await page.locator('#content').evaluate(root=>[...root.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&e.checkVisibility()&&!e.closest('svg,.wk-chip,.ob-wrap,.ob-plan,.cat-grid,.ed-fields')&&parseFloat(getComputedStyle(e).fontSize)<12).map(e=>e.className+': '+e.textContent.trim().slice(0,50)));assert.deepEqual(bad,[],`texto pequeno ${width}/${theme}`);};
 for(const view of ['__hoje','__perfil','__nutri']) {await page.evaluate(v=>window.render(v),view);if(view==='__perfil')await page.evaluate(()=>window.evTab('corpo'));if(view==='__hoje'&&await page.locator('#todayToggle[aria-expanded="false"]').count())await page.locator('#todayToggle').click();await page.locator('#content details').evaluateAll(es=>es.forEach(e=>e.open=true));await scan();if(view==='__perfil'){assert(await page.locator('.lc-svg[role="img"][aria-label]').count()>0);assert(await page.locator('[role="img"][aria-label*="Mapa"]').count()>0);}}
 const tab=page.locator('[data-day="opts"]');assert.equal(await tab.innerText(),'Mais');assert.equal(await tab.locator('svg[aria-hidden="true"] circle').count(),3);
 await tab.click();await page.waitForTimeout(260);
 const close=page.getByRole('button',{name:'Fechar',exact:true});await assert.doesNotReject(()=>close.waitFor());assert(await close.evaluate(e=>e===document.activeElement));
 const box=await close.boundingBox();assert(box.width>=44&&box.height>=44);
 assert.equal(await page.locator('#sheetBg .sheet-item').count(),11);
 assert.equal(await page.locator('#sheetTitle').innerText(),'Mais');
 assert.deepEqual(await page.locator('#sheetBg h3.sheet-sub').allTextContents(),['Ir para','Aparência','Aplicação','Dados','Sobre']);
 assert(await page.locator('#sheetBg .sheet-item, #sheetBg .theme-choice label').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)));
 assert.equal(await page.locator('#sheetBg #wakeNote').count(),1);
 for(const handler of ['__plano','__eu','__hist','toggleWake','enableNotif','exportBackup','importFile','exportMeasuresCSV','exportIntakeCSV','exportLoadCSV'])assert.equal(await page.locator(`#sheetBg .sheet-item[onclick*="${handler}"]`).count(),1);
 const geometry=await page.locator('#sheetBg .sheet').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,h:innerHeight,overflow:e.scrollHeight>e.clientHeight};});assert(geometry.top>=0&&geometry.bottom<=height+1&&geometry.overflow);
 await page.locator('#sheetBg .sheet').evaluate(e=>e.scrollTop=e.scrollHeight);
 const last=await page.locator('#sheetBg .sheet-item').last().boundingBox();const head=await page.locator('.mais-head').boundingBox();assert(last.y+last.height<=height+1);assert(head.y>=geometry.top-1&&head.y+head.height<last.y);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#sheetBg .sheet').scrollWidth<=document.querySelector('#sheetBg .sheet').clientWidth));
 for(let i=0;i<20;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('#sheetBg').contains(document.activeElement)));}
 await page.keyboard.press('Escape');assert(await tab.evaluate(e=>document.activeElement===e));await tab.click();assert.equal(await page.locator('#sheetBg .sheet').evaluate(e=>e.scrollTop),0);
 assert.deepEqual(await page.locator('#sheetBg').evaluate(root=>[...root.querySelectorAll('*')].filter(e=>e.checkVisibility()&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<12).map(e=>e.className)),[]);
 await close.click();
 await page.evaluate(async()=>{
  const {ST}=await import('./js/state.js');
  const {loadChart}=await import('./js/loads.js');
  const {metricChartHTML}=await import('./js/profile.js');
  const {hxOpen,hxPeriod}=await import('./js/history.js');
  const oldLog=ST.log,oldMeasures=ST.measures,oldHx=ST.hx,oldView=ST.view;
  try {for(const n of [0,1,3]) {
    ST.log={'Supino reto':Array.from({length:n},(_,i)=>({date:`2026-09-${10+i}`,w:20+i,r:8}))};
    ST.measures=Array.from({length:n},(_,i)=>({date:`2026-09-${10+i}`,weight:80-i}));
    hxOpen('Supino reto');hxPeriod('all');
    const historySVG=document.querySelector('#content .lc-svg');
    if(n>1&&(!historySVG||historySVG.getAttribute('role')!=='img'||!historySVG.getAttribute('aria-label')?.includes('Carga')))throw new Error('Gráfico de histórico sem nome');
    if(n<2&&historySVG)throw new Error('Estado vazio/único inesperado');
    for(const html of [loadChart('Supino reto',0),metricChartHTML('weight')]) {
      const d=document.createElement('div');d.innerHTML=html;
      const svg=d.querySelector('svg.lc-svg');
      if(n&&!svg)throw new Error('Falta gráfico real');
      if(svg&&(svg.getAttribute('role')!=='img'||!svg.getAttribute('aria-label')?.includes('kg')))throw new Error('Nome do gráfico real inválido');
    }
  }} finally {ST.log=oldLog;ST.measures=oldMeasures;ST.hx=oldHx;window.render(oldView);}
 });
 const labels=await page.evaluate(async()=>{const {chartSVG}=await import('./js/charts.js');return [[],[80],[80,79,78]].map(vals=>{const d=document.createElement('div');d.innerHTML=chartSVG(vals,'Peso <teste> "seguro"','kg');const s=d.querySelector('svg');return {role:s.getAttribute('role'),label:s.getAttribute('aria-label'),count:d.querySelectorAll('svg').length};});});
 labels.forEach((s,i)=>{assert.equal(s.role,'img');assert.equal(s.count,1);assert(s.label.includes('Peso <teste> "seguro" (kg)'));assert(s.label.includes(`${[0,1,3][i]} registos`));if(i)assert(s.label.includes('primeiro 80'));});
 const contrast=await page.evaluate(()=>{const results=[];const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)));const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 for(const cls of ['wk-row s-rest','ob-d rest']){const e=document.createElement('div');e.className=cls;e.innerHTML='<b>Descanso</b><small>Recuperar</small>'+(cls.startsWith('wk-row')?'<span class="wk-today">hoje</span>':'');document.querySelector('#content').append(e);for(const t of [e,...e.children]){let bg=[255,255,255];const chain=[];for(let p=t;p;p=p.parentElement)chain.unshift(p);for(const p of chain)bg=blend(rgb(getComputedStyle(p).backgroundColor),bg);const fg=blend(rgb(getComputedStyle(t).color),bg);const a=lum(fg),b=lum(bg);results.push({cls,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),opacity:getComputedStyle(t).opacity});}e.remove();}return results;});
 contrast.forEach(r=>{assert(r.ratio>=4.5,JSON.stringify({theme,...r}));assert.equal(r.opacity,'1');});
 console.log(`OK Mais ${width}×${height} ${theme}; contraste mínimo ${Math.min(...contrast.map(r=>r.ratio)).toFixed(2)}:1`);await ctx.close();
}
assert.deepEqual(errors,[]);
} finally {await browser.close();await new Promise(r=>server.close(r));}
