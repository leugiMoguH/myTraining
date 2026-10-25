/* Adaptação no ecrã: sugestão (aceitar/recusar/desfazer), treino rápido, correção de aulas passadas — npm run test:adapt-ui */
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

async function open(theme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(th => { try { localStorage.setItem('treino_theme', th); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) {} }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.clock.install({ time: new Date('2026-10-21T12:00:00') });   /* Quarta; Segunda em atraso */
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async prefs => {
    const { applyPlan } = await import('./js/plan.js'); const { normalizePrefs, proposePlan } = await import('./js/planner.js');
    const r = applyPlan(proposePlan(normalizePrefs(prefs)), { reason: 'teste' }); if (!r.ok) throw new Error(r.error);
    const S = await import('./js/state.js'); S.ST.sched.skip = {}; S.save();   /* plano «antigo»: Segunda conta como atraso */
    window.render('__hoje');
  }, PREFS);
  return { ctx, page };
}
const st = (page, f) => page.evaluate(async src => { const { ST } = await import('./js/state.js'); return new Function('ST', `return (${src})(ST)`)(ST); }, f.toString());
const noH = async (page, m) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `scroll horizontal: ${m}`);
const small = async (page, m) => assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.ad-card button, .ad-note button, .ad-quick, #classBg.show button, #classBg.show input')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 43).map(e => e.textContent.trim().slice(0, 24))), [], `alvos pequenos: ${m}`);

