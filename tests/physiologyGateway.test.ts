import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { WebSocket } from 'ws';
import { createPhysiologyGateway } from '../server/physiology-gateway';
import { CanineReferenceDriver } from '../server/canineReferenceDriver';
import { PRESET_SCENARIOS } from '../src/data/scenarios';
import {
  CANINE_REFERENCE,
  createCaninePatientConfiguration,
  evaluateCanineRestingReference,
} from '../src/physiology/canineReferenceModel';
import {
  PHYSIOLOGY_PROTOCOL_VERSION,
  canSnapshotDriveMonitor,
  isPhysiologyClientMessage,
  type PhysiologyServerMessage,
  type PhysiologyStepInputs,
} from '../src/physiology/protocol';
import { mapDoseToPulseAction, PULSE_SUBSTANCE_BY_DRUG_ID } from '../src/physiology/pulseActionMapping';
import {
  buildHybridPharmacologyInput,
  buildPharmacologyCoverage,
  PULSE_HYBRID_MODEL_VERSION,
} from '../src/physiology/pulseHybridBridge';
import { createDefaultEquipment, createSimulationState } from '../src/validation/simulationHarness';
import type { ActiveDrugDose } from '../src/types/simulator';

const caninePatient = PRESET_SCENARIOS.find((patient) => patient.species === 'canine');
if (!caninePatient) throw new Error('Os cenários precisam conter ao menos um paciente canino.');

const stepInputs: PhysiologyStepInputs = {
  simulationTimeSeconds: 0.1,
  localPrediction: {
    heartRate: 87,
    systolicBP: 120,
    diastolicBP: 75,
    meanArterialPressure: 90,
    respiratoryRate: 18,
    pulseOximetrySpO2: 98,
    etCO2: 40,
    bodyTemperatureC: 38.4,
  },
  activeDrugs: [],
  equipment: {
    oxygenFlowLMin: 1.5,
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
      rateBpm: 18,
      tidalVolumeMl: 240,
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
  },
  surgicalStimulus: 0,
};

test('perfil canino preserva espécie, unidades e referência basal rastreável', () => {
  const manifest = JSON.parse(readFileSync(
    new URL('../models/canine-adult-alpha/profile.json', import.meta.url),
    'utf8'
  )) as {
    modelId: string;
    profileVersion: string;
    cardiovascular: { cardiacOutputMlMinKg: number };
    explicitAssumptionsPendingPrimaryValidation: string[];
  };
  assert.equal(manifest.modelId, CANINE_REFERENCE.modelId);
  assert.equal(manifest.profileVersion, CANINE_REFERENCE.version);
  assert.equal(
    manifest.cardiovascular.cardiacOutputMlMinKg,
    CANINE_REFERENCE.cardiovascular.cardiacOutputMlKgMin.mean
  );
  assert.ok(manifest.explicitAssumptionsPendingPrimaryValidation.length > 0);

  const configured = createCaninePatientConfiguration(caninePatient);
  assert.equal(configured.species, 'canine');
  assert.equal(configured.sex, 'female');
  assert.equal(configured.weightKg, caninePatient.weightKg);
  assert.ok(configured.targets.bloodVolumeMl > 0);

  const checks = evaluateCanineRestingReference({
    heartRatePerMin: CANINE_REFERENCE.cardiovascular.heartRatePerMin.mean,
    meanArterialPressureMmHg: CANINE_REFERENCE.cardiovascular.meanArterialPressureMmHg.mean,
    cardiacOutputMlKgMin: CANINE_REFERENCE.cardiovascular.cardiacOutputMlKgMin.mean,
    arterialPh: CANINE_REFERENCE.bloodChemistry.arterialPh.mean,
    arterialPaCO2MmHg: CANINE_REFERENCE.bloodChemistry.arterialPaCO2MmHg.mean,
    arterialPaO2MmHg: CANINE_REFERENCE.bloodChemistry.arterialPaO2MmHg.mean,
    oxygenConsumptionMlKgMin: CANINE_REFERENCE.cardiovascular.oxygenConsumptionMlKgMin.mean,
  });
  assert.equal(checks.length, 7);
  assert.ok(checks.every((check) => check.passed));
  assert.ok(checks.every((check) => check.unit.length > 0));
});

test('adaptador farmacológico só produz ações Pulse dimensionais e explicitamente suportadas', () => {
  const propofol = {
    id: 'dose-propofol',
    drugId: 'propofol',
    drugName: 'Propofol',
    category: 'induction' as const,
    route: 'IV' as const,
    administrationSpeed: 'bolus_slow' as const,
    doseAmount: 82,
    dosePerKg: 4,
    volumeMl: 8.2,
    administeredAtSimTime: 0,
    peakEffectSimTime: 60,
    deliveryDurationSec: 60,
    currentCe: 0,
    currentCp: 0,
  };
  const mapped = mapDoseToPulseAction(propofol);
  assert.equal(mapped.status, 'native');
  assert.equal(mapped.pulseSubstance, PULSE_SUBSTANCE_BY_DRUG_ID.propofol);
  assert.equal(mapped.totalMassMg, 82);
  assert.equal(mapped.concentrationMgMl, 10);

  const hybrid = mapDoseToPulseAction({ ...propofol, id: 'dose-ace', drugId: 'acepromazine', drugName: 'Acepromazina' });
  assert.equal(hybrid.status, 'hybrid');
  assert.match(hybrid.reasonPt || '', /ponte híbrida/i);

  const unsupported = mapDoseToPulseAction({ ...propofol, id: 'dose-desconhecido', drugId: 'desconhecido', drugName: 'Desconhecido' });
  assert.equal(unsupported.status, 'unsupported');
  assert.match(unsupported.reasonPt || '', /ausente do catálogo/i);
});

