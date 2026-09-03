import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import { PHARMACOLOGY_EXPECTATIONS, RelativeTrendExpectation } from '../src/validation/pharmacologyExpectations';
import {
  DoseLevel,
  TraceMetrics,
  administerDrug,
  advanceSimulation,
  createDefaultEquipment,
  createHealthyValidationPatient,
  createSimulationState,
  defaultObservationSeconds,
  summarizeTrace,
} from '../src/validation/simulationHarness';
import { DrugDefinition, SpeciesType, VitalSigns } from '../src/types/simulator';

interface CaseResult {
  drugId: string;
  drugName: string;
  species: SpeciesType;
  doseLevel: DoseLevel;
  dosePerKg: number;
  doseUnit: string;
  route: string;
  observationSeconds: number;
  metrics: TraceMetrics;
  failures: string[];
}

const DOSE_LEVELS: DoseLevel[] = ['min', 'typical', 'max'];
const SPECIES: SpeciesType[] = ['canine', 'feline', 'equine', 'bovine', 'rabbit', 'avian'];

function cliValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function explicitSpecies(drug: DrugDefinition): SpeciesType[] {
  return SPECIES.filter((species) => Object.prototype.hasOwnProperty.call(drug.recommendedDose, species));
}

function needsProtectedVentilation(drug: DrugDefinition): boolean {
  return drug.category === 'induction' || drug.category === 'nmba';
}

function vitalMetric(vitals: VitalSigns, metric: RelativeTrendExpectation['metric']): number {
  if (metric === 'heartRate') return vitals.heartRate;
  if (metric === 'map') return vitals.meanArterialPressure;
  return vitals.respiratoryRate;
}

function pairedFractionalDeltas(
  treated: ReturnType<typeof createSimulationState>['frames'],
  control: ReturnType<typeof createSimulationState>['frames'],
  metric: RelativeTrendExpectation['metric']
): number[] {
  const count = Math.min(treated.length, control.length);
  const deltas: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const reference = vitalMetric(control[index].vitals, metric);
    const observed = vitalMetric(treated[index].vitals, metric);
    deltas.push((observed - reference) / Math.max(1, Math.abs(reference)));
  }
  return deltas;
}

function validateCase(
  drug: DrugDefinition,
  species: SpeciesType,
  doseLevel: DoseLevel
): CaseResult {
  const expectation = PHARMACOLOGY_EXPECTATIONS.find((item) => item.drugId === drug.id);
  if (!expectation) throw new Error(`Contrato clínico ausente para ${drug.id}`);
  const patient = createHealthyValidationPatient(species);
  const protectedVentilation = needsProtectedVentilation(drug);
  const equipment = createDefaultEquipment(patient, protectedVentilation ? {
    intubationStatus: 'intubated_tracheal',
    cuffPressureCmH2O: 18,
    ventilatorMode: 'cmv_volume',
    isVentilatorActive: true,
    oxygenFlowLMin: Math.max(1, patient.weightKg * 0.05),
  } : {});
  const treated = createSimulationState(patient, equipment);
  const control = createSimulationState(patient, equipment);
  administerDrug(treated, drug.id, doseLevel);
  const administered = treated.doses[0];
  const observationSeconds = Math.min(1800, defaultObservationSeconds(drug.id, administered.route));
  advanceSimulation(treated, observationSeconds, { dtSeconds: 2 });
  advanceSimulation(control, observationSeconds, { dtSeconds: 2 });
  const metrics = summarizeTrace(treated.frames);
  const failures: string[] = [];

  const numericMetrics = Object.entries(metrics).filter(([, value]) => typeof value === 'number') as [string, number][];
  for (const [name, value] of numericMetrics) {
    if (!Number.isFinite(value)) failures.push(`${name} não finito`);
  }
  if (metrics.peakEffectSiteExposure < 0.02) failures.push('fármaco não alcançou o sítio efetor');
  if (metrics.cardiacArrestOccurred) failures.push('parada cardíaca na faixa terapêutica em cenário protegido/controlado');

  const speciesFloorFactor = species === 'avian' ? 0.82 : species === 'rabbit' ? 0.88 : 1;
  for (const signal of expectation.signals) {
    const observed = metrics[signal.metric];
    const minimum = signal.minimum?.[doseLevel];
    const maximum = signal.maximum?.[doseLevel];
    if (minimum !== undefined && observed < minimum * speciesFloorFactor) {
      failures.push(`${signal.metric} ${observed.toFixed(3)} < mínimo ${minimum.toFixed(3)}`);
    }
    if (maximum !== undefined && observed > maximum + 0.015) {
      failures.push(`${signal.metric} ${observed.toFixed(3)} > máximo ${maximum.toFixed(3)}`);
    }
  }

  if (doseLevel === 'typical') {
    for (const trend of expectation.relativeTrends || []) {
      if (trend.excludeSpecies?.includes(species)) continue;
      const deltas = pairedFractionalDeltas(treated.frames, control.frames, trend.metric);
      const minDelta = Math.min(...deltas);
      const maxDelta = Math.max(...deltas);
      const maxAbsoluteDelta = Math.max(...deltas.map(Math.abs));
      if (trend.direction === 'increase' && maxDelta < (trend.minimumFraction || 0)) {
        failures.push(`${trend.metric} não aumentou ${(100 * (trend.minimumFraction || 0)).toFixed(0)}% (máx. ${(100 * maxDelta).toFixed(1)}%)`);
      }
      if (trend.direction === 'decrease' && minDelta > -(trend.minimumFraction || 0)) {
        failures.push(`${trend.metric} não reduziu ${(100 * (trend.minimumFraction || 0)).toFixed(0)}% (mín. ${(100 * minDelta).toFixed(1)}%)`);
      }
      if (trend.direction === 'preserve' && maxAbsoluteDelta > (trend.toleranceFraction || 0.1)) {
        failures.push(`${trend.metric} variou ${(100 * maxAbsoluteDelta).toFixed(1)}%, acima da tolerância`);
      }
    }
  }

  return {
    drugId: drug.id,
    drugName: drug.name,
    species,
    doseLevel,
    dosePerKg: administered.dosePerKg,
    doseUnit: drug.doseUnit,
    route: administered.route,
    observationSeconds,
    metrics,
    failures,
  };
}

