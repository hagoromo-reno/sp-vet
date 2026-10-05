import type {
  AdminCapnographyOverride,
  AdminECGOverride,
  AdminMonitorOverrides,
  AdminOximetryOverride,
  CapnogramType,
  CardiacRhythm,
  VitalSigns,
} from '../types/simulator';

export interface OverrideOption<T> {
  id: T;
  title: string;
  subtitle: string;
  category: string;
  badge?: string;
  clinicalNote: string;
}

export const ECG_OVERRIDE_OPTIONS: OverrideOption<AdminECGOverride>[] = [
  {
    id: 'auto',
    title: 'Automático (Fisiologia Real)',
    subtitle: 'Modulado continuamente por drogas, plano anestésico e tônus autonômico',
    category: 'Fisiológico',
    clinicalNote: 'O motor fisiológico calcula o ritmo com base nos receptores e estado cardiovascular.',
  },
  {
    id: 'normal',
    title: 'Ritmo Sinusal Normal',
    subtitle: 'Ondas P normais seguidas de QRS estreito e onda T assimétrica',
    category: 'Normal',
    clinicalNote: 'Despolarização sinusal normal com intervalo PR e morfologia preservados.',
  },
  {
    id: 'sinus_bradycardia',
    title: 'Bradicardia Sinusal',
    subtitle: 'Frequência cardíaca baixa com preservação da morfologia sinusal',
    category: 'Sinusal',
    badge: 'FC Reduzida',
    clinicalNote: 'Comum sob agonistas alfa-2 adrenérgicos (dexmedetomidina) ou hipotermia.',
  },
  {
    id: 'sinus_tachycardia',
    title: 'Taquicardia Sinusal',
    subtitle: 'Frequência elevada com condução AV rápida 1:1 e P-QRS-T mantidos',
    category: 'Sinusal',
    badge: 'FC Elevada',
    clinicalNote: 'Dor cirúrgica, hipovolemia, febre ou resposta simpatoadrenal intensa.',
  },
  // Arritmias Ventriculares
  {
    id: 'ventricular_premature_complexes',
    title: 'Extrassístoles Ventriculares (CVP / VPC)',
    subtitle: 'Batimentos ventriculares prematuros aberrantes e alargados intercalados',
    category: 'Arritmias Ventriculares',
    badge: 'CVP / PVC',
    clinicalNote: 'Origem ectópica ventricular com pausa compensatória completa.',
  },
  {
    id: 'ventricular_tachycardia',
    title: 'Taquicardia Ventricular (TV)',
    subtitle: 'Complexos QRS bizarros, monomórficos e largos em sucessão rápida',
    category: 'Arritmias Ventriculares',
    badge: 'Emergência',
    clinicalNote: 'Arritmia hemodinamicamente instável. Risco iminente de colapso circulatório.',
  },
  {
    id: 'ventricular_fibrillation',
    title: 'Fibrilação Ventricular (FV)',
    subtitle: 'Ondulações caóticas multifocais sem complexos QRS organizados',
    category: 'Arritmias Ventriculares',
    badge: 'PCR Chocável',
    clinicalNote: 'Parada Cardiorrespiratória em ritmo chocável. Requer desfibrilação imediata.',
  },
  // Arritmias Supraventriculares
  {
    id: 'supraventricular_tachycardia',
    title: 'Taquicardia Supraventricular (TSV)',
    subtitle: 'Frequência extremamente rápida com QRS estreito e onda P oculta ou retrógrada',
    category: 'Arritmias Supraventriculares',
    badge: 'QRS Estreito',
    clinicalNote: 'Reentrada nodal ou via acessória. Enchimento diastólico ventricular reduzido.',
  },
  {
    id: 'atrial_flutter',
    title: 'Flutter Atrial',
    subtitle: 'Ondas F contínuas em dente de serra (~300 bpm) com bloqueio de condução 2:1',
    category: 'Arritmias Supraventriculares',
    badge: 'Dente de Serra',
    clinicalNote: 'Macro-reentrada atrial com condução atrioventricular filtrada.',
  },
  {
    id: 'atrial_fibrillation',
    title: 'Fibrilação Atrial (AFib)',
    subtitle: 'Linha de base irregular com micro-oscilações f e intervalos R-R caóticos',
    category: 'Arritmias Supraventriculares',
    badge: 'R-R Irregular',
    clinicalNote: 'Perda da contração atrial organizada ("atrial kick"), comum em cardiopatas.',
  },
  // BAVs
  {
    id: 'av_block_1st_degree',
    title: 'BAV de 1º Grau',
    subtitle: 'Prolongamento fixo e anormal do intervalo PR sem falha de condução ventricular',
    category: 'Bloqueios AV',
    badge: 'PR Longo',
    clinicalNote: 'Atraso homogêneo na condução através do nó atrioventricular.',
  },
  {
    id: 'av_block_2nd_degree_mobitz1',
    title: 'BAV de 2º Grau Mobitz I (Wenckebach)',
    subtitle: 'Alongamento progressivo do PR ciclo a ciclo até o bloqueio de uma onda P',
    category: 'Bloqueios AV',
    badge: 'Wenckebach',
    clinicalNote: 'Fadiga progressiva da condução no nó AV culminando em QRS bloqueado.',
  },
  {
    id: 'av_block_2nd_degree_mobitz2',
    title: 'BAV de 2º Grau Mobitz II',
    subtitle: 'Intervalo PR constante com ondas P bloqueadas de forma súbita e intermitente',
    category: 'Bloqueios AV',
    badge: 'Infranodal',
    clinicalNote: 'Lesão infranodal (sistema His-Purkinje). Maior gravidade com risco de BAVT.',
  },
  {
    id: 'av_block_3rd_degree',
    title: 'BAV de 3º Grau (Total / BAVT)',
    subtitle: 'Dissociação atrioventricular total: P sinusal marcha independente do escape ventricular',
    category: 'Bloqueios AV',
    badge: 'Dissociação AV',
    clinicalNote: 'Nenhum estímulo atrial alcança os ventrículos. Ritmo de escape ventricular lento.',
  },
  // Alterações de ST / Isquemia
  {
    id: 'st_depression_ischemia',
    title: 'Isquemia Miocárdica (Infradesnível ST)',
    subtitle: 'Depressão horizontal/descendente do segmento ST > 0.15-0.25 mV abaixo da linha de base',
    category: 'Isquemia / ST-T',
    badge: 'Infradesnível ST',
    clinicalNote: 'Isquemia subendocárdica por desequilíbrio entre oferta e demanda miocárdica de O2.',
  },
  {
    id: 'st_elevation_injury',
    title: 'Corrente de Lesão (Supradesnível ST)',
    subtitle: 'Elevação convexa acentuada do ponto J e segmento ST fundindo-se à onda T',
    category: 'Isquemia / ST-T',
    badge: 'Supradesnível ST',
    clinicalNote: 'Lesão transmural aguda / espasmo coronariano grave.',
  },
  {
    id: 't_wave_inversion',
    title: 'Inversão de Onda T',
    subtitle: 'Ondas T negativas profundas e simétricas após despolarização normal',
    category: 'Isquemia / ST-T',
    badge: 'T Invertida',
    clinicalNote: 'Alteração primária de repolarização ventricular ou sobrecarga ventricular.',
  },
  // Distúrbios Eletrolíticos
  {
    id: 'hyperkalemia',
    title: 'Hipercalemia (Potássio Elevado)',
    subtitle: 'Ondas T pontiagudas e simétricas ("em tenda"), alargamento de QRS e perda da onda P',
    category: 'Distúrbios Eletrolíticos',
    badge: 'K+ > 7.0 mEq/L',
    clinicalNote: 'Comum na obstrução uretral felina e insuficiência renal aguda anúrica.',
  },
  {
    id: 'hypokalemia',
    title: 'Hipocalemia (Potássio Baixo)',
    subtitle: 'Achatamento de onda T, discreto infradesnível de ST e onda U proeminente',
    category: 'Distúrbios Eletrolíticos',
    badge: 'K+ < 3.0 mEq/L',
    clinicalNote: 'Perdas gastrointestinais, diuréticos de alça ou alcalose metabólica.',
  },
];

