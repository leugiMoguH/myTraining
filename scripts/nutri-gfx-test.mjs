/* ⓘ das referências (Preferências) e «Remover do diário»: geometria, alvos de toque, teclado, remoção — npm run test:nutri-gfx */
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
mkdirSync(join(root, 'test-results/nutri'), { recursive: true });
const LONG = 'Salada de grão-de-bico com atum, tomate, cebola roxa e azeitonas pretas curadas em salmoura';
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).map(Number).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
try {
  for (const width of [320, 360, 390, 412]) for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.fulfill({ status: 200, body: '' }));
    const page = await ctx.newPage(); await skipOnboarding(page);
    await page.addInitScript(t => localStorage.setItem('treino_theme', t), theme);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async long => {
      const { ST, todayStr, save } = await import('./js/state.js');
      ST.profile = { sex: 'm', age: 30, height: 180, activity: 'mod', goal: 'manter' }; ST.measures = [{ date: todayStr(), weight: 80 }];
      ST.nutri = { profile: { meals: 4, cookTime: 'medio', fav: { protein: [], carbs: [], veg: [], snack: [] }, restrictions: [], supps: [], avoid: [] } };
      const mk = (id, name, meal, kcal) => ({ id, ts: new Date().toISOString(), date: todayStr(), name, kcal, protein: 10, n: { carbs: 20, fat: 5, fibre: 2, sugars: 3, salt: 0.5 }, g: 150, unit: 'g', meal, src: 'manual' });
      ST.intake = [mk('a1', long, 'alm', 300), mk('a2', 'Banana', 'pa', 105)]; save(); window.render('__nutri');
    }, LONG);
    // ⓘ das referências
    await page.locator('.nutri-preferences summary').click();
    const rows = await page.locator('.nref').evaluateAll(els => els.map(e => { const t = e.querySelector('span').getBoundingClientRect(), g = e.querySelector('button'), b = g.getBoundingClientRect(), r = e.getBoundingClientRect(); return { t: [t.left, t.right], b: [b.left, b.right, b.width, b.height], r: [r.left, r.right], glyph: parseFloat(getComputedStyle(g).fontSize), name: g.getAttribute('aria-label') }; }));
    assert(rows.length >= 6, 'linhas de referência: ' + rows.length);
    for (const x of rows) {
      assert(x.b[2] >= 44 && x.b[3] >= 44, 'alvo ≥44: ' + x.b); assert(x.glyph >= 16 && x.glyph <= 18, 'glifo ' + x.glyph);
      assert(x.t[1] <= x.b[0] + 0.5, 'texto sobrepõe ⓘ'); assert(x.b[1] <= x.r[1] + 0.5 && x.t[0] >= x.r[0] - 0.5, 'dentro da linha'); assert(/Informação sobre/.test(x.name));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'scroll horizontal');
    const infoBtn = page.locator('.nref button').first();
    await page.keyboard.press('Shift'); await infoBtn.focus(); assert((await infoBtn.evaluate(e => getComputedStyle(e).outlineStyle)) !== 'none', 'foco visível');
    await page.keyboard.press('Enter'); await page.locator('.app-dialog').waitFor(); assert((await page.locator('.app-dialog').textContent()).length > 40);
    await page.keyboard.press('Escape'); await page.locator('.app-dialog').waitFor({ state: 'detached' });
    await page.locator('.nutri-preferences').screenshot({ path: join(root, `test-results/nutri/gfx-${width}-${theme}-info.png`) });
    // Remover
    await page.locator('.nutri-preferences summary').click();
    await page.locator('[data-entry="a1"]').click(); await page.locator('#food-delete').waitFor();
    const g = await page.evaluate(() => { const s = document.querySelector('#food-save').getBoundingClientRect(), d = document.querySelector('#food-delete'), r = d.getBoundingClientRect(), cs = getComputedStyle(d), sheetEl = document.querySelector('.food-sheet'), sheet = sheetEl.getBoundingClientRect(); return { s: [s.left, s.right, s.bottom], d: [r.left, r.right, r.top, r.width, r.height], color: cs.color, text: d.textContent, over: sheetEl.scrollWidth > sheetEl.clientWidth, inside: r.left >= sheet.left && r.right <= sheet.right, bg: getComputedStyle(sheetEl).backgroundColor }; });
    assert(g.d[4] >= 44 && g.d[3] >= 200, 'Remover: dimensão ' + g.d); assert(g.d[2] >= g.s[2], 'Remover abaixo de Guardar'); assert(!g.over && g.inside); assert(/Remover/.test(g.text));
    const [l1, l2] = [lum(g.color), lum(g.bg)].sort((a, b) => b - a); assert((l1 + .05) / (l2 + .05) >= 4.5, 'contraste Remover ' + g.color + ' / ' + g.bg);
    await page.screenshot({ path: join(root, `test-results/nutri/gfx-${width}-${theme}-remover.png`) });
    await page.keyboard.press('Shift'); await page.locator('#food-delete').focus(); assert((await page.locator('#food-delete').evaluate(e => getComputedStyle(e).outlineStyle)) !== 'none');
    await page.keyboard.press('Enter'); await page.locator('#foodSheet').waitFor({ state: 'detached' });
    const after = await page.evaluate(async () => (await import('./js/state.js')).ST.intake.map(e => e.id));
    assert.deepEqual(after, ['a2'], 'só a Banana fica'); assert.match(await page.locator('#notice').textContent(), /removido do diário/);
    await page.locator('.diary-full summary').tap();
    assert(await page.locator('[data-nutrient="kcal"]').isVisible());
    assert.equal(await page.locator('[data-entry="a1"]').count(), 0); assert.match(await page.locator('[data-nutrient="kcal"] b').textContent(), /^105/);
    await ctx.close(); console.log('ok', width, theme);
  }
  assert.deepEqual(errors, []);
  console.log('nutri-gfx ok');
} finally { await browser.close(); server.close(); }
