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
/* passos que precisam do ecrã limpo antes de clicar */
const stepClean = async (name, fn) => { await clearOverlays(); await step(name, fn); };

const click = async sel => { await page.locator(sel).first().click({ timeout: 3000 }); };

await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });

await step('arranque', async () => {
  const tabs = await page.locator('.tab').count();
  if (tabs !== 4) throw new Error(`${tabs} separadores (esperado 4: Hoje/Semana/Perfil/Nutricao)`);
  const chips = await page.locator('.week-strip .wk-chip').count();
  if (chips !== 7) throw new Error(`tira da semana com ${chips} dias`);
  /* ou ha treino pendente (cartoes), ou e dia de descanso/semana fechada */
  const treino = await page.locator('.card').count();
  const descanso = await page.locator('.rest-card').count();
  if (!treino && !descanso) throw new Error('ecra Hoje vazio: nem treino nem cartao de descanso');
});

await step('tab Semana', async () => {
  await click('.tab[data-day="__semana"]');
  const rows = await page.locator('.wk-row').count();
  if (rows !== 7) throw new Error(`lista da semana com ${rows} dias`);
});

for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']) {
  await step(`dia ${day}`, async () => {
    await click(`.wk-chip[data-day="${day}"]`);
    if (!(await page.locator('.card').count())) throw new Error('sem cartoes');
  });
}
await step('tab Perfil', () => click('.tab[data-day="__perfil"]'));
await step('tab Nutricao', () => click('.tab[data-day="__nutri"]'));
await step('volta a Segunda', async () => {
  await click('.tab[data-day="__semana"]');
  await click('.wk-row[data-day="Segunda"]');
  if (!(await page.locator('.card').count())) throw new Error('sem cartoes na Segunda');
});

await step('marcar serie 1', async () => {
  await click('.set-btn');
  if (!(await page.locator('.set-btn.on').count())) throw new Error('serie nao ficou marcada - handler morto?');
});
await step('grafico de carga', () => click('.load-chart-btn'));
await step('escolher esquema de progressao', async () => {
  const nome = await page.locator('.card-title').first().innerText();
  await page.locator('.lc-prog .cat-chip', { hasText: 'Greyskull' }).first().click();
  await page.waitForTimeout(250);
  const cfg = await page.evaluate(n => (JSON.parse(localStorage.getItem('treino_v2')).prog || {})[n], nome);
  if (!cfg || cfg.scheme !== 'greyskull') throw new Error(`esquema nao gravou: ${JSON.stringify(cfg)}`);
  if (!(await page.locator('.lc-prog .cat-chip.on', { hasText: 'Greyskull' }).count())) throw new Error('chip nao ficou ativo depois de repintar');
});
await step('mudar salto de peso', async () => {
  const nome = await page.locator('.card-title').first().innerText();
  const input = page.locator('.lc-inc input').first();
  await input.fill('1.5');
  await input.blur();
  await page.waitForTimeout(250);
  const cfg = await page.evaluate(n => (JSON.parse(localStorage.getItem('treino_v2')).prog || {})[n], nome);
  if (!cfg || cfg.inc !== 1.5) throw new Error(`incremento ficou ${cfg && cfg.inc}`);
});
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

