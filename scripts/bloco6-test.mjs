/* Bloco 6: Plano / Perfil / Evolução — navegação, edição, rascunhos, dados intactos, sessão viva, visual — npm run test:b6 */
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
let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log(`OK ${name}`); };
const WIDE = process.env.B6_SHOTS === '1';

const PREFS = { goal: 'forca', days: ['Segunda', 'Quarta', 'Sexta'], mins: 60, exp: 'regular', place: 'gym', equip: ['maq', 'livres'], limits: ['ombros'], name: 'Rita' };
const LOG = (n, d, w, r) => [n, [{ date: d, ts: Date.parse(d), w, r, sets: [{ w, r, ts: Date.parse(d), k: 'x:0' }] }]];

async function open(w = 390, theme = 'dark', { plan = true, logs = 9 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 1000, isMobile: w < 1000, serviceWorkers: 'allow' });
  await ctx.addInitScript(th => { try { localStorage.setItem('treino_theme', th); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) { /* sem storage */ } }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async ([prefs, plan, logs, LOGS]) => {
    const { ST, save } = await import('./js/state.js');
    if (plan) {
      const { applyPlan } = await import('./js/plan.js'); const { normalizePrefs, proposePlan } = await import('./js/planner.js');
      const r = applyPlan(proposePlan(normalizePrefs(prefs)), { reason: 'teste' }); if (!r.ok) throw new Error(r.error);
    }
    const names = ['Leg press', 'Supino na máquina', 'Puxada alta', 'Remada sentado', 'Stiff', 'Passada', 'Prancha', 'Panturrilha', 'Elevação lateral'].slice(0, logs);
    ST.log = Object.fromEntries(names.map((n, i) => [n, [{ date: `2026-09-${10 + i}`, ts: 1790000000000 + i, w: 20 + i, r: 8, sets: [{ w: 20 + i, r: 8, ts: 1790000000000 + i }] }]]));
    ST.measures = [{ date: '2026-09-01', ts: '2026-09-01T08:00:00.000Z', weight: 80 }, { date: '2026-09-20', ts: '2026-09-20T08:00:00.000Z', weight: 79 }];
    save(); window.render('__hoje');
  }, [PREFS, plan, logs, null]);
  return { ctx, page };
}
const rects = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length > 0 && !(e.closest('details:not([open])') && e.tagName !== 'SUMMARY')).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, t: (e.textContent || '').trim().slice(0, 30) }; }), sel);
const overlap = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
const view = page => page.evaluate(async () => (await import('./js/state.js')).ST.view);
const st = (page, f) => page.evaluate(async src => { const { ST } = await import('./js/state.js'); return new Function('ST', `return (${src})(ST)`)(ST); }, f.toString());
const sheetTo = async (page, label) => { await page.locator('#bnav').locator('[data-day="opts"]').tap(); await page.locator('.sheet-item', { hasText: label }).first().tap(); };
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

