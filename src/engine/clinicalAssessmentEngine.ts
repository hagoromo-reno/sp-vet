import { ASAStatus, SpeciesType } from '../types/simulator';

export type GenderType = 'Macho' | 'Fêmea' | 'Macho Castrado' | 'Fêmea Castrada' | 'Indeterminado';

export type CardiacCompromiseLevel = 'none' | 'mild' | 'moderate' | 'severe';

export type CardiacAuscultationType =
  | 'normal_sinus'
  | 'sinus_arrhythmia'
  | 'mild_murmur'
  | 'loud_murmur'
  | 'gallop_rhythm'
  | 'arrhythmic_irregular';

export type RespiratoryCompromiseLevel = 'none' | 'mild' | 'moderate' | 'severe';

export type RespiratoryAuscultationType =
  | 'eupneic_clear'
  | 'mild_stridor'
  | 'moderate_crackles_wheezes'
  | 'severe_respiratory_failure';

export type HemorrhageLevel = 'none' | 'mild' | 'moderate' | 'severe';

export interface BiochemicalLabMarkers {
  creatinineMgDl: number;
  ureaMgDl: number;
  sdmaUgDl: number;
  urineSpecificGravity: number;
  oliguriaAnuria?: 'normal' | 'oliguria' | 'anuria';
  altUl: number;
  alpUl: number;
  astUl?: number;
  totalBilirubinMgDl: number;
  albuminGDl: number;
  ptStatus: 'normal' | 'prolonged';
}

export interface ClinicalAssessmentData {
  isEmergency: boolean;
  cardiacCompromise: CardiacCompromiseLevel;
  cardiacAuscultation: CardiacAuscultationType;
  respiratoryCompromise: RespiratoryCompromiseLevel;
  respiratoryAuscultation: RespiratoryAuscultationType;
  hemorrhageSeverity: HemorrhageLevel;
  autoCalculatedAsa: ASAStatus;
  asaManualOverride: boolean;
  asaJustification: string;
}

export interface OrganImpairmentResult {
  severity: number; // 0 to 1 (0% to 100%)
  percent: number; // 0 to 100
  stageLabel: string;
  clinicalSummary: string;
}

export interface SexBiochemicalReference {
  hematocritPct: number;
  creatinineMgDl: number;
  albuminGDl: number;
  ureaMgDl: number;
  sdmaUgDl: number;
  urineSpecificGravity: number;
  altUl: number;
  alpUl: number;
  totalBilirubinMgDl: number;
  explanation: string;
}

/**
 * Retorna valores bioquímicos e hematológicos basais fisiológicos de acordo com a espécie e sexo.
 * Fundamentação clínica:
 * - Machos inteiros possuem níveis androgênicos elevados estimulando a eritropoiese renal (maior Hct: 46-50% vs 40-44% em fêmeas).
 * - Machos possuem maior massa muscular estriada esquelética relativa, produzindo taxa basal de creatinina sérica discretamente superior (1.0-1.2 mg/dL vs 0.7-0.9 mg/dL).
 * - Machos/fêmeas castrados apresentam níveis intermediários decorrentes da supressão gonadal hormonal.
 */
