import {
  AnesthesiaEquipmentState,
  BiologicalState,
  PatientProfile,
  SpeciesType,
} from '../types/simulator';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const expApproach = (current: number, target: number, dtSeconds: number, tauSeconds: number): number =>
  current + (target - current) * (1 - Math.exp(-dtSeconds / Math.max(0.01, tauSeconds)));
const decayByHalfLife = (value: number, dtSeconds: number, halfLifeSeconds: number): number =>
  value * Math.exp(-Math.LN2 * dtSeconds / halfLifeSeconds);

const BASELINE_GLUCOSE: Record<SpeciesType, number> = {
  canine: 95,
  feline: 105,
  equine: 92,
  bovine: 72,
  rabbit: 110,
  avian: 220,
};

const STRESS_GLUCOSE_GAIN: Record<SpeciesType, number> = {
  canine: 70,
  feline: 135,
  equine: 55,
  bovine: 48,
  rabbit: 105,
  avian: 90,
};

type FluidKind = 'crystalloid' | 'hypertonic' | 'colloid' | 'whole_blood';

const classifyFluid = (label: string): FluidKind => {
  const normalized = label.toLocaleLowerCase('pt-BR');
  if (normalized.includes('sangue') || normalized.includes('blood')) return 'whole_blood';
  if (normalized.includes('hipert')) return 'hypertonic';
  if (normalized.includes('coloide') || normalized.includes('starch')) return 'colloid';
  return 'crystalloid';
};

export class BiologicalStateEngine {
  public static initialize(patient: PatientProfile): BiologicalState {
    const glucose = patient.baselineVitals.glucoseMgDl ?? BASELINE_GLUCOSE[patient.species] ?? 95;
    return {
      species: {
        recumbencySeconds: 0,
        lowMapExposureSeconds: 0,
        pulmonaryShuntPct: 5,
        ruminalBloatSeverity: 0,
        myopathyRisk: 0,
      },
      fluids: {
        lastObservedTotalInfusedMl: 0,
        crystalloidCentralMl: 0,
        hypertonicExpansionMl: 0,
        colloidCentralMl: 0,
        wholeBloodCentralMl: 0,
        effectiveCirculatingExpansionMl: 0,
        currentHematocritPct: patient.baselineVitals.hctPct,
      },
      metabolic: {
        bloodGlucoseMgDl: glucose,
        insulinActivity: 1,
        counterRegulatoryDrive: 0,
      },
      respiratory: {
        highAirwayPressureSeconds: 0,
      },
      resuscitation: {
        roscReadinessSeconds: 0,
        processedShockCount: 0,
      },
    };
  }

  /** Advance the slow exposure and intravascular fluid compartments. */
  public static stepSlowCompartments(
    dtSeconds: number,
    patient: PatientProfile,
    equipment: AnesthesiaEquipmentState,
    previous: BiologicalState,
    isRecumbent: boolean,
    currentMap: number,
    criticalMap: number,
    recumbencyShuntPct: number
  ): BiologicalState {
    const next: BiologicalState = {
      species: { ...previous.species },
      fluids: { ...previous.fluids },
      metabolic: { ...previous.metabolic },
      respiratory: { ...previous.respiratory },
      resuscitation: { ...previous.resuscitation },
    };

    next.species.recumbencySeconds = isRecumbent
      ? previous.species.recumbencySeconds + dtSeconds
      : Math.max(0, previous.species.recumbencySeconds - dtSeconds * 1.5);

    const mapDeficit = Math.max(0, criticalMap - currentMap);
    next.species.lowMapExposureSeconds = mapDeficit > 0 && isRecumbent
      ? previous.species.lowMapExposureSeconds + dtSeconds
      : Math.max(0, previous.species.lowMapExposureSeconds - dtSeconds * 0.25);

    if (patient.species === 'bovine') {
      const bloatRate = isRecumbent ? 1 / 1350 : -1 / 650;
      next.species.ruminalBloatSeverity = clamp(
        previous.species.ruminalBloatSeverity + bloatRate * dtSeconds,
        0,
        1
      );
    } else {
      next.species.ruminalBloatSeverity = 0;
    }

    const targetShunt = isRecumbent
      ? recumbencyShuntPct + next.species.ruminalBloatSeverity * 14
      : 5;
    next.species.pulmonaryShuntPct = clamp(
      expApproach(previous.species.pulmonaryShuntPct, targetShunt, dtSeconds, isRecumbent ? 75 : 210),
      4,
      45
    );

    if (patient.species === 'equine' && isRecumbent && mapDeficit > 0) {
      const injuryRate = (mapDeficit / 25) * dtSeconds / 7200;
      next.species.myopathyRisk = clamp(previous.species.myopathyRisk + injuryRate, 0, 1);
    } else {
      next.species.myopathyRisk = clamp(previous.species.myopathyRisk - dtSeconds / 28800, 0, 1);
    }

    next.fluids.crystalloidCentralMl = decayByHalfLife(previous.fluids.crystalloidCentralMl, dtSeconds, 1800);
    next.fluids.hypertonicExpansionMl = decayByHalfLife(previous.fluids.hypertonicExpansionMl, dtSeconds, 1500);
    next.fluids.colloidCentralMl = decayByHalfLife(previous.fluids.colloidCentralMl, dtSeconds, 7200);
    next.fluids.wholeBloodCentralMl = decayByHalfLife(previous.fluids.wholeBloodCentralMl, dtSeconds, 43200);

    const observedTotal = Math.max(0, equipment.totalFluidsInfusedMl);
    const newlyDeliveredMl = Math.max(0, observedTotal - previous.fluids.lastObservedTotalInfusedMl);
    switch (classifyFluid(equipment.activeFluidType)) {
      case 'whole_blood':
        next.fluids.wholeBloodCentralMl += newlyDeliveredMl * 0.9;
        break;
      case 'hypertonic':
        next.fluids.hypertonicExpansionMl += newlyDeliveredMl * 3.2;
        break;
      case 'colloid':
        next.fluids.colloidCentralMl += newlyDeliveredMl * 0.8;
        break;
      default:
        next.fluids.crystalloidCentralMl += newlyDeliveredMl;
    }
    next.fluids.lastObservedTotalInfusedMl = observedTotal;

    const effectiveExpansion = next.fluids.crystalloidCentralMl * 0.25
      + next.fluids.hypertonicExpansionMl
      + next.fluids.colloidCentralMl
      + next.fluids.wholeBloodCentralMl;
    next.fluids.effectiveCirculatingExpansionMl = effectiveExpansion;

    const baselineBloodVolume = Math.max(1, patient.baselineVitals.bloodVolumeMl);
    const baselineRedCellVolume = baselineBloodVolume * patient.baselineVitals.hctPct / 100;
    const donorRedCellVolume = next.fluids.wholeBloodCentralMl * 0.4;
    const centralVolume = baselineBloodVolume + effectiveExpansion;
    next.fluids.currentHematocritPct = clamp(
      100 * (baselineRedCellVolume + donorRedCellVolume) / Math.max(1, centralVolume),
      8,
      65
    );

    return next;
  }