try {
  await test('navegação: Hoje, Opções → Plano/Perfil, Evolução; 5 destinos fixos; regresso consistente', async () => {
    const { ctx, page } = await open(390);
    assert.equal(await page.locator('#bnav .nb').count(), 5);
    await page.locator('.hero-links .linklike[onclick*="__plano"], .today-plan-link').tap();
    assert.equal(await view(page), '__plano'); assert.match(await page.locator('#hdrSub').textContent(), /Plano/);
    await page.locator('.hx-back').tap(); assert.equal(await view(page), '__hoje');
    await sheetTo(page, 'Plano'); assert.equal(await view(page), '__plano');
    assert.equal(await page.locator('#bnav .nb.active').getAttribute('data-day'), 'opts', 'Plano/Perfil assinalam Opções');
    assert.equal(await page.locator('#sheetBg.show').count(), 0, 'a folha devia fechar');
    await sheetTo(page, 'Perfil'); assert.equal(await view(page), '__eu'); assert.match(await page.locator('#hdrSub').textContent(), /Perfil/);
    await page.locator('#bnav').getByText('Evolução').tap(); assert.equal(await view(page), '__perfil');
    assert.equal(await page.locator('#p-height').count(), 0, 'Evolução não devia ter o formulário de Perfil');
    assert.equal(await page.locator('.ob-plan').count(), 0, 'Evolução não devia ter a gestão do plano');
    assert.equal(await page.locator('#bnav .nb.active').getAttribute('data-day'), '__perfil');
    await page.locator('.ev-link').filter({hasText:'Histórico'}).tap();
    assert.equal(await page.locator('.hx-row').count(), 0, 'a lista por exercício saiu do Histórico');
    await page.locator('.ev-link').tap(); assert.equal(await view(page), '__perfil');
    await ctx.close();
  });

  await test('Evolução: exercícios (8 + ver todos), medidas com registo recolhido, mapa e volume; abrir/voltar à origem', async () => {
    const { ctx, page } = await open(390);
    await page.evaluate(() => window.render('__perfil'));
    assert.equal(await page.locator('.ev-list .hx-row').count(), 9);
    assert.equal(await page.locator('.nutri-wrap > .week-list .hx-row').count(), 8, '8 visíveis');
    assert.equal(await page.locator('details.ev-more:has(.hx-row)').count(), 1);
    assert(await page.locator('#m-form').evaluate(e => !e.open), 'registo de medidas recolhido por omissão');
    assert.equal(await page.locator('#mmap').count(), 1); assert.equal(await page.locator('.vol').count(), 1);
    await page.locator('.hx-row').first().tap();
    assert.equal(await view(page), '__ex');
    assert.equal(await page.locator('#bnav .nb.active').getAttribute('data-day'), '__perfil');
    await page.locator('.hx-back').tap(); assert.equal(await view(page), '__perfil');
    /* aberto a partir de um cartão (Hoje) volta ao Hoje */
    await page.evaluate(() => { window.render('__hoje'); window.hxOpen('Leg press'); });
    await page.locator('.hx-back').tap(); assert.equal(await view(page), '__hoje');
    await ctx.close();
  });

  await test('Plano: 7 dias, exercícios por dia, editar e gravar, regresso, histórico intacto', async () => {
    const { ctx, page } = await open(390);
    await page.evaluate(() => window.render('__plano'));
    assert.equal(await page.locator('.pl-day').count(), 3); assert.equal(await page.locator('.wk-row.s-rest').count(), 4);
    assert.match(await page.locator('.ob-plan').innerText(), /todos os dados/i);
    const logBefore = await st(page, S => JSON.stringify(S.log));
    const d0 = page.locator('.pl-day').first(); await d0.locator('summary').tap();
    assert((await d0.locator('li').count()) >= 3);
    const day = await d0.getAttribute('data-day');
    await d0.getByRole('button', { name: /Editar/ }).tap();
    assert.equal(await view(page), '__dia'); assert(await page.locator('.ed-btn, .ed-del, .ed-row').count() > 0, 'modo de edição');
    assert.match(await page.locator('.hx-back').textContent(), /Plano/);
    await page.evaluate(d => window.edField(d, 0, 's', 5), day);
    assert.equal(await st(page, S => S.routine[Object.keys(S.routine).find(k => S.routine[k].ex.length)].ex[0].s), 5, 'gravou');
    await page.locator('.hx-back').tap();
    assert.equal(await view(page), '__plano');
    assert.match(await page.locator('.pl-day').first().locator('summary').innerText(), new RegExp(day));
    await page.locator('.pl-day').first().locator('summary').tap();
    assert.match(await page.locator('.pl-day').first().locator('li').first().innerText(), /5×/);
    assert.equal(await st(page, S => JSON.stringify(S.log)), logBefore, 'histórico de cargas intacto');
    await page.evaluate(() => window.render('Segunda'));
    assert.equal(await page.locator('.hx-back').count(), 0, 'sem origem, sem botão de regresso');
    assert(!(await page.evaluate(async () => (await import('./js/editor.js')).isEditing('Segunda'))), 'a edição não fica ligada');
    await ctx.close();
  });

  await test('Perfil: preferências lidas de ST.prefs, Alterar abre o passo certo, retoma e descarta; sem novas perguntas', async () => {
    const { ctx, page } = await open(390);
    await page.evaluate(() => window.render('__eu'));
    const txt = await page.locator('.pf-list').innerText();
    for (const t of [/Objetivo de treino/, /Seg, Qua, Sex · até 60 min/, /Já treino/, /Ginásio · Máquinas, Pesos livres/, /Ombros/, /Rita/]) assert.match(txt, t);
    assert.equal(await page.locator('#p-sex, #p-age, #p-height, #p-goal, #p-activity').count(), 5, 'dados pessoais existentes');
    await page.getByRole('button', { name: 'Alterar: Disponibilidade' }).tap();
    assert.match(await page.locator('#onbBody h1').innerText(), /Quando consegues treinar/);
    await page.locator('#onbBody').getByRole('button', { name: 'Qui' }).tap();
    await page.locator('#onbBody').getByRole('button', { name: 'Continuar' }).tap();
    await page.reload({ waitUntil: 'networkidle' });                        /* o rascunho sobrevive a recarregar */
    assert.equal(await page.locator('#onbBg.show').count(), 0);
    await page.evaluate(() => window.render('__eu'));
    assert.match(await page.locator('#content').innerText(), /alterações por concluir/);
    await page.getByRole('button', { name: 'Continuar', exact: true }).first().tap();
    assert.match(await page.locator('#onbBody h1').innerText(), /Como treinas/, 'retomou no passo guardado');
    await page.locator('#onbBody').getByRole('button', { name: 'Voltar' }).tap();
    assert.equal(await page.locator('#onbBody .ob-days .on').count(), 4, 'o dia acrescentado mantém-se');
    const plan0 = await st(page, S => JSON.stringify([S.routine, S.prefs, S.plan]));
    await page.locator('#onbBody').getByRole('button', { name: 'Voltar' }).tap();
    await page.locator('#onbBody').getByRole('button', { name: 'Cancelar' }).tap();   /* cancelar descarta e não toca no plano */
    assert.equal(await st(page, S => JSON.stringify([S.routine, S.prefs, S.plan])), plan0, 'cancelar não muda o plano');
    assert.equal(await st(page, S => !!S.onb.editing), false);
    await page.evaluate(() => window.render('__eu'));
    assert.doesNotMatch(await page.locator('#content').innerText(), /alterações por concluir/);
    await ctx.close();
  });

  await test('rascunhos: dados pessoais e medida nova sobrevivem à navegação; guardar limpa só o seu', async () => {
    const { ctx, page } = await open(390);
    await page.evaluate(() => window.render('__eu'));
    await page.fill('#p-age', '41'); await page.fill('#p-height', '178');
    await page.locator('#bnav').getByText('Evolução').tap();
    await page.locator('#m-form summary').tap(); await page.fill('#m-weight', '77.5');
    await sheetTo(page, 'Plano');
    await page.locator('#bnav').getByText('Evolução').tap();
    assert.equal(await page.inputValue('#m-weight'), '77.5'); assert(await page.locator('#m-form').evaluate(e => e.open), 'a secção reabre com rascunho');
    await sheetTo(page, 'Perfil');
    assert.equal(await page.inputValue('#p-age'), '41'); assert.equal(await page.inputValue('#p-height'), '178');
    await page.getByRole('button', { name: 'Guardar dados', exact: true }).tap();
    assert.equal(await st(page, S => S.profile.height), 178);
    await page.locator('#bnav').getByText('Evolução').tap();
    assert.equal(await page.inputValue('#m-weight'), '77.5', 'guardar o perfil não apaga o rascunho da medida');
    await page.getByRole('button', { name: 'Registar medidas de hoje' }).tap();
    assert.equal(await view(page), '__perfil', 'guardar medida fica na Evolução');
    assert.equal(await st(page, S => S.measures.length), 3);
    assert.equal(await page.locator('#m-form').evaluate(e => e.open), false);
    /* editar um registo: formulário e rascunho próprios */
    await page.locator('#m-form summary').tap(); await page.fill('#m-weight', '66.6');   /* rascunho de medida nova */
    await page.locator('#m-hist summary').tap(); await page.locator('.iitem-x[aria-label="Editar registo"]').last().tap();   /* o registo mais antigo */
    assert.equal(await view(page), '__perfil'); assert(await page.locator('#m-form').evaluate(e => e.open));
    assert.equal(await page.inputValue('#m-weight'), await st(page, S => String(S.measures[0].weight)), 'o rascunho da medida nova não contamina o registo antigo');
    await page.getByRole('button', { name: /Cancelar edição/ }).tap();
    assert.equal(await page.inputValue('#m-weight'), '66.6', 'o rascunho da medida nova volta depois de cancelar a edição');
    await page.locator('#bnav').getByText('Hoje').tap();
    await ctx.close();
  });

  await test('histórico, medidas, perfil e plano intactos ao navegar por tudo; exportação inclui tudo; importar limpa rascunhos', async () => {
    const { ctx, page } = await open(390);
    const snap = () => st(page, S => JSON.stringify({ log: S.log, measures: S.measures, profile: S.profile, routine: S.routine, prefs: S.prefs, workouts: S.workouts }));
    const before = await snap();
    for (const v of ['__plano', '__eu', '__perfil', '__hist', '__nutri', '__hoje', '__ex']) await page.evaluate(x => window.render(x), v);
    assert.equal(await snap(), before);
    const out = await page.evaluate(async () => { const { ST } = await import('./js/state.js'); return JSON.stringify({ log: Object.keys(ST.log).length, m: ST.measures.length }); });
    assert.deepEqual(JSON.parse(out), { log: 9, m: 2 });
    /* rascunho + importação: o valor antigo não pode sobrepor-se aos dados repostos */
    await page.evaluate(() => window.render('__eu')); await page.fill('#p-age', '99');
    const payload = await page.evaluate(async () => { const { ST } = await import('./js/state.js'); return JSON.stringify({ app: 'treino', v: 2, state: { ...ST, profile: { sex: 'm', age: 30, height: 170, goal: 'manter', activity: 'mod' } } }); });
    await page.setInputFiles('#importFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await page.locator('.app-dialog-actions button', { hasText: 'Importar' }).first().tap();
    await page.waitForFunction(() => document.querySelector('#notice.show'));
    await page.evaluate(() => window.render('__eu'));
    assert.equal(await page.inputValue('#p-age'), '30');
    /* exportação real: o ficheiro descarregado leva o estado todo */
    await page.locator('#bnav').locator('[data-day="opts"]').tap();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.sheet-item', { hasText: 'Exportar backup de tudo' }).tap()]);
    const exp = JSON.parse(readFileSync(await dl.path(), 'utf8'));
    assert.equal(exp.app, 'treino'); assert.equal(Object.keys(exp.state.log).length, 9); assert.equal(exp.state.measures.length, 2);
    assert(exp.state.routine && exp.state.prefs && exp.state.plan && exp.state.profile, 'plano, preferências e perfil exportados');
    await ctx.close();
  });

  await test('sessão em curso: navegar por todos os ecrãs preserva-a; Plano não a rompe', async () => {
    const { ctx, page } = await open(390);
    await page.evaluate(async () => { const { startSession } = await import('./js/session.js'); const { ST } = await import('./js/state.js'); startSession(Object.keys(ST.routine).find(k => ST.routine[k].ex.length), 'x'); });
    const id0 = await st(page, S => S.session.id);
    for (const v of ['__plano', '__eu', '__semana', '__perfil', '__hist', '__nutri', '__hoje']) {
      await page.evaluate(x => window.render(x), v);
      assert.equal(await st(page, S => S.session.id), id0); assert.equal(await page.locator('#navLive').isVisible(), true, `faixa de treino em ${v}`);
      const ov = await rects(page, '#navLive, #navRow'); assert(ov.length === 2 && !overlap(ov[0], ov[1]), 'faixa e barra');
    }
    await page.evaluate(() => window.render('__plano'));
    await page.locator('.pl-day').first().locator('summary').tap();
    await page.locator('.pl-day').first().getByRole('button', { name: /Editar/ }).tap();
    assert.equal(await st(page, S => S.session.id), id0); await page.locator('.hx-back').tap();
    /* sair do dia por outra via (Plano → Editar → Início → o dia) não deixa a edição ligada */
    await page.evaluate(d => window.planEdit(d), await page.locator('.pl-day').first().getAttribute('data-day'));
    await page.evaluate(() => window.render('__hoje'));
    assert.equal(await page.evaluate(async () => { const { ST } = await import('./js/state.js'); return (await import('./js/editor.js')).isEditing(Object.keys(ST.routine).find(k => ST.routine[k].ex.length)); }), false);
    /* aplicar um plano novo com treino em curso continua recusado (proteção existente) */
    const r = await page.evaluate(async () => { const { applyPlan } = await import('./js/plan.js'); const { normalizePrefs, proposePlan } = await import('./js/planner.js'); return applyPlan(proposePlan(normalizePrefs({})), {}).ok; });
    assert.equal(r, false);
    await ctx.close();
  });

  await test('offline: o service worker serve os novos ecrãs', async () => {
    const { ctx, page } = await open(390);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    for (const v of ['__plano', '__eu', '__perfil']) { await page.evaluate(x => window.render(x), v); assert(await page.locator('#content').innerText().then(t => t.length > 50), v); }
    assert((await page.evaluate(() => caches.keys())).includes('treino-v50'));
    await ctx.setOffline(false);
    await ctx.close();
  });

  for (const [w, theme] of [[320, 'dark'], [360, 'light'], [390, 'dark'], [412, 'light'], [1280, 'dark'], [1280, 'light']]) {
    await test(`visual ${theme} ${w}: Plano, Perfil, Evolução, Hoje sem sobreposição, sem scroll horizontal, alvos ≥44px`, async () => {
      const { ctx, page } = await open(w, theme);
      for (const [v, name] of [['__hoje', 'hoje'], ['__plano', 'plano'], ['__eu', 'perfil'], ['__perfil', 'evolucao']]) {
        await page.evaluate(x => window.render(x), v);
        if (v === '__plano') await page.locator('.pl-day summary').first().click();
        if (v === '__perfil') await page.locator('#m-form summary').click();
        assert(await noHScroll(page), `${v}: scroll horizontal`);
        const small = (await rects(page, '#content button, #content summary, #content .linklike, #content select, #content input:not([type=hidden])')).filter(r => r.h < 43.5);
        assert.deepEqual(small.map(s => `${s.t}:${Math.round(s.h)}`), [], `${v}: alvos <44px`);
        const bs = await rects(page, '#content button, #content summary, #content input, #content select');
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) assert(!overlap(bs[i], bs[j]), `${v}: sobreposição ${bs[i].t} / ${bs[j].t}`);
        if (WIDE) await page.screenshot({ path: join(SHOTS, `bloco6-${name}-${theme}-${w}.png`), fullPage: process.env.B6_FULL === '1' });
      }
      await ctx.close();
    });
  }

  assert.deepEqual(errors, []);
  console.log(`OK — ${count} grupos do Bloco 6`);
} finally { await browser.close(); server.close(); }
