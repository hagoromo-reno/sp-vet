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
import { getRoutePharmacokinetics, getSpeciesDoseRange, isExtravascularRoute } from './drugAdministration';
import { BiologicalStateEngine } from './biologicalState';

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
    const previousCriticalTimers = previousVitals?.criticalEventTimers || {
      severeBradycardiaSeconds: 0,
      severeTachycardiaSeconds: 0,
      profoundHypotensionSeconds: 0,
    };

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

    let ageClearanceFactor = 1;
    if (isPediatric) ageClearanceFactor *= 0.65;
    if (isGeriatric) ageClearanceFactor *= 0.65;

    // ASA Physical Status Clearance Impact (reduced organ perfusion / clearance in higher ASA classes)
    let asaClearanceFactor = 1.0;
    if (patient.asa === 'II') {
      asaClearanceFactor = 0.92;
    } else if (patient.asa === 'III') {
      asaClearanceFactor = 0.75;
    } else if (patient.asa === 'IV' || patient.asa === 'V' || patient.asa === 'E') {
      asaClearanceFactor = 0.55;
    }

    const glucuronidationSensitiveDrugs = new Set([
      'propofol',
      'morphine',
      'buprenorphine',
      'acepromazine',
      'lidocaine_2pct',
    ]);

    // ----------------------------------------------------
    // 1. PHARMACOKINETICS: BIO-PHASE EQUILIBRATION (ke0)
    // ----------------------------------------------------
    const updatedDoses: ActiveDrugDose[] = [];
    const activeDrugEffects: Record<string, { drugDef: DrugDefinition; Ce: number; Cp: number; bolusShockMagnitude: number; totalDoseAdministered: number }> = {};
    let fatalOverdoseTriggered = false;
    let fatalToxicityReason = '';

    const cumulativeBolusDosePerKg = new Map<string, number>();
    for (const dose of activeDoses) {
      if (!dose.isCRI) {
        cumulativeBolusDosePerKg.set(
          dose.drugId,
          (cumulativeBolusDosePerKg.get(dose.drugId) || 0) + dose.dosePerKg
        );
      }
    }

    for (const dose of activeDoses) {
      const drugDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === dose.drugId);
      if (!drugDef) continue;
      const speciesDoseRange = getSpeciesDoseRange(drugDef, patient.species, Boolean(dose.isCRI));
      // Never normalize an unvalidated species exposure against the canine dose.
      if (!speciesDoseRange) continue;

      let newCp = dose.currentCp;
      let newCe = dose.currentCe;
      let deliveryElapsed = dose.deliveryElapsedSec || 0;
      const priorTransitLag = Math.max(0, dose.transitLagRemainingSec || 0);
      const transitLagRemaining = Math.max(0, priorTransitLag - dtSeconds);
      const pharmacologicallyActiveSeconds = priorTransitLag <= 0
        ? dtSeconds
        : Math.max(0, dtSeconds - priorTransitLag);
      let isFullyDelivered = dose.isFullyDelivered || false;
      let isFastBolusShockTriggered = dose.isFastBolusShockTriggered || false;
      let shockMagnitude = dose.bolusShockMagnitude || 0;
      let bolusShockRemainingSec = Math.max(0, (dose.bolusShockRemainingSec || 0) - dtSeconds);
      const routePK = getRoutePharmacokinetics(drugDef, dose.route);

      // Acute Fast Bolus Hemodynamic Shock
      if (dose.administrationSpeed === 'bolus_rapid' && !isFastBolusShockTriggered && transitLagRemaining <= 0) {
        isFastBolusShockTriggered = true;
        const doseRatio = dose.dosePerKg / speciesDoseRange.typical;

        if (drugDef.fastBolusRisk) {
          // A usual rapid bolus can express a listed adverse effect without making
          // every probability deterministic; supratherapeutic doses approach 1.5.
          shockMagnitude = Math.min(1.5, doseRatio / (0.65 + doseRatio));
          bolusShockRemainingSec = 45;
        }
      }

      // Route-aware normalized PK + bio-phase equilibration. The normalized
      // exposure is converted to saturable occupancy by CellularReceptorsEngine.
      if (pharmacologicallyActiveSeconds > 0) {
        const activeDtMin = pharmacologicallyActiveSeconds / 60;
        const typicalDose = speciesDoseRange.typical;
        const normalizedDose = dose.dosePerKg / typicalDose;

        const metabolicClearanceFactor = ageClearanceFactor * asaClearanceFactor * (
          glucuronidationSensitiveDrugs.has(drugDef.id)
            ? speciesConfig.glucuronidationClearanceMultiplier
            : 1
        );
        const eliminationHalfLife = Math.max(0.1, drugDef.halfLifeBeta / Math.max(0.05, metabolicClearanceFactor));
        const kel = Math.log(2) / eliminationHalfLife;

        if (dose.isCRI) {
          const isRunning = dose.isInfusionRunning !== false && (dose.criRatePerKgMin || 0) > 0;
          if (isRunning) {
            // The catalog rate defines a normalized steady-state target. This keeps
            // /min and /h prescriptions dimensionally consistent after UI conversion.
            const typicalRatePerMin = (drugDef.criDoseUnit?.endsWith('/h') || drugDef.doseUnit.endsWith('/h'))
              ? typicalDose / 60
              : typicalDose;
            const targetCp = (dose.criRatePerKgMin || 0) / Math.max(0.00001, typicalRatePerMin);
            const approachRate = Math.max(kel, Math.log(2) / Math.max(0.25, drugDef.onsetMinutes));
            newCp += approachRate * (targetCp - newCp) * activeDtMin;
          } else {
            newCp = Math.max(0, newCp - kel * newCp * activeDtMin);
            isFullyDelivered = true;
          }
          deliveryElapsed += pharmacologicallyActiveSeconds;
        } else if (isExtravascularRoute(dose.route)) {
          const previousElapsedMin = deliveryElapsed / 60;
          deliveryElapsed += pharmacologicallyActiveSeconds;
          const nextElapsedMin = deliveryElapsed / 60;
          const ka = Math.log(2) / Math.max(0.05, routePK.absorptionHalfLifeMinutes);
          const previousAbsorbed = routePK.bioavailability * (1 - Math.exp(-ka * previousElapsedMin));
          const nextAbsorbed = routePK.bioavailability * (1 - Math.exp(-ka * nextElapsedMin));
          newCp += normalizedDose * Math.max(0, nextAbsorbed - previousAbsorbed);
          isFullyDelivered = nextAbsorbed >= routePK.bioavailability * 0.995;

          const distributionRate = Math.log(2) / Math.max(0.1, drugDef.halfLifeAlpha);
          const distributionWeight = Math.exp(-nextElapsedMin / Math.max(0.1, drugDef.halfLifeAlpha));
          const effectiveLossRate = kel + (distributionRate - kel) * distributionWeight * 0.35;
          newCp = Math.max(0, newCp - effectiveLossRate * newCp * activeDtMin);
        } else {
          const deliveryDuration = Math.max(0.1, dose.deliveryDurationSec || 1);
          const previousFraction = Math.min(1, deliveryElapsed / deliveryDuration);
          deliveryElapsed += pharmacologicallyActiveSeconds;
          const nextFraction = Math.min(1, deliveryElapsed / deliveryDuration);
          newCp += normalizedDose * Math.max(0, nextFraction - previousFraction);
          isFullyDelivered = nextFraction >= 1;

          const elapsedMin = deliveryElapsed / 60;
          const distributionRate = Math.log(2) / Math.max(0.1, drugDef.halfLifeAlpha);
          const distributionWeight = Math.exp(-elapsedMin / Math.max(0.1, drugDef.halfLifeAlpha));
          const effectiveLossRate = kel + (distributionRate - kel) * distributionWeight;
          newCp = Math.max(0, newCp - effectiveLossRate * newCp * activeDtMin);
        }

        const ke0 = drugDef.ke0;
        newCe = Math.max(0, newCe + ke0 * (newCp - newCe) * activeDtMin);
      }

      // Species-Specific Toxicological Overdose Triggers
      const cumulativeDose = cumulativeBolusDosePerKg.get(drugDef.id) || dose.dosePerKg;
      const overdoseRatio = dose.isCRI
        ? Math.max(newCp, newCe) / Math.max(0.01, speciesDoseRange.max / speciesDoseRange.typical)
        : cumulativeDose / speciesDoseRange.max;
      const drugHasArrived = transitLagRemaining <= 0 && (newCp > 0.005 || newCe > 0.005);

      // A. Bovine Xylazine Extreme Hypersensitivity (alpha-2D)
      if (drugHasArrived && patient.species === 'bovine' && drugDef.id === 'xylazine' && cumulativeDose > 0.15) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = `Intoxicação Letal por Xilazina em Bovino (Dose ${cumulativeDose} mg/kg = ${(cumulativeDose / 0.05).toFixed(1)}x a dose de segurança; receptores alfa-2D hiper-responsivos)`;
      }

      // B. Feline Acute Lidocaine IV Toxicity
      if (drugHasArrived && patient.species === 'feline' && drugDef.id === 'lidocaine_2pct' && (dose.route.includes('IV') || dose.route === 'CRI') && cumulativeDose > speciesConfig.lidocaineIvCardiotoxicityThresholdMgKg) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = 'Colapso Cardiocerebral e Depressão Miocárdica Fulminante por Lidocaína IV em Felino (Déficit congênito de conjugação e alta toxicidade de canais NaV)';
      }

      // C. Potassium Chloride Rapid Bolus
      if (drugHasArrived && drugDef.id === 'potassium_chloride' && (dose.administrationSpeed === 'bolus_rapid' || cumulativeDose > 0.6)) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = 'Parada Cardíaca Instantânea em Diástole por Hipercalemia Fulminante (Bólus IV de Cloreto de Potássio)';
      }

      // D. Massive exposure for agents with a genuinely high lethal bolus burden.
      const lethalRisk = drugDef.fastBolusRisk?.lethalityRiskScore || 0;
      if (drugHasArrived && !fatalOverdoseTriggered && overdoseRatio >= 4.5 && lethalRisk >= 0.45 && (drugDef.category === 'induction' || drugDef.category === 'opioid_analgesic' || drugDef.category === 'premedication')) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = `Sobredosagem Maciça Fatal por ${drugDef.name} (${overdoseRatio.toFixed(1)}x acima da dose máxima de segurança)`;
      }

      // Retain active doses
      // A dose must NEVER be discarded while it is still being infused (!isFullyDelivered)
      // or during transit lag. Once delivered, keep it while circulating in plasma (newCp > 0.0001)
      // or in the biophase effect compartment (newCe > 0.0001), or while CRI is active.
      if (
        !isFullyDelivered ||
        newCp > 0.0001 ||
        newCe > 0.0001 ||
        transitLagRemaining > 0 ||
        priorTransitLag > 0 ||
        bolusShockRemainingSec > 0 ||
        (dose.isCRI && dose.isInfusionRunning !== false && (dose.criRatePerKgMin || 0) > 0)
      ) {
        const updatedDose: ActiveDrugDose = {
          ...dose,
          deliveryElapsedSec: deliveryElapsed,
          transitLagRemainingSec: transitLagRemaining,
          isFullyDelivered,
          isFastBolusShockTriggered,
          bolusShockMagnitude: shockMagnitude,
          bolusShockRemainingSec,
          currentCp: newCp,
          currentCe: newCe,
        };
        updatedDoses.push(updatedDose);

        if (!activeDrugEffects[drugDef.id]) {
          activeDrugEffects[drugDef.id] = { drugDef, Ce: newCe, Cp: newCp, bolusShockMagnitude: shockMagnitude, totalDoseAdministered: cumulativeDose };
        } else {
          activeDrugEffects[drugDef.id].Ce = Math.min(4.0, activeDrugEffects[drugDef.id].Ce + newCe);
          activeDrugEffects[drugDef.id].Cp = Math.min(4.0, activeDrugEffects[drugDef.id].Cp + newCp);
          activeDrugEffects[drugDef.id].bolusShockMagnitude = Math.max(activeDrugEffects[drugDef.id].bolusShockMagnitude, shockMagnitude);
          activeDrugEffects[drugDef.id].totalDoseAdministered = cumulativeDose;
        }
      }
    }

    // ----------------------------------------------------
    // 2. INHALATION PHARMACOKINETICS
    // ----------------------------------------------------
    let deliveredVaporizerPct = 0;
    if (
      equipment.isVaporizerOn
      && !equipment.isOxygenFlushActive
      && equipment.oxygenFlowLMin > 0.1
      && (equipment.intubationStatus === 'intubated_tracheal' || equipment.intubationStatus === 'laryngeal_mask')
    ) {
      deliveredVaporizerPct = equipment.vaporizerDialPct;
    }

    const macSpecies = equipment.vaporizerType === 'isoflurane' ? speciesInfo.macValues.isoflurane : speciesInfo.macValues.sevoflurane;
    const inspiredMac = deliveredVaporizerPct / macSpecies;
    const previousInhalantCe = previousVitals?.cellularState?.volatileAnestheticMac || 0;
    const baselineMinuteVentilation = Math.max(0.1, patient.baselineVitals.rr * patient.weightKg * 0.012);
    const priorMinuteVentilation = Math.max(0.05, previousVitals?.minuteVolumeL || baselineMinuteVentilation);
    const ventilationFactor = Math.max(0.25, Math.min(2, priorMinuteVentilation / baselineMinuteVentilation));
    const circuitFlowFactor = Math.max(0.35, Math.min(1.4, equipment.oxygenFlowLMin / Math.max(0.5, patient.weightKg * 0.05)));
    const baseTimeConstantSec = equipment.vaporizerType === 'sevoflurane' ? 48 : 75;
    const washTimeConstantSec = baseTimeConstantSec / Math.sqrt(ventilationFactor * circuitFlowFactor);
    const inhalantAlpha = 1 - Math.exp(-dtSeconds / washTimeConstantSec);
    const inhalantCe = Math.max(0, previousInhalantCe + (inspiredMac - previousInhalantCe) * inhalantAlpha);

    // ----------------------------------------------------
    // 3. CELLULAR RECEPTOR & TRANSDUCTION ENGINE
    // ----------------------------------------------------
    const receptors: ReceptorStateSnapshot = CellularReceptorsEngine.computeReceptorState(
      patient,
      updatedDoses,
      inhalantCe,
      equipment.vaporizerType
    );

    // ----------------------------------------------------
    // 4. SPECIES PHYSIOLOGICAL & CELLULAR PARTICULARITIES
    // ----------------------------------------------------
    const prevMAP = previousVitals?.meanArterialPressure ?? patient.baselineVitals.map;
    const prevHR = previousVitals?.heartRate ?? patient.baselineVitals.hr;
    // Large animals must not acquire recumbency shunt/timpanism merely because the
    // simulation clock is running. Deep hypnosis, dissociation or motor blockade
    // imply recumbency; tranquilization alone usually does not.
    const isRecumbent = receptors.hypnoticEffect > 0.30
      || receptors.dissociativeEffect > 0.48
      || receptors.nmOccupancy > 0.25;
    const isAtropineActive = (activeDrugEffects['atropine']?.Ce || 0) > 0.05;
    let biologicalState = BiologicalStateEngine.stepSlowCompartments(
      dtSeconds,
      patient,
      equipment,
      previousVitals?.biologicalState ?? BiologicalStateEngine.initialize(patient),
      isRecumbent,
      prevMAP,
      speciesConfig.criticalMapThresholdMmHg,
      speciesConfig.recumbencyPulmonaryShuntBasePct
    );

    const speciesEval = SpeciesPhysiologyEngine.evaluateParticularities(
      patient,
      simTimeSeconds,
      prevMAP,
      receptors.alpha2Drive,
      receptors.muOpioidDrive,
      receptors.naVBlockade,
      receptors.volatileSiteOccupancy,
      isRecumbent,
      isAtropineActive,
      biologicalState.species.pulmonaryShuntPct,
      biologicalState.species.myopathyRisk,
      biologicalState.species.ruminalBloatSeverity
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
      speciesEval.ruminalBloatSeverity,
      biologicalState.fluids.effectiveCirculatingExpansionMl,
      previousCriticalTimers,
      previousVitals?.pulseOximetrySpO2 ?? patient.baselineVitals.spo2,
      previousVitals?.arterialBloodGases.lactate ?? patient.baselineVitals.lactateMmolL,
      previousVitals?.nociceptiveStressLevel ?? 0
    );

    ischemiaScore = hemodynamics.myocardialIschemiaScore;
    // Dependent-muscle ischemia in recumbent equids is tracked as myopathy risk,
    // not added to the myocardial ischemia/VF state variable.

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
      previousVitals?.arterialBloodGases.paCO2 ?? patient.baselineVitals.etco2 + 4.5,
      hypoxiaSeconds,
      previousVitals?.arterialBloodGases.lactate ?? patient.baselineVitals.lactateMmolL,
      speciesEval.shuntFractionPct,
      speciesEval.ruminalBloatSeverity,
      hemodynamics.cardiacOutputLMin / Math.max(0.1, patient.weightKg * 0.11),
      hemodynamics.meanArterialPressure,
      previousVitals?.respiratoryRate ?? patient.baselineVitals.rr,
      previousVitals?.etCO2 ?? patient.baselineVitals.etco2,
      hemodynamics.nociceptiveStressLevel,
      biologicalState.fluids.currentHematocritPct
    );

    hypoxiaSeconds = respiration.hypoxiaSecondsAccumulated;
    biologicalState = BiologicalStateEngine.stepAirwayPressure(
      dtSeconds,
      biologicalState,
      respiration.currentAirwayPressureCmH2O
    );
    biologicalState = BiologicalStateEngine.stepMetabolism(
      dtSeconds,
      patient,
      biologicalState,
      receptors.alpha2Drive,
      receptors.beta1Drive,
      hemodynamics.nociceptiveStressLevel,
      respiration.pulseOximetrySpO2,
      hemodynamics.meanArterialPressure
    );

    // Barotrauma Check
    let barotraumaCollapse = biologicalState.respiratory.highAirwayPressureSeconds >= 8;
    if (barotraumaCollapse) {
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
      isIntubated,
      updatedDoses
    );

    // ----------------------------------------------------
    // 8. CARDIAC ARREST & ROSC RESUSCITATION STATE MACHINE (RECOVER 2024)
    // ----------------------------------------------------
    let triggeredArrestNow = false;
    let achievedROSCNow = false;

    if (hemodynamics.isArrestTriggered && !isAlreadyArrested && !isAlreadyDead) {
      triggeredArrestNow = true;
      arrestType = hemodynamics.arrestType || 'ventricular_fibrillation';
      arrestCause = hemodynamics.arrestCause;
    }

    if (fatalOverdoseTriggered && !isAlreadyArrested && !isAlreadyDead) {
      triggeredArrestNow = true;
      arrestType = fatalToxicityReason.includes('Fibrilação') ? 'ventricular_fibrillation' : 'asystole';
      arrestCause = fatalToxicityReason;
    }

    if (hypoxiaSeconds > (isPediatric ? 55 : 110) && !isAlreadyArrested && !isAlreadyDead) {
      triggeredArrestNow = true;
      arrestType = 'asystole';
      arrestCause = `Parada Cardiorrespiratória por Anóxia Miocárdica Aguda (${Math.round(hypoxiaSeconds)}s em hipóxia crítica)`;
    }

    if (triggeredArrestNow) {
      isAlreadyArrested = true;
    }

    // ROSC & Arrest Progression Logic
    if (isAlreadyArrested && !isAlreadyDead) {
      // 1. Check CPR & Resuscitation Quality
      const hasEffectiveCompressions =
        resuscitation.isCPRActive &&
        resuscitation.compressionsPerMin >= 80 &&
        (resuscitation.compressionDepthQuality || 0.8) >= 0.45;

      const hasAirwayVentilation =
        Boolean(resuscitation.isCPRVentilationActive) ||
        (equipment.intubationStatus === 'intubated_tracheal' &&
          equipment.oxygenFlowLMin > 0.1 &&
          (equipment.isVentilatorActive ||
            Boolean(equipment.manualVentilationCadenceSeconds && equipment.manualVentilationCadenceSeconds > 0) ||
            Boolean(equipment.isManualBreathTriggered) ||
            (simTimeSeconds - (equipment.manualBreathLastTriggerTime || 0)) < 6.0));

      // 2. Check Pharmacological Support & Reversible Causes
      const hasInotropicVasoSupport =
        (activeDrugEffects['epinephrine']?.Ce || 0) > 0.03 ||
        (activeDrugEffects['norepinephrine']?.Ce || 0) > 0.05 ||
        (activeDrugEffects['ephedrine']?.Ce || 0) > 0.06 ||
        (activeDrugEffects['dobutamine']?.Ce || 0) > 0.08;

      const isHypoxiaCorrected =
        respiration.pulseOximetrySpO2 >= 85 ||
        respiration.arterialBloodGases.paO2 >= 60 ||
        (hasAirwayVentilation && hasEffectiveCompressions);

      const isLethalOverdoseReversed =
        !fatalOverdoseTriggered ||
        (activeDrugEffects['naloxone']?.Ce || 0) > 0.08 ||
        (activeDrugEffects['atipamezole']?.Ce || 0) > 0.08 ||
        (activeDrugEffects['flumazenil']?.Ce || 0) > 0.08 ||
        (activeDrugEffects['lipid_emulsion_20']?.Ce || 0) > 0.08;

      // Defibrillation is an event, not a permanent boolean. A delivered shock
      // is consumed exactly once by the biological state.
      const minShockJoules = Math.max(4, Math.round(patient.weightKg * 1.5));
      const observedShockCount = resuscitation.shocksDeliveredCount
        ?? (resuscitation.lastShockDeliveredJoules ? 1 : 0);
      const isNewShock = observedShockCount > biologicalState.resuscitation.processedShockCount;
      const hasDeliveredAdequateShock = Boolean(
        isNewShock &&
        resuscitation.lastShockDeliveredJoules &&
        resuscitation.lastShockDeliveredJoules >= minShockJoules
      );
      const isDefibrillatedVF =
        (arrestType === 'ventricular_fibrillation' || arrestType === 'pulseless_ventricular_tachycardia') &&
        hasDeliveredAdequateShock;

      biologicalState.resuscitation.processedShockCount = observedShockCount;

      // 3. RECOVER ROSC Criteria:
      // Adequate CPR + Ventilation + (Inotrope OR Reversal OR Corrected Hypoxia OR Defibrillation)
      const canAchieveROSC =
        hasEffectiveCompressions &&
        hasAirwayVentilation &&
        (hasInotropicVasoSupport || isHypoxiaCorrected || isDefibrillatedVF) &&
        isLethalOverdoseReversed;

      // Biological viability: severe hypoxia/ischemia/acidosis reduces ROSC rate naturally
      const biologicalInhibition = Math.min(0.80, (
        (hypoxiaSeconds / 90) * 0.35 +
        (ischemiaScore > 0.55 ? (ischemiaScore - 0.55) * 0.75 : 0) +
        (respiration.arterialBloodGases.pH < 7.08 ? (7.08 - respiration.arterialBloodGases.pH) * 1.4 : 0)
      ));
      const compressionQuality = resuscitation.compressionDepthQuality || 0.8;
      if (canAchieveROSC) {
        const supportGain = hasInotropicVasoSupport ? 0.35 : 0;
        const shockGain = isDefibrillatedVF ? 4.0 : 0;
        biologicalState.resuscitation.roscReadinessSeconds = Math.min(
          20,
          biologicalState.resuscitation.roscReadinessSeconds
            + dtSeconds * (0.65 + compressionQuality * 0.55 + supportGain) * (1 - biologicalInhibition)
            + shockGain
        );
      } else {
        biologicalState.resuscitation.roscReadinessSeconds = Math.max(
          0,
          biologicalState.resuscitation.roscReadinessSeconds - dtSeconds * 0.75
        );
      }
      const hasBiologicalReadiness = biologicalState.resuscitation.roscReadinessSeconds >= 7.5;

      if (canAchieveROSC && (cprSeconds >= 6 || hasInotropicVasoSupport || isDefibrillatedVF) && hasBiologicalReadiness) {
        // SUCCESSFUL ROSC!
        achievedROSCNow = true;
        isAlreadyArrested = false;
        arrestCause = undefined;
        arrestType = undefined;
        asystoleSeconds = 0;
        cprSeconds = 0;
        hypoxiaSeconds = 0;
        ischemiaScore = 0.10; // CRITICAL: Reset ischemia so it does not immediately re-trigger arrest!
        biologicalState.resuscitation.roscReadinessSeconds = 0;
        previousCriticalTimers.severeBradycardiaSeconds = 0;
        previousCriticalTimers.severeTachycardiaSeconds = 0;
        previousCriticalTimers.profoundHypotensionSeconds = 0;
        hemodynamics.criticalEventTimers.severeBradycardiaSeconds = 0;
        hemodynamics.criticalEventTimers.severeTachycardiaSeconds = 0;
        hemodynamics.criticalEventTimers.profoundHypotensionSeconds = 0;
      } else {
        if (resuscitation.isCPRActive) {
          cprSeconds += dtSeconds;
        } else {
          asystoleSeconds += dtSeconds;
        }

        const deathThresholdSec = isPediatric ? 120 : 210;
        if ((asystoleSeconds > deathThresholdSec || (cprSeconds > 480 && asystoleSeconds > 90)) && !isAlreadyDead) {
          isAlreadyDead = true;
          deathTime = simTimeSeconds;
          deathCause = arrestCause || 'Morte Biológica Irreversível por Parada Cardiorrespiratória Refratária';
        }
      }
    } else {
      biologicalState.resuscitation.roscReadinessSeconds = 0;
      biologicalState.resuscitation.processedShockCount = resuscitation.shocksDeliveredCount
        ?? biologicalState.resuscitation.processedShockCount;
    }

    // ----------------------------------------------------
    // 8B. IMPENDING ARREST & CRITICAL DETERIORATION EARLY WARNING
    // ----------------------------------------------------
    let impendingArrestWarning: VitalSigns['impendingArrestWarning'] = undefined;

    if (!isAlreadyDead && !isAlreadyArrested) {
      if (hemodynamics.criticalEventTimers.profoundHypotensionSeconds >= 2.5) {
        const remaining = Math.max(1, Math.round(18 - hemodynamics.criticalEventTimers.profoundHypotensionSeconds));
        impendingArrestWarning = {
          type: 'hypotension',
          headline: 'COLAPSO CIRCULATÓRIO IMINENTE · CHOQUE DESCOMPENSADO',
          details: `Pressão Arterial Média em nível crítico (${Math.round(hemodynamics.meanArterialPressure)} mmHg) há ${Math.round(hemodynamics.criticalEventTimers.profoundHypotensionSeconds)}s. Risco de AESP em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: 'Reduzir ou suspender inalatório, infundir bólus volêmico e aplicar Efedrina (0.1 mg/kg) ou Adrenalina (0.01 mg/kg IV).',
          urgency: hemodynamics.criticalEventTimers.profoundHypotensionSeconds >= 9 ? 'critical' : 'warning',
        };
      } else if (hemodynamics.criticalEventTimers.severeBradycardiaSeconds >= 2.5) {
        const remaining = Math.max(1, Math.round(12 - hemodynamics.criticalEventTimers.severeBradycardiaSeconds));
        impendingArrestWarning = {
          type: 'bradycardia',
          headline: 'BRADICARDIA CRÍTICA EXTREMA · RISCO DE ASSISTOLIA',
          details: `Frequência Cardíaca em colapso (${Math.round(hemodynamics.heartRate)} bpm) há ${Math.round(hemodynamics.criticalEventTimers.severeBradycardiaSeconds)}s. Risco de assistolia terminal em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: 'Administrar Atropina 0.03 mg/kg IV; se houver agonista alfa-2 ativo, aplicar Atipamezol imediatamente.',
          urgency: hemodynamics.criticalEventTimers.severeBradycardiaSeconds >= 6 ? 'critical' : 'warning',
        };
      } else if (hemodynamics.criticalEventTimers.severeTachycardiaSeconds >= 2.5) {
        const remaining = Math.max(1, Math.round(10 - hemodynamics.criticalEventTimers.severeTachycardiaSeconds));
        impendingArrestWarning = {
          type: 'tachycardia',
          headline: 'TAQUICARDIA MALIGNA · RISCO DE FIBRILAÇÃO VENTRICULAR',
          details: `FC extrema (${Math.round(hemodynamics.heartRate)} bpm) com tempo diastólico insuficiente para enchimento coronariano. Risco de FV em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: 'Aprofundar plano anestésico se superficial, suspender infusões adrenérgicas ou titular Lidocaína.',
          urgency: 'critical',
        };
      } else if (hemodynamics.myocardialIschemiaScore >= 0.38) {
        const remaining = Math.max(2, Math.round((0.75 - hemodynamics.myocardialIschemiaScore) * 80));
        impendingArrestWarning = {
          type: 'ischemia',
          headline: 'ISQUEMIA MIOCÁRDICA GRAVE · RISCO DE FIBRILAÇÃO VENTRICULAR',
          details: `Desbalanço grave de MVO₂ (${Math.round(hemodynamics.myocardialIschemiaScore * 100)}% de isquemia). Risco iminente de Fibrilação Ventricular!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: 'Se associado Alfa-2 + Atropina, aplicar Atipamezol imediatamente; otimizar oxigenação e reduzir consumo miocárdico.',
          urgency: hemodynamics.myocardialIschemiaScore >= 0.58 ? 'critical' : 'warning',
        };
      } else if (hypoxiaSeconds >= 25 && respiration.pulseOximetrySpO2 < 82) {
        const deathSec = isPediatric ? 55 : 110;
        const remaining = Math.max(1, Math.round(deathSec - hypoxiaSeconds));
        impendingArrestWarning = {
          type: 'hypoxia',
          headline: 'HIPÓXIA TECIDUAL CRÍTICA · RISCO DE PCR ANÓXICA',
          details: `SpO₂ (${Math.round(respiration.pulseOximetrySpO2)}%) e PaO₂ (${Math.round(respiration.arterialBloodGases.paO2)} mmHg) críticos há ${Math.round(hypoxiaSeconds)}s. Risco de parada anóxica em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: 'Verificar via aérea, ventilar com 100% O₂ e aumentar fluxo de oxigênio.',
          urgency: hypoxiaSeconds >= (isPediatric ? 35 : 65) ? 'critical' : 'warning',
        };
      }
    }

    // ----------------------------------------------------
    // 9. GUEDEL STAGE & CONSCIOUSNESS ENGINE
    // ----------------------------------------------------
    const gCl = receptors.gabaAChlorideConductance;
    const gabaHypnosis = Math.max(0, Math.min(1, (gCl - 0.08) / 1.25));
    const generalHypnosis = Math.max(gabaHypnosis, receptors.hypnoticEffect);
    const dissociation = receptors.dissociativeEffect;
    const sedation = receptors.centralSedation;
    let anestheticDepthScore = Math.round(Math.min(100, Math.max(
      generalHypnosis * 100,
      dissociation * 82,
      sedation * 68
    )));

    let consciousnessScore = 100;
    let guedelStage: VitalSigns['guedelStage'] = 'Estágio I (Consciente / Alerta)';
    let eyePosition: EyePosition = 'central_light';
    let palpebralReflex: ReflexStrength = 'brisk';
    let cornealReflex: ReflexStrength = 'brisk';
    let jawTone: JawTone = 'rigid';
    let pedalReflex: ReflexStrength = 'brisk';
    let surgicalTolerancePct = 0;

    const analgesiaPct = Math.round(receptors.nociceptiveInhibition * 100);

    if (isAlreadyDead || isAlreadyArrested) {
      consciousnessScore = 0;
      guedelStage = 'Estágio IV (Depressão Bulbar / Parada)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'absent';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    } else if (dissociation > 0.34 && dissociation > generalHypnosis + 0.08) {
      // Dissociative anesthesia is not a GABA/Guedel state: awareness is reduced,
      // analgesia is present, but ocular/laryngeal reflexes and muscle tone persist.
      consciousnessScore = Math.max(4, Math.round(100 * (1 - Math.min(0.96, dissociation * 1.25)) * (1 - sedation * 0.35)));
      guedelStage = 'Anestesia Dissociativa (Reflexos Preservados)';
      eyePosition = 'central_light';
      palpebralReflex = dissociation > 0.72 ? 'sluggish' : 'moderate';
      cornealReflex = 'brisk';
      jawTone = receptors.muscleRelaxation > 0.48 ? 'moderate' : 'rigid';
      pedalReflex = analgesiaPct > 75 ? 'sluggish' : 'moderate';
      surgicalTolerancePct = Math.round(Math.min(90, analgesiaPct * 0.72 + dissociation * 28));
    } else if (generalHypnosis >= 0.94 || gCl >= 2.8) {
      consciousnessScore = 0;
      guedelStage = 'Estágio IV (Depressão Bulbar / Parada)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'absent';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    } else if (generalHypnosis >= 0.78) {
      consciousnessScore = 0;
      guedelStage = 'Estágio III Plano 3 (Profundo)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'sluggish';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = Math.round(Math.min(100, 88 + analgesiaPct * 0.12));
    } else if (generalHypnosis >= 0.56) {
      consciousnessScore = 0;
      guedelStage = 'Estágio III Plano 2 (Cirúrgico)';
      eyePosition = 'ventromedial_surgical';
      palpebralReflex = 'absent';
      cornealReflex = 'moderate';
      jawTone = 'relaxed_surgical';
      pedalReflex = analgesiaPct > 35 ? 'absent' : 'sluggish';
      surgicalTolerancePct = Math.round(Math.min(100, 72 + analgesiaPct * 0.28));
    } else if (generalHypnosis >= 0.36) {
      consciousnessScore = Math.max(5, Math.round(48 - (generalHypnosis - 0.36) * 155));
      guedelStage = 'Estágio III Plano 1 (Leve)';
      eyePosition = 'ventromedial_surgical';
      palpebralReflex = 'sluggish';
      cornealReflex = 'brisk';
      jawTone = receptors.muscleRelaxation > 0.38 ? 'relaxed_surgical' : 'moderate';
      pedalReflex = analgesiaPct > 65 ? 'absent' : 'sluggish';
      surgicalTolerancePct = Math.round(Math.min(82, 48 + analgesiaPct * 0.34));
    } else if (generalHypnosis >= 0.22) {
      consciousnessScore = Math.max(32, Math.round(68 - generalHypnosis * 85 - sedation * 20));
      guedelStage = 'Estágio II (Excitação/Delírio)';
      eyePosition = 'central_light';
      palpebralReflex = 'moderate';
      cornealReflex = 'brisk';
      jawTone = receptors.muscleRelaxation > 0.3 ? 'moderate' : 'rigid';
      pedalReflex = analgesiaPct > 60 ? 'moderate' : 'brisk';
      surgicalTolerancePct = Math.round(Math.min(55, 18 + analgesiaPct * 0.36));
    } else if (sedation >= 0.38 || (sedation >= 0.20 && analgesiaPct >= 40) || receptors.alpha2Drive > 0.30) {
      // Deep Sedation / Neuroleptanalgesia (e.g. Dexmedetomidine, Xylazine, Acepromazine + Opioid)
      consciousnessScore = Math.max(8, Math.round(100 - sedation * 90 - generalHypnosis * 55 - analgesiaPct * 0.22));
      guedelStage = 'Estágio I (Sedação Profunda / Neuroleptanalgesia)';
      eyePosition = 'central_light';
      palpebralReflex = sedation > 0.60 ? 'sluggish' : 'moderate';
      cornealReflex = 'brisk';
      jawTone = receptors.muscleRelaxation > 0.30 ? 'relaxed_surgical' : 'moderate';
      pedalReflex = analgesiaPct > 50 ? 'sluggish' : 'moderate';
      surgicalTolerancePct = Math.round(Math.min(92, 35 + sedation * 42 + analgesiaPct * 0.45));
    } else if (sedation >= 0.10 || receptors.bzdAllostericOccupancy >= 0.08 || generalHypnosis >= 0.08) {
      // Tranquilization / Light Sedation
      consciousnessScore = Math.max(35, Math.round(100 - sedation * 70 - generalHypnosis * 55));
      guedelStage = 'Estágio I (Sedação Leve / Abatimento)';
      eyePosition = 'central_light';
      palpebralReflex = 'brisk';
      cornealReflex = 'brisk';
      jawTone = receptors.muscleRelaxation > 0.24 ? 'moderate' : 'rigid';
      pedalReflex = analgesiaPct > 65 ? 'moderate' : 'brisk';
      surgicalTolerancePct = Math.round(Math.min(50, analgesiaPct * 0.38 + generalHypnosis * 15 + sedation * 18));
    } else {
      // Estágio I (Consciente / Alerta)
      consciousnessScore = 100;
      guedelStage = 'Estágio I (Consciente / Alerta)';
      eyePosition = 'central_light';
      palpebralReflex = 'brisk';
      cornealReflex = 'brisk';
      jawTone = 'rigid';
      pedalReflex = receptors.localNeuralBlockade > 0.45 ? 'absent' : (analgesiaPct > 65 ? 'moderate' : 'brisk');
      if (receptors.localNeuralBlockade > 0.35) {
        // High surgical tolerance in blocked field despite conscious patient
        surgicalTolerancePct = Math.round(Math.min(95, 45 + receptors.localNeuralBlockade * 45 + analgesiaPct * 0.15));
      } else {
        surgicalTolerancePct = Math.round(Math.min(45, analgesiaPct * 0.45));
      }
    }

    // When noxious surgical stimulation or lingering adrenergic stress is present:
    const activePainStress = hemodynamics.nociceptiveStressLevel;
    if (activePainStress > 0.05 && !isAlreadyDead && !isAlreadyArrested) {
      if (activePainStress > 0.40) {
        pedalReflex = generalHypnosis >= 0.56 ? 'sluggish' : 'brisk';
        if (consciousnessScore < 60 && consciousnessScore > 15) {
          consciousnessScore = Math.min(75, consciousnessScore + 12);
        }
      } else if (activePainStress > 0.15) {
        pedalReflex = generalHypnosis >= 0.56 ? (analgesiaPct > 40 ? 'absent' : 'sluggish') : 'moderate';
      } else {
        pedalReflex = analgesiaPct > 50 || generalHypnosis > 0.40 ? 'absent' : 'sluggish';
      }
    }

    // Motor paralysis changes observable responses but never creates hypnosis.
    if (!isAlreadyDead && !isAlreadyArrested && receptors.nmOccupancy > 0.4) {
      jawTone = receptors.nmOccupancy > 0.8 ? 'flaccid' : 'relaxed_surgical';
      pedalReflex = 'absent';
      palpebralReflex = receptors.nmOccupancy > 0.75 ? 'absent' : 'sluggish';
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
    const thermoregulatorySuppression = 1 + receptors.centralSedation * 0.45 + receptors.hypnoticEffect * 0.85
      + Math.max(0, receptors.cAMPVascular - 1) * 0.25;
    tempC -= thermalLossRate * thermoregulatorySuppression * dtSeconds;
    if (equipment.warmingBlanketActive) {
      tempC = Math.min(38.8, tempC + 0.0007 * dtSeconds);
    }

    // Detailed clinical autopsy report if dead
    let deathDetailedSummary;
    if (isAlreadyDead) {
      // Check for reversal-aggravated collapse in unstable conditions
      let reversalAggravationEvent: string | undefined;
      const atipamezoleActive = (activeDrugEffects['atipamezole']?.Ce || 0) > 0.04;
      const naloxoneActive = (activeDrugEffects['naloxone']?.Ce || 0) > 0.04;

      if (atipamezoleActive && (hemodynamics.meanArterialPressure < 35 || (patient.pathologyConditions.hypovolemiaSeverity || 0) > 0.65)) {
        reversalAggravationEvent = 'Colapso Circulatório Fulminante precipitado por Atipamezol em choque hipovolêmico/vasomotor: a perda súbita do tônus vascular periférico residual extinguiu o retorno venoso e a perfusão coronariana.';
      } else if (naloxoneActive && isSurgicalStimulationActive && hemodynamics.myocardialIschemiaScore > 0.38) {
        reversalAggravationEvent = 'Arritmia Letal / Isquemia Transmural precipitada por Naloxona em estresse nociceptivo cirúrgico: descarga simpática endógena maciça com consumo miocárdico de O2 (MVO2) insustentável.';
      }

      const hadCompressions = resuscitation.isCPRActive || cprSeconds > 10;
      const hadVentilation = Boolean(resuscitation.isCPRVentilationActive) || equipment.intubationStatus === 'intubated_tracheal';
      const wasShockable = arrestType === 'ventricular_fibrillation' || arrestType === 'pulseless_ventricular_tachycardia';
      const hadShock = Boolean(resuscitation.lastShockDeliveredJoules && resuscitation.lastShockDeliveredJoules > 0);
      const hadInotrope = (activeDrugEffects['epinephrine']?.Ce || 0) > 0.02 || (activeDrugEffects['ephedrine']?.Ce || 0) > 0.04;

      const preventabilityOpportunities: string[] = [];
      if (!hadCompressions) {
        preventabilityOpportunities.push('Compressões torácicas imediatas e de alta qualidade (100-120/min com recuo total do tórax) não foram estabelecidas precocemente.');
      }
      if (!hadVentilation) {
        preventabilityOpportunities.push('Ventilação assistida com 100% de Oxigênio (10 rpm, tempo inspiratório de 1s) não foi instituída para reversão da hipóxia.');
      }
      if (wasShockable && !hadShock) {
        preventabilityOpportunities.push('Desfibrilação elétrica precoce (2 a 4 J/kg) não foi disparada para ritmo chocável (Fibrilação Ventricular / TVSP).');
      }
      if (!hadInotrope && cprSeconds > 100) {
        preventabilityOpportunities.push('Suporte vasopressor/inotrópico (Adrenalina 0.01 mg/kg ou Efedrina) não foi administrado em ciclo avançado de RCP.');
      }
      if (reversalAggravationEvent) {
        preventabilityOpportunities.push('A reversão de MPA (alfa-2 ou opioide) deve ser cautelosa ou precedida de ressuscitação volêmica quando houver choque descompensado ativo.');
      }

      const wasResuscitationExemplary = preventabilityOpportunities.length === 0 && hadCompressions && hadVentilation;
      let inevitabilityStatement: string | undefined;
      if (wasResuscitationExemplary) {
        inevitabilityStatement = 'Todas as manobras e intervenções de ressuscitação foram realizadas de acordo com as diretrizes internacionais (RECOVER) de forma correta e oportuna, contudo a gravidade da condição clínica subjacente, o esgotamento bioenergético e a anóxia celular tornaram o óbito biologicamente inevitável.';
      }

      deathDetailedSummary = {
        primaryCause: deathCause || 'Parada Cardiorrespiratória Refratária',
        contributingFactors: [
          `Espécie: ${patient.species.toUpperCase()} (${patient.weightKg} kg) · Classificação ASA ${patient.asa}`,
          speciesEval.particularities.filter((p) => p.isActive).map((p) => `${p.name}: ${p.clinicalImpact}`).join(' | '),
          activeDrugInteractions.map((i) => `${i.title} (${i.severity.toUpperCase()})`).join(', '),
          hypoxiaSeconds > 25 ? `Exposição a Hipóxia Crítica por ${Math.round(hypoxiaSeconds)} segundos` : '',
          ischemiaScore > 0.4 ? `Isquemia Miocárdica Transmural Severa (${(ischemiaScore * 100).toFixed(0)}%)` : '',
          reversalAggravationEvent || '',
        ].filter(Boolean),
        chronology: [
          `Procedimento cirúrgico: ${patient.surgicalProcedure} em ${patient.name}`,
          respiration.isRespiratoryArrest ? `Apneia detectada: ${respiration.respiratoryArrestCause}` : '',
          arrestCause ? `Parada Cardiorrespiratória: ${arrestCause}` : '',
          hadCompressions ? `Manobras de Ressuscitação CPCR (Compressões ativas por ${Math.round(cprSeconds)}s)` : 'Sem compressões torácicas registradas',
          asystoleSeconds > 0 ? `Período em colapso/assistolia: ${Math.round(asystoleSeconds)}s` : '',
          `Declaração de Óbito Encefálico e Cardiopulmonar Irreversível`,
        ].filter(Boolean),
        autopsyFindings: [
          `Gasometria Terminal: pH ${respiration.arterialBloodGases.pH.toFixed(2)}, PaCO2 ${respiration.arterialBloodGases.paCO2.toFixed(1)} mmHg, Lactato ${respiration.arterialBloodGases.lactate.toFixed(2)} mmol/L`,
          `Índice Isquêmico Cardíaco: ${(ischemiaScore * 100).toFixed(0)}%`,
          `Cianose/palidez profunda com tempo de enchimento capilar ausente`,
          `Pupilas em midríase paralítica fixa bilateral e ausência de reflexo corneal`,
        ],
        wasResuscitationExemplary,
        inevitabilityStatement,
        preventabilityOpportunities: preventabilityOpportunities.length > 0 ? preventabilityOpportunities : undefined,
        reversalAggravationEvent,
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
    } else if (achievedROSCNow) {
      // Return of Spontaneous Circulation (ROSC)
      finalHR = Math.round(speciesInfo.normalVitals.hrTypical * 1.15);
      finalMAP = Math.round(speciesInfo.normalVitals.mapTypical * 0.95);
      finalSysBP = finalMAP + 25;
      finalDiaBP = Math.max(20, finalMAP - 15);
      finalRhythm = 'sinus_tachycardia';
      pulseQuality = 'Forte e Cheio';
      finalEtCO2 = Math.min(52, Math.max(38, respiration.etCO2 + 16)); // Hallmark ROSC hypercapnic washout spike!
      capnogramType = 'normal';
    } else if (isAlreadyArrested) {
      if (resuscitation.isCPRActive) {
        finalHR = resuscitation.compressionsPerMin || 110;
        finalMAP = Math.round(35 * (resuscitation.compressionDepthQuality || 0.8));
        finalSysBP = finalMAP + 15;
        finalDiaBP = Math.max(5, finalMAP - 10);
        finalRhythm = arrestType === 'ventricular_fibrillation'
          ? 'ventricular_fibrillation'
          : arrestType === 'pulseless_ventricular_tachycardia'
          ? 'ventricular_tachycardia'
          : arrestType === 'pea'
          ? 'pulseless_electrical_activity'
          : 'asystole';
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
      centralSedation: Number(receptors.centralSedation.toFixed(3)),
      hypnoticEffect: Number(receptors.hypnoticEffect.toFixed(3)),
      dissociativeEffect: Number(receptors.dissociativeEffect.toFixed(3)),
      muscleRelaxation: Number(receptors.muscleRelaxation.toFixed(3)),
      respiratoryDepression: Number(receptors.respiratoryDepression.toFixed(3)),
      macSparingFraction: Number(receptors.macSparingFraction.toFixed(3)),
      volatileAnestheticMac: Number(inhalantCe.toFixed(4)),
      localNeuralBlockade: Number(receptors.localNeuralBlockade.toFixed(3)),
      systemicNaVBlockade: Number(receptors.naVBlockade.toFixed(3)),
      electrolyteCardiotoxicity: Number(receptors.hyperkalemicCardiotoxicity.toFixed(3)),
      antiarrhythmicIbProtection: Number(receptors.antiarrhythmicIbProtection.toFixed(3)),
      cardiacOutputLMin: hemodynamics.cardiacOutputLMin,
      strokeVolumeMl: hemodynamics.strokeVolumeMl,
      systemicVascularResistanceDyne: hemodynamics.systemicVascularResistanceDyne,
      inotropicStateEmax: hemodynamics.inotropicStateEmax,
      baroreceptorGain: hemodynamics.baroreceptorGain,
      baroreceptorVagalTone: hemodynamics.baroreceptorVagalTone,
      pulmonaryShuntFractionPct: Number(speciesEval.shuntFractionPct.toFixed(1)),
      dependentMyopathyRisk: Number(speciesEval.myopathyIschemiaRiskScore.toFixed(3)),
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
      bodyTemperatureC: Number(tempC.toFixed(4)),
      arterialBloodGases: {
        ...respiration.arterialBloodGases,
        glucoseMgDl: Number(biologicalState.metabolic.bloodGlucoseMgDl.toFixed(1)),
      },
      consciousnessScore,
      anestheticDepthScore,
      guedelStage,
      eyePosition,
      palpebralReflex,
      cornealReflex,
      jawTone,
      pedalReflex,
      surgicalTolerancePct: Math.round(surgicalTolerancePct),
      nociceptiveStressLevel: hemodynamics.nociceptiveStressLevel,
      trainOfFourCount: tofCount,
      mucousMembraneColor: mmColor,
      capillaryRefillTime: crt,
      pulseQuality,
      perfusionIndex: Number((Math.max(0, (finalMAP / 85) * (finalSpO2 / 100))).toFixed(2)),

      // Organ Failures & Arrest States
      isRespiratoryArrest: respiration.isRespiratoryArrest,
      isSpontaneousApnea: respiration.isSpontaneousApnea,
      respiratoryArrestCause: respiration.isSpontaneousApnea ? respiration.respiratoryArrestCause : undefined,
      isCardiacArrest: isAlreadyArrested,
      isChestCompressionPulse: isAlreadyArrested && resuscitation.isCPRActive,
      cardiacArrestCause: arrestCause,
      cardiacArrestType: arrestType,
      isDead: isAlreadyDead,
      deathTimeSeconds: deathTime,
      deathCause: deathCause,
      deathDetailedSummary,
      asystoleSecondsElapsed: Math.round(asystoleSeconds),
      cprSecondsElapsed: Math.round(cprSeconds),
      activeDrugInteractions,
      myocardialIschemiaScore: Number(ischemiaScore.toFixed(5)),
      hypoxiaExposureSeconds: Number(hypoxiaSeconds.toFixed(3)),
      severeAcidosisRisk: respiration.arterialBloodGases.pH < 7.15,
      barotraumaCollapse,
      felineLidocaineToxicity: patient.species === 'feline'
        && (receptors.naVBlockade > 0.25 || fatalToxicityReason.includes('Lidocaína')),
      bovineBloatRespiratoryRestriction: patient.species === 'bovine' && speciesEval.ruminalBloatSeverity > 0.4,
      criticalEventTimers: hemodynamics.criticalEventTimers,
      impendingArrestWarning,
      cellularState,
      biologicalState,
    };

    return {
      vitals,
      updatedDoses,
      equipmentUpdates: {
        sodaLimeExhaustionPct: respiration.sodaLimeExhaustionPct,
        currentAirwayPressureCmH2O: respiration.currentAirwayPressureCmH2O,
        totalFluidsInfusedMl: equipment.totalFluidsInfusedMl + (equipment.isFluidPumpRunning ? (equipment.fluidRateMlPerHour / 3600) * dtSeconds : 0),
        isManualBreathTriggered: false,
        manualBreathLastTriggerTime: equipment.isManualBreathTriggered ? simTimeSeconds : equipment.manualBreathLastTriggerTime,
      },
    };
  }
}
