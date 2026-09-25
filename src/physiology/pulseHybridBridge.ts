import { CellularReceptorsEngine, type ReceptorStateSnapshot } from '../engine/cellularReceptors';
import type { ActiveDrugDose, AnesthesiaEquipmentState, PatientProfile, VitalSigns } from '../types/simulator';
import type {
  HybridPharmacologyInput,
  PharmacologyCoverageEntry,
} from './protocol';
import { mapDoseToPulseAction } from './pulseActionMapping';

export const PULSE_HYBRID_MODEL_VERSION = 'sp-vet-cellular-pd-1.0.0';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));

interface OrganEffectVector {
  heartRateFraction: number;
  meanBloodPressureFraction: number;
  respirationRateFraction: number;
  tidalVolumeFraction: number;
  sedation: number;
  neuromuscularBlock: number;
  bronchodilation: number;
}

/**
 * Projects the receptor orchestra onto the organ-level inputs consumed by
 * Pulse. Coefficients mirror the existing canine circuit couplings instead of
 * inventing a second independent dose-response model in the gateway.
 */
const toOrganEffectVector = (state: ReceptorStateSnapshot): OrganEffectVector => {
  const heartRateFraction = state.beta1Drive * 0.55
    - state.m2Drive * 0.50
    - state.alpha2Drive * 0.40
    + state.directHeartRateEffect * 0.32
    - state.acuteBolusBradycardia * 0.28
    - state.hyperkalemicCardiotoxicity * 0.30;

  const meanBloodPressureFraction = Math.max(0, state.alpha1Drive) * 0.35
    + Math.max(0, state.alpha2Drive) * 0.20
    - Math.max(0, -state.alpha1Drive) * 0.16
    - Math.max(0, state.beta2Drive) * 0.20
    + Math.max(0, state.directBloodPressureEffect) * 0.16
    - Math.max(0, -state.directBloodPressureEffect) * 0.10
    - state.directVasodilatorEffect * 0.52
    - state.acuteBolusHypotension * 0.28
    - state.histamineRelease * 0.22;

  const netRespiratoryDepression = Math.max(
    state.respiratoryDepression,
    state.hypnoticEffect * 0.55 + Math.max(0, state.muOpioidDrive) * 0.22
  );

  return {
    heartRateFraction: clamp(heartRateFraction, -0.9, 1.2),
    meanBloodPressureFraction: clamp(meanBloodPressureFraction, -0.8, 1.2),
    respirationRateFraction: -Math.min(0.95, netRespiratoryDepression * 0.78),
    tidalVolumeFraction: -Math.min(0.75, netRespiratoryDepression * 0.45),
    sedation: clamp(Math.max(state.centralSedation, state.hypnoticEffect), 0, 1),
    neuromuscularBlock: clamp(state.nmOccupancy, 0, 1),
    bronchodilation: clamp(Math.max(0, state.beta2Drive) * 0.30, -1, 1),
  };
};

export const buildPharmacologyCoverage = (
  doses: ActiveDrugDose[]
): PharmacologyCoverageEntry[] => doses.map((dose) => {
  const action = mapDoseToPulseAction(dose);
  return {
    drugId: dose.drugId,
    drugName: dose.drugName,
    mode: action.status === 'native'
      ? 'native_pbpk_pd'
      : action.status === 'hybrid'
        ? 'hybrid_veterinary_pd'
        : 'unsupported',
    reasonPt: action.status === 'native'
      ? 'Transporte PBPK e farmacodinâmica da substância executados nativamente no Pulse.'
      : action.reasonPt || 'Entrada sem cobertura fisiológica.',
  };
});

export const buildHybridPharmacologyInput = (
  patient: PatientProfile,
  doses: ActiveDrugDose[],
  equipment: AnesthesiaEquipmentState,
  vitals: VitalSigns
): HybridPharmacologyInput => {
  const activeDoses = doses.filter((dose) => dose.currentCe > 0.00001 || dose.isInfusionRunning);
  const nativeDoses = activeDoses.filter((dose) => mapDoseToPulseAction(dose).status === 'native');
  const receptorFeedback = vitals.biologicalState.biotransformation.receptorAdaptiveFeedback;
  const inhalantEffectSiteMac = vitals.biologicalState.inhalant.vesselRichMac;

  const completeState = CellularReceptorsEngine.computeReceptorState(
    patient,
    activeDoses,
    inhalantEffectSiteMac,
    equipment.vaporizerType,
    receptorFeedback
  );
  const nativeState = CellularReceptorsEngine.computeReceptorState(
    patient,
    nativeDoses,
    0,
    equipment.vaporizerType,
    receptorFeedback
  );
  const complete = toOrganEffectVector(completeState);
  const native = toOrganEffectVector(nativeState);

  return {
    modelVersion: PULSE_HYBRID_MODEL_VERSION,
    activeDrugIds: [
      ...new Set([
        ...activeDoses.map((dose) => dose.drugId),
        ...(inhalantEffectSiteMac > 0.0001 ? [`inalatorio:${equipment.vaporizerType}`] : []),
      ]),
    ],
    modifiers: {
      heartRateFraction: clamp(complete.heartRateFraction - native.heartRateFraction, -0.9, 1.2),
      meanBloodPressureFraction: clamp(complete.meanBloodPressureFraction - native.meanBloodPressureFraction, -0.8, 1.2),
      respirationRateFraction: clamp(complete.respirationRateFraction - native.respirationRateFraction, -0.95, 0.8),
      tidalVolumeFraction: clamp(complete.tidalVolumeFraction - native.tidalVolumeFraction, -0.75, 0.6),
      sedationDelta: clamp(complete.sedation - native.sedation, -1, 1),
      neuromuscularBlockDelta: clamp(complete.neuromuscularBlock - native.neuromuscularBlock, -1, 1),
      bronchodilationDelta: clamp(complete.bronchodilation - native.bronchodilation, -1, 1),
      nociceptiveInhibition: clamp(completeState.nociceptiveInhibition, 0, 1),
    },
  };
};
