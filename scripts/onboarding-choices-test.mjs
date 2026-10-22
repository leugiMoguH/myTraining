/* Acolhimento: equipamento multi-escolha, durações até 120 min, novas zonas e «Nenhuma» — npm run test:onb-choices
   Chromium com toque a 320/360/412, tema escuro e claro. Falha com qualquer erro de consola. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, 'test-results'); mkdirSync(shots, { recursive: true });
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

async function open(width, theme, seed) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([th, sd]) => { try { localStorage.setItem('treino_theme', th); if (sd && !localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify(sd)); } catch (_) {} }, [theme, seed || null]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
}
const body = page => page.locator('#onbBody');
const chip = (page, name) => body(page).getByRole('button', { name, exact: true });
const pressed = async (page, name) => (await chip(page, name).getAttribute('aria-pressed')) === 'true';
const tap = (page, name) => page.locator('#onbBg').getByRole('button', { name, exact: true }).tap();
const draft = page => page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).onb.draft);
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById('onbBody').scrollWidth <= document.getElementById('onbBody').clientWidth + 1);
const toStep = async (page, n) => { for (let i = 0; i < n; i++) await tap(page, 'Continuar'); };
const shot = (page, name, theme, w) => page.screenshot({ path: join(shots, `onb-choices-${name}-${theme}-${w}.png`) });
const OLD = { onb: { done: false, step: 2, draft: { goal: 'forca', days: ['Segunda', 'Quarta', 'Sexta'], mins: 45, exp: 'inicio', place: 'gym', pref: 'livres', limits: [] } } };

try {
  for (const theme of ['dark', 'light']) for (const w of [320, 360, 412]) {
    await test(`${theme} ${w}: durações, equipamento múltiplo, mínimo de uma, «Nenhuma» exclusiva`, async () => {
      const { ctx, page } = await open(w, theme);
      await tap(page, 'Continuar');   /* objetivo (predefinido) → dias */
      await toStep(page, 0);
      /* passo 2: duração */
      for (const m of [30, 45, 60, 90, 120]) assert.equal(await chip(page, `${m} min`).count(), 1, `${m} min existe`);
      await chip(page, '120 min').tap();
      assert.equal(await pressed(page, '120 min'), true);
      assert.equal(await pressed(page, '60 min'), false, 'duração é de escolha única');
      assert.match(await body(page).innerText(), /não aumentamos o treino/);
      assert(await noHScroll(page), 'scroll horizontal nas durações');
      await shot(page, 'duracao', theme, w);
      await tap(page, 'Continuar');
      /* passo 3: equipamento */
      assert.match(await body(page).locator('h1').innerText(), /Como treinas/);
      assert.equal(await body(page).getByRole('group', { name: /Preferes/ }).count(), 1, 'grupo rotulado');
      for (const n of ['Máquinas', 'Pesos livres', 'Peso corporal']) assert.equal(await pressed(page, n), true, `${n} ligado por omissão`);
      await chip(page, 'Máquinas').tap(); await chip(page, 'Pesos livres').tap();
      assert.equal(await pressed(page, 'Máquinas'), false); assert.equal(await pressed(page, 'Pesos livres'), false);
      assert.equal(await pressed(page, 'Peso corporal'), true);
      await chip(page, 'Peso corporal').tap();   /* a última não se desliga */
      assert.equal(await pressed(page, 'Peso corporal'), true, 'ficou sem equipamento');
      assert.match(await page.locator('#ob-eq-err').innerText(), /pelo menos uma/);
      assert.equal(await page.locator('#ob-eq-err').getAttribute('role'), 'alert');
      assert.equal(await body(page).getByRole('group', { name: /Preferes/ }).getAttribute('aria-describedby'), 'ob-eq-err');
      await shot(page, 'equipamento-erro', theme, w);
      await chip(page, 'Máquinas').tap();
      assert.equal(await page.locator('#ob-eq-err').innerText(), '', 'o erro limpa-se ao escolher');
      assert.deepEqual((await draft(page)).equip, ['maq', 'corpo']);
      assert.equal((await draft(page)).pref, 'maq', 'pref acompanha equip[0]');
      /* em casa sem máquinas */
      await chip(page, 'Em casa').tap(); await chip(page, 'Peso corporal').tap();
      assert.match(await body(page).innerText(), /Em casa não há máquinas/);
      await chip(page, 'Peso corporal').tap();   /* volta a ligar */
      assert(await noHScroll(page), 'scroll horizontal no equipamento');
      for (const loc of await chip(page, 'Máquinas').all()) assert((await loc.boundingBox()).height >= 44, 'alvo < 44px');
      await tap(page, 'Continuar');
      /* passo 4: zonas */
      assert.match(await body(page).locator('h1').innerText(), /Algo a evitar/);
      for (const z of ['Nenhuma', 'Joelhos', 'Costas', 'Ombros', 'Ancas', 'Punhos', 'Cotovelos', 'Pescoço']) assert.equal(await chip(page, z).count(), 1, `${z} existe`);
      assert.equal(await pressed(page, 'Nenhuma'), true, 'Nenhuma ligada sem zonas');
      await chip(page, 'Joelhos').tap();
      assert.equal(await pressed(page, 'Nenhuma'), false, 'escolher uma zona desliga Nenhuma');
      for (const z of ['Ancas', 'Punhos', 'Cotovelos', 'Pescoço']) await chip(page, z).tap();
      assert.deepEqual((await draft(page)).limits, ['joelhos', 'ancas', 'punhos', 'cotovelos', 'pescoco']);
      await shot(page, 'zonas', theme, w);
      await chip(page, 'Nenhuma').tap();
      assert.equal(await pressed(page, 'Nenhuma'), true);
      for (const z of ['Joelhos', 'Ancas', 'Punhos', 'Cotovelos', 'Pescoço']) assert.equal(await pressed(page, z), false, `${z} devia desligar com Nenhuma`);
      assert.deepEqual((await draft(page)).limits, []);
      assert(await noHScroll(page), 'scroll horizontal nas zonas');
      await ctx.close();
    });
  }

  await test('escolhas mantidas ao voltar, ao recarregar e na proposta/plano (dados guardados)', async () => {
    const { ctx, page } = await open(390, 'dark');
    await toStep(page, 1); await chip(page, '90 min').tap(); await toStep(page, 1);
    await chip(page, 'Máquinas').tap(); await chip(page, 'Pesos livres').tap();   /* fica só corporal */
    await tap(page, 'Continuar');
    await chip(page, 'Ancas').tap(); await chip(page, 'Punhos').tap();
    await tap(page, 'Voltar');
    assert.equal(await pressed(page, 'Peso corporal'), true); assert.equal(await pressed(page, 'Máquinas'), false);
    await tap(page, 'Voltar');
    assert.equal(await pressed(page, '90 min'), true, 'duração mantida ao voltar');
    await tap(page, 'Continuar'); await tap(page, 'Continuar');
    assert.equal(await pressed(page, 'Ancas'), true, 'zonas mantidas ao avançar de novo');
    await page.reload({ waitUntil: 'networkidle' });
    assert(await page.locator('#onbBg.show').count(), 'o acolhimento devia retomar');
    assert.match(await body(page).locator('h1').innerText(), /Algo a evitar/);
    assert.equal(await pressed(page, 'Punhos'), true, 'zonas mantidas após recarregar');
    const d = await draft(page);
    assert.deepEqual([d.equip, d.mins, d.limits], [['corpo'], 90, ['ancas', 'punhos']]);
    await tap(page, 'Ver a minha proposta');
    await page.getByRole('button', { name: 'Confirmar e começar' }).tap();
    await page.waitForFunction(() => !document.getElementById('onbBg').classList.contains('show'));
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
    assert.deepEqual([st.prefs.equip, st.prefs.pref, st.prefs.mins, st.prefs.limits], [['corpo'], 'corpo', 90, ['ancas', 'punhos']]);
    const ex = Object.values(st.routine).flatMap(r => (r.ex || []).map(e => e.name));
    assert(ex.length > 3, 'plano vazio');
    for (const banned of ['Flexões', 'Flexões inclinadas', 'Prancha', 'Agachamento corporal', 'Leg press', 'Rosca alternada']) assert(!ex.includes(banned), `${banned} desrespeita as zonas escolhidas`);
    assert.match(st.plan.why, /as ancas e os punhos|os punhos e as ancas|ancas/i, 'a explicação devia mencionar as zonas');
    await ctx.close();
  });

  await test('perfil antigo (só pref) abre sem perda: continua válido e editável', async () => {
    const { ctx, page } = await open(390, 'dark', OLD);
    assert(await page.locator('#onbBg.show').count());
    assert.match(await body(page).locator('h1').innerText(), /Como treinas/);
    for (const n of ['Máquinas', 'Pesos livres', 'Peso corporal']) assert.equal(await pressed(page, n), true, `${n} (comportamento antigo: tudo permitido)`);
    assert.equal((await draft(page)).pref, 'livres', 'o campo antigo não se perde antes de editar');
    await chip(page, 'Máquinas').tap();
    const d = await draft(page);
    assert.deepEqual(d.equip, ['livres', 'corpo']); assert.equal(d.pref, 'livres');
    await ctx.close();
  });

  assert.deepEqual(errors, []);
  console.log(`OK — ${count} grupos de testes das escolhas do acolhimento`);
} finally { await browser.close(); await new Promise(r => server.close(r)); }