/* ── editor de dias + catálogo (Fase 11b) ───────────────────────────────── */
await stepClean('entrar em modo edicao', async () => {
  await click('[onclick*="toggleEdit"]');
  if (!(await page.locator('.ed-row').count())) throw new Error('editor nao apareceu');
});
await step('descer exercicio', async () => {
  const antes = await page.locator('.ed-name').first().innerText();
  await page.locator('.ed-row').first().locator('.ed-btn').nth(1).click();
  const depois = await page.locator('.ed-name').first().innerText();
  if (antes === depois) throw new Error('ordem nao mudou');
});
await step('mudar series', async () => {
  const input = page.locator('.ed-fields input[type="number"]').first();
  await input.fill('5');
  await input.blur();
  await page.waitForTimeout(150);
  const v = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).routine['Segunda'].ex[0].s);
  if (v !== 5) throw new Error(`series ficaram ${v}, esperado 5`);
});
await step('abrir catalogo', async () => {
  await click('.ed-add');
  await page.waitForSelector('.cat-row', { timeout: 8000 });
  const n = await page.locator('.cat-row').count();
  if (n < 10) throw new Error(`so ${n} resultados no catalogo`);
});
await step('pesquisar no catalogo', async () => {
  await page.locator('#catQ').fill('squat');
  await page.waitForTimeout(400);
  const first = await page.locator('.cat-name').first().innerText();
  if (!first.toLowerCase().startsWith('squat')) throw new Error(`primeiro resultado: ${first}`);
});
await step('filtrar por equipamento', async () => {
  await page.locator('.cat-chip', { hasText: 'Halteres' }).first().click();
  await page.waitForTimeout(300);
  if (!(await page.locator('.cat-row').count())) throw new Error('filtro nao deu resultados');
});
await page.screenshot({ path: join(SHOTS, 'catalogo.png') });
await step('adicionar exercicio', async () => {
  const nome = await page.locator('.cat-name').first().innerText();
  const antes = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).routine['Segunda'].ex.length);
  await page.locator('.cat-row').first().click();
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).routine['Segunda'].ex);
  if (st.length !== antes + 1) throw new Error('exercicio nao foi acrescentado');
  const novo = st[st.length - 1];
  if (novo.name !== nome) throw new Error(`acrescentou "${novo.name}" em vez de "${nome}"`);
  if (!novo.catalogId || !novo.m) throw new Error('entrada sem catalogId/media_id - GIF nao vai carregar');
});
await step('sair do modo edicao', async () => {
  await click('[onclick*="toggleEdit"]');
  if (await page.locator('.ed-row').count()) throw new Error('continua em modo edicao');
});
await step('GIF do exercicio novo aparece', async () => {
  const gif = page.locator('.cat-gif').first();
  await gif.waitFor({ state: 'attached', timeout: 5000 });
  await gif.scrollIntoViewIfNeeded();          /* loading=lazy: fora do ecrã não descarrega */
  await page.waitForTimeout(1500);
  const ok = await gif.evaluate(img => new Promise(res => {
    if (img.complete) return res(img.naturalWidth > 0);
    img.onload = () => res(true); img.onerror = () => res(false);
    setTimeout(() => res(img.naturalWidth > 0), 8000);
  }));
  if (!ok) throw new Error('GIF do exercicio do catalogo nao carregou');
});
await step('ficha EN do exercicio novo', async () => {
  await page.locator('.card').last().locator('.info-btn').click();
  await page.waitForTimeout(1500);
  const txt = await page.locator('#infoBody').innerText();
  if (txt.includes('A carregar')) throw new Error('instrucoes nunca chegaram');
  if (txt.length < 80) throw new Error(`ficha vazia: ${txt}`);
  if (!txt.includes('Gym visual')) throw new Error('falta a atribuicao obrigatoria a Gym visual');
});
await page.screenshot({ path: join(SHOTS, 'ficha-catalogo.png') });
await stepClean('remover exercicio novo', async () => {
  page.once('dialog', d => d.accept());
  await click('[onclick*="toggleEdit"]');
  const n = await page.locator('.ed-row').count();
  await page.locator('.ed-row').last().locator('.ed-del').click();
  await page.waitForTimeout(300);
  if (await page.locator('.ed-row').count() !== n - 1) throw new Error('nao removeu');
  await click('[onclick*="toggleEdit"]');
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

/* ── agenda dinamica (Fase 2) ───────────────────────────────────────────── */
await stepClean('concluir treino da Segunda', async () => {
  await click('.wk-chip[data-day="Segunda"]');
  await click('[onclick*="toggleDayDone"]');
  await page.waitForTimeout(200);
  const done = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).sched.done);
  if (!done || !done['Segunda']) throw new Error('o treino nao ficou marcado como concluido');
  if (!(await page.locator('.wk-chip[data-day="Segunda"].s-done').count())) throw new Error('a tira da semana nao mostra o dia como feito');
});
await step('Hoje salta o dia ja feito', async () => {
  await click('.tab[data-day="__hoje"]');
  const cur = await page.evaluate(async () => (await import('./js/schedule.js')).currentDay());
  if (cur === 'Segunda') throw new Error('Segunda concluida continua a ser o treino atual');
});
await step('reabrir treino', async () => {
  await click('.wk-chip[data-day="Segunda"]');
  await click('[onclick*="toggleDayDone"]');
  await page.waitForTimeout(200);
  const done = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).sched.done);
  if (done && done['Segunda']) throw new Error('o treino continua marcado como concluido');
});
await stepClean('marcar dia de descanso', async () => {
  await click('.wk-chip[data-day="Terça"]');
  await click('[onclick*="toggleEdit"]');
  await page.locator('.ed-check input').check();
  await page.waitForTimeout(200);
  const rest = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).routine['Terça'].rest);
  if (rest !== true) throw new Error('a flag de descanso nao ficou gravada');
  await page.locator('.ed-check input').uncheck();
  await page.waitForTimeout(200);
  await click('[onclick*="toggleEdit"]');
});

