import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import type {
  ActiveDrugDose,
  BiologicalState,
  DrugBiotransformationProfile,
  DrugDefinition,
  PatientProfile,
} from '../types/simulator';
import { getSpeciesDoseRange } from './drugAdministration';
import {
  classifyConcentration,
  DRUG_DISPOSITION,
  DrugDispositionProfile,
  ENZYME_PATHWAYS,
  ENZYME_PATHWAY_KM,
  EnzymePathway,
  getTherapeuticWindow,
  TherapeuticWindow,
} from './pk/speciesDrugDisposition';
import { computeOrganClearance, OrganClearanceBreakdown } from './organClearance';
import { predictDecrementTimes } from './pharmacokineticModel';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const approach = (current: number, target: number, dt: number, tau: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / Math.max(0.1, tau)));

const PROFILE_OVERRIDES: Record<string, Partial<DrugBiotransformationProfile>> = {
  acepromazine: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Oxidação e conjugação hepática (CYP1A2/CYP2D)', enzymeSystem: 'CYP1A2/CYP2D', hepaticClearanceFraction: 0.90, renalClearanceFraction: 0.10, proteinBindingFraction: 0.92, apparentCentralVolumeLKg: 0.65, lipidSolubility: 0.85 },
  dexmedetomidine: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Glucuronidação direta e oxidação hepática (UGT/CYP2A6)', enzymeSystem: 'UGT/CYP2A6', hepaticClearanceFraction: 0.85, renalClearanceFraction: 0.15, proteinBindingFraction: 0.94, apparentCentralVolumeLKg: 0.50, lipidSolubility: 0.78 },
  xylazine: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Metabolização microssomal hepática (CYP)', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.88, renalClearanceFraction: 0.12, proteinBindingFraction: 0.70, apparentCentralVolumeLKg: 0.55, lipidSolubility: 0.72 },
  detomidine: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Oxidação e hidroxilação hepática (CYP)', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.90, renalClearanceFraction: 0.10, proteinBindingFraction: 0.85, apparentCentralVolumeLKg: 0.48, lipidSolubility: 0.75 },
  midazolam: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Hidroxilação hepática (CYP3A)', enzymeSystem: 'CYP3A', hepaticClearanceFraction: 0.86, renalClearanceFraction: 0.14, proteinBindingFraction: 0.95, apparentCentralVolumeLKg: 0.45, lipidSolubility: 0.82 },
  diazepam: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Desmetilação e hidroxilação hepática com metabólitos ativos (CYP3A/CYP2C)', enzymeSystem: 'CYP3A/CYP2C', hepaticClearanceFraction: 0.95, renalClearanceFraction: 0.05, proteinBindingFraction: 0.98, apparentCentralVolumeLKg: 0.40, lipidSolubility: 0.92, activeMetabolite: 'nordiazepam e oxazepam' },
  propofol: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Conjugação hepática e extra-hepática (pulmão/rim)', enzymeSystem: 'UGT', hepaticClearanceFraction: 0.65, renalClearanceFraction: 0.15, proteinBindingFraction: 0.98, apparentCentralVolumeLKg: 0.35, lipidSolubility: 0.95, extrahepaticClearanceFraction: 0.20 },
  morphine: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Glucuronidação hepática (UGT2B)', enzymeSystem: 'UGT2B', hepaticClearanceFraction: 0.78, renalClearanceFraction: 0.22, proteinBindingFraction: 0.35, apparentCentralVolumeLKg: 0.5, lipidSolubility: 0.55, activeMetabolite: 'metabólitos glucuronídeos' },
  methadone: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'N-desmetilação hepática (CYP3A/CYP2B)', enzymeSystem: 'CYP3A/CYP2B', hepaticClearanceFraction: 0.85, renalClearanceFraction: 0.15, proteinBindingFraction: 0.88, apparentCentralVolumeLKg: 0.65, lipidSolubility: 0.85, activeMetabolite: 'EDDP (inativo)' },
  fentanyl: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Oxidação hepática (CYP3A)', enzymeSystem: 'CYP3A', hepaticClearanceFraction: 0.90, renalClearanceFraction: 0.10, proteinBindingFraction: 0.84, apparentCentralVolumeLKg: 0.55, lipidSolubility: 0.98 },
  butorphanol: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Hidroxilação hepática (CYP)', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.85, renalClearanceFraction: 0.15, proteinBindingFraction: 0.80, apparentCentralVolumeLKg: 0.60, lipidSolubility: 0.70 },
  buprenorphine: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'N-desalquilação hepática (CYP3A) e glucuronidação', enzymeSystem: 'CYP3A/UGT', hepaticClearanceFraction: 0.88, renalClearanceFraction: 0.12, proteinBindingFraction: 0.96, apparentCentralVolumeLKg: 0.55, lipidSolubility: 0.88, activeMetabolite: 'norbuprenorfina' },
  tramadol: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'O-desmetilação (CYP2D) e N-desmetilação (CYP3A)', enzymeSystem: 'CYP2D/CYP3A', hepaticClearanceFraction: 0.82, renalClearanceFraction: 0.18, proteinBindingFraction: 0.20, apparentCentralVolumeLKg: 0.70, lipidSolubility: 0.60, activeMetabolite: 'O-desmetiltramadol (M1)' },
  ketamine: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'N-desmetilação hepática', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.82, renalClearanceFraction: 0.18, proteinBindingFraction: 0.28, apparentCentralVolumeLKg: 0.65, lipidSolubility: 0.78, activeMetabolite: 'norcetamina' },
  lidocaine_2pct: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Desalquilação hepática', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.88, renalClearanceFraction: 0.12, proteinBindingFraction: 0.65, apparentCentralVolumeLKg: 0.7, lipidSolubility: 0.72, activeMetabolite: 'MEGX/GX' },
  atracurium: { primaryPathway: 'hoffmann', pathwayLabel: 'Eliminação de Hofmann e hidrólise esterásica', hepaticClearanceFraction: 0.08, renalClearanceFraction: 0.08, proteinBindingFraction: 0.82, apparentCentralVolumeLKg: 0.18, lipidSolubility: 0.15, activeMetabolite: 'laudanosina' },
  remifentanil: { primaryPathway: 'plasma_esterase', pathwayLabel: 'Hidrólise por esterases plasmáticas', hepaticClearanceFraction: 0.05, renalClearanceFraction: 0.05, proteinBindingFraction: 0.7, apparentCentralVolumeLKg: 0.25, lipidSolubility: 0.7 },
  sodium_nitroprusside: { primaryPathway: 'none', pathwayLabel: 'Liberação de NO com formação de cianeto/tiocianato', hepaticClearanceFraction: 0.55, renalClearanceFraction: 0.45, proteinBindingFraction: 0.02, apparentCentralVolumeLKg: 0.2, lipidSolubility: 0.08, activeMetabolite: 'tiocianato' },
  hydralazine: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Acetilação e hidroxilação hepática', enzymeSystem: 'NAT', hepaticClearanceFraction: 0.78, renalClearanceFraction: 0.22, proteinBindingFraction: 0.9, apparentCentralVolumeLKg: 0.45, lipidSolubility: 0.4 },
  neostigmine: { primaryPathway: 'renal', pathwayLabel: 'Excreção renal e hidrólise', hepaticClearanceFraction: 0.25, renalClearanceFraction: 0.75, proteinBindingFraction: 0.2, apparentCentralVolumeLKg: 0.25, lipidSolubility: 0.05 },
  sugammadex: { primaryPathway: 'renal', pathwayLabel: 'Excreção renal do complexo encapsulado', hepaticClearanceFraction: 0.02, renalClearanceFraction: 0.98, proteinBindingFraction: 0.02, apparentCentralVolumeLKg: 0.2, lipidSolubility: 0.02 },
  naloxone: { primaryPathway: 'hepatic_phase_ii', pathwayLabel: 'Glucuronidação hepática rápida (UGT)', enzymeSystem: 'UGT', hepaticClearanceFraction: 0.85, renalClearanceFraction: 0.15, proteinBindingFraction: 0.45, apparentCentralVolumeLKg: 0.50, lipidSolubility: 0.65 },
  atipamezole: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Oxidação e hidroxilação hepática', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.88, renalClearanceFraction: 0.12, proteinBindingFraction: 0.85, apparentCentralVolumeLKg: 0.40, lipidSolubility: 0.70 },
  flumazenil: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Desalquilação hepática rápida', enzymeSystem: 'CYP', hepaticClearanceFraction: 0.90, renalClearanceFraction: 0.10, proteinBindingFraction: 0.50, apparentCentralVolumeLKg: 0.35, lipidSolubility: 0.60 },
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
  dispositionProfile?: DrugDispositionProfile;
  therapeuticWindow?: TherapeuticWindow;
  therapeuticBand?: TherapeuticWindow['bands'][number];
  contextSensitiveHalfTimeMin?: number;
  metaboliteExposure?: {
    name: string;
    amountNormalized: number;
    effectNormalized: number;
    isToxic: boolean;
    clinicalNote: string;
  };
  clearanceBreakdown?: OrganClearanceBreakdown;
  effectiveClearance: number;
  feedbackExplanation: string;
}