export const CAPNOGRAPHY_OVERRIDE_OPTIONS: OverrideOption<AdminCapnographyOverride>[] = [
  {
    id: 'auto',
    title: 'Automático (Fisiologia Real)',
    subtitle: 'Curva dinâmica baseada na ventilação alveolar, débito cardíaco e circuito',
    category: 'Fisiológico',
    clinicalNote: 'O simulador calcula EtCO2 e FiCO2 respeitando produção metabólica e ventilação.',
  },
  {
    id: 'normal',
    title: 'Normocapnia Calibrada (Padrão)',
    subtitle: 'EtCO2 entre 38-42 mmHg com fases I, II, III e 0 clássicas bem delimitadas',
    category: 'Normal',
    clinicalNote: 'Curva com ângulo alfa ~105°, ângulo beta ~90° e platô alveolar ligeiramente ascendente.',
  },
  {
    id: 'hypocapnia',
    title: 'Hipocapnia (Hiperventilação)',
    subtitle: 'EtCO2 baixo (20-25 mmHg) por ventilação alveolar excessiva ou baixo débito',
    category: 'Ventilação',
    badge: 'EtCO2 < 30 mmHg',
    clinicalNote: 'Hiperventilação mecânica vigorosa, dor/taquipneia ou redução súbita de débito cardíaco.',
  },
  {
    id: 'hypercapnia',
    title: 'Hipercapnia (Hipoventilação)',
    subtitle: 'EtCO2 elevado (58-70 mmHg) por depressão respiratória ou baixo volume minuto',
    category: 'Ventilação',
    badge: 'EtCO2 > 50 mmHg',
    clinicalNote: 'Hipoventilação alveolar por anestésicos gerais, opioides ou obstrução parcial.',
  },
  {
    id: 'rebreathing',
    title: 'Reinalação de CO2 (Rebreathing)',
    subtitle: 'Elevação da linha de base inspiratória (FiCO2 > 8-12 mmHg) com EtCO2 alto',
    category: 'Circuito / Válvulas',
    badge: 'Linha de Base Alta',
    clinicalNote: 'Falha na válvula expiratória, cal sodada exausta ou fluxo de oxigênio insuficiente no Bain.',
  },
  {
    id: 'esophageal_intubation',
    title: 'Intubação Esofágica',
    subtitle: 'Decaimento exponencial imediato: 2-3 pequenas curvas que colapsam a 0 mmHg',
    category: 'Via Aérea',
    badge: 'Sonda no Esôfago',
    clinicalNote: 'CO2 residual do estômago é rapidamente eliminado, seguido de ausência total de curva.',
  },
  {
    id: 'bronchospasm',
    title: 'Broncoespasmo (Barbatana de Tubarão)',
    subtitle: 'Fase II lenta e prolongada sem ângulo alfa nítido ("Shark-Fin Pattern")',
    category: 'Obstrução',
    badge: 'Shark-Fin',
    clinicalNote: 'Aumento da resistência expiratória por asma felina, broncoespasmo ou sonda dobrada.',
  },
  {
    id: 'co2_contamination',
    title: 'Contaminação de CO2 / Cal Sodada Exausta',
    subtitle: 'Linha de base sustentada elevada sem retorno a zero durante todo o ciclo',
    category: 'Circuito / Válvulas',
    badge: 'Cal Esgotada',
    clinicalNote: 'Incapacidade de absorção do CO2 expirado pelo absorvedor do circuito fechado.',
  },
  {
    id: 'cardiogenic_oscillations',
    title: 'Oscilações Cardiogênicas',
    subtitle: 'Pequenas ondulações rítmicas na fase III alveolar sincrônicas com os batimentos',
    category: 'Peculiaridades',
    badge: 'Pulsos Cardíacos',
    clinicalNote: 'O coração pulsando contra o parênquima pulmonar gera microfluxos gasosos na expiração.',
  },
  {
    id: 'curare_cleft',
    title: 'Fenda de Curare (Respiração contra Ventilador)',
    subtitle: 'Entalhe/dente profundo no platô da fase III por tentativa inspiratória do paciente',
    category: 'Peculiaridades',
    badge: 'Esforço Diafragmático',
    clinicalNote: 'Recuperação parcial do bloqueador neuromuscular ou assincronia com ventilação mecânica.',
  },
];