export function getSexBiochemicalReference(
  species: SpeciesType,
  gender: GenderType
): SexBiochemicalReference {
  const isMale = gender.startsWith('Macho');
  const isCastrated = gender.includes('Castrad');

  switch (species) {
    case 'canine': {
      if (isMale && !isCastrated) {
        return {
          hematocritPct: 48,
          creatinineMgDl: 1.1,
          albuminGDl: 3.3,
          ureaMgDl: 28,
          sdmaUgDl: 9,
          urineSpecificGravity: 1.035,
          altUl: 35,
          alpUl: 55,
          totalBilirubinMgDl: 0.2,
          explanation: 'Macho canino inteiro: maior massa muscular esquelética (creatinina basal ~1.1 mg/dL) e estímulo androgênico eritroide (Ht ~48%).',
        };
      }
      if (isMale && isCastrated) {
        return {
          hematocritPct: 45,
          creatinineMgDl: 1.0,
          albuminGDl: 3.2,
          ureaMgDl: 28,
          sdmaUgDl: 9,
          urineSpecificGravity: 1.035,
          altUl: 35,
          alpUl: 50,
          totalBilirubinMgDl: 0.2,
          explanation: 'Macho canino orquiectomizado: massa muscular moderada (creatinina basal ~1.0 mg/dL) e Ht fisiológico de ~45%.',
        };
      }
      if (!isMale && !isCastrated) {
        return {
          hematocritPct: 42,
          creatinineMgDl: 0.8,
          albuminGDl: 3.1,
          ureaMgDl: 25,
          sdmaUgDl: 9,
          urineSpecificGravity: 1.035,
          altUl: 30,
          alpUl: 45,
          totalBilirubinMgDl: 0.2,
          explanation: 'Fêmea canina inteira: menor proporção de massa muscular esquelética (creatinina basal ~0.8 mg/dL) e Ht fisiológico de ~42%.',
        };
      }
      // Fêmea Castrada
      return {
        hematocritPct: 43,
        creatinineMgDl: 0.85,
        albuminGDl: 3.1,
        ureaMgDl: 26,
        sdmaUgDl: 9,
        urineSpecificGravity: 1.035,
        altUl: 32,
        alpUl: 48,
        totalBilirubinMgDl: 0.2,
        explanation: 'Fêmea canina castrada: creatinina basal de ~0.85 mg/dL e hematócrito fisiológico estável de ~43%.',
      };
    }
    case 'feline': {
      if (isMale && !isCastrated) {
        return {
          hematocritPct: 42,
          creatinineMgDl: 1.3,
          albuminGDl: 3.2,
          ureaMgDl: 38,
          sdmaUgDl: 10,
          urineSpecificGravity: 1.045,
          altUl: 45,
          alpUl: 35,
          totalBilirubinMgDl: 0.2,
          explanation: 'Gato macho inteiro: massa muscular compacta com creatinina basal até 1.3 mg/dL e densidade urinária concentrada (>1.040).',
        };
      }
      return {
        hematocritPct: 38,
        creatinineMgDl: 1.0,
        albuminGDl: 3.0,
        ureaMgDl: 34,
        sdmaUgDl: 9,
        urineSpecificGravity: 1.040,
        altUl: 40,
        alpUl: 30,
        totalBilirubinMgDl: 0.2,
        explanation: 'Felino: Ht de 38% e creatinina sérica basal em torno de 1.0 mg/dL.',
      };
    }
    case 'equine':
      return {
        hematocritPct: isMale ? 38 : 35,
        creatinineMgDl: 1.2,
        albuminGDl: 3.1,
        ureaMgDl: 22,
        sdmaUgDl: 8,
        urineSpecificGravity: 1.030,
        altUl: 15,
        alpUl: 120,
        totalBilirubinMgDl: 1.0,
        explanation: 'Equino: Ht típico de 35-38% com bilirrubina basal discretamente mais elevada por jejum.',
      };
    case 'bovine':
    default:
      return {
        hematocritPct: 32,
        creatinineMgDl: 1.1,
        albuminGDl: 3.4,
        ureaMgDl: 20,
        sdmaUgDl: 8,
        urineSpecificGravity: 1.032,
        altUl: 25,
        alpUl: 110,
        totalBilirubinMgDl: 0.3,
        explanation: 'Ruminante: Ht basal fisiológico de 30-34% e excreção fecal expressiva de ureia.',
      };
  }
}

/**
 * Estima o comprometimento da função renal (0.0 a 1.0) baseado nos biomarcadores (Creatinina, Ureia, SDMA, DU, Débito)
 * Integrado aos critérios de estadiamento IRIS (International Renal Interest Society).
 */
