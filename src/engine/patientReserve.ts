import type { BiologicalState, PatientProfile } from '../types/simulator';

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Educational reserve ceiling: urgency alone (E) is not organ failure. */
export function getPatientReserveCapacity(patient: PatientProfile): number {
  const baseAsa = patient.asa.replace(/-?E$/, '') || 'I';
  const asaTable: Record<string, number> = { I: 1, II: 0.9, III: 0.75, IV: 0.55, V: 0.35, E: 1 };
  const asa = asaTable[baseAsa] ?? 1;

  const years = patient.ageYears + patient.ageMonths / 12;
  const oldAge = { canine: 9.5, feline: 11, equine: 18, bovine: 10 }[patient.species];
  const age = years < 0.6 || years >= oldAge ? 0.85 : 1;
  return clamp(asa * age * (patient.pathologyConditions.cardiacFailureDCM ? 0.85 : 1), 0.2, 1);
}

export function getCompensationStatus(patient: PatientProfile, state: BiologicalState): string {
  const r = state.systemicRegulation;
  const fraction = r.compensatoryReserve / getPatientReserveCapacity(patient);
  const debt = state.organPerfusion.cumulativeOxygenDebt;
  if (fraction < 0.45 && (r.cellularHypoxia > 0.3 || debt > 0.35)) return 'Descompensação';
  if (r.cellularHypoxia > 0.12 || debt > 0.12 || r.myocardialStress > 0.2) return 'Compensação sob estresse';
  if (fraction < 0.85 || r.hepaticInjury > 0.05 || r.renalInjury > 0.05) return 'Recuperação de reserva';
  return 'Reserva preservada';
}
