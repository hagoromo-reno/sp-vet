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
  if (isCRI && drug.recommendedCriDose?.[species]) {
    return drug.recommendedCriDose[species];
  }
  return drug.recommendedDose[species];
}

export function isTimeBasedDoseUnit(doseUnit?: string): boolean {
  if (!doseUnit) return false;
  return doseUnit.endsWith('/min') || doseUnit.endsWith('/h');
}

export interface AdministrationCommand {
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
  const isCriRoute = command.route === 'CRI' || Boolean(command.isCRI);
  const range = getSpeciesDoseRange(drug, patient.species, isCriRoute);
  const isNativeRate = isTimeBasedDoseUnit(drug.doseUnit);
  const hasCriRange = Boolean(drug.recommendedCriDose?.[patient.species]);
  const isSupportedCRI = isNativeRate || hasCriRange;

  if (!range) errors.push(`${drug.name} não possui regime ${isCriRoute ? 'CRI' : 'validado'} para ${patient.species}.`);
  if (!drug.supportedRoutes.includes(command.route)) errors.push(`Via ${command.route} não cadastrada para ${drug.name}.`);
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

/** Route-specific delivery model. Ce remains normalized to a typical clinical dose. */
export function getRoutePharmacokinetics(
  drug: DrugDefinition,
  route: DrugRoute
): RoutePharmacokinetics {
  const onset = Math.max(0.1, drug.onsetMinutes);
  const ivLag = Math.max(0, drug.transitLagSecondsIV);

  switch (route) {
    case 'IM':
      return {
        transitLagSeconds: Math.max(20, onset * 60 * 0.22),
        bioavailability: 0.9,
        absorptionHalfLifeMinutes: Math.max(0.35, onset * 0.42),
        systemicEffectFraction: 1,
        localNeuralEffectFraction: 0,
      };
    case 'SC':
      return {
        transitLagSeconds: Math.max(45, onset * 60 * 0.35),
        bioavailability: 0.75,
        absorptionHalfLifeMinutes: Math.max(0.75, onset * 0.7),
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
