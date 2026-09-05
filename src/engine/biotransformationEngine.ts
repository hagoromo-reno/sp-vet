import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import type {
  ActiveDrugDose,
  BiologicalState,
  DrugBiotransformationProfile,
  DrugDefinition,
  PatientProfile,
} from '../types/simulator';
import { getSpeciesDoseRange } from './drugAdministration';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const approach = (current: number, target: number, dt: number, tau: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / Math.max(0.1, tau)));

const PROFILE_OVERRIDES: Record<string, Partial<DrugBiotransformationProfile>> = {
  propofol: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Conjugação hepática e extra-hepática', enzymeSystem: 'UGT', hepaticClearanceFraction: 0.82, renalClearanceFraction: 0.18, proteinBindingFraction: 0.98, apparentCentralVolumeLKg: 0.35, lipidSolubility: 0.95 },
  morphine: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Glucuronidação hepática', enzymeSystem: 'UGT2B', hepaticClearanceFraction: 0.78, renalClearanceFraction: 0.22, proteinBindingFraction: 0.35, apparentCentralVolumeLKg: 0.5, lipidSolubility: 0.55, activeMetabolite: 'metabólitos glucuronídeos' },
  fentanyl: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Oxidação hepática', enzymeSystem: 'CYP3A', hepaticClearanceFraction: 0.9, renalClearanceFraction: 0.1, proteinBindingFraction: 0.84, apparentCentralVolumeLKg: 0.55, lipidSolubility: 0.98 },
  ketamine: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'N-desmetilação hepática', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.82, renalClearanceFraction: 0.18, proteinBindingFraction: 0.28, apparentCentralVolumeLKg: 0.65, lipidSolubility: 0.78, activeMetabolite: 'norcetamina' },
  midazolam: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Hidroxilação hepática', enzymeSystem: 'CYP3A', hepaticClearanceFraction: 0.86, renalClearanceFraction: 0.14, proteinBindingFraction: 0.95, apparentCentralVolumeLKg: 0.45, lipidSolubility: 0.82 },
  lidocaine_2pct: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Desalquilação hepática', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.88, renalClearanceFraction: 0.12, proteinBindingFraction: 0.65, apparentCentralVolumeLKg: 0.7, lipidSolubility: 0.72, activeMetabolite: 'MEGX/GX' },
  atracurium: { primaryPathway: 'hoffmann', pathwayLabel: 'Eliminação de Hofmann e hidrólise esterásica', hepaticClearanceFraction: 0.08, renalClearanceFraction: 0.08, proteinBindingFraction: 0.82, apparentCentralVolumeLKg: 0.18, lipidSolubility: 0.15, activeMetabolite: 'laudanosina' },
  remifentanil: { primaryPathway: 'plasma_esterase', pathwayLabel: 'Hidrólise por esterases plasmáticas', hepaticClearanceFraction: 0.05, renalClearanceFraction: 0.05, proteinBindingFraction: 0.7, apparentCentralVolumeLKg: 0.25, lipidSolubility: 0.7 },
  sodium_nitroprusside: { primaryPathway: 'none', pathwayLabel: 'Liberação de NO com formação de cianeto/tiocianato', hepaticClearanceFraction: 0.55, renalClearanceFraction: 0.45, proteinBindingFraction: 0.02, apparentCentralVolumeLKg: 0.2, lipidSolubility: 0.08, activeMetabolite: 'tiocianato' },
  hydralazine: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Acetilação e hidroxilação hepática', enzymeSystem: 'NAT', hepaticClearanceFraction: 0.78, renalClearanceFraction: 0.22, proteinBindingFraction: 0.9, apparentCentralVolumeLKg: 0.45, lipidSolubility: 0.4 },
  neostigmine: { primaryPathway: 'renal', pathwayLabel: 'Excreção renal e hidrólise', hepaticClearanceFraction: 0.25, renalClearanceFraction: 0.75, proteinBindingFraction: 0.2, apparentCentralVolumeLKg: 0.25, lipidSolubility: 0.05 },
  sugammadex: { primaryPathway: 'renal', pathwayLabel: 'Excreção renal do complexo encapsulado', hepaticClearanceFraction: 0.02, renalClearanceFraction: 0.98, proteinBindingFraction: 0.02, apparentCentralVolumeLKg: 0.2, lipidSolubility: 0.02 },
};

