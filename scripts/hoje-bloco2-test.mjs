/* Bloco 2: 120 combinações sem reload, relógio fixo e percurso tátil. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const server = createServer((q, r) => {
  const f = join(root, ...decodeURIComponent(q.url.split('?')[0] === '/' ? '/index.html' : q.url.split('?')[0]).split('/').filter(s => s && s !== '..'));
  if (!existsSync(f)) return void r.writeHead(404).end();
  r.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(f)] || 'application/octet-stream');
  r.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const states = [
  ['novo', '2026-10-28', 'new'], ['treino-hoje', '2026-10-26'],
  ['descanso', '2026-10-29', 'rest'], ['concluido', '2026-10-26', 'doneToday'],
  ['atraso-adaptacao', '2026-10-28'], ['aula-treino', '2026-10-26', 'classToday'],
  ['aula-anterior', '2026-10-28', 'classPast'], ['em-curso', '2026-10-26', 'live'],
  ['pausada', '2026-10-26', 'paused'], ['fim-semana', '2026-10-31'],
  ['semana-nova', '2026-11-02', 'week'], ['semana-fechada', '2026-10-29', 'doneAll'],
];
const errors = [], measurements = [];
const timerVisible = page => page.locator('.hdr-timer-row').isVisible();
async function seed(page, mode) {
  await page.evaluate(async mode => {
    const S = await import('./js/state.js'), R = await import('./js/routine.js'), Q = await import('./js/schedule.js'), X = await import('./js/session.js'), C = await import('./js/classes.js');
    const st = S.ST, days = R.dayNames();
    if (mode === 'new') { /* onboarding real, sem o esconder artificialmente */ }
    if (mode === 'doneAll') days.forEach(d => { st.sched.done[d] = S.todayStr(); });
    if (mode === 'doneToday') st.sched.done[Q.currentDay()] = S.todayStr();
    if (mode === 'rest') days.slice(0, 3).forEach(d => { st.sched.done[d] = S.todayStr(); });
    if (mode === 'classToday' || mode === 'classPast') {
      const result = C.addClass({ kind: 'pilates', name: mode === 'classPast' ? 'Pilates de resistência com nome comprido' : 'Pilates', day: mode === 'classPast' ? 'Terça' : 'Segunda', time: '18:30', min: 50, intensity: 1, weekly: true }, mode === 'classPast' ? new Date('2026-10-26T09:00:00') : new Date());
      if (!result.ok) throw Error(result.error);
    }
    if (mode === 'live' || mode === 'paused') { X.startSession(Q.currentDay(), 'Treino'); if (mode === 'paused') X.pauseSession(); }
    if (mode === 'week') { st.sched.week = '2026-10-26'; st.sched.done.Segunda = '2026-10-26'; }
    S.save(); window.render('__hoje');
  }, mode);
}
async function check(page, tag, expectedLive) {
  const m = await page.evaluate(() => {
    const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('details:not([open]) :not(summary)');
    const hero = document.querySelector('.hero'), cta = hero?.querySelector('.start-wo');
    const box = cta?.getBoundingClientRect();
    const all = [...document.querySelectorAll('#content button, #content summary')].filter(visible);
    const top = s => document.querySelector(s)?.getBoundingClientRect().top;
    return {
      hero: !!hero, primary: all.filter(e => e.matches('.btn-primary') && /Começar|Continuar|Iniciar/.test(e.textContent)).length,
      status: document.querySelectorAll('.hero-k').length, old: document.querySelectorAll('.hero-hi,.today-plan,.today-top .sched-note').length,
      quick: all.filter(e => /Versão rápida|pouco tempo/i.test(e.textContent)).length,
      small: all.filter(e => e.getBoundingClientRect().height < 43.9 || e.getBoundingClientRect().width < 43.9).map(e => e.textContent.trim()),
      horizontal: document.documentElement.scrollWidth > innerWidth,
      y: box ? Math.round(box.y) : null, bottom: box?.bottom, nav: document.querySelector('#bnav').getBoundingClientRect().top,
      strip: top('.week-strip'), heroTop: top('.hero'), toggle: top('#todayToggle'), attention: top('.ad-card'), classes: top('.cl-card'),
      listOpen: !!document.querySelector('#todayList:not([hidden])'),
    };
  });
  assert.equal(m.primary, m.hero ? 1 : 0, `${tag}: CTA único`);
  assert.equal(m.status, m.hero ? 1 : 0, `${tag}: estado único`);
  assert.equal(m.old, 0, `${tag}: mensagens antigas`);
  assert(m.quick <= 1, `${tag}: versão rápida duplicada`);
  assert(!m.horizontal, `${tag}: scroll horizontal`);
  assert.deepEqual(m.small, [], `${tag}: alvos <44px`);
  if (m.hero) assert(m.strip < m.heroTop, `${tag}: tira antes do cartão`);
  if (m.toggle != null) { assert(m.heroTop < m.toggle, `${tag}: lista sob cartão`); if (m.attention != null) assert(m.attention > m.toggle, `${tag}: atenção depois da lista`); }
  assert.equal(await timerVisible(page), expectedLive || m.listOpen, `${tag}: timer Hoje`);
  return m;
}
async function hit(page, selector) {
  const e = page.locator(selector).first(); await e.scrollIntoViewIfNeeded();
  assert(await e.evaluate(e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === e || e.contains(hit); }), `${selector}: sobreposição`);
  await e.tap();
}
try {
  let n = 0;
  for (const [id, date, mode] of states) for (const theme of ['light', 'dark']) for (const width of [320, 360, 390, 412, 1280]) {
    const height = width === 360 ? 640 : width === 390 ? 844 : 800;
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 1000, serviceWorkers: 'block' });
    await ctx.clock.setFixedTime(new Date(`${date}T10:00:00`));
    await ctx.addInitScript(([theme, mode]) => { localStorage.setItem('treino_theme', theme); if (mode !== 'new') localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); }, [theme, mode]);
    const page = await ctx.newPage(); page.setDefaultTimeout(7000); page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
    await seed(page, mode);
    const tag = `${id}/${theme}/${width}`, live = mode === 'live' || mode === 'paused';
    const m = await check(page, tag, live);
    if (id === 'atraso-adaptacao') assert.equal(await page.locator('.ad-card').count(), 1, `${tag}: sugestão de adaptação`);
    if (mode === 'classPast') assert.match(await page.locator('.cl-card').innerText(), /Pilates de resistência/, `${tag}: aula anterior semeada`);
    if (mode === 'rest') assert(await page.locator('.rest-card').isVisible(), `${tag}: descanso com próximo treino`);
    if (mode === 'doneAll') { assert.equal(m.hero, false); assert(await page.locator('.today-plan-link').isVisible()); }
    if (width === 360 || width === 390) measurements.push({ estado: id, tema: theme, viewport: `${width}×${height}`, y: m.y });
    if (width === 360 && ['treino-hoje', 'atraso-adaptacao'].includes(id)) assert(m.y >= 0 && m.bottom <= Math.min(640, m.nav), `${tag}: CTA visível a 360×640 (${m.y})`);
    if (mode === 'new') assert(await page.locator('#onbBg.show').isVisible(), `${tag}: onboarding novo`);
    if (id === 'treino-hoje' && width === 390) {
      assert.equal(await timerVisible(page), false);
      await hit(page, '#todayToggle'); assert.equal(await timerVisible(page), true);
      await hit(page, '#todayToggle'); assert.equal(await timerVisible(page), false);
      await hit(page, '.hero .start-wo');
      assert(await page.locator('#woBg.show').isVisible());
      await page.fill('#wo-w', '40'); await page.fill('#wo-r', '8');
      await hit(page, '.wo-main');
      assert(await page.locator('#woRest .wo-rest-num').isVisible());
      await hit(page, '.wo-bar button[onclick="closeWorkout()"]');
      assert.equal(await page.locator('#woBg.show').count(), 0);
      await page.evaluate(() => window.render('__hoje'));
      assert.match(await page.locator('.hero .start-wo').innerText(), /Continuar/);
      await hit(page, '.hero .start-wo'); assert(await page.locator('#woBg.show').isVisible());
      await page.evaluate(() => { window.closeWorkout(); window.timerDismiss(); });
      for (const v of ['__hist', '__perfil', '__nutri', '__plano', '__eu']) {
        await page.evaluate(v => window.render(v), v); assert.equal(await timerVisible(page), false, `${v}: escondido mesmo com sessão`);
      }
      for (const v of ['Segunda', '__pers', '__ex']) {
        await page.evaluate(v => window.render(v), v); assert.equal(await timerVisible(page), true, `${v}: visível`);
      }
      await page.evaluate(() => window.render('__hoje')); assert.equal(await timerVisible(page), true);
      const open = await page.locator('#todayList').evaluate(e => !e.hidden);
      if (open) await hit(page, '#todayToggle');
      assert.equal(await timerVisible(page), true, 'sessão viva com lista fechada');
      await page.evaluate(async () => { const X = await import('./js/session.js'); X.abandonSession(); });
      assert.equal(await timerVisible(page), false, 'evento de sessão e lista fechada');
    }
    await ctx.close(); n++;
    if (n % 10 === 0) console.log(`OK ${id}: 10 combinações`);
  }
  assert.deepEqual(errors, []);
  console.table(measurements);
  console.log(`OK — ${n} combinações sem reload; percurso 390 claro/escuro; posições do CTA acima.`);
} finally { await browser.close(); await new Promise(r => server.close(r)); }
