/* Preferência visual independente dos dados e da sessão de treino. */
const valid = value => ['auto', 'light', 'dark'].includes(value) ? value : 'dark';
let pref = 'dark';
function readPref() {
  try { return valid(localStorage.getItem('treino_theme')); } catch { return 'dark'; }
}
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
function syncRadios() {
  document.querySelectorAll('input[name="theme"]').forEach(input => { input.checked = input.value === pref; });
}
function apply() {
  const theme = pref === 'auto' ? (media?.matches ? 'dark' : 'light') : pref;
  const root = document.documentElement;
  if (root) {
    root.dataset.theme = theme;
    root.style.backgroundColor = theme === 'light' ? '#f8fafc' : '#0a0a0f';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f8fafc' : '#0a0a0f';
  syncRadios();
}
function getThemePref() { return pref; }
function setThemePref(value) {
  pref = valid(value);
  try { localStorage.setItem('treino_theme', pref); } catch { /* A escolha mantém-se em memória quando não é possível persistir. */ }
  apply();
}
pref = readPref();
apply();
const onSystemTheme = () => { if (pref === 'auto') apply(); };
if (typeof media?.addEventListener === 'function') media.addEventListener('change', onSystemTheme);
else if (typeof media?.addListener === 'function') media.addListener(onSystemTheme);
window.addEventListener('storage', event => {
  try { if (event.storageArea !== localStorage) return; } catch { return; }
  if (event.key === 'treino_theme' || event.key === null) { pref = readPref(); apply(); }
});
// A folha existente abre por classe: sincronizar sem alterar backup.js nem reconstruir conteúdo.
const sheet = document.getElementById('sheetBg');
if (sheet && typeof MutationObserver !== 'undefined') {
  new MutationObserver(syncRadios).observe(sheet, { attributes: true, attributeFilter: ['class'] });
}

export { getThemePref, setThemePref };
