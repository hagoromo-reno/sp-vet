import { SpeciesType } from '../types/simulator';

export interface SpeciesProfile {
  id: SpeciesType;
  namePt: string;
  nameEn: string;
  iconName: string;
  typicalWeightRangeKg: [number, number];
  bloodVolumeMlPerKg: number;
  normalVitals: {
    hrMin: number;
    hrMax: number;
    hrTypical: number;
    rrMin: number;
    rrMax: number;
    rrTypical: number;
    sysBpMin: number;
    sysBpMax: number;
    diaBpMin: number;
    diaBpMax: number;
    mapMin: number;
    mapMax: number;
    mapTypical: number;
    tempMinC: number;
    tempMaxC: number;
    tempTypicalC: number;
    spo2Normal: number;
    etco2Min: number;
    etco2Max: number;
    etco2Typical: number;
  };
  tidalVolumeMlKg: [number, number]; // ml/kg (usually 10-15 ml/kg)
  macValues: {
    isoflurane: number; // % (e.g., 1.30 dog, 1.63 cat, 1.31 horse)
    sevoflurane: number; // % (e.g., 2.36 dog, 2.58 cat, 2.31 horse)
  };
  recommendedEtTubeRange: {
    min: number;
    max: number;
  };
  specialConsiderations: string[];
}

