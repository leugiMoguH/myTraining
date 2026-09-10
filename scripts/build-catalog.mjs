/* Gera data/catalog.json + data/instructions.en.json a partir do exercises-dataset.
   Correr à mão quando se quiser atualizar o catálogo: node scripts/build-catalog.mjs

   O JSON de origem tem 17,4 MB (instruções em 10 idiomas) — demasiado para um PWA.
   Aqui fica só o índice pesquisável (~260 KB) e as instruções EN à parte (~620 KB),
   que a app só descarrega quando o utilizador abre a ficha de um exercício.

   Dataset: hasaneyldrm/exercises-dataset (MIT). Media: © Gym visual (gymvisual.com). */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';

/* SHA fixado de propósito: @main podia mudar debaixo dos pés e invalidar as URLs
   de media já em cache. Atualizar aqui em conjunto com o catálogo. */
const SHA = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd';
const SRC = `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@${SHA}/data/exercises.json`;
const OUT = new URL('../data/', import.meta.url);

const REQUIRED = ['id', 'name', 'body_part', 'equipment', 'target', 'media_id'];

const res = await fetch(SRC);
if (!res.ok) throw new Error(`dataset indisponível: HTTP ${res.status} — ${SRC}`);
const raw = await res.json();
if (!Array.isArray(raw) || !raw.length) throw new Error('dataset vazio ou com formato inesperado');

const bad = [];
const catalog = [];
const instructions = {};

for (const [i, ex] of raw.entries()) {
  const missing = REQUIRED.filter(k => !ex[k]);
  if (missing.length) { bad.push(`#${i} (${ex.name || 'sem nome'}): falta ${missing.join(', ')}`); continue; }
  catalog.push({
    id: ex.id,
    n: ex.name,
    b: ex.body_part,
    e: ex.equipment,
    t: ex.target,
    s: Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
    m: ex.media_id,
  });
  const en = ex.instructions?.en;
  if (typeof en === 'string' && en.trim()) instructions[ex.id] = en.trim();
}

if (bad.length) console.warn(`${bad.length} exercícios ignorados:\n  ` + bad.slice(0, 10).join('\n  '));
if (catalog.length < 1000) throw new Error(`só ${catalog.length} exercícios válidos — dataset suspeito, nada escrito`);

const meta = {
  sha: SHA,
  count: catalog.length,
  generated: new Date().toISOString().slice(0, 10),
  media: `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@${SHA}/`,
  attribution: '© Gym visual — https://gymvisual.com/ · dataset: hasaneyldrm/exercises-dataset (MIT)',
};

mkdirSync(OUT, { recursive: true });
const write = (f, data) => {
  const p = new URL(f, OUT);
  writeFileSync(p, JSON.stringify(data), 'utf8');
  return `${f}: ${(statSync(p).size / 1024).toFixed(0)} KB`;
};

console.log(write('catalog.json', { meta, ex: catalog }));
console.log(write('instructions.en.json', instructions));
console.log(`${catalog.length} exercícios · ${Object.keys(instructions).length} com instruções EN`);
console.log(`grupos: ${[...new Set(catalog.map(e => e.b))].length} · equipamentos: ${[...new Set(catalog.map(e => e.e))].length} · alvos: ${[...new Set(catalog.map(e => e.t))].length}`);
