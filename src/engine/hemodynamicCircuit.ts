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
    ruminalBloatSeverity: number = 0
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
    const baselineCOApprox = (patient.weightKg * 0.11); // ~ 110 ml/kg/min
    const baselineSVR = Math.round(((baseMAP - 4) / Math.max(0.1, baselineCOApprox)) * 80);

    // Receptors affecting vascular smooth muscle tone:
    // Vasoconstrictors: Alpha-1, initial Alpha-2 peripheral
    // Vasodilators: Beta-2, Volatile inhalants, Acepromazine (alpha-1 block), local anesthetics
    const alpha1Constriction = Math.max(0, receptors.alpha1Drive) * 0.65;
    const alpha2Constriction = Math.max(0, receptors.alpha2Drive) * 0.40;
    const alpha1Blockade = receptors.alpha1Drive < 0 ? Math.abs(receptors.alpha1Drive) * 0.45 : 0;
    const volatileVasodilation = Math.max(0, receptors.volatileSiteOccupancy) * 0.35;
    const beta2Dilation = Math.max(0, receptors.beta2Drive) * 0.25;

    // Sepsis pathology vasodilation
    const sepsisDilation = patient.pathologyConditions.sepsisVasodilation ? 0.45 : 0;

    const netVascularResistanceFactor = Math.max(
      0.35,
      1.0 + alpha1Constriction + alpha2Constriction - alpha1Blockade - volatileVasodilation - beta2Dilation - sepsisDilation
    );
    const SVR = Math.round(baselineSVR * netVascularResistanceFactor);

    // ----------------------------------------------------
    // 2. PRELOAD & VENOUS RETURN (END-DIASTOLIC VOLUME)
    // ----------------------------------------------------
    // Baseline stroke volume ~ 1.0 - 1.5 ml/kg
    const baselineSV = patient.weightKg * 1.25;
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
    computedSV = Math.max(1.0, Math.min(baselineSV * 2.2, computedSV));
    const strokeVolumeMl = Number(computedSV.toFixed(1));

    // ----------------------------------------------------
    // 5. BARORECEPTOR REFLEX CONTROL LOOP
    // ----------------------------------------------------
    // Sensitivity / Gain of the Baroreceptor reflex (attenuated by depth/volatile agents)
    const volatileSuppression = Math.max(0, receptors.volatileSiteOccupancy) * 0.55;
    const propofolSuppression = receptors.propofolSiteOccupancy * 0.40;
    const baroreceptorGain = Math.max(0.08, 1.0 - volatileSuppression - propofolSuppression);

    // MAP deviation from baseline
    const mapError = previousMAP - baseMAP;

    // Vagal efferent firing on SA node if MAP is elevated (Reflex Bradycardia)
    // Sympathetic disinhibition if MAP is depressed (Compensatory Tachycardia)
    let baroreceptorEffector = -(mapError / 45.0) * baroreceptorGain;
    baroreceptorEffector = Math.max(-1.0, Math.min(1.0, baroreceptorEffector));

    // ----------------------------------------------------
    // 6. HEART RATE DYNAMICS (INTEGRATING MOA + REFLEX)
    // ----------------------------------------------------
    // Primary receptor drives:
    // Beta-1 (+ chronotropy via cAMP)
    // M2 (- chronotropy via hyperpolarization)
    // Alpha-2 (central sympatholysis + reflex bradycardia from peripheral SVR spike)
    let autonomicHRMultiplier = 1.0;

    // Direct receptor effect on SA node
    autonomicHRMultiplier += receptors.beta1Drive * 0.60;
    autonomicHRMultiplier -= receptors.m2Drive * 0.55;
    autonomicHRMultiplier -= receptors.alpha2Drive * 0.45;

    // Baroreceptor feedback contribution
    autonomicHRMultiplier += baroreceptorEffector * 0.35;

    // Anticholinergic unmasking (Atropine / Glycopyrrolate blocks M2 vagal tone)
    if (receptors.m2Drive < -0.3) {
      autonomicHRMultiplier += Math.abs(receptors.m2Drive) * 0.30;
    }

    // Surgical stimulation tachycardia if nociception or depth is insufficient
    if (isSurgicalStimulationActive) {
      const nociceptiveDeficit = Math.max(0, 1.0 - receptors.nociceptiveInhibition);
      const depthDeficit = receptors.gabaAChlorideConductance < 1.0 ? 1.0 - receptors.gabaAChlorideConductance : 0;
      autonomicHRMultiplier += (nociceptiveDeficit * 0.35 + depthDeficit * 0.20);
    }

    let targetHR = baseHR * autonomicHRMultiplier;

    // Pediatric patients depend strictly on heart rate for cardiac output
    const ageTotalYears = patient.ageYears + (patient.ageMonths || 0) / 12;
    if (ageTotalYears < 0.6) {
      targetHR = Math.max(baseHR * 0.7, targetHR);
    }

    targetHR = Math.max(0, Math.min(380, targetHR));

    // ----------------------------------------------------
    // 7. CARDIAC OUTPUT & ARTERIAL PRESSURE
    // ----------------------------------------------------
    let cardiacOutputLMin = (targetHR * strokeVolumeMl) / 1000.0;
    cardiacOutputLMin = Number(cardiacOutputLMin.toFixed(2));

    // Mean Arterial Pressure: MAP = CVP + (CO * SVR / 80)
    const cvp = 4.0;
    let targetMAP = cvp + (cardiacOutputLMin * SVR) / 80.0;

    // Pulse pressure based on stroke volume and arterial compliance
    // Larger SV = wider pulse pressure
    const pulsePressure = Math.max(15, Math.round(strokeVolumeMl * 0.9 * (SVR / baselineSVR)));
    let sysBP = Math.round(targetMAP + pulsePressure * 0.55);
    let diaBP = Math.round(Math.max(10, targetMAP - pulsePressure * 0.45));

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

    let ischemRate = 0;
    if (demandRatio > 1.8 && coronaryAdequacy < 1.1) {
      // Severe mismatch (e.g. Alpha-2 peripheral constriction + Atropine tachycardia)
      ischemRate = 0.08 * (demandRatio - 1.5);
    } else if (targetMAP < speciesConfig.criticalMapThresholdMmHg) {
      // Coronary hypoperfusion
      const deficit = speciesConfig.criticalMapThresholdMmHg - targetMAP;
      ischemRate = 0.04 * (deficit / 20.0);
    } else if (previousIschemiaScore > 0) {
      // Recovery
      ischemRate = -0.015;
    }

    const myocardialIschemiaScore = Math.min(1.0, Math.max(0, previousIschemiaScore + ischemRate * dtSeconds));

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
    } else if (myocardialIschemiaScore > 0.20 || patient.pathologyConditions.gastricDilatationVolvulus) {
      rhythm = 'ventricular_premature_complexes';
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

    // B. Critical Bradycardia Arrest
    const fatalBradyThreshold = patient.species === 'canine' ? 24 : patient.species === 'feline' ? 50 : patient.species === 'equine' ? 12 : 18;
    if (targetHR <= fatalBradyThreshold && simTimeSeconds > 20) {
      isArrestTriggered = true;
      arrestType = 'asystole';
      arrestCause = `Assistolia Terminal por Bradicardia Refratária (FC ${Math.round(targetHR)} bpm)`;
    }

    // C. Extreme Tachycardia / PEA Collapse
    const fatalTachyThreshold = patient.species === 'canine' ? 250 : patient.species === 'feline' ? 285 : patient.species === 'equine' ? 120 : 165;
    if (targetHR >= fatalTachyThreshold && simTimeSeconds > 20) {
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
    if (targetMAP < 20 && simTimeSeconds > 30) {
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
      heartRate: Math.round(targetHR),
      cardiacRhythm: rhythm,
      systolicBP: Math.round(sysBP),
      diastolicBP: Math.round(diaBP),
      meanArterialPressure: Math.round(targetMAP),
      cardiacOutputLMin,
      strokeVolumeMl,
      systemicVascularResistanceDyne: SVR,
      inotropicStateEmax,
      baroreceptorGain: Number(baroreceptorGain.toFixed(2)),
      baroreceptorVagalTone: Number(baroreceptorEffector.toFixed(2)),
      myocardialIschemiaScore: Number(myocardialIschemiaScore.toFixed(2)),
      isArrestTriggered,
      arrestType,
      arrestCause,
      pulseQuality,
    };
  }
}
