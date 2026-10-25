/* Bloco 1: dimensões reais, extremos dos alvos, sessão e movimento reduzido. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { skipOnboarding } from './_skip-onb.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, 'test-results');
mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(root, path === '/' ? 'index.html' : path.split('/').filter(s => s && s !== '..').join('/'));
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(8137, '127.0.0.1', r));
let browser;
const errors = [], failures = [];
const selectors = '.hdr-timer-adj,.hdr-timer-btn,#timerBanner .t-btn,.reset-btn,.start-wo,.ed-btn,.ed-label input,.ed-fields input,.ed-check,.ed-ss,.nfield input,.nfield select,.nfree,.nchip span,.iadd .load-chart-btn,.load-save,.qfood,.iitem-x,#mchips .m-chip,.cat-chip,.linklike,.cat-close,.wk-chip';
try {
  browser = await chromium.launch();
  for (const width of [320, 360, 390, 412, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await skipOnboarding(page);
    await page.goto('http://127.0.0.1:8137/', { waitUntil: 'networkidle' });
    async function inspect(name) {
      const problems = await page.evaluate(selectors => {
        const bad = [];
        if (document.documentElement.scrollWidth > innerWidth) bad.push('scroll horizontal');
        if (document.querySelector('#hdr').getBoundingClientRect().height > 56) bad.push('cabeçalho >56');
        for (const el of document.querySelectorAll(selectors)) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || !el.checkVisibility({ visibilityProperty: true })) continue;
          if (el.closest('[inert]')) continue;
          const modal = document.querySelector('#catBg.show, #woBg.show, #onbBg.show');
          if (modal && !modal.contains(el)) continue;
          if (document.querySelector('#timerBanner.show') && el.closest('#hdr')) continue;
          // Sete dias não cabem a 44px de largura num ecrã de 320px.
          if (r.height < 43.9 || (!el.matches('.wk-chip') && r.width < 43.9)) bad.push(`${el.className}: ${r.width}×${r.height}`);
          if (el.disabled) continue;
          // Desloca o alvo para testar os quatro extremos, além do centro.
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          const b = el.getBoundingClientRect();
          for (const [x, y] of [[b.left+2,b.top+2],[b.right-2,b.top+2],[b.left+2,b.bottom-2],[b.right-2,b.bottom-2],[(b.left+b.right)/2,(b.top+b.bottom)/2]]) {
            if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit && hit !== el && !el.contains(hit) && !hit.contains(el) && hit.closest('button,input,select,label,[onclick]') && !el.closest('label')?.contains(hit)) bad.push(`alvo tapado: ${el.className}`);
          }
        }
        return bad;
      }, selectors);
      failures.push(...problems.map(p => `${width}/${name}: ${p}`));
      await page.screenshot({ path: join(shots, `ux1-${width}-${name}.png`), fullPage: true });
    }
    for (const [name, view] of [['hoje','__hoje'],['dia','Segunda'],['evolucao','__perfil'],['nutricao','__nutri'],['historico','__hist']]) {
      if (name === 'dia') await page.evaluate(() => window.render('__semana'));
      await page.evaluate(v => window.render(v), view);
      await inspect(name);
    }
    await page.evaluate(() => window.hxOpen('Agachamento'));
    await inspect('exercicio');
    await page.evaluate(() => window.render('Segunda'));
    await page.evaluate(() => window.toggleEdit('Segunda'));
    await inspect('editor');
    await page.evaluate(() => window.render('__nutri'));
    await page.evaluate(() => window.editNutri());
    await inspect('nutricao-editar');
    await page.evaluate(() => window.edAdd('Segunda'));
    await page.waitForSelector('.cat-chip');
    await inspect('catalogo');
    await page.evaluate(() => window.closeCatalog());
    await page.evaluate(() => { window.timerStart(999); });
    await inspect('descanso');
    await page.evaluate(() => window.timerDismiss());
    await page.evaluate(() => document.querySelector('#restLabel').textContent = '999s');
    await inspect('descanso-header');
    await page.evaluate(async () => {
      const { startSession } = await import('./js/session.js');
      const { ST, save } = await import('./js/state.js');
      startSession('Segunda'); ST.sets['Segunda:0'] = [true]; save(); window.render('Segunda');
    });
    await page.evaluate(() => window.startWorkout('Segunda'));
    await page.evaluate(() => window.closeWorkout());
    for (const state of ['ACTIVE', 'PAUSED']) {
      if (state === 'PAUSED') await page.evaluate(async () => (await import('./js/session.js')).pauseSession());
      if (state === 'PAUSED') {
        await page.evaluate(() => window.startWorkout('Segunda'));
        await page.evaluate(() => window.closeWorkout());
      }
      const before = await page.evaluate(() => { const s = JSON.parse(localStorage.treino_v2); return { sets: s.sets, log: s.log, state: s.session.state }; });
      await page.locator('.hdr-home').click();
      const after = await page.evaluate(() => { const s = JSON.parse(localStorage.treino_v2); return { sets: s.sets, log: s.log, state: s.session.state }; });
      assert.deepEqual(after, before, `sessão preservada ${width}/${state}`);
    }
    await page.evaluate(async () => {
      const { ST, save, todayStr } = await import('./js/state.js');
      const { abandonSession, startSession } = await import('./js/session.js');
      abandonSession();
      ST.custom = { date: todayStr(), label: 'Teste', muscles: [], stage: 'active', ex: [{ name: 'Agachamento', s: 3, r: '8' }] };
      startSession('Personalizado'); ST.sets['Personalizado:0'] = [true]; save(); window.render('__pers');
    });
    await inspect('personalizado');
    for (const state of ['ACTIVE', 'PAUSED']) {
      if (state === 'PAUSED') await page.evaluate(async () => (await import('./js/session.js')).pauseSession());
      const snapshot = () => page.evaluate(() => { const s = JSON.parse(localStorage.treino_v2); return { session: s.session, sets: s.sets, log: s.log, custom: s.custom }; });
      const before = await snapshot();
      await page.locator('.hdr-home').click();
      assert.deepEqual(await snapshot(), before, `personalizado preservado ${width}/${state}`);
    }
    const motion = await page.evaluate(() => {
      const set = document.createElement('button'); set.className = 'set-btn pop';
      const slide = document.createElement('div'); slide.className = 'demo-slide'; slide.innerHTML = '<div class="demo-b">Demonstração</div>';
      document.body.append(set, slide);
      return ['#timerBanner', '.set-btn.pop', '.demo-b'].every(s => {
        const c = getComputedStyle(document.querySelector(s));
        return c.transitionDuration.split(',').every(v => parseFloat(v) < .001) && c.animationDuration.split(',').every(v => parseFloat(v) < .001);
      }) && getComputedStyle(document.documentElement).scrollBehavior === 'auto';
    });
    assert(motion, `movimento reduzido ${width}`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'erros de consola');
  assert.deepEqual(failures, [], 'verificações visuais');
  console.log('Bloco 1: verificações concluídas.');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
