import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHealthyValidationPatient,
  createDefaultEquipment,
  createSimulationState,
  advanceSimulation,
  administerDrug,
} from '../src/validation/simulationHarness';
import { PKPDEngine } from '../src/engine/pkpdEngine';
import { ResuscitationState } from '../src/types/simulator';

test('Dinâmica de RCP Avançada (RECOVER): Taxa e Profundidade Modulam PAM, CPP e EtCO2 Artificial', () => {
  const patient = createHealthyValidationPatient('canine');

  const defaultEquip = createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal',
    cuffPressureCmH2O: 20,
    oxygenFlowLMin: 3.0,
  });

  // 1. RCP de Baixa Qualidade (Frequência lenta 60 cpm, profundidade inadequada 0.35)
  const poorCPR: ResuscitationState = {
    ...createSimulationState(patient).resuscitation,
    isCPRActive: true,
    compressionsPerMin: 60,
    compressionDepthQuality: 0.35,
    isCPRVentilationActive: true,
  };

  const poorResult = PKPDEngine.stepSimulation(
    1.0,
    10.0,
    patient,
    [],
    defaultEquip,
    poorCPR,
    false,
    {
      ...createSimulationState(patient).vitals,
      isCardiacArrest: true,
      cardiacArrestType: 'asystole',
      cardiacRhythm: 'asystole',
      meanArterialPressure: 0,
      heartRate: 0,
      cardiacArrestCause: 'Assistolia',
    }
  );

  // 2. RCP de Alta Qualidade pelas Diretrizes RECOVER (110 cpm, profundidade ideal 0.90)
  const highQualityCPR: ResuscitationState = {
    ...createSimulationState(patient).resuscitation,
    isCPRActive: true,
    compressionsPerMin: 110,
    compressionDepthQuality: 0.90,
    isCPRVentilationActive: true,
  };

  const hqResult = PKPDEngine.stepSimulation(
    1.0,
    10.0,
    patient,
    [],
    defaultEquip,
    highQualityCPR,
    false,
    {
      ...createSimulationState(patient).vitals,
      isCardiacArrest: true,
      cardiacArrestType: 'asystole',
      cardiacRhythm: 'asystole',
      meanArterialPressure: 0,
      heartRate: 0,
      cardiacArrestCause: 'Assistolia',
    }
  );

  assert.ok(
    hqResult.vitals.meanArterialPressure > poorResult.vitals.meanArterialPressure + 8,
    `RCP de alta qualidade deve gerar PAM significativamente maior (HQ: ${hqResult.vitals.meanArterialPressure} vs Poor: ${poorResult.vitals.meanArterialPressure})`
  );
  assert.ok(
    hqResult.vitals.etCO2 > poorResult.vitals.etCO2 + 6,
    `EtCO2 durante RCP reflete fluxo pulmonar e deve ser superior na compressão de alta qualidade (HQ: ${hqResult.vitals.etCO2} vs Poor: ${poorResult.vitals.etCO2})`
  );
  assert.ok(
    hqResult.vitals.diastolicBP > poorResult.vitals.diastolicBP,
    `Pressão diastólica gerada pela compressão HQ deve ser superior (${hqResult.vitals.diastolicBP} vs ${poorResult.vitals.diastolicBP})`
  );
});

