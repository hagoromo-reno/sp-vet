import {
  AnesthesiaEquipmentState,
  BiologicalState,
  CapnogramType,
  PatientProfile,
  RespiratoryPattern,
} from '../types/simulator';
import { SPECIES_DATABASE } from '../data/speciesData';
import { ReceptorStateSnapshot } from './cellularReceptors';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';
import { getLactateClearanceMultiplier, getOxygenDeliveryDeficit } from './oxygenTransport';
import {
  NEUTRAL_PHYSIOLOGICAL_MODIFIERS,
  type PhysiologicalModifiers,
} from './systemCoupling';
import { BiologicalVariationsEngine } from './biologicalVariations';

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
    persistentHematocritPct?: number,
    integratedCentralDrive: number = 1,
    integratedNeuromuscularCapacity: number = 1,
    alveolarRecruitment: number = 1,
    coupling: PhysiologicalModifiers = NEUTRAL_PHYSIOLOGICAL_MODIFIERS,
    organPerfusion?: BiologicalState['organPerfusion'],
    fluidBaseDeficitMmolL: number = 0
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

    const coupledCentralDrive = integratedCentralDrive * coupling.respiratoryDriveMultiplier;
    let spontaneousRR = baselineRR;
    let spontaneousVT = baselineVT;

    // A. Neuromuscular Blockade Paralysis
    if (integratedNeuromuscularCapacity < 0.60 || receptors.nmOccupancy > 0.62) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = 'Ausência de ventilação espontânea por Bloqueio Neuromuscular Periférico (suporte ventilatório obrigatório)';
    }
    // B. Post-Induction Apnea (Rate-dependent Bolus Surge, Severe Overdose or High-Dose Synergy)
    else if (
      receptors.acuteBolusRespiratoryDepression > 0.40 ||
      coupledCentralDrive < 0.08 ||
      receptors.hypnoticEffect > 0.95 ||
      receptors.respiratoryDepression > 0.92 ||
      (receptors.propofolSiteOccupancy > 0.72 && receptors.bzdAllostericOccupancy > 0.28)
    ) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = receptors.hypnoticEffect > 0.96
        ? 'Parada Respiratória por Depressão Bulbar Profunda (Plano Anestésico Excessivo / Estágio IV)'
        : 'Apneia Pós-Indução por Bólus Rápido de Agente Indutor (Propofol/GABA-A)';
    }
    // C. Opioid-Induced Central Apnea
    else if (receptors.muOpioidDrive > 0.88 && receptors.respiratoryDepression > 0.82) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = 'Apneia Central por Sinergismo Depressor Bulbar (Opioide Mu-Puro + Anestésico Geral)';
    }
    // D. Graded Bradypnea / Hypoventilation in Surgical Planes (Continuous Physiological Curve)
    else {
      // Continuous concentration-dependent depression: titrated doses induce smooth bradypnea without apnea
      const gabaSuppression = receptors.hypnoticEffect * 0.48;
      const opioidSuppression = Math.max(0, receptors.muOpioidDrive) * 0.26;
      const bzdSuppression = receptors.bzdAllostericOccupancy * 0.14;
      const netDepression = Math.max(
        receptors.respiratoryDepression * 0.70,
        gabaSuppression + opioidSuppression + bzdSuppression,
        1 - coupledCentralDrive
      );

      // Graded depression: spontaneous RR drops smoothly to bradypnea (~8-12 rpm), VT drops (~20-30%)
      spontaneousRR = Math.max(0, baselineRR * (1.0 - Math.min(0.65, netDepression * 0.68)));
      spontaneousVT = Math.max(0, baselineVT * (1.0 - Math.min(0.42, netDepression * 0.40)));

      // Hypercapnic chemoreflex, attenuated by opioids and deep hypnosis.
      const co2Stimulus = Math.max(0, Math.min(1.2, (previousPaCO2 - 42) / 35));
      const chemoreflexGain = Math.max(0.08, 1 - Math.max(0, receptors.muOpioidDrive) * 0.65 - receptors.hypnoticEffect * 0.55);
      spontaneousRR *= 1 + co2Stimulus * chemoreflexGain * 0.55;
      spontaneousVT *= 1 + co2Stimulus * chemoreflexGain * 0.22;

      // Peripheral arterial chemoreflex: compensatory hyperventilation responding to metabolic / lactic acidosis
      const metabolicAcidosisStimulus = Math.max(0, Math.min(1.2, (previousLactate - 2.5) / 4.0));
      if (metabolicAcidosisStimulus > 0) {
        const peripheralDriveGain = Math.max(0.12, 1 - receptors.hypnoticEffect * 0.50 - Math.max(0, receptors.muOpioidDrive) * 0.40);
        spontaneousRR *= 1 + metabolicAcidosisStimulus * peripheralDriveGain * 0.28;
        spontaneousVT *= 1 + metabolicAcidosisStimulus * peripheralDriveGain * 0.18;
      }

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
    const effectiveCompliance = baseCompliance * restrictiveFactor * Math.max(0.65, alveolarRecruitment);

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
    // Intubation bypasses nasal and pharyngeal anatomical dead space (~30%), but adds
    // apparatus mechanical dead space (ET connector, adapter, capnograph sensor, Y-piece).
    const anatomicDeadSpaceMl = patient.weightKg * speciesConfig.anatomicDeadSpaceMlKg * (hasSealedAirway ? 0.70 : 1.0);
    const mechanicalDeadSpaceMl = hasSealedAirway ? Math.min(30, Math.max(3.5, patient.weightKg * 1.1)) : 0;
    const totalDeadSpaceMl = anatomicDeadSpaceMl + mechanicalDeadSpaceMl;
    const alveolarVentilationLMin = Math.max(0, ((finalVT - totalDeadSpaceMl) * finalRR) / 1000.0);

    // Endotracheal tube cuff seal integrity:
    // Optimal veterinary cuff inflation pressure: 18 - 25 cmH2O.
    // Below 12 cmH2O, an inspiratory/expiratory air leak occurs.
    const cuffLeakFraction = (hasSealedAirway && equipment.cuffPressureCmH2O < 12 && equipment.cuffPressureCmH2O >= 0)
      ? Math.min(0.45, Math.max(0, (12 - equipment.cuffPressureCmH2O) / 12) * 0.45)
      : 0;

    // ----------------------------------------------------
    // 3. CAPNOGRAPHY (EtCO2 & FiCO2) & CIRCUIT GAS DYNAMICS
    // ----------------------------------------------------
    const isBainOrTPiece = equipment.circuitType === 'bain_non_rebreathing' || equipment.circuitType === 't_piece_non_rebreathing';
    const isCircle = Boolean(equipment.circuitType && equipment.circuitType.includes('circle'));
    const o2Flow = Math.max(0, equipment.oxygenFlowLMin || 0);

    // A. Circle System & Soda Lime Kinetics:
    let sodaLimeExhaustionPct = equipment.sodaLimeExhaustionPct || 0;
    if (isCircle && o2Flow > 0.05) {
      sodaLimeExhaustionPct = Math.min(100, sodaLimeExhaustionPct + (dtSeconds / 3600) * 8.0);
    }

    let circleFiCO2 = 0;
    if (sodaLimeExhaustionPct > 50 && isCircle) {
      // High fresh gas flow (>= 2.5 L/min) flushes CO2 out through the APL valve, preventing rebreathing!
      const highFlowWashoutFactor = Math.min(1.0, o2Flow / 2.5);
      const unabsorbedFraction = ((sodaLimeExhaustionPct - 50) / 50) * (1.0 - highFlowWashoutFactor);
      circleFiCO2 = Math.round(unabsorbedFraction * 18);
    }

    // B. Bain / Mapleson D Non-Rebreathing System:
    // Bain circuits require high fresh gas flow (FGF >= 2.0 to 2.5 x Minute Volume, or 150-250 mL/kg/min)
    // to flush alveolar gas away from the inspiratory limb before the next breath.
    let bainFiCO2 = 0;
    let bainRebreathingDeficit = 0;
    if (isBainOrTPiece && hasSealedAirway) {
      const requiredBainFGF = Math.max(0.8, patient.weightKg * 0.18);
      if (o2Flow < requiredBainFGF) {
        bainRebreathingDeficit = Math.min(0.85, (requiredBainFGF - o2Flow) / requiredBainFGF);
        bainFiCO2 = Math.round(bainRebreathingDeficit * 24);
      }
    }

    const fico2 = Math.max(circleFiCO2, bainFiCO2);

    let capnogramType: CapnogramType = 'normal';
    let etco2 = 0;
    let paCO2Estimate = previousPaCO2 || patient.baselineVitals.etco2 + 4.5;

    const isAirwaySampled = equipment.intubationStatus === 'intubated_tracheal' || equipment.intubationStatus === 'laryngeal_mask';

    // Alveolar metabolic production VCO2 and alveolar ventilation ratio
    const baselineAlveolarV = Math.max(0.05, ((baselineVT - totalDeadSpaceMl) * baselineRR) / 1000.0);
    const ventilationRatio = alveolarVentilationLMin / baselineAlveolarV;
    const baselinePaCO2 = (patient.baselineVitals.etco2 + 4.5) * coupling.metabolicCo2Multiplier;

    if (finalRR === 0 || isEsophageal) {
      // Complete apnea or esophageal misplacement:
      // CO2 cannot be eliminated via the lungs; metabolic VCO2 accumulates in arterial blood and tissues.
      // Accumulation rate: ~0.095 mmHg/s (~5.7 mmHg/min of apnea).
      paCO2Estimate = Math.min(130, paCO2Estimate + dtSeconds * 0.095 * coupling.metabolicCo2Multiplier);
      etco2 = 0;
      capnogramType = 'cardiac_arrest_flat';
    } else {
      // Active Ventilation (Spontaneous or Mechanical):
      // Target steady-state PaCO2 is inversely proportional to alveolar ventilation ratio
      const clampedVentRatio = Math.max(0.25, Math.min(3.2, ventilationRatio));
      const targetPaCO2 = (baselinePaCO2 / clampedVentRatio) + fico2;

      // Physiological body CO2 wash-in / wash-out time constant:
      // Hypercapnic or hypocapnic clearance through the venous pool takes 40s
      const washTauSeconds = 40.0;
      const co2Equilibration = 1 - Math.exp(-dtSeconds / washTauSeconds);
      paCO2Estimate += (targetPaCO2 - paCO2Estimate) * co2Equilibration;

      // Arterial-to-End-Tidal CO2 gradient: P(a-ET)CO2
      // Baseline anatomical shunt and dead space creates ~3.5 mmHg gradient.
      // Impaired pulmonary blood flow (low cardiac output) increases alveolar dead space,
      // widening the gradient and lowering measured EtCO2.
      let arterialAlveolarGradient = 3.5;
      if (cardiacOutputRatio < 0.65) {
        arterialAlveolarGradient += (0.65 - cardiacOutputRatio) * 16.0;
      }
      if (pulmonaryShuntFractionPct > 10) {
        arterialAlveolarGradient += (pulmonaryShuntFractionPct - 10) * 0.15;
      }

      // End-tidal alveolar CO2 derived directly from PaCO2 minus physiological gradient
      let targetEtCO2 = Math.max(0, paCO2Estimate - arterialAlveolarGradient);

      // In non-intubated patients (spontaneous breathing with nasal cannula / mask sidestream line),
      // slight room air entrainment slightly dilutes the measured peak (~95% of alveolar plateau)
      if (!isAirwaySampled) {
        targetEtCO2 *= 0.95;
      } else if (cuffLeakFraction > 0) {
        targetEtCO2 *= (1.0 - cuffLeakFraction * 0.35);
      }

      if (fico2 > 0) {
        targetEtCO2 += fico2;
      }

      // Breath-by-breath FRC wash-in/wash-out smoothing (tau ~ 6s)
      const etco2Tau = 6.0;
      const washFraction = 1 - Math.exp(-dtSeconds / etco2Tau);
      const prevEt = (previousEtCO2 !== undefined && previousEtCO2 > 0) ? previousEtCO2 : targetEtCO2;
      let rawEtco2 = prevEt + (targetEtCO2 - prevEt) * washFraction;

      etco2 = Number(rawEtco2.toFixed(1));

      // Classify Capnogram waveform pattern
      if (fico2 > 2) {
        capnogramType = 'rebreathing_elevated_baseline';
      } else if (etco2 > 46 || paCO2Estimate > 50) {
        capnogramType = 'hypoventilation';
      } else if (etco2 < 30 && finalRR > baselineRR * 1.25) {
        capnogramType = 'hyperventilation';
      } else if (receptors.nmOccupancy > 0.35 && receptors.nmOccupancy < 0.62) {
        capnogramType = 'curare_cleft';
      } else {
        capnogramType = 'normal';
      }
    }

    // ----------------------------------------------------
    // 4. ARTERIAL OXYGENATION & SHUNT (PaO2 & SpO2)
    // ----------------------------------------------------
    // Inspired oxygen concentration (FiO2) dynamically computed from fresh gas flow,
    // circuit type, rebreathing dilution, and airway seal:
    let fio2 = 0.21;
    if (equipment.isOxygenFlushActive) {
      fio2 = 0.99;
    } else if (hasSealedAirway) {
      if (o2Flow > 0.05) {
        let circuitFiO2 = 0.98;
        if (bainRebreathingDeficit > 0) {
          circuitFiO2 = 0.98 * (1.0 - bainRebreathingDeficit * 0.30);
        }
        if (cuffLeakFraction > 0) {
          circuitFiO2 = circuitFiO2 * (1.0 - cuffLeakFraction) + 0.21 * cuffLeakFraction;
        }
        fio2 = Math.max(0.21, Math.min(0.99, circuitFiO2));
      } else {
        // Zero oxygen flow in closed circuit: progressive hypoxic depletion
        fio2 = Math.max(0.12, 0.21 - (previousHypoxiaSeconds > 10 ? 0.08 : 0.02));
      }
    } else {
      // Extubated / Unintubated patient breathes ambient room air (21% O2)
      fio2 = 0.21;
    }
    
    // Alveolar Gas Equation: PAO2 = FiO2 * (P_atm - 47) - (PaCO2 / 0.8)
    const pAO2 = Math.max(10, fio2 * 713 - (paCO2Estimate / 0.8));

    // Effect of Intrapulmonary Shunt (Qs/Qt):
    // Shunt directly mixes deoxygenated venous blood with arterial blood
    const peepRecruitment = hasSealedAirway && equipment.isVentilatorActive
      ? Math.min(0.32, Math.max(0, equipment.ventilatorSettings.peepCmH2O) * 0.025)
      : 0;
    const persistentRecruitment = Math.max(0, alveolarRecruitment - 1) * 0.55;
    const effectiveShuntPct = pulmonaryShuntFractionPct * (1 - peepRecruitment - persistentRecruitment);
    const shuntFraction = Math.max(0.04, effectiveShuntPct / 100.0);
    let targetPaO2 = pAO2 * (1.0 - shuntFraction * 1.8);
    targetPaO2 = Math.max(15, Math.min(480, targetPaO2));

    // Severe airway disruption (esophageal intubation or total apnea)
    let isAdequatelyVentilating = finalRR > 0 && finalVT > totalDeadSpaceMl && !isEsophageal;
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

    // Keep PaO2 and SpO2 physiologically coherent in both ventilation and apnea
    // with physiological Bohr shift (pH and PaCO2 effect on hemoglobin P50).
    const baseP50 = 28.0;
    const bohrShift = (7.40 - (previousLactate > 2.5 ? 7.32 : 7.40)) * 10.0 + Math.max(0, paCO2Estimate - 40) * 0.12;
    const effectiveP50 = Math.max(22.0, Math.min(36.0, baseP50 + bohrShift));
    const hillN = 2.7;
    const calculatedSpO2 = 100 * (Math.pow(currentPaO2, hillN) / (Math.pow(effectiveP50, hillN) + Math.pow(currentPaO2, hillN)));
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
    const variations = BiologicalVariationsEngine.compute(
      simTimeSeconds,
      patient,
      receptors.hypnoticEffect,
      isRespiratoryArrest
    );

    let lactate = previousLactate + coupling.additionalLactateMmolLMin * dtSeconds / 60;
    // Perfusion threshold is species-aware: MAP < 60 mmHg (dogs/cats) or < 70 mmHg (equines)
    // causes subclinical tissue dysoxia and progressive microvascular lactate accumulation
    const criticalMapThreshold = patient.species === 'equine' ? 68 : 58;
    const perfusionDeficit = Math.max(0, (criticalMapThreshold - meanArterialPressure) / 30) + Math.max(0, 0.55 - cardiacOutputRatio);
    const oxygenContent = 1.34 * (persistentHematocritPct ?? patient.baselineVitals.hctPct) / 3 * currentSpO2 / 100 + 0.003 * currentPaO2;
    const delivery = oxygenContent * speciesConfig.cardiacOutputMlKgMin * cardiacOutputRatio / 100;
    const deliveryDeficit = getOxygenDeliveryDeficit(patient.species, delivery, coupling.cellularOxygenUtilizationFraction);
    if (currentSpO2 < 75 || hypoxiaSecondsAccumulated > 20 || perfusionDeficit > 0.20 || deliveryDeficit > 0.05) {
      // Anaerobic glycolysis lactic acid accumulation
      const hypoxicRate = currentSpO2 < 75 || hypoxiaSecondsAccumulated > 20 || perfusionDeficit > 0.20 ? 1.25 : 0;
      lactate = Math.min(18.0, lactate + (dtSeconds / 60.0) * (hypoxicRate + perfusionDeficit * 1.6 + deliveryDeficit * 1.2));
    } else if (lactate > patient.baselineVitals.lactateMmolL) {
      // Lactate metabolism follows hepatic/renal perfusion, not feline UGT activity.
      const clearanceMultiplier = getLactateClearanceMultiplier(
        organPerfusion?.hepaticFraction ?? Math.min(1, cardiacOutputRatio),
        organPerfusion?.renalFraction ?? Math.min(1, cardiacOutputRatio)
      );
      lactate = Math.max(patient.baselineVitals.lactateMmolL, lactate - (dtSeconds / 60.0) * 0.45 * clearanceMultiplier);
    }

    const lactateBaseDeficit = Math.max(0, lactate - patient.baselineVitals.lactateMmolL) * 1.25
      + (deliveryDeficit > 0.05 ? deliveryDeficit * 0.8 : 0);
    // A normalized bicarbonate effect represents a clinically relevant buffer dose,
    // not a concentration fraction. Keep the effect large enough to remain visible
    // while the drug redistributes, but cap it to avoid non-physiologic alkalosis.
    const bicarb = Math.max(8, Math.min(32, 24.0 - lactateBaseDeficit - fluidBaseDeficitMmolL + receptors.alkalinization * 12));
    const paCO2Final = paCO2Estimate;
    // Henderson-Hasselbalch couples respiratory CO2 and metabolic bicarbonate.
    const finalPH = Math.max(6.70, Math.min(
      7.65,
      6.1 + Math.log10(bicarb / Math.max(0.3, 0.03 * paCO2Final))
    ));

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

    // Physiological potassium dynamics:
    // 1. Classical transcellular H+/K+ shift: acidosis shifts K+ out of cells (~0.35 mEq/L per 0.1 pH unit)
    // 2. Beta-2 stimulation activates Na+/K+ ATPase, driving K+ intracellularly
    // 3. Severe tissue hypoxia / ATP depletion causes cytotoxic K+ release
    const phPotassiumShift = (7.38 - finalPH) * 0.35;
    const beta2PotassiumShift = -Math.max(0, receptors.beta2Drive) * 0.20;
    const ischemicKRelease = Math.min(1.2, (hypoxiaSecondsAccumulated / 45) * 0.30);

    const potassium = Math.max(
      2,
      patient.baselineVitals.potassiumMeqL + receptors.potassiumLoad * 1.2
        - receptors.alkalinization * 0.65
        + phPotassiumShift
        + beta2PotassiumShift
        + ischemicKRelease
        + (isRespiratoryArrest ? 0 : variations.potassiumVariationMeqL)
    );

    const hasAssistedVentilation = hasSealedAirway && (
      (equipment.isVentilatorActive && equipment.ventilatorMode !== 'spontaneous')
      || isSingleManualBreathActive
      || hasManualCadence
    );

    // Apply continuous biological variations when spontaneously ventilating
    const reportedRR = (finalRR > 0 && !hasAssistedVentilation)
      ? Math.max(1, finalRR + variations.rrVariationRpm)
      : finalRR;
    const reportedVT = (finalVT > 0 && !hasAssistedVentilation)
      ? Math.max(0.1, finalVT * variations.vtVariationFactor)
      : finalVT;
    const reportedEtCO2 = etco2 > 10 ? Math.max(0, etco2 + variations.etco2VariationMmHg) : etco2;
    const reportedSpO2 = currentSpO2 > 85 ? Math.min(100, Math.max(0, currentSpO2 + variations.spo2VariationPct)) : currentSpO2;
    const reportedPH = Math.max(6.70, Math.min(7.65, finalPH + (isRespiratoryArrest ? 0 : variations.phVariation)));

    return {
      respiratoryRate: Number(reportedRR.toFixed(3)),
      tidalVolumeMl: Number(reportedVT.toFixed(3)),
      minuteVolumeL,
      respiratoryPattern: pattern,
      etCO2: Number(reportedEtCO2.toFixed(1)),
      fiCO2: fico2,
      capnogramType,
      pulseOximetrySpO2: Number(reportedSpO2.toFixed(3)),
      arterialBloodGases: {
        pH: Number(reportedPH.toFixed(2)),
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
