import { dialogResponder, settleDialog } from './_dialogs.mjs';
/* Acolhimento + plano + Hoje no app real (Chromium, 412px, toque) — npm run test:onboarding
   Percursos: utilizador NOVO (retoma a meio, confirma, treina) e utilizador EXISTENTE (histórico intacto,
   sem acolhimento imposto, plano novo opcional com cópia e reposição). Falha com qualquer erro de consola. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const PORT = +process.env.PORT || 8129;
const SHOTS = join(ROOT, 'test-results');
mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = join(ROOT, p.split('/').filter(s => s && s !== '..').join('/'));
  if (!existsSync(file)) { res.writeHead(404).end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));
const URL_ = `http://localhost:${PORT}/index.html`;
const fail = [], errors = [];
const check = (c, m) => { if (!c) fail.push(m); };
const browser = await chromium.launch();

async function newPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, screen: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await dialogResponder(page, () => true, errors);
  if (seed) await page.addInitScript(s => { try { if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify(s)); } catch (_) { /* sem storage */ } }, seed);
  await page.goto(URL_, { waitUntil: 'networkidle' });
  return page;
}
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
const shown = (page, sel) => page.locator(sel).isVisible();
const shot = (page, n) => page.screenshot({ path: join(SHOTS, `onb-${n}.png`) });
const tap = async (page, text) => { await page.locator('#onbBg').getByRole('button', { name: text }).first().tap(); await settleDialog(page); };