test('Suporte Vasopressor em RCP (Adrenalina): Aumento do Tônus Aórtico, Pressão Diastólica e Perfusão Coronariana', () => {
  const patient = createHealthyValidationPatient('canine');
  const equip = createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal',
    cuffPressureCmH2O: 20,
    oxygenFlowLMin: 3.0,
  });

  const standardCPR: ResuscitationState = {
    ...createSimulationState(patient).resuscitation,
    isCPRActive: true,
    compressionsPerMin: 110,
    compressionDepthQuality: 0.85,
    isCPRVentilationActive: true,
  };

  // A. RCP sem Adrenalina
  const stateWithout = createSimulationState(patient, equip);
  stateWithout.vitals.isCardiacArrest = true;
  stateWithout.vitals.cardiacArrestType = 'asystole';
  stateWithout.vitals.cardiacRhythm = 'asystole';
  stateWithout.vitals.meanArterialPressure = 0;
  stateWithout.resuscitation = standardCPR;
  advanceSimulation(stateWithout, 2, { dtSeconds: 1 });

  // B. RCP com Adrenalina ativa na circulação coronariana/aórtica
  const stateWith = createSimulationState(patient, equip);
  stateWith.vitals.isCardiacArrest = true;
  stateWith.vitals.cardiacArrestType = 'asystole';
  stateWith.vitals.cardiacRhythm = 'asystole';
  stateWith.vitals.meanArterialPressure = 0;
  stateWith.resuscitation = standardCPR;
  administerDrug(stateWith, 'epinephrine', 'typical');
  for (const d of stateWith.doses) {
    d.transitLagRemainingSec = 0;
    d.currentCe = 0.40;
    d.currentCp = 0.50;
  }
  advanceSimulation(stateWith, 2, { dtSeconds: 1 });

  // Pressão de Perfusão Coronariana estimada: CPP ~ Diastólica - RAP (6 mmHg)
  const cppWithout = Math.max(0, stateWithout.vitals.diastolicBP - 6);
  const cppWith = Math.max(0, stateWith.vitals.diastolicBP - 6);

  assert.ok(
    stateWith.vitals.meanArterialPressure > stateWithout.vitals.meanArterialPressure + 4,
    `Adrenalina deve elevar a PAM na RCP via vasoconstrição periférica alfa-1 (com: ${stateWith.vitals.meanArterialPressure} vs sem: ${stateWithout.vitals.meanArterialPressure})`
  );
  assert.ok(
    stateWith.vitals.diastolicBP > stateWithout.vitals.diastolicBP + 3,
    `Adrenalina deve sustentar tônus aórtico diastólico (com: ${stateWith.vitals.diastolicBP} vs sem: ${stateWithout.vitals.diastolicBP})`
  );
  assert.ok(
    cppWith > cppWithout + 2,
    `Pressão de Perfusão Coronariana (CPP) deve ser incrementada pela Adrenalina (CPP com: ${cppWith} vs sem: ${cppWithout})`
  );
});

