/* Atualização do service worker (v33 → atual): dados, sessão em curso e descanso sobrevivem; cache velha sai — npm run test:sw-update */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const OLD_SW = execSync('git show 1f4b63c:sw.js', { cwd: root, encoding: 'utf8' });   /* o sw.js publicado (treino-v33) */
const OLD = /treino-v\d+/.exec(OLD_SW)[0], NEW = /treino-v\d+/.exec(readFileSync(join(root, 'sw.js'), 'utf8'))[0];
assert.notEqual(OLD, NEW, 'a versão do SW não subiu');
let serveOld = true;
const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/sw.js') { res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store'); return res.end(serveOld ? OLD_SW : readFileSync(join(root, 'sw.js'))); }
  const file = p === '/' ? join(root, 'index.html') : join(root, ...p.split('/').filter(s => s && s !== '..'));
  if (!existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
const now = Date.now();
await page.addInitScript(([t]) => {
  try {
    if (localStorage.getItem('treino_v2')) return;
    localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} }, prefs: { goal: 'forca', days: ['Segunda', 'Quarta', 'Sexta'], mins: 45, exp: 'inicio', place: 'gym', pref: 'livres', limits: [] },
      log: { 'Supino reto': [{ date: '2026-10-20', ts: t - 4e6, w: 40, r: 8 }] }, session: { id: 'sw-test', day: 'Segunda', label: 'A', state: 'ACTIVE', date: '2026-10-21', startedAt: t - 6e5, seenAt: t, confirmedMs: 1e5, pausedMs: 0, pauseAt: 0, endedAt: 0, pos: 0 } }));
    localStorage.setItem('rest_timer', JSON.stringify({ end: t + 9e5, total: 900 }));
  } catch (_) { /* sem storage */ }
}, [now]);
const snap = () => page.evaluate(() => { const st = JSON.parse(localStorage.getItem('treino_v2')); const { id, day, state, startedAt, pausedMs } = st.session || {}; return JSON.stringify({ log: st.log, session: { id, day, state, startedAt, pausedMs }, workouts: st.workouts, routine: st.routine, prefs: st.prefs, plan: st.plan, sets: st.sets, sched: st.sched, rest: localStorage.getItem('rest_timer') });   /* seenAt/confirmedMs andam com o batimento da app: ficam de fora */ });
const caches_ = () => page.evaluate(async () => (await caches.keys()).sort());

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(async n => (await caches.keys()).includes(n) && !!(await navigator.serviceWorker.ready).active, OLD, { timeout: 15000 });
const before = await snap();
assert(JSON.parse(before).session.state === 'ACTIVE', 'a sessão de teste não ficou ativa');
assert(JSON.parse(before).rest, 'o descanso de teste não ficou persistido');

serveOld = false;
await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
await page.waitForFunction(async ([o, n]) => { const k = await caches.keys(); return k.includes(n) && !k.includes(o); }, [OLD, NEW], { timeout: 15000 });
await page.reload({ waitUntil: 'networkidle' });
const after = await snap();
assert(after === before, 'dados/sessão/descanso mudaram com a atualização do SW');
await page.waitForFunction(async n => { const k = await caches.keys(); return k.length === 1 && k[0] === n; }, NEW, { timeout: 5000 });
assert.deepEqual(await caches_(), [NEW], 'cache antiga não saiu');
/* cache antiga recriada por um SW em fim de vida com um ficheiro VELHO/estragado: a nova versão não pode servi-lo */
await page.evaluate(async old => { const c = await caches.open(old); await c.put('js/ui.js', new Response('throw new Error("ficheiro velho")', { headers: { 'Content-Type': 'text/javascript' } })); await c.put('index.html', new Response('<h1>velho</h1>', { headers: { 'Content-Type': 'text/html' } })); }, OLD);
await page.reload({ waitUntil: 'networkidle' });
assert(await page.evaluate(() => document.getElementById('content').children.length > 0 && !document.body.textContent.includes('velho')), 'serviu ficheiro de cache antiga');
assert.deepEqual(errors, []);
await browser.close(); server.close();
console.log(`OK — SW ${OLD} → ${NEW}: histórico, sessão em curso, plano, preferências e descanso intactos; cache antiga removida.`);
