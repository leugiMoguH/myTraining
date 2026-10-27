import { openAbout } from './about.js';
import { show } from './notice.js';
import { setThemePref } from './theme.js';
/* myTraining — ponte para os handlers inline (onclick="...") do HTML.
   Em ES modules nada é global: sem isto TODOS os botões falham em silêncio.
   Regra: um handler novo usado num atributo inline tem de ser acrescentado aqui. */
import { closeSheet, exportBackup, exportIntakeCSV, exportLoadCSV, exportMeasuresCSV, importBackup, openSheet } from './backup.js';
import { adAccept, adAlt, adDismiss, adQuick, adUndo } from './adapt-ui.js';
import { mvClose, mvDetails, mvOpen, mvWeek } from './motiv-ui.js';
import { clClose, clConflict, clDelete, clKeep, clMark, clMoveStep, clMoveTo, clMoveWeek, clMovePerm, clPast, clPastSet, clPastSave, clOpen, clReopen, clReplace, clSave, clSet, clText } from './classes-ui.js';
import { catAdd, catFilter, catInput, catPick, catScope, closeCatalog, openSwap, undoSwap } from './catalog-ui.js';
import { cuAdd, cuBegin, cuDiscard, cuFinish, cuHome, cuRemove, cuSuggest, cuToggle, openCustom } from './custom.js';
import { edAdd, edField, edLabel, edSuper, edMove, edRemove, edReset, edRest, toggleEdit } from './editor.js';
import { closeInfo, openInfo } from './guide.js';
import { mmDays, mmSel } from './muscle-map.js';
import { progInc, progScheme, saveLoad, toggleChart } from './loads.js';
import { addMedia, delMedia } from './media.js';
import { enableNotif } from './notify.js';
import { cancelNutri, editNutri, saveNutri, scanBarcode, stopScan } from './nutrition.js';
import { planBack, planEdit } from './plan-screen.js';
import { evTab, evTabKey, discardDraft, cancelMeasureEdit, delMeasure, editMeasure, saveMeasure, saveProfile, setMetric } from './profile.js';
import { slNext, slPrev, slTo } from './sliders.js';
import { esc, markDone, resetDay, toggleSet } from './state.js';
import { adjustRest, timerAdd, timerDismiss, timerStart } from './timer.js';
import { hxAddOpen, hxAddSave, hxBack, hxCancel, hxDelDay, hxDelSet, hxEditDate, hxEditSet, hxMetric, hxOpen, hxPeriod, hxSaveDate, hxSaveSet } from './history.js';
import { slideFail, goDay, render, toggleDayDone, toggleTodayList } from './ui.js';
import { toggleWake } from './wake.js';
import { heroStart } from './nav.js';
import { obDiscard, obApply, obBack, obClose, obDay, obEquip, obLimit, obName, obNext, obOpen, obPick, obSet, obSkip, obUndoPlan } from './onboarding.js';
import { closeWorkout, startWorkout, woDoSet, woFinish, woGo, woInfo, woPause, woStep, woSwap, woUndo } from './workout.js';

import { retrySave } from './save-banner.js';
import { exportCopy } from './backup.js';
Object.assign(window, { retrySave, exportCopy,
  openAbout,
  adAccept, adAlt, adDismiss, adQuick, adUndo,
  mvClose, mvDetails, mvOpen, mvWeek,
  clClose, clConflict, clDelete, clKeep, clMark, clMoveStep, clMoveTo, clMoveWeek, clMovePerm, clPast, clPastSet, clPastSave, clOpen, clReopen, clReplace, clSave, clSet, clText,
  slideFail,
  planBack, planEdit, obDiscard,
  setThemePref,
  addMedia,
  adjustRest,
  evTab, evTabKey, discardDraft, cancelMeasureEdit,
  cancelNutri,
  catAdd,
  catFilter,
  catInput,
  catPick,
  catScope,
  closeCatalog,
  closeInfo,
  closeSheet,
  closeWorkout,
  woDoSet, woFinish, woInfo, woPause, woStep, woSwap, woUndo,
  cuAdd,
  cuBegin,
  cuDiscard,
  cuFinish,
  cuHome,
  cuRemove,
  cuSuggest,
  cuToggle,
  delMeasure,
  delMedia,
  edAdd,
  edField,
  edLabel, edSuper,
  edMove,
  edRemove,
  edReset,
  edRest,
  editMeasure,
  editNutri,
  enableNotif,
  esc,
  exportBackup,
  exportIntakeCSV,
  exportLoadCSV,
  exportMeasuresCSV,
  goDay,
  importBackup,
  markDone,
  openCustom,
  openInfo,
  openSheet,
  openSwap,
  progInc,
  progScheme,
  render,
  hxAddOpen, hxAddSave, hxBack, hxCancel, hxDelDay, hxDelSet, hxEditDate, hxEditSet, hxMetric, hxOpen, hxPeriod, hxSaveDate, hxSaveSet,
  mmDays,
  mmSel,
  resetDay,
  saveLoad,
  saveMeasure,
  saveNutri,
  saveProfile,
  scanBarcode,
  setMetric,
  slNext,
  slPrev,
  slTo,
  startWorkout,
  stopScan,
  timerAdd,
  timerDismiss,
  timerStart,
  toggleChart,
  toggleDayDone,
  toggleTodayList,
  toggleEdit,
  toggleSet,
  toggleWake,
  undoSwap,
  woGo,
  heroStart,
  obApply, obBack, obClose, obDay, obEquip, obLimit, obName, obNext, obOpen, obPick, obSet, obSkip, obUndoPlan,
});

/* Os handlers devolvem Promises sem rejeições por tratar. */
for (const name of ['openAbout','heroStart','startWorkout','woFinish','cuFinish','cuDiscard','cuSuggest','edRemove','edReset','hxDelSet','hxDelDay','delMeasure','resetDay','obApply','obUndoPlan','importBackup','addMedia','scanBarcode','enableNotif','clMovePerm','clDelete','clPastSave']) {
  const handler=window[name];
  window[name]=(...args)=>{ try { return Promise.resolve(handler(...args)).catch(e=>show(e?.message || 'Não foi possível concluir a ação.', 'error')); } catch(e) { show(e?.message || 'Não foi possível concluir a ação.', 'error'); } };
}
