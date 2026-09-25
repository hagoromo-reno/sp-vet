import {
  AdministrationSpeed,
  DrugDefinition,
  DrugRoute,
  PatientProfile,
  SpeciesType,
} from '../types/simulator';

export interface DoseRange {
  min: number;
  typical: number;
  max: number;
}

/** Returns only an explicitly curated range for the requested species. Supports CRI ranges for dual-mode drugs. */
export function getSpeciesDoseRange(
  drug: DrugDefinition,
  species: SpeciesType,
  isCRI?: boolean
): DoseRange | undefined {
  if (isCRI) {
    return drug.recommendedCriDose?.[species]
      ?? (isTimeBasedDoseUnit(drug.doseUnit) ? drug.recommendedDose[species] : undefined);
  }
  return drug.recommendedDose[species];
}

export function getSpeciesDrugRoutes(drug: DrugDefinition, species: SpeciesType): DrugRoute[] {
  return drug.speciesRoutes?.[species] ?? drug.supportedRoutes;
}

export function isTimeBasedDoseUnit(doseUnit?: string): boolean {
  if (!doseUnit) return false;
  return doseUnit.endsWith('/min') || doseUnit.endsWith('/h');
}

export interface AdministrationCommand {
  deliveryDurationSec?: number;
  route: DrugRoute;
  administrationSpeed?: AdministrationSpeed;
  isCRI?: boolean;
  dosePerKg: number;
  concentrationMgMl?: number;
}

/**
 * Central safety boundary shared by UI and application state. It deliberately
 * permits supratherapeutic experiments, but rejects dimensional, route and
 * species extrapolations that the model cannot interpret faithfully.
 */
export function validateAdministrationCommand(
  patient: PatientProfile,
  drug: DrugDefinition,
  command: AdministrationCommand
): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(patient.weightKg) || patient.weightKg <= 0) errors.push('Peso do paciente deve ser finito e maior que zero.');
  if (command.deliveryDurationSec !== undefined && (!Number.isFinite(command.deliveryDurationSec) || command.deliveryDurationSec < 1 || command.deliveryDurationSec > 3600)) {
    errors.push('Tempo de administração deve estar entre 1 e 3600 segundos.');
  }
  const isCriRoute = command.route === 'CRI' || Boolean(command.isCRI);
  const range = getSpeciesDoseRange(drug, patient.species, isCriRoute);
  const isNativeRate = isTimeBasedDoseUnit(drug.doseUnit);
  const hasCriRange = Boolean(drug.recommendedCriDose?.[patient.species]);
  const isSupportedCRI = isNativeRate || hasCriRange;

  if (!range) errors.push(`${drug.name} não possui regime ${isCriRoute ? 'CRI' : 'validado'} para ${patient.species}.`);
  if (!getSpeciesDrugRoutes(drug, patient.species).includes(command.route)) errors.push(`Via ${command.route} não cadastrada para ${drug.name}.`);
  if (!Number.isFinite(command.dosePerKg) || command.dosePerKg <= 0) errors.push('A dose deve ser finita e maior que zero.');
  if (command.concentrationMgMl !== undefined && (!Number.isFinite(command.concentrationMgMl) || command.concentrationMgMl <= 0)) {
    errors.push('A concentração deve ser finita e maior que zero.');
  }
  if (Boolean(command.isCRI) !== (command.route === 'CRI')) errors.push('O modo CRI e a via CRI precisam coincidir.');
  if (isCriRoute && !isSupportedCRI) errors.push(`${drug.name} possui somente dose de ataque cadastrada; a taxa CRI ainda não foi validada.`);
  if (!isCriRoute && isNativeRate) errors.push(`${drug.name} possui somente regime contínuo cadastrado; não use a taxa como dose em bólus.`);
  if (isCriRoute && command.administrationSpeed !== 'infusion_cri') errors.push('CRI exige modo de infusão contínua.');
  if (!isCriRoute && command.administrationSpeed === 'infusion_cri') errors.push('Infusão contínua exige via CRI.');
  if (command.administrationSpeed === 'bolus_rapid' && command.route !== 'IV') {
    errors.push('Bólus rápido só é válido para uma via IV que permita push; IV lento e vias extravasculares não permitem esse modo.');
  }

  return errors;
}

