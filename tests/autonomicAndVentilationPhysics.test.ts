import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthyValidationPatient, createSimulationState, advanceSimulation } from '../src/validation/simulationHarness';
import { RespiratoryGasExchangeEngine } from '../src/engine/respiratoryGasExchange';
import { CellularReceptorsEngine } from '../src/engine/cellularReceptors';
import { BiologicalStateEngine } from '../src/engine/biologicalState';
import { NEUTRAL_PHYSIOLOGICAL_MODIFIERS } from '../src/engine/systemCoupling';

test('circuito Bain: baixo fluxo de O2 produz reinalação com elevação de FiCO2 e EtCO2', () => {
  const patient = createHealthyValidationPatient('canine');
  const receptors = CellularReceptorsEngine.computeReceptorState(patient, [], 0, 'isoflurane');
  
  // 1. Bain com fluxo de O2 insuficiente (< 2.2x volume minuto)
  const lowFlowEquipment = {
    ...createSimulationState(patient).equipment,
    circuitType: 'bain_non_rebreathing' as const,
    intubationStatus: 'intubated_tracheal' as const,
    cuffPressureCmH2O: 20,
    oxygenFlowLMin: 0.3, // fluxo insuficiente para cão de 20 kg
  };

  const lowFlowRespiration = RespiratoryGasExchangeEngine.stepRespiration(
    10, 10, patient, receptors, lowFlowEquipment, false,
    98, 98, 40, 0, 1.2, 5, 0, 1, 80, patient.baselineVitals.rr,
    38, 0, 42, 1, 1, 1, NEUTRAL_PHYSIOLOGICAL_MODIFIERS
  );

  assert.ok(lowFlowRespiration.fiCO2 > 5, `FiCO2 deve elevar-se por reinalação no Bain; observado: ${lowFlowRespiration.fiCO2} mmHg`);
  assert.equal(lowFlowRespiration.capnogramType, 'rebreathing_elevated_baseline');

  // 2. Bain com fluxo adequado (FGF >= 150-200 mL/kg/min)
  const adequateFlowEquipment = {
    ...lowFlowEquipment,
    oxygenFlowLMin: 4.0, // fluxo adequado de varredura (>= 180 mL/kg/min)
  };

  const adequateFlowRespiration = RespiratoryGasExchangeEngine.stepRespiration(
    10, 20, patient, receptors, adequateFlowEquipment, false,
    98, 98, 40, 0, 1.2, 5, 0, 1, 80, patient.baselineVitals.rr,
    lowFlowRespiration.etCO2, 0, 42, 1, 1, 1, NEUTRAL_PHYSIOLOGICAL_MODIFIERS
  );

  assert.equal(adequateFlowRespiration.fiCO2, 0, 'Fluxo de varredura adequado no Bain deve zerar FiCO2');
});

test('circuito circular: cal sodada exausta causa reinalação em baixo fluxo e varre CO2 em alto fluxo', () => {
  const patient = createHealthyValidationPatient('canine');
  const receptors = CellularReceptorsEngine.computeReceptorState(patient, [], 0, 'isoflurane');

  // 1. Cal sodada 90% exausta com baixo fluxo (0.5 L/min)
  const exhaustedLowFlow = {
    ...createSimulationState(patient).equipment,
    circuitType: 'circle_rebreathing_adult' as const,
    intubationStatus: 'intubated_tracheal' as const,
    cuffPressureCmH2O: 20,
    sodaLimeExhaustionPct: 90,
    oxygenFlowLMin: 0.5,
  };

  const lowFlowRes = RespiratoryGasExchangeEngine.stepRespiration(
    10, 10, patient, receptors, exhaustedLowFlow, false,
    98, 98, 40, 0, 1.2, 5, 0, 1, 80, patient.baselineVitals.rr,
    38, 0, 42, 1, 1, 1, NEUTRAL_PHYSIOLOGICAL_MODIFIERS
  );

  assert.ok(lowFlowRes.fiCO2 > 0, `Cal sodada exausta com baixo fluxo deve permitir FiCO2 > 0; observado: ${lowFlowRes.fiCO2}`);
  assert.equal(lowFlowRes.capnogramType, 'rebreathing_elevated_baseline');

  // 2. Alto fluxo de O2 (3.0 L/min) em circuito circular varre CO2 pela válvula APL
  const exhaustedHighFlow = {
    ...exhaustedLowFlow,
    oxygenFlowLMin: 3.0,
  };

  const highFlowRes = RespiratoryGasExchangeEngine.stepRespiration(
    10, 20, patient, receptors, exhaustedHighFlow, false,
    98, 98, 40, 0, 1.2, 5, 0, 1, 80, patient.baselineVitals.rr,
    lowFlowRes.etCO2, 0, 42, 1, 1, 1, NEUTRAL_PHYSIOLOGICAL_MODIFIERS
  );

  assert.equal(highFlowRes.fiCO2, 0, 'Alto fluxo de O2 (>=2.5 L/min) deve varrer CO2 mesmo com cal sodada exausta');
});

