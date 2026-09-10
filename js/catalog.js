/* Catálogo dos 1324 exercícios (exercises-dataset, MIT · media © Gym visual).

   data/catalog.json são ~173 KB e só é descarregado quando o utilizador abre a
   pesquisa; data/instructions.en.json (~610 KB) só quando abre uma ficha.
   O service worker guarda ambos em cache, por isso é uma vez por dispositivo. */
import { bodyPartPT, equipmentPT, targetPT, muscleIdsOf } from './labels.js';

const CATALOG_URL = 'data/catalog.json';          /* relativo: GitHub Pages serve num subcaminho */
const INSTRUCTIONS_URL = 'data/instructions.en.json';

let catalog = null;        /* { meta, ex:[…] } depois do primeiro load */
let instructions = null;
let catalogPromise = null;
let instructionsPromise = null;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/* Uma só ida à rede, mesmo com várias chamadas em paralelo. Em erro limpa a
   promessa para a tentativa seguinte poder repetir. */
async function loadCatalog() {
  if (catalog) return catalog;
  catalogPromise ||= fetchJSON(CATALOG_URL)
    .then(d => {
      if (!d || !Array.isArray(d.ex) || !d.ex.length) throw new Error('catalog.json com formato inesperado');
      catalog = d;
      for (const ex of catalog.ex) ex.k = norm(ex.n);   /* chave de pesquisa, calculada uma vez */
      return catalog;
    })
    .catch(err => { catalogPromise = null; throw err; });
  return catalogPromise;
}

async function loadInstructions() {
  if (instructions) return instructions;
  instructionsPromise ||= fetchJSON(INSTRUCTIONS_URL)
    .then(d => (instructions = d || {}))
    .catch(err => { instructionsPromise = null; throw err; });
  return instructionsPromise;
}

/* minúsculas sem acentos: "Agachamento búlgaro" e "bulgaro" têm de bater certo */
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function isLoaded() { return catalog !== null; }
function all() { return catalog ? catalog.ex : []; }
function byId(id) { return all().find(e => e.id === id) || null; }
function meta() { return catalog ? catalog.meta : null; }

/* Valores distintos de um campo, já traduzidos, para os filtros da UI. */
function facets() {
  const uniq = k => [...new Set(all().map(e => e[k]))].filter(Boolean).sort();
  const label = { b: bodyPartPT, e: equipmentPT, t: targetPT };
  const out = {};
  for (const k of ['b', 'e', 't']) out[k] = uniq(k).map(v => ({ value: v, label: label[k](v) }));
  return out;
}

/* Relevância: nome começado pela pesquisa > uma palavra começada pelo 1.º termo >
   só contém. Os nomes do dataset vêm prefixados pelo equipamento ("barbell bench
   press"), por isso sem isto "bench press" devolvia tudo por ordem alfabética. */
function rankOf(ex, terms, joined) {
  if (ex.k.startsWith(joined)) return 0;
  if (ex.k.split(/[^a-z0-9]+/).some(w => w.startsWith(terms[0]))) return 1;
  return 2;
}

/* Pesquisa por termos (todos têm de aparecer) + filtros opcionais. */
function search(query, { bodyPart, equipment, target, limit = 60 } = {}) {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  const joined = terms.join(' ');
  const out = [];
  for (const ex of all()) {
    if (bodyPart && ex.b !== bodyPart) continue;
    if (equipment && ex.e !== equipment) continue;
    if (target && ex.t !== target) continue;
    if (terms.length && !terms.every(t => ex.k.includes(t))) continue;
    out.push(ex);
  }
  out.sort(terms.length
    ? (a, b) => rankOf(a, terms, joined) - rankOf(b, terms, joined) || a.n.localeCompare(b.n, 'pt')
    : (a, b) => a.n.localeCompare(b.n, 'pt'));
  return limit > 0 ? out.slice(0, limit) : out;
}

/* URLs de media (o SHA está fixado em meta.media, gerado por build-catalog.mjs). */
function thumbUrl(ex) { const m = meta(); return m ? `${m.media}images/${ex.id}-${ex.m}.jpg` : ''; }
function gifUrl(ex) { const m = meta(); return m ? `${m.media}videos/${ex.id}-${ex.m}.gif` : ''; }

/* Instruções EN (o dataset não tem PT). Devolve '' se ainda não carregadas. */
function instructionOf(id) { return (instructions && instructions[id]) || ''; }

/* Exercício do catálogo → entrada de rotina, no formato de js/data.js.
   `tip` fica vazio de propósito: os 30 exercícios originais têm tips PT escritos
   à mão que não se devem perder, e para os novos a ficha EN chega. */
function toRoutineEntry(ex, { s = 3, r = '8-12' } = {}) {
  return { name: ex.n, s, r, tip: '', alt: '', catalogId: ex.id };
}

export {
  loadCatalog, loadInstructions, isLoaded, all, byId, meta, facets, search,
  thumbUrl, gifUrl, instructionOf, toRoutineEntry, norm, muscleIdsOf,
};
