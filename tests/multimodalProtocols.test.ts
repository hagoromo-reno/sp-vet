import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHealthyValidationPatient,
  createSimulationState,
  administerDrug,
  advanceSimulation,
} from '../src/validation/simulationHarness';
import { calculateAdministration } from '../src/engine/drugAdministration';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';

test('Protocolo Multimodal: Cetamina em CRI atinge steady-state e washout gradual', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient);

  const ketamineDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'ketamine')!;
  assert.ok(ketamineDef.recommendedCriDose?.canine, 'Cetamina deve ter dose CRI cadastrada para canino');

  // Iniciar CRI de Cetamina a 20 mcg/kg/min
  administerDrug(state, 'ketamine', 'typical', { route: 'CRI' });
  const criDose = state.doses.find((d) => d.drugId === 'ketamine' && d.isCRI);
  assert.ok(criDose, 'Dose CRI de Cetamina deve estar ativa');
  assert.equal(criDose.route, 'CRI');

  // Simular 300 segundos de infusão contínua
  advanceSimulation(state, 300, { dtSeconds: 1 });
  const activeKetamine = state.doses.find((d) => d.drugId === 'ketamine');
  assert.ok(activeKetamine, 'Cetamina deve permanecer em fármacos ativos durante a infusão');
  assert.ok(activeKetamine.currentCe > 0.40, `Cetamina deve acumular no sítio efetor Ce; observado: ${activeKetamine.currentCe}`);
  assert.ok(state.vitals.cellularState.nociceptiveInhibition > 0.25, 'Cetamina em CRI deve promover analgesia multimodal');

  // Interromper CRI e verificar washout gradual
  const doseBeforeStop = state.doses.find((d) => d.drugId === 'ketamine')!;
  doseBeforeStop.isInfusionRunning = false;
  doseBeforeStop.criRatePerKgMin = 0;
  const cePreWashout = doseBeforeStop.currentCe;

  advanceSimulation(state, 600, { dtSeconds: 1 });
  const washedKetamine = state.doses.find((d) => d.drugId === 'ketamine');
  assert.ok(washedKetamine, 'Cetamina deve continuar sendo monitorada durante o washout');
  assert.ok(washedKetamine.currentCe < cePreWashout, 'Ce deve decair gradualmente após parada da infusão');
});

test('Controle de Taquicardia Nociceptiva com Fentanil e Analgesia Multimodal', () => {
  const patient = createHealthyValidationPatient('canine');
  const baselineHR = patient.baselineVitals.hr;
  const state = createSimulationState(patient);

  // Ativar estimulação cirúrgica intensa sem analgesia -> taquicardia nociceptiva
  advanceSimulation(state, 30, { dtSeconds: 1, surgicalStimulation: true });
  const painHR = state.vitals.heartRate;
  assert.ok(painHR > baselineHR * 1.15, `Dor sem analgesia deve elevar FC; basal=${baselineHR}, dor=${painHR}`);

  // Administrar Fentanil IV em bólus (5 mcg/kg)
  administerDrug(state, 'fentanyl', 'typical', { route: 'IV' });
  advanceSimulation(state, 90, { dtSeconds: 1, surgicalStimulation: true });

  const treatedHR = state.vitals.heartRate;
  assert.ok(
    treatedHR < painHR * 0.90,
    `Fentanil deve controlar taquicardia nociceptiva; dor=${painHR}, tratado=${treatedHR}`
  );
  assert.ok(
    state.vitals.cellularState.nociceptiveInhibition > 0.50,
    'Fentanil deve estabelecer bloqueio nociceptivo evidente'
  );
});