export interface CalculatedAdministration {
  doseAmount: number;
  volumeMl: number;
  pumpRateMlPerHour?: number;
}

/**
 * Converts the catalog dose unit into an injectable volume without assuming that
 * every product is expressed in mg/mL. Rate prescriptions return the pump rate.
 */
export function calculateAdministration(
  drug: DrugDefinition,
  dosePerKg: number,
  weightKg: number,
  concentrationMgMl: number = drug.defaultConcentrationMgMl,
  isCRI?: boolean
): CalculatedAdministration {
  const activeDoseUnit = (isCRI && drug.criDoseUnit) ? drug.criDoseUnit : drug.doseUnit;
  const doseAmount = Math.max(0, dosePerKg) * Math.max(0, weightKg);
  let volumePerPrescriptionIntervalMl: number;

  const isMcg = activeDoseUnit.startsWith('mcg') || (!activeDoseUnit.startsWith('mg') && drug.unit === 'mcg');

  if (activeDoseUnit.startsWith('ml/kg')) {
    volumePerPrescriptionIntervalMl = doseAmount;
  } else if (isMcg) {
    volumePerPrescriptionIntervalMl = doseAmount / Math.max(0.000001, concentrationMgMl * 1000);
  } else if (drug.unit === 'mEq') {
    const concentration = drug.concentrationInDoseUnitPerMl ?? 1;
    volumePerPrescriptionIntervalMl = doseAmount / Math.max(0.000001, concentration);
  } else {
    volumePerPrescriptionIntervalMl = doseAmount / Math.max(0.000001, concentrationMgMl);
  }

  let pumpRateMlPerHour: number | undefined;
  if (activeDoseUnit.endsWith('/min')) {
    pumpRateMlPerHour = volumePerPrescriptionIntervalMl * 60;
  } else if (activeDoseUnit.endsWith('/h')) {
    pumpRateMlPerHour = volumePerPrescriptionIntervalMl;
  }

  return {
    doseAmount: Number(doseAmount.toFixed(4)),
    volumeMl: Number(volumePerPrescriptionIntervalMl.toFixed(4)),
    pumpRateMlPerHour: pumpRateMlPerHour === undefined
      ? undefined
      : Number(pumpRateMlPerHour.toFixed(3)),
  };
}

export interface RoutePharmacokinetics {
  transitLagSeconds: number;
  bioavailability: number;
  absorptionHalfLifeMinutes: number;
  systemicEffectFraction: number;
  localNeuralEffectFraction: number;
}

interface ExtravascularRouteConfig {
  imBioavailability?: number;
  imAbsorptionHalfLifeMinutes?: number;
  imTransitLagSeconds?: number;
  scBioavailability?: number;
  scAbsorptionHalfLifeMinutes?: number;
  scTransitLagSeconds?: number;
}

