/* myTraining — ponte para os handlers inline (onclick="...") do HTML.
   Em ES modules nada é global: sem isto TODOS os botões falham em silêncio.
   Regra: um handler novo usado num atributo inline tem de ser acrescentado aqui. */
import { closeSheet, exportBackup, exportIntakeCSV, exportLoadCSV, exportMeasuresCSV, importBackup, openSheet } from './backup.js';
import { catAdd, catFilter, catInput, catPick, catScope, closeCatalog, openSwap, undoSwap } from './catalog-ui.js';
import { cuAdd, cuBegin, cuDiscard, cuFinish, cuHome, cuRemove, cuSuggest, cuToggle, openCustom } from './custom.js';
import { edAdd, edField, edLabel, edMove, edRemove, edReset, edRest, toggleEdit } from './editor.js';
import { closeInfo, openInfo } from './guide.js';
import { progInc, progScheme, saveLoad, toggleChart } from './loads.js';
import { addMedia, delMedia } from './media.js';
import { enableNotif } from './notify.js';
import { addIntakeUI, cancelNutri, delIntake, editNutri, fillIntake, saveNutri, scanBarcode, stopScan } from './nutrition.js';
import { cancelMeasureEdit, delMeasure, editMeasure, saveMeasure, saveProfile, setMetric } from './profile.js';
import { slNext, slPrev, slTo } from './sliders.js';
import { esc, markDone, resetDay, toggleSet } from './state.js';
import { adjustRest, timerAdd, timerDismiss, timerStart } from './timer.js';
import { goDay, render, toggleDayDone } from './ui.js';
import { toggleWake } from './wake.js';
import { closeWorkout, startWorkout, woGo, woSaveLoad, woToggle } from './workout.js';

Object.assign(window, {
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
  edLabel,
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
  woSaveLoad,
  woToggle,
});
