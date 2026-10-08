/* Ecrã de pesquisa do catálogo: escolher um dos 1324 exercícios e juntá-lo a um
   dia (modo `add`) ou pôr no lugar de outro (modo `swap` — máquina ocupada,
   ombro a doer, ginásio sem o aparelho). */
import { loadCatalog, search, facets, thumbUrl, toRoutineEntry, byId, muscleIdsOf } from './catalog.js';
import { MUSCLES } from './charts.js';
import { bodyPartPT, equipmentPT } from './labels.js';
import { CUSTOM_DAY, addExercise, exercisesOf, replaceExercise } from './routine.js';
import { forgetSwap, rememberSwap, swapOriginal } from './schedule.js';
import { esc } from './state.js';
import { render } from './ui.js';

const CAT = { day: null, i: null, mode: 'add', perm: false, q: '', b: '', e: '', ready: false, timer: null };

function open(day) {
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

function openCatalog(day) { CAT.mode = 'add'; CAT.i = null; open(day); }

/* Trocar o exercício da posição i por um equivalente. */
function openSwap(day, i) {
  if (!exercisesOf(day)[i]) return;
  CAT.mode = 'swap'; CAT.i = i; CAT.perm = false;
  open(day);
}

function current() { return CAT.mode === 'swap' ? exercisesOf(CAT.day)[CAT.i] : null; }

/* Músculos primários do exercício atual: vêm na entrada (catálogo) ou do mapa
   escrito à mão para os 30 originais. */
function primaryIds(ex) {
  if (ex && ex.mus && Array.isArray(ex.mus.p) && ex.mus.p.length) return ex.mus.p;
  const m = MUSCLES[ex && ex.name];
  return (m && m.p) || [];
}

/* "Só esta semana" é o caso normal: a máquina volta a estar livre para a semana. */
function catScope(perm) { CAT.perm = !!perm; renderFilters(); }

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

/* Cabeçalho do modo troca: o que se está a trocar, âmbito e a alternativa
   escrita à mão (quando existe — os 30 exercícios originais têm `alt`). */
function swapHeadHTML() {
  const ex = current();
  if (!ex) return '';
  return `
    <div class="cat-swap">
      <div class="cat-swap-t">Trocar <b>${esc(ex.name)}</b> por um equivalente</div>
      ${ex.alt ? `<div class="cat-swap-alt">💡 Sugestão do plano: ${esc(ex.alt)}</div>` : ''}
      ${CAT.day === CUSTOM_DAY ? '' : `<div class="cat-chips">
        <button class="cat-chip${CAT.perm ? '' : ' on'}" onclick="catScope(false)">Só esta semana</button>
        <button class="cat-chip${CAT.perm ? ' on' : ''}" onclick="catScope(true)">Trocar sempre</button>
      </div>`}
    </div>`;
}

function renderFilters() {
  const el = document.getElementById('catFilters');
  if (!el || !CAT.ready) return;
  const f = facets();
  el.innerHTML = swapHeadHTML() +
    `<div class="cat-chips">${f.b.map(x => chip('b', x.value, x.label, CAT.b === x.value)).join('')}</div>` +
    `<div class="cat-chips">${f.e.map(x => chip('e', x.value, x.label, CAT.e === x.value)).join('')}</div>`;
}

/* No modo troca só interessam exercícios do mesmo músculo primário, e primeiro
   os de equipamento diferente — se estás a trocar é porque o aparelho não dá. */
function candidates() {
  const ex = current();
  const hits = search(CAT.q, { bodyPart: CAT.b, equipment: CAT.e, limit: CAT.mode === 'swap' ? 0 : 50 });
  if (CAT.mode !== 'swap') return hits;

  const ids = primaryIds(ex);
  const mine = ex.catalogId && byId(ex.catalogId) ? byId(ex.catalogId).e : null;
  const same = ids.length ? hits.filter(e => muscleIdsOf(e).p.some(id => ids.includes(id))) : hits;
  return same
    .filter(e => e.n.toLowerCase() !== String(ex.name).toLowerCase())
    .sort((a, b) => (a.e === mine ? 1 : 0) - (b.e === mine ? 1 : 0))
    .slice(0, 50);
}

function renderResults() {
  if (!CAT.ready) return;
  const hits = candidates();
  if (!hits.length) { paint('<div class="cat-msg">Sem resultados. Tenta em inglês — o catálogo é EN (ex.: <b>squat</b>, <b>curl</b>, <b>row</b>).</div>'); return; }
  const action = CAT.mode === 'swap' ? 'catPick' : 'catAdd';
  const icon = CAT.mode === 'swap' ? '🔄' : '＋';
  paint(hits.map(ex => `
    <button class="cat-row" onclick="${action}('${ex.id}')">
      <img class="cat-thumb" src="${thumbUrl(ex)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="cat-info">
        <span class="cat-name">${esc(ex.n)}</span>
        <span class="cat-meta">${esc(bodyPartPT(ex.b))} · ${esc(equipmentPT(ex.e))}</span>
      </span>
      <span class="cat-add">${icon}</span>
    </button>`).join(''));
}

function catAdd(id) {
  const ex = byId(id);
  if (!ex || !CAT.day) return;
  if (!addExercise(CAT.day, toRoutineEntry(ex))) return;
  closeCatalog();
  render(CAT.day);
}

/* Aplica a troca. Só esta semana → guarda o original, que o reset de Segunda
   repõe. Sempre → passa a ser a rotina e não há nada para repor. */
function catPick(id) {
  const novo = byId(id);
  const antigo = current();
  if (!novo || !antigo) return;
  if (CAT.perm) forgetSwap(CAT.day, CAT.i);
  else rememberSwap(CAT.day, CAT.i, antigo);
  if (!replaceExercise(CAT.day, CAT.i, toRoutineEntry(novo))) return;
  closeCatalog();
  render(CAT.day);
}

/* Desfaz uma troca temporária antes do fim da semana. */
function undoSwap(day, i) {
  const orig = swapOriginal(day, i);
  if (!orig) return;
  if (replaceExercise(day, i, orig)) forgetSwap(day, i);
  render(day);
}

export { openCatalog, openSwap, closeCatalog, catInput, catFilter, catAdd, catPick, catScope, undoSwap };
