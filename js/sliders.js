/* myTraining — módulo extraído de index.html (Fase 0). */

/* ═══════════════════════ SLIDERS ════════════════════ */
const SL={};
function slInit(id,n){ SL[id]={cur:0,n}; }
function slTo(id,i){ SL[id].cur=((i%SL[id].n)+SL[id].n)%SL[id].n; slSync(id); }
function slNext(id){ slTo(id,SL[id].cur+1); }
function slPrev(id){ slTo(id,SL[id].cur-1); }
function slSync(id){
  const {cur,n}=SL[id];
  const slides=document.getElementById(`slides-${id}`);
  if(slides) slides.style.transform=`translateX(-${cur*100}%)`;
  document.querySelectorAll(`#dots-${id} .dot`).forEach((d,i)=>d.classList.toggle('on',i===cur));
  const ctr=document.getElementById(`ctr-${id}`);
  if(ctr) ctr.textContent=`${cur+1}/${n}`;
}

export { SL, slInit, slTo, slNext, slPrev, slSync };
