import { diaryHTML, bindDiary, selectSheetFood } from './diary-ui.js';
import { references, energyEstimate } from './nutri-calc.js';
import { parseOff } from './foods.js';
import { openOverlay, closeOverlay } from './overlay.js';
/* myTraining — módulo extraído de index.html (Fase 0). */
import { fieldError } from './inline-error.js';
import { bodyMetrics, profileComplete } from './profile.js';
import { ST, esc, save } from './state.js';

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
  return `<div class="nsec-title">Estimativa · referências</div>`+Object.keys(labels).map(k=>{const x=r[k]; return `<div class="nref"><span>${labels[k]}: <b>${x.range?x.range.map(v=>Math.round(v)).join('–'):x.value===null?'—':k==='salt'?'&lt;5':Math.round(x.value*10)/10}</b></span><button type="button" class="info-i" data-reference-info aria-label="Informação sobre ${labels[k]}">ⓘ</button></div>`;}).join('');
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
function selectFood(food){ selectSheetFood(food); }

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
  content.innerHTML=`<div class="nutri-wrap"><h1 class="day-hdr-name">Nutrição</h1>${diaryHTML()}<details class="nutri-preferences"><summary>Preferências e sugestões</summary>${showForm ? nutriFormHTML(p) : nutriPlanHTML(p)}</details></div>`;
  bindDiary(renderNutri);
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
  code=String(code||'').trim(); field.value=code;
  const operation=++lookupOperation, view=ST.view;
  const valid=()=>operation===lookupOperation && field.isConnected && document.getElementById('barcode')===field && field.value===code && ST.view===view;
  if(!/^\d{6,}$/.test(code)){ fieldError('barcode','Código inválido. Introduz pelo menos 6 algarismos.'); return; }
  const status=document.getElementById('barcode-status');
  if(!navigator.onLine){ status.textContent='Sem ligação. Usa Não encontro para adicionar manualmente.'; return; }
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

export { PROT, CARB, VEG, SNACK, RESTR, SUPPS, NUTRI_EDIT, calcTargets, referencesHTML, mealPlan, shopping, nchips, freeVal, collectFav, nutriFormHTML, nutriPlanHTML, renderNutri, editNutri, cancelNutri, saveNutri, offLookup, scanBarcode, scanStream, startScan, stopScan };
