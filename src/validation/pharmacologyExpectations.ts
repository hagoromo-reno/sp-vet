import { DoseLevel, TraceMetrics } from './simulationHarness';
import { SpeciesType } from '../types/simulator';

export type ValidationMetric = keyof Pick<
  TraceMetrics,
  | 'maxSedation'
  | 'maxHypnosis'
  | 'maxDissociation'
  | 'maxAnalgesia'
  | 'maxMuscleRelaxation'
  | 'maxRespiratoryDepression'
  | 'maxLocalBlockade'
  | 'maxSystemicNaVBlockade'
  | 'maxPotassium'
  | 'maxBicarbonate'
  | 'maxHematocrit'
>;

export interface SignalExpectation {
  metric: ValidationMetric;
  minimum?: Partial<Record<DoseLevel, number>>;
  maximum?: Partial<Record<DoseLevel, number>>;
}

export interface RelativeTrendExpectation {
  metric: 'heartRate' | 'map' | 'respiratoryRate';
  direction: 'increase' | 'decrease' | 'preserve';
  /** Smallest clinically visible fractional change at the typical dose. */
  minimumFraction?: number;
  /** Largest accepted fractional change for a preservation expectation. */
  toleranceFraction?: number;
  excludeSpecies?: SpeciesType[];
}

export interface MedicationValidationSpec {
  drugId: string;
  clinicalClass: string;
  mechanism: string;
  expectedDoseResponse: Record<DoseLevel, string>;
  signals: SignalExpectation[];
  relativeTrends?: RelativeTrendExpectation[];
  context: 'healthy' | 'reversal' | 'pathology' | 'toxicology';
  speciesNotes?: Partial<Record<SpeciesType, string>>;
  evidence: string[];
}

const dose = (min: string, typical: string, max: string): Record<DoseLevel, string> => ({ min, typical, max });

/**
 * Executable clinical contract for every item in the medication catalog.
 * Numeric bands are intentionally broad: this validates direction, separation of
 * effect axes and clinically meaningful magnitude, not a claim of patient-level
 * predictive accuracy.
 */
