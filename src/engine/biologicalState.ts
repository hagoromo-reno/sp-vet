import { stepFluidBalance, type FluidDelivery } from './fluidTherapy';
import {
  AnesthesiaEquipmentState,
  BiologicalState,
  PatientProfile,
  SpeciesType,
} from '../types/simulator';
import type { ReceptorStateSnapshot } from './cellularReceptors';
import { getPatientReserveCapacity } from './patientReserve';
import { getOxygenDeliveryDeficit, getOxygenDeliveryThresholds } from './oxygenTransport';

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
};

const STRESS_GLUCOSE_GAIN: Record<SpeciesType, number> = {
  canine: 70,
  feline: 135,
  equine: 55,
  bovine: 48,
};

const CARDIAC_OUTPUT_ML_KG_MIN: Record<SpeciesType, number> = {
  canine: 110,
  feline: 140,
  equine: 75,
  bovine: 95,
};

const CNS_KINETICS: Record<SpeciesType, { induction: number; recovery: number; excitation: number }> = {
  canine: { induction: 2.8, recovery: 8, excitation: 6 },
  feline: { induction: 2.4, recovery: 10, excitation: 7 },
  equine: { induction: 4.5, recovery: 20, excitation: 10 },
  bovine: { induction: 5.5, recovery: 25, excitation: 12 },
};

