/* Motivação no ecrã: celebração pós-treino, retoma, Histórico, Evolução (semana + conquistas) — npm run test:motiv-ui */
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
const EX = 'Supino na máquina';

async function open(theme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(th => { try { localStorage.setItem('treino_theme', th); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) {} }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.clock.install({ time: new Date('2026-10-21T12:00:00') });   /* Quarta */
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async prefs => {
    const { applyPlan } = await import('./js/plan.js'); const { normalizePrefs, proposePlan } = await import('./js/planner.js');
    const r = applyPlan(proposePlan(normalizePrefs(prefs)), { reason: 'teste' }); if (!r.ok) throw new Error(r.error);
    const S = await import('./js/state.js'); S.ST.sched.skip = {}; S.save();
    window.render('__hoje');
  }, PREFS);
  return { ctx, page };
}
const st = (page, f) => page.evaluate(async src => { const { ST } = await import('./js/state.js'); return new Function('ST', `return (${src})(ST)`)(ST); }, f.toString());
const noH = async (page, m) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `scroll horizontal: ${m}`);
const small = async (page, m) => assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#mvBg.show button, .mv-week button, .mv-more summary')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 43).map(e => e.textContent.trim().slice(0, 24))), [], `alvos pequenos: ${m}`);

/* treino real: sessão viva do dia, uma série com carga registada, concluir como o botão «Terminar» faz */
const train = (page, w, r) => page.evaluate(async ([ex, w, r]) => {
  const S = await import('./js/state.js'), Se = await import('./js/session.js');
  const day = S.ST.sched && window.__day || 'Quarta';
  Se.startSession(day, 'Corpo inteiro B');
  S.addSetLog(ex, w, r, false, `${day}:0`, day);
  Se.completeSession();
}, [EX, w, r]);

async function run(theme, width) {
  const tag = `${theme}-${width}`;
  const shot = (page, n) => page.screenshot({ path: join(SHOTS, `motiv-${tag}-${n}.png`) });
  const { ctx, page } = await open(theme, width);
  const sheet = page.locator('#mvBg.show');

  /* 1. primeiro treino de sempre: celebra, sem recorde inventado, conquista «primeiro treino» */
  await train(page, 40, 8);
  await sheet.waitFor();
  const t1 = await sheet.innerText();
  assert.match(t1, /Treino concluído/);
  assert.doesNotMatch(t1, /recorde/i, 'o primeiro registo de um exercício não é recorde');
  assert.equal(await sheet.locator('.mv-ach').count(), 1, 'uma conquista (agrupada)');
  assert.ok(await sheet.locator('.mv-msg').innerText(), 'mensagem positiva');
  assert.doesNotMatch(t1, /kcal|calorias|bpm/i, 'sem métricas inventadas');
  await noH(page, 'celebração'); await small(page, 'celebração'); await shot(page, 'primeiro');
  await sheet.getByRole('button', { name: 'Ver detalhes' }).tap();
  assert.match(await sheet.innerText(), new RegExp(EX), 'detalhes mostram o exercício');
  await shot(page, 'detalhes');
  await sheet.getByRole('button', { name: 'Concluir', exact: true }).tap();
  assert.equal(await page.locator('#mvBg.show').count(), 0, 'folha fechada');
  assert.equal(await st(page, s => s.view), '__hoje', 'regressa ao Hoje');
  assert.equal(await st(page, s => s.motiv.pending), null, 'pendente limpo');

  /* 2. recarregar: nada volta a celebrar */
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#mvBg.show').count(), 0, 'sem celebração ao recarregar');
  assert.equal(await st(page, s => s.workouts.filter(w => w.state === 'COMPLETED').length), 1, 'um treino guardado');

  /* 3. Histórico: o resumo reabre sem conquistas novas nem gravar */
  const motivBefore = await st(page, s => JSON.stringify(s.motiv));
  await page.evaluate(() => window.render('__hist'));
  await page.locator('.wk-row', { hasText: 'Concluído' }).getByText('Resumo').tap();
  await sheet.waitFor();
  assert.equal(await sheet.locator('.mv-new').count(), 0, 'consulta não celebra');
  assert.equal(await sheet.getByRole('button', { name: 'Fechar', exact: true }).count(), 1);
  await noH(page, 'resumo no histórico'); await shot(page, 'historico');
  await sheet.getByRole('button', { name: 'Fechar', exact: true }).tap();
  assert.equal(await st(page, s => JSON.stringify(s.motiv)), motivBefore, 'consultar não grava');

  /* 4. outro dia, mais carga: recorde verdadeiro e melhoria; conquista de recorde */
  await page.clock.setFixedTime(new Date('2026-10-22T12:00:00'));
  await train(page, 45, 8);
  await sheet.waitFor();
  const t2 = await sheet.innerText();
  assert.match(t2, /recorde/i, 'recorde verdadeiro');
  assert.match(t2, /45/);
  assert.equal(await sheet.locator('.mv-ach').count() >= 1, true);
  await shot(page, 'recorde');

  /* 5. fechar a app sem tocar em Concluir: a celebração retoma uma vez */
  await page.reload({ waitUntil: 'networkidle' });
  await sheet.waitFor();
  assert.match(await sheet.innerText(), /recorde/i, 'celebração pendente retomada');
  await sheet.getByRole('button', { name: 'Concluir', exact: true }).tap();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#mvBg.show').count(), 0, 'não volta a repetir');

  /* 6. Evolução: A tua semana + Conquistas, sem texto negativo */
  await page.evaluate(() => window.render('__perfil'));
  const ev = await page.locator('#content').innerText();
  assert.match(ev, /A tua semana/i);
  assert.match(ev, /Conquistas/i);
  assert.doesNotMatch(ev, /falhaste|falhou|atraso|perdeste|culpa/i);
  await noH(page, 'evolução'); await small(page, 'evolução'); await shot(page, 'evolucao');
  await page.getByText('Ver semana passada').tap();
  assert.match(await page.locator('#content').innerText(), /Semana passada/i);
  assert.doesNotMatch(await page.locator('#content .mv-week').innerText(), /falhaste|falhou|atraso|perdeste|culpa|nenhum treino/i);
  await shot(page, 'semana-passada');
  /* 7. treino manual (sem sessão guiada): fica no Histórico e o resumo reabre */
  await page.evaluate(async () => { const S = await import('./js/state.js'); S.ST.sessions = [...S.ST.sessions, { id: 'manual1', date: '2026-10-22', kind: 'custom', label: 'Meu treino', muscles: [], ex: ['A', 'B'], sets: 5 }]; S.save(); window.render('__hist'); });
  await page.locator('.wk-row', { hasText: 'Meu treino' }).getByText('Resumo').tap();
  await sheet.waitFor();
  const man = await sheet.innerText();
  assert.match(man, /5/); assert.doesNotMatch(man, /recorde/i, 'sem séries com carga não há recordes');
  await sheet.getByRole('button', { name: 'Fechar', exact: true }).tap();
  await ctx.close();
}

try {
  await run('dark', 360);
  await run('light', 390);
  assert.deepEqual(errors, [], `erros: ${errors.join(' | ')}`);
  console.log('OK motivação no ecrã: celebração, retoma, histórico, recorde, Evolução; 360/390, dois temas.');
} finally { await browser.close(); server.close(); }
