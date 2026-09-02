export type SpeciesType = 'canine' | 'feline' | 'equine' | 'bovine' | 'rabbit' | 'avian';

export type ASAStatus = 'I' | 'II' | 'III' | 'IV' | 'V' | 'E';

export type CardiacRhythm = 
  | 'sinus'
  | 'sinus_bradycardia'
  | 'sinus_tachycardia'
  | 'sinus_arrhythmia'
  | 'ventricular_premature_complexes' // VPCs / PVCs
  | 'ventricular_tachycardia'
  | 'ventricular_fibrillation'
  | 'atrial_fibrillation'
  | 'av_block_2nd_degree'
  | 'av_block_3rd_degree'
  | 'pulseless_electrical_activity' // PEA
  | 'asystole';

export type RespiratoryPattern = 
  | 'eupneic'
  | 'tachypneic'
  | 'bradypneic'
  | 'apneic'
  | 'obstructive'
  | 'agonal_gasping'
  | 'curare_cleft';

export type CapnogramType = 
  | 'normal'
  | 'obstructive_shark_fin'
  | 'rebreathing_elevated_baseline'
  | 'curare_cleft'
  | 'cardiogenic_oscillations'
  | 'hyperventilation'
  | 'hypoventilation'
  | 'cardiac_arrest_flat';

export type IntubationStatus = 
  | 'unintubated'
  | 'intubated_tracheal'
  | 'intubated_esophageal'
  | 'laryngeal_mask'
  | 'extubated';

export type MucousMembraneColor = 'pink' | 'pale' | 'cyanotic' | 'icteric' | 'brick_red' | 'gray_moribund';

export type CapillaryRefillTime = '< 1s (hyperdynamic)' | '1 - 2s (normal)' | '2 - 3s (sluggish)' | '> 3s (poor perfusion)' | 'absent';

export type ReflexStrength = 'brisk' | 'moderate' | 'sluggish' | 'absent';

export type EyePosition = 'central_light' | 'ventromedial_surgical' | 'central_deep_dilated';

export type JawTone = 'rigid' | 'moderate' | 'relaxed_surgical' | 'flaccid';

export type VentilatorMode = 'spontaneous' | 'cmv_volume' | 'pcv_pressure';

export type BreathingCircuitType = 'circle_rebreathing_adult' | 'circle_rebreathing_pediatric' | 'bain_non_rebreathing' | 't_piece_non_rebreathing';

export type DrugCategory = 
  | 'premedication'
  | 'induction'
  | 'inhalation'
  | 'opioid_analgesic'
  | 'antagonist_reversal'
  | 'emergency_inotrope'
  | 'antiarrhythmic'
  | 'nmba'
  | 'nmba_reversal'
  | 'local_anesthetic'
  | 'fluid_crystalloid'
  | 'fluid_colloid'
  | 'blood_product';

export type DrugRoute = 'IV' | 'IV_slow' | 'IM' | 'SC' | 'CRI' | 'Inh' | 'Epidural' | 'Local';

export type AdministrationSpeed = 'bolus_rapid' | 'bolus_slow' | 'infusion_cri';

export interface FastBolusConsequences {
  apneaRisk: number; // 0 to 1
  hypotensionSeverity: number; // 0 to 1
  reflexBradycardiaRisk: number; // 0 to 1
  arrhythmiaRisk: number; // 0 to 1
  histamineRelease: boolean;
  lethalityRiskScore: number; // 0 to 1
  warningDescription: string;
}

