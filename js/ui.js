/* myTraining — módulo extraído de index.html (Fase 0). */
import { gifUrlFor } from './catalog.js';
import { MUSCLES, bodySVG, muscleSlide, noImgSlide } from './charts.js';
import { editorHTML, isEditing, toggleEdit } from './editor.js';
import { DAYS } from './routine.js';
import { openInfo } from './guide.js';
import { saveLoad, toggleChart } from './loads.js';
import { DEMOS, demoSlide, mediaSlide } from './media.js';
import { renderNutri } from './nutrition.js';
import { renderProfile } from './profile.js';
import { slInit, slNext, slPrev, slTo } from './sliders.js';
import { ST, esc, getLog, getProgress, getSets, key, markDone, resetDay, save, toggleSet } from './state.js';
import { REST_SEC, timerStart } from './timer.js';
import { startWorkout } from './workout.js';

/* ═══════════════════════ RENDER ═════════════════════ */
function refreshProgress() {
  const {total,done}=getProgress(ST.day);
  document.getElementById('progFill').style.width=`${total?done/total*100:0}%`;
  document.getElementById('hdrSub').textContent=`${DAYS[ST.day].label} · ${done}/${total}`;
  document.querySelectorAll('.tab').forEach(t=>{
    if(t.dataset.day===ST.day){
      const b=t.querySelector('.tab-badge');
      if(b){ const {done:d,total:tot}=getProgress(ST.day); b.textContent=d>0?`${d}/${tot}`:''; b.style.display=d>0?'':'none'; }
    }
  });
}

function refreshCard(day,i) {
  const card=document.getElementById(`card-${i}`);
  if(!card) return;
  const isDone=!!ST.done[key(day,i)];
  card.classList.toggle('done',isDone);
  const sets=getSets(day,i);
  card.querySelectorAll('.set-btn').forEach(btn=>{
    const si=+btn.dataset.si;
    btn.classList.toggle('on',sets.includes(si));
  });
}

/* GIF animado do exercises-dataset (180x180, ~90 KB). loading=lazy porque um dia
   pode ter 8 cartões e não vale a pena puxar todos de uma vez. */
function gifSlide(ex){
  return `<div class="slide"><img class="cat-gif" src="${gifUrlFor(ex.catalogId,ex.m)}" alt="${esc(ex.name)}" loading="lazy"
    onerror="this.closest('.slide').innerHTML='<div class=\'no-img\'><span>💪</span><span>${esc(ex.name)}</span></div>'"></div>`;
}

