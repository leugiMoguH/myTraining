import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = createServer((req, res) => {
  const path = req.url.split('?')[0];
  const f = path === '/' ? join(root, 'index.html') : join(root, ...decodeURIComponent(path).split('/').filter(s => s && s !== '..'));
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', ({ '.js':'text/javascript', '.html':'text/html', '.json':'application/json' })[extname(f)] || 'application/octet-stream');
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const errors = [];
try {
  for (const width of [320, 360, 390, 412, 1280]) {
    const ctx = await browser.newContext({ viewport:{ width, height:915 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb:{ done:true, skipped:true } }));
    });
    await page.clock.install({ time:new Date('2026-10-19T10:00:00') });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });
    const go = view => page.evaluate(v => window.render(v), view);
    const tab = id => page.locator(`#navRow [data-day="${id}"]`).click();
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).session);
    const closeGuided = () => page.locator('.wo-bar button').filter({ hasText:'Sair' }).click();
    const historyLink = () => page.locator('#content .ev-link').filter({ hasText:'Histórico' }).click();
    const geometry = async tag => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const result = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('#bnav button')].filter(e => e.checkVisibility());
        const rects = buttons.map(e => e.getBoundingClientRect());
        const overlap = rects.some((a,i) => rects.slice(i+1).some(b => Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
        const content = document.querySelector('#content');
        const children = [...content.children].filter(e => e.checkVisibility());
        const last = children.at(-1)?.getBoundingClientRect();
        return { horizontal:document.documentElement.scrollWidth>innerWidth, overlap,
          small:rects.some(r => r.width<44 || r.height<44),
          covered:!!last && last.bottom>document.querySelector('#bnav').getBoundingClientRect().top+1 };
      });
      assert.deepEqual(result, { horizontal:false, overlap:false, small:false, covered:false }, `${width}: ${tag}`);
    };
    assert.equal(await page.locator('#navMain,.nb-main').count(), 0);
    assert.deepEqual(await page.locator('#navRow .nb-l').allTextContents(), ['Hoje','Semana','Evolução','Nutrição','Mais']);
    assert(await page.locator('#navRow .nb-i').evaluateAll(es => es.length===5 && es.every(e => e.textContent.trim() || e.querySelector('svg'))));
    const destinations = { __hoje:'__hoje', __pers:'__hoje', __semana:'__semana', __dia:'__semana', __perfil:'__perfil', __ex:'__perfil', __hist:'__perfil', __nutri:'__nutri', __plano:'opts', __eu:'opts' };
    for (const [view, active] of Object.entries(destinations)) {
      // Some subviews need their own data; syncNav maps them without rendering invalid fixtures.
      await page.evaluate(async view => { const {ST}=await import('./js/state.js'); const {syncNav}=await import('./js/nav.js'); ST.view=view; syncNav(); }, view);
      assert.equal(await page.locator('#navRow [aria-current="page"]').getAttribute('data-day'), active);
    }
    await go('__semana');
    assert.equal(await page.locator('.week-list .wk-row[data-day]').count(), 7);
    await page.locator('.wk-row[data-day="Segunda"]').click();
    assert.equal(await page.locator('#navRow [aria-current]').getAttribute('data-day'), '__semana');
    await page.locator('.hx-back').click();
    assert.equal(await page.locator('#navRow [aria-current]').getAttribute('data-day'), '__semana');
    for (const origin of ['__hoje','__semana','__nutri']) {
      await go(origin); await tab('__perfil'); await historyLink();
      assert.equal(await page.locator('#hdrSub').innerText(), 'Histórico');
      await go(origin); await tab('opts');
      for (const text of ['Plano','Perfil','Histórico','backup']) assert((await page.locator('#sheetBg').innerText()).toLowerCase().includes(text.toLowerCase()));
      assert.equal(await page.locator('#sheetBg [onclick*="__nutri"]').count(), 0);
      assert((await page.locator('#appVersionLabel').innerText()).includes('treino-v51'));
      await page.locator('#sheetBg [onclick*="__hist"]').click();
      assert.equal(await page.locator('#sheetBg.show').count(), 0);
      assert.equal(await page.locator('#hdrSub').innerText(), 'Histórico');
    }
    await go('__semana'); await historyLink();
    assert.equal(await page.locator('.week-list .wk-row[data-day]').count(), 0);
    await go('__hoje'); await page.locator('.hero .start-wo').click();
    assert.equal((await state()).state, 'ACTIVE');
    const id = (await state()).id;
    await page.locator('#wo-w').fill('20');
    await page.locator('#wo-r').fill('10');
    await page.locator('.wo-main').click();
    const progress = () => page.evaluate(() => { const s=JSON.parse(localStorage.getItem('treino_v2')); return {sets:s.sets, log:s.log}; });
    const savedProgress = await progress();
    await closeGuided();
    await page.evaluate(() => window.timerStart(90));
    for (const dest of ['__hoje','__semana','__perfil','__nutri','opts']) {
      await tab(dest);
      if (dest==='opts') { await page.getByRole('button',{name:'Fechar',exact:true}).click(); }
      assert(await page.locator('#navLive').isVisible());
      assert.equal((await state()).id, id); assert.equal((await state()).state, 'ACTIVE');
      assert.deepEqual(await progress(), savedProgress);
      if (['__semana','__perfil','__nutri'].includes(dest)) assert.equal(await page.locator('#timerBanner').isVisible(), false);
      await geometry(dest);
    }
    await page.locator('#navPause').click(); assert.equal((await state()).state,'PAUSED');
    assert.equal(await page.locator('#navPause').getAttribute('aria-label'),'Retomar treino');
    const handle = await page.locator('#navPause').elementHandle();
    await page.clock.runFor(2200);
    assert(await handle.evaluate(e => e===document.querySelector('#navPause')));
    await page.locator('#navPause').click(); assert.equal((await state()).state,'ACTIVE');
    await page.locator('#navLive').click(); assert(await page.locator('#woBg.show').isVisible());
    await page.goBack(); assert.equal(await page.locator('#woBg.show').count(),0); assert.equal((await state()).id,id);
    await page.reload({ waitUntil:'networkidle' }); assert.equal((await state()).id,id);
    assert.deepEqual(await progress(), savedProgress);
    if (await page.locator('#woBg.show').count()) await closeGuided();
    await page.evaluate(async () => { const {ST,save}=await import('./js/state.js'); ST.session.seenAt=Date.now()-7200000; save(); const {syncNav}=await import('./js/nav.js'); syncNav(); });
    assert(await page.locator('#navEnd').isVisible()); assert(await page.locator('#navDrop').isVisible());
    for (const view of ['__hoje','__semana','__perfil','__nutri','__hist']) { await go(view); await geometry(`idle ${view}`); }
    console.log(`OK navegação ${width}px`);
    await ctx.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); await new Promise(r => server.close(r)); }
