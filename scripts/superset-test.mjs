import { dialogResponder, settleDialog } from './_dialogs.mjs';
/* Superset e troca rápida no guiado (Chromium) — npm run test:superset */
import { chromium } from 'playwright';
import { skipOnboarding } from './_skip-onb.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const PORT = +process.env.PORT || 8126;
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
await skipOnboarding(page);
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await dialogResponder(page, () => true, errors);
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });

const state = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('treino_v2')); const w = document.querySelector('.wo-name');
  return { name: w ? w.textContent : '', sets: s.sets, rest: !!document.querySelector('#woRest:not([hidden])') };
});
const day = await page.evaluate(async () => {
  const sc = await import('./js/schedule.js'), rt = await import('./js/routine.js'), wk = await import('./js/workout.js');
  const d = sc.currentDay(); rt.updateExercise(d, 0, { ss: true });
  rt.updateExercise(d, 0, { s: 2 }); rt.updateExercise(d, 1, { s: 2 });
  window.__d = d; wk.startWorkout(d); return d;
});
await page.waitForSelector('.wo-name');
const ex = await page.evaluate(async d => (await import('./js/routine.js')).DAYS[d].ex.slice(0, 2).map(e => e.name), day);
const fill = async () => { await page.fill('#wo-w', '20'); await page.fill('#wo-r', '10'); };
const done = async () => { await fill(); await page.click('.wo-main'); await page.waitForTimeout(450); };

await done(); let s = await state();
check(s.name === ex[1] && !s.rest, `A1 → B sem descanso (visto: ${s.name}, descanso ${s.rest})`);
await done(); s = await state();
check(s.name === ex[0] && s.rest, `B1 → descanso e volta a A (visto: ${s.name}, descanso ${s.rest})`);
await done(); s = await state(); check(s.name === ex[1] && !s.rest, 'A2 → B sem descanso (o do par anterior acaba)');
await page.click('.wo-links button:has-text("Desfazer")'); await page.waitForTimeout(300); s = await state();
check(s.name === ex[0] && s.sets[`${day}:0`].length === 1, `desfazer tira A2 (visto: ${s.name})`);
await done(); s = await state(); check(s.name === ex[1], 'A2 outra vez → B');
await done(); s = await state();
check(s.sets[`${day}:0`].length === 2 && s.sets[`${day}:1`].length === 2, 'quatro séries marcadas (A1,B1,A2,B2)');
check(await page.locator('.wo-links button:has-text("Trocar")').count() === 0, 'Trocar escondido com séries feitas');

/* troca rápida num exercício sem séries */
await page.evaluate(async () => { const wk = await import('./js/workout.js'); wk.woGo(1); });
/* troca rápida (exercício 3, sem séries): abre o catálogo, escolhe, o guiado repinta com o novo nome */
await page.evaluate(async () => { (await import('./js/workout.js')).woGo(1); });
const antes = (await state()).name;
check(await page.locator('.wo-links button:has-text("Trocar")').count() === 1, 'Trocar visível sem séries feitas');
await page.click('.wo-links button:has-text("Trocar")');
await page.waitForSelector('[onclick^="catPick"]', { timeout: 10000 });
await page.locator('[onclick^="catPick"]').first().click();
await page.waitForTimeout(500);
check((await state()).name !== antes, 'guiado repinta com o exercício trocado');
console.log(fail.length ? 'FALHOU:\n  ' + fail.join('\n  ') : 'OK — superset A1,B1,A2,B2 com descanso só no fim do par');
if (errors.length) { console.log('erros de consola:\n  ' + errors.join('\n  ')); fail.push('consola'); }
await browser.close(); server.close(); process.exit(fail.length ? 1 : 0);
