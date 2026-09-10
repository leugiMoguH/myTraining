/* Teste real no browser (Chromium headless) — corre com: npm run test:browser
   Serve o site, abre-o, clica em tudo e falha se o Console tiver um único erro. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const SHOTS = join(ROOT, 'test-results');
const PORT = 8123;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const safe = p.split('/').filter(seg => seg && seg !== '..').join('/');
  const file = join(ROOT, safe);
  if (!existsSync(file)) { res.writeHead(404).end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', r => {
  const u = r.url();
  if (u.startsWith(`http://localhost:${PORT}`)) errors.push(`falhou: ${u.replace(`http://localhost:${PORT}`, '')}`);
});

const fail = [];
/* Entre passos: fechar overlays e o banner do temporizador. Sem isto o passo
   seguinte clica numa camada por cima e falha com timeout sem razão real. */
const clearOverlays = () => page.evaluate(() => {
  ['infoBg', 'sheetBg', 'scanBg'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.remove('show');
  });
  if (typeof window.timerDismiss === 'function') window.timerDismiss();
});

const step = async (name, fn) => {
  const before = errors.length;
  try { await fn(); } catch (e) { fail.push(`${name}: ${e.message.split('\n')[0]}`); }
  await page.waitForTimeout(120);
  await clearOverlays();
  for (const e of errors.slice(before)) fail.push(`${name} -> ${e}`);
};
const click = async sel => { await page.locator(sel).first().click({ timeout: 3000 }); };

await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });

await step('arranque', async () => {
  const tabs = await page.locator('.tab').count();
  if (tabs < 9) throw new Error(`so ${tabs} separadores (esperado 9)`);
  const cards = await page.locator('.card').count();
  if (cards < 1) throw new Error('nenhum cartao de exercicio renderizado');
});

for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']) {
  await step(`tab ${day}`, async () => {
    await click(`.tab[data-day="${day}"]`);
    if (!(await page.locator('.card').count())) throw new Error('sem cartoes');
  });
}
await step('tab Perfil', () => click('.tab[data-day="__perfil"]'));
await step('tab Nutricao', () => click('.tab[data-day="__nutri"]'));
await step('volta a Segunda', () => click('.tab[data-day="Segunda"]'));

await step('marcar serie 1', async () => {
  await click('.set-btn');
  if (!(await page.locator('.set-btn.on').count())) throw new Error('serie nao ficou marcada - handler morto?');
});
await step('grafico de carga', () => click('.load-chart-btn'));
await step('slider seguinte', () => click('.slide-next'));
await step('ficha tecnica', async () => {
  await click('.info-btn');
  if (!(await page.locator('#infoBg.show').count())) throw new Error('modal nao abriu');
  await click('.info-close');
});
await step('marcar exercicio feito', async () => {
  await click('.act-done');
  if (!(await page.locator('.card.done').count())) throw new Error('cartao nao ficou marcado');
});

await step('iniciar treino', async () => {
  await click('.start-wo');
  if (!(await page.locator('#woBg.show').count())) throw new Error('modo guiado nao abriu');
});
await step('treino: proximo', () => click('.wo-navbtn.next'));
await step('treino: serie', () => click('.wo-set'));
await page.screenshot({ path: join(SHOTS, 'treino-guiado.png') });
await step('fechar treino', () => click('.wo-close'));

await step('abrir definicoes', async () => {
  await click('.hdr-gear');
  if (!(await page.locator('#sheetBg.show').count())) throw new Error('sheet nao abriu');
});
await step('ajustar descanso', () => click('.hdr-timer-adj'));
await step('fechar definicoes', () => page.evaluate(() => window.closeSheet()));

await step('reload mantem progresso', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.locator('.set-btn.on').count())) throw new Error('progresso perdeu-se no reload');
});

await step('catalogo carrega', async () => {
  const r = await page.evaluate(async () => {
    const c = await import('./js/catalog.js');
    await c.loadCatalog();
    return { n: c.all().length, squat: c.search('squat')[0] && c.search('squat')[0].n, url: c.gifUrl(c.all()[0]) };
  });
  if (r.n !== 1324) throw new Error(`catalogo com ${r.n} exercicios`);
  if (!r.squat || !r.squat.startsWith('squat')) throw new Error(`pesquisa ma: ${r.squat}`);
  if (!r.url.endsWith('.gif')) throw new Error('URL de GIF mal formada');
});

await step('GIF do CDN responde', async () => {
  const url = await page.evaluate(async () => {
    const c = await import('./js/catalog.js');
    await c.loadCatalog();
    return c.gifUrl(c.search('barbell bench press')[0]);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
});

await page.locator('.tab[data-day="Segunda"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: join(SHOTS, 'segunda.png'), fullPage: true });
await page.locator('.tab[data-day="__perfil"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: join(SHOTS, 'perfil.png'), fullPage: true });

await browser.close();
server.close();

if (fail.length) { console.error(`FALHOU (${fail.length}):\n  ` + fail.join('\n  ')); process.exit(1); }
console.log('OK - app real no Chromium: 0 erros de consola, 0 pedidos falhados, tudo clicavel responde.');
