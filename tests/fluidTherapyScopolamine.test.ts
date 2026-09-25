import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceSimulation, administerDrug, createActiveDose, createHealthyValidationPatient, createSimulationState } from '../src/validation/simulationHarness';
import { advanceFluidDelivery, FLUID_SOLUTIONS, stepFluidBalance } from '../src/engine/fluidTherapy';
import { CellularReceptorsEngine } from '../src/engine/cellularReceptors';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import { validateAdministrationCommand } from '../src/engine/drugAdministration';
import type { SpeciesType } from '../src/types/simulator';

function setup(species: SpeciesType = 'canine') {
  const state = createSimulationState(createHealthyValidationPatient(species));
  state.equipment.warmingBlanketActive = true;
  state.equipment.fluidTemperatureC = 38;
  return state;
}
function bolus(state: ReturnType<typeof setup>, mlKg: number, durationSec: number, fluidName: string = FLUID_SOLUTIONS[0].name) {
  state.equipment.fluidBoluses = [{ id: 'challenge', fluidName, volumeMl: state.patient.weightKg * mlKg, durationSec, deliveredMl: 0, isRunning: true }];
}
const close = (a: number, b: number, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('bólus é entregue no tempo prescrito, interrompido e concluído sem exceder volume', () => {
  const state = setup(); bolus(state, 10, 600);
  advanceSimulation(state, 60, { dtSeconds: 1 });
  close(state.equipment.totalFluidsInfusedMl, state.patient.weightKg);
  state.equipment.fluidBoluses![0].isRunning = false;
  advanceSimulation(state, 60, { dtSeconds: 1 });
  close(state.equipment.totalFluidsInfusedMl, state.patient.weightKg);
  state.equipment.fluidBoluses![0].isRunning = true;
  advanceSimulation(state, 1000, { dtSeconds: 2 });
  close(state.equipment.totalFluidsInfusedMl, state.patient.weightKg * 10);
  assert.equal(state.equipment.fluidBoluses![0].isRunning, false);
});

test('bomba e bólus simultâneos conservam composição ao trocar a bolsa', () => {
  const state = setup(); bolus(state, 10, 600, 'Sangue Total Fresco');
  state.equipment.isFluidPumpRunning = true;
  state.equipment.fluidRateMlPerHour = 360;
  state.equipment.activeFluidType = FLUID_SOLUTIONS[1].name;
  const step = advanceFluidDelivery(60, state.equipment);
  close(step.deliveries.find(d => d.fluidName === 'Sangue Total Fresco')!.volumeMl, state.patient.weightKg);
  close(step.deliveries.find(d => d.fluidName === FLUID_SOLUTIONS[1].name)!.volumeMl, 6);
  close(step.totalFluidsInfusedMl, state.patient.weightKg + 6);
});

test('balanço conserva volume administrado entre plasma, interstício e eliminação', () => {
  const state = setup();
  for (const solution of FLUID_SOLUTIONS) {
    let biology = structuredClone(state.vitals.biologicalState);
    for (let i = 0; i < 120; i++) biology.fluids = stepFluidBalance(10, state.patient, biology, [{ fluidName: solution.name, volumeMl: 2 }]);
    const f = biology.fluids;
    close(f.crystalloidCentralMl + f.interstitialMl! + f.colloidCentralMl + f.wholeBloodCentralMl + f.eliminatedMl!, 240);
    assert.ok(f.effectiveCirculatingExpansionMl >= 0);
  }
});

test('taxa e passo temporal: mesmo volume, maior pico com entrega rápida; estabilidade de integração', () => {
  const state = setup();
  function run(duration: number, dt: number) {
    let biology = structuredClone(state.vitals.biologicalState);
    for (let time = 0; time < duration; time += dt) biology.fluids = stepFluidBalance(dt, state.patient, biology, [{ fluidName: FLUID_SOLUTIONS[0].name, volumeMl: 300 * dt / duration }]);
    return biology.fluids;
  }
  const fast = run(120, 1); const slow = run(1800, 1); const coarse = run(120, 5);
  assert.ok(fast.effectiveCirculatingExpansionMl > slow.effectiveCirculatingExpansionMl * 1.4);
  close(fast.effectiveCirculatingExpansionMl, coarse.effectiveCirculatingExpansionMl, 2);
});

test('fluidoterapia atua pelo volume real tanto na farmacopeia quanto na bomba', () => {
  const catalog = setup(); const pump = setup();
  administerDrug(catalog, 'fluid_lrs');
  catalog.doses[0].transitLagRemainingSec = 0;
  pump.equipment.isFluidPumpRunning = true;
  pump.equipment.fluidRateMlPerHour = catalog.doses[0].criRateMlPerHour!;
  advanceSimulation(catalog, 600, { dtSeconds: 1 }); advanceSimulation(pump, 600, { dtSeconds: 1 });
  close(catalog.equipment.totalFluidsInfusedMl, pump.equipment.totalFluidsInfusedMl);
  close(catalog.vitals.biologicalState.fluids.effectiveCirculatingExpansionMl, pump.vitals.biologicalState.fluids.effectiveCirculatingExpansionMl, 0.2);
  close(catalog.vitals.meanArterialPressure, pump.vitals.meanArterialPressure, 1);
  const receptors = CellularReceptorsEngine.computeReceptorState(catalog.patient, catalog.doses, 0, 'isoflurane');
  assert.equal(receptors.volumeExpansion, 0);
  assert.equal(receptors.directBloodPressureEffect, 0);
});

test('hipovolemia responde a volume; sepse não se resolve como simples déficit de pré-carga', () => {
  const patient = createHealthyValidationPatient('canine');
  patient.pathologyConditions.hypovolemiaSeverity = 0.6;
  const control = createSimulationState(patient); const treated = createSimulationState(patient);
  bolus(treated, 15, 600);
  advanceSimulation(control, 600, { dtSeconds: 1 }); advanceSimulation(treated, 600, { dtSeconds: 1 });
  assert.ok(treated.vitals.meanArterialPressure > control.vitals.meanArterialPressure + 4);
  assert.ok(treated.vitals.cellularState.cardiacOutputLMin > control.vitals.cellularState.cardiacOutputLMin);
  const septic = setup(); septic.patient.pathologyConditions.sepsisVasodilation = true;
  bolus(septic, 15, 600); advanceSimulation(septic, 600, { dtSeconds: 1 });
  assert.ok(septic.vitals.biologicalState.fluids.interstitialMl! > treated.vitals.biologicalState.fluids.interstitialMl!);
});

test('mesma taxa em disfunção renal retém mais fluido; cardiopatia aumenta intolerância', () => {
  const healthy = setup(); const renal = setup(); const cardiac = setup();
  renal.patient.pathologyConditions.renalDysfunctionSeverity = 0.85;
  cardiac.patient.pathologyConditions.cardiacFailureDCM = true;
  for (const state of [healthy, renal, cardiac]) {
    state.equipment.isFluidPumpRunning = true; state.equipment.fluidRateMlPerHour = state.patient.weightKg * 35;
    advanceSimulation(state, 2400, { dtSeconds: 2 });
  }
  assert.ok(renal.vitals.biologicalState.fluids.eliminatedMl! < healthy.vitals.biologicalState.fluids.eliminatedMl!);
  assert.ok(cardiac.vitals.biologicalState.fluids.pulmonaryEdemaSeverity! > healthy.vitals.biologicalState.fluids.pulmonaryEdemaSeverity!);
  assert.ok(cardiac.vitals.pulseOximetrySpO2 < healthy.vitals.pulseOximetrySpO2);
});

test('glicose responde à composição e à taxa; salina aumenta cloreto e reduz bicarbonato', () => {
  const balanced = setup(); const saline = setup(); const glucose = setup(); const glucoseHigh = setup();
  for (const [state, name, rate] of [[balanced, FLUID_SOLUTIONS[0].name, 20], [saline, FLUID_SOLUTIONS[1].name, 20], [glucose, FLUID_SOLUTIONS[6].name, 5], [glucoseHigh, FLUID_SOLUTIONS[6].name, 15]] as const) {
    state.equipment.activeFluidType = name; state.equipment.isFluidPumpRunning = true; state.equipment.fluidRateMlPerHour = state.patient.weightKg * rate;
    advanceSimulation(state, 1200, { dtSeconds: 2 });
  }
  assert.ok(glucoseHigh.vitals.arterialBloodGases.glucoseMgDl > glucose.vitals.arterialBloodGases.glucoseMgDl + 10);
  assert.ok(glucose.vitals.arterialBloodGases.glucoseMgDl > balanced.vitals.arterialBloodGases.glucoseMgDl + 5);
  assert.ok(saline.vitals.biologicalState.fluids.chlorideMmolL! > balanced.vitals.biologicalState.fluids.chlorideMmolL!);
  assert.ok(saline.vitals.arterialBloodGases.bicarbonate < balanced.vitals.arterialBloodGases.bicarbonate);
});

test('hipertônica recruta água e aumenta sódio sem fabricar hemácias; sangue adiciona hemácias', () => {
  const state = setup(); state.patient.baselineVitals.hctPct = 25;
  const hyper = stepFluidBalance(1, state.patient, state.vitals.biologicalState, [{ fluidName: FLUID_SOLUTIONS[2].name, volumeMl: state.patient.weightKg * 4 }]);
  const blood = stepFluidBalance(1, state.patient, state.vitals.biologicalState, [{ fluidName: FLUID_SOLUTIONS[4].name, volumeMl: state.patient.weightKg * 10 }]);
  assert.ok(hyper.sodiumMmolL! > 150);
  assert.ok(hyper.currentHematocritPct < 25);
  assert.ok(blood.currentHematocritPct > 25);
});

test('infusão fria tem efeito térmico proporcional à quantidade', () => {
  const cold = setup(); const warm = setup();
  for (const state of [cold, warm]) bolus(state, 20, 300);
  cold.equipment.fluidTemperatureC = 10;
  advanceSimulation(cold, 300, { dtSeconds: 1 }); advanceSimulation(warm, 300, { dtSeconds: 1 });
  assert.ok(cold.vitals.bodyTemperatureC < warm.vitals.bodyTemperatureC - 0.3);
});

test('escopolaminas têm doses, vias e ações centrais distintas, sem extrapolar espécies', () => {
  const patient = createHealthyValidationPatient('canine');
  const peripheral = createActiveDose(patient, 'hyoscine_butylbromide');
  const central = createActiveDose(patient, 'scopolamine_hydrobromide');
  const expose = (dose: typeof central) => ({ ...dose, transitLagRemainingSec: 0, currentCe: 1, currentCp: 1 });
  const p = CellularReceptorsEngine.computeReceptorState(patient, [expose(peripheral)], 0, 'isoflurane');
  const c = CellularReceptorsEngine.computeReceptorState(patient, [expose(central)], 0, 'isoflurane');
  assert.equal(p.centralM1Blockade, 0); assert.ok(c.centralM1Blockade! > 0.3);
  assert.ok(p.m2Drive < 0 && p.m3Drive < 0 && c.m2Drive < 0);
  assert.equal(p.nociceptiveInhibition, 0); assert.equal(c.nmOccupancy, 0);
  const drug = VETERINARY_DRUG_DATABASE.find(d => d.id === central.drugId)!;
  assert.ok(validateAdministrationCommand(patient, drug, { route: 'IV', dosePerKg: 0.015 }).length > 0);
  assert.equal(drug.recommendedDose.equine, undefined);
});

test('butilbrometo aumenta FC e reduz motilidade, sem produzir hipnose ou analgesia cirúrgica', () => {
  const control = setup('equine'); const treated = setup('equine');
  administerDrug(treated, 'hyoscine_butylbromide');
  advanceSimulation(control, 180, { dtSeconds: 1 }); advanceSimulation(treated, 180, { dtSeconds: 1 });
  assert.ok(treated.vitals.heartRate > control.vitals.heartRate + 2);
  assert.ok(treated.vitals.biologicalState.visceral!.gutMotilityFraction < 0.8);
  assert.ok(treated.vitals.consciousnessScore > 90);
  assert.equal(treated.vitals.biologicalState.neurological.hypnoticDepth, 0);
});

test('bromidrato tem efeito cognitivo e interação central; alfa-2 + butilbrometo produz sinal de pós-carga', () => {
  const central = setup(); administerDrug(central, 'scopolamine_hydrobromide');
  advanceSimulation(central, 900, { dtSeconds: 2 });
  assert.ok(central.vitals.biologicalState.visceral!.centralAntimuscarinicBurden > 0.02);
  assert.ok(central.vitals.consciousnessScore < 99);
  const peripheral = setup('equine');
  administerDrug(peripheral, 'detomidine'); administerDrug(peripheral, 'hyoscine_butylbromide');
  advanceSimulation(peripheral, 120, { dtSeconds: 1 });
  assert.ok(peripheral.vitals.activePhysiologicalSignals?.some(s => s.id === 'alpha2-antimuscarinic-afterload-mismatch'));
});

test('infusão de manutenção mantém estabilidade nas quatro espécies', () => {
  for (const species of ['canine', 'feline', 'equine', 'bovine'] as const) {
    const state = setup(species);
    state.equipment.isFluidPumpRunning = true; state.equipment.fluidRateMlPerHour = state.patient.weightKg * 2.5;
    advanceSimulation(state, 1800, { dtSeconds: 2 });
    assert.equal(state.vitals.isCardiacArrest, false, species);
    assert.ok(state.vitals.biologicalState.fluids.pulmonaryEdemaSeverity! < 0.01, species);
  }
});
