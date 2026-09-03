import {
  AnesthesiaEquipmentState,
  CardiacRhythm,
  PatientProfile,
  ResuscitationState,
} from '../types/simulator';
import { SPECIES_DATABASE } from '../data/speciesData';
import { ReceptorStateSnapshot } from './cellularReceptors';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';

export interface HemodynamicOutputs {
  heartRate: number; // bpm
  cardiacRhythm: CardiacRhythm;
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  meanArterialPressure: number; // mmHg
  cardiacOutputLMin: number; // L/min
  strokeVolumeMl: number; // mL
  systemicVascularResistanceDyne: number; // dynes*s/cm^5
  inotropicStateEmax: number; // mmHg/mL
  baroreceptorGain: number; // 0 to 1
  baroreceptorVagalTone: number; // -1 to +1
  myocardialIschemiaScore: number; // 0 to 1
  criticalEventTimers: {
    severeBradycardiaSeconds: number;
    severeTachycardiaSeconds: number;
    profoundHypotensionSeconds: number;
  };
  isArrestTriggered: boolean;
  arrestType?: 'asystole' | 'ventricular_fibrillation' | 'pulseless_ventricular_tachycardia' | 'pea';
  arrestCause?: string;
  pulseQuality: 'Forte e Cheio' | 'Normal' | 'Fraco / Filiforme' | 'Célere / Saltão' | 'Ausente';
}

