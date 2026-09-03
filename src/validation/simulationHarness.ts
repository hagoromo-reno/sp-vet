import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import { SPECIES_DATABASE } from '../data/speciesData';
import { calculateAdministration, getRoutePharmacokinetics, getSpeciesDoseRange } from '../engine/drugAdministration';
import { PKPDEngine } from '../engine/pkpdEngine';
import {
  ActiveDrugDose,
  AdministrationSpeed,
  AnesthesiaEquipmentState,
  DrugRoute,
  PatientProfile,
  ResuscitationState,
  SpeciesType,
  VitalSigns,
} from '../types/simulator';

export type DoseLevel = 'min' | 'typical' | 'max';

export interface SimulationFrame {
  timeSeconds: number;
  vitals: VitalSigns;
  doses: ActiveDrugDose[];
}

export interface SimulationState {
  patient: PatientProfile;
  equipment: AnesthesiaEquipmentState;
  resuscitation: ResuscitationState;
  timeSeconds: number;
  vitals: VitalSigns;
  doses: ActiveDrugDose[];
  frames: SimulationFrame[];
}

export interface TraceMetrics {
  minHeartRate: number;
  maxHeartRate: number;
  minMap: number;
  maxMap: number;
  minRespiratoryRate: number;
  maxRespiratoryRate: number;
  minSpO2: number;
  maxPaCO2: number;
  maxLactate: number;
  maxPotassium: number;
  maxBicarbonate: number;
  maxHematocrit: number;
  maxSedation: number;
  maxHypnosis: number;
  maxDissociation: number;
  maxAnalgesia: number;
  maxMuscleRelaxation: number;
  maxRespiratoryDepression: number;
  maxLocalBlockade: number;
  maxSystemicNaVBlockade: number;
  maxVolumeExpansionProxy: number;
  minTrainOfFour: number;
  minConsciousness: number;
  maxDepth: number;
  peakEffectSiteExposure: number;
  cardiacArrestOccurred: boolean;
  respiratoryArrestOccurred: boolean;
  stages: string[];
}

const VALIDATION_WEIGHTS_KG: Record<SpeciesType, number> = {
  canine: 20,
  feline: 4.5,
  equine: 500,
  bovine: 500,
  rabbit: 2.5,
  avian: 0.5,
};

/** Standardized ASA-I patient used for paired pharmacology experiments. */
export function createHealthyValidationPatient(species: SpeciesType): PatientProfile {
  const profile = SPECIES_DATABASE[species];
  const weightKg = VALIDATION_WEIGHTS_KG[species];
  const normal = profile.normalVitals;
  return {
    id: `validation-${species}`,
    name: `Controle ${profile.namePt}`,
    species,
    breed: 'Paciente padronizado',
    ageYears: species === 'equine' || species === 'bovine' ? 6 : species === 'avian' ? 4 : 3,
    ageMonths: 0,
    weightKg,
    gender: 'Indeterminado',
    asa: 'I',
    scenarioTitle: 'Validação farmacológica controlada',
    scenarioDescription: 'Paciente hígido e padronizado para comparação pareada do motor.',
    clinicalHistory: 'Sem comorbidades modeladas.',
    surgicalProcedure: 'Nenhum procedimento',
    baselineVitals: {
      hr: normal.hrTypical,
      rr: normal.rrTypical,
      sysBP: Math.round((normal.sysBpMin + normal.sysBpMax) / 2),
      diaBP: Math.round((normal.diaBpMin + normal.diaBpMax) / 2),
      map: normal.mapTypical,
      tempC: normal.tempTypicalC,
      spo2: normal.spo2Normal,
      etco2: normal.etco2Typical,
      bloodVolumeMl: weightKg * profile.bloodVolumeMlPerKg,
      hctPct: species === 'equine' || species === 'bovine' ? 35 : 42,
      potassiumMeqL: 4.2,
      lactateMmolL: 1.2,
    },
    pathologyConditions: {},
  };
}

export function createDefaultEquipment(
  patient: PatientProfile,
  overrides: Partial<AnesthesiaEquipmentState> = {}
): AnesthesiaEquipmentState {
  const species = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
  const base: AnesthesiaEquipmentState = {
    oxygenFlowLMin: 1.5,
    nitrousOxideFlowLMin: 0,
    vaporizerType: 'isoflurane',
    vaporizerDialPct: 0,
    isVaporizerOn: false,
    circuitType: 'circle_rebreathing_adult',
    sodaLimeExhaustionPct: 5,
    aplValveState: 'open',
    reservoirBagVolumeMl: 1000,
    isOxygenFlushActive: false,
    intubationStatus: 'unintubated',
    tubeSizeMm: 8.5,
    cuffPressureCmH2O: 0,
    ventilatorMode: 'spontaneous',
    isVentilatorActive: false,
    ventilatorSettings: {
      rateBpm: species.normalVitals.rrTypical,
      tidalVolumeMl: Math.round(patient.weightKg * 12),
      peepCmH2O: 0,
      ieRatio: '1:2',
      pipPressureLimitCmH2O: 18,
      inspiratoryPausePct: 10,
    },
    currentAirwayPressureCmH2O: 0,
    activeFluidType: 'Ringer com Lactato (LRS)',
    fluidRateMlPerHour: 0,
    totalFluidsInfusedMl: 0,
    isFluidPumpRunning: false,
    warmingBlanketActive: false,
    warmingBlanketTempC: 38.5,
  };

  return {
    ...base,
    ...overrides,
    ventilatorSettings: {
      ...base.ventilatorSettings,
      ...(overrides.ventilatorSettings || {}),
    },
  };
}

