/* myTraining — módulo extraído de index.html (Fase 0). */
import { gifUrlFor } from './catalog.js';
import { MUSCLES, bodySVG, muscleSlide, noImgSlide } from './charts.js';
import { adaptCardHTML, quickButtonHTML } from './adapt-ui.js';
import { histBtn } from './motiv-ui.js';
import { classDayMarks, recentClassesHTML, todayClassesHTML, weekClassesHTML } from './classes-ui.js';
import { customEntryHTML, renderCustom } from './custom.js';
import { editorHTML, isEditing, stopEdit, toggleEdit } from './editor.js';
import { CUSTOM_DAY, DAYS } from './routine.js';
import { openInfo } from './guide.js';
import { saveLoad, toggleChart } from './loads.js';
import { DEMOS, demoSlide, mediaSlide } from './media.js';
import { renderNutri } from './nutrition.js';
import { estimateMin } from './plan.js';
import { renderEvolution, renderProfile } from './profile.js';
import { renderPlan } from './plan-screen.js';
import { slInit, slNext, slPrev, slTo } from './sliders.js';
import { agenda, completeDay, dayStatus, reopenDay, swapOriginal } from './schedule.js';
import { renderExercise } from './history.js';
import { ST, esc, getLog, getProgress, getSets, key, markDone, resetDay, save, toggleSet } from './state.js';
import { REST_SEC, timerStart } from './timer.js';
import { syncNav } from './nav.js';
import { fmtDur, liveDay, statsOf } from './session.js';
import { weekActivity } from './classes.js';
import { startWorkout } from './workout.js';

/* ═══════════════════════ RENDER ═════════════════════ */
/* Regresso ao ecrã de onde se abriu um dia (ex.: Editar a partir do Plano). Só vive enquanto se fica nesse dia. */
let BACK = null;
function setBack(view, label, day) { BACK = { view, label, day }; }
function refreshProgress() {
  /* no treino personalizado o dia ativo não é ST.day (que continua a ser um dia real) */
  const day=ST.view==='__pers' ? CUSTOM_DAY : ST.day;
  if(!DAYS[day]) return;
  const {total,done}=getProgress(day);
  document.getElementById('progFill').style.width=`${total?done/total*100:0}%`;
  document.getElementById('hdrSub').textContent=`${DAYS[day].label} · ${done}/${total}`;
}

/* Estado visual das séries: feita (`on`), atual (`next` = 1.ª por fazer, só com o cartão aberto) e pendente. */
function paintSets(card,sets,isDone){
  const next=isDone?-1:[...card.querySelectorAll('.set-btn')].map(b=>+b.dataset.si).find(si=>!sets.includes(si));
  card.querySelectorAll('.set-btn').forEach(btn=>{
    const si=+btn.dataset.si, on=sets.includes(si);
    btn.classList.toggle('on',on);
    btn.classList.toggle('next',si===next);
    btn.setAttribute('aria-pressed',String(on));
    btn.setAttribute('aria-label',`Série ${si+1}${si===next?', próxima':''}`);
  });
}

function refreshCard(day,i) {
  const card=document.getElementById(`card-${i}`);
  if(!card) return;
  const isDone=!!ST.done[key(day,i)];
  card.classList.toggle('done',isDone);
  paintSets(card,getSets(day,i),isDone);
}

/* GIF animado do exercises-dataset (180x180, ~90 KB). loading=lazy porque um dia
   pode ter 8 cartões e não vale a pena puxar todos de uma vez. */
