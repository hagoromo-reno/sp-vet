import assert from 'node:assert/strict';
import test from 'node:test';
import {
  behaviorScenarioSummary,
  runBehaviorScenarios,
} from '../src/validation/behaviorScenarios';
import {
  administerDrug,
  advanceSimulation,
  createDefaultEquipment,
  createHealthyValidationPatient,
  createSimulationState,
} from '../src/validation/simulationHarness';

const results = runBehaviorScenarios();

test('matriz comportamental não contém desvios fisiológicos conhecidos', async (t) => {
  for (const result of results) {
    await t.test(`${result.id}: ${result.title}`, () => {
      assert.equal(result.passed, true, `${result.expected}; observado: ${result.observed}`);
    });
  }
  assert.deepEqual(behaviorScenarioSummary(results), { passed: results.length, failed: 0 });
});

test('exposições de decúbito começam no evento biológico, não no relógio global', () => {
  const state = createSimulationState(createHealthyValidationPatient('bovine'));
  advanceSimulation(state, 3600, { dtSeconds: 5 });

  assert.equal(state.vitals.biologicalState.species.recumbencySeconds, 0);
  assert.equal(state.vitals.biologicalState.species.ruminalBloatSeverity, 0);

  administerDrug(state, 'propofol', 'typical');
  advanceSimulation(state, 180, { dtSeconds: 1 });

  assert.ok(state.vitals.biologicalState.species.recumbencySeconds > 60);
  assert.ok(state.vitals.biologicalState.species.ruminalBloatSeverity > 0.04);
  assert.ok(state.vitals.biologicalState.species.ruminalBloatSeverity < 0.2);
});

test('cristaloide e sangue alteram volume e hematócrito de formas distintas', () => {
  const patient = createHealthyValidationPatient('canine');
  patient.baselineVitals.map = 55;
  patient.pathologyConditions.hypovolemiaSeverity = 0.55;

  const crystalloid = createSimulationState(patient);
  const wholeBlood = createSimulationState(patient);
  crystalloid.equipment.activeFluidType = 'Ringer com Lactato (LRS)';
  crystalloid.equipment.totalFluidsInfusedMl = 400;
  wholeBlood.equipment.activeFluidType = 'Sangue Total Fresco';
  wholeBlood.equipment.totalFluidsInfusedMl = 400;

  advanceSimulation(crystalloid, 60);
  advanceSimulation(wholeBlood, 60);

  assert.ok(wholeBlood.vitals.meanArterialPressure > crystalloid.vitals.meanArterialPressure + 4);
  assert.ok(
    wholeBlood.vitals.arterialBloodGases.hematocritPct
      > crystalloid.vitals.arterialBloodGases.hematocritPct + 1.5
  );
});

test('ventilador respeita modo, limite de pressão e recrutamento por PEEP', () => {
  const patient = createHealthyValidationPatient('canine');
  const makeVentilated = (mode: 'cmv_volume' | 'pcv_pressure', peep: number, pip: number) =>
    createSimulationState(patient, createDefaultEquipment(patient, {
      intubationStatus: 'intubated_tracheal',
      isVentilatorActive: true,
      ventilatorMode: mode,
      ventilatorSettings: {
        rateBpm: 12,
        tidalVolumeMl: 240,
        peepCmH2O: peep,
        ieRatio: '1:2',
        pipPressureLimitCmH2O: pip,
        inspiratoryPausePct: 10,
      },
    }));

  const unrestrictedVcv = makeVentilated('cmv_volume', 0, 30);
  const pressureLimitedVcv = makeVentilated('cmv_volume', 0, 6);
  const pcv = makeVentilated('pcv_pressure', 5, 18);
  advanceSimulation(unrestrictedVcv, 10);
  advanceSimulation(pressureLimitedVcv, 10);
  advanceSimulation(pcv, 10);

  assert.equal(unrestrictedVcv.vitals.tidalVolumeMl, 240);
  assert.ok(pressureLimitedVcv.vitals.tidalVolumeMl < unrestrictedVcv.vitals.tidalVolumeMl);
  assert.equal(pressureLimitedVcv.equipment.currentAirwayPressureCmH2O, 6);
  assert.notEqual(pcv.vitals.tidalVolumeMl, 240);

  const equine = createHealthyValidationPatient('equine');
  const makeEquine = (peep: number) => createSimulationState(equine, createDefaultEquipment(equine, {
    intubationStatus: 'intubated_tracheal',
    isVentilatorActive: true,
    ventilatorMode: 'cmv_volume',
    ventilatorSettings: {
      rateBpm: 10,
      tidalVolumeMl: 6000,
      peepCmH2O: peep,
      ieRatio: '1:2',
      pipPressureLimitCmH2O: 25,
      inspiratoryPausePct: 10,
    },
  }));
  const noPeep = makeEquine(0);
  const withPeep = makeEquine(8);
  noPeep.vitals.biologicalState.species.pulmonaryShuntPct = 26;
  withPeep.vitals.biologicalState.species.pulmonaryShuntPct = 26;
  advanceSimulation(noPeep, 60);
  advanceSimulation(withPeep, 60);
  assert.ok(withPeep.vitals.arterialBloodGases.paO2 > noPeep.vitals.arterialBloodGases.paO2 + 20);
});

