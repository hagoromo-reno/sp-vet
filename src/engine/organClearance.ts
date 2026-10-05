import type { BiologicalState, DrugDefinition, PatientProfile } from '../types/simulator';
import { resolveBiotransformationProfile } from './biotransformationEngine';
import {
  DRUG_DISPOSITION,
  ENZYME_PATHWAYS,
  EnzymePathway,
  SPECIES_ORGAN_PHYSIOLOGY,
} from './pk/speciesDrugDisposition';

const clamp = (n: number, min = 0.05, max = 1.15) => Math.min(max, Math.max(min, n));

/** Enzymatic Q10 ≈ 2.5 → ~9% activity loss per °C below 38 °C. */
export const enzymeThermalFactor = (temperatureC: number): number =>
  clamp(Math.pow(2.5, (Math.min(40, temperatureC) - 38) / 10), 0.3, 1.12);

/** Hofmann elimination is strongly temperature and pH dependent (slower in hypothermia/acidemia). */
export const hofmannFactor = (temperatureC: number, arterialPh = 7.4): number =>
  clamp(Math.pow(3.2, (temperatureC - 38) / 10) * (1 + (arterialPh - 7.4) * 1.6), 0.2, 1.2);

export interface OrganClearanceBreakdown {
  /** Overall multiplier applied to the calibrated k10 (1 = healthy reference). */
  multiplier: number;
  hepaticRatio: number;
  renalRatio: number;
  extraHepaticRatio: number;
  hepaticShare: number;
  renalShare: number;
  extraShare: number;
  extractionRatioReference: number;
  extractionRatioCurrent: number;
  freeFractionReference: number;
  freeFractionCurrent: number;
  hepaticBloodFlowMlMinKg: number;
  hepaticBloodFlowReferenceMlMinKg: number;
  gfrMlMinKg: number;
  hepaticClearanceMlMinKg: number;
  renalClearanceMlMinKg: number;
  extraHepaticClearanceMlMinKg: number;
  enzymeActivity: number;
  thermalFactor: number;
  /** 'flow-limited' (ER > 0.7), 'capacity-limited' (ER < 0.3) or intermediate. */
  clearanceRegime: 'limitada pelo fluxo' | 'limitada pela capacidade enzimática' | 'intermediária';
  limitingFactor: string;
}

/** Pathway-weighted enzymatic activity from the persistent biotransformation state. */
const drugEnzymeActivity = (drugId: string, state: BiologicalState): number => {
  const pathways = DRUG_DISPOSITION[drugId]?.pathways;
  const pathwayState = state.biotransformation.enzymePathways;
  if (!pathways || !pathwayState) return clamp(state.biotransformation.hepaticEnzymeCapacity, 0.1, 1.15);
  let weighted = 0;
  let total = 0;
  for (const pathway of ENZYME_PATHWAYS) {
    const share = pathways[pathway as EnzymePathway] || 0;
    if (share <= 0) continue;
    weighted += share * (pathwayState[pathway]?.activity ?? 1);
    total += share;
  }
  return total > 0 ? weighted / total : clamp(state.biotransformation.hepaticEnzymeCapacity, 0.1, 1.15);
};

/**
 * Physiological organ clearance.
 *
 * Hepatic: well-stirred model CLh = Qh·fu·CLint / (Qh + fu·CLint), with CLint
 * back-calculated from the canine extraction ratio. High-extraction drugs
 * (propofol, lidocaine, fentanyl, ketamine) therefore follow hepatic blood flow
 * (cardiac output), while low-extraction drugs (diazepam, thiopental) follow
 * enzyme activity and unbound fraction (albumin).
 * Renal: GFR (renal perfusion) × unbound-fraction shift × tubular saturation.
 * Extra-hepatic: plasma esterases, Hofmann degradation (temperature/pH), lung.
 * Species enzymatic differences are applied in the PK solver
 * (getSpeciesEliminationFactor) and are deliberately NOT repeated here.
 */
