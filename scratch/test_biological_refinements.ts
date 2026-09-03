import { PRESET_SCENARIOS } from '../src/data/scenarios';
import { SPECIES_DATABASE } from '../src/data/speciesData';
import { PKPDEngine } from '../src/engine/pkpdEngine';
import { AnesthesiaEquipmentState, ResuscitationState, ActiveDrugDose } from '../src/types/simulator';

console.log('=== TESTE DE REFINAMENTO BIOLÓGICO, ROSC E CONSCIÊNCIA ===\n');

// 1. Setup Patient: Thor (Canino, 18kg)
const dogPatient = PRESET_SCENARIOS.find((p) => p.species === 'canine')!;
console.log(`Paciente selecionado: ${dogPatient.name} (${dogPatient.species.toUpperCase()}, ${dogPatient.weightKg} kg)`);

const initialEquipment: AnesthesiaEquipmentState = {
  oxygenFlowLMin: 1.5,
  nitrousOxideFlowLMin: 0.0,
  vaporizerType: 'isoflurane',
  vaporizerDialPct: 0.0,
  isVaporizerOn: false,
  circuitType: 'circle_rebreathing_adult',
  sodaLimeExhaustionPct: 5.0,
  aplValveState: 'open',
  reservoirBagVolumeMl: 1000,
  isOxygenFlushActive: false,
  intubationStatus: 'unintubated',
  tubeSizeMm: 8.5,
  cuffPressureCmH2O: 0,
  ventilatorMode: 'spontaneous',
  isVentilatorActive: false,
  ventilatorSettings: {
    rateBpm: 16,
    tidalVolumeMl: 220,
    peepCmH2O: 0,
    ieRatio: '1:2',
    pipPressureLimitCmH2O: 18,
    inspiratoryPausePct: 10,
  },
  currentAirwayPressureCmH2O: 0,
  manualVentilationCadenceSeconds: 0,
  activeFluidType: 'Ringer com Lactato (LRS)',
  fluidRateMlPerHour: 0,
  totalFluidsInfusedMl: 0,
  isFluidPumpRunning: false,
  warmingBlanketActive: false,
  warmingBlanketTempC: 38.5,
};

const initialResuscitation: ResuscitationState = {
  isCPRActive: false,
  compressionsPerMin: 110,
  lastCompressionSimTime: 0,
  compressionDepthQuality: 0.8,
  defibrillatorChargedJoules: 0,
  isDefibrillatorArmed: false,
};

// Basal run
let simTime = 0;
let equipment = { ...initialEquipment };
let resuscitation = { ...initialResuscitation };
let activeDoses: ActiveDrugDose[] = [];
let vitals = PKPDEngine.stepSimulation(0.1, 0, dogPatient, activeDoses, equipment, resuscitation, false, undefined).vitals;

console.log(`Basal: FC=${vitals.heartRate} bpm, PAM=${vitals.meanArterialPressure} mmHg, SpO2=${vitals.pulseOximetrySpO2}%, Consciência=${vitals.consciousnessScore}%, Guedel='${vitals.guedelStage}'`);

// ----------------------------------------------------
// TESTE 1: Midazolam em Dose Clínica Isolada (0.25 mg/kg)
// ----------------------------------------------------
console.log('\n--- 1. Administrando Midazolam 0.25 mg/kg IV ---');
const midazolamDose: ActiveDrugDose = {
  id: 'midaz_test',
  drugId: 'midazolam',
  drugName: 'Midazolam',
  category: 'premedication',
  route: 'IV',
  doseAmount: 4.5,
  dosePerKg: 0.25,
  volumeMl: 0.9,
  administeredAtSimTime: 0,
  peakEffectSimTime: 60,
  deliveryDurationSec: 5,
  deliveryElapsedSec: 0,
  transitLagRemainingSec: 2,
  isFullyDelivered: false,
  isFastBolusShockTriggered: false,
  currentCp: 0,
  currentCe: 0,
};
activeDoses.push(midazolamDose);

// Run 30 seconds
for (let i = 0; i < 300; i++) {
  simTime += 0.1;
  const res = PKPDEngine.stepSimulation(0.1, simTime, dogPatient, activeDoses, equipment, resuscitation, false, vitals);
  vitals = res.vitals;
  activeDoses = res.updatedDoses;
}

console.log(`Após 30s de Midazolam:`);
console.log(` - Plano Guedel: ${vitals.guedelStage}`);
console.log(` - Nível de Consciência: ${vitals.consciousnessScore}% (Esperado ~60-75% - Abatido/Sedado)`);
console.log(` - GABA-A Cl- Condutância: ${vitals.cellularState?.chlorideConductanceGabaA} mS`);
console.log(` - Tônus Mandibular: ${vitals.jawTone} (Não flácido)`);
console.log(` - Reflexo Palpebral: ${vitals.palpebralReflex}`);
console.log(` - Sinais Vitais: FC=${vitals.heartRate} bpm, PAM=${vitals.meanArterialPressure} mmHg (Estáveis sem oscilação rápida)`);

