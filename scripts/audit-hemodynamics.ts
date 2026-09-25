import { createHealthyValidationPatient, createSimulationState, administerDrug, advanceSimulation } from '../src/validation/simulationHarness';
import type { SpeciesType } from '../src/types/simulator';

// Paired, reproducible investigation: identical patient/support, no painful stimulus.
const protocols = [[], ['acepromazine'], ['methadone'], ['acepromazine', 'methadone'],
  ['midazolam'], ['ketamine'], ['midazolam', 'ketamine'], ['dexmedetomidine'],
  ['dexmedetomidine', 'methadone'], ['propofol'], ['acepromazine', 'methadone', 'propofol'],
  ['dexmedetomidine', 'methadone', 'propofol'],
  ['midazolam', 'propofol'], ['atropine'], ['atropine', 'ketamine']];
const rows = [];
for (const species of ['canine', 'feline'] as SpeciesType[]) {
  for (const drugs of protocols) {
    const patient = createHealthyValidationPatient(species);
    const state = createSimulationState(patient);
    state.equipment.intubationStatus = 'intubated_tracheal';
    state.equipment.cuffPressureCmH2O = 20;
    state.equipment.isVentilatorActive = true;
    state.equipment.ventilatorMode = 'cmv_volume';
    state.equipment.warmingBlanketActive = true;
    for (const drug of drugs) administerDrug(state, drug);
    advanceSimulation(state, 900, {dtSeconds: 2});
    const worst = state.frames.reduce((a,b) => b.vitals.meanArterialPressure < a.vitals.meanArterialPressure ? b : a);
    const c = worst.vitals.cellularState;
    rows.push({species, protocol: drugs.join('+') || 'control', baseHR:patient.baselineVitals.hr, baseMAP:patient.baselineVitals.map,
      minMAP: +worst.vitals.meanArterialPressure.toFixed(1), time:worst.timeSeconds,
      maxHR:+Math.max(...state.frames.map(f=>f.vitals.heartRate)).toFixed(1),
      HRatMinMAP:+worst.vitals.heartRate.toFixed(1), Ca:c.intracellularCalcium,
      CO:c.cardiacOutputLMin, SVR:c.systemicVascularResistanceDyne,
      pH:worst.vitals.arterialBloodGases.pH, lactate:worst.vitals.arterialBloodGases.lactate,
      arrest:state.vitals.isCardiacArrest, cause:state.vitals.cardiacArrestCause,
      early: [60,180,300,600,900].map(t=>{const v=state.frames.find(f=>f.timeSeconds===t)!.vitals; return {t,hr:v.heartRate,map:v.meanArterialPressure,ischemia:v.myocardialIschemiaScore,regulation:v.biologicalState.systemicRegulation};})});
  }
}
console.log(JSON.stringify(rows, null, 2));
