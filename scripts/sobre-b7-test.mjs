/* Bloco 7: painel «Sobre» com «X» discreto + temas realmente aplicados (claro/escuro/automático) — npm run test:sobre */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(root, 'test-results', 'sobre'); mkdirSync(SHOTS, { recursive: true });
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

/* cada contexto é isolado e FIXA a preferência guardada (o escuro é o valor por omissão da app) */
async function open(w, pref, system = 'light') {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true, colorScheme: system, serviceWorkers: 'block' });
  await ctx.addInitScript(p => { try { localStorage.setItem('treino_theme', p); if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } })); } catch (_) { /* sem storage */ } }, pref);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
}
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const theme = page => page.evaluate(() => ({ t: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
async function openAbout(page) {
  await page.locator('[data-day="opts"]').tap();
  const entry = page.getByRole('button', { name: /Versão treino-v/ });
  await entry.scrollIntoViewIfNeeded(); await entry.tap();
  await page.getByRole('dialog', { name: 'Sobre', exact: true }).waitFor();
}

try {
  for (const [pref, system, expected] of [['light', 'dark', 'light'], ['dark', 'light', 'dark'], ['auto', 'light', 'light'], ['auto', 'dark', 'dark']]) {
    await test(`tema «${pref}» (sistema ${system}) aplicado de facto: ${expected}, persiste após reload`, async () => {
      const { ctx, page } = await open(390, pref, system);
      const a = await theme(page);
      assert.equal(a.t, expected);
      assert.equal(lum(a.bg) > 0.5, expected === 'light', `fundo ${a.bg} não corresponde a ${expected}`);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal((await theme(page)).t, expected, 'persistência');
      assert.equal(await page.evaluate(() => localStorage.getItem('treino_theme')), pref);
      await ctx.close();
    });
  }

  for (const w of [320, 360, 390, 412]) for (const pref of ['light', 'dark']) {
    await test(`Sobre ${w}px ${pref}: «X» pequeno, alvo ≥44px, alinhado, sem sobreposição, fecha por toque/Escape/teclado, foco restaurado`, async () => {
      const { ctx, page } = await open(w, pref, pref === 'light' ? 'dark' : 'light');
      assert.equal((await theme(page)).t, pref, 'tema pedido');
      await openAbout(page);
      const dlg = page.getByRole('dialog', { name: 'Sobre', exact: true });
      const x = dlg.getByRole('button', { name: 'Fechar informações sobre a aplicação' });
      assert.equal(await x.count(), 1, 'nome acessível do X');
      assert.equal(await dlg.getByRole('button', { name: 'Fechar', exact: true }).count(), 0, 'sem botão «Fechar» grande');
      const m = await page.evaluate(() => {
        const d = document.querySelector('.app-dialog'), b = d.querySelector('.app-dialog-x'), h = d.querySelector('h2'), s = b.querySelector('svg');
        const r = e => { const q = e.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, w: q.width, h: q.height }; };
        return { d: r(d), b: r(b), h: r(h), s: r(s), color: getComputedStyle(b).color, bg: getComputedStyle(d).backgroundColor, sw: document.documentElement.scrollWidth, iw: innerWidth };
      });
      assert(m.b.w >= 44 && m.b.h >= 44, `alvo ${m.b.w}×${m.b.h}`);
      assert(m.s.w >= 18 && m.s.w <= 20 && m.s.h >= 18 && m.s.h <= 20, `ícone ${m.s.w}×${m.s.h}`);
      assert(m.d.r - m.b.r <= 24, 'X no canto superior direito');
      assert(Math.abs((m.b.t + m.b.b) / 2 - (m.h.t + m.h.b) / 2) <= 3, 'alinhado verticalmente com o título');
      assert(m.b.l >= m.h.r - 1 || m.b.t >= m.h.b - 1, 'sem sobreposição com o título');
      assert(ratio(m.color, m.bg) >= 3, `contraste do X ${ratio(m.color, m.bg).toFixed(2)}`);
      assert(m.sw <= m.iw, 'scroll horizontal');
      assert((await dlg.innerText()).includes('Código em execução:'), 'mantém a informação de versão');
      await page.screenshot({ path: join(SHOTS, `sobre-${w}-${pref}.png`) });
      await x.tap();
      await dlg.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-day')), 'opts', 'foco volta ao controlo que abriu a cadeia (separador Mais)');
      await openAbout(page); await page.keyboard.press('Escape');
      await dlg.waitFor({ state: 'detached' });
      await openAbout(page);
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('.app-dialog')), true, 'Tab não sai do diálogo');
      await x.focus(); await page.keyboard.press('Enter');
      await dlg.waitFor({ state: 'detached' });
      await ctx.close();
    });
  }

  await test('outros diálogos mantêm o botão «Cancelar» (sem X)', async () => {
    const { ctx, page } = await open(390, 'dark');
    await page.evaluate(async () => { const { confirmDialog } = await import('./js/dialog.js'); window.__p = confirmDialog({ title: 'Teste', message: 'm' }); });
    const d = page.getByRole('dialog', { name: 'Teste' });
    await d.waitFor();
    assert.equal(await d.locator('.app-dialog-x').count(), 0);
    await d.getByRole('button', { name: 'Cancelar' }).tap();
    assert.equal(await page.evaluate(() => window.__p), false);
    await ctx.close();
  });

  assert.deepEqual(errors, [], `erros: ${errors.join(' | ')}`);
  console.log(`OK — ${count} grupos (Sobre + temas)`);
} finally {
  await browser.close(); server.close();
}
