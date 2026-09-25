import type { ActiveDrugDose, AnesthesiaEquipmentState, BiologicalState, PatientProfile } from '../types/simulator';
import type { PhysiologicalSignal } from './systemCoupling';
import { SPECIES_DATABASE } from '../data/speciesData';

const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
const finite = (x: number) => Number.isFinite(x) ? Math.max(0, x) : 0;
export const FLUID_SOLUTIONS = [
  { name: 'Ringer com Lactato (LRS)', kind: 'balanced', sodium: 130, chloride: 109, glucoseMgMl: 0 },
  { name: 'NaCl 0.9% (Fisiológico)', kind: 'saline', sodium: 154, chloride: 154, glucoseMgMl: 0 },
  { name: 'Salina Hipertônica 7.2%', kind: 'hypertonic', sodium: 1232, chloride: 1232, glucoseMgMl: 0 },
  { name: 'Hetastarch (Coloide)', kind: 'colloid', sodium: 154, chloride: 154, glucoseMgMl: 0 },
  { name: 'Sangue Total Fresco', kind: 'blood', sodium: 145, chloride: 110, glucoseMgMl: 0 },
  { name: 'Glicose 5% em água', kind: 'dextrose', sodium: 0, chloride: 0, glucoseMgMl: 50 },
  { name: 'Ringer com Lactato + Glicose 2.5%', kind: 'balanced', sodium: 130, chloride: 109, glucoseMgMl: 25 },
] as const;

export function fluidSolution(name: string) {
  const exact = FLUID_SOLUTIONS.find(fluid => fluid.name === name);
  if (exact) return exact;
  const label = name.toLowerCase();
  if (/sangue|blood/.test(label)) return FLUID_SOLUTIONS[4];
  if (/hipert|hyperton/.test(label)) return FLUID_SOLUTIONS[2];
  if (/starch|coloide/.test(label)) return FLUID_SOLUTIONS[3];
  if (/nacl|fisiol/.test(label)) return FLUID_SOLUTIONS[1];
  return FLUID_SOLUTIONS[0];
}
export interface FluidDelivery { fluidName: string; volumeMl: number }
export const FLUID_DRUG_NAMES: Record<string, string> = {
  fluid_lrs: FLUID_SOLUTIONS[0].name, hypertonic_saline_72: FLUID_SOLUTIONS[2].name, whole_blood: FLUID_SOLUTIONS[4].name,
};

/** Actual mL delivered, never effect-site concentration. All entry points use this ledger. */
export function advanceFluidDelivery(dt: number, equipment: AnesthesiaEquipmentState, doses: ActiveDrugDose[] = [], updatedDoses: ActiveDrugDose[] = []) {
  const seconds = finite(dt);
  const deliveries: FluidDelivery[] = [];
  if (equipment.isFluidPumpRunning) deliveries.push({ fluidName: equipment.activeFluidType, volumeMl: finite(equipment.fluidRateMlPerHour) * seconds / 3600 });
  const fluidBoluses = (equipment.fluidBoluses ?? []).map(bolus => {
    const volume = finite(bolus.volumeMl);
    const delivered = clamp(finite(bolus.deliveredMl), 0, volume);
    const increment = bolus.isRunning ? Math.min(volume - delivered, volume * seconds / Math.max(1, finite(bolus.durationSec))) : 0;
    if (increment > 0) deliveries.push({ fluidName: bolus.fluidName, volumeMl: increment });
    return { ...bolus, deliveredMl: delivered + increment, isRunning: bolus.isRunning && delivered + increment < volume - 1e-8 };
  });
  for (const dose of doses) {
    const fluidName = FLUID_DRUG_NAMES[dose.drugId];
    if (!fluidName) continue;
    const updated = updatedDoses.find(candidate => candidate.id === dose.id);
    const activeSeconds = Math.max(0, seconds - (dose.transitLagRemainingSec ?? 0));
    const duration = Math.max(0.1, dose.deliveryDurationSec ?? 1);
    const volumeMl = dose.isCRI
      ? (dose.isInfusionRunning !== false ? finite(dose.criRateMlPerHour ?? 0) * activeSeconds / 3600 : 0)
      : finite(dose.volumeMl) * Math.max(0, Math.min(1, (updated?.deliveryElapsedSec ?? dose.deliveryElapsedSec ?? 0) / duration) - Math.min(1, (dose.deliveryElapsedSec ?? 0) / duration));
    if (volumeMl > 0) deliveries.push({ fluidName, volumeMl });
  }
  return { deliveries, fluidBoluses, totalFluidsInfusedMl: finite(equipment.totalFluidsInfusedMl) + deliveries.reduce((sum, delivery) => sum + delivery.volumeMl, 0) };
}

