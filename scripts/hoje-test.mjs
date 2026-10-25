/* Bloco 4: ecrã Hoje (hierarquia, lista recolhível) e demonstração grande no treino guiado. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
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

async function open(width, height, theme = 'dark') {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000, isMobile: width < 1000, serviceWorkers: 'block' });
  await ctx.addInitScript(th => { try { if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); localStorage.setItem('treino_theme', th); } catch (_) {} }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="gray"/></svg>' }));
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
}
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

try {
  await test('Hoje: ordem (calendário → estado → ação principal → lista) e lista recolhida', async () => {
    const { ctx, page } = await open(390, 844);
    const order = await page.evaluate(() => {
      const top = id => document.querySelector(id)?.getBoundingClientRect().top ?? -1;
      return { strip: top('.week-strip'), hero: top('.hero'), toggle: top('#todayToggle'), note: top('.ad-card') };
    });
    assert(order.strip < order.hero && order.hero < order.toggle, 'ordem strip < hero < lista');
    if (order.note >= 0) assert(order.note > order.toggle, 'a atenção fica depois da lista');
    assert.equal(await page.locator('.hero-hi, .today-plan, .today-top .sched-note').count(), 0);
    assert.equal(await page.locator('#todayList').evaluate(e => e.hidden), true);
    assert.equal(await page.locator('#todayToggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.start-wo').first().isVisible(), true);
    const startTop = await page.locator('.hero .start-wo').evaluate(e => e.getBoundingClientRect().bottom);
    assert(startTop < 844 - 90, 'a ação principal fica acima da barra, sem scroll');
    await ctx.close();
  });

  await test('Hoje: abrir/fechar, estado mantido ao navegar, séries preservadas', async () => {
    const { ctx, page } = await open(390, 844);
    await page.locator('#todayToggle').click();
    assert.equal(await page.locator('#todayList').evaluate(e => e.hidden), false);
    assert.equal(await page.locator('#todayToggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#card-0 .set-btn').first().click();
    await page.evaluate(() => window.timerDismiss());
    await page.locator('.nb[data-day="__perfil"]').click();
    await page.locator('.nb[data-day="__hoje"]').click();
    assert.equal(await page.locator('#todayList').evaluate(e => e.hidden), false, 'a lista continua aberta');
    assert.equal(await page.locator('#card-0 .set-btn.on').count(), 1, 'a série marcada mantém-se');
    await page.locator('#todayToggle').click();
    assert.equal(await page.locator('#todayList').evaluate(e => e.hidden), true);
    assert.equal(await page.locator('#card-0 .set-btn.on').count(), 1, 'recolher não apaga dados');
    await page.locator('#todayToggle').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#todayToggle').getAttribute('aria-expanded'), 'true', 'teclado abre a lista');
    await ctx.close();
  });

  await test('Hoje: com progresso a lista abre sozinha', async () => {
    const { ctx, page } = await open(390, 844);
    await page.evaluate(async () => { const s = await import('./js/state.js'); const sc = await import('./js/schedule.js'); const d = sc.agenda().current; s.toggleSet(d, 0, 0, true); window.render('__hoje'); });
    assert.equal(await page.locator('#todayList').evaluate(e => e.hidden), false);
    await ctx.close();
  });

  await test('Guiado: demonstração grande, sem scroll horizontal, em 5 larguras e 2 temas', async () => {
    for (const theme of ['dark', 'light']) for (const [w, h] of [[320, 640], [360, 740], [390, 844], [412, 915], [1280, 800]]) {
      const { ctx, page } = await open(w, h, theme);
      await page.evaluate(async () => { const sc = await import('./js/schedule.js'); const wo = await import('./js/workout.js'); wo.openWorkout(sc.agenda().current, 0); });
      await page.waitForSelector('.wo-name');
      await page.locator('.wo-media img').first().waitFor({ state: 'visible' });
      await page.waitForFunction(() => { const i = document.querySelector('.wo-media img'); return i && i.complete; }, null, { timeout: 15000 }).catch(() => {});
      const m = await page.evaluate(() => { const b = document.querySelector('.wo-media').getBoundingClientRect(); const bar = document.querySelector('.wo-bar').getBoundingClientRect(); const dock = document.querySelector('.wo-dock').getBoundingClientRect(); return { w: b.width, h: b.height, top: b.top, barB: bar.bottom, dockTop: dock.top }; });
      assert(m.w >= Math.min(w - 40, 280) || w >= 1000, `${theme} ${w}: demonstração com ${Math.round(m.w)}px`);
      assert(m.h >= 150, `${theme} ${w}: altura ${Math.round(m.h)}`);
      assert(m.top >= m.barB - 1, `${theme} ${w}: demonstração por baixo da barra`);
      assert(await noHScroll(page), `${theme} ${w}: scroll horizontal`);
      const fields = await page.evaluate(() => ['#wo-w', '#wo-r'].map(s => document.querySelector(s).getBoundingClientRect().width));
      assert(fields.every(f => f >= 40), `${theme} ${w}: campos kg/reps estreitos ${fields}`);
      assert(await page.locator('.wo-main').evaluate(e => e.getBoundingClientRect().bottom <= innerHeight), `${theme} ${w}: ação principal fora do ecrã`);
      await ctx.close();
    }
  });

  await test('Guiado: descanso fica à vista; ecrãs baixos e teclado dão prioridade aos campos', async () => {
    const { ctx, page } = await open(320, 640);
    await page.evaluate(async () => { const sc = await import('./js/schedule.js'); const wo = await import('./js/workout.js'); wo.openWorkout(sc.agenda().current, 0); window.timerStart(45); });
    await page.waitForSelector('#woRest .wo-rest-num');
    assert.equal(await page.locator('.wo-media').isVisible(), false, 'com descanso num ecrã baixo a demonstração cede lugar');
    const hit = sel => page.locator(sel).first().evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    assert(await hit('#woRest .wo-rest-num') && await hit('#woRest .wo-btn'), 'descanso visível');
    await page.evaluate(() => window.timerDismiss());
    assert.equal(await page.locator('.wo-media').isVisible(), true, 'sem descanso a demonstração volta');
    await page.setViewportSize({ width: 320, height: 380 });
    await page.locator('#wo-w').focus();
    assert.equal(await page.locator('.wo-media').isVisible(), false, 'teclado aberto: sem demonstração');
    assert(await hit('#wo-w') && await hit('.wo-main'), 'campos e ação principal visíveis com teclado');
    await ctx.close();
  });

  await test('Guiado: movimento reduzido não anima a demonstração', async () => {
    const { ctx, page } = await open(390, 844);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(async () => { const sc = await import('./js/schedule.js'); const wo = await import('./js/workout.js'); wo.openWorkout(sc.agenda().current, 0); });
    await page.waitForSelector('.wo-name');
    assert.equal(await page.evaluate(() => { const b = document.querySelector('.wo-media .demo-b'); return b ? getComputedStyle(b).animationName : 'none'; }), 'none');
    await ctx.close();
  });

  assert.deepEqual(errors, []);
  console.log(`OK — ${count} grupos de testes do Hoje e do guiado`);
} finally { await browser.close(); await new Promise(r => server.close(r)); }
