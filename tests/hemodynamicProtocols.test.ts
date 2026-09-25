import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthyValidationPatient, createDefaultEquipment, createSimulationState, createActiveDose, administerDrug, advanceSimulation } from '../src/validation/simulationHarness';
import { CellularReceptorsEngine } from '../src/engine/cellularReceptors';
import { BiologicalStateEngine } from '../src/engine/biologicalState';
import type { PatientProfile, SpeciesType } from '../src/types/simulator';

function supported(patient: PatientProfile) {
  return createSimulationState(patient, createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal', cuffPressureCmH2O: 20,
    isVentilatorActive: true, ventilatorMode: 'cmv_volume', warmingBlanketActive: true,
  }));
}
const minMap = (state: ReturnType<typeof supported>) => Math.min(...state.frames.map(f => f.vitals.meanArterialPressure));

test('dexmedetomidina + metadona + propofol: redução de débito sem colapso automático em paciente hígido com suporte', () => {
  for (const species of ['canine', 'feline'] as SpeciesType[]) {
    const state = supported(createHealthyValidationPatient(species));
    for (const id of ['dexmedetomidine', 'methadone', 'propofol']) administerDrug(state, id);
    advanceSimulation(state, 1800);
    // Broad educational guardrails, not a prediction for every clinical patient.
    assert.ok(minMap(state) > 55, `${species}: PAM ${minMap(state)}`);
    assert.ok(!state.vitals.isCardiacArrest, species);
    assert.ok(state.frames.every(f => f.vitals.biologicalState.organPerfusion.cumulativeOxygenDebt < 0.2));
    const peakSedation = state.frames.find(f => f.timeSeconds === 300)!.vitals;
    assert.ok(peakSedation.heartRate < state.patient.baselineVitals.hr * 0.85);
    assert.ok(peakSedation.cellularState.cardiacOutputLMin < state.frames[0].vitals.cellularState.cardiacOutputLMin * 0.85);
  }
});

test('pré-medicação IM seguida de propofol gradual mantém trajetória estável', () => {
  const state = supported(createHealthyValidationPatient('canine'));
  administerDrug(state, 'dexmedetomidine', 'typical', { route:'IM', dosePerKg:2 });
  administerDrug(state, 'methadone', 'typical', { route:'IM', dosePerKg:0.3 });
  advanceSimulation(state, 1200);
  administerDrug(state, 'propofol', 'typical', {dosePerKg:2});
  state.doses[state.doses.length - 1].deliveryDurationSec = 120;
  advanceSimulation(state, 900);
  assert.ok(minMap(state) > 60);
  assert.ok(!state.vitals.isCardiacArrest);
});

test('metadona não converte vagotonia em depressão ventricular intensa; acepromazina ainda reduz PAM', () => {
  const patient = createHealthyValidationPatient('canine');
  const dose = {...createActiveDose(patient,'methadone'),currentCe:1};
  const receptors = CellularReceptorsEngine.computeReceptorState(patient,[dose],0,'isoflurane');
  assert.ok(receptors.m2Drive > 0.1);
  assert.ok(receptors.intracellularCalcium > 0.96);
  const opioid = supported(patient), pair = supported(patient);
  administerDrug(opioid,'methadone');
  administerDrug(pair,'methadone'); administerDrug(pair,'acepromazine');
  advanceSimulation(opioid,900); advanceSimulation(pair,900);
  assert.ok(minMap(opioid) > 65);
  assert.ok(minMap(pair) > 55 && minMap(pair) < minMap(opioid) - 5);
});

test('bloqueio muscarínico compartilhado satura, independe da ordem e não soma taquicardia indefinidamente', () => {
  const patient = createHealthyValidationPatient('canine');
  const doses = ['atropine','glycopyrrolate','hyoscine_butylbromide'].map(id=>({...createActiveDose(patient,id),currentCe:3}));
  const single = CellularReceptorsEngine.computeReceptorState(patient,doses.slice(0,1),0,'isoflurane');
  const combined = CellularReceptorsEngine.computeReceptorState(patient,doses,0,'isoflurane');
  const reversed = CellularReceptorsEngine.computeReceptorState(patient,[...doses].reverse(),0,'isoflurane');
  assert.ok(combined.m2Drive < single.m2Drive && combined.m2Drive >= -1);
  assert.equal(combined.m2Drive,reversed.m2Drive);
  assert.ok(combined.m3Drive >= -1);
  assert.equal(combined.directHeartRateEffect,0);
  const state = supported(patient);
  for (const id of ['atropine','glycopyrrolate','hyoscine_butylbromide']) administerDrug(state,id);
  advanceSimulation(state,900);
  const peak = Math.max(...state.frames.map(f=>f.vitals.heartRate));
  assert.ok(peak > patient.baselineVitals.hr * 1.15 && peak < patient.baselineVitals.hr * 1.6);
});