test('Desfibrilação de Ritmo Chocável (FV), Restauração de RASC (ROSC) e Pico de Washout Hipercápnico', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient);

  const equip = createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal',
    cuffPressureCmH2O: 20,
    oxygenFlowLMin: 3.0,
    isVentilatorActive: true,
    ventilatorMode: 'cmv_volume',
    ventilatorSettings: { rateBpm: 10, tidalVolumeMl: 250, pipPressureLimitCmH2O: 14, peepCmH2O: 0, ieRatio: '1:2', inspiratoryPausePct: 0 },
  });

  // 1. Instalar Parada por Fibrilação Ventricular
  state.vitals.isCardiacArrest = true;
  state.vitals.cardiacArrestType = 'ventricular_fibrillation';
  state.vitals.cardiacRhythm = 'ventricular_fibrillation';
  state.vitals.meanArterialPressure = 0;
  state.vitals.heartRate = 0;
  state.vitals.systolicBP = 0;
  state.vitals.diastolicBP = 0;
  state.vitals.pulseQuality = 'Ausente';
  state.vitals.cardiacArrestCause = 'Fibrilação Ventricular';
  state.vitals.arterialBloodGases.lactate = 4.2; // Acidose metabólica tecidual acumulada durante PCR

  // 2. RCP com Suporte Inotrópico / Vasopressor e Desfibrilação Elétrica Oportuna (4 J/kg)
  state.equipment = equip;
  state.resuscitation = {
    ...createSimulationState(patient).resuscitation,
    isCPRActive: true,
    compressionsPerMin: 110,
    compressionDepthQuality: 0.95,
    isCPRVentilationActive: true,
    lastShockDeliveredJoules: Math.round(patient.weightKg * 3.5),
    shocksDeliveredCount: 1,
  };

  administerDrug(state, 'epinephrine', 'typical');

  // Avançar ciclo de ressuscitação
  let achievedROSC = false;
  let maxWashoutEtCO2 = 0;
  for (let t = 0; t < 15; t++) {
    advanceSimulation(state, 1, { dtSeconds: 1 });
    if (state.vitals.etCO2 > maxWashoutEtCO2) {
      maxWashoutEtCO2 = state.vitals.etCO2;
    }
    if (!state.vitals.isCardiacArrest && state.vitals.heartRate > 0) {
      achievedROSC = true;
      break;
    }
  }

  // 3. Validação do RASC / ROSC
  assert.ok(
    achievedROSC,
    'Após choque elétrico em FV e RCP de alta qualidade, deve ocorrer retorno da circulação espontânea (RASC)'
  );
  assert.ok(
    state.vitals.heartRate > 0,
    `Frequência cardíaca deve ser positiva após RASC (FC: ${state.vitals.heartRate})`
  );
  assert.ok(
    state.vitals.meanArterialPressure >= 45,
    `PAM deve se restabelecer em níveis compatíveis com RASC (PAM: ${state.vitals.meanArterialPressure})`
  );
  assert.ok(
    maxWashoutEtCO2 >= 38,
    `Marca registrada do RASC (RECOVER): pico de washout hipercápnico imediato por reperfusão sistêmica (EtCO2: ${maxWashoutEtCO2} mmHg)`
  );
  assert.ok(
    ['Forte e Cheio', 'Normal'].includes(state.vitals.pulseQuality),
    `Qualidade do pulso deve ser restabelecida no RASC (obtido: ${state.vitals.pulseQuality})`
  );
});

test('Choque Hipovolêmico: Fase Compensada vs Descompensada e Resposta à Ressuscitação Volêmica e Bicarbonato', () => {
  const patient = createHealthyValidationPatient('canine');
  patient.baselineVitals.map = 65;
  patient.baselineVitals.sysBP = 90;
  patient.baselineVitals.diaBP = 45;
  patient.baselineVitals.hctPct = 30;
  patient.pathologyConditions.hypovolemiaSeverity = 0.50; // Choque hipovolêmico inicial

  const controlShock = createSimulationState(patient);
  const resuscitatedShock = createSimulationState(patient);

  // Evolução temporal do choque sem intervenção
  advanceSimulation(controlShock, 180, { dtSeconds: 1 });

  const controlMap = controlShock.vitals.meanArterialPressure;
  assert.ok(
    controlMap <= 65,
    `Choque não tratado deve manter hipotensão persistente (PAM: ${controlMap})`
  );

  // No grupo tratado: infusão de sangue total e bicarbonato de sódio para acidose
  administerDrug(resuscitatedShock, 'whole_blood', 'typical');
  administerDrug(resuscitatedShock, 'sodium_bicarbonate', 'typical');
  advanceSimulation(resuscitatedShock, 180, { dtSeconds: 1 });

  const resuscitatedMap = resuscitatedShock.vitals.meanArterialPressure;
  assert.ok(
    resuscitatedMap > controlMap + 3.5,
    `Ressuscitação volêmica associada a correção metabólica deve recuperar PAM em relação ao choque mantido (Tratado: ${resuscitatedMap} vs Controle: ${controlMap})`
  );
  assert.ok(
    resuscitatedShock.vitals.arterialBloodGases.bicarbonate > controlShock.vitals.arterialBloodGases.bicarbonate,
    `Bicarbonato sérico deve ser superior no paciente ressuscitado (${resuscitatedShock.vitals.arterialBloodGases.bicarbonate} vs ${controlShock.vitals.arterialBloodGases.bicarbonate})`
  );
});