test('Antiarrítmico Classe Ib: Lidocaína 2% reverte arritmia ventricular (VPCs) em paciente com GDV', () => {
  const patient = createHealthyValidationPatient('canine');
  patient.pathologyConditions.gastricDilatationVolvulus = true;

  const state = createSimulationState(patient);
  // Sem tratamento, GDV gera complexos ventriculares prematuros (VPCs)
  advanceSimulation(state, 10, { dtSeconds: 1 });
  assert.equal(state.vitals.cardiacRhythm, 'ventricular_premature_complexes', 'GDV sem antiarrítmico deve apresentar VPCs');

  // Administrar bólus terapêutico de Lidocaína 2% (2 mg/kg IV lento)
  administerDrug(state, 'lidocaine_2pct', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });
  advanceSimulation(state, 75, { dtSeconds: 1 });

  // A estabilização de membrana miocárdica classe Ib deve suprimir VPCs e reverter para ritmo sinusal
  assert.ok(
    (state.vitals.cellularState.antiarrhythmicIbProtection || 0) > 0.30,
    'Lidocaína terapêutica deve fornecer proteção antiarrítmica classe Ib'
  );
  assert.ok(
    state.vitals.cardiacRhythm.startsWith('sinus'),
    `Ritmo deve converter para sinusal sob lidocaína; observado: ${state.vitals.cardiacRhythm}`
  );
});

test('Reserva Fisiológica ASA: Paciente ASA IV apresenta maior vulnerabilidade hemodinâmica que ASA I sob indução', () => {
  const healthyPatient = createHealthyValidationPatient('canine');
  healthyPatient.asa = 'I';

  const criticalPatient = createHealthyValidationPatient('canine');
  criticalPatient.asa = 'IV';

  const healthyState = createSimulationState(healthyPatient);
  const criticalState = createSimulationState(criticalPatient);

  // Indução convencional de Propofol (4 mg/kg IV)
  administerDrug(healthyState, 'propofol', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });
  administerDrug(criticalState, 'propofol', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });

  advanceSimulation(healthyState, 60, { dtSeconds: 1 });
  advanceSimulation(criticalState, 60, { dtSeconds: 1 });

  // Paciente ASA I mantém PAM adequada por tônus basal e barorreflexo íntegro
  // Paciente ASA IV sofre hipotensão severa por reserva cardiovascular e barorreflexo exíguos
  assert.ok(
    healthyState.vitals.meanArterialPressure > criticalState.vitals.meanArterialPressure + 8,
    `ASA IV deve ter PAM significativamente menor que ASA I; ASA I=${healthyState.vitals.meanArterialPressure}, ASA IV=${criticalState.vitals.meanArterialPressure}`
  );
  assert.ok(
    criticalState.vitals.meanArterialPressure < 58,
    `Paciente ASA IV deve desenvolver hipotensão clínica (<58 mmHg) sob dose plena de propofol; observado=${criticalState.vitals.meanArterialPressure}`
  );
});

test('Cinética de Depuração ASA: Paciente ASA IV acumula fármacos por clearance hepático/renal retardado', () => {
  const patientAsaI = createHealthyValidationPatient('canine');
  patientAsaI.asa = 'I';

  const patientAsaIV = createHealthyValidationPatient('canine');
  patientAsaIV.asa = 'IV';

  const stateI = createSimulationState(patientAsaI);
  const stateIV = createSimulationState(patientAsaIV);

  administerDrug(stateI, 'propofol', 'typical', { route: 'IV_slow' });
  administerDrug(stateIV, 'propofol', 'typical', { route: 'IV_slow' });

  // Avançar 20 minutos (1200s) para avaliar a fase de eliminação beta
  advanceSimulation(stateI, 1200, { dtSeconds: 1 });
  advanceSimulation(stateIV, 1200, { dtSeconds: 1 });

  const doseI = stateI.doses.find((d) => d.drugId === 'propofol');
  const doseIV = stateIV.doses.find((d) => d.drugId === 'propofol');

  assert.ok(doseI && doseIV, 'Ambas as doses devem estar presentes');
  assert.ok(
    doseIV.currentCe > doseI.currentCe * 1.25,
    `Paciente ASA IV deve reter níveis séricos/biofase mais elevados que ASA I; Ce ASA I=${doseI.currentCe}, Ce ASA IV=${doseIV.currentCe}`
  );
});

