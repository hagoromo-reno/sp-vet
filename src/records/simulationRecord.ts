import type { ActiveDrugDose, ActiveNociceptiveTest, ActiveSurgicalProcedure, AnesthesiaEquipmentState, LogEntry, MonitorAlarmLimits, PatientProfile, ResuscitationState, VitalSigns } from '../types/simulator';
import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import { SPECIES_DATABASE } from '../data/speciesData';
import { SPECIES_CELLULAR_CONFIGS } from '../engine/speciesPhysiology';

export const RECORD_VERSION = 1;
export const MODEL_VERSION = 'veterinary-2026.09-feedback-1';
export const SPECIES_CODES = { canine: 'CAN', feline: 'FEL', bovine: 'BOV', equine: 'EQUI' } as const;
export const clone = <T,>(value: T): T => structuredClone(value);
export type Observation = {
  simTimeSeconds: number;
  vitals: VitalSigns;
  equipment: AnesthesiaEquipmentState;
  doses: ActiveDrugDose[];
  resuscitation: ResuscitationState;
  surgical: ActiveSurgicalProcedure | null;
  nociceptive: ActiveNociceptiveTest | null;
  paused: boolean;
  speed: number;
  monitor: {
    continuousBP: boolean;
    nibp: { sys: number; dia: number; map: number; timestampSimSec: number } | null;
    measuring: boolean;
    autoIntervalMin: number;
    alarmLimits: MonitorAlarmLimits;
  };
};
export type Snapshot = Observation & { id: string; recordedAt: string; kind: 'baseline' | 'minute' | 'final'; scheduledSimTimeSeconds: number };
export type AuditEvent = {
  id: string; sequence: number; simTimeSeconds: number; recordedAt: string;
  kind: 'action' | 'outcome' | 'log' | 'lifecycle' | 'gap';
  message: string; data?: unknown;
  before?: VitalSigns; after?: VitalSigns;
  /** Temporal association only; does not establish clinical causation. */
  precedingActionIds: string[];
};
export const METRICS = {
  hr: { label: 'FC', unit: 'bpm', read: (v: VitalSigns) => v.heartRate },
  map: { label: 'PAM', unit: 'mmHg', read: (v: VitalSigns) => v.meanArterialPressure },
  sysBP: { label: 'PAS', unit: 'mmHg', read: (v: VitalSigns) => v.systolicBP },
  diaBP: { label: 'PAD', unit: 'mmHg', read: (v: VitalSigns) => v.diastolicBP },
  spo2: { label: 'SpO₂', unit: '%', read: (v: VitalSigns) => v.pulseOximetrySpO2 },
  etco2: { label: 'EtCO₂', unit: 'mmHg', read: (v: VitalSigns) => v.etCO2 },
  rr: { label: 'FR', unit: 'rpm', read: (v: VitalSigns) => v.respiratoryRate },
  temp: { label: 'Temperatura', unit: '°C', read: (v: VitalSigns) => v.bodyTemperatureC },
  ph: { label: 'pH', unit: '', read: (v: VitalSigns) => v.arterialBloodGases.pH },
  paco2: { label: 'PaCO₂', unit: 'mmHg', read: (v: VitalSigns) => v.arterialBloodGases.paCO2 },
  pao2: { label: 'PaO₂', unit: 'mmHg', read: (v: VitalSigns) => v.arterialBloodGases.paO2 },
  lactate: { label: 'Lactato', unit: 'mmol/L', read: (v: VitalSigns) => v.arterialBloodGases.lactate },
  potassium: { label: 'Potássio', unit: 'mEq/L', read: (v: VitalSigns) => v.arterialBloodGases.potassium },
  hct: { label: 'Hematócrito', unit: '%', read: (v: VitalSigns) => v.arterialBloodGases.hematocritPct },
  glucose: { label: 'Glicemia', unit: 'mg/dL', read: (v: VitalSigns) => v.arterialBloodGases.glucoseMgDl },
  depth: { label: 'Profundidade', unit: 'índice', read: (v: VitalSigns) => v.anestheticDepthScore },
  consciousness: { label: 'Consciência', unit: '%', read: (v: VitalSigns) => v.consciousnessScore },
  pain: { label: 'Dor', unit: 'escore', read: (v: VitalSigns) => v.painScore },
  cardiacOutput: { label: 'Débito cardíaco', unit: 'L/min', read: (v: VitalSigns) => v.cellularState.cardiacOutputLMin },
  tidalVolume: { label: 'Volume corrente', unit: 'mL', read: (v: VitalSigns) => v.tidalVolumeMl },
  minuteVolume: { label: 'Volume minuto', unit: 'L/min', read: (v: VitalSigns) => v.minuteVolumeL },
  fico2: { label: 'FiCO₂', unit: 'mmHg', read: (v: VitalSigns) => v.fiCO2 },
  bicarbonate: { label: 'Bicarbonato', unit: 'mEq/L', read: (v: VitalSigns) => v.arterialBloodGases.bicarbonate },
  activity: { label: 'Atividade', unit: '%', read: (v: VitalSigns) => v.activityLevelPct },
  tolerance: { label: 'Tolerância cirúrgica', unit: '%', read: (v: VitalSigns) => v.surgicalTolerancePct },
  tof: { label: 'TOF', unit: 'respostas', read: (v: VitalSigns) => v.trainOfFourCount },
  perfusion: { label: 'Índice de perfusão', unit: '%', read: (v: VitalSigns) => v.perfusionIndex },
  shunt: { label: 'Shunt pulmonar', unit: '%', read: (v: VitalSigns) => v.cellularState.pulmonaryShuntFractionPct },
} as const;
export type Metric = keyof typeof METRICS;
export type ExpectedRange = { metric: Metric; min: number; max: number };
export type ExpertReview = {
  id: string; runId: string; snapshotId: string; createdAt: string;
  reviewer: string; qualification: string; verdict: 'plausible' | 'adjust' | 'uncertain';
  expected: ExpectedRange[]; expectedNarrative: string; rationale: string;
  confidence: 'low' | 'medium' | 'high'; relatedEventId?: string;
  expectedResponseSeconds?: number; supersedes?: string;
};
export type SimulationRun = {
  schemaVersion: number; id: string; startedAt: string; updatedAt: string; endedAt?: string;
  status: 'active' | 'completed' | 'interrupted'; endReason?: string;
  modelVersion: string; buildFingerprint: string; engine: string;
  speciesCode: string; patient: PatientProfile; snapshots: Snapshot[]; events: AuditEvent[];
  configuration?: { species: unknown; cellular: unknown; drugCatalog: typeof VETERINARY_DRUG_DATABASE };
  reviews: ExpertReview[]; lastObservation: Observation;
};

