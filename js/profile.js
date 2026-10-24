import { confirmDialog } from './dialog.js';
import { fieldError } from './inline-error.js';
/* myTraining — módulo extraído de index.html (Fase 0). */
import { chartSVG } from './charts.js';
import { calcTargets } from './nutrition.js';
import { ST, fmtDateTime, fmtTime, nowISO, save, todayStr } from './state.js';
import { prefsSummaryHTML } from './onboarding.js';
import { exerciseListHTML } from './history.js';
import { muscleMapHTML, muscleMapWarm } from './muscle-map.js';
import { volumeHTML } from './volume.js';
import { motivEvolutionHTML } from './motiv-ui.js';

const DRAFT = Object.create(null);
const PIDS=['p-sex','p-age','p-height','p-goal','p-activity'];
const MIDS=['m-date','m-weight','m-waist','m-neck','m-hip','m-chest','m-arm','m-thigh'];
const idsFor=k=>k==='profile'?PIDS:/^measure:(new|\d{4}-\d{2}-\d{2})$/.test(k)?MIDS:null;
function baseFields(k){
  const p=ST.profile||{};
  if(k==='profile') return Object.fromEntries(PIDS.map((id,i)=>[id,String([p.sex||'m',p.age||'',p.height||'',p.goal||'manter',p.activity||'mod'][i])]));
  const date=k.slice(8), e=(ST.measures||[]).find(e=>e.date===date);
  if(date!=='new'&&!e) return null;
  const fields=Object.fromEntries(MIDS.map(id=>[id,String(id==='m-date'?(e?.date||todayStr()):(date==='new'?'':e?.[id.slice(2)]??''))]));
  if(date==='new') fields['m-existing']=JSON.stringify((ST.measures||[]).map(e=>JSON.stringify(e)));
  return fields;
}
function persistDrafts(){try{if(Object.keys(DRAFT).length)localStorage.setItem('treino_drafts',JSON.stringify({v:1,forms:DRAFT}));else localStorage.removeItem('treino_drafts');}catch(_){}}
let loaded=false;
function validateDrafts(){
  if(!loaded){loaded=true;try{
    const raw=localStorage.getItem('treino_drafts');
    if(raw){const d=JSON.parse(raw),obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
      if(!obj(d)||d.v!==1||!obj(d.forms))throw Error();
      for(const [k,v] of Object.entries(d.forms)){
        const ids=idsFor(k);if(!ids||!obj(v)||typeof v.base!=='string'||!obj(v.fields))throw Error();
        const base=JSON.parse(v.base);
        if(!obj(base)||Object.keys(base).length!==ids.length+(k==='measure:new'&&typeof base['m-existing']==='string'?1:0)||ids.some(id=>typeof base[id]!=='string')||Object.keys(base).some(id=>!ids.includes(id)&&!(k==='measure:new'&&id==='m-existing'))||Object.entries(v.fields).some(([id,x])=>!ids.includes(id)||typeof x!=='string'))throw Error();
        if(k==='measure:new'&&base['m-existing']!==undefined){const entries=JSON.parse(base['m-existing']);if(!Array.isArray(entries)||entries.some(e=>typeof e!=='string'))throw Error();}
      }Object.assign(DRAFT,d.forms);
    }
  }catch(_){}}
  for(const [k,d] of Object.entries(DRAFT)){
    const base=baseFields(k);
    if(!base||(k==='measure:new'&&(ST.measures||[]).some(e=>e.date===(d.fields['m-date']||JSON.parse(d.base)['m-date'])&&!JSON.parse(JSON.parse(d.base)['m-existing']||'[]').includes(JSON.stringify(e))))||(k!=='measure:new'&&JSON.stringify(base)!==d.base)||Object.entries(d.fields).every(([id,v])=>v===JSON.parse(d.base)[id]))delete DRAFT[k];
  }persistDrafts();
}
const hasDraft=k=>!!DRAFT[k];
function syncDiscard(f){const b=f.querySelector('[data-discard]');if(b)b.hidden=!hasDraft(f.dataset.draft);}
document.addEventListener('input',e=>{
  const t=e.target,f=t?.closest?.('[data-draft]'),k=f?.dataset.draft;
  if(!f||!idsFor(k)?.includes(t.id))return;
  validateDrafts();const d=DRAFT[k]||{base:JSON.stringify(baseFields(k)),fields:{}};
  for(const id of idsFor(k)){const el=f.querySelector('#'+id);if(el)d.fields[id]=el.value;}
  DRAFT[k]=d;if(Object.entries(d.fields).every(([id,v])=>v===JSON.parse(d.base)[id]))delete DRAFT[k];
  persistDrafts();syncDiscard(f);
});
function applyDraft(k){const f=document.querySelector('[data-draft="'+k+'"]');if(!f)return;for(const [id,v]of Object.entries(DRAFT[k]?.fields||{})){const el=f.querySelector('#'+id);if(el)el.value=v;}syncDiscard(f);}
const clearDraft=k=>{delete DRAFT[k];persistDrafts();};
const clearDrafts=()=>{loaded=true;Object.keys(DRAFT).forEach(k=>delete DRAFT[k]);MEASURE_EDIT_DATE=null;persistDrafts();};
function discardDraft(k){clearDraft(k);if(k==='profile')renderProfile();else{MEASURE_EDIT_DATE=null;renderEvolution();}}

