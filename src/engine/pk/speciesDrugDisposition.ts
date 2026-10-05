import type { DrugDefinition, SpeciesType } from '../../types/simulator';
import { SPECIES_PK_CALIBRATION } from './speciesPkCalibration.generated';

/**
 * Mechanistic disposition knowledge base.
 *
 * Canine catalog parameters (halfLifeAlpha/Beta, ke0) remain the calibrated
 * reference. Everything here is expressed RELATIVE to the dog, so a species
 * difference measured in the literature is applied once, never on top of an
 * already species-specific catalog value.
 *
 * Main references (consolidated, educational):
 *  - Riviere & Papich, Veterinary Pharmacology and Therapeutics, 10th ed.
 *  - Grimm et al., Veterinary Anesthesia and Analgesia (Lumb & Jones), 6th ed.
 *  - Court MH. Feline drug metabolism and disposition. Vet Clin Small Anim 2013.
 *  - Toutain & Bousquet-Mélou. Plasma clearance / free fraction concepts. JVPT 2004.
 *  - Trepanier LA. Canine NAT deficiency. JVPT 1997.
 */

export type EnzymePathway =
  | 'cyp3a'
  | 'cyp2b_2c'
  | 'cyp2d'
  | 'cyp1a2'
  | 'ugt'
  | 'sult'
  | 'nat'
  | 'esterase'
  | 'hofmann'
  | 'comt_mao';

export const ENZYME_PATHWAYS: EnzymePathway[] = [
  'cyp3a', 'cyp2b_2c', 'cyp2d', 'cyp1a2', 'ugt', 'sult', 'nat', 'esterase', 'hofmann', 'comt_mao',
];

export const ENZYME_PATHWAY_LABELS: Record<EnzymePathway, { label: string; phase: 'Fase I' | 'Fase II' | 'Extra-hepática' }> = {
  cyp3a: { label: 'CYP3A (oxidação)', phase: 'Fase I' },
  cyp2b_2c: { label: 'CYP2B/2C/2A (oxidação)', phase: 'Fase I' },
  cyp2d: { label: 'CYP2D (O-desmetilação)', phase: 'Fase I' },
  cyp1a2: { label: 'CYP1A2 (N-desalquilação)', phase: 'Fase I' },
  ugt: { label: 'UGT (glucuronidação)', phase: 'Fase II' },
  sult: { label: 'SULT (sulfatação)', phase: 'Fase II' },
  nat: { label: 'NAT (acetilação)', phase: 'Fase II' },
  esterase: { label: 'Esterases plasmáticas/teciduais', phase: 'Extra-hepática' },
  hofmann: { label: 'Degradação de Hofmann', phase: 'Extra-hepática' },
  comt_mao: { label: 'COMT/MAO (catecolaminas)', phase: 'Extra-hepática' },
};

/** Michaelis-Menten half-saturation of each pathway in normalized plasma exposure units. */
export const ENZYME_PATHWAY_KM: Record<EnzymePathway, number> = {
  cyp3a: 3.0, cyp2b_2c: 3.2, cyp2d: 2.6, cyp1a2: 2.8, ugt: 2.4, sult: 1.6, nat: 2.0,
  esterase: 12, hofmann: 1000, comt_mao: 8,
};

export interface SpeciesOrganPhysiology {
  hepaticBloodFlowMlMinKg: number;
  renalPlasmaFlowMlMinKg: number;
  gfrMlMinKg: number;
  plasmaAlbuminGdl: number;
  /** Enzyme activity relative to the canine calibration (dog = 1). */
  enzymeActivityVsDog: Record<EnzymePathway, number>;
  /** Absolute/qualitative notes shown to the trainee. */
  metabolicNotes: string[];
}

