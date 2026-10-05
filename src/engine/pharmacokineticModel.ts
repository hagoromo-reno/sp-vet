import type {
  ActiveDrugDose,
  DrugDefinition,
  PatientProfile,
  SpeciesType,
} from '../types/simulator';
import { getRoutePharmacokinetics, isExtravascularRoute, isTimeBasedDoseUnit } from './drugAdministration';
import { resolveBiotransformationProfile } from './biotransformationEngine';
import {
  DRUG_DISPOSITION,
  getMetaboliteFormationFraction,
  getMetaboliteHalfLifeMin,
  getSpeciesEliminationFactor,
} from './pk/speciesDrugDisposition';

type PKState = NonNullable<ActiveDrugDose['pkCompartments']>;

export interface PharmacokineticStepResult {
  currentCp: number;
  currentCe: number;
  deliveryElapsedSec: number;
  isFullyDelivered: boolean;
  pkCompartments: PKState;
}

export const CENTRAL_VOLUME_SCALE: Record<SpeciesType, number> = {
  canine: 1,
  feline: 0.9,
  equine: 1.12,
  bovine: 1.18,
};

const concentrationUnitScale = (unit?: string): number => {
  if (!unit) return 1;
  if (unit.startsWith('mcg')) return 0.001;
  if (unit.startsWith('g/')) return 1000;
  return 1;
};

const ratePerMinute = (rate: number, unit?: string): number => (
  unit?.endsWith('/h') ? rate / 60 : rate
);

const freshState = (dose: ActiveDrugDose): PKState => ({
  centralAmountNormalized: Math.max(0, dose.currentCp),
  rapidPeripheralAmountNormalized: 0,
  deepPeripheralAmountNormalized: 0,
  absorptionDepotAmountNormalized: 0,
  cumulativeDeliveredNormalized: Math.max(0, dose.currentCp),
  cumulativeEliminatedNormalized: 0,
  bioavailableFraction: 1,
  effectiveClearanceMultiplier: 1,
  depotWasLoaded: false,
  metaboliteAmountNormalized: 0,
  metaboliteEffectNormalized: 0,
  cumulativeMetaboliteFormedNormalized: 0,
});

export interface PkMicroConstants {
  /** min⁻¹ */
  k10: number;
  k12: number;
  k21: number;
  k13: number;
  k31: number;
  ke0: number;
  vcScale: number;
  speciesEliminationFactor: number;
  speciesSource: string;
  /** Unscaled k10 for the healthy reference patient of the same species. */
  referenceK10: number;
  k10Factor: number;
  beta: number;
}

/**
 * Micro-constants of the open mammillary model. Canine catalog half-lives are
 * the calibrated reference; species differences enter only through k10
 * (CL/V, literature or enzyme-predicted), keeping distribution physiology intact.
 */
export function getPkMicroConstants(
  patient: PatientProfile,
  drug: DrugDefinition,
  systemicClearanceModifier = 1,
): PkMicroConstants {
  const bioProfile = resolveBiotransformationProfile(drug);
  const lipidSolubility = bioProfile.lipidSolubility ?? 0.5;
  const alpha = Math.LN2 / Math.max(0.1, drug.halfLifeAlpha);
  const beta = Math.LN2 / Math.max(0.2, drug.halfLifeBeta);
  const k12 = Math.max(0.001, (alpha - beta) * 0.52);
  const k21k12Ratio = Math.max(0.18, 0.55 - lipidSolubility * 0.35);
  const k21 = Math.max(0.001, k12 * k21k12Ratio);
  const deepUptakeFactor = Math.max(0.10, 0.10 + lipidSolubility * 0.18);
  const k13 = Math.max(0.0002, beta * deepUptakeFactor);
  const k31 = Math.max(0.0008, beta * Math.max(0.20, 0.35 - lipidSolubility * 0.15));
  const hepaticFraction = bioProfile.hepaticClearanceFraction;
  const k10Factor = hepaticFraction > 0.7 ? 0.95 : hepaticFraction > 0.3 ? 0.82 : 0.70;
  const species = getSpeciesEliminationFactor(drug, patient.species, hepaticFraction);
  const clearance = Math.max(0.08, systemicClearanceModifier * species.factor);
  const referenceK10 = Math.max(0.0005, beta * k10Factor * species.factor);
  return {
    k10: Math.max(0.0005, beta * k10Factor * clearance),
    k12,
    k21,
    k13,
    k31,
    ke0: drug.ke0,
    vcScale: CENTRAL_VOLUME_SCALE[patient.species] || 1,
    speciesEliminationFactor: species.factor,
    speciesSource: species.source,
    referenceK10,
    k10Factor,
    beta,
  };
}

