import { PatientProfile, SpeciesCellularParticularity, SpeciesType } from '../types/simulator';

export interface SpeciesCellularConfig {
  species: SpeciesType;
  cardiacOutputMlKgMin: number; // resting cardiac index used to scale SV/SVR across body sizes
  muOpioidSensitivityFactor: number;
  kappaOpioidSensitivityFactor: number;
  gabaSensitivityFactor: number;
  nmdaSensitivityFactor: number;
  atropineResponseFactor: number;
  restingVagalTone: number; // 0 to 1
  splenicContractionReserve: number; // 0 to 0.25 (fraction of RBC auto-transfused during adrenergic stress)
  alpha2DReceptorExpression: boolean; // Bovine 10x hypersensitivity to alpha-2
  alpha2SensitivityFactor: number; // multiplier on alpha-2 affinity
  ugt1a6Deficiency: boolean; // Feline lack of UGT1A6 glucuronidation
  glucuronidationClearanceMultiplier: number;
  laryngealReflexSensitivity: number; // 1.0 normal, 4.0 feline laryngospasm
  lidocaineIvCardiotoxicityThresholdMgKg: number; // mg/kg IV safe limit
  criticalMapThresholdMmHg: number; // MAP required to avoid ischemic myopathy
  recumbencyPulmonaryShuntBasePct: number; // Qs/Qt (%) in recumbency
  ruminalFermentationGasRateLPerHour: number; // Bovine gas accumulation rate
  continuousSalivaProductionLPerDay: number; // Bovine continuous salivation
  atropineSalivaryContraindication: boolean; // Contraindicated due to inspissated mucus plugs
  opioidManiaSusceptibility: boolean; // Feline morphine mania / hyperthermia
  normalPhysiologicalSecondDegreeAVBlock: boolean; // Equine physiological Mobitz I at rest
  normalPhysiologicalSinusArrhythmia: boolean; // Canine respiratory sinus arrhythmia
}

