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
};
