import assert from 'node:assert/strict';
import test from 'node:test';
import {
  administerDrug,
  advanceSimulation,
  createActiveDose,
  createDefaultEquipment,
  createHealthyValidationPatient,
  createSimulationState,
} from '../src/validation/simulationHarness';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import {
  analyzePatientDrugKinetics,
  BiotransformationEngine,
} from '../src/engine/biotransformationEngine';
import { BiologicalStateEngine } from '../src/engine/biologicalState';
import { computeOrganClearance } from '../src/engine/organClearance';
import {
  predictDecrementTimes,
  getPkMicroConstants,
} from '../src/engine/pharmacokineticModel';
import {
  DRUG_DISPOSITION,
  getSpeciesEliminationFactor,
  SPECIES_ORGAN_PHYSIOLOGY,
} from '../src/engine/pk/speciesDrugDisposition';
import type { BiologicalState } from '../src/types/simulator';

test('Bioquímica: Saturação de vias enzimáticas (CYP3A) sob polifarmácia competitiva', () => {
  const patient = createHealthyValidationPatient('canine');
  const singleState = createSimulationState(patient);
  const polyState = createSimulationState(patient);

  // Monoterapia: Fentanil isolado
  administerDrug(singleState, 'fentanyl', 'typical', { route: 'IV' });
  advanceSimulation(singleState, 120, { dtSeconds: 2 });

  // Polifarmácia: Midazolam + Fentanil + Cetamina (todos com substrato CYP3A / CYP2B)
  administerDrug(polyState, 'fentanyl', 'typical', { route: 'IV' });
  administerDrug(polyState, 'midazolam', 'typical', { route: 'IV' });
  administerDrug(polyState, 'ketamine', 'typical', { route: 'IV' });
  advanceSimulation(polyState, 120, { dtSeconds: 2 });

  const singleBio = singleState.vitals.biologicalState.biotransformation;
  const polyBio = polyState.vitals.biologicalState.biotransformation;

  assert.ok(polyBio.enzymePathways, 'enzymePathways deve estar presente na telemetria biotransformacional');
  assert.ok(singleBio.enzymePathways, 'enzymePathways deve estar presente na telemetria biotransformacional');

  const singleCyp3a = singleBio.enzymePathways.cyp3a;
  const polyCyp3a = polyBio.enzymePathways.cyp3a;

  // Carga e saturação de CYP3A devem ser significativamente maiores na polifarmácia
  assert.ok(
    polyCyp3a.load > singleCyp3a.load * 1.5,
    `Carga de CYP3A na polifarmácia (${polyCyp3a.load.toFixed(2)}) deve superar monoterapia (${singleCyp3a.load.toFixed(2)})`
  );
  assert.ok(
    polyCyp3a.saturation > singleCyp3a.saturation,
    `Saturação de CYP3A deve aumentar sob polifarmácia (mono=${singleCyp3a.saturation.toFixed(3)}, poli=${polyCyp3a.saturation.toFixed(3)})`
  );
  assert.ok(
    polyCyp3a.activity < singleCyp3a.activity,
    `Atividade residual de CYP3A deve ser menor sob competição enzimática (mono=${singleCyp3a.activity.toFixed(3)}, poli=${polyCyp3a.activity.toFixed(3)})`
  );

  // Saturação hepática global reflete soma de substratos
  assert.ok(
    polyBio.hepaticEnzymeSaturation > singleBio.hepaticEnzymeSaturation,
    'Saturação enzimática hepática global deve refletir a carga combinada'
  );
});

test('Toxicocinética: Acúmulo de metabólito tóxico (MEGX) e ativação de sobrecarga tóxica em hipoperfusão prolongada', () => {
  const normalPatient = createHealthyValidationPatient('canine');
  const shockPatient = createHealthyValidationPatient('canine');
  shockPatient.asa = 'III';
  shockPatient.pathologyConditions = { hypovolemiaSeverity: 0.35 };

  const normalState = createSimulationState(normalPatient);
  const shockState = createSimulationState(shockPatient);

  // Ambos recebem infusão contínua de Lidocaína
  administerDrug(normalState, 'lidocaine_2pct', 'typical', { route: 'CRI' });
  administerDrug(shockState, 'lidocaine_2pct', 'typical', { route: 'CRI' });

  // Avançar 600 segundos (10 minutos de CRI)
  advanceSimulation(normalState, 600, { dtSeconds: 2 });
  advanceSimulation(shockState, 600, { dtSeconds: 2 });

  const normalLido = normalState.doses.find((d) => d.drugId === 'lidocaine_2pct')!;
  const shockLido = shockState.doses.find((d) => d.drugId === 'lidocaine_2pct')!;

  assert.ok(normalLido.pkCompartments?.metaboliteAmountNormalized !== undefined, 'MEGX deve ser quantificado');
  assert.ok(normalLido.pkCompartments!.cumulativeMetaboliteFormedNormalized > 0, 'MEGX deve acumular com a infusão');

  // Sob hipoperfusão (perfusão hepática < 0.6), a sobrecarga tóxica celular é desencadeada
  const normalToxicBurden = normalState.vitals.biologicalState.biotransformation.toxicMetaboliteBurden ?? 0;
  const shockToxicBurden = shockState.vitals.biologicalState.biotransformation.toxicMetaboliteBurden ?? 0;

  assert.equal(normalToxicBurden, 0, 'Em normoperfusão, metabólitos classe parent não geram sobrecarga tóxica');
  assert.ok(
    shockToxicBurden > 0,
    `Hipoperfusão deve ativar sobrecarga de metabólitos tóxicos celular (obtido: ${shockToxicBurden.toFixed(6)})`
  );

  // Análise cinética do paciente deve alertar sobre o metabólito
  const kinetics = analyzePatientDrugKinetics(shockPatient, shockLido, shockState.vitals.biologicalState);
  assert.ok(kinetics?.metaboliteExposure, 'kinetics deve expor perfil do metabólito');
  assert.equal(kinetics.metaboliteExposure.name, 'MEGX (monoetilglicinexilidida)');
  assert.ok(kinetics.metaboliteExposure.amountNormalized > 0);
});