export class BiologicalStateEngine {
  public static initialize(patient: PatientProfile): BiologicalState {
    const glucose = patient.baselineVitals.glucoseMgDl ?? BASELINE_GLUCOSE[patient.species] ?? 95;
    const baselineHemoglobinGdl = patient.baselineVitals.hctPct / 3;
    const baselineOxygenContent = 1.34 * baselineHemoglobinGdl * patient.baselineVitals.spo2 / 100;
    const baselineOxygenDelivery = baselineOxygenContent
      * CARDIAC_OUTPUT_ML_KG_MIN[patient.species] / 100;
    return {
      inhalant: {
        inspiredMac: 0,
        alveolarMac: 0,
        vesselRichMac: 0,
        muscleMac: 0,
        fatMac: 0,
      },
      neurological: {
        corticalArousalPct: 100,
        hypnoticDepth: 0,
        sedativeDepth: 0,
        dissociativeDepth: 0,
        excitationDrive: 0,
        centralSensitization: 0,
        nociceptiveInput: 0,
        motorCapacity: 1,
        unconsciousnessSeconds: 0,
      },
      autonomic: {
        sympatheticDrive: 0,
        parasympatheticDrive: 0.15,
        catecholamineReserve: 1,
        norepinephrineSynaptic: 0.20,
        epinephrinePlasma: 0.05,
        acetylcholineSynaptic: 0.15,
        gabaTone: 0.20,
        glutamateTone: 0.10,
      },
      organPerfusion: {
        cerebralFraction: 1,
        hepaticFraction: 1,
        renalFraction: 1,
        oxygenDeliveryMlKgMin: baselineOxygenDelivery,
        cumulativeOxygenDebt: 0,
      },
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
        nitroprussideToxicMetaboliteBurden: 0,
      },
      systemicRegulation: {
        cellularOxygenUtilizationFraction: 1,
        cellularHypoxia: 0,
        myocardialStress: 0,
        arrhythmogenicBurden: 0,
        endothelialDysfunction: 0,
        hepaticInjury: 0,
        renalInjury: 0,
        compensatoryReserve: getPatientReserveCapacity(patient),
      },
      biotransformation: {
        hepaticEnzymeCapacity: 1,
        hepaticEnzymeSaturation: 0,
        renalFiltrationCapacity: 1,
        renalTransportSaturation: 0,
        circulatingMetaboliteBurden: 0,
        receptorAdaptiveFeedback: 0,
      },
      respiratory: {
        highAirwayPressureSeconds: 0,
        centralDrive: 1,
        neuromuscularCapacity: 1,
        alveolarRecruitment: 1,
      },
      resuscitation: {
        roscReadinessSeconds: 0,
        processedShockCount: 0,
        postRoscStabilizationSeconds: 0,
      },
    };
  }

  /**
   * Couples receptor occupancy to slower neural, autonomic and respiratory
   * control loops. Different induction/recovery constants create hysteresis:
   * the same instantaneous Ce can therefore produce different states during
   * induction and emergence.
   */
  public static stepRegulatorySystems(
    dtSeconds: number,
    patient: PatientProfile,
    equipment: AnesthesiaEquipmentState,
    previous: BiologicalState,
    receptors: ReceptorStateSnapshot,
    surgicalStimulusIntensity: number,
    previousPaCO2: number,
    previousSpO2: number,
    previousMap: number
  ): BiologicalState {
    const next: BiologicalState = {
      ...previous,
      inhalant: { ...previous.inhalant },
      neurological: { ...previous.neurological },
      autonomic: { ...previous.autonomic },
      organPerfusion: { ...previous.organPerfusion },
      species: { ...previous.species },
      fluids: { ...previous.fluids },
      metabolic: { ...previous.metabolic },
      biotransformation: { ...previous.biotransformation },
      respiratory: { ...previous.respiratory },
      resuscitation: { ...previous.resuscitation },
    };
    const kinetics = CNS_KINETICS[patient.species] || CNS_KINETICS.canine;
    const hypnoticTarget = clamp(receptors.hypnoticEffect, 0, 1);
    const sedationTarget = clamp(receptors.centralSedation, 0, 1);
    const dissociationTarget = clamp(receptors.dissociativeEffect, 0, 1);
    const hypnosisTau = hypnoticTarget > previous.neurological.hypnoticDepth
      ? kinetics.induction
      : kinetics.recovery;
    next.neurological.hypnoticDepth = expApproach(
      previous.neurological.hypnoticDepth,
      hypnoticTarget,
      dtSeconds,
      hypnosisTau
    );
    next.neurological.sedativeDepth = expApproach(
      previous.neurological.sedativeDepth,
      sedationTarget,
      dtSeconds,
      sedationTarget > previous.neurological.sedativeDepth ? kinetics.induction * 1.4 : kinetics.recovery * 1.3
    );
    next.neurological.dissociativeDepth = expApproach(
      previous.neurological.dissociativeDepth,
      dissociationTarget,
      dtSeconds,
      dissociationTarget > previous.neurological.dissociativeDepth ? kinetics.induction : kinetics.recovery * 0.8
    );

    const analgesicProtection = clamp(receptors.nociceptiveInhibition, 0, 1);
    const activeNoxiousInput = Math.max(0, Math.min(1, surgicalStimulusIntensity));
    const rawNociception = activeNoxiousInput > 0
      ? activeNoxiousInput * (1 - analgesicProtection) * (1 + previous.neurological.centralSensitization * 0.35)
      : previous.neurological.centralSensitization * 0.12;
    next.neurological.nociceptiveInput = expApproach(
      previous.neurological.nociceptiveInput,
      clamp(rawNociception, 0, 1.3),
      dtSeconds,
      rawNociception > previous.neurological.nociceptiveInput ? 2.2 : 3.5
    );
    const sensitizationDelta = activeNoxiousInput > 0 && rawNociception > 0.2
      ? rawNociception * dtSeconds / 720
      : -dtSeconds * (0.15 + analgesicProtection * 0.65) / 3600;
    next.neurological.centralSensitization = clamp(
      previous.neurological.centralSensitization + sensitizationDelta,
      0,
      1
    );

    const speciesExcitability = patient.species === 'feline' || patient.species === 'equine' ? 1.2 : 1;
    const dissociativeExcitation = dissociationTarget > 0.12 && hypnoticTarget < 0.42
      ? dissociationTarget * speciesExcitability
      : 0;
    const transitionExcitation = hypnoticTarget > 0.12 && hypnoticTarget < 0.38
      ? (1 - Math.abs(hypnoticTarget - 0.25) / 0.13) * 0.55
      : 0;
    const opioidDysphoria = (patient.species === 'feline' || patient.species === 'equine')
      && receptors.muOpioidDrive > 0.45 && receptors.alpha2Drive < 0.18
      ? (receptors.muOpioidDrive - 0.45) * 0.8
      : 0;
    const excitationTarget = clamp(
      Math.max(dissociativeExcitation, transitionExcitation, opioidDysphoria, receptors.centralAntimuscarinicExcitation ?? 0)
        + next.neurological.nociceptiveInput * 0.25,
      0,
      1.4
    );
    next.neurological.excitationDrive = expApproach(
      previous.neurological.excitationDrive,
      excitationTarget,
      dtSeconds,
      excitationTarget > previous.neurological.excitationDrive ? kinetics.excitation : kinetics.recovery
    );

    next.neurological.motorCapacity = expApproach(
      previous.neurological.motorCapacity,
      clamp(1 - receptors.nmOccupancy, 0, 1),
      dtSeconds,
      1.8
    );
    const arousalTarget = clamp(
      100
        * (1 - next.neurological.hypnoticDepth)
        * (1 - next.neurological.sedativeDepth * 0.68)
        * (1 - next.neurological.dissociativeDepth * 0.82)
        + next.neurological.excitationDrive * 18
        - previous.organPerfusion.cumulativeOxygenDebt * 45
        - (receptors.centralM1Blockade ?? 0) * 12,
      0,
      125
    );
    next.neurological.corticalArousalPct = expApproach(
      previous.neurological.corticalArousalPct,
      arousalTarget,
      dtSeconds,
      arousalTarget < previous.neurological.corticalArousalPct ? kinetics.induction : kinetics.recovery
    );
    const isUnconscious = next.neurological.corticalArousalPct < 22 || next.neurological.hypnoticDepth > 0.5;
    next.neurological.unconsciousnessSeconds = isUnconscious
      ? previous.neurological.unconsciousnessSeconds + dtSeconds
      : Math.max(0, previous.neurological.unconsciousnessSeconds - dtSeconds * 2);

    const hypotensiveStimulus = clamp((patient.baselineVitals.map - previousMap) / 45, 0, 1);
    const co2Drive = clamp((previousPaCO2 - 40) / 35, 0, 1.2);
    const hypoxicDrive = clamp((90 - previousSpO2) / 35, 0, 1);
    const hypertensiveVagalStimulus = clamp((previousMap - (patient.baselineVitals.map + 12)) / 40, 0, 0.85);

    const sympatheticTarget = clamp(
      next.neurological.nociceptiveInput * 0.75
        + Math.max(0, receptors.beta1Drive) * 0.55
        + hypotensiveStimulus * 0.35
        + co2Drive * 0.25
        + hypoxicDrive * 0.25
        + next.neurological.excitationDrive * 0.30
        - Math.max(0, receptors.alpha2Drive) * 0.65,
      0,
      1.5
    );
    const parasympatheticTarget = clamp(
      0.12 + Math.max(0, receptors.m2Drive) * 0.70
        + Math.max(0, receptors.muOpioidDrive) * 0.22
        + hypertensiveVagalStimulus * 0.45
        - Math.max(0, receptors.beta1Drive) * 0.25,
      0,
      1.3
    );
    next.autonomic.sympatheticDrive = expApproach(
      previous.autonomic.sympatheticDrive,
      sympatheticTarget,
      dtSeconds,
      sympatheticTarget > previous.autonomic.sympatheticDrive ? 3.5 : 22
    );
    next.autonomic.parasympatheticDrive = expApproach(
      previous.autonomic.parasympatheticDrive,
      parasympatheticTarget,
      dtSeconds,
      4.5
    );
    const reserveUse = Math.max(0, next.autonomic.sympatheticDrive - 0.65) * dtSeconds / 900;
    const reserveRecovery = Math.max(0, 1 - previous.autonomic.catecholamineReserve) * dtSeconds / 1800;
    next.autonomic.catecholamineReserve = clamp(
      previous.autonomic.catecholamineReserve - reserveUse + reserveRecovery,
      0.18,
      1
    );

    // ----------------------------------------------------
    // NEUROTRANSMITTER POOL DYNAMICS & SITE OCCUPANCY
    // ----------------------------------------------------
    // 1. Synaptic Norepinephrine (NE):
    // Pre-synaptic sympathetic postganglionic release driven by sympathetic outflow and stored catecholamine reserve.
    // Pre-synaptic alpha-2 autoreceptor activation inhibits vesicular exocytosis of NE by up to 82%.
    const alpha2AutoreceptorInhibition = Math.min(0.82, Math.max(0, receptors.alpha2Drive) * 0.85);
    const targetNE = (0.18 + next.autonomic.sympatheticDrive * 0.85 * next.autonomic.catecholamineReserve)
      * (1.0 - alpha2AutoreceptorInhibition);
    const prevNE = previous.autonomic.norepinephrineSynaptic ?? 0.20;
    next.autonomic.norepinephrineSynaptic = expApproach(prevNE, targetNE, dtSeconds, 2.5);

    // 2. Humoral Epinephrine (Adrenaline in plasma):
    // Secreted by adrenal medulla chromaffin cells during severe sympathetic stress, hypotension, or hypoxia.
    const severeStressEpiRelease = (next.autonomic.sympatheticDrive > 0.65 ? (next.autonomic.sympatheticDrive - 0.65) * 0.8 : 0)
      + (hypotensiveStimulus > 0.5 ? (hypotensiveStimulus - 0.5) * 0.6 : 0)
      + (hypoxicDrive > 0.4 ? (hypoxicDrive - 0.4) * 0.5 : 0);
    const exogenousEpi = Math.max(0, receptors.beta1Drive > 0.5 && receptors.beta2Drive > 0.3 ? 0.45 : 0);
    const targetEpi = 0.05 + severeStressEpiRelease * next.autonomic.catecholamineReserve + exogenousEpi;
    const prevEpi = previous.autonomic.epinephrinePlasma ?? 0.05;
    next.autonomic.epinephrinePlasma = expApproach(prevEpi, targetEpi, dtSeconds, 25.0);

    // 3. Synaptic Acetylcholine (ACh):
    // Vagal release at neuroeffector junctions (cardiac M2, visceral M3, skeletal Nm).
    // Neostigmine inhibits AChE (receptors.acheInhibition), causing prominent ACh accumulation!
    const baseAChRelease = 0.12 + next.autonomic.parasympatheticDrive * 0.70;
    const acheInhibitionFactor = 1.0 + (receptors.acheInhibition || 0) * 3.2;
    const targetACh = baseAChRelease * acheInhibitionFactor;
    const prevACh = previous.autonomic.acetylcholineSynaptic ?? 0.15;
    next.autonomic.acetylcholineSynaptic = expApproach(prevACh, targetACh, dtSeconds, 1.2);

    // 4. Central GABA Tone:
    // Enhanced allosterically by BZDs, propofol, neurosteroids, and volatiles.
    const bzdModulation = receptors.bzdAllostericOccupancy * 0.35;
    const propofolModulation = receptors.propofolSiteOccupancy * 0.55;
    const volatileModulation = receptors.volatileSiteOccupancy * 0.45;
    const targetGABA = 0.20 + bzdModulation + propofolModulation + volatileModulation;
    const prevGABA = previous.autonomic.gabaTone ?? 0.20;
    next.autonomic.gabaTone = expApproach(prevGABA, targetGABA, dtSeconds, 3.0);

    // 5. Central Glutamate Tone:
    // Nociceptive afferent release in dorsal horn and central excitation, blocked downstream by NMDA uncoupling (ketamine).
    const nociceptiveGlutamateRelease = next.neurological.nociceptiveInput * 0.85 + next.neurological.excitationDrive * 0.45;
    const unblockedGlutamate = nociceptiveGlutamateRelease * (1.0 - Math.min(0.92, receptors.nmdaBlockade * 0.92));
    const targetGlutamate = 0.10 + unblockedGlutamate;
    const prevGlutamate = previous.autonomic.glutamateTone ?? 0.10;
    next.autonomic.glutamateTone = expApproach(prevGlutamate, targetGlutamate, dtSeconds, 4.0);
    const chemoreflexSuppression = clamp(
      receptors.muOpioidDrive * 0.58 + next.neurological.hypnoticDepth * 0.48,
      0,
      0.9
    );
    const respiratoryTarget = clamp(
      1 - receptors.respiratoryDepression + (co2Drive * 0.45 + hypoxicDrive * 0.25) * (1 - chemoreflexSuppression),
      0,
      1.35
    );
    next.respiratory.centralDrive = expApproach(
      previous.respiratory.centralDrive,
      respiratoryTarget,
      dtSeconds,
      respiratoryTarget < previous.respiratory.centralDrive ? 2.2 : 7
    );
    next.respiratory.neuromuscularCapacity = next.neurological.motorCapacity;
    const peep = equipment.isVentilatorActive ? equipment.ventilatorSettings.peepCmH2O : 0;
    const recruitmentTarget = clamp(1 + peep * 0.035 - previous.species.pulmonaryShuntPct / 100 * 0.35, 0.65, 1.28);
    next.respiratory.alveolarRecruitment = expApproach(
      previous.respiratory.alveolarRecruitment,
      recruitmentTarget,
      dtSeconds,
      recruitmentTarget > previous.respiratory.alveolarRecruitment ? 35 : 180
    );
    return next;
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
    recumbencyShuntPct: number,
    deliveries?: FluidDelivery[],
    alpha1Drive?: number
  ): BiologicalState {
    const next: BiologicalState = {
      ...previous,
      inhalant: { ...previous.inhalant },
      neurological: { ...previous.neurological },
      autonomic: { ...previous.autonomic },
      organPerfusion: { ...previous.organPerfusion },
      species: { ...previous.species },
      fluids: { ...previous.fluids },
      metabolic: { ...previous.metabolic },
      biotransformation: { ...previous.biotransformation },
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

    // Legacy externally added totals remain supported; normal UI and catalog paths
    // provide composition-specific deliveries in the current tick.
    const observedTotal = Math.max(0, equipment.totalFluidsInfusedMl);
    const inputs = deliveries ?? [{ fluidName: equipment.activeFluidType, volumeMl: Math.max(0, observedTotal - previous.fluids.lastObservedTotalInfusedMl) }];
    next.fluids = stepFluidBalance(dtSeconds, patient, previous, inputs);
    next.fluids.lastObservedTotalInfusedMl = observedTotal;

    // Sequestro esplênico de eritrócitos por relaxamento capsular sob bloqueio alfa-1 (acepromazina)
    if (alpha1Drive !== undefined && alpha1Drive < -0.05) {
      const splenicSequestrationFraction = Math.min(0.25, Math.abs(alpha1Drive) * 0.25);
      next.fluids.currentHematocritPct = clamp(next.fluids.currentHematocritPct * (1 - splenicSequestrationFraction), 5, 65);
    }

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
    meanArterialPressure: number,
    cardiacOutputRatio: number = 1,
    paO2: number = 98,
    cellularOxygenUtilizationFraction: number = 1,
    hepaticPerfusionMultiplier: number = 1,
    renalPerfusionMultiplier: number = 1
  ): BiologicalState {
    const next: BiologicalState = {
      ...state,
      inhalant: { ...state.inhalant },
      neurological: { ...state.neurological },
      autonomic: { ...state.autonomic },
      organPerfusion: { ...state.organPerfusion },
      species: { ...state.species },
      fluids: { ...state.fluids },
      metabolic: { ...state.metabolic },
      biotransformation: { ...state.biotransformation },
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
      900
    );
    next.metabolic.bloodGlucoseMgDl = clamp(next.metabolic.bloodGlucoseMgDl
      + (state.fluids.glucoseInputMg ?? 0) / Math.max(1, patient.weightKg * 2)
      - Math.max(0, state.metabolic.bloodGlucoseMgDl - 180) * dtSeconds / 1800
        * state.organPerfusion.renalFraction * (1 - (patient.pathologyConditions.renalDysfunctionSeverity ?? 0)), 20, 900);
    const oxygenFactor = clamp(spo2 / 95, 0.2, 1.05);
    const flowAvailability = clamp(cardiacOutputRatio / 0.85, 0.05, 1);
    const cerebralTarget = clamp((meanArterialPressure - 25) / 45, 0.15, 1.1) * oxygenFactor * flowAvailability;
    const hepaticTarget = clamp(
      (cardiacOutputRatio * 0.65 + oxygenFactor * 0.35) * hepaticPerfusionMultiplier,
      0.08,
      1.15
    );
    const renalTarget = clamp(
      ((meanArterialPressure - 30) / 50) * oxygenFactor * renalPerfusionMultiplier * flowAvailability,
      0.05,
      1.1
    );
    next.organPerfusion.cerebralFraction = expApproach(state.organPerfusion.cerebralFraction, cerebralTarget, dtSeconds, 12);
    next.organPerfusion.hepaticFraction = expApproach(state.organPerfusion.hepaticFraction, hepaticTarget, dtSeconds, 28);
    next.organPerfusion.renalFraction = expApproach(state.organPerfusion.renalFraction, renalTarget, dtSeconds, 45);
    const hemoglobinGdl = next.fluids.currentHematocritPct / 3;
    const arterialOxygenContentMlDl = 1.34 * hemoglobinGdl * clamp(spo2 / 100, 0, 1) + 0.003 * paO2;
    const baselineCardiacOutputLMin = patient.weightKg
      * (CARDIAC_OUTPUT_ML_KG_MIN[patient.species] || 110) / 1000;
    next.organPerfusion.oxygenDeliveryMlKgMin = arterialOxygenContentMlDl
      * baselineCardiacOutputLMin * cardiacOutputRatio * 10 / Math.max(0.1, patient.weightKg);
    const effectiveCellularOxygen = next.organPerfusion.oxygenDeliveryMlKgMin
      * clamp(cellularOxygenUtilizationFraction, 0.05, 1.1);
    const deliveryDeficit = getOxygenDeliveryDeficit(patient.species, effectiveCellularOxygen);
    const oxygenThresholds = getOxygenDeliveryThresholds(patient.species);
    // Renal/hepatic hypoperfusion remains an organ injury/clearance signal. It
    // must not accumulate as whole-body anoxia and independently trigger PEA.
    // Systemic delivery failure or profound cerebral hypoperfusion incur global debt.
    const cerebralIschemicDebtRate = clamp(1 - cerebralTarget / 0.30, 0, 1);
    const oxygenDebtRate = Math.max(deliveryDeficit, cerebralIschemicDebtRate);

    let recoveryRate = 0;
    if (oxygenDebtRate === 0) {
      if (effectiveCellularOxygen >= oxygenThresholds.recovery && meanArterialPressure >= 60 && spo2 >= 94) {
        // Robust tissue oxygenation actively clears oxygen debt via supranormal DO2
        const surplusFactor = clamp((effectiveCellularOxygen - oxygenThresholds.recovery) / oxygenThresholds.reserve, 0.25, 2.0);
        recoveryRate = (dtSeconds / 90) * surplusFactor;
      } else {
        recoveryRate = dtSeconds / 360;
      }
    }

    next.organPerfusion.cumulativeOxygenDebt = clamp(
      state.organPerfusion.cumulativeOxygenDebt + (oxygenDebtRate * dtSeconds / 240) - recoveryRate,
      0,
      1
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
      inhalant: { ...state.inhalant },
      neurological: { ...state.neurological },
      autonomic: { ...state.autonomic },
      organPerfusion: { ...state.organPerfusion },
      species: { ...state.species },
      fluids: { ...state.fluids },
      metabolic: { ...state.metabolic },
      biotransformation: { ...state.biotransformation },
      respiratory: { ...state.respiratory },
      resuscitation: { ...state.resuscitation },
    };
    next.respiratory.highAirwayPressureSeconds = airwayPressureCmH2O >= 30
      ? state.respiratory.highAirwayPressureSeconds + dtSeconds
      : Math.max(0, state.respiratory.highAirwayPressureSeconds - dtSeconds * 2);
    return next;
  }
}
