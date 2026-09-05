import type { PatientProfile } from '../types/simulator';
import {
  CANINE_MODEL_ID,
  type CaninePatientConfiguration,
  type ParameterProvenance,
} from './protocol';

export const CANINE_REFERENCE_PROFILE_VERSION = '0.1.0-alpha';

/**
 * The first reference profile is intentionally a 20.5 kg adult dog because
 * the largest coherent cardiopulmonary reference set available to the project
 * reports 97 unsedated, normovolemic dogs around this body mass. Parameters
 * are never silently promoted from an assumption to validated data.
 */
export const CANINE_REFERENCE = {
  modelId: CANINE_MODEL_ID,
  version: CANINE_REFERENCE_PROFILE_VERSION,
  referenceBodyWeightKg: 20.5,
  cardiovascular: {
    heartRatePerMin: { mean: 87, sd: 22 },
    meanArterialPressureMmHg: { mean: 103, sd: 15 },
    cardiacOutputMlKgMin: { mean: 165, sd: 43 },
    cardiacIndexLMinM2: { mean: 4.42, sd: 1.24 },
    centralVenousPressureCmH2O: { mean: 3.1, sd: 4.1 },
    pulmonaryArterialPressureMmHg: { mean: 14, sd: 3.2 },
    oxygenDeliveryMlKgMin: { mean: 29.5, sd: 8.8 },
    oxygenConsumptionMlKgMin: { mean: 6.0, sd: 2.6 },
  },
  bloodChemistry: {
    arterialPh: { mean: 7.381, sd: 0.025 },
    arterialPaCO2MmHg: { mean: 40.2, sd: 3.4 },
    arterialPaO2MmHg: { mean: 99.5, sd: 6.8 },
    bicarbonateMmolL: { mean: 23.1, sd: 2.0 },
    hemoglobinGdl: { mean: 13.6, sd: 1.8 },
    venousAdmixtureFraction: { mean: 0.036, sd: 0.041 },
  },
  pbpkBeagle: {
    cardiacOutputLHrKg: 12.9,
    tissueVolumeFraction: {
      liver: 0.0329,
      kidney: 0.0055,
      muscle: 0.4565,
      brain: 0.0078,
      lung: 0.0082,
      heart: 0.0078,
      gastrointestinal: 0.0368,
      blood: 0.082,
    },
    bloodFlowFraction: {
      liverArterial: 0.046,
      kidney: 0.173,
      muscle: 0.217,
      brain: 0.02,
      heart: 0.046,
      gastrointestinal: 0.1,
    },
  },
} as const;

export const CANINE_PARAMETER_PROVENANCE: ParameterProvenance[] = [
  {
    parameter: 'cardiopulmonary_reference',
    source: 'Haskins et al., Comparative Medicine 2005;55(2):156-161. PMID 15884778',
    sourceType: 'primary_study',
    uncertainty: 'low',
    note: '97 cães instrumentados, não sedados e normovolêmicos; usado para os alvos basais iniciais.',
  },
  {
    parameter: 'pbpk_beagle_tissue_volumes_and_flows',
    source: 'Elwell-Cuddy et al., J Vet Pharmacol Ther. 2018. DOI 10.1111/jvp.12676',
    sourceType: 'primary_study',
    uncertainty: 'medium',
    note: 'Parâmetros fisiológicos do Beagle; não representam automaticamente todas as raças.',
  },
  {
    parameter: 'hypotension_intervention_threshold',
    source: 'ACVAA Small Animal Anesthesia and Sedation Monitoring Guidelines 2025',
    sourceType: 'guideline',
    uncertainty: 'low',
    note: 'PAM abaixo de 60–65 mmHg deve motivar avaliação e intervenção; não é alvo basal.',
  },
  {
    parameter: 'blood_volume_ml_kg',
    source: 'Faixa clínica veterinária consolidada; validação primária específica ainda pendente.',
    sourceType: 'assumption',
    uncertainty: 'high',
    note: 'Mantido explicitamente como hipótese do modelo alfa, não como valor validado.',
  },
];

