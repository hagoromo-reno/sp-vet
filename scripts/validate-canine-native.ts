import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createPhysiologyGateway } from '../server/physiology-gateway';
import { PRESET_SCENARIOS } from '../src/data/scenarios';
import {
  createCaninePatientConfiguration,
  evaluateCanineRestingReference,
} from '../src/physiology/canineReferenceModel';
import {
  PHYSIOLOGY_PROTOCOL_VERSION,
  type PhysiologyServerMessage,
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
    requestId: 'validation-init',
    requestedMode: 'shadow',
    patient: configuration,
  }));

  const initialization = await waitFor(
    (message): message is Extract<PhysiologyServerMessage, { type: 'ack' | 'error' }> =>
      (message.type === 'ack' || message.type === 'error') && message.requestId === 'validation-init',
    300_000
  );
  if (initialization.type === 'error') throw new Error(initialization.messagePt);

  const inputs: PhysiologyStepInputs = {
    simulationTimeSeconds: 0,
    activeDrugs: [],
    equipment: {
      oxygenFlowLMin: 0,
      vaporizerType: 'isoflurane',
      vaporizerDialPct: 0,
      isVaporizerOn: false,
      intubationStatus: 'unintubated',
      tubeSizeMm: 8,
      cuffPressureCmH2O: 0,
      ventilatorMode: 'spontaneous',
      isVentilatorActive: false,
      ventilatorSettings: {
        rateBpm: configuration.targets.respirationRatePerMin,
        tidalVolumeMl: patient.weightKg * 11.5,
        peepCmH2O: 0,
        ieRatio: '1:2',
        pipPressureLimitCmH2O: 18,
        inspiratoryPausePct: 10,
      },
    },
    surgicalStimulus: 0,
  };
  const observations: Array<Extract<PhysiologyServerMessage, { type: 'snapshot' }>['snapshot']> = [];
  for (const elapsedSeconds of [60, 120, 180, 240, 300]) {
    inputs.simulationTimeSeconds = elapsedSeconds;
    const requestId = `validation-baseline-${elapsedSeconds}s`;
    socket.send(JSON.stringify({
      type: 'advance',
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      requestId,
      deltaTimeSeconds: 60,
      inputs,
    }));

    const response = await waitFor(
      (message): message is Extract<PhysiologyServerMessage, { type: 'snapshot' | 'error' }> =>
        (message.type === 'snapshot' || message.type === 'error') && message.requestId === requestId,
      180_000
    );
    if (response.type === 'error') throw new Error(response.messagePt);
    observations.push(response.snapshot);
  }

  const measurements = observations.map((snapshot) => {
    const oxygenConsumption = snapshot.homeostasis?.metabolic.oxygenConsumptionRate.value;
    if (!Number.isFinite(oxygenConsumption)) throw new Error('Snapshot não contém consumo de oxigênio finito.');
    return {
      timeSeconds: snapshot.simulationTimeSeconds,
      heartRatePerMin: snapshot.cardiovascular.heartRate.value,
      meanArterialPressureMmHg: snapshot.cardiovascular.meanArterialPressure.value,
      cardiacOutputMlKgMin: snapshot.cardiovascular.cardiacOutput.value * 1000 / patient.weightKg,
      arterialPh: snapshot.respiratory.arterialPh.value,
      arterialPaCO2MmHg: snapshot.respiratory.arterialPaCO2.value,
      arterialPaO2MmHg: snapshot.respiratory.arterialPaO2.value,
      oxygenConsumptionMlKgMin: oxygenConsumption! / patient.weightKg,
    };
  });
  const referenceChecks = measurements.map((measurement) => ({
    timeSeconds: measurement.timeSeconds,
    checks: evaluateCanineRestingReference(measurement),
  }));

  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const relativeDriftPercent = (initial: number, final: number) => Math.abs((final - initial) / initial) * 100;
  // Engineering gates for post-warm-up stationarity. These are not clinical
  // reference intervals; they detect numerical/physiological drift in a
  // nominal resting run and are deliberately reported separately.
  const stabilityChecks = [
    { id: 'heart_rate_drift', actual: relativeDriftPercent(first.heartRatePerMin, last.heartRatePerMin), maximum: 10, unit: '%' },
    { id: 'map_drift', actual: relativeDriftPercent(first.meanArterialPressureMmHg, last.meanArterialPressureMmHg), maximum: 10, unit: '%' },
    { id: 'cardiac_output_drift', actual: relativeDriftPercent(first.cardiacOutputMlKgMin, last.cardiacOutputMlKgMin), maximum: 15, unit: '%' },
    { id: 'arterial_ph_drift', actual: Math.abs(last.arterialPh - first.arterialPh), maximum: 0.05, unit: '1' },
    { id: 'paco2_drift', actual: relativeDriftPercent(first.arterialPaCO2MmHg, last.arterialPaCO2MmHg), maximum: 10, unit: '%' },
    { id: 'pao2_drift', actual: relativeDriftPercent(first.arterialPaO2MmHg, last.arterialPaO2MmHg), maximum: 10, unit: '%' },
    { id: 'oxygen_consumption_drift', actual: relativeDriftPercent(first.oxygenConsumptionMlKgMin, last.oxygenConsumptionMlKgMin), maximum: 15, unit: '%' },
  ].map((check) => ({ ...check, passed: check.actual <= check.maximum }));

  const snapshot = observations[observations.length - 1];
  const allReferenceChecksPassed = referenceChecks.every((observation) =>
    observation.checks.every((check) => check.passed)
  );
  const stabilityPassed = stabilityChecks.every((check) => check.passed);

  const report = {
    modelId: snapshot.modelId,
    profileVersion: snapshot.validation.profileVersion,
    executionMode: snapshot.executionMode,
    nativeValidationGrade: snapshot.validation.grade,
    warmUpSeconds: 1200,
    observationWindowSeconds: snapshot.simulationTimeSeconds,
    measurements,
    referenceChecks,
    stabilityChecks,
    passed: allReferenceChecksPassed && stabilityPassed,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  socket.close();
  await once(socket, 'close');
  await new Promise<void>((resolve) => gateway.webSocketServer.close(() => resolve()));
  await new Promise<void>((resolve) => gateway.httpServer.close(() => resolve()));
}
