/* myTraining — módulo extraído de index.html (Fase 0). */
import { MUSCLES, MUSCLE_NAMES } from './charts.js';
import { DAYS } from './routine.js';

/* ═══════════ VOLUME SEMANAL (planeado, por grupo) ═══════════ */
function weeklyVolume(){
  const vol={};
  Object.keys(DAYS).forEach(d=>DAYS[d].ex.forEach(e=>{
    const s=typeof e.s==='number'?e.s:0; if(!s) return;
    const mm=MUSCLES[e.name]; if(!mm) return;
    mm.p.forEach(m=>vol[m]=(vol[m]||0)+s);
    mm.s.forEach(m=>vol[m]=(vol[m]||0)+s*0.5);
  }));
  return vol;
}
function volumeHTML(){
  const vol=weeklyVolume(), keys=Object.keys(vol).sort((a,b)=>vol[b]-vol[a]);
  if(!keys.length) return '';
  const max=Math.max.apply(null,keys.map(k=>vol[k]));
  return `<div class="nsec-title">Volume semanal planeado (séries/grupo)</div><div class="vol">`+
    keys.map(k=>`<div class="vol-row"><span class="vol-l">${MUSCLE_NAMES[k]||k}</span><div class="vol-bar"><div class="vol-fill" style="width:${Math.round(vol[k]/max*100)}%"></div></div><span class="vol-v">${Math.round(vol[k])}</span></div>`).join('')+
    `</div><div class="ndisc">Soma das séries planeadas por grupo (secundários contam ½). Mostra o equilíbrio do programa.</div>`;
}

export { weeklyVolume, volumeHTML };