export const SPECIES_CELLULAR_CONFIGS: Record<SpeciesType, SpeciesCellularConfig> = {
  canine: {
    species: 'canine',
    cardiacOutputMlKgMin: 110,
    muOpioidSensitivityFactor: 1.05,
    kappaOpioidSensitivityFactor: 1,
    gabaSensitivityFactor: 1,
    nmdaSensitivityFactor: 1,
    atropineResponseFactor: 1,
    restingVagalTone: 0.75, // Elevated resting vagal tone
    splenicContractionReserve: 0.16, // Contraction of rich splenic capsule releases 15-20% hematocrit
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 1.0,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1.0,
    laryngealReflexSensitivity: 1.0,
    lidocaineIvCardiotoxicityThresholdMgKg: 8.0,
    criticalMapThresholdMmHg: 60,
    recumbencyPulmonaryShuntBasePct: 5.0,
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 0.5,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: false,
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: true,
  },
  feline: {
    species: 'feline',
    cardiacOutputMlKgMin: 140,
    muOpioidSensitivityFactor: 1,
    kappaOpioidSensitivityFactor: 0.95,
    gabaSensitivityFactor: 1.05,
    nmdaSensitivityFactor: 1,
    atropineResponseFactor: 1,
    restingVagalTone: 0.30,
    splenicContractionReserve: 0.05,
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 1.1,
    ugt1a6Deficiency: true, // Gene UGT1A6 pseudogenized (inability to rapidly conjugate phenols, benzoic acid)
    glucuronidationClearanceMultiplier: 0.18, // 82% slower glucuronidation clearance
    laryngealReflexSensitivity: 4.5, // Violent laryngeal adductor reflex (laryngospasm risk without topical lidocaine)
    lidocaineIvCardiotoxicityThresholdMgKg: 1.2, // Extremely narrow window! > 1.2 mg/kg IV causes direct myocardial depression
    criticalMapThresholdMmHg: 60,
    recumbencyPulmonaryShuntBasePct: 4.0,
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 0.15,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: true, // High mu agonists provoke CNS excitation, hyperthermia, mydriasis
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: false,
  },
  equine: {
    species: 'equine',
    cardiacOutputMlKgMin: 75,
    muOpioidSensitivityFactor: 0.85,
    kappaOpioidSensitivityFactor: 1.1,
    gabaSensitivityFactor: 0.95,
    nmdaSensitivityFactor: 1,
    atropineResponseFactor: 1,
    restingVagalTone: 0.90, // Extremely high resting vagal tone (resting HR 28-40 bpm)
    splenicContractionReserve: 0.22, // Massive splenic reservoir (can raise HCT from 32% to 50% under stress)
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 1.0,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1.0,
    laryngealReflexSensitivity: 0.8,
    lidocaineIvCardiotoxicityThresholdMgKg: 5.0,
    criticalMapThresholdMmHg: 70, // STRICTLY >= 70 mmHg required to prevent post-anesthetic compartment myopathy
    recumbencyPulmonaryShuntBasePct: 26.0, // Visceral compression on diaphragm causes severe V/Q mismatch and atelectasis
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 12.0,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: true,
    normalPhysiologicalSecondDegreeAVBlock: true, // Mobitz I (Wenckebach) is normal in healthy resting horse
    normalPhysiologicalSinusArrhythmia: false,
  },
  bovine: {
    species: 'bovine',
    cardiacOutputMlKgMin: 95,
    muOpioidSensitivityFactor: 0.9,
    kappaOpioidSensitivityFactor: 1,
    gabaSensitivityFactor: 1,
    nmdaSensitivityFactor: 0.95,
    atropineResponseFactor: 0.8,
    restingVagalTone: 0.45,
    splenicContractionReserve: 0.08,
    alpha2DReceptorExpression: true, // Specific alpha-2D subtype in ruminant brainstem
    // The roughly 10-fold clinical sensitivity is already represented by the
    // species-specific dose ranges. This residual factor models response at an
    // equi-effective normalized dose without applying the difference twice.
    alpha2SensitivityFactor: 1.35,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1.1,
    laryngealReflexSensitivity: 1.4,
    lidocaineIvCardiotoxicityThresholdMgKg: 5.0,
    criticalMapThresholdMmHg: 65,
    recumbencyPulmonaryShuntBasePct: 20.0, // Huge rumen pushes against diaphragm in dorsal/lateral recumbency
    ruminalFermentationGasRateLPerHour: 40.0, // Continuous 30-50 L/h gas accumulation without eructation
    continuousSalivaProductionLPerDay: 75.0, // Profuse 50-100 L/day secretion of alkaline saliva
    atropineSalivaryContraindication: true, // Anticholinergics cause thick, viscous mucus plugs that asphyxiate
    opioidManiaSusceptibility: false,
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: false,
  },
  rabbit: {
    species: 'rabbit',
    cardiacOutputMlKgMin: 240,
    muOpioidSensitivityFactor: 0.9,
    kappaOpioidSensitivityFactor: 1,
    gabaSensitivityFactor: 1.05,
    nmdaSensitivityFactor: 1.05,
    atropineResponseFactor: 0.2,
    restingVagalTone: 0.20,
    splenicContractionReserve: 0.04,
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 0.8,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1.4,
    laryngealReflexSensitivity: 3.5,
    lidocaineIvCardiotoxicityThresholdMgKg: 4.0,
    criticalMapThresholdMmHg: 55,
    recumbencyPulmonaryShuntBasePct: 6.0,
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 0.2,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: false,
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: false,
  },
  avian: {
    species: 'avian',
    cardiacOutputMlKgMin: 320,
    muOpioidSensitivityFactor: 0.8,
    kappaOpioidSensitivityFactor: 1.15,
    gabaSensitivityFactor: 1,
    nmdaSensitivityFactor: 0.95,
    atropineResponseFactor: 0.85,
    restingVagalTone: 0.15,
    splenicContractionReserve: 0.02,
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 0.7,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1.8,
    laryngealReflexSensitivity: 2.0,
    lidocaineIvCardiotoxicityThresholdMgKg: 3.0,
    criticalMapThresholdMmHg: 60,
    recumbencyPulmonaryShuntBasePct: 4.0,
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 0.05,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: false,
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: false,
  },
};

