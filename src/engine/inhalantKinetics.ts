import type { AnesthesiaEquipmentState, BiologicalState, PatientProfile } from '../types/simulator';
import { SPECIES_DATABASE } from '../data/speciesData';

const approach = (current: number, target: number, dtSeconds: number, tauSeconds: number): number =>
  current + (target - current) * (1 - Math.exp(-dtSeconds / Math.max(0.1, tauSeconds)));

export interface InhalantStepResult {
  state: BiologicalState['inhalant'];
  deliveredVaporizerPct: number;
}

/** Alveolar and tissue partial-pressure model expressed in species MAC units. */
export class InhalantKineticsEngine {
  public static step(
    dtSeconds: number,
    patient: PatientProfile,
    equipment: AnesthesiaEquipmentState,
    previous: BiologicalState['inhalant'],
    ventilationRatio: number,
    cardiacOutputRatio: number
  ): InhalantStepResult {
    const species = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const hasGasPath = equipment.intubationStatus === 'intubated_tracheal'
      || equipment.intubationStatus === 'laryngeal_mask';
    const deliveredVaporizerPct = equipment.isVaporizerOn
      && !equipment.isOxygenFlushActive
      && equipment.oxygenFlowLMin > 0.1
      && hasGasPath
      ? equipment.vaporizerDialPct
      : 0;
    const macPct = equipment.vaporizerType === 'isoflurane'
      ? species.macValues.isoflurane
      : species.macValues.sevoflurane;
    const inspiredMac = deliveredVaporizerPct / Math.max(0.1, macPct);
    const flowRatio = Math.max(0.25, Math.min(
      1.6,
      equipment.oxygenFlowLMin / Math.max(0.5, patient.weightKg * 0.05)
    ));
    const effectiveVentilation = Math.max(0.12, Math.min(2.2, ventilationRatio));
    const bloodGasSolubility = equipment.vaporizerType === 'sevoflurane' ? 0.65 : 1.0;
    const alveolarTau = 58 * bloodGasSolubility / Math.sqrt(flowRatio * effectiveVentilation);

    // During washout, dissolved anesthetic returning from tissues slows the fall
    // in alveolar partial pressure without creating anesthetic mass.
    const tissueBackPressure = deliveredVaporizerPct === 0
      ? previous.vesselRichMac * 0.07 + previous.muscleMac * 0.025 + previous.fatMac * 0.008
      : 0;
    const alveolarTarget = Math.max(0, inspiredMac + tissueBackPressure);
    const alveolarMac = approach(previous.alveolarMac, alveolarTarget, dtSeconds, alveolarTau);

    // High cardiac output slows alveolar rise but speeds delivery to vessel-rich
    // organs. Both effects are represented by separate time constants.
    const perfusion = Math.max(0.2, Math.min(1.5, cardiacOutputRatio));
    const vesselTau = (equipment.vaporizerType === 'sevoflurane' ? 22 : 30) / perfusion;
    const vesselRichMac = approach(previous.vesselRichMac, alveolarMac, dtSeconds, vesselTau);
    const muscleMac = approach(previous.muscleMac, vesselRichMac, dtSeconds, 360 / perfusion);
    const fatMac = approach(previous.fatMac, vesselRichMac, dtSeconds, 2400 / perfusion);

    return {
      state: {
        inspiredMac,
        alveolarMac: Math.max(0, alveolarMac),
        vesselRichMac: Math.max(0, vesselRichMac),
        muscleMac: Math.max(0, muscleMac),
        fatMac: Math.max(0, fatMac),
      },
      deliveredVaporizerPct,
    };
  }
}
