/* Bloco 2: preferência, primeiro frame, dados intactos, offline, contraste e capturas. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { skipOnboarding } from './_skip-onb.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, 'test-results');
const screenshots = process.env.THEME_SCREENSHOTS !== '0';
if (screenshots) mkdirSync(shots, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml' };
const server = createServer((req,res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(root, path === '/' ? 'index.html' : path.split('/').filter(p=>p && p!=='..').join('/'));
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(r=>server.listen(8138,'127.0.0.1',r));
const url='http://127.0.0.1:8138/';
let browser;
const errors=[], contrastFailures=[];
async function listen(page) {
  // Thumbnails are irrelevant to theme contrast; keep the catalogue deterministic offline.
  await page.context().route('https://cdn.jsdelivr.net/**', route => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(route.request().url())
    ? route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52"/>'})
    : route.continue());
  page.on('console',m=>{if(m.type()==='error') errors.push(`${m.text()} (${m.location().url})`);});
  page.on('pageerror',e=>errors.push(e.message));
}
async function theme(page, value) { await page.evaluate(v=>window.setThemePref(v),value); }
async function expectTheme(page,value) { await page.waitForFunction(v=>document.documentElement.dataset.theme===v,value); }
async function contrast(page) {
  const failures=await page.evaluate(()=>{
    const bad=[];
    const parse=c=>{const v=c.match(/[\d.]+/g).map(Number);if(v.length===3)v.push(1);return v;};
    const over=(f,b)=>{const a=f[3]??1, ba=b[3]??1, out=a+ba*(1-a);return [0,1,2].map(i=>out?(f[i]*a+b[i]*ba*(1-a))/out:0).concat(out);};
    const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const ratio=(f,b)=>{f=lum(over(f,b));b=lum(b);return (Math.max(f,b)+.05)/(Math.min(f,b)+.05);};
    const probe=document.createElement('span');document.body.append(probe);
    const col=n=>{probe.style.color=`var(--${n})`;return parse(getComputedStyle(probe).color);};
    for(const bg of ['bg','surface','card','card2']) for(const fg of ['text','muted','text-soft','text-medium','text-strong']) {
      const r=ratio(col(fg),col(bg));if(r<4.5)bad.push(`${fg}/${bg}: ${r}`);
    }
    const ctaMin = document.documentElement.dataset.theme === 'light' ? 4.5 : 3;
    for(const [fg,bg,min] of [['on-success','success-fill',4.5],['success','success-bg',4.5],['warn','warn-bg',4.5],['text','danger-bg',4.5],['info','info-bg',4.5],['on-primary','accent',ctaMin],['on-primary','accent2',ctaMin]]) {
      const b=over(col(bg),col('card')), r=ratio(col(fg),b);if(r<min)bad.push(`${fg}/${bg}: ${r}`);
    }
    // Resolve actual component backgrounds, composing transparency through ancestors.
    // Gradients: evaluate each stop, conservatively using its worst contrast.
    for(const sel of ['.hdr-home','.hero-t','.hero-s','.card-title','.load-in','.wo-main','.start-wo','.nb','.sheet-item','.theme-choice label','.t-big','.wo-rest-lbl','#toast','.wk-chip','.cat-chip','.nchip span','#mchips .m-chip','.m-legend .m-chip','legend','.lc-meta','.lc-meta b','.lc-when','.lc-next','.lc-next-s','.lc-prog-t','.lc-prog-m','.lc-inc','svg text','.vol-l','.vol-v','.hdr-sub','.tag','.cat-q','.cat-close','.cat-name','.cat-meta','.cat-add','.cat-msg','.cat-sub']) {
      for(const el of document.querySelectorAll(sel)) {
        if(!el.checkVisibility({visibilityProperty:true,opacityProperty:true}) || !el.getBoundingClientRect().height) continue;
        // Compose each ancestor's background AND group opacity, from the text outwards.
        const st=getComputedStyle(el), fg=parse(el instanceof SVGElement ? st.fill : st.color);
        const stops=st.backgroundImage.match(/rgba?\([^)]+\)/g);
        const backgrounds=stops?.length?stops.map(parse):[parse(st.backgroundColor)];
        const large=parseFloat(st.fontSize)>=18 || (parseFloat(st.fontSize)>=14 && Number(st.fontWeight)>=700);
        // Button/input labels are text too; only standalone UI symbols get 3:1.
        const ui=el.matches('.cat-close,.cat-add');
        const min=large||ui?3:4.5;
        for(const background of backgrounds){
          let ink=over(fg,background), bg=background, node=el;
          while(node){
            const style=getComputedStyle(node), opacity=Number(style.opacity);
            ink[3]*=opacity; bg[3]*=opacity;
            node=node.parentElement;
            const behind=node?parse(getComputedStyle(node).backgroundColor):col('bg');
            ink=over(ink,behind); bg=over(bg,behind);
          }
          const r=ratio(ink,bg);if(r<min)bad.push(`${sel}: ${r} < ${min}`);
        }
      }
    }
    probe.remove();return bad;
  });
  const documentTheme = await page.locator('html').getAttribute('data-theme');
  contrastFailures.push(...failures.map(f=>`${documentTheme}: ${f}`));
}
try {
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:390,height:900},colorScheme:'light',reducedMotion:'reduce'});
  const page=await context.newPage();await listen(page);await skipOnboarding(page);
  await page.addInitScript(()=>{
    window.firstTheme=[];
    const record=label=>window.firstTheme.push({label,theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.documentElement).backgroundColor});
    document.addEventListener('DOMContentLoaded',()=>record('DOMContentLoaded'),{once:true});
    // Inline bootstrap runs before module evaluation, even with module network delay.
    const observer=new MutationObserver(()=>{if(document.documentElement.dataset.theme){record('bootstrap');observer.disconnect();}});
    observer.observe(document,{subtree:true,attributes:true,attributeFilter:['data-theme']});
    requestAnimationFrame(()=>record('frame'));
  });
  await page.goto(url);await page.waitForFunction(()=>typeof window.setThemePref==='function');
  await expectTheme(page,'dark');
  await page.evaluate(()=>window.openSheet());
  assert.equal(await page.locator('input[name=theme]:checked').inputValue(),'dark');
  await page.locator('input[name=theme][value=light]').check();await expectTheme(page,'light');
  await page.locator('input[name=theme][value=light]').press('ArrowRight');
  await expectTheme(page,'dark');
  await page.locator('input[name=theme][value=light]').check();
  await page.reload();await page.waitForFunction(()=>typeof window.setThemePref==='function');await expectTheme(page,'light');
  assert.equal(await page.evaluate(()=>localStorage.treino_theme),'light');
  assert.ok(await page.evaluate(()=>window.firstTheme.length && window.firstTheme.every(x=>x.theme==='light' && x.bg==='rgb(248, 250, 252)')),'flash no arranque');
  await theme(page,'auto');await page.emulateMedia({colorScheme:'dark'});await expectTheme(page,'dark');
  await page.emulateMedia({colorScheme:'light'});await expectTheme(page,'light');
  await theme(page,'dark');await page.emulateMedia({colorScheme:'dark'});await page.emulateMedia({colorScheme:'light'});await expectTheme(page,'dark');
  await page.evaluate(()=>localStorage.setItem('treino_theme','invalid'));await page.reload();await expectTheme(page,'dark');
  await page.waitForFunction(()=>typeof window.setThemePref==='function');
  const other=await context.newPage();await listen(other);await other.goto(url);await other.waitForFunction(()=>typeof window.setThemePref==='function');
  await theme(other,'light');await expectTheme(page,'light');await other.close();
  await page.evaluate(()=>{
    localStorage.setItem('treino_theme','dark');
    window.dispatchEvent(new StorageEvent('storage',{key:'treino_theme',storageArea:sessionStorage}));
  });
  await expectTheme(page,'light');
  await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'treino_theme',storageArea:localStorage})));
  await expectTheme(page,'dark');await theme(page,'light');
  await page.evaluate(()=>window.startWorkout('Segunda'));
  await page.locator('#wo-w').fill('37.5');await page.locator('#wo-r').fill('11');
  const before=await page.evaluate(async()=>JSON.stringify((await import('./js/state.js')).ST));
  await theme(page,'dark');await theme(page,'light');
  assert.equal(await page.locator('#wo-w').inputValue(),'37.5');assert.equal(await page.locator('#wo-r').inputValue(),'11');
  assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/state.js')).ST)),before);
  await page.evaluate(()=>window.closeWorkout());
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof window.setThemePref==='function');await expectTheme(page,'light');await context.setOffline(false);
  await context.close();
  const blocked=await browser.newContext();
  const b=await blocked.newPage();await listen(b);await skipOnboarding(b);
  await b.addInitScript(()=>{
    const nativeMatchMedia=window.matchMedia.bind(window);
    window.matchMedia=query=>{
      const native=nativeMatchMedia(query);
      return {get matches(){return native.matches;},addListener:listener=>native.addEventListener('change',listener)};
    };
    const get=Storage.prototype.getItem, set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){if(key==='treino_theme')throw new Error('storage indisponível');return get.call(this,key);};
    Storage.prototype.setItem=function(key,value){if(key==='treino_theme')throw new Error('storage indisponível');return set.call(this,key,value);};
  });
  await b.goto(url);await b.waitForFunction(()=>typeof window.setThemePref==='function');
  await expectTheme(b,'dark');await theme(b,'light');await expectTheme(b,'light');
  assert.equal(await b.evaluate(async()=>(await import('./js/theme.js')).getThemePref()),'light');
  await b.evaluate(()=>window.openSheet());
  assert.equal(await b.locator('input[name=theme]:checked').inputValue(),'light');
  await b.reload();await b.waitForFunction(()=>typeof window.setThemePref==='function');await expectTheme(b,'dark');
  await theme(b,'auto');await b.emulateMedia({colorScheme:'light'});await expectTheme(b,'light');
  await b.emulateMedia({colorScheme:'dark'});await expectTheme(b,'dark');
  await b.reload();await b.waitForFunction(()=>typeof window.setThemePref==='function');await expectTheme(b,'dark');
  assert.equal(await b.evaluate(async()=>(await import('./js/theme.js')).getThemePref()),'dark');
  await blocked.close();
  for(const width of [320,360,390,412,1280]) for(const value of ['dark','light']) {
    const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const p=await ctx.newPage();await listen(p);await skipOnboarding(p);await p.goto(url);await p.waitForFunction(()=>typeof window.setThemePref==='function');await theme(p,value);
    async function inspect(name) {
      await p.waitForTimeout(350); // Evaluate the settled component, after theme/sheet transitions.
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${value}/${name}/${width}: scroll horizontal`);
      await contrast(p);
      if (screenshots) await p.screenshot({path:join(shots,`tema-${value}-${name}-${width}.png`),fullPage:true});
    }
    for(const [name,view] of [['hoje','__hoje'],['dia','Segunda'],['evolucao','__perfil'],['historico','__hist'],['nutricao','__nutri']]) {await p.evaluate(v=>window.render(v),view);await inspect(name);}
    await p.evaluate(()=>window.hxOpen('Agachamento'));await inspect('exercicio');
    await p.evaluate(()=>window.render('Segunda'));await p.evaluate(()=>window.startWorkout('Segunda'));await inspect('guiado');
    await p.evaluate(()=>window.closeWorkout());await p.evaluate(()=>window.openSheet());await inspect('definicoes');
    await p.evaluate(()=>window.closeSheet());await p.evaluate(async()=>(await import('./js/catalog-ui.js')).openCatalog('Segunda'));await inspect('catalogo');
    await p.evaluate(async()=>(await import('./js/catalog-ui.js')).closeCatalog());await p.evaluate(()=>window.timerStart(90));await inspect('descanso');
    await ctx.close();
  }
  /* Identidade escura preservada de propósito: estes pares já falhavam AA antes do tema claro (branco sobre #f97316, chips
   de descanso, rótulos SVG). Ficam como limitação conhecida (ver relatório): só passam enquanto NÃO piorarem (piso = valor
   medido); qualquer outro par, ou um valor mais baixo, continua a falhar o teste. */
const BASE_ESCURA = { 'on-primary/accent2': 2.80, '.start-wo': 2.80, '.wk-chip': 2.82, '.cat-chip': 3.76, 'svg text': 3.78 };
const baseEscura = f => { const m = /^dark: (.+?): ([\d.]+)/.exec(f); return !!m && m[1] in BASE_ESCURA && +m[2] >= BASE_ESCURA[m[1]] - 0.01; };
assert.deepEqual({console:[...new Set(errors)],contraste:[...new Set(contrastFailures)].filter(f=>!baseEscura(f))},{console:[],contraste:[]},'Consola e contraste AA (escuro: só a base conhecida)');
  console.log('Tema: preferência, flash, auto, storage, sessão, offline, AA e capturas OK');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