export const PHARMACOLOGY_EXPECTATIONS: MedicationValidationSpec[] = [
  {
    drugId: 'acepromazine',
    clinicalClass: 'Fenotiazínico tranquilizante',
    mechanism: 'Antagonismo D2 central e alfa-1 periférico, com contribuição H1/5-HT2; tranquiliza e causa venodilatação/hipotensão, sem analgesia ou anestesia geral.',
    expectedDoseResponse: dose('Tranquilização leve e discreta redução pressórica.', 'Tranquilização moderada, paciente ainda despertável; redução de PAM/débito.', 'Platô de tranquilização e maior risco hemodinâmico, sem converter-se em hipnose.'),
    signals: [
      { metric: 'maxSedation', minimum: { min: 0.08, typical: 0.25, max: 0.30 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.06, typical: 0.06, max: 0.06 } },
      { metric: 'maxHypnosis', maximum: { min: 0.16, typical: 0.18, max: 0.22 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'decrease', minimumFraction: 0.04 }],
    context: 'healthy',
    evidence: ['PMID:32362549', 'PMID:19397778'],
  },
  {
    drugId: 'dexmedetomidine',
    clinicalClass: 'Agonista alfa-2 altamente seletivo',
    mechanism: 'Ativação alfa-2 pré-sináptica reduz liberação de noradrenalina; produz sedação, analgesia, bradicardia e resposta vascular bifásica.',
    expectedDoseResponse: dose('Sedação/analgesia leves com bradicardia mensurável.', 'Sedação profunda despertável, analgesia e bradicardia.', 'Próximo do teto sedativo; bradicardia/baixo débito e bloqueio AV mais prováveis.'),
    signals: [
      { metric: 'maxSedation', minimum: { min: 0.16, typical: 0.38, max: 0.46 } },
      { metric: 'maxAnalgesia', minimum: { min: 0.08, typical: 0.22, max: 0.30 } },
    ],
    relativeTrends: [{ metric: 'heartRate', direction: 'decrease', minimumFraction: 0.08 }],
    context: 'healthy',
    speciesNotes: { bovine: 'Ruminantes respondem a doses muito menores; evitar aplicar multiplicador de sensibilidade duas vezes.', feline: 'Bradicardia e vasoconstrição podem ser marcantes mesmo com oxigenação preservada.' },
    evidence: ['PMID:40731195', 'PMID:36058821'],
  },
  {
    drugId: 'xylazine',
    clinicalClass: 'Agonista alfa-2',
    mechanism: 'Agonismo alfa-2 central/periférico causa sedação, analgesia visceral, relaxamento e bradicardia; em ruminantes pode causar hipoxemia e alterações metabólicas.',
    expectedDoseResponse: dose('Sedação leve e queda de FC.', 'Sedação/analgesia moderadas e relaxamento.', 'Sedação intensa com maior risco de BAV, baixo débito e depressão respiratória.'),
    signals: [
      { metric: 'maxSedation', minimum: { min: 0.15, typical: 0.34, max: 0.42 } },
      { metric: 'maxAnalgesia', minimum: { min: 0.08, typical: 0.20, max: 0.27 } },
    ],
    relativeTrends: [{ metric: 'heartRate', direction: 'decrease', minimumFraction: 0.08 }],
    context: 'healthy',
    speciesNotes: { bovine: 'Faixa cadastrada já é aproximadamente um décimo da equina; deve produzir forte resposta sem morte determinística na faixa terapêutica.' },
    evidence: ['PMID:9885970', 'PMID:32166760'],
  },
  {
    drugId: 'detomidine',
    clinicalClass: 'Agonista alfa-2 de longa ação',
    mechanism: 'Agonismo alfa-2 reduz tônus simpático e transmissão nociceptiva, especialmente útil para sedação/analgesia visceral de grandes animais.',
    expectedDoseResponse: dose('Sedação e analgesia discretas.', 'Sedação/analgesia fortes com relaxamento.', 'Resposta próxima ao teto e risco cardiovascular aumentado.'),
    signals: [
      { metric: 'maxSedation', minimum: { min: 0.18, typical: 0.38, max: 0.46 } },
      { metric: 'maxAnalgesia', minimum: { min: 0.12, typical: 0.26, max: 0.34 } },
    ],
    relativeTrends: [{ metric: 'heartRate', direction: 'decrease', minimumFraction: 0.08 }],
    context: 'healthy',
    speciesNotes: { equine: 'Uso primário no equino; alto tônus vagal torna BAV de segundo grau plausível.' },
    evidence: ['PMID:34475584'],
  },
  {
    drugId: 'midazolam',
    clinicalClass: 'Benzodiazepínico',
    mechanism: 'Modulador alostérico positivo GABA-A dependente de GABA; causa ansiólise/relaxamento e potencializa hipnóticos, mas não fornece analgesia.',
    expectedDoseResponse: dose('Relaxamento discreto; possível pouca sedação em adulto hígido.', 'Relaxamento importante e sedação leve/moderada.', 'Maior relaxamento, com teto por depender de GABA; não deve causar anestesia cirúrgica isoladamente.'),
    signals: [
      { metric: 'maxMuscleRelaxation', minimum: { min: 0.18, typical: 0.35, max: 0.44 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
      { metric: 'maxHypnosis', maximum: { min: 0.18, typical: 0.18, max: 0.22 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'preserve', toleranceFraction: 0.15 }],
    context: 'healthy',
    speciesNotes: { canine: 'Pode causar excitação paradoxal em cães jovens hígidos; o sinergismo com propofol deve ser testado separadamente.', rabbit: 'Costuma integrar protocolos combinados, não analgesia isolada.' },
    evidence: ['PMID:23570259', 'PMID:23750585'],
  },
  {
    drugId: 'diazepam',
    clinicalClass: 'Benzodiazepínico',
    mechanism: 'Modulação alostérica GABA-A com ansiólise e relaxamento muscular; mínimo efeito cardiovascular e nenhuma analgesia.',
    expectedDoseResponse: dose('Relaxamento discreto.', 'Relaxamento com sedação leve.', 'Teto de relaxamento; não deve produzir plano cirúrgico isolado.'),
    signals: [
      { metric: 'maxMuscleRelaxation', minimum: { min: 0.20, typical: 0.35, max: 0.44 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
      { metric: 'maxHypnosis', maximum: { min: 0.18, typical: 0.18, max: 0.22 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'preserve', toleranceFraction: 0.15 }],
    context: 'healthy',
    evidence: ['PMID:23750585'],
  },
  {
    drugId: 'morphine',
    clinicalClass: 'Opioide agonista µ pleno',
    mechanism: 'Agonismo µ inibe transmissão nociceptiva e drive respiratório, aumenta tônus vagal; IV rápido pode liberar histamina.',
    expectedDoseResponse: dose('Analgesia mensurável, sedação discreta.', 'Analgesia forte com bradipneia/bradicardia possíveis.', 'Analgesia próxima ao teto e maior depressão respiratória; bólus rápido adiciona hipotensão por histamina.'),
    signals: [{ metric: 'maxAnalgesia', minimum: { min: 0.24, typical: 0.44, max: 0.52 } }],
    relativeTrends: [{ metric: 'respiratoryRate', direction: 'decrease', minimumFraction: 0.08 }],
    context: 'healthy',
    speciesNotes: { feline: 'Excitação/disforia e hipertermia são possíveis, sobretudo sem tranquilizante.', equine: 'Agonistas µ isolados podem causar excitação locomotora; combinar/titular.' },
    evidence: ['PMID:19121156'],
  },
  {
    drugId: 'methadone',
    clinicalClass: 'Opioide agonista µ/NMDA',
    mechanism: 'Agonismo µ pleno com componente antagonista NMDA; analgesia somática/visceral, sedação e depressão respiratória dose-dependentes.',
    expectedDoseResponse: dose('Analgesia moderada.', 'Analgesia forte e sedação moderada.', 'Analgesia próxima ao teto com maior bradipneia.'),
    signals: [{ metric: 'maxAnalgesia', minimum: { min: 0.28, typical: 0.47, max: 0.54 } }],
    relativeTrends: [{ metric: 'respiratoryRate', direction: 'decrease', minimumFraction: 0.08 }],
    context: 'healthy',
    evidence: ['PMID:18565203', 'PMID:24004232'],
  },
  {
    drugId: 'fentanyl',
    clinicalClass: 'Opioide agonista µ pleno de alta potência',
    mechanism: 'Agonismo µ de início rápido causa analgesia intensa, poupança de MAC, bradicardia vagal e depressão ventilatória.',
    expectedDoseResponse: dose('Analgesia rápida.', 'Analgesia intensa, bradipneia e sedação.', 'Efeito próximo ao teto, com apneia/rigidez torácica mais prováveis em bólus rápido.'),
    signals: [
      { metric: 'maxAnalgesia', minimum: { min: 0.30, typical: 0.50, max: 0.57 } },
      { metric: 'maxRespiratoryDepression', minimum: { min: 0.16, typical: 0.30, max: 0.38 } },
    ],
    relativeTrends: [{ metric: 'respiratoryRate', direction: 'decrease', minimumFraction: 0.15 }],
    context: 'healthy',
    evidence: ['PMID:34813931'],
  },
  {
    drugId: 'butorphanol',
    clinicalClass: 'Opioide κ agonista/µ antagonista-parcial',
    mechanism: 'Agonismo κ com baixa eficácia µ produz sedação e analgesia de teto, geralmente inferior aos agonistas µ para dor intensa.',
    expectedDoseResponse: dose('Sedação/analgesia leves.', 'Sedação moderada e analgesia visceral limitada.', 'Platô analgésico; aumentar dose não deve alcançar eficácia de agonista µ pleno.'),
    signals: [
      { metric: 'maxAnalgesia', minimum: { min: 0.16, typical: 0.28, max: 0.32 }, maximum: { max: 0.65 } },
      { metric: 'maxSedation', minimum: { typical: 0.16 } },
    ],
    context: 'healthy',
    speciesNotes: { avian: 'Receptores κ são mais representados em várias aves, mas a resposta varia entre espécies; usar apenas um modificador moderado.' },
    evidence: ['PMID:30077553', 'PMID:19836984'],
  },
  {
    drugId: 'buprenorphine',
    clinicalClass: 'Opioide agonista µ parcial de alta afinidade',
    mechanism: 'Agonismo µ parcial de dissociação lenta produz analgesia prolongada e teto relativo de depressão respiratória.',
    expectedDoseResponse: dose('Analgesia de início gradual.', 'Analgesia moderada/forte e prolongada, pouca depressão respiratória.', 'Aproximação do teto por agonismo parcial, sem equivaler a escalada linear de fentanyl.'),
    signals: [
      { metric: 'maxAnalgesia', minimum: { min: 0.22, typical: 0.38, max: 0.44 } },
      { metric: 'maxRespiratoryDepression', maximum: { typical: 0.42, max: 0.55 } },
    ],
    context: 'healthy',
    speciesNotes: { feline: 'Evidência clínica sustenta analgesia mais duradoura que butorfanol em vários cenários cirúrgicos.' },
    evidence: ['PMID:19836984', 'PMID:24984130'],
  },
  {
    drugId: 'propofol',
    clinicalClass: 'Hipnótico alquilfenol',
    mechanism: 'Potencia e abre GABA-A, causando hipnose rápida, vasodilatação e depressão ventilatória; não é analgésico.',
    expectedDoseResponse: dose('Sedação/hipnose leve, geralmente insuficiente para intubação sem premedicação.', 'Perda de consciência e relaxamento, com hipotensão/bradipneia.', 'Hipnose profunda e alta probabilidade de apneia; suporte de via aérea necessário.'),
    signals: [
      { metric: 'maxHypnosis', minimum: { min: 0.25, typical: 0.45, max: 0.55 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'decrease', minimumFraction: 0.04 }],
    context: 'healthy',
    speciesNotes: { feline: 'Exposição repetida/prolongada exige cautela metabólica; uma dose única não deve ser declarada fatal por espécie.' },
    evidence: ['PMID:30605029', 'PMID:22789018'],
  },
  {
    drugId: 'alfaxalone',
    clinicalClass: 'Neuroesteroide hipnótico',
    mechanism: 'Modulação/abertura GABA-A por sítio neuroesteroide produz hipnose e relaxamento sem analgesia; rapidez de administração influencia apneia.',
    expectedDoseResponse: dose('Sedação/hipnose leve.', 'Perda de consciência com relativa estabilidade cardiovascular.', 'Hipnose profunda e risco crescente de apneia.'),
    signals: [
      { metric: 'maxHypnosis', minimum: { min: 0.26, typical: 0.45, max: 0.55 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'preserve', toleranceFraction: 0.22 }],
    context: 'healthy',
    evidence: ['PMID:22405410', 'PMID:39323870'],
  },
  {
    drugId: 'ketamine',
    clinicalClass: 'Anestésico dissociativo',
    mechanism: 'Bloqueio não competitivo do poro NMDA produz dissociação e analgesia, preserva reflexos e aumenta tônus simpático; isolada pode causar hipertonia.',
    expectedDoseResponse: dose('Analgesia e dissociação leves.', 'Anestesia dissociativa com reflexos preservados e aumento de FC/PAM.', 'Dissociação intensa, maior hipertonia e risco de recuperação disfórica.'),
    signals: [
      { metric: 'maxDissociation', minimum: { min: 0.22, typical: 0.40, max: 0.48 } },
      { metric: 'maxAnalgesia', minimum: { min: 0.20, typical: 0.36, max: 0.43 } },
      { metric: 'maxMuscleRelaxation', maximum: { min: 0.12, typical: 0.12, max: 0.12 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'increase', minimumFraction: 0.05 }],
    context: 'healthy',
    evidence: ['PMID:30605029', 'PMID:29033245'],
  },
  {
    drugId: 'etomidate',
    clinicalClass: 'Hipnótico imidazólico',
    mechanism: 'Modulação GABA-A produz hipnose com depressão cardiovascular mínima; não analgésico e pode causar mioclonia/supressão adrenal.',
    expectedDoseResponse: dose('Hipnose parcial.', 'Perda de consciência com PAM/FC próximas ao controle.', 'Hipnose profunda; depressão respiratória pode aumentar, sem grande vasodilatação direta.'),
    signals: [
      { metric: 'maxHypnosis', minimum: { min: 0.23, typical: 0.42, max: 0.52 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'preserve', toleranceFraction: 0.16 }],
    context: 'healthy',
    evidence: ['PMID:22405410'],
  },
  {
    drugId: 'thiopental',
    clinicalClass: 'Barbitúrico hipnótico',
    mechanism: 'Potencia/abre GABA-A, causando hipnose rápida, depressão ventilatória e cardiovascular sem analgesia.',
    expectedDoseResponse: dose('Hipnose parcial.', 'Perda de consciência, relaxamento e depressão respiratória.', 'Hipnose profunda/apneia e maior hipotensão.'),
    signals: [
      { metric: 'maxHypnosis', minimum: { min: 0.25, typical: 0.45, max: 0.55 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
    ],
    relativeTrends: [{ metric: 'map', direction: 'decrease', minimumFraction: 0.03 }],
    context: 'healthy',
    evidence: ['PMID:9736392', 'PMID:18447788'],
  },
  {
    drugId: 'guaifenesin',
    clinicalClass: 'Relaxante muscular central',
    mechanism: 'Depressão seletiva de vias interneuronais medulares produz relaxamento; isoladamente não oferece analgesia nem anestesia cirúrgica confiável.',
    expectedDoseResponse: dose('Relaxamento discreto.', 'Relaxamento pronunciado, consciência em grande parte preservada.', 'Fraqueza/decúbito; toxicidade por sobredose sem substituir hipnótico/analgésico.'),
    signals: [
      { metric: 'maxMuscleRelaxation', minimum: { min: 0.28, typical: 0.45, max: 0.54 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
      { metric: 'maxHypnosis', maximum: { min: 0.12, typical: 0.14, max: 0.18 } },
    ],
    context: 'healthy',
    speciesNotes: { equine: 'Deve demonstrar complementaridade com xilazina + cetamina no “triple drip”.' },
    evidence: ['PMID:17237458'],
  },
  {
    drugId: 'atipamezole',
    clinicalClass: 'Antagonista alfa-2',
    mechanism: 'Antagonismo competitivo alfa-2 reverte sedação, analgesia e bradicardia de agonistas alfa-2; não é estimulante inespecífico.',
    expectedDoseResponse: dose('Reversão parcial quando há agonista.', 'Reversão substancial de sedação/analgesia.', 'Reversão rápida com maior risco de excitação/descarga simpática.'),
    signals: [], context: 'reversal',
    evidence: ['RECOVER-2024'],
  },
  {
    drugId: 'naloxone',
    clinicalClass: 'Antagonista opioide',
    mechanism: 'Antagonismo competitivo de receptores opioides, sobretudo µ, reverte depressão respiratória e analgesia; pode precipitar dor/disforia.',
    expectedDoseResponse: dose('Reversão parcial/titulada.', 'Reversão de depressão respiratória e perda de analgesia.', 'Reversão mais completa e abrupta.'),
    signals: [], context: 'reversal',
    evidence: ['RECOVER-2024'],
  },
  {
    drugId: 'flumazenil',
    clinicalClass: 'Antagonista do sítio benzodiazepínico',
    mechanism: 'Compete no sítio benzodiazepínico GABA-A e reverte sedação/relaxamento por midazolam ou diazepam, sem antagonizar propofol/inhalante.',
    expectedDoseResponse: dose('Reversão parcial de benzodiazepínico.', 'Reversão clara de relaxamento/sedação.', 'Reversão próxima ao teto; não desperta de hipnose não benzodiazepínica.'),
    signals: [], context: 'reversal',
    evidence: ['RECOVER-2024'],
  },
  {
    drugId: 'lipid_emulsion_20',
    clinicalClass: 'Emulsão lipídica de resgate',
    mechanism: 'Particionamento/redistribuição de xenobióticos lipofílicos reduz fração efetiva; indicada em toxicidade selecionada, não como vasopressor isolado.',
    expectedDoseResponse: dose('Bolus inicial de resgate com efeito variável.', 'Redução relevante de toxicidade lipofílica quando presente.', 'Maior carga lipídica; benefício não deve crescer indefinidamente e eventos adversos são possíveis.'),
    signals: [], context: 'toxicology',
    evidence: ['PMID:37841477', 'PMID:35769306'],
  },
  {
    drugId: 'epinephrine',
    clinicalClass: 'Agonista alfa-1/beta-1/beta-2',
    mechanism: 'Vasoconstrição alfa-1, inotropismo/cronotropismo beta-1 e broncodilatação beta-2; em PCR prioriza perfusão coronariana/cerebral.',
    expectedDoseResponse: dose('Suporte pressórico/inotrópico.', 'Aumento acentuado de PAM/FC.', 'Maior vasoconstrição e risco de taquiarritmia; dose alta não é recomendada rotineiramente na PCR.'),
    signals: [],
    relativeTrends: [{ metric: 'map', direction: 'increase', minimumFraction: 0.15 }, { metric: 'heartRate', direction: 'increase', minimumFraction: 0.08 }],
    context: 'pathology',
    evidence: ['RECOVER-2024'],
  },
  {
    drugId: 'atropine',
    clinicalClass: 'Antimuscarínico terciário',
    mechanism: 'Antagonismo M2/M3 remove tônus vagal, elevando FC e reduzindo secreções; resposta depende da espécie e do mecanismo da bradicardia.',
    expectedDoseResponse: dose('Cronotropismo discreto.', 'Taquicardia vagolítica clara.', 'Próximo do bloqueio vagal máximo, com maior risco de taquiarritmia.'),
    signals: [],
    relativeTrends: [{ metric: 'heartRate', direction: 'increase', minimumFraction: 0.12, excludeSpecies: ['rabbit', 'avian'] }],
    context: 'healthy',
    speciesNotes: { rabbit: 'Atropinase plasmática torna a resposta imprevisível/fraca em parte dos coelhos.', bovine: 'Pode espessar secreções; não deve ser modelada como escolha inócua.' },
    evidence: ['PMID:7889456', 'RECOVER-2024'],
  },
  {
    drugId: 'glycopyrrolate',
    clinicalClass: 'Antimuscarínico quaternário',
    mechanism: 'Antagonismo muscarínico periférico causa vagólise mais lenta/prolongada, sem efeito central significativo.',
    expectedDoseResponse: dose('Elevação discreta de FC.', 'Resposta vagolítica clara e sustentada.', 'Próximo do teto periférico; taquicardia possível.'),
    signals: [],
    relativeTrends: [{ metric: 'heartRate', direction: 'increase', minimumFraction: 0.10 }],
    context: 'healthy',
    speciesNotes: { rabbit: 'Mais confiável que atropina em coelhos com atropinase.' },
    evidence: ['PMID:7889456'],
  },
  {
    drugId: 'lidocaine_2pct',
    clinicalClass: 'Anestésico local amida/antiarrítmico classe Ib',
    mechanism: 'Bloqueio uso-dependente de canais NaV; localmente interrompe condução, IV reduz automatismo ventricular e em excesso causa neuro/cardiotoxicidade.',
    expectedDoseResponse: dose('Bloqueio local/efeito antiarrítmico discreto conforme via.', 'Analgesia regional forte ou efeito sistêmico moderado sem colapso.', 'Maior bloqueio; margem sistêmica estreita em felinos.'),
    signals: [{ metric: 'maxAnalgesia', minimum: { min: 0.10, typical: 0.18, max: 0.24 } }],
    context: 'healthy',
    speciesNotes: { feline: 'A via local deve permanecer separada da toxicidade IV; CRI/IV exige limiar específico e não morte automática na dose baixa.' },
    evidence: ['WSAVA-2022', 'RECOVER-2024'],
  },
  {
    drugId: 'dobutamine',
    clinicalClass: 'Inotrópico beta-1 predominante',
    mechanism: 'Agonismo beta-1 aumenta contratilidade e débito; efeito cronotrópico/vascular é menor e dependente da dose.',
    expectedDoseResponse: dose('Aumento discreto de débito.', 'Aumento claro de débito/PAM no baixo débito.', 'Maior suporte com taquicardia/arrítmia mais prováveis.'),
    signals: [],
    relativeTrends: [{ metric: 'map', direction: 'increase', minimumFraction: 0.12 }],
    context: 'pathology',
    evidence: ['PMID:17472447', 'PMID:36058821'],
  },
  {
    drugId: 'norepinephrine',
    clinicalClass: 'Vasopressor alfa-1/beta-1',
    mechanism: 'Agonismo alfa-1 eleva RVS/PAM e beta-1 sustenta inotropia; barorreflexo pode limitar ou reduzir FC.',
    expectedDoseResponse: dose('Vasoconstrição discreta.', 'Elevação clara de PAM com FC relativamente preservada.', 'Vasoconstrição intensa, maior pós-carga e risco isquêmico.'),
    signals: [],
    relativeTrends: [{ metric: 'map', direction: 'increase', minimumFraction: 0.15 }],
    context: 'pathology',
    evidence: ['PMID:36058821'],
  },
  {
    drugId: 'potassium_chloride',
    clinicalClass: 'Reposição eletrolítica concentrada',
    mechanism: 'Aumenta potássio extracelular; infusão controlada corrige déficit, enquanto bólus causa despolarização sustentada e parada.',
    expectedDoseResponse: dose('Pequena elevação de K sérico.', 'Elevação terapêutica mensurável em infusão.', 'Maior elevação e risco de alteração de condução; bólus rápido é cenário tóxico distinto.'),
    signals: [{ metric: 'maxPotassium', minimum: { min: 4.35, typical: 4.55, max: 4.75 } }],
    context: 'pathology',
    evidence: ['RECOVER-2024'],
  },
  {
    drugId: 'calcium_gluconate',
    clinicalClass: 'Sal de cálcio cardioprotetor',
    mechanism: 'Eleva limiar de excitabilidade e estabiliza membrana miocárdica na hipercalemia; não remove potássio do organismo.',
    expectedDoseResponse: dose('Estabilização discreta.', 'Melhora da condução/pressão no paciente hipercalêmico sem reduzir K.', 'Maior suporte, com risco de bradicardia/arritmia se infundido rápido.'),
    signals: [], context: 'pathology',
    evidence: ['RECOVER-2024'],
  },
  {
    drugId: 'sodium_bicarbonate',
    clinicalClass: 'Tampão alcalinizante',
    mechanism: 'Aumenta bicarbonato/ pH e desloca K para o intracelular; gera CO2 e não substitui ventilação/perfusão.',
    expectedDoseResponse: dose('Pequena elevação de bicarbonato.', 'Alcalinização mensurável no paciente acidótico.', 'Maior alcalinização, com risco de alcalose/hipernatremia e carga de CO2.'),
    signals: [{ metric: 'maxBicarbonate', minimum: { min: 22.4, typical: 23.2, max: 24.0 } }],
    context: 'pathology',
    evidence: ['RECOVER-2024'],
  },
  {
    drugId: 'atracurium',
    clinicalClass: 'Bloqueador neuromuscular não despolarizante',
    mechanism: 'Antagonismo competitivo nicotínico Nm paralisa músculo esquelético/respiratório; não reduz consciência nem dor.',
    expectedDoseResponse: dose('Redução parcial de TOF.', 'Bloqueio neuromuscular profundo e necessidade de ventilação.', 'Bloqueio próximo do completo e mais prolongado.'),
    signals: [
      { metric: 'maxMuscleRelaxation', minimum: { min: 0.28, typical: 0.48, max: 0.57 } },
      { metric: 'maxHypnosis', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
      { metric: 'maxAnalgesia', maximum: { min: 0.05, typical: 0.05, max: 0.05 } },
    ],
    context: 'healthy',
    evidence: ['PMID:2300723'],
  },
  {
    drugId: 'neostigmine',
    clinicalClass: 'Inibidor de acetilcolinesterase',
    mechanism: 'Eleva acetilcolina na junção neuromuscular e reverte bloqueio não despolarizante recuperável; também causa efeitos muscarínicos, exigindo anticolinérgico.',
    expectedDoseResponse: dose('Reversão parcial se já houver recuperação.', 'Recuperação relevante do TOF com bradicardia se sem antimuscarínico.', 'Maior reversão, sem superar bloqueio excessivamente profundo; mais efeito muscarínico.'),
    signals: [], context: 'reversal',
    evidence: ['PMID:2300723'],
  },
  {
    drugId: 'sugammadex',
    clinicalClass: 'Encapsulador seletivo de NMBA aminosteroidal',
    mechanism: 'Encapsula rocurônio/vecurônio livres; não reverte atracúrio, um benzilisoquinolínico.',
    expectedDoseResponse: dose('Reversão de bloqueio aminosteroidal raso.', 'Reversão rápida de bloqueio aminosteroidal moderado.', 'Dose para bloqueio profundo; nenhum efeito específico sobre atracúrio.'),
    signals: [], context: 'reversal',
    evidence: ['PMID:40157877'],
  },
  {
    drugId: 'bupivacaine_05',
    clinicalClass: 'Anestésico local amida de longa ação',
    mechanism: 'Bloqueio NaV regional interrompe aferência nociceptiva e motora; injeção intravascular/sobredose causa LAST cardiotóxica.',
    expectedDoseResponse: dose('Bloqueio regional parcial.', 'Bloqueio regional/analgesia fortes com baixa exposição sistêmica.', 'Bloqueio próximo do teto; dose local alta não equivale automaticamente a injeção IV.'),
    signals: [
      { metric: 'maxLocalBlockade', minimum: { min: 0.35, typical: 0.55, max: 0.65 } },
      { metric: 'maxAnalgesia', minimum: { min: 0.36, typical: 0.52, max: 0.62 } },
      { metric: 'maxSystemicNaVBlockade', maximum: { min: 0.15, typical: 0.15, max: 0.20 } },
    ],
    context: 'healthy',
    evidence: ['WSAVA-2022', 'PMID:35769306'],
  },
  {
    drugId: 'fluid_lrs',
    clinicalClass: 'Cristaloide isotônico balanceado',
    mechanism: 'Expande transitoriamente o compartimento extracelular/intravascular; melhora pré-carga quando há déficit, mas hemodilui e não corrige vasoplegia isolada.',
    expectedDoseResponse: dose('Manutenção, pouca alteração em normovolemia.', 'Reposição gradual com melhora de pré-carga na hipovolemia.', 'Maior expansão/hemodiluição; risco de sobrecarga deve limitar resposta.'),
    signals: [], context: 'pathology',
    evidence: ['PMID:11803735', 'PMID:20126348'],
  },
  {
    drugId: 'hypertonic_saline_72',
    clinicalClass: 'Cristaloide hipertônico',
    mechanism: 'Gradiente osmótico recruta água para o intravascular, elevando pré-carga rapidamente com pequeno volume; efeito é transitório.',
    expectedDoseResponse: dose('Expansão rápida discreta.', 'Melhora rápida de PAM/débito no choque hipovolêmico.', 'Maior expansão transitória e carga de sódio/osmolalidade.'),
    signals: [],
    relativeTrends: [{ metric: 'map', direction: 'increase', minimumFraction: 0.06 }],
    context: 'pathology',
    evidence: ['PMID:11803735', 'PMID:15271735'],
  },
  {
    drugId: 'whole_blood',
    clinicalClass: 'Hemocomponente',
    mechanism: 'Repõe volume, eritrócitos e capacidade carreadora de O2 após hemorragia; não é depressor respiratório ou sedativo.',
    expectedDoseResponse: dose('Aumento discreto de Hct/volume.', 'Melhora de Hct, pré-carga e entrega de O2 na hemorragia.', 'Maior reposição; resposta deve respeitar risco de sobrecarga/reação transfusional.'),
    signals: [],
    context: 'pathology',
    evidence: ['WSAVA-2022'],
  },
];

export function getMedicationExpectation(drugId: string): MedicationValidationSpec {
  const expectation = PHARMACOLOGY_EXPECTATIONS.find((item) => item.drugId === drugId);
  if (!expectation) throw new Error(`Contrato clínico ausente para ${drugId}`);
  return expectation;
}
