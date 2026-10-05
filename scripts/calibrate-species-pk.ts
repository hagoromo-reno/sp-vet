import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import {
  DRUG_DISPOSITION,
  setSpeciesPkCalibrationOverride,
} from '../src/engine/pk/speciesDrugDisposition';
import { PharmacokineticModel } from '../src/engine/pharmacokineticModel';
import { createHealthyValidationPatient, createActiveDose } from '../src/validation/simulationHarness';
import type { ActiveDrugDose, DrugDefinition, SpeciesType } from '../src/types/simulator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CalibrationTarget {
  drugId: string;
  drug: DrugDefinition;
  species: SpeciesType;
  targetRatio: number; // k10 species / k10 dog
}

interface EmergentResult {
  target: CalibrationTarget;
  dogLambdaZ: number;
  dogTerminalHalfLifeMin: number;
  speciesLambdaZ: number;
  speciesTerminalHalfLifeMin: number;
  emergentRatio: number;
  residualPct: number;
  correctionFactor: number;
}

const TARGET_SPECIES: SpeciesType[] = ['feline', 'equine', 'bovine'];
const MAX_ITERATIONS = 5;
const MIN_CORRECTION = 0.60;
const MAX_CORRECTION = 1.60;
const CONVERGENCE_RESIDUAL_PCT = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Simulates an IV bolus and estimates terminal elimination rate constant (lambda_z)
 * via log-linear regression of the terminal disposition phase.
 */
function measureTerminalLambdaZ(
  drug: DrugDefinition,
  species: SpeciesType,
): { lambdaZ: number; terminalHalfLifeMin: number } {
  const patient = createHealthyValidationPatient(species);
  const route = drug.supportedRoutes.includes('IV') ? 'IV' : drug.supportedRoutes[0];
  const dose = createActiveDose(patient, drug.id, 'typical', { route });
  dose.dosePerKg = 1;
  dose.deliveryDurationSec = 1;
  dose.transitLagRemainingSec = 0;
  dose.isCRI = false;
  dose.currentCp = 0;
  dose.currentCe = 0;
  dose.isFullyDelivered = false;

  const betaMin = Math.max(1, drug.halfLifeBeta);
  const totalSimMin = Math.max(30, betaMin * 4.5);
  const totalSimSec = totalSimMin * 60;
  const dtSec = clamp(betaMin * 60 / 120, 0.5, 10);
  const numSteps = Math.ceil(totalSimSec / dtSec);

  const timePointsMin: number[] = [];
  const cpPoints: number[] = [];
  let currentDose = dose;
  let cpMax = 0;

  for (let step = 0; step < numSteps; step += 1) {
    const res = PharmacokineticModel.step(
      dtSec,
      patient,
      drug,
      currentDose,
      1, // typicalBolusDosePerKg
      undefined,
      1.0, // systemicClearanceModifier
      1.0, // peripheralPerfusion
      1.0, // absorptionRateMultiplier
      1.0, // metaboliteClearanceModifier
    );

    const timeMin = ((step + 1) * dtSec) / 60;
    const cp = res.currentCp;
    if (cp > cpMax) cpMax = cp;

    timePointsMin.push(timeMin);
    cpPoints.push(cp);

    currentDose = {
      ...currentDose,
      currentCp: res.currentCp,
      currentCe: res.currentCe,
      deliveryElapsedSec: res.deliveryElapsedSec,
      isFullyDelivered: res.isFullyDelivered,
      pkCompartments: res.pkCompartments,
    };
  }

  // Identify terminal points: well past distribution (t >= 1.2 * beta or cp <= 0.40 * max)
  // and above numerical floor (cp >= 0.0005 * max)
  const regressionX: number[] = [];
  const regressionY: number[] = [];

  for (let i = 0; i < timePointsMin.length; i += 1) {
    const t = timePointsMin[i];
    const cp = cpPoints[i];
    if (t >= betaMin * 1.2 && cp <= cpMax * 0.40 && cp >= cpMax * 0.0005) {
      regressionX.push(t);
      regressionY.push(Math.log(cp));
    }
  }

  // Fallback if distribution was unusually fast/slow: take the last 25% of points
  if (regressionX.length < 5) {
    const startIdx = Math.floor(timePointsMin.length * 0.7);
    for (let i = startIdx; i < timePointsMin.length; i += 1) {
      const cp = cpPoints[i];
      if (cp > 1e-12) {
        regressionX.push(timePointsMin[i]);
        regressionY.push(Math.log(cp));
      }
    }
  }

  // Linear regression: ln(Cp) = intercept - lambda_z * t
  const n = regressionX.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    sumX += regressionX[i];
    sumY += regressionY[i];
    sumXY += regressionX[i] * regressionY[i];
    sumXX += regressionX[i] * regressionX[i];
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = Math.abs(denominator) > 1e-12 ? (n * sumXY - sumX * sumY) / denominator : -Math.LN2 / betaMin;
  const lambdaZ = Math.max(1e-5, -slope);
  const terminalHalfLifeMin = Math.LN2 / lambdaZ;

  return { lambdaZ, terminalHalfLifeMin };
}