export function createDefaultResuscitation(): ResuscitationState {
  return {
    isCPRActive: false,
    compressionsPerMin: 110,
    lastCompressionSimTime: 0,
    compressionDepthQuality: 0.8,
    defibrillatorChargedJoules: 0,
    isDefibrillatorArmed: false,
  };
}

export function createSimulationState(
  patient: PatientProfile,
  equipment: AnesthesiaEquipmentState = createDefaultEquipment(patient)
): SimulationState {
  const resuscitation = createDefaultResuscitation();
  const initial = PKPDEngine.stepSimulation(
    0.1,
    0,
    patient,
    [],
    equipment,
    resuscitation,
    false
  );
  return {
    patient,
    equipment: { ...equipment, ...initial.equipmentUpdates },
    resuscitation,
    timeSeconds: 0,
    vitals: initial.vitals,
    doses: [],
    frames: [{ timeSeconds: 0, vitals: initial.vitals, doses: [] }],
  };
}

function preferredRoute(drugId: string, supportedRoutes: DrugRoute[], doseUnit: string): DrugRoute {
  if (doseUnit.endsWith('/min') || doseUnit.endsWith('/h')) return 'CRI';
  if (drugId === 'bupivacaine_05') return 'Local';
  return supportedRoutes[0];
}

export function createActiveDose(
  patient: PatientProfile,
  drugId: string,
  doseLevel: DoseLevel = 'typical',
  options: {
    route?: DrugRoute;
    speed?: AdministrationSpeed;
    administeredAtSimTime?: number;
    dosePerKg?: number;
  } = {}
): ActiveDrugDose {
  const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === drugId);
  if (!drug) throw new Error(`Fármaco não encontrado: ${drugId}`);
  const range = getSpeciesDoseRange(drug, patient.species);
  if (!range) throw new Error(`${drug.name} não possui faixa cadastrada para ${patient.species}`);

  const dosePerKg = options.dosePerKg ?? range[doseLevel];
  const route = options.route || preferredRoute(drug.id, drug.supportedRoutes, drug.doseUnit);
  if (!drug.supportedRoutes.includes(route)) {
    throw new Error(`Via ${route} não suportada para ${drug.name}`);
  }

  const isCRI = route === 'CRI';
  const speed = options.speed || (isCRI ? 'infusion_cri' : route === 'IV_slow' ? 'bolus_slow' : 'bolus_slow');
  const administration = calculateAdministration(drug, dosePerKg, patient.weightKg);
  const routePK = getRoutePharmacokinetics(drug, route);
  const time = options.administeredAtSimTime || 0;
  const deliveryDurationSec = isCRI
    ? 0
    : speed === 'bolus_rapid'
      ? 3
      : route === 'IM' || route === 'SC' || route === 'Local' || route === 'Epidural'
        ? 1
        : 60;

  return {
    id: `${drugId}-${route}-${doseLevel}-${time}`,
    drugId: drug.id,
    drugName: drug.name,
    category: drug.category,
    route,
    administrationSpeed: speed,
    doseAmount: administration.doseAmount,
    dosePerKg,
    volumeMl: administration.volumeMl,
    administeredAtSimTime: time,
    peakEffectSimTime: time + routePK.transitLagSeconds + drug.onsetMinutes * 60,
    deliveryDurationSec,
    deliveryElapsedSec: 0,
    transitLagRemainingSec: routePK.transitLagSeconds,
    isFullyDelivered: false,
    isFastBolusShockTriggered: false,
    isCRI,
    isInfusionRunning: isCRI,
    criRatePerKgMin: isCRI ? dosePerKg : undefined,
    criRateMlPerHour: isCRI ? administration.pumpRateMlPerHour : undefined,
    bolusShockMagnitude: 0,
    bolusShockRemainingSec: 0,
    currentCe: 0,
    currentCp: 0,
  };
}

export function administerDrug(
  state: SimulationState,
  drugId: string,
  doseLevel: DoseLevel = 'typical',
  options: Parameters<typeof createActiveDose>[3] = {}
): void {
  state.doses.push(createActiveDose(state.patient, drugId, doseLevel, {
    ...options,
    administeredAtSimTime: state.timeSeconds,
  }));
}