let trocaOriginal = null;
await stepClean('trocar exercicio por equivalente', async () => {
  await click('.wk-chip[data-day="Segunda"]');
  const antes = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')).routine['Segunda'].ex[0]);
  trocaOriginal = antes.name;
  await click('.act-swap');
  await page.waitForSelector('.cat-swap', { timeout: 8000 });
  await page.waitForSelector('.cat-row', { timeout: 8000 });
  const sugerido = await page.locator('.cat-name').first().innerText();
  await page.locator('.cat-row').first().click();
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
  const novo = st.routine['Segunda'].ex[0];
  if (novo.name !== sugerido) throw new Error(`trocou para "${novo.name}" em vez de "${sugerido}"`);
  if (novo.s !== antes.s || novo.r !== antes.r) throw new Error('a troca perdeu as series/reps do plano');
  if (!st.sched.swaps['Segunda:0']) throw new Error('a troca temporaria nao guardou o original');
  await page.screenshot({ path: join(SHOTS, 'troca.png') });
});
await step('repor exercicio trocado', async () => {
  if (!(await page.locator('.card-swap').count())) throw new Error('cartao nao avisa que esta trocado');
  await click('.card-swap .linklike');
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
  if (st.routine['Segunda'].ex[0].name !== trocaOriginal) throw new Error(`repos "${st.routine['Segunda'].ex[0].name}" em vez de "${trocaOriginal}"`);
  if (st.sched.swaps['Segunda:0']) throw new Error('o original ficou guardado depois de reposto');
});

/* ── treino personalizado: só hoje, o plano normal não muda ─────────────── */
const lerST = () => page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
const plano0 = JSON.stringify((await lerST()).routine);
const diaAntes = (await lerST()).day;