function buildCard(day,ex,i) {
  const card=document.createElement('div');
  card.className='card'+(ST.done[key(day,i)]?' done':'');
  card.id=`card-${i}`;

  // slides: 1) demo real (CDN)  2) mapa muscular  3+) demos do utilizador  4+) diagramas (ex.dia)
  /* Exercício do catálogo: o GIF e os músculos vêm na própria entrada da rotina
     (catalogId + m + mus), por isso o cartão não espera pelo catálogo a chegar. */
  const mm=MUSCLES[ex.name] || (ex.mus && ex.mus.p && ex.mus.p.length ? ex.mus : null);
  const dmo=DEMOS[ex.name];
  const media=(ST.media&&ST.media[ex.name])||[];
  const extra=ex.dia||[];
  const slidesArr=[];
  if(ex.catalogId && ex.m) slidesArr.push(gifSlide(ex));
  else if(dmo) slidesArr.push(demoSlide(dmo,ex.name));
  slidesArr.push(mm ? muscleSlide(mm) : noImgSlide(ex.name));
  media.forEach((url,mi)=>slidesArr.push(mediaSlide(url,ex.name,mi)));
  extra.forEach(src=>slidesArr.push(`<div class="slide"><img src="${src}" alt="${ex.name}" loading="lazy"
        onerror="this.closest('.slide').innerHTML='<div class=\\'no-img\\'><span>💪</span><span>${ex.name}</span></div>'"></div>`));
  const n=slidesArr.length;
  slInit(i,n);
  const slidesHTML=slidesArr.join('');

  const dotsHTML = n>1
    ? `<div class="dots" id="dots-${i}">${Array.from({length:n},(_,j)=>`<div class="dot${j===0?' on':''}" onclick="slTo(${i},${j})"></div>`).join('')}</div>`
    : '';

  const navHTML = n>1
    ? `<button class="slide-prev" onclick="slPrev(${i})">‹</button>
       <button class="slide-next" onclick="slNext(${i})">›</button>`
    : '';

  const totalSets=typeof ex.s==='number'?ex.s:0;
  const completedSets=getSets(day,i);

  const setsHTML = totalSets>0
    ? `<div>
         <div class="sets-label">Séries</div>
         <div class="sets-row">
           ${Array.from({length:totalSets},(_,si)=>`
             <button class="set-btn${completedSets.includes(si)?' on':''}" data-si="${si}"
                     onclick="toggleSet('${day}',${i},${si});this.classList.add('pop');setTimeout(()=>this.classList.remove('pop'),220)">
               ${si+1}
             </button>`).join('')}
         </div>
       </div>`
    : '';

  const jsName=ex.name.replace(/'/g,"\\'");
  const lastLog=getLog(ex.name).slice(-1)[0];
  const loadHTML = totalSets>0 ? `
      <div class="load" id="load-${i}">
        <div class="load-row">
          <input class="load-in" id="w-${i}" type="number" inputmode="decimal" min="0" step="0.5" placeholder="kg" value="${lastLog?lastLog.w:''}" aria-label="Peso (kg)">
          <span class="load-x">×</span>
          <input class="load-in" id="r-${i}" type="number" inputmode="numeric" min="0" step="1" placeholder="reps" value="${lastLog?lastLog.r:''}" aria-label="Repetições">
          <button class="load-save" onclick="saveLoad(${i},'${jsName}')">Registar</button>
          <button class="load-chart-btn" onclick="toggleChart(${i},'${jsName}')" aria-label="Ver progresso">📈</button>
        </div>
        <div class="lc" id="lc-${i}" hidden></div>
      </div>` : '';

  card.innerHTML=`
    <div class="img-wrap">
      <div class="slides" id="slides-${i}">${slidesHTML}</div>
      ${navHTML}
      ${dotsHTML}
      <button class="info-btn" onclick="openInfo('${jsName}','${ex.catalogId||''}')" aria-label="Informação técnica">ℹ</button>
    </div>
    <div class="card-body">
      <div class="card-title-row">
        <div class="card-title">${ex.name}</div>
        <div class="done-pill">✓ Feito</div>
      </div>
      <div class="card-stats">
        <div class="stat">
          <span class="stat-label">Séries</span>
          <span class="stat-val">${ex.s}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Reps</span>
          <span class="stat-val">${ex.r}</span>
        </div>
      </div>
      ${setsHTML}
      ${loadHTML}
      ${ex.tip?`<div class="tip">💡 ${ex.tip}</div>`:''}
      ${ex.alt?`<div class="card-alt"><strong>Alternativa:</strong> ${ex.alt}</div>`:''}
      <div class="card-actions">
        <button class="act-btn act-timer" onclick="timerStart(REST_SEC)">⏱ <span class="rest-lbl">${REST_SEC}s</span></button>
        <button class="act-btn act-done" onclick="markDone('${day}',${i})">
          ${ST.done[key(day,i)]?'✓ Concluído':'Marcar feito'}
        </button>
      </div>
    </div>
  `;

  // swipe
  const wrap=card.querySelector('.img-wrap');
  let x0=0,y0=0,swiping=false;
  wrap.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY;swiping=false;},{passive:true});
  wrap.addEventListener('touchmove',e=>{
    const dx=e.touches[0].clientX-x0,dy=e.touches[0].clientY-y0;
    if(!swiping && Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>6) swiping=true;
  },{passive:true});
  wrap.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-x0;
    if(swiping&&Math.abs(dx)>40){dx<0?slNext(i):slPrev(i);}
  });

  return card;
}


function render(day) {
  ST.day=day; save();
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.day===day));

  const content=document.getElementById('content');
  if(day==='__nutri'){ renderNutri(content); return; }
  if(day==='__perfil'){ renderProfile(content); return; }
  content.innerHTML='';

  const editing=isEditing(day);

  // day header
  const hdr=document.createElement('div');
  hdr.className='day-hdr';
  hdr.innerHTML=`
    <div class="day-hdr-text">
      <div class="day-hdr-name">${day}</div>
      <div class="day-hdr-sub">${DAYS[day].label}</div>
    </div>
    <div class="day-hdr-btns">
      ${editing
        ? `<button class="start-wo" onclick="toggleEdit('${day}')">✓ Pronto</button>`
        : `<button class="start-wo" onclick="startWorkout('${day}')">▶ Iniciar</button>
           <button class="reset-btn" onclick="toggleEdit('${day}')">✎ Editar</button>
           <button class="reset-btn" onclick="resetDay('${day}')">↺ Reset</button>`}
    </div>
  `;
  content.appendChild(hdr);

  if(editing){
    const box=document.createElement('div');
    box.innerHTML=editorHTML(day);
    content.appendChild(box);
    refreshProgress();
    return;
  }

  DAYS[day].ex.forEach((ex,i)=>content.appendChild(buildCard(day,ex,i)));
  refreshProgress();
}

// build tabs

export { refreshProgress, refreshCard, buildCard, gifSlide, render };
