import assert from 'node:assert/strict';
import test from 'node:test';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import { EMERGENCY_DRUG_IDS } from '../src/data/emergencyDrugs';
import { PharmacokineticModel } from '../src/engine/pharmacokineticModel';
import { BiologicalStateEngine } from '../src/engine/biologicalState';
import { getOrganClearanceModifier } from '../src/engine/organClearance';
import { getSpeciesDoseRange, validateAdministrationCommand } from '../src/engine/drugAdministration';
import { HomeostaticFeedbackEngine } from '../src/engine/homeostaticFeedbackEngine';
import { aggregatePhysiologicalSignals } from '../src/engine/systemCoupling';
import { getPatientReserveCapacity } from '../src/engine/patientReserve';
import { PhysiologicalOrchestrator } from '../src/engine/physiologicalOrchestrator';
import { CellularReceptorsEngine } from '../src/engine/cellularReceptors';
import { createActiveDose, createHealthyValidationPatient, createSimulationState, administerDrug, advanceSimulation } from '../src/validation/simulationHarness';
import type { ActiveDrugDose } from '../src/types/simulator';

const patient = createHealthyValidationPatient('canine');
const drugById = (id: string) => VETERINARY_DRUG_DATABASE.find(d => d.id === id)!;
function evolve(dose: ActiveDrugDose, seconds: number, clearance = 1, perfusion = 1) {
  const drug = drugById(dose.drugId);
  let next = { ...dose, transitLagRemainingSec: 0 };
  for (let i = 0; i < seconds; i++) next = { ...next, ...PharmacokineticModel.step(1, patient, drug, next,
    getSpeciesDoseRange(drug, patient.species)!.typical,
    getSpeciesDoseRange(drug, patient.species, true)?.typical, clearance, perfusion) };
  return next;
}
function assertMassBalance(dose: ActiveDrugDose) {
  const p = dose.pkCompartments!;
  const accounted = p.centralAmountNormalized + p.rapidPeripheralAmountNormalized
    + p.deepPeripheralAmountNormalized + p.absorptionDepotAmountNormalized + p.cumulativeEliminatedNormalized;
  assert.ok(Math.abs(accounted - p.cumulativeDeliveredNormalized) < 1e-8);
}

test('CRI entrega massa fixa: dobrar taxa dobra exposição; falha de eliminação acumula sem alterar bomba', () => {
  for (const id of ['ketamine', 'dobutamine']) {
    const dose = createActiveDose(patient, id, 'typical', { route: 'CRI' });
    const normal = evolve(dose, 600);
    const impaired = evolve(dose, 600, 0.2);
    const doubled = evolve({ ...dose, criRatePerKgMin: dose.criRatePerKgMin! * 2 }, 600);
    assert.equal(normal.pkCompartments!.cumulativeDeliveredNormalized, impaired.pkCompartments!.cumulativeDeliveredNormalized);
    assert.ok(impaired.currentCp > normal.currentCp);
    assert.ok(Math.abs(doubled.currentCp / normal.currentCp - 2) < 1e-8);
    for (const result of [normal, impaired, doubled]) assertMassBalance(result);
    const stopped = evolve({ ...normal, isInfusionRunning: false, criRatePerKgMin: 0 }, 300);
    assert.equal(stopped.pkCompartments!.cumulativeDeliveredNormalized, normal.pkCompartments!.cumulativeDeliveredNormalized);
    assert.ok(stopped.currentCp < normal.currentCp);
    assertMassBalance(stopped);
  }
});

test('Hipoperfusão retarda absorção IM, preservando a dose no depósito', () => {
  const dose = createActiveDose(patient, 'ketamine', 'typical', { route: 'IM' });
  const normal = evolve(dose, 120);
  const shock = evolve(dose, 120, 1, 0.1);
  assert.ok(shock.currentCp < normal.currentCp);
  assert.ok(shock.pkCompartments!.absorptionDepotAmountNormalized > normal.pkCompartments!.absorptionDepotAmountNormalized);
  assertMassBalance(normal);
  assertMassBalance(shock);
});

test('Eliminação renal, hepática e extra-hepática respondem seletivamente à disfunção', () => {
  const state = BiologicalStateEngine.initialize(patient);
  const renal = { ...patient, pathologyConditions: { renalDysfunctionSeverity: 1 } };
  const hepatic = { ...patient, pathologyConditions: { hepaticDysfunctionSeverity: 1 } };
  const clearance = (p: typeof patient, id: string) => getOrganClearanceModifier(p, drugById(id), state, 38);
  assert.ok(clearance(renal, 'sugammadex') < clearance(hepatic, 'sugammadex'));
  assert.ok(clearance(hepatic, 'fentanyl') < clearance(renal, 'fentanyl'));
  assert.ok(clearance(renal, 'atracurium') > clearance(renal, 'sugammadex'));
  assert.ok(clearance(hepatic, 'atracurium') > clearance(hepatic, 'fentanyl'));
});