export function computeOrganClearance(
  patient: PatientProfile,
  drug: DrugDefinition,
  state: BiologicalState,
  temperatureC: number,
  arterialPh = 7.4,
): OrganClearanceBreakdown {
  const profile = resolveBiotransformationProfile(drug);
  const disposition = DRUG_DISPOSITION[drug.id];
  const organs = SPECIES_ORGAN_PHYSIOLOGY[patient.species] || SPECIES_ORGAN_PHYSIOLOGY.canine;
  const hepaticShareRaw = profile.hepaticClearanceFraction;
  const renalShareRaw = profile.renalClearanceFraction;
  const extraShareRaw = Math.max(0, 1 - hepaticShareRaw - renalShareRaw);
  const totalShare = Math.max(1, hepaticShareRaw + renalShareRaw + extraShareRaw);
  const hepaticShare = hepaticShareRaw / totalShare;
  const renalShare = renalShareRaw / totalShare;
  const extraShare = extraShareRaw / totalShare;

  const thermal = enzymeThermalFactor(temperatureC);
  const hepaticDysfunction = patient.pathologyConditions.hepaticDysfunctionSeverity ?? 0;
  const renalDysfunction = patient.pathologyConditions.renalDysfunctionSeverity ?? 0;

  // Unbound fraction: binding capacity proportional to albumin (when measured).
  const fuRef = Math.min(1, Math.max(0.005, 1 - profile.proteinBindingFraction));
  const albumin = patient.labMarkers?.albuminGDl;
  const albuminRatio = albumin && albumin > 0 ? clamp(albumin / organs.plasmaAlbuminGdl, 0.3, 1.4) : 1;
  // Acidemia displaces weakly basic, highly bound drugs (small effect).
  const acidemiaShift = arterialPh < 7.3 ? 1 + (7.3 - arterialPh) * 0.6 : 1;
  const fuNow = Math.min(1, (1 / (1 + (1 / fuRef - 1) * albuminRatio)) * acidemiaShift);

  // Hepatic (well-stirred).
  const erRef = clamp(disposition?.hepaticExtractionRatio ?? (hepaticShare > 0.7 ? 0.6 : 0.35), 0.01, 0.97);
  const qhRef = organs.hepaticBloodFlowMlMinKg;
  // Intrahepatic shunting in severe hepatopathy lowers the functionally perfused flow.
  const qhNow = qhRef * clamp(state.organPerfusion.hepaticFraction, 0.05, 1.2) * (1 - hepaticDysfunction * 0.5);
  const fuClintRef = qhRef * erRef / (1 - erRef);
  const enzymeActivity = drugEnzymeActivity(drug.id, state)
    * thermal
    * clamp(1 - state.systemicRegulation.hepaticInjury * 0.7, 0.05, 1)
    * clamp(1 - hepaticDysfunction * 0.85, 0.05, 1);
  const fuClintNow = fuClintRef * enzymeActivity * (fuNow / fuRef);
  const clhRef = qhRef * erRef;
  const clhNow = qhNow * fuClintNow / Math.max(0.0001, qhNow + fuClintNow);
  const erNow = clhNow / Math.max(0.0001, qhNow);
  const hepaticRatio = clamp(clhNow / clhRef, 0.03, 1.25);

  // Renal: filtration follows perfusion; secretion saturates.
  const renalFunction = clamp(state.organPerfusion.renalFraction, 0.03, 1.15)
    * clamp(1 - state.biotransformation.renalTransportSaturation * 0.38, 0.4, 1)
    * clamp(1 - state.systemicRegulation.renalInjury * 0.8, 0.05, 1)
    * clamp(1 - renalDysfunction * 0.9, 0.05, 1);
  const renalRatio = clamp(renalFunction * Math.pow(fuNow / fuRef, 0.7), 0.03, 1.3);

  // Extra-hepatic routes.
  const extraRatio = profile.primaryPathway === 'hoffmann'
    ? hofmannFactor(temperatureC, arterialPh) * clamp(1 - state.organPerfusion.cumulativeOxygenDebt * 0.3, 0.4, 1)
    : clamp(thermal, 0.4, 1.1);

  const multiplier = clamp(hepaticShare * hepaticRatio + renalShare * renalRatio + extraShare * extraRatio, 0.05, 1.15);

  const regime = erRef > 0.7 ? 'limitada pelo fluxo' : erRef < 0.3 ? 'limitada pela capacidade enzimática' : 'intermediária';
  const contributions: [string, number][] = [
    ['fluxo hepático', erRef > 0.5 ? clamp(qhNow / qhRef, 0, 2) : 1],
    ['atividade enzimática', erRef <= 0.7 ? enzymeActivity : 1],
    ['filtração renal', renalShare > 0.3 ? renalFunction : 1],
    ['hipotermia', thermal],
  ];
  const limiting = contributions.reduce((worst, item) => (item[1] < worst[1] ? item : worst), ['nenhum', 0.97] as [string, number]);

  const gfrNow = organs.gfrMlMinKg * renalFunction;
  const totalRefClearance = clhRef / Math.max(0.05, hepaticShare || 0.05);
  return {
    multiplier,
    hepaticRatio,
    renalRatio,
    extraHepaticRatio: extraRatio,
    hepaticShare,
    renalShare,
    extraShare,
    extractionRatioReference: erRef,
    extractionRatioCurrent: clamp(erNow, 0, 1),
    freeFractionReference: fuRef,
    freeFractionCurrent: fuNow,
    hepaticBloodFlowMlMinKg: qhNow,
    hepaticBloodFlowReferenceMlMinKg: qhRef,
    gfrMlMinKg: gfrNow,
    hepaticClearanceMlMinKg: clhNow,
    renalClearanceMlMinKg: totalRefClearance * renalShare * renalRatio,
    extraHepaticClearanceMlMinKg: totalRefClearance * extraShare * extraRatio,
    enzymeActivity,
    thermalFactor: thermal,
    clearanceRegime: regime,
    limitingFactor: limiting[1] < 0.97 ? `${limiting[0]} (${Math.round(limiting[1] * 100)}%)` : 'nenhum — depuração preservada',
  };
}

/** Weight each elimination pathway separately: renal failure cannot abolish
 * plasma esterase clearance; feline UGT cannot suppress CYP-mediated clearance. */
export function getOrganClearanceModifier(
  patient: PatientProfile,
  drug: DrugDefinition,
  state: BiologicalState,
  temperature: number,
  arterialPh = 7.4,
): number {
  return computeOrganClearance(patient, drug, state, temperature, arterialPh).multiplier;
}
