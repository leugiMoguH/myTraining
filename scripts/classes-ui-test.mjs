/* Aulas no ecrã (Hoje, Plano, Semana/Histórico): criar, conflito, assinalar, substituir, reabrir — npm run test:classes-ui */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(root, 'test-results'); mkdirSync(SHOTS, { recursive: true });
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
const PREFS = { goal: 'forca', days: ['Segunda', 'Quarta', 'Sexta'], mins: 60, exp: 'regular', place: 'gym', equip: ['maq', 'livres'], limits: ['ombros'], name: 'Rita' };

async function run(theme) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(th => { try { localStorage.setItem('treino_theme', th); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) {} }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.clock.install({ time: new Date('2026-10-21T12:00:00') });   /* Quarta: dia de treino do plano */
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async prefs => {
    const { applyPlan } = await import('./js/plan.js'); const { normalizePrefs, proposePlan } = await import('./js/planner.js');
    const r = applyPlan(proposePlan(normalizePrefs(prefs)), { reason: 'teste' }); if (!r.ok) throw new Error(r.error);
    window.render('__plano');
  }, PREFS);
  const st = f => page.evaluate(async src => { const { ST } = await import('./js/state.js'); return new Function('ST', `return (${src})(ST)`)(ST); }, f.toString());
  const noH = async m => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `scroll horizontal: ${m}`);
  const small = async m => assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#classBg.show button, .cl-acts button, .cl-sheet input')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 43).map(e => e.textContent.trim().slice(0, 20))), [], `alvos pequenos: ${m}`);
  const shot = n => page.screenshot({ path: join(SHOTS, `aulas-${theme}-${n}.png`) });
  const before = await st(s => JSON.stringify([s.sched.done, s.workouts, s.log]));

  /* criar Pilates na Quarta (hoje, com treino) → conflito → manter ambos */
  await page.locator('text=＋ Adicionar aula').tap();
  assert.ok(await page.locator('#classBg.show').count(), 'folha aberta');
  await noH('formulário'); await small('formulário'); await shot('form');
  await page.locator('#classBg').getByText('Guardar aula').tap();
  assert.match(await page.locator('#clBody').innerText(), /Quarta já tem o treino/, 'conflito apresentado');
  await shot('conflito');
  await page.locator('#classBg').locator('.sheet-item', { hasText: 'Manter ambos' }).tap();
  assert.equal(await page.locator('#classBg.show').count(), 0, 'folha fechada');
  assert.equal(await page.locator('.wk-row', { hasText: 'Pilates' }).count(), 1, 'aula na lista do Plano');
  assert.equal(await st(s => Object.keys(s.sched.replaced || {}).length), 0, 'plano intacto');

  /* Hoje: aula + hero do treino; Fiz → feita, treino continua pendente */
  await page.evaluate(() => window.render('__hoje'));
  assert.equal(await page.locator('.cl-row').count(), 1, 'aula no Hoje');
  assert.ok(await page.locator('.hero .start-wo').count(), 'treino continua a ser a ação principal');
  assert.equal(await page.locator('.wk-chip .wk-c').count(), 1, 'ponto no chip do dia');
  await noH('hoje'); await small('hoje'); await shot('hoje');
  await page.locator('.cl-row').getByText('✓ Fiz').tap();
  assert.match(await page.locator('.cl-row .cl-st').innerText(), /Feita/);
  assert.ok(await page.locator('.hero .start-wo').count(), 'treino não foi tocado');
  assert.equal(await st(s => s.sched.done.Quarta || null), null, 'treino de Quarta não ficou feito');
  /* Histórico: resumo e aulas recentes, sem as misturar com treinos */
  await page.evaluate(() => window.render('__hist'));
  assert.match(await page.locator('#hdrSub').innerText(), /1 aula feita/);
  assert.match(await page.locator('#content').innerText(), /Aulas recentes/);
  await noH('histórico'); await shot('hist');
  await page.evaluate(() => window.render('__hoje'));
  await page.locator('.cl-row').getByText('Reabrir').tap();
  assert.match(await page.locator('.cl-row .cl-st').innerText(), /Planeada/);

  /* segunda aula (intensa) a substituir o treino de hoje: só conta quando é feita; Reabrir desfaz */
  await page.evaluate(() => window.render('__plano'));
  await page.locator('text=＋ Adicionar aula').tap();
  await page.locator('#classBg').getByText('Spinning').tap();
  await page.locator('#classBg').getByText('Guardar aula').tap();
  assert.match(await page.locator('#clBody').innerText(), /Considera substituir/, 'conselho para aula intensa');
  await page.locator('#classBg').locator('.sheet-item', { hasText: 'A aula substitui o treino de Quarta' }).tap();
  assert.equal(await st(s => Object.keys(s.sched.replaced || {}).length), 0, 'intenção não altera o plano');
  await page.evaluate(() => window.render('__hoje'));
  assert.equal(await page.locator('.cl-row').count(), 2);
  await page.locator('.cl-row', { hasText: 'Spinning' }).getByText('✓ Fiz').tap();
  assert.equal(await st(s => (s.sched.replaced.Quarta ? 1 : 0)), 1, 'treino de Quarta substituído ao assinalar');
  await page.locator('.cl-row', { hasText: 'Spinning' }).getByText('Reabrir').tap();
  assert.equal(await st(s => Object.keys(s.sched.replaced || {}).length), 0, 'reabrir desfaz a substituição');

  /* «Manter ambos» desfaz a substituição escolhida antes; editar uma aula pontual de outra semana não muda a data */
  await page.evaluate(() => window.render('__plano'));
  await page.locator('.wk-row', { hasText: 'Spinning' }).tap();
  await page.locator('#classBg').getByText('Guardar aula').tap();
  await page.locator('.sheet-item', { hasText: 'Manter ambos' }).tap();
  assert.equal(await st(s => Object.values(s.classLog).some(o => o.replacesDay)), false, 'manter ambos limpa a intenção');
  await page.evaluate(async () => { const { addClass } = await import('./js/classes.js'); const r = addClass({ kind: 'yoga', name: 'Yoga', day: 'Quarta', time: '09:00', min: 45, intensity: 1, weekly: false, date: '2026-10-28' }); if (!r.ok) throw new Error(r.error); window.render('__plano'); });
  await page.locator('.wk-row', { hasText: 'Yoga' }).tap();
  await page.locator('#classBg').getByText('Guardar aula').tap();
  await page.locator('.sheet-item', { hasText: 'Manter ambos' }).tap();
  assert.equal(await st(s => s.classes.find(c => c.name === 'Yoga').date), '2026-10-28', 'data da aula pontual intacta');
  await page.evaluate(() => window.render('__hoje'));

  /* editar e apagar: o histórico fica */
  await page.locator('.cl-row', { hasText: 'Pilates' }).getByText('✓ Fiz').tap();
  await page.evaluate(() => window.render('__plano'));
  await page.locator('.wk-row', { hasText: 'Pilates' }).tap();
  await page.locator('#classBg').getByText('Apagar aula').tap();
  await page.locator('.app-dialog .btn-danger').tap();
  assert.equal(await page.locator('.wk-row', { hasText: 'Pilates' }).count(), 0, 'modelo apagado');
  assert.equal(await st(s => Object.values(s.classLog).filter(o => o.status === 'done' && o.snap.name === 'Pilates').length), 1, 'histórico mantido');
  await page.evaluate(() => window.render('__hist'));
  assert.match(await page.locator('#content').innerText(), /Pilates/, 'aula feita continua no histórico');
  assert.equal(await st(s => JSON.stringify([s.sched.done, s.workouts, s.log])), before, 'treinos e cargas intactos');
  await ctx.close();
}

try {
  await run('dark');
  await run('light');
  assert.deepEqual(errors, [], `erros: ${errors.join(' | ')}`);
  console.log('OK aulas no ecrã: criar, conflito, assinalar, substituir, reabrir, apagar; dois temas, 360px.');
} finally { await browser.close(); server.close(); }
