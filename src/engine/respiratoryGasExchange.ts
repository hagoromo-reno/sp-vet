import {
  AnesthesiaEquipmentState,
  CapnogramType,
  PatientProfile,
  RespiratoryPattern,
} from '../types/simulator';
import { SPECIES_DATABASE } from '../data/speciesData';
import { ReceptorStateSnapshot } from './cellularReceptors';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';

export interface RespiratoryOutputs {
  respiratoryRate: number; // bpm
  tidalVolumeMl: number; // mL
  minuteVolumeL: number; // L/min
  respiratoryPattern: RespiratoryPattern;
  etCO2: number; // mmHg
  fiCO2: number; // mmHg
  capnogramType: CapnogramType;
  pulseOximetrySpO2: number; // %
  arterialBloodGases: {
    pH: number;
    paO2: number; // mmHg
    paCO2: number; // mmHg
    bicarbonate: number; // mEq/L
    lactate: number; // mmol/L
    potassium: number; // mEq/L
    hematocritPct: number; // %
  };
  isRespiratoryArrest: boolean;
  isSpontaneousApnea: boolean;
  respiratoryArrestCause?: string;
  hypoxiaSecondsAccumulated: number;
  currentAirwayPressureCmH2O: number;
  sodaLimeExhaustionPct: number;
}

