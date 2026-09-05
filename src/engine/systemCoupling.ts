export type PhysiologicalSystem =
  | 'farmacologia'
  | 'neurologico'
  | 'autonomico'
  | 'cardiovascular'
  | 'respiratorio'
  | 'metabolico'
  | 'hepatico'
  | 'renal'
  | 'celular';

export type SignalTopology = 'one-to-one' | 'one-to-many' | 'broadcast';

/**
 * A typed message emitted by one engine and consumed by one or more other
 * engines. Effects are deltas/multipliers, not presentation-only warnings.
 */
export interface PhysiologicalSignal {
  id: string;
  source: PhysiologicalSystem;
  targets: PhysiologicalSystem[];
  topology: SignalTopology;
  severity: number;
  label: string;
  effects: Partial<PhysiologicalModifiers>;
}

export interface PhysiologicalModifiers {
  heartRateMultiplier: number;
  vascularResistanceMultiplier: number;
  contractilityMultiplier: number;
  respiratoryDriveMultiplier: number;
  metabolicCo2Multiplier: number;
  cellularOxygenUtilizationFraction: number;
  additionalLactateMmolLMin: number;
  myocardialIschemiaRatePerMinute: number;
  arrhythmogenicBurden: number;
  hepaticPerfusionMultiplier: number;
  renalPerfusionMultiplier: number;
}

export const NEUTRAL_PHYSIOLOGICAL_MODIFIERS: PhysiologicalModifiers = {
  heartRateMultiplier: 1,
  vascularResistanceMultiplier: 1,
  contractilityMultiplier: 1,
  respiratoryDriveMultiplier: 1,
  metabolicCo2Multiplier: 1,
  cellularOxygenUtilizationFraction: 1,
  additionalLactateMmolLMin: 0,
  myocardialIschemiaRatePerMinute: 0,
  arrhythmogenicBurden: 0,
  hepaticPerfusionMultiplier: 1,
  renalPerfusionMultiplier: 1,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Multipliers compose multiplicatively; rate/burden signals are additive. This
 * lets one-to-one and broadcast messages converge without depending on engine
 * execution order.
 */
export const aggregatePhysiologicalSignals = (signals: PhysiologicalSignal[]): PhysiologicalModifiers => {
  const result = { ...NEUTRAL_PHYSIOLOGICAL_MODIFIERS };
  for (const signal of signals) {
    const effects = signal.effects;
    if (effects.heartRateMultiplier !== undefined) result.heartRateMultiplier *= effects.heartRateMultiplier;
    if (effects.vascularResistanceMultiplier !== undefined) result.vascularResistanceMultiplier *= effects.vascularResistanceMultiplier;
    if (effects.contractilityMultiplier !== undefined) result.contractilityMultiplier *= effects.contractilityMultiplier;
    if (effects.respiratoryDriveMultiplier !== undefined) result.respiratoryDriveMultiplier *= effects.respiratoryDriveMultiplier;
    if (effects.metabolicCo2Multiplier !== undefined) result.metabolicCo2Multiplier *= effects.metabolicCo2Multiplier;
    if (effects.cellularOxygenUtilizationFraction !== undefined) result.cellularOxygenUtilizationFraction *= effects.cellularOxygenUtilizationFraction;
    result.additionalLactateMmolLMin += effects.additionalLactateMmolLMin || 0;
    result.myocardialIschemiaRatePerMinute += effects.myocardialIschemiaRatePerMinute || 0;
    result.arrhythmogenicBurden += effects.arrhythmogenicBurden || 0;
    if (effects.hepaticPerfusionMultiplier !== undefined) result.hepaticPerfusionMultiplier *= effects.hepaticPerfusionMultiplier;
    if (effects.renalPerfusionMultiplier !== undefined) result.renalPerfusionMultiplier *= effects.renalPerfusionMultiplier;
  }
  return {
    heartRateMultiplier: clamp(result.heartRateMultiplier, 0.35, 1.8),
    vascularResistanceMultiplier: clamp(result.vascularResistanceMultiplier, 0.25, 2.2),
    contractilityMultiplier: clamp(result.contractilityMultiplier, 0.18, 1.5),
    respiratoryDriveMultiplier: clamp(result.respiratoryDriveMultiplier, 0.08, 1.5),
    metabolicCo2Multiplier: clamp(result.metabolicCo2Multiplier, 0.7, 1.8),
    cellularOxygenUtilizationFraction: clamp(result.cellularOxygenUtilizationFraction, 0.08, 1.1),
    additionalLactateMmolLMin: clamp(result.additionalLactateMmolLMin, 0, 8),
    myocardialIschemiaRatePerMinute: clamp(result.myocardialIschemiaRatePerMinute, 0, 0.8),
    arrhythmogenicBurden: clamp(result.arrhythmogenicBurden, 0, 1),
    hepaticPerfusionMultiplier: clamp(result.hepaticPerfusionMultiplier, 0.2, 1.15),
    renalPerfusionMultiplier: clamp(result.renalPerfusionMultiplier, 0.2, 1.15),
  };
};
