/* Descanso e navegação: posições reais, controlos acessíveis, transições — npm run test:rest
   Mede retângulos e testa o que está realmente à frente de cada controlo (elementFromPoint); ausência de scroll horizontal não chega. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(root, 'test-results', 'rest'); mkdirSync(SHOTS, { recursive: true });
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
const SIZES = [[320, 640, 'dark'], [360, 740, 'dark'], [360, 740, 'light'], [390, 780, 'light'], [390, 780, 'dark'], [412, 860, 'light'], [1280, 800, 'dark']];
const TAG = process.env.REST_TAG || 'depois';

/* o que está realmente à frente do centro do elemento: o próprio (ou um descendente) ⇒ não está tapado */
const probe = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s);
  if (!e || !e.getClientRects().length) return { ok: false, why: 'ausente/oculto' };
  const b = e.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  const inside = b.left >= -0.5 && b.right <= vw + 0.5 && b.top >= -0.5 && b.bottom <= vh + 0.5;
  const pts = [[b.left + b.width / 2, b.top + b.height / 2], [b.left + 6, b.top + 6], [b.right - 6, b.bottom - 6]];
  const covered = pts.filter(([x, y]) => { const t = document.elementFromPoint(x, y); return !(t && (t === e || e.contains(t))); }).length;
  return { ok: inside && covered === 0, inside, covered, rect: { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height) } };
}, sel);
const rectOf = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; }, sel);
const overlap = (a, b) => !!a && !!b && a.t < b.b - 0.5 && b.t < a.b - 0.5 && a.l < b.r - 0.5 && b.l < a.r - 0.5;
const st = (page, f) => page.evaluate(async src => { const { ST } = await import('./js/state.js'); return new Function('ST', `return (${src})(ST)`)(ST); }, f.toString());
const timerLeft = page => page.evaluate(async () => { const T = await import('./js/timer.js'); return T.TM ? T.TM.left : null; });

async function open(width, height, theme) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 800, isMobile: width < 800 });
  await ctx.addInitScript(th => { try { localStorage.setItem('treino_theme', th); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) {} }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { errors.push(`Diálogo nativo: ${d.message()}`); d.dismiss(); });
  await page.clock.install({ time: new Date('2026-10-19T12:00:00') });   /* Segunda */
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async prefs => {
    const { applyPlan } = await import('./js/plan.js'); const { normalizePrefs, proposePlan } = await import('./js/planner.js');
    const r = applyPlan(proposePlan(normalizePrefs(prefs)), { reason: 'teste' }); if (!r.ok) throw new Error(r.error);
    window.render('__hoje');
  }, PREFS);
  return { ctx, page };
}
const tap = (page, loc) => (page.viewportSize().width < 800 ? loc.tap() : loc.click());