function slideFail(img){
  const slide=img?.closest?.('.slide'); if(!slide) return;
  const box=document.createElement('div'), icon=document.createElement('span'), name=document.createElement('span');
  box.className='no-img'; icon.textContent='💪'; name.textContent=img.alt;
  box.append(icon,name); slide.replaceChildren(box);
}
function gifSlide(ex){
  return `<div class="slide"><img class="cat-gif" src="${esc(gifUrlFor(ex.catalogId,ex.m))}" alt="${esc(ex.name)}" loading="lazy" onerror="slideFail(this)"></div>`;
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
  slidesArr.push(mm ? muscleSlide(mm) : noImgSlide(esc(ex.name)));
  media.forEach((url,mi)=>slidesArr.push(mediaSlide(url,ex.name,mi)));
  extra.forEach(src=>slidesArr.push(`<div class="slide"><img src="${esc(src)}" alt="${esc(ex.name)}" loading="lazy" onerror="slideFail(this)"></div>`));
  const n=slidesArr.length;
  slInit(i,n);
  const slidesHTML=slidesArr.join('');

  const dotsHTML = n>1
    ? `<div class="dots" id="dots-${i}">${Array.from({length:n},(_,j)=>`<button type="button" class="dot${j===0?' on':''}" aria-label="Imagem ${j+1} de ${n}"${j===0?' aria-current="true"':''} onclick="slTo(${i},${j})"></button>`).join('')}</div>`
    : '';

  const navHTML = n>1
    ? `<button class="slide-prev" onclick="slPrev(${i})">‹</button>
       <button class="slide-next" onclick="slNext(${i})">›</button>`
    : '';

  const totalSets=typeof ex.s==='number'?ex.s:0;
  const completedSets=getSets(day,i);
  const trocado=swapOriginal(day,i);

  /* colunas iguais: até 6 numa linha (6 só se o contentor tiver 304px; senão 3+3); mais séries repartem-se em 2 linhas equilibradas (6 cabe numa linha só a partir de 360px) */
  const cols=totalSets<=6?totalSets:totalSets<=10?Math.ceil(totalSets/2):5;
  const setsHTML = totalSets>0
    ? `<div class="sets-row" role="group" aria-label="Séries" style="--c:${cols}" data-n="${totalSets}">
         ${Array.from({length:totalSets},(_,si)=>`
           <button class="set-btn${completedSets.includes(si)?' on':''}" data-si="${si}" aria-pressed="${completedSets.includes(si)}" aria-label="Série ${si+1}"
                   onclick="toggleSet('${day}',${i},${si});this.classList.add('pop');setTimeout(()=>this.classList.remove('pop'),220)">
             ${si+1}
           </button>`).join('')}
       </div>`
    : '';

  const jsName=esc(ex.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n'));
  const lastLog=getLog(ex.name).slice(-1)[0];
  const loadHTML = totalSets>0 ? `
      <div class="load" id="load-${i}">
        <div class="load-row">
          <input class="load-in" id="w-${i}" type="number" inputmode="decimal" min="0" step="0.5" placeholder="kg" value="${lastLog?lastLog.w:''}" aria-label="Peso (kg)">
          <span class="load-x">×</span>
          <input class="load-in" id="r-${i}" type="number" inputmode="numeric" min="0" step="1" placeholder="reps" value="${lastLog?lastLog.r:''}" aria-label="Repetições">
          <button class="load-save" onclick="saveLoad(${i},'${jsName}')">Registar</button>
        </div>
      </div>` : '';

  card.innerHTML=`
    <div class="card-body">
      <div class="card-title-row">
        <div class="card-title">${esc(ex.name)}</div>
        <div class="card-meta">
          <div class="card-stats">${totalSets>0
            ?`<span class="sr-only">${ex.s} séries de ${esc(ex.r)} repetições</span><span aria-hidden="true" class="st-vis"><b>${ex.s}</b><span class="st-x">×</span><b>${esc(ex.r)}</b></span>`
            :`<b>${esc(ex.s)}</b><span class="st-x" aria-hidden="true">·</span><b>${esc(ex.r)}</b>`}</div>
          <div class="done-pill">✓ Feito</div>
        </div>
      </div>
      ${setsHTML}
      ${loadHTML}
      ${trocado?`<div class="card-swap">🔄 Trocado só esta semana ·
        <button class="linklike" onclick="undoSwap('${day}',${i})">repor ${esc(trocado.name)}</button></div>`:''}
      <div class="card-actions">
        <button class="act-btn act-timer">⏱ <span class="rest-lbl">${REST_SEC}s</span></button>
        <button class="act-btn act-done" onclick="markDone('${day}',${i})">
          ${ST.done[key(day,i)]?'✓ Concluído':'Marcar feito'}
        </button>
      </div>
      <button class="card-more" aria-expanded="false" aria-controls="more-${i}"><span class="more-lbl">Mais</span><svg class="more-ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="card-details" id="more-${i}" hidden>
        <div class="img-wrap">
          <div class="slides" id="slides-${i}">${slidesHTML}</div>
          ${navHTML}
          ${dotsHTML}
          <button class="info-btn" onclick="openInfo('${jsName}','${ex.catalogId||''}')" aria-label="Informação técnica">ℹ</button>
        </div>
        ${ex.tip?`<div class="tip">💡 ${ex.tip}</div>`:''}
        <div class="card-tools">
          ${totalSets>0?`<button class="load-chart-btn" onclick="toggleChart(${i},'${jsName}')" aria-label="Ver progresso">📈 Progresso</button>`:''}
          <button class="act-btn act-swap" onclick="openSwap('${day}',${i})" title="Trocar por um equivalente">🔄 Trocar</button>
        </div>
        ${totalSets>0?`<div class="lc" id="lc-${i}" hidden></div>`:''}
      </div>
    </div>
  `;
  paintSets(card,completedSets,!!ST.done[key(day,i)]);
  card.querySelector('.act-timer').addEventListener('click',()=>timerStart(REST_SEC));
  const more=card.querySelector('.card-more');
  const details=card.querySelector('.card-details');
  more.addEventListener('click',()=>{
    details.hidden=!details.hidden;
    more.setAttribute('aria-expanded',String(!details.hidden));
    more.querySelector('.more-lbl').textContent=details.hidden?'Mais':'Menos';
  });

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
  const marks = classDayMarks();
  return `<div class="week-strip">${a.days.map(d=>`
    <button class="wk-chip s-${d.status}${d.isToday?' today':''}${d.isCurrent?' current':''}"
            data-day="${d.day}" onclick="goDay('${d.day}')" title="${esc(d.label)}${marks.has(d.day) ? ' · com aula' : ''}${d.movedTo ? ` · passa para ${d.movedTo}` : ''}">
      <span class="wk-d">${d.short}${marks.has(d.day) ? '<i class="wk-c" aria-hidden="true"></i>' : ''}</span>
      <span class="wk-i">${d.movedTo ? '↪' : d.icon}</span>
    </button>`).join('')}</div>`;
}

/* Nada para treinar hoje: ou é dia de descanso, ou a semana já está fechada. */
function restCardHTML(a) {
  const next = a.nextPlanned && DAYS[a.nextPlanned];
  const [emoji, title, sub] = !a.allDone
    ? ['😴', 'Dia de descanso', 'Recupera. Dormir e comer é onde o músculo cresce.']
    : !a.nothingDone
      ? ['🎉', 'Semana concluída', 'Todos os treinos do plano estão feitos. O progresso faz reset na Segunda.']
      : ['📅', 'Sem treinos até à próxima semana', next ? `O primeiro treino do plano é na semana que vem: ${a.nextPlanned} · ${esc(next.label)}.` : 'Não há treinos planeados. Podes criar um treino personalizado ou editar o plano.'];
  return `
    <div class="rest-card">
      <div class="rest-emoji">${emoji}</div>
      <div class="rest-title">${title}</div>
      <div class="rest-sub">${sub}</div>
    </div>`;
}

/* Cartão "Hoje": o próximo treino, quanto demora, porquê este plano, e o botão que inicia o treino real. */
function heroHTML(a) {
  const d = DAYS[a.current];
  if (!d || !d.ex.length) return '';
  const kicker = a.restToday && a.late ? `Descanso hoje · ${a.current} pendente` : a.late ? `Em atraso · ${a.current}` : a.current === a.today ? `Hoje · ${a.current}` : `Próximo treino · ${a.current}`;
  const mins = estimateMin(a.current);
  const live = liveDay() === a.current;
  const why = ST.plan && ST.plan.why ? `<details><summary>Porquê este plano?</summary><p>${esc(ST.plan.why)}</p></details>` : '';
  const names = d.ex.map(e => e.name), more = names.length - 3;
  const preview = `${names.slice(0, 3).map(esc).join(' · ')}${more > 0 ? ` · +${more}` : ''}`;
  return `<div class="hero">
    <div class="hero-k">${esc(kicker)}</div><div class="hero-t">${esc(d.label)}</div>
    <div class="hero-s">${mins ? `~${mins} min · ` : ''}${d.ex.length} exercícios</div>
    <div class="hero-ex">${preview}</div>
    <button class="start-wo btn-primary" onclick="heroStart('${a.current}')">${live ? '▶ Continuar treino' : '▶ Começar treino'}</button><div class="hero-links">${quickButtonHTML(a.current)}<button class="linklike" onclick="render('__plano')">Ver plano ›</button></div>${why}</div>`;
}

/* Lista de exercícios do Hoje: recolhida por omissão; abre sozinha com treino em curso, séries marcadas ou edição.
   O que o utilizador escolhe fica por dia enquanto a app está aberta (só vista, nunca dados). */
const listChoice = {};
function listOpen(day) {
  if (day in listChoice) return listChoice[day];
  return isEditing(day) || liveDay() === day || DAYS[day].ex.some((_, i) => getSets(day, i).length) || dayStatus(day) === 'partial';
}
function listToggleHTML(day) {
  const open = listOpen(day), { total, done } = getProgress(day);
  return `<button class="list-toggle" id="todayToggle" aria-expanded="${open}" aria-controls="todayList" onclick="toggleTodayList()">
    <span>${open ? 'Esconder exercícios' : 'Ver exercícios e registar'}</span><small>${done}/${total}</small><i aria-hidden="true">▾</i></button>`;
}
function toggleTodayList() {
  const btn = document.getElementById('todayToggle'), list = document.getElementById('todayList');
  if (!btn || !list || isEditing(ST.day)) return;
  const open = list.hidden;
  listChoice[ST.day] = open;
  list.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  syncHeaderTimer();
  btn.querySelector('span').textContent = open ? 'Esconder exercícios' : 'Ver exercícios e registar';
}

function renderToday(content) {
  const a = agenda();
  content.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'full today-strip';
  head.innerHTML = weekStripHTML(a);
  content.appendChild(head);

  /* dia de descanso e sem atrasos, ou semana fechada → não há treino a mostrar */
  if (a.allDone || (a.restToday && !a.late)) {
    const box = document.createElement('div');
    box.className = 'full';
    box.innerHTML = restCardHTML(a) + (a.current ? heroHTML({ ...a, late: false, today: null }) : `<button class="linklike today-plan-link" onclick="render('__plano')">Ver plano ›</button>`) + adaptCardHTML() + todayClassesHTML() + customEntryHTML();
    content.appendChild(box);
    document.getElementById('hdrSub').textContent = a.allDone ? (a.nothingDone ? 'Sem treinos esta semana' : 'Semana concluída') : 'Descanso';
    document.getElementById('progFill').style.width = a.allDone && !a.nothingDone ? '100%' : '0';
    return;
  }

  /* ST.day tem de ser um dia real: é a chave do progresso (`dia:índice`) */
  ST.day = a.current; save();

  const note = document.createElement('div');
  note.className = 'full today-top';
  note.innerHTML = heroHTML(a) + listToggleHTML(a.current);
  content.appendChild(note);
  const list = document.createElement('div');
  list.className = 'full today-list';
  list.id = 'todayList';
  list.hidden = !listOpen(a.current);
  content.appendChild(list);
  renderDay(list, a.current, false);
  const cu = document.createElement('div');
  cu.className = 'full';
  cu.innerHTML = adaptCardHTML() + todayClassesHTML() + customEntryHTML();
  content.appendChild(cu);
}

/* Vista da semana: uma linha por dia, para editar ou saltar para qualquer um. */
function renderWeek(content) {
  const a = agenda();
  const LBL = { done:'Feito', swapped:'Substituído', partial:'A meio', todo:'Por fazer', rest:'Descanso', skipped:'Antes do plano' };
  content.innerHTML = `<div class="full">
    ${weekStripHTML(a)}
    <div class="week-list">${a.days.map(d=>{
      const {done,total} = d.status==='rest' ? {done:0,total:0} : getProgress(d.day);
      return `<button type="button" class="wk-row s-${d.status}" data-day="${d.day}" onclick="goDay('${d.day}')">
        <div class="wk-row-main">
          <div class="wk-row-day">${d.icon} ${d.day}${d.isToday?' <span class="wk-today">hoje</span>':''}</div>
          <div class="wk-row-sub">${esc(d.label)}${total?` · ${done}/${total}`:''}${d.movedFrom && d.movedFrom.length ? ` · treino de ${d.movedFrom.map(esc).join(', ')} (movido)` : ''}</div>
        </div>
        <div class="wk-row-st">${d.movedTo ? `Passa para ${esc(d.movedTo)}` : d.status==='done' && ST.sched && ST.sched.quick && ST.sched.quick[d.day] ? 'Feito · reduzido' : LBL[d.status]}</div>
      </button>`;
    }).join('')}</div>
    ${weekClassesHTML()}
    <button class="ev-link" onclick="render('__hist')">Histórico ›</button>
  </div>`;
  const nc = weekActivity().classes;
  document.getElementById('hdrSub').textContent = `Semana · ${a.pending} treino${a.pending===1?'':'s'} por fazer${nc ? ` · ${nc} aula${nc===1?'':'s'} feita${nc===1?'':'s'}` : ''}`;
  document.getElementById('progFill').style.width = `${a.days.length?(a.days.filter(d=>d.status==='done'||d.status==='swapped').length/a.days.filter(d=>d.status!=='rest').length)*100:0}%`;
}

/* Histórico: treinos terminados e aulas recentes. */
function renderHistory(content) {
  content.innerHTML = '';
  document.getElementById('hdrSub').textContent = 'Histórico';
  document.getElementById('progFill').style.width = '0%';
  const guided = new Set((ST.workouts || []).map(w => w.id));
  const manual = (ST.sessions || []).filter(s => s.id && !(s.sid && guided.has(s.sid)) && !(ST.workouts || []).some(w => w.day === 'Personalizado' && w.date === s.date && !s.sid) && /^\d{4}-\d{2}-\d{2}$/.test(s.date || ''))
    .map(s => ({ id: s.id, state: 'COMPLETED', date: s.date, day: s.label || 'Treino personalizado', label: '', quick: s.kind === 'quick' ? (s.quick && s.quick.mode) || 'quick' : '', manual: true }));
  const all = [...(ST.workouts || []).filter(w => w.state === 'COMPLETED' || w.state === 'ABANDONED'), ...manual].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const rows = all.slice(-10).reverse().map(w => {
    const t = statsOf(w);
    const extra = [t.paused >= 1000 ? `pausa ${fmtDur(t.paused)}` : '', t.unknown >= 1000 ? `sem registo ${fmtDur(t.unknown)}` : ''].filter(Boolean).join(' · ');
    return `<div class="wk-row"><div class="wk-row-main">
      <div class="wk-row-day">${esc(String(w.date || '').split('-').reverse().join('/'))} · ${esc(w.quick ? (w.quick === 'retoma' ? 'Retoma' : 'Treino rápido') : w.day)}</div>
      <div class="wk-row-sub">${esc(w.label || '')}${w.manual ? 'sem relógio de treino' : ' · ' + fmtDur(t.duration)}${extra ? ' · ' + extra : ''}</div></div>
      <div class="wk-row-st">${w.state === 'COMPLETED' ? (w.quick ? 'Concluído · reduzido' : 'Concluído') : 'Descartado'}</div>${w.state === 'COMPLETED' ? histBtn(w.id, 'Resumo') : ''}</div>`;
  }).join('');
  const box = document.createElement('div');
  box.className = 'full';
  box.innerHTML = `<div class="cu-title">Treinos recentes</div><div class="week-list">${rows || '<div class="sched-note">Ainda não há treinos terminados.</div>'}</div>${recentClassesHTML()}`;
  content.appendChild(box);
  const ex = document.createElement('div');
  ex.className = 'full';
  ex.innerHTML = `<button class="ev-link" onclick="render('__perfil')"><div class="wk-row-main"><div class="wk-row-day">📈 Evolução por exercício</div><div class="wk-row-sub">Cargas, recordes, gráficos e medidas</div></div><div class="wk-row-st">›</div></button>`;
  content.appendChild(ex);
}

/* Um dia concreto. `standalone` a falso = está embutido no ecrã "Hoje". */
function renderDay(content, day, standalone = true) {
  if (standalone) {
    content.innerHTML = '';
    if (!DAYS[day]) { content.innerHTML = '<div class="full sched-note warn">Dia desconhecido.</div>'; return; }
    /* a tira da semana anda sempre com o utilizador: é a navegação entre dias */
    const strip = document.createElement('div');
    strip.className = 'full';
    strip.innerHTML = (BACK && BACK.day === day ? `<button class="reset-btn btn-ghost hx-back" onclick="render('${BACK.view}')">‹ ${esc(BACK.label)}</button>` : '') + weekStripHTML(agenda());
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
        ? `<button class="start-wo btn-primary" onclick="toggleEdit('${day}')">✓ Pronto</button>`
        : `${standalone ? `<button class="start-wo btn-primary" onclick="startWorkout('${day}')">${liveDay()===day?'▶ Continuar':'▶ Iniciar'}</button>` : ''}
           <button class="reset-btn btn-secondary" onclick="toggleEdit('${day}')">✎ Editar</button>
           <button class="reset-btn btn-ghost btn-danger" onclick="resetDay('${day}')">↺ Reset</button>`}
    </div>
  `;
  content.appendChild(hdr);

  if (editing) {
    const box = document.createElement('div');
    box.innerHTML = editorHTML(day);
    box.querySelectorAll('.ed-btn').forEach(b => b.classList.add('btn-ghost'));
    box.querySelectorAll('.ed-del').forEach(b => b.classList.add('btn-danger'));
    box.querySelectorAll('.ed-tag').forEach(b => b.classList.add('tag'));
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
         <button class="reset-btn btn-ghost" onclick="toggleDayDone('${day}')">↩ Reabrir treino</button>`
      : `<button class="start-wo btn-primary wide" onclick="toggleDayDone('${day}')">✓ Concluir treino</button>`;
    content.appendChild(foot);
  }
  refreshProgress();
}