export const SPECIES_ORGAN_PHYSIOLOGY: Record<SpeciesType, SpeciesOrganPhysiology> = {
  canine: {
    hepaticBloodFlowMlMinKg: 32,
    renalPlasmaFlowMlMinKg: 13,
    gfrMlMinKg: 3.7,
    plasmaAlbuminGdl: 3.1,
    enzymeActivityVsDog: { cyp3a: 1, cyp2b_2c: 1, cyp2d: 1, cyp1a2: 1, ugt: 1, sult: 1, nat: 1, esterase: 1, hofmann: 1, comt_mao: 1 },
    metabolicNotes: [
      'Deficiência congênita de N-acetiltransferases (NAT1/NAT2): acetilação substituída por oxidação.',
      'Glucuronidação e oxidação CYP robustas; referência de calibração do simulador.',
    ],
  },
  feline: {
    hepaticBloodFlowMlMinKg: 36,
    renalPlasmaFlowMlMinKg: 11,
    gfrMlMinKg: 2.8,
    plasmaAlbuminGdl: 3.0,
    enzymeActivityVsDog: { cyp3a: 0.85, cyp2b_2c: 0.7, cyp2d: 0.8, cyp1a2: 0.8, ugt: 0.18, sult: 1.2, nat: 1.5, esterase: 0.9, hofmann: 1, comt_mao: 1 },
    metabolicNotes: [
      'UGT1A6/UGT1A9 pseudogenizados: glucuronidação de fenóis (propofol, morfina, paracetamol) muito lenta.',
      'Sulfatação compensatória com baixa capacidade (saturável).',
      'Maior produção de metabólitos ativos de tramadol (M1) e acúmulo de nordiazepam.',
    ],
  },
  equine: {
    hepaticBloodFlowMlMinKg: 19,
    renalPlasmaFlowMlMinKg: 7,
    gfrMlMinKg: 1.7,
    plasmaAlbuminGdl: 3.2,
    enzymeActivityVsDog: { cyp3a: 1.1, cyp2b_2c: 1.0, cyp2d: 0.9, cyp1a2: 1.0, ugt: 0.9, sult: 1, nat: 1.5, esterase: 0.8, hofmann: 1, comt_mao: 1 },
    metabolicNotes: [
      'Menor fluxo hepático por kg (alometria): fármacos de alta extração dependem do débito cardíaco em decúbito.',
      'Grande produção de norcetamina e acúmulo de MEGX em infusões prolongadas de lidocaína.',
      'Dexmedetomidina com depuração elevada (t½ ~20–30 min).',
    ],
  },
  bovine: {
    hepaticBloodFlowMlMinKg: 28,
    renalPlasmaFlowMlMinKg: 8,
    gfrMlMinKg: 1.9,
    plasmaAlbuminGdl: 3.4,
    enzymeActivityVsDog: { cyp3a: 1.0, cyp2b_2c: 0.9, cyp2d: 0.8, cyp1a2: 0.9, ugt: 1.1, sult: 1, nat: 1.5, esterase: 0.7, hofmann: 1, comt_mao: 1 },
    metabolicNotes: [
      'Fluxo portal elevado (rúmen): efeito de primeira passagem intenso para vias enterais.',
      'Hipersensibilidade α2 farmacodinâmica (receptor α2D), não farmacocinética.',
      'Esterases plasmáticas com menor atividade relativa.',
    ],
  },
};

export type MetabolitePdMode = 'parent' | 'inactive' | 'toxic' | 'handled_by_parent_model';

export interface MetaboliteDefinition {
  name: string;
  /** Fraction of the eliminated parent mass converted into this metabolite. */
  formationFraction: Partial<Record<SpeciesType, number>> & { canine: number };
  /** Elimination half-life (min) in the dog; species multipliers below. */
  halfLifeMin: number;
  halfLifeSpeciesFactor?: Partial<Record<SpeciesType, number>>;
  /** Equi-effective potency relative to the parent (1 = equipotent). */
  potencyVsParent: number;
  pdMode: MetabolitePdMode;
  eliminationRoute: 'renal' | 'hepatic' | 'mixed';
  clinicalNote: string;
}

export interface TherapeuticWindow {
  unit: 'µg/mL' | 'ng/mL';
  /** Concentration bands in the given unit (plasma, total). */
  bands: { label: string; min: number; max: number; tone: 'sub' | 'therapeutic' | 'high' | 'toxic' }[];
}