await page.locator('.tab[data-day="__hoje"]').click();
await page.waitForTimeout(200);
await stepClean('personalizado: abrir', async () => {
  await click('button.cu-entry');
  await page.waitForSelector('.cu-chip', { timeout: 3000 });
});
await step('personalizado: sem musculos avisa', async () => {
  await click('text=Sugerir treino');
  await page.waitForSelector('.sched-note.warn', { timeout: 3000 });
  if ((await lerST()).custom) throw new Error('criou treino sem musculos escolhidos');
});
await step('personalizado: peito + triceps', async () => {
  await page.locator('.cu-chip', { hasText: 'Peito' }).click();
  await page.locator('.cu-chip', { hasText: 'Tríceps' }).click();
  await click('text=Sugerir treino');
  await page.waitForSelector('.cu-row', { timeout: 8000 });
  const n = await page.locator('.cu-row').count();
  if (n !== 6) throw new Error(`esperava 6 exercicios, vieram ${n}`);
  await page.screenshot({ path: join(SHOTS, 'personalizado-revisao.png'), fullPage: true });
});
await step('personalizado: remover exercicio', async () => {
  await click('.cu-row button[aria-label="Remover"]');
  await page.waitForTimeout(150);
  if ((await page.locator('.cu-row').count()) !== 5) throw new Error('remover nao tirou o exercicio');
});
await step('personalizado: trocar abre o catalogo', async () => {
  await click('.cu-row button[aria-label="Trocar"]');
  await page.waitForSelector('#catBg.show .cat-row', { timeout: 8000 });
  if (await page.locator('#catFilters .cat-swap .cat-chip').count()) throw new Error('trocar sempre / so esta semana nao se aplica ao personalizado');
  await page.evaluate(() => window.closeCatalog());
});
await step('personalizado: comecar treino', async () => {
  await click('text=Começar treino');
  await page.waitForSelector('.card', { timeout: 3000 });
  if ((await page.locator('.card').count()) !== 5) throw new Error('cartoes != 5');
  await click('.card .set-btn');
  await page.waitForTimeout(150);
  const st = await lerST();
  if (!st.sets['Personalizado:0'] || !st.sets['Personalizado:0'].length) throw new Error('serie do personalizado nao ficou registada');
  if (st.day !== diaAntes) throw new Error('ST.day mudou durante o personalizado');
  await page.screenshot({ path: join(SHOTS, 'personalizado-treino.png'), fullPage: true });
});
await step('personalizado: treino guiado', async () => {
  await click('text=▶ Guiado');
  await page.waitForSelector('#woBg.show', { timeout: 3000 });
  await click('.wo-close');
  await page.waitForSelector('.card', { timeout: 3000 });
});
await step('personalizado: reload mantem o treino', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.card', { timeout: 3000 });
  const st = await lerST();
  if (!st.custom || st.custom.stage !== 'active') throw new Error('o treino personalizado perdeu-se no reload');
});
await step('personalizado: Hoje mostra o treino em curso', async () => {
  await page.locator('.tab[data-day="__hoje"]').click();
  await page.waitForSelector('.sched-note.cu-entry', { timeout: 3000 });
  await click('.sched-note.cu-entry .cat-chip');
  await page.waitForSelector('.card', { timeout: 3000 });
});
await step('personalizado: concluir', async () => {
  await click('text=Concluir treino');
  await page.waitForSelector('.rest-title', { timeout: 3000 });
  const st = await lerST();
  if (st.sessions.length !== 1 || st.sessions[0].kind !== 'custom') throw new Error('sessao nao ficou no historico');
  if (JSON.stringify(st.routine) !== plano0) throw new Error('o plano normal foi alterado');
  if (Object.keys(st.sets).some(k => k.startsWith('Personalizado:'))) throw new Error('sobraram series do personalizado');
  const subs = Object.keys(st.sched.replaced || {});
  if (subs.length !== 1 || (st.sched.done || {})[subs[0]]) throw new Error('o personalizado devia substituir 1 dia sem o marcar feito');
  if (st.sessions[0].replaced !== subs[0]) throw new Error('a sessao nao regista o dia substituido');
  await page.screenshot({ path: join(SHOTS, 'personalizado-concluido.png'), fullPage: true });
});
await step('personalizado: Hoje volta ao plano normal', async () => {
  await click('text=Voltar a Hoje');
  await page.waitForSelector('.day-hdr', { timeout: 3000 });
  if (!(await page.locator('button.cu-entry').count())) throw new Error('o botao do personalizado nao voltou');
  if (!(await page.locator('.wk-chip.s-swapped').count())) throw new Error('a tira da semana nao mostra o dia substituido');
  const st = await lerST();
  /* o dia substituído saiu da fila: o treino atual passa ao seguinte */
  if (st.day === Object.keys(st.sched.replaced)[0] || !st.routine[st.day]) throw new Error('ST.day devia passar ao treino seguinte, e ser um dia real');
});

await page.locator('.tab[data-day="__hoje"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: join(SHOTS, 'hoje.png'), fullPage: true });
await page.locator('.tab[data-day="__semana"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: join(SHOTS, 'semana.png'), fullPage: true });
await page.locator('.wk-chip[data-day="Segunda"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: join(SHOTS, 'segunda.png'), fullPage: true });
await page.locator('.tab[data-day="__perfil"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: join(SHOTS, 'perfil.png'), fullPage: true });

await browser.close();
server.close();

if (fail.length) { console.error(`FALHOU (${fail.length}):\n  ` + fail.join('\n  ')); process.exit(1); }
console.log('OK - app real no Chromium: 0 erros de consola, 0 pedidos falhados, tudo clicavel responde.');
