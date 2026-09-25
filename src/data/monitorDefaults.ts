import { SPECIES_DATABASE } from './speciesData';
import { SPECIES_CELLULAR_CONFIGS } from '../engine/speciesPhysiology';
import type { MonitorAlarmLimits, SpeciesType } from '../types/simulator';

/** Educational starting limits derived from species references, not anesthetic treatment targets. */
export function speciesAlarmLimits(species: SpeciesType, isAudioMuted = false): MonitorAlarmLimits {
  const normal = SPECIES_DATABASE[species].normalVitals;
  return { hrLow: Math.round(normal.hrMin * .8), hrHigh: Math.round(normal.hrMax * 1.15),
    mapLow: SPECIES_CELLULAR_CONFIGS[species].criticalMapThresholdMmHg, mapHigh: 120,
    spo2Low: 94, etco2Low: 30, etco2High: 50,
    tempLow: 36.5, tempHigh: Math.max(39.5, normal.tempMaxC), isAudioMuted };
}
