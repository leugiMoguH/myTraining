/* myTraining — ponte para os handlers inline (onclick="...") do HTML.
   Em ES modules nada é global: sem isto TODOS os botões falham em silêncio.
   Regra: um handler novo usado num atributo inline tem de ser acrescentado aqui. */
import { closeSheet, exportBackup, exportIntakeCSV, exportLoadCSV, exportMeasuresCSV, importBackup, openSheet } from './backup.js';
import { catAdd, catFilter, catInput, closeCatalog } from './catalog-ui.js';
import { edAdd, edField, edLabel, edMove, edRemove, edReset, toggleEdit } from './editor.js';
import { closeInfo, openInfo } from './guide.js';
import { saveLoad, toggleChart } from './loads.js';
import { addMedia, delMedia } from './media.js';
import { enableNotif } from './notify.js';
import { addIntakeUI, cancelNutri, delIntake, editNutri, fillIntake, saveNutri, scanBarcode, stopScan } from './nutrition.js';
import { cancelMeasureEdit, delMeasure, editMeasure, saveMeasure, saveProfile, setMetric } from './profile.js';
import { slNext, slPrev, slTo } from './sliders.js';
import { esc, markDone, resetDay, toggleSet } from './state.js';
import { adjustRest, timerAdd, timerDismiss, timerStart } from './timer.js';
import { render } from './ui.js';
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
  closeCatalog,
  closeInfo,
  closeSheet,
  closeWorkout,
  delIntake,
  delMeasure,
  delMedia,
  edAdd,
  edField,
  edLabel,
  edMove,
  edRemove,
  edReset,
  editMeasure,
  editNutri,
  enableNotif,
  esc,
  exportBackup,
  exportIntakeCSV,
  exportLoadCSV,
  exportMeasuresCSV,
  fillIntake,
  importBackup,
  markDone,
  openInfo,
  openSheet,
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
  toggleEdit,
  toggleSet,
  toggleWake,
  woGo,
  woSaveLoad,
  woToggle,
});