const bounded = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const createCaninePatientConfiguration = (
  patient: PatientProfile
): CaninePatientConfiguration => {
  if (patient.species !== 'canine') {
    throw new Error('O motor canino só pode ser inicializado com um paciente canino.');
  }

  const systolic = patient.baselineVitals.sysBP;
  const diastolic = patient.baselineVitals.diaBP;
  const calculatedMap = diastolic + (systolic - diastolic) / 3;

  return {
    id: patient.id,
    name: patient.name,
    species: 'canine',
    sex: patient.gender.startsWith('Fêmea')
      ? 'female'
      : patient.gender.startsWith('Macho')
        ? 'male'
        : 'unknown',
    ageYears: patient.ageYears,
    weightKg: patient.weightKg,
    asaStatus: patient.asa,
    conformation: patient.pathologyConditions.brachycephalicObstruction
      ? 'brachycephalic'
      : undefined,
    targets: {
      heartRatePerMin: bounded(patient.baselineVitals.hr, 35, 240),
      respirationRatePerMin: bounded(patient.baselineVitals.rr, 4, 80),
      systolicPressureMmHg: bounded(systolic, 55, 220),
      diastolicPressureMmHg: bounded(diastolic, 25, 150),
      meanArterialPressureMmHg: bounded(
        Number.isFinite(patient.baselineVitals.map) ? patient.baselineVitals.map : calculatedMap,
        35,
        180
      ),
      temperatureC: bounded(patient.baselineVitals.tempC, 34, 41.5),
      arterialPh: CANINE_REFERENCE.bloodChemistry.arterialPh.mean,
      arterialPaCO2MmHg: CANINE_REFERENCE.bloodChemistry.arterialPaCO2MmHg.mean,
      arterialPaO2MmHg: CANINE_REFERENCE.bloodChemistry.arterialPaO2MmHg.mean,
      // Provisional until the dedicated blood-volume evidence set is accepted.
      bloodVolumeMl: patient.baselineVitals.bloodVolumeMl,
    },
  };
};

export interface CanineReferenceCheck {
  id: string;
  passed: boolean;
  actual: number;
  expectedLow: number;
  expectedHigh: number;
  unit: string;
}

const withinStandardDeviations = (
  id: string,
  actual: number,
  reference: { mean: number; sd: number },
  unit: string,
  standardDeviations = 2
): CanineReferenceCheck => ({
  id,
  passed: actual >= reference.mean - standardDeviations * reference.sd
    && actual <= reference.mean + standardDeviations * reference.sd,
  actual,
  expectedLow: reference.mean - standardDeviations * reference.sd,
  expectedHigh: reference.mean + standardDeviations * reference.sd,
  unit,
});

export const evaluateCanineRestingReference = (values: {
  heartRatePerMin: number;
  meanArterialPressureMmHg: number;
  cardiacOutputMlKgMin: number;
  arterialPh: number;
  arterialPaCO2MmHg: number;
  arterialPaO2MmHg: number;
  oxygenConsumptionMlKgMin: number;
}): CanineReferenceCheck[] => [
  withinStandardDeviations('heart_rate', values.heartRatePerMin, CANINE_REFERENCE.cardiovascular.heartRatePerMin, '1/min'),
  withinStandardDeviations('mean_arterial_pressure', values.meanArterialPressureMmHg, CANINE_REFERENCE.cardiovascular.meanArterialPressureMmHg, 'mmHg'),
  withinStandardDeviations('cardiac_output', values.cardiacOutputMlKgMin, CANINE_REFERENCE.cardiovascular.cardiacOutputMlKgMin, 'mL/min/kg'),
  withinStandardDeviations('arterial_ph', values.arterialPh, CANINE_REFERENCE.bloodChemistry.arterialPh, '1'),
  withinStandardDeviations('arterial_paco2', values.arterialPaCO2MmHg, CANINE_REFERENCE.bloodChemistry.arterialPaCO2MmHg, 'mmHg'),
  withinStandardDeviations('arterial_pao2', values.arterialPaO2MmHg, CANINE_REFERENCE.bloodChemistry.arterialPaO2MmHg, 'mmHg'),
  withinStandardDeviations('oxygen_consumption', values.oxygenConsumptionMlKgMin, CANINE_REFERENCE.cardiovascular.oxygenConsumptionMlKgMin, 'mL/min/kg'),
];
