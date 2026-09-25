import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createPhysiologyGateway } from '../server/physiology-gateway';
import { PRESET_SCENARIOS } from '../src/data/scenarios';
import { createCaninePatientConfiguration } from '../src/physiology/canineReferenceModel';
import {
  PHYSIOLOGY_PROTOCOL_VERSION,
  type PhysiologyServerMessage,
  type PhysiologySnapshot,
  type PhysiologyStepInputs,
} from '../src/physiology/protocol';

const patient = PRESET_SCENARIOS.find((candidate) => candidate.species === 'canine');
if (!patient) throw new Error('Nenhum cenário canino disponível para validação.');

const gateway = createPhysiologyGateway();
gateway.httpServer.listen(0, '127.0.0.1');
await once(gateway.httpServer, 'listening');
const address = gateway.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Não foi possível abrir a porta de validação.');

const socket = new WebSocket(`ws://127.0.0.1:${address.port}/physiology`);
const messages: PhysiologyServerMessage[] = [];
socket.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as PhysiologyServerMessage));
await once(socket, 'open');

const waitFor = async <T extends PhysiologyServerMessage>(
  predicate: (message: PhysiologyServerMessage) => message is T,
  timeoutMs: number
): Promise<T> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const index = messages.findIndex(predicate);
    if (index >= 0) return messages.splice(index, 1)[0] as T;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Tempo limite de ${timeoutMs} ms excedido aguardando o worker canino.`);
};

const baseEquipment: PhysiologyStepInputs['equipment'] = {
  oxygenFlowLMin: 0,
  nitrousOxideFlowLMin: 0,
  vaporizerType: 'isoflurane',
  vaporizerDialPct: 0,
  isVaporizerOn: false,
  intubationStatus: 'unintubated',
  tubeSizeMm: 8,
  cuffPressureCmH2O: 0,
  ventilatorMode: 'spontaneous',
  isVentilatorActive: false,
  ventilatorSettings: {
    rateBpm: 12,
    tidalVolumeMl: patient.weightKg * 10,
    peepCmH2O: 0,
    ieRatio: '1:2',
    pipPressureLimitCmH2O: 18,
    inspiratoryPausePct: 10,
  },
  circuitType: 'circle_rebreathing_adult',
  activeFluidType: 'Ringer com lactato',
  totalFluidsInfusedMl: 0,
  fluidRateMlPerHour: 0,
  isFluidPumpRunning: false,
};

let simulationTimeSeconds = 0;
let requestSequence = 0;
const advance = async (
  deltaTimeSeconds: number,
  overrides: Partial<PhysiologyStepInputs> = {}
): Promise<PhysiologySnapshot> => {
  simulationTimeSeconds += deltaTimeSeconds;
  requestSequence += 1;
  const requestId = `validation-action-${requestSequence}`;
  const inputs: PhysiologyStepInputs = {
    simulationTimeSeconds,
    activeDrugs: [],
    equipment: baseEquipment,
    surgicalStimulus: 0,
    ...overrides,
  };
  socket.send(JSON.stringify({
    type: 'advance',
    protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
    requestId,
    deltaTimeSeconds,
    inputs,
  }));
  const response = await waitFor(
    (message): message is Extract<PhysiologyServerMessage, { type: 'snapshot' | 'error' }> =>
      (message.type === 'snapshot' || message.type === 'error') && message.requestId === requestId,
    180_000
  );
  if (response.type === 'error') throw new Error(response.messagePt);
  return response.snapshot;
};

const substance = (snapshot: PhysiologySnapshot, name: string) =>
  snapshot.substances.find((item) => item.substanceId === name);
const domainApplied = (snapshot: PhysiologySnapshot, domain: string) =>
  snapshot.integration?.appliedDomains.includes(domain) === true;

try {
  const status = await waitFor(
    (message): message is Extract<PhysiologyServerMessage, { type: 'status' }> => message.type === 'status',
    5_000
  );
  if (!status.nativeWorkerAvailable) {
    throw new Error('Worker Pulse canino não encontrado. Execute scripts/build-pulse-canino.ps1 primeiro.');
  }

  const configuration = createCaninePatientConfiguration(patient);
  socket.send(JSON.stringify({
    type: 'initialize',
    protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
    requestId: 'validation-actions-init',
    requestedMode: 'shadow',
    patient: configuration,
  }));
  const initialization = await waitFor(
    (message): message is Extract<PhysiologyServerMessage, { type: 'ack' | 'error' }> =>
      (message.type === 'ack' || message.type === 'error') && message.requestId === 'validation-actions-init',
    300_000
  );
  if (initialization.type === 'error') throw new Error(initialization.messagePt);

  const baseline = await advance(60);
  const stressed = await advance(60, {
    surgicalStimulus: 0.8,
    surgicalProcedure: { id: 'incision-skin', name: 'Incisão cutânea', tissueLayer: 'pele' },
  });
  const postStress = await advance(120);

  const ventilatorEquipment: PhysiologyStepInputs['equipment'] = {
    ...baseEquipment,
    oxygenFlowLMin: 2,
    intubationStatus: 'intubated_tracheal',
    cuffPressureCmH2O: 25,
    ventilatorMode: 'cmv_volume',
    isVentilatorActive: true,
    ventilatorSettings: {
      ...baseEquipment.ventilatorSettings,
      rateBpm: 12,
      tidalVolumeMl: patient.weightKg * 10,
      peepCmH2O: 5,
    },
  };
  const ventilated = await advance(90, { equipment: ventilatorEquipment });

  const propofolMassMg = patient.weightKg * 4;
  const propofolDose: PhysiologyStepInputs['activeDrugs'][number] = {
    id: 'validation-propofol-bolus',
    drugId: 'propofol',
    drugName: 'Propofol',
    route: 'IV',
    dosePerKg: 4,
    currentCp: 0,
    currentCe: 0,
    isCRI: false,
    criRatePerKgMin: 0,
    isInfusionRunning: false,
    nativeAction: {
      status: 'native',
      pulseSubstance: 'Propofol',
      mode: 'bolus',
      route: 'IV',
      totalMassMg: propofolMassMg,
      solutionVolumeMl: propofolMassMg / 10,
      concentrationMgMl: 10,
      administrationDurationSeconds: 10,
    },
  };
  const propofolPeak = await advance(30, {
    equipment: ventilatorEquipment,
    activeDrugs: [propofolDose],
  });
  const propofolWashout = await advance(300, { equipment: ventilatorEquipment });

  // 10 µg/kg/h is represented dimensionally as a 0.05 mg/mL solution.
  const fentanylMassRateMgHour = patient.weightKg * 10 / 1000;
  const fentanylInfusion: PhysiologyStepInputs['activeDrugs'][number] = {
    id: 'validation-fentanyl-cri',
    drugId: 'fentanyl',
    drugName: 'Fentanil',
    route: 'CRI',
    dosePerKg: 10,
    currentCp: 0,
    currentCe: 0,
    isCRI: true,
    criRatePerKgMin: 10 / 60,
    isInfusionRunning: true,
    nativeAction: {
      status: 'native',
      pulseSubstance: 'Fentanyl',
      mode: 'infusion',
      route: 'CRI',
      concentrationMgMl: 0.05,
      infusionRateMlPerMin: fentanylMassRateMgHour / 0.05 / 60,
      infusionRunning: true,
    },
  };
  const fentanylRunning = await advance(300, {
    equipment: ventilatorEquipment,
    activeDrugs: [fentanylInfusion],
  });
  const fentanylWashout = await advance(600, { equipment: ventilatorEquipment });

  const dexmedetomidineDose: PhysiologyStepInputs['activeDrugs'][number] = {
    id: 'validation-dexmedetomidine',
    drugId: 'dexmedetomidine',
    drugName: 'Dexmedetomidina',
    route: 'IV',
    dosePerKg: 5,
    currentCp: 0.8,
    currentCe: 0.8,
    isCRI: false,
    criRatePerKgMin: 0,
    isInfusionRunning: false,
    nativeAction: {
      status: 'hybrid',
      reasonPt: 'Farmacocinética e mecanismos veterinários acoplados aos circuitos Pulse pela ponte híbrida.',
    },
  };
  const hybridStep = await advance(60, {
    equipment: ventilatorEquipment,
    activeDrugs: [dexmedetomidineDose],
    hybridPharmacology: {
      modelVersion: 'sp-vet-cellular-pd-1.0.0',
      activeDrugIds: ['dexmedetomidine'],
      modifiers: {
        heartRateFraction: -0.35,
        meanBloodPressureFraction: 0.15,
        respirationRateFraction: -0.20,
        tidalVolumeFraction: -0.10,
        sedationDelta: 0.85,
        neuromuscularBlockDelta: 0,
        bronchodilationDelta: 0,
        nociceptiveInhibition: 0.60,
      },
    },
  });

  const unsupportedEquipment: PhysiologyStepInputs['equipment'] = {
    ...ventilatorEquipment,
    isVaporizerOn: true,
    vaporizerDialPct: 1.5,
  };
  const unsupported = await advance(1, {
    equipment: unsupportedEquipment,
    activeDrugs: [{
      id: 'validation-unsupported-molecule',
      drugId: 'unsupported_molecule',
      drugName: 'Molécula Sem Suporte',
      route: 'IV',
      dosePerKg: 0.03,
      currentCp: 0,
      currentCe: 0,
      isCRI: false,
      criRatePerKgMin: 0,
      isInfusionRunning: false,
      nativeAction: {
        status: 'unsupported',
        reasonPt: 'Substância sem modelo nativo nem equivalente veterinário no pacote Pulse.',
      },
    }],
  });

  const propofolAtPeak = substance(propofolPeak, 'Propofol');
  const propofolAfterWashout = substance(propofolWashout, 'Propofol');
  const fentanylOnPump = substance(fentanylRunning, 'Fentanyl');
  const fentanylAfterStop = substance(fentanylWashout, 'Fentanyl');
  const heartRateStressDelta = stressed.cardiovascular.heartRate.value
    - baseline.cardiovascular.heartRate.value;
  const mapStressDelta = stressed.cardiovascular.meanArterialPressure.value
    - baseline.cardiovascular.meanArterialPressure.value;

  const checks = [
    {
      id: 'surgical_stress_reaches_native_feedback',
      passed: domainApplied(stressed, 'estresse_nociceptivo_substituto')
        && (Math.abs(heartRateStressDelta) > 0.25 || Math.abs(mapStressDelta) > 0.25),
      actual: {
        heartRateDeltaPerMin: heartRateStressDelta,
        mapDeltaMmHg: mapStressDelta,
        events: stressed.events.map((event) => event.id),
      },
    },
    {
      id: 'stress_removal_remains_finite',
      passed: Number.isFinite(postStress.cardiovascular.heartRate.value)
        && Number.isFinite(postStress.cardiovascular.meanArterialPressure.value),
      actual: {
        heartRate: postStress.cardiovascular.heartRate.value,
        meanArterialPressure: postStress.cardiovascular.meanArterialPressure.value,
      },
    },
    {
      id: 'ventilator_controls_native_respiration',
      passed: domainApplied(ventilated, 'ventilacao_mecanica')
        && Math.abs(ventilated.respiratory.respirationRate.value - 12) <= 2
        && ventilated.respiratory.arterialPaO2.value > postStress.respiratory.arterialPaO2.value,
      actual: {
        respirationRate: ventilated.respiratory.respirationRate.value,
        tidalVolumeMl: ventilated.respiratory.tidalVolume.value,
        paO2Before: postStress.respiratory.arterialPaO2.value,
        paO2After: ventilated.respiratory.arterialPaO2.value,
      },
    },
    {
      id: 'propofol_enters_and_leaves_circulation',
      passed: domainApplied(propofolPeak, 'farmacologia_nativa')
        && (propofolAtPeak?.amountInBody?.value || 0) > 0
        && (propofolAtPeak?.amountInBody?.value || Number.POSITIVE_INFINITY) <= propofolMassMg * 1.001
        && (propofolAtPeak?.plasmaTotal.value || 0) > (propofolAfterWashout?.plasmaTotal.value || 0),
      actual: {
        administeredMassMg: propofolMassMg,
        peakPlasmaUgMl: propofolAtPeak?.plasmaTotal.value,
        washoutPlasmaUgMl: propofolAfterWashout?.plasmaTotal.value,
        peakMassMg: propofolAtPeak?.amountInBody?.value,
        washoutMassMg: propofolAfterWashout?.amountInBody?.value,
        mapBefore: ventilated.cardiovascular.meanArterialPressure.value,
        mapAfter: propofolPeak.cardiovascular.meanArterialPressure.value,
      },
    },
    {
      id: 'fentanyl_cri_starts_stops_and_washes_out',
      passed: domainApplied(fentanylRunning, 'farmacologia_nativa')
        && (fentanylOnPump?.plasmaTotal.value || 0) > 0
        && (fentanylOnPump?.plasmaTotal.value || 0) > (fentanylAfterStop?.plasmaTotal.value || 0),
      actual: {
        runningPlasmaUgMl: fentanylOnPump?.plasmaTotal.value,
        stoppedPlasmaUgMl: fentanylAfterStop?.plasmaTotal.value,
        runningMassMg: fentanylOnPump?.amountInBody?.value,
        stoppedMassMg: fentanylAfterStop?.amountInBody?.value,
      },
    },
    {
      id: 'hybrid_veterinary_pd_couples_to_pulse',
      passed: domainApplied(hybridStep, 'farmacodinamica_veterinaria_hibrida')
        && hybridStep.integration?.pharmacologyCoverage?.some((c) => c.drugId === 'dexmedetomidine' && c.mode === 'hybrid_veterinary_pd') === true
        && hybridStep.cardiovascular.heartRate.value < fentanylWashout.cardiovascular.heartRate.value,
      actual: {
        heartRateBefore: fentanylWashout.cardiovascular.heartRate.value,
        heartRateWithDex: hybridStep.cardiovascular.heartRate.value,
        coverage: hybridStep.integration?.pharmacologyCoverage,
        appliedDomains: hybridStep.integration?.appliedDomains,
      },
    },
    {
      id: 'unsupported_inputs_are_explicit',
      passed: unsupported.integration?.unsupportedInputs.some((item) => item.id === 'drug-validation-unsupported-molecule') === true
        && unsupported.integration?.unsupportedInputs.some((item) => item.id === 'volatile-isoflurane') === true,
      actual: unsupported.integration?.unsupportedInputs,
    },
  ];

  const report = {
    modelId: unsupported.modelId,
    protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
    executionMode: unsupported.executionMode,
    scope: 'verificação dinâmica de integração; não constitui validação clínica',
    simulatedDurationSeconds: simulationTimeSeconds,
    checks,
    passed: checks.every((check) => check.passed),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  socket.close();
  await once(socket, 'close');
  await new Promise<void>((resolve) => gateway.webSocketServer.close(() => resolve()));
  await new Promise<void>((resolve) => gateway.httpServer.close(() => resolve()));
}
