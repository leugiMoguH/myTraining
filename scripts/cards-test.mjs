/* Bloco 5: cartões de exercício (cabeçalho, séries distribuídas, estados, ARIA, alvos de toque) — npm run test:cards */
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
const LONG = 'Remada unilateral com halter apoiada no banco inclinado';
const NOSPACE = 'Supercalifragilisticoexpialidoso-Extensão-Unilateral';

async function open(w, theme = 'dark') {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 1000, isMobile: w < 1000 });
  await ctx.addInitScript(th => { try { localStorage.setItem('treino_theme', th); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) { /* sem storage */ } }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async ([long, nospace]) => {
    const { ST } = await import('./js/state.js');
    const ex = ST.routine.Segunda.ex;
    ex[0] = { ...ex[0], name: long, s: 4, r: '8-10' };
    ex[1] = { ...ex[1], name: nospace, s: 6, r: '12-15' };
    ex[2] = { ...ex[2], s: 'livre', r: '15 min' };
    ex[3] = { ...ex[3], s: 5, r: '10' };
    ex[4] = { ...ex[4], s: 12, r: '20' };
    window.render('Segunda');
  }, [LONG, NOSPACE]);
  if (!(await page.locator('#card-0').isVisible())) await page.locator('#todayToggle').click();   /* a lista do Hoje vem recolhida */
  await page.locator('#card-0').waitFor({ state: 'visible' });
  return { ctx, page };
}
const rects = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }), sel);
const rows = r => new Set(r.map(x => Math.round(x.y))).size;
const overlap = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

