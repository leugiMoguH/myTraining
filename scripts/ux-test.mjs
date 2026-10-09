/* Teste de UX real (Chromium, toque) — corre com: npm run test:ux
   Não confirma só que os elementos existem: toca neles com o ecrã tátil, verifica que o elemento no ponto do
   toque é mesmo o controlo (não está tapado), que nada se sobrepõe, que não há scroll horizontal, que o contraste
   cumpre WCAG AA e que cada toque provoca exatamente uma transição. Capturas em test-results/ux-*.png. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const SHOTS = join(ROOT, 'test-results');
const PORT = +process.env.PORT || 8125;
const T = +process.env.TEST_TIMEOUT || 10000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = join(ROOT, p.split('/').filter(s => s && s !== '..').join('/'));
  if (!existsSync(file)) { res.writeHead(404).end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));
mkdirSync(SHOTS, { recursive: true });

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };
const URL_ = `http://localhost:${PORT}/index.html`;
const browser = await chromium.launch();
const errors = [];

async function open(w, h, mobile = true) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, screen: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
  page.on('console', m => { if (m.type() === 'error') errors.push(`${w}px console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${w}px pageerror: ${e.message}`));
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(URL_, { waitUntil: 'networkidle' });
  return { ctx, page };
}

/* ── helpers de comportamento real ─────────────────────────────────────── */
const sess = page => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('treino_v2')).session; return s ? s.state : 'NONE'; });
/* o ponto central do elemento pertence mesmo a ele (não está tapado por outra camada) e está dentro do ecrã */
const hit = (page, sel) => page.evaluate(sel => {
  const e = document.querySelector(sel); if (!e) return false;
  const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (r.width < 1 || r.height < 1 || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
  const t = document.elementFromPoint(x, y); return !!t && (e === t || e.contains(t));
}, sel);
const tap = async (page, sel) => {
  await page.locator(sel).first().evaluate(e => { if (!e.closest('.wo-dock, .wo-bar, #bnav, .info-card')) e.scrollIntoView({ block: 'center', behavior: 'instant' }); });
  const r = await page.locator(sel).first().boundingBox();
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(130);
};
const holdTouch = async (page, ctx, sel, ms) => {
  const cdp = await ctx.newCDPSession(page);
  const r = await page.locator(sel).first().boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
};
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1);
/* caixas dos controlos acionáveis: nenhuma interseção entre pares (>2px) */
const overlaps = (page, scope) => page.evaluate(scope => {
  const els = [...document.querySelectorAll(scope)].filter(e => e.getBoundingClientRect().width > 0);
  const out = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
    const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 2 && iy > 2) out.push(`${els[i].className || els[i].tagName}~${els[j].className || els[j].tagName}`);
  }
  return out;
}, scope);
const small = (page, scope) => page.evaluate(scope => [...document.querySelectorAll(scope)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map(e => `${e.className || e.tagName}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`), scope);
/* contraste WCAG: cor do texto vs fundo composto dos antepassados */
const contrast = (page, sels) => page.evaluate(sels => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = c => 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  const P = s => { const m = s.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
  const mix = (top, base) => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 });
  const bgOf = el => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = P(getComputedStyle(e).backgroundColor); if (c.a > 0) layers.push(c); if (c.a >= 1) break; } let base = { r: 10, g: 10, b: 15, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) base = mix(layers[i], base); return base; };
  const bad = [];
  for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(); if (r.width < 1 || !el.innerText.trim()) continue;
    const cs = getComputedStyle(el), bg = bgOf(el), fg = mix(P(cs.color), bg);
    const ratio = (Math.max(L(bg), L(fg)) + 0.05) / (Math.min(L(bg), L(fg)) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) bad.push(`${sel} "${el.innerText.trim().slice(0, 18)}" ${ratio.toFixed(2)}:1 (${px}px)`);
  }
  return bad;
}, sels);

const GUIDED_CONTROLS = '.wo-bar button, .wo-step, .wo-main, .wo-links button, .wo-end, .wo-load input';
const GUIDED_TEXT = ['.wo-bar button', '.wo-prog', '.wo-prog small', '.wo-name', '.wo-sub', '.wo-lbl', '.wo-main', '.wo-links button', '.wo-end', '.wo-hint', '.wo-rest-lbl', '.wo-rest-next', '.wo-btn'];
const NAV_TEXT = ['#bnav .nb', '#bnav .nb-l', '#bnav .nb-main', '#navLive'];