test('Espécie-especificidade: Deficiência felina de UGT1A6 retarda recuperação de propofol vs canino', () => {
  const caninePatient = createHealthyValidationPatient('canine');
  const felinePatient = createHealthyValidationPatient('feline');

  const canineEquipment = createDefaultEquipment(caninePatient, {
    intubationStatus: 'intubated_tracheal',
    ventilatorMode: 'cmv_volume',
    isVentilatorActive: true,
  });
  const felineEquipment = createDefaultEquipment(felinePatient, {
    intubationStatus: 'intubated_tracheal',
    ventilatorMode: 'cmv_volume',
    isVentilatorActive: true,
  });

  const canineState = createSimulationState(caninePatient, canineEquipment);
  const felineState = createSimulationState(felinePatient, felineEquipment);

  // Verificar fator de eliminação derivado da deficiência UGT1A6
  const propofolDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'propofol')!;
  const canineFactor = getSpeciesEliminationFactor(propofolDef, 'canine');
  const felineFactor = getSpeciesEliminationFactor(propofolDef, 'feline');

  assert.equal(canineFactor.factor, 1.0, 'Canino é a referência padrão (fator=1.0)');
  assert.ok(
    felineFactor.factor < 0.65,
    `Fator de eliminação felino de propofol (${felineFactor.factor.toFixed(3)}) deve ser < 0.65 devido a pseudogenização de UGT1A6`
  );

  // Administrar bólus clínico de indução típico para cada espécie
  administerDrug(canineState, 'propofol', 'typical', { route: 'IV' });
  administerDrug(felineState, 'propofol', 'typical', { route: 'IV' });

  // Simular 900 segundos (15 minutos) pós-indução
  advanceSimulation(canineState, 900, { dtSeconds: 2 });
  advanceSimulation(felineState, 900, { dtSeconds: 2 });

  const caninePropofol = canineState.doses.find((d) => d.drugId === 'propofol')!;
  const felinePropofol = felineState.doses.find((d) => d.drugId === 'propofol')!;

  // Aos 15 min, a concentração plasmática e no sítio efetor do gato deve ser substancialmente maior
  assert.ok(
    felinePropofol.currentCp > caninePropofol.currentCp * 1.35,
    `Concentração plasmática de propofol no gato (${felinePropofol.currentCp.toFixed(4)}) deve ser >35% superior à do cão (${caninePropofol.currentCp.toFixed(4)}) aos 15 min`
  );
  assert.ok(
    felinePropofol.currentCe > caninePropofol.currentCe * 1.30,
    `Concentração no sítio efetor do gato (${felinePropofol.currentCe.toFixed(4)}) deve ser superior à do cão (${caninePropofol.currentCe.toFixed(4)})`
  );

  // Grau de hipnose residual no gato deve ser superior
  assert.ok(
    felineState.vitals.cellularState.hypnoticEffect > canineState.vitals.cellularState.hypnoticEffect,
    'Efeito hipnótico residual deve ser maior no felino devido à depuração retardada'
  );
});