test('ventilação protege a troca gasosa sem ocultar apneia espontânea', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient, createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal',
    isVentilatorActive: true,
    ventilatorMode: 'cmv_volume',
  }));
  administerDrug(state, 'atracurium', 'typical');
  advanceSimulation(state, 300);

  assert.equal(state.vitals.isSpontaneousApnea, true);
  assert.equal(state.vitals.isRespiratoryArrest, false);
  assert.ok(state.vitals.pulseOximetrySpO2 > 95);
});

test('alfa-2 produz hiperglicemia progressiva por supressão de insulina', () => {
  const control = createSimulationState(createHealthyValidationPatient('feline'));
  const alpha2 = createSimulationState(createHealthyValidationPatient('feline'));
  administerDrug(alpha2, 'dexmedetomidine', 'typical');
  advanceSimulation(control, 600);
  advanceSimulation(alpha2, 600);

  assert.ok(alpha2.vitals.arterialBloodGases.glucoseMgDl > control.vitals.arterialBloodGases.glucoseMgDl + 20);
  assert.ok(alpha2.vitals.biologicalState.metabolic.insulinActivity < control.vitals.biologicalState.metabolic.insulinActivity);
});

test('ROSC é determinístico e um choque não é reaplicado a cada tick', () => {
  const prepareArrest = () => {
    const patient = createHealthyValidationPatient('canine');
    const state = createSimulationState(patient, createDefaultEquipment(patient, {
      intubationStatus: 'intubated_tracheal',
      oxygenFlowLMin: 2,
      isVentilatorActive: true,
      ventilatorMode: 'cmv_volume',
    }));
    state.vitals.isCardiacArrest = true;
    state.vitals.cardiacArrestType = 'ventricular_fibrillation';
    state.vitals.cardiacArrestCause = 'Teste controlado';
    state.resuscitation.isCPRActive = true;
    state.resuscitation.isCPRVentilationActive = true;
    state.resuscitation.compressionDepthQuality = 0.85;
    state.resuscitation.lastShockDeliveredJoules = 40;
    state.resuscitation.shocksDeliveredCount = 1;
    return state;
  };

  const first = prepareArrest();
  const second = prepareArrest();
  advanceSimulation(first, 2);
  advanceSimulation(second, 2);
  assert.equal(first.vitals.isCardiacArrest, true);
  assert.equal(first.vitals.biologicalState.resuscitation.processedShockCount, 1);
  assert.equal(
    first.vitals.biologicalState.resuscitation.roscReadinessSeconds,
    second.vitals.biologicalState.resuscitation.roscReadinessSeconds
  );

  advanceSimulation(first, 10);
  advanceSimulation(second, 10);
  assert.equal(first.vitals.isCardiacArrest, false);
  assert.equal(first.vitals.isCardiacArrest, second.vitals.isCardiacArrest);
  assert.equal(first.vitals.heartRate, second.vitals.heartRate);
});
