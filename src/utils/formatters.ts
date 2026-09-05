/**
 * Utility functions for clean, medically standard decimal and numeric formatting.
 * Eliminates IEEE-754 precision artifacts (e.g., 0.00000000000000000000000000000)
 * and limits values to at most 2 decimal places with comma or dot according to locale.
 */

/**
 * Formats any number to a maximum of decimals (default 2).
 * Trims redundant trailing zeros by default, or pads if padZeros is true.
 * Returns '0,00' or '0' for null/undefined/NaN.
 */
export function formatDecimal(
  value: number | null | undefined,
  decimals = 2,
  padZeros = false
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return padZeros ? '0,' + '0'.repeat(decimals) : '0';
  }

  // Handle tiny numbers close to zero (e.g. 1e-12) to avoid -0 or long float strings
  if (Math.abs(value) < 1e-7) {
    return padZeros ? '0,' + '0'.repeat(decimals) : '0';
  }

  const fixed = value.toFixed(decimals);
  if (!padZeros && fixed.includes('.')) {
    const trimmed = fixed.replace(/\.?0+$/, '');
    return trimmed.replace('.', ',');
  }
  return fixed.replace('.', ',');
}

/**
 * Formats drug doses and volumes intelligently:
 * - If value >= 10: up to 1 decimal place (e.g. "12,5" mL)
 * - If value >= 1: up to 2 decimal places (e.g. "1,25" mL)
 * - If value < 1: up to 3 decimal places if small (e.g. "0,03" ou "0,005" mL)
 */
export function formatDose(
  value: number | null | undefined,
  unit?: string
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return unit ? `0 ${unit}` : '0';
  }

  if (Math.abs(value) < 1e-7) {
    return unit ? `0 ${unit}` : '0';
  }

  let decimals = 2;
  const abs = Math.abs(value);
  if (abs >= 10) {
    decimals = 1;
  } else if (abs < 0.05 && abs > 0) {
    decimals = 3;
  }

  const formatted = formatDecimal(value, decimals, false);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Formats physiological pressures (PAM, PAS, PAD, Paw) as clean rounded integers.
 */
export function formatPressure(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return String(Math.round(value));
}

/**
 * Formats heart rate / respiratory rate as clean rounded integers.
 */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return String(Math.round(value));
}

/**
 * Formats body temperature with 1 decimal place (e.g., "37,5°C").
 */
export function formatTemperature(
  value: number | null | undefined,
  includeUnit = true
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return includeUnit ? '0,0°C' : '0,0';
  }
  const formatted = formatDecimal(value, 1, true);
  return includeUnit ? `${formatted}°C` : formatted;
}
import type { SpeciesType } from '../types/simulator';

const SPECIES_LABELS: Record<SpeciesType, string> = {
  canine: 'canino', feline: 'felino', equine: 'equino', bovine: 'bovino', rabbit: 'coelho', avian: 'ave',
};

export function formatSpecies(species: SpeciesType): string {
  return SPECIES_LABELS[species];
}
