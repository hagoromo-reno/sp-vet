import {
  AnesthesiaEquipmentState,
  CardiacRhythm,
  PatientProfile,
  ResuscitationState,
  HemodynamicDrivers,
} from '../types/simulator';
import { SPECIES_DATABASE } from '../data/speciesData';
import { ReceptorStateSnapshot } from './cellularReceptors';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';
import {
  NEUTRAL_PHYSIOLOGICAL_MODIFIERS,
  type PhysiologicalModifiers,
} from './systemCoupling';
import { BiologicalVariationsEngine } from './biologicalVariations';

export interface HemodynamicOutputs {
  drivers: HemodynamicDrivers;
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
  nociceptiveStressLevel: number; // 0 to 1: dynamic neurohumoral adrenergic stress
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
    _equipment: AnesthesiaEquipmentState,
    resuscitation: ResuscitationState,
    isSurgicalStimulationActive: boolean,
    previousMAP: number,
    previousHR: number,
    previousIschemiaScore: number,
    ruminalBloatSeverity: number = 0,
    effectiveFluidExpansionMl: number = 0,
    previousCriticalTimers: HemodynamicOutputs['criticalEventTimers'] = {
      severeBradycardiaSeconds: 0,
      severeTachycardiaSeconds: 0,
      profoundHypotensionSeconds: 0,
    },
    previousSpO2: number = 98,
    previousLactate: number = 1,
    previousNociceptiveStress: number = 0,
    integratedNociceptiveInput: number = 0,
    catecholamineReserve: number = 1,
    previousOxygenDeliveryMlKgMin: number = 20,
    coupling: PhysiologicalModifiers = NEUTRAL_PHYSIOLOGICAL_MODIFIERS
  ): HemodynamicOutputs {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;

    const baseHR = patient.baselineVitals.hr;
    const baseMAP = patient.baselineVitals.map;

    // Receptors affecting vascular smooth muscle tone:
    // Vasoconstrictors: Alpha-1, initial Alpha-2 peripheral
    // Vasodilators: Beta-2, Volatile inhalants, Acepromazine (alpha-1 block), local anesthetics
    const adrenergicResponse = coupling.adrenergicResponsiveness;
    const alpha1Constriction = Math.max(0, receptors.alpha1Drive) * 0.65 * adrenergicResponse;
    const alpha2Constriction = Math.max(0, receptors.alpha2Drive) * 1.10;
    const alpha1Blockade = receptors.alpha1Drive < 0 ? Math.min(1, Math.abs(receptors.alpha1Drive)) * 0.16 : 0;
    const volatileVasodilation = Math.min(0.68, Math.max(0, receptors.volatileMacExposure) * 0.18);
    const beta2Dilation = Math.max(0, receptors.beta2Drive) * 0.25;
    const calibratedPressureDilation = Math.max(0, -receptors.directBloodPressureEffect) * 0.10;
    const titratableDirectVasodilation = receptors.directVasodilatorEffect * 0.52;
    const calibratedPressureSupport = Math.max(0, receptors.directBloodPressureEffect) * 0.16 * adrenergicResponse;
    const acuteVasodilation = receptors.acuteBolusHypotension * 0.28 + receptors.histamineRelease * 0.22;

    // Sepsis pathology vasodilation
    const sepsisDilation = patient.pathologyConditions.sepsisVasodilation ? 0.45 : 0;

    // ----------------------------------------------------
    // NOCICEPTIVE BREAKTHROUGH & DYNAMIC ADRENERGIC STRESS
    // ----------------------------------------------------
    // Autonomic response (tachycardia + vasoconstriction) to surgical pain
    // depends on the balance between noxious stimulus and 4 protective axes:
    // 1. Analgesia (Opioids, Local anesthetics, Alpha-2 spinal analgesia, Ketamine NMDA block)
    // 2. Hypnosis / Anesthetic Depth (GABA-A cortical/subcortical depression, volatile MAC)
    // 3. Central Sedation & Alpha-2 Sympatholysis (Inhibition of locus coeruleus & RVLM sympathetic outflow)
    // 4. Dissociative sensory uncoupling (Ketamine)
    // 1. Analgesia: Opioids, Local anesthetics (NaV), and Spinal Alpha-2 form the true antinociceptive gate
    const analgesiaProt = receptors.nociceptiveInhibition;
    // Ketamine dissociates somatic sensory perception (NMDA), offering moderate protection (up to 60%)
    const dissociativeSomaticProt = Math.min(0.60, receptors.dissociativeEffect * 0.60);
    const totalAnalgesicProtection = Math.min(0.98, analgesiaProt + dissociativeSomaticProt * (1 - analgesiaProt));

    const afferentStimulus = integratedNociceptiveInput > 0
      ? integratedNociceptiveInput
      : (isSurgicalStimulationActive ? 1.0 : 0.0);

    // Unblocked nociceptive transmission arriving at the brainstem:
    const unblockedNociceptiveDrive = Math.max(0, afferentStimulus * (1 - totalAnalgesicProtection));

    // 2. Autonomic breakthrough modulation:
    // Cortical hypnosis and tranquilization suppress conscious perception and voluntary movement,
    // but subcortical/spinoreticular sympathetic reflex arcs remain functional.
    // Deep hypnotic depression blunts the autonomic surge only moderately (~25%),
    // whereas central Alpha-2 agonists provide potent sympatholysis (inhibition of locus coeruleus/RVLM).
    const hypnoticAutonomicDampening = Math.min(0.28, Math.max(receptors.hypnoticEffect, receptors.volatileSiteOccupancy) * 0.28);
    const alpha2Sympatholysis = Math.min(0.85, Math.max(0, receptors.alpha2Drive) * 0.85);

    const targetBreakthrough = Math.max(0, Math.min(
      1.0,
      unblockedNociceptiveDrive * (1 - hypnoticAutonomicDampening) * (1 - alpha2Sympatholysis)
    ));

    // Physiological neuro-endocrine wash-in and wash-out kinetics:
    // Acute pain triggers catecholamine secretion with realistic onset latency (tau = 4.5s)
    // Relief of pain is followed by slower physiological clearance / reuptake (tau = 18.0s)
    let currentStress = previousNociceptiveStress;
    if (targetBreakthrough > currentStress) {
      const riseAlpha = 1.0 - Math.exp(-dtSeconds / 4.5);
      currentStress = currentStress + (targetBreakthrough - currentStress) * riseAlpha;
    } else {
      const decayAlpha = 1.0 - Math.exp(-dtSeconds / 18.0);
      currentStress = currentStress + (targetBreakthrough - currentStress) * decayAlpha;
    }
    const nociceptiveStressLevel = Number(Math.max(0, Math.min(1.0, currentStress)).toFixed(4));
    const surgicalVasoconstriction = nociceptiveStressLevel * 0.28 * Math.max(0.25, catecholamineReserve);

    // ----------------------------------------------------
    // 1. PRELOAD & INTRAVASCULAR BLOOD VOLUME
    // ----------------------------------------------------
    // SV is derived from a species-scaled resting cardiac index. Using a fixed
    // mL/kg stroke volume made pressure/CO impossible for horses, cattle and birds.
    const baselineCOApprox = patient.weightKg * speciesConfig.cardiacOutputMlKgMin / 1000;
    const baseSVRApprox = Math.round(((baseMAP - 4) / Math.max(0.1, baselineCOApprox)) * 80);
    const baselineSV = (baselineCOApprox * 1000) / Math.max(1, baseHR);
    const expectedBloodVolumeMl = Math.max(1, patient.weightKg * speciesInfo.bloodVolumeMlPerKg);
    const observedDeficit = Math.max(0, 1 - patient.baselineVitals.bloodVolumeMl / expectedBloodVolumeMl);
    const declaredDeficit = Math.max(
      observedDeficit,
      (patient.pathologyConditions.hypovolemiaSeverity || 0) * 0.45,
      patient.pathologyConditions.traumaHemorrhage ? 0.30 : 0
    );
    let bloodVolumeRatio = 1.0 - declaredDeficit;

    // Splenic auto-transfusion (Canine/Equine under adrenergic stress)
    if (receptors.alpha1Drive > 0.3 || receptors.beta1Drive > 0.4) {
      bloodVolumeRatio += speciesConfig.splenicContractionReserve * 0.5;
    }

    // Persistent central-volume compartments account for distribution and loss
    // of effect; cumulative pump volume must not expand the circulation forever.
    bloodVolumeRatio = Math.min(1.45, bloodVolumeRatio + effectiveFluidExpansionMl / expectedBloodVolumeMl);

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
      (receptors.directVenodilatorEffect ?? 0) * 0.12 +
      acuteVasodilation * 0.25;
    bloodVolumeRatio = Math.max(0.3, bloodVolumeRatio - venousPooling);
    bloodVolumeRatio = Math.min(1.4, bloodVolumeRatio + receptors.volumeExpansion * 0.28);

    // Effective circulating preload
    const preloadEDV = baselineSV * 1.5 * Math.max(0.3, bloodVolumeRatio);

    // ----------------------------------------------------
    // DYNAMIC SHOCK STAGES & COMPENSATORY HEMODYNAMICS
    // ----------------------------------------------------
    // Hypovolemic/Hemorrhagic Deficit:
    const effectiveHypovolemicDeficit = Math.max(0, 1.0 - bloodVolumeRatio);

    // Shock Staging:
    // Compensated Shock (Stage 1-2):
    // Maintained by endogenous sympathetic drive and baroreflex. Compensatory tachycardia
    // increases forward flow under reduced stroke volume.
    // Decompensated / Vasoplegic Shock (Stage 3):
    // Severe lactic acidosis (lactate > 4.5 mmol/L) causes progressive vascular smooth muscle
    // paralysis (vasoplegia) and myocardial contractility failure.
    let acidoticVasoplegia = 0;
    let acidoticInotropyDepression = 1.0;

    if (previousLactate > 4.5 || effectiveHypovolemicDeficit > 0.08 || patient.pathologyConditions.sepsisVasodilation) {
      if (previousLactate > 4.5) {
        const acidoticSeverity = Math.min(1.0, (previousLactate - 4.5) / 5.5);
        acidoticVasoplegia = acidoticSeverity * 0.26;
        acidoticInotropyDepression = Math.max(0.58, 1.0 - acidoticSeverity * 0.35);
      }
    }

    // ----------------------------------------------------
    // 2. SYSTEMIC VASCULAR RESISTANCE (AFTERLOAD)
    // ----------------------------------------------------
    const baselineSVR = baseSVRApprox;

    // Em choque hipovolêmico ou hemorrágico, o bloqueio alfa-1 (acepromazina) anula a vasoconstrição compensatória
    const shockAlpha1Failure = (receptors.alpha1Drive < 0 && declaredDeficit > 0.10)
      ? Math.min(0.40, Math.abs(receptors.alpha1Drive) * declaredDeficit * 0.90)
      : 0;
    // Fenômeno da inversão da epinefrina: sob bloqueio alfa-1, o estímulo beta-2 vasodilata sem oposição alfa-1
    const epinephrineReversalDilation = (receptors.alpha1Drive < 0 && receptors.beta2Drive > 0.05)
      ? Math.min(0.35, Math.abs(receptors.alpha1Drive) * receptors.beta2Drive * 0.50)
      : 0;

    const netVascularResistanceFactor = Math.max(
      0.25,
      (1.0 + alpha1Constriction + alpha2Constriction + calibratedPressureSupport + surgicalVasoconstriction
        - alpha1Blockade - volatileVasodilation - beta2Dilation - calibratedPressureDilation
        - acuteVasodilation - titratableDirectVasodilation - sepsisDilation - acidoticVasoplegia
        - shockAlpha1Failure - epinephrineReversalDilation) * coupling.vascularResistanceMultiplier
    );
    const SVR = Math.round(baselineSVR * netVascularResistanceFactor);

    // ----------------------------------------------------
    // 3. MYOCARDIAL INOTROPY & CONTRACTILITY (Emax)
    // ----------------------------------------------------
    // Inotropic state driven by intracellular calcium [Ca2+]i
    // Normal baseline Emax = 1.0
    const responsiveCalcium = receptors.intracellularCalcium <= 1 ? receptors.intracellularCalcium
      : 1 + (receptors.intracellularCalcium - 1) * adrenergicResponse;
    let inotropyFactor = responsiveCalcium * acidoticInotropyDepression;

    // DCM pathology
    if (patient.pathologyConditions.cardiacFailureDCM) {
      inotropyFactor *= 0.45;
    }

    // ASA Physical Status Modifiers on Cardiovascular Reserve
    const baseAsa = patient.asa.replace(/-?E$/, '');
    let asaReserveFactor = 1.0;
    let asaBaroreflexFactor = 1.0;
    if (baseAsa === 'II') {
      asaReserveFactor = 0.92;
      asaBaroreflexFactor = 0.90;
    } else if (baseAsa === 'III') {
      asaReserveFactor = 0.75;
      asaBaroreflexFactor = 0.65;
    } else if (baseAsa === 'IV' || baseAsa === 'V') {
      asaReserveFactor = 0.52;
      asaBaroreflexFactor = 0.40;
    }

    inotropyFactor *= asaReserveFactor * coupling.contractilityMultiplier;

    // Volatile myocardial depression is already included in intracellular calcium.

    // Feline local anesthetic toxicity
    if (patient.species === 'feline' && receptors.naVBlockade > 0.25) {
      inotropyFactor = Math.max(0.1, inotropyFactor - receptors.naVBlockade * 0.70);
    }

    // Propofol and acute induction myocardial contractility depression
    if (receptors.propofolSiteOccupancy > 0.15) {
      inotropyFactor = Math.max(0.35, inotropyFactor - (receptors.propofolSiteOccupancy - 0.15) * 0.22);
    }
    if (receptors.acuteBolusHypotension > 0.15) {
      inotropyFactor = Math.max(0.35, inotropyFactor - (receptors.acuteBolusHypotension - 0.15) * 0.20);
    }

    const inotropicStateEmax = Number(inotropyFactor.toFixed(2));

    // ----------------------------------------------------
    // 4. STROKE VOLUME (SV) DYNAMICS
    // ----------------------------------------------------
    // SV = (Preload * Inotropy) / (1 + AfterloadRatio * 0.5)
    const afterloadRatio = SVR / baselineSVR;
    let computedSV = (preloadEDV * 0.65 * inotropyFactor) / (0.4 + afterloadRatio * 0.6);
    // Em cardiopatas (DCM/ICC), a elevação de pós-carga por alfa-2 descompensa severamente o ventrículo insuficiente
    if (patient.pathologyConditions.cardiacFailureDCM && receptors.alpha2Drive > 0.15) {
      const dcmAfterloadPenalty = 1 / (1 + receptors.alpha2Drive * 1.5);
      computedSV *= dcmAfterloadPenalty;
    }
    computedSV = Math.max(baselineSV * 0.12, Math.min(baselineSV * 2.2, computedSV));
    let strokeVolumeMl = computedSV;

    // ----------------------------------------------------
    // ----------------------------------------------------
    // 5. BARORECEPTOR REFLEX CONTROL LOOP (PHYSIOLOGICALLY DAMPED)
    // ----------------------------------------------------
    // Sensitivity / Gain of the Baroreceptor reflex (attenuated by depth/volatile agents and ASA status)
    const volatileSuppression = Math.min(0.85, Math.max(0, receptors.volatileMacExposure) * 0.27);
    const propofolSuppression = receptors.propofolSiteOccupancy * 0.30;
    const sedativeSuppression = receptors.centralSedation * 0.18 + Math.max(0, receptors.alpha2Drive) * 0.18;
    const baroreceptorGain = Math.max(0.08, (1.0 - volatileSuppression - propofolSuppression - sedativeSuppression) * asaBaroreflexFactor);

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
    autonomicHRMultiplier += receptors.beta1Drive * 0.55 * adrenergicResponse;
    const vagolyticReserve = (0.20 + speciesConfig.restingVagalTone * 0.40)
      * Math.min(1, speciesInfo.normalVitals.hrTypical / Math.max(1, baseHR))
      * Math.max(0.35, 1 - Math.max(0, receptors.beta1Drive) * 0.5 - nociceptiveStressLevel * 0.4);
    autonomicHRMultiplier -= Math.max(0, receptors.m2Drive) * 0.50;
    autonomicHRMultiplier += Math.max(0, -receptors.m2Drive) * vagolyticReserve;
    autonomicHRMultiplier -= receptors.alpha2Drive * 0.40;
    autonomicHRMultiplier += receptors.directHeartRateEffect * 0.32;
    autonomicHRMultiplier -= receptors.acuteBolusBradycardia * 0.28;
    autonomicHRMultiplier -= receptors.hyperkalemicCardiotoxicity * 0.30;
    const nodalDeltaBpm = baseHR * (autonomicHRMultiplier - 1);
    const systemicDeltaBpm = baseHR * autonomicHRMultiplier * (coupling.heartRateMultiplier - 1);
    autonomicHRMultiplier *= coupling.heartRateMultiplier;

    // Baroreceptor feedback contribution (smoothly bounded)
    autonomicHRMultiplier += baroreceptorEffector;

    // Severe metabolic acidosis SA node failure (terminal Stage 3 shock)
    if (previousLactate > 8.0) {
      const terminalBradyDrive = Math.min(0.40, (previousLactate - 8.0) * 0.08);
      autonomicHRMultiplier -= terminalBradyDrive;
    }

    // Surgical stimulation tachycardia scaled strictly by dynamic nociceptive stress
    // Alpha-2 agonists and M2 vagal tone hyperpolarize the sinoatrial node via Gi/GIRK,
    // attenuating chronotropic breakthrough during painful stimuli
    if (nociceptiveStressLevel > 0.01) {
      const nodalSympatholyticBraking = Math.max(0.35, 1.0 - Math.max(0, receptors.alpha2Drive) * 0.75);
      autonomicHRMultiplier += nociceptiveStressLevel * 0.36 * nodalSympatholyticBraking
        * Math.max(0.25, catecholamineReserve);
    }

    let targetHR = baseHR * autonomicHRMultiplier;

    // Respiratory sinus arrhythmia is a real beat-to-breath vagal modulation in
    // resting dogs, not merely a rhythm label. It fades with deep respiratory
    // depression and strong sympathetic activation.
    if (speciesConfig.normalPhysiologicalSinusArrhythmia && receptors.respiratoryDepression < 0.65) {
      const respiratoryPhase = 2 * Math.PI * simTimeSeconds * patient.baselineVitals.rr / 60;
      const vagalAmplitude = baseHR * 0.055
        * Math.max(0.2, 1 - Math.max(0, receptors.beta1Drive) * 0.7)
        * Math.max(0.2, 1 - nociceptiveStressLevel * 0.8);
      targetHR += Math.sin(respiratoryPhase) * vagalAmplitude;
    }

    const autonomicDepth = Math.max(
      receptors.hypnoticEffect,
      receptors.centralSedation,
      Math.max(0, receptors.alpha2Drive)
    );
    const variations = BiologicalVariationsEngine.compute(
      simTimeSeconds,
      patient,
      autonomicDepth,
      resuscitation.isCPRActive
    );

    // Pediatric patients depend strictly on heart rate for cardiac output
    const ageTotalYears = patient.ageYears + (patient.ageMonths || 0) / 12;
    if (ageTotalYears < 0.6) {
      targetHR = Math.max(baseHR * 0.7, targetHR);
    }

    targetHR = Math.max(0, Math.min(350, targetHR));

    // SA Node Physiological Inertia (1st-order low-pass filter: tau = 1.8s)
    // Eliminates 100ms numerical limit-cycle flickering while maintaining dt-invariance
    const prevVariationHR = resuscitation.isCPRActive ? 0
      : BiologicalVariationsEngine.compute(Math.max(0, simTimeSeconds - dtSeconds), patient, autonomicDepth, false).hrVariationBpm;
    const prevCoreHR = previousHR > 0 ? (previousHR - prevVariationHR) : targetHR;
    const hrSmoothingAlpha = 1.0 - Math.exp(-dtSeconds / 1.8);
    const effectiveHR = prevCoreHR > 0 ? (prevCoreHR + (targetHR - prevCoreHR) * hrSmoothingAlpha) : targetHR;
    const finalHR = Number((effectiveHR + (resuscitation.isCPRActive ? 0 : variations.hrVariationBpm)).toFixed(3));

    // Longer diastole can partly restore SV during vagal/sympatholytic bradycardia.
    // It cannot manufacture preload in hemorrhage or normalize a failing ventricle.
    if (effectiveHR > 0 && effectiveHR < baseHR) {
      const fillingReserve = Math.min(1, Math.max(0, (bloodVolumeRatio - 0.45) / 0.55));
      strokeVolumeMl *= 1 + Math.min(0.45, (baseHR / effectiveHR - 1) * 0.6) * fillingReserve;
    }
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

    // Low-pass filter MAP to eliminate high-frequency flickering with dt-invariance
    const prevVariationBP = resuscitation.isCPRActive ? 0
      : BiologicalVariationsEngine.compute(Math.max(0, simTimeSeconds - dtSeconds), patient, autonomicDepth, false).bpVariationMmHg;
    const prevCoreMAP = previousMAP > 0 ? (previousMAP - prevVariationBP) : rawMAP;
    const mapSmoothingAlpha = 1.0 - Math.exp(-dtSeconds / 1.4);
    const smoothedMAP = prevCoreMAP > 0 ? (prevCoreMAP + (rawMAP - prevCoreMAP) * mapSmoothingAlpha) : rawMAP;
    const finalMAP = Number(Math.max(5, smoothedMAP + (resuscitation.isCPRActive ? 0 : variations.bpVariationMmHg)).toFixed(3));
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
    let sysBP = Math.round(finalMAP + pulsePressure * 0.55);
    let diaBP = Math.round(Math.max(10, finalMAP - pulsePressure * 0.45));

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
    } else if (patient.pathologyConditions.cardiacFailureDCM && receptors.alpha2Drive > 0.25) {
      // Descompensação isquêmica por estresse de parede em miocárdio insuficiente sob alfa-2
      ischemRatePerMinute = 0.10 * receptors.alpha2Drive;
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
    if (previousOxygenDeliveryMlKgMin < 8) {
      ischemRatePerMinute += 0.10 * ((8 - previousOxygenDeliveryMlKgMin) / 8);
    }
    if (previousLactate > 5) ischemRatePerMinute += 0.06 * ((previousLactate - 5) / 5);
    ischemRatePerMinute += coupling.myocardialIschemiaRatePerMinute;

    const myocardialIschemiaScore = Math.min(1.0, Math.max(
      0,
      previousIschemiaScore + ischemRatePerMinute * (dtSeconds / 60)
        + receptors.acuteBolusArrhythmia * 0.0015 * dtSeconds
        + coupling.arrhythmogenicBurden * 0.0012 * dtSeconds
    ));

    // ----------------------------------------------------
    // 9. CARDIAC RHYTHM DETERMINATION
    // ----------------------------------------------------
    let rhythm: CardiacRhythm = 'sinus';
    let isArrestTriggered = false;
    let arrestType: HemodynamicOutputs['arrestType'];
    let arrestCause: string | undefined;

    // A. Lethal Ischemia / Malignant Ventricular Arrhythmias
    const hasAntiarrhythmicProtection = receptors.antiarrhythmicIbProtection > 0.30;
    if (myocardialIschemiaScore > 0.75) {
      isArrestTriggered = true;
      arrestType = 'ventricular_fibrillation';
      arrestCause = 'Parada Cardíaca por Fibrilação Ventricular (Isquemia Miocárdica Transmural Crítica por Descasamento MVO2 / Coronariano)';
      rhythm = 'ventricular_fibrillation';
    } else if ((myocardialIschemiaScore > 0.40 || coupling.arrhythmogenicBurden > 0.78) && !hasAntiarrhythmicProtection) {
      rhythm = 'ventricular_tachycardia';
    } else if ((myocardialIschemiaScore > 0.20 || receptors.acuteBolusArrhythmia > 0.55 || coupling.arrhythmogenicBurden > 0.28 || patient.pathologyConditions.gastricDilatationVolvulus) && !hasAntiarrhythmicProtection) {
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
      drivers: {
        preloadRatio: bloodVolumeRatio,
        vascularResistanceRatio: netVascularResistanceFactor,
        contractilityRatio: inotropyFactor,
        nodalDeltaBpm,
        baroreflexDeltaBpm: baseHR * baroreceptorEffector,
        systemicDeltaBpm,
        otherDeltaBpm: targetHR - baseHR - nodalDeltaBpm - baseHR * baroreceptorEffector - systemicDeltaBpm,
        targetHeartRate: targetHR,
      },
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
      nociceptiveStressLevel,
    };
  }
}