export const OXIMETRY_OVERRIDE_OPTIONS: OverrideOption<AdminOximetryOverride>[] = [
  {
    id: 'auto',
    title: 'Automático (Fisiologia Real)',
    subtitle: 'Modulação bioquímica pelo transporte de O2, perfusão tecidual e curva de saturação',
    category: 'Fisiológico',
    clinicalNote: 'A saturação responde com atraso circulatório e cinética de wash-in alveolar gradual.',
  },
  {
    id: 'normal',
    title: 'Oximetria Calibrada Fisiológica (Normal)',
    subtitle: 'SpO2 98-99%, onda pletismográfica nítida com incisura dícrota e PI equilibrado (1.8-2.2%)',
    category: 'Normal',
    clinicalNote: 'Relação clássica de curva arterial: subida anacrítica rápida e rebote elástico aórtico.',
  },
  {
    id: 'vasodilation',
    title: 'Vasodilatação Periférica',
    subtitle: 'Onda pletismográfica ampla, dicrotismo baixo e arredondado, PI elevado (~4.0 - 5.5%)',
    category: 'Perfusão',
    badge: 'PI Elevado',
    clinicalNote: 'Baixa resistência vascular sistêmica por anestésicos inalatórios, calor ou sepse hiperdinâmica.',
  },
  {
    id: 'vasoconstriction',
    title: 'Vasoconstrição Periférica',
    subtitle: 'Amplitude extremamente achatada, perda da incisura dícrota, micro-pulso e baixo PI (~0.2 - 0.4%)',
    category: 'Perfusão',
    badge: 'PI Baixo',
    clinicalNote: 'Alta resistência arteriolar por alfa-2 agonistas, hipotermia profunda, choque ou dor.',
  },
];