  /** Integrates endocrine stress instead of mapping glucose directly to one drug. */
  public static stepMetabolism(
    dtSeconds: number,
    patient: PatientProfile,
    state: BiologicalState,
    alpha2Drive: number,
    beta1Drive: number,
    nociceptiveStress: number,
    spo2: number,
    meanArterialPressure: number
  ): BiologicalState {
    const next: BiologicalState = {
      ...state,
      species: { ...state.species },
      fluids: { ...state.fluids },
      metabolic: { ...state.metabolic },
      respiratory: { ...state.respiratory },
      resuscitation: { ...state.resuscitation },
    };
    const baseline = patient.baselineVitals.glucoseMgDl ?? BASELINE_GLUCOSE[patient.species] ?? 95;
    const hypoxicDrive = clamp((88 - spo2) / 30, 0, 1);
    const hypotensiveDrive = clamp((60 - meanArterialPressure) / 35, 0, 1);
    const counterTarget = clamp(
      nociceptiveStress * 0.75 + Math.max(0, beta1Drive) * 0.3 + hypoxicDrive * 0.45 + hypotensiveDrive * 0.4,
      0,
      1.5
    );
    next.metabolic.counterRegulatoryDrive = expApproach(
      state.metabolic.counterRegulatoryDrive,
      counterTarget,
      dtSeconds,
      counterTarget > state.metabolic.counterRegulatoryDrive ? 35 : 600
    );

    const alpha2Inhibition = clamp(Math.max(0, alpha2Drive) * 0.8, 0, 0.9);
    const glucoseFeedback = clamp((state.metabolic.bloodGlucoseMgDl - baseline) / 140, 0, 0.8);
    const insulinTarget = clamp(1 - alpha2Inhibition + glucoseFeedback, 0.08, 1.5);
    next.metabolic.insulinActivity = expApproach(state.metabolic.insulinActivity, insulinTarget, dtSeconds, 150);

    const glucoseTarget = baseline
      + STRESS_GLUCOSE_GAIN[patient.species] * next.metabolic.counterRegulatoryDrive
      + 65 * alpha2Inhibition
      - 28 * Math.max(0, next.metabolic.insulinActivity - 1);
    next.metabolic.bloodGlucoseMgDl = clamp(
      expApproach(
        state.metabolic.bloodGlucoseMgDl,
        glucoseTarget,
        dtSeconds,
        glucoseTarget > state.metabolic.bloodGlucoseMgDl ? 210 : 1200
      ),
      25,
      patient.species === 'avian' ? 520 : 450
    );
    return next;
  }

  public static stepAirwayPressure(
    dtSeconds: number,
    state: BiologicalState,
    airwayPressureCmH2O: number
  ): BiologicalState {
    const next = {
      ...state,
      species: { ...state.species },
      fluids: { ...state.fluids },
      metabolic: { ...state.metabolic },
      respiratory: { ...state.respiratory },
      resuscitation: { ...state.resuscitation },
    };
    next.respiratory.highAirwayPressureSeconds = airwayPressureCmH2O >= 30
      ? state.respiratory.highAirwayPressureSeconds + dtSeconds
      : Math.max(0, state.respiratory.highAirwayPressureSeconds - dtSeconds * 2);
    return next;
  }
}