/** Educational volume-kinetic model. Parameters and limits are documented, not a dosing calculator. */
export function stepFluidBalance(dt: number, patient: PatientProfile, state: BiologicalState, deliveries: FluidDelivery[]): BiologicalState['fluids'] {
  const f = { ...state.fluids };
  const weight = Math.max(0.1, patient.weightKg);
  const seconds = finite(dt);
  const expectedBlood = weight * SPECIES_DATABASE[patient.species].bloodVolumeMlPerKg;
  const deficit = Math.max(0, expectedBlood - patient.baselineVitals.bloodVolumeMl, expectedBlood * (patient.pathologyConditions.hypovolemiaSeverity ?? 0) * 0.45, patient.pathologyConditions.traumaHemorrhage ? expectedBlood * 0.3 : 0);
  const leak = clamp((patient.pathologyConditions.sepsisVasodilation ? 0.5 : 0) + state.systemicRegulation.endothelialDysfunction * 0.5);
  const intrinsicRenal = clamp(1 - (patient.pathologyConditions.renalDysfunctionSeverity ?? 0), 0.02, 1);
  const renal = clamp(state.organPerfusion.renalFraction * intrinsicRenal * (1 - state.systemicRegulation.renalInjury * 0.65), 0.01, 1.1);
  f.interstitialMl ??= 0; f.eliminatedMl ??= 0; f.deliveredMl ??= 0;
  f.sodiumExcessMmol ??= 0; f.chlorideExcessMmol ??= 0; f.baseDeficitMmol ??= 0; f.freeWaterMl ??= 0;
  f.lastDeliveryMl = deliveries.reduce((sum, d) => sum + finite(d.volumeMl), 0);
  f.currentDeliveryMlPerHour = seconds > 0 ? f.lastDeliveryMl * 3600 / seconds : 0;
  f.glucoseInputMg = 0;
  // Substeps keep exchange, diuresis and composition consistent across simulation speeds.
  const count = Math.max(1, Math.ceil(seconds / 2));
  const h = seconds / count;
  for (let step = 0; step < count; step++) {
    for (const delivery of deliveries) {
      const solution = fluidSolution(delivery.fluidName);
      const ml = finite(delivery.volumeMl) / count;
      f.deliveredMl += ml;
      f.glucoseInputMg += ml * solution.glucoseMgMl;
      if (solution.kind === 'blood') f.wholeBloodCentralMl += ml;
      else if (solution.kind === 'colloid') f.colloidCentralMl += ml;
      else {
        f.crystalloidCentralMl += ml;
        if (solution.kind === 'dextrose') f.freeWaterMl += ml;
        if (solution.kind === 'hypertonic') f.hypertonicExpansionMl += ml * 2.2 * clamp(1 - deficit / expectedBlood, 0.3, 1);
      }
      if (solution.kind !== 'blood') {
        f.sodiumExcessMmol += ml / 1000 * (solution.sodium - 145);
        f.chlorideExcessMmol += ml / 1000 * (solution.chloride - 110);
        if (solution.kind === 'saline' || solution.kind === 'hypertonic' || solution.kind === 'colloid') f.baseDeficitMmol += ml / 1000 * 35;
      }
    }
    f.hypertonicExpansionMl *= Math.exp(-Math.LN2 * h / 1500);
    const colloidLeak = f.colloidCentralMl * (1 - Math.exp(-h * (1 + leak * 3) / 14400));
    f.colloidCentralMl -= colloidLeak; f.interstitialMl += colloidLeak;
    const totalCrystalloid = f.crystalloidCentralMl + f.interstitialMl;
    const fillingDeficit = Math.max(0, deficit - f.wholeBloodCentralMl - f.colloidCentralMl - f.hypertonicExpansionMl);
    const freeFraction = clamp(f.freeWaterMl / Math.max(1, totalCrystalloid));
    const equilibriumCentral = totalCrystalloid * (0.25 - freeFraction * 0.17) * (1 - leak * 0.4)
      + Math.min(totalCrystalloid * 0.35, fillingDeficit * 0.5);
    const exchange = (f.crystalloidCentralMl - equilibriumCentral) * (1 - Math.exp(-h * (1 + leak) / 600));
    f.crystalloidCentralMl -= exchange; f.interstitialMl += exchange;
    const expansion = f.crystalloidCentralMl + f.colloidCentralMl + f.wholeBloodCentralMl + f.hypertonicExpansionMl;
    const overload = Math.max(0, expansion - deficit) / expectedBlood;
    const retention = clamp((expansion + 1) / (deficit + 1), 0.08, 1);
    const removable = Math.max(0, f.crystalloidCentralMl + f.interstitialMl);
    const osmoticDiuresis = Math.max(0, state.metabolic.bloodGlucoseMgDl - 180) / 120;
    const renalCapacityMlH = weight * (1 + overload * 18 + osmoticDiuresis) * renal * retention * (1 - (f.congestionSeverity ?? 0) * 0.6);
    const eliminated = Math.min(removable, renalCapacityMlH * h / 3600, removable * (1 - Math.exp(-h * renal / 3600)));
    const centralShare = f.crystalloidCentralMl / Math.max(0.001, removable);
    f.crystalloidCentralMl -= eliminated * centralShare; f.interstitialMl -= eliminated * (1 - centralShare);
    f.eliminatedMl += eliminated;
    const washout = 1 - eliminated / Math.max(1, removable);
    f.freeWaterMl *= washout; f.sodiumExcessMmol *= washout; f.chlorideExcessMmol *= washout;
    f.baseDeficitMmol *= Math.exp(-h * renal / 7200);
    f.renalOutputMlKgHour = h > 0 ? eliminated / weight * 3600 / h : 0;
  }
  f.effectiveCirculatingExpansionMl = f.crystalloidCentralMl + f.hypertonicExpansionMl + f.colloidCentralMl + f.wholeBloodCentralMl;
  const circulatingBlood = Math.max(1, expectedBlood - deficit);
  const redCells = circulatingBlood * patient.baselineVitals.hctPct / 100 + f.wholeBloodCentralMl * 0.4;
  f.currentHematocritPct = clamp(100 * redCells / (circulatingBlood + f.effectiveCirculatingExpansionMl), 5, 65);
  const ecfL = weight * 0.2 + (f.crystalloidCentralMl + f.interstitialMl) / 1000;
  f.sodiumMmolL = clamp(145 + f.sodiumExcessMmol / ecfL, 90, 210);
  f.chlorideMmolL = clamp(110 + f.chlorideExcessMmol / ecfL, 60, 180);
  f.fluidBaseDeficitMmolL = clamp(f.baseDeficitMmol / ecfL, 0, 18);
  const tolerance = patient.pathologyConditions.cardiacFailureDCM ? 0.08 : 0.25;
  const excessCentral = Math.max(0, f.effectiveCirculatingExpansionMl - deficit) / expectedBlood;
  const congestionTarget = clamp((excessCentral - tolerance) / 0.5);
  f.congestionSeverity = (f.congestionSeverity ?? 0) + (congestionTarget - (f.congestionSeverity ?? 0)) * (1 - Math.exp(-seconds / 45));
  const interstitialExcess = Math.max(0, f.interstitialMl - deficit * 0.6) / weight;
  const edemaTarget = clamp(f.congestionSeverity * 0.8 + Math.max(0, interstitialExcess - 25) / 110 * (0.3 + leak));
  f.pulmonaryEdemaSeverity = (f.pulmonaryEdemaSeverity ?? 0) + (edemaTarget - (f.pulmonaryEdemaSeverity ?? 0)) * (1 - Math.exp(-seconds / (edemaTarget > (f.pulmonaryEdemaSeverity ?? 0) ? 120 : 1800)));
  return f;
}

