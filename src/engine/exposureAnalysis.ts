import type { ActiveDrugDose, DrugConcentrationPhase, DrugDefinition } from '../types/simulator';

export interface DrugExposureAnalysis {
  phase: DrugConcentrationPhase;
  phaseLabel: string;
  effectPercent: number;
  plasmaPercentOfPeak: number;
  estimatedEffectMinutesRemaining?: number;
  /** Whether the drug is producing clinically meaningful direct effect on the patient */
  isEffectActive: boolean;
  /** Human-readable clinical effect status */
  clinicalEffectStatus: 'efeito direto ativo' | 'efeito subterapêutico' | 'sem efeito clínico' | 'em trânsito';
  /** Fraction of total drug load that has been eliminated (0-1) */
  eliminatedFraction: number;
}

const PHASE_LABELS: Record<DrugConcentrationPhase, string> = {
  transit: 'em trânsito', absorption: 'absorção', rising: 'efeito em ascensão',
  plateau: 'próximo ao pico', infusion: 'infusão / equilíbrio',
  washout: 'eliminação / washout', residual: 'efeito residual',
};

/**
 * Determine the Ce threshold below which the drug has no clinically relevant
 * direct effect. For hypnotic / induction agents and volatile agents this is
 * higher because sub-anesthetic concentrations lose clinical sedation earlier.
 * For sympathomimetics (ephedrine, dobutamine) and short-acting vasoactives
 * the cutoff is even higher because the therapeutic window is narrower.
 */
const getClinicalCutoffCe = (drug: DrugDefinition): number => {
  if (drug.specialTraits?.isSympathomimetic) return 0.15;
  if (drug.category === 'induction' || drug.category === 'inhalation') return 0.12;
  if (drug.category === 'emergency_inotrope') return 0.12;
  if (drug.specialTraits?.isOpioid) return 0.08;
  return 0.08;
};

/**
 * Ce threshold below which even residual/subtherapeutic effects are negligible.
 */
const getSubtherapeuticCutoffCe = (drug: DrugDefinition): number => {
  if (drug.specialTraits?.isSympathomimetic) return 0.06;
  if (drug.category === 'induction') return 0.05;
  return 0.03;
};

export const estimateEffectOffsetMinutes = (
  concentration: number,
  drug: DrugDefinition,
  isInfusionRunning: boolean,
  pkCompartments?: ActiveDrugDose['pkCompartments']
): number | undefined => {
  if (isInfusionRunning) return undefined;

  const cutoffCe = getClinicalCutoffCe(drug);
  if (concentration <= cutoffCe) return undefined;

  // The clinical half-time for bolus offset is derived from drug.durationMinutes,
  // representing the time a typical therapeutic dose (Ce ≈ 1.0) takes to drop below
  // the clinical effect cutoff. Using beta elimination half-life alone overestimates
  // single-bolus duration (e.g. acepromazine 240min beta leading to >860min estimated).
  const nominalHalfTimesToCutoff = Math.max(1, Math.log2(1.0 / cutoffCe));
  const bolusEffectiveHalfTime = Math.max(0.5, drug.durationMinutes / nominalHalfTimesToCutoff);

  // If peripheral compartments are heavily loaded (e.g. following prolonged CRI or repeated boluses),
  // the context-sensitive half-time shifts toward the terminal beta elimination half-life.
  let effectiveHalfTime = bolusEffectiveHalfTime;
  if (pkCompartments) {
    const deepAmount = pkCompartments.deepPeripheralAmountNormalized || 0;
    const centralAmount = Math.max(0.001, pkCompartments.centralAmountNormalized || 0.001);
    const deepRatio = Math.min(1, deepAmount / (centralAmount * 3));
    effectiveHalfTime = bolusEffectiveHalfTime * (1 - deepRatio * 0.45)
      + Math.min(drug.halfLifeBeta, bolusEffectiveHalfTime * 2.0) * (deepRatio * 0.45);
  }

  // log2(Ce / cutoff) half-times until clinical effect ceases
  const halfTimesRemaining = Math.max(0, Math.log2(concentration / cutoffCe));
  const remaining = effectiveHalfTime * halfTimesRemaining;

  return Math.max(0.5, Math.round(remaining * 10) / 10);
};

export const analyzeDrugExposure = (dose: ActiveDrugDose, drug: DrugDefinition): DrugExposureAnalysis => {
  const inTransit = (dose.transitLagRemainingSec || 0) > 0;
  const deltaCp = dose.currentCp - (dose.previousCp ?? dose.currentCp);
  const deltaCe = dose.currentCe - (dose.previousCe ?? dose.currentCe);
  const isRunning = Boolean(dose.isCRI && dose.isInfusionRunning !== false);
  const hasDepot = (dose.pkCompartments?.absorptionDepotAmountNormalized || 0) > 0.002;

  // Determine the pharmacological phase
  let phase: DrugConcentrationPhase;
  const clinicalCutoff = getClinicalCutoffCe(drug);
  const subtherapeuticCutoff = getSubtherapeuticCutoffCe(drug);

  if (inTransit) phase = 'transit';
  else if (isRunning) phase = 'infusion';
  else if (hasDepot && deltaCp > 0.00005) phase = 'absorption';
  else if (deltaCe > 0.00005 && dose.currentCe > subtherapeuticCutoff) phase = 'rising';
  else if (Math.abs(deltaCe) <= 0.00005 && dose.currentCe > clinicalCutoff) phase = 'plateau';
  else if (dose.currentCe > clinicalCutoff) phase = 'washout';
  else if (dose.currentCe > subtherapeuticCutoff || dose.currentCp > subtherapeuticCutoff) phase = 'residual';
  else phase = 'residual';

  // Determine clinical effect status
  let isEffectActive: boolean;
  let clinicalEffectStatus: DrugExposureAnalysis['clinicalEffectStatus'];

  if (inTransit) {
    isEffectActive = false;
    clinicalEffectStatus = 'em trânsito';
  } else if (dose.currentCe >= clinicalCutoff) {
    isEffectActive = true;
    clinicalEffectStatus = 'efeito direto ativo';
  } else if (dose.currentCe >= subtherapeuticCutoff) {
    isEffectActive = false;
    clinicalEffectStatus = 'efeito subterapêutico';
  } else {
    isEffectActive = false;
    clinicalEffectStatus = 'sem efeito clínico';
  }

  // Calculate eliminated fraction from PK compartments
  const state = dose.pkCompartments;
  const currentBody = (state?.centralAmountNormalized || 0)
    + (state?.rapidPeripheralAmountNormalized || 0)
    + (state?.deepPeripheralAmountNormalized || 0)
    + (state?.absorptionDepotAmountNormalized || 0);
  const eliminated = state?.cumulativeEliminatedNormalized || 0;
  const totalDelivered = Math.max(0.000001, currentBody + eliminated);
  const eliminatedFraction = eliminated / totalDelivered;

  const peakCp = Math.max(0.0001, dose.peakObservedCp || dose.currentCp);
  const effectPercent = Math.round((dose.currentCe ** 1.7 / (0.5 ** 1.7 + dose.currentCe ** 1.7)) * 100);
  return {
    phase,
    phaseLabel: PHASE_LABELS[phase],
    effectPercent: Math.max(0, Math.min(100, effectPercent)),
    plasmaPercentOfPeak: Math.max(0, Math.min(100, Math.round(dose.currentCp / peakCp * 100))),
    estimatedEffectMinutesRemaining: estimateEffectOffsetMinutes(dose.currentCe, drug, isRunning, dose.pkCompartments),
    isEffectActive,
    clinicalEffectStatus,
    eliminatedFraction,
  };
};