const DRUG_EXTRAVASCULAR_CONFIGS: Record<string, ExtravascularRouteConfig> = {
  acepromazine: {
    imBioavailability: 0.78,
    imAbsorptionHalfLifeMinutes: 12.0,
    imTransitLagSeconds: 60,
    scBioavailability: 0.68,
    scAbsorptionHalfLifeMinutes: 24.0,
    scTransitLagSeconds: 120,
  },
  dexmedetomidine: {
    imBioavailability: 0.85,
    imAbsorptionHalfLifeMinutes: 8.5,
    imTransitLagSeconds: 45,
    scBioavailability: 0.74,
    scAbsorptionHalfLifeMinutes: 18.0,
    scTransitLagSeconds: 90,
  },
  xylazine: {
    imBioavailability: 0.82,
    imAbsorptionHalfLifeMinutes: 7.5,
    imTransitLagSeconds: 45,
    scBioavailability: 0.70,
    scAbsorptionHalfLifeMinutes: 16.0,
    scTransitLagSeconds: 90,
  },
  detomidine: {
    imBioavailability: 0.85,
    imAbsorptionHalfLifeMinutes: 8.0,
    imTransitLagSeconds: 45,
    scBioavailability: 0.72,
    scAbsorptionHalfLifeMinutes: 17.0,
    scTransitLagSeconds: 90,
  },
  midazolam: {
    imBioavailability: 0.90,
    imAbsorptionHalfLifeMinutes: 7.0,
    imTransitLagSeconds: 40,
    scBioavailability: 0.78,
    scAbsorptionHalfLifeMinutes: 15.0,
    scTransitLagSeconds: 75,
  },
  diazepam: {
    imBioavailability: 0.50,
    imAbsorptionHalfLifeMinutes: 26.0,
    imTransitLagSeconds: 90,
    scBioavailability: 0.40,
    scAbsorptionHalfLifeMinutes: 40.0,
    scTransitLagSeconds: 150,
  },
  ketamine: {
    imBioavailability: 0.92,
    imAbsorptionHalfLifeMinutes: 6.5,
    imTransitLagSeconds: 40,
    scBioavailability: 0.78,
    scAbsorptionHalfLifeMinutes: 14.0,
    scTransitLagSeconds: 75,
  },
  alfaxalone: {
    imBioavailability: 0.84,
    imAbsorptionHalfLifeMinutes: 7.5,
    imTransitLagSeconds: 45,
    scBioavailability: 0.72,
    scAbsorptionHalfLifeMinutes: 16.0,
    scTransitLagSeconds: 80,
  },
  morphine: {
    imBioavailability: 0.82,
    imAbsorptionHalfLifeMinutes: 11.0,
    imTransitLagSeconds: 50,
    scBioavailability: 0.72,
    scAbsorptionHalfLifeMinutes: 22.0,
    scTransitLagSeconds: 100,
  },
  methadone: {
    imBioavailability: 0.86,
    imAbsorptionHalfLifeMinutes: 10.0,
    imTransitLagSeconds: 50,
    scBioavailability: 0.75,
    scAbsorptionHalfLifeMinutes: 20.0,
    scTransitLagSeconds: 90,
  },
  butorphanol: {
    imBioavailability: 0.80,
    imAbsorptionHalfLifeMinutes: 9.0,
    imTransitLagSeconds: 45,
    scBioavailability: 0.70,
    scAbsorptionHalfLifeMinutes: 18.0,
    scTransitLagSeconds: 80,
  },
  buprenorphine: {
    imBioavailability: 0.85,
    imAbsorptionHalfLifeMinutes: 13.0,
    imTransitLagSeconds: 60,
    scBioavailability: 0.74,
    scAbsorptionHalfLifeMinutes: 25.0,
    scTransitLagSeconds: 110,
  },
  tramadol: {
    imBioavailability: 0.88,
    imAbsorptionHalfLifeMinutes: 10.5,
    imTransitLagSeconds: 45,
    scBioavailability: 0.76,
    scAbsorptionHalfLifeMinutes: 21.0,
    scTransitLagSeconds: 90,
  },
  atropine: {
    imBioavailability: 0.88,
    imAbsorptionHalfLifeMinutes: 7.5,
    imTransitLagSeconds: 40,
    scBioavailability: 0.75,
    scAbsorptionHalfLifeMinutes: 16.0,
    scTransitLagSeconds: 80,
  },
  glycopyrrolate: {
    imBioavailability: 0.85,
    imAbsorptionHalfLifeMinutes: 9.0,
    imTransitLagSeconds: 45,
    scBioavailability: 0.72,
    scAbsorptionHalfLifeMinutes: 18.0,
    scTransitLagSeconds: 90,
  },
  atipamezole: {
    imBioavailability: 0.95,
    imAbsorptionHalfLifeMinutes: 2.0,
    imTransitLagSeconds: 15,
    scBioavailability: 0.85,
    scAbsorptionHalfLifeMinutes: 8.0,
    scTransitLagSeconds: 40,
  },
  naloxone: {
    imBioavailability: 0.90,
    imAbsorptionHalfLifeMinutes: 2.2,
    imTransitLagSeconds: 15,
    scBioavailability: 0.80,
    scAbsorptionHalfLifeMinutes: 8.5,
    scTransitLagSeconds: 40,
  },
  flumazenil: {
    imBioavailability: 0.88,
    imAbsorptionHalfLifeMinutes: 2.2,
    imTransitLagSeconds: 15,
    scBioavailability: 0.78,
    scAbsorptionHalfLifeMinutes: 9.0,
    scTransitLagSeconds: 45,
  },
};