/* ═══ 1. UTILIZADOR NOVO ═══════════════════════════════════════════════════ */
{
  const page = await newPage(null);
  check(await shown(page, '#onbBg.show'), 'novo: o acolhimento devia abrir sozinho');
  check(/O que queres alcançar/.test(await page.locator('#onbBody h1').innerText()), 'novo: 1.º passo errado');
  await shot(page, '1-objetivo');
  await tap(page, /Ganhar força/);
  check(await page.evaluate(() => document.getElementById('onbBody').contains(document.activeElement) && document.activeElement.tagName === 'BUTTON'), 'a11y: escolher uma opção não devia perder o foco do teclado');
  await tap(page, 'Continuar');
  check(await page.evaluate(() => document.activeElement.tagName === 'H1'), 'a11y: mudar de passo devia mover o foco para o título');
  check(await page.evaluate(() => document.getElementById('timerBanner').inert && document.getElementById('content').inert), 'a11y: o resto da app devia ficar inerte com o overlay aberto');
  check(/Quando consegues treinar/.test(await page.locator('#onbBody h1').innerText()), 'novo: 2.º passo errado');
  check(/3 dias por semana/.test(await page.locator('#onbBody').innerText()), 'novo: dias predefinidos sensatos (3)');
  await tap(page, 'Ter');
  check(/4 dias por semana/.test(await page.locator('#onbBody').innerText()), 'novo: escolher um dia devia dar 4');
  await tap(page, 'Ter');
  await shot(page, '2-dias');
  /* regras: nunca menos de 2 dias */
  await tap(page, 'Qua'); await tap(page, 'Sex');
  check(await page.locator('#onbBody .ob-btn').first().isDisabled(), 'novo: com 1 dia não devia deixar continuar');
  await tap(page, 'Qua'); await tap(page, 'Sex');
  await tap(page, 'Continuar');

  /* retomar: recarregar a meio volta ao mesmo passo com as respostas guardadas */
  await page.reload({ waitUntil: 'networkidle' });
  check(await shown(page, '#onbBg.show') && /Como treinas/.test(await page.locator('#onbBody h1').innerText()), 'novo: depois de recarregar devia retomar no passo 3');
  const d1 = (await state(page)).onb.draft;
  check(d1.goal === 'forca' && d1.days.join() === 'Segunda,Quarta,Sexta', 'novo: respostas perdidas ao recarregar');
  await tap(page, 'Continuar');
  await tap(page, 'Joelhos');
  await page.locator('#onbBody input').fill('Ana');
  await shot(page, '3-limites');
  await tap(page, 'Ver a minha proposta');
  const prop = await page.locator('#onbBody').innerText();
  check(/Ana, esta é a tua semana/.test(prop) && /Porquê assim/.test(prop) && /joelhos/.test(prop), 'novo: proposta sem nome/explicação/limitação');
  await shot(page, '4-proposta');
  const antes = await state(page);
  check(!antes.plan, 'novo: o plano não devia estar aplicado antes de confirmar');
  await tap(page, 'Confirmar e começar');

  check(!(await shown(page, '#onbBg.show')), 'novo: o acolhimento devia fechar');
  const st = await state(page);
  check(st.plan && st.prefs.name === 'Ana' && st.onb.done && Object.keys(st.routine).length === 7, 'novo: plano/preferências não ficaram persistidos');
  check(Object.values(st.routine).every(d => d.id), 'novo: dias sem id');
  const hero = await page.locator('.hero').innerText();
  check(/Ana/.test(hero) && /Corpo inteiro [ABC]/.test(hero) && /min/.test(hero), `novo: cartão Hoje sem nome/treino/duração: ${hero}`);
  check(!/Em atraso/.test(await page.locator('#content').innerText()), 'novo: um plano criado a meio da semana não pode começar "em atraso"');
  await page.waitForTimeout(300);
  await shot(page, '5-hoje');

  /* treino REAL a partir do Hoje */
  await page.locator('.hero .start-wo').tap();
  await page.waitForSelector('#woBg.show');
  check((await state(page)).session && (await state(page)).session.state === 'ACTIVE', 'novo: o botão Começar treino devia iniciar a sessão real');
  await shot(page, '6-treino');
  check(await page.locator('#wo-r').inputValue() === '8', 'novo: reps devia vir pré-preenchido com o início da gama (8)');
  await page.locator('#wo-w').fill('20');
  await page.locator('.wo-main').tap({ force: true });
  await page.waitForTimeout(300);
  const st2 = await state(page);
  check(Object.values(st2.sets).some(a => a.length), 'novo: a série devia ficar registada no motor real');
  await page.reload({ waitUntil: 'networkidle' });
  const st3 = await state(page);
  check(st3.session && Object.values(st3.sets).some(a => a.length) && await shown(page, '#woBg.show'), 'novo: o treino devia sobreviver ao reload');
  await page.evaluate(() => { window.closeWorkout(); });

  /* não repetir o acolhimento */
  await page.reload({ waitUntil: 'networkidle' });
  check(!(await shown(page, '#onbBg.show')), 'novo: o acolhimento não devia voltar depois de concluído');

  /* Perfil: rever e reorganizar sem repetir o acolhimento */
  await page.evaluate(() => { if (document.getElementById('woBg').classList.contains('show')) window.closeWorkout(); });
  await page.locator('#bnav').getByText('Evolução').tap();
  check(/O meu plano/.test(await page.locator('#content').innerText()), 'novo: Perfil sem o cartão do plano');
  await shot(page, '7-perfil');
  await page.getByRole('button', { name: /Reorganizar a semana/ }).tap();
  check(await shown(page, '#onbBg.show') && /Reorganizar/.test(await page.locator('#onbBody h1').innerText()), 'novo: reorganizar não abriu');
  /* há treino em curso: o dia dele não pode mover-se; o resto troca-se à vontade (inclusive para um dia de descanso) */
  const base = await state(page), live = base.session.day;
  const WK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const other = WK.find(d => d !== live);
  await tap(page, new RegExp(`^${live}`)); await tap(page, new RegExp(`^${other}`));
  check(/em curso/.test(await page.locator('#onbBody').innerText()), 'novo: devia recusar mover o dia do treino em curso');
  const treino = WK.find(d => d !== live && base.routine[d].ex.length), descanso = WK.find(d => d !== live && !base.routine[d].ex.length);
  const labelT = base.routine[treino].label;
  await tap(page, new RegExp(`^${treino}`)); await tap(page, new RegExp(`^${descanso}`));
  await shot(page, '8-reorganizar');
  const st4 = await state(page);
  check(!st4.routine[treino].ex.length && st4.routine[descanso].label === labelT && st4.routine[descanso].ex.length > 0, `novo: ${treino}↔${descanso} não trocou os treinos`);
  await tap(page, 'Pronto');
  check(!(await shown(page, '#onbBg.show')), 'novo: Pronto devia fechar');
  await page.context().close();
}