async function run(theme, width) {
  const tag = `${theme}-${width}`;
  const shot = (page, n) => page.screenshot({ path: join(SHOTS, `adapt-${tag}-${n}.png`) });
  let { ctx, page } = await open(theme, width);
  let routine0 = await st(page, s => JSON.stringify(s.routine));

  /* 1. sugestão: o que aconteceu / o que recomendo / o que acontece; sem culpa */
  const card = page.locator('.ad-card');
  assert.equal(await card.count(), 1, 'uma sugestão');
  const text = await card.innerText();
  assert.match(await page.locator('.hero-k').innerText(), /Segunda/i, 'o cartão identifica o treino pendente');
  assert.equal(await card.locator('.ad-what, .btn-primary').count(), 0);
  assert.equal(await card.locator('[onclick^="adAlt"]').count(), 0);
  assert.doesNotMatch(text, /falhaste|preguiça|culpa|devias/i, 'sem tom culpabilizador');
  await noH(page, 'sugestão'); await small(page, 'sugestão'); await shot(page, 'sug');

  /* 2. recusar: some e não volta (também após recarregar) */
  await card.getByText('Agora não').tap();
  assert.equal(await page.locator('.ad-card').count(), 0, 'recusada some');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.ad-card').count(), 0, 'recusada não volta após recarregar');
  assert.equal(await st(page, s => Object.keys((s.adapt || {}).moves || {}).length), 0, 'recusar não move nada');

  /* 3. aceitar noutro contexto: move só desta semana, rotina intacta, Desfazer repõe */
  await ctx.close();
  ({ ctx, page } = await open(theme, width)); routine0 = await st(page, s => JSON.stringify(s.routine));
  await page.locator('.ad-card').getByText('Aceitar').tap();
  assert.equal(await page.locator('.ad-note').count(), 1, 'nota persistente do move');
  assert.match(await page.locator('.ad-note').innerText(), /passou para/);
  assert.equal(await st(page, s => JSON.stringify(s.routine)), routine0, 'rotina intacta');
  assert.equal(await st(page, s => Object.keys(s.adapt.moves).length), 1, 'um move');
  await noH(page, 'após aceitar'); await small(page, 'nota'); await shot(page, 'moved');
  await page.evaluate(() => window.render('__hist'));
  assert.match(await page.locator('#content').innerText(), /Passa para/, 'Semana mostra o treino movido');
  await page.reload({ waitUntil: 'networkidle' }); await page.evaluate(() => window.render('__hoje'));
  assert.equal(await page.locator('.ad-note').count(), 1, 'move persiste após recarregar');
  await page.locator('.ad-note').getByText('Desfazer').tap();
  assert.equal(await page.locator('.ad-note').count(), 0, 'desfeito');
  assert.equal(await st(page, s => Object.keys(s.adapt.moves).length), 0, 'move removido');
  assert.equal(await st(page, s => JSON.stringify(s.routine)), routine0, 'rotina continua intacta');

  /* 4. treino rápido: revisão, concluir → dia «feito · reduzido», histórico distingue */
  await page.evaluate(() => window.render('__hoje'));
  const day = await st(page, s => s.day);
  await page.locator('.ad-quick').tap();
  assert.equal(await page.evaluate(async () => (await import('./js/state.js')).ST.view), '__pers', 'ecrã de revisão');
  assert.match(await page.locator('#content').innerText(), /rápido/i);
  await shot(page, 'quick');
  const planned = await st(page, s => s.custom.ex.length), original = await st(page, s => s.routine[s.custom.quick.from].ex.length);
  assert.ok(planned >= 1 && planned <= original, 'só exercícios do dia');
  await page.evaluate(() => window.cuBegin());
  await page.evaluate(async () => { const { ST } = await import('./js/state.js'); window.toggleSet('Personalizado', 0, 0, true); void ST; });
  await page.evaluate(() => window.cuFinish());
  await page.locator('#mvBg.show').getByRole('button', { name: 'Concluir', exact: true }).tap();   /* celebração do treino rápido */
  assert.equal(await st(page, s => s.sessions.at(-1).kind), 'quick');
  const from = await st(page, s => s.custom.quick.from);
  assert.equal(await st(page, s => !!s.sched.quick[s.custom.quick.from]), true, 'dia reduzido marcado');
  assert.equal(await st(page, s => !!s.sched.done[s.custom.quick.from]), true, 'dia fechado');
  await page.evaluate(() => window.render('__hist'));
  assert.match(await page.locator('#content').innerText(), /Feito · reduzido/, 'Semana distingue reduzido');
  void day; void from;

  /* 5. aula de semana passada: registar e corrigir, data original e registo da alteração */
  await page.evaluate(async () => {
    const { addClass } = await import('./js/classes.js');
    const r = addClass({ kind: 'pilates', name: 'Pilates', day: 'Segunda', time: '18:00', min: 60, intensity: 1, weekly: true }, '2026-10-21');
    if (!r.ok) throw new Error(r.error);
    window.render('__hist');
  });
  const before = await st(page, s => JSON.stringify([s.sched.done, s.workouts, s.log]));
  await page.getByText('＋ Registar aula de outro dia').tap();
  await page.locator('#classBg .ob-chip', { hasText: 'Pilates' }).tap();
  await page.locator('#clDate').fill('2026-10-12');
  await noH(page, 'registar aula'); await small(page, 'registar aula'); await shot(page, 'past');
  await page.locator('#classBg').getByText('Guardar', { exact: true }).tap();
  assert.match(await page.locator('#content').innerText(), /12\/10/, 'aula passada no histórico');
  await page.locator('.wk-row', { hasText: '12/10' }).getByText('Corrigir').tap();
  await page.locator('#classBg .ob-chip', { hasText: 'Cancelada' }).tap();
  await page.locator('#classBg').getByText('Guardar', { exact: true }).tap();
  assert.equal(await st(page, s => Object.values(s.classLog).find(o => o.date === '2026-10-12').status), 'cancelled');
  assert.equal(await st(page, s => Object.values(s.classLog).find(o => o.date === '2026-10-12').changes.length), 2, 'registo das alterações');
  assert.equal(await st(page, s => JSON.stringify([s.sched.done, s.workouts, s.log])), before, 'treinos e cargas intactos');
  await page.locator('.wk-row', { hasText: '12/10' }).getByText('Corrigir').tap();
  await page.locator('#classBg .ob-chip', { hasText: 'Cancelada' }).waitFor();   /* sheet abre noutro estado */
  await page.locator('#classBg').getByText('Cancelar', { exact: true }).tap();
  await ctx.close();
}

try {
  await run('dark', 360);
  await run('light', 412);
  assert.deepEqual(errors, [], `erros: ${errors.join(' | ')}`);
  console.log('OK adaptação no ecrã: sugestão, recusar, aceitar, desfazer, persistência, treino rápido, aulas passadas; 360/412, dois temas.');
} finally { await browser.close(); server.close(); }
