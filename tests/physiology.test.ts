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
  stopInfusion,
} from '../src/validation/simulationHarness';
import { analyzePatientDrugKinetics } from '../src/engine/biotransformationEngine';

const results = runBehaviorScenarios();

test('matriz comportamental não contém desvios fisiológicos conhecidos', async (t) => {
  for (const result of results) {
    await t.test(`${result.id}: ${result.title}`, () => {
      assert.equal(result.passed, true, `${result.expected}; observado: ${result.observed}`);
    });
  }
  assert.deepEqual(behaviorScenarioSummary(results), { passed: results.length, failed: 0 });
});

test('procedimentos cirúrgicos graduados produzem resposta proporcional à intensidade tecidual', () => {
  const runStimulus = (intensity: number) => {
    const state = createSimulationState(createHealthyValidationPatient('canine'));
    advanceSimulation(state, 25, { dtSeconds: 0.5, surgicalStimulation: intensity });
    return state.vitals;
  };
  const cutaneous = runStimulus(0.42);
  const visceral = runStimulus(0.92);

  assert.ok(visceral.biologicalState.neurological.nociceptiveInput > cutaneous.biologicalState.neurological.nociceptiveInput);
  assert.ok((visceral.nociceptiveStressLevel || 0) > (cutaneous.nociceptiveStressLevel || 0));
  assert.ok(visceral.heartRate >= cutaneous.heartRate);
});

test('infusão prolongada de nitroprussiato acumula metabólitos e melhora após interrupção', () => {
  const state = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(state, 'sodium_nitroprusside', 'typical');
  advanceSimulation(state, 17 * 3600, { dtSeconds: 30 });
  const duringInfusion = state.vitals.biologicalState.metabolic.nitroprussideToxicMetaboliteBurden;
  assert.ok(duringInfusion > 0.2, `carga insuficiente: ${duringInfusion}`);

  stopInfusion(state, 'sodium_nitroprusside');
  advanceSimulation(state, 12 * 3600, { dtSeconds: 30 });
  assert.ok(state.vitals.biologicalState.metabolic.nitroprussideToxicMetaboliteBurden < duringInfusion);
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

test('PK mamilar conserva massa entre plasma, tecidos, depósito e eliminação', () => {
  const state = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(state, 'propofol', 'typical');
  advanceSimulation(state, 180);
  const pk = state.doses.find((dose) => dose.drugId === 'propofol')?.pkCompartments;
  assert.ok(pk);
  const accounted = pk.centralAmountNormalized
    + pk.rapidPeripheralAmountNormalized
    + pk.deepPeripheralAmountNormalized
    + pk.absorptionDepotAmountNormalized
    + pk.cumulativeEliminatedNormalized;
  assert.ok(Math.abs(accounted - pk.cumulativeDeliveredNormalized) < 0.002);
  assert.ok(pk.rapidPeripheralAmountNormalized > 0.1);
  assert.ok(pk.cumulativeEliminatedNormalized > 0);
});

test('hipoperfusão reduz depuração e aumenta dívida de oxigênio', () => {
  const healthyPatient = createHealthyValidationPatient('canine');
  const compromisedPatient = createHealthyValidationPatient('canine');
  compromisedPatient.asa = 'IV';
  const healthy = createSimulationState(healthyPatient);
  const compromised = createSimulationState(compromisedPatient);
  administerDrug(healthy, 'propofol', 'typical');
  administerDrug(compromised, 'propofol', 'typical');
  advanceSimulation(healthy, 180);
  advanceSimulation(compromised, 180);

  const healthyClearance = healthy.doses[0].pkCompartments!.effectiveClearanceMultiplier;
  const compromisedClearance = compromised.doses[0].pkCompartments!.effectiveClearanceMultiplier;
  assert.ok(compromisedClearance < healthyClearance * 0.6);
  assert.ok(
    compromised.vitals.biologicalState.biotransformation.hepaticEnzymeCapacity
      < healthy.vitals.biologicalState.biotransformation.hepaticEnzymeCapacity
  );
  assert.ok(
    compromised.vitals.biologicalState.organPerfusion.cumulativeOxygenDebt
      > healthy.vitals.biologicalState.organPerfusion.cumulativeOxygenDebt + 0.15
  );
});

test('painel farmacocinético deriva concentração livre, distribuição e biotransformação do paciente', () => {
  const state = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(state, 'propofol', 'typical');
  advanceSimulation(state, 90, { dtSeconds: 1 });
  const dose = state.doses.find((item) => item.drugId === 'propofol');
  assert.ok(dose);
  const kinetics = analyzePatientDrugKinetics(state.patient, dose, state.vitals.biologicalState);
  assert.ok(kinetics?.estimatedPlasmaConcentration && kinetics.estimatedPlasmaConcentration > 0);
  assert.ok(kinetics.estimatedFreeConcentration! < kinetics.estimatedPlasmaConcentration);
  assert.ok(kinetics.rapidTissueFraction + kinetics.deepTissueFraction > 0);
  assert.equal(kinetics.profile.enzymeSystem, 'UGT');
});

test('exposição contínua a agonistas induz retroalimentação adaptativa receptorial', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient, createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal', ventilatorMode: 'cmv_volume', isVentilatorActive: true,
  }));
  administerDrug(state, 'fentanyl', 'typical', { route: 'CRI' });
  advanceSimulation(state, 4 * 3600, { dtSeconds: 10 });
  assert.ok(state.vitals.biologicalState.biotransformation.receptorAdaptiveFeedback > 0.15);
});