test('poupança de MAC não aumenta a depressão miocárdica da mesma concentração de inalatório', () => {
  const patient = createHealthyValidationPatient('canine');
  const base = CellularReceptorsEngine.computeReceptorState(patient,[],1,'isoflurane');
  const combined = CellularReceptorsEngine.computeReceptorState(patient,[{...createActiveDose(patient,'midazolam'),currentCe:1}],1,'isoflurane');
  assert.ok(combined.macSparingFraction > base.macSparingFraction);
  assert.equal(combined.intracellularCalcium,base.intracellularCalcium);
  const deep = CellularReceptorsEngine.computeReceptorState(patient,[],2,'isoflurane');
  assert.ok(deep.intracellularCalcium < base.intracellularCalcium);
});

test('hipoperfusão renal isolada não vira dívida anóxica global; baixo débito grave continua acumulando dívida', () => {
  const patient = createHealthyValidationPatient('canine');
  let renal = BiologicalStateEngine.initialize(patient), shock = BiologicalStateEngine.initialize(patient);
  for (let t=0;t<900;t++) {
    renal = BiologicalStateEngine.stepMetabolism(1,patient,renal,0,0,0,98,80,1,98,1,1,0.1);
    shock = BiologicalStateEngine.stepMetabolism(1,patient,shock,0,0,0,98,40,0.2);
  }
  assert.ok(renal.organPerfusion.renalFraction < 0.15);
  assert.equal(renal.organPerfusion.cumulativeOxygenDebt,0);
  assert.ok(shock.organPerfusion.cumulativeOxygenDebt > 0.8);
});

test('hipovolemia e indução excessiva rápida continuam agravando hipotensão', () => {
  const patient = createHealthyValidationPatient('canine');
  const healthy = supported(patient);
  const depleted = supported({...patient,pathologyConditions:{hypovolemiaSeverity:0.8}});
  const overdose = supported(patient);
  for (const state of [healthy,depleted,overdose]) {
    administerDrug(state,'dexmedetomidine'); administerDrug(state,'methadone');
    administerDrug(state,'propofol','typical',{dosePerKg: state===overdose ? 12 : 2, speed:state===overdose ? 'bolus_rapid' : 'bolus_slow'});
    advanceSimulation(state,600);
  }
  assert.ok(minMap(depleted) < minMap(healthy) - 10);
  assert.ok(minMap(overdose) < minMap(healthy) - 8);
});

test('protocolo informado converge entre passos de 0,1, 1 e 2 segundos', () => {
  const values = [0.1,1,2].map(dtSeconds=>{
    const state = supported(createHealthyValidationPatient('canine'));
    for (const id of ['dexmedetomidine','methadone','propofol']) administerDrug(state,id);
    advanceSimulation(state,600,{dtSeconds});
    return state.vitals;
  });
  assert.ok(Math.max(...values.map(v=>v.meanArterialPressure))-Math.min(...values.map(v=>v.meanArterialPressure)) < 2);
  assert.ok(Math.max(...values.map(v=>v.heartRate))-Math.min(...values.map(v=>v.heartRate)) < 2);
});

test('determinantes da FC explicam o alvo sem alterar a saída do monitor', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = supported(patient);
  administerDrug(state,'ketamine'); administerDrug(state,'atropine');
  advanceSimulation(state,180,{surgicalStimulation:true});
  const d = state.vitals.cellularState.hemodynamicDrivers!;
  assert.ok(d.nodalDeltaBpm > 0 && d.otherDeltaBpm !== 0);
  const sum = patient.baselineVitals.hr + d.nodalDeltaBpm + d.baroreflexDeltaBpm + d.systemicDeltaBpm + d.otherDeltaBpm;
  assert.ok(Math.abs(sum - d.targetHeartRate) < 1e-8);
  assert.ok(d.preloadRatio > 0 && d.vascularResistanceRatio > 0 && d.contractilityRatio > 0);
});

test('nitroprussiato preserva ação venosa e arterial; hidralazina permanece predominantemente arterial', () => {
  const patient = createHealthyValidationPatient('canine');
  const response = (id:string) => CellularReceptorsEngine.computeReceptorState(patient,[{...createActiveDose(patient,id),currentCe:1}],0,'isoflurane');
  const balanced = response('sodium_nitroprusside'), arterial = response('hydralazine');
  assert.ok(balanced.directVasodilatorEffect > 0 && balanced.directVenodilatorEffect! > 0);
  assert.ok(arterial.directVasodilatorEffect > 0);
  assert.equal(arterial.directVenodilatorEffect,0);
  assert.equal(balanced.directBloodPressureEffect,0);
});