test('Cálculo dimensional de bomba para CRI de Cetamina, Fentanil e Lidocaína', () => {
  const ketamineDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'ketamine')!;
  const fentanylDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'fentanyl')!;
  const lidocaineDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === 'lidocaine_2pct')!;

  // Cão de 20 kg
  // Cetamina 20 mcg/kg/min a 100 mg/mL -> 400 mcg/min = 0.4 mg/min = 24 mg/h = 0.24 mL/h
  const ketCalc = calculateAdministration(ketamineDef, 20, 20, 100, true);
  assert.equal(ketCalc.pumpRateMlPerHour, 0.24);

  // Fentanil 0.3 mcg/kg/min a 50 mcg/mL (0.05 mg/mL) -> 6 mcg/min = 360 mcg/h = 7.2 mL/h
  const fenCalc = calculateAdministration(fentanylDef, 0.3, 20, 0.05, true);
  assert.equal(fenCalc.pumpRateMlPerHour, 7.2);

  // Lidocaína 35 mcg/kg/min a 20 mg/mL -> 700 mcg/min = 0.7 mg/min = 42 mg/h = 2.1 mL/h
  const lidoCalc = calculateAdministration(lidocaineDef, 35, 20, 20, true);
  assert.equal(lidoCalc.pumpRateMlPerHour, 2.1);
});

test('Cetamina em bólus lento (60s) permanece ativa após trânsito e atinge plano dissociativo', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient);

  // Administrar Cetamina 5 mg/kg IV lento (infusão em 60s, trânsito 4s)
  administerDrug(state, 'ketamine', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });

  // 1. Imediatamente após fim do trânsito (ex: 5s e 10s):
  // O fármaco NÃO pode sumir de fármacos ativos! Ele está sendo ativamente infundido pela seringa.
  advanceSimulation(state, 5, { dtSeconds: 0.1 });
  let doseActive = state.doses.find((d) => d.drugId === 'ketamine');
  assert.ok(doseActive, 'Cetamina NÃO pode sumir ao fim do tempo de trânsito enquanto ainda está sendo infundida');

  advanceSimulation(state, 10, { dtSeconds: 0.1 });
  doseActive = state.doses.find((d) => d.drugId === 'ketamine');
  assert.ok(doseActive, 'Cetamina continua ativa aos 15s de simulação');

  // 2. Concluir infusão do bólus lento e equilibrar biofase (total 75s)
  advanceSimulation(state, 60, { dtSeconds: 1 });
  doseActive = state.doses.find((d) => d.drugId === 'ketamine');
  assert.ok(doseActive, 'Cetamina permanece em fármacos ativos após término da injeção');
  assert.ok(doseActive.isFullyDelivered, 'A injeção do bólus lento deve estar 100% entregue');
  assert.ok(doseActive.currentCe > 0.35, `Ce deve atingir níveis anestésicos; observado: ${doseActive.currentCe}`);

  // 3. Efeitos mapeados: anestesia dissociativa com reflexos preservados
  assert.ok(
    state.vitals.cellularState.dissociativeEffect > 0.30,
    `Cetamina deve induzir dissociação; observado: ${state.vitals.cellularState.dissociativeEffect}`
  );
  assert.ok(
    state.vitals.guedelStage.includes('Dissociativa'),
    `Estágio deve refletir anestesia dissociativa; observado: ${state.vitals.guedelStage}`
  );
  assert.equal(state.vitals.cornealReflex, 'brisk', 'Reflexo corneal deve permanecer preservado na cetamina');
});

