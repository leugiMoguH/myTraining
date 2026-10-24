import { confirmDialog } from './dialog.js';
import { show } from './notice.js';
/* myTraining — módulo extraído de index.html (Fase 0). */
import { DEFAULT_DAYS } from './data.js';
import { migrate, snapshot } from './migrate.js';
import { DAYS } from './routine.js';
import { syncNotifUI } from './notify.js';
import { bodyFat, clearDrafts } from './profile.js';
import { ST, est1RM, fmtTime, save, todayStr, setST } from './state.js';
import { REST_SEC, setRest, timerDismiss } from './timer.js';
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

let importOperation=0;
async function importBackup(e){
  const input=e.target, file=input.files && input.files[0], operation=++importOperation;
  if(!file) { input.value=''; return; }
  const guided=()=>document.getElementById('woBg').classList.contains('show');
  // O relógio pode avançar; todas as outras alterações invalidam a aprovação.
  const signature=()=>JSON.stringify(ST,(key,value)=>['seenAt','confirmedMs'].includes(key)?undefined:value);
  const before=signature();
  try{
      const raw=await file.text();
      if(operation!==importOperation || input.files[0]!==file || before!==signature()) return;
      const p=JSON.parse(raw);
      const incoming=(p && typeof p==='object' && p.state) ? p.state : p;
      const isObj=o=>!!o && typeof o==='object' && !Array.isArray(o);
      if(!isObj(incoming) || !isObj(incoming.sets) || !isObj(incoming.done))
        throw new Error('estrutura inválida');
      // Recusar enquanto o guiado está aberto evita referências WO/descanso antigas.
      if(guided()){ show('Sai do treino guiado antes de importar uma cópia.', 'info'); return; }
      if(!await confirmDialog({title:'Importar backup', message:'Importar substitui o progresso atual. Continuar?', danger:true, confirmLabel:'Importar'})) return;
      if(operation!==importOperation || input.files[0]!==file || before!==signature() || guided()) return;
      const snap=snapshot('antes de importar');
      if(!snap.ok){ show('Não foi possível guardar uma cópia do estado atual antes de importar: '+snap.error+'\nNada foi alterado.', 'error'); return; }
      const previous=ST, previousRest=REST_SEC;
      try {
      setST({ day:'Segunda', sets:{}, done:{}, log:{}, nutri:{profile:null}, profile:{}, measures:[], intake:[], media:{}, routine:null, ...incoming });
      if(!ST.log || typeof ST.log!=='object') ST.log={};
      if(!ST.nutri || typeof ST.nutri!=='object') ST.nutri={profile:null};
      if(!ST.profile || typeof ST.profile!=='object') ST.profile={};
      if(!Array.isArray(ST.measures)) ST.measures=[];
      if(!Array.isArray(ST.intake)) ST.intake=[];
      if(!ST.media || typeof ST.media!=='object') ST.media={};
      if(!Array.isArray(ST.sessions)) ST.sessions=[];
      if(!Array.isArray(ST.workouts)) ST.workouts=[];
      /* backup antigo (sem rotina) → repõe o plano original */
      if(!ST.routine || typeof ST.routine!=='object' || !Object.keys(ST.routine).length) ST.routine=JSON.parse(JSON.stringify(DEFAULT_DAYS));
      if(ST.day!=='__nutri' && ST.day!=='__perfil' && !DAYS[ST.day]) ST.day='Segunda';
      if(p && typeof p.rest_sec==='number') setRest(p.rest_sec);
      const migration=migrate();   /* ids, onb e meta também para backups antigos */
      if(migration.error || migration.saved===false || !save()) throw new Error(migration.error || 'Não foi possível guardar o backup.');
      } catch(err) { setST(previous); setRest(previousRest); save(); throw err; }
      clearDrafts();
      timerDismiss();
      closeSheet();
      render(ST.day);
      document.getElementById('restLabel').textContent=REST_SEC+'s';
      show('Backup importado ✓', 'ok');
    }catch(err){
      if(operation===importOperation) show('Não foi possível importar: '+(err && err.message ? err.message : 'ficheiro inválido'), 'error');
    }finally{
      if(operation===importOperation) input.value='';
    }
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
  if(rows.length<2){ show('Sem medidas para exportar.', 'info'); return; }
  csvDownload(`medidas-${todayStr()}.csv`, rows); closeSheet();
}
function exportIntakeCSV(){
  const rows=[['data','hora','alimento','kcal','proteina_g']];
  (ST.intake||[]).slice().sort((a,b)=>(a.ts||'')<(b.ts||'')?-1:1).forEach(x=>rows.push([x.date, x.ts?fmtTime(x.ts):'', x.name, Math.round(x.kcal), x.protein]));
  if(rows.length<2){ show('Sem registos de ingestão para exportar.', 'info'); return; }
  csvDownload(`diario-${todayStr()}.csv`, rows); closeSheet();
}
function exportLoadCSV(){
  const rows=[['exercicio','data','hora','peso_kg','reps','rm_estimado','tipo']];
  Object.keys(ST.log||{}).forEach(name=>{ (ST.log[name]||[]).forEach(e=>rows.push([name, e.date, e.ts?fmtTime(e.ts):'', e.w, e.r, est1RM(e.w,e.r), e.c?'personalizado':'programado'])); });
  if(rows.length<2){ show('Sem cargas para exportar.', 'info'); return; }
  csvDownload(`cargas-${todayStr()}.csv`, rows); closeSheet();
}

export { openSheet, closeSheet, exportBackup, importBackup, csvCell, csvDownload, exportMeasuresCSV, exportIntakeCSV, exportLoadCSV };