/**
 * Open mammillary model with central, rapidly equilibrating, deep tissue and
 * effect-site compartments. Concentrations remain normalized to a usual
 * clinical bolus, allowing the heterogeneous catalog units to share one solver.
 *
 * Micro-constants are derived from the drug's alpha (distribution) and beta
 * (elimination) half-lives. The deep peripheral compartment (k13/k31) now
 * represents true slow tissue equilibration governed exclusively by beta
 * kinetics and lipid solubility, rather than using the clinical offset which
 * previously inverted the trapping ratio for short-acting lipophilic drugs.
 *
 * Prolonged infusion accumulates drug in peripheral tissues. Redistribution
 * continues after stopping the pump; clearance does not switch at pump stop.
 * The hepatic share of eliminated mass forms the primary metabolite, which has
 * its own species-specific elimination and biophase (active metabolites such as
 * norketamine, nordiazepam and MEGX extend the clinical effect).
 * These normalized educational parameters are not a clinical TCI model.
 */
export class PharmacokineticModel {
  public static step(
    dtSeconds: number,
    patient: PatientProfile,
    drug: DrugDefinition,
    dose: ActiveDrugDose,
    typicalBolusDosePerKg: number,
    typicalCriRatePerKg: number | undefined,
    systemicClearanceModifier: number,
    peripheralPerfusion: number = 1,
    absorptionRateMultiplier: number = 1,
    metaboliteClearanceModifier: number = systemicClearanceModifier,
  ): PharmacokineticStepResult {
    const state: PKState = { ...(dose.pkCompartments ?? freshState(dose)) };
    const route = getRoutePharmacokinetics(drug, dose.route);
    const priorTransitLag = Math.max(0, dose.transitLagRemainingSec || 0);
    const activeSeconds = priorTransitLag <= 0 ? dtSeconds : Math.max(0, dtSeconds - priorTransitLag);
    let deliveryElapsedSec = dose.deliveryElapsedSec || 0;
    let isFullyDelivered = dose.isFullyDelivered || false;

    if (activeSeconds <= 0) {
      return {
        currentCp: dose.currentCp,
        currentCe: dose.currentCe,
        deliveryElapsedSec,
        isFullyDelivered,
        pkCompartments: state,
      };
    }

    const normalizedBolus = Math.max(0, dose.dosePerKg / Math.max(0.000001, typicalBolusDosePerKg));
    const micro = getPkMicroConstants(patient, drug, systemicClearanceModifier);
    const { k12, k21, k13, k31, vcScale } = micro;
    const effectiveK10 = micro.k10;
    state.effectiveClearanceMultiplier = Math.max(0.08, systemicClearanceModifier * micro.speciesEliminationFactor);
    state.speciesEliminationFactor = micro.speciesEliminationFactor;
    state.bioavailableFraction = route.bioavailability;

    const bioProfile = resolveBiotransformationProfile(drug);
    const metabolite = DRUG_DISPOSITION[drug.id]?.metabolite;
    const formationFraction = metabolite
      ? getMetaboliteFormationFraction(metabolite, patient.species) * Math.min(1, bioProfile.hepaticClearanceFraction + 0.1)
      : 0;
    const metaboliteK = metabolite
      ? Math.LN2 / Math.max(1, getMetaboliteHalfLifeMin(metabolite, patient.species)) * Math.max(0.08, metaboliteClearanceModifier)
      : 0;
    const metaboliteKe0 = Math.max(0.02, drug.ke0 * 0.5);

    const effectivePerfusion = Math.min(1.2, Math.max(0.08, peripheralPerfusion)) * Math.max(0.5, Math.min(1.5, absorptionRateMultiplier));
    const ka = route.absorptionHalfLifeMinutes > 0
      ? Math.LN2 / route.absorptionHalfLifeMinutes * effectivePerfusion
      : 0;

    let directCentralInput = 0;
    if (dose.isCRI) {
      deliveryElapsedSec += activeSeconds;
      isFullyDelivered = dose.isInfusionRunning === false;
    } else if (isExtravascularRoute(dose.route)) {
      if (!state.depotWasLoaded) {
        state.absorptionDepotAmountNormalized += normalizedBolus * route.bioavailability;
        state.cumulativeDeliveredNormalized += normalizedBolus * route.bioavailability;
        state.depotWasLoaded = true;
      }
      deliveryElapsedSec += activeSeconds;
    } else {
      const deliveryDuration = Math.max(0.1, dose.deliveryDurationSec || 1);
      const previousFraction = Math.min(1, deliveryElapsedSec / deliveryDuration);
      deliveryElapsedSec += activeSeconds;
      const nextFraction = Math.min(1, deliveryElapsedSec / deliveryDuration);
      directCentralInput = normalizedBolus * Math.max(0, nextFraction - previousFraction);
      state.cumulativeDeliveredNormalized += directCentralInput;
      isFullyDelivered = nextFraction >= 1;
    }

    const substeps = Math.max(1, Math.ceil(activeSeconds / 1.5));
    const hMin = activeSeconds / substeps / 60;
    let effectSite = Math.max(0, dose.currentCe);
    let metaboliteAmount = Math.max(0, state.metaboliteAmountNormalized || 0);
    let metaboliteEffect = Math.max(0, state.metaboliteEffectNormalized || 0);
    let metaboliteFormed = Math.max(0, state.cumulativeMetaboliteFormedNormalized || 0);

    for (let index = 0; index < substeps; index += 1) {
      let inputThisStep = directCentralInput / substeps;

      if (dose.isCRI && dose.isInfusionRunning !== false && (dose.criRatePerKgMin || 0) > 0) {
        const rateUnit = drug.criDoseUnit || drug.doseUnit;
        const configuredRate = (dose.criRatePerKgMin || 0) * concentrationUnitScale(rateUnit);
        const typicalRate = Math.max(
          0.000001,
          ratePerMinute(typicalCriRatePerKg || dose.dosePerKg, rateUnit) * concentrationUnitScale(rateUnit)
        );
        // A prescribed pump delivers fixed mass/time, independent of patient Cp
        // and clearance. Dual-mode products share the bolus mass normalization.
        // Rate-only products use a fixed healthy-reference steady-state scale.
        const referenceAmount = isTimeBasedDoseUnit(drug.doseUnit)
          ? typicalRate / (micro.referenceK10 * vcScale)
          : typicalBolusDosePerKg * concentrationUnitScale(drug.doseUnit);
        const inputRate = configuredRate / Math.max(0.000001, referenceAmount);
        inputThisStep += inputRate * hMin;
        state.cumulativeDeliveredNormalized += inputRate * hMin;
      }

      if (state.absorptionDepotAmountNormalized > 0 && ka > 0) {
        const absorbed = state.absorptionDepotAmountNormalized * (1 - Math.exp(-ka * hMin));
        state.absorptionDepotAmountNormalized -= absorbed;
        inputThisStep += absorbed;
      }

      const central = Math.max(0, state.centralAmountNormalized + inputThisStep);
      const rapid = Math.max(0, state.rapidPeripheralAmountNormalized);
      const deep = Math.max(0, state.deepPeripheralAmountNormalized);
      const totalOutRate = k12 + k13 + effectiveK10;
      const outflow = central * (1 - Math.exp(-totalOutRate * hMin));
      const toRapid = outflow * k12 / totalOutRate;
      const toDeep = outflow * k13 / totalOutRate;
      const eliminated = outflow * effectiveK10 / totalOutRate;
      const fromRapid = rapid * (1 - Math.exp(-k21 * hMin));
      const fromDeep = deep * (1 - Math.exp(-k31 * hMin));

      state.centralAmountNormalized = Math.max(0, central - toRapid - toDeep - eliminated + fromRapid + fromDeep);
      state.rapidPeripheralAmountNormalized = Math.max(0, rapid + toRapid - fromRapid);
      state.deepPeripheralAmountNormalized = Math.max(0, deep + toDeep - fromDeep);
      state.cumulativeEliminatedNormalized += Math.max(0, eliminated);

      const plasma = state.centralAmountNormalized / vcScale;
      effectSite = Math.max(0, effectSite + (plasma - effectSite) * (1 - Math.exp(-drug.ke0 * hMin)));

      if (metabolite) {
        const formed = Math.max(0, eliminated) * formationFraction;
        metaboliteFormed += formed;
        metaboliteAmount = Math.max(0, metaboliteAmount + formed - metaboliteAmount * (1 - Math.exp(-metaboliteK * hMin)));
        const metabolitePlasma = metaboliteAmount / vcScale;
        metaboliteEffect = Math.max(0, metaboliteEffect + (metabolitePlasma - metaboliteEffect) * (1 - Math.exp(-metaboliteKe0 * hMin)));
      }
    }

    state.metaboliteAmountNormalized = metaboliteAmount;
    state.metaboliteEffectNormalized = metaboliteEffect;
    state.cumulativeMetaboliteFormedNormalized = metaboliteFormed;

    if (isExtravascularRoute(dose.route)) {
      isFullyDelivered = state.depotWasLoaded
        && state.absorptionDepotAmountNormalized <= normalizedBolus * route.bioavailability * 0.005;
    }

    return {
      currentCp: Math.max(0, state.centralAmountNormalized / vcScale),
      currentCe: effectSite,
      deliveryElapsedSec,
      isFullyDelivered,
      pkCompartments: state,
    };
  }
}

