/* Bloco 7: varredura objetiva de todos os ecrãs (tema fixado de facto): scroll horizontal, alvos <44px, texto <11px, erros — npm run test:consist */
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
const errors = [], found = [];
const SCREENS = [['__hoje'], ['__semana'], ['__plano'], ['__hist'], ['__perfil', 'resumo'], ['__perfil', 'cargas'], ['__perfil', 'corpo'], ['__nutri'], ['__eu']];

for (const [w, theme] of [[320, 'dark'], [390, 'light'], [1280, 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: w < 1000, isMobile: w < 1000, serviceWorkers: 'block', colorScheme: theme === 'light' ? 'dark' : 'light' });
  await ctx.addInitScript(t => { try { localStorage.setItem('treino_theme', t); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) { /* sem storage */ } }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-28T10:00:00') });
  await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme, 'tema pedido');
  await page.evaluate(async () => {
    const { ST, save } = await import('./js/state.js');
    ST.log = { 'Leg press': [{ date: '2026-09-10', ts: 1, w: 100, r: 8, sets: [{ w: 100, r: 8, ts: 1 }] }] };
    ST.measures = [{ date: '2026-09-20', ts: '2026-09-20T08:00:00.000Z', weight: 79 }];
    ST.profile = { sex: 'm', age: 30, height: 178, goal: 'manter', activity: 'mod' };
    save();
  });
  for (const [view, tab] of SCREENS) {
    await page.evaluate(async ([v, t]) => { const { render } = await import('./js/ui.js'); render(v); if (t) window.evTab(t); }, [view, tab]);
    await page.evaluate(() => document.querySelectorAll('#content details').forEach(d => { d.open = true; }));
    const r = await page.evaluate(() => {
      const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      const small = [...document.querySelectorAll('#content button, #content summary, #content a, #content select, #content input:not([type=hidden])')].filter(vis).map(e => { const q = (e.closest('label') || e).getBoundingClientRect(); return { t: (e.textContent || e.id || e.name || '').trim().slice(0, 26), h: Math.round(q.height), w: Math.round(q.width) }; }).filter(x => x.h < 44 && !/^[✎✕🔗×]$/.test(x.t));
      const tiny = [...document.querySelectorAll('#content *')].filter(e => vis(e) && !e.closest('svg') && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map(e => `${e.tagName}.${e.className}`.slice(0, 40));
      return { hscroll: document.documentElement.scrollWidth > innerWidth, small, tiny: [...new Set(tiny)] };
    });
    const id = `${w}/${theme}/${view}${tab ? ':' + tab : ''}`;
    if (r.hscroll) found.push(`${id}: scroll horizontal`);
    if (r.small.length) found.push(`${id}: alvos <44px → ${r.small.map(s => `${s.t}(${s.w}×${s.h})`).join(', ')}`);
    if (r.tiny.length) found.push(`${id}: texto <11px → ${r.tiny.join(', ')}`);
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(found.length ? found.join('\n') : 'sem achados');
assert.deepEqual(errors, [], `erros: ${errors.join(' | ')}`);
assert.deepEqual(found, [], 'inconsistências objetivas');
console.log('OK — varredura de consistência (9 ecrãs × 3 viewports/temas)');