/* Marca/desmarca o treino do dia e volta ao ecrã onde estavas. */
function toggleDayDone(day) {
  ['done', 'swapped'].includes(dayStatus(day)) ? reopenDay(day) : completeDay(day);
  render(ST.view === '__hoje' ? '__hoje' : day);
}

function goDay(day) {
  if (ST.view === '__semana' && DAYS[day]) setBack('__semana', 'Semana', day);
  render(day);
}

/* Só o contentor do temporizador muda de visibilidade; o relógio conserva os seus nós. */
function syncHeaderTimer() {
  const list = document.getElementById('todayList');
  const visible = ['__dia', '__pers', '__ex'].includes(ST.view) ||
    (ST.view === '__hoje' && (liveDay() !== null || !!list && !list.hidden));
  document.body.classList.toggle('show-header-timer', visible);
}

/* `target` é um dia da rotina ou um dos ecrãs `__…`. */
function render(target) {
  const content = document.getElementById('content');
  const isView = String(target).startsWith('__');

  /* Quem chama render(dia) depois de mexer no progresso (reset, treino guiado,
     media) não devia arrancar o utilizador do ecrã "Hoje" quando é o mesmo dia. */
  if (!isView && ST.view === '__hoje' && target === ST.day) target = '__hoje';
  /* o treino personalizado tem ecrã próprio: ST.day nunca pode ser ele */
  if (target === CUSTOM_DAY || (!isView && ST.view === '__pers' && target === ST.day)) target = '__pers';
  if (BACK && (isView || target !== BACK.day)) { if (isEditing(BACK.day)) stopEdit(); BACK = null; }   /* sair do dia aberto a partir do Plano desliga também a edição */
  ST.view = String(target).startsWith('__') ? target : '__dia';
  if (ST.view === '__dia') ST.day = target;
  save();

  syncNav();

  try {
    if (target === '__nutri') { renderNutri(content); return; }
    if (target === '__perfil'){ renderEvolution(content); return; }   /* a aba «Evolução» (id antigo) */
    if (target === '__eu')    { renderProfile(content); return; }     /* Perfil: dados pessoais e preferências */
    if (target === '__plano') { renderPlan(content); return; }
    if (target === '__semana') { renderWeek(content); return; }
    if (target === '__hist')  { renderHistory(content); return; }
    if (target === '__ex')    { renderExercise(content); return; }
    if (target === '__hoje')  { renderToday(content); return; }
    if (target === '__pers')  { renderCustom(content); return; }
    renderDay(content, target);
  } finally { syncHeaderTimer(); }
}

export { syncHeaderTimer, slideFail, setBack, refreshProgress, refreshCard, buildCard, gifSlide, render, renderDay, renderToday, renderWeek, renderHistory, goDay, toggleDayDone, toggleTodayList };
