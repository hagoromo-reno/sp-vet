import {
  ActiveDrugDose,
  AnesthesiaEquipmentState,
  CardiacRhythm,
  CapnogramType,
  DrugDefinition,
  PatientProfile,
  ResuscitationState,
  VitalSigns,
  EyePosition,
  ReflexStrength,
  JawTone,
  MucousMembraneColor,
  CapillaryRefillTime,
  CellularBiophysicsState,
} from '../types/simulator';
import { SPECIES_DATABASE } from '../data/speciesData';
import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import { CellularReceptorsEngine, ReceptorStateSnapshot } from './cellularReceptors';
import { SpeciesPhysiologyEngine, SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';
import { HemodynamicCircuitEngine } from './hemodynamicCircuit';
import { RespiratoryGasExchangeEngine } from './respiratoryGasExchange';
import { DynamicInteractionsEngine } from './dynamicInteractions';

export class PKPDEngine {
  /**
   * Advanced multi-system biophysical simulation engine:
   * 1. Multi-compartment pharmacokinetics & bio-phase equilibration (ke0).
   * 2. Receptor-level allosteric cooperativity and competitive displacement (Schild law).
   * 3. Closed-loop cardiovascular mechanics (Frank-Starling inotropy, SVR, stroke volume, baroreceptor reflex).
   * 4. Medullary pre-Bötzinger respiratory rhythm, intrapulmonary V/Q shunt, and acid-base equilibrium.
   * 5. Deep species-specific abstraction (Canine vagotonia, Feline UGT1A6 deficit/lidocaine toxicity,
   *    Equine recumbency myopathy/shunt, Bovine alpha-2D hypersensitivity/ruminal bloat).
   * 6. Neurological Guedel planes, reflex mapping, and resuscitation kinetics.
   */
  public static stepSimulation(
    dtSeconds: number,
    simTimeSeconds: number,
    patient: PatientProfile,
    activeDoses: ActiveDrugDose[],
    equipment: AnesthesiaEquipmentState,
    resuscitation: ResuscitationState,
    isSurgicalStimulationActive: boolean,
    previousVitals?: VitalSigns
  ): { vitals: VitalSigns; updatedDoses: ActiveDrugDose[]; equipmentUpdates: Partial<AnesthesiaEquipmentState> } {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const dtMin = dtSeconds / 60.0;

    // Previous state accumulators
    let hypoxiaSeconds = previousVitals?.hypoxiaExposureSeconds || 0;
    let ischemiaScore = previousVitals?.myocardialIschemiaScore || 0;
    let isAlreadyArrested = previousVitals?.isCardiacArrest || false;
    let arrestCause = previousVitals?.cardiacArrestCause;
    let arrestType: VitalSigns['cardiacArrestType'] = previousVitals?.cardiacArrestType || 'asystole';
    let isAlreadyDead = previousVitals?.isDead || false;
    let deathTime = previousVitals?.deathTimeSeconds;
    let deathCause = previousVitals?.deathCause;
    let asystoleSeconds = previousVitals?.asystoleSecondsElapsed || 0;
    let cprSeconds = previousVitals?.cprSecondsElapsed || 0;

    // Demographic modifiers
    const ageTotalYears = patient.ageYears + (patient.ageMonths || 0) / 12;
    const isPediatric = ageTotalYears < 0.6; // < 7 months
    const isGeriatric = (
      (patient.species === 'canine' && ageTotalYears >= 9.5) ||
      (patient.species === 'feline' && ageTotalYears >= 11) ||
      (patient.species === 'equine' && ageTotalYears >= 18) ||
      (patient.species === 'bovine' && ageTotalYears >= 10) ||
      (patient.species === 'rabbit' && ageTotalYears >= 5) ||
      (patient.species === 'avian' && ageTotalYears >= 8)
    );

    let drugClearanceFactor = speciesConfig.glucuronidationClearanceMultiplier;
    if (isPediatric) drugClearanceFactor *= 0.65;
    if (isGeriatric) drugClearanceFactor *= 0.65;

    // ----------------------------------------------------
    // 1. PHARMACOKINETICS: BIO-PHASE EQUILIBRATION (ke0)
    // ----------------------------------------------------
    const updatedDoses: ActiveDrugDose[] = [];
    const activeDrugEffects: Record<string, { drugDef: DrugDefinition; Ce: number; Cp: number; bolusShockMagnitude: number; totalDoseAdministered: number }> = {};
    let fatalOverdoseTriggered = false;
    let fatalToxicityReason = '';

    for (const dose of activeDoses) {
      const drugDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === dose.drugId);
      if (!drugDef) continue;

      let newCp = dose.currentCp;
      let newCe = dose.currentCe;
      let deliveryElapsed = (dose.deliveryElapsedSec || 0) + dtSeconds;
      let transitLagRemaining = Math.max(0, (dose.transitLagRemainingSec || 0) - dtSeconds);
      let isFullyDelivered = dose.isFullyDelivered || false;
      let isFastBolusShockTriggered = dose.isFastBolusShockTriggered || false;
      let shockMagnitude = 0;

      const deliveryDuration = dose.deliveryDurationSec || 1;
      const deliveryFraction = deliveryDuration > 0 ? Math.min(1.0, deliveryElapsed / deliveryDuration) : 1.0;
      if (deliveryFraction >= 1.0) {
        isFullyDelivered = true;
      }

      // Acute Fast Bolus Hemodynamic Shock
      if (dose.administrationSpeed === 'bolus_rapid' && !isFastBolusShockTriggered && transitLagRemaining <= 0) {
        isFastBolusShockTriggered = true;
        const recommendedDose = drugDef.recommendedDose[patient.species] || drugDef.recommendedDose.canine;
        const doseRatio = dose.dosePerKg / (recommendedDose?.typical || 1.0);

        if (drugDef.fastBolusRisk) {
          shockMagnitude = drugDef.fastBolusRisk.lethalityRiskScore * Math.min(3.0, doseRatio);
        }
      }

      // Two-compartment PK + Bio-phase (ke0)
      if (transitLagRemaining <= 0) {
        const rec = drugDef.recommendedDose[patient.species] || drugDef.recommendedDose.canine;
        const typicalDose = rec?.typical || 1.0;
        const normalizedDose = dose.dosePerKg / typicalDose;

        if (dose.isCRI && dose.criRatePerKgMin && dose.criRatePerKgMin > 0) {
          const inputRate = (dose.criRatePerKgMin / typicalDose) * 60; // per hour equivalent
          const kel = 0.693 / (drugDef.halfLifeBeta / drugClearanceFactor);
          newCp = newCp + (inputRate * 0.05 - kel * newCp) * dtMin;
        } else {
          if (!isFullyDelivered && deliveryDuration > 0) {
            const incrementalInput = (normalizedDose / (deliveryDuration / 60)) * dtMin;
            newCp += incrementalInput;
          } else if (newCp === 0 && isFullyDelivered) {
            newCp = normalizedDose;
          }

          const kel = 0.693 / ((drugDef.halfLifeBeta * drugClearanceFactor) || 60);
          const kdist = 0.693 / (drugDef.halfLifeAlpha || 10);
          const effectiveKel = newCp > 0.6 ? kdist : kel;
          newCp = Math.max(0, newCp - effectiveKel * newCp * dtMin);
        }

        const ke0 = drugDef.ke0;
        newCe = Math.max(0, newCe + ke0 * (newCp - newCe) * dtMin);
      }

      // Species-Specific Toxicological Overdose Triggers
      const rec = drugDef.recommendedDose[patient.species] || drugDef.recommendedDose.canine;
      const overdoseRatio = dose.dosePerKg / (rec?.max || 1.0);

      // A. Bovine Xylazine Extreme Hypersensitivity (alpha-2D)
      if (patient.species === 'bovine' && drugDef.id === 'xylazine' && dose.dosePerKg > 0.15) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = `Intoxicação Letal por Xilazina em Bovino (Dose ${dose.dosePerKg} mg/kg = ${(dose.dosePerKg / 0.05).toFixed(1)}x a dose de segurança; receptores alfa-2D hiper-responsivos)`;
      }

      // B. Feline Acute Lidocaine IV Toxicity
      if (patient.species === 'feline' && drugDef.id === 'lidocaine_2pct' && dose.route.includes('IV') && (dose.dosePerKg > 1.2 || dose.administrationSpeed === 'bolus_rapid')) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = 'Colapso Cardiocerebral e Depressão Miocárdica Fulminante por Lidocaína IV em Felino (Déficit congênito de conjugação e alta toxicidade de canais NaV)';
      }

      // C. Potassium Chloride Rapid Bolus
      if (drugDef.id === 'potassium_chloride' && (dose.administrationSpeed === 'bolus_rapid' || dose.dosePerKg > 0.6)) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = 'Parada Cardíaca Instantânea em Diástole por Hipercalemia Fulminante (Bólus IV de Cloreto de Potássio)';
      }

      // D. Massive Single-Drug Overdose
      if (!fatalOverdoseTriggered && overdoseRatio >= 3.8 && (drugDef.category === 'induction' || drugDef.category === 'opioid_analgesic' || drugDef.category === 'premedication')) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = `Sobredosagem Maciça Fatal por ${drugDef.name} (${overdoseRatio.toFixed(1)}x acima da dose máxima de segurança)`;
      }

      // Retain active doses
      if (newCp > 0.002 || newCe > 0.002 || transitLagRemaining > 0 || (dose.isCRI && (dose.criRatePerKgMin || 0) > 0)) {
        const updatedDose: ActiveDrugDose = {
          ...dose,
          deliveryElapsedSec: deliveryElapsed,
          transitLagRemainingSec: transitLagRemaining,
          isFullyDelivered,
          isFastBolusShockTriggered,
          currentCp: newCp,
          currentCe: newCe,
        };
        updatedDoses.push(updatedDose);

        if (!activeDrugEffects[drugDef.id]) {
          activeDrugEffects[drugDef.id] = { drugDef, Ce: newCe, Cp: newCp, bolusShockMagnitude: shockMagnitude, totalDoseAdministered: dose.dosePerKg };
        } else {
          activeDrugEffects[drugDef.id].Ce = Math.min(4.0, activeDrugEffects[drugDef.id].Ce + newCe);
          activeDrugEffects[drugDef.id].Cp = Math.min(4.0, activeDrugEffects[drugDef.id].Cp + newCp);
          activeDrugEffects[drugDef.id].bolusShockMagnitude = Math.max(activeDrugEffects[drugDef.id].bolusShockMagnitude, shockMagnitude);
          activeDrugEffects[drugDef.id].totalDoseAdministered += dose.dosePerKg;
        }
      }
    }

    // ----------------------------------------------------
    // 2. INHALATION PHARMACOKINETICS
    // ----------------------------------------------------
    let deliveredVaporizerPct = 0;
    if (equipment.isVaporizerOn && equipment.oxygenFlowLMin > 0.1 && equipment.intubationStatus === 'intubated_tracheal') {
      deliveredVaporizerPct = equipment.vaporizerDialPct;
    }

    const macSpecies = equipment.vaporizerType === 'isoflurane' ? speciesInfo.macValues.isoflurane : speciesInfo.macValues.sevoflurane;
    const inhalantCe = deliveredVaporizerPct / macSpecies; // 1.0 = 1 MAC

    if (deliveredVaporizerPct >= 4.5 && equipment.oxygenFlowLMin > 0.3 && inhalantCe >= 2.8) {
      fatalOverdoseTriggered = true;
      fatalToxicityReason = `Sobredosagem Letal por Anestésico Inalatório (${equipment.vaporizerType.toUpperCase()} a ${deliveredVaporizerPct}% = ${(inhalantCe).toFixed(1)} MAC com colapso miocárdico e vasomotor)`;
    }

    // ----------------------------------------------------
    // 3. CELLULAR RECEPTOR & TRANSDUCTION ENGINE
    // ----------------------------------------------------
    const receptors: ReceptorStateSnapshot = CellularReceptorsEngine.computeReceptorState(
      patient,
      updatedDoses,
      inhalantCe,
      equipment.vaporizerType
    );

    // Synchronize post-reversal concentrations back into doses
    if (receptors.reversalCe.atipamezole > 0.05) {
      ['dexmedetomidine', 'xylazine', 'detomidine'].forEach((id) => {
        const d = updatedDoses.find((dose) => dose.drugId === id);
        if (d) d.currentCe = Math.max(0, d.currentCe - receptors.reversalCe.atipamezole * 2.8);
      });
    }
    if (receptors.reversalCe.naloxone > 0.05) {
      ['morphine', 'methadone', 'fentanyl', 'butorphanol', 'buprenorphine'].forEach((id) => {
        const d = updatedDoses.find((dose) => dose.drugId === id);
        if (d) d.currentCe = Math.max(0, d.currentCe - receptors.reversalCe.naloxone * 3.0);
      });
    }
    if (receptors.reversalCe.flumazenil > 0.05) {
      ['midazolam', 'diazepam'].forEach((id) => {
        const d = updatedDoses.find((dose) => dose.drugId === id);
        if (d) d.currentCe = Math.max(0, d.currentCe - receptors.reversalCe.flumazenil * 2.8);
      });
    }

    // ----------------------------------------------------
    // 4. SPECIES PHYSIOLOGICAL & CELLULAR PARTICULARITIES
    // ----------------------------------------------------
    const prevMAP = previousVitals?.meanArterialPressure ?? patient.baselineVitals.map;
    const prevHR = previousVitals?.heartRate ?? patient.baselineVitals.hr;
    const isRecumbent = true; // patient on surgical table
    const isAtropineActive = (activeDrugEffects['atropine']?.Ce || 0) > 0.05;

    const speciesEval = SpeciesPhysiologyEngine.evaluateParticularities(
      patient,
      simTimeSeconds,
      prevMAP,
      receptors.alpha2Drive,
      receptors.muOpioidDrive,
      receptors.naVBlockade,
      receptors.volatileSiteOccupancy,
      isRecumbent,
      isAtropineActive
    );

    // ----------------------------------------------------
    // 5. HEMODYNAMIC CIRCUIT & CLOSED-LOOP BAROREFLEX
    // ----------------------------------------------------
    const hemodynamics = HemodynamicCircuitEngine.stepHemodynamics(
      dtSeconds,
      simTimeSeconds,
      patient,
      receptors,
      equipment,
      resuscitation,
      isSurgicalStimulationActive,
      prevMAP,
      prevHR,
      ischemiaScore,
      speciesEval.ruminalBloatSeverity
    );

    ischemiaScore = hemodynamics.myocardialIschemiaScore;
    if (speciesEval.myopathyIschemiaRiskScore > 0.4) {
      ischemiaScore = Math.min(1.0, ischemiaScore + speciesEval.myopathyIschemiaRiskScore * 0.15 * dtMin);
    }

    // ----------------------------------------------------
    // 6. RESPIRATORY GAS EXCHANGE & ACID-BASE ENGINE
    // ----------------------------------------------------
    const respiration = RespiratoryGasExchangeEngine.stepRespiration(
      dtSeconds,
      simTimeSeconds,
      patient,
      receptors,
      equipment,
      isSurgicalStimulationActive,
      previousVitals?.pulseOximetrySpO2 ?? patient.baselineVitals.spo2,
      previousVitals?.arterialBloodGases.paO2 ?? 98,
      hypoxiaSeconds,
      previousVitals?.arterialBloodGases.lactate ?? patient.baselineVitals.lactateMmolL,
      speciesEval.shuntFractionPct,
      speciesEval.ruminalBloatSeverity
    );

    hypoxiaSeconds = respiration.hypoxiaSecondsAccumulated;

    // Barotrauma Check
    let barotraumaCollapse = false;
    if (equipment.aplValveState === 'closed' && equipment.oxygenFlowLMin > 1.2 && equipment.reservoirBagVolumeMl > 2400) {
      barotraumaCollapse = true;
      fatalOverdoseTriggered = true;
      fatalToxicityReason = 'Pneumotórax Hipertensivo / Barotrauma Pulmonar (Válvula APL fechada com sobrepressão sustentada)';
    }

    // ----------------------------------------------------
    // 7. DYNAMIC EMERGENT INTERACTIONS
    // ----------------------------------------------------
    const isVentilatorActive = equipment.isVentilatorActive && equipment.ventilatorMode !== 'spontaneous';
    const isIntubated = equipment.intubationStatus === 'intubated_tracheal';
    const activeDrugInteractions = DynamicInteractionsEngine.evaluateDynamicInteractions(
      patient,
      receptors,
      isVentilatorActive,
      isIntubated
    );

    // ----------------------------------------------------
    // 8. CARDIAC ARREST & BIOLOGICAL DEATH STATE MACHINE
    // ----------------------------------------------------
    let triggeredArrestNow = false;

    if (hemodynamics.isArrestTriggered && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = hemodynamics.arrestType || 'ventricular_fibrillation';
      arrestCause = hemodynamics.arrestCause;
    }

    if (fatalOverdoseTriggered && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = fatalToxicityReason.includes('Fibrilação') ? 'ventricular_fibrillation' : 'asystole';
      arrestCause = fatalToxicityReason;
    }

    if (hypoxiaSeconds > (isPediatric ? 45 : 90) && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = 'asystole';
      arrestCause = `Parada Cardiorrespiratória por Anóxia Miocárdica Aguda (${Math.round(hypoxiaSeconds)}s em hipóxia crítica)`;
    }

    if (triggeredArrestNow) {
      isAlreadyArrested = true;
    }

    if (isAlreadyArrested) {
      if (resuscitation.isCPRActive) {
        cprSeconds += dtSeconds;
      } else {
        asystoleSeconds += dtSeconds;
      }

      const deathThresholdSec = isPediatric ? 95 : 155;
      if ((asystoleSeconds > deathThresholdSec || (cprSeconds > 360 && asystoleSeconds > 60)) && !isAlreadyDead) {
        isAlreadyDead = true;
        deathTime = simTimeSeconds;
        deathCause = arrestCause || 'Morte Biológica Irreversível por Parada Cardiorrespiratória Refratária';
      }
    }

    // ----------------------------------------------------
    // 9. GUEDEL STAGE & CLINICAL REFLEX ENGINE
    // ----------------------------------------------------
    // Pure continuous mapping from GABA-A chloride conductance (gCl-) and nociception
    const gCl = receptors.gabaAChlorideConductance;
    let anestheticDepthScore = Math.min(100, Math.round((gCl / 3.0) * 85));
    if (gCl >= 3.0) anestheticDepthScore = Math.min(100, 85 + Math.round(((gCl - 3.0) / 1.5) * 15));

    let guedelStage: VitalSigns['guedelStage'] = 'Estágio I (Voluntário)';
    let eyePosition: EyePosition = 'central_light';
    let palpebralReflex: ReflexStrength = 'brisk';
    let cornealReflex: ReflexStrength = 'brisk';
    let jawTone: JawTone = 'rigid';
    let pedalReflex: ReflexStrength = 'brisk';
    let surgicalTolerancePct = 0;

    const analgesiaPct = Math.round(receptors.nociceptiveInhibition * 100);

    if (isAlreadyDead || isAlreadyArrested) {
      guedelStage = 'Estágio IV (Depressão Bulbar / Parada)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'absent';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    } else if (gCl < 0.35) {
      // Estágio I (Consciente / Sedação Leve)
      guedelStage = 'Estágio I (Voluntário)';
      eyePosition = 'central_light';
      palpebralReflex = 'brisk';
      cornealReflex = 'brisk';
      jawTone = receptors.bzdAllostericOccupancy > 0.4 ? 'moderate' : 'rigid';
      pedalReflex = 'brisk';
      surgicalTolerancePct = Math.min(25, analgesiaPct * 0.25);
    } else if (gCl < 0.90) {
      // Estágio II (Excitação / Delírio / Sedação Profunda)
      guedelStage = 'Estágio II (Excitação/Delírio)';
      eyePosition = 'central_light';
      palpebralReflex = 'moderate';
      cornealReflex = 'brisk';
      jawTone = receptors.bzdAllostericOccupancy > 0.5 || receptors.alpha2Drive > 0.4 ? 'moderate' : 'rigid';
      pedalReflex = analgesiaPct > 60 ? 'moderate' : 'brisk';
      surgicalTolerancePct = Math.round(25 + analgesiaPct * 0.25);
    } else if (gCl < 1.70) {
      // Estágio III Plano 1 (Anestesia Leve / Indução Recém-Instalada):
      // Relaxamento mandibular perfeito para intubação orotraqueal!
      guedelStage = 'Estágio III Plano 1 (Leve)';
      eyePosition = 'ventromedial_surgical';
      palpebralReflex = 'sluggish';
      cornealReflex = 'brisk';
      jawTone = 'relaxed_surgical';
      pedalReflex = analgesiaPct > 70 ? 'absent' : 'sluggish';
      surgicalTolerancePct = Math.round(65 + analgesiaPct * 0.20);
    } else if (gCl < 2.70) {
      // Estágio III Plano 2 (Plano Cirúrgico Ideal):
      guedelStage = 'Estágio III Plano 2 (Cirúrgico)';
      eyePosition = 'ventromedial_surgical';
      palpebralReflex = 'absent';
      cornealReflex = 'moderate';
      jawTone = 'relaxed_surgical';
      pedalReflex = 'absent';
      surgicalTolerancePct = Math.round(92 + (analgesiaPct / 100) * 8);
    } else if (gCl < 3.50) {
      // Estágio III Plano 3 (Anestesia Profunda):
      guedelStage = 'Estágio III Plano 3 (Profundo)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'sluggish';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    } else {
      // Estágio IV (Depressão Bulbar)
      guedelStage = 'Estágio IV (Depressão Bulbar / Parada)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'absent';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    }

    // ----------------------------------------------------
    // 10. PHYSICAL EXAM & PERFUSION
    // ----------------------------------------------------
    let mmColor: MucousMembraneColor = 'pink';
    let crt: CapillaryRefillTime = '1 - 2s (normal)';

    if (isAlreadyDead || isAlreadyArrested) {
      mmColor = 'gray_moribund';
      crt = 'absent';
    } else if (respiration.pulseOximetrySpO2 < 78) {
      mmColor = 'cyanotic';
      crt = '> 3s (poor perfusion)';
    } else if (hemodynamics.meanArterialPressure < 45 || patient.pathologyConditions.hypovolemiaSeverity) {
      mmColor = 'pale';
      crt = '> 3s (poor perfusion)';
    } else if (patient.pathologyConditions.sepsisVasodilation) {
      mmColor = 'brick_red';
      crt = '< 1s (hyperdynamic)';
    } else if (receptors.alpha2Drive > 0.35) {
      mmColor = 'pale';
      crt = '2 - 3s (sluggish)';
    }

    const tofCount = receptors.nmOccupancy > 0.85 ? 0 : receptors.nmOccupancy > 0.40 ? 2 : 4;

    // Body Temperature Dynamics
    let tempC = previousVitals?.bodyTemperatureC ?? patient.baselineVitals.tempC;
    const thermalLossRate = patient.weightKg < 2.0 ? 0.0011 : patient.weightKg < 8.0 ? 0.0005 : 0.0002;
    tempC -= thermalLossRate * dtSeconds;
    if (equipment.warmingBlanketActive) {
      tempC = Math.min(38.8, tempC + 0.0007 * dtSeconds);
    }

    // Detailed clinical autopsy report if dead
    let deathDetailedSummary;
    if (isAlreadyDead) {
      deathDetailedSummary = {
        primaryCause: deathCause || 'Parada Cardiorrespiratória Refratária',
        contributingFactors: [
          `Espécie: ${patient.species.toUpperCase()} (${patient.weightKg} kg)`,
          speciesEval.particularities.filter((p) => p.isActive).map((p) => `${p.name}: ${p.clinicalImpact}`).join(' | '),
          activeDrugInteractions.map((i) => `${i.title} (${i.severity.toUpperCase()})`).join(', '),
          hypoxiaSeconds > 25 ? `Exposição a Hipóxia Crítica por ${Math.round(hypoxiaSeconds)} segundos` : '',
          ischemiaScore > 0.5 ? `Isquemia Miocárdica Transmural Severa (${(ischemiaScore * 100).toFixed(0)}%)` : '',
        ].filter(Boolean),
        chronology: [
          `Tempo 00:00: Procedimento para ${patient.name} (${patient.surgicalProcedure})`,
          respiration.isRespiratoryArrest ? `Apneia detectada: ${respiration.respiratoryArrestCause}` : '',
          arrestCause ? `Parada Cardiorrespiratória: ${arrestCause}` : '',
          asystoleSeconds > 0 ? `Período em colapso/assistolia: ${Math.round(asystoleSeconds)}s` : '',
          `Declaração de Óbito Encefálico e Cardiopulmonar Irreversível`,
        ].filter(Boolean),
        autopsyFindings: [
          `Gasometria Terminal: pH ${respiration.arterialBloodGases.pH}, PaCO2 ${respiration.arterialBloodGases.paCO2} mmHg, Lactato ${respiration.arterialBloodGases.lactate} mmol/L`,
          `Índice Isquêmico Cardíaco: ${(ischemiaScore * 100).toFixed(0)}%`,
          `Cianose/palidez profunda com tempo de enchimento capilar ausente`,
          `Pupilas em midríase paralítica fixa bilateral e ausência de reflexo corneal`,
        ],
      };
    }

    // Synchronize final vitals under arrest/death
    let finalHR = hemodynamics.heartRate;
    let finalMAP = hemodynamics.meanArterialPressure;
    let finalSysBP = hemodynamics.systolicBP;
    let finalDiaBP = hemodynamics.diastolicBP;
    let finalRhythm = hemodynamics.cardiacRhythm;
    let finalRR = respiration.respiratoryRate;
    let finalSpO2 = respiration.pulseOximetrySpO2;
    let finalEtCO2 = respiration.etCO2;
    let pulseQuality = hemodynamics.pulseQuality;
    let capnogramType = respiration.capnogramType;

    if (isAlreadyDead) {
      finalHR = 0;
      finalMAP = 0;
      finalSysBP = 0;
      finalDiaBP = 0;
      finalRR = 0;
      finalSpO2 = 0;
      finalEtCO2 = 0;
      finalRhythm = 'asystole';
      pulseQuality = 'Ausente';
      capnogramType = 'cardiac_arrest_flat';
    } else if (isAlreadyArrested) {
      if (resuscitation.isCPRActive) {
        finalHR = resuscitation.compressionsPerMin || 110;
        finalMAP = Math.round(35 * (resuscitation.compressionDepthQuality || 0.8));
        finalSysBP = finalMAP + 15;
        finalDiaBP = Math.max(5, finalMAP - 10);
        finalRhythm = 'pulseless_electrical_activity';
        pulseQuality = 'Fraco / Filiforme';
        finalEtCO2 = Math.round(16 * (resuscitation.compressionDepthQuality || 0.8));
        capnogramType = 'normal';
      } else {
        finalHR = 0;
        finalMAP = 0;
        finalSysBP = 0;
        finalDiaBP = 0;
        finalRR = 0;
        finalSpO2 = 0;
        finalEtCO2 = 0;
        finalRhythm = arrestType === 'ventricular_fibrillation'
          ? 'ventricular_fibrillation'
          : arrestType === 'pulseless_ventricular_tachycardia'
          ? 'ventricular_tachycardia'
          : 'asystole';
        pulseQuality = 'Ausente';
        capnogramType = 'cardiac_arrest_flat';
      }
    }

    // ----------------------------------------------------
    // 11. CELLULAR BIOPHYSICS SNAPSHOT
    // ----------------------------------------------------
    const cellularState: CellularBiophysicsState = {
      cAMPMyocardial: Number(receptors.cAMPMyocardial.toFixed(2)),
      cAMPVascular: Number(receptors.cAMPVascular.toFixed(2)),
      intracellularCalcium: Number(receptors.intracellularCalcium.toFixed(2)),
      chlorideConductanceGabaA: Number(receptors.gabaAChlorideConductance.toFixed(2)),
      nociceptiveInhibition: Number(receptors.nociceptiveInhibition.toFixed(2)),
      nmbaReceptorBlockade: Number(receptors.nmOccupancy.toFixed(2)),
      cardiacOutputLMin: hemodynamics.cardiacOutputLMin,
      strokeVolumeMl: hemodynamics.strokeVolumeMl,
      systemicVascularResistanceDyne: hemodynamics.systemicVascularResistanceDyne,
      inotropicStateEmax: hemodynamics.inotropicStateEmax,
      baroreceptorGain: hemodynamics.baroreceptorGain,
      baroreceptorVagalTone: hemodynamics.baroreceptorVagalTone,
      pulmonaryShuntFractionPct: Number(speciesEval.shuntFractionPct.toFixed(1)),
      speciesParticularities: speciesEval.particularities,
    };

    const vitals: VitalSigns = {
      heartRate: finalHR,
      cardiacRhythm: finalRhythm,
      systolicBP: finalSysBP,
      diastolicBP: finalDiaBP,
      meanArterialPressure: finalMAP,
      pulseOximetrySpO2: finalSpO2,
      respiratoryRate: finalRR,
      tidalVolumeMl: respiration.tidalVolumeMl,
      minuteVolumeL: respiration.minuteVolumeL,
      respiratoryPattern: respiration.respiratoryPattern,
      etCO2: finalEtCO2,
      fiCO2: respiration.fiCO2,
      capnogramType,
      bodyTemperatureC: Number(tempC.toFixed(1)),
      arterialBloodGases: respiration.arterialBloodGases,
      anestheticDepthScore,
      guedelStage,
      eyePosition,
      palpebralReflex,
      cornealReflex,
      jawTone,
      pedalReflex,
      surgicalTolerancePct,
      trainOfFourCount: tofCount,
      mucousMembraneColor: mmColor,
      capillaryRefillTime: crt,
      pulseQuality,
      perfusionIndex: Number((Math.max(0, (finalMAP / 85) * (finalSpO2 / 100))).toFixed(2)),

      // Organ Failures & Arrest States
      isRespiratoryArrest: respiration.isRespiratoryArrest,
      respiratoryArrestCause: respiration.isRespiratoryArrest ? respiration.respiratoryArrestCause : undefined,
      isCardiacArrest: isAlreadyArrested,
      cardiacArrestCause: arrestCause,
      cardiacArrestType: arrestType,
      isDead: isAlreadyDead,
      deathTimeSeconds: deathTime,
      deathCause: deathCause,
      deathDetailedSummary,
      asystoleSecondsElapsed: Math.round(asystoleSeconds),
      cprSecondsElapsed: Math.round(cprSeconds),
      activeDrugInteractions,
      myocardialIschemiaScore: Number(ischemiaScore.toFixed(2)),
      hypoxiaExposureSeconds: Math.round(hypoxiaSeconds),
      severeAcidosisRisk: respiration.arterialBloodGases.pH < 7.15,
      barotraumaCollapse,
      felineLidocaineToxicity: patient.species === 'feline' && fatalOverdoseTriggered,
      bovineBloatRespiratoryRestriction: patient.species === 'bovine' && speciesEval.ruminalBloatSeverity > 0.4,
      cellularState,
    };

    return {
      vitals,
      updatedDoses,
      equipmentUpdates: {
        sodaLimeExhaustionPct: respiration.sodaLimeExhaustionPct,
        currentAirwayPressureCmH2O: respiration.currentAirwayPressureCmH2O,
        totalFluidsInfusedMl: equipment.totalFluidsInfusedMl + (equipment.isFluidPumpRunning ? (equipment.fluidRateMlPerHour / 3600) * dtSeconds : 0),
      },
    };
  }
}
