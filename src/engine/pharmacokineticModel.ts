import type {
  ActiveDrugDose,
  DrugDefinition,
  PatientProfile,
  SpeciesType,
} from '../types/simulator';
import { getRoutePharmacokinetics, isExtravascularRoute } from './drugAdministration';

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
  rabbit: 0.82,
  avian: 0.72,
};

const GENERIC_CLEARANCE_SCALE: Record<SpeciesType, number> = {
  canine: 1,
  feline: 0.9,
  equine: 0.9,
  bovine: 0.82,
  rabbit: 1.3,
  avian: 1.45,
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
 */
export class PharmacokineticModel {
  public static step(
    dtSeconds: number,
    patient: PatientProfile,
    drug: DrugDefinition,
    dose: ActiveDrugDose,
    typicalBolusDosePerKg: number,
    typicalCriRatePerKg: number | undefined,
    systemicClearanceModifier: number
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

    const alpha = Math.LN2 / Math.max(0.1, drug.halfLifeAlpha);
    const beta = Math.LN2 / Math.max(0.2, drug.halfLifeBeta);
    const clinicalOffset = Math.LN2 / Math.max(0.2, drug.durationMinutes);
    const k10 = Math.max(0.0005, beta * 0.78 * clearance);
    const k12 = Math.max(0.001, (alpha - beta) * 0.52);
    const k21 = Math.max(0.001, k12 * 0.34);
    const k13 = Math.max(0.0002, beta * 0.22);
    const k31 = Math.max(0.0001, beta * 0.075, clinicalOffset * 0.5);
    const ka = route.absorptionHalfLifeMinutes > 0
      ? Math.LN2 / route.absorptionHalfLifeMinutes
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
        const targetCp = configuredRate / typicalRate;
        const currentCp = state.centralAmountNormalized / vcScale;
        const establishmentRate = Math.LN2 / Math.max(0.25, drug.onsetMinutes);
        // Catalog CRI rates define a clinically normalized target. The transient
        // term represents the distribution/loading component needed while tissue
        // compartments fill; the maintenance term replaces eliminated drug.
        const inputRate = targetCp * k10 * vcScale
          + Math.max(0, targetCp - currentCp) * establishmentRate * vcScale;
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
      const toRapid = k12 * central * hMin;
      const fromRapid = k21 * rapid * hMin;
      const toDeep = k13 * central * hMin;
      const fromDeep = k31 * deep * hMin;
      const eliminated = k10 * central * hMin;

      state.centralAmountNormalized = Math.max(0, central - toRapid - toDeep - eliminated + fromRapid + fromDeep);
      state.rapidPeripheralAmountNormalized = Math.max(0, rapid + toRapid - fromRapid);
      state.deepPeripheralAmountNormalized = Math.max(0, deep + toDeep - fromDeep);
      state.cumulativeEliminatedNormalized += Math.max(0, eliminated);

      const plasma = state.centralAmountNormalized / vcScale;
      effectSite = Math.max(0, effectSite + drug.ke0 * (plasma - effectSite) * hMin);
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
