import type { SpeciesType } from '../types/simulator';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';

/** Shared educational calibration, not a measured clinical DO2 critical value. */
export function getOxygenDeliveryThresholds(species: SpeciesType) {
  const demand = SPECIES_CELLULAR_CONFIGS[species]?.oxygenConsumptionMlKgMin ?? 5.5;
  return { critical: demand * 1.5, recovery: demand * 1.8, reserve: demand * 0.8 };
}

export function getOxygenDeliveryDeficit(species: SpeciesType, delivery: number, utilization = 1): number {
  const { critical } = getOxygenDeliveryThresholds(species);
  return Math.min(1, Math.max(0, (critical - delivery * utilization) / critical));
}

/** Lactate is handled through oxidative metabolism/gluconeogenesis, not UGT. */
export function getLactateClearanceMultiplier(hepaticPerfusion: number, renalPerfusion: number): number {
  return Math.min(1.1, Math.max(0.05, hepaticPerfusion * 0.7 + renalPerfusion * 0.3));
}

/**
 * State for persistent alveolar wash-in and circulation transit delay tracking
 */
export interface OxygenTransportState {
  alveolarFiO2: number; // Gradual wash-in of oxygen in the FRC/circuit
  peripheralLagPaO2: number; // Delayed PaO2 arriving at peripheral capillary beds
  probeSmoothedSpO2: number; // Pulse oximeter photoplethysmograph moving average
  intubatedSecondsAccumulated: number; // Time elapsed under active high-O2 ventilation
}

export interface OxygenTransportOutputs {
  targetFiO2: number;
  alveolarFiO2: number;
  pAO2: number; // mmHg (Alveolar O2 tension)
  paO2: number; // mmHg (Arterial O2 tension)
  saO2: number; // % (Arterial hemoglobin saturation)
  pulseOximetrySpO2: number; // % (Measured bedside peripheral SpO2)
  caO2: number; // mL O2 / dL blood (Arterial oxygen content)
  cvO2: number; // mL O2 / dL blood (Mixed venous oxygen content)
  p50Effective: number; // mmHg (Dynamic hemoglobin affinity)
  oxygenDeliveryMlMin: number; // DO2
  shuntFractionCalculated: number; // Qs/Qt
}

/**
 * Biomechanical & Biochemical Oxygen Cascade and Hemoglobin Dissociation Model:
 * 1. Denitrogenation Wash-in: Alveolar gas exchange dynamics (FRC + circuit wash-in tau ~ 35-70s).
 * 2. Severinghaus-Ellis Oxyhemoglobin Dissociation with Bohr effect (pH, PaCO2, Temp, 2,3-DPG).
 * 3. Alveolar-Capillary shunt admixture (Cc'O2 and CvO2 mass balance).
 * 4. Lung-to-periphery circulatory transit delay (12-25s) and pulse oximeter optical averaging.
 */
export class OxygenTransportEngine {
  /**
   * Evaluates Oxyhemoglobin Saturation (SaO2, 0-100%) from PaO2 (mmHg) using the Severinghaus equation
   * with complete physiological Bohr shift (pH, PaCO2, Temperature).
   */
  public static calculateSaO2(
    paO2: number,
    pH: number = 7.40,
    paCO2: number = 40,
    temperatureC: number = 38.0,
    speciesBaselineP50: number = 28.0
  ): { saO2: number; p50Effective: number } {
    if (paO2 <= 0) {
      return { saO2: 0, p50Effective: speciesBaselineP50 };
    }

    // Bohr effect shifts P50:
    // - Acidosis (low pH) / hypercapnia / hyperthermia shift curve to RIGHT (higher P50 -> lower affinity, promotes O2 unloading)
    // - Alkalosis (high pH) / hypocapnia / hypothermia shift curve to LEFT (lower P50 -> higher affinity, tighter binding)
    const deltaPh = 7.40 - pH;
    const deltaCo2 = Math.log10(Math.max(10, paCO2) / 40.0);
    const deltaTemp = temperatureC - 38.0;

    const p50ShiftMultiplier = Math.pow(10, (0.48 * deltaPh) + (0.06 * deltaCo2) + (0.024 * deltaTemp));
    const p50Effective = Math.max(16.0, Math.min(42.0, speciesBaselineP50 * p50ShiftMultiplier));

    // Normalized PaO2 aligned with standard Severinghaus reference P50 (26.6 mmHg)
    const virtualPaO2 = Math.max(0.1, paO2 * (26.6 / p50Effective));

    // Severinghaus formulation:
    // SaO2 = 100 * [(((virtualPaO2^3 + 150*virtualPaO2)^-1 * 23400) + 1)^-1]
    const p3 = Math.pow(virtualPaO2, 3);
    const denom = p3 + 150 * virtualPaO2;
    const saO2Fraction = denom / (denom + 23400);
    const saO2 = Math.min(100.0, Math.max(0.0, saO2Fraction * 100.0));

    return { saO2, p50Effective };
  }