export function estimateRenalImpairment(
  labs: Partial<BiochemicalLabMarkers>,
  species: SpeciesType = 'canine',
  gender: GenderType = 'Macho'
): OrganImpairmentResult {
  const ref = getSexBiochemicalReference(species, gender);
  const creatinine = labs.creatinineMgDl ?? ref.creatinineMgDl;
  const urea = labs.ureaMgDl ?? ref.ureaMgDl;
  const sdma = labs.sdmaUgDl ?? ref.sdmaUgDl;
  const usg = labs.urineSpecificGravity ?? ref.urineSpecificGravity;
  const oliguria = labs.oliguriaAnuria ?? 'normal';

  // Base score from Creatinine relative to IRIS staging
  // IRIS Dog thresholds: < 1.4 normal, 1.4-2.8 mild, 2.9-5.0 moderate, > 5.0 severe
  // For cats: < 1.6 normal, 1.6-2.8 mild, 2.9-5.0 moderate, > 5.0 severe
  const normalCreatCutoff = species === 'feline' ? 1.6 : ref.creatinineMgDl * 1.35;
  let scoreFromCreat = 0;

  if (creatinine <= normalCreatCutoff) {
    scoreFromCreat = Math.max(0, (creatinine - ref.creatinineMgDl) / normalCreatCutoff * 0.15);
  } else if (creatinine <= 2.8) {
    scoreFromCreat = 0.20 + ((creatinine - normalCreatCutoff) / (2.8 - normalCreatCutoff)) * 0.25;
  } else if (creatinine <= 5.0) {
    scoreFromCreat = 0.45 + ((creatinine - 2.8) / (5.0 - 2.8)) * 0.30;
  } else {
    scoreFromCreat = 0.75 + Math.min(0.25, ((creatinine - 5.0) / 5.0) * 0.25);
  }

  // SDMA component: sensitive early biomarker (increases when ~25-40% nephrons lost)
  let scoreFromSdma = 0;
  if (sdma > 14) {
    if (sdma <= 17) scoreFromSdma = 0.25;
    else if (sdma <= 25) scoreFromSdma = 0.50;
    else if (sdma <= 45) scoreFromSdma = 0.75;
    else scoreFromSdma = 0.95;
  }

  // Urea/BUN azotemia component
  let scoreFromUrea = 0;
  if (urea > 50) {
    scoreFromUrea = Math.min(0.85, (urea - 50) / 150);
  }

  // Urine Specific Gravity: loss of tubular concentrating ability (isosthenuria 1.008-1.012)
  let usgPenalty = 0;
  if (usg <= 1.012 && usg >= 1.008 && creatinine > normalCreatCutoff) {
    usgPenalty = 0.15; // Isostenúria fixa confirmada com azotemia
  } else if (usg < 1.020 && creatinine > normalCreatCutoff) {
    usgPenalty = 0.08;
  }

  // Oliguria/anuria acute crisis
  let oliguriaMultiplier = 1.0;
  if (oliguria === 'anuria') {
    oliguriaMultiplier = 1.4;
  } else if (oliguria === 'oliguria') {
    oliguriaMultiplier = 1.2;
  }

  // Combined weighted severity: ensure non-oliguric Stage 3 remains within 0.45 - 0.72
  const maxBase = Math.max(scoreFromCreat, scoreFromSdma * 0.80, scoreFromUrea * 0.70);
  const combined = Math.min(creatinine <= 5.0 && oliguria === 'normal' ? 0.72 : 1.0, maxBase + usgPenalty);
  const finalSeverity = Math.min(1.0, Math.max(0.0, combined * oliguriaMultiplier));
  const percent = Math.round(finalSeverity * 100);

  let stageLabel = 'Função Renal Normal';
  let clinicalSummary = `Creatinina ${creatinine.toFixed(1)} mg/dL · SDMA ${sdma} µg/dL · Ureia ${Math.round(urea)} mg/dL. Filtração glomerular preservada.`;

  if (finalSeverity >= 0.75 || oliguria === 'anuria') {
    stageLabel = 'IRIS Estágio 4 (Falência Renal Severa / Uremia)';
    clinicalSummary = `Falência renal avançada/anúria. Perda de >85% da função de eliminação de metabólitos e anestésicos de depuração renal. Risco crítico de hipercalemia e acidose.`;
  } else if (finalSeverity >= 0.45) {
    stageLabel = 'IRIS Estágio 3 (Disfunção Renal Moderada a Grave)';
    clinicalSummary = `Azotemia renal marcante com retenção de escórias. Ajustar volume hídrico, manter PAM > 70 mmHg para perfusão glomerular e evitar nefrotóxicos (ex: AINEs).`;
  } else if (finalSeverity >= 0.20 || scoreFromSdma >= 0.25) {
    stageLabel = 'IRIS Estágio 2 (Disfunção Renal Leve a Moderada)';
    clinicalSummary = `Perda subclínica de néfrons com azotemia leve/SDMA alterado. Capacidade de compensação reduzida sob hipotensão transoperatória.`;
  } else if (finalSeverity >= 0.08) {
    stageLabel = 'IRIS Estágio 1 (Risco Renal / Lesão Não-Azotêmica)';
    clinicalSummary = `Marcadores limítrofes. Requer monitorização estrita de débito urinário e pressão de perfusão renal.`;
  }

  return {
    severity: Number(finalSeverity.toFixed(3)),
    percent,
    stageLabel,
    clinicalSummary,
  };
}