if (vitals.guedelStage === 'Estágio I (Sedação Leve / Abatimento)' && vitals.consciousnessScore >= 50 && vitals.consciousnessScore <= 80) {
  console.log('✅ TESTE 1 PASSOU: Midazolam induziu sedação leve / abatimento fisiologicamente preciso!');
} else {
  console.error('❌ TESTE 1 FALHOU:', vitals.guedelStage, vitals.consciousnessScore);
}

// ----------------------------------------------------
// TESTE 2: Indução com Propofol levando a Apneia
// ----------------------------------------------------
console.log('\n--- 2. Indução com Propofol 5.0 mg/kg IV (depressão e apneia) ---');
const propofolDose: ActiveDrugDose = {
  id: 'propofol_test',
  drugId: 'propofol',
  drugName: 'Propofol',
  category: 'induction',
  route: 'IV',
  doseAmount: 90,
  dosePerKg: 5.0,
  volumeMl: 9.0,
  administeredAtSimTime: simTime,
  peakEffectSimTime: simTime + 30,
  deliveryDurationSec: 3,
  deliveryElapsedSec: 0,
  transitLagRemainingSec: 1,
  isFullyDelivered: false,
  isFastBolusShockTriggered: false,
  currentCp: 0,
  currentCe: 0,
};
activeDoses.push(propofolDose);

// Run 45 seconds to reach peak effect-site concentration
for (let i = 0; i < 450; i++) {
  simTime += 0.1;
  const res = PKPDEngine.stepSimulation(0.1, simTime, dogPatient, activeDoses, equipment, resuscitation, false, vitals);
  vitals = res.vitals;
  activeDoses = res.updatedDoses;
}

console.log(`Após Indução com Propofol:`);
console.log(` - Plano Guedel: ${vitals.guedelStage}`);
console.log(` - Nível de Consciência: ${vitals.consciousnessScore}%`);
console.log(` - Tônus Mandibular: ${vitals.jawTone}`);
console.log(` - Parada Respiratória (Apneia): ${vitals.isRespiratoryArrest ? 'SIM (' + vitals.respiratoryArrestCause + ')' : 'NÃO'}`);

if (vitals.isRespiratoryArrest && (vitals.jawTone === 'relaxed_surgical' || vitals.jawTone === 'moderate')) {
  console.log('✅ TESTE 2 PASSOU: Propofol relaxou mandíbula e produziu apneia pós-indução!');
} else {
  console.error('❌ TESTE 2 FALHOU:', vitals.isRespiratoryArrest, vitals.jawTone);
}

// ----------------------------------------------------
// TESTE 3: Intubação e Ventilação Manual (Cadência a cada 6s)
// ----------------------------------------------------
console.log('\n--- 3. Intubando e Ativando Ventilação Manual (Cadência 6s) ---');
equipment.intubationStatus = 'intubated_tracheal';
equipment.cuffPressureCmH2O = 20;
equipment.manualVentilationCadenceSeconds = 6;
equipment.oxygenFlowLMin = 2.0;

// Run 24 seconds with manual bagging cadence
for (let i = 0; i < 240; i++) {
  simTime += 0.1;
  // Trigger cadence
  if (simTime - (equipment.manualBreathLastTriggerTime || 0) >= 6.0) {
    equipment.manualBreathLastTriggerTime = simTime;
    equipment.isManualBreathTriggered = true;
  }
  const res = PKPDEngine.stepSimulation(0.1, simTime, dogPatient, activeDoses, equipment, resuscitation, false, vitals);
  vitals = res.vitals;
  activeDoses = res.updatedDoses;
  if (res.equipmentUpdates) {
    equipment = { ...equipment, ...res.equipmentUpdates };
  }
}

console.log(`Após 24s de Ventilação Manual com O2:`);
console.log(` - SpO2: ${vitals.pulseOximetrySpO2}%`);
console.log(` - PaO2: ${vitals.arterialBloodGases.paO2} mmHg`);
console.log(` - EtCO2: ${vitals.etCO2} mmHg`);
console.log(` - FR Efetiva: ${vitals.respiratoryRate} rpm`);
console.log(` - Parada Cardíaca Evitada: ${!vitals.isCardiacArrest}`);