test('ponte híbrida calcula modificadores farmacodinâmicos veterinários e cobertura de catálogo', () => {
  const patient = caninePatient;
  const simState = createSimulationState(patient, createDefaultEquipment(patient));
  const dexDose: ActiveDrugDose = {
    id: 'dose-dex',
    drugId: 'dexmedetomidine',
    drugName: 'Dexmedetomidina',
    category: 'premedication',
    route: 'IV',
    administrationSpeed: 'bolus_slow',
    doseAmount: 142.5,
    dosePerKg: 5,
    volumeMl: 0.285,
    administeredAtSimTime: 10,
    peakEffectSimTime: 60,
    deliveryDurationSec: 60,
    currentCe: 0.8,
    currentCp: 0.8,
  };
  const propofolDose: ActiveDrugDose = {
    id: 'dose-prop',
    drugId: 'propofol',
    drugName: 'Propofol',
    category: 'induction',
    route: 'IV',
    administrationSpeed: 'bolus_slow',
    doseAmount: 114,
    dosePerKg: 4,
    volumeMl: 11.4,
    administeredAtSimTime: 10,
    peakEffectSimTime: 60,
    deliveryDurationSec: 60,
    currentCe: 2.5,
    currentCp: 3.0,
  };

  const coverage = buildPharmacologyCoverage([dexDose, propofolDose]);
  assert.equal(coverage.length, 2);
  assert.equal(coverage.find((c) => c.drugId === 'dexmedetomidine')?.mode, 'hybrid_veterinary_pd');
  assert.equal(coverage.find((c) => c.drugId === 'propofol')?.mode, 'native_pbpk_pd');

  const hybridInput = buildHybridPharmacologyInput(
    patient,
    [dexDose, propofolDose],
    simState.equipment,
    simState.vitals
  );
  assert.equal(hybridInput.modelVersion, PULSE_HYBRID_MODEL_VERSION);
  assert.ok(hybridInput.activeDrugIds.includes('dexmedetomidine'));
  assert.ok(hybridInput.modifiers.heartRateFraction < 0);
  assert.ok(hybridInput.modifiers.sedationDelta > 0);
});

test('saída de referência nunca recebe autoridade sobre o monitor', () => {
  const driver = new CanineReferenceDriver();
  driver.initialize(createCaninePatientConfiguration(caninePatient));
  const snapshot = driver.advance(stepInputs);

  assert.equal(snapshot.executionMode, 'shadow');
  assert.equal(snapshot.validation.grade, 'not_validated');
  assert.equal(canSnapshotDriveMonitor(snapshot), false);
  assert.equal(canSnapshotDriveMonitor({
    ...snapshot,
    executionMode: 'authoritative',
    validation: {
      ...snapshot.validation,
      grade: 'externally_validated',
      failedChecks: [],
    },
  }), true);
});

test('validador rejeita versão incompatível antes de alcançar o motor', () => {
  assert.equal(isPhysiologyClientMessage({
    type: 'ping',
    protocolVersion: '0.9.0',
    requestId: 'incompatível',
  }), false);
  assert.equal(isPhysiologyClientMessage({
    type: 'ping',
    protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
    requestId: 'compatível',
  }), true);
  assert.equal(isPhysiologyClientMessage({
    type: 'advance',
    protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
    requestId: 'sem-inputs',
    deltaTimeSeconds: 0.1,
  }), false);
});

test('gateway WebSocket inicializa uma sessão isolada e devolve snapshot em sombra', async () => {
  const previousWorker = process.env.PULSE_CANINE_WORKER;
  const previousDisableNative = process.env.PULSE_CANINE_DISABLE_NATIVE;
  delete process.env.PULSE_CANINE_WORKER;
  process.env.PULSE_CANINE_DISABLE_NATIVE = '1';
  const { httpServer, webSocketServer } = createPhysiologyGateway();

  try {
    httpServer.listen(0, '127.0.0.1');
    await once(httpServer, 'listening');
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Endereço TCP de teste indisponível.');

    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/physiology`);
    const messages: PhysiologyServerMessage[] = [];
    socket.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as PhysiologyServerMessage));
    await once(socket, 'open');

    socket.send(JSON.stringify({
      type: 'initialize',
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      requestId: 'init-1',
      requestedMode: 'shadow',
      patient: createCaninePatientConfiguration(caninePatient),
    }));
    socket.send(JSON.stringify({
      type: 'advance',
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      requestId: 'step-1',
      deltaTimeSeconds: 0.1,
      inputs: stepInputs,
    }));

    const deadline = Date.now() + 2_000;
    while (!messages.some((message) => message.type === 'snapshot') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const status = messages.find((message) => message.type === 'status');
    const snapshotMessage = messages.find((message) => message.type === 'snapshot');
    assert.ok(status && status.type === 'status');
    assert.equal(status.nativeWorkerAvailable, false);
    assert.ok(snapshotMessage && snapshotMessage.type === 'snapshot');
    assert.equal(snapshotMessage.snapshot.sequence, 1);
    assert.equal(snapshotMessage.snapshot.executionMode, 'shadow');
    assert.ok(Number.isFinite(snapshotMessage.snapshot.homeostasis?.metabolic.oxygenConsumptionRate.value));
    assert.equal(canSnapshotDriveMonitor(snapshotMessage.snapshot), false);

    socket.close();
    await once(socket, 'close');
  } finally {
    await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    if (previousWorker === undefined) delete process.env.PULSE_CANINE_WORKER;
    else process.env.PULSE_CANINE_WORKER = previousWorker;
    if (previousDisableNative === undefined) delete process.env.PULSE_CANINE_DISABLE_NATIVE;
    else process.env.PULSE_CANINE_DISABLE_NATIVE = previousDisableNative;
  }
});
