import { show } from './notice.js';
import { setThemePref } from './theme.js';
/* myTraining — ponte para os handlers inline (onclick="...") do HTML.
   Em ES modules nada é global: sem isto TODOS os botões falham em silêncio.
   Regra: um handler novo usado num atributo inline tem de ser acrescentado aqui. */
import { closeSheet, exportBackup, exportIntakeCSV, exportLoadCSV, exportMeasuresCSV, importBackup, openSheet } from './backup.js';
import { catAdd, catFilter, catInput, catPick, catScope, closeCatalog, openSwap, undoSwap } from './catalog-ui.js';
import { cuAdd, cuBegin, cuDiscard, cuFinish, cuHome, cuRemove, cuSuggest, cuToggle, openCustom } from './custom.js';
import { edAdd, edField, edLabel, edSuper, edMove, edRemove, edReset, edRest, toggleEdit } from './editor.js';
import { closeInfo, openInfo } from './guide.js';
import { mmDays, mmSel } from './muscle-map.js';
import { progInc, progScheme, saveLoad, toggleChart } from './loads.js';
import { addMedia, delMedia } from './media.js';
import { enableNotif } from './notify.js';
import { addIntakeUI, cancelNutri, delIntake, editNutri, fillIntake, saveNutri, scanBarcode, stopScan } from './nutrition.js';
import { cancelMeasureEdit, delMeasure, editMeasure, saveMeasure, saveProfile, setMetric } from './profile.js';
import { slNext, slPrev, slTo } from './sliders.js';
import { esc, markDone, resetDay, toggleSet } from './state.js';
import { adjustRest, timerAdd, timerDismiss, timerStart } from './timer.js';
import { hxAddOpen, hxAddSave, hxBack, hxCancel, hxDelDay, hxDelSet, hxEditDate, hxEditSet, hxMetric, hxOpen, hxPeriod, hxSaveDate, hxSaveSet } from './history.js';
import { goDay, render, toggleDayDone } from './ui.js';
import { toggleWake } from './wake.js';
import { heroStart } from './nav.js';
import { obApply, obBack, obClose, obDay, obLimit, obName, obNext, obOpen, obPick, obSet, obSkip, obUndoPlan } from './onboarding.js';
import { closeWorkout, startWorkout, woDoSet, woFinish, woGo, woInfo, woPause, woStep, woSwap, woUndo } from './workout.js';

Object.assign(window, {
  setThemePref,
  addIntakeUI,
  addMedia,
  adjustRest,
  cancelMeasureEdit,
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
  delIntake,
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
  fillIntake,
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
  toggleEdit,
  toggleSet,
  toggleWake,
  undoSwap,
  woGo,
  heroStart,
  obApply, obBack, obClose, obDay, obLimit, obName, obNext, obOpen, obPick, obSet, obSkip, obUndoPlan,
});

/* Os handlers devolvem Promises sem rejeições por tratar. */
for (const name of ['heroStart','startWorkout','woFinish','cuFinish','cuDiscard','cuSuggest','edRemove','edReset','hxDelSet','hxDelDay','delMeasure','resetDay','obApply','obUndoPlan','importBackup','addMedia','scanBarcode','enableNotif']) {
  const handler=window[name];
  window[name]=(...args)=>{ try { return Promise.resolve(handler(...args)).catch(e=>show(e?.message || 'Não foi possível concluir a ação.', 'error')); } catch(e) { show(e?.message || 'Não foi possível concluir a ação.', 'error'); } };
}
