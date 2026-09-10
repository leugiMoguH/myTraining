/* Ecrã de pesquisa do catálogo: escolher um dos 1324 exercícios e juntá-lo a um dia. */
import { loadCatalog, search, facets, thumbUrl, toRoutineEntry, byId } from './catalog.js';
import { bodyPartPT, equipmentPT } from './labels.js';
import { addExercise } from './routine.js';
import { esc } from './state.js';
import { render } from './ui.js';

const CAT = { day: null, q: '', b: '', e: '', ready: false, timer: null };

function openCatalog(day) {
  CAT.day = day;
  CAT.q = ''; CAT.b = ''; CAT.e = '';
  document.getElementById('catBg').classList.add('show');
  const input = document.getElementById('catQ');
  if (input) input.value = '';
  paint('<div class="cat-msg">A carregar o catálogo…</div>');

  loadCatalog()
    .then(() => { CAT.ready = true; renderFilters(); renderResults(); })
    .catch(err => paint(`<div class="cat-msg">Não foi possível carregar o catálogo.<br><span class="cat-sub">${esc(err.message)}</span></div>`));
}

function closeCatalog() { document.getElementById('catBg').classList.remove('show'); }

function paint(html) {
  const el = document.getElementById('catList');
  if (el) el.innerHTML = html;
}

/* Escrever é rápido, filtrar 1324 exercícios não precisa de correr a cada tecla. */
function catInput(value) {
  CAT.q = value;
  clearTimeout(CAT.timer);
  CAT.timer = setTimeout(renderResults, 140);
}

function catFilter(kind, value) {
  CAT[kind] = CAT[kind] === value ? '' : value;
  renderFilters();
  renderResults();
}

function chip(kind, value, label, active) {
  return `<button class="cat-chip${active ? ' on' : ''}" onclick="catFilter('${kind}','${esc(value)}')">${esc(label)}</button>`;
}

function renderFilters() {
  const el = document.getElementById('catFilters');
  if (!el || !CAT.ready) return;
  const f = facets();
  el.innerHTML =
    `<div class="cat-chips">${f.b.map(x => chip('b', x.value, x.label, CAT.b === x.value)).join('')}</div>` +
    `<div class="cat-chips">${f.e.map(x => chip('e', x.value, x.label, CAT.e === x.value)).join('')}</div>`;
}

function renderResults() {
  if (!CAT.ready) return;
  const hits = search(CAT.q, { bodyPart: CAT.b, equipment: CAT.e, limit: 50 });
  if (!hits.length) { paint('<div class="cat-msg">Sem resultados. Tenta em inglês — o catálogo é EN (ex.: <b>squat</b>, <b>curl</b>, <b>row</b>).</div>'); return; }
  paint(hits.map(ex => `
    <button class="cat-row" onclick="catAdd('${ex.id}')">
      <img class="cat-thumb" src="${thumbUrl(ex)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="cat-info">
        <span class="cat-name">${esc(ex.n)}</span>
        <span class="cat-meta">${esc(bodyPartPT(ex.b))} · ${esc(equipmentPT(ex.e))}</span>
      </span>
      <span class="cat-add">＋</span>
    </button>`).join(''));
}

function catAdd(id) {
  const ex = byId(id);
  if (!ex || !CAT.day) return;
  if (!addExercise(CAT.day, toRoutineEntry(ex))) return;
  closeCatalog();
  render(CAT.day);
}

export { openCatalog, closeCatalog, catInput, catFilter, catAdd };