/** Route-specific delivery model. Ce remains normalized to a typical clinical dose. */
export function getRoutePharmacokinetics(
  drug: DrugDefinition,
  route: DrugRoute
): RoutePharmacokinetics {
  const onset = Math.max(0.1, drug.onsetMinutes);
  const ivLag = Math.max(0, drug.transitLagSecondsIV);
  const drugConfig = DRUG_EXTRAVASCULAR_CONFIGS[drug.id];

  switch (route) {
    case 'IM':
      return {
        transitLagSeconds: drugConfig?.imTransitLagSeconds ?? Math.max(35, onset * 60 * 0.15),
        bioavailability: drugConfig?.imBioavailability ?? 0.82,
        absorptionHalfLifeMinutes: drugConfig?.imAbsorptionHalfLifeMinutes ?? Math.max(5.0, onset * 0.75),
        systemicEffectFraction: 1,
        localNeuralEffectFraction: 0,
      };
    case 'SC':
      return {
        transitLagSeconds: drugConfig?.scTransitLagSeconds ?? Math.max(60, onset * 60 * 0.25),
        bioavailability: drugConfig?.scBioavailability ?? 0.70,
        absorptionHalfLifeMinutes: drugConfig?.scAbsorptionHalfLifeMinutes ?? Math.max(12.0, onset * 1.5),
        systemicEffectFraction: 1,
        localNeuralEffectFraction: 0,
      };
    case 'Epidural':
      return {
        transitLagSeconds: Math.max(20, onset * 60 * 0.18),
        bioavailability: 1,
        absorptionHalfLifeMinutes: Math.max(0.4, onset * 0.35),
        systemicEffectFraction: 0.18,
        localNeuralEffectFraction: 1,
      };
    case 'Local':
      return {
        transitLagSeconds: Math.max(8, onset * 60 * 0.12),
        bioavailability: 1,
        absorptionHalfLifeMinutes: Math.max(0.2, onset * 0.25),
        systemicEffectFraction: 0.08,
        localNeuralEffectFraction: 1,
      };
    case 'CRI':
      return {
        transitLagSeconds: ivLag,
        bioavailability: 1,
        absorptionHalfLifeMinutes: 0,
        systemicEffectFraction: 1,
        localNeuralEffectFraction: drug.category === 'local_anesthetic' ? 0.25 : 0,
      };
    case 'IV_slow':
    case 'IV':
    default:
      return {
        transitLagSeconds: ivLag,
        bioavailability: 1,
        absorptionHalfLifeMinutes: 0,
        systemicEffectFraction: 1,
        localNeuralEffectFraction: drug.category === 'local_anesthetic' ? 0.25 : 0,
      };
  }
}

export function isExtravascularRoute(route: DrugRoute): boolean {
  return route === 'IM' || route === 'SC' || route === 'Epidural' || route === 'Local';
}