export function stopInfusion(state: SimulationState, drugId: string): void {
  state.doses = state.doses.map((dose) => dose.drugId === drugId && dose.isCRI
    ? { ...dose, isInfusionRunning: false, criRatePerKgMin: 0 }
    : dose);
}

export function advanceSimulation(
  state: SimulationState,
  durationSeconds: number,
  options: { dtSeconds?: number; surgicalStimulation?: boolean } = {}
): SimulationState {
  const dtSeconds = options.dtSeconds ?? 1;
  const steps = Math.ceil(durationSeconds / dtSeconds);

  for (let index = 0; index < steps; index += 1) {
    const dt = Math.min(dtSeconds, durationSeconds - index * dtSeconds);
    if (dt <= 0) break;
    state.timeSeconds += dt;
    const result = PKPDEngine.stepSimulation(
      dt,
      state.timeSeconds,
      state.patient,
      state.doses,
      state.equipment,
      state.resuscitation,
      Boolean(options.surgicalStimulation),
      state.vitals
    );
    state.vitals = result.vitals;
    state.doses = result.updatedDoses;
    state.equipment = { ...state.equipment, ...result.equipmentUpdates };
    state.frames.push({
      timeSeconds: state.timeSeconds,
      vitals: state.vitals,
      doses: state.doses.map((dose) => ({ ...dose })),
    });
  }
  return state;
}

export function summarizeTrace(frames: SimulationFrame[]): TraceMetrics {
  if (frames.length === 0) throw new Error('Não há quadros de simulação para resumir');
  const vitals = frames.map((frame) => frame.vitals);
  const values = (selector: (vital: VitalSigns) => number): number[] => vitals.map(selector);
  const max = (selector: (vital: VitalSigns) => number): number => Math.max(...values(selector));
  const min = (selector: (vital: VitalSigns) => number): number => Math.min(...values(selector));

  return {
    minHeartRate: min((item) => item.heartRate),
    maxHeartRate: max((item) => item.heartRate),
    minMap: min((item) => item.meanArterialPressure),
    maxMap: max((item) => item.meanArterialPressure),
    minRespiratoryRate: min((item) => item.respiratoryRate),
    maxRespiratoryRate: max((item) => item.respiratoryRate),
    minSpO2: min((item) => item.pulseOximetrySpO2),
    maxPaCO2: max((item) => item.arterialBloodGases.paCO2),
    maxLactate: max((item) => item.arterialBloodGases.lactate),
    maxPotassium: max((item) => item.arterialBloodGases.potassium),
    maxBicarbonate: max((item) => item.arterialBloodGases.bicarbonate),
    maxHematocrit: max((item) => item.arterialBloodGases.hematocritPct),
    maxSedation: max((item) => item.cellularState.centralSedation),
    maxHypnosis: max((item) => item.cellularState.hypnoticEffect),
    maxDissociation: max((item) => item.cellularState.dissociativeEffect),
    maxAnalgesia: max((item) => item.cellularState.nociceptiveInhibition),
    maxMuscleRelaxation: max((item) => item.cellularState.muscleRelaxation),
    maxRespiratoryDepression: max((item) => item.cellularState.respiratoryDepression),
    maxLocalBlockade: max((item) => item.cellularState.localNeuralBlockade),
    maxSystemicNaVBlockade: max((item) => item.cellularState.systemicNaVBlockade),
    maxVolumeExpansionProxy: max((item) => item.cellularState.cardiacOutputLMin),
    minTrainOfFour: min((item) => item.trainOfFourCount),
    minConsciousness: min((item) => item.consciousnessScore),
    maxDepth: max((item) => item.anestheticDepthScore),
    peakEffectSiteExposure: Math.max(0, ...frames.flatMap((frame) => frame.doses.map((dose) => dose.currentCe))),
    cardiacArrestOccurred: vitals.some((item) => item.isCardiacArrest || item.isDead),
    respiratoryArrestOccurred: vitals.some((item) => item.isRespiratoryArrest),
    stages: [...new Set(vitals.map((item) => item.guedelStage))],
  };
}

export function defaultObservationSeconds(drugId: string, route?: DrugRoute): number {
  const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === drugId);
  if (!drug) throw new Error(`Fármaco não encontrado: ${drugId}`);
  const selectedRoute = route || preferredRoute(drug.id, drug.supportedRoutes, drug.doseUnit);
  const routePK = getRoutePharmacokinetics(drug, selectedRoute);
  const peakWindow = routePK.transitLagSeconds + drug.onsetMinutes * 60 * 2.2;
  if (selectedRoute === 'CRI') return Math.max(600, Math.min(1800, peakWindow));
  return Math.max(180, Math.min(2400, peakWindow));
}
