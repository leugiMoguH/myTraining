/* Bloco 6: Evolução em separadores (Resumo · Cargas · Corpo), Histórico «Ver todos», Perfil em secções — npm run test:b6b */
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
let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log(`OK ${name}`); };
const DAY = 864e5, T0 = Date.UTC(2026, 9, 1, 10);   /* relógio fixo: 2026-10-26 */

async function open(w, theme, nWorkouts = 14) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 1000, isMobile: w < 1000, colorScheme: theme, serviceWorkers: 'block', timezoneId: 'Europe/Lisbon' });
  await ctx.addInitScript(th => { try { localStorage.setItem('treino_theme', th); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) { /* sem storage */ } }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.clock.install({ time: new Date('2026-10-26T10:00:00') });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async ([n, T0, DAY]) => {
    const { ST, save } = await import('./js/state.js');
    ST.log = { 'Leg press': [{ date: '2026-09-10', ts: 1, w: 100, r: 8, sets: [{ w: 100, r: 8, ts: 1 }] }, { date: '2026-09-17', ts: 2, w: 110, r: 8, sets: [{ w: 110, r: 8, ts: 2 }] }] };
    ST.measures = [{ date: '2026-09-01', ts: '2026-09-01T08:00:00.000Z', weight: 80 }, { date: '2026-09-20', ts: '2026-09-20T08:00:00.000Z', weight: 79 }];
    ST.workouts = Array.from({ length: n }, (_, k) => { const d = new Date(T0 + k * DAY); return { id: 'w' + k, label: 'Treino', day: 'Segunda', state: 'COMPLETED', date: d.toISOString().slice(0, 10), wk: '', startedAt: d.getTime(), endedAt: d.getTime() + 3000000, pausedMs: 0, confirmedMs: 2400000, pos: 0 }; });
    save(); window.render('__hoje');
  }, [nWorkouts, T0, DAY]);
  return { ctx, page };
}
const view = page => page.evaluate(async () => (await import('./js/state.js')).ST.view);
const selected = page => page.locator('.ev-tab[aria-selected="true"]').innerText();
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