function runCalibration(): void {
  console.log('========================================================================');
  console.log('SP-VET: Calibração Farmacocinética de Disposição Espécie-Específica');
  console.log('Metodologia: Mapeamento Mamilar Não-Linear & Análise NCA de Eliminação');
  console.log('========================================================================\n');

  // 1. Gather all targets with published literature ratios
  const targets: CalibrationTarget[] = [];
  for (const drug of VETERINARY_DRUG_DATABASE) {
    const disposition = DRUG_DISPOSITION[drug.id];
    if (!disposition?.speciesEliminationRatio) continue;

    for (const species of TARGET_SPECIES) {
      const targetRatio = disposition.speciesEliminationRatio[species];
      if (targetRatio !== undefined && targetRatio > 0) {
        targets.push({ drugId: drug.id, drug, species, targetRatio });
      }
    }
  }

  console.log(`Pares fármaco-espécie com calibração de literatura identificados: ${targets.length}`);

  // 2. Precompute canine baseline lambdaZ for each drug
  const dogBaselines: Record<string, { lambdaZ: number; terminalHalfLifeMin: number }> = {};
  setSpeciesPkCalibrationOverride({}); // reset to neutral 1.0

  for (const drug of VETERINARY_DRUG_DATABASE) {
    if (targets.some((t) => t.drugId === drug.id)) {
      dogBaselines[drug.id] = measureTerminalLambdaZ(drug, 'canine');
    }
  }

  // 3. Iterative calibration loop
  const calibrationMap: Record<string, number> = {};
  for (const target of targets) {
    calibrationMap[`${target.drugId}:${target.species}`] = 1.0;
  }

  let finalResults: EmergentResult[] = [];
  let converged = false;
  let iteration = 0;

  for (iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    setSpeciesPkCalibrationOverride(calibrationMap);
    const results: EmergentResult[] = [];
    let maxResidual = 0;

    for (const target of targets) {
      const dog = dogBaselines[target.drugId];
      const sp = measureTerminalLambdaZ(target.drug, target.species);
      const emergentRatio = sp.lambdaZ / Math.max(1e-5, dog.lambdaZ);
      const residualPct = ((emergentRatio - target.targetRatio) / target.targetRatio) * 100;
      const absResidual = Math.abs(residualPct);
      if (absResidual > maxResidual) maxResidual = absResidual;

      const currentCorr = calibrationMap[`${target.drugId}:${target.species}`] ?? 1.0;
      results.push({
        target,
        dogLambdaZ: dog.lambdaZ,
        dogTerminalHalfLifeMin: dog.terminalHalfLifeMin,
        speciesLambdaZ: sp.lambdaZ,
        speciesTerminalHalfLifeMin: sp.terminalHalfLifeMin,
        emergentRatio,
        residualPct,
        correctionFactor: currentCorr,
      });

      // Update factor for next iteration: damped proportional update clamped to [0.60, 1.60]
      // emergentRatio = sp.lambdaZ / dog.lambdaZ. If emergent < target, we need higher lambdaZ (higher factor)
      const ratioOfTarget = target.targetRatio / Math.max(0.01, emergentRatio);
      const updatedCorr = clamp(currentCorr * Math.pow(ratioOfTarget, 0.85), MIN_CORRECTION, MAX_CORRECTION);
      calibrationMap[`${target.drugId}:${target.species}`] = Number(updatedCorr.toFixed(3));
    }

    finalResults = results;
    console.log(`Iteração ${iteration}/${MAX_ITERATIONS} — Resíduo máximo: ${maxResidual.toFixed(2)}%`);

    if (maxResidual <= CONVERGENCE_RESIDUAL_PCT) {
      converged = true;
      console.log(`✓ Convergência alcançada na iteração ${iteration} (tolerância <= ${CONVERGENCE_RESIDUAL_PCT}%)\n`);
      break;
    }
  }

  // 4. Print detailed convergence table
  console.log('\nTabela de Calibração Farmacocinética Final:');
  console.log('Fármaco\tEspécie\tAlvo Lit.\tEmergente\tt½ Cão (min)\tt½ Esp (min)\tFator Corr.\tResíduo %');
  for (const res of finalResults) {
    console.log([
      res.target.drugId.padEnd(16),
      res.target.species.padEnd(8),
      res.target.targetRatio.toFixed(2),
      res.emergentRatio.toFixed(2),
      res.dogTerminalHalfLifeMin.toFixed(1),
      res.speciesTerminalHalfLifeMin.toFixed(1),
      res.correctionFactor.toFixed(3),
      `${res.residualPct >= 0 ? '+' : ''}${res.residualPct.toFixed(1)}%`,
    ].join('\t'));
  }

  // 5. Generate src/engine/pk/speciesPkCalibration.generated.ts
  const outputPath = path.resolve(__dirname, '../src/engine/pk/speciesPkCalibration.generated.ts');
  const maxResidualPct = Math.max(...finalResults.map((r) => Math.abs(r.residualPct)));

  const fileContent = `/**
 * AUTO-GENERATED by scripts/calibrate-species-pk.ts — bounded correction factors
 * (${MIN_CORRECTION.toFixed(1)}–${MAX_CORRECTION.toFixed(1)}) that make the emergent terminal half-life ratio of the normalized
 * 3-compartment solver match the literature species ratio. Do not edit by hand;
 * rerun \`npm run calibrate:pk\`.
 */
export const SPECIES_PK_CALIBRATION: Record<string, number> = ${JSON.stringify(calibrationMap, null, 2)};

export const SPECIES_PK_CALIBRATION_META = {
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  iterations: ${iteration > MAX_ITERATIONS ? MAX_ITERATIONS : iteration},
  converged: ${converged},
  maxResidualPct: ${Number(maxResidualPct.toFixed(2))},
};
`;

  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`\n✓ Arquivo gerado com sucesso: ${outputPath}`);
  console.log(`✓ Total de fatores ajustados: ${Object.keys(calibrationMap).length}`);
  console.log(`✓ Resíduo máximo final: ${maxResidualPct.toFixed(2)}%\n`);
}

runCalibration();