export class SpeciesPhysiologyEngine {
  /**
   * Evaluates active species-specific particularities based on patient, current vitals, doses, and elapsed time.
   */
  public static evaluateParticularities(
    patient: PatientProfile,
    simTimeSeconds: number,
    currentMAP: number,
    currentCeAlpha2: number,
    currentCeOpioid: number,
    currentCeLidocaine: number,
    currentCeInhalant: number,
    isRecumbent: boolean,
    isAtropineAdministered: boolean
  ): {
    particularities: SpeciesCellularParticularity[];
    shuntFractionPct: number;
    effectiveAlpha2Drive: number;
    myopathyIschemiaRiskScore: number;
    ruminalBloatSeverity: number; // 0 to 1
  } {
    const config = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const particularities: SpeciesCellularParticularity[] = [];

    let shuntFractionPct = 5.0;
    let effectiveAlpha2Drive = currentCeAlpha2;
    let myopathyIschemiaRiskScore = 0;
    let ruminalBloatSeverity = 0;

    // ----------------------------------------------------
    // 1. CANINE PARTICULARITIES
    // ----------------------------------------------------
    if (patient.species === 'canine') {
      particularities.push({
        id: 'canine_vagotonia',
        name: 'Tônus Vagal Acentuado & Arritmia Sinusal',
        species: 'canine',
        severity: 'info',
        mechanism: 'Alta densidade de receptores M2 no nó sinoatrial com modulação respiratória do efluxo vagal.',
        clinicalImpact: 'Variação rítmica fisiológica da FC com a ventilação; resposta intensa a opioides e excelente resposta a anticolinérgicos.',
        isActive: true,
        intensity: 0.75,
      });

      if (currentCeOpioid > 0.4) {
        particularities.push({
          id: 'canine_opioid_bradycardia',
          name: 'Bradicardia Vagal Mediada por Opioides',
          species: 'canine',
          severity: 'warning',
          mechanism: 'Estimulação de núcleos vagais bulbares por agonistas mu puros promovendo cronotropismo negativo.',
          clinicalImpact: 'Bradicardia responsiva a atropina/glicopirrolato sem redução primária do volume sistólico.',
          isActive: true,
          intensity: Math.min(1.0, currentCeOpioid),
        });
      }
    }

    // ----------------------------------------------------
    // 2. FELINE PARTICULARITIES
    // ----------------------------------------------------
    if (patient.species === 'feline') {
      particularities.push({
        id: 'feline_ugt1a6_deficit',
        name: 'Déficit Congênito de Glicuronidação (Gene UGT1A6 Pseudogenizado)',
        species: 'feline',
        severity: 'warning',
        mechanism: 'Incapacidade funcional da isoenzima microssomal UGT1A6 para conjugar compostos fenólicos e carboxílicos.',
        clinicalImpact: 'Metabolização lenta de propofol (risco de corpúsculos de Heinz em infusões prolongadas), toxicidade por paracetamol e fenois.',
        isActive: true,
        intensity: 0.90,
      });

      if (currentCeLidocaine > 0.15) {
        const toxRatio = currentCeLidocaine / 0.5;
        const isCritical = currentCeLidocaine > 0.45;
        particularities.push({
          id: 'feline_lidocaine_sensitivity',
          name: isCritical ? 'TOXICIDADE CARDÍACA AGUDA POR LIDOCAÍNA EM FELINO' : 'Alta Sensibilidade Cardíaca a Anestésicos Locais IV',
          species: 'feline',
          severity: isCritical ? 'lethal' : 'danger',
          mechanism: 'Sensibilidade miocárdica acentuada com bloqueio dos canais de sódio NaV1.5 e influxo de cálcio dependente.',
          clinicalImpact: isCritical
            ? 'Depressão inotrópica fulminante, colapso de PAM, bradicardia intratável e parada em AESP/assistolia.'
            : 'Estreita margem de segurança; evitar infusão IV rotineira de lidocaína em gatos.',
          isActive: true,
          intensity: Math.min(1.0, toxRatio),
        });
      }

      if (currentCeOpioid > 0.7 && currentCeAlpha2 < 0.1) {
        particularities.push({
          id: 'feline_morphine_mania',
          name: 'Risco de Disforia / Hipertermia por Opioide ("Mania Mórfica")',
          species: 'feline',
          severity: 'warning',
          mechanism: 'Ativação assimétrica de receptores mu e kappa em vias dopaminérgicas e centro termorregulador hipotalâmico.',
          clinicalImpact: 'Midríase fixa, agitação psicomotora, desorientação e hipertermia pós-operatória.',
          isActive: true,
          intensity: 0.65,
        });
      }
    }

    // ----------------------------------------------------
    // 3. EQUINE PARTICULARITIES
    // ----------------------------------------------------
    if (patient.species === 'equine') {
      // Physiological 2nd degree AV block
      particularities.push({
        id: 'equine_normal_av_block',
        name: 'Tônus Vagal Basal Extremo (BAV de 2º Grau Fisiológico)',
        species: 'equine',
        severity: 'info',
        mechanism: 'Hipertonia vagal basal sobre o nó AV, produzindo pausas e bloqueio Mobitz Tipo I (Wenckebach) benigno em repouso.',
        clinicalImpact: 'Fisiológico em repouso; reverte imediatamente com atropina ou estímulo simpático.',
        isActive: true,
        intensity: 0.85,
      });

      // Strict MAP >= 70 mmHg requirement
      if (currentMAP < config.criticalMapThresholdMmHg) {
        const mapDeficit = config.criticalMapThresholdMmHg - currentMAP;
        myopathyIschemiaRiskScore = Math.min(1.0, (mapDeficit / 25) * (simTimeSeconds > 60 ? 1.0 : 0.4));
        particularities.push({
          id: 'equine_compartment_myopathy',
          name: 'RISCO CRÍTICO: Isquemia Muscular & Miopatia Pós-Anestésica (PAM < 70 mmHg)',
          species: 'equine',
          severity: currentMAP < 55 ? 'lethal' : 'danger',
          mechanism: 'Colapso da pressão capilar de perfusão nos compartimentos musculares profundos dependentes (tríceps/glúteo).',
          clinicalImpact: 'Rabdomiólise severa, liberação maciça de mioglobina, paralisia de nervo radial e incapacidade de apoio de pé na recuperação.',
          isActive: true,
          intensity: myopathyIschemiaRiskScore,
        });
      }

      // Massive V/Q Shunt due to visceral compression
      if (isRecumbent) {
        shuntFractionPct = config.recumbencyPulmonaryShuntBasePct + (currentCeInhalant > 0.8 ? 6.0 : 0);
        particularities.push({
          id: 'equine_vq_shunt',
          name: 'Shunt Intrapulmonar Massivo por Compressão Visceral (Atelectasia V/Q)',
          species: 'equine',
          severity: 'warning',
          mechanism: '150+ kg de vísceras abdominais comprimem o hemidiafragma em decúbito, colapsando alvéolos dependentes.',
          clinicalImpact: `Shunt direito-esquerdo estimado em ${shuntFractionPct.toFixed(0)}% (Qs/Qt), limitando a PaO2 arterial mesmo a 100% de O2.`,
          isActive: true,
          intensity: shuntFractionPct / 40.0,
        });
      }
    }

    // ----------------------------------------------------
    // 4. BOVINE PARTICULARITIES
    // ----------------------------------------------------
    if (patient.species === 'bovine') {
      // 10x Alpha-2 Hypersensitivity
      effectiveAlpha2Drive = currentCeAlpha2 * config.alpha2SensitivityFactor;
      particularities.push({
        id: 'bovine_alpha2d_hypersensitivity',
        name: 'Hiper-sensibilidade a Alfa-2 (Isoforma Adrenérgica alfa-2D)',
        species: 'bovine',
        severity: currentCeAlpha2 > 0.15 ? 'lethal' : 'warning',
        mechanism: 'Expressão da isoforma alfa-2D no SNC com afinidade 10x maior pela xilazina do que equinos.',
        clinicalImpact: 'Exige estritamente 1/10 da dose equina (0.05 mg/kg vs 0.5-1.0 mg/kg). Doses equinas causam colapso cardiovascular e edema pulmonar agudo.',
        isActive: true,
        intensity: Math.min(1.0, currentCeAlpha2 * 4.0),
      });

      // Ruminal Bloat / Tympanism Dynamics
      if (isRecumbent && simTimeSeconds > 20) {
        // Continuous gas accumulation without eructation
        const bloatTimeMin = simTimeSeconds / 60.0;
        ruminalBloatSeverity = Math.min(1.0, bloatTimeMin * 0.045); // progressive accumulation
        shuntFractionPct = config.recumbencyPulmonaryShuntBasePct + ruminalBloatSeverity * 14;

        if (ruminalBloatSeverity > 0.25) {
          particularities.push({
            id: 'bovine_ruminal_tympanism',
            name: 'Timpanismo Ruminal Agudo & Restrição Diafragmática',
            species: 'bovine',
            severity: ruminalBloatSeverity > 0.65 ? 'danger' : 'warning',
            mechanism: 'Fermentação ruminal contínua (30-50 L/h de gás) sem eructação, comprimindo diafragma e veia cava caudal.',
            clinicalImpact: 'Hipoventilação restritiva, retenção severa de CO2 e redução do retorno venoso (queda do débito cardíaco).',
            isActive: true,
            intensity: ruminalBloatSeverity,
          });
        }
      }

      // Profuse continuous salivation & Atropine Contraindication
      particularities.push({
        id: 'bovine_saliva_atropine_warning',
        name: isAtropineAdministered ? 'ALERTA: Atropina em Ruminante (Rolhas Mucosas Obstrutivas)' : 'Salivação Alcalina Contínua & Risco de Regurgitação Passiva',
        species: 'bovine',
        severity: isAtropineAdministered ? 'danger' : 'info',
        mechanism: 'Secreção salivar de até 75 L/dia não é inibida por anticolinérgicos; atropina apenas aumenta a viscosidade.',
        clinicalImpact: isAtropineAdministered
          ? 'Saliva espessa e aderente forma rolhas mucosas no tubo endotraqueal com risco de asfixia aguda.'
          : 'Manter via aérea vedada com cuff insuflado e cabeça posicionada declive para drenagem livre.',
        isActive: true,
        intensity: isAtropineAdministered ? 0.95 : 0.60,
      });
    }

    return {
      particularities,
      shuntFractionPct,
      effectiveAlpha2Drive,
      myopathyIschemiaRiskScore,
      ruminalBloatSeverity,
    };
  }
}