/* ═══ 2. UTILIZADOR EXISTENTE (histórico) ═════════════════════════════════ */
{
  const mk = (n, w, r, d) => ({ date: d, ts: `${d}T10:00:00.000Z`, w, r, sets: [{ w, r, ts: `${d}T10:00:00.000Z`, k: 'Segunda:0' }] });
  const log = { 'Leg press': [mk(1, 100, 10, '2026-09-01'), mk(1, 110, 10, '2026-09-08'), mk(1, 120, 8, '2026-09-15')], 'Supino reto': [mk(1, 60, 8, '2026-09-02')] };
  const seed = { day: 'Segunda', sets: {}, done: {}, log, prog: { 'Leg press': { scheme: 'double', step: 5 } }, measures: [{ date: '2026-09-01', weight: 80 }], workouts: [{ id: 'w1', day: 'Segunda', date: '2026-09-01', state: 'COMPLETED' }], sessions: [] };
  const page = await newPage(seed);
  check(!(await shown(page, '#onbBg.show')), 'existente: não devia ver o acolhimento');
  let st = await state(page);
  check(st.onb && st.onb.done && st.onb.legacy, 'existente: devia ficar marcado como dispensado');
  check(JSON.stringify(st.log) === JSON.stringify(log) && st.workouts.length === 1 && st.measures.length === 1, 'existente: a migração alterou o histórico');
  check(Object.values(st.routine).every(d => d.id && d.ex.every(e => e.id)), 'existente: ids em falta');
  const pre = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2_premigration')));
  check(pre && JSON.stringify(pre.state.log) === JSON.stringify(log), 'existente: falta a cópia original verificada');
  check(await shown(page, '.hero'), 'existente: o ecrã Hoje devia mostrar o próximo treino');
  await shot(page, '9-existente-hoje');

  /* histórico continua visível */
  await page.locator('#bnav').getByText('Histórico').tap();
  await page.waitForTimeout(200);
  check(/Leg press|Segunda|Semana/.test(await page.locator('#content').innerText()), 'existente: Histórico vazio');

  /* plano novo opcional, com cópia e reposição */
  await page.locator('#bnav').getByText('Evolução').tap();
  const routineBefore = JSON.stringify(st.routine);
  await shot(page, '10-existente-perfil');
  await page.getByRole('button', { name: /Criar plano novo/ }).tap();
  await tap(page, /Reduzir gordura/); await tap(page, 'Continuar'); await tap(page, 'Continuar'); await tap(page, 'Continuar');
  await tap(page, 'Ver a minha proposta'); await tap(page, 'Confirmar e começar');
  st = await state(page);
  check(JSON.stringify(st.log) === JSON.stringify(log) && JSON.stringify(st.prog) === JSON.stringify(seed.prog) && st.workouts.length === 1, 'existente: o plano novo tocou no histórico/progressão');
  check(st.routine.Segunda.label !== 'Pernas & Ombros' && st.plan, 'existente: a rotina não mudou');
  const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2_snap')));
  check(snap && JSON.stringify(snap.state.routine) === routineBefore, 'existente: a cópia anterior ao plano não é a rotina antiga');
  await page.locator('#bnav').getByText('Evolução').tap();
  await page.getByRole('button', { name: /Repor o estado anterior/ }).tap(); await settleDialog(page);
  await page.waitForTimeout(200);
  st = await state(page);
  check(JSON.stringify(st.routine) === routineBefore && JSON.stringify(st.log) === JSON.stringify(log), 'existente: repor devia devolver a rotina e o histórico');
  await page.context().close();
}

/* ═══ 3. ARMAZENAMENTO CHEIO: o erro vê-se ════════════════════════════════ */
{
  const page = await newPage({ onb: { done: true, skipped: true, step: 0, draft: {} } });
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  await page.locator('#bnav').getByText('Evolução').tap();
  await page.evaluate(() => window.render('__hoje'));
  await page.waitForTimeout(200);
  check(await shown(page, '#notice.show.err'), 'quota: o erro de gravação devia aparecer ao utilizador');
  await shot(page, '11-erro-gravacao');
  await page.context().close();
}

/* ═══ 4. LARGURAS PEQUENAS: alvos ≥44 px e sem scroll horizontal ══════════ */
for (const w of [320, 360]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 640 }, screen: { width: w, height: 640 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await dialogResponder(page, () => true, errors);
  await page.goto(URL_, { waitUntil: 'networkidle' });
  const audit = async tag => {
    const r = await page.evaluate(() => ({
      h: document.documentElement.scrollWidth > window.innerWidth || document.getElementById('onbBody').scrollWidth > document.getElementById('onbBody').clientWidth,
      small: [...document.querySelectorAll('#onbBg button, #onbBg input, #onbBg summary')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 44 || b.height < 44); }).map(e => `${e.className || e.tagName}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
    }));
    check(!r.h, `${w}px ${tag}: scroll horizontal`);
    check(!r.small.length, `${w}px ${tag}: alvos <44 px: ${r.small.join(',')}`);
  };
  await audit('objetivo'); await tap(page, 'Continuar'); await audit('dias'); await tap(page, 'Continuar'); await audit('experiência');
  await tap(page, 'Continuar'); await audit('limites'); await tap(page, 'Ver a minha proposta');
  await page.locator('#onbBody summary').first().tap(); await audit('proposta');
  await tap(page, 'Confirmar e começar');
  const hs = await page.evaluate(() => [...document.querySelectorAll('.hero button, .hero summary')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 44 || b.height < 44); }).map(e => e.className || e.tagName));
  check(!hs.length, `${w}px Hoje: alvos <44 px no cartão: ${hs.join(',')}`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `${w}px Hoje: scroll horizontal`);
  await ctx.close();
}

await browser.close(); server.close();
if (errors.length) fail.push(`erros de consola: ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
if (fail.length) { console.error(`FALHOU (${fail.length}):\n  ` + fail.join('\n  ')); process.exit(1); }
console.log('OK — acolhimento, plano e Hoje no app real: utilizador novo (retoma, treino real, reorganizar) e existente (histórico, cópia, reposição), 0 erros de consola.');
