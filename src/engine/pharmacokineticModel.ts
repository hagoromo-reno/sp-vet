import type {
  ActiveDrugDose,
  DrugDefinition,
  PatientProfile,
  SpeciesType,
} from '../types/simulator';
import { getRoutePharmacokinetics, isExtravascularRoute, isTimeBasedDoseUnit } from './drugAdministration';
import { resolveBiotransformationProfile } from './biotransformationEngine';

type PKState = NonNullable<ActiveDrugDose['pkCompartments']>;

export interface PharmacokineticStepResult {
  currentCp: number;
  currentCe: number;
  deliveryElapsedSec: number;
  isFullyDelivered: boolean;
  pkCompartments: PKState;
}

const CENTRAL_VOLUME_SCALE: Record<SpeciesType, number> = {
  canine: 1,
  feline: 0.9,
  equine: 1.12,
  bovine: 1.18,
};

const GENERIC_CLEARANCE_SCALE: Record<SpeciesType, number> = {
  canine: 1,
  feline: 0.9,
  equine: 0.9,
  bovine: 0.82,
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
});

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
    absorptionRateMultiplier: number = 1
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
    const vcScale = CENTRAL_VOLUME_SCALE[patient.species] || 1;
    const speciesClearance = GENERIC_CLEARANCE_SCALE[patient.species] || 1;
    const clearance = Math.max(0.08, systemicClearanceModifier * speciesClearance);
    state.effectiveClearanceMultiplier = clearance;
    state.bioavailableFraction = route.bioavailability;

    const bioProfile = resolveBiotransformationProfile(drug);
    const lipidSolubility = bioProfile.lipidSolubility ?? 0.5;

    const alpha = Math.LN2 / Math.max(0.1, drug.halfLifeAlpha);
    const beta = Math.LN2 / Math.max(0.2, drug.halfLifeBeta);

    const hepaticFraction = bioProfile.hepaticClearanceFraction;
    const k10Factor = hepaticFraction > 0.7 ? 0.95 : hepaticFraction > 0.3 ? 0.82 : 0.70;
    const k10 = Math.max(0.0005, beta * k10Factor * clearance);

    const k12 = Math.max(0.001, (alpha - beta) * 0.52);
    const k21k12Ratio = Math.max(0.15, 0.55 - lipidSolubility * 0.35);
    const k21 = Math.max(0.001, k12 * k21k12Ratio);

    const deepUptakeFactor = Math.max(0.12, 0.10 + lipidSolubility * 0.22);
    const k13 = Math.max(0.0002, beta * deepUptakeFactor);
    const deepReturnFactor = Math.max(0.03, 0.10 - lipidSolubility * 0.065);
    const k31 = Math.max(0.0001, beta * deepReturnFactor);

    // Tissue return already produces context dependence. Stopping the pump must
    // not instantaneously change intrinsic clearance.
    const effectiveK10 = k10;
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
        const referenceK10 = Math.max(0.0005, beta * k10Factor * speciesClearance);
        const referenceAmount = isTimeBasedDoseUnit(drug.doseUnit)
          ? typicalRate / (referenceK10 * vcScale)
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
    }

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
