/* Ecrã Hoje em todos os dias da semana (relógio real de cada dia, sem esconder fins de semana) — npm run test:hoje-semana */
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
const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const text = async page => (await page.locator('#content').textContent()).replace(/\s+/g, ' ');
let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log(`OK ${name}`); };

async function open(dayIndex, seed) {   /* 2026-10-19 é segunda */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.clock.install({ time: new Date(`2026-10-${19 + dayIndex}T10:00:00`) });
  await page.addInitScript(s => { try { if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify(s)); } catch (_) { /* sem storage */ } }, seed);
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
}
const SKIP = { onb: { done: true, skipped: true, step: 0, draft: {} } };

async function newPlan(page) {   /* plano novo Seg/Qua/Sex, criado "hoje" como o acolhimento faz */
  await page.evaluate(async () => {
    const { proposePlan } = await import('./js/planner.js'), { applyPlan } = await import('./js/plan.js'), { render } = await import('./js/ui.js');
    const r = applyPlan(proposePlan({ goal: 'forma', days: ['Segunda', 'Quarta', 'Sexta'], mins: 45, exp: 'inicio', place: 'gym' }));
    if (r && r.ok === false) throw new Error('applyPlan recusou');
    render('__hoje');
  });
}

try {
  const expected = [
    [/Hoje · Segunda/, true], [/Próximo treino · Quarta/, true], [/Hoje · Quarta/, true], [/Próximo treino · Sexta/, true], [/Hoje · Sexta/, true],
    [/Sem treinos até à próxima semana[\s\S]*Segunda/, false], [/Sem treinos até à próxima semana[\s\S]*Segunda/, false],
  ];
  for (let i = 0; i < 7; i++) await test(`plano novo Seg/Qua/Sex criado ${DAYS[i]}: Hoje coerente`, async () => {
    const { ctx, page } = await open(i, SKIP);
    await newPlan(page);
    const t = await text(page);
    assert.match(t, expected[i][0], `${DAYS[i]}: ${t.slice(0, 200)}`);
    assert.equal(await page.locator('.hero').count(), expected[i][1] ? 1 : 0, `${DAYS[i]}: cartão principal`);
    assert.doesNotMatch(t, /Semana concluída/, `${DAYS[i]}: não pode celebrar uma semana sem treinos feitos`);
    if (!expected[i][1]) assert.equal(await page.evaluate(() => document.getElementById('progFill').style.width), '0px', `${DAYS[i]}: barra de progresso cheia sem treinos feitos`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'scroll horizontal');
    await ctx.close();
  });

  for (const i of [5, 6]) await test(`${DAYS[i]}: treinos todos feitos → Semana concluída`, async () => {
    const { ctx, page } = await open(i, SKIP);
    await newPlan(page);
    await page.evaluate(async () => {
      const { ST, save } = await import('./js/state.js'), { render } = await import('./js/ui.js');
      ST.sched = { ...ST.sched, skip: {}, done: { Segunda: '2026-10-19', Quarta: '2026-10-21', Sexta: '2026-10-23' } }; save(); render('__hoje');
    });
    assert.match(await text(page), /Semana concluída/i);
    assert.equal(await page.locator('.hero').count(), 0);
    assert.equal(await page.evaluate(() => document.getElementById('progFill').style.width), '100%');
    await ctx.close();
  });

  for (const i of [5, 6]) await test(`${DAYS[i]}: rotina original, treinos em falta → em atraso (não fim de semana vazio)`, async () => {
    const { ctx, page } = await open(i, SKIP);
    assert.match(await text(page), /Em atraso · Segunda/i);
    assert.equal(await page.locator('.hero').count(), 1);
    await ctx.close();
  });

  await test('Sábado: descanso do plano original com tudo feito → Semana concluída; sem treinos planeados → mensagem própria', async () => {
    const { ctx, page } = await open(5, SKIP);
    await page.evaluate(async () => {
      const { ST, save } = await import('./js/state.js'), { render } = await import('./js/ui.js');
      ST.sched = { ...ST.sched, done: { Segunda: 'x', Terça: 'x', Quarta: 'x', Quinta: 'x', Sexta: 'x' } }; save(); render('__hoje');
    });
    assert.match(await text(page), /Semana concluída/i);
    await page.evaluate(async () => {
      const { ST, save } = await import('./js/state.js'), { render } = await import('./js/ui.js');
      ST.routine = Object.fromEntries(Object.entries(ST.routine).map(([d, v]) => [d, { ...v, rest: true }])); ST.sched = { ...ST.sched, done: {}, skip: {} }; save(); render('__hoje');
    });
    const t = await text(page);
    assert.match(t, /Sem treinos até à próxima semana[\s\S]*Não há treinos planeados/);
    assert.equal(await page.locator('.hero').count(), 0);
    await ctx.close();
  });

  assert.deepEqual(errors, []);
  console.log(`OK — ${count} grupos: o ecrã Hoje em cada dia da semana`);
} finally { await browser.close(); server.close(); }