/* Três ecrãs com os dados deste módulo (ids de vista): '__perfil' = Evolução (a aba; id antigo, mantém-se para não
   mudar o ecrã de quem tinha a app aberta), '__eu' = Perfil (dados pessoais e preferências), '__plano' = Plano. */
/* ═══════════════════════ PERFIL ═════════════════════ */
function getProfile(){ return ST.profile||{}; }
function bodyMetrics(){ const p=getProfile(); return { sex:p.sex||'m', age:+p.age||0, height:+p.height||0, goal:p.goal||'manter', activity:p.activity||'mod', weight:latestWeight() }; }
function profileComplete(){ const b=bodyMetrics(); return b.age>0 && b.height>0 && b.weight>0; }
function latestMeasure(){ const m=ST.measures||[]; return m.length?m[m.length-1]:null; }
function latestWeight(){ const e=latestMeasure(); return e&&e.weight>0?e.weight:0; }

function bodyFat(e){
  const p=getProfile(), h=+p.height, waist=+e.waist, neck=+e.neck, hip=+e.hip;
  if(!(h>0)) return null;
  let v;
  if(p.sex==='f'){
    if(!(waist>0 && hip>0 && neck>0 && (waist+hip-neck)>0)) return null;
    v=495/(1.29579-0.35004*Math.log10(waist+hip-neck)+0.22100*Math.log10(h))-450;
  } else {
    if(!(waist>0 && neck>0 && (waist-neck)>0)) return null;
    v=495/(1.0324-0.19077*Math.log10(waist-neck)+0.15456*Math.log10(h))-450;
  }
  if(!isFinite(v) || v<=0 || v>70) return null;
  return Math.round(v*10)/10;
}

const METRIC_DEF={weight:['Peso','kg'],bf:['% Gordura','%'],waist:['Cintura','cm'],neck:['Pescoço','cm'],hip:['Anca','cm'],chest:['Peito','cm'],arm:['Braço','cm'],thigh:['Coxa','cm']};
let MEASURE_METRIC='weight';
let MEASURE_EDIT_DATE=null;
function measureSeries(field){
  const out=[];
  (ST.measures||[]).forEach(e=>{ const v= field==='bf'?bodyFat(e):e[field]; if(typeof v==='number' && !isNaN(v)) out.push({date:e.date,v}); });
  return out;
}
function metricChartHTML(field){
  const s=measureSeries(field), def=METRIC_DEF[field]||[field,''];
  if(!s.length) return `<div class="lc-empty">Sem registos de ${def[0]}.</div>`;
  const vals=s.map(p=>p.v), last=vals[vals.length-1], first=vals[0], d=Math.round((last-first)*10)/10;
  return chartSVG(vals)+`<div class="lc-meta"><span><b>${last}</b>${def[1]} ${def[0]}</span><span class="lc-1rm">${d>0?'+':''}${d}${def[1]} desde início</span><span class="lc-range">${s.length} reg.</span></div>`;
}
function setMetric(m){
  MEASURE_METRIC=m;
  const host=document.getElementById('mchart'); if(host) host.innerHTML=metricChartHTML(m);
  document.querySelectorAll('#mchips .m-chip').forEach(c=>{ const on=c.dataset.m===m; c.classList.toggle('prim',on); c.setAttribute('aria-pressed',on); });
}
function measuresDashboard(){
  const avail=Object.keys(METRIC_DEF).filter(f=>measureSeries(f).length>0);
  if(avail.indexOf(MEASURE_METRIC)<0) MEASURE_METRIC=avail[0]||'weight';
  const chips=avail.map(f=>`<button type="button" class="m-chip${f===MEASURE_METRIC?' prim':''}" data-m="${f}" aria-pressed="${f===MEASURE_METRIC}" onclick="setMetric('${f}')">${METRIC_DEF[f][0]}</button>`).join('');
  const last=latestMeasure();
  return `<div id="mchips" class="m-legend" style="justify-content:flex-start">${chips}</div><div class="lc" id="mchart">${metricChartHTML(MEASURE_METRIC)}</div>${last&&last.ts?`<div class="ndisc">Último registo: ${fmtDateTime(last.ts)}</div>`:''}`;
}