test('vazamento de cuff (cuff deflacionado) reduz FiO2 e dilui amostra capnográfica', () => {
  const patient = createHealthyValidationPatient('canine');
  const receptors = CellularReceptorsEngine.computeReceptorState(patient, [], 0, 'isoflurane');

  // 1. Cuff selado (22 cmH2O)
  const sealedEquipment = {
    ...createSimulationState(patient).equipment,
    intubationStatus: 'intubated_tracheal' as const,
    cuffPressureCmH2O: 22,
    oxygenFlowLMin: 2.0,
  };

  const sealedRes = RespiratoryGasExchangeEngine.stepRespiration(
    10, 10, patient, receptors, sealedEquipment, false,
    98, 98, 40, 0, 1.2, 5, 0, 1, 80, patient.baselineVitals.rr,
    38, 0, 42, 1, 1, 1, NEUTRAL_PHYSIOLOGICAL_MODIFIERS
  );

  // 2. Cuff deflacionado (0 cmH2O)
  const leakingEquipment = {
    ...sealedEquipment,
    cuffPressureCmH2O: 0,
  };

  const leakingRes = RespiratoryGasExchangeEngine.stepRespiration(
    10, 20, patient, receptors, leakingEquipment, false,
    98, sealedRes.arterialBloodGases.paO2, 40, 0, 1.2, 5, 0, 1, 80, patient.baselineVitals.rr,
    sealedRes.etCO2, 0, 42, 1, 1, 1, NEUTRAL_PHYSIOLOGICAL_MODIFIERS
  );

  assert.ok(
    leakingRes.etCO2 <= sealedRes.etCO2,
    `Cuff com vazamento deve diluir leitura de EtCO2 (selado: ${sealedRes.etCO2}, vazando: ${leakingRes.etCO2})`
  );
});

test('neurotransmissores: alfa-2 inibe noradrenalina pré-sináptica e neostigmina acumula acetilcolina sináptica', () => {
  const patient = createHealthyValidationPatient('canine');
  const baseState = BiologicalStateEngine.initialize(patient);

  // 1. Estado basal
  assert.ok((baseState.autonomic.norepinephrineSynaptic ?? 0) > 0.1);
  assert.ok((baseState.autonomic.acetylcholineSynaptic ?? 0) > 0.1);

  // 2. Administração de agonista alfa-2 (dexmedetomidina)
  const alpha2Receptors = {
    ...CellularReceptorsEngine.computeReceptorState(patient, [], 0, 'isoflurane'),
    alpha2Drive: 0.95,
  };

  const alpha2State = BiologicalStateEngine.stepRegulatorySystems(
    10, patient, createSimulationState(patient).equipment, baseState,
    alpha2Receptors, 0, 40, 98, 80
  );

  assert.ok(
    (alpha2State.autonomic.norepinephrineSynaptic ?? 0) < (baseState.autonomic.norepinephrineSynaptic ?? 0),
    `Agonismo alfa-2 deve inibir exocitose de noradrenalina pré-sináptica (basal: ${baseState.autonomic.norepinephrineSynaptic}, alfa-2: ${alpha2State.autonomic.norepinephrineSynaptic})`
  );

  // 3. Administração de inibidor de AChE (neostigmina)
  const acheReceptors = {
    ...CellularReceptorsEngine.computeReceptorState(patient, [], 0, 'isoflurane'),
    acheInhibition: 0.85,
  };

  const acheState = BiologicalStateEngine.stepRegulatorySystems(
    10, patient, createSimulationState(patient).equipment, baseState,
    acheReceptors, 0, 40, 98, 80
  );

  assert.ok(
    (acheState.autonomic.acetylcholineSynaptic ?? 0) > (baseState.autonomic.acetylcholineSynaptic ?? 0) * 2,
    `Inibição de AChE deve causar acúmulo de acetilcolina sináptica (basal: ${baseState.autonomic.acetylcholineSynaptic}, neostigmina: ${acheState.autonomic.acetylcholineSynaptic})`
  );
});
