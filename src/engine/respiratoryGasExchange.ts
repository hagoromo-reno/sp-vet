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
    previousHypoxiaSeconds: number,
    previousLactate: number,
    pulmonaryShuntFractionPct: number,
    ruminalBloatSeverity: number = 0
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
    // B. Profound Bulbar Depression (GABA-A / Deep Anesthesia)
    else if (receptors.gabaAChlorideConductance > 3.0) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = 'Parada Respiratória por Depressão Bulbar Profunda (Plano Anestésico Excessivo / Estágio IV)';
    }
    // C. Opioid-Induced Central Apnea
    else if (receptors.muOpioidDrive > 0.85 && receptors.gabaAChlorideConductance > 1.2) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = 'Apneia Central por Sinergismo Depressor Bulbar (Opioide Mu-Puro + Anestésico Geral)';
    }
    // D. Graded Bradypnea / Hypoventilation in Surgical Planes
    else {
      // GABA-A depression
      const gabaSuppression = Math.max(0, receptors.gabaAChlorideConductance - 0.2);
      const opioidSuppression = receptors.muOpioidDrive * 0.45;
      const netDepression = gabaSuppression * 0.28 + opioidSuppression;

      spontaneousRR = Math.max(0, baselineRR * (1.0 - Math.min(0.85, netDepression)));
      spontaneousVT = Math.max(0, baselineVT * (1.0 - Math.min(0.60, netDepression * 0.6)));

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
    }

    spontaneousRR = Math.round(spontaneousRR);
    spontaneousVT = Math.round(spontaneousVT);

    // ----------------------------------------------------
    // 2. VENTILATOR COUPLING & AIRWAY PRESSURES
    // ----------------------------------------------------
    let finalRR = spontaneousRR;
    let finalVT = spontaneousVT;
    let currentPaw = 0;

    if (equipment.isVentilatorActive && equipment.ventilatorMode !== 'spontaneous') {
      finalRR = equipment.ventilatorSettings.rateBpm;
      finalVT = equipment.ventilatorSettings.tidalVolumeMl;
      currentPaw = equipment.ventilatorSettings.pipPressureLimitCmH2O;
      isRespiratoryArrest = false;
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

      if (ventilationRatio < 0.70) {
        // Hypoventilation
        etco2 = Math.min(88, Math.round(patient.baselineVitals.etco2 / Math.max(0.35, ventilationRatio)));
        capnogramType = 'hypoventilation';
      } else if (ventilationRatio > 1.45) {
        // Hyperventilation
        etco2 = Math.max(14, Math.round(patient.baselineVitals.etco2 / Math.min(2.5, ventilationRatio)));
        capnogramType = 'hyperventilation';
      } else {
        etco2 = Math.round(patient.baselineVitals.etco2);
        capnogramType = 'normal';
      }

      if (fico2 > 0) {
        etco2 += fico2;
        capnogramType = 'rebreathing_elevated_baseline';
      }
    }

    // ----------------------------------------------------
    // 4. ARTERIAL OXYGENATION & SHUNT (PaO2 & SpO2)
    // ----------------------------------------------------
    // Inspired oxygen concentration
    const fio2 = isIntubated && equipment.oxygenFlowLMin > 0.2 ? 0.98 : 0.21;
    
    // Alveolar Gas Equation: PAO2 = FiO2 * (P_atm - 47) - (PaCO2 / 0.8)
    const paCO2Estimate = etco2 > 0 ? etco2 + 4.5 : 75;
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
      const desatSpeed = (patient.species === 'feline' || patient.species === 'rabbit' ? 0.65 : 0.40);
      currentPaO2 = Math.max(12, currentPaO2 - dtSeconds * 8.5);
      currentSpO2 = Math.max(0, currentSpO2 - dtSeconds * desatSpeed);
    } else {
      // Re-oxygenation towards target
      if (currentPaO2 < targetPaO2) {
        currentPaO2 = Math.min(targetPaO2, currentPaO2 + dtSeconds * 22.0);
      } else {
        currentPaO2 = Math.max(targetPaO2, currentPaO2 - dtSeconds * 6.0);
      }

      // SpO2 calculation via Hill equation from PaO2
      // P50 ~ 28 mmHg, Hill coefficient n ~ 2.7
      const p50 = 28.0;
      const hillN = 2.7;
      const calculatedSpO2 = 100 * (Math.pow(currentPaO2, hillN) / (Math.pow(p50, hillN) + Math.pow(currentPaO2, hillN)));
      currentSpO2 = Math.min(100, Math.max(0, calculatedSpO2));
    }

    // Hypoxia accumulation tracker
    let hypoxiaSecondsAccumulated = previousHypoxiaSeconds;
    if (currentSpO2 < 82 || currentPaO2 < 55) {
      hypoxiaSecondsAccumulated += dtSeconds;
    } else {
      hypoxiaSecondsAccumulated = Math.max(0, hypoxiaSecondsAccumulated - dtSeconds * 0.5);
    }

    // ----------------------------------------------------
    // 5. ACID-BASE BALANCE (HENDERSON-HASSELBALCH & LACTATE)
    // ----------------------------------------------------
    let lactate = previousLactate;
    if (currentSpO2 < 75 || hypoxiaSecondsAccumulated > 20) {
      // Anaerobic glycolysis lactic acid accumulation
      lactate = Math.min(18.0, lactate + (dtSeconds / 60.0) * 2.2);
    } else if (lactate > patient.baselineVitals.lactateMmolL) {
      // Hepatic clearance of lactate
      const clearanceMultiplier = speciesConfig.glucuronidationClearanceMultiplier;
      lactate = Math.max(patient.baselineVitals.lactateMmolL, lactate - (dtSeconds / 60.0) * 0.45 * clearanceMultiplier);
    }

    const bicarb = 22.0;
    const paCO2Final = Math.round(paCO2Estimate);
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
    }

    return {
      respiratoryRate: finalRR,
      tidalVolumeMl: finalVT,
      minuteVolumeL,
      respiratoryPattern: pattern,
      etCO2: etco2,
      fiCO2: fico2,
      capnogramType,
      pulseOximetrySpO2: Math.round(currentSpO2),
      arterialBloodGases: {
        pH: Number(finalPH.toFixed(2)),
        paO2: Math.round(currentPaO2),
        paCO2: paCO2Final,
        bicarbonate: bicarb,
        lactate: Number(lactate.toFixed(1)),
        potassium: patient.baselineVitals.potassiumMeqL,
        hematocritPct: patient.baselineVitals.hctPct,
      },
      isRespiratoryArrest,
      respiratoryArrestCause: arrestCause,
      hypoxiaSecondsAccumulated: Math.round(hypoxiaSecondsAccumulated),
      currentAirwayPressureCmH2O: currentPaw,
      sodaLimeExhaustionPct,
    };
  }
}
