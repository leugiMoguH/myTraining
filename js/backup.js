/* myTraining — módulo extraído de index.html (Fase 0). */
import { DEFAULT_DAYS } from './data.js';
import { DAYS } from './routine.js';
import { syncNotifUI } from './notify.js';
import { bodyFat } from './profile.js';
import { ST, est1RM, fmtTime, save, todayStr, setST } from './state.js';
import { REST_SEC, setRest } from './timer.js';
import { render } from './ui.js';
import { syncWakeUI } from './wake.js';

/* ═══════════════ DEFINIÇÕES / BACKUP ════════════════ */
function openSheet(){ syncWakeUI(); syncNotifUI(); document.getElementById('sheetBg').classList.add('show'); }
function closeSheet(){ document.getElementById('sheetBg').classList.remove('show'); }

function exportBackup(){
  const payload={ app:'treino', v:2, exportedAt:new Date().toISOString(), rest_sec:REST_SEC, state:ST };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`treino-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function importBackup(e){
  const file=e.target.files && e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const p=JSON.parse(reader.result);
      const incoming=(p && typeof p==='object' && p.state) ? p.state : p;
      if(!incoming || typeof incoming!=='object' || typeof incoming.sets!=='object' || typeof incoming.done!=='object')
        throw new Error('estrutura inválida');
      if(!confirm('Importar substitui o progresso atual. Continuar?')){ e.target.value=''; return; }
      setST({ day:'Segunda', sets:{}, done:{}, log:{}, nutri:{profile:null}, profile:{}, measures:[], intake:[], media:{}, routine:null, ...incoming });
      if(!ST.log || typeof ST.log!=='object') ST.log={};
      if(!ST.nutri || typeof ST.nutri!=='object') ST.nutri={profile:null};
      if(!ST.profile || typeof ST.profile!=='object') ST.profile={};
      if(!Array.isArray(ST.measures)) ST.measures=[];
      if(!Array.isArray(ST.intake)) ST.intake=[];
      if(!ST.media || typeof ST.media!=='object') ST.media={};
      /* backup antigo (sem rotina) → repõe o plano original */
      if(!ST.routine || typeof ST.routine!=='object' || !Object.keys(ST.routine).length) ST.routine=JSON.parse(JSON.stringify(DEFAULT_DAYS));
      if(ST.day!=='__nutri' && ST.day!=='__perfil' && !DAYS[ST.day]) ST.day='Segunda';
      if(p && typeof p.rest_sec==='number') setRest(p.rest_sec);
      save();
      closeSheet();
      render(ST.day);
      document.getElementById('restLabel').textContent=REST_SEC+'s';
      alert('Backup importado ✓');
    }catch(err){
      alert('Não foi possível importar: '+(err && err.message ? err.message : 'ficheiro inválido'));
    }finally{
      e.target.value='';
    }
  };
  reader.onerror=()=>{ alert('Erro a ler o ficheiro.'); e.target.value=''; };
  reader.readAsText(file);
}

/* ── EXPORTAÇÃO CSV ───────────────────────────────── */
function csvCell(v){ v=(v==null?'':String(v)); return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function csvDownload(filename, rows){
  const csv=rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportMeasuresCSV(){
  const rows=[['data','hora','peso_kg','cintura_cm','pescoco_cm','anca_cm','peito_cm','braco_cm','coxa_cm','gordura_pct']];
  (ST.measures||[]).forEach(e=>{ const bf=bodyFat(e); rows.push([e.date, e.ts?fmtTime(e.ts):'', e.weight, e.waist||'', e.neck||'', e.hip||'', e.chest||'', e.arm||'', e.thigh||'', bf!=null?bf:'']); });
  if(rows.length<2){ alert('Sem medidas para exportar.'); return; }
  csvDownload(`medidas-${todayStr()}.csv`, rows); closeSheet();
}
function exportIntakeCSV(){
  const rows=[['data','hora','alimento','kcal','proteina_g']];
  (ST.intake||[]).slice().sort((a,b)=>(a.ts||'')<(b.ts||'')?-1:1).forEach(x=>rows.push([x.date, x.ts?fmtTime(x.ts):'', x.name, Math.round(x.kcal), x.protein]));
  if(rows.length<2){ alert('Sem registos de ingestão para exportar.'); return; }
  csvDownload(`diario-${todayStr()}.csv`, rows); closeSheet();
}
function exportLoadCSV(){
  const rows=[['exercicio','data','hora','peso_kg','reps','rm_estimado']];
  Object.keys(ST.log||{}).forEach(name=>{ (ST.log[name]||[]).forEach(e=>rows.push([name, e.date, e.ts?fmtTime(e.ts):'', e.w, e.r, est1RM(e.w,e.r)])); });
  if(rows.length<2){ alert('Sem cargas para exportar.'); return; }
  csvDownload(`cargas-${todayStr()}.csv`, rows); closeSheet();
}

export { openSheet, closeSheet, exportBackup, importBackup, csvCell, csvDownload, exportMeasuresCSV, exportIntakeCSV, exportLoadCSV };