try {
  for (const [w, theme] of [[320, 'dark'], [360, 'light'], [390, 'dark'], [412, 'light'], [1280, 'dark']]) {
    await test(`${theme} ${w}: cabeçalho sem sobreposição, sem scroll horizontal, séries ≥44px e sem tocar umas nas outras`, async () => {
      const { ctx, page } = await open(w, theme);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'scroll horizontal');
      for (const i of [0, 1]) {
        const [t] = await rects(page, `#card-${i} .card-title`), [m] = await rects(page, `#card-${i} .card-meta`), [c] = await rects(page, `#card-${i}`);
        assert(!overlap(t, m), `card-${i}: nome e séries×reps sobrepostos`);
        assert(m.r <= c.r + 0.5 && t.x >= c.x - 0.5, `card-${i}: transborda o cartão`);
        assert(m.x > t.x, `card-${i}: séries×reps não está à direita do nome ${JSON.stringify({ t, m })}`);
      }
      for (const i of [0, 1, 3, 4]) {
        const bs = await rects(page, `#card-${i} .set-btn`);
        assert(bs.every(b => b.w >= 44 && b.h >= 44), `card-${i}: alvo <44px`);
        for (let a = 0; a < bs.length; a++) for (let b = a + 1; b < bs.length; b++) assert(!overlap(bs[a], bs[b]), `card-${i}: séries sobrepostas`);
        const [c] = await rects(page, `#card-${i}`);
        assert(bs.every(b => b.x >= c.x && b.r <= c.r), `card-${i}: série fora do cartão`);
      }
      const r6 = await rects(page, '#card-1 .set-btn'), r5 = await rects(page, '#card-3 .set-btn'), r12 = await rects(page, '#card-4 .set-btn');
      assert.equal(rows(r5), 1, '5 séries numa linha');
      assert(rows(r12) <= 3, '12 séries em ≤3 linhas');
      const inner = await page.evaluate(() => { const b = document.querySelector('#card-1 .card-body'), cs = getComputedStyle(b); return b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); });
      /* 6 × 44px + 5 × 8px = 304px: cabe numa linha só se o contentor (não o viewport) o permitir */
      assert.equal(rows(r6), inner >= 304 ? 1 : 2, `6 séries com contentor de ${inner}px`);
      if (w >= 390) assert.equal(rows(r6), 1, `6 séries numa linha a ${w}px`);
      assert(await page.evaluate(() => { const e = document.querySelector('#card-0 .sets-row'); return e.scrollWidth <= e.clientWidth + 1; }), 'a grelha de séries transborda');
      await ctx.close();
    });
  }

  await test('séries em texto: sem botões, texto visível, sem «repetições» falsas', async () => {
    const { ctx, page } = await open(360);
    assert.equal(await page.locator('#card-2 .set-btn').count(), 0);
    assert.match(await page.locator('#card-2 .card-stats').textContent(), /livre.*15 min/);
    assert.doesNotMatch(await page.locator('#card-2 .card-stats').textContent(), /repeti/i);
    await ctx.close();
  });

  await test('estados: atual avança, feita/pendente, ARIA coerente, botões preservados (foco/handlers)', async () => {
    const { ctx, page } = await open(390);
    const state = () => page.evaluate(() => [...document.querySelectorAll('#card-0 .set-btn')].map(b => [b.classList.contains('on'), b.classList.contains('next'), b.getAttribute('aria-pressed'), b.getAttribute('aria-label')]));
    let s = await state();
    assert.deepEqual(s.map(x => x[1]), [true, false, false, false], 'a 1.ª série devia ser a atual');
    assert.equal(s[0][3], 'Série 1, próxima'); assert.equal(s[1][3], 'Série 2');
    await page.evaluate(() => { document.querySelector('#card-0 .set-btn').__marca = 'mesmo-elemento'; });
    await page.locator('#card-0 .set-btn').nth(1).focus();   /* teclado: o foco fica no mesmo botão depois de marcar */
    await page.keyboard.press('Enter');
    assert(await page.evaluate(() => document.activeElement === document.querySelectorAll('#card-0 .set-btn')[1]), 'o foco saiu do botão da série');
    await page.locator('#card-0 .set-btn').nth(1).tap();   /* desfaz: volta ao estado inicial */
    await page.locator('#card-0 .set-btn').nth(0).tap();
    s = await state();
    assert.deepEqual(s.map(x => x[0]), [true, false, false, false]); assert.deepEqual(s.map(x => x[1]), [false, true, false, false]);
    assert.deepEqual(s.map(x => x[2]), ['true', 'false', 'false', 'false']);
    assert.equal(await page.evaluate(() => document.querySelector('#card-0 .set-btn').__marca), 'mesmo-elemento', 'os botões foram recriados');
    await page.locator('#card-0 .set-btn').nth(2).tap();   /* salta uma: a atual continua a ser a 1.ª por fazer */
    s = await state(); assert.deepEqual(s.map(x => x[1]), [false, true, false, false]);
    for (const i of [1, 3]) await page.locator('#card-0 .set-btn').nth(i).tap();
    s = await state(); assert(s.every(x => x[0] && !x[1] && x[2] === 'true'), 'todas feitas: nenhuma atual');
    await page.locator('#card-0 .set-btn').nth(1).tap();   /* desmarcar */
    s = await state(); assert.deepEqual(s.map(x => x[1]), [false, true, false, false]);
    await page.locator('#card-0 .act-done').tap();           /* concluir: nenhuma série atual */
    await page.waitForFunction(() => document.getElementById('card-0').classList.contains('done'));
    s = await state(); assert(s.every(x => !x[1]), 'cartão concluído não tem série atual');
    await page.locator('#card-0 .set-btn').nth(2).tap();     /* reabrir: desmarcar uma série tira o «feito» */
    await page.waitForFunction(() => !document.getElementById('card-0').classList.contains('done'));
    assert((await state()).some(x => x[1]), 'reaberto: volta a haver série atual');
    await ctx.close();
  });

  await test('registo de carga e sessão em curso: cartão atualiza, histórico intacto, IDs mantidos', async () => {
    const { ctx, page } = await open(360);
    const ids = await page.evaluate(() => ['card-0', 'w-0', 'r-0', 'load-0', 'more-0'].map(i => !!document.getElementById(i)));
    assert(ids.every(Boolean), 'IDs do cartão mudaram');
    const before = await page.evaluate(async ([n]) => { const { ST, save } = await import('./js/state.js'); ST.log = { ...ST.log, [n]: [{ date: '2026-10-01', ts: 1, w: 30, r: 10 }], 'Outro exercício': [{ date: '2026-10-02', ts: 2, w: 10, r: 12 }] }; save(); return JSON.stringify(ST.log); }, [LONG]);
    await page.evaluate(async () => { const { startSession } = await import('./js/session.js'); startSession('Segunda', 'x'); window.render('Segunda'); });
    await page.locator('#card-0 .set-btn').nth(0).tap();
    await page.fill('#w-0', '42.5'); await page.fill('#r-0', '9');
    await page.locator('#card-0 .load-save').tap();
    const log = await page.evaluate(async ([n]) => { const { ST } = await import('./js/state.js'); const l = ST.log[n]; return l && l.slice(-1)[0]; }, [LONG]);
    assert(log && log.w === 42.5 && log.r === 9, `registo de carga perdido: ${JSON.stringify(log)}`);
    const old = await page.evaluate(async ([n]) => { const { ST } = await import('./js/state.js'); return JSON.stringify({ [n]: ST.log[n].filter(e => e.ts <= 2), o: ST.log['Outro exercício'] }); }, [LONG]);
    assert.equal(old, JSON.stringify({ [LONG]: JSON.parse(before)[LONG], o: JSON.parse(before)['Outro exercício'] }), 'o histórico anterior foi alterado');
    assert.equal(await page.locator('#card-0 .set-btn.on').count(), 1, 'a série marcada perdeu-se com a sessão em curso');
    assert.equal(await page.evaluate(async () => (await import('./js/session.js')).sessionState()), 'ACTIVE');
    await ctx.close();
  });

  assert.deepEqual(errors, []);
  console.log(`OK — ${count} grupos dos cartões de exercício`);
} finally { await browser.close(); server.close(); }