export const SPECIES_DATABASE: Record<SpeciesType, SpeciesProfile> = {
  canine: {
    id: 'canine',
    namePt: 'Canino (Cão)',
    nameEn: 'Canine (Dog)',
    iconName: 'Dog',
    typicalWeightRangeKg: [2, 60],
    bloodVolumeMlPerKg: 88, // 85-90 ml/kg
    normalVitals: {
      hrMin: 60,
      hrMax: 140,
      hrTypical: 90,
      rrMin: 10,
      rrMax: 30,
      rrTypical: 16,
      sysBpMin: 90,
      sysBpMax: 140,
      diaBpMin: 50,
      diaBpMax: 90,
      mapMin: 65,
      mapMax: 100,
      mapTypical: 78,
      tempMinC: 37.5,
      tempMaxC: 39.2,
      tempTypicalC: 38.3,
      spo2Normal: 98,
      etco2Min: 35,
      etco2Max: 45,
      etco2Typical: 38,
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.30,
      sevoflurane: 2.36,
    },
    recommendedEtTubeRange: {
      min: 4.5,
      max: 12.0,
    },
    specialConsiderations: [
      'Alta variação de tamanho corporal (Chihuahua 1.5kg a Dogue Alemão 70kg)',
      'Raças braquicefálicas com estenose de narinas, palato mole alongado e tônus vagal elevado',
      'Predisposição a arritmias (VPCs) em afecções esplênicas, torção gástrica e trauma torácico',
    ],
  },
  feline: {
    id: 'feline',
    namePt: 'Felino (Gato)',
    nameEn: 'Feline (Cat)',
    iconName: 'Cat',
    typicalWeightRangeKg: [2.5, 7.5],
    bloodVolumeMlPerKg: 60, // 55-66 ml/kg
    normalVitals: {
      hrMin: 120,
      hrMax: 200,
      hrTypical: 145,
      rrMin: 15,
      rrMax: 35,
      rrTypical: 22,
      sysBpMin: 90,
      sysBpMax: 140,
      diaBpMin: 55,
      diaBpMax: 90,
      mapMin: 65,
      mapMax: 100,
      mapTypical: 80,
      tempMinC: 38.0,
      tempMaxC: 39.2,
      tempTypicalC: 38.5,
      spo2Normal: 98,
      etco2Min: 35,
      etco2Max: 45,
      etco2Typical: 38,
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.63,
      sevoflurane: 2.58,
    },
    recommendedEtTubeRange: {
      min: 3.0,
      max: 5.5,
    },
    specialConsiderations: [
      'Reflexo laringoespástico intenso (obrigatório uso de lidocaína tópica antes da intubação)',
      'Extrema suscetibilidade a hipotermia rápida devido à grande relação superfície/massa corporal',
      'Menor capacidade de conjugação hepática por glicuronidação (cuidado com opioides e fenois)',
      'Predisposição a laringoestenose pós-cuff hiperinsuflado (> 20 cmH2O)',
    ],
  },
  equine: {
    id: 'equine',
    namePt: 'Equino (Cavalo)',
    nameEn: 'Equine (Horse)',
    iconName: 'Horse',
    typicalWeightRangeKg: [350, 700],
    bloodVolumeMlPerKg: 75,
    normalVitals: {
      hrMin: 28,
      hrMax: 44,
      hrTypical: 36,
      rrMin: 8,
      rrMax: 16,
      rrTypical: 10,
      sysBpMin: 90,
      sysBpMax: 130,
      diaBpMin: 50,
      diaBpMax: 80,
      mapMin: 70, // In horses, MAP > 70 mmHg is strictly required to prevent myopathy
      mapMax: 95,
      mapTypical: 75,
      tempMinC: 37.2,
      tempMaxC: 38.5,
      tempTypicalC: 37.8,
      spo2Normal: 97,
      etco2Min: 35,
      etco2Max: 50,
      etco2Typical: 40,
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.31,
      sevoflurane: 2.31,
    },
    recommendedEtTubeRange: {
      min: 18.0,
      max: 30.0,
    },
    specialConsiderations: [
      'PAM > 70 mmHg mandatória sob anestesia inalatória para prevenir rabdomiólise e neuropatia pós-anestésica',
      'Grande massa visceral causa compressão pulmonar em decúbito dorsal/lateral (atelectasia e shunt V/Q)',
      'Protocolo de TIVA (Triplo Gotejamento: Guafenesina + Xilazina + Cetamina) amplamente utilizado a campo',
      'Fase de recuperação e apoio de pé crítica com risco de fraturas catastróficas',
    ],
  },
  bovine: {
    id: 'bovine',
    namePt: 'Bovino (Boi/Vaca)',
    nameEn: 'Bovine',
    iconName: 'Beef',
    typicalWeightRangeKg: [300, 800],
    bloodVolumeMlPerKg: 60,
    normalVitals: {
      hrMin: 50,
      hrMax: 80,
      hrTypical: 65,
      rrMin: 12,
      rrMax: 28,
      rrTypical: 18,
      sysBpMin: 95,
      sysBpMax: 140,
      diaBpMin: 55,
      diaBpMax: 90,
      mapMin: 70,
      mapMax: 100,
      mapTypical: 80,
      tempMinC: 38.0,
      tempMaxC: 39.5,
      tempTypicalC: 38.6,
      spo2Normal: 97,
      etco2Min: 35,
      etco2Max: 45,
      etco2Typical: 38,
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.18,
      sevoflurane: 2.15,
    },
    recommendedEtTubeRange: {
      min: 16.0,
      max: 26.0,
    },
    specialConsiderations: [
      'Altíssima sensibilidade a agonistas alfa-2 (xilazina requer 1/10 da dose de equinos)',
      'Risco de timpanismo ruminal agudo e regurgitação passiva com aspiração pulmonar severa',
      'Salivação profusa contínua não inibida por atropina (anticolinérgicos aumentam viscosidade)',
    ],
  },
  rabbit: {
    id: 'rabbit',
    namePt: 'Coelho / Lagomorfo',
    nameEn: 'Rabbit',
    iconName: 'Rabbit',
    typicalWeightRangeKg: [1.2, 4.5],
    bloodVolumeMlPerKg: 57,
    normalVitals: {
      hrMin: 180,
      hrMax: 300,
      hrTypical: 220,
      rrMin: 30,
      rrMax: 60,
      rrTypical: 40,
      sysBpMin: 80,
      sysBpMax: 130,
      diaBpMin: 50,
      diaBpMax: 80,
      mapMin: 60,
      mapMax: 90,
      mapTypical: 70,
      tempMinC: 38.5,
      tempMaxC: 40.0,
      tempTypicalC: 39.0,
      spo2Normal: 98,
      etco2Min: 35,
      etco2Max: 45,
      etco2Typical: 38,
    },
    tidalVolumeMlKg: [8, 12],
    macValues: {
      isoflurane: 2.05,
      sevoflurane: 3.70,
    },
    recommendedEtTubeRange: {
      min: 2.0,
      max: 3.5,
    },
    specialConsiderations: [
      'Intubação endotraqueal às cegas ou guiada por endoscópio / máscara supraglótica V-gel',
      'Reflexo de apneia súbita e bradicardia ao sentir odor de anestésicos voláteis sem pré-medicação',
      'Presença de atropinase em até 40-50% dos coelhos (glicopirrolato é o anticolinérgico de escolha)',
      'Íleo paralítico gastrointestinal pós-operatório comum se o manejo álgico for insuficiente',
    ],
  },
  avian: {
    id: 'avian',
    namePt: 'Ave / Exótico',
    nameEn: 'Avian / Exotic',
    iconName: 'Bird',
    typicalWeightRangeKg: [0.08, 1.5],
    bloodVolumeMlPerKg: 95,
    normalVitals: {
      hrMin: 250,
      hrMax: 450,
      hrTypical: 320,
      rrMin: 25,
      rrMax: 50,
      rrTypical: 35,
      sysBpMin: 90,
      sysBpMax: 140,
      diaBpMin: 50,
      diaBpMax: 80,
      mapMin: 65,
      mapMax: 100,
      mapTypical: 80,
      tempMinC: 39.5,
      tempMaxC: 42.0,
      tempTypicalC: 40.8,
      spo2Normal: 98,
      etco2Min: 30,
      etco2Max: 40,
      etco2Typical: 35,
    },
    tidalVolumeMlKg: [12, 18],
    macValues: {
      isoflurane: 1.44,
      sevoflurane: 2.21,
    },
    recommendedEtTubeRange: {
      min: 1.5,
      max: 4.0,
    },
    specialConsiderations: [
      'Traqueia com anéis cartilaginosos completos (tubos SEM balonete/cuff para evitar necrose traqueal)',
      'Sistema respiratório com sacos aéreos e fluxo contínuo unidirecional de gás',
      'Hipotermia ultra-rápida devido à alta taxa metabólica e pequeno volume corporal',
    ],
  },
};