/* ═══ cenário principal: telemóvel 412 × 915 ═══════════════════════════════ */
{
  const { ctx, page } = await open(412, 915);
  await page.evaluate(() => window.goDay('Segunda'));

  /* 1+2. iniciar, e 5 ciclos pausar/retomar com TOQUES; cada toque = uma transição */
  check(await hit(page, '#navMain'), 'botão central tapado no ecrã normal');
  await tap(page, '#navMain');
  check(await sess(page) === 'ACTIVE' && await page.locator('#woBg.show').count() === 1, 'iniciar: devia dar ACTIVE e abrir o guiado');
  check(!(await page.locator('#bnav').isVisible()), 'no guiado só pode haver uma barra: a geral devia estar escondida');
  await tap(page, '.wo-bar button:has-text("Sair")');
  check(await page.locator('#woBg.show').count() === 0 && await page.locator('#bnav').isVisible(), 'sair do guiado devia devolver a barra geral');
  check(await sess(page) === 'ACTIVE', 'sair da vista não pode terminar a sessão');
  const seq = [];
  for (let i = 0; i < 5; i++) {
    check(await hit(page, '#navMain'), `ciclo ${i + 1}: botão central tapado`);
    await tap(page, '#navMain'); seq.push(await sess(page));
    await tap(page, '#navMain'); seq.push(await sess(page));
  }
  check(seq.join() === Array.from({ length: 5 }, () => 'PAUSED,ACTIVE').join(), `5 ciclos pausar/retomar: cada toque devia dar uma transição (${seq.join('>')})`);
  /* toque longo (o nó do botão não pode ser trocado debaixo do dedo) */
  await holdTouch(page, ctx, '#navMain', 1600); const aposLongo = await sess(page);
  await holdTouch(page, ctx, '#navMain', 1600);
  check(aposLongo === 'PAUSED' && await sess(page) === 'ACTIVE', 'toque longo (1,6 s) no botão central falhou');
  /* mudar de separador e voltar não perde nada */
  await tap(page, '.nb[data-day="__hist"]'); await tap(page, '.nb[data-day="__hoje"]');
  await tap(page, '#navMain'); await tap(page, '#navMain');
  check(await sess(page) === 'ACTIVE', 'depois de navegar o botão central devia continuar a funcionar');
  check(await page.locator('#woBg.show').count() === 0, 'pausar/retomar na barra não abre o guiado sozinhos');
  await page.screenshot({ path: join(SHOTS, 'ux-faixa-em-curso.png') });
  await tap(page, '#navLive');
  check(await page.locator('#woBg.show').count() === 1, 'a faixa "Abrir" devia abrir o guiado');

  /* 3. três séries seguidas */
  for (const id of ['#woBg .wo-step']) check(await hit(page, id), 'botões −/+ tapados');
  await page.screenshot({ path: join(SHOTS, 'ux-guiado.png') });
  for (let n = 1; n <= 3; n++) {
    if (n === 1) { await page.fill('#wo-w', '40'); await page.fill('#wo-r', '10'); }
    check(await hit(page, '.wo-main'), `série ${n}: botão principal tapado`);
    await tap(page, '.wo-main'); await page.waitForTimeout(450);
    check(await page.locator('.wo-dots i.on').count() === Math.min(n, await page.locator('.wo-dots i').count()), `série ${n}: ponto de progresso`);
    if (n < 3 && await page.locator('.wo-main.next').count() === 0) {
      /* 4. descanso visível e dominante */
      check(await page.locator('#woRest:not([hidden])').count() === 1, `série ${n}: o descanso devia estar visível dentro do guiado`);
      check(await hit(page, '#woRest .wo-rest-num'), `série ${n}: o número do descanso está tapado`);
    }
  }
  await tap(page, '.wo-main.next, .wo-main'); /* seguinte */
  await page.waitForTimeout(200);

  /* 4/5. descanso: relógio a andar, +30 s, Saltar */
  await page.evaluate(() => window.timerStart(60));
  await page.waitForTimeout(300);
  check(await page.locator('#woRest:not([hidden])').count() === 1 && await hit(page, '#woRest .wo-rest-num'), 'descanso não aparece no guiado');
  const t0 = await page.locator('#woRest .t-live').innerText(); await page.waitForTimeout(1300);
  check(t0 !== await page.locator('#woRest .t-live').innerText(), 'o relógio do descanso não anda');
  const sec = s => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };
  const a0 = sec(await page.locator('#woRest .t-live').innerText());
  await tap(page, '#woRest .wo-btn:has-text("+30")');
  check(sec(await page.locator('#woRest .t-live').innerText()) >= a0 + 25, '+30 s não somou');
  check(!(await page.locator('#timerBanner').isVisible()), 'o banner global não pode aparecer por cima do guiado');
  await page.screenshot({ path: join(SHOTS, 'ux-descanso.png') });
  /* 9. refresh durante o descanso */
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('#woBg.show').count() === 1 && await page.locator('#woRest:not([hidden])').count() === 1, 'refresh durante o descanso: guiado e descanso devem voltar');
  await tap(page, '#woRest .wo-btn:has-text("Saltar")');
  check(await page.locator('#woRest').isHidden() && !(await page.evaluate(() => localStorage.getItem('rest_timer'))), 'Saltar devia terminar o descanso');

  /* 6. ficha técnica: abre por cima do guiado, tem o conteúdo do exercício e fecha para o mesmo exercício */
  const nome = await page.locator('.wo-name').innerText();
  await tap(page, '.wo-links button:has-text("Ficha")');
  check(await page.locator('#infoBg.show').count() === 1, 'a ficha não abriu');
  check(await hit(page, '.info-close') && await hit(page, '#infoBody'), 'ficha tapada pelo guiado (camadas)');
  await page.waitForFunction(() => !document.getElementById('infoBody').innerText.includes('A carregar'), null, { timeout: T }).catch(() => {});
  const txt = await page.locator('#infoBody').innerText();
  check(txt.toLowerCase().includes(nome.toLowerCase().slice(0, 6)) && txt.length > 40, `a ficha devia mostrar o exercício atual (${nome}): "${txt.slice(0, 50)}"`);
  await page.screenshot({ path: join(SHOTS, 'ux-ficha.png') });
  await tap(page, '.info-close');
  check(await page.locator('#infoBg.show').count() === 0 && await page.locator('#woBg.show').count() === 1 && await page.locator('.wo-name').innerText() === nome, 'fechar a ficha devia voltar ao mesmo exercício');

  /* 7. fechar e reabrir o guiado */
  await tap(page, '.wo-bar button:has-text("Sair")'); await tap(page, '#navLive');
  check(await page.locator('.wo-name').innerText() === nome && await page.locator('#woBg.show').count() === 1, 'reabrir o guiado devia mostrar o mesmo exercício');
  /* pausa dentro do guiado */
  await tap(page, '.wo-pause');
  check(await sess(page) === 'PAUSED' && await page.locator('.wo-main.resume').count() === 1, 'pausar no guiado: botão principal devia ser Retomar');
  await page.screenshot({ path: join(SHOTS, 'ux-pausa.png') });
  await tap(page, '.wo-main.resume'); check(await sess(page) === 'ACTIVE', 'retomar no guiado');

  /* rascunho: o que se escreveu em kg/reps sobrevive a pausar/retomar; validação visível, sem alertas */
  if (await page.locator('.wo-main.next').count()) await tap(page, '.wo-links button:has-text("Desfazer")');   /* garante uma série por fazer */
  await page.waitForTimeout(450);
  await page.fill('#wo-w', '77'); await page.fill('#wo-r', '9');
  await tap(page, '.wo-pause'); await tap(page, '.wo-main.resume');
  check(await page.inputValue('#wo-w') === '77' && await page.inputValue('#wo-r') === '9', 'pausar/retomar apagou o que estava escrito em kg/reps');
  await page.fill('#wo-r', '0.5'); await page.waitForTimeout(450);
  await tap(page, '.wo-main');
  check(await page.locator('#wo-r.bad').count() === 1, 'reps inválidas (0,5) deviam ficar marcadas, não falhar em silêncio');
  await page.fill('#wo-r', '9');
  /* o resto da app fica inerte por baixo do guiado; a ficha fecha com Esc e devolve o foco; o X não rola */
  check(await page.evaluate(() => document.getElementById('content').inert === true), 'com o guiado aberto o conteúdo devia estar inerte');
  await tap(page, '.wo-links button:has-text("Ficha")');
  await page.evaluate(() => { document.getElementById('infoBody').scrollTop = 9999; });
  check(await hit(page, '.info-close'), 'o X da ficha desapareceu com o scroll');
  await page.keyboard.press('Escape');
  check(await page.locator('#infoBg.show').count() === 0 && await page.locator('#woBg.show').count() === 1, 'Esc devia fechar só a ficha');
  check(await page.evaluate(() => !!document.activeElement && document.activeElement.textContent.includes('Ficha')), 'o foco devia voltar ao botão que abriu a ficha');

  /* 14. dados sem duplicação */
  const dados = await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('treino_v2')); const ks = []; for (const arr of Object.values(st.log)) for (const e of arr) for (const x of e.sets || []) if (x.k) ks.push(`${e.date}|${x.k}`); return { ks, dup: new Set(ks).size !== ks.length, w: (st.workouts || []).length }; });
  check(!dados.dup && dados.ks.length >= 3, `séries duplicadas ou em falta no histórico (${dados.ks.length})`);

  /* 8. Histórico e regresso (fecha o guiado primeiro) */
  await tap(page, '.wo-bar button:has-text("Sair")');
  await tap(page, '.nb[data-day="__hist"]');
  check(await page.locator('text=Treinos recentes').count() === 1, 'Histórico devia abrir');
  await tap(page, '.nb[data-day="__hoje"]');
  check(await page.locator('.week-strip, .rest-card').count() >= 1, 'Início devia voltar');

  /* 10. teclado numérico: com o ecrã encolhido o guiado mantém Sair e o botão principal à vista */
  await tap(page, '#navLive');
  await page.setViewportSize({ width: 412, height: 420 });
  await page.locator('#wo-w').focus(); await page.waitForTimeout(250);
  check(await hit(page, '.wo-bar button') && await hit(page, '.wo-main'), 'com o teclado aberto, Sair/Pausar ou o botão principal ficaram tapados');
  await page.setViewportSize({ width: 412, height: 915 });
  await page.evaluate(() => document.activeElement.blur());
  await tap(page, '.wo-bar button:has-text("Sair")');
  await page.evaluate(() => window.goDay('Segunda'));
  await page.locator('.load-in').first().focus();
  await page.setViewportSize({ width: 412, height: 420 }); await page.waitForTimeout(300);
  check(!(await page.locator('#bnav').isVisible()), 'com o teclado aberto a barra devia esconder-se');
  await page.setViewportSize({ width: 412, height: 915 }); await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(300);
  check(await page.locator('#bnav').isVisible(), 'a barra devia voltar com o teclado fechado');

  /* contraste (barra, faixa e guiado) */
  check((await contrast(page, NAV_TEXT)).length === 0, `contraste da barra: ${(await contrast(page, NAV_TEXT)).join('; ')}`);
  await tap(page, '#navLive');
  const c1 = await contrast(page, GUIDED_TEXT);
  check(c1.length === 0, `contraste no guiado: ${c1.join('; ')}`);
  check((await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.wo-main')); return s.backgroundColor; })) !== '', 'sanidade');
  await ctx.close();
}

/* ═══ Reset depois de pausar: Iniciar → série → Pausar → Reset → Início → Play, repetido ═════════════ */
{
  const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
  const loads = S => Object.values(S.log || {}).flat().reduce((n, e) => n + (e.sets ? e.sets.length : 0), 0);
  const toDay = async page => { await tap(page, '.nb[data-day="__hist"]'); await tap(page, '.wk-row[data-day="Segunda"], .wk-chip[data-day="Segunda"]'); };
  const doSet = async (page, kg = '20') => { await page.fill('#wo-w', kg); await page.fill('#wo-r', '10'); await tap(page, '.wo-main'); };
  /* um ciclo completo com toques; devolve o id da sessão criada */
  async function cycle(page, tag, { rest = false, refresh = false, otherTab = false } = {}) {
    const pre = await state(page);
    await toDay(page);
    if (pre.session) await tap(page, '#navLive'); else await tap(page, '#navMain');   /* 2.º ciclo: a sessão nova do Play anterior ainda vive */
    const a = await state(page);
    check(a.session && a.session.state === 'ACTIVE' && a.session.day === 'Segunda' && await page.locator('#woBg.show').count() === 1, `${tag}: Play devia criar sessão ACTIVE e abrir o guiado (${a.session && a.session.state})`);
    const id = a.session && a.session.id;
    await doSet(page);
    if (!rest) await page.evaluate(() => window.timerDismiss());
    const b = await state(page);
    check((b.sets['Segunda:0'] || []).length === 1 && loads(b) >= 1, `${tag}: a série devia ficar marcada e com carga`);
    await tap(page, '.wo-bar button:has-text("Pausar")');
    check(await sess(page) === 'PAUSED', `${tag}: devia estar PAUSED`);
    await tap(page, '.wo-bar button:has-text("Sair")');
    await tap(page, 'button:has-text("Reset")');
    const c = await state(page);
    check(c.session === null && !(c.sets['Segunda:0'] || []).length && !c.done['Segunda:0'], `${tag}: Reset devia desfazer a sessão e as marcas (sessão=${c.session && c.session.state})`);
    check(!JSON.stringify(c.log).includes(id), `${tag}: as cargas desta sessão não podem sobrar no log`);
    check(await page.evaluate(() => !document.querySelector('#restBanner.show, .rest-banner.show') && !localStorage.getItem('rest_timer')), `${tag}: o descanso devia ter sido limpo`);
    if (otherTab) { await tap(page, '.nb[data-day="__perfil"]'); await tap(page, '.nb[data-day="__hist"]'); }
    if (refresh) { await page.reload({ waitUntil: 'networkidle' }); }
    await tap(page, '.nb[data-day="__hoje"]');
    check(await page.evaluate(() => document.getElementById('navMain').dataset.face) === '|▶|Iniciar', `${tag}: o botão devia voltar a "Iniciar"`);
    check(await hit(page, '#navMain'), `${tag}: botão central tapado depois do Reset`);
    await tap(page, '#navMain');
    const d = await state(page);
    check(d.session && d.session.state === 'ACTIVE' && d.session.id !== id && await page.locator('#woBg.show').count() === 1, `${tag}: Play depois do Reset devia iniciar uma sessão NOVA e abrir o guiado`);
    check(!JSON.stringify(d.log).includes(id) && (d.workouts || []).length === 0, `${tag}: sem sessões duplicadas nem presas`);
    await tap(page, '.wo-bar button:has-text("Sair")');
    return d.session.id;
  }
  for (const [tag, opt] of [['reset', {}], ['reset+refresh', { refresh: true }], ['reset+descanso', { rest: true }], ['reset+separador', { otherTab: true }]]) {
    const { ctx, page } = await open(412, 915);
    await page.evaluate(() => window.goDay('Segunda'));
    /* outra carga (outro dia, treino anterior) tem de sobreviver a todos os resets */
    await page.evaluate(() => { const S = JSON.parse(localStorage.getItem('treino_v2')); S.log = { ...S.log, 'Exercício antigo': [{ date: '2026-01-05', ts: 'x', w: 50, r: 8, sets: [{ w: 50, r: 8, ts: 'x', k: 'Terça:0', sid: 'velha' }] }] }; localStorage.setItem('treino_v2', JSON.stringify(S)); });
    await page.reload({ waitUntil: 'networkidle' });
    const first = await cycle(page, tag, opt);
    const second = await cycle(page, tag + ' (2.º ciclo)', opt);   /* repetição: sem duplicar nem perder */
    check(first !== second, `${tag}: o 2.º ciclo devia ter outra sessão`);
    const f = await state(page);
    check(f.log['Exercício antigo'] && f.log['Exercício antigo'][0].sets.length === 1, `${tag}: o Reset apagou cargas de outro treino`);
    check(f.sched && !Object.values(f.sched.done || {}).some(Boolean), `${tag}: nenhum dia devia ficar concluído`);
    await page.reload({ waitUntil: 'networkidle' });
    check(await sess(page) === 'ACTIVE', `${tag}: a sessão iniciada depois do Reset devia sobreviver ao refresh`);
    await ctx.close();
  }
}

/* ═══ Personalizado: iniciar → série → pausar → descartar → novo personalizado → Play ═════════════ */
{
  const { ctx, page } = await open(412, 915);
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('treino_v2')));
  const seed = () => page.evaluate(() => { const S = JSON.parse(localStorage.getItem('treino_v2')); const d = new Date(); const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    S.custom = { date: t, muscles: ['peito'], label: 'Peito', stage: 'active', ex: [{ name: 'Flexões', s: 3, r: '10', tip: '', alt: '' }, { name: 'Fundos', s: 3, r: '10', tip: '', alt: '' }] }; localStorage.setItem('treino_v2', JSON.stringify(S)); });
  const ids = [];
  for (let i = 1; i <= 2; i++) {
    await seed(); await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => window.render('__pers'));
    await tap(page, '#navMain');
    const a = await st();
    check(a.session && a.session.state === 'ACTIVE' && a.session.day === 'Personalizado' && await page.locator('#woBg.show').count() === 1, `personalizado ${i}: Play devia iniciar a sessão e abrir o guiado`);
    ids.push(a.session && a.session.id);
    await page.fill('#wo-w', '10'); await page.fill('#wo-r', '10'); await tap(page, '.wo-main'); await page.evaluate(() => window.timerDismiss());
    await tap(page, '.wo-bar button:has-text("Pausar")');
    await tap(page, '.wo-bar button:has-text("Sair")');
    await tap(page, 'button:has-text("Descartar")');
    const b = await st();
    check(b.custom === null && !(b.sets['Personalizado:0'] || []).length, `personalizado ${i}: descartar devia limpar o treino e as marcas`);
  }
  check(ids[0] && ids[1] && ids[0] !== ids[1], 'personalizado: o 2.º Play devia criar outra sessão');
  await ctx.close();
}