export function fluidPhysiologicalSignals(state: BiologicalState): PhysiologicalSignal[] {
  const f = state.fluids;
  const signals: PhysiologicalSignal[] = [];
  const congestion = f.congestionSeverity ?? 0;
  if (congestion > 0.02) signals.push({ id: 'fluid-congestion', source: 'cardiovascular', targets: ['renal', 'hepatico', 'cardiovascular'], topology: 'one-to-many', severity: congestion, label: 'Congestão por sobrecarga reduz perfusão orgânica e eficiência cardíaca', effects: { renalPerfusionMultiplier: 1 - congestion * 0.5, hepaticPerfusionMultiplier: 1 - congestion * 0.25, contractilityMultiplier: 1 - congestion * 0.25 } });
  const edema = f.pulmonaryEdemaSeverity ?? 0;
  if (edema > 0.02) signals.push({ id: 'fluid-pulmonary-edema', source: 'cardiovascular', targets: ['respiratorio'], topology: 'one-to-one', severity: edema, label: 'Edema intersticial pulmonar amplia shunt e esforço ventilatório', effects: { respiratoryDriveMultiplier: 1 + edema * 0.35 } });
  const acid = clamp((f.fluidBaseDeficitMmolL ?? 0) / 12);
  if (acid > 0.05) signals.push({ id: 'fluid-hyperchloremia', source: 'metabolico', targets: ['cardiovascular', 'renal'], topology: 'one-to-many', severity: acid, label: 'Carga de cloreto provoca acidose e reduz responsividade vascular', effects: { adrenergicResponsiveness: 1 - acid * 0.2, renalPerfusionMultiplier: 1 - acid * 0.15 } });
  const sodiumBurden = clamp(Math.max(0, Math.abs((f.sodiumMmolL ?? 145) - 145) - 10) / 40);
  if (sodiumBurden > 0.02) signals.push({ id: 'fluid-dysnatremia', source: 'metabolico', targets: ['neurologico', 'cardiovascular'], topology: 'one-to-many', severity: sodiumBurden, label: 'Distúrbio osmótico por composição e acúmulo de fluidos', effects: { respiratoryDriveMultiplier: 1 - sodiumBurden * 0.2, contractilityMultiplier: 1 - sodiumBurden * 0.1, arrhythmogenicBurden: sodiumBurden * 0.15 } });
  return signals;
}
