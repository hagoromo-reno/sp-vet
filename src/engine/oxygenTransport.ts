import type { SpeciesType } from '../types/simulator';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';

/** Shared educational calibration, not a measured clinical DO2 critical value. */
export function getOxygenDeliveryThresholds(species: SpeciesType) {
  const demand = SPECIES_CELLULAR_CONFIGS[species].oxygenConsumptionMlKgMin;
  return { critical: demand * 1.5, recovery: demand * 1.8, reserve: demand * 0.8 };
}

export function getOxygenDeliveryDeficit(species: SpeciesType, delivery: number, utilization = 1): number {
  const { critical } = getOxygenDeliveryThresholds(species);
  return Math.min(1, Math.max(0, (critical - delivery * utilization) / critical));
}

/** Lactate is handled through oxidative metabolism/gluconeogenesis, not UGT. */
export function getLactateClearanceMultiplier(hepaticPerfusion: number, renalPerfusion: number): number {
  return Math.min(1.1, Math.max(0.05, hepaticPerfusion * 0.7 + renalPerfusion * 0.3));
}