  /**
   * Dynamic Oxygenation step accounting for alveolar denitrogenation wash-in,
   * biochemical shunt mixing, and circulatory probe response.
   */
  public static stepOxygenTransport(
    dtSeconds: number,
    species: SpeciesType,
    weightKg: number,
    previousPaO2: number,
    previousSpO2: number,
    previousState: OxygenTransportState,
    isIntubatedTracheal: boolean,
    isVentilating: boolean,
    oxygenFlowLMin: number,
    isOxygenFlushActive: boolean,
    currentPaCO2: number,
    currentPH: number,
    temperatureC: number,
    cardiacOutputRatio: number = 1.0,
    pulmonaryShuntPct: number = 8.0,
    hematocritPct: number = 40.0,
    hasSevereAirwayLeak: boolean = false
  ): { outputs: OxygenTransportOutputs; nextState: OxygenTransportState } {
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[species] || SPECIES_CELLULAR_CONFIGS.canine;
    const baselineP50 = speciesConfig.baselineP50MmHg || 28.0;

    // 1. Inspired Oxygen (Target FiO2)
    let targetCircuitFiO2 = 0.21;
    if (isOxygenFlushActive) {
      targetCircuitFiO2 = 0.99;
    } else if (isIntubatedTracheal) {
      if (oxygenFlowLMin > 0.08) {
        targetCircuitFiO2 = hasSevereAirwayLeak ? 0.65 : 0.98;
      } else {
        // Hypoxic mixture if O2 is off in closed circuit
        targetCircuitFiO2 = 0.16;
      }
    } else {
      // Room air
      targetCircuitFiO2 = 0.21;
    }

    // 2. Alveolar Nitrogen Wash-out / Wash-in Kinetics (Denitrogenation):
    let currentAlveolarFiO2 = previousState.alveolarFiO2 ?? 0.21;
    const frcMl = Math.max(50, weightKg * speciesConfig.functionalResidualCapacityMlKg);
    const circuitVolumeMl = isIntubatedTracheal ? Math.max(1500, Math.min(6000, weightKg * 10)) : 200;
    const effectiveWashRate = isOxygenFlushActive
      ? 0.35 // Flush rapidly displaces circuit in ~5-8s
      : isVentilating
      ? Math.max(0.025, Math.min(0.08, (oxygenFlowLMin * 1000 + weightKg * 60) / (frcMl + circuitVolumeMl)))
      : 0.005; // Very slow passive diffusion without ventilation

    const washAlpha = 1.0 - Math.exp(-dtSeconds * effectiveWashRate);
    currentAlveolarFiO2 = currentAlveolarFiO2 + (targetCircuitFiO2 - currentAlveolarFiO2) * washAlpha;
    currentAlveolarFiO2 = Math.min(0.99, Math.max(0.12, currentAlveolarFiO2));

    // 3. Alveolar Oxygen Tension (PAO2) via Alveolar Gas Equation
    // PAO2 = FiO2 * (PB - PH2O) - (PaCO2 / R)
    // At sea level: PB = 760 mmHg, PH2O = 47 mmHg -> PB - 47 = 713 mmHg. R ~ 0.8
    const rq = 0.82;
    const pAO2 = Math.max(10, currentAlveolarFiO2 * 713 - (Math.max(10, currentPaCO2) / rq));

    // 4. Intrapulmonary Shunt (Qs/Qt) and Arterial Oxygen Tension (PaO2)
    // Shunt directly mixes mixed venous blood (low O2) into pulmonary end-capillary blood
    const safeShuntPct = Math.max(3.0, Math.min(65.0, pulmonaryShuntPct));
    const effectiveShuntFraction = safeShuntPct / 100.0;

    // Ideal pulmonary capillary O2 reaches equilibrium with alveolar gas (PAO2)
    const idealCapillaryPaO2 = pAO2;
    const { saO2: endCapillarySaO2 } = OxygenTransportEngine.calculateSaO2(
      idealCapillaryPaO2,
      currentPH,
      currentPaCO2,
      temperatureC,
      baselineP50
    );

    // Hemoglobin concentration (g/dL) approximated from hematocrit: Hb ~ Hct / 3.0
    const hemoglobinGDl = Math.max(4.0, hematocritPct / 2.95);

    // End-capillary oxygen content (Cc'O2)
    const ccPrimeO2 = (hemoglobinGDl * 1.34 * (endCapillarySaO2 / 100.0)) + (0.0031 * idealCapillaryPaO2);

    // Whole body oxygen consumption VO2 (mL/min)
    const vo2MlMin = weightKg * speciesConfig.oxygenConsumptionMlKgMin;

    // Cardiac Output (L/min)
    const baselineCardiacOutputLMin = (weightKg * 0.08) * 1.1; // ~85-90 mL/kg/min
    const activeCardiacOutputLMin = Math.max(0.15, baselineCardiacOutputLMin * cardiacOutputRatio);

    // Mixed venous oxygen content CvO2 derived from Fick principle:
    // CaO2 - CvO2 = VO2 / (CO * 10)
    const aVDiff = Math.min(12.0, Math.max(2.5, (vo2MlMin / (activeCardiacOutputLMin * 10.0))));
    const cvO2Estimated = Math.max(2.0, ccPrimeO2 - aVDiff * 1.25);

    // Shunt Equation: CaO2 = Cc'O2 * (1 - Qs/Qt) + CvO2 * (Qs/Qt)
    const caO2Calculated = ccPrimeO2 * (1.0 - effectiveShuntFraction) + cvO2Estimated * effectiveShuntFraction;

    // Target arterial PaO2 derived from CaO2:
    // In hyperoxia (high FiO2), dissolved oxygen (0.0031 * PaO2) is significant
    let targetPaO2: number;
    if (currentAlveolarFiO2 > 0.40) {
      // Linearized high PaO2 plateau with shunt drop
      targetPaO2 = Math.max(
        25,
        pAO2 * Math.exp(-effectiveShuntFraction * 2.8)
      );
    } else {
      // Normoxic / Hypoxic curve
      targetPaO2 = Math.max(
        15,
        pAO2 * (1.0 - effectiveShuntFraction * 1.6)
      );
    }

    // Dynamic PaO2 equilibration in blood:
    let newPaO2 = previousPaO2;
    if (!isVentilating) {
      // Apnea desaturation rate: consumption depletes stores
      const desatRate = 3.5 * (speciesConfig.oxygenConsumptionMlKgMin / 5.0) * (40 / speciesConfig.functionalResidualCapacityMlKg);
      newPaO2 = Math.max(12, newPaO2 - dtSeconds * desatRate);
    } else {
      // Re-oxygenation or wash-out towards target PaO2
      // Gradual physiological blood pool wash: tau ~ 8-12s
      const paO2Tau = 9.0;
      const paO2Alpha = 1.0 - Math.exp(-dtSeconds / paO2Tau);
      newPaO2 = newPaO2 + (targetPaO2 - newPaO2) * paO2Alpha;
    }

    // Calculate arterial SaO2 from current arterial PaO2
    const { saO2: arterialSaO2, p50Effective } = OxygenTransportEngine.calculateSaO2(
      newPaO2,
      currentPH,
      currentPaCO2,
      temperatureC,
      baselineP50
    );

    // 5. Circulatory Transit Delay and Bedside Pulse Oximeter Probe Response:
    // Arterial blood takes 12-25 seconds to travel from the pulmonary veins through the aorta
    // to the peripheral pulse oximeter probe (tongue, digit, lip, ear).
    // Plus, the monitor uses a moving average (6-8 beats) for signal stability.
    let peripheralLagPaO2 = previousState.peripheralLagPaO2 ?? previousPaO2;
    const transitDelaySec = Math.max(8.0, 16.0 / Math.max(0.35, cardiacOutputRatio));
    const transitAlpha = 1.0 - Math.exp(-dtSeconds / transitDelaySec);
    peripheralLagPaO2 = peripheralLagPaO2 + (newPaO2 - peripheralLagPaO2) * transitAlpha;

    // Bedside SpO2 derived from peripheral blood arrival
    const { saO2: peripheralRawSpO2 } = OxygenTransportEngine.calculateSaO2(
      peripheralLagPaO2,
      currentPH,
      currentPaCO2,
      temperatureC,
      baselineP50
    );

    // Pulse oximeter moving average filter (tau ~ 4s)
    let probeSmoothedSpO2 = previousState.probeSmoothedSpO2 ?? previousSpO2;
    const filterAlpha = 1.0 - Math.exp(-dtSeconds / 4.0);
    probeSmoothedSpO2 = probeSmoothedSpO2 + (peripheralRawSpO2 - probeSmoothedSpO2) * filterAlpha;

    const reportedSpO2 = Math.min(100.0, Math.max(0.0, Number(probeSmoothedSpO2.toFixed(1))));

    // Oxygen delivery DO2 = CO * CaO2 * 10 (mL O2 / min)
    const do2 = activeCardiacOutputLMin * caO2Calculated * 10;

    const nextState: OxygenTransportState = {
      alveolarFiO2: currentAlveolarFiO2,
      peripheralLagPaO2,
      probeSmoothedSpO2,
      intubatedSecondsAccumulated: isIntubatedTracheal
        ? (previousState.intubatedSecondsAccumulated || 0) + dtSeconds
        : 0,
    };

    const outputs: OxygenTransportOutputs = {
      targetFiO2: targetCircuitFiO2,
      alveolarFiO2: currentAlveolarFiO2,
      pAO2,
      paO2: Number(newPaO2.toFixed(1)),
      saO2: Number(arterialSaO2.toFixed(1)),
      pulseOximetrySpO2: reportedSpO2,
      caO2: Number(caO2Calculated.toFixed(2)),
      cvO2: Number(cvO2Estimated.toFixed(2)),
      p50Effective: Number(p50Effective.toFixed(1)),
      oxygenDeliveryMlMin: Math.round(do2),
      shuntFractionCalculated: Number((effectiveShuntFraction * 100).toFixed(1)),
    };

    return { outputs, nextState };
  }
}
