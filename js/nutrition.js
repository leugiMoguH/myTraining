import { references, energyEstimate } from './nutri-calc.js';
import { NUTRIENTS, nutrient, scaleFood, sumEntries, entryNutrients, parseOff } from './foods.js';
import { openOverlay, closeOverlay } from './overlay.js';
/* myTraining — módulo extraído de index.html (Fase 0). */
import { chartSVG } from './charts.js';
import { fieldError } from './inline-error.js';
import { bodyMetrics, profileComplete } from './profile.js';
import { ST, esc, fmtTime, nowISO, save, todayStr } from './state.js';
import { render } from './ui.js';

/* ═══════════════════════ NUTRIÇÃO ═══════════════════ */
const PROT=['Frango','Peru','Carne vaca','Atum','Salmão','Ovos','Iogurte','Queijo fresco','Tofu','Whey'];
const CARB=['Arroz','Massa','Batata','Batata-doce','Pão','Aveia','Grão','Feijão','Fruta'];
const VEG=['Brócolos','Espinafres','Tomate','Alface','Cenoura','Courgette','Pimento','Feijão-verde'];
const SNACK=['Fruta','Frutos secos','Iogurte','Barra proteica','Queijo','Ovo cozido'];
const RESTR=['Vegetariano','Vegano','Sem lactose','Sem glúten'];
const SUPPS=['Whey','Creatina','Multivitamínico','Ómega-3','Magnésio'];
let NUTRI_EDIT=false;

function calcTargets(p){
  const r=references(p);
  return r.applicable ? {kcal:energyEstimate(p),protein:1.8*p.weight,water:r.water.value,fatG:(r.fat.range[0]+r.fat.range[1])/2,carbG:(r.carbs.range[0]+r.carbs.range[1])/2} : {kcal:null,protein:null,water:null,fatG:null,carbG:null};
}
function referencesHTML(p){
  const r=references(p);
  if(!r.applicable) return `<div class="ndisc">${esc(r.reason)}</div>`;
  const labels={energy:'Energia de manutenção (kcal/dia)',protein:'Proteína (g/dia)',fat:'Gordura (g/dia)',carbs:'Hidratos (g/dia)',fibre:'Fibra (g/dia)',water:'Água total (L/dia)',salt:'Sal (g/dia)',sugars:'Açúcares livres (informação)'};
  return `<div class="nsec-title">Estimativa · referências</div>`+Object.keys(labels).map(k=>{const x=r[k]; return `<div class="ndisc">${labels[k]}: <b>${x.range?x.range.map(v=>Math.round(v)).join('–'):x.value===null?'—':k==='salt'?'&lt;5':Math.round(x.value*10)/10}</b><details><summary>Fonte · ${esc(x.fonte)}</summary>${esc(x.nota)}</details></div>`;}).join('');
}

function mealPlan(p){
  const fav=p.fav||{};
  const pick=(cat,fb,idx)=>{ const a=fav[cat]||[]; return a.length?a[((idx||0)%a.length)]:fb; };
  const hasWhey=(p.supps||[]).indexOf('Whey')>=0;
  const meals=[];
  meals.push({t:'Pequeno-almoço', i:`${pick('protein','Ovos',0)} + ${pick('carbs','Aveia',0)} + fruta`});
  meals.push({t:'Pré-treino · 60–90min antes', i:`${pick('carbs','Pão',1)} + ${pick('protein','Iogurte',1)} — hidratos para energia`, tag:'treino'});
  meals.push({t:'Pós-treino · até 1h depois', i:`${hasWhey?'Whey':pick('protein','Frango',2)} + ${pick('carbs','Arroz',2)} — repor + construir`, tag:'treino'});
  meals.push({t:'Almoço', i:`${pick('protein','Frango',3)} + ${pick('carbs','Arroz',3)} + ${pick('veg','Brócolos',0)}`});
  if((p.meals||4)>=5) meals.push({t:'Lanche', i:`${pick('snack','Fruta',0)} + ${pick('protein','Iogurte',4)}`});
  meals.push({t:'Jantar', i:`${pick('protein','Salmão',4)} + ${pick('veg','Espinafres',1)}${p.goal==='ganhar'?' + '+pick('carbs','Batata-doce',4):''}`});
  if((p.meals||4)>=6) meals.push({t:'Ceia', i:`${pick('snack','Iogurte',1)} — leve, antes de dormir`});
  return meals;
}