export const resolveBiotransformationProfile = (drug: DrugDefinition): DrugBiotransformationProfile => {
  const isFluid = drug.category.startsWith('fluid_') || drug.category === 'blood_product';
  const defaultProfile: DrugBiotransformationProfile = isFluid ? {
    primaryPathway: 'none', pathwayLabel: 'Distribuição e redistribuição intravascular', hepaticClearanceFraction: 0,
    renalClearanceFraction: 0.65, proteinBindingFraction: 0, apparentCentralVolumeLKg: 0.08, lipidSolubility: 0,
  } : {
    primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Biotransformação hepática seguida de excreção renal', enzymeSystem: 'CYP/UGT',
    hepaticClearanceFraction: 0.72, renalClearanceFraction: 0.28, proteinBindingFraction: 0.55,
    apparentCentralVolumeLKg: 0.45, lipidSolubility: drug.category === 'induction' || drug.category === 'opioid_analgesic' ? 0.75 : 0.45,
  };
  return { ...defaultProfile, ...(PROFILE_OVERRIDES[drug.id] || {}), ...(drug.biotransformation || {}) };
};

const doseValueToMg = (value: number, unit: string): number | undefined => {
  if (unit.startsWith('mcg')) return value / 1000;
  if (unit.startsWith('mg')) return value;
  if (unit.startsWith('g')) return value * 1000;
  return undefined;
};

export interface PatientDrugKinetics {
  estimatedPlasmaConcentration?: number;
  concentrationUnit: 'µg/mL' | 'índice relativo';
  estimatedFreeConcentration?: number;
  estimatedCentralAmountMg?: number;
  plasmaTrend: 'subindo' | 'estável' | 'diminuindo';
  centralFraction: number;
  rapidTissueFraction: number;
  deepTissueFraction: number;
  depotFraction: number;
  eliminatedFraction: number;
  bioaccumulationLabel: 'mínima' | 'moderada' | 'elevada';
  profile: DrugBiotransformationProfile;
  effectiveClearance: number;
  feedbackExplanation: string;
}

export const analyzePatientDrugKinetics = (patient: PatientProfile, dose: ActiveDrugDose, biological: BiologicalState): PatientDrugKinetics | undefined => {
  const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
  if (!drug) return undefined;
  const profile = resolveBiotransformationProfile(drug);
  const state = dose.pkCompartments;
  const central = state?.centralAmountNormalized || 0;
  const rapid = state?.rapidPeripheralAmountNormalized || 0;
  const deep = state?.deepPeripheralAmountNormalized || 0;
  const depot = state?.absorptionDepotAmountNormalized || 0;
  const eliminated = state?.cumulativeEliminatedNormalized || 0;
  const currentBody = central + rapid + deep + depot;
  const distributionTotal = Math.max(0.000001, currentBody);
  const deliveredTotal = Math.max(0.000001, currentBody + eliminated);
  const tissueFraction = (rapid + deep) / distributionTotal;
  const trendDelta = dose.currentCp - (dose.previousCp ?? dose.currentCp);
  const plasmaTrend = trendDelta > 0.00005 ? 'subindo' : trendDelta < -0.00005 ? 'diminuindo' : 'estável';

  const normalizingRange = getSpeciesDoseRange(drug, patient.species, Boolean(dose.isCRI))
    || getSpeciesDoseRange(drug, patient.species, false);
  const activeUnit = dose.isCRI ? (drug.criDoseUnit || drug.doseUnit) : drug.doseUnit;
  const normalizingMg = normalizingRange ? doseValueToMg(normalizingRange.typical, activeUnit) : undefined;
  let estimatedPlasmaConcentration: number | undefined;
  if (normalizingMg !== undefined) {
    const doseEquivalentMgKg = dose.isCRI
      ? normalizingMg * Math.max(0.5, drug.halfLifeBeta) / Math.LN2
      : normalizingMg;
    estimatedPlasmaConcentration = dose.currentCp * doseEquivalentMgKg / Math.max(0.05, profile.apparentCentralVolumeLKg);
  }
  const hepaticCapacity = biological.biotransformation.hepaticEnzymeCapacity;
  const renalCapacity = biological.biotransformation.renalFiltrationCapacity;
  const effectiveClearance = profile.hepaticClearanceFraction * hepaticCapacity
    + profile.renalClearanceFraction * renalCapacity
    + Math.max(0, 1 - profile.hepaticClearanceFraction - profile.renalClearanceFraction);

  return {
    estimatedPlasmaConcentration,
    concentrationUnit: estimatedPlasmaConcentration === undefined ? 'índice relativo' : 'µg/mL',
    estimatedFreeConcentration: estimatedPlasmaConcentration === undefined ? undefined : estimatedPlasmaConcentration * (1 - profile.proteinBindingFraction),
    estimatedCentralAmountMg: estimatedPlasmaConcentration === undefined ? undefined : estimatedPlasmaConcentration * profile.apparentCentralVolumeLKg * patient.weightKg,
    plasmaTrend,
    centralFraction: central / distributionTotal,
    rapidTissueFraction: rapid / distributionTotal,
    deepTissueFraction: deep / distributionTotal,
    depotFraction: depot / distributionTotal,
    eliminatedFraction: eliminated / deliveredTotal,
    bioaccumulationLabel: tissueFraction > 0.62 ? 'elevada' : tissueFraction > 0.3 ? 'moderada' : 'mínima',
    profile,
    effectiveClearance,
    feedbackExplanation: effectiveClearance < 0.65
      ? 'Depuração limitada pela perfusão/capacidade orgânica; maior tendência à acumulação.'
      : biological.biotransformation.receptorAdaptiveFeedback > 0.2
        ? 'Exposição sustentada induz adaptação receptorial e menor resposta por unidade de concentração.'
        : 'Entrada, distribuição e depuração permanecem em equilíbrio fisiológico compensado.',
  };
};

