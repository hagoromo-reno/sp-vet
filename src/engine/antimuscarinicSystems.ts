import type { BiologicalState, PatientProfile } from '../types/simulator';
import type { ReceptorStateSnapshot } from './cellularReceptors';
import type { PhysiologicalSignal } from './systemCoupling';

const clamp = (x: number) => Math.max(0, Math.min(1, x));
export function stepAntimuscarinicSystems(dt: number, patient: PatientProfile, state: BiologicalState, receptors: ReceptorStateSnapshot): BiologicalState {
  const old = state.visceral ?? { gutMotilityFraction: 1, secretionsFraction: 1, urinaryRetentionMl: 0, gutStasisSeconds: 0, centralAntimuscarinicBurden: 0 };
  const m3 = clamp(-receptors.m3Drive);
  const central = receptors.centralM1Blockade ?? 0;
  const targetMotility = Math.max(0.03, (1 - m3 * 0.8) * (1 - Math.max(0, receptors.muOpioidDrive) * 0.45) * (1 - Math.max(0, receptors.alpha2Drive) * 0.35));
  const motility = old.gutMotilityFraction + (targetMotility - old.gutMotilityFraction) * (1 - Math.exp(-dt / (targetMotility < old.gutMotilityFraction ? 45 : 300)));
  const retentionInput = patient.weightKg * (1 + (state.fluids.renalOutputMlKgHour ?? 0)) * dt / 3600 * m3;
  const retention = Math.max(0, old.urinaryRetentionMl + retentionInput - old.urinaryRetentionMl * (1 - m3) * (1 - Math.exp(-dt / 300)));
  return { ...state, visceral: {
    gutMotilityFraction: motility,
    secretionsFraction: old.secretionsFraction + (1 - m3 * 0.75 - old.secretionsFraction) * (1 - Math.exp(-dt / 60)),
    urinaryRetentionMl: retention,
    gutStasisSeconds: motility < 0.4 ? old.gutStasisSeconds + dt : Math.max(0, old.gutStasisSeconds - dt * 0.5),
    centralAntimuscarinicBurden: old.centralAntimuscarinicBurden + (central - old.centralAntimuscarinicBurden) * (1 - Math.exp(-dt / 40)),
  } };
}

export function antimuscarinicSignals(patient: PatientProfile, state: BiologicalState, receptors: ReceptorStateSnapshot): PhysiologicalSignal[] {
  const signals: PhysiologicalSignal[] = [];
  const central = receptors.centralM1Blockade ?? 0;
  if (central > 0.05) {
    const synergy = central * Math.max(receptors.centralSedation, receptors.muOpioidDrive, receptors.hypnoticEffect);
    signals.push({ id: 'central-antimuscarinic', source: 'farmacologia', targets: ['neurologico', 'respiratorio'], topology: 'one-to-many', severity: central, label: 'Bloqueio muscarínico central: alteração de consciência e somação com depressores', effects: { respiratoryDriveMultiplier: 1 - synergy * 0.25 } });
  }
  const m3 = clamp(-receptors.m3Drive);
  if (m3 > 0.08) signals.push({ id: 'peripheral-antimuscarinic', source: 'farmacologia', targets: ['autonomico', 'renal', 'respiratorio'], topology: 'one-to-many', severity: m3, label: 'Bloqueio M3: redução de secreções, motilidade e esvaziamento vesical', effects: { renalPerfusionMultiplier: 1 - clamp((state.visceral?.urinaryRetentionMl ?? 0) / Math.max(1, patient.weightKg * 20)) * 0.3 } });
  const stasis = clamp((state.visceral?.gutStasisSeconds ?? 0) / 7200);
  if (stasis > 0.05) signals.push({ id: 'antimuscarinic-gut-stasis', source: 'autonomico', targets: ['metabolico', 'cardiovascular'], topology: 'one-to-many', severity: stasis, label: 'Hipomotilidade digestiva persistente: estase e estresse visceral', effects: { metabolicCo2Multiplier: 1 + stasis * 0.05, heartRateMultiplier: 1 + stasis * 0.08 } });
  return signals;
}