async function run([w, h, theme]) {
  const tag = `${theme}-${w}x${h}`;
  const where = m => `${tag}: ${m}`; if (process.env.REST_V) console.log('→', tag);
  const { ctx, page } = await open(w, h, theme);
  const shot = n => page.screenshot({ path: join(SHOTS, `${TAG}-${tag}-${n}.png`) });

  /* 1. descanso no guiado: tudo à vista, nada tapado nem sobreposto */
  await page.evaluate(async () => { (await import('./js/workout.js')).startWorkout('Segunda'); });
  await page.locator('.wo-main').first().waitFor();
  await page.fill('#wo-w', '40'); await page.fill('#wo-r', '8');
  await page.waitForTimeout(450);   /* protecção de duplo toque do guiado (400 ms) */
  await tap(page, page.locator('.wo-main').first());
  await page.locator('#woRest:not([hidden])').waitFor();
  await shot('guiado');
  for (const sel of ['.wo-bar button:first-child', '.wo-pause', '#woRest .wo-rest-num', '#woRest button:nth-of-type(1)', '#woRest button:nth-of-type(2)', '#woRest .wo-rest-next', '#wo-w', '#wo-r', '.wo-dock .wo-main']) {
    const p = await probe(page, sel);
    assert.ok(p.ok, where(`${sel} tapado/fora do ecrã: ${JSON.stringify(p)}`));
  }
  const rBtns = await page.evaluate(() => [...document.querySelectorAll('#woRest button')].map(b => Math.round(b.getBoundingClientRect().height)));
  assert.ok(rBtns.length === 2 && rBtns.every(x => x >= 44), where(`alvos do descanso pequenos: ${rBtns}`));
  const [bar, rest, dock, scroll] = await Promise.all(['.wo-bar', '#woRest', '.wo-dock', '.wo-scroll'].map(s => rectOf(page, s)));
  assert.ok(!overlap(bar, rest) && !overlap(rest, dock) && !overlap(bar, dock), where('barra, descanso e dock sobrepostos'));
  assert.ok(rest.b <= dock.t + 0.5 && rest.t >= bar.b - 0.5, where('o descanso tem de ficar entre a barra e o dock'));
  assert.ok(scroll.b <= rest.t + 0.5, where('o descanso não pode estar dentro da zona com scroll'));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), where('scroll horizontal'));
  const numPx = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#woRest .wo-rest-num')).fontSize));
  assert.ok(numPx >= 32, where(`tempo pouco legível: ${numPx}px`));
  const title = await probe(page, '.wo-name');   /* nome do exercício continua visível durante o descanso */
  assert.ok(title.ok, where(`nome do exercício tapado: ${JSON.stringify(title)}`));
  const setsBefore = await st(page, s => JSON.stringify(s.sets));

  /* 2. +30 s e Saltar */
  const t0 = await timerLeft(page);
  await tap(page, page.locator('#woRest button', { hasText: '+30' }));
  const t1 = await timerLeft(page);
  assert.ok(t1 >= t0 + 29, where(`+30 s não acrescentou: ${t0} → ${t1}`));
  await tap(page, page.locator('#woRest button', { hasText: 'Saltar' }));
  await page.locator('#woRest[hidden]').waitFor({ state: 'attached' });
  assert.equal(await st(page, s => JSON.stringify(s.sets)), setsBefore, where('séries intactas após Saltar'));
  assert.equal(await page.evaluate(() => localStorage.getItem('rest_timer')), null, where('o descanso saltado não deixa temporizador'));

  /* 3. nova série ⇒ novo descanso; chega a zero sozinho */
  await page.waitForTimeout(450);   /* protecção de duplo toque do guiado (400 ms) */
  await tap(page, page.locator('.wo-main').first());
  await page.locator('#woRest:not([hidden])').waitFor();
  assert.equal(await st(page, s => Object.values(s.sets).flat().length), 2, where('duas séries marcadas'));
  await page.clock.runFor(65000);
  await page.locator('#woRest[hidden]').waitFor({ state: 'attached' });
  assert.equal(await st(page, s => Object.values(s.sets).flat().length), 2, where('o fim do descanso não mexe nas séries'));

  /* 4. descanso ativo + Sair: banner, faixa «Em curso» e barra sem sobreposições; Abrir regressa ao mesmo descanso */
  await page.waitForTimeout(450);   /* protecção de duplo toque do guiado (400 ms) */
  await tap(page, page.locator('.wo-main').first());
  await page.locator('#woRest:not([hidden])').waitFor();
  await tap(page, page.locator('.wo-bar button').first());          /* ‹ Sair */
  await page.locator('#timerBanner.show').waitFor();
  await shot('fora');
  for (const sel of ['#timerBanner .t-btn.plus', '#timerBanner .t-btn:last-of-type', '#navLive', '#navPause', '#bnav .nb[data-day="__perfil"]', '#bnav .nb[data-day="__semana"]']) {
    const p = await probe(page, sel);
    assert.ok(p.ok, where(`${sel} tapado/fora do ecrã (fora do guiado): ${JSON.stringify(p)}`));
  }
  const [banner, live, fab, nav] = await Promise.all(['#timerBanner', '#navLive', '#navPause', '#bnav'].map(s => rectOf(page, s)));
  assert.ok(!overlap(live, fab), where(`o botão central invade a faixa «Em curso»: ${JSON.stringify({ live, fab })}`));
  assert.ok(!overlap(banner, nav), where('banner e barra inferior sobrepostos'));
  const content = await page.evaluate(() => { const c = document.getElementById('content'); const last = [...c.children].pop(); return last ? { pb: parseFloat(getComputedStyle(c).paddingBottom) } : null; });
  assert.ok(content && content.pb >= nav.b - nav.t - 4 + 0, where('o conteúdo tem de poder ir acima da barra'));
  const left1 = await timerLeft(page);
  await tap(page, page.locator('#bnav .nb[data-day="__perfil"]'));  /* navegar com descanso ativo */
  assert.equal(await st(page, s => s.view), '__perfil');
  assert.ok((await timerLeft(page)) > 0 && (await page.locator('#timerBanner.show').count()) === 1, where('o descanso sobrevive à navegação, sem banners duplicados'));
  assert.equal(await page.evaluate(() => document.querySelectorAll('#timerBanner').length), 1);
  await tap(page, page.locator('#navLive'));                         /* Abrir */
  await page.locator('#woRest:not([hidden])').waitFor();
  const left2 = await timerLeft(page);
  assert.ok(left2 <= left1 && left2 > 0, where(`o descanso devia continuar (${left1} → ${left2})`));
  assert.equal(await st(page, s => Object.values(s.sets).flat().length), 3, where('séries intactas ao regressar'));

  /* 5. diálogo durante o descanso: por cima e sem perder nada */
  await tap(page, page.locator('.wo-end'));
  await page.locator('.app-dialog').waitFor();
  const dlg = await probe(page, '.app-dialog .btn-ghost, .app-dialog button');
  assert.ok(dlg.ok, where(`diálogo tapado: ${JSON.stringify(dlg)}`));
  await page.locator('.app-dialog button', { hasText: /Cancelar|Voltar|Não/ }).first().click();
  await page.locator('.app-dialog').waitFor({ state: 'detached' });
  assert.ok((await timerLeft(page)) > 0 && (await page.locator('#woRest:not([hidden])').count()) === 1, where('o descanso continua após cancelar o diálogo'));

  /* 6. recarregar a meio do descanso: temporizador e séries recuperados, sem duplicados */
  await page.reload({ waitUntil: 'networkidle' });
  assert.ok((await page.evaluate(() => localStorage.getItem('rest_timer'))) !== null, where('o fim absoluto do descanso persiste'));
  assert.equal(await st(page, s => Object.values(s.sets).flat().length), 3, where('séries intactas após recarregar'));
  assert.equal(await page.evaluate(() => document.querySelectorAll('#timerBanner').length), 1);
  assert.equal(await st(page, s => s.session && s.session.state), 'ACTIVE', where('sessão preservada'));
  const afterReload = (await page.locator('#woRest:not([hidden])').count()) ? 'guiado' : 'banner';
  const ok = afterReload === 'guiado' ? await probe(page, '#woRest .wo-rest-num') : await probe(page, '#timerBanner .t-btn.plus');
  assert.ok(ok.ok, where(`após recarregar o descanso tem de estar utilizável (${afterReload}): ${JSON.stringify(ok)}`));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), where('scroll horizontal após recarregar'));
  await ctx.close();
}