/**
 * Applies instructor / admin monitor overrides to the simulated vital signs.
 */
export function applyAdminMonitorOverrides(
  vitals: VitalSigns,
  overrides: AdminMonitorOverrides
): VitalSigns {
  let modified: VitalSigns = { ...vitals };

  // 1. ECG OVERRIDES
  if (overrides.ecg !== 'auto') {
    switch (overrides.ecg) {
      case 'normal':
        modified.cardiacRhythm = 'sinus';
        modified.heartRate = Math.min(120, Math.max(75, modified.heartRate));
        break;
      case 'sinus_bradycardia':
        modified.cardiacRhythm = 'sinus_bradycardia';
        modified.heartRate = Math.min(52, Math.max(34, Math.round(modified.heartRate * 0.55)));
        break;
      case 'sinus_tachycardia':
        modified.cardiacRhythm = 'sinus_tachycardia';
        modified.heartRate = Math.max(160, Math.min(210, Math.round(modified.heartRate * 1.55)));
        break;
      case 'ventricular_premature_complexes':
        modified.cardiacRhythm = 'ventricular_premature_complexes';
        break;
      case 'ventricular_tachycardia':
        modified.cardiacRhythm = 'ventricular_tachycardia';
        modified.heartRate = Math.max(185, Math.min(240, modified.heartRate));
        modified.pulseQuality = 'Fraco / Filiforme';
        break;
      case 'ventricular_fibrillation':
        modified.cardiacRhythm = 'ventricular_fibrillation';
        modified.heartRate = 0;
        modified.systolicBP = 18;
        modified.diastolicBP = 12;
        modified.meanArterialPressure = 14;
        modified.pulseQuality = 'Ausente';
        modified.pulseOximetrySpO2 = 0;
        break;
      case 'supraventricular_tachycardia':
        modified.cardiacRhythm = 'supraventricular_tachycardia';
        modified.heartRate = Math.max(215, Math.min(265, modified.heartRate));
        break;
      case 'atrial_flutter':
        modified.cardiacRhythm = 'atrial_flutter';
        modified.heartRate = 150; // Typically 2:1 conduction from 300 bpm atrial flutter
        break;
      case 'atrial_fibrillation':
        modified.cardiacRhythm = 'atrial_fibrillation';
        break;
      case 'av_block_1st_degree':
        modified.cardiacRhythm = 'av_block_1st_degree';
        break;
      case 'av_block_2nd_degree_mobitz1':
        modified.cardiacRhythm = 'av_block_2nd_degree_mobitz1';
        break;
      case 'av_block_2nd_degree_mobitz2':
        modified.cardiacRhythm = 'av_block_2nd_degree_mobitz2';
        break;
      case 'av_block_3rd_degree':
        modified.cardiacRhythm = 'av_block_3rd_degree';
        modified.heartRate = Math.min(42, Math.max(28, Math.round(modified.heartRate * 0.4)));
        break;
      case 'st_depression_ischemia':
        modified.cardiacRhythm = 'st_depression_ischemia';
        break;
      case 'st_elevation_injury':
        modified.cardiacRhythm = 'st_elevation_injury';
        break;
      case 't_wave_inversion':
        modified.cardiacRhythm = 't_wave_inversion';
        break;
      case 'hyperkalemia':
        modified.cardiacRhythm = 'hyperkalemia';
        modified.arterialBloodGases = {
          ...modified.arterialBloodGases,
          potassium: 7.8,
        };
        break;
      case 'hypokalemia':
        modified.cardiacRhythm = 'hypokalemia';
        modified.arterialBloodGases = {
          ...modified.arterialBloodGases,
          potassium: 2.3,
        };
        break;
    }
  }

  // 2. CAPNOGRAPHY OVERRIDES
  if (overrides.capnography !== 'auto') {
    switch (overrides.capnography) {
      case 'normal':
        modified.capnogramType = 'normal';
        modified.etCO2 = 40;
        modified.fiCO2 = 0;
        break;
      case 'hypocapnia':
        modified.capnogramType = 'hyperventilation';
        modified.etCO2 = 22;
        modified.fiCO2 = 0;
        break;
      case 'hypercapnia':
        modified.capnogramType = 'hypoventilation';
        modified.etCO2 = 64;
        modified.fiCO2 = 0;
        break;
      case 'rebreathing':
        modified.capnogramType = 'rebreathing_elevated_baseline';
        modified.etCO2 = 52;
        modified.fiCO2 = 12;
        break;
      case 'esophageal_intubation':
        modified.capnogramType = 'esophageal_intubation';
        modified.etCO2 = 0;
        modified.fiCO2 = 0;
        break;
      case 'bronchospasm':
        modified.capnogramType = 'obstructive_shark_fin';
        modified.etCO2 = 46;
        break;
      case 'co2_contamination':
        modified.capnogramType = 'rebreathing_elevated_baseline';
        modified.etCO2 = 50;
        modified.fiCO2 = 16;
        break;
      case 'cardiogenic_oscillations':
        modified.capnogramType = 'cardiogenic_oscillations';
        modified.etCO2 = 39;
        break;
      case 'curare_cleft':
        modified.capnogramType = 'curare_cleft';
        modified.etCO2 = 42;
        break;
    }
  }

  // 3. OXIMETRY / PLETHYSMOGRAPHY OVERRIDES
  if (overrides.oximetry !== 'auto') {
    switch (overrides.oximetry) {
      case 'normal':
        modified.pulseOximetrySpO2 = Math.min(100, Math.max(98, modified.pulseOximetrySpO2));
        modified.perfusionIndex = 2.0;
        break;
      case 'vasodilation':
        modified.pulseOximetrySpO2 = Math.min(100, Math.max(99, modified.pulseOximetrySpO2));
        modified.perfusionIndex = 4.8;
        break;
      case 'vasoconstriction':
        modified.pulseOximetrySpO2 = Math.min(94, Math.max(88, modified.pulseOximetrySpO2 || 91));
        modified.perfusionIndex = 0.3;
        break;
    }
  }

  return modified;
}