test('Capnografia: amostragem espontânea não-intubado vs. intubação traqueal vs. erro esofágico', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient);

  // 1. Paciente Não Intubado (respiração espontânea / amostragem nasal):
  // O monitor multiparamétrico capta a respiração espontânea e exibe EtCO2 fisiológico
  state.equipment.intubationStatus = 'unintubated';
  advanceSimulation(state, 10, { dtSeconds: 1 });
  assert.ok(state.vitals.etCO2 > 30, `Paciente não intubado deve apresentar EtCO2 fisiológico em respiração espontânea; observado: ${state.vitals.etCO2}`);
  assert.notEqual(state.vitals.capnogramType, 'cardiac_arrest_flat', 'Traçado do capnógrafo deve refletir respiração espontânea');

  // 2. Intubação Esofágica (erro crítico de intubação):
  // O tubo está no esôfago -> não há CO2 alveolar -> EtCO2 cai para zero (flatline)
  state.equipment.intubationStatus = 'intubated_esophageal';
  advanceSimulation(state, 10, { dtSeconds: 1 });
  assert.equal(state.vitals.etCO2, 0, 'Intubação esofágica deve apresentar EtCO2 = 0 (sem CO2 alveolar)');
  assert.equal(state.vitals.capnogramType, 'cardiac_arrest_flat');

  // 3. Intubação Traqueal Correta:
  // Tubo na traqueia -> capnógrafo com acoplamento traqueal direto, confirmando intubação
  state.equipment.intubationStatus = 'intubated_tracheal';
  advanceSimulation(state, 15, { dtSeconds: 1 });
  assert.ok(
    state.vitals.etCO2 > 30,
    `Capnografia deve detectar CO2 alveolar após intubação traqueal; observado: ${state.vitals.etCO2} mmHg`
  );
  assert.notEqual(state.vitals.capnogramType, 'cardiac_arrest_flat', 'Capnograma deve gerar onda com platô alveolar');
});

test('Estímulo de Dor: Paciente Consciente vs. Sedação Profunda / Alfa-2 (Dexmedetomidina)', () => {
  // A. Paciente Consciente (sem medicação):
  // O estímulo de dor deve desencadear resposta adrenérgica completa (taquicardia, hipertensão, taquipneia)
  const patientAwake = createHealthyValidationPatient('canine');
  const stateAwake = createSimulationState(patientAwake);
  const baselineHrAwake = stateAwake.vitals.heartRate;
  const baselineMapAwake = stateAwake.vitals.meanArterialPressure;
  const baselineRrAwake = stateAwake.vitals.respiratoryRate;

  // Aplicar estímulo doloroso/cirúrgico no paciente consciente
  advanceSimulation(stateAwake, 10, { dtSeconds: 1, surgicalStimulation: true });
  const painHrAwake = stateAwake.vitals.heartRate;
  const painMapAwake = stateAwake.vitals.meanArterialPressure;
  const painRrAwake = stateAwake.vitals.respiratoryRate;

  assert.ok(
    painHrAwake > baselineHrAwake + 18,
    `Paciente consciente com dor deve apresentar taquicardia marcante; inicial: ${baselineHrAwake}, com dor: ${painHrAwake}`
  );
  assert.ok(
    painMapAwake > baselineMapAwake + 12,
    `Paciente consciente com dor deve apresentar hipertensão simpática; inicial: ${baselineMapAwake}, com dor: ${painMapAwake}`
  );
  assert.ok(
    painRrAwake > baselineRrAwake + 4,
    `Paciente consciente com dor deve apresentar taquipneia; inicial: ${baselineRrAwake}, com dor: ${painRrAwake}`
  );
  assert.equal(stateAwake.vitals.pedalReflex, 'brisk', 'Reflexo de retirada pedal deve ser vivo no paciente acordado');

  // B. Paciente em Sedação Profunda com Dexmedetomidina:
  // A sedação central profunda e a simpaticólise alfa-2 pré-sináptica bloqueiam o disparo adrenérgico,
  // garantindo estabilidade hemodinâmica (variação de FC e MAP <= 5 bpm/mmHg)
  const patientSedated = createHealthyValidationPatient('canine');
  const stateSedated = createSimulationState(patientSedated);
  administerDrug(stateSedated, 'dexmedetomidine', 'typical', { route: 'IV' });
  advanceSimulation(stateSedated, 120, { dtSeconds: 1 }); // Deixar atingir pico de sedação (onset 2 min)

  const hrSedatedPreStim = stateSedated.vitals.heartRate;
  const mapSedatedPreStim = stateSedated.vitals.meanArterialPressure;
  const rrSedatedPreStim = stateSedated.vitals.respiratoryRate;

  // Aplicar estímulo doloroso/cirúrgico sob sedação profunda
  advanceSimulation(stateSedated, 10, { dtSeconds: 1, surgicalStimulation: true });
  const hrSedatedPostStim = stateSedated.vitals.heartRate;
  const mapSedatedPostStim = stateSedated.vitals.meanArterialPressure;
  const rrSedatedPostStim = stateSedated.vitals.respiratoryRate;

  const hrDelta = Math.abs(hrSedatedPostStim - hrSedatedPreStim);
  const mapDelta = Math.abs(mapSedatedPostStim - mapSedatedPreStim);
  const rrDelta = Math.abs(rrSedatedPostStim - rrSedatedPreStim);

  assert.ok(
    hrDelta <= 6,
    `Paciente em sedação profunda deve ter variação mínima de FC sob estímulo (<= 6 bpm); delta: ${hrDelta}`
  );
  assert.ok(
    mapDelta <= 8,
    `Paciente em sedação profunda deve ter variação mínima de MAP sob estímulo (<= 8 mmHg); delta: ${mapDelta}`
  );
  assert.ok(
    rrDelta <= 3,
    `Paciente em sedação profunda deve ter variação mínima de FR sob estímulo (<= 3 rpm); delta: ${rrDelta}`
  );
  assert.ok(
    stateSedated.vitals.surgicalTolerancePct >= 65,
    `Tolerância cirúrgica deve ser elevada na sedação profunda; observado: ${stateSedated.vitals.surgicalTolerancePct}%`
  );
  assert.notEqual(stateSedated.vitals.pedalReflex, 'brisk', 'Reflexo pedal não pode ser brisk sob sedação profunda');
});