export interface DrugDispositionProfile {
  /** Canine hepatic extraction ratio (blood). */
  hepaticExtractionRatio: number;
  /** Shares of hepatic intrinsic clearance by pathway (sum ≈ 1). */
  pathways: Partial<Record<EnzymePathway, number>>;
  /**
   * Literature elimination-rate ratio vs dog (k10 species / k10 dog, i.e. CL/V).
   * > 1 faster than dog; < 1 slower. When present it supersedes enzyme prediction.
   */
  speciesEliminationRatio?: Partial<Record<SpeciesType, number>>;
  /** Species unbound fraction overrides (fu). */
  speciesFreeFraction?: Partial<Record<SpeciesType, number>>;
  metabolite?: MetaboliteDefinition;
  therapeuticWindow?: TherapeuticWindow;
  speciesWindowOverrides?: Partial<Record<SpeciesType, TherapeuticWindow>>;
  literatureNote?: string;
}

const W = (unit: TherapeuticWindow['unit'], bands: TherapeuticWindow['bands']): TherapeuticWindow => ({ unit, bands });

export const DRUG_DISPOSITION: Record<string, DrugDispositionProfile> = {
  acepromazine: {
    hepaticExtractionRatio: 0.45, pathways: { cyp2d: 0.5, cyp1a2: 0.3, ugt: 0.2 },
    speciesEliminationRatio: { equine: 1.4 },
    metabolite: { name: 'Hidroxipromazina / sulfóxidos', formationFraction: { canine: 0.6 }, halfLifeMin: 300, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'renal', clinicalNote: 'Conjugados inativos de excreção urinária (detectáveis por dias).' },
    literatureNote: 'Cão t½ ~7 h; equino t½ ~3 h (Ballard 1982).',
  },
  dexmedetomidine: {
    hepaticExtractionRatio: 0.72, pathways: { ugt: 0.5, cyp2b_2c: 0.5 },
    speciesEliminationRatio: { feline: 0.9, equine: 1.8, bovine: 1.0 },
    therapeuticWindow: W('ng/mL', [
      { label: 'subterapêutico', min: 0, max: 0.3, tone: 'sub' },
      { label: 'sedação/analgesia', min: 0.3, max: 3, tone: 'therapeutic' },
      { label: 'vasoconstrição α2B marcada', min: 3, max: 8, tone: 'high' },
      { label: 'bradiarritmia grave', min: 8, max: Infinity, tone: 'toxic' },
    ]),
    literatureNote: 'Cão CL 15–20 mL/min/kg, t½ 40–60 min; equino CL ~50 mL/min/kg, t½ ~20–30 min.',
  },
  xylazine: {
    hepaticExtractionRatio: 0.8, pathways: { cyp2b_2c: 0.6, cyp3a: 0.4 },
    speciesEliminationRatio: { feline: 0.9, equine: 0.75, bovine: 0.85 },
    metabolite: { name: '2,6-xilidina', formationFraction: { canine: 0.3 }, halfLifeMin: 180, potencyVsParent: 0, pdMode: 'toxic', eliminationRoute: 'mixed', clinicalNote: 'Metabólito sem ação α2; marcador de resíduo (carcinogênico potencial em produção).' },
    literatureNote: 'Cão t½ ~30 min; equino ~50 min; bovino ~36 min.',
  },
  detomidine: {
    hepaticExtractionRatio: 0.7, pathways: { cyp2b_2c: 0.6, cyp3a: 0.4 },
    metabolite: { name: 'Carboxi/hidroxidetomidina', formationFraction: { canine: 0.7 }, halfLifeMin: 120, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'renal', clinicalNote: 'Metabólitos inativos de excreção renal.' },
  },
  midazolam: {
    hepaticExtractionRatio: 0.5, pathways: { cyp3a: 0.9, ugt: 0.1 },
    speciesEliminationRatio: { feline: 0.8, equine: 0.45, bovine: 0.8 },
    metabolite: { name: 'α-hidroximidazolam', formationFraction: { canine: 0.6, feline: 0.6, equine: 0.65, bovine: 0.6 }, halfLifeMin: 60, halfLifeSpeciesFactor: { feline: 2.5, equine: 1.5 }, potencyVsParent: 0.3, pdMode: 'parent', eliminationRoute: 'mixed', clinicalNote: 'Ativo (~30%); depende de glucuronidação — acumula em gatos e na insuficiência renal.' },
    therapeuticWindow: W('ng/mL', [
      { label: 'subterapêutico', min: 0, max: 50, tone: 'sub' },
      { label: 'ansiólise/co-indução', min: 50, max: 400, tone: 'therapeutic' },
      { label: 'sedação profunda/ataxia', min: 400, max: 1000, tone: 'high' },
      { label: 'depressão respiratória', min: 1000, max: Infinity, tone: 'toxic' },
    ]),
    literatureNote: 'Cão CL ~27 mL/min/kg, t½ ~77 min; equino t½ 3–5 h.',
  },
  diazepam: {
    hepaticExtractionRatio: 0.15, pathways: { cyp3a: 0.6, cyp2b_2c: 0.4 },
    speciesEliminationRatio: { feline: 0.6, equine: 0.4, bovine: 0.7 },
    metabolite: { name: 'Nordiazepam (desmetildiazepam)', formationFraction: { canine: 0.7, feline: 0.75, equine: 0.7, bovine: 0.65 }, halfLifeMin: 210, halfLifeSpeciesFactor: { feline: 4, equine: 3, bovine: 1.5 }, potencyVsParent: 0.35, pdMode: 'parent', eliminationRoute: 'hepatic', clinicalNote: 'Metabólito ativo de longa duração (gato t½ ~21 h): sedação residual e risco hepatotóxico oral.' },
    therapeuticWindow: W('ng/mL', [
      { label: 'subterapêutico', min: 0, max: 100, tone: 'sub' },
      { label: 'anticonvulsivante/ansiolítico', min: 100, max: 800, tone: 'therapeutic' },
      { label: 'sedação/ataxia', min: 800, max: 2000, tone: 'high' },
      { label: 'depressão SNC', min: 2000, max: Infinity, tone: 'toxic' },
    ]),
    literatureNote: 'Baixa extração (ER ~0,15) e alta ligação proteica: depuração sensível à albumina, pouco ao fluxo.',
  },
  morphine: {
    hepaticExtractionRatio: 0.7, pathways: { ugt: 0.85, sult: 0.15 },
    speciesEliminationRatio: { feline: 0.6, equine: 0.75, bovine: 0.85 },
    metabolite: { name: 'Morfina-6-glucuronídeo (M6G)', formationFraction: { canine: 0.03, feline: 0.0, equine: 0.06, bovine: 0.05 }, halfLifeMin: 120, potencyVsParent: 2.0, pdMode: 'parent', eliminationRoute: 'renal', clinicalNote: 'Cães formam majoritariamente M3G (inativo); gatos quase não glucuronidam (via sulfatação). M6G acumula na insuficiência renal.' },
    therapeuticWindow: W('ng/mL', [
      { label: 'subterapêutico', min: 0, max: 15, tone: 'sub' },
      { label: 'analgesia', min: 15, max: 80, tone: 'therapeutic' },
      { label: 'sedação/disforia', min: 80, max: 200, tone: 'high' },
      { label: 'depressão respiratória', min: 200, max: Infinity, tone: 'toxic' },
    ]),
    literatureNote: 'Cão CL 60–85 mL/min/kg; gato CL ~24 mL/min/kg (Taylor 2001).',
  },
  methadone: {
    hepaticExtractionRatio: 0.55, pathways: { cyp3a: 0.6, cyp2b_2c: 0.4 },
    speciesEliminationRatio: { feline: 0.5, equine: 1.3, bovine: 1.0 },
    metabolite: { name: 'EDDP', formationFraction: { canine: 0.7 }, halfLifeMin: 240, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'mixed', clinicalNote: 'Metabólito pirrolidínico inativo.' },
    therapeuticWindow: W('ng/mL', [
      { label: 'subterapêutico', min: 0, max: 10, tone: 'sub' },
      { label: 'analgesia', min: 10, max: 60, tone: 'therapeutic' },
      { label: 'sedação marcada', min: 60, max: 150, tone: 'high' },
      { label: 'depressão respiratória', min: 150, max: Infinity, tone: 'toxic' },
    ]),
  },
  fentanyl: {
    hepaticExtractionRatio: 0.8, pathways: { cyp3a: 1 },
    speciesEliminationRatio: { feline: 0.6, equine: 0.85 },
    metabolite: { name: 'Norfentanil', formationFraction: { canine: 0.8 }, halfLifeMin: 120, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'renal', clinicalNote: 'Inativo; excreção renal.' },
    therapeuticWindow: W('ng/mL', [
      { label: 'subterapêutico', min: 0, max: 0.8, tone: 'sub' },
      { label: 'analgesia', min: 0.8, max: 3, tone: 'therapeutic' },
      { label: 'MAC-sparing intenso/bradicardia', min: 3, max: 8, tone: 'high' },
      { label: 'apneia/rigidez', min: 8, max: Infinity, tone: 'toxic' },
    ]),
    literatureNote: 'Alta extração (ER ~0,8): depuração cai proporcionalmente ao débito cardíaco; meia-vida contexto-sensível sobe muito com infusões longas.',
  },
  butorphanol: {
    hepaticExtractionRatio: 0.75, pathways: { cyp2b_2c: 0.7, ugt: 0.3 },
    speciesEliminationRatio: { feline: 0.4, equine: 1.8, bovine: 1.1 },
    metabolite: { name: 'Hidroxibutorfanol', formationFraction: { canine: 0.6 }, halfLifeMin: 180, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'renal', clinicalNote: 'Inativo.' },
  },
  buprenorphine: {
    hepaticExtractionRatio: 0.5, pathways: { cyp3a: 0.7, ugt: 0.3 },
    speciesEliminationRatio: { feline: 0.7, equine: 0.9 },
    metabolite: { name: 'Norbuprenorfina', formationFraction: { canine: 0.3 }, halfLifeMin: 300, potencyVsParent: 0.05, pdMode: 'parent', eliminationRoute: 'mixed', clinicalNote: 'Fraco agonista μ com potencial depressor respiratório; pouca passagem pela barreira.' },
  },
  tramadol: {
    hepaticExtractionRatio: 0.6, pathways: { cyp2d: 0.5, cyp3a: 0.4, ugt: 0.1 },
    speciesEliminationRatio: { feline: 0.55, equine: 0.8 },
    metabolite: { name: 'O-desmetiltramadol (M1)', formationFraction: { canine: 0.05, feline: 0.35, equine: 0.15, bovine: 0.12 }, halfLifeMin: 110, halfLifeSpeciesFactor: { feline: 2.6 }, potencyVsParent: 0, pdMode: 'handled_by_parent_model', eliminationRoute: 'mixed', clinicalNote: 'Principal agonista μ. Cães formam pouco M1 (CYP2D15 → M2 inativo); gatos formam e retêm M1 (glucuronidação lenta).' },
  },
  propofol: {
    hepaticExtractionRatio: 0.95, pathways: { ugt: 0.7, sult: 0.1, cyp2b_2c: 0.2 },
    speciesEliminationRatio: { feline: 0.35, equine: 0.9, bovine: 1.0 },
    metabolite: { name: 'Propofol-glucuronídeo / quinóis', formationFraction: { canine: 0.85, feline: 0.4 }, halfLifeMin: 90, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'renal', clinicalNote: 'Inativos. Em gatos, quinóis/fenóis residuais favorecem estresse oxidativo (corpúsculos de Heinz) após doses repetidas.' },
    therapeuticWindow: W('µg/mL', [
      { label: 'subterapêutico', min: 0, max: 1.5, tone: 'sub' },
      { label: 'sedação', min: 1.5, max: 3, tone: 'therapeutic' },
      { label: 'hipnose/manutenção', min: 3, max: 7, tone: 'therapeutic' },
      { label: 'apneia/hipotensão', min: 7, max: 14, tone: 'high' },
      { label: 'depressão cardiovascular grave', min: 14, max: Infinity, tone: 'toxic' },
    ]),
    literatureNote: 'Cão CL 30–60 mL/min/kg (excede fluxo hepático: depuração extra-hepática pulmonar/renal); gato CL 8–15 mL/min/kg.',
  },
  alfaxalone: {
    hepaticExtractionRatio: 0.85, pathways: { cyp2b_2c: 0.5, ugt: 0.3, sult: 0.2 },
    speciesEliminationRatio: { feline: 0.5, equine: 0.8 },
    metabolite: { name: 'Alfaxalona-glucuronídeo/sulfato', formationFraction: { canine: 0.9 }, halfLifeMin: 60, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'renal', clinicalNote: 'Gatos formam predominantemente conjugados sulfatados.' },
    therapeuticWindow: W('µg/mL', [
      { label: 'subterapêutico', min: 0, max: 0.8, tone: 'sub' },
      { label: 'hipnose', min: 0.8, max: 3, tone: 'therapeutic' },
      { label: 'apneia', min: 3, max: Infinity, tone: 'high' },
    ]),
  },
  ketamine: {
    hepaticExtractionRatio: 0.8, pathways: { cyp3a: 0.5, cyp2b_2c: 0.5 },
    speciesEliminationRatio: { feline: 0.75, equine: 1.1, bovine: 1.0 },
    metabolite: { name: 'Norcetamina', formationFraction: { canine: 0.5, feline: 0.6, equine: 0.8, bovine: 0.6 }, halfLifeMin: 120, halfLifeSpeciesFactor: { feline: 1.5 }, potencyVsParent: 0.25, pdMode: 'parent', eliminationRoute: 'mixed', clinicalNote: 'Antagonista NMDA ativo (~20–33% da potência); prolonga analgesia/recuperação. Em gatos é excretada pelos rins (acumula na DRC/obstrução uretral).' },
    therapeuticWindow: W('µg/mL', [
      { label: 'subterapêutico', min: 0, max: 0.1, tone: 'sub' },
      { label: 'analgesia (anti-hiperalgesia)', min: 0.1, max: 0.6, tone: 'therapeutic' },
      { label: 'sedação/dissociação leve', min: 0.6, max: 1.5, tone: 'therapeutic' },
      { label: 'anestesia dissociativa', min: 1.5, max: 6, tone: 'high' },
      { label: 'convulsão/hipertonia', min: 6, max: Infinity, tone: 'toxic' },
    ]),
  },
  etomidate: {
    hepaticExtractionRatio: 0.5, pathways: { esterase: 0.8, cyp3a: 0.2 },
    metabolite: { name: 'Ácido carboxílico do etomidato', formationFraction: { canine: 0.9 }, halfLifeMin: 120, potencyVsParent: 0, pdMode: 'inactive', eliminationRoute: 'renal', clinicalNote: 'Inativo; supressão adrenal (11β-hidroxilase) é efeito do composto original.' },
  },
  thiopental: {
    hepaticExtractionRatio: 0.12, pathways: { cyp2b_2c: 0.8, cyp3a: 0.2 },
    speciesEliminationRatio: { feline: 0.9, equine: 1.4 },
    metabolite: { name: 'Pentobarbital', formationFraction: { canine: 0.05 }, halfLifeMin: 480, potencyVsParent: 0.8, pdMode: 'parent', eliminationRoute: 'hepatic', clinicalNote: 'Fração pequena, porém ativa e de longa duração; galgos (baixa gordura + CYP2B11) recuperam lentamente.' },
    literatureNote: 'Baixa extração: término do efeito depende de redistribuição, não de metabolismo.',
  },
  guaifenesin: { hepaticExtractionRatio: 0.4, pathways: { ugt: 0.7, cyp2b_2c: 0.3 } },
  atipamezole: { hepaticExtractionRatio: 0.6, pathways: { cyp2b_2c: 0.6, ugt: 0.4 }, speciesEliminationRatio: { equine: 1.6 } },
  naloxone: { hepaticExtractionRatio: 0.9, pathways: { ugt: 1 }, speciesEliminationRatio: { feline: 0.8 } },
  flumazenil: { hepaticExtractionRatio: 0.8, pathways: { cyp3a: 0.6, esterase: 0.4 } },
  lipid_emulsion_20: { hepaticExtractionRatio: 0.3, pathways: { esterase: 1 } },
  lidocaine_2pct: {
    hepaticExtractionRatio: 0.75, pathways: { cyp1a2: 0.5, cyp3a: 0.5 },
    speciesEliminationRatio: { feline: 0.65, equine: 0.8, bovine: 0.9 },
    metabolite: { name: 'MEGX (monoetilglicinexilidida)', formationFraction: { canine: 0.6, feline: 0.55, equine: 0.7, bovine: 0.6 }, halfLifeMin: 120, halfLifeSpeciesFactor: { feline: 1.5, equine: 1.6 }, potencyVsParent: 0.4, pdMode: 'parent', eliminationRoute: 'mixed', clinicalNote: 'Ativo (antiarrítmico e neurotóxico ~40–80%); acumula em infusões longas, especialmente em equinos.' },
    therapeuticWindow: W('µg/mL', [
      { label: 'subterapêutico', min: 0, max: 1, tone: 'sub' },
      { label: 'antiarrítmico/analgésico', min: 1, max: 5, tone: 'therapeutic' },
      { label: 'sinais neurológicos (tremor)', min: 5, max: 8, tone: 'high' },
      { label: 'convulsão/cardiotoxicidade', min: 8, max: Infinity, tone: 'toxic' },
    ]),
    speciesWindowOverrides: {
      feline: W('µg/mL', [
        { label: 'subterapêutico', min: 0, max: 0.5, tone: 'sub' },
        { label: 'analgésico', min: 0.5, max: 2, tone: 'therapeutic' },
        { label: 'depressão miocárdica', min: 2, max: 4, tone: 'high' },
        { label: 'cardiotoxicidade/convulsão', min: 4, max: Infinity, tone: 'toxic' },
      ]),
      equine: W('µg/mL', [
        { label: 'subterapêutico', min: 0, max: 0.5, tone: 'sub' },
        { label: 'pró-cinético/analgésico', min: 0.5, max: 2, tone: 'therapeutic' },
        { label: 'fasciculação/ataxia', min: 2, max: 4.5, tone: 'high' },
        { label: 'colapso/convulsão', min: 4.5, max: Infinity, tone: 'toxic' },
      ]),
    },
  },
  bupivacaine_05: {
    hepaticExtractionRatio: 0.4, pathways: { cyp3a: 0.8, cyp1a2: 0.2 },
    therapeuticWindow: W('µg/mL', [
      { label: 'traços sistêmicos', min: 0, max: 1, tone: 'sub' },
      { label: 'absorção regional esperada', min: 1, max: 2, tone: 'therapeutic' },
      { label: 'neurotoxicidade', min: 2, max: 4, tone: 'high' },
      { label: 'cardiotoxicidade (LAST)', min: 4, max: Infinity, tone: 'toxic' },
    ]),
  },
  atropine: { hepaticExtractionRatio: 0.4, pathways: { esterase: 0.5, cyp3a: 0.5 } },
  glycopyrrolate: { hepaticExtractionRatio: 0.1, pathways: { cyp3a: 1 } },
  epinephrine: { hepaticExtractionRatio: 0.6, pathways: { comt_mao: 1 } },
  norepinephrine: { hepaticExtractionRatio: 0.6, pathways: { comt_mao: 1 } },
  dobutamine: { hepaticExtractionRatio: 0.6, pathways: { comt_mao: 0.8, ugt: 0.2 } },
  ephedrine: { hepaticExtractionRatio: 0.2, pathways: { comt_mao: 0.4, cyp2d: 0.6 } },
  atracurium: {
    hepaticExtractionRatio: 0.1, pathways: { hofmann: 0.6, esterase: 0.4 },
    metabolite: { name: 'Laudanosina', formationFraction: { canine: 0.5 }, halfLifeMin: 120, potencyVsParent: 0, pdMode: 'toxic', eliminationRoute: 'mixed', clinicalNote: 'Estimulante do SNC (convulsivante em concentrações altas); acumula em infusões prolongadas e insuficiência hepática/renal.' },
  },
  neostigmine: { hepaticExtractionRatio: 0.2, pathways: { esterase: 1 } },
  sugammadex: { hepaticExtractionRatio: 0.01, pathways: {} },
  sodium_nitroprusside: { hepaticExtractionRatio: 0.1, pathways: {} },
  hydralazine: { hepaticExtractionRatio: 0.6, pathways: { nat: 0.6, cyp2b_2c: 0.4 }, literatureNote: 'Cães não acetilam (NAT ausente): via oxidativa predominante na referência canina.' },
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Allometric/global species scale used only when no literature ratio exists. */
const GENERIC_SPECIES_ELIMINATION_SCALE: Record<SpeciesType, number> = {
  canine: 1,
  feline: 0.9,
  equine: 0.9,
  bovine: 0.82,
};

export const getDispositionProfile = (drugId: string): DrugDispositionProfile | undefined => DRUG_DISPOSITION[drugId];

export const hasLiteratureSpeciesRatio = (drugId: string, species: SpeciesType): boolean =>
  species === 'canine' || DRUG_DISPOSITION[drugId]?.speciesEliminationRatio?.[species] !== undefined;

/** Enzyme-predicted species scale: Σ share × activity(species) / Σ share. */
export const predictPathwaySpeciesFactor = (drugId: string, species: SpeciesType): number => {
  const profile = DRUG_DISPOSITION[drugId];
  if (!profile) return 1;
  const shares = Object.entries(profile.pathways) as [EnzymePathway, number][];
  const totalShare = shares.reduce((sum, [, share]) => sum + share, 0);
  if (totalShare <= 0) return 1;
  const activity = SPECIES_ORGAN_PHYSIOLOGY[species].enzymeActivityVsDog;
  return shares.reduce((sum, [pathway, share]) => sum + share * activity[pathway], 0) / totalShare;
};

let activeCalibration: Record<string, number> = SPECIES_PK_CALIBRATION;

export const setSpeciesPkCalibrationOverride = (
  overrides: Record<string, number> | null,
): void => {
  activeCalibration = overrides ?? SPECIES_PK_CALIBRATION;
};

export type SpeciesEliminationSource = 'calibração canina' | 'literatura' | 'predição enzimática';

/**
 * Species k10 multiplier relative to the canine calibration.
 * Literature ratio → used as-is (with bounded calibration correction).
 * Otherwise → allometric scale × enzyme-pathway prediction, applied only to the
 * hepatic share of clearance so renal/esterase routes are not penalized.
 */
export const getSpeciesEliminationFactor = (
  drug: Pick<DrugDefinition, 'id'>,
  species: SpeciesType,
  hepaticClearanceShare = 0.7,
): { factor: number; source: SpeciesEliminationSource } => {
  if (species === 'canine') return { factor: 1, source: 'calibração canina' };
  const profile = DRUG_DISPOSITION[drug.id];
  const literature = profile?.speciesEliminationRatio?.[species];
  const correction = activeCalibration[`${drug.id}:${species}`] ?? 1;
  if (literature !== undefined) {
    return { factor: clamp(literature * correction, 0.15, 3), source: 'literatura' };
  }
  const pathway = predictPathwaySpeciesFactor(drug.id, species);
  const share = clamp(hepaticClearanceShare, 0, 1);
  const predicted = GENERIC_SPECIES_ELIMINATION_SCALE[species] * ((1 - share) + share * pathway);
  return { factor: clamp(predicted * correction, 0.12, 3), source: 'predição enzimática' };
};

export const getMetaboliteFormationFraction = (metabolite: MetaboliteDefinition, species: SpeciesType): number =>
  metabolite.formationFraction[species] ?? metabolite.formationFraction.canine;

export const getMetaboliteHalfLifeMin = (metabolite: MetaboliteDefinition, species: SpeciesType): number =>
  metabolite.halfLifeMin * (metabolite.halfLifeSpeciesFactor?.[species] ?? 1);

export const getTherapeuticWindow = (drugId: string, species: SpeciesType): TherapeuticWindow | undefined => {
  const profile = DRUG_DISPOSITION[drugId];
  return profile?.speciesWindowOverrides?.[species] ?? profile?.therapeuticWindow;
};

export const classifyConcentration = (
  window: TherapeuticWindow | undefined,
  concentrationInWindowUnit: number | undefined,
): TherapeuticWindow['bands'][number] | undefined => {
  if (!window || concentrationInWindowUnit === undefined || !Number.isFinite(concentrationInWindowUnit)) return undefined;
  return window.bands.find((band) => concentrationInWindowUnit >= band.min && concentrationInWindowUnit < band.max)
    ?? window.bands[window.bands.length - 1];
};