function profileDataHTML(){
  const p=getProfile(), sel=(v,o)=>v===o?' selected':'';
  return `
  <div class="nplan-hdr"><div><div class="day-hdr-name">👤 Dados pessoais</div><div class="day-hdr-sub">Fonte para as metas de Nutrição</div></div></div>
  <div class="nform" data-draft="profile">
    <div class="nrow">
      <label class="nfield"><span>Sexo</span><select id="p-sex"><option value="m"${sel(p.sex||'m','m')}>Masculino</option><option value="f"${sel(p.sex,'f')}>Feminino</option></select></label>
      <label class="nfield"><span>Idade</span><input id="p-age" type="number" min="10" max="100" inputmode="numeric" value="${p.age||''}"></label>
      <label class="nfield"><span>Altura (cm) *</span><input id="p-height" type="number" min="120" max="230" inputmode="numeric" value="${p.height||''}"></label>
    </div>
    <div class="nrow">
      <label class="nfield"><span>Objetivo alimentar</span><select id="p-goal"><option value="perder"${sel(p.goal,'perder')}>Perder gordura</option><option value="manter"${sel(p.goal||'manter','manter')}>Manter</option><option value="ganhar"${sel(p.goal,'ganhar')}>Ganhar músculo</option></select></label>
      <label class="nfield"><span>Atividade (fora do treino)</span><select id="p-activity"><option value="sed"${sel(p.activity,'sed')}>Sedentário</option><option value="leve"${sel(p.activity,'leve')}>Leve</option><option value="mod"${sel(p.activity||'mod','mod')}>Moderado</option><option value="alto"${sel(p.activity,'alto')}>Alto</option></select></label>
    </div>
    <button class="nbtn" onclick="saveProfile()">Guardar dados</button>
    <button type="button" class="reset-btn" data-discard hidden onclick="discardDraft('profile')">Descartar rascunho</button>
  </div>`;
}
function saveProfile(){
  const v=id=>{ const el=document.getElementById(id); return el?el.value:''; };
  const height=parseFloat(v('p-height'));
  if(!(height>0)){ fieldError('p-height','A altura é obrigatória.'); return; }
  const previous=ST.profile;
  ST.profile={ sex:v('p-sex'), age:parseInt(v('p-age'),10)||0, height, goal:v('p-goal'), activity:v('p-activity') };
  if(!save()){ST.profile=previous;return;}
  clearDraft('profile'); renderProfile();
}