export interface DrugDefinition {
  id: string;
  name: string;
  brandName?: string;
  category: DrugCategory;
  description: string;
  defaultConcentrationMgMl: number; // mg/ml (or mcg/ml, or % for fluids/inhalants)
  unit: 'mg' | 'mcg' | 'g' | 'ml' | '%' | 'UI' | 'mEq';
  doseUnit: 'mg/kg' | 'mcg/kg' | 'mg/kg/h' | 'mcg/kg/min' | 'ml/kg' | 'ml/kg/h' | '%' | 'UI/kg' | 'mEq/kg';
  recommendedDose: {
    canine: { min: number; max: number; typical: number };
    feline: { min: number; max: number; typical: number };
    equine?: { min: number; max: number; typical: number };
    bovine?: { min: number; max: number; typical: number };
    rabbit?: { min: number; max: number; typical: number };
    avian?: { min: number; max: number; typical: number };
  };
  supportedRoutes: DrugRoute[];
  // PK/PD Parameters
  onsetMinutes: number; // Peak time
  durationMinutes: number; // Elimination half-time / clinical duration
  transitLagSecondsIV: number; // arm-to-brain / circulation delay (s)
  ke0: number; // equilibration rate constant (min^-1)
  halfLifeAlpha: number; // distribution half-life (min)
  halfLifeBeta: number; // elimination half-life (min)
  fastBolusRisk?: FastBolusConsequences;
  // Pharmacodynamics Vectors (-1 to +1 or scale factor)
  effectHR: number; // >0 tachy, <0 brady
  effectBP: number; // >0 hyper, <0 hypo (vasodilation/inotropy)
  effectRR: number; // >0 tachypnea, <0 bradypnea/apnea
  effectDepth: number; // Anesthetic/hypnotic power (0 to 1)
  effectAnalgesia: number; // Analgesic power (0 to 1)
  macReductionPct: number; // percentage MAC reduction (e.g. 0.3 = 30%)
  muscleRelaxation: number; // 0 to 1
  specialTraits?: {
    isAlpha2Agonist?: boolean;
    isAlpha2Antagonist?: boolean;
    isOpioid?: boolean;
    isOpioidAntagonist?: boolean;
    isBenzodiazepine?: boolean;
    isBenzoAntagonist?: boolean;
    isParasympatholytic?: boolean;
    isSympathomimetic?: boolean;
    isDissociative?: boolean;
    isAntiarrhythmicClass1b?: boolean;
    isNMBA?: boolean;
    isNMBAReversal?: boolean;
    causesInitialHypertensionReflexBradycardia?: boolean;
    causesHistamineRelease?: boolean;
    causesArrhythmogenicityReduction?: boolean;
    isPotassiumSalt?: boolean;
    isCalciumSalt?: boolean;
    isLipidSink?: boolean;
    isFelineToxicIV?: boolean;
    isBovineHyperSensitive?: boolean;
  };
}

export interface ActiveDrugDose {
  id: string;
  drugId: string;
  drugName: string;
  category: DrugCategory;
  route: DrugRoute;
  administrationSpeed?: AdministrationSpeed;
  doseAmount: number; // in mg, mcg, etc.
  dosePerKg: number; // in mg/kg or mcg/kg
  volumeMl: number;
  administeredAtSimTime: number; // simulation seconds
  peakEffectSimTime: number;
  deliveryDurationSec?: number;
  deliveryElapsedSec?: number;
  transitLagRemainingSec?: number;
  isFullyDelivered?: boolean;
  isFastBolusShockTriggered?: boolean;
  isCRI?: boolean;
  criRatePerKgMin?: number;
  criRateMlPerHour?: number;
  currentCe: number; // Effect-site concentration (0 to 1 normalized)
  currentCp: number; // Plasma concentration
}

export interface PatientProfile {
  id: string;
  name: string;
  species: SpeciesType;
  breed: string;
  ageYears: number;
  ageMonths: number;
  weightKg: number;
  gender: 'Macho' | 'Fêmea' | 'Macho Castrado' | 'Fêmea Castrada' | 'Indeterminado';
  asa: ASAStatus;
  scenarioTitle: string;
  scenarioDescription: string;
  clinicalHistory: string;
  surgicalProcedure: string;
  baselineVitals: {
    hr: number;
    rr: number;
    sysBP: number;
    diaBP: number;
    map: number;
    tempC: number;
    spo2: number;
    etco2: number;
    bloodVolumeMl: number;
    hctPct: number;
    potassiumMeqL: number;
    lactateMmolL: number;
  };
  pathologyConditions: {
    hypovolemiaSeverity?: number; // 0 (none) to 1 (severe shock)
    hyperkalemiaSeverity?: number; // 0 to 1
    brachycephalicObstruction?: boolean;
    cardiacFailureDCM?: boolean;
    sepsisVasodilation?: boolean;
    hypothermiaSusceptible?: boolean;
    gastricDilatationVolvulus?: boolean;
    traumaHemorrhage?: boolean;
    fetalDepressionRisk?: boolean;
  };
}