/**
 * Estima o comprometimento da função hepática (0.0 a 1.0) baseado nos biomarcadores (ALT, FA, Bilirrubina, Albumina, TP)
 * Foca não apenas na lesão enzimática (ALT/FA), mas prioritariamente na capacidade de síntese (Albumina, Coagulopatia)
 * e depuração/eliminação biliar (Bilirrubina).
 */
export function estimateHepaticImpairment(
  labs: Partial<BiochemicalLabMarkers>
): OrganImpairmentResult {
  const alt = labs.altUl ?? 35;
  const alp = labs.alpUl ?? 50;
  const bilirubin = labs.totalBilirubinMgDl ?? 0.2;
  const albumin = labs.albuminGDl ?? 3.2;
  const ptStatus = labs.ptStatus ?? 'normal';

  // 1. Enzyme injury (ALT hepatocellular leakage + ALP cholestasis/induction)
  let enzymeScore = 0;
  if (alt > 100) {
    if (alt <= 300) enzymeScore += 0.10;
    else if (alt <= 800) enzymeScore += 0.22;
    else enzymeScore += 0.35; // severa necrose
  }
  if (alp > 150) {
    if (alp <= 400) enzymeScore += 0.08;
    else enzymeScore += 0.15;
  }

  // 2. Synthetic functional failure: Albumin (synthesized uniquely by hepatocytes)
  let syntheticLoss = 0;
  if (albumin < 2.8) {
    if (albumin >= 2.4) syntheticLoss = 0.18;
    else if (albumin >= 1.8) syntheticLoss = 0.38;
    else syntheticLoss = 0.60; // Hipoalbuminemia crítica
  }

  // 3. Coagulation factor synthesis (Factors II, VII, IX, X vitamin K dependent)
  let coagulopathyScore = 0;
  if (ptStatus === 'prolonged') {
    coagulopathyScore = 0.30;
  }

  // 4. Cholestatic / excretory failure (Bilirubin > 1.5-2.0 mg/dL produces clinical jaundice)
  let bilirubinScore = 0;
  if (bilirubin > 0.5) {
    if (bilirubin <= 1.5) bilirubinScore = 0.12;
    else if (bilirubin <= 3.5) bilirubinScore = 0.28;
    else bilirubinScore = 0.45;
  }

  const combined = Math.min(1.0, enzymeScore + syntheticLoss + coagulopathyScore + bilirubinScore);
  const percent = Math.round(combined * 100);

  let stageLabel = 'Função Hepática Preservada';
  let clinicalSummary = `ALT ${Math.round(alt)} U/L · FA ${Math.round(alp)} U/L · Albumina ${albumin.toFixed(1)} g/dL · Bilirrubina ${bilirubin.toFixed(1)} mg/dL. Síntese e biotransformação normais.`;

  if (combined >= 0.70 || (syntheticLoss >= 0.38 && coagulopathyScore > 0)) {
    stageLabel = 'Insuficiência Hepática Grave / Falência de Síntese';
    clinicalSummary = `Déficit crítico de síntese proteica (albumina baixa) e coagulopatia. Redução de até 70-85% na metabolização de fármacos hepato-dependentes (ex: cetamina, benzodiazepínicos, opioides).`;
  } else if (combined >= 0.40) {
    stageLabel = 'Hepatopatia Moderada a Grave';
    clinicalSummary = `Lesão hepática com redução de síntese de albumina ou hiperbilirrubinemia. Meia-vida de fármacos lipofílicos significativamente prolongada; menor ligação a proteínas plasmáticas (fração livre de drogas aumentada).`;
  } else if (combined >= 0.18) {
    stageLabel = 'Hepatopatia Leve a Moderada (Lesão Celular)';
    clinicalSummary = `Elevação enzimática sugestiva de hepatite ou colestase com capacidade de síntese basal ainda compensada. Requer uso de fármacos com depuração extra-hepática/Hofmann (ex: atracúrio).`;
  }

  return {
    severity: Number(combined.toFixed(3)),
    percent,
    stageLabel,
    clinicalSummary,
  };
}

export interface AsaInterpretationInput {
  species: SpeciesType;
  ageYears: number;
  ageMonths: number;
  gender: GenderType;
  cardiacCompromise: CardiacCompromiseLevel;
  cardiacAuscultation: CardiacAuscultationType;
  respiratoryCompromise: RespiratoryCompromiseLevel;
  respiratoryAuscultation: RespiratoryAuscultationType;
  hemorrhageSeverity: HemorrhageLevel;
  renalSeverity: number; // 0 to 1
  hepaticSeverity: number; // 0 to 1
  isEmergency: boolean;
  comorbidities?: {
    sepsis?: boolean;
    gdv?: boolean;
    trauma?: boolean;
    brachycephalic?: boolean;
  };
}

