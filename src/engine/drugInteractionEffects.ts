import type { PatientProfile } from '../types/simulator';
import type { ReceptorStateSnapshot } from './cellularReceptors';
import type { PhysiologicalSignal } from './systemCoupling';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

/** Produces causal, bounded organ effects for emergent pharmacodynamic interactions. */
export class DrugInteractionEffectsEngine {
  public static evaluate(patient: PatientProfile, receptors: ReceptorStateSnapshot): PhysiologicalSignal[] {
    const signals: PhysiologicalSignal[] = [];

    const gabaPartner = Math.max(
      receptors.propofolSiteOccupancy,
      receptors.volatileSiteOccupancy,
      receptors.neurosteroidSiteOccupancy
    );
    const gabaSynergy = clamp(receptors.bzdAllostericOccupancy * gabaPartner * 1.65);
    if (gabaSynergy > 0.08) {
      signals.push({
        id: 'gaba-allosteric-synergy',
        source: 'farmacologia',
        targets: ['neurologico', 'respiratorio', 'cardiovascular'],
        topology: 'one-to-many',
        severity: gabaSynergy,
        label: 'Sinergismo alostérico GABA-A com depressão sistêmica',
        effects: {
          respiratoryDriveMultiplier: 1 - gabaSynergy * 0.28,
          contractilityMultiplier: 1 - gabaSynergy * 0.06,
        },
      });
    }

    const afterloadMismatch = clamp(Math.max(0, receptors.alpha2Drive - 0.18) * Math.max(0, -receptors.m2Drive) * 2.6);
    if (afterloadMismatch > 0.04) {
      signals.push({
        id: 'alpha2-antimuscarinic-afterload-mismatch',
        source: 'farmacologia',
        targets: ['cardiovascular'],
        topology: 'one-to-one',
        severity: afterloadMismatch,
        label: 'Descasamento entre pós-carga alfa-2 e bloqueio vagal',
        effects: {
          vascularResistanceMultiplier: 1 + afterloadMismatch * 0.12,
          myocardialIschemiaRatePerMinute: afterloadMismatch * 0.22,
          arrhythmogenicBurden: afterloadMismatch * 0.7,
        },
      });
    }

    const adrenergicStorm = clamp(Math.max(0, receptors.cAMPMyocardial - 1.75) / 1.25);
    if (adrenergicStorm > 0.04) {
      signals.push({
        id: 'adrenergic-calcium-overload',
        source: 'autonomico',
        targets: ['cardiovascular', 'celular', 'metabolico'],
        topology: 'one-to-many',
        severity: adrenergicStorm,
        label: 'Sobrecarga adrenérgica de cálcio e consumo miocárdico',
        effects: {
          metabolicCo2Multiplier: 1 + adrenergicStorm * 0.18,
          myocardialIschemiaRatePerMinute: adrenergicStorm * 0.14,
          arrhythmogenicBurden: adrenergicStorm * 0.65,
        },
      });
    }

    const centralSynergy = clamp(
      Math.max(0, receptors.centralSedation - 0.25)
        * Math.max(0, receptors.respiratoryDepression - 0.28)
        * 2.5
    );
    if (centralSynergy > 0.04) {
      signals.push({
        id: 'central-respiratory-summation',
        source: 'neurologico',
        targets: ['respiratorio'],
        topology: 'one-to-one',
        severity: centralSynergy,
        label: 'Somação central sobre o drive ventilatório',
        effects: { respiratoryDriveMultiplier: 1 - centralSynergy * 0.3 },
      });
    }

    // Cats express a narrower margin for systemic sodium-channel blockade.
    const sodiumChannelToxicity = clamp(
      receptors.naVBlockade * (patient.species === 'feline' ? 1.65 : 1.0)
    );
    if (sodiumChannelToxicity > 0.12) {
      signals.push({
        id: 'systemic-nav-toxicity',
        source: 'farmacologia',
        targets: ['cardiovascular', 'neurologico'],
        topology: 'one-to-many',
        severity: sodiumChannelToxicity,
        label: 'Bloqueio sistêmico de canais de sódio',
        effects: {
          contractilityMultiplier: 1 - sodiumChannelToxicity * 0.32,
          arrhythmogenicBurden: sodiumChannelToxicity * 0.75,
        },
      });
    }

    return signals;
  }
}