test('Modelo Well-Stirred PBPK: Fármaco de alta extração (fluxo-dependente) vs baixa extração (capacidade-dependente)', () => {
  const patient = createHealthyValidationPatient('canine');
  const dexDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'dexmedetomidine')!; // ER ≈ 0.72 (alta extração)
  const diazDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'diazepam')!; // ER ≈ 0.15 (baixa extração)

  const normalBiological = BiologicalStateEngine.initialize(patient);

  // Estado de choque hipovolêmico grave: fluxo hepático e perfusão caem a 35%
  const shockBiological: BiologicalState = {
    ...normalBiological,
    organPerfusion: {
      ...normalBiological.organPerfusion,
      hepaticFraction: 0.35,
      renalFraction: 0.30,
    },
    biotransformation: {
      ...normalBiological.biotransformation,
      hepaticEnzymeCapacity: 0.35,
      renalFiltrationCapacity: 0.30,
    },
  };

  const dexNormal = computeOrganClearance(patient, dexDef, normalBiological, 38.0);
  const dexShock = computeOrganClearance(patient, dexDef, shockBiological, 38.0);

  const diazNormal = computeOrganClearance(patient, diazDef, normalBiological, 38.0);
  const diazShock = computeOrganClearance(patient, diazDef, shockBiological, 38.0);

  // Verificação dos regimes de depuração esperados
  assert.equal(dexNormal.clearanceRegime, 'limitada pelo fluxo');
  assert.equal(diazNormal.clearanceRegime, 'limitada pela capacidade enzimática');

  // Redução fracional de depuração no choque
  const dexDrop = (dexNormal.multiplier - dexShock.multiplier) / dexNormal.multiplier;
  const diazDrop = (diazNormal.multiplier - diazShock.multiplier) / diazNormal.multiplier;

  // Dexmedetomidina (alta extração) sofre queda acentuada proporcional ao fluxo sanguíneo
  assert.ok(
    dexDrop > 0.45,
    `Queda na depuração de dexmedetomidina no choque deve ser acentuada (>45%); obtido: ${(dexDrop * 100).toFixed(1)}%`
  );

  // A sensibilidade ao fluxo da dexmedetomidina deve superar a do diazepam
  assert.ok(
    dexDrop > diazDrop,
    `Fármaco de alta extração deve ser mais sensível à queda de perfusão que fármaco de baixa extração (dexDrop=${dexDrop.toFixed(2)}, diazDrop=${diazDrop.toFixed(2)})`
  );
});

test('PBPK Dinâmico: Elongação de Meia-Vida Contexto-Sensível (t1/2 CS) e Janela Terapêutica', () => {
  const patient = createHealthyValidationPatient('canine');
  const fentanylDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'fentanyl')!;

  // 1. Simular bólus único vs infusão prolongada
  const bolusDose = createActiveDose(patient, 'fentanyl', 'typical', { route: 'IV' });
  bolusDose.currentCp = 0.2; // ~1.8 ng/mL (faixa analgésica terapêutica)
  bolusDose.currentCe = 0.2;
  bolusDose.isFullyDelivered = true;
  bolusDose.pkCompartments = {
    centralAmountNormalized: 0.2,
    rapidPeripheralAmountNormalized: 0.15,
    deepPeripheralAmountNormalized: 0.10,
    absorptionDepotAmountNormalized: 0,
    cumulativeDeliveredNormalized: 1.0,
    cumulativeEliminatedNormalized: 0.55,
    bioavailableFraction: 1,
    effectiveClearanceMultiplier: 1,
    depotWasLoaded: false,
  };

  const criProlongedDose = createActiveDose(patient, 'fentanyl', 'typical', { route: 'CRI' });
  criProlongedDose.criRatePerKgMin = 0.0003;
  criProlongedDose.currentCp = 1.0;
  criProlongedDose.currentCe = 1.0;
  criProlongedDose.isFullyDelivered = false;
  criProlongedDose.pkCompartments = {
    centralAmountNormalized: 1.0,
    rapidPeripheralAmountNormalized: 2.2, // Tecidos periféricos saturados após 2h de CRI
    deepPeripheralAmountNormalized: 3.5, // Compartimento profundo saturado
    absorptionDepotAmountNormalized: 0,
    cumulativeDeliveredNormalized: 12.0,
    cumulativeEliminatedNormalized: 5.3,
    bioavailableFraction: 1,
    effectiveClearanceMultiplier: 1,
    depotWasLoaded: false,
  };

  const bolusDecrement = predictDecrementTimes(patient, fentanylDef, bolusDose, 1.0);
  const criDecrement = predictDecrementTimes(patient, fentanylDef, criProlongedDose, 1.0);

  assert.ok(bolusDecrement.contextSensitiveHalfTimeMin !== undefined, 't1/2 CS deve ser calculado para bólus');
  assert.ok(criDecrement.contextSensitiveHalfTimeMin !== undefined, 't1/2 CS deve ser calculado para CRI');

  // Efeito clássico de Hughes et al. (1992): saturação de tecidos eleva t1/2 CS
  assert.ok(
    criDecrement.contextSensitiveHalfTimeMin > bolusDecrement.contextSensitiveHalfTimeMin * 2,
    `t1/2 CS pós-infusão longa (${criDecrement.contextSensitiveHalfTimeMin} min) deve ser significativamente maior que bólus (${bolusDecrement.contextSensitiveHalfTimeMin} min)`
  );

  // 2. Classificação em Faixa Terapêutica (ng/mL)
  const kinetics = analyzePatientDrugKinetics(patient, bolusDose);
  assert.ok(kinetics?.therapeuticWindow, 'Janela terapêutica deve estar configurada para fentanil');
  assert.equal(kinetics.therapeuticWindow.unit, 'ng/mL');
  assert.ok(kinetics.therapeuticBand, 'Faixa de concentração deve ser classificada');
  assert.equal(
    kinetics.therapeuticBand.label,
    'analgesia',
    `Dose terapêutica deve cair na faixa 'analgesia'; recebido: ${kinetics.therapeuticBand.label}`
  );
});
