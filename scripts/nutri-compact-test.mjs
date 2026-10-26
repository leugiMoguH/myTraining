import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { skipOnboarding } from './_skip-onb.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = join(root, ...(p === '/' ? '/index.html' : p).split('/').filter(s => s && s !== '..'));
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`, browser = await chromium.launch(), errors = [];

try {
 const ctx=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.fulfill({status:200,body:''}));
 const page=await ctx.newPage();await skipOnboarding(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 async function fixture(count,{partial=false,zero=false,profile=true,legacy=false,past=false,multiplier=1}={}) {
  await page.evaluate(async o=>{
   const {ST,todayStr}=await import('./js/state.js');
   ST.profile=o.profile?{sex:'m',age:30,height:180,activity:'mod'}:{};ST.measures=o.profile?[{date:todayStr(),weight:80}]:[];
   const d=new Date(todayStr()+'T12:00:00');d.setDate(d.getDate()-1);const yesterday=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
   ST.intake=Array.from({length:o.count},(_,i)=>({id:'fixture'+i,ts:new Date().toISOString(),date:o.past?yesterday:todayStr(),name:i===0?'Alimento com nome muito longo '.repeat(3):'Alimento '+i,kcal:o.partial&&i===1?null:o.zero?0:200*o.multiplier,protein:o.partial&&i===1?null:o.zero?0:10*o.multiplier,n:{carbs:20,fat:5,fibre:2,sugars:3,salt:1},g:100,unit:'g',...(o.legacy?{}:{meal:['pa','alm','jan','lan'][i%4]})}));
   window.render('__nutri');
  },{count,partial,zero,profile,legacy,past,multiplier});
  await page.locator('[data-today]').tap();if(past)await page.locator('[data-day="-1"]').tap();
  if(await page.locator('.diary-full').evaluate(e=>e.open))await page.locator('.diary-full summary').tap();
 }
 async function totals(){
  assert.equal(await page.locator('[data-nutrient="salt"]').isVisible(),false);
  await page.locator('.diary-full summary').tap();
  const expected=await page.evaluate(async()=>{
   const {ST}=await import('./js/state.js'),{sumEntries,intakeForDate}=await import('./js/foods.js');
   const {daySummary}=await import('./js/nutri-summary.js'),{references}=await import('./js/nutri-calc.js'),{bodyMetrics}=await import('./js/profile.js');
   const list=intakeForDate(ST.intake,document.querySelector('#diary-date').value);
   return {sum:sumEntries(list),summary:daySummary(list,references(bodyMetrics()))};
  });
  for(const [k,n] of Object.entries(expected.summary)){
   const row=page.locator(`[data-nutrient="${k}"]`);assert(await row.isVisible());
   const value=(n.total===null?'\u2014':String(Math.round(n.total*10)/10))+' '+(k==='kcal'?'kcal':'g');
   assert.equal(await row.locator('b').textContent(),value);assert.equal(n.total,expected.sum[k]);
   if(['kcal','protein'].includes(k)){
    const tile=page.locator(`[data-compact="${k}"]`);
    assert.equal(await tile.locator('b').textContent(),value);
    assert.equal((await tile.locator('small').allTextContents()).join(' \u00b7 '),await row.locator('small').textContent());
    assert.equal(await tile.locator('.diary-bar').count(),await row.locator('.diary-bar').count());
   }
   if(n.state==='parcial')assert.equal(await row.locator('.diary-bar').count(),0);
  }
 }
 for(const [count,opts] of [[0,{}],[1,{}],[4,{}],[14,{}],[2,{partial:true}],[2,{partial:true,zero:true}],[1,{profile:false}],[1,{multiplier:20}],[1,{multiplier:.01}],[4,{past:true}],[1,{legacy:true}]]){
  await fixture(count,opts);
  await page.evaluate(()=>scrollTo(0,0));
  assert(await page.locator('#diary-add-quick').evaluate(e=>{const r=e.getBoundingClientRect();return scrollY===0&&r.top>=0&&r.bottom<=document.querySelector('#bnav').getBoundingClientRect().top;}));
  await totals();assert.equal(await page.locator('[data-add]').count(),4);
  if(opts.legacy)assert.equal(await page.locator('[aria-label="Sem refei\u00e7\u00e3o"]').count(),1);
 }
 await fixture(14);
 for(const width of [320,360,390,412,1280]){
  await page.setViewportSize({width,height:740});await page.evaluate(()=>scrollTo(0,0));
  const g=await page.evaluate(()=>{
   const b=document.querySelector('#diary-add-quick').getBoundingClientRect(),nav=document.querySelector('#bnav').getBoundingClientRect(),meal=document.querySelector('.diary-meal h2').getBoundingClientRect();
   return {overlap:[...document.querySelectorAll('#navRow button')].some((e,i,a)=>a.slice(i+1).some(f=>{const x=e.getBoundingClientRect(),y=f.getBoundingClientRect();return Math.min(x.right,y.right)>Math.max(x.left,y.left)+1&&Math.min(x.bottom,y.bottom)>Math.max(x.top,y.top)+1;})),overflow:document.documentElement.scrollWidth>innerWidth,top:b.top,bottom:b.bottom,nav:nav.top,meal:meal.bottom,scroll:scrollY};
  });assert(!g.overflow);assert(!g.overlap);assert.equal(g.scroll,0);assert(g.top>=0&&g.bottom<=g.nav,JSON.stringify(g));assert(g.meal<=g.nav,JSON.stringify(g));
  assert.equal(await page.locator('#bnav button:visible').count(),5);assert.match(await page.locator('#navRow [aria-current="page"]').textContent(),/Nutri/);
 }
 await page.setViewportSize({width:360,height:740});
 for(const [time,meal] of [['10:59','pa'],['11:00','alm'],['14:59','alm'],['15:00','lan'],['17:59','lan'],['18:00','jan']]){
  await page.clock.install({time:new Date('2026-10-25T'+time+':00')});
  await page.locator('#diary-add-quick').tap();await page.locator('#food-manual').tap();assert.equal(await page.locator('#food-meal').inputValue(),meal);
  await page.locator('#food-close').tap();assert(await page.locator('#diary-add-quick').evaluate(e=>e===document.activeElement));
 }
 for(const opener of ['#diary-add-quick','#diary-add-pa']){
  await fixture(0);await page.locator(opener).tap();await page.locator('#food-close').tap();assert(await page.locator(opener).evaluate(e=>e===document.activeElement));
  await page.locator(opener).tap();await page.locator('#food-manual').tap();await page.locator('#food-name').fill('Teste compacto');await page.locator('#food-save').tap();
  assert(await page.locator(opener).evaluate(e=>e===document.activeElement));assert.equal(await page.locator('[data-entry]').count(),1);
  await page.locator('[data-entry]').tap();await page.locator('#food-close').tap();assert(await page.locator('[data-entry]').evaluate(e=>e===document.activeElement));
  await page.locator('[data-entry]').tap();await page.locator('#food-amount').fill('150');await page.locator('#food-save').tap();assert(await page.locator('[data-entry]').evaluate(e=>e===document.activeElement));
  await page.locator('[data-entry]').tap();const meal=await page.locator('#food-meal').inputValue();await page.locator('#food-delete').tap();assert.equal(await page.locator('[data-entry]').count(),0);assert(await page.locator('#diary-add-'+meal).evaluate(e=>e===document.activeElement));
 }
 await page.locator('.diary-full summary').tap();await page.locator('[data-today]').tap();assert(await page.locator('.diary-full').evaluate(e=>e.open));await page.locator('#navRow [data-day="__perfil"]').tap();await page.locator('#navRow [data-day="__nutri"]').tap();assert(await page.locator('.diary-full').evaluate(e=>e.open));
 assert.deepEqual(errors,[]);await ctx.close();console.log('OK nutri-compact: fixtures, totais, toque, geometria, horarios, foco, CRUD e persistencia');
} finally {await browser.close();await new Promise(r=>server.close(r));}