function measureFormHTML(){
  const editing=MEASURE_EDIT_DATE;
  const src=editing ? (ST.measures||[]).find(e=>e.date===editing) : null;
  const g=f=> src&&src[f]!=null?src[f]:'';
  const theDate=editing||todayStr();
  return `<div class="nform" data-draft="measure:${editing||'new'}">
    <label class="nfield"><span>Data</span><input id="m-date" type="date" max="${todayStr()}" value="${theDate}"></label>
    <div class="mgrid">
      <label class="nfield"><span>Peso (kg) *</span><input id="m-weight" type="number" step="0.1" inputmode="decimal" value="${g('weight')}"></label>
      <label class="nfield"><span>Cintura (cm)</span><input id="m-waist" type="number" step="0.1" inputmode="decimal" value="${g('waist')}"></label>
      <label class="nfield"><span>Pescoço (cm)</span><input id="m-neck" type="number" step="0.1" inputmode="decimal" value="${g('neck')}"></label>
      <label class="nfield"><span>Anca (cm)</span><input id="m-hip" type="number" step="0.1" inputmode="decimal" value="${g('hip')}"></label>
      <label class="nfield"><span>Peito (cm)</span><input id="m-chest" type="number" step="0.1" inputmode="decimal" value="${g('chest')}"></label>
      <label class="nfield"><span>Braço (cm)</span><input id="m-arm" type="number" step="0.1" inputmode="decimal" value="${g('arm')}"></label>
      <label class="nfield"><span>Coxa (cm)</span><input id="m-thigh" type="number" step="0.1" inputmode="decimal" value="${g('thigh')}"></label>
    </div>
    <button class="nbtn" onclick="saveMeasure()">${editing?'Guardar alterações':'Registar medidas de hoje'}</button>
    ${!editing?`<button type="button" class="reset-btn" data-discard hidden onclick="discardDraft('measure:new')">Descartar rascunho</button>`:''}
    ${editing?`<button class="reset-btn" onclick="cancelMeasureEdit()">✕ Cancelar edição</button>`:''}
  </div>`;
}
/* Evolução das medidas: gráfico primeiro; registar e o histórico completo ficam em secções que se abrem (abertas se há edição/rascunho) */
function measuresHTML(){
  const editing=MEASURE_EDIT_DATE, src=editing ? (ST.measures||[]).find(e=>e.date===editing) : latestMeasure();
  const bf=src?bodyFat(src):null, has=(ST.measures||[]).length>0;
  const formOpen=!!editing||hasDraft('measure:new');
  return `<div class="nsec-title">Medidas corporais${editing?` · <span style="color:var(--accent)">a editar ${editing}</span>`:''}${bf!=null?` · <span style="color:var(--accent2)">${bf}% gordura (calc.)</span>`:''}</div>
  ${has ? measuresDashboard() : '<div class="ndisc">Regista o peso (e cintura+pescoço para calcular a % de gordura) para veres a evolução.</div>'}
  <details class="ev-more" id="m-form"${formOpen?' open':''}><summary>${editing?'Editar registo':'＋ Registar medidas'}</summary>${measureFormHTML()}</details>
  ${has ? `<details class="ev-more" id="m-hist"${editing?' open':''}><summary>Histórico de medidas (${(ST.measures||[]).length})</summary>${measuresHistoryHTML()}</details>` : ''}`;
}
async function saveMeasure(){
  const num=id=>{ const el=document.getElementById(id); const x=el?parseFloat(el.value):NaN; return x>0?x:undefined; };
  const weight=num('m-weight');
  if(!(weight>0)){ fieldError('m-weight','O peso é obrigatório para registar medidas.'); return; }
  const dEl=document.getElementById('m-date');
  let date=(dEl && /^\d{4}-\d{2}-\d{2}$/.test(dEl.value)) ? dEl.value : (MEASURE_EDIT_DATE||todayStr());
  if(date>todayStr()) date=todayStr();
  const entry={ date, ts:nowISO(), weight };
  ['waist','neck','hip','chest','arm','thigh'].forEach(f=>{ const x=num('m-'+f); if(x!==undefined) entry[f]=x; });
  if(!MEASURE_EDIT_DATE&&(ST.measures||[]).some(e=>e.date===date)){
    const before=JSON.stringify((ST.measures||[]).find(e=>e.date===date));
    if(!await confirmDialog({title:'Substituir medidas', confirmLabel:'Substituir', message:'Já existe um registo de medidas nesta data. Substituir?', danger:true})) return;
    if(MEASURE_EDIT_DATE||before!==JSON.stringify((ST.measures||[]).find(e=>e.date===date))) return;
  }
  let arr=(ST.measures||[]).slice();
  if(MEASURE_EDIT_DATE && MEASURE_EDIT_DATE!==date) arr=arr.filter(e=>e.date!==MEASURE_EDIT_DATE); // data mudou → remove antigo
  const idx=arr.findIndex(e=>e.date===date);
  if(idx>=0) arr[idx]=Object.assign({},arr[idx],entry); else arr.push(entry);
  arr.sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0));
  const previous=ST.measures;
  ST.measures=arr;
  if(!save()){ST.measures=previous;return;}
  clearDraft('measure:'+(MEASURE_EDIT_DATE||'new')); MEASURE_EDIT_DATE=null;
  renderEvolution();
}
function editMeasure(date){ MEASURE_EDIT_DATE=date; renderEvolution(); }
function cancelMeasureEdit(){ clearDraft('measure:'+MEASURE_EDIT_DATE); MEASURE_EDIT_DATE=null; renderEvolution(); }
async function delMeasure(date){
  const entry=()=>JSON.stringify((ST.measures||[]).find(e=>e.date===date));
  const before=entry(); if(!before) return;
  if(!await confirmDialog({title:'Apagar medidas', confirmLabel:'Apagar', message:'Apagar este registo de medidas?', danger:true})) return;
  if(before!==entry()) return;
  ST.measures=(ST.measures||[]).filter(e=>e.date!==date);
  clearDraft('measure:'+date);
  if(MEASURE_EDIT_DATE===date) MEASURE_EDIT_DATE=null;
  save(); renderEvolution();
}
function measuresHistoryHTML(){
  const arr=(ST.measures||[]).slice().sort((a,b)=>a.date<b.date?1:-1);
  if(!arr.length) return '';
  return `<div class="ilist">`+arr.map(e=>{
    const bf=bodyFat(e), parts=[`${e.weight}kg`];
    if(bf!=null) parts.push(`${bf}% gord.`);
    ['waist','neck','hip','chest','arm','thigh'].forEach(f=>{ if(e[f]!=null) parts.push(`${METRIC_DEF[f][0]} ${e[f]}`); });
    return `<div class="iitem"><div class="iitem-main"><span class="iitem-n">${e.date}</span><span class="iitem-t">${e.ts?fmtTime(e.ts)+' · ':''}${parts.join(' · ')}</span></div><div class="iitem-r"><button class="iitem-x" onclick="editMeasure('${e.date}')" aria-label="Editar registo">✎</button><button class="iitem-x" onclick="delMeasure('${e.date}')" aria-label="Apagar registo">✕</button></div></div>`;
  }).join('')+`</div>`;
}