/* ═══ larguras: 320, 360, 412 e desktop ═══════════════════════════════════ */
for (const [w, h, mobile] of [[320, 640, true], [360, 740, true], [412, 915, true], [1280, 800, false]]) {
  const { ctx, page } = await open(w, h, mobile);
  const tag = `${w}px`;
  await page.evaluate(() => window.goDay('Segunda'));
  check(await noHScroll(page), `${tag}: scroll horizontal no ecrã normal`);
  check((await small(page, '#bnav .nb')).length === 0, `${tag}: botões da barra com alvo <44 px: ${(await small(page, '#bnav .nb')).join(',')}`);
  check((await overlaps(page, '#bnav .nb')).length === 0, `${tag}: botões da barra sobrepostos`);
  await page.evaluate(() => window.startWorkout('Segunda'));
  await page.waitForSelector('.wo-main');
  await page.fill('#wo-w', '40'); await page.fill('#wo-r', '10');
  check(await noHScroll(page), `${tag}: scroll horizontal no guiado`);
  for (const sel of ['.wo-bar button:first-child', '.wo-pause', '.wo-main', '.wo-load input', '.wo-links button']) check(await hit(page, sel), `${tag}: ${sel} tapado ou fora do ecrã`);
  const ov = await overlaps(page, '.wo-bar button, .wo-bar .wo-prog, .wo-dock button, .wo-dock input');
  check(ov.length === 0, `${tag}: sobreposição no guiado: ${ov.join('; ')}`);
  const sm = await small(page, '.wo-bar button, .wo-dock button');
  check(sm.length === 0, `${tag}: alvos <44 px no guiado: ${sm.join(', ')}`);
  /* a dock não cobre o título nem o relógio (caixas disjuntas) */
  const caixas = await page.evaluate(() => { const b = s => document.querySelector(s).getBoundingClientRect(); return { bar: b('.wo-bar').bottom, dock: b('.wo-dock').top, vh: innerHeight, scrollH: b('.wo-scroll').height }; });
  check(caixas.dock >= caixas.bar - 1 && caixas.scrollH > 60, `${tag}: o corpo do guiado ficou sem espaço (${caixas.scrollH}px)`);
  await page.evaluate(() => window.timerStart(45)); await page.waitForTimeout(250);
  check(await hit(page, '#woRest .wo-rest-num') && await hit(page, '#woRest .wo-btn'), `${tag}: descanso tapado`);
  if (w === 320 || w === 1280) await page.screenshot({ path: join(SHOTS, `ux-guiado-${w}.png`) });
  await ctx.close();
}