export const analyzePatientDrugKinetics = (
  patient: PatientProfile,
  dose: ActiveDrugDose,
  biological?: BiologicalState
): PatientDrugKinetics | undefined => {
  const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
  if (!drug) return undefined;
  const profile = resolveBiotransformationProfile(drug);
  const disposition = DRUG_DISPOSITION[drug.id];
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

  // Therapeutic window classification
  const window = getTherapeuticWindow(drug.id, patient.species);
  let concentrationForWindow: number | undefined = estimatedPlasmaConcentration;
  if (window && estimatedPlasmaConcentration !== undefined && window.unit === 'ng/mL') {
    concentrationForWindow = estimatedPlasmaConcentration * 1000;
  }
  const therapeuticBand = classifyConcentration(window, concentrationForWindow);

  // Clearance breakdown & predictions
  let clearanceBreakdown: OrganClearanceBreakdown | undefined;
  if (biological) {
    clearanceBreakdown = computeOrganClearance(patient, drug, biological, patient.baselineVitals.tempC);
  }

  const decrement = predictDecrementTimes(
    patient,
    drug,
    dose,
    clearanceBreakdown?.multiplier ?? 1.0,
    0.08,
    360
  );

  const metabolite = disposition?.metabolite;
  const metaboliteExposure = metabolite ? {
    name: metabolite.name,
    amountNormalized: state?.metaboliteAmountNormalized || 0,
    effectNormalized: state?.metaboliteEffectNormalized || 0,
    isToxic: metabolite.pdMode === 'toxic',
    clinicalNote: metabolite.clinicalNote,
  } : undefined;

  const hepaticCapacity = biological?.biotransformation?.hepaticEnzymeCapacity ?? 1.0;
  const renalCapacity = biological?.biotransformation?.renalFiltrationCapacity ?? 1.0;
  const effectiveClearance = clearanceBreakdown
    ? clearanceBreakdown.multiplier
    : profile.hepaticClearanceFraction * hepaticCapacity
      + profile.renalClearanceFraction * renalCapacity
      + Math.max(0, 1 - profile.hepaticClearanceFraction - profile.renalClearanceFraction);

  return {
    estimatedPlasmaConcentration,
    concentrationUnit: estimatedPlasmaConcentration === undefined ? 'índice relativo' : 'µg/mL',
    estimatedFreeConcentration: estimatedPlasmaConcentration === undefined ? undefined : estimatedPlasmaConcentration * (1 - (clearanceBreakdown?.freeFractionCurrent !== undefined ? (1 - clearanceBreakdown.freeFractionCurrent) : profile.proteinBindingFraction)),
    estimatedCentralAmountMg: estimatedPlasmaConcentration === undefined ? undefined : estimatedPlasmaConcentration * profile.apparentCentralVolumeLKg * patient.weightKg,
    plasmaTrend,
    centralFraction: central / distributionTotal,
    rapidTissueFraction: rapid / distributionTotal,
    deepTissueFraction: deep / distributionTotal,
    depotFraction: depot / distributionTotal,
    eliminatedFraction: eliminated / deliveredTotal,
    bioaccumulationLabel: tissueFraction > 0.62 ? 'elevada' : tissueFraction > 0.3 ? 'moderada' : 'mínima',
    profile,
    dispositionProfile: disposition,
    therapeuticWindow: window,
    therapeuticBand,
    contextSensitiveHalfTimeMin: decrement.contextSensitiveHalfTimeMin,
    metaboliteExposure,
    clearanceBreakdown,
    effectiveClearance,
    feedbackExplanation: effectiveClearance < 0.65
      ? `Depuração reduzida: ${clearanceBreakdown?.limitingFactor || 'perfusão orgânica diminuída'}; risco de bioacumulação.`
      : (biological?.biotransformation?.receptorAdaptiveFeedback ?? 0) > 0.2
        ? 'Exposição sustentada induz adaptação receptorial e menor resposta por unidade de concentração.'
        : 'Entrada, distribuição e depuração em equilíbrio fisiológico com o regime hemodinâmico.',
  };
};