export class RespiratoryGasExchangeEngine {
  /**
   * Biomechanically accurate respiratory and blood-gas exchange model:
   * 1. Medullary pre-Bötzinger rhythm generation modulated by PaCO2, mu-opioids, and GABA-A hyperpolarization.
   * 2. Intrapulmonary shunt (Qs/Qt) reflecting species positional atelectasis (equine/bovine).
   * 3. Oxyhemoglobin dissociation and dynamic arterial PaO2/SpO2 desaturation.
   * 4. Alveolar gas equation and Henderson-Hasselbalch continuous acid-base balance.
   */
  public static stepRespiration(
    dtSeconds: number,
    simTimeSeconds: number,
    patient: PatientProfile,
    receptors: ReceptorStateSnapshot,
    equipment: AnesthesiaEquipmentState,
    _isSurgicalStimulationActive: boolean,
    previousSpO2: number,
    previousPaO2: number,
    previousPaCO2: number,
    previousHypoxiaSeconds: number,
    previousLactate: number,
    pulmonaryShuntFractionPct: number,
    ruminalBloatSeverity: number = 0,
    cardiacOutputRatio: number = 1,
    meanArterialPressure: number = 80,
    previousRespiratoryRate?: number,
    previousEtCO2?: number,
    nociceptiveStressLevel: number = 0,
    persistentHematocritPct?: number
  ): RespiratoryOutputs {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const baselineRR = patient.baselineVitals.rr;
    const baselineVT = patient.weightKg
      * ((speciesInfo.tidalVolumeMlKg[0] + speciesInfo.tidalVolumeMlKg[1]) / 2);

    const isIntubated = equipment.intubationStatus === 'intubated_tracheal';
    const isEsophageal = equipment.intubationStatus === 'intubated_esophageal';
    const isUnintubated = equipment.intubationStatus === 'unintubated' || equipment.intubationStatus === 'extubated';

    // ----------------------------------------------------
    // 1. MEDULLARY RESPIRATORY RHYTHM (pre-Bötzinger Complex)
    // ----------------------------------------------------
    // Spontaneous Respiratory Drive governed by:
    // - Mu-opioid receptor activation (shifts apneic threshold right, blunts CO2 sensitivity)
    // - GABA-A chloride conductance (cortical and bulbar hypnotic suppression)
    // - Neuromuscular junction blockade (flaccid motor paralysis)
    let isRespiratoryArrest = false;
    let arrestCause: string | undefined;

    let spontaneousRR = baselineRR;
    let spontaneousVT = baselineVT;

    // A. Neuromuscular Blockade Paralysis
    if (receptors.nmOccupancy > 0.40) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = 'Ausência de ventilação espontânea por Bloqueio Neuromuscular Periférico (suporte ventilatório obrigatório)';
    }
    // B. Post-Induction Apnea (Propofol / Alfaxalone / Thiopental Bolus or BZD synergy)
    else if (
      receptors.acuteBolusRespiratoryDepression > 0.72 ||
      receptors.hypnoticEffect > 0.94 ||
      receptors.respiratoryDepression > 0.90 ||
      (receptors.propofolSiteOccupancy > 0.78 && receptors.bzdAllostericOccupancy > 0.25)
    ) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = receptors.hypnoticEffect > 0.96
        ? 'Parada Respiratória por Depressão Bulbar Profunda (Plano Anestésico Excessivo / Estágio IV)'
        : 'Apneia Pós-Indução por Bólus de Agente Indutor (Propofol/GABA-A)';
    }
    // C. Opioid-Induced Central Apnea
    else if (receptors.muOpioidDrive > 0.88 && receptors.respiratoryDepression > 0.82) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = 'Apneia Central por Sinergismo Depressor Bulbar (Opioide Mu-Puro + Anestésico Geral)';
    }
    // D. Graded Bradypnea / Hypoventilation in Surgical Planes
    else {
      // GABA-A depression
      const gabaSuppression = receptors.hypnoticEffect * 0.55;
      const opioidSuppression = Math.max(0, receptors.muOpioidDrive) * 0.22;
      const netDepression = Math.max(receptors.respiratoryDepression, gabaSuppression + opioidSuppression);

      // Graded depression preserves a compensatory ventilatory floor. True apnea
      // is handled by the explicit thresholds above rather than emerging from
      // multiplying moderate RR and VT reductions into near-zero ventilation.
      spontaneousRR = Math.max(0, baselineRR * (1.0 - Math.min(0.80, netDepression * 0.78)));
      spontaneousVT = Math.max(0, baselineVT * (1.0 - Math.min(0.50, netDepression * 0.45)));

      // Hypercapnic chemoreflex, attenuated by opioids and deep hypnosis.
      const co2Stimulus = Math.max(0, Math.min(1.2, (previousPaCO2 - 42) / 35));
      const chemoreflexGain = Math.max(0.08, 1 - Math.max(0, receptors.muOpioidDrive) * 0.65 - receptors.hypnoticEffect * 0.55);
      spontaneousRR *= 1 + co2Stimulus * chemoreflexGain * 0.55;
      spontaneousVT *= 1 + co2Stimulus * chemoreflexGain * 0.22;

      // Nociceptive afferent tachypnea scaled strictly by dynamic neurohumoral stress
      if (nociceptiveStressLevel > 0.02) {
        spontaneousRR *= (1.0 + nociceptiveStressLevel * 0.42);
        spontaneousVT *= (1.0 + nociceptiveStressLevel * 0.20);
      }

      // Ruminal Bloat diaphragmatic mechanical restriction (Bovine)
      if (ruminalBloatSeverity > 0.2) {
        spontaneousVT = Math.max(baselineVT * 0.35, spontaneousVT * (1.0 - ruminalBloatSeverity * 0.55));
        spontaneousRR *= (1.0 + ruminalBloatSeverity * 0.40); // compensatory tachypnea
      }

      if (patient.pathologyConditions.brachycephalicObstruction && isUnintubated) {
        spontaneousVT *= 0.68;
        spontaneousRR *= 1.18;
      }
    }

    spontaneousRR = isRespiratoryArrest ? 0 : spontaneousRR;
    spontaneousVT = isRespiratoryArrest ? 0 : spontaneousVT;

    // ----------------------------------------------------
    // 2. MANUAL BAGGING & MECHANICAL VENTILATOR COUPLING
    // ----------------------------------------------------
    let finalRR = spontaneousRR;
    let finalVT = spontaneousVT;
    let currentPaw = 0;

    // A. Check for Manual Breath (Bag Squeeze) or Cadence
    const hasActiveTrachealTube = equipment.intubationStatus === 'intubated_tracheal';
    const hasSealedAirway = hasActiveTrachealTube || equipment.intubationStatus === 'laryngeal_mask';
    const isSingleManualBreathActive = Boolean(
      equipment.isManualBreathTriggered || 
      (equipment.manualBreathLastTriggerTime && (simTimeSeconds - equipment.manualBreathLastTriggerTime) < 2.0)
    );
    const hasManualCadence = Boolean(
      equipment.manualVentilationCadenceSeconds && equipment.manualVentilationCadenceSeconds > 0
    );

    const baseCompliance = Math.max(0.1, speciesConfig.dynamicComplianceMlKgCmH2O * patient.weightKg);
    const restrictiveFactor = Math.max(0.38, 1 - ruminalBloatSeverity * 0.48 - Math.max(0, pulmonaryShuntFractionPct - 5) / 100);
    const effectiveCompliance = baseCompliance * restrictiveFactor;

    if (hasSealedAirway && equipment.isVentilatorActive && equipment.ventilatorMode !== 'spontaneous') {
      // Mechanical Ventilator Active
      finalRR = equipment.ventilatorSettings.rateBpm;
      const peep = equipment.ventilatorSettings.peepCmH2O;
      const pressureLimit = Math.max(peep + 1, equipment.ventilatorSettings.pipPressureLimitCmH2O);
      const expiratoryParts = Number(equipment.ventilatorSettings.ieRatio.split(':')[1]) || 2;
      const inspiratoryTimeSeconds = (60 / Math.max(1, finalRR)) / (1 + expiratoryParts);
      const pressureEquilibration = 1 - Math.exp(-inspiratoryTimeSeconds / 0.45);
      if (equipment.ventilatorMode === 'pcv_pressure') {
        const drivingPressure = Math.max(0, pressureLimit - peep);
        finalVT = Math.min(patient.weightKg * 18, effectiveCompliance * drivingPressure * pressureEquilibration);
        currentPaw = pressureLimit;
      } else {
        const requestedVT = Math.max(0, equipment.ventilatorSettings.tidalVolumeMl);
        const inspiratoryFlowMlSec = requestedVT / Math.max(0.15, inspiratoryTimeSeconds);
        const resistancePressure = inspiratoryFlowMlSec * 0.018 / Math.sqrt(Math.max(0.1, patient.weightKg));
        const requiredPeakPressure = peep + requestedVT / effectiveCompliance + resistancePressure;
        currentPaw = Math.min(pressureLimit, requiredPeakPressure);
        finalVT = requiredPeakPressure > pressureLimit
          ? Math.max(0, effectiveCompliance * Math.max(0, pressureLimit - peep))
          : requestedVT;
      }
    } else if (hasActiveTrachealTube && (isSingleManualBreathActive || hasManualCadence)) {
      // Manual Bag Ventilation (Apertar Balão / Cadência Manual)
      const cadenceRate = hasManualCadence ? Math.round(60 / (equipment.manualVentilationCadenceSeconds || 6)) : 10;
      finalRR = Math.max(spontaneousRR, cadenceRate);
      const manualVT = baselineVT;
      finalVT = Math.max(spontaneousVT, manualVT);
      currentPaw = 16; // Normal manual bag peak airway pressure ~16 cmH2O
    } else {
      const closedCircuitPressure = equipment.aplValveState === 'closed' && equipment.oxygenFlowLMin > 1.2
        ? (equipment.isOxygenFlushActive ? 42 : 32)
        : 2;
      currentPaw = spontaneousRR > 0 ? closedCircuitPressure : 0;
    }

    const minuteVolumeL = Number(((finalRR * finalVT) / 1000.0).toFixed(2));
    const deadSpaceMl = patient.weightKg * speciesConfig.anatomicDeadSpaceMlKg;
    const alveolarVentilationLMin = Math.max(0, ((finalVT - deadSpaceMl) * finalRR) / 1000.0);

    // ----------------------------------------------------
    // 3. CAPNOGRAPHY (EtCO2 & FiCO2)
    // ----------------------------------------------------
    let sodaLimeExhaustionPct = equipment.sodaLimeExhaustionPct;
    if (equipment.circuitType.includes('circle') && equipment.oxygenFlowLMin > 0.1) {
      sodaLimeExhaustionPct = Math.min(100, sodaLimeExhaustionPct + (dtSeconds / 3600) * 8.0);
    }

    let fico2 = 0;
    if (sodaLimeExhaustionPct > 55 && equipment.circuitType.includes('circle')) {
      fico2 = Math.round(((sodaLimeExhaustionPct - 55) / 45) * 16);
    }

    let capnogramType: CapnogramType = 'normal';
    let etco2 = 0;
    let paCO2Estimate = previousPaCO2 || patient.baselineVitals.etco2 + 4.5;

    // Capnography strictly requires an active tracheal tube or laryngeal mask.
    // In an unintubated animal or esophageal intubation, the machine sensor is open to room air (EtCO2 = 0, flatline).
    const isAirwaySampled = equipment.intubationStatus === 'intubated_tracheal' || equipment.intubationStatus === 'laryngeal_mask';

    // Alveolar metabolic production VCO2 and alveolar ventilation ratio
    const baselineAlveolarV = ((baselineVT - deadSpaceMl) * baselineRR) / 1000.0;
    const ventilationRatio = alveolarVentilationLMin / Math.max(0.1, baselineAlveolarV);

    let targetSteadyEtCO2 = patient.baselineVitals.etco2;
    if (finalRR === 0) {
      targetSteadyEtCO2 = 0;
    } else if (ventilationRatio < 0.80) {
      capnogramType = 'hypoventilation';
      const severity = Math.min(1.0, (0.80 - ventilationRatio) / 0.45);
      const maxHypoventEt = patient.baselineVitals.etco2 / Math.max(0.35, ventilationRatio);
      targetSteadyEtCO2 = patient.baselineVitals.etco2 + (maxHypoventEt - patient.baselineVitals.etco2) * severity;
    } else if (ventilationRatio > 1.25) {
      capnogramType = 'hyperventilation';
      const severity = Math.min(1.0, (ventilationRatio - 1.25) / 0.75);
      const minHyperventEt = patient.baselineVitals.etco2 / Math.min(2.5, ventilationRatio);
      targetSteadyEtCO2 = patient.baselineVitals.etco2 - (patient.baselineVitals.etco2 - minHyperventEt) * severity;
    } else {
      capnogramType = 'normal';
    }

    if (fico2 > 0) {
      targetSteadyEtCO2 += fico2;
      capnogramType = 'rebreathing_elevated_baseline';
    }

    // In non-intubated patients (spontaneous breathing with nasal cannula / mask sidestream line),
    // slight room air entrainment slightly dilutes the measured steady peak (~95% of alveolar plateau)
    if (!isAirwaySampled && finalRR > 0) {
      targetSteadyEtCO2 *= 0.95;
    }

    const targetPaCO2 = targetSteadyEtCO2 + 4.5;
    const co2Equilibration = 1 - Math.exp(-dtSeconds / 14);
    paCO2Estimate += (targetPaCO2 - paCO2Estimate) * co2Equilibration;

    if (isEsophageal || finalRR === 0) {
      etco2 = 0;
      capnogramType = 'cardiac_arrest_flat';
    } else {
      // Smooth physiological wash-in/wash-out due to Functional Residual Capacity (FRC)
      // CO2 changes take time (~14 seconds time constant) to wash out or accumulate in lung volume
      const etco2Tau = 14.0; // seconds
      const washFraction = 1 - Math.exp(-dtSeconds / etco2Tau);
      const prevEt = (previousEtCO2 !== undefined && previousEtCO2 > 0) ? previousEtCO2 : (targetSteadyEtCO2 * 0.96);
      let rawEtco2 = prevEt + (targetSteadyEtCO2 - prevEt) * washFraction;

      // Low pulmonary blood flow lowers measured EtCO2 despite systemic CO2 retention.
      if (cardiacOutputRatio < 0.55) {
        rawEtco2 = rawEtco2 * Math.max(0.35, cardiacOutputRatio / 0.55);
      }

      etco2 = Number(rawEtco2.toFixed(1));
    }

    if (finalRR === 0 || isEsophageal) {
      paCO2Estimate = Math.min(140, paCO2Estimate + dtSeconds * 0.65);
    }

    // ----------------------------------------------------
    // 4. ARTERIAL OXYGENATION & SHUNT (PaO2 & SpO2)
    // ----------------------------------------------------
    // Inspired oxygen concentration
    const fio2 = hasSealedAirway && equipment.oxygenFlowLMin > 0.2 ? 0.98 : 0.21;
    
    // Alveolar Gas Equation: PAO2 = FiO2 * (P_atm - 47) - (PaCO2 / 0.8)
    const pAO2 = Math.max(10, fio2 * 713 - (paCO2Estimate / 0.8));

    // Effect of Intrapulmonary Shunt (Qs/Qt):
    // Shunt directly mixes deoxygenated venous blood with arterial blood
    const peepRecruitment = hasSealedAirway && equipment.isVentilatorActive
      ? Math.min(0.32, Math.max(0, equipment.ventilatorSettings.peepCmH2O) * 0.025)
      : 0;
    const effectiveShuntPct = pulmonaryShuntFractionPct * (1 - peepRecruitment);
    const shuntFraction = Math.max(0.04, effectiveShuntPct / 100.0);
    let targetPaO2 = pAO2 * (1.0 - shuntFraction * 1.8);
    targetPaO2 = Math.max(15, Math.min(480, targetPaO2));

    // Severe airway disruption (esophageal intubation or total apnea)
    let isAdequatelyVentilating = finalRR > 0 && finalVT > deadSpaceMl && !isEsophageal;
    let currentPaO2 = previousPaO2;
    let currentSpO2 = previousSpO2;

    if (!isAdequatelyVentilating) {
      // Oxygen reserve and consumption vary strongly by species/body plan.
      const desaturationRate = Math.min(24, Math.max(
        3,
        8.5 * (speciesConfig.oxygenConsumptionMlKgMin / 5)
          * (45 / speciesConfig.functionalResidualCapacityMlKg)
      ));
      currentPaO2 = Math.max(12, currentPaO2 - dtSeconds * desaturationRate);
    } else {
      // Re-oxygenation towards target
      if (currentPaO2 < targetPaO2) {
        currentPaO2 = Math.min(targetPaO2, currentPaO2 + dtSeconds * 22.0);
      } else {
        currentPaO2 = Math.max(targetPaO2, currentPaO2 - dtSeconds * 6.0);
      }

    }

    // Keep PaO2 and SpO2 physiologically coherent in both ventilation and apnea.
    const p50 = 28.0;
    const hillN = 2.7;
    const calculatedSpO2 = 100 * (Math.pow(currentPaO2, hillN) / (Math.pow(p50, hillN) + Math.pow(currentPaO2, hillN)));
    currentSpO2 = Math.min(100, Math.max(0, calculatedSpO2));

    // Hypoxia accumulation tracker
    let hypoxiaSecondsAccumulated = previousHypoxiaSeconds;
    if (currentSpO2 < 75 || currentPaO2 < 40) {
      hypoxiaSecondsAccumulated += dtSeconds;
    } else if (currentSpO2 < 88 || currentPaO2 < 60) {
      // Moderate hypoxemia carries risk but is not equivalent to complete anoxia.
      hypoxiaSecondsAccumulated += dtSeconds * 0.15;
    } else {
      hypoxiaSecondsAccumulated = Math.max(0, hypoxiaSecondsAccumulated - dtSeconds * 0.5);
    }

    // ----------------------------------------------------
    // 5. ACID-BASE BALANCE (HENDERSON-HASSELBALCH & LACTATE)
    // ----------------------------------------------------
    let lactate = previousLactate;
    const perfusionDeficit = Math.max(0, (60 - meanArterialPressure) / 40) + Math.max(0, 0.7 - cardiacOutputRatio);
    if (currentSpO2 < 75 || hypoxiaSecondsAccumulated > 20 || perfusionDeficit > 0.25) {
      // Anaerobic glycolysis lactic acid accumulation
      lactate = Math.min(18.0, lactate + (dtSeconds / 60.0) * (2.2 + perfusionDeficit * 1.4));
    } else if (lactate > patient.baselineVitals.lactateMmolL) {
      // Hepatic clearance of lactate
      const clearanceMultiplier = speciesConfig.glucuronidationClearanceMultiplier;
      lactate = Math.max(patient.baselineVitals.lactateMmolL, lactate - (dtSeconds / 60.0) * 0.45 * clearanceMultiplier);
    }

    const bicarb = Math.min(30, 22.0 + receptors.alkalinization * 5);
    const paCO2Final = paCO2Estimate;
    // pH = 6.1 + log10(HCO3 / (0.03 * PaCO2)) - metabolic base deficit
    const respiratoryPHShift = (40.0 - paCO2Final) * 0.008;
    const metabolicPHShift = (lactate - patient.baselineVitals.lactateMmolL) * 0.045;
    const finalPH = Math.max(6.70, Math.min(7.65, 7.40 + respiratoryPHShift - metabolicPHShift));

    // Respiratory pattern classification
    let pattern: RespiratoryPattern = 'eupneic';
    if (finalRR === 0) {
      pattern = 'apneic';
    } else if (finalRR > baselineRR * 1.6) {
      pattern = 'tachypneic';
    } else if (finalRR < baselineRR * 0.6) {
      pattern = 'bradypneic';
    } else if (patient.pathologyConditions.brachycephalicObstruction && isUnintubated) {
      pattern = 'obstructive';
    }

    const hematocrit = Math.max(
      8,
      (persistentHematocritPct ?? patient.baselineVitals.hctPct) + receptors.oxygenCarryingSupport * 10
        - Math.max(0, receptors.volumeExpansion - receptors.oxygenCarryingSupport * 0.65) * 5
    );
    const potassium = Math.max(
      2,
      patient.baselineVitals.potassiumMeqL + receptors.potassiumLoad * 1.2 - receptors.alkalinization * 0.65
    );

    const hasAssistedVentilation = hasSealedAirway && (
      (equipment.isVentilatorActive && equipment.ventilatorMode !== 'spontaneous')
      || isSingleManualBreathActive
      || hasManualCadence
    );

    return {
      respiratoryRate: Number(finalRR.toFixed(3)),
      tidalVolumeMl: Number(finalVT.toFixed(3)),
      minuteVolumeL,
      respiratoryPattern: pattern,
      etCO2: etco2,
      fiCO2: fico2,
      capnogramType,
      pulseOximetrySpO2: Number(currentSpO2.toFixed(3)),
      arterialBloodGases: {
        pH: Number(finalPH.toFixed(2)),
        paO2: Number(currentPaO2.toFixed(3)),
        paCO2: Number(paCO2Final.toFixed(3)),
        bicarbonate: Number(bicarb.toFixed(2)),
        lactate: Number(lactate.toFixed(4)),
        potassium: Number(potassium.toFixed(2)),
        hematocritPct: Number(hematocrit.toFixed(2)),
      },
      isRespiratoryArrest: isRespiratoryArrest && !hasAssistedVentilation,
      isSpontaneousApnea: isRespiratoryArrest,
      respiratoryArrestCause: arrestCause,
      hypoxiaSecondsAccumulated: Number(hypoxiaSecondsAccumulated.toFixed(3)),
      currentAirwayPressureCmH2O: currentPaw,
      sodaLimeExhaustionPct,
    };
  }
}
