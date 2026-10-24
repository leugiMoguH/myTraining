/* Bloco 6: Plano / Perfil / Evolução — navegação, edição, rascunhos, dados intactos, sessão viva, visual — npm run test:b6 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(root, 'test-results'); mkdirSync(SHOTS, { recursive: true });
const server = createServer((req, res) => {
  const file = req.url === '/' ? join(root, 'index.html') : join(root, ...decodeURIComponent(req.url.split('?')[0]).split('/').filter(s => s && s !== '..'));
  if (!existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const errors = [];
let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log(`OK ${name}`); };
import { skipOnboarding } from './_skip-onb.mjs';
try {
 const ctx=await browser.newContext({serviceWorkers:'block'}), page=await ctx.newPage();
 await skipOnboarding(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 await page.evaluate(async()=>{const {ST,save}=await import('./js/state.js');ST.profile={sex:'m',age:30,height:170,goal:'manter',activity:'mod'};ST.measures=[{date:'2026-09-01',weight:80}];ST.log={test:[{date:'2026-09-01',w:20,r:8}]};ST.workouts=[{id:'preserve'}];save();});
 const intact=()=>page.evaluate(async()=>{const {ST}=await import('./js/state.js');return JSON.stringify([ST.log,ST.workouts]);});
 const before=await intact();
 const view=v=>page.evaluate(v=>window.render(v),v);
 const reload=async v=>{await page.reload({waitUntil:'networkidle'});await view(v);};
 const storage=()=>page.evaluate(()=>localStorage.getItem('treino_drafts'));
 await test('perfil e medida nova sobrevivem ao reload, isolados',async()=>{
  await view('__eu');await page.fill('#p-age','41');await view('__perfil');await page.locator('#m-form summary').click();assert.equal(await page.inputValue('#m-weight'),'');await page.fill('#m-weight','77.5');
  await reload('__eu');assert.equal(await page.inputValue('#p-age'),'41');await view('__perfil');assert.equal(await page.inputValue('#m-weight'),'77.5');assert(await page.locator('#m-form').evaluate(e=>e.open));
 });
 await test('guardar limpa apenas o seu rascunho e storage final',async()=>{
  await view('__eu');await page.getByRole('button',{name:'Guardar dados',exact:true}).click();await reload('__eu');assert.equal(await page.getByRole('button',{name:'Descartar rascunho'}).isVisible(),false);
  await view('__perfil');await page.getByRole('button',{name:'Registar medidas de hoje'}).click();await reload('__perfil');assert.equal(await storage(),null);
 });
 await test('edicao retomada e dados mais recentes ganham',async()=>{
  await page.evaluate(()=>window.editMeasure('2026-09-01'));await page.fill('#m-weight','81');await reload('__perfil');assert.equal(await page.inputValue('#m-weight'),'81');assert.equal(await page.evaluate(async()=>(await import('./js/profile.js')).MEASURE_EDIT_DATE),'2026-09-01');
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('treino_v2'));s.measures[0].weight=82;localStorage.setItem('treino_v2',JSON.stringify(s));});
  await reload('__perfil');assert.equal(await storage(),null);assert.equal(await page.evaluate(async()=>(await import('./js/profile.js')).MEASURE_EDIT_DATE),null);
 });
 await test('medida nova em conflito descarta rascunho e exige confirmacao',async()=>{
  const date='2026-09-02';
  await view('__perfil');await page.locator('#m-form summary').click();await page.fill('#m-date',date);await page.fill('#m-weight','77');
  await page.evaluate(date=>{const s=JSON.parse(localStorage.getItem('treino_v2'));s.measures.push({date,weight:82});localStorage.setItem('treino_v2',JSON.stringify(s));},date);
  await reload('__perfil');assert.equal(await storage(),null);assert.equal(await page.inputValue('#m-weight'),'');
  const weight=()=>page.evaluate(async date=>(await import('./js/state.js')).ST.measures.find(e=>e.date===date).weight,date);
  assert.equal(await weight(),82);
  await page.locator('#m-form summary').click();await page.fill('#m-date',date);await page.fill('#m-weight','77');
  await page.getByRole('button',{name:'Registar medidas de hoje'}).click();assert.equal(await weight(),82);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await weight(),82);assert.equal(await page.inputValue('#m-weight'),'77');
  await page.getByRole('button',{name:'Registar medidas de hoje'}).click();await page.getByRole('button',{name:'Substituir',exact:true}).click();
  await reload('__perfil');assert.equal(await weight(),77);assert.equal(await storage(),null);
 });
 await test('storage invalido ignorado',async()=>{
  for(const raw of ['lixo',JSON.stringify({v:2,forms:{}}),JSON.stringify({v:1,forms:{evil:{base:'{}',fields:{}}}}),JSON.stringify({v:1,forms:{profile:{base:'{}',fields:{evil:'x'}}}})]){await page.evaluate(raw=>localStorage.setItem('treino_drafts',raw),raw);await reload('__eu');assert.equal(await page.inputValue('#p-age'),'41');}
 });
 await test('descartar, valores identicos e clearDrafts limpam',async()=>{
  await page.fill('#p-age','42');await page.getByRole('button',{name:'Descartar rascunho'}).click();assert.equal(await page.inputValue('#p-age'),'41');assert.equal(await storage(),null);
  await page.fill('#p-age','42');await page.fill('#p-age','41');assert.equal(await storage(),null);
  await view('__perfil');await page.locator('#m-form summary').click();await page.fill('#m-weight','90');await page.getByRole('button',{name:'Descartar rascunho'}).click();assert.equal(await storage(),null);
  await view('__eu');await page.fill('#p-age','45');await page.evaluate(async()=>(await import('./js/profile.js')).clearDrafts());assert.equal(await storage(),null);
 });
 await test('perfil desatualizado e storage indisponivel',async()=>{
  await view('__eu');await page.fill('#p-age','49');
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('treino_v2'));s.profile.age=50;localStorage.setItem('treino_v2',JSON.stringify(s));});
  await reload('__eu');assert.equal(await page.inputValue('#p-age'),'50');assert.equal(await storage(),null);
  await page.evaluate(()=>{window.originalDraftSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='treino_drafts')throw Error('teste');return window.originalDraftSet.call(this,k,v);};});
  await page.fill('#p-age','51');await view('__perfil');await view('__eu');assert.equal(await page.inputValue('#p-age'),'51');
  await page.evaluate(()=>Storage.prototype.setItem=window.originalDraftSet);await page.getByRole('button',{name:'Descartar rascunho'}).click();
 });
 await test('falha de save preserva rascunho e formulario',async()=>{
  await view('__perfil');await page.locator('#m-form summary').click();await page.fill('#m-date','2026-09-03');await page.fill('#m-weight','88');
  await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='treino_v2')throw Error('teste');return window.originalSet.call(this,k,v);};});
  await page.getByRole('button',{name:'Registar medidas de hoje'}).click();assert(await storage());assert(await page.locator('#m-form').evaluate(e=>e.open));assert.equal(await page.inputValue('#m-weight'),'88');
  await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await page.getByRole('button',{name:'Descartar rascunho'}).click();
 });
 assert.equal(await intact(),before);assert.deepEqual(errors,[]);console.log(`OK - ${count} grupos de rascunhos; log/workouts intactos`);await ctx.close();
} finally {await browser.close();server.close();}