test('PAM preservada com baixo débito não equivale a perfusão ou oxigenação preservadas', () => {
  let normal = BiologicalStateEngine.initialize(patient);
  let lowFlow = BiologicalStateEngine.initialize(patient);
  for (let i = 0; i < 180; i++) {
    normal = BiologicalStateEngine.stepMetabolism(1, patient, normal, 0, 0, 0, 98, 80, 1);
    lowFlow = BiologicalStateEngine.stepMetabolism(1, patient, lowFlow, 0, 0, 0, 98, 80, 0.25);
  }
  assert.ok(lowFlow.organPerfusion.renalFraction < normal.organPerfusion.renalFraction);
  assert.ok(lowFlow.organPerfusion.cerebralFraction < normal.organPerfusion.cerebralFraction);
  assert.ok(lowFlow.organPerfusion.cumulativeOxygenDebt > normal.organPerfusion.cumulativeOxygenDebt);
});

test('Hipóxia e reserva exaurida reduzem resposta adrenérgica e contratilidade', () => {
  const state = BiologicalStateEngine.initialize(patient);
  const healthy = aggregatePhysiologicalSignals(HomeostaticFeedbackEngine.evaluate(patient, state));
  state.systemicRegulation.cellularHypoxia = 0.9;
  state.systemicRegulation.endothelialDysfunction = 0.8;
  state.systemicRegulation.compensatoryReserve = 0.1;
  state.organPerfusion.cumulativeOxygenDebt = 0.8;
  const shock = aggregatePhysiologicalSignals(HomeostaticFeedbackEngine.evaluate(patient, state));
  assert.ok(shock.adrenergicResponsiveness < healthy.adrenergicResponsiveness);
  assert.ok(shock.contractilityMultiplier < healthy.contractilityMultiplier);
  assert.ok(getPatientReserveCapacity({ ...patient, asa: 'IV' }) < getPatientReserveCapacity(patient));
});

test('Emergências constam no catálogo; tempo prescrito altera a entrega e rejeita valores inválidos', () => {
  for (const id of EMERGENCY_DRUG_IDS) assert.ok(drugById(id), id);
  const drug = drugById('calcium_gluconate');
  const dose = createActiveDose(patient, drug.id, 'typical', { route: 'IV_slow' });
  const fast = evolve({ ...dose, deliveryDurationSec: 60 }, 60);
  const slow = evolve({ ...dose, deliveryDurationSec: 600 }, 60);
  assert.ok(fast.pkCompartments!.cumulativeDeliveredNormalized > slow.pkCompartments!.cumulativeDeliveredNormalized * 9.9);
  const command = { route: dose.route, dosePerKg: dose.dosePerKg, administrationSpeed: dose.administrationSpeed, isCRI: false };
  assert.equal(validateAdministrationCommand(patient, drug, { ...command, deliveryDurationSec: 600 }).length, 0);
  for (const value of [0, -1, NaN, Infinity]) assert.ok(validateAdministrationCommand(patient, drug, { ...command, deliveryDurationSec: value }).length);
});

test('Reserva se esgota sob hipóxia sustentada e se recupera gradualmente após suporte', () => {
  const receptors = CellularReceptorsEngine.computeReceptorState(patient, [], 0, 'isoflurane');
  let state = BiologicalStateEngine.initialize(patient);
  state.organPerfusion.oxygenDeliveryMlKgMin = 1;
  state.organPerfusion.cumulativeOxygenDebt = 0.8;
  for (let i = 0; i < 600; i++) state = PhysiologicalOrchestrator.step(1, patient, state, receptors).state;
  const exhausted = state.systemicRegulation.compensatoryReserve;
  assert.ok(exhausted < 0.3);
  state.organPerfusion.oxygenDeliveryMlKgMin = 25;
  state.organPerfusion.cumulativeOxygenDebt = 0;
  for (let i = 0; i < 30; i++) state = PhysiologicalOrchestrator.step(1, patient, state, receptors).state;
  const early = state.systemicRegulation.compensatoryReserve;
  assert.ok(early > exhausted && early < 0.5);
  for (let i = 0; i < 1800; i++) state = PhysiologicalOrchestrator.step(1, patient, state, receptors).state;
  assert.ok(state.systemicRegulation.compensatoryReserve > early);
  assert.ok(state.systemicRegulation.compensatoryReserve < getPatientReserveCapacity(patient));
});

test('KCl em infusão: maior taxa eleva mais o potássio nas quatro espécies', () => {
  for (const species of ['canine', 'feline', 'equine', 'bovine'] as const) {
    const p = createHealthyValidationPatient(species);
    const values = ['min', 'typical', 'max'].map(level => {
      const state = createSimulationState(p);
      administerDrug(state, 'potassium_chloride', level as 'min' | 'typical' | 'max', { route: 'CRI' });
      advanceSimulation(state, 600);
      return state.vitals.arterialBloodGases.potassium;
    });
    assert.ok(values[0] < values[1] && values[1] < values[2], `${species}: ${values}`);
  }
});