export interface VitalSigns {
  heartRate: number; // bpm
  cardiacRhythm: CardiacRhythm;
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  meanArterialPressure: number; // mmHg
  pulseOximetrySpO2: number; // %
  respiratoryRate: number; // bpm
  tidalVolumeMl: number; // ml
  minuteVolumeL: number; // L/min
  respiratoryPattern: RespiratoryPattern;
  etCO2: number; // mmHg
  fiCO2: number; // mmHg
  capnogramType: CapnogramType;
  bodyTemperatureC: number; // °C
  arterialBloodGases: {
    pH: number;
    paO2: number; // mmHg
    paCO2: number; // mmHg
    bicarbonate: number; // mEq/L
    lactate: number; // mmol/L
    potassium: number; // mEq/L
    hematocritPct: number; // %
  };
  // Neurological & Reflex Status
  anestheticDepthScore: number; // 0 (awake) to 100 (lethal/too deep)
  guedelStage: 'Estágio I (Voluntário)' | 'Estágio II (Excitação/Delírio)' | 'Estágio III Plano 1 (Leve)' | 'Estágio III Plano 2 (Cirúrgico)' | 'Estágio III Plano 3 (Profundo)' | 'Estágio IV (Depressão Bulbar / Parada)';
  eyePosition: EyePosition;
  palpebralReflex: ReflexStrength;
  cornealReflex: ReflexStrength;
  jawTone: JawTone;
  pedalReflex: ReflexStrength;
  surgicalTolerancePct: number; // 0 to 100% (how well patient tolerates surgical stimulation)
  trainOfFourCount: number; // 0 to 4 (neuromuscular blockade)
  // Perfusion & Physical Exam
  mucousMembraneColor: MucousMembraneColor;
  capillaryRefillTime: CapillaryRefillTime;
  pulseQuality: 'Forte e Cheio' | 'Normal' | 'Fraco / Filiforme' | 'Célere / Saltão' | 'Ausente';
  perfusionIndex: number;
  // Critical / Lethal Organ Status
  isRespiratoryArrest: boolean;
  respiratoryArrestCause?: string;
  isCardiacArrest: boolean;
  cardiacArrestCause?: string;
  cardiacArrestType?: 'asystole' | 'ventricular_fibrillation' | 'pulseless_ventricular_tachycardia' | 'pea';
  isDead: boolean;
  deathTimeSeconds?: number;
  deathCause?: string;
  deathDetailedSummary?: {
    primaryCause: string;
    contributingFactors: string[];
    chronology: string[];
    autopsyFindings: string[];
  };
  asystoleSecondsElapsed: number;
  cprSecondsElapsed: number;
  activeDrugInteractions: {
    title: string;
    severity: 'info' | 'warning' | 'danger' | 'lethal';
    description: string;
    pharmacologyMechanism: string;
  }[];
  myocardialIschemiaScore: number; // 0 to 1
  hypoxiaExposureSeconds: number;
  severeAcidosisRisk: boolean;
  barotraumaCollapse: boolean;
  felineLidocaineToxicity: boolean;
  bovineBloatRespiratoryRestriction: boolean;
}

export interface AnesthesiaEquipmentState {
  oxygenFlowLMin: number;
  nitrousOxideFlowLMin: number;
  vaporizerType: 'isoflurane' | 'sevoflurane';
  vaporizerDialPct: number; // 0 to 5%
  isVaporizerOn: boolean;
  circuitType: BreathingCircuitType;
  sodaLimeExhaustionPct: number; // 0 to 100%
  aplValveState: 'open' | 'closed' | 'partial_20cm';
  reservoirBagVolumeMl: number;
  isOxygenFlushActive: boolean;
  
  // Airway & Tube
  intubationStatus: IntubationStatus;
  tubeSizeMm: number;
  cuffPressureCmH2O: number;
  
  // Mechanical Ventilator
  ventilatorMode: VentilatorMode;
  isVentilatorActive: boolean;
  ventilatorSettings: {
    rateBpm: number;
    tidalVolumeMl: number;
    peepCmH2O: number;
    ieRatio: '1:2' | '1:3' | '1:4';
    pipPressureLimitCmH2O: number;
    inspiratoryPausePct: number;
  };
  currentAirwayPressureCmH2O: number;
  
  // Fluid Therapy & Thermal
  activeFluidType: string;
  fluidRateMlPerHour: number;
  totalFluidsInfusedMl: number;
  isFluidPumpRunning: boolean;
  warmingBlanketActive: boolean;
  warmingBlanketTempC: number;
}

export interface ResuscitationState {
  isCPRActive: boolean;
  compressionsPerMin: number;
  lastCompressionSimTime: number;
  compressionDepthQuality: number; // 0 to 1
  defibrillatorChargedJoules: number;
  isDefibrillatorArmed: boolean;
}

export interface LogEntry {
  id: string;
  simTimeSeconds: number;
  realTimestamp: string;
  type: 'drug' | 'equipment' | 'vital' | 'surgical' | 'emergency' | 'system';
  message: string;
  details?: string;
  severity?: 'normal' | 'warning' | 'danger' | 'success';
}

export interface VitalRecordPoint {
  simTimeSeconds: number;
  timeLabel: string;
  hr: number;
  sysBP: number;
  diaBP: number;
  map: number;
  spo2: number;
  etco2: number;
  rr: number;
  tempC: number;
  vaporizerPct: number;
  depthScore: number;
}

export interface MonitorAlarmLimits {
  hrLow: number;
  hrHigh: number;
  mapLow: number;
  mapHigh: number;
  spo2Low: number;
  etco2Low: number;
  etco2High: number;
  tempLow: number;
  tempHigh: number;
  isAudioMuted: boolean;
}