function addDoseOrderingFailures(results: CaseResult[]): void {
  const groups = new Map<string, CaseResult[]>();
  for (const result of results) {
    const key = `${result.drugId}:${result.species}`;
    groups.set(key, [...(groups.get(key) || []), result]);
  }
  for (const group of groups.values()) {
    if (group.length !== 3) continue;
    const ordered = DOSE_LEVELS.map((level) => group.find((item) => item.doseLevel === level)!);
    const ce = ordered.map((item) => item.metrics.peakEffectSiteExposure);
    if (ce[1] + 0.015 < ce[0] || ce[2] + 0.015 < ce[1]) {
      ordered[2].failures.push(`exposição não monotônica: ${ce.map((item) => item.toFixed(3)).join(' < ')}`);
    }
    const expectation = PHARMACOLOGY_EXPECTATIONS.find((item) => item.drugId === ordered[0].drugId)!;
    const primaryMetric = expectation.signals.find((item) => item.minimum)?.metric;
    if (primaryMetric) {
      const response = ordered.map((item) => item.metrics[primaryMetric]);
      if (response[1] + 0.035 < response[0] || response[2] + 0.035 < response[1]) {
        ordered[2].failures.push(`${primaryMetric} não monotônico: ${response.map((item) => item.toFixed(3)).join(' < ')}`);
      }
    }
  }
}

const requestedDrug = cliValue('drug');
const requestedSpecies = cliValue('species') as SpeciesType | undefined;
const jsonOutput = process.argv.includes('--json');
const verbose = process.argv.includes('--verbose');

const selectedDrugs = VETERINARY_DRUG_DATABASE.filter((drug) => !requestedDrug || drug.id === requestedDrug);
if (selectedDrugs.length === 0) throw new Error(`Nenhum fármaco corresponde a --drug=${requestedDrug}`);

const catalogIds = new Set(VETERINARY_DRUG_DATABASE.map((item) => item.id));
const expectationIds = new Set(PHARMACOLOGY_EXPECTATIONS.map((item) => item.drugId));
const missingContracts = [...catalogIds].filter((id) => !expectationIds.has(id));
const orphanContracts = [...expectationIds].filter((id) => !catalogIds.has(id));
if (missingContracts.length || orphanContracts.length) {
  throw new Error(`Matriz divergente do catálogo. Ausentes: ${missingContracts.join(', ') || '-'}; órfãos: ${orphanContracts.join(', ') || '-'}`);
}

const results: CaseResult[] = [];
for (const drug of selectedDrugs) {
  const speciesToRun = explicitSpecies(drug).filter((species) => !requestedSpecies || species === requestedSpecies);
  for (const species of speciesToRun) {
    for (const doseLevel of DOSE_LEVELS) results.push(validateCase(drug, species, doseLevel));
  }
}
addDoseOrderingFailures(results);

if (jsonOutput) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    catalogCount: VETERINARY_DRUG_DATABASE.length,
    caseCount: results.length,
    failureCount: results.reduce((sum, item) => sum + item.failures.length, 0),
    results,
  }, null, 2));
} else {
  const failedCases = results.filter((item) => item.failures.length > 0);
  console.log(`Farmacopeia: ${VETERINARY_DRUG_DATABASE.length} itens | Casos executados: ${results.length} | Casos com desvio: ${failedCases.length}`);
  console.log('Fármaco\tClasse\tMecanismo/resultado esperado');
  for (const drug of selectedDrugs) {
    const expectation = PHARMACOLOGY_EXPECTATIONS.find((item) => item.drugId === drug.id)!;
    console.log(`${drug.id}\t${expectation.clinicalClass}\t${expectation.mechanism}`);
  }
  if (failedCases.length > 0) {
    console.log('\nDesvios encontrados:');
    for (const result of failedCases) {
      console.log(`- ${result.drugId}/${result.species}/${result.doseLevel}: ${result.failures.join('; ')}`);
    }
  }
  if (verbose) {
    console.log('\nResultados completos:');
    for (const result of results) {
      console.log([
        result.drugId,
        result.species,
        result.doseLevel,
        `${result.dosePerKg} ${result.doseUnit}`,
        result.route,
        `Ce=${result.metrics.peakEffectSiteExposure.toFixed(2)}`,
        `sed=${result.metrics.maxSedation.toFixed(2)}`,
        `hip=${result.metrics.maxHypnosis.toFixed(2)}`,
        `diss=${result.metrics.maxDissociation.toFixed(2)}`,
        `analg=${result.metrics.maxAnalgesia.toFixed(2)}`,
        `PAM=${result.metrics.minMap.toFixed(0)}-${result.metrics.maxMap.toFixed(0)}`,
        `FC=${result.metrics.minHeartRate.toFixed(0)}-${result.metrics.maxHeartRate.toFixed(0)}`,
        result.failures.length ? 'FAIL' : 'PASS',
      ].join('\t'));
    }
  }
}

if (results.some((item) => item.failures.length > 0)) process.exitCode = 1;