function actionState(o: Observation) {
  const { totalFluidsInfusedMl, currentAirwayPressureCmH2O, ...equipment } = o.equipment;
  // Delivery progress and machine readouts are outcomes, not operator commands.
  const { sodaLimeExhaustionPct, ...settings } = equipment;
  return { equipment: { ...settings, fluidBoluses: settings.fluidBoluses?.map(({ deliveredMl, ...b }) => b) },
    doses: o.doses.map(d => ({ id: d.id, drugId: d.drugId, route: d.route, dosePerKg: d.dosePerKg,
      doseAmount: d.doseAmount, volumeMl: d.volumeMl, deliveryDurationSec: d.deliveryDurationSec,
      administrationSpeed: d.administrationSpeed, administeredAtSimTime: d.administeredAtSimTime,
      isCRI: d.isCRI, isInfusionRunning: d.isInfusionRunning, criRatePerKgMin: d.criRatePerKgMin,
      preparation: d.preparation, criRateMlPerHour: d.criRateMlPerHour })),
    resuscitation: o.resuscitation, surgical: o.surgical, nociceptive: o.nociceptive,
    paused: o.paused, speed: o.speed,
    monitor: { continuousBP: o.monitor.continuousBP, autoIntervalMin: o.monitor.autoIntervalMin, alarmLimits: o.monitor.alarmLimits },
  };
}
function outcomeState(v: VitalSigns) {
  return { rhythm: v.cardiacRhythm, respiratoryPattern: v.respiratoryPattern,
    cardiacArrest: v.isCardiacArrest, respiratoryArrest: v.isRespiratoryArrest, dead: v.isDead,
    warning: v.impendingArrestWarning?.type ?? null,
    interactions: v.activeDrugInteractions.map(i => i.title).sort(),
    activeSignals: v.activePhysiologicalSignals.map(signal => signal.id).sort() };
}