export interface AsaInterpretationOutput {
  calculatedAsa: ASAStatus;
  baseClass: 'I' | 'II' | 'III' | 'IV' | 'V';
  isEmergency: boolean;
  riskScore: number;
  justification: string;
  contributingFactors: string[];
}

/**
 * Interpretação e classificação automática do estado físico ASA (American Society of Anesthesiologists).
 * Classificação canônica:
 * - ASA I: Paciente hígido normal sem doença sistêmica.
 * - ASA II: Doença sistêmica leve sem limitação funcional (ex: geriátrico sem disfunção, sopro leve assintomático, braquicefálico leve).
 * - ASA III: Doença sistêmica moderada a grave que impõe limitação funcional (ex: cardiopata B2 compensado, DRC moderada, anemia).
 * - ASA IV: Doença sistêmica grave que é ameaça constante à vida (ex: choque séptico, torção gástrica, ICC descompensada, hemorragia grave).
 * - ASA V: Paciente moribundo com expectativa de sobrevida < 24 horas com ou sem cirurgia.
 * - Sufixo 'E': Procedimento cirúrgico ou estabilização de Emergência.
 */
export function interpretAsaScore(input: AsaInterpretationInput): AsaInterpretationOutput {
  const factors: string[] = [];
  let baseScore = 1; // 1 = ASA I, 2 = ASA II, 3 = ASA III, 4 = ASA IV, 5 = ASA V

  const totalAgeYears = input.ageYears + input.ageMonths / 12;

  // 1. Age Factor
  if (totalAgeYears < 0.5) {
    baseScore = Math.max(baseScore, 2);
    factors.push('Idade pediátrica (<6 meses: imaturidade renal e reflexo barorreceptor incompleto)');
  } else if (input.species === 'canine' && totalAgeYears >= 10) {
    baseScore = Math.max(baseScore, 2);
    factors.push(`Idade geriátrica (${Math.floor(totalAgeYears)} anos: declínio fisiológico de reserva orgânica)`);
  } else if (input.species === 'feline' && totalAgeYears >= 12) {
    baseScore = Math.max(baseScore, 2);
    factors.push(`Idade geriátrica felina (${Math.floor(totalAgeYears)} anos)`);
  }

  // 2. Cardiac Compromise & Auscultation
  if (input.cardiacCompromise === 'severe' || input.cardiacAuscultation === 'gallop_rhythm' || input.cardiacAuscultation === 'arrhythmic_irregular') {
    baseScore = Math.max(baseScore, 4);
    factors.push('Cardiopatia grave descompensada (ICC C/D, arritmias ventriculares frequentes ou ritmo de galope S3/S4)');
  } else if (input.cardiacCompromise === 'moderate' || input.cardiacAuscultation === 'loud_murmur') {
    baseScore = Math.max(baseScore, 3);
    factors.push('Cardiopatia moderada com remodelamento / sopro holossistólico importante (ICC estágio B2)');
  } else if (input.cardiacCompromise === 'mild' || input.cardiacAuscultation === 'mild_murmur') {
    baseScore = Math.max(baseScore, 2);
    factors.push('Cardiopatia leve assintomática (sopro sistólico grau I-II/VI, ICC B1 sem cardiomegalia)');
  }

  // 3. Respiratory Compromise & Auscultation
  if (input.respiratoryCompromise === 'severe' || input.respiratoryAuscultation === 'severe_respiratory_failure') {
    baseScore = Math.max(baseScore, 4);
    factors.push('Insuficiência respiratória aguda/severa com hipoxemia, padrão paradoxal ou cianose');
  } else if (input.respiratoryCompromise === 'moderate' || input.respiratoryAuscultation === 'moderate_crackles_wheezes') {
    baseScore = Math.max(baseScore, 3);
    factors.push('Comprometimento respiratório moderado (estertores crepitantes úmidos, sibilos ou dispneia)');
  } else if (input.respiratoryCompromise === 'mild' || input.respiratoryAuscultation === 'mild_stridor' || input.comorbidities?.brachycephalic) {
    baseScore = Math.max(baseScore, 2);
    factors.push('Limitação respiratória leve / estridor braquicefálico por estenose nasal e palato mole');
  }

  // 4. Hemorrhage / Hypovolemia / Shock
  if (input.hemorrhageSeverity === 'severe') {
    baseScore = Math.max(baseScore, 4);
    factors.push('Choque hemorrágico descompensado (>30% perda de volemia circulante, colapso pressórico)');
  } else if (input.hemorrhageSeverity === 'moderate') {
    baseScore = Math.max(baseScore, 3);
    factors.push('Hemorragia moderada com repercussão volêmica (taquicardia compensatória, mucosas pálidas)');
  } else if (input.hemorrhageSeverity === 'mild') {
    baseScore = Math.max(baseScore, 2);
    factors.push('Perda sanguínea leve / hipovolemia incipiente');
  }

  // 5. Renal Impairment
  if (input.renalSeverity >= 0.70) {
    baseScore = Math.max(baseScore, 4);
    factors.push(`Comprometimento renal avançado (${Math.round(input.renalSeverity * 100)}% - uremia/falência IRIS 4)`);
  } else if (input.renalSeverity >= 0.35) {
    baseScore = Math.max(baseScore, 3);
    factors.push(`Disfunção renal moderada (${Math.round(input.renalSeverity * 100)}% - azotemia IRIS 2-3)`);
  } else if (input.renalSeverity >= 0.15) {
    baseScore = Math.max(baseScore, 2);
    factors.push(`Alteração renal inicial (${Math.round(input.renalSeverity * 100)}% - lesão renal subclínica)`);
  }

  // 6. Hepatic Impairment
  if (input.hepaticSeverity >= 0.65) {
    baseScore = Math.max(baseScore, 4);
    factors.push(`Insuficiência hepática grave (${Math.round(input.hepaticSeverity * 100)}% - hipoalbuminemia/coagulopatia)`);
  } else if (input.hepaticSeverity >= 0.35) {
    baseScore = Math.max(baseScore, 3);
    factors.push(`Hepatopatia moderada (${Math.round(input.hepaticSeverity * 100)}% - redução da capacidade sintética)`);
  } else if (input.hepaticSeverity >= 0.18) {
    baseScore = Math.max(baseScore, 2);
    factors.push(`Lesão hepática leve (${Math.round(input.hepaticSeverity * 100)}% - elevação enzimática)`);
  }

  // 7. Critical Comorbidities
  if (input.comorbidities?.gdv) {
    baseScore = Math.max(baseScore, 4);
    factors.push('Síndrome Dilatação-Vólvulo Gástrico (risco de choque compressivo e arritmias)');
  }
  if (input.comorbidities?.sepsis) {
    baseScore = Math.max(baseScore, 4);
    factors.push('Sepse generalizada com vasodilatação distributiva e hipotensão refratária');
  }
  if (input.comorbidities?.trauma && input.hemorrhageSeverity === 'severe') {
    baseScore = Math.max(baseScore, 4);
    factors.push('Politrauma com lesão multissistêmica');
  }

  // Check for Moribund (ASA V) criteria: extreme shock + multiple organ collapse
  if (
    (input.hemorrhageSeverity === 'severe' && input.cardiacCompromise === 'severe') ||
    (input.renalSeverity >= 0.85 && input.hepaticSeverity >= 0.70 && input.hemorrhageSeverity === 'severe')
  ) {
    baseScore = 5;
    factors.push('Condição moribunda extrema: expectativa de sobrevida inferior a 24 horas');
  }

  const baseClassMap: Record<number, 'I' | 'II' | 'III' | 'IV' | 'V'> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
  };

  const baseClass = baseClassMap[baseScore] || 'I';
  const calculatedAsa: ASAStatus = (input.isEmergency ? `${baseClass}-E` : baseClass) as ASAStatus;

  let justification = '';
  if (baseScore === 1) {
    justification = input.isEmergency
      ? 'Paciente hígido sem patologias sistêmicas prévias, porém agendado para procedimento em caráter de Urgência/Emergência (ASA I-E).'
      : 'Paciente hígido sem alterações sistêmicas. Exames laboratoriais e ausculta cardiopulmonar dentro dos padrões fisiológicos (ASA I Padrão Eletivo).';
  } else {
    justification = `Classificado como ASA ${calculatedAsa} devido a: ${factors.join('; ')}.${input.isEmergency ? ' Cirurgia em caráter de emergência.' : ''}`;
  }

  return {
    calculatedAsa,
    baseClass,
    isEmergency: input.isEmergency,
    riskScore: baseScore,
    justification,
    contributingFactors: factors,
  };
}
