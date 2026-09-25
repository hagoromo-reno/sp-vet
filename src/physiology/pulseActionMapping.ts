import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import type { ActiveDrugDose } from '../types/simulator';
import type { PulseDrugActionInput } from './protocol';

export const PULSE_SUBSTANCE_BY_DRUG_ID: Readonly<Record<string, string>> = {
  epinephrine: 'Epinephrine',
  etomidate: 'Etomidate',
  fentanyl: 'Fentanyl',
  ketamine: 'Ketamine',
  midazolam: 'Midazolam',
  morphine: 'Morphine',
  norepinephrine: 'Norepinephrine',
  propofol: 'Propofol',
};

const toMilligrams = (amount: number, unit: string): number | undefined => {
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  if (unit.startsWith('mcg')) return amount / 1000;
  if (unit.startsWith('mg')) return amount;
  if (unit.startsWith('g/')) return amount * 1000;
  return undefined;
};

/**
 * Produces a dimensional, auditable Pulse action. Unsupported mappings remain
 * explicit so the native worker can report coverage instead of silently
 * ignoring an intervention or reusing a pharmacologically different drug.
 */
export const mapDoseToPulseAction = (dose: ActiveDrugDose): PulseDrugActionInput => {
  const definition = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === dose.drugId);
  const pulseSubstance = PULSE_SUBSTANCE_BY_DRUG_ID[dose.drugId];
  if (!definition || !pulseSubstance) {
    return {
      status: definition ? 'hybrid' : 'unsupported',
      reasonPt: definition
        ? 'Farmacocinética e mecanismos veterinários acoplados aos circuitos Pulse pela ponte híbrida.'
        : 'Substância ausente do catálogo farmacológico da aplicação.',
    };
  }

  if (!['IV', 'IV_slow', 'IM', 'CRI'].includes(dose.route)) {
    return {
      status: 'hybrid',
      reasonPt: `A via ${dose.route} usa a farmacocinética veterinária e a ponte farmacodinâmica Pulse.`,
    };
  }

  const activeUnit = dose.isCRI ? (definition.criDoseUnit || definition.doseUnit) : definition.doseUnit;
  const massMg = toMilligrams(dose.doseAmount, activeUnit);
  if (massMg === undefined || !(dose.volumeMl > 0)) {
    return {
      status: 'hybrid',
      reasonPt: `A unidade ${activeUnit} permanece no modelo veterinário para evitar conversão nativa ambígua.`,
    };
  }

  const concentrationMgMl = massMg / dose.volumeMl;
  if (dose.isCRI) {
    const infusionRateMlPerMin = (dose.criRateMlPerHour || 0) / 60;
    if (!(infusionRateMlPerMin >= 0) || !Number.isFinite(infusionRateMlPerMin)) {
      return { status: 'unsupported', reasonPt: 'Taxa volumétrica da CRI ausente ou inválida.' };
    }
    return {
      status: 'native',
      pulseSubstance,
      mode: 'infusion',
      route: 'CRI',
      concentrationMgMl,
      solutionVolumeMl: dose.volumeMl,
      infusionRateMlPerMin,
      infusionRunning: dose.isInfusionRunning !== false,
    };
  }

  return {
    status: 'native',
    pulseSubstance,
    mode: 'bolus',
    route: dose.route,
    totalMassMg: massMg,
    solutionVolumeMl: dose.volumeMl,
    concentrationMgMl,
    administrationDurationSeconds: Math.max(0.1, dose.deliveryDurationSec || 2),
  };
};