test('Estímulo de Dor: Anestesia Geral Multimodal (Propofol + Fentanil) garante estabilidade cirúrgica', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient);

  // Indução com Propofol e analgesia potente com Fentanil (anestesia balanceada)
  administerDrug(state, 'propofol', 'typical', { route: 'IV_slow' });
  administerDrug(state, 'fentanyl', 'typical', { route: 'IV' });
  advanceSimulation(state, 60, { dtSeconds: 1 });

  assert.ok(
    state.vitals.guedelStage.includes('Estágio III'),
    `Deve estar em Estágio III cirúrgico; observado: ${state.vitals.guedelStage}`
  );

  const preStimHr = state.vitals.heartRate;
  const preStimMap = state.vitals.meanArterialPressure;

  // Estímulo cirúrgico vigoroso (ex: incisão cutânea / celiorrafia)
  advanceSimulation(state, 15, { dtSeconds: 1, surgicalStimulation: true });
  const postStimHr = state.vitals.heartRate;
  const postStimMap = state.vitals.meanArterialPressure;

  const hrDiff = Math.abs(postStimHr - preStimHr);
  const mapDiff = Math.abs(postStimMap - preStimMap);

  assert.ok(
    hrDiff <= 5,
    `Sob anestesia geral multimodal, variação de FC durante cirurgia deve ser quase nula (<= 5 bpm); delta: ${hrDiff}`
  );
  assert.ok(
    mapDiff <= 5,
    `Sob anestesia geral multimodal, MAP deve permanecer estável (<= 5 mmHg); delta: ${mapDiff}`
  );
  assert.ok(
    state.vitals.surgicalTolerancePct >= 85,
    `Tolerância cirúrgica deve ser excelente (>= 85%); observado: ${state.vitals.surgicalTolerancePct}%`
  );
  assert.equal(state.vitals.pedalReflex, 'absent', 'Reflexo pedal deve ser abolido durante cirurgia sob plano adequado');
});

