import { ST, esc, save, todayStr, nowISO } from './state.js';
import { NUTRIENTS, nutrient, scaleFood, rescaleEntry, intakeForDate, mealOf, validateIntakeList, validateCustomFoods } from './foods.js';
import { searchFoods } from './food-search.js';
import { daySummary } from './nutri-summary.js';
import { references } from './nutri-calc.js';
import { bodyMetrics } from './profile.js';
import { openOverlay, closeOverlay } from './overlay.js';
import { confirmDialog } from './dialog.js';
import { offLookup, scanBarcode } from './nutrition.js';

document.addEventListener('click',e=>{if(e.target.closest('[data-reference-info]')) info();});

const meals = {pa:'Pequeno-almoço',alm:'Almoço',jan:'Jantar',lan:'Lanches'};
const labels = {kcal:'Energia',protein:'Proteína',carbs:'Hidratos',fat:'Gordura',fibre:'Fibra',sugars:'Açúcares totais',salt:'Sal'};
const show = n => n == null ? '—' : String(Math.round(n*10)/10);
let date = todayStr(), catalogue = null, loading = null, repaint = null, sheet = null, fullOpen = false;
const definitions = () => [...(catalogue || []), ...(ST.foodsCustom || []).map(f => ({...f,id:'c:'+f.id,source:'manual'}))];
async function loadFoods() {
  if (catalogue) return catalogue;
  if (!loading) loading = fetch('data/foods-pt.json').then(r => {
    if (!r.ok) throw Error('catálogo'); return r.json();
  }).then(j => { if (!Array.isArray(j.foods)) throw Error('catálogo'); catalogue=j.foods; return catalogue; }).finally(() => { loading=null; });
  return loading;
}
function info(food) {
  const message = food ? `${food.name}. Fonte: ${food.source || 'manual'}; identificador ${food.sourceId || food.id || 'não indicado'}; versão ${food.version || 'não indicada'}. ${food.aprox ? 'Aproximação: '+food.aprox+'. ' : ''}Alimento de origem: ${food.usdaName || food.name}. Fórmula: nutriente por 100 × quantidade / 100. Porções da fonte; g e ml não são convertidos. Valores médios, não uma análise deste alimento. Confirma alergénios no rótulo.`
    : 'Fórmula Mifflin–St Jeor (1990): 10 × kg + 6,25 × cm − 5 × anos + 5 (masculino) ou −161 (feminino); multiplicada por atividade 1,2 / 1,375 / 1,55 / 1,725. População: adultos saudáveis 18–65 anos. Pressupostos: sexo e atividade escolhidos, peso atual; manutenção, sem ajuste por objetivo. Proteína: Morton 2018, 1,6–2,2 g/kg para treino de força. EFSA 2010: hidratos 45–60 % da energia /4, gordura 20–35 % /9, fibra 25 g (não é teto). OMS 2012: sal <5 g. Açúcares totais não são açúcares livres e não têm limite aqui. Limites: estimativa com incerteza individual, intervalos não somam necessariamente a mesma energia; dados ausentes não valem zero. Não substitui um profissional.';
  return confirmDialog({title:food ? 'Origem e aproximações' : 'Como são estimadas as referências',message,confirmLabel:'Fechar',cancelLabel:'Voltar'});
}
function diaryHTML() {
  const list = intakeForDate(ST.intake || [],date), refs = references(bodyMetrics()), summary = daySummary(list,refs);
  const presentation = Object.fromEntries(NUTRIENTS.map(k => {
    const s=summary[k], r=refs[k==='kcal'?'energy':k], max=r?.range?.[1] || r?.value;
    const bar=s.complete && refs.applicable && k!=='sugars' && max;
    const state=s.state==='parcial' ? `parcial · +${s.missing} sem dado`
      : s.state==='vazio' ? 'Sem registos' : s.state==='desconhecido' ? 'Sem dado'
      : k==='fibre' ? 'Valor registado' : k==='kcal' && s.referenceText ? s.referenceText.replace('referência','ref.')
      : s.referenceText || 'Valor registado';
    const reference=r?.range ? `ref. ${r.range.map(v=>Math.round(v)).join('–')} g`
      : r?.value != null ? `ref. ${show(r.value)} ${k==='kcal'?'kcal':'g'}`
      : k==='sugars' ? 'sem referência' : 'ref. indisponível';
    const value=`${show(s.total)} ${k==='kcal'?'kcal':'g'}`;
    const barHTML=bar ? `<div class="diary-bar" aria-hidden="true"><span style="width:${Math.min(100,Math.max(0,s.total/max*100))}%"></span>${r.range ? `<i style="left:${r.range[0]/max*100}%"></i>` : ''}</div>` : '';
    return [k,{value,state,reference,barHTML}];
  }));
  const rows=NUTRIENTS.map(k=>{
    const p=presentation[k];
    return `<div class="diary-total" data-nutrient="${k}"><div><strong>${labels[k]}</strong><b>${p.value}</b></div><small>${esc(p.state)} · ${esc(p.reference)}</small>${p.barHTML}</div>`;
  }).join('');
  const compact=['kcal','protein'].map(k=>{
    const p=presentation[k];
    return `<div class="diary-compact" data-compact="${k}"><strong>${labels[k]}</strong><b>${p.value}</b><small>${esc(p.state)}</small><small>${esc(p.reference)}</small>${p.barHTML}</div>`;
  }).join('');
  const sections = [...Object.entries(meals),...(list.some(e => !mealOf(e)) ? [['legacy','Sem refeição']] : [])].map(([id,label]) => {
    const items=list.filter(e => (mealOf(e) || 'legacy')===id);
    return `<section class="diary-meal" aria-label="${label}"><div class="diary-row"><div><h2>${label}</h2><small class="diary-count">${items.length} ${items.length===1?'item':'itens'}</small></div>${id!=='legacy' ? `<button class="btn-secondary" data-add="${id}" id="diary-add-${id}">＋ Adicionar</button>` : ''}</div>${items.length ? items.map(e => `<button class="diary-entry" data-entry="${esc(e.id)}"><strong>${esc(e.name)}</strong><span>${e.g ? show(e.g)+' '+esc(e.unit)+' · ' : ''}${show(e.kcal)} kcal · ${show(e.protein)} g proteína · <u>Editar</u> ›</span></button>`).join('') : '<p class="ndisc">Sem registos.</p>'}</section>`;
  }).join('');
  return `<div class="diary-row diary-date"><button class="btn-secondary" data-day="-1" aria-label="Dia anterior">‹</button><label><span class="diary-date-label">Dia</span><input type="date" id="diary-date" value="${date}"></label><button class="btn-secondary" data-today>Hoje</button><button class="btn-secondary" data-day="1" aria-label="Dia seguinte">›</button></div><section class="diary-summary" aria-label="Resumo dos registos"><div class="diary-row"><h2>Resumo</h2><button class="info-i" data-estimate aria-label="Informação sobre as estimativas">ⓘ</button></div>${!refs.applicable ? `<p class="ndisc">${esc(refs.reason)} <button class="btn-secondary" data-profile>Abrir Perfil</button></p>` : ''}<div class="diary-compact-grid">${compact}</div><button class="btn-primary diary-add-quick" id="diary-add-quick" data-add-quick>＋ Adicionar alimento</button><details class="diary-full"${fullOpen?' open':''}><summary>Resumo completo</summary>${rows}<p class="ndisc">Estimativas para adultos 18–65; não substituem um profissional. Confirma alergénios no rótulo.</p></details></section>${sections}`;
}
function bindDiary(render) {
  repaint=render;
  loadFoods().catch(()=>{});
  const root=document.getElementById('content');
  const full=root.querySelector('.diary-full');
  // Native toggle is queued: retain a user activation even if navigation removes this DOM first.
  full.querySelector('summary').addEventListener('click',()=>{fullOpen=!full.open;});
  full.addEventListener('toggle',()=>{if(full.isConnected && root.querySelector('.diary-full')===full) fullOpen=full.open;});
  root.querySelector('[data-add-quick]').addEventListener('click',()=>{
    const hour=new Date().getHours();
    openFoodSheet({meal:hour<11?'pa':hour<15?'alm':hour<18?'lan':'jan'});
  });
  root.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click',()=>openFoodSheet({meal:b.dataset.add})));
  root.querySelectorAll('[data-entry]').forEach(b => b.addEventListener('click',()=>openFoodSheet({id:b.dataset.entry})));
  root.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click',()=>{
    const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()+Number(b.dataset.day));
    date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); render();
  }));
  root.querySelector('[data-today]').addEventListener('click',()=>{date=todayStr();render();});
  root.querySelector('#diary-date').addEventListener('change',e=>{if(e.target.value){date=e.target.value;render();}});
  root.querySelector('[data-estimate]').addEventListener('click',()=>info());
  root.querySelector('[data-profile]')?.addEventListener('click',()=>window.render('__eu'));
}
function closeSheet() {
  if (!sheet) return;
  const current=sheet; sheet=null; closeOverlay(current.bg); current.bg.remove();
  document.body.classList.remove('food-sheet-open');
  const target=(current.openerId==='diary-add-quick' ? document.getElementById(current.openerId) : null) || document.querySelector(`[data-entry="${CSS.escape(current.original?.id || '')}"]`) || document.getElementById('diary-add-'+current.meal);
  target?.focus({preventScroll:true});
}
const on=(selector,event,fn)=>sheet.bg.querySelector(selector)?.addEventListener(event,fn);
function error(message) {
  sheet.bg.querySelector('#food-error').textContent=message;
  document.dispatchEvent(new CustomEvent('app-notice',{detail:{msg:message,kind:'error'}}));
}
function openFoodSheet({meal='pa',id}={}) {
  if(sheet) return;
  const original=id ? (ST.intake || []).find(e=>e.id===id) : null;
  if(id && !original) return;
  const bg=document.createElement('div'); bg.className='food-sheet-bg'; bg.id='foodSheet';
  bg.innerHTML=`<section class="food-sheet" role="dialog" aria-modal="true" aria-labelledby="food-title"><div class="diary-row"><h2 id="food-title">${original?'Editar registo':'Adicionar alimento'}${date!==todayStr()?' · '+esc(date):''}</h2><button class="btn-secondary" id="food-close" aria-label="Fechar folha">✕</button></div><div id="food-body"></div><p id="food-error" class="inline-error" role="alert"></p></section>`;
  sheet={bg,openerId:document.activeElement?.id,meal:original?.meal || meal,original,food:original?.fid ? definitions().find(f=>f.id===original.fid) || null : null,busy:false}; document.body.append(bg);
  document.body.classList.add('food-sheet-open');
  on('#food-close','click',closeSheet);
  if(original) quantity(); else search();
  openOverlay(bg,{initial:original?'#food-meal':'#food-query',onClose:closeSheet});
}
function search() {
  const current=sheet;
  sheet.bg.querySelector('#food-body').innerHTML=`<label class="nfield">Pesquisar alimento<input class="nfree" type="search" id="food-query" placeholder="Banana, maçã, pão…" autocomplete="off"></label><div id="food-results" aria-live="polite"></div><button class="btn-secondary" id="food-manual">Não encontro · Adicionar sem pesquisar</button><details><summary>Código de barras · Open Food Facts</summary><form id="food-barcode"><label class="nfield">Código de barras<input class="nfree" id="barcode" inputmode="numeric"></label><button class="btn-secondary" type="submit">Pesquisar código</button><button class="btn-secondary" type="button" id="food-scan" aria-label="Ler código de barras">Ler código de barras</button><p id="barcode-status" role="status"></p></form></details>`;
  on('#food-manual','click',()=>{sheet.food=null;quantity();});
  on('#food-barcode','submit',e=>{e.preventDefault();offLookup(document.getElementById('barcode').value);});
  on('#food-scan','click',scanBarcode);
  on('#food-query','input',results);
  async function results() {
    const host=current.bg.querySelector('#food-results'); if(!host) return;
    host.textContent='A carregar alimentos…';
    try {
      await loadFoods(); if(sheet!==current || !host.isConnected) return;
      const query=current.bg.querySelector('#food-query').value;
      const foods=searchFoods(definitions(),query,{recentIds:ST.foodRecent || []});
      host.innerHTML=`<p class="ndisc">${query ? foods.length?'Resultados':'Sem resultados. Usa Não encontro.' : 'Recentes'}</p>`+foods.map((f,i)=>`<div class="food-result"><button class="diary-entry" data-result="${i}"><strong>${esc(f.name)}</strong><span>${esc(f.state || '')} · ${show(f.nutrients.kcal)} kcal/100 ${esc(f.ref.unit)}${f.aprox?' · aprox.':''}</span></button><button class="btn-secondary" data-source="${i}" aria-label="Origem de ${esc(f.name)}">ⓘ</button></div>`).join('');
      host.querySelectorAll('[data-result]').forEach(b=>b.addEventListener('click',()=>selectSheetFood(foods[+b.dataset.result])));
      host.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',()=>info(foods[+b.dataset.source])));
    } catch {
      if(sheet!==current || !host.isConnected) return;
      host.innerHTML='<p>Não foi possível carregar os alimentos.</p><button class="btn-secondary" id="food-retry">Tentar de novo</button>';
      on('#food-retry','click',results);
    }
  }
  results();
}
function selectSheetFood(food) { if(sheet){sheet.food=food;quantity();sheet.bg.querySelector('#food-amount')?.focus();} }
function quantity() {
  const {original:e,food:f}=sheet, legacy=e && !(Number.isFinite(e.g) && e.g>0 && ['g','ml'].includes(e.unit));
  const unit=e?.unit || f?.ref.unit || 'g';
  sheet.bg.querySelector('#food-body').innerHTML=`${!e?'<button class="btn-secondary" id="food-back">‹ Pesquisa</button>':''}<div class="food-name"><h3>${esc(e?.name || f?.name || 'Alimento não encontrado')}</h3>${f?.aprox?'<span class="ndisc">aprox.</span>':''}${f?'<button class="food-source" id="food-source" aria-label="Origem do alimento">ⓘ</button>':''}</div>${!e&&!f?'<label class="nfield">Nome<input class="nfree" id="food-name" required></label>':''}<label class="nfield">Refeição<select id="food-meal">${Object.entries(meals).map(([id,n])=>`<option value="${id}"${id===sheet.meal?' selected':''}>${n}</option>`).join('')}</select></label>${legacy?'<p class="ndisc">Registo anterior sem quantidade: só podes mudar de refeição ou eliminar.</p>':''}<div class="qfoods">${(f?.portions || []).map((p,i)=>`<button type="button" class="btn-secondary" data-portion="${i}">${esc(p.label)} · ${show(p.g)} ${esc(unit)}</button>`).join('')}</div><label class="nfield">Quantidade (${esc(unit)})<input class="nfree" id="food-amount" type="number" min="0.01" step="any" value="${e?.g || 100}"${legacy?' disabled':''}></label><p id="food-preview" role="status"></p>${!e&&!f?`<details id="food-advanced"><summary>Avançado · valores do rótulo por 100 g</summary>${NUTRIENTS.map(k=>`<label class="nfield">${labels[k]} (${k==='kcal'?'kcal':'g'})<input class="nfree" type="number" min="0" step="any" data-manual="${k}" placeholder="Sem dado"></label>`).join('')}<label class="food-check"><input type="checkbox" id="food-reuse"> Guardar para reutilizar</label></details>`:''}<p class="ndisc">Estimativa; confirma alergénios no rótulo. Sem dado = desconhecido.</p><div class="food-actions"><button class="btn-primary" id="food-save">Guardar</button>${e?'<button class="btn-danger" id="food-delete">Remover do diário</button>':''}</div>`;
  on('#food-back','click',search); on('#food-source','click',()=>info(f));
  on('#food-meal','change',e=>{sheet.meal=e.target.value;});
  on('#food-amount','input',preview);
  sheet.bg.querySelectorAll('[data-manual]').forEach(i=>i.addEventListener('input',preview));
  sheet.bg.querySelectorAll('[data-portion]').forEach(b=>b.addEventListener('click',()=>{sheet.bg.querySelector('#food-amount').value=f.portions[+b.dataset.portion].g;preview();}));
  on('#food-save','click',()=>commit(false)); on('#food-delete','click',()=>commit(true)); preview();
}
function manualFood() {
  return {name:sheet.bg.querySelector('#food-name')?.value.trim(),ref:{amount:100,unit:'g'},nutrients:Object.fromEntries(NUTRIENTS.map(k=>[k,nutrient(sheet.bg.querySelector(`[data-manual="${k}"]`)?.value)]))};
}
function values() {
  const amount=Number(sheet.bg.querySelector('#food-amount').value), e=sheet.original;
  if(e) return Number.isFinite(e.g) && e.g>0 && ['g','ml'].includes(e.unit) ? rescaleEntry(e,amount) : e;
  return scaleFood(sheet.food || manualFood(),amount);
}
function preview() {
  try {const n=values(); sheet.bg.querySelector('#food-preview').textContent=`${show(n.kcal)} kcal · ${show(n.protein)} g proteína`;} catch {sheet.bg.querySelector('#food-preview').textContent='Indica uma quantidade válida.';}
}
function commit(remove) {
  if(!sheet || sheet.busy) return;
  sheet.busy=true; const button=sheet.bg.querySelector('#food-save'); button.disabled=true;
  const before={intake:ST.intake,foodsCustom:ST.foodsCustom,foodRecent:ST.foodRecent};
  try {
    const e=sheet.original, amount=Number(sheet.bg.querySelector('#food-amount').value), meal=sheet.bg.querySelector('#food-meal').value;
    if(!remove && (!e || e.g) && !(Number.isFinite(amount) && amount>0)) throw Error('Indica uma quantidade superior a zero.');
    let entry;
    if(!remove && e) entry={...values(),meal};
    if(!remove && !e) {
      let f=sheet.food || manualFood(); if(!f.name) throw Error('Indica o nome do alimento.');
      const n=scaleFood(f,amount), ts=nowISO();
      if(!sheet.food && sheet.bg.querySelector('#food-reuse')?.checked) {
        const custom={id:'c'+crypto.randomUUID(),name:f.name,ref:f.ref,nutrients:f.nutrients,createdTs:ts};
        ST.foodsCustom=[...(ST.foodsCustom || []),custom]; f={...custom,id:'c:'+custom.id,source:'manual'};
      }
      entry={id:'i'+crypto.randomUUID(),ts,date,name:f.name,kcal:n.kcal,protein:n.protein,n:Object.fromEntries(NUTRIENTS.filter(k=>!['kcal','protein'].includes(k)).map(k=>[k,n[k]])),g:amount,unit:f.ref.unit,meal,...(f.id?{fid:f.id}:{}),src:f.source || 'manual',sid:f.sourceId ?? null,ver:f.version ?? null,note:[f.aprox || '',f.notes ? typeof f.notes==='string'?f.notes:JSON.stringify(f.notes) : ''].filter(Boolean).join(' · ')};
    }
    ST.intake=e ? (ST.intake || []).flatMap(x=>x.id===e.id ? remove?[]:[entry] : [x]) : [...(ST.intake || []),entry];
    if(entry?.fid) ST.foodRecent=[entry.fid,...(ST.foodRecent || []).filter(id=>id!==entry.fid)].slice(0,12);
    const valid=validateIntakeList(ST.intake), customValid=validateCustomFoods(ST.foodsCustom);
    if(!valid.ok || !customValid.ok) throw Error(valid.reason || customValid.reason);
    if(!save({rolledBack:true})) throw Error('Não foi possível guardar. Os dados anteriores foram repostos. Tenta de novo.');
    repaint(); closeSheet();
    if(remove) document.dispatchEvent(new CustomEvent('app-notice',{detail:{msg:`«${e.name}» removido do diário.`,kind:'info'}}));
  } catch(err) {
    for(const [k,v] of Object.entries(before)) {if(v===undefined) delete ST[k];else ST[k]=v;}
    error(err.message); sheet.busy=false; button.disabled=false;
  }
}

export { diaryHTML, bindDiary, openFoodSheet, selectSheetFood };
