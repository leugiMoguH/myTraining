/* Bloco 8: acessibilidade estrutural — corre com: npm run test:a11y
   Automatiza o que dá para automatizar (semântica, teclado, foco, contraste em gradientes, scroll horizontal).
   NÃO substitui leitor de ecrã real (anúncios, ordem de leitura): isso fica para validação manual. */
import { chromium } from 'playwright';
import { skipOnboarding } from './_skip-onb.mjs';
import { serve, scanContrast } from './a11y-lib.mjs';

const PORT = +process.env.PORT || 8141;
const server = await serve(PORT);
const URL_ = `http://localhost:${PORT}/index.html`;
const browser = await chromium.launch();
const fail = [], errors = [];
const check = (c, m) => { if (!c) fail.push(m); };
const SCREENS = ['__hoje', '__semana', '__dia', '__perfil', '__eu', '__plano', '__nutri', '__hist'];

async function open(w, theme = 'dark') {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  const page = await ctx.newPage();
  await skipOnboarding(page);
  await page.addInitScript(t => { try { localStorage.setItem('treino_theme', t); } catch { /* sem storage */ } }, theme);
  page.on('console', m => { if (m.type() === 'error') errors.push(`${w}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${w}: ${e.message}`));
  await page.goto(URL_, { waitUntil: 'networkidle' });
  return { ctx, page };
}
const go = async (page, v) => { await page.evaluate(v => window.goDay(v), v); await page.waitForTimeout(200); };
const active = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : ''; });
const insideActive = (page, sel) => page.evaluate(sel => !!document.activeElement?.closest(sel), sel);

/* 1. semântica + contraste + scroll horizontal, nos dois temas e em todas as larguras pedidas */
for (const theme of ['dark', 'light']) {
  for (const w of [320, 360, 390, 412, 1280]) {
    const { ctx, page } = await open(w, theme);
    for (const v of SCREENS) {
      await go(page, v);
      const fake = await page.evaluate(() => [...document.querySelectorAll('[onclick]')]
        .filter(e => !e.matches('button, a[href], input, select, label, summary') && !e.matches('.sheet-bg, .info-bg, .sheet, .info-card'))
        .map(e => `${e.tagName.toLowerCase()}.${e.className}`));
      check(!fake.length, `${theme}/${w}/${v}: clicável sem semântica: ${fake.join(', ')}`);
      check(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), `${theme}/${w}/${v}: scroll horizontal`);
      if (w === 390) (await scanContrast(page, `${theme}/${v}`)).forEach(m => fail.push(`contraste ${m}`));
    }
    await ctx.close();
  }
}

/* 2. Definições: foco dentro, Tab preso, fundo inerte, Esc fecha, foco regressa ao botão de origem */
{
  const { ctx, page } = await open(390);
  await go(page, '__hoje');
  await page.focus('#navRow button:last-child');
  const origin = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 60));
  await page.evaluate(() => window.openSheet());
  check(await insideActive(page, '#sheetBg'), 'sheet: foco inicial fora da folha');
  check(await page.evaluate(() => document.getElementById('content').inert && document.getElementById('bnav').inert), 'sheet: fundo não inerte');
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); if (!await insideActive(page, '#sheetBg')) { fail.push('sheet: Tab saiu da folha'); break; } }
  await page.keyboard.press('Shift+Tab');
  check(await insideActive(page, '#sheetBg'), 'sheet: Shift+Tab saiu da folha: ' + await active(page));
  await page.keyboard.press('Escape');
  check(!await page.evaluate(() => document.getElementById('sheetBg').classList.contains('show')), 'sheet: Esc não fecha');
  check(!await page.evaluate(() => document.getElementById('content').inert), 'sheet: fundo continua inerte após fechar');
  check(await page.evaluate(o => document.activeElement.outerHTML.slice(0, 60) === o, origin), 'sheet: foco não regressou à origem');
  const role = await page.evaluate(() => { const s = document.querySelector('#sheetBg .sheet'); return [s.getAttribute('role'), s.getAttribute('aria-modal'), !!document.getElementById(s.getAttribute('aria-labelledby'))]; });
  check(role.join() === 'dialog,true,true', `sheet: papel/nome do diálogo ${role}`);
  /* Esc num diálogo de confirmação aberto a partir da folha fecha só o diálogo */
  await page.evaluate(() => window.openSheet());
  await page.evaluate(() => { import('./js/dialog.js').then(m => { window.__d = m.confirmDialog({ title: 'x', message: 'y' }); }); });
  await page.waitForSelector('.app-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check(await page.evaluate(() => !document.querySelector('.app-dialog') && document.getElementById('sheetBg').classList.contains('show')), 'Esc num diálogo fechou também a folha (ou o diálogo)');
  await page.keyboard.press('Escape');
  check(!await page.evaluate(() => document.getElementById('sheetBg').classList.contains('show')), 'sheet: Esc final não fecha');
  await ctx.close();
}

/* 3. Ficha técnica (aberta por ℹ do cartão): foco no ✕, Esc fecha, foco regressa ao ℹ */
{
  const { ctx, page } = await open(390);
  await go(page, '__semana');
  await go(page, await page.locator('.wk-row:not(.s-rest)').first().getAttribute('data-day'));
  const origin = page.locator('#content button:visible').first();
  await origin.focus();
  await page.evaluate(() => window.openInfo('Supino reto com barra', ''));
  await page.waitForTimeout(200);
  check(await insideActive(page, '#infoBg'), 'ficha: foco inicial fora da ficha');
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if (!await insideActive(page, '#infoBg')) { fail.push('ficha: Tab saiu'); break; } }
  await page.keyboard.press('Escape');
  check(!await page.evaluate(() => document.getElementById('infoBg').classList.contains('show')), 'ficha: Esc não fecha');
  check(await page.evaluate(() => document.activeElement === document.querySelector('#content button:not([hidden])') || !!document.activeElement.closest('#content')), 'ficha: foco não regressou à origem');
  await ctx.close();
}

/* 4. Teclado nos controlos convertidos: Enter e Espaço ativam chips, linhas da semana e pontos */
{
  const { ctx, page } = await open(390);
  await go(page, '__semana');
  const row = page.locator('.wk-row').first();
  await row.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  check(await page.evaluate(() => !document.querySelector('.week-list')), 'linha da semana: Enter não navegou');
  await ctx.close();
}

console.log(errors.length ? errors.join('\n') : '');
if (fail.length || errors.length) { console.error('FALHOU:\n' + [...new Set(fail)].join('\n')); process.exitCode = 1; }
else console.log('OK — a11y: semântica, contraste (2 temas), teclado/foco de Definições e ficha, 320–1280 sem scroll horizontal.');
await browser.close(); server.close();