test('Estímulo de Dor: Bloqueio Local / Epidural (Lidocaína / Bupivacaína) impede resposta autonômica', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient);

  // Infiltração Local com Lidocaína 2% (bloqueio regional dos canais NaV primários)
  administerDrug(state, 'lidocaine_2pct', 'typical', { route: 'Local' });
  advanceSimulation(state, 90, { dtSeconds: 1 }); // Deixar atingir bloqueio neural local pleno

  assert.ok(
    state.vitals.cellularState.localNeuralBlockade > 0.60,
    `Bloqueio local NaV deve estar estabelecido; observado: ${state.vitals.cellularState.localNeuralBlockade}`
  );

  const preStimHr = state.vitals.heartRate;
  const preStimMap = state.vitals.meanArterialPressure;

  // Aplicar estímulo cirúrgico vigoroso no campo bloqueado
  advanceSimulation(state, 15, { dtSeconds: 1, surgicalStimulation: true });
  const postStimHr = state.vitals.heartRate;
  const postStimMap = state.vitals.meanArterialPressure;

  const hrDiff = Math.abs(postStimHr - preStimHr);
  const mapDiff = Math.abs(postStimMap - preStimMap);

  assert.ok(
    hrDiff <= 4,
    `Bloqueio local com anestésico local deve bloquear taquicardia nociceptiva (<= 4 bpm); delta: ${hrDiff}`
  );
  assert.ok(
    mapDiff <= 5,
    `Bloqueio local deve impedir vasoconstrição simpática hipertensiva (<= 5 mmHg); delta: ${mapDiff}`
  );
  assert.ok(
    state.vitals.surgicalTolerancePct >= 80,
    `Tolerância cirúrgica no campo com anestesia local deve ser excelente; observado: ${state.vitals.surgicalTolerancePct}%`
  );
  assert.notEqual(
    state.vitals.pedalReflex,
    'brisk',
    'Reflexo de retirada não pode ser brisk em campo bloqueado com anestésico local'
  );
});

test('Cinética Fisiológica da Dor: Crescendo Gradual e Regressão Suave Pós-Estímulo', () => {
  const patient = createHealthyValidationPatient('canine');
  const state = createSimulationState(patient);
  const baselineHr = state.vitals.heartRate;

  // 1. Início do estímulo doloroso: No primeiro segundo, a FC NÃO deve saltar instantaneamente 30 bpm
  advanceSimulation(state, 1, { dtSeconds: 1, surgicalStimulation: true });
  const hrAt1s = state.vitals.heartRate;
  const initialRise = hrAt1s - baselineHr;
  assert.ok(
    initialRise >= 1 && initialRise <= 8,
    `No 1º segundo de dor, FC deve ter aumento suave e progressivo (1 a 8 bpm); observado aumento de: ${initialRise.toFixed(2)} bpm`
  );

  // 2. Continuidade do estímulo por 10 segundos: Atinge o pico de estresse catecolaminérgico
  advanceSimulation(state, 9, { dtSeconds: 1, surgicalStimulation: true });
  const peakHr = state.vitals.heartRate;
  assert.ok(
    peakHr > baselineHr + 16,
    `Após 10s de estímulo doloroso sustentado, FC deve ter atingido taquicardia marcante; inicial: ${baselineHr}, pico: ${peakHr}`
  );

  // 3. Fim do estímulo doloroso: No 1º segundo após alívio, a FC NÃO deve despencar instantaneamente de volta
  advanceSimulation(state, 1, { dtSeconds: 1, surgicalStimulation: false });
  const hrJustAfterRelief = state.vitals.heartRate;
  assert.ok(
    hrJustAfterRelief > baselineHr + 12,
    `No 1º segundo após cessar o estímulo, catecolaminas circulantes devem sustentar a FC próxima ao pico; basal: ${baselineHr}, após alívio: ${hrJustAfterRelief}`
  );

  // 4. Lavagem gradual (clearance e recaptação em 20 segundos)
  advanceSimulation(state, 20, { dtSeconds: 1, surgicalStimulation: false });
  const hrAfterWashout = state.vitals.heartRate;
  assert.ok(
    hrAfterWashout < hrJustAfterRelief - 8,
    `Após 20 segundos sem estímulo, a FC deve ter regredido progressivamente; pico: ${peakHr}, após 20s: ${hrAfterWashout}`
  );
});