test('inalatório possui gradiente inspirado-alveolar-cérebro-tecidos e histerese de recuperação', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient, createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal',
    oxygenFlowLMin: 2,
    isVaporizerOn: true,
    vaporizerDialPct: 1.3,
  }));
  advanceSimulation(state, 300);
  const maintained = { ...state.vitals.biologicalState.inhalant };
  assert.ok(maintained.alveolarMac > 0.9);
  assert.ok(maintained.vesselRichMac > maintained.muscleMac);
  assert.ok(maintained.muscleMac > maintained.fatMac);

  state.equipment.isVaporizerOn = false;
  advanceSimulation(state, 60);
  const washout = state.vitals.biologicalState.inhalant;
  assert.equal(washout.inspiredMac, 0);
  assert.ok(washout.vesselRichMac > washout.alveolarMac);
  assert.ok(washout.muscleMac > maintained.muscleMac);
  assert.ok(state.vitals.consciousnessScore > 0 && state.vitals.consciousnessScore < 80);
});

test('fenótipos canino, felino, equino e bovino divergem nos sistemas esperados', () => {
  const dog = createSimulationState(createHealthyValidationPatient('canine'));
  const dogRates: number[] = [];
  for (let second = 0; second < 20; second += 1) {
    advanceSimulation(dog, 1);
    dogRates.push(dog.vitals.heartRate);
  }
  assert.ok(Math.max(...dogRates) - Math.min(...dogRates) > 2.5);

  const cat = createSimulationState(createHealthyValidationPatient('feline'));
  administerDrug(cat, 'dexmedetomidine', 'typical');
  advanceSimulation(cat, 600);
  assert.ok(cat.vitals.arterialBloodGases.glucoseMgDl > 130);

  const anesthetizeLargeAnimal = (species: 'equine' | 'bovine', vaporizerDialPct: number) => {
    const patient = createHealthyValidationPatient(species);
    const state = createSimulationState(patient, createDefaultEquipment(patient, {
      intubationStatus: 'intubated_tracheal',
      oxygenFlowLMin: 8,
      isVaporizerOn: true,
      vaporizerDialPct,
    }));
    advanceSimulation(state, 600, { dtSeconds: 2 });
    return state;
  };
  const horse = anesthetizeLargeAnimal('equine', 1.31);
  const cattle = anesthetizeLargeAnimal('bovine', 1.18);
  assert.ok(horse.vitals.biologicalState.species.myopathyRisk > 0.01);
  assert.equal(horse.vitals.biologicalState.species.ruminalBloatSeverity, 0);
  assert.ok(cattle.vitals.biologicalState.species.ruminalBloatSeverity > 0.25);
});

test('orquestrador converte sinergismo GABA-A em sinal causal e ventilação mensurável', () => {
  const patient = createHealthyValidationPatient('canine');
  const propofol = createSimulationState(patient);
  const combined = createSimulationState(patient);
  administerDrug(propofol, 'propofol', 'typical');
  administerDrug(combined, 'propofol', 'typical');
  administerDrug(combined, 'midazolam', 'typical');

  advanceSimulation(propofol, 45, { dtSeconds: 0.5 });
  advanceSimulation(combined, 45, { dtSeconds: 0.5 });

  const signal = combined.vitals.activePhysiologicalSignals.find((item) => item.id === 'gaba-allosteric-synergy');
  assert.ok(signal);
  assert.equal(signal.topology, 'one-to-many');
  assert.ok(signal.targets.includes('respiratorio'));
  assert.ok(combined.vitals.respiratoryRate < propofol.vitals.respiratoryRate);
});

test('interação alfa-2 e antimuscarínico aumenta dinamicamente demanda e isquemia miocárdica', () => {
  const patient = createHealthyValidationPatient('canine');
  const alpha2 = createSimulationState(patient);
  const mismatch = createSimulationState(patient);
  administerDrug(alpha2, 'dexmedetomidine', 'typical');
  administerDrug(mismatch, 'dexmedetomidine', 'typical');
  administerDrug(mismatch, 'atropine', 'typical');

  advanceSimulation(alpha2, 120, { dtSeconds: 0.5 });
  advanceSimulation(mismatch, 120, { dtSeconds: 0.5 });

  assert.ok(mismatch.vitals.activePhysiologicalSignals.some((item) => item.id === 'alpha2-antimuscarinic-afterload-mismatch'));
  assert.ok(mismatch.vitals.heartRate > alpha2.vitals.heartRate + 10);
  assert.ok(mismatch.vitals.myocardialIschemiaScore > alpha2.vitals.myocardialIschemiaScore + 0.03);
});

test('toxicidade metabólica reduz utilização celular de oxigênio e repercute no visor', () => {
  const patient = createHealthyValidationPatient('canine');
  const control = createSimulationState(patient);
  const intoxicated = createSimulationState(patient);
  intoxicated.vitals.biologicalState.metabolic.nitroprussideToxicMetaboliteBurden = 0.75;

  advanceSimulation(control, 120, { dtSeconds: 1 });
  advanceSimulation(intoxicated, 120, { dtSeconds: 1 });

  const regulation = intoxicated.vitals.biologicalState.systemicRegulation;
  assert.ok(intoxicated.vitals.activePhysiologicalSignals.some((item) => item.id === 'nitroprusside-cellular-toxicity'));
  assert.ok(regulation.cellularOxygenUtilizationFraction < 0.5);
  assert.ok(intoxicated.vitals.arterialBloodGases.lactate > control.vitals.arterialBloodGases.lactate + 4);
  assert.ok(intoxicated.vitals.meanArterialPressure < control.vitals.meanArterialPressure - 10);
});
