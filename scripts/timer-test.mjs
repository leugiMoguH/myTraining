/* Descanso expirado (Chromium) — npm run test:timer */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const PORT = +process.env.PORT || 8127;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = join(ROOT, p.split('/').filter(s => s && s !== '..').join('/'));
  if (!existsSync(file)) { res.writeHead(404).end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));
const fail = [], errors = [];
const check = (c, m) => { if (!c) fail.push(m); };
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 800 } })).newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(async () => { (await import('./js/timer.js')).timerStart(1); });
const shown = () => page.evaluate(() => document.getElementById('timerBanner').classList.contains('show'));
check(await shown(), 'banner devia aparecer ao iniciar');
await page.waitForTimeout(1600);
check(!(await shown()), 'banner devia sair quando o descanso expira (ficava em 0:00)');
check(await page.evaluate(() => !localStorage.getItem('rest_timer')), 'rest_timer devia ser limpo');
/* background: expira sem ticks; o tick de regresso fecha o banner */
await page.evaluate(async () => { const t = await import('./js/timer.js'); t.timerStart(60); t.TM.end = Date.now() - 1000; t.timerTick(); });
check(!(await shown()), 'tick de regresso depois do fim devia fechar o banner');
console.log(fail.length ? 'FALHOU: ' + fail.join(' | ') : 'OK — banner do descanso sai ao expirar');
if (errors.length) { console.log('erros de consola: ' + errors.join(' | ')); fail.push('consola'); }
await browser.close(); server.close(); process.exit(fail.length ? 1 : 0);