export interface DecrementPrediction {
  /** Minutes for plasma concentration to fall 50% with no further input (context-sensitive half-time). */
  contextSensitiveHalfTimeMin?: number;
  /** Minutes for plasma concentration to fall 80%. */
  decrement80Min?: number;
  /** Minutes until effect-site exposure falls below a clinical threshold. */
  minutesToEffectOffset?: number;
  /** Projected Cp (normalized) at +30 min with current input stopped. */
  projectedCp30Min: number;
}

/**
 * Forward-simulates the current compartment state with the infusion stopped,
 * yielding the true context-sensitive half-time and 80% decrement time.
 */
export function predictDecrementTimes(
  patient: PatientProfile,
  drug: DrugDefinition,
  dose: ActiveDrugDose,
  systemicClearanceModifier: number,
  effectThresholdCe = 0.08,
  horizonMin = 720,
): DecrementPrediction {
  const pk = dose.pkCompartments;
  if (!pk) return { projectedCp30Min: dose.currentCp };
  const micro = getPkMicroConstants(patient, drug, systemicClearanceModifier);
  let c = pk.centralAmountNormalized + (pk.absorptionDepotAmountNormalized || 0) * 0.5;
  let r = pk.rapidPeripheralAmountNormalized;
  let d = pk.deepPeripheralAmountNormalized;
  let e = dose.currentCe;
  const cp0 = c / micro.vcScale;
  if (cp0 <= 1e-6) return { projectedCp30Min: 0 };
  const h = 0.25;
  let t50: number | undefined;
  let t80: number | undefined;
  let tOffset: number | undefined = e <= effectThresholdCe ? 0 : undefined;
  let projected30 = cp0;
  const total = micro.k10 + micro.k12 + micro.k13;
  for (let t = h; t <= horizonMin; t += h) {
    const out = c * (1 - Math.exp(-total * h));
    const back2 = r * (1 - Math.exp(-micro.k21 * h));
    const back3 = d * (1 - Math.exp(-micro.k31 * h));
    c = Math.max(0, c - out + back2 + back3);
    r = Math.max(0, r + out * micro.k12 / total - back2);
    d = Math.max(0, d + out * micro.k13 / total - back3);
    const cp = c / micro.vcScale;
    e += (cp - e) * (1 - Math.exp(-micro.ke0 * h));
    if (t50 === undefined && cp <= cp0 * 0.5) t50 = t;
    if (t80 === undefined && cp <= cp0 * 0.2) t80 = t;
    if (tOffset === undefined && e <= effectThresholdCe && t > 0.5) tOffset = t;
    if (Math.abs(t - 30) < h / 2) projected30 = cp;
    if (t50 !== undefined && t80 !== undefined && tOffset !== undefined && t >= 30) break;
  }
  return {
    contextSensitiveHalfTimeMin: t50,
    decrement80Min: t80,
    minutesToEffectOffset: tOffset,
    projectedCp30Min: projected30,
  };
}