function shopping(p){
  const f=p.fav||{};
  const all=[].concat(f.protein||[],f.carbs||[],f.veg||[],f.snack||[]);
  const seen={}, out=[];
  all.forEach(x=>{ if(x && !seen[x]){ seen[x]=1; out.push(x); } });
  return out;
}

/* ── DIÁRIO DE INGESTÃO ───────────────────────────── */
let FOODS=[], foodsLoad=null, selectedFood=null;
const nutrientLabels={kcal:'Energia (kcal)',protein:'Proteína (g)',carbs:'Hidratos (g)',fat:'Gordura (g)',fibre:'Fibra (g)',sugars:'Açúcares totais (g)',salt:'Sal (g)'};
const inputId=k=>k==='protein'?'i-prot':'i-'+k;
const display=v=>v===null||v===undefined?'—':String(Math.round(v*10)/10);
function totalText(t,k){return display(t[k])+(t.missing[k]?` + ${t.missing[k]} sem dado`:'');}
function loadFoods(){
  if(!foodsLoad) foodsLoad=fetch('data/foods-basic.json').then(r=>r.ok?r.json():null).then(j=>{FOODS=Array.isArray(j?.foods)?j.foods.filter(f=>f?.name&&f?.ref&&f?.nutrients):[];}).catch(()=>{FOODS=[];}).then(()=>{
    const box=document.getElementById('basic-foods'); if(box) box.innerHTML=foodsHTML();
  });
}
function foodsHTML(){return FOODS.map((f,k)=>`<button type="button" class="qfood" onclick="fillIntake(${k})">${esc(f.name)}${f.state?' · '+esc(f.state):''}</button>`).join('');}
function addIntake(name,kcal,protein,extra={}){
  name=(name||'').trim(); kcal=nutrient(kcal); protein=nutrient(protein);
  if(!name && kcal===null) return false;
  const item={...extra,id:'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:nowISO(),date:todayStr(),name:name||'Item',kcal,protein};
  ST.intake=(ST.intake||[]).concat([item]); save(); return true;
}
function delIntake(id){ST.intake=(ST.intake||[]).filter(x=>x.id!==id);save();renderNutri();}
function intakeToday(){return (ST.intake||[]).filter(x=>x.date===todayStr());}
function intakeTotals(list){return sumEntries(list);}
function intakeDailySeries(){
  const by={}; (ST.intake||[]).forEach(x=>(by[x.date]??=[]).push(x));
  return Object.keys(by).sort().map(date=>({date,v:sumEntries(by[date]).kcal,missing:sumEntries(by[date]).missing.kcal}));
}
function clearSelectedFood(){
  selectedFood=null; document.getElementById('i-unit').textContent='g'; updatePreview();
}
function selectFood(f){
  selectedFood=f; document.getElementById('i-name').value=f.name;
  document.getElementById('i-grams').value=100;
  document.getElementById('i-unit').textContent=f.ref.unit;
  NUTRIENTS.forEach(k=>{document.getElementById(inputId(k)).value=f.nutrients[k]??'';}); updatePreview();
}
function fillIntake(k){if(FOODS[k]) selectFood(FOODS[k]);}
function formFood(){return selectedFood||{ref:{amount:100,unit:'g'},nutrients:Object.fromEntries(NUTRIENTS.map(k=>[k,nutrient(document.getElementById(inputId(k)).value)]))};}
function foodNote(food){
  const notes=food?.notes;
  return typeof notes==='string'?notes:notes&&typeof notes==='object'?Object.entries(notes).map(([k,v])=>`${nutrientLabels[k]||k}: ${v}`).join(' · '):'';
}
function updatePreview(){
  const f=formFood(), n=scaleFood(f,document.getElementById('i-grams').value);
  document.getElementById('i-preview').textContent='Estimativa para a quantidade: '+NUTRIENTS.map(k=>nutrientLabels[k]+': '+display(n[k])).join(' · ');
  document.getElementById('i-source').textContent=selectedFood?`${f.source} · ${f.sourceId} · versão ${f.version??'não indicada'} · ${foodNote(f)}`:'Entrada manual: valores por 100 g indicados por ti.';
}
function addIntakeUI(){
  const g=nutrient(document.getElementById('i-grams').value);
  if(!g){fieldError('i-grams','Indica uma quantidade superior a zero.');return;}
  const f=formFood(), n=scaleFood(f,g);
  const extra={g,unit:f.ref.unit,src:selectedFood?.source||'manual',sid:selectedFood?.sourceId??null,ver:selectedFood?.version??null,note:foodNote(selectedFood),n:Object.fromEntries(NUTRIENTS.filter(k=>k!=='kcal'&&k!=='protein').map(k=>[k,n[k]]))};
  if(addIntake(document.getElementById('i-name').value,n.kcal,n.protein,extra)) renderNutri();
  else fieldError('i-name','Indica pelo menos um nome ou as kcal.');
}
function entryHTML(x){
  const n=entryNutrients(x);
  const source=x.src?`${x.src} · ${x.sid??'sem identificador'} · versão ${x.ver??'não indicada'}${x.note?' · '+x.note:''}`:'Registo anterior: fonte não indicada.';
  return `<div class="iitem" style="flex-wrap:wrap"><div class="iitem-main"><span class="iitem-n">${esc(x.name)}</span><span class="iitem-t">${fmtTime(x.ts)}${x.g?' · '+display(x.g)+' '+esc(x.unit):''}</span></div><div class="iitem-r"><span>${display(n.kcal)} kcal · ${display(n.protein)} g proteína</span><button class="iitem-x" onclick="delIntake('${esc(x.id)}')" aria-label="Remover">✕</button></div><details class="ndisc" style="width:100%;overflow-wrap:anywhere"><summary>Estimativa · fonte e nutrientes</summary>${esc(source)}<br>${NUTRIENTS.filter(k=>n[k]!==null).map(k=>`${nutrientLabels[k]}: ${display(n[k])}`).join(' · ')}</details></div>`;
}
function totalsHTML(list){
  const t=sumEntries(list);
  return `<div class="ndisc">Estimativa · total registado: ${NUTRIENTS.filter(k=>k==='kcal'||k==='protein'||list.some(x=>entryNutrients(x)[k]!==null)).map(k=>`${nutrientLabels[k]}: ${totalText(t,k)}`).join(' · ')}</div>`;
}
function intakeHTML(){
  const list=intakeToday(), series=intakeDailySeries(), known=series.filter(p=>p.v!==null);
  return `<div class="nsec-title">Hoje · diário alimentar</div>${totalsHTML(list)}
  <div class="ndisc">Dados de produtos podem estar incompletos; confirma alergénios no rótulo.</div>
  <div class="iadd" style="flex-wrap:wrap">
    <label>Alimento<input id="i-name" class="nfree" placeholder="alimento"></label>
    <label>Quantidade (<span id="i-unit">g</span>)<input id="i-grams" class="nfree inum" type="number" min="0" step="any" value="100"></label>
    <div class="ndisc" style="width:100%">Valores de referência por 100 g ou 100 ml, conforme a fonte. Entrada manual em gramas.</div>
    ${NUTRIENTS.map(k=>`<label>${nutrientLabels[k]}<input id="${inputId(k)}" class="nfree inum" type="number" min="0" step="any" placeholder="sem dado"></label>`).join('')}
    <button class="load-chart-btn" onclick="scanBarcode()" aria-label="Ler código de barras">📷</button>
    <button class="load-save" onclick="addIntakeUI()">Registar</button>
  </div>
  <div id="i-preview" class="ndisc"></div><details class="ndisc"><summary>Estimativa · fonte do alimento</summary><span id="i-source">Entrada manual.</span></details>
  <form id="barcodeForm" class="barcode-form"><label class="nfield" for="barcode">Código de barras</label><div class="barcode-row"><input id="barcode" class="nfree" inputmode="numeric"><button class="btn-secondary" type="submit">Pesquisar</button></div><div id="barcode-status" class="inline-error" role="status" aria-live="polite"></div></form>
  <div id="basic-foods" class="qfoods">${foodsHTML()}</div>
  ${list.length?`<div class="ilist">${list.map(entryHTML).join('')}</div>`:'<div class="ndisc">Ainda nada registado hoje.</div>'}
  ${known.length>1?`<div class="lc">${chartSVG(known.map(p=>p.v))}<div class="ndisc">Energia registada (estimativa): ${series.map(p=>`${esc(p.date)}: ${display(p.v)} kcal${p.missing?' + '+p.missing+' sem dado':''}`).join(' · ')}. Dias sem dados não entram no gráfico.</div></div>`:''}
  ${intakeHistoryHTML()}`;
}
function intakeHistoryHTML(){
  const by={}; (ST.intake||[]).filter(x=>x.date!==todayStr()).forEach(x=>(by[x.date]??=[]).push(x));
  return Object.keys(by).sort().reverse().slice(0,7).map(d=>`<div class="nsec-title">${esc(d)}</div>${totalsHTML(by[d])}${by[d].map(entryHTML).join('')}`).join('');
}

function nchips(cat,opts,selected){
  selected=selected||[];
  return `<div class="nchips" data-cat="${cat}">`+opts.map(o=>`<label class="nchip"><input type="checkbox" value="${esc(o)}"${selected.indexOf(o)>=0?' checked':''}><span>${esc(o)}</span></label>`).join('')+`</div>`;
}
function freeVal(selected,opts){ return esc((selected||[]).filter(x=>opts.indexOf(x)<0).join(', ')); }
function collectFav(cat){
  const checked=Array.prototype.slice.call(document.querySelectorAll(`.nchips[data-cat="${cat}"] input:checked`)).map(i=>i.value);
  const fEl=document.getElementById('free-'+cat);
  const free=fEl?fEl.value.split(',').map(s=>s.trim()).filter(Boolean):[];
  const seen={}, out=[];
  checked.concat(free).forEach(x=>{ if(x && !seen[x]){ seen[x]=1; out.push(x); } });
  return out;
}

function nutriFormHTML(food){
  food=food||{}; const f=food.fav||{};
  const sel=(v,o)=>v===o?' selected':'';
  const editing=!!(ST.nutri&&ST.nutri.profile);
  const warn=profileComplete()?'':`<div class="nnote">⚠ Completa o teu <b>Perfil</b> 👤 (idade, altura, peso) para veres as estimativas. As preferências abaixo guardam-se na mesma.</div>`;
  return `
  <div class="nplan-hdr">
    <div><div class="day-hdr-name">🥗 Nutrição</div><div class="day-hdr-sub">Preferências alimentares</div></div>
    ${editing?`<button class="reset-btn btn-ghost" onclick="cancelNutri()">✕ Cancelar</button>`:''}
  </div>
  ${warn}
  <form id="nutriForm" class="nform" onsubmit="saveNutri(event)">
    <div class="nrow">
      <label class="nfield"><span>Refeições/dia</span>
        <select id="n-meals"><option${sel(String(food.meals),'3')}>3</option><option${sel(String(food.meals||4),'4')}>4</option><option${sel(String(food.meals),'5')}>5</option><option${sel(String(food.meals),'6')}>6</option></select></label>
      <label class="nfield"><span>Tempo p/ cozinhar</span>
        <select id="n-cook"><option value="pouco"${sel(food.cookTime,'pouco')}>Pouco</option><option value="medio"${sel(food.cookTime||'medio','medio')}>Médio</option><option value="muito"${sel(food.cookTime,'muito')}>Muito</option></select></label>
    </div>
    <div class="nsec-title">Proteínas favoritas</div>${nchips('protein',PROT,f.protein)}<input class="nfree" id="free-protein" placeholder="outras (separa por vírgulas)" value="${freeVal(f.protein,PROT)}">
    <div class="nsec-title">Hidratos favoritos</div>${nchips('carbs',CARB,f.carbs)}<input class="nfree" id="free-carbs" placeholder="outros (separa por vírgulas)" value="${freeVal(f.carbs,CARB)}">
    <div class="nsec-title">Vegetais favoritos</div>${nchips('veg',VEG,f.veg)}<input class="nfree" id="free-veg" placeholder="outros (separa por vírgulas)" value="${freeVal(f.veg,VEG)}">
    <div class="nsec-title">Snacks favoritos</div>${nchips('snack',SNACK,f.snack)}<input class="nfree" id="free-snack" placeholder="outros (separa por vírgulas)" value="${freeVal(f.snack,SNACK)}">
    <div class="nsec-title">Restrições</div>${nchips('restr',RESTR,food.restrictions)}
    <div class="nsec-title">Suplementos que usas</div>${nchips('supps',SUPPS,food.supps)}
    <label class="nfield full"><span>Alimentos a evitar</span><input id="n-avoid" placeholder="ex.: marisco, coentros" value="${esc((food.avoid||[]).join(', '))}"></label>
    <button class="nbtn" type="submit">Guardar preferências →</button>
  </form>`;
}

function nutriPlanHTML(food){
  food=food||{};
  const b=bodyMetrics();
  const meals=mealPlan(Object.assign({},food,{goal:b.goal}));
  const shop=shopping(food);
  const goalTxt={perder:'perder gordura',manter:'manter',ganhar:'ganhar músculo'}[b.goal]||'';
  const targetsHTML = referencesHTML(b);

  return `
  <div class="nplan-hdr">
    <div><div class="day-hdr-name">🥗 Nutrição</div><div class="day-hdr-sub">${food.meals||4} refeições${goalTxt?` · ${goalTxt}`:''}</div></div>
    <button class="reset-btn btn-ghost" onclick="editNutri()">✎ Editar</button>
  </div>
  ${targetsHTML}
  ${intakeHTML()}
  <div class="nsec-title">Sugestão de refeições</div>
  <div class="nmeals">${meals.map(m=>`<div class="nmeal${m.tag==='treino'?' treino':''}"><div class="nmeal-t">${m.t}</div><div class="nmeal-i">${esc(m.i)}</div></div>`).join('')}</div>
  <div class="nnote">⏱ Nos dias de treino: <b>pré-treino</b> 60–90min antes, <b>pós-treino</b> na 1ª hora a seguir.</div>
  ${shop.length?`<div class="nsec-title">Lista de compras (dos teus favoritos)</div><div class="nshop">${shop.map(s=>`<span class="nshop-i">${esc(s)}</span>`).join('')}</div>`:''}
  <div class="ndisc">Estimativas (Mifflin-St Jeor). Ajusta conforme os resultados ao fim de 2–3 semanas.</div>`;
}

function renderNutri(content){
  content=content||document.getElementById('content');
  document.getElementById('hdrSub').textContent='Nutrição';
  document.getElementById('progFill').style.width='0%';
  const p=ST.nutri&&ST.nutri.profile;
  const showForm = !p || NUTRI_EDIT;
  content.innerHTML=`<div class="nutri-wrap">${ showForm ? nutriFormHTML(p) : nutriPlanHTML(p) }</div>`;
  // O diário e a entrada manual existem mesmo antes de definir preferências.
  if(showForm) content.querySelector('.nutri-wrap').insertAdjacentHTML('beforeend',referencesHTML(bodyMetrics())+intakeHTML());
  selectedFood=null;
  loadFoods();
  for(const id of ['i-name',...NUTRIENTS.map(inputId)]){
    document.getElementById(id)?.addEventListener('input',()=>{lookupOperation++;clearSelectedFood();});
  }
  document.getElementById('i-grams')?.addEventListener('input',()=>{lookupOperation++;updatePreview();});
  updatePreview();
  const form=document.getElementById('barcodeForm'), field=document.getElementById('barcode');
  if(form) form.addEventListener('submit',e=>{ e.preventDefault(); offLookup(field.value); });
  if(field) field.addEventListener('input',()=>{ lookupOperation++; clearSelectedFood(); document.getElementById('barcode-status').textContent=''; });
}
function editNutri(){ NUTRI_EDIT=true; renderNutri(); }
function cancelNutri(){ NUTRI_EDIT=false; renderNutri(); }
function saveNutri(e){
  e.preventDefault();
  const val=id=>{ const el=document.getElementById(id); return el?el.value:''; };
  const profile={
    meals:parseInt(val('n-meals'),10)||4, cookTime:val('n-cook'),
    fav:{ protein:collectFav('protein'), carbs:collectFav('carbs'), veg:collectFav('veg'), snack:collectFav('snack') },
    restrictions:collectFav('restr'), supps:collectFav('supps'),
    avoid:(val('n-avoid')||'').split(',').map(s=>s.trim()).filter(Boolean)
  };
  ST.nutri={profile};
  save();
  NUTRI_EDIT=false;
  renderNutri();
}


/* ═══════════ DIÁRIO: scan + Open Food Facts ═══════════ */
let lookupOperation=0;
async function offLookup(code){
  const field=document.getElementById('barcode'); if(!field) return;
  clearSelectedFood();
  code=String(code||'').trim(); field.value=code;
  const operation=++lookupOperation, view=ST.view;
  const valid=()=>operation===lookupOperation && field.isConnected && document.getElementById('barcode')===field && field.value===code && ST.view===view;
  if(!/^\d{6,}$/.test(code)){ fieldError('barcode','Código inválido. Introduz pelo menos 6 algarismos.'); return; }
  const status=document.getElementById('barcode-status');
  status.textContent='A pesquisar…';
  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    if(!valid()) return;
    const j=await r.json();
    if(!valid()) return;
    if(j.status!==1){ status.textContent='Produto não encontrado no Open Food Facts. Preenche manualmente.'; return; }
    const food=parseOff(j);
    if(!food){status.textContent='Produto sem dados. Preenche manualmente.';return;}
    if(!food.sourceId) food.sourceId=code;
    selectFood(food);
    status.textContent='Produto encontrado. Confirma os valores e a quantidade.';
  }catch(e){ if(valid()) status.textContent='Sem ligação ao Open Food Facts. Preenche manualmente.'; }
}
function manualBarcode(message){
  const field=document.getElementById('barcode');
  if(!field) return;
  document.getElementById('barcode-status').textContent=message;
  field.focus();
}
function scanBarcode(){
  if(!('BarcodeDetector' in window) || !(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){
    manualBarcode('Introduz o código de barras para pesquisar.'); return;
  }
  return startScan();
}
let scanStream=null, scanRAF=null, scanToken=0;
async function startScan(){
  stopScan();
  const token=++scanToken;
  openOverlay(document.getElementById('scanBg'), { initial: '.scan-close', onClose: stopScan });
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    if(token!==scanToken){ stream.getTracks().forEach(t=>t.stop()); return; }
    scanStream=stream;
    const v=document.getElementById('scanVid'); v.srcObject=scanStream; await v.play();
    if(token!==scanToken) return;
    const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
    const loop=async()=>{
      if(token!==scanToken || !scanStream) return;
      try{ const codes=await det.detect(v); if(token!==scanToken) return; if(codes&&codes.length){ const code=codes[0].rawValue; stopScan(); offLookup(code); return; } }catch(_){}
      if(token===scanToken) scanRAF=requestAnimationFrame(loop);
    };
    loop();
  }catch(e){ if(token!==scanToken) return; stopScan(); manualBarcode('Câmara indisponível. Introduz o código de barras ou preenche manualmente.'); }
}
function stopScan(){
  ++scanToken;
  const ov=document.getElementById('scanBg'); if(ov) closeOverlay(ov);
  const video=document.getElementById('scanVid'); if(video) video.srcObject=null;
  if(scanRAF){ cancelAnimationFrame(scanRAF); scanRAF=null; }
  if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; }
}

export { PROT, CARB, VEG, SNACK, RESTR, SUPPS, NUTRI_EDIT, calcTargets, referencesHTML, mealPlan, shopping, FOODS, addIntake, delIntake, intakeToday, intakeTotals, intakeDailySeries, fillIntake, addIntakeUI, intakeHTML, intakeHistoryHTML, nchips, freeVal, collectFav, nutriFormHTML, nutriPlanHTML, renderNutri, editNutri, cancelNutri, saveNutri, offLookup, scanBarcode, scanStream, startScan, stopScan };
