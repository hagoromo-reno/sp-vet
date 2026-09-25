import type {
  ActiveDrugDose,
  AnesthesiaEquipmentState,
  PatientProfile,
  VitalSigns,
} from '../types/simulator';

export const PHYSIOLOGY_PROTOCOL_VERSION = '1.2.0' as const;
export const CANINE_MODEL_ID = 'canine-adult-whole-body-alpha' as const;

export type PhysiologyExecutionMode = 'shadow' | 'authoritative';
export type ValidationGrade =
  | 'not_validated'
  | 'structurally_verified'
  | 'calibrated'
  | 'externally_validated';

export interface Quantity {
  value: number;
  unit: string;
}

export interface ParameterProvenance {
  parameter: string;
  source: string;
  sourceType: 'primary_study' | 'guideline' | 'derived' | 'assumption';
  uncertainty: 'low' | 'medium' | 'high';
  note?: string;
}

export interface CaninePatientConfiguration {
  id: string;
  name: string;
  species: 'canine';
  sex: 'male' | 'female' | 'unknown';
  ageYears: number;
  weightKg: number;
  asaStatus: PatientProfile['asa'];
  bodyConditionScore9?: number;
  conformation?: 'mesocephalic' | 'brachycephalic' | 'dolichocephalic';
  targets: {
    heartRatePerMin: number;
    respirationRatePerMin: number;
    systolicPressureMmHg: number;
    diastolicPressureMmHg: number;
    meanArterialPressureMmHg: number;
    temperatureC: number;
    arterialPh: number;
    arterialPaCO2MmHg: number;
    arterialPaO2MmHg: number;
    bloodVolumeMl: number;
  };
}

export interface PhysiologyStepInputs {
  simulationTimeSeconds: number;
  localPrediction?: Pick<
    VitalSigns,
    | 'heartRate'
    | 'systolicBP'
    | 'diastolicBP'
    | 'meanArterialPressure'
    | 'respiratoryRate'
    | 'pulseOximetrySpO2'
    | 'etCO2'
    | 'bodyTemperatureC'
  >;
  activeDrugs: Array<Pick<
    ActiveDrugDose,
    | 'id'
    | 'drugId'
    | 'route'
    | 'dosePerKg'
    | 'currentCp'
    | 'currentCe'
    | 'isCRI'
    | 'criRatePerKgMin'
    | 'isInfusionRunning'
  > & {
    drugName: string;
    nativeAction: PulseDrugActionInput;
  }>;
  equipment: Pick<
    AnesthesiaEquipmentState,
    | 'oxygenFlowLMin'
    | 'nitrousOxideFlowLMin'
    | 'vaporizerType'
    | 'vaporizerDialPct'
    | 'isVaporizerOn'
    | 'intubationStatus'
    | 'tubeSizeMm'
    | 'cuffPressureCmH2O'
    | 'ventilatorMode'
    | 'isVentilatorActive'
    | 'ventilatorSettings'
    | 'circuitType'
    | 'activeFluidType'
    | 'totalFluidsInfusedMl'
    | 'fluidRateMlPerHour'
    | 'isFluidPumpRunning'
  >;
  surgicalStimulus: number;
  surgicalProcedure?: {
    id: string;
    name: string;
    tissueLayer: string;
  };
  hybridPharmacology?: HybridPharmacologyInput;
}

export interface PulseDrugActionInput {
  status: 'native' | 'hybrid' | 'unsupported';
  reasonPt?: string;
  pulseSubstance?: string;
  mode?: 'bolus' | 'infusion';
  route?: ActiveDrugDose['route'];
  totalMassMg?: number;
  solutionVolumeMl?: number;
  concentrationMgMl?: number;
  administrationDurationSeconds?: number;
  infusionRateMlPerMin?: number;
  infusionRunning?: boolean;
}

export interface HybridPharmacologyInput {
  modelVersion: string;
  activeDrugIds: string[];
  modifiers: {
    heartRateFraction: number;
    meanBloodPressureFraction: number;
    respirationRateFraction: number;
    tidalVolumeFraction: number;
    sedationDelta: number;
    neuromuscularBlockDelta: number;
    bronchodilationDelta: number;
    nociceptiveInhibition: number;
  };
}

export type PharmacologyCoverageMode = 'native_pbpk_pd' | 'hybrid_veterinary_pd' | 'unsupported';

export interface PharmacologyCoverageEntry {
  drugId: string;
  drugName: string;
  mode: PharmacologyCoverageMode;
  reasonPt: string;
}

export interface CirculatingSubstanceSnapshot {
  substanceId: string;
  plasmaTotal: Quantity;
  plasmaUnbound?: Quantity;
  effectSite?: Quantity;
  amountInBody?: Quantity;
  hepaticClearanceRate?: Quantity;
  renalClearanceRate?: Quantity;
  tissueConcentrations?: Record<string, Quantity>;
}

