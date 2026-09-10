/* myTraining — módulo extraído de index.html (Fase 0). */
import { chartSVG } from './charts.js';
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
  const bmr=10*p.weight+6.25*p.height-5*p.age+(p.sex==='m'?5:-161);
  const af={sed:1.2,leve:1.375,mod:1.55,alto:1.725}[p.activity]||1.375;
  const tdee=bmr*af;
  const adj={perder:-0.18,manter:0,ganhar:0.12}[p.goal]||0;
  const kcal=Math.round((tdee*(1+adj))/10)*10;
  const ppk={perder:2.0,manter:1.8,ganhar:2.0}[p.goal]||1.8;
  const protein=Math.round(p.weight*ppk);
  const water=Math.round(p.weight*0.035*10)/10;
  const fatG=Math.round(p.weight*0.9);
  const carbG=Math.max(0,Math.round((kcal-protein*4-fatG*9)/4));
  return {kcal,protein,water,fatG,carbG};
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
const FOODS=[
  {n:'Frango grelhado (100g)',k:165,p:31},{n:'Atum lata (100g)',k:130,p:29},
  {n:'Ovo (1)',k:78,p:6},{n:'Arroz cozido (100g)',k:130,p:2.7},
  {n:'Massa cozida (100g)',k:158,p:5.8},{n:'Batata-doce (100g)',k:86,p:1.6},
  {n:'Aveia (40g)',k:150,p:5},{n:'Iogurte natural (1)',k:90,p:9},
  {n:'Whey (1 scoop)',k:120,p:24},{n:'Banana (1)',k:105,p:1.3},
  {n:'Pão (1 fatia)',k:80,p:3},{n:'Queijo fresco (100g)',k:110,p:11}
];
function addIntake(name,kcal,protein){
  name=(name||'').trim(); kcal=parseFloat(kcal)||0; protein=parseFloat(protein)||0;
  if(!name && !kcal) return false;
  const item={ id:'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), ts:nowISO(), date:todayStr(), name:name||'Item', kcal, protein };
  ST.intake=(ST.intake||[]).concat([item]);
  save(); return true;
}
function delIntake(id){ ST.intake=(ST.intake||[]).filter(x=>x.id!==id); save(); renderNutri(); }
function intakeToday(){ const t=todayStr(); return (ST.intake||[]).filter(x=>x.date===t); }
function intakeTotals(list){ return list.reduce((a,x)=>({kcal:a.kcal+(+x.kcal||0),protein:a.protein+(+x.protein||0)}),{kcal:0,protein:0}); }
function intakeDailySeries(){
  const by={}; (ST.intake||[]).forEach(x=>{ by[x.date]=(by[x.date]||0)+(+x.kcal||0); });
  return Object.keys(by).sort().map(d=>({date:d,v:Math.round(by[d])}));
}
function fillIntake(k){ const f=FOODS[k]; if(!f) return; const set=(id,v)=>{const el=document.getElementById(id); if(el) el.value=v;}; set('i-name',f.n); set('i-kcal',f.k); set('i-prot',f.p); }
function addIntakeUI(){
  const v=id=>{const el=document.getElementById(id); return el?el.value:'';};
  if(addIntake(v('i-name'),v('i-kcal'),v('i-prot'))) renderNutri();
  else alert('Indica pelo menos um nome ou as kcal.');
}
function intakeHTML(){
  const list=intakeToday().slice().sort((a,b)=>(a.ts||'')<(b.ts||'')?-1:1);
  const tot=intakeTotals(list);
  const b=bodyMetrics(), tgt=(b.age>0&&b.height>0&&b.weight>0)?calcTargets(b):null;
  const kPct=tgt?Math.min(100,Math.round(tot.kcal/tgt.kcal*100)):0;
  const pPct=tgt?Math.min(100,Math.round(tot.protein/(tgt.protein||1)*100)):0;
  const series=intakeDailySeries();
  return `
  <div class="nsec-title">📋 Hoje · diário alimentar</div>
  ${ tgt ? `<div class="iprog">
    <div class="iprog-row"><span>Calorias</span><span><b>${Math.round(tot.kcal)}</b> / ${tgt.kcal} kcal</span></div>
    <div class="ibar"><div class="ibar-fill${tot.kcal>tgt.kcal?' over':''}" style="width:${kPct}%"></div></div>
    <div class="iprog-row"><span>Proteína</span><span><b>${Math.round(tot.protein)}</b> / ${tgt.protein} g</span></div>
    <div class="ibar"><div class="ibar-fill prot" style="width:${pPct}%"></div></div>
  </div>` : `<div class="ndisc">Completa o Perfil para veres o progresso vs metas.</div>` }
  <div class="iadd">
    <input id="i-name" class="nfree" placeholder="alimento">
    <input id="i-kcal" class="nfree inum" type="number" inputmode="numeric" placeholder="kcal">
    <input id="i-prot" class="nfree inum" type="number" inputmode="numeric" placeholder="prot">
    <button class="load-chart-btn" onclick="scanBarcode()" aria-label="Ler código de barras" title="Ler código de barras">📷</button>
    <button class="load-save" onclick="addIntakeUI()">+ Add</button>
  </div>
  <div class="qfoods">${FOODS.map((f,k)=>`<button type="button" class="qfood" onclick="fillIntake(${k})">${f.n}</button>`).join('')}</div>
  ${ list.length ? `<div class="ilist">${list.map(x=>`<div class="iitem"><div class="iitem-main"><span class="iitem-n">${esc(x.name)}</span><span class="iitem-t">${fmtTime(x.ts)}</span></div><div class="iitem-r"><span>${Math.round(x.kcal)}kcal · ${Math.round(x.protein)}g</span><button class="iitem-x" onclick="delIntake('${x.id}')" aria-label="Remover">✕</button></div></div>`).join('')}</div>` : '<div class="ndisc">Ainda nada registado hoje.</div>' }
  ${ series.length>1 ? `<div class="lc">${chartSVG(series.map(p=>p.v))}<div class="lc-meta"><span><b>${Math.round(tot.kcal)}</b> kcal hoje</span><span class="lc-range">${series.length} dias registados</span></div></div>` : '' }
  ${intakeHistoryHTML()}`;
}
function intakeHistoryHTML(){
  const t=todayStr(), byDate={};
  (ST.intake||[]).forEach(x=>{ if(x.date!==t){ (byDate[x.date]=byDate[x.date]||[]).push(x); } });
  const dates=Object.keys(byDate).sort().reverse().slice(0,7);
  if(!dates.length) return '';
  return `<div class="nsec-title">Dias anteriores</div>`+dates.map(d=>{
    const items=byDate[d].slice().sort((a,b)=>(a.ts||'')<(b.ts||'')?-1:1), tt=intakeTotals(items);
    return `<div class="ihist"><div class="ihist-h"><span class="iitem-n">${d}</span><span>${Math.round(tt.kcal)}kcal · ${Math.round(tt.protein)}g</span></div>`+
      items.map(x=>`<div class="iitem"><div class="iitem-main"><span class="iitem-n">${esc(x.name)}</span><span class="iitem-t">${fmtTime(x.ts)} · ${Math.round(x.kcal)}kcal · ${Math.round(x.protein)}g</span></div><div class="iitem-r"><button class="iitem-x" onclick="delIntake('${x.id}')" aria-label="Remover">✕</button></div></div>`).join('')+
      `</div>`;
  }).join('');
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
  const warn=profileComplete()?'':`<div class="nnote">⚠ Completa o teu <b>Perfil</b> 👤 (idade, altura, peso) para calcular as metas. As preferências abaixo guardam-se na mesma.</div>`;
  return `
  <div class="nplan-hdr">
    <div><div class="day-hdr-name">🥗 Nutrição</div><div class="day-hdr-sub">Preferências alimentares</div></div>
    ${editing?`<button class="reset-btn" onclick="cancelNutri()">✕ Cancelar</button>`:''}
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
  const complete=b.age>0 && b.height>0 && b.weight>0;
  const meals=mealPlan(Object.assign({},food,{goal:b.goal}));
  const shop=shopping(food);
  const goalTxt={perder:'perder gordura',manter:'manter',ganhar:'ganhar músculo'}[b.goal]||'';
  const targetsHTML = complete ? (function(){ const t=calcTargets(b); return `
  <div class="ntargets">
    <div class="ntar"><span class="ntar-v">${t.kcal}</span><span class="ntar-l">kcal/dia</span></div>
    <div class="ntar"><span class="ntar-v">${t.protein}g</span><span class="ntar-l">proteína</span></div>
    <div class="ntar"><span class="ntar-v">${t.water}L</span><span class="ntar-l">água</span></div>
  </div>
  <div class="nmacros">Hidratos ~${t.carbG}g · Gordura ~${t.fatG}g</div>`; })()
  : `<div class="nnote">⚠ Completa o <b>Perfil</b> (idade, altura, peso) para veres as metas. <button class="linklike" onclick="render('__perfil')">Ir ao Perfil 👤</button></div>`;
  return `
  <div class="nplan-hdr">
    <div><div class="day-hdr-name">🥗 Nutrição</div><div class="day-hdr-sub">${food.meals||4} refeições${goalTxt?` · ${goalTxt}`:''}</div></div>
    <button class="reset-btn" onclick="editNutri()">✎ Editar</button>
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
async function offLookup(code){
  code=(code||'').replace(/\D/g,''); if(code.length<6){ alert('Código inválido.'); return; }
  const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=val; };
  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const j=await r.json();
    if(j.status!==1){ alert('Produto não encontrado no Open Food Facts. Preenche manualmente.'); return; }
    const p=j.product||{}, n=p.nutriments||{};
    const nm=p.product_name||p.generic_name||('Cód '+code);
    set('i-name', nm+' (100g)');
    set('i-kcal', Math.round(n['energy-kcal_100g']||0));
    set('i-prot', Math.round((n.proteins_100g||0)*10)/10);
  }catch(e){ alert('Sem ligação ao Open Food Facts.'); }
}
function scanBarcode(){
  if(!('BarcodeDetector' in window) || !(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){
    const c=prompt('Introduz o código de barras:'); if(c) offLookup(c); return;
  }
  startScan();
}
let scanStream=null, scanRAF=null;
async function startScan(){
  document.getElementById('scanBg').classList.add('show');
  try{
    scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const v=document.getElementById('scanVid'); v.srcObject=scanStream; await v.play();
    const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
    const loop=async()=>{
      if(!scanStream) return;
      try{ const codes=await det.detect(v); if(codes&&codes.length){ const code=codes[0].rawValue; stopScan(); offLookup(code); return; } }catch(_){}
      scanRAF=requestAnimationFrame(loop);
    };
    loop();
  }catch(e){ stopScan(); const c=prompt('Câmara indisponível. Código de barras:'); if(c) offLookup(c); }
}
function stopScan(){
  const ov=document.getElementById('scanBg'); if(ov) ov.classList.remove('show');
  if(scanRAF){ cancelAnimationFrame(scanRAF); scanRAF=null; }
  if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; }
}

export { PROT, CARB, VEG, SNACK, RESTR, SUPPS, NUTRI_EDIT, calcTargets, mealPlan, shopping, FOODS, addIntake, delIntake, intakeToday, intakeTotals, intakeDailySeries, fillIntake, addIntakeUI, intakeHTML, intakeHistoryHTML, nchips, freeVal, collectFav, nutriFormHTML, nutriPlanHTML, renderNutri, editNutri, cancelNutri, saveNutri, offLookup, scanBarcode, scanStream, startScan, stopScan };
