/* Auxiliares do teste de acessibilidade (Bloco 8): servidor estático e varredura de contraste WCAG.
   A varredura percorre TODO o texto visível e, ao contrário de ux-test, trata fundos em gradiente
   (usa o pior dos extremos), que era onde o branco sobre laranja (2,8:1) escapava. */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

export async function serve(port) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const file = join(ROOT, p.split('/').filter(s => s && s !== '..').join('/'));
    if (!existsSync(file)) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
  });
  await new Promise(r => server.listen(port, r));
  return server;
}

/* devolve ["ecrã sel "texto" 2.80:1 (13px)"] para o ecrã atualmente visível */
export const scanContrast = (page, label) => page.evaluate(label => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = c => 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const mix = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const root = document.documentElement.dataset.theme === 'light' ? { r: 248, g: 250, b: 252, a: 1 } : { r: 10, g: 10, b: 15, a: 1 };
  /* fundos possíveis (vários se houver gradiente), do antepassado opaco mais próximo para fora */
  const bgs = el => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const grad = cs.backgroundImage.includes('gradient') ? [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])) : null;
      const c = parse(cs.backgroundColor);
      if (grad && grad.length) { layers.push({ grad }); if (grad.every(g => g.a >= 1)) break; }
      else if (c && c.a > 0) { layers.push({ c }); if (c.a >= 1) break; }
    }
    let opts = [root];
    for (const l of layers.reverse()) opts = l.grad ? l.grad.flatMap(g => opts.map(o => mix(g, o))) : opts.map(o => mix(l.c, o));
    return opts;
  };
  const bad = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const t = n.nodeValue.trim(); if (!t) continue;
    const el = n.parentElement;
    if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    if (el.closest('[hidden], [inert], .sheet-bg:not(.show), .info-bg:not(.show), .wo-bg:not(.show), .onb-bg:not(.show)')) continue;
    if (r.bottom < 0 || r.top > innerHeight * 6) continue;
    const fgc = parse(cs.color); if (!fgc) continue;
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700), need = large ? 3 : 4.5;
    let worst = 99;
    for (const bg of bgs(el)) {
      const fg = mix({ ...fgc, a: fgc.a * (+cs.opacity || 1) }, bg);
      worst = Math.min(worst, (Math.max(L(bg), L(fg)) + 0.05) / (Math.min(L(bg), L(fg)) + 0.05));
    }
    if (worst < need) {
      const id = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
      const k = `${label} ${id} ${worst.toFixed(2)}:1`;
      if (!bad.has(k)) bad.set(k, `${k} "${t.slice(0, 22)}" (${px}px)`);
    }
  }
  return [...bad.values()];
}, label);
