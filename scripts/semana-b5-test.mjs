/* Bloco 5: Semana, plano habitual, acessibilidade e preservação dos registos — npm run test:b5. */
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
async function open(width = 390, time = '2026-10-26T12:00:00Z') {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Europe/Lisbon', hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  // Media externa não faz parte deste contrato: fixture local determinista.
  await ctx.route('https://**', route => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()} (${m.location().url})`); });
  page.on('requestfailed', r => console.log(`Pedido falhou: ${r.url()} — ${r.failure()?.errorText}`));
  await page.clock.install({ time: new Date(time) });
  await page.addInitScript(() => { if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true } })); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
}
const render = (page, view) => page.evaluate(v => window.render(v), view);
const state = page => page.evaluate(async () => {
  const { ST } = await import('./js/state.js');
  return JSON.parse(JSON.stringify({ log: ST.log, workouts: ST.workouts, sessions: ST.sessions, session: ST.session }));
});
try {
  for (const width of [320, 360, 390, 412, 1280]) {
    const { ctx, page } = await open(width);
    for (const view of ['__hoje', '__semana', 'Segunda']) {
      await render(page, view);
      const chips = await page.locator('.wk-chip').evaluateAll(es => es.map(e => {
        const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, w: r.width, h: r.height, label: e.getAttribute('aria-label') };
      }));
      assert.equal(chips.length, 7);
      chips.forEach((c, i) => { assert(c.w >= 44 && c.h >= 44, `${width}/${view}: ${JSON.stringify(c)}`); assert(c.label.includes(', ')); if (i) assert(chips[i - 1].right <= c.x + .01, 'sobreposição'); });
      assert.equal(await page.locator('.wk-chip[aria-current="date"]').count(), 1);
      assert.match(await page.locator('.wk-chip[aria-current="date"]').getAttribute('aria-label'), /Segunda, hoje/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}/${view}: overflow`);
    }
    await render(page, '__semana');
    assert.match(await page.locator('h1').innerText(), /Esta semana.*26 out.*1 nov/);
    assert.equal(await page.locator('.hero, .adapt-card').count(), 0);
    await page.locator('.wk-row[data-day="Segunda"]').click();
    await page.getByRole('button', { name: '‹ Semana', exact: true }).click();
    assert.match(await page.locator('h1').innerText(), /Esta semana/);
    await render(page, '__plano');
    assert.match(await page.locator('#content').innerText(), /Alterações à rotina valem para todas as semanas/);
    await page.evaluate(async () => {
      const { ST, save } = await import('./js/state.js');
      ST.log['Carga preservada'] = [{ date: '2026-10-20', ts: 1792497600000, w: 42, r: 8, sets: [{ w: 42, r: 8, ts: 1792497600000 }] }];
      ST.log['Carga desta semana'] = [{ date: '2026-10-26', ts: 1793016000000, w: 50, r: 6, sets: [{ w: 50, r: 6, ts: 1793016000000, k: 'Terça:0' }] }];
      ST.workouts = [{ id: 'b5-old', state: 'COMPLETED', day: 'Segunda', date: '2026-10-20' }];
      ST.sessions = [{ id: 'b5-manual', date: '2026-10-19', label: 'Manual' }]; save();
    });
    const before = await state(page);
    await page.locator('.pl-day').first().locator('summary').click();
    await page.locator('.pl-day').first().getByRole('button', { name: /Editar/ }).click();
    assert.match(await page.locator('.day-hdr').innerText(), /A editar o plano habitual — vale para todas as semanas/);
    await page.locator('.ed-label input').fill('Rotina B5');
    await page.locator('.ed-label input').dispatchEvent('change');
    await page.getByRole('button', { name: '✓ Pronto', exact: true }).click();
    await page.getByRole('button', { name: '‹ Plano', exact: true }).click();
    await render(page, 'Segunda');
    await page.getByRole('button', { name: '✎ Editar rotina', exact: true }).click();
    await page.locator('.ed-fields input[type="text"]').first().fill('8-12');
    await page.locator('.ed-fields input[type="text"]').first().dispatchEvent('change');
    await page.getByRole('button', { name: '✓ Pronto', exact: true }).click();
    assert.deepEqual(await state(page), before, 'editar não altera registos');
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await state(page), before, 'reload preserva registos');
    assert.match(await page.locator('#content').innerText(), /Rotina B5/);
    assert.equal(await page.evaluate(async () => (await import('./js/state.js')).ST.routine.Segunda.ex[0].r), '8-12');
    await page.evaluate(() => window.obOpen('reorg'));
    assert.match(await page.locator('#onbBody').innerText(), /plano habitual.*todas as semanas/s);
    await page.locator('.ob-row-day').filter({ hasText: 'Terça' }).click();
    await page.locator('.ob-row-day').filter({ hasText: 'Sábado' }).click();
    const reorganized = await state(page);
    assert.equal(reorganized.log['Carga desta semana'][0].sets[0].k, 'Sábado:0');
    const values = s => JSON.parse(JSON.stringify(s, (k, v) => k === 'k' ? undefined : v));
    assert.deepEqual(values(reorganized), values(before), 'reorganizar preserva valores e datas dos registos');
    await page.getByRole('button', { name: 'Pronto', exact: true }).click();
    await ctx.close(); console.log(`OK chips, rótulos, retornos, edição e reload ${width}px`);
  }
  for (const paused of [false, true]) {
    const { ctx, page } = await open(390, '2026-11-01T23:59:00Z');
    await page.evaluate(async paused => { const s = await import('./js/session.js'); s.startSession('Segunda'); if (paused) s.pauseSession(); }, paused);
    const before = await state(page);
    await page.clock.fastForward(120000);
    await render(page, '__semana');
    const after = await state(page);
    assert.equal(after.session.id, before.session.id);
    assert.equal(after.session.state, paused ? 'PAUSED' : 'ACTIVE');
    assert.equal(after.session.date, before.session.date);
    assert.equal(after.session.wk, before.session.wk);
    assert.deepEqual(after.log, before.log); assert.deepEqual(after.workouts, before.workouts); assert.deepEqual(after.sessions, before.sessions);
    assert.match(await page.locator('h1').innerText(), /2 nov.*8 nov/);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await state(page)).session.id, before.session.id);
    await ctx.close(); console.log(`OK domingo → segunda: ${paused ? 'pausada' : 'ativa'}`);
  }
  const { ctx, page } = await open();
  await page.evaluate(async () => {
    const { moveDay } = await import('./js/adapt.js');
    const r = moveDay('Segunda', 'Sábado'); if (!r.ok) throw new Error(r.error);
    window.render('__semana');
  });
  assert.match(await page.locator('.wk-chip[data-day="Segunda"]').getAttribute('aria-label'), /movido para Sábado/);
  assert.match(await page.locator('.wk-row[data-day="Sábado"]').innerText(), /treino de Segunda \(movido\)/);
  await page.evaluate(async () => {
    const { ST } = await import('./js/state.js'); const { undoMove } = await import('./js/adapt.js');
    for (const id of Object.keys(ST.adapt.moves)) { const r = undoMove(id); if (!r.ok) throw new Error(r.error); }
  });
  await page.evaluate(async () => {
    const { ST, save } = await import('./js/state.js');
    ST.sched.done.Segunda = '2026-10-26';
    ST.sched.replaced['Terça'] = '2026-10-27';
    ST.done['Quarta:0'] = true;
    ST.sched.skip.Sexta = true;
    save(); window.render('__semana');
  });
  for (const [day, label] of [['Segunda', 'treino feito'], ['Terça', 'treino substituído'], ['Quarta', 'treino a meio'], ['Sexta', 'antes do plano'], ['Sábado', 'descanso']]) {
    assert.match(await page.locator(`.wk-chip[data-day="${day}"]`).getAttribute('aria-label'), new RegExp(label));
  }
  await page.evaluate(async () => {
    const { addClass } = await import('./js/classes.js');
    for (const weekly of [false, true]) {
      const r = addClass({ name: weekly ? 'Recorrente B5' : 'Pontual B5', day: 'Segunda', date: '2026-10-26', weekly, time: '18:00', min: 45, intensity: 1, kind: 'pilates' });
      if (!r.ok) throw new Error(r.error);
    }
    window.render('__semana');
  });
  assert.match(await page.locator('.wk-chip[aria-current="date"]').getAttribute('aria-label'), /com aula/);
  assert.match(await page.locator('#content').innerText(), /Pontual B5/);
  assert.match(await page.locator('#content').innerText(), /Recorrente B5/);
  await render(page, '__plano');
  assert.match(await page.locator('.wk-row', { hasText: 'Pontual B5' }).innerText(), /só esta semana/);
  assert.match(await page.locator('.wk-row', { hasText: 'Recorrente B5' }).innerText(), /todas as semanas/);
  await page.clock.setSystemTime(new Date('2026-11-02T12:00:00Z'));
  await render(page, '__semana');
  assert.doesNotMatch(await page.locator('#content').innerText(), /Pontual B5/);
  assert.match(await page.locator('#content').innerText(), /Recorrente B5/);
  await page.evaluate(async () => { const { ST, save } = await import('./js/state.js'); for (const d of Object.values(ST.routine)) d.rest = true; save(); window.render('__semana'); });
  assert.equal(await page.locator('.week-list .s-rest').count(), 7);
  assert.equal(await page.locator('.hero').count(), 0);
  assert.equal(await page.locator('#progFill').evaluate(e => e.style.width), '0%');
  for (const view of ['__hoje', '__semana', '__perfil', '__nutri']) {
    await render(page, view);
    if (view === '__hoje') await page.locator('.nb[data-day="__semana"]').click();
    if (view === '__nutri') {
      await page.locator('.nb[data-day="opts"]').click();
      await page.locator('#sheetBg').getByRole('button', { name: /Histórico/ }).click();
    } else await page.getByRole('button', { name: /Histórico/ }).first().click();
    assert.equal(await page.locator('#hdrSub').innerText(), 'Histórico');
  }
  await page.locator('.nb[data-day="opts"]').click();
  await page.locator('#sheetBg').getByRole('button', { name: /Histórico/ }).click();
  assert.equal(await page.locator('#hdrSub').innerText(), 'Histórico');
  await ctx.close();
  assert.deepEqual(errors, []);
  console.log('OK descanso, Histórico ≤2 toques, sem erros de consola');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