/* foco, botão «Voltar» do telemóvel e terminar a sessão durante o descanso */
async function run2([w, h, theme]) {
  const where = m => `${theme}-${w}x${h}: ${m}`;
  const { ctx, page } = await open(w, h, theme);
  await page.evaluate(async () => { (await import('./js/workout.js')).startWorkout('Segunda'); });
  await page.fill('#wo-w', '40'); await page.fill('#wo-r', '8');
  await tap(page, page.locator('.wo-main').first());
  await page.locator('#woRest:not([hidden])').waitFor();
  /* +30 s não recria os botões: o foco fica */
  await page.locator('#woRest button', { hasText: '+30' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim()), '+30 s', where('«+30 s» perdeu o foco'));
  /* Voltar (do telemóvel) fecha o guiado como «Sair»: a app não sai e o descanso e a sessão ficam */
  const href = page.url();
  await page.goBack();
  await page.locator('#woBg.show').waitFor({ state: 'detached' });
  assert.equal(page.url(), href, where('Voltar saiu da app'));
  assert.equal(await st(page, s => s.session && s.session.state), 'ACTIVE', where('sessão preservada com Voltar'));
  assert.ok((await page.locator('#timerBanner.show').count()) === 1 && (await timerLeft(page)) > 0, where('descanso preservado com Voltar'));
  await tap(page, page.locator('#navLive'));
  await page.locator('#woRest:not([hidden])').waitFor();
  await tap(page, page.locator('.wo-bar button').first());          /* Sair pelo botão: sem entradas de histórico a mais */
  await page.locator('#woBg.show').waitFor({ state: 'detached' });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => history.state && history.state.wo ? 1 : 0), 0, where('«Sair» deixou entrada de histórico'));
  /* terminar a sessão com o descanso a correr: o descanso acaba com ela */
  await tap(page, page.locator('#navLive'));
  await page.locator('.wo-end').waitFor();
  await tap(page, page.locator('.wo-end'));
  await page.locator('.app-dialog button.btn-danger, .app-dialog .btn-primary, .app-dialog button', { hasText: 'Terminar' }).first().click();
  await page.locator('#mvBg.show').waitFor();
  assert.equal(await timerLeft(page) > 0 && (await page.evaluate(async () => (await import('./js/timer.js')).TM.on)), false, where('o descanso continuou depois de terminar o treino'));
  assert.equal(await page.evaluate(() => localStorage.getItem('rest_timer')), null, where('rest_timer ficou gravado'));
  assert.equal(await page.locator('#timerBanner.show').count(), 0, where('banner de descanso depois de terminar'));
  assert.equal(await st(page, s => Object.values(s.sets).flat().length + (s.workouts.at(-1) && s.workouts.at(-1).state === 'COMPLETED' ? 100 : 0)), 101, where('séries e treino concluído'));
  await ctx.close();
}

