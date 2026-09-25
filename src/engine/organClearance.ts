import type { BiologicalState, DrugDefinition, PatientProfile } from '../types/simulator';
import { resolveBiotransformationProfile } from './biotransformationEngine';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';

const clamp = (n: number, min = 0.05, max = 1.15) => Math.min(max, Math.max(min, n));

/** Weight each elimination pathway separately: renal failure cannot abolish
 * plasma esterase clearance; feline UGT cannot suppress CYP-mediated clearance. */
export function getOrganClearanceModifier(patient: PatientProfile, drug: DrugDefinition, state: BiologicalState, temperature: number): number {
  const profile = resolveBiotransformationProfile(drug);
  const hepatic = profile.hepaticClearanceFraction;
  const renal = profile.renalClearanceFraction;
  const extra = Math.max(0, 1 - hepatic - renal);
  const total = Math.max(1, hepatic + renal);
  const thermal = clamp(1 - Math.max(0, 38 - temperature) * 0.09, 0.5, 1);
  const ugt = profile.primaryPathway === 'hepatic_phase_ii' && profile.enzymeSystem?.startsWith('UGT')
    ? SPECIES_CELLULAR_CONFIGS[patient.species].glucuronidationClearanceMultiplier : 1;
  const hepaticFunction = clamp(state.organPerfusion.hepaticFraction)
    * clamp(state.biotransformation.hepaticEnzymeCapacity)
    * clamp(1 - state.systemicRegulation.hepaticInjury * 0.7)
    * clamp(1 - (patient.pathologyConditions.hepaticDysfunctionSeverity ?? 0) * 0.85);
  const renalFunction = clamp(state.organPerfusion.renalFraction)
    * clamp(state.biotransformation.renalFiltrationCapacity)
    * clamp(1 - state.systemicRegulation.renalInjury * 0.8)
    * clamp(1 - (patient.pathologyConditions.renalDysfunctionSeverity ?? 0) * 0.9);
  // Hofmann degradation also slows in acidemia (modeled from accumulated debt).
  const extraFunction = profile.primaryPathway === 'hoffmann'
    ? thermal * clamp(1 - state.organPerfusion.cumulativeOxygenDebt * 0.4) : thermal;
  return clamp((hepatic * hepaticFunction * ugt * thermal + renal * renalFunction + extra * extraFunction) / total);
}