function macrosSummaryHTML(){
  const b=bodyMetrics();
  if(!(b.age>0 && b.height>0 && b.weight>0)) return `<div class="nsec-title">Macros &amp; metas</div><div class="ndisc">Preenche idade + altura aqui e regista o peso em Evolução para calcular as metas.</div>`;
  const t=calcTargets(b), goalTxt={perder:'perder gordura',manter:'manter',ganhar:'ganhar músculo'}[b.goal]||b.goal;
  return `<div class="nsec-title">Macros &amp; metas</div>
  <div class="ntargets">
    <div class="ntar"><span class="ntar-v">${t.kcal}</span><span class="ntar-l">kcal/dia</span></div>
    <div class="ntar"><span class="ntar-v">${t.protein}g</span><span class="ntar-l">proteína</span></div>
    <div class="ntar"><span class="ntar-v">${t.water}L</span><span class="ntar-l">água</span></div>
  </div>
  <div class="nmacros">Hidratos ~${t.carbG}g · Gordura ~${t.fatG}g · objetivo: ${goalTxt}</div>
  <button class="reset-btn btn-secondary" onclick="render('__nutri')">🥗 Abrir Nutrição</button>`;
}
const backHTML=`<button class="reset-btn btn-ghost hx-back" onclick="render('__hoje')">‹ Início</button>`;
/* só o formulário que está desenhado: medida nova OU a que se está a editar (nunca a nova por cima de um registo antigo) */
const measureKey=()=>'measure:'+(MEASURE_EDIT_DATE||'new');

/* Perfil ('__eu'): quem és (dados pessoais, preferências de treino) e as metas que daí saem */
function renderProfile(content){
  validateDrafts();
  content=content||document.getElementById('content');
  document.getElementById('hdrSub').textContent='Perfil';
  document.getElementById('progFill').style.width='0%';
  content.innerHTML=`<div class="nutri-wrap">${backHTML}${prefsSummaryHTML()}${profileDataHTML()}${macrosSummaryHTML()}</div>`;
  applyDraft('profile');
}

/* Evolução ('__perfil', a aba): só acompanhamento — exercícios, recordes, medidas, músculos, volume */
function renderEvolution(content){
  validateDrafts();
  if(!MEASURE_EDIT_DATE&&!hasDraft('measure:new')) MEASURE_EDIT_DATE=Object.keys(DRAFT).find(k=>k.startsWith('measure:'))?.slice(8)||null;
  content=content||document.getElementById('content');
  document.getElementById('hdrSub').textContent='Evolução';
  document.getElementById('progFill').style.width='0%';
  content.innerHTML=`<div class="nutri-wrap">${motivEvolutionHTML()}${exerciseListHTML(8)}${measuresHTML()}${muscleMapHTML()}${volumeHTML()}</div>`;
  applyDraft(measureKey());
  muscleMapWarm();
}

export { discardDraft, clearDrafts, renderEvolution, getProfile, bodyMetrics, profileComplete, latestMeasure, latestWeight, bodyFat, METRIC_DEF, MEASURE_METRIC, MEASURE_EDIT_DATE, measureSeries, metricChartHTML, setMetric, measuresDashboard, profileDataHTML, saveProfile, measuresHTML, saveMeasure, editMeasure, cancelMeasureEdit, delMeasure, measuresHistoryHTML, macrosSummaryHTML, renderProfile };