export class BiotransformationEngine {
  public static step(
    dtSeconds: number,
    doses: ActiveDrugDose[],
    previous: BiologicalState['biotransformation'],
    hepaticPerfusion: number,
    renalPerfusion: number
  ): BiologicalState['biotransformation'] {
    let hepaticLoad = 0;
    let renalLoad = 0;
    let metaboliteDrive = 0;
    let toxicMetaboliteDrive = 0;
    let longestContinuousExposureHours = 0;

    // Track per-pathway substrate loads
    const pathwayLoads: Record<EnzymePathway, number> = {
      cyp3a: 0, cyp2b_2c: 0, cyp2d: 0, cyp1a2: 0, ugt: 0, sult: 0, nat: 0, esterase: 0, hofmann: 0, comt_mao: 0,
    };

    for (const dose of doses) {
      const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
      if (!drug) continue;
      const profile = resolveBiotransformationProfile(drug);
      const disposition = DRUG_DISPOSITION[drug.id];
      const cp = dose.currentCp;

      hepaticLoad += cp * profile.hepaticClearanceFraction;
      renalLoad += cp * profile.renalClearanceFraction;
      metaboliteDrive += cp * profile.hepaticClearanceFraction * (profile.activeMetabolite ? 0.45 : 0.12);

      // Metabolite accumulation
      if (disposition?.metabolite) {
        if (disposition.metabolite.pdMode === 'toxic') {
          toxicMetaboliteDrive += (dose.pkCompartments?.metaboliteAmountNormalized || 0) * 0.8;
        } else if (disposition.metabolite.pdMode === 'parent') {
          // e.g. MEGX or norcetamina under hypoperfusion
          if (hepaticPerfusion < 0.6 || renalPerfusion < 0.6) {
            toxicMetaboliteDrive += (dose.pkCompartments?.metaboliteAmountNormalized || 0) * 0.4;
          }
        }
      }

      // Distribute load among pathways
      if (disposition?.pathways) {
        for (const [p, share] of Object.entries(disposition.pathways) as [EnzymePathway, number][]) {
          pathwayLoads[p] = (pathwayLoads[p] || 0) + cp * share;
        }
      }

      const isToleranceSensitive = Boolean(drug.specialTraits?.isOpioid || drug.specialTraits?.isAlpha2Agonist || drug.specialTraits?.isSympathomimetic);
      if (isToleranceSensitive && dose.isCRI && dose.isInfusionRunning !== false) {
        longestContinuousExposureHours = Math.max(longestContinuousExposureHours, (dose.deliveryElapsedSec || 0) / 3600);
      }
    }

    // Step per-pathway Michaelis-Menten saturation and activity
    const enzymePathways: Record<string, { load: number; saturation: number; activity: number }> = {};
    for (const pathway of ENZYME_PATHWAYS) {
      const load = pathwayLoads[pathway];
      const km = ENZYME_PATHWAY_KM[pathway];
      const targetSat = clamp(load / (km + load));
      const prevSat = previous.enzymePathways?.[pathway]?.saturation ?? 0;
      const sat = approach(prevSat, targetSat, dtSeconds, targetSat > prevSat ? 45 : 360);
      const activity = clamp(1 - sat * 0.48, 0.12, 1.0);
      enzymePathways[pathway] = { load, saturation: sat, activity };
    }

    const hepaticSaturationTarget = clamp(hepaticLoad / (2.5 + hepaticLoad));
    const renalSaturationTarget = clamp(renalLoad / (3 + renalLoad));
    const hepaticEnzymeSaturation = approach(previous.hepaticEnzymeSaturation, hepaticSaturationTarget, dtSeconds, hepaticSaturationTarget > previous.hepaticEnzymeSaturation ? 45 : 420);
    const renalTransportSaturation = approach(previous.renalTransportSaturation, renalSaturationTarget, dtSeconds, renalSaturationTarget > previous.renalTransportSaturation ? 60 : 360);
    const metaboliteTarget = clamp(metaboliteDrive / 4);
    const toxicTarget = clamp(toxicMetaboliteDrive / 2.5);
    const adaptationTarget = clamp(longestContinuousExposureHours / 12, 0, 0.65);

    return {
      hepaticEnzymeSaturation,
      renalTransportSaturation,
      hepaticEnzymeCapacity: clamp(hepaticPerfusion * (1 - hepaticEnzymeSaturation * 0.48), 0.12, 1.15),
      renalFiltrationCapacity: clamp(renalPerfusion * (1 - renalTransportSaturation * 0.38), 0.12, 1.15),
      circulatingMetaboliteBurden: approach(previous.circulatingMetaboliteBurden, metaboliteTarget, dtSeconds, metaboliteTarget > previous.circulatingMetaboliteBurden ? 180 : 1800),
      toxicMetaboliteBurden: approach(previous.toxicMetaboliteBurden ?? 0, toxicTarget, dtSeconds, toxicTarget > (previous.toxicMetaboliteBurden ?? 0) ? 90 : 600),
      receptorAdaptiveFeedback: approach(previous.receptorAdaptiveFeedback, adaptationTarget, dtSeconds, adaptationTarget > previous.receptorAdaptiveFeedback ? 900 : 3600),
      enzymePathways,
    };
  }
}