export interface PhysiologySnapshot {
  protocolVersion: typeof PHYSIOLOGY_PROTOCOL_VERSION;
  modelId: typeof CANINE_MODEL_ID;
  sequence: number;
  simulationTimeSeconds: number;
  generatedAt: string;
  executionMode: PhysiologyExecutionMode;
  validation: {
    grade: ValidationGrade;
    profileVersion: string;
    passedChecks: string[];
    failedChecks: string[];
  };
  integration?: {
    appliedDomains: string[];
    unsupportedInputs: Array<{ id: string; reasonPt: string }>;
    pharmacologyCoverage?: PharmacologyCoverageEntry[];
    hybridModelVersion?: string;
  };
  cardiovascular: {
    heartRate: Quantity;
    systolicPressure: Quantity;
    diastolicPressure: Quantity;
    meanArterialPressure: Quantity;
    cardiacOutput: Quantity;
    strokeVolume: Quantity;
    systemicVascularResistance: Quantity;
    centralVenousPressure: Quantity;
  };
  respiratory: {
    respirationRate: Quantity;
    tidalVolume: Quantity;
    minuteVentilation: Quantity;
    arterialPaO2: Quantity;
    arterialPaCO2: Quantity;
    arterialPh: Quantity;
    oxygenSaturation: Quantity;
  };
  homeostasis?: {
    metabolic: {
      oxygenConsumptionRate: Quantity;
      carbonDioxideProductionRate: Quantity;
      intracellularFluidPh: Quantity;
    };
    renal?: {
      glomerularFiltrationRate: Quantity;
      renalBloodFlow: Quantity;
    };
    regulatoryFeedback?: {
      baroreceptorHeartRateScale: Quantity;
      baroreceptorResistanceScale: Quantity;
      chemoreceptorHeartRateScale: Quantity;
    };
  };
  substances: CirculatingSubstanceSnapshot[];
  events: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    messagePt: string;
  }>;
}

interface MessageBase {
  protocolVersion: typeof PHYSIOLOGY_PROTOCOL_VERSION;
  requestId: string;
}

export type PhysiologyClientMessage =
  | (MessageBase & {
      type: 'initialize';
      requestedMode: PhysiologyExecutionMode;
      patient: CaninePatientConfiguration;
    })
  | (MessageBase & {
      type: 'advance';
      deltaTimeSeconds: number;
      inputs: PhysiologyStepInputs;
    })
  | (MessageBase & { type: 'reset' })
  | (MessageBase & { type: 'ping' });

export type PhysiologyServerMessage =
  | {
      type: 'status';
      protocolVersion: typeof PHYSIOLOGY_PROTOCOL_VERSION;
      connected: boolean;
      nativeWorkerAvailable: boolean;
      modelId: typeof CANINE_MODEL_ID;
      executionMode: PhysiologyExecutionMode;
      validationGrade: ValidationGrade;
      messagePt: string;
    }
  | {
      type: 'ack';
      protocolVersion: typeof PHYSIOLOGY_PROTOCOL_VERSION;
      requestId: string;
    }
  | {
      type: 'snapshot';
      protocolVersion: typeof PHYSIOLOGY_PROTOCOL_VERSION;
      requestId: string;
      snapshot: PhysiologySnapshot;
    }
  | {
      type: 'error';
      protocolVersion: typeof PHYSIOLOGY_PROTOCOL_VERSION;
      requestId?: string;
      code: string;
      messagePt: string;
    }
  | {
      type: 'pong';
      protocolVersion: typeof PHYSIOLOGY_PROTOCOL_VERSION;
      requestId: string;
    };

export const isPhysiologyClientMessage = (value: unknown): value is PhysiologyClientMessage => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PhysiologyClientMessage>;
  if (candidate.protocolVersion !== PHYSIOLOGY_PROTOCOL_VERSION) return false;
  if (typeof candidate.requestId !== 'string' || candidate.requestId.length === 0) return false;
  if (candidate.type === 'reset' || candidate.type === 'ping') return true;
  if (candidate.type === 'initialize') {
    const patient = candidate.patient;
    return (candidate.requestedMode === 'shadow' || candidate.requestedMode === 'authoritative')
      && patient?.species === 'canine'
      && typeof patient.id === 'string'
      && Number.isFinite(patient.weightKg)
      && patient.weightKg > 0
      && !!patient.targets
      && Number.isFinite(patient.targets.heartRatePerMin)
      && Number.isFinite(patient.targets.meanArterialPressureMmHg)
      && Number.isFinite(patient.targets.bloodVolumeMl);
  }
  if (candidate.type === 'advance') {
    return Number.isFinite(candidate.deltaTimeSeconds)
      && (candidate.deltaTimeSeconds ?? 0) > 0
      && !!candidate.inputs
      && Number.isFinite(candidate.inputs.simulationTimeSeconds)
      && Array.isArray(candidate.inputs.activeDrugs)
      && !!candidate.inputs.equipment
      && Number.isFinite(candidate.inputs.surgicalStimulus);
  }
  return false;
};

export const canSnapshotDriveMonitor = (snapshot: PhysiologySnapshot): boolean =>
  snapshot.executionMode === 'authoritative'
  && snapshot.validation.grade === 'externally_validated'
  && snapshot.validation.failedChecks.length === 0;
