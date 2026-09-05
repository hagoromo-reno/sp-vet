import type { BiologicalState, PatientProfile } from '../types/simulator';
import type { ReceptorStateSnapshot } from './cellularReceptors';
import type { PhysiologicalSignal } from './systemCoupling';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

/** Converts toxin/metabolite burdens into organ-level causal signals. */
export class ToxicologyEngine {
  public static evaluate(
    patient: PatientProfile,
    state: BiologicalState,
    receptors: ReceptorStateSnapshot
  ): PhysiologicalSignal[] {
    const signals: PhysiologicalSignal[] = [];
    const cyanideBurden = clamp(state.metabolic.nitroprussideToxicMetaboliteBurden || 0);

    if (cyanideBurden > 0.08) {
      const toxicity = clamp((cyanideBurden - 0.08) / 0.72);
      signals.push({
        id: 'nitroprusside-cellular-toxicity',
        source: 'metabolico',
        targets: ['celular', 'cardiovascular', 'hepatico', 'renal', 'neurologico'],
        topology: 'broadcast',
        severity: toxicity,
        label: 'Inibição da respiração celular por metabólitos do nitroprussiato',
        effects: {
          cellularOxygenUtilizationFraction: 1 - toxicity * 0.78,
          additionalLactateMmolLMin: toxicity * 4.2,
          contractilityMultiplier: 1 - toxicity * 0.38,
          vascularResistanceMultiplier: 1 - toxicity * 0.22,
          arrhythmogenicBurden: toxicity * 0.5,
          hepaticPerfusionMultiplier: 1 - toxicity * 0.18,
          renalPerfusionMultiplier: 1 - toxicity * 0.2,
        },
      });
    }

    const metaboliteBurden = clamp(state.biotransformation.circulatingMetaboliteBurden);
    const impairedClearance = clamp(1 - Math.min(
      state.biotransformation.hepaticEnzymeCapacity,
      state.biotransformation.renalFiltrationCapacity
    ));
    const retainedBurden = metaboliteBurden * impairedClearance;
    if (retainedBurden > 0.08) {
      signals.push({
        id: 'retained-metabolite-load',
        source: 'hepatico',
        targets: ['renal', 'neurologico', 'respiratorio'],
        topology: 'one-to-many',
        severity: clamp(retainedBurden * 1.6),
        label: 'Retenção de metabólitos por depuração orgânica limitada',
        effects: {
          respiratoryDriveMultiplier: 1 - clamp(retainedBurden) * 0.12,
          renalPerfusionMultiplier: 1 - clamp(retainedBurden) * 0.08,
        },
      });
    }

    const membraneInstability = clamp(receptors.hyperkalemicCardiotoxicity);
    if (membraneInstability > 0.08) {
      signals.push({
        id: 'hyperkalemic-membrane-instability',
        source: 'metabolico',
        targets: ['celular', 'cardiovascular'],
        topology: 'one-to-many',
        severity: membraneInstability,
        label: 'Instabilidade de membrana por hipercalemia',
        effects: {
          heartRateMultiplier: 1 - membraneInstability * 0.2,
          contractilityMultiplier: 1 - membraneInstability * 0.16,
          arrhythmogenicBurden: membraneInstability * 0.82,
        },
      });
    }

    // Keep patient in the signature intentionally: toxicokinetic rules can be
    // extended by species without changing the orchestrator contract.
    void patient;
    return signals;
  }
}
