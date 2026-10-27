import { save, getSaveState } from './state.js';
import { announceLoadProblem } from './save-state.js';
function initSaveBanner() {
  const style=document.createElement('style');
  style.textContent=`#saveBanner{position:fixed;top:env(safe-area-inset-top,0px);left:8px;right:8px;z-index:600;box-sizing:border-box;padding:12px;background:var(--surface);color:var(--text);border:2px solid var(--accent);border-radius:var(--r-sm);font-size:14px;line-height:1.4;overflow-wrap:anywhere}#saveBanner p{margin:0 0 8px}#saveBanner .save-actions{display:flex;flex-wrap:wrap;gap:8px}#saveBanner button{min-height:44px;min-width:44px;flex:1;padding:8px;font-size:14px;background:var(--card2);color:var(--text);border:1px solid var(--text-muted);border-radius:var(--r-sm)}`;
  document.body.appendChild(style);
  function render() {
    const state=getSaveState();
    let banner=document.getElementById('saveBanner');
    if(!state.pending){ if(banner) banner.remove(); return; }
    if(!banner){
      banner=document.createElement('div'); banner.id='saveBanner'; banner.setAttribute('role','alert');
      banner.innerHTML='<p></p><div class="save-actions"><button onclick="retrySave()">Tentar de novo</button><button onclick="exportCopy()">Exportar cópia</button></div>';
      const sheets=[...document.querySelectorAll('.sheet-bg.show, #infoBg.show, #onbBg.show, #mvBg.show')];
      (sheets[sheets.length-1] || document.body).appendChild(banner);
    }
    banner.querySelector('p').textContent=state.loadProblem==='blocked' ? 'Dados guardados ilegíveis; não foi possível guardar uma cópia bruta. A gravação está bloqueada. Exporta uma cópia. Não feches a app.' : 'Alterações NÃO guardadas neste dispositivo. Não feches a app.';
  }
  document.addEventListener('save-state',render);
  window.addEventListener('beforeunload',e=>{ if(getSaveState().pending){ e.preventDefault(); e.returnValue=''; } });
  render(); announceLoadProblem();
}
function retrySave(){
  const ok=save();
  if(!ok) document.dispatchEvent(new CustomEvent('app-notice',{detail:{msg:'Continua sem ser possível guardar. Exporta uma cópia.',kind:'error'}}));
  return ok;
}
export { initSaveBanner, retrySave };
