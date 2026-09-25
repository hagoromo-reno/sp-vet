import type { PatientProfile } from '../types/simulator';

export interface BiologicalVariationsSnapshot {
  hrVariationBpm: number;
  bpVariationMmHg: number;
  rrVariationRpm: number;
  vtVariationFactor: number;
  etco2VariationMmHg: number;
  spo2VariationPct: number;
  glucoseVariationMgDl: number;
  potassiumVariationMeqL: number;
  phVariation: number;
  absorptionRateFactor: number;
}

/**
 * Generates continuous, deterministic biological variations (autonomic rhythms,
 * respiratory sinus arrhythmia, Mayer waves, and micro-scale metabolic fluctuations).
 *
 * Being a continuous function of simulation time and patient seed, it is strictly
 * invariant to numerical timestep (dt), guaranteeing mathematical stability
 * while providing authentic organic realism.
 */
export class BiologicalVariationsEngine {
  public static compute(
    simTimeSeconds: number,
    patient: PatientProfile,
    depthOfAnesthesia: number = 0, // 0 awake to 1 profound depression
    isArrestedOrDead: boolean = false
  ): BiologicalVariationsSnapshot {
    if (isArrestedOrDead) {
      return {
        hrVariationBpm: 0,
        bpVariationMmHg: 0,
        rrVariationRpm: 0,
        vtVariationFactor: 1,
        etco2VariationMmHg: 0,
        spo2VariationPct: 0,
        glucoseVariationMgDl: 0,
        potassiumVariationMeqL: 0,
        phVariation: 0,
        absorptionRateFactor: 1,
      };
    }

    // Patient-specific phase offsets derived deterministically from demographics
    const seed = Math.abs(
      Math.round(patient.weightKg * 101.3 + (patient.baselineVitals?.hr ?? 100) * 17.7 + patient.ageYears * 31.1)
    );
    const p1 = (seed % 997) / 100.0;
    const p2 = ((seed * 3) % 991) / 100.0;
    const p3 = ((seed * 7) % 983) / 100.0;
    const p4 = ((seed * 11) % 977) / 100.0;

    const t = simTimeSeconds;

    // Multi-scale physiological frequencies:
    // 1. Mayer vasomotor wave (~0.08 to 0.12 Hz, period ~10-12s)
    const mayerWave = Math.sin(2 * Math.PI * 0.092 * t + p1) * 0.65 + Math.sin(2 * Math.PI * 0.061 * t + p2) * 0.35;

    // 2. Slow autonomic tone drift (~0.025 to 0.04 Hz, period ~25-40s)
    const slowDrift = Math.sin(2 * Math.PI * 0.033 * t + p3) * 0.70 + Math.cos(2 * Math.PI * 0.019 * t + p4) * 0.30;

    // 3. Ultra-slow endocrine/metabolic fluctuation (~0.008 Hz, period ~120s)
    const ultraSlow = Math.sin(2 * Math.PI * 0.0085 * t + p2 + p3);

    // Deep sedation and general anesthesia attenuate autonomic variability (as seen in clinical HRV and EEG burst suppression)
    const anesthesiaDampening = depthOfAnesthesia > 0.15
      ? Math.pow(Math.max(0, 1.0 - depthOfAnesthesia * 1.3), 3)
      : (1.0 - depthOfAnesthesia * 0.70);
    const autonomicSuppression = isArrestedOrDead ? 0 : Math.max(0, anesthesiaDampening);

    // Species factor: canines possess prominent sinus arrhythmia and vagal modulation;
    // felines, equines and bovines have tighter resting autonomic variability.
    const speciesHrScale = patient.species === 'canine' ? 1.4 : patient.species === 'equine' ? 0.9 : 0.8;

    const hrVariationBpm = (mayerWave * 1.1 + slowDrift * 1.4) * autonomicSuppression * speciesHrScale;
    const bpVariationMmHg = (mayerWave * 1.5 + slowDrift * 0.9) * autonomicSuppression;
    const rrVariationRpm = (slowDrift * 0.65 + mayerWave * 0.25) * autonomicSuppression;
    const vtVariationFactor = 1.0 + (mayerWave * 0.02 + slowDrift * 0.015) * autonomicSuppression;
    const etco2VariationMmHg = (slowDrift * 0.55 + mayerWave * 0.25) * autonomicSuppression;
    const spo2VariationPct = Math.sin(2 * Math.PI * 0.05 * t + p1) * 0.22 * autonomicSuppression;

    // Subtle continuous metabolic / biochemical organic fluctuations
    const glucoseVariationMgDl = (ultraSlow * 1.5 + slowDrift * 0.8) * 0.9;
    const potassiumVariationMeqL = (ultraSlow * 0.03 + slowDrift * 0.015) * 0.8;
    const phVariation = (slowDrift * 0.006 + mayerWave * 0.003) * 0.8;

    // Micro-vascular muscular vasomotion affecting local extravascular absorption depot
    const absorptionRateFactor = 1.0 + (mayerWave * 0.04 + slowDrift * 0.03);

    return {
      hrVariationBpm,
      bpVariationMmHg,
      rrVariationRpm,
      vtVariationFactor,
      etco2VariationMmHg,
      spo2VariationPct,
      glucoseVariationMgDl,
      potassiumVariationMeqL,
      phVariation,
      absorptionRateFactor,
    };
  }
}