export class HemodynamicCircuitEngine {
  /**
   * High-fidelity closed-loop hemodynamic simulation:
   * 1. Frank-Starling inotropy and stroke volume (preload, afterload, contractility).
   * 2. Arterial blood pressure dynamics (CO, SVR, aortic compliance).
   * 3. Baroreceptor reflex negative feedback loop with anesthetic gain depression.
   * 4. Myocardial oxygen balance (MVO2 vs coronary perfusion pressure).
   */
  public static stepHemodynamics(
    dtSeconds: number,
    simTimeSeconds: number,
    patient: PatientProfile,
    receptors: ReceptorStateSnapshot,
    equipment: AnesthesiaEquipmentState,
    resuscitation: ResuscitationState,
    isSurgicalStimulationActive: boolean,
    previousMAP: number,
    previousHR: number,
    previousIschemiaScore: number,
    ruminalBloatSeverity: number = 0,
    previousCriticalTimers: HemodynamicOutputs['criticalEventTimers'] = {
      severeBradycardiaSeconds: 0,
      severeTachycardiaSeconds: 0,
      profoundHypotensionSeconds: 0,
    },
    previousSpO2: number = 98,
    previousLactate: number = 1
  ): HemodynamicOutputs {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;

    const baseHR = patient.baselineVitals.hr;
    const baseMAP = patient.baselineVitals.map;

    // ----------------------------------------------------
    // 1. SYSTEMIC VASCULAR RESISTANCE (AFTERLOAD)
    // ----------------------------------------------------
    // Normal baseline SVR scaled by patient body weight
    // Typical dog 20kg: CO ~ 2.2 L/min, MAP ~ 85, SVR ~ (85-4)/2.2 * 80 ~ 2900 dynes
    const baselineCOApprox = patient.weightKg * speciesConfig.cardiacOutputMlKgMin / 1000;
    const baselineSVR = Math.round(((baseMAP - 4) / Math.max(0.1, baselineCOApprox)) * 80);

    // Receptors affecting vascular smooth muscle tone:
    // Vasoconstrictors: Alpha-1, initial Alpha-2 peripheral
    // Vasodilators: Beta-2, Volatile inhalants, Acepromazine (alpha-1 block), local anesthetics
    const alpha1Constriction = Math.max(0, receptors.alpha1Drive) * 0.65;
    const alpha2Constriction = Math.max(0, receptors.alpha2Drive) * 0.40;
    const alpha1Blockade = receptors.alpha1Drive < 0 ? Math.min(1, Math.abs(receptors.alpha1Drive)) * 0.16 : 0;
    const volatileVasodilation = Math.max(0, receptors.volatileSiteOccupancy) * 0.18;
    const beta2Dilation = Math.max(0, receptors.beta2Drive) * 0.25;
    const calibratedPressureDilation = Math.max(0, -receptors.directBloodPressureEffect) * 0.10;
    const calibratedPressureSupport = Math.max(0, receptors.directBloodPressureEffect) * 0.16;
    const acuteVasodilation = receptors.acuteBolusHypotension * 0.28 + receptors.histamineRelease * 0.22;

    // Sepsis pathology vasodilation
    const sepsisDilation = patient.pathologyConditions.sepsisVasodilation ? 0.45 : 0;

    const netVascularResistanceFactor = Math.max(
      0.35,
      1.0 + alpha1Constriction + alpha2Constriction + calibratedPressureSupport
        - alpha1Blockade - volatileVasodilation - beta2Dilation - calibratedPressureDilation
        - acuteVasodilation
    );
    const SVR = Math.round(baselineSVR * netVascularResistanceFactor);

    // ----------------------------------------------------
    // 2. PRELOAD & VENOUS RETURN (END-DIASTOLIC VOLUME)
    // ----------------------------------------------------
    // SV is derived from a species-scaled resting cardiac index. Using a fixed
    // mL/kg stroke volume made pressure/CO impossible for horses, cattle and birds.
    const baselineSV = (baselineCOApprox * 1000) / Math.max(1, baseHR);
    let bloodVolumeRatio = 1.0;

    if (patient.pathologyConditions.hypovolemiaSeverity) {
      bloodVolumeRatio -= patient.pathologyConditions.hypovolemiaSeverity * 0.45;
    }
    if (patient.pathologyConditions.traumaHemorrhage) {
      bloodVolumeRatio -= 0.30;
    }

    // Splenic auto-transfusion (Canine/Equine under adrenergic stress)
    if (receptors.alpha1Drive > 0.3 || receptors.beta1Drive > 0.4) {
      bloodVolumeRatio += speciesConfig.splenicContractionReserve * 0.5;
    }

    // Fluids infusion contribution
    if (equipment.totalFluidsInfusedMl > 0) {
      const infusedRatio = equipment.totalFluidsInfusedMl / (patient.weightKg * 40);
      bloodVolumeRatio = Math.min(1.35, bloodVolumeRatio + infusedRatio * 0.25);
    }

    // Ruminal Bloat / Tympanism venous cava compression (Bovine)
    if (ruminalBloatSeverity > 0.15) {
      bloodVolumeRatio = Math.max(0.40, bloodVolumeRatio - ruminalBloatSeverity * 0.45);
    }

    // Alpha-1 blockade and general anesthetics dilate the venous capacitance bed.
    // This prevents the previous non-physiological rise in stroke volume after acepromazine.
    const venousPooling =
      Math.min(1, Math.abs(Math.min(0, receptors.alpha1Drive))) * 0.22 +
      receptors.hypnoticEffect * 0.12 +
      calibratedPressureDilation * 0.45 +
      acuteVasodilation * 0.25;
    bloodVolumeRatio = Math.max(0.3, bloodVolumeRatio - venousPooling);
    bloodVolumeRatio = Math.min(1.4, bloodVolumeRatio + receptors.volumeExpansion * 0.28);

    // Effective circulating preload
    const preloadEDV = baselineSV * 1.5 * Math.max(0.3, bloodVolumeRatio);

    // ----------------------------------------------------
    // 3. MYOCARDIAL INOTROPY & CONTRACTILITY (Emax)
    // ----------------------------------------------------
    // Inotropic state driven by intracellular calcium [Ca2+]i
    // Normal baseline Emax = 1.0
    let inotropyFactor = receptors.intracellularCalcium;

    // DCM pathology
    if (patient.pathologyConditions.cardiacFailureDCM) {
      inotropyFactor *= 0.45;
    }

    // Volatile anesthetic direct negative inotropy at > 1.2 MAC
    if (receptors.volatileSiteOccupancy > 1.1) {
      inotropyFactor = Math.max(0.2, inotropyFactor - (receptors.volatileSiteOccupancy - 1.1) * 0.35);
    }

    // Feline local anesthetic toxicity
    if (patient.species === 'feline' && receptors.naVBlockade > 0.25) {
      inotropyFactor = Math.max(0.1, inotropyFactor - receptors.naVBlockade * 0.70);
    }

    const inotropicStateEmax = Number(inotropyFactor.toFixed(2));

    // ----------------------------------------------------
    // 4. STROKE VOLUME (SV) DYNAMICS
    // ----------------------------------------------------
    // SV = (Preload * Inotropy) / (1 + AfterloadRatio * 0.5)
    const afterloadRatio = SVR / baselineSVR;
    let computedSV = (preloadEDV * 0.65 * inotropyFactor) / (0.4 + afterloadRatio * 0.6);
    computedSV = Math.max(baselineSV * 0.12, Math.min(baselineSV * 2.2, computedSV));
    let strokeVolumeMl = computedSV;

    // ----------------------------------------------------
    // ----------------------------------------------------
    // 5. BARORECEPTOR REFLEX CONTROL LOOP (PHYSIOLOGICALLY DAMPED)
    // ----------------------------------------------------
    // Sensitivity / Gain of the Baroreceptor reflex (attenuated by depth/volatile agents)
    const volatileSuppression = Math.max(0, receptors.volatileSiteOccupancy) * 0.38;
    const propofolSuppression = receptors.propofolSiteOccupancy * 0.30;
    const sedativeSuppression = receptors.centralSedation * 0.18 + Math.max(0, receptors.alpha2Drive) * 0.18;
    const baroreceptorGain = Math.max(0.08, 1.0 - volatileSuppression - propofolSuppression - sedativeSuppression);

    // Sigmoidal normalized MAP deviation from baseline (prevents algebraic loop resonance)
    const rawMapError = (previousMAP > 0 ? previousMAP : baseMAP) - baseMAP;
    const normalizedMapError = Math.max(-1.0, Math.min(1.0, rawMapError / 45.0));

    // Damped baroreceptor effector (max 20% chronotropic shift to prevent overshooting oscillation)
    const baroreceptorEffector = -normalizedMapError * baroreceptorGain * 0.20;

    // ----------------------------------------------------
    // 6. HEART RATE DYNAMICS (INTEGRATING MOA + REFLEX + INERTIA)
    // ----------------------------------------------------
    // Primary receptor drives:
    // Beta-1 (+ chronotropy via cAMP)
    // M2 (- chronotropy via hyperpolarization)
    // Alpha-2 (central sympatholysis + reflex bradycardia)
    let autonomicHRMultiplier = 1.0;

    // Direct receptor effect on SA node
    autonomicHRMultiplier += receptors.beta1Drive * 0.55;
    autonomicHRMultiplier -= receptors.m2Drive * 0.50;
    autonomicHRMultiplier -= receptors.alpha2Drive * 0.40;
    autonomicHRMultiplier += receptors.directHeartRateEffect * 0.18;
    autonomicHRMultiplier -= receptors.acuteBolusBradycardia * 0.28;
    autonomicHRMultiplier -= receptors.hyperkalemicCardiotoxicity * 0.30;

    // Baroreceptor feedback contribution (smoothly bounded)
    autonomicHRMultiplier += baroreceptorEffector;

    // Surgical stimulation tachycardia if nociception or depth is insufficient
    if (isSurgicalStimulationActive) {
      const nociceptiveDeficit = Math.max(0, 1.0 - receptors.nociceptiveInhibition);
      const effectiveUnconsciousness = Math.max(receptors.hypnoticEffect, receptors.dissociativeEffect);
      const depthDeficit = Math.max(0, 1.0 - effectiveUnconsciousness);
      autonomicHRMultiplier += (nociceptiveDeficit * 0.30 + depthDeficit * 0.15);
    }

    let targetHR = baseHR * autonomicHRMultiplier;

    // Pediatric patients depend strictly on heart rate for cardiac output
    const ageTotalYears = patient.ageYears + (patient.ageMonths || 0) / 12;
    if (ageTotalYears < 0.6) {
      targetHR = Math.max(baseHR * 0.7, targetHR);
    }

    targetHR = Math.max(0, Math.min(350, targetHR));

    // SA Node Physiological Inertia (1st-order low-pass filter: tau = 1.8s)
    // Eliminates 100ms numerical limit-cycle flickering
    const hrSmoothingAlpha = 1.0 - Math.exp(-dtSeconds / 1.8);
    const effectiveHR = previousHR > 0 ? (previousHR + (targetHR - previousHR) * hrSmoothingAlpha) : targetHR;
    const finalHR = Number(effectiveHR.toFixed(3));

    // Very high rates shorten diastole and reduce preload instead of increasing CO forever.
    if (effectiveHR > baseHR * 1.2) {
      const fillingPenalty = 1 / (1 + ((effectiveHR / baseHR) - 1.2) * 0.75);
      strokeVolumeMl *= Math.max(0.42, fillingPenalty);
    }
    strokeVolumeMl = Number(strokeVolumeMl.toFixed(3));

    // ----------------------------------------------------
    // 7. CARDIAC OUTPUT & ARTERIAL PRESSURE
    // ----------------------------------------------------
    let cardiacOutputLMin = (effectiveHR * strokeVolumeMl) / 1000.0;
    cardiacOutputLMin = Number(cardiacOutputLMin.toFixed(2));

    // Mean Arterial Pressure: MAP = CVP + (CO * SVR / 80)
    const cvp = 4.0;
    const rawMAP = cvp + (cardiacOutputLMin * SVR) / 80.0;

    // Low-pass filter MAP to eliminate high-frequency flickering
    const mapSmoothingAlpha = 1.0 - Math.exp(-dtSeconds / 1.4);
    const smoothedMAP = previousMAP > 0 ? (previousMAP + (rawMAP - previousMAP) * mapSmoothingAlpha) : rawMAP;
    const finalMAP = Number(smoothedMAP.toFixed(3));
    const targetMAP = finalMAP;

    // Pulse pressure based on stroke volume and arterial compliance
    const baselinePulsePressure = Math.max(
      18,
      ((speciesInfo.normalVitals.sysBpMin + speciesInfo.normalVitals.sysBpMax) / 2) -
        ((speciesInfo.normalVitals.diaBpMin + speciesInfo.normalVitals.diaBpMax) / 2)
    );
    const normalizedStrokeVolume = strokeVolumeMl / Math.max(0.001, baselineSV);
    const pulsePressure = Math.max(
      12,
      Math.round(baselinePulsePressure * normalizedStrokeVolume * Math.sqrt(Math.max(0.25, SVR / baselineSVR)))
    );
    let sysBP = Math.round(smoothedMAP + pulsePressure * 0.55);
    let diaBP = Math.round(Math.max(10, smoothedMAP - pulsePressure * 0.45));

    // ----------------------------------------------------
    // 8. MYOCARDIAL OXYGEN SUPPLY/DEMAND (MVO2 & ISCHEMIA)
    // ----------------------------------------------------
    // MVO2 index = HR * SysBP * Inotropy
    const baselineMVO2 = baseHR * baseMAP * 1.0;
    const currentMVO2 = targetHR * sysBP * inotropicStateEmax;
    const demandRatio = currentMVO2 / Math.max(1, baselineMVO2);

    // Coronary Perfusion Pressure ~ Diastolic BP - LVEDP
    const cpp = Math.max(0, diaBP - 8);
    const coronaryAdequacy = cpp / Math.max(1, baseMAP * 0.6);

    let ischemRatePerMinute = 0;
    if (demandRatio > 1.8 && coronaryAdequacy < 1.1) {
      // Severe mismatch (e.g. Alpha-2 peripheral constriction + Atropine tachycardia)
      ischemRatePerMinute = 0.08 * (demandRatio - 1.5);
    } else if (targetMAP < Math.max(32, baseMAP * 0.52)) {
      // Coronary hypoperfusion is distinct from the higher equine MAP target used
      // to prevent dependent-muscle/nerve injury during prolonged recumbency.
      const myocardialCriticalMap = Math.max(32, baseMAP * 0.52);
      const deficit = myocardialCriticalMap - targetMAP;
      ischemRatePerMinute = 0.04 * (deficit / 20.0);
    } else if (previousIschemiaScore > 0) {
      // Recovery
      ischemRatePerMinute = -0.015;
    }

    if (previousSpO2 < 80) ischemRatePerMinute += 0.12 * ((80 - previousSpO2) / 20);
    if (previousLactate > 5) ischemRatePerMinute += 0.06 * ((previousLactate - 5) / 5);

    const myocardialIschemiaScore = Math.min(1.0, Math.max(
      0,
      previousIschemiaScore + ischemRatePerMinute * (dtSeconds / 60) + receptors.acuteBolusArrhythmia * 0.0015 * dtSeconds
    ));

    // ----------------------------------------------------
    // 9. CARDIAC RHYTHM DETERMINATION
    // ----------------------------------------------------
    let rhythm: CardiacRhythm = 'sinus';
    let isArrestTriggered = false;
    let arrestType: HemodynamicOutputs['arrestType'];
    let arrestCause: string | undefined;

    // A. Lethal Ischemia / Malignant Ventricular Arrhythmias
    if (myocardialIschemiaScore > 0.75) {
      isArrestTriggered = true;
      arrestType = 'ventricular_fibrillation';
      arrestCause = 'Parada Cardíaca por Fibrilação Ventricular (Isquemia Miocárdica Transmural Crítica por Descasamento MVO2 / Coronariano)';
      rhythm = 'ventricular_fibrillation';
    } else if (myocardialIschemiaScore > 0.40) {
      rhythm = 'ventricular_tachycardia';
    } else if (myocardialIschemiaScore > 0.20 || receptors.acuteBolusArrhythmia > 0.55 || patient.pathologyConditions.gastricDilatationVolvulus) {
      rhythm = 'ventricular_premature_complexes';
    } else if (receptors.hyperkalemicCardiotoxicity > 0.72) {
      rhythm = 'av_block_3rd_degree';
    } else if (speciesConfig.normalPhysiologicalSecondDegreeAVBlock && targetHR < baseHR * 0.95 && receptors.beta1Drive < 0.2) {
      // Normal Equine high vagal tone
      rhythm = 'av_block_2nd_degree';
    } else if (receptors.alpha2Drive > 0.5 && receptors.m2Drive > -0.2) {
      // Alpha-2 induced 2nd degree AV block
      rhythm = 'av_block_2nd_degree';
    } else if (targetHR < speciesInfo.normalVitals.hrMin * 0.75) {
      rhythm = 'sinus_bradycardia';
    } else if (targetHR > speciesInfo.normalVitals.hrMax * 1.25) {
      rhythm = 'sinus_tachycardia';
    } else if (speciesConfig.normalPhysiologicalSinusArrhythmia && receptors.m2Drive > -0.3) {
      rhythm = 'sinus_arrhythmia';
    } else {
      rhythm = 'sinus';
    }

    // B-D. Critical states must persist; global simulation time is not a duration.
    const legacyTachyThreshold = patient.species === 'canine' ? 250 : patient.species === 'feline' ? 285 : patient.species === 'equine' ? 120 : 165;
    const fatalBradyThreshold = Math.max(8, speciesInfo.normalVitals.hrMin * 0.35);
    const fatalTachyThreshold = Math.max(legacyTachyThreshold, speciesInfo.normalVitals.hrMax * 1.55);
    const criticalEventTimers = {
      severeBradycardiaSeconds: targetHR <= fatalBradyThreshold
        ? previousCriticalTimers.severeBradycardiaSeconds + dtSeconds
        : Math.max(0, previousCriticalTimers.severeBradycardiaSeconds - dtSeconds * 2),
      severeTachycardiaSeconds: targetHR >= fatalTachyThreshold
        ? previousCriticalTimers.severeTachycardiaSeconds + dtSeconds
        : Math.max(0, previousCriticalTimers.severeTachycardiaSeconds - dtSeconds * 2),
      profoundHypotensionSeconds: targetMAP < 20
        ? previousCriticalTimers.profoundHypotensionSeconds + dtSeconds
        : Math.max(0, previousCriticalTimers.profoundHypotensionSeconds - dtSeconds * 2),
    };

    if (criticalEventTimers.severeBradycardiaSeconds >= 12) {
      isArrestTriggered = true;
      arrestType = 'asystole';
      arrestCause = `Assistolia Terminal por Bradicardia Refratária (FC ${Math.round(targetHR)} bpm)`;
    }

    if (criticalEventTimers.severeTachycardiaSeconds >= 10) {
      isArrestTriggered = true;
      arrestType = 'ventricular_fibrillation';
      arrestCause = `Taquiarritmia e Fibrilação Ventricular Terminal (FC crítica ${Math.round(targetHR)} bpm com perda de enchimento diastólico)`;
    }

    // D. Feline Lidocaine Toxicity Arrest
    if (patient.species === 'feline' && receptors.naVBlockade > 0.45) {
      isArrestTriggered = true;
      arrestType = 'pea';
      arrestCause = 'Dissociação Eletromecânica (AESP) por Colapso Miocárdico Fulminante por Lidocaína IV em Felino';
    }

    // E. Terminal Hypotension Collapse
    if (criticalEventTimers.profoundHypotensionSeconds >= 18) {
      isArrestTriggered = true;
      arrestType = 'pea';
      arrestCause = 'Parada Cardíaca por Choque Irreversível e Ausência de Perfusão Sistêmica (PAM < 20 mmHg)';
    }

    // Pulse Quality Assessment
    let pulseQuality: HemodynamicOutputs['pulseQuality'] = 'Normal';
    if (targetMAP < 45 || strokeVolumeMl < baselineSV * 0.45) {
      pulseQuality = 'Fraco / Filiforme';
    } else if (pulsePressure > 65 && targetMAP > 85) {
      pulseQuality = 'Célere / Saltão';
    }

    return {
      heartRate: finalHR,
      cardiacRhythm: rhythm,
      systolicBP: Math.round(sysBP),
      diastolicBP: Math.round(diaBP),
      // Preserve solver precision between frames. Rounding here made the closed
      // baroreflex converge to different equilibria at 0.1 s versus 1-2 s steps;
      // presentation components remain responsible for integer display.
      meanArterialPressure: Number(targetMAP.toFixed(3)),
      cardiacOutputLMin,
      strokeVolumeMl,
      systemicVascularResistanceDyne: SVR,
      inotropicStateEmax,
      baroreceptorGain: Number(baroreceptorGain.toFixed(2)),
      baroreceptorVagalTone: Number(baroreceptorEffector.toFixed(2)),
      myocardialIschemiaScore: Number(myocardialIschemiaScore.toFixed(5)),
      criticalEventTimers: {
        severeBradycardiaSeconds: Number(criticalEventTimers.severeBradycardiaSeconds.toFixed(3)),
        severeTachycardiaSeconds: Number(criticalEventTimers.severeTachycardiaSeconds.toFixed(3)),
        profoundHypotensionSeconds: Number(criticalEventTimers.profoundHypotensionSeconds.toFixed(3)),
      },
      isArrestTriggered,
      arrestType,
      arrestCause,
      pulseQuality,
    };
  }
}
