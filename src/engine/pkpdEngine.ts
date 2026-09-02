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
} from '../types/simulator';
import { SPECIES_DATABASE } from '../data/speciesData';
import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';

export class PKPDEngine {
  /**
   * High-fidelity veterinary PK/PD, receptor biochemistry, and organ pathophysiology engine.
   * Accurately simulates:
   * 1. Multi-compartment drug disposition and bio-phase equilibration (ke0).
   * 2. Receptor-level allosteric GABA-A potentiation (Benzodiazepine + Opioid + Propofol synergy).
   * 3. Realistic veterinary induction protocols (e.g. Midazolam + Methadone + Propofol) for dogs & cats.
   * 4. Species-specific clearances (feline glucuronidation, canine vagotonia, bovine alpha-2 sensitivity).
   * 5. Guedel planes (jaw tone, palpebral/corneal reflexes, eye rotation).
   * 6. Acute bolus hemodynamics, respiratory arrest (apnea), cardiac arrest thresholds, and biological death.
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

    // ----------------------------------------------------
    // PATIENT DEMOGRAPHICS & SPECIES METABOLIC VULNERABILITIES
    // ----------------------------------------------------
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

    // Clearance and sensitivity modifiers
    let drugClearanceFactor = 1.0;
    let cardiovascularReserveFactor = 1.0;
    let hypoxiaDesaturationMultiplier = 1.0;

    if (patient.species === 'feline') {
      // Felines have deficient glucuronidation (UGT1A6/UGT1A9 deficit)
      drugClearanceFactor *= 0.85;
      hypoxiaDesaturationMultiplier *= 1.25;
    } else if (patient.species === 'canine') {
      // Canines have strong vagal responsiveness to pure opioids
      drugClearanceFactor *= 1.0;
    } else if (patient.species === 'rabbit' || patient.species === 'avian') {
      drugClearanceFactor *= 1.4; // High metabolic rate
      hypoxiaDesaturationMultiplier *= 2.2;
    }

    if (isPediatric) {
      drugClearanceFactor *= 0.65; // Immature hepatic microsomal clearance
      cardiovascularReserveFactor *= 0.70; // Non-compliant myocardium, rate-dependent cardiac output
      hypoxiaDesaturationMultiplier *= 2.2; // High VO2 and small FRC
    } else if (isGeriatric) {
      drugClearanceFactor *= 0.65; // Reduced GFR and hepatic blood flow
      cardiovascularReserveFactor *= 0.60; // Diastolic stiffness, low ischemia threshold
      hypoxiaDesaturationMultiplier *= 1.35;
    }

    if (patient.weightKg < 4.0) {
      hypoxiaDesaturationMultiplier *= 1.25;
    }

    // ----------------------------------------------------
    // 1. ACTIVE DRUG PHARMACOKINETICS (BIO-PHASE EQUILIBRATION)
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

      // Delivery progress
      const deliveryDuration = dose.deliveryDurationSec || 1;
      const deliveryFraction = deliveryDuration > 0 ? Math.min(1.0, deliveryElapsed / deliveryDuration) : 1.0;
      if (deliveryFraction >= 1.0) {
        isFullyDelivered = true;
      }

      // Fast Bolus Acute Shock calculation
      if (dose.administrationSpeed === 'bolus_rapid' && !isFastBolusShockTriggered && transitLagRemaining <= 0) {
        isFastBolusShockTriggered = true;
        const recommendedDose = drugDef.recommendedDose[patient.species] || drugDef.recommendedDose.canine;
        const doseRatio = dose.dosePerKg / (recommendedDose?.typical || 1.0);

        if (drugDef.fastBolusRisk) {
          shockMagnitude = drugDef.fastBolusRisk.lethalityRiskScore * Math.min(3.0, doseRatio);
        }
      }

      // PK Disposition (Two-compartment + Effect Site bio-phase)
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

      // Toxicological Overdose Checks
      const rec = drugDef.recommendedDose[patient.species] || drugDef.recommendedDose.canine;
      const overdoseRatio = dose.dosePerKg / (rec?.max || 1.0);

      // 1. Bovine Extreme Sensitivity to Xylazine (Alpha-2D isoform)
      if (patient.species === 'bovine' && drugDef.id === 'xylazine' && dose.dosePerKg > 0.20) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = `Intoxicação Letal por Xilazina em Bovino (Dose ${dose.dosePerKg} mg/kg = ${(dose.dosePerKg / 0.05).toFixed(1)}x a dose terapêutica; receptores alfa-2D hiper-responsivos)`;
      }

      // 2. Feline Acute Lidocaine IV Toxicity
      if (patient.species === 'feline' && drugDef.id === 'lidocaine_2pct' && dose.route.includes('IV') && (dose.dosePerKg > 1.2 || dose.administrationSpeed === 'bolus_rapid')) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = 'Colapso Cardiocerebral e Depressão Miocárdica Fulminante por Lidocaína IV em Felino (Déficit congênito de glicuronidação)';
      }

      // 3. Rapid Potassium Chloride (KCl) bolus
      if (drugDef.id === 'potassium_chloride' && (dose.administrationSpeed === 'bolus_rapid' || dose.dosePerKg > 0.6)) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = 'Parada Cardíaca Instantânea em Diástole por Hipercalemia Fulminante (Bólus IV de Cloreto de Potássio)';
      }

      // 4. Massive single-drug overdose
      if (overdoseRatio >= 3.8 && (drugDef.category === 'induction' || drugDef.category === 'opioid_analgesic' || drugDef.category === 'premedication')) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = `Sobredosagem Maciça Fatal por ${drugDef.name} (${overdoseRatio.toFixed(1)}x acima da dose máxima de segurança)`;
      }

      // Retain in active pool
      if (newCp > 0.003 || newCe > 0.003 || transitLagRemaining > 0 || (dose.isCRI && (dose.criRatePerKgMin || 0) > 0)) {
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
    // 2. COMPETITIVE ANTAGONIST / REVERSAL KINETICS
    // ----------------------------------------------------
    // Atipamezole reversing Alpha-2 (Dexmedetomidine, Xylazine, Detomidine)
    const atipamezoleCe = activeDrugEffects['atipamezole']?.Ce || 0;
    if (atipamezoleCe > 0.03) {
      ['dexmedetomidine', 'xylazine', 'detomidine'].forEach((id) => {
        if (activeDrugEffects[id]) {
          activeDrugEffects[id].Ce = Math.max(0, activeDrugEffects[id].Ce - atipamezoleCe * 2.8);
        }
      });
    }

    // Naloxone reversing Opioids (Morphine, Methadone, Fentanyl, etc.)
    const naloxoneCe = activeDrugEffects['naloxone']?.Ce || 0;
    if (naloxoneCe > 0.03) {
      ['morphine', 'methadone', 'fentanyl', 'butorphanol', 'buprenorphine', 'tramadol'].forEach((id) => {
        if (activeDrugEffects[id]) {
          activeDrugEffects[id].Ce = Math.max(0, activeDrugEffects[id].Ce - naloxoneCe * 3.0);
        }
      });
    }

    // Flumazenil reversing Benzodiazepines (Midazolam, Diazepam)
    const flumazenilCe = activeDrugEffects['flumazenil']?.Ce || 0;
    if (flumazenilCe > 0.03) {
      ['midazolam', 'diazepam'].forEach((id) => {
        if (activeDrugEffects[id]) {
          activeDrugEffects[id].Ce = Math.max(0, activeDrugEffects[id].Ce - flumazenilCe * 2.8);
        }
      });
    }

    // Neostigmine reversing Atracurium NMBA
    const neostigmineCe = activeDrugEffects['neostigmine']?.Ce || 0;
    if (neostigmineCe > 0.03 && activeDrugEffects['atracurium']) {
      activeDrugEffects['atracurium'].Ce = Math.max(0, activeDrugEffects['atracurium'].Ce - neostigmineCe * 2.5);
    }

    // Sugammadex reversing NMBA
    const sugammadexCe = activeDrugEffects['sugammadex']?.Ce || 0;
    if (sugammadexCe > 0.03 && activeDrugEffects['atracurium']) {
      activeDrugEffects['atracurium'].Ce = Math.max(0, activeDrugEffects['atracurium'].Ce - sugammadexCe * 3.5);
    }

    // Lipid Emulsion 20% (Intralipid "Lipid Sink") reversing Local Anesthetic Toxicity
    const lipidCe = activeDrugEffects['lipid_emulsion_20']?.Ce || 0;
    if (lipidCe > 0.03) {
      ['lidocaine_2pct', 'bupivacaine_05'].forEach((id) => {
        if (activeDrugEffects[id]) {
          activeDrugEffects[id].Ce = Math.max(0, activeDrugEffects[id].Ce - lipidCe * 2.8);
          activeDrugEffects[id].Cp = Math.max(0, activeDrugEffects[id].Cp - lipidCe * 2.8);
        }
      });
    }

    // Synchronize post-reversal Ce back into updatedDoses array
    updatedDoses.forEach((d) => {
      if (activeDrugEffects[d.drugId]) {
        d.currentCe = activeDrugEffects[d.drugId].Ce;
      }
    });

    // ----------------------------------------------------
    // 3. INHALATION ANESTHETIC PHARMACOKINETICS & CIRCUIT
    // ----------------------------------------------------
    let deliveredVaporizerPct = 0;
    if (equipment.isVaporizerOn && equipment.oxygenFlowLMin > 0.1 && equipment.intubationStatus === 'intubated_tracheal') {
      deliveredVaporizerPct = equipment.vaporizerDialPct;
    }

    const macSpecies = equipment.vaporizerType === 'isoflurane' ? speciesInfo.macValues.isoflurane : speciesInfo.macValues.sevoflurane;
    const inhalantCe = deliveredVaporizerPct / macSpecies; // 1.0 = 1 MAC

    // Inhalation acute overdose
    if (deliveredVaporizerPct >= 4.0 && equipment.oxygenFlowLMin > 0.3 && inhalantCe >= 2.8) {
      fatalOverdoseTriggered = true;
      fatalToxicityReason = `Sobredosagem Letal por Anestésico Inalatório (${equipment.vaporizerType.toUpperCase()} a ${deliveredVaporizerPct}% = ${(inhalantCe).toFixed(1)} MAC com colapso miocárdico e vasomotor)`;
    }

    let sodaLimeExhaustionPct = equipment.sodaLimeExhaustionPct;
    if (equipment.circuitType.includes('circle') && equipment.oxygenFlowLMin > 0.1) {
      sodaLimeExhaustionPct = Math.min(100, sodaLimeExhaustionPct + (dtSeconds / 3600) * 8.0);
    }

    // ----------------------------------------------------
    // 4. CHEMICAL RECEPTOR OCCUPANCY & SYNERGY MODEL
    // ----------------------------------------------------
    const activeInteractions: VitalSigns['activeDrugInteractions'] = [];

    // Extract receptor agonist effect-site concentrations (Ce)
    const alpha2Ce = Math.max(activeDrugEffects['dexmedetomidine']?.Ce || 0, activeDrugEffects['xylazine']?.Ce || 0, activeDrugEffects['detomidine']?.Ce || 0);
    const opioidCe = Math.max(activeDrugEffects['fentanyl']?.Ce || 0, activeDrugEffects['methadone']?.Ce || 0, activeDrugEffects['morphine']?.Ce || 0, activeDrugEffects['butorphanol']?.Ce || 0, activeDrugEffects['buprenorphine']?.Ce || 0);
    const benzoCe = Math.max(activeDrugEffects['midazolam']?.Ce || 0, activeDrugEffects['diazepam']?.Ce || 0);
    const hypnoticDirectCe = (activeDrugEffects['propofol']?.Ce || 0) + (activeDrugEffects['alfaxalone']?.Ce || 0) + (activeDrugEffects['etomidate']?.Ce || 0) + (activeDrugEffects['thiopental']?.Ce || 0);
    const dissociativeCe = activeDrugEffects['ketamine']?.Ce || 0;
    const anticholinergicCe = Math.max(activeDrugEffects['atropine']?.Ce || 0, activeDrugEffects['glycopyrrolate']?.Ce || 0);
    const inotropeCe = Math.max(activeDrugEffects['epinephrine']?.Ce || 0, activeDrugEffects['norepinephrine']?.Ce || 0, activeDrugEffects['dobutamine']?.Ce || 0, activeDrugEffects['dopamine']?.Ce || 0, activeDrugEffects['ephedrine']?.Ce || 0);
    const nmbaCe = activeDrugEffects['atracurium']?.Ce || 0;
    const acepromazineCe = activeDrugEffects['acepromazine']?.Ce || 0;
    const localCe = activeDrugEffects['lidocaine_2pct']?.Ce || 0 + (activeDrugEffects['bupivacaine_05pct']?.Ce || 0);

    let fatalAlpha2AtropineTrigger = false;
    let fatalSympathomimeticStormTrigger = false;

    // INTERACTION 1: Alpha-2 Agonist + Anticholinergic (Dexmedetomidine/Xylazine + Atropine)
    if (alpha2Ce > 0.25 && anticholinergicCe > 0.25) {
      activeInteractions.push({
        title: 'Alfa-2 Agonista + Anticolinérgico (Dexmedetomidina + Atropina)',
        severity: 'lethal',
        description: 'Taquicardia forçada contra vasoconstrição periférica severa (Pós-carga extrema). Risco imediato de crise hipertensiva, isquemia miocárdica transmural aguda e Fibrilação Ventricular.',
        pharmacologyMechanism: 'Bloqueio parassimpático vagal forçando cronotropismo positivo contra resistência vascular sistêmica aumentada por estimulação alfa-2 pós-sináptica periférica.',
      });

      ischemiaScore = Math.min(1.0, ischemiaScore + (dtSeconds / 15) * 0.85);
      if (ischemiaScore > 0.55 && !isAlreadyArrested) {
        fatalAlpha2AtropineTrigger = true;
      }
    }

    // INTERACTION 2: Opioid + Hypnotic + Benzodiazepine (Neuroleptanalgesia & Induction Synergy)
    if (opioidCe > 0.25 && benzoCe > 0.25 && (hypnoticDirectCe > 0.25 || inhalantCe > 0.5)) {
      activeInteractions.push({
        title: 'Sinergismo de Neuroleptoanalgesia e Indução GABA-érgica',
        severity: 'info',
        description: 'Potencialização alostérica no receptor GABA-A com poupança de até 70% na dose de propofol/isoflurano e relaxamento mandibular perfeito.',
        pharmacologyMechanism: 'Modulação alostérica positiva no complexo GABA-A por benzodiazepínicos potencializando a abertura de canais de Cloro pelo propofol, somada à inibição nociceptiva bulbar pelos receptores mu-opioides.',
      });
    }

    // INTERACTION 3: Sympathomimetic Storm (Excessive Epinephrine)
    if (inotropeCe > 0.85 && !isAlreadyArrested) {
      activeInteractions.push({
        title: 'Tempestade Adrenérgica e Taquiarritmia Maligna',
        severity: 'lethal',
        description: 'Hiperestimulação beta-1/alfa-1 provocando taquicardia extrema (>240 bpm), encurtamento crítico da diástole com isquemia coronariana e FV/TV sem pulso.',
        pharmacologyMechanism: 'Sobrecarga intracelular de cálcio por fosforilação de fosfolambano via AMPc, precipitando pós-despolarizações precoces e tardias (EAD/DAD).',
      });

      ischemiaScore = Math.min(1.0, ischemiaScore + (dtSeconds / 12) * 0.9);
      if (ischemiaScore > 0.50) {
        fatalSympathomimeticStormTrigger = true;
      }
    }

    // INTERACTION 4: NMBA without Mechanical Ventilation
    if (nmbaCe > 0.20 && !equipment.isVentilatorActive && equipment.intubationStatus !== 'intubated_tracheal') {
      activeInteractions.push({
        title: 'Bloqueio Neuromuscular sem Suporte Ventilatório',
        severity: 'lethal',
        description: 'Paralisia diafragmática completa por bloqueio nicotínico sem via aérea pérvia ou ventilação mecânica. Asfixia rápida com anóxia progressiva.',
        pharmacologyMechanism: 'Antagonismo competitivo dos receptores colinérgicos nicotínicos na placa motora terminal (diafragma e músculos intercostais).',
      });
    }

    // ----------------------------------------------------
    // 5. DOSE-RESPONSE PHARMACODYNAMICS (HILL EQUATIONS & GUEDEL DEPTH)
    // ----------------------------------------------------
    // Calculate synergistic neuroleptanalgesia & MAC reduction
    const macReductionFactor = Math.min(
      0.75,
      0.35 * benzoCe + 0.45 * opioidCe + 0.60 * alpha2Ce + 0.30 * acepromazineCe + 0.35 * dissociativeCe
    );
    const effectiveMacNeeded = Math.max(0.25, 1.0 - macReductionFactor);
    const normalizedInhalantDrive = (inhalantCe / effectiveMacNeeded) * 1.1;

    // Allosteric multi-drug synergy multiplier for GABA-A activation:
    const gabaAllostericSynergy = 1.0 + 1.8 * benzoCe + 1.4 * opioidCe + 2.8 * (benzoCe * opioidCe) + 2.0 * alpha2Ce;

    // Total Effective Hypnotic Drive at brain effect-site:
    const effectiveHypnoticDrive =
      (hypnoticDirectCe + 0.85 * dissociativeCe + 0.95 * normalizedInhalantDrive) * gabaAllostericSynergy +
      0.35 * benzoCe +
      0.30 * opioidCe +
      0.55 * alpha2Ce +
      0.25 * acepromazineCe;

    // Sigmoidal Hill Equation for Anesthetic Depth (0 - 100):
    // EC50 = 1.0, gamma = 2.4
    const hillGamma = 2.4;
    const hillNumerator = Math.pow(Math.max(0, effectiveHypnoticDrive), hillGamma);
    const hillDenominator = Math.pow(1.0, hillGamma) + hillNumerator;
    let rawDepthScore = 100 * (hillNumerator / hillDenominator);

    // Apply species tolerance tuning
    if (patient.species === 'feline' && dissociativeCe > 0.3 && benzoCe === 0) {
      // Feline without benzo may exhibit cataleptic rigidity and higher sympathetic arousal
      rawDepthScore = Math.max(20, rawDepthScore * 0.85);
    }

    let anestheticDepthScore = Math.min(100, Math.max(0, rawDepthScore));

    // Antinociceptive (Analgesia) Score (0 - 100):
    const rawAnalgesicDrive = 1.8 * opioidCe + 1.2 * alpha2Ce + 0.9 * dissociativeCe + 0.7 * localCe;
    const surgicalAnalgesiaPct = Math.min(100, Math.round(100 * (Math.pow(rawAnalgesicDrive, 2) / (Math.pow(0.9, 2) + Math.pow(rawAnalgesicDrive, 2)))));

    // Muscle Relaxation Score (0 - 100):
    const rawRelaxDrive = 1.2 * benzoCe + 0.9 * alpha2Ce + 1.0 * hypnoticDirectCe + 1.1 * normalizedInhalantDrive + 2.8 * nmbaCe + 0.4 * acepromazineCe - 0.4 * dissociativeCe;
    const muscleRelaxationPct = Math.min(100, Math.max(0, Math.round(100 * (Math.pow(Math.max(0, rawRelaxDrive), 2) / (Math.pow(1.0, 2) + Math.pow(Math.max(0, rawRelaxDrive), 2))))));

    // ----------------------------------------------------
    // 6. CARDIOVASCULAR & HEMODYNAMIC DYNAMICS
    // ----------------------------------------------------
    let deltaHRScore = 0;
    let deltaBPScore = 0;
    let deltaRRScore = 0;
    let antiarrhythmicFactor = 0;
    let acuteBolusHypotension = 0;
    let acuteAlpha2Hypertension = 0;
    let acuteAlpha2Bradycardia = 0;
    let acuteApneaRisk = 0;

    for (const key of Object.keys(activeDrugEffects)) {
      const { drugDef, Ce, bolusShockMagnitude } = activeDrugEffects[key];
      deltaHRScore += drugDef.effectHR * Ce;
      deltaBPScore += drugDef.effectBP * Ce;
      deltaRRScore += drugDef.effectRR * Ce;

      if (drugDef.specialTraits?.causesArrhythmogenicityReduction) {
        antiarrhythmicFactor += Ce;
      }

      if (bolusShockMagnitude > 0 && drugDef.fastBolusRisk) {
        acuteApneaRisk = Math.max(acuteApneaRisk, drugDef.fastBolusRisk.apneaRisk * bolusShockMagnitude);
        if (drugDef.fastBolusRisk.hypotensionSeverity > 0) {
          acuteBolusHypotension += drugDef.fastBolusRisk.hypotensionSeverity * bolusShockMagnitude * 35;
        }
        if (drugDef.specialTraits?.causesInitialHypertensionReflexBradycardia) {
          acuteAlpha2Hypertension += 45 * bolusShockMagnitude;
          acuteAlpha2Bradycardia += 0.60 * bolusShockMagnitude;
        }
      }
    }

    if (alpha2Ce > 0.2 && anticholinergicCe > 0.2) {
      acuteAlpha2Hypertension += 75 * Math.min(1.5, alpha2Ce * anticholinergicCe);
      deltaHRScore += 1.4 * anticholinergicCe;
      acuteAlpha2Bradycardia = 0;
    }

    let baselineHR = patient.baselineVitals.hr;
    let baselineMAP = patient.baselineVitals.map;

    let targetHR = baselineHR * (1 + deltaHRScore * 0.85);
    let targetMAP = baselineMAP * (1 + deltaBPScore * 0.80);

    targetMAP -= acuteBolusHypotension;
    targetMAP += acuteAlpha2Hypertension;
    targetHR *= (1 - acuteAlpha2Bradycardia);

    // Inhalation cardiovascular depression
    if (inhalantCe > 1.1) {
      targetMAP -= (inhalantCe - 1.1) * 24;
      targetHR -= (inhalantCe - 1.1) * 12;
    }

    // Surgical stimulation response (tachycardia & hypertension if depth or analgesia is insufficient)
    if (isSurgicalStimulationActive) {
      if (anestheticDepthScore < 45 || surgicalAnalgesiaPct < 35) {
        targetHR += 38;
        targetMAP += 30;
      } else if (anestheticDepthScore < 65 || surgicalAnalgesiaPct < 60) {
        targetHR += 14;
        targetMAP += 10;
      }
    }

    // Pathology shock
    if (patient.pathologyConditions.hypovolemiaSeverity) {
      const severity = patient.pathologyConditions.hypovolemiaSeverity;
      targetMAP *= (1 - severity * 0.50);
      targetHR *= (1 + severity * 0.45);
    }

    // Fluids
    if (equipment.isFluidPumpRunning && equipment.fluidRateMlPerHour > 0) {
      const infusedVolumeMl = (equipment.fluidRateMlPerHour / 3600) * dtSeconds;
      const volumeRatio = infusedVolumeMl / (patient.weightKg * 10);
      targetMAP += volumeRatio * 18;
    }

    // ----------------------------------------------------
    // 7. RESPIRATORY PHYSIOLOGY, APNEA & OXYGENATION
    // ----------------------------------------------------
    const isIntubated = equipment.intubationStatus === 'intubated_tracheal';
    const isEsophageal = equipment.intubationStatus === 'intubated_esophageal';
    const isUnintubated = equipment.intubationStatus === 'unintubated' || equipment.intubationStatus === 'extubated';
    const isFullyParalyzed = nmbaCe > 0.20;

    let baselineRR = patient.baselineVitals.rr;
    let spontaneousRR = baselineRR * (1 + deltaRRScore * 0.80);

    // Apnea Thresholds (Respiratory Arrest)
    let isRespiratoryArrest = false;
    let apneaCause = '';

    if (isFullyParalyzed) {
      spontaneousRR = 0;
      isRespiratoryArrest = true;
      apneaCause = 'Parada Respiratória por Bloqueio Neuromuscular (Atracúrio sem ventilação mecânica)';
    } else if (anestheticDepthScore > 88) {
      spontaneousRR = 0;
      isRespiratoryArrest = true;
      apneaCause = 'Parada Respiratória por Depressão Bulbar Profunda (Plano anestésico excessivo / Estágio IV)';
    } else if (acuteApneaRisk > 0.70) {
      spontaneousRR = 0;
      isRespiratoryArrest = true;
      apneaCause = 'Apneia Aguda por Bólus IV Rápido de Hipnótico/Opioide';
    } else if (opioidCe > 0.75 && hypnoticDirectCe > 0.70) {
      spontaneousRR = 0;
      isRespiratoryArrest = true;
      apneaCause = 'Parada Respiratória por Sinergismo Depressor Opioide + Hipnótico';
    } else if (anestheticDepthScore > 68) {
      spontaneousRR *= 0.50; // Moderate Bradypnea in Stage III Plane 2
    } else if (anestheticDepthScore > 48) {
      spontaneousRR *= 0.75; // Mild Bradypnea in Stage III Plane 1
    }

    if (isSurgicalStimulationActive && anestheticDepthScore < 50 && !isFullyParalyzed && spontaneousRR > 0) {
      spontaneousRR *= 1.40;
    }

    spontaneousRR = Math.max(0, Math.round(spontaneousRR));

    let finalRR = spontaneousRR;
    let tidalVolumeMl = patient.weightKg * 12;
    let currentPaw = 0;

    if (equipment.isVentilatorActive && equipment.ventilatorMode !== 'spontaneous') {
      finalRR = equipment.ventilatorSettings.rateBpm;
      tidalVolumeMl = equipment.ventilatorSettings.tidalVolumeMl;
      currentPaw = equipment.ventilatorSettings.pipPressureLimitCmH2O;
      isRespiratoryArrest = false;
    } else {
      currentPaw = spontaneousRR > 0 ? (equipment.aplValveState === 'closed' ? 24 : 2) : 0;
    }

    const minuteVolumeL = (finalRR * tidalVolumeMl) / 1000.0;

    // Barotrauma
    let barotraumaCollapse = false;
    if (equipment.aplValveState === 'closed' && equipment.oxygenFlowLMin > 1.2 && equipment.reservoirBagVolumeMl > 2400) {
      barotraumaCollapse = true;
      fatalOverdoseTriggered = true;
      fatalToxicityReason = 'Pneumotórax Hipertensivo / Barotrauma Pulmonar (Válvula APL fechada com sobrepressão crítica)';
    }

    // Capnography Dynamics
    let etco2 = patient.baselineVitals.etco2;
    let fico2 = 0;
    let capnogramType: CapnogramType = 'normal';

    if (sodaLimeExhaustionPct > 60 && equipment.circuitType.includes('circle')) {
      fico2 = Math.round(((sodaLimeExhaustionPct - 60) / 40) * 14);
      etco2 += fico2;
      capnogramType = 'rebreathing_elevated_baseline';
    }

    if (isEsophageal || (isUnintubated && finalRR === 0) || isAlreadyArrested) {
      etco2 = isEsophageal || isAlreadyArrested ? 0 : etco2;
      if (isEsophageal || isAlreadyArrested) capnogramType = 'cardiac_arrest_flat';
    } else {
      if (finalRR === 0) {
        etco2 = 0;
        capnogramType = 'cardiac_arrest_flat';
      } else if (minuteVolumeL > patient.weightKg * 0.28) {
        etco2 = Math.max(16, Math.round(38 - (minuteVolumeL - patient.weightKg * 0.28) * 4));
        capnogramType = 'hyperventilation';
      } else if (minuteVolumeL < patient.weightKg * 0.10) {
        etco2 = Math.min(85, Math.round(38 + (patient.weightKg * 0.10 - minuteVolumeL) * 12));
        capnogramType = 'hypoventilation';
      }
    }

    // Oxygenation & Hypoxia Cascade
    let paO2 = isIntubated && equipment.oxygenFlowLMin > 0.3 ? 380 : 95;
    let spo2 = previousVitals?.pulseOximetrySpO2 || patient.baselineVitals.spo2;
    const isBreathingAdequately = (finalRR > 0 && tidalVolumeMl > 0) || (equipment.isVentilatorActive && equipment.oxygenFlowLMin > 0.2);

    if (isEsophageal || !isBreathingAdequately || (isUnintubated && spontaneousRR === 0)) {
      // Realistic desaturation rate (e.g. 0.4% per second in standard dog)
      const desatSpeed = 0.40 * hypoxiaDesaturationMultiplier;
      spo2 = Math.max(0, spo2 - dtSeconds * desatSpeed);
      paO2 = Math.max(10, paO2 - dtSeconds * 3.5 * hypoxiaDesaturationMultiplier);
    } else if (spo2 < 98) {
      spo2 = Math.min(100, spo2 + dtSeconds * 2.8);
      paO2 = Math.min(380, paO2 + dtSeconds * 16.0);
    }

    if (patient.pathologyConditions.brachycephalicObstruction && isUnintubated && anestheticDepthScore > 18) {
      spo2 = Math.max(60, spo2 - dtSeconds * 0.35);
      capnogramType = 'obstructive_shark_fin';
    }

    // Hypoxia accumulation
    if (spo2 < 82 || paO2 < 55) {
      hypoxiaSeconds += dtSeconds;
    } else {
      hypoxiaSeconds = Math.max(0, hypoxiaSeconds - dtSeconds * 0.6);
    }

    // ----------------------------------------------------
    // 8. CARDIAC ARREST THRESHOLDS & LETHAL ARREST PROGRESSION
    // ----------------------------------------------------
    const isCoronaryHypoperfused = targetMAP < (isGeriatric ? 55 : 40);
    const isExtremeTachycardic = targetHR > (speciesInfo.normalVitals.hrMax * 1.55);
    const isSevereHypertensive = targetMAP > 190;

    if (hypoxiaSeconds > 25 || isCoronaryHypoperfused || isExtremeTachycardic || isSevereHypertensive) {
      const ischemRate = (isExtremeTachycardic && isSevereHypertensive ? 0.9 : 0.45) / cardiovascularReserveFactor;
      ischemiaScore = Math.min(1.0, ischemiaScore + (dtSeconds / 60) * ischemRate);
    } else {
      ischemiaScore = Math.max(0, ischemiaScore - (dtSeconds / 60) * 0.20);
    }

    let triggeredArrestNow = false;

    // A. Extreme Tachycardia / Sympathomimetic Collapse
    const fatalHRThreshold = patient.species === 'canine' ? 245 : patient.species === 'feline' ? 280 : patient.species === 'equine' ? 115 : 160;
    if (targetHR >= fatalHRThreshold && simTimeSeconds > 15 && !isAlreadyArrested) {
      if (ischemiaScore > 0.40 || (previousVitals?.heartRate && previousVitals.heartRate > fatalHRThreshold)) {
        triggeredArrestNow = true;
        arrestType = 'ventricular_fibrillation';
        arrestCause = `Parada Cardíaca por Taquiarritmia e Fibrilação Ventricular (FC crítica de ${Math.round(targetHR)} bpm com isquemia coronariana transmural e colapso de enchimento diastólico)`;
      }
    }

    // B. Alpha-2 + Atropine Induced Lethal Crisis
    if (fatalAlpha2AtropineTrigger && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = 'ventricular_fibrillation';
      arrestCause = 'Parada Cardiorrespiratória por Fibrilação Ventricular decorrente de Crise Hipertensiva e Isquemia Miocárdica Aguda (Interação Letal: Alfa-2 + Atropina)';
    }

    // C. Sympathomimetic Overdose Storm
    if (fatalSympathomimeticStormTrigger && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = 'pulseless_ventricular_tachycardia';
      arrestCause = 'Parada Cardíaca por Taquicardia Ventricular Sem Pulso / Fibrilação Ventricular pós-Hiperestimulação Adrenérgica Maciça';
    }

    // D. Critical Asphyxia / Prolonged Hypoxia (SpO2 < 50% or Hypoxia > 90s)
    if ((hypoxiaSeconds > (isPediatric ? 50 : 95) || (spo2 < 20 && simTimeSeconds > 25)) && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = 'asystole';
      arrestCause = `Parada Cardiorrespiratória por Anóxia Miocárdica e Asfixia Aguda (${Math.round(hypoxiaSeconds)}s em hipóxia crítica)`;
    }

    // E. Extreme Critical Bradycardia
    const fatalBradyThreshold = patient.species === 'canine' ? (isPediatric ? 55 : 28) : patient.species === 'feline' ? 55 : patient.species === 'equine' ? 14 : 20;
    if (targetHR <= fatalBradyThreshold && simTimeSeconds > 15 && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = 'asystole';
      arrestCause = `Parada Cardíaca em Assistolia por Bradicardia Extrema e Choque Cardiogênico Terminal (FC ${Math.round(targetHR)} bpm)`;
    }

    // F. Direct Toxic Overdose / Fatal Overdose
    if (fatalOverdoseTriggered && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = drugDefIdArrestType(fatalToxicityReason);
      arrestCause = fatalToxicityReason;
    }

    // G. Terminal Hypotension (MAP < 22 mmHg sustained)
    if (targetMAP < 22 && simTimeSeconds > 30 && !isAlreadyArrested) {
      triggeredArrestNow = true;
      arrestType = 'pea';
      arrestCause = 'Parada Cardíaca por Dissociação Eletromecânica (AESP) decorrente de Choque Hipovolêmico / Vasodilatador Irreversível (PAM < 22 mmHg)';
    }

    if (triggeredArrestNow) {
      isAlreadyArrested = true;
    }

    // ----------------------------------------------------
    // 9. BIOLOGICAL DEATH DETERMINATION (IRREVERSIBLE ARREST)
    // ----------------------------------------------------
    if (isAlreadyArrested) {
      if (resuscitation.isCPRActive) {
        cprSeconds += dtSeconds;
      } else {
        asystoleSeconds += dtSeconds;
      }

      const deathThresholdSec = isPediatric ? 100 : 160;
      if ((asystoleSeconds > deathThresholdSec || (cprSeconds > 360 && asystoleSeconds > 60)) && !isAlreadyDead) {
        isAlreadyDead = true;
        deathTime = simTimeSeconds;
        deathCause = arrestCause || 'Morte Encefálica e Circulatória Irreversível decorrente de Parada Cardiorrespiratória Refratária';
      }
    }

    // ----------------------------------------------------
    // 10. RHYTHM & HEMODYNAMIC ASSIGNMENT
    // ----------------------------------------------------
    let rhythm: CardiacRhythm = 'sinus';
    let pulseQuality: 'Forte e Cheio' | 'Normal' | 'Fraco / Filiforme' | 'Célere / Saltão' | 'Ausente' = 'Normal';

    if (isAlreadyDead) {
      rhythm = 'asystole';
      targetHR = 0;
      targetMAP = 0;
      spo2 = 0;
      etco2 = 0;
      finalRR = 0;
      capnogramType = 'cardiac_arrest_flat';
      pulseQuality = 'Ausente';
    } else if (isAlreadyArrested) {
      if (resuscitation.isCPRActive) {
        rhythm = 'pulseless_electrical_activity';
        targetHR = resuscitation.compressionsPerMin || 110;
        targetMAP = 35 * (resuscitation.compressionDepthQuality || 0.8);
        pulseQuality = 'Fraco / Filiforme';
        etco2 = Math.round(16 * (resuscitation.compressionDepthQuality || 0.8));
        capnogramType = 'normal';
      } else {
        rhythm = arrestType === 'ventricular_fibrillation'
          ? 'ventricular_fibrillation'
          : arrestType === 'pulseless_ventricular_tachycardia'
          ? 'ventricular_tachycardia'
          : 'asystole';
        targetHR = 0;
        targetMAP = 0;
        spo2 = 0;
        etco2 = 0;
        finalRR = 0;
        capnogramType = 'cardiac_arrest_flat';
        pulseQuality = 'Ausente';
      }
    } else {
      if (ischemiaScore > 0.70 || (patient.pathologyConditions.hyperkalemiaSeverity && patient.pathologyConditions.hyperkalemiaSeverity > 0.85)) {
        rhythm = 'ventricular_tachycardia';
        targetHR = Math.max(210, targetHR);
      } else if (ischemiaScore > 0.35 || patient.pathologyConditions.gastricDilatationVolvulus) {
        rhythm = 'ventricular_premature_complexes';
      } else if (acuteAlpha2Bradycardia > 0.25 || (alpha2Ce > 0.6 && antiarrhythmicFactor < 0.2 && anticholinergicCe < 0.1)) {
        rhythm = 'av_block_2nd_degree';
        targetHR = Math.min(speciesInfo.normalVitals.hrMin * 0.6, targetHR);
      } else if (targetHR < speciesInfo.normalVitals.hrMin * 0.8) {
        rhythm = 'sinus_bradycardia';
      } else if (targetHR > speciesInfo.normalVitals.hrMax * 1.25) {
        rhythm = 'sinus_tachycardia';
      } else {
        rhythm = 'sinus';
      }

      if (targetMAP < 50) {
        pulseQuality = 'Fraco / Filiforme';
      } else if (targetMAP > 120) {
        pulseQuality = 'Célere / Saltão';
      } else {
        pulseQuality = 'Normal';
      }
    }

    const finalHR = isAlreadyArrested && !resuscitation.isCPRActive ? 0 : Math.max(0, Math.min(360, Math.round(targetHR)));
    const finalMAP = isAlreadyArrested && !resuscitation.isCPRActive ? 0 : Math.max(0, Math.min(240, Math.round(targetMAP)));
    const pulsePressure = Math.round(finalMAP * 0.45);
    const finalSysBP = isAlreadyArrested && !resuscitation.isCPRActive ? 0 : finalMAP + Math.round(pulsePressure * 0.6);
    const finalDiaBP = isAlreadyArrested && !resuscitation.isCPRActive ? 0 : Math.max(0, finalMAP - Math.round(pulsePressure * 0.4));

    // ----------------------------------------------------
    // 11. BODY TEMPERATURE DYNAMICS
    // ----------------------------------------------------
    let tempC = previousVitals?.bodyTemperatureC || patient.baselineVitals.tempC;
    const thermalLossRate = patient.weightKg < 2.0 ? 0.0011 : patient.weightKg < 8.0 ? 0.0005 : 0.0002;
    tempC -= thermalLossRate * dtSeconds;
    if (equipment.warmingBlanketActive) {
      tempC = Math.min(38.8, tempC + 0.0007 * dtSeconds);
    }

    // ----------------------------------------------------
    // 12. CLINICAL GUEDEL STAGE & PHYSICAL REFLEX ENGINE
    // ----------------------------------------------------
    let guedelStage: VitalSigns['guedelStage'] = 'Estágio I (Voluntário)';
    let eyePosition: EyePosition = 'central_light';
    let palpebralReflex: ReflexStrength = 'brisk';
    let cornealReflex: ReflexStrength = 'brisk';
    let jawTone: JawTone = 'rigid';
    let pedalReflex: ReflexStrength = 'brisk';
    let surgicalTolerancePct = 0;

    if (isAlreadyDead || isAlreadyArrested) {
      guedelStage = 'Estágio IV (Depressão Bulbar / Parada)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'absent';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    } else if (anestheticDepthScore < 22) {
      // Estágio I: Conscious or light tranquilization
      guedelStage = 'Estágio I (Voluntário)';
      eyePosition = 'central_light';
      palpebralReflex = 'brisk';
      cornealReflex = 'brisk';
      jawTone = benzoCe > 0.4 ? 'moderate' : 'rigid';
      pedalReflex = 'brisk';
      surgicalTolerancePct = Math.min(25, surgicalAnalgesiaPct * 0.25);
    } else if (anestheticDepthScore < 48) {
      // Estágio I / II: Deep Neuroleptanalgesia / Sedation (Midazolam + Methadone / Dexmedetomidine)
      guedelStage = 'Estágio II (Excitação/Delírio)';
      eyePosition = 'central_light';
      palpebralReflex = 'moderate';
      cornealReflex = 'brisk';
      jawTone = muscleRelaxationPct > 50 ? 'moderate' : 'rigid';
      pedalReflex = surgicalAnalgesiaPct > 60 ? 'moderate' : 'brisk';
      surgicalTolerancePct = Math.round(25 + surgicalAnalgesiaPct * 0.25);
    } else if (anestheticDepthScore < 68) {
      // Estágio III Plano 1 (Leve / Indução Recém-Instalada):
      // Propofol bolus delivered, mandible relaxed, palpebral sluggish, ventromedial eye rotation!
      guedelStage = 'Estágio III Plano 1 (Leve)';
      eyePosition = 'ventromedial_surgical';
      palpebralReflex = 'sluggish';
      cornealReflex = 'brisk';
      jawTone = 'relaxed_surgical'; // Unlocked mandible for intubation!
      pedalReflex = surgicalAnalgesiaPct > 70 ? 'absent' : 'sluggish';
      surgicalTolerancePct = Math.round(65 + surgicalAnalgesiaPct * 0.20);
    } else if (anestheticDepthScore < 85) {
      // Estágio III Plano 2 (Cirúrgico Ideal):
      // Full surgical anesthesia, absent palpebral, preserved corneal, ventromedial eye, relaxed jaw
      guedelStage = 'Estágio III Plano 2 (Cirúrgico)';
      eyePosition = 'ventromedial_surgical';
      palpebralReflex = 'absent';
      cornealReflex = 'moderate';
      jawTone = 'relaxed_surgical';
      pedalReflex = 'absent';
      surgicalTolerancePct = Math.round(92 + (surgicalAnalgesiaPct / 100) * 8);
    } else if (anestheticDepthScore < 95) {
      // Estágio III Plano 3 (Profundo):
      // Excessive depth, central dilated eye, flaccid tone, sluggish corneal
      guedelStage = 'Estágio III Plano 3 (Profundo)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'sluggish';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    } else {
      // Estágio IV (Depressão Bulbar e Risco Terminal)
      guedelStage = 'Estágio IV (Depressão Bulbar / Parada)';
      eyePosition = 'central_deep_dilated';
      palpebralReflex = 'absent';
      cornealReflex = 'absent';
      jawTone = 'flaccid';
      pedalReflex = 'absent';
      surgicalTolerancePct = 100;
    }

    // ----------------------------------------------------
    // 13. MUCOUS MEMBRANE & PERFUSION
    // ----------------------------------------------------
    let mmColor: MucousMembraneColor = 'pink';
    let crt: CapillaryRefillTime = '1 - 2s (normal)';

    if (isAlreadyDead || isAlreadyArrested) {
      mmColor = 'gray_moribund';
      crt = 'absent';
    } else if (spo2 < 78) {
      mmColor = 'cyanotic';
      crt = '> 3s (poor perfusion)';
    } else if (finalMAP < 45 || patient.pathologyConditions.hypovolemiaSeverity) {
      mmColor = 'pale';
      crt = '> 3s (poor perfusion)';
    } else if (patient.pathologyConditions.sepsisVasodilation) {
      mmColor = 'brick_red';
      crt = '< 1s (hyperdynamic)';
    } else if (alpha2Ce > 0.35) {
      mmColor = 'pale';
      crt = '2 - 3s (sluggish)';
    }

    const tofCount = isFullyParalyzed ? 0 : nmbaCe > 0.12 ? 2 : 4;

    // Blood Gases
    const paCO2 = isAlreadyDead ? 90 : etco2 > 0 ? etco2 + 5.0 : (isRespiratoryArrest ? 75 : 40);
    let lactate = patient.baselineVitals.lactateMmolL;
    if (finalMAP < 50 || hypoxiaSeconds > 25 || isAlreadyArrested) {
      lactate = Math.min(16.0, lactate + (dtSeconds / 60) * 1.8);
    }

    const pH = Math.max(6.70, Math.min(7.60, 7.40 - (paCO2 - 40) * 0.008 - (lactate - 1.0) * 0.045));

    // Detailed clinical autopsy report if dead
    let deathDetailedSummary;
    if (isAlreadyDead) {
      deathDetailedSummary = {
        primaryCause: deathCause || 'Parada Cardiorrespiratória Refratária',
        contributingFactors: [
          `Espécie: ${patient.species.toUpperCase()} (${patient.weightKg} kg, ${ageTotalYears < 1 ? `${patient.ageMonths} meses` : `${patient.ageYears} anos`})`,
          isPediatric ? 'Paciente Pediátrico: Débito cardíaco dependente de FC e reserva funcional restrita' : '',
          isGeriatric ? 'Paciente Geriátrico: Baixa reserva coronariana e menor clearance farmacológico' : '',
          hypoxiaSeconds > 30 ? `Exposição a Hipóxia Grave por ${Math.round(hypoxiaSeconds)} segundos` : '',
          activeInteractions.length > 0 ? `Interações Farmacêuticas Detectadas: ${activeInteractions.map((i) => i.title).join(', ')}` : '',
          isRespiratoryArrest ? `Apneia prévia: ${apneaCause}` : '',
        ].filter(Boolean),
        chronology: [
          `Tempo 00:00: Início do procedimento anestésico para ${patient.name}`,
          isRespiratoryArrest ? `Apneia/Parada respiratória identificada: ${apneaCause}` : '',
          arrestCause ? `Parada Cardiorrespiratória desencadeada: ${arrestCause}` : '',
          asystoleSeconds > 0 ? `Período em colapso/assistolia sem fluxo espontâneo: ${Math.round(asystoleSeconds)}s` : '',
          `Declaração de Óbito Clínico e Encefálico com midríase fixa paralítica e assistolia refratária`,
        ].filter(Boolean),
        autopsyFindings: [
          `Acidose Metabólica e Respiratória Terminal (pH ${pH.toFixed(2)}, PaCO2 ${Math.round(paCO2)} mmHg, Lactato ${lactate.toFixed(1)} mmol/L)`,
          `Isquemia Miocárdica Transmural Global (Índice de Isquemia: ${(ischemiaScore * 100).toFixed(0)}%)`,
          `Mucosas cinzentas/cianóticas com ausência total de perfusão capilar`,
          `Pupilas em midríase paralítica bilateral com abolição de reflexo corneano e palpebral`,
        ],
      };
    }

    const vitals: VitalSigns = {
      heartRate: finalHR,
      cardiacRhythm: rhythm,
      systolicBP: finalSysBP,
      diastolicBP: finalDiaBP,
      meanArterialPressure: finalMAP,
      pulseOximetrySpO2: Math.round(Math.max(0, spo2)),
      respiratoryRate: finalRR,
      tidalVolumeMl: Math.round(tidalVolumeMl),
      minuteVolumeL: Number(minuteVolumeL.toFixed(2)),
      respiratoryPattern: finalRR === 0 ? 'apneic' : finalRR > baselineRR * 1.5 ? 'tachypneic' : 'eupneic',
      etCO2: Math.round(Math.max(0, etco2)),
      fiCO2: Math.round(Math.max(0, fico2)),
      capnogramType,
      bodyTemperatureC: Number(tempC.toFixed(1)),
      arterialBloodGases: {
        pH: Number(pH.toFixed(2)),
        paO2: Math.round(Math.max(0, paO2)),
        paCO2: Math.round(Math.max(0, paCO2)),
        bicarbonate: 22,
        lactate: Number(lactate.toFixed(1)),
        potassium: patient.baselineVitals.potassiumMeqL,
        hematocritPct: patient.baselineVitals.hctPct,
      },
      anestheticDepthScore: Math.round(anestheticDepthScore),
      guedelStage,
      eyePosition,
      palpebralReflex,
      cornealReflex,
      jawTone,
      pedalReflex,
      surgicalTolerancePct: Math.round(surgicalTolerancePct),
      trainOfFourCount: tofCount,
      mucousMembraneColor: mmColor,
      capillaryRefillTime: crt,
      pulseQuality,
      perfusionIndex: Number((Math.max(0, (finalMAP / 85) * (spo2 / 100))).toFixed(2)),

      // Critical & Lethal Organ States
      isRespiratoryArrest,
      respiratoryArrestCause: isRespiratoryArrest ? apneaCause : undefined,
      isCardiacArrest: isAlreadyArrested,
      cardiacArrestCause: arrestCause,
      cardiacArrestType: arrestType,
      isDead: isAlreadyDead,
      deathTimeSeconds: deathTime,
      deathCause: deathCause,
      deathDetailedSummary,
      asystoleSecondsElapsed: Math.round(asystoleSeconds),
      cprSecondsElapsed: Math.round(cprSeconds),
      activeDrugInteractions: activeInteractions,
      myocardialIschemiaScore: Number(ischemiaScore.toFixed(2)),
      hypoxiaExposureSeconds: Math.round(hypoxiaSeconds),
      severeAcidosisRisk: pH < 7.15,
      barotraumaCollapse,
      felineLidocaineToxicity: patient.species === 'feline' && fatalOverdoseTriggered,
      bovineBloatRespiratoryRestriction: patient.species === 'bovine' && fatalOverdoseTriggered,
    };

    return {
      vitals,
      updatedDoses,
      equipmentUpdates: {
        sodaLimeExhaustionPct,
        currentAirwayPressureCmH2O: currentPaw,
        totalFluidsInfusedMl: equipment.totalFluidsInfusedMl + (equipment.isFluidPumpRunning ? (equipment.fluidRateMlPerHour / 3600) * dtSeconds : 0),
      },
    };
  }
}

function drugDefIdArrestType(reason: string): VitalSigns['cardiacArrestType'] {
  if (reason.includes('Fibrilação') || reason.includes('Taquiarritmia')) {
    return 'ventricular_fibrillation';
  }
  if (reason.includes('TV') || reason.includes('Taquicardia Ventricular')) {
    return 'pulseless_ventricular_tachycardia';
  }
  return 'asystole';
}
