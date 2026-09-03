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
    isSurgicalStimulationActive: boolean,
    previousSpO2: number,
    previousPaO2: number,
    previousPaCO2: number,
    previousHypoxiaSeconds: number,
    previousLactate: number,
    pulmonaryShuntFractionPct: number,
    ruminalBloatSeverity: number = 0,
    cardiacOutputRatio: number = 1,
    meanArterialPressure: number = 80
  ): RespiratoryOutputs {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const baselineRR = patient.baselineVitals.rr;
    const baselineVT = Math.round(patient.weightKg * 12); // ~12 ml/kg

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
      arrestCause = 'Parada Respiratória por Bloqueio Neuromuscular Periférico (Atracúrio sem ventilação mecânica)';
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

      // Surgical stimulation tachypnea if light plane or inadequate analgesia
      if (isSurgicalStimulationActive && receptors.nociceptiveInhibition < 0.65 && receptors.gabaAChlorideConductance < 1.4) {
        spontaneousRR *= 1.45;
        spontaneousVT *= 1.20;
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

    spontaneousRR = Math.round(spontaneousRR);
    spontaneousVT = Math.round(spontaneousVT);

    // ----------------------------------------------------
    // 2. MANUAL BAGGING & MECHANICAL VENTILATOR COUPLING
    // ----------------------------------------------------
    let finalRR = spontaneousRR;
    let finalVT = spontaneousVT;
    let currentPaw = 0;

    // A. Check for Manual Breath (Bag Squeeze) or Cadence
    const hasActiveTrachealTube = equipment.intubationStatus === 'intubated_tracheal';
    const isSingleManualBreathActive = Boolean(
      equipment.isManualBreathTriggered || 
      (equipment.manualBreathLastTriggerTime && (simTimeSeconds - equipment.manualBreathLastTriggerTime) < 2.0)
    );
    const hasManualCadence = Boolean(
      equipment.manualVentilationCadenceSeconds && equipment.manualVentilationCadenceSeconds > 0
    );

    if (equipment.isVentilatorActive && equipment.ventilatorMode !== 'spontaneous') {
      // Mechanical Ventilator Active
      finalRR = equipment.ventilatorSettings.rateBpm;
      finalVT = equipment.ventilatorSettings.tidalVolumeMl;
      currentPaw = equipment.ventilatorSettings.pipPressureLimitCmH2O;
      isRespiratoryArrest = false;
    } else if (hasActiveTrachealTube && (isSingleManualBreathActive || hasManualCadence)) {
      // Manual Bag Ventilation (Apertar Balão / Cadência Manual)
      const cadenceRate = hasManualCadence ? Math.round(60 / (equipment.manualVentilationCadenceSeconds || 6)) : 10;
      finalRR = Math.max(spontaneousRR, cadenceRate);
      const manualVT = Math.round(Math.max(patient.weightKg * 12, 160));
      finalVT = Math.max(spontaneousVT, manualVT);
      currentPaw = 16; // Normal manual bag peak airway pressure ~16 cmH2O
      isRespiratoryArrest = false; // Protected from asphyxia by manual ventilation!
    } else {
      currentPaw = spontaneousRR > 0 ? (equipment.aplValveState === 'closed' ? 24 : 2) : 0;
    }

    const minuteVolumeL = Number(((finalRR * finalVT) / 1000.0).toFixed(2));
    const deadSpaceMl = patient.weightKg * 4.0; // anatomical dead space ~ 4 ml/kg
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
    let etco2 = patient.baselineVitals.etco2;
    let paCO2Estimate = previousPaCO2 || patient.baselineVitals.etco2 + 4.5;

    if (isEsophageal || (isUnintubated && finalRR === 0)) {
      etco2 = 0;
      capnogramType = 'cardiac_arrest_flat';
    } else if (finalRR === 0) {
      etco2 = 0;
      capnogramType = 'cardiac_arrest_flat';
    } else {
      // Normal metabolic production VCO2
      const baselineAlveolarV = ((baselineVT - deadSpaceMl) * baselineRR) / 1000.0;
      const ventilationRatio = alveolarVentilationLMin / Math.max(0.1, baselineAlveolarV);

      let targetPaCO2 = patient.baselineVitals.etco2 + 4.5;
      if (ventilationRatio < 0.70) {
        // Hypoventilation
        etco2 = Math.min(88, Math.round(patient.baselineVitals.etco2 / Math.max(0.35, ventilationRatio)));
        targetPaCO2 = etco2 + 4.5;
        capnogramType = 'hypoventilation';
      } else if (ventilationRatio > 1.45) {
        // Hyperventilation
        etco2 = Math.max(14, Math.round(patient.baselineVitals.etco2 / Math.min(2.5, ventilationRatio)));
        targetPaCO2 = etco2 + 4.5;
        capnogramType = 'hyperventilation';
      } else {
        etco2 = Math.round(patient.baselineVitals.etco2);
        targetPaCO2 = etco2 + 4.5;
        capnogramType = 'normal';
      }

      if (fico2 > 0) {
        etco2 += fico2;
        capnogramType = 'rebreathing_elevated_baseline';
        targetPaCO2 += fico2;
      }

      const co2Equilibration = 1 - Math.exp(-dtSeconds / 12);
      paCO2Estimate += (targetPaCO2 - paCO2Estimate) * co2Equilibration;
      // Low pulmonary blood flow lowers measured EtCO2 despite systemic CO2 retention.
      if (cardiacOutputRatio < 0.65) {
        etco2 = Math.max(0, Math.round(etco2 * Math.max(0.35, cardiacOutputRatio / 0.65)));
      }
    }

    if (finalRR === 0 || isEsophageal) {
      paCO2Estimate = Math.min(140, paCO2Estimate + dtSeconds * 0.65);
    }

    // ----------------------------------------------------
    // 4. ARTERIAL OXYGENATION & SHUNT (PaO2 & SpO2)
    // ----------------------------------------------------
    // Inspired oxygen concentration
    const fio2 = isIntubated && equipment.oxygenFlowLMin > 0.2 ? 0.98 : 0.21;
    
    // Alveolar Gas Equation: PAO2 = FiO2 * (P_atm - 47) - (PaCO2 / 0.8)
    const pAO2 = Math.max(10, fio2 * 713 - (paCO2Estimate / 0.8));

    // Effect of Intrapulmonary Shunt (Qs/Qt):
    // Shunt directly mixes deoxygenated venous blood with arterial blood
    const shuntFraction = Math.max(0.04, pulmonaryShuntFractionPct / 100.0);
    let targetPaO2 = pAO2 * (1.0 - shuntFraction * 1.8);
    targetPaO2 = Math.max(15, Math.min(480, targetPaO2));

    // Severe airway disruption (esophageal intubation or total apnea)
    let isAdequatelyVentilating = finalRR > 0 && finalVT > deadSpaceMl && !isEsophageal;
    let currentPaO2 = previousPaO2;
    let currentSpO2 = previousSpO2;

    if (!isAdequatelyVentilating) {
      // Rapid desaturation rate
      currentPaO2 = Math.max(12, currentPaO2 - dtSeconds * 8.5);
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
      patient.baselineVitals.hctPct + receptors.oxygenCarryingSupport * 10
        - Math.max(0, receptors.volumeExpansion - receptors.oxygenCarryingSupport * 0.65) * 5
    );
    const potassium = Math.max(
      2,
      patient.baselineVitals.potassiumMeqL + receptors.potassiumLoad * 1.2 - receptors.alkalinization * 0.65
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
      isRespiratoryArrest,
      respiratoryArrestCause: arrestCause,
      hypoxiaSecondsAccumulated: Number(hypoxiaSecondsAccumulated.toFixed(3)),
      currentAirwayPressureCmH2O: currentPaw,
      sodaLimeExhaustionPct,
    };
  }
}