/* histórico: reloads não acumulam entradas; Voltar com diálogo aberto não deixa a app inerte */
async function run3([w, h, theme]) {
  const where = m => `${theme}-${w}x${h}: ${m}`;
  const { ctx, page } = await open(w, h, theme);
  const len0 = await page.evaluate(() => history.length);
  await page.evaluate(async () => { (await import('./js/workout.js')).startWorkout('Segunda'); });
  await page.locator('#woBg.show').waitFor();
  const len1 = await page.evaluate(() => history.length);
  assert.equal(len1, len0 + 1, where('abrir o guiado devia acrescentar uma só entrada'));
  for (let i = 0; i < 3; i++) await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => history.length), len1, where('cada reload acumulou uma entrada de histórico'));
  await page.locator('#woBg.show').waitFor();                         /* a sessão recente reabre o guiado */
  /* Voltar com o diálogo «Terminar» aberto: o guiado fica, o diálogo fica, nada fica inerte depois de cancelar */
  const inertOf = () => page.evaluate(() => ['hdr', 'content', 'bnav'].map(id => document.getElementById(id).inert));
  const inertBefore = await inertOf();
  await tap(page, page.locator('.wo-end'));
  await page.locator('.app-dialog').waitFor();
  await page.goBack();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#woBg.show').count(), 1, where('Voltar fechou o guiado por baixo do diálogo'));
  assert.equal(await page.locator('.app-dialog').count(), 1, where('o diálogo desapareceu'));
  await page.locator('.app-dialog button', { hasText: /Cancelar|Voltar|Não/ }).first().click();
  await page.locator('.app-dialog').waitFor({ state: 'detached' });
  assert.deepEqual(await inertOf(), inertBefore, where('o fundo ficou com inert diferente do de antes do diálogo'));
  assert.equal(await page.locator('#woBg.show').count(), 1, where('o guiado devia continuar'));
  assert.equal(await probe(page, '.wo-bar button:first-child').then(p => p.ok), true, where('Sair tapado'));
  /* Voltar sem camadas fecha o guiado e fica-se na app, na mesma entrada de antes de o abrir */
  const href = page.url();
  await page.goBack();
  await page.locator('#woBg.show').waitFor({ state: 'detached' });
  assert.equal(page.url(), href, where('Voltar saiu da app'));
  assert.equal(await page.evaluate(() => history.state && history.state.wo ? 1 : 0), 0, where('entrada de histórico a mais'));
  assert.equal(await st(page, s => s.session && s.session.state), 'ACTIVE', where('sessão preservada'));
  await ctx.close();
}

try {
  for (const s of SIZES) await run(s);
  for (const s of [[360, 740, 'dark'], [390, 780, 'light']]) await run2(s);
  for (const s of [[360, 740, 'dark'], [390, 780, 'light']]) await run3(s);
  assert.deepEqual(errors, [], `erros: ${errors.join(' | ')}`);
  console.log('OK descanso: posições reais, controlos acessíveis, +30 s/Saltar/fim, Sair/Abrir, navegação, diálogo e recarregar; 320–1280, dois temas.');
} finally { await browser.close(); server.close(); }