/* ═══ cache atualizada: o service worker serve a versão do disco e só ela ═══ */
{
  const { ctx, page } = await open(412, 915);
  await page.reload({ waitUntil: 'networkidle' });
  const swv = readFileSync(join(ROOT, 'sw.js'), 'utf8').match(/CACHE = '([^']+)'/)[1];
  const info = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); const r = await c.match('js/workout.js') || await c.match('./js/workout.js'); return { ks, w: r ? await r.text() : '' }; });
  check(info.ks.length === 1 && info.ks[0] === swv, `caches: ${info.ks.join(',')} (esperado só ${swv})`);
  check(info.w.replace(/\r\n/g, '\n') === readFileSync(join(ROOT, 'js/workout.js'), 'utf8').replace(/\r\n/g, '\n'), 'a cache tem uma versão antiga de js/workout.js');
  await ctx.close();
}

await browser.close(); server.close();
const e2 = errors.filter(Boolean);
if (e2.length) fail.push(`erros de consola: ${e2.slice(0, 3).join(' | ')}`);
if (fail.length) { console.error(`FALHOU (${fail.length}):\n  ` + fail.join('\n  ')); process.exit(1); }
console.log('OK - UX real: toques, camadas, sobreposições, scroll horizontal, contraste AA, descanso, ficha e cache em 320/360/412/desktop.');
