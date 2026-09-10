/* myTraining — módulo extraído de index.html (Fase 0). */
import { getLog } from './state.js';

/* ═══════════ PROGRESSÃO (sugestão de carga) ═══════════ */
function nextTarget(name){
  const d=getLog(name); if(!d.length) return null;
  const l=d[d.length-1];
  if(l.r>=12) return {w:Math.round((l.w+2.5)*2)/2, r:8};
  return {w:l.w, r:l.r+1};
}
function progHint(name){ const t=nextTarget(name); return t?`🎯 Próximo: <b>${t.w}</b>kg × ${t.r}`:''; }

export { nextTarget, progHint };