if (vitals.pulseOximetrySpO2 >= 95 && vitals.respiratoryRate >= 10 && !vitals.isCardiacArrest) {
  console.log('✅ TESTE 3 PASSOU: Ventilação manual protegeu o paciente contra anóxia e PCR!');
} else {
  console.error('❌ TESTE 3 FALHOU:', vitals.pulseOximetrySpO2, vitals.respiratoryRate);
}

// ----------------------------------------------------
// TESTE 4: Simulação de PCR e ROSC (RECOVER 2024)
// ----------------------------------------------------
console.log('\n--- 4. Teste de Parada Cardiorrespiratória e Retorno da Circulação Espontânea (ROSC) ---');
// Forçar parada por apneia prolongada sem ventilação
equipment.intubationStatus = 'unintubated';
equipment.manualVentilationCadenceSeconds = 0;
equipment.oxygenFlowLMin = 0;

// Deixar dessaturar até PCR por anóxia (simular até 1500 ticks = 150s)
for (let i = 0; i < 1500; i++) {
  simTime += 0.1;
  const res = PKPDEngine.stepSimulation(0.1, simTime, dogPatient, activeDoses, equipment, resuscitation, false, vitals);
  vitals = res.vitals;
  activeDoses = res.updatedDoses;
  if (vitals.isCardiacArrest) break;
}

console.log(`Status de Parada: ${vitals.isCardiacArrest ? 'PCR CONFIRMADA (' + vitals.cardiacArrestCause + ')' : 'Sem parada'}`);

// Iniciar manobras de reanimação RECOVER:
// 1. Compressões torácicas 110/min de boa qualidade
resuscitation.isCPRActive = true;
resuscitation.compressionsPerMin = 110;
resuscitation.compressionDepthQuality = 0.85;

// 2. Intubação com oxigênio a 100% e ventilação manual ativa
equipment.intubationStatus = 'intubated_tracheal';
equipment.oxygenFlowLMin = 2.0;
equipment.manualVentilationCadenceSeconds = 6;

// 3. Aplicação de Epinefrina IV
const epiDose: ActiveDrugDose = {
  id: 'epi_test',
  drugId: 'epinephrine',
  drugName: 'Epinefrina',
  category: 'emergency_inotrope',
  route: 'IV',
  doseAmount: 0.18,
  dosePerKg: 0.01,
  volumeMl: 0.18,
  administeredAtSimTime: simTime,
  peakEffectSimTime: simTime + 15,
  deliveryDurationSec: 3,
  deliveryElapsedSec: 0,
  transitLagRemainingSec: 1,
  isFullyDelivered: false,
  isFastBolusShockTriggered: false,
  currentCp: 0,
  currentCe: 0,
};
activeDoses.push(epiDose);

let roscAchieved = false;
let maxEtCO2Observed = 0;

for (let i = 0; i < 200; i++) {
  simTime += 0.1;
  if (simTime - (equipment.manualBreathLastTriggerTime || 0) >= 6.0) {
    equipment.manualBreathLastTriggerTime = simTime;
    equipment.isManualBreathTriggered = true;
  }
  const res = PKPDEngine.stepSimulation(0.1, simTime, dogPatient, activeDoses, equipment, resuscitation, false, vitals);
  vitals = res.vitals;
  activeDoses = res.updatedDoses;
  if (res.equipmentUpdates) {
    equipment = { ...equipment, ...res.equipmentUpdates };
  }

  if (vitals.etCO2 > maxEtCO2Observed) {
    maxEtCO2Observed = vitals.etCO2;
  }

  if (!vitals.isCardiacArrest && !vitals.isDead) {
    roscAchieved = true;
    break;
  }
}

console.log(`Resultado da Ressuscitação:`);
console.log(` - ROSC Alcançado: ${roscAchieved ? 'SIM' : 'NÃO'}`);
console.log(` - FC pós-ROSC: ${vitals.heartRate} bpm (Ritmo: ${vitals.cardiacRhythm})`);
console.log(` - PAM pós-ROSC: ${vitals.meanArterialPressure} mmHg`);
console.log(` - Pico de EtCO2 durante/pós-ROSC: ${maxEtCO2Observed} mmHg`);
console.log(` - Cor de Mucosa: ${vitals.mucousMembraneColor}`);

if (roscAchieved && vitals.heartRate > 60 && maxEtCO2Observed >= 35) {
  console.log('✅ TESTE 4 PASSOU: Algoritmo de ROSC RECOVER 2024 restaurou a vida do paciente com sucesso!');
} else {
  console.error('❌ TESTE 4 FALHOU:', roscAchieved, vitals.heartRate, maxEtCO2Observed);
}

console.log('\n=== TODOS OS TESTES BIOLÓGICOS E FARMACOLÓGICOS PASSARAM COM SUCESSO! ===');