export class SimulationRecorder {
  run: SimulationRun;
  private nextMinute = 60;
  private seenLogs = new Set<string>();
  private clock: () => string;
  constructor(patient: PatientProfile, initial: Observation, clock = () => new Date().toISOString(), buildFingerprint = 'development') {
    this.clock = clock;
    const at = clock();
    this.run = { schemaVersion: RECORD_VERSION, id: crypto.randomUUID(), startedAt: at, updatedAt: at,
      status: 'active', modelVersion: MODEL_VERSION, buildFingerprint, engine: 'local-veterinary-pkpd',
      speciesCode: SPECIES_CODES[patient.species], patient: clone(patient), snapshots: [], events: [], reviews: [], lastObservation: clone(initial) };
    this.run.configuration = clone({ species: SPECIES_DATABASE[patient.species], cellular: SPECIES_CELLULAR_CONFIGS[patient.species], drugCatalog: VETERINARY_DRUG_DATABASE });
    this.snapshot(initial, 'baseline', 0);
    this.event(initial, 'lifecycle', 'Rodada iniciada');
  }
  private event(o: Observation, kind: AuditEvent['kind'], message: string, data?: unknown, before?: VitalSigns) {
    const recent = this.run.events.filter(e => e.kind === 'action' && o.simTimeSeconds >= e.simTimeSeconds && o.simTimeSeconds - e.simTimeSeconds <= 60).map(e => e.id);
    this.run.events.push({ id: crypto.randomUUID(), sequence: this.run.events.length + 1,
      simTimeSeconds: o.simTimeSeconds, recordedAt: this.clock(), kind, message, data: clone(data),
      before: before && clone(before), after: clone(o.vitals), precedingActionIds: recent });
  }
  private snapshot(o: Observation, kind: Snapshot['kind'], scheduledSimTimeSeconds: number) {
    this.run.snapshots.push({ ...clone(o), id: crypto.randomUUID(), recordedAt: this.clock(), kind, scheduledSimTimeSeconds });
  }
  observe(o: Observation) {
    if (this.run.status !== 'active') return;
    const previous = this.run.lastObservation;
    if (!Number.isFinite(o.simTimeSeconds) || o.simTimeSeconds < previous.simTimeSeconds) throw new Error('Relógio regressivo ou inválido: inicie uma nova rodada.');
    const beforeActions = actionState(previous), afterActions = actionState(o);
    if (JSON.stringify(beforeActions) !== JSON.stringify(afterActions)) {
      const changed = Object.keys(afterActions).filter(key => JSON.stringify(beforeActions[key as keyof typeof beforeActions]) !== JSON.stringify(afterActions[key as keyof typeof afterActions]));
      const labels: Record<string, string> = { equipment: 'equipamento', doses: 'administrações', resuscitation: 'ressuscitação', surgical: 'estímulo cirúrgico', nociceptive: 'teste nociceptivo', paused: 'pausa', speed: 'velocidade', monitor: 'monitorização' };
      this.event(o, 'action', `Alteração de estado: ${changed.map(key => labels[key]).join(', ')}`, { before: beforeActions, after: afterActions }, previous.vitals);
    }
    const beforeOutcome = outcomeState(previous.vitals), afterOutcome = outcomeState(o.vitals);
    if (JSON.stringify(beforeOutcome) !== JSON.stringify(afterOutcome)) this.event(o, 'outcome', 'Transição fisiológica', { before: beforeOutcome, after: afterOutcome }, previous.vitals);
    if (o.simTimeSeconds + 1e-7 >= this.nextMinute) {
      // Never invent intermediate readings when a caller skips a minute.
      const boundary = Math.floor((o.simTimeSeconds + 1e-7) / 60) * 60;
      if (boundary > this.nextMinute) this.event(o, 'gap', 'Lacuna de amostragem', { from: this.nextMinute, to: boundary - 60 });
      this.snapshot(o, 'minute', boundary);
      this.nextMinute = boundary + 60;
    }
    this.run.lastObservation = clone(o);
    this.run.updatedAt = this.clock();
    if (o.vitals.isDead) this.finish('Óbito');
  }
  ingestLogs(logs: LogEntry[]) {
    for (const log of logs) {
      const key = JSON.stringify(log);
      if (this.seenLogs.has(key)) continue;
      this.seenLogs.add(key);
      this.event({ ...this.run.lastObservation, simTimeSeconds: log.simTimeSeconds }, 'log', log.message, log);
    }
  }
  finish(reason: string) {
    if (this.run.status !== 'active') return;
    this.snapshot(this.run.lastObservation, 'final', this.run.lastObservation.simTimeSeconds);
    this.event(this.run.lastObservation, 'lifecycle', reason);
    this.run.status = 'completed';
    this.run.endReason = reason;
    this.run.endedAt = this.run.updatedAt = this.clock();
  }
}

