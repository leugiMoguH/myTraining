/* myTraining — módulo extraído de index.html (Fase 0). */
import { gifUrlFor } from './catalog.js';
import { MUSCLES, bodySVG, muscleSlide, noImgSlide } from './charts.js';
import { customEntryHTML, renderCustom } from './custom.js';
import { editorHTML, isEditing, toggleEdit } from './editor.js';
import { CUSTOM_DAY, DAYS } from './routine.js';
import { openInfo } from './guide.js';
import { saveLoad, toggleChart } from './loads.js';
import { DEMOS, demoSlide, mediaSlide } from './media.js';
import { renderNutri } from './nutrition.js';
import { renderProfile } from './profile.js';
import { slInit, slNext, slPrev, slTo } from './sliders.js';
import { agenda, completeDay, dayStatus, reopenDay, swapOriginal } from './schedule.js';
import { ST, esc, getLog, getProgress, getSets, key, markDone, resetDay, save, toggleSet } from './state.js';
import { REST_SEC, timerStart } from './timer.js';
import { syncNav } from './nav.js';
import { fmtDur, liveDay, statsOf } from './session.js';
import { startWorkout } from './workout.js';

/* ═══════════════════════ RENDER ═════════════════════ */
function refreshProgress() {
  /* no treino personalizado o dia ativo não é ST.day (que continua a ser um dia real) */
  const day=ST.view==='__pers' ? CUSTOM_DAY : ST.day;
  if(!DAYS[day]) return;
  const {total,done}=getProgress(day);
  document.getElementById('progFill').style.width=`${total?done/total*100:0}%`;
  document.getElementById('hdrSub').textContent=`${DAYS[day].label} · ${done}/${total}`;
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
  const trocado=swapOriginal(day,i);

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
      ${trocado?`<div class="card-swap">🔄 Trocado só esta semana ·
        <button class="linklike" onclick="undoSwap('${day}',${i})">repor ${esc(trocado.name)}</button></div>`:''}
      <div class="card-actions">
        <button class="act-btn act-timer" onclick="timerStart(REST_SEC)">⏱ <span class="rest-lbl">${REST_SEC}s</span></button>
        <button class="act-btn act-swap" onclick="openSwap('${day}',${i})" title="Trocar por um equivalente">🔄</button>
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


/* ═══════════════════════ AGENDA ═════════════════════ */

/* Tira dos 7 dias com o estado de cada um. Substitui a antiga fila de
   separadores: é por aqui que se salta para um dia concreto. */
function weekStripHTML(a) {
  return `<div class="week-strip">${a.days.map(d=>`
    <button class="wk-chip s-${d.status}${d.isToday?' today':''}${d.isCurrent?' current':''}"
            data-day="${d.day}" onclick="goDay('${d.day}')" title="${esc(d.label)}">
      <span class="wk-d">${d.short}</span>
      <span class="wk-i">${d.icon}</span>
    </button>`).join('')}</div>`;
}

function bannerHTML(a) {
  if (a.restToday && a.late) return `<div class="sched-note warn">😴 Hoje é descanso, mas <b>${a.current}</b> ficou pendente.</div>`;
  if (a.late) return `<div class="sched-note warn">⏳ Em atraso: <b>${a.current}</b> ficou por fazer. Faz este antes de avançar.</div>`;
  return '';   /* em dia: nada a avisar */
}

/* Nada para treinar hoje: ou é dia de descanso, ou a semana já está fechada. */
function restCardHTML(a) {
  const next = a.current;
  return `
    <div class="rest-card">
      <div class="rest-emoji">${a.allDone?'🎉':'😴'}</div>
      <div class="rest-title">${a.allDone?'Semana concluída':'Dia de descanso'}</div>
      <div class="rest-sub">${a.allDone
        ? 'Todos os treinos do plano estão feitos. O progresso faz reset na Segunda.'
        : 'Recupera. Dormir e comer é onde o músculo cresce.'}</div>
      ${next?`<button class="start-wo" onclick="goDay('${next}')">▶ Treinar na mesma: ${next}</button>`:''}
    </div>`;
}

function renderToday(content) {
  const a = agenda();
  content.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'full';
  head.innerHTML = weekStripHTML(a);
  content.appendChild(head);

  /* dia de descanso e sem atrasos, ou semana fechada → não há treino a mostrar */
  if (a.allDone || (a.restToday && !a.late)) {
    const box = document.createElement('div');
    box.className = 'full';
    box.innerHTML = restCardHTML(a) + customEntryHTML();
    content.appendChild(box);
    document.getElementById('hdrSub').textContent = a.allDone ? 'Semana concluída' : 'Descanso';
    document.getElementById('progFill').style.width = a.allDone ? '100%' : '0';
    return;
  }

  /* ST.day tem de ser um dia real: é a chave do progresso (`dia:índice`) */
  ST.day = a.current; save();

  const note = document.createElement('div');
  note.className = 'full';
  note.innerHTML = bannerHTML(a) + customEntryHTML();
  content.appendChild(note);
  renderDay(content, a.current, false);
}

/* Vista da semana: uma linha por dia, para editar ou saltar para qualquer um. */
function renderWeek(content) {
  const a = agenda();
  const LBL = { done:'Feito', swapped:'Substituído', partial:'A meio', todo:'Por fazer', rest:'Descanso' };
  content.innerHTML = `<div class="full">
    ${weekStripHTML(a)}
    <div class="week-list">${a.days.map(d=>{
      const {done,total} = d.status==='rest' ? {done:0,total:0} : getProgress(d.day);
      return `<div class="wk-row s-${d.status}" data-day="${d.day}" onclick="goDay('${d.day}')">
        <div class="wk-row-main">
          <div class="wk-row-day">${d.icon} ${d.day}${d.isToday?' <span class="wk-today">hoje</span>':''}</div>
          <div class="wk-row-sub">${esc(d.label)}${total?` · ${done}/${total}`:''}</div>
        </div>
        <div class="wk-row-st">${LBL[d.status]}</div>
      </div>`;
    }).join('')}</div>
  </div>`;
  document.getElementById('hdrSub').textContent = `Semana · ${a.pending} treino${a.pending===1?'':'s'} por fazer`;
  document.getElementById('progFill').style.width = `${a.days.length?(a.days.filter(d=>d.status==='done'||d.status==='swapped').length/a.days.filter(d=>d.status!=='rest').length)*100:0}%`;
}

/* Histórico: a Semana (agenda) e os treinos terminados. O histórico completo vem depois. */
function renderHistory(content) {
  renderWeek(content);
  const rows = (ST.workouts || []).filter(w => w.state === 'COMPLETED' || w.state === 'ABANDONED').slice(-10).reverse().map(w => {
    const t = statsOf(w);
    const extra = [t.paused >= 1000 ? `pausa ${fmtDur(t.paused)}` : '', t.unknown >= 1000 ? `sem registo ${fmtDur(t.unknown)}` : ''].filter(Boolean).join(' · ');
    return `<div class="wk-row"><div class="wk-row-main">
      <div class="wk-row-day">${esc(String(w.date || '').split('-').reverse().join('/'))} · ${esc(w.day)}</div>
      <div class="wk-row-sub">${esc(w.label || '')} · ${fmtDur(t.duration)}${extra ? ' · ' + extra : ''}</div></div>
      <div class="wk-row-st">${w.state === 'COMPLETED' ? 'Concluído' : 'Descartado'}</div></div>`;
  }).join('');
  const box = document.createElement('div');
  box.className = 'full';
  box.innerHTML = `<div class="cu-title">Treinos recentes</div><div class="week-list">${rows || '<div class="sched-note">Ainda não há treinos terminados.</div>'}</div>`;
  content.appendChild(box);
}

/* Um dia concreto. `standalone` a falso = está embutido no ecrã "Hoje". */
function renderDay(content, day, standalone = true) {
  if (standalone) {
    content.innerHTML = '';
    if (!DAYS[day]) { content.innerHTML = '<div class="full sched-note warn">Dia desconhecido.</div>'; return; }
    /* a tira da semana anda sempre com o utilizador: é a navegação entre dias */
    const strip = document.createElement('div');
    strip.className = 'full';
    strip.innerHTML = weekStripHTML(agenda());
    content.appendChild(strip);
  }
  if (!DAYS[day]) return;

  const editing = isEditing(day);
  const st = dayStatus(day);

  const hdr = document.createElement('div');
  hdr.className = 'day-hdr';
  hdr.innerHTML = `
    <div class="day-hdr-text">
      <div class="day-hdr-name">${day}</div>
      <div class="day-hdr-sub">${DAYS[day].label}</div>
    </div>
    <div class="day-hdr-btns">
      ${editing
        ? `<button class="start-wo" onclick="toggleEdit('${day}')">✓ Pronto</button>`
        : `<button class="start-wo" onclick="startWorkout('${day}')">${liveDay()===day?'▶ Continuar':'▶ Iniciar'}</button>
           <button class="reset-btn" onclick="toggleEdit('${day}')">✎ Editar</button>
           <button class="reset-btn" onclick="resetDay('${day}')">↺ Reset</button>`}
    </div>
  `;
  content.appendChild(hdr);

  if (editing) {
    const box = document.createElement('div');
    box.innerHTML = editorHTML(day);
    content.appendChild(box);
    refreshProgress();
    return;
  }

  DAYS[day].ex.forEach((ex,i)=>content.appendChild(buildCard(day,ex,i)));

  if (st !== 'rest') {
    const foot = document.createElement('div');
    foot.className = 'day-foot';
    foot.innerHTML = st === 'done' || st === 'swapped'
      ? `${st === 'swapped' ? '<div class="sched-note">🎯 Substituído por um treino personalizado.</div>' : ''}
         <button class="reset-btn" onclick="toggleDayDone('${day}')">↩ Reabrir treino</button>`
      : `<button class="start-wo wide" onclick="toggleDayDone('${day}')">✓ Concluir treino</button>`;
    content.appendChild(foot);
  }
  refreshProgress();
}

/* Marca/desmarca o treino do dia e volta ao ecrã onde estavas. */
function toggleDayDone(day) {
  ['done', 'swapped'].includes(dayStatus(day)) ? reopenDay(day) : completeDay(day);
  render(ST.view === '__hoje' ? '__hoje' : day);
}

function goDay(day) { render(day); }

/* `target` é um dia da rotina ou um dos ecrãs `__…`. */
function render(target) {
  if (target === '__semana') target = '__hist';   /* ecrã antigo, agora dentro do Histórico */
  const content = document.getElementById('content');
  const isView = String(target).startsWith('__');

  /* Quem chama render(dia) depois de mexer no progresso (reset, treino guiado,
     media) não devia arrancar o utilizador do ecrã "Hoje" quando é o mesmo dia. */
  if (!isView && ST.view === '__hoje' && target === ST.day) target = '__hoje';
  /* o treino personalizado tem ecrã próprio: ST.day nunca pode ser ele */
  if (target === CUSTOM_DAY || (!isView && ST.view === '__pers' && target === ST.day)) target = '__pers';
  ST.view = String(target).startsWith('__') ? target : '__dia';
  if (ST.view === '__dia') ST.day = target;
  save();

  syncNav();

  if (target === '__nutri') { renderNutri(content); return; }
  if (target === '__perfil'){ renderProfile(content); return; }
  if (target === '__hist')  { renderHistory(content); return; }
  if (target === '__hoje')  { renderToday(content); return; }
  if (target === '__pers')  { renderCustom(content); return; }
  renderDay(content, target);
}

export { refreshProgress, refreshCard, buildCard, gifSlide, render, renderDay, renderToday, renderWeek, renderHistory, goDay, toggleDayDone };
