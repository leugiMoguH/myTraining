/* Percursos integrados: um Chromium, contextos isolados em sequencia. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serve } from './a11y-lib.mjs';
import { skipOnboarding } from './_skip-onb.mjs';
const server = await serve(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const errors = [], errorStacks = [];
let context;
async function open(skip = true) {
  if (context) await context.close();
  context = await browser.newContext({ viewport: { width: 412, height: 900 }, timezoneId: 'Europe/Lisbon', acceptDownloads: true });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  p.on('pageerror', e => { errors.push(e.message); errorStacks.push(e.stack); });
  p.on('dialog', d => { errors.push('Dialogo nativo: ' + d.message()); void d.dismiss(); });
  await p.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
  if (skip) await skipOnboarding(p);
  await p.goto(url, { waitUntil: 'networkidle' });
  return p;
}
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
const persisted = p => p.evaluate(() => localStorage.getItem('treino_v2'));
const normalize = s => Object.fromEntries(['log', 'workouts', 'measures', 'routine', 'prefs', 'profile'].map(k => [k, s[k]]));
async function answer(p, yes) {
  const d = p.locator('.app-dialog-bg');
  await d.waitFor();
  await d.getByRole('button').nth(yes ? -1 : 0).click();
  await d.waitFor({ state: 'detached' });
  await p.evaluate(() => new Promise(r => setTimeout(r, 0)));
}
async function record(p, w = '25') {
  await p.locator('#wo-w').fill(w); await p.locator('#wo-r').fill('8');
  await p.locator('[onclick="woDoSet()"]').click();
}
async function importFile(p, text, decision) {
  await p.evaluate(text => {
    window.__importDone = false;
    const input = document.createElement('input'); input.type = 'file';
    const dt = new DataTransfer(); dt.items.add(new File([text], 'backup.json', { type: 'application/json' })); input.files = dt.files;
    import('./js/backup.js').then(m => m.importBackup({ target: input })).finally(() => { window.__importDone = true; });
  }, text);
  if (decision !== undefined) await answer(p, decision);
  await p.waitForFunction(() => window.__importDone);
}
async function focusInside(p, id) {
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(id => document.getElementById(id).contains(document.activeElement), id)) return;
    await p.waitForTimeout(50);
  }
  console.error('focus failure', await p.evaluate(id => ({id, active:document.activeElement.outerHTML.slice(0,150), visibility:getComputedStyle(document.getElementById(id)).visibility, focus:document.hasFocus(), frames:document.getElementById(id).getBoundingClientRect().toJSON()}), id));
  assert.fail('foco dentro de ' + id);
}
try {
  // J1 so liga acolhimento, sessao e os dois destinos finais; regras do plano ficam nas suites existentes.
  let p = await open(false);
  await p.locator('#onbBg.show').waitFor();
  const tap = text => p.locator('#onbBg').getByRole('button', { name: text, exact: true }).click();
  await tap('Continuar'); await tap('Continuar'); await tap('Continuar');
  await tap('Ver a minha proposta'); await tap(/Confirmar e/);
  assert((await state(p)).plan);
  await p.locator('.hero .start-wo').click();
  await record(p);
  await p.clock.runFor(500);
  await p.evaluate(() => window.timerDismiss());
  await record(p, '27');
  await p.locator('.wo-end').click(); await answer(p, true);
  const completed = await state(p);
  assert.equal(completed.workouts.at(-1).state, 'COMPLETED');
  const name = Object.keys(completed.log)[0];
  assert.equal(completed.log[name][0].sets.length, 2);
  await p.locator('#mvBg.show').getByRole('button', { name: 'Concluir', exact: true }).click();   /* celebração do treino */
  await p.locator('#bnav').locator('[data-day="__hist"]').click();
  assert.match(await p.locator('#content').innerText(), /Treinos recentes/);
  assert.match(await p.locator('#content').innerText(), new RegExp(completed.workouts.at(-1).label));
  await p.locator('#bnav').locator('[data-day="__perfil"]').click();
  assert((await p.locator('#content').innerText()).includes(name));
  console.log('OK J1 novo -> plano -> duas series -> terminar -> Historico/Evolucao');

  // J2 exportacao real e importacao noutro perfil Chromium, com sentinelas.
  p = await open();
  await p.evaluate(async () => {
    const { ST, save } = await import('./js/state.js');
    ST.log = { 'Carga ficticia': [{ date: '2026-10-20', w: 42, r: 8, sets: [{ w: 42, r: 8 }] }] };
    ST.workouts = [{ id: 'fixture', day: 'Segunda', label: 'Ficticio', state: 'COMPLETED', date: '2026-10-20', startedAt: 1792486800000, endedAt: 1792487400000, pausedMs: 0, confirmedMs: 600000 }];
    ST.measures = [{ date: '2026-10-20', weight: 72 }]; ST.profile = { height: 175, sex: 'm' };
    ST.prefs = { name: 'Backup ficticio', days: ['Segunda', 'Quarta'], goal: 'forca' };
    ST.routine.Segunda.label = 'Rotina ficticia';
    localStorage.setItem('treino_drafts', JSON.stringify({ v: 1, forms: { profile: { height: '999' } } })); save();
  });
  const downloaded = p.waitForEvent('download');
  await p.evaluate(() => window.exportBackup());
  const download = await downloaded;
  const payload = await readFile(await download.path(), 'utf8');
  const exported = JSON.parse(payload).state;
  assert.equal(exported.routine.Segunda.label, 'Rotina ficticia');
  p = await open();
  await p.evaluate(async () => {
    const { ST, save } = await import('./js/state.js'); ST.log = { Sentinel: [{ date: '2026-10-19', w: 1, r: 1 }] };
    ST.profile = { height: 199 }; save(); localStorage.setItem('treino_drafts', '{"v":1,"forms":{"profile":{"height":"198"}}}');
  });
  let before = await persisted(p);
  await importFile(p, payload, false); assert.equal(await persisted(p), before);
  await importFile(p, payload, true);
  assert.deepEqual(normalize(await state(p)), normalize(exported));
  assert(await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('treino_drafts') || '{}'); return Object.values(d).every(v => !v || !Object.keys(v).length); }));
  console.log('OK J2 download real, contexto novo, round-trip e cancelar; drafts limpos');
  for (const [label, text] of [
    ['JSON ilegivel', '{broken'],
    ['log nao-objeto', JSON.stringify({ ...exported, log: [] })],
    ['workouts nao-array', JSON.stringify({ ...exported, workouts: {} })],
    ['sets como string', JSON.stringify({ ...exported, log: { Broken: [{ date: '2026-10-20', w: 1, r: 1, sets: 'bad' }] } })],
  ]) {
    before = await persisted(p);
    await importFile(p, text);
    assert.equal(await p.locator('.app-dialog-bg').count(), 0, label + ': rejeitar antes de confirmar');
    assert.equal(await persisted(p), before, label + ': estado intacto');
    assert.match(await p.locator('#notice.show').innerText(), /importar/i);
    console.log('OK J2 rejeicao: ' + label);
  }
  for (const key of ['treino_v2_snap', 'treino_v2']) {
    before = await persisted(p);
    await p.evaluate(key => {
      window.__setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('quota', 'QuotaExceededError'); return window.__setItem.call(this, k, v); };
    }, key);
    await importFile(p, JSON.stringify({ ...exported, profile: { height: 188 } }), true);
    assert.equal(await persisted(p), before);
    assert.deepEqual(await p.evaluate(async () => (await import('./js/state.js')).ST.profile), exported.profile);
    await p.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
    console.log('OK J2 falha de storage em ' + key + ': persistencia e memoria preservadas');
  }

  // J3 espera explicitamente pelo controlador e por cada entrada CORE antes de desligar a rede.
  p = await open();
  await p.evaluate(async () => {
    const { ST, save } = await import('./js/state.js');
    ST.workouts = [{ id: 'prior', date: '2026-10-20', day: 'Segunda', label: 'Anterior', state: 'COMPLETED', startedAt: 1792486800000, endedAt: 1792487400000 }]; save();
    window.startWorkout('Segunda');
  });
  await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  const core = /const CORE = (\[[\s\S]*?\]);/.exec(await readFile(new URL('../sw.js', import.meta.url), 'utf8'))[1];
  await p.waitForFunction(async paths => { const c = await caches.open('treino-v44'); return (await Promise.all(paths.map(u => c.match(new URL(u, location.href))))).every(Boolean); }, Function('return ' + core)());
  const prior = (await state(p)).workouts;
  const sid = (await state(p)).session.id;
  await context.setOffline(true);
  await record(p);
  let saved = await state(p);
  await p.reload({ waitUntil: 'load' });
  assert.equal((await state(p)).session.id, sid);
  const sessionFields = s => Object.fromEntries(['id','day','date','wk','state','pos','startedAt','pausedMs','pauseAt'].map(k => [k, s[k]]));
  assert.deepEqual(sessionFields((await state(p)).session), sessionFields(saved.session));
  assert.deepEqual((await state(p)).log, saved.log);
  assert.deepEqual((await state(p)).sets, saved.sets);
  await p.evaluate(async () => { const { ST } = await import('./js/state.js'); (await import('./js/workout.js')).openWorkout(ST.session.day, ST.session.pos); window.woGo(1); });
  const originalExercise = (await state(p)).routine.Segunda.ex[1].name;
  await p.locator('[onclick="woSwap()"]').click();
  await p.locator('.cat-row').first().click();
  assert.notEqual((await state(p)).routine.Segunda.ex[1].name, originalExercise);
  await focusInside(p, 'woBg');
  await p.evaluate(() => window.woPause()); assert.equal((await state(p)).session.state, 'PAUSED');
  await p.evaluate(() => window.woPause()); assert.equal((await state(p)).session.state, 'ACTIVE');
  await p.evaluate(() => window.closeWorkout());
  before = await persisted(p);
  await p.locator('#navDrop').click(); await answer(p, false);
  assert.equal(await persisted(p), before);
  await p.locator('#navDrop').click(); await answer(p, true);
  assert.equal((await state(p)).session.state, 'ABANDONED');
  assert.deepEqual((await state(p)).workouts.slice(0, prior.length), prior);
  assert.deepEqual((await state(p)).log, saved.log);
  console.log('OK J3 offline com CORE completa, serie/reload sem duplicar, troca, pausa/retoma, descarte cancelado/confirmado');
  await context.setOffline(false);
  p = await open();
  await p.evaluate(async () => {
    Storage.prototype.getItem = function() { throw new Error('storage unavailable'); };
    Storage.prototype.setItem = function() { throw new Error('storage unavailable'); };
    (await import('./js/state.js')).save();
  });
  assert(await p.locator('#notice.show').isVisible());
  assert(await p.locator('#content').isVisible());
  console.log('OK J3 storage indisponivel durante uso: app visivel e app-notice');

  // J4 teclado, overlays empilhados e duas corridas assincronas da camara.
  p = await open();
  await p.evaluate(() => { window.render('__hist'); window.render('Segunda'); });
  await p.locator('#content button').first().focus();
  await p.evaluate(async () => { window.__origin = document.activeElement; (await import('./js/catalog-ui.js')).openCatalog('Segunda'); });
  await p.locator('#catQ').waitFor(); await p.waitForTimeout(250); await focusInside(p, 'catBg');
  assert(await p.locator('#catQ').evaluate(e => e === document.activeElement));
  assert(await p.locator('#content').evaluate(e => e.inert));
  await p.locator('.cat-close').focus(); await p.keyboard.press('Tab'); await focusInside(p, 'catBg');
  await p.locator('#catQ').focus(); await p.keyboard.press('Shift+Tab'); await focusInside(p, 'catBg');
  await p.keyboard.press('Escape');
  assert(await p.evaluate(() => document.activeElement === window.__origin));
  await p.evaluate(async () => (await import('./js/catalog-ui.js')).openCatalog('Segunda')); await p.locator('.cat-row').first().click();
  assert(await p.evaluate(() => document.activeElement !== document.body && document.activeElement.isConnected && !document.activeElement.closest('[inert]')));
  await p.evaluate(() => window.startWorkout('Segunda'));
  await p.locator('[onclick="woSwap()"]').click();
  assert(await p.locator('#woBg').evaluate(e => e.inert));
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#woBg.show').count(), 1);
  assert.equal(await p.locator('#woBg').evaluate(e => e.inert), false);
  assert(await p.locator('#content').evaluate(e => e.inert));
  await focusInside(p, 'woBg');
  await p.locator('[onclick="woSwap()"]').click(); await p.locator('.cat-row').first().click(); await focusInside(p, 'woBg');
  await p.evaluate(() => window.closeWorkout());
  // Fechar a camada inferior primeiro nao deixa os locks presos.
  await p.evaluate(async () => { window.openSheet(); (await import('./js/catalog-ui.js')).openCatalog('Segunda'); window.closeSheet(); });
  assert(await p.locator('#content').evaluate(e => e.inert));
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#content').evaluate(e => e.inert), false);
  await p.evaluate(() => {
    window.__stopped = 0; window.__pending = false;
    window.BarcodeDetector = class { async detect() { return []; } };
    HTMLMediaElement.prototype.play = async function() {};
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, get() { return this.__stream; }, set(v) { this.__stream = v; } });
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => {
      const stream = { getTracks: () => [{ stop() { window.__stopped++; } }] };
      if (window.__pending) window.__resolveCamera = () => resolve(stream); else resolve(stream);
    });
  });
  await p.locator('#content button').first().focus();
  await p.evaluate(() => { window.__origin = document.activeElement; void window.scanBarcode(); });
  await p.waitForFunction(async () => !!(await import('./js/nutrition.js')).scanStream);
  assert(await p.locator('.scan-close').evaluate(e => e === document.activeElement));
  await p.keyboard.press('Tab'); await focusInside(p, 'scanBg');
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => window.__stopped), 1);
  assert(await p.evaluate(() => document.activeElement === window.__origin));
  await p.evaluate(() => { window.__pending = true; void window.scanBarcode(); });
  await p.keyboard.press('Escape'); await p.evaluate(() => window.__resolveCamera());
  await p.waitForFunction(() => window.__stopped === 2);
  assert.equal(await p.locator('#scanBg.show').count(), 0);
  assert.equal(await p.evaluate(async () => (await import('./js/nutrition.js')).scanStream), null);
  assert.equal(await p.locator('#scanVid').evaluate(e => e.srcObject), null);
  console.log('OK J4 foco/Tab/Esc dia e guiado; add/swap; fecho fora de ordem; camara normal e tardia parada');
  assert.deepEqual(errors, []);
  p = await open();
  await p.addInitScript(() => {
    Storage.prototype.getItem = function() { throw new Error('storage unavailable'); };
    Storage.prototype.setItem = function() { throw new Error('storage unavailable'); };
  });
  await p.reload({ waitUntil: 'networkidle' });
  if (errors.length) console.error('J3 storage startup:', errorStacks.join('\n'));
  assert.deepEqual(errors, [], 'J3 arranque com storage indisponivel nao pode causar pageerror (timer.js/wake.js fora do ambito)');
  assert(await p.locator('#notice.show').isVisible(), 'J3 arranque deve mostrar app-notice');
  console.log('PASS test:journeys (J1-J4; sem pageerror/dialogos nativos)');
} finally {
  if (context) await context.close();
  await browser.close();
  await new Promise(r => server.close(r));
}