try {
  await test('Evolução: 3 separadores com ARIA, teclado e conteúdo certo em cada um', async () => {
    const { ctx, page } = await open(390, 'dark');
    await page.evaluate(() => window.render('__perfil'));
    assert.equal(await page.locator('[role=tablist] [role=tab]').count(), 3);
    assert.equal(await selected(page), 'Resumo');
    assert.equal(await page.locator('[role=tabpanel]').count(), 1);
    assert(/conquistas/i.test(await page.locator('#content').innerText()), 'Resumo mostra conquistas');
    assert.equal(await page.locator('.hx-row').count(), 0, 'cargas não estão no Resumo');
    await page.getByRole('tab', { name: 'Cargas' }).tap();
    assert.equal(await selected(page), 'Cargas');
    assert((await page.locator('.hx-row').count()) >= 1, 'recordes por exercício');
    assert.equal(await page.locator('.vol').count(), 1, 'volume nas Cargas');
    await page.getByRole('tab', { name: 'Corpo' }).tap();
    assert.equal(await page.locator('#m-form').count(), 1, 'medidas no Corpo');
    assert.equal(await page.locator('#mmap').count(), 1, 'mapa muscular no Corpo');
    await page.locator('.ev-tab[aria-selected="true"]').focus();
    await page.keyboard.press('ArrowRight'); assert.equal(await selected(page), 'Resumo', 'ArrowRight dá a volta');
    await page.keyboard.press('ArrowLeft'); assert.equal(await selected(page), 'Corpo');
    await page.keyboard.press('Home'); assert.equal(await selected(page), 'Resumo');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'evt-resumo', 'foco acompanha o separador');
    await ctx.close();
  });

  await test('separador lembra-se ao ir ao Histórico e voltar; Histórico a 1 toque de cada separador e 2 a partir de Mais', async () => {
    const { ctx, page } = await open(390, 'light');
    await page.evaluate(() => window.render('__perfil'));
    for (const t of ['Resumo', 'Cargas', 'Corpo']) {
      await page.getByRole('tab', { name: t }).tap();
      await page.locator('.ev-link').first().tap();
      assert.equal(await view(page), '__hist', `Histórico a partir de ${t}`);
      await page.locator('#bnav').getByText('Evolução').tap();
      assert.equal(await selected(page), t, `volta ao separador ${t}`);
    }
    await page.locator('#bnav').getByText('Mais').tap();
    await page.locator('#sheetBg').getByRole('button', { name: /Histórico/ }).tap();
    assert.equal(await view(page), '__hist', 'Mais → Histórico (2 toques)');
    await ctx.close();
  });

  await test('Histórico: 10 recentes + «Ver todos (N)» sem alterar os dados guardados', async () => {
    const { ctx, page } = await open(390, 'dark', 14);
    const before = await page.evaluate(async () => JSON.stringify((await import('./js/state.js')).ST.workouts));
    await page.evaluate(() => window.render('__hist'));
    assert.equal(await page.locator('.cu-title:has-text("Treinos recentes") + .week-list > .wk-row').count(), 10);
    const more = page.locator('details.ev-more summary');
    assert.match(await more.innerText(), /Ver todos \(14\)/);
    assert.equal(await page.locator('details.ev-more .wk-row').count(), 4);
    await more.tap();
    assert.equal(await page.locator('details.ev-more').evaluate(e => e.open), true);
    assert.equal(await page.evaluate(async () => JSON.stringify((await import('./js/state.js')).ST.workouts)), before, 'ST.workouts intacto');
    const texts = await page.locator('.wk-row-day').allInnerTexts();
    assert.equal(new Set(texts.filter(t => /\d\d\/\d\d\/\d{4}/.test(t))).size, 14, 'sem duplicados: 14 datas distintas');
    await ctx.close();
    const few = await open(390, 'dark', 3);
    await few.page.evaluate(() => window.render('__hist'));
    assert.equal(await few.page.locator('details.ev-more').count(), 0, 'com poucos registos não há «Ver todos»');
    await few.ctx.close();
  });

  await test('Perfil: secções recolhidas com resumo; abre sozinha só o que pede ação; mantém o que o utilizador abriu', async () => {
    const { ctx, page } = await open(390, 'dark');
    await page.evaluate(() => window.render('__eu'));
    const secs = page.locator('details.pf-sec');
    assert.equal(await secs.count(), 3);
    assert.equal(await page.locator('#pf-basic').evaluate(e => e.open), true, 'dados em falta → Dados básicos aberto');
    assert.equal(await page.locator('#pf-nutri').evaluate(e => e.open), false);
    await page.fill('#p-age', '41'); await page.fill('#p-height', '178');
    await page.locator('#p-sex').selectOption('m'); await page.locator('#p-activity').selectOption('mod');
    await page.getByRole('button', { name: 'Guardar dados' }).tap();
    await page.evaluate(() => { window.render('__hoje'); window.render('__eu'); });
    assert.equal(await page.locator('#pf-basic').evaluate(e => e.open), false, 'completo → recolhido');
    assert.match(await page.locator('#pf-basic summary').innerText(), /41 anos · 178 cm/);
    assert.equal(await page.locator('#pf-prefs').evaluate(e => e.open), true, 'sem plano → preferências abertas (pedem ação)');
    await page.locator('#pf-prefs summary').tap();
    assert.equal(await page.locator('#pf-prefs').evaluate(e => e.open), false, 'o utilizador fecha');
    await page.locator('#pf-basic summary').tap();
    await page.fill('#p-age', '42');
    await page.getByRole('button', { name: 'Descartar rascunho' }).tap();
    assert.equal(await page.locator('#pf-basic').evaluate(e => e.open), true, 'secção aberta pelo utilizador mantém-se');
    assert.equal(await page.inputValue('#p-age'), '41');
    await ctx.close();
  });

  await test('dados intactos ao percorrer separadores e Perfil', async () => {
    const { ctx, page } = await open(360, 'light');
    const snap = () => page.evaluate(async () => { const { ST } = await import('./js/state.js'); return JSON.stringify({ l: ST.log, m: ST.measures, w: ST.workouts, s: ST.sessions }); });
    const before = await snap();
    await page.evaluate(() => window.render('__perfil'));
    for (const t of ['Cargas', 'Corpo', 'Resumo']) await page.getByRole('tab', { name: t }).tap();
    await page.evaluate(() => { window.render('__eu'); window.render('__hist'); window.render('__perfil'); });
    assert.equal(await snap(), before);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await snap(), before, 'persiste após reload');
    await ctx.close();
  });

  for (const [w, theme] of [[320, 'dark'], [360, 'light'], [390, 'dark'], [412, 'light'], [1280, 'dark'], [1280, 'light']]) {
    await test(`visual ${w}px ${theme}: separadores, Histórico e Perfil sem overflow, alvos ≥44px, sem sobreposição`, async () => {
      const { ctx, page } = await open(w, theme);
      const check = async label => {
        assert.equal(await overflow(page), false, `${label}: scroll horizontal`);
        const small = await page.evaluate(() => [...document.querySelectorAll('#content button, #content summary, #content [role=tab]')].filter(e => e.getClientRects().length && !e.closest('details:not([open])') || e.tagName === 'SUMMARY').filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.h < 44 && !/^[✎✕]$/.test(r.t)));
        assert.deepEqual(small, [], `${label}: alvos <44px`);
      };
      await page.evaluate(() => window.render('__perfil'));
      for (const t of ['Resumo', 'Cargas', 'Corpo']) {
        await page.getByRole('tab', { name: t }).click();
        await check(`Evolução/${t}`);
        const tabs = await page.locator('.ev-tab').evaluateAll(es => es.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
        assert(tabs.every((a, i) => i === 0 || a[0] >= tabs[i - 1][1] - 1), 'separadores sobrepostos');
      }
      await page.evaluate(() => window.render('__hist')); await check('Histórico');
      await page.locator('details.ev-more summary').click(); await check('Histórico (todos)');
      await page.evaluate(() => window.render('__eu')); await check('Perfil');
      await ctx.close();
    });
  }

  assert.deepEqual(errors, [], `erros: ${errors.join(' | ')}`);
  console.log(`OK — ${count} grupos do Bloco 6 (Evolução e Perfil)`);
} finally {
  await browser.close(); server.close();
}