export function validateReview(run: SimulationRun, review: ExpertReview): void {
  if (review.runId !== run.id || !run.snapshots.some(s => s.id === review.snapshotId)) throw new Error('Parecer não pertence a este ponto da rodada.');
  if (![review.reviewer, review.qualification, review.rationale, review.expectedNarrative].every(value => typeof value === 'string' && value.trim())) throw new Error('Preencha autoria, qualificação, resposta esperada e justificativa.');
  if (!['plausible', 'adjust', 'uncertain'].includes(review.verdict) || !['low', 'medium', 'high'].includes(review.confidence)) throw new Error('Classificação inválida.');
  const metrics = new Set<string>();
  for (const range of review.expected) {
    if (!Object.hasOwn(METRICS, range.metric) || metrics.has(range.metric) || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max) throw new Error('Faixas esperadas inválidas ou duplicadas.');
    metrics.add(range.metric);
  }
  if (review.expectedResponseSeconds !== undefined && (!Number.isFinite(review.expectedResponseSeconds) || review.expectedResponseSeconds < 0)) throw new Error('Tempo de resposta inválido.');
  if (review.expectedResponseSeconds !== undefined && !review.relatedEventId) throw new Error('Associe o tempo de resposta a um evento.');
  if (review.relatedEventId && !run.events.some(e => e.id === review.relatedEventId && e.simTimeSeconds <= run.snapshots.find(s => s.id === review.snapshotId)!.simTimeSeconds)) throw new Error('Evento inexistente ou posterior à avaliação.');
  if (review.supersedes && (review.supersedes === review.id || !run.reviews.some(r => r.id === review.supersedes && r.reviewer === review.reviewer && r.snapshotId === review.snapshotId))) throw new Error('Revisão anterior incompatível.');
}
export function currentReviews(run: SimulationRun): ExpertReview[] {
  const replaced = new Set(run.reviews.map(r => r.supersedes).filter(Boolean));
  return run.reviews.filter(r => !replaced.has(r.id));
}
export function compareReview(run: SimulationRun, review: ExpertReview) {
  const snapshot = run.snapshots.find(s => s.id === review.snapshotId)!;
  return review.expected.map(range => {
    const observed = METRICS[range.metric].read(snapshot.vitals);
    return { ...range, observed, unit: METRICS[range.metric].unit,
      deviation: observed < range.min ? observed - range.min : observed > range.max ? observed - range.max : 0 };
  });
}
export function exportRefinementRows(run: SimulationRun): string {
  return currentReviews(run).map(review => {
    const snapshot = run.snapshots.find(s => s.id === review.snapshotId)!;
    return JSON.stringify({ schemaVersion: RECORD_VERSION, runId: run.id, patient: run.patient,
      modelVersion: run.modelVersion, buildFingerprint: run.buildFingerprint, engine: run.engine,
      configuration: run.configuration, snapshot, events: run.events.filter(e => e.simTimeSeconds <= snapshot.simTimeSeconds),
      review, comparison: compareReview(run, review), labelStatus: 'expert_opinion_not_adjudicated' });
  }).join('\n');
}