export class BiotransformationEngine {
  public static step(dtSeconds: number, doses: ActiveDrugDose[], previous: BiologicalState['biotransformation'], hepaticPerfusion: number, renalPerfusion: number): BiologicalState['biotransformation'] {
    let hepaticLoad = 0;
    let renalLoad = 0;
    let metaboliteDrive = 0;
    let longestContinuousExposureHours = 0;
    for (const dose of doses) {
      const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
      if (!drug) continue;
      const profile = resolveBiotransformationProfile(drug);
      hepaticLoad += dose.currentCp * profile.hepaticClearanceFraction;
      renalLoad += dose.currentCp * profile.renalClearanceFraction;
      metaboliteDrive += dose.currentCp * profile.hepaticClearanceFraction * (profile.activeMetabolite ? 0.45 : 0.12);
      const isToleranceSensitive = Boolean(drug.specialTraits?.isOpioid || drug.specialTraits?.isAlpha2Agonist || drug.specialTraits?.isSympathomimetic);
      if (isToleranceSensitive && dose.isCRI && dose.isInfusionRunning !== false) {
        longestContinuousExposureHours = Math.max(longestContinuousExposureHours, (dose.deliveryElapsedSec || 0) / 3600);
      }
    }
    const hepaticSaturationTarget = clamp(hepaticLoad / (2.5 + hepaticLoad));
    const renalSaturationTarget = clamp(renalLoad / (3 + renalLoad));
    const hepaticEnzymeSaturation = approach(previous.hepaticEnzymeSaturation, hepaticSaturationTarget, dtSeconds, hepaticSaturationTarget > previous.hepaticEnzymeSaturation ? 45 : 420);
    const renalTransportSaturation = approach(previous.renalTransportSaturation, renalSaturationTarget, dtSeconds, renalSaturationTarget > previous.renalTransportSaturation ? 60 : 360);
    const metaboliteTarget = clamp(metaboliteDrive / 4);
    const adaptationTarget = clamp(longestContinuousExposureHours / 12, 0, 0.65);
    return {
      hepaticEnzymeSaturation,
      renalTransportSaturation,
      hepaticEnzymeCapacity: clamp(hepaticPerfusion * (1 - hepaticEnzymeSaturation * 0.48), 0.12, 1.15),
      renalFiltrationCapacity: clamp(renalPerfusion * (1 - renalTransportSaturation * 0.38), 0.12, 1.15),
      circulatingMetaboliteBurden: approach(previous.circulatingMetaboliteBurden, metaboliteTarget, dtSeconds, metaboliteTarget > previous.circulatingMetaboliteBurden ? 180 : 1800),
      receptorAdaptiveFeedback: approach(previous.receptorAdaptiveFeedback, adaptationTarget, dtSeconds, adaptationTarget > previous.receptorAdaptiveFeedback ? 900 : 3600),
    };
  }
}
