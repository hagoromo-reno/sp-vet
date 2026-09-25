import type { ActiveDrugDose, DrugConcentrationPhase, DrugDefinition } from '../types/simulator';

export interface DrugExposureAnalysis {
  phase: DrugConcentrationPhase;
  phaseLabel: string;
  effectPercent: number;
  plasmaPercentOfPeak: number;
  estimatedEffectMinutesRemaining?: number;
}

const PHASE_LABELS: Record<DrugConcentrationPhase, string> = {
  transit: 'em trânsito', absorption: 'absorção', rising: 'efeito em ascensão',
  plateau: 'próximo ao pico', infusion: 'infusão / equilíbrio',
  washout: 'eliminação / washout', residual: 'efeito residual',
};

export const estimateEffectOffsetMinutes = (concentration: number, drug: DrugDefinition, isInfusionRunning: boolean): number | undefined => {
  if (isInfusionRunning) return undefined;

  // Cutoff below which clinical effect (hypnosis, deep sedation, surgical analgesia) is terminated
  const isInductionOrHypnotic = drug.category === 'induction' || drug.category === 'inhalation';
  const cutoffCe = isInductionOrHypnotic ? 0.20 : 0.15;
  if (concentration <= cutoffCe) return undefined;

  // A standard therapeutic bolus achieves peak Ce ~0.85-1.0 and lasts ~drug.durationMinutes.
  // Effective decay constant per half-time from peak to cutoff:
  const baseDuration = Math.max(1, drug.durationMinutes);
  const effectiveHalfTime = baseDuration / Math.max(1, Math.log2(1.0 / cutoffCe));

  // Dose-dependent offset: log2(Ce / cutoff) half-times until emergence
  const halfTimesRemaining = Math.log2(concentration / cutoffCe);
  const remaining = effectiveHalfTime * halfTimesRemaining;

  return Math.max(0.5, Math.round(remaining * 10) / 10);
};

export const analyzeDrugExposure = (dose: ActiveDrugDose, drug: DrugDefinition): DrugExposureAnalysis => {
  const inTransit = (dose.transitLagRemainingSec || 0) > 0;
  const deltaCp = dose.currentCp - (dose.previousCp ?? dose.currentCp);
  const deltaCe = dose.currentCe - (dose.previousCe ?? dose.currentCe);
  const isRunning = Boolean(dose.isCRI && dose.isInfusionRunning !== false);
  const hasDepot = (dose.pkCompartments?.absorptionDepotAmountNormalized || 0) > 0.002;
  let phase: DrugConcentrationPhase;
  if (inTransit) phase = 'transit';
  else if (isRunning) phase = 'infusion';
  else if (hasDepot && deltaCp > 0.00005) phase = 'absorption';
  else if (deltaCe > 0.00005) phase = 'rising';
  else if (Math.abs(deltaCe) <= 0.00005 && dose.currentCe > 0.05) phase = 'plateau';
  else if (dose.currentCe > 0.05 || dose.currentCp > 0.05) phase = 'washout';
  else phase = 'residual';

  const peakCp = Math.max(0.0001, dose.peakObservedCp || dose.currentCp);
  const effectPercent = Math.round((dose.currentCe ** 1.7 / (0.5 ** 1.7 + dose.currentCe ** 1.7)) * 100);
  return {
    phase,
    phaseLabel: PHASE_LABELS[phase],
    effectPercent: Math.max(0, Math.min(100, effectPercent)),
    plasmaPercentOfPeak: Math.max(0, Math.min(100, Math.round(dose.currentCp / peakCp * 100))),
    estimatedEffectMinutesRemaining: estimateEffectOffsetMinutes(dose.currentCe, drug, isRunning),
  };
};
