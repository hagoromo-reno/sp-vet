import { writeFileSync } from 'node:fs';
import { createHealthyValidationPatient, createSimulationState, createDefaultEquipment, administerDrug, advanceSimulation, summarizeTrace } from '../src/validation/simulationHarness';
import { PHARMACOLOGY_EXPECTATIONS } from '../src/validation/pharmacologyExpectations';
import { METRICS, MODEL_VERSION, SPECIES_CODES, type Metric } from '../src/records/simulationRecord';

// Controlled comparisons, not suggested anesthetic protocols. Ventilation is held identical.
const protocols = [[], ['acepromazine'], ['xylazine'], ['propofol'], ['ketamine'], ['xylazine', 'ketamine']];
const rows = [];
for (const species of ['canine', 'feline', 'bovine', 'equine'] as const) {
  for (const protocol of protocols) {
    const patient = createHealthyValidationPatient(species);
    const state = createSimulationState(patient, createDefaultEquipment(patient, {
      intubationStatus: 'intubated_tracheal', cuffPressureCmH2O: 18, ventilatorMode: 'cmv_volume',
      isVentilatorActive: true, oxygenFlowLMin: Math.max(1, patient.weightKg * .05),
    }));
    for (const id of protocol) administerDrug(state, id);
    const administered = structuredClone(state.doses);
    const minuteSamples = [];
    for (let minute = 1; minute <= 10; minute++) {
      advanceSimulation(state, 60, { dtSeconds: .5 });
      const parameters = Object.fromEntries((Object.keys(METRICS) as Metric[]).map(metric => [metric, METRICS[metric].read(state.vitals)]));
      if (Object.values(parameters).some(value => !Number.isFinite(value))) throw new Error(`Valor não finito: ${species}/${protocol}`);
      minuteSamples.push({ minute, parameters, rhythm: state.vitals.cardiacRhythm, respiratoryPattern: state.vitals.respiratoryPattern,
        signals: state.vitals.activePhysiologicalSignals, biologicalState: state.vitals.biologicalState });
    }
    const metrics = summarizeTrace(state.frames);
    rows.push({ species, code: SPECIES_CODES[species], protocol: protocol.join(' + ') || 'Controle', patient, equipment: state.equipment,
      administered, expected: protocol.map(id => PHARMACOLOGY_EXPECTATIONS.find(e => e.drugId === id)!.expectedDoseResponse.typical),
      metrics, minuteSamples });
  }
}
writeFileSync('docs/auditoria-temporal-especies.json', JSON.stringify({ modelVersion: MODEL_VERSION,
  description: '24 execuções determinísticas; 10 minutos; passo 0,5 s; dose típica; mesma ventilação dentro de cada espécie. Expectativas educacionais do catálogo, não alvos clínicos validados.', rows }, null, 2));
const round = (n: number) => n.toFixed(1);
const table = rows.map(r => `| ${r.code} | ${r.protocol} | ${round(r.metrics.minHeartRate)}–${round(r.metrics.maxHeartRate)} | ${round(r.metrics.minMap)}–${round(r.metrics.maxMap)} | ${round(r.metrics.maxSedation)} | ${round(r.metrics.maxHypnosis)} | ${round(r.metrics.maxDissociation)} | ${r.metrics.cardiacArrestOccurred ? 'Sim' : 'Não'} |`).join('\n');
writeFileSync('docs/auditoria-temporal-especies.md', `# Auditoria temporal das quatro espécies\n\n24 execuções de 10 minutos, 240 pontos de avaliação. Ventilação controlada igual dentro de cada espécie; ausência de estímulo doloroso e dose típica do catálogo. Ensaios de mecanismo, não propostas de protocolos. A ventilação assistida permite examinar efeitos circulatórios, mas não comprova segurança em respiração espontânea.\n\n| Espécie | Exposição | FC mín.–máx. (bpm) | PAM mín.–máx. (mmHg) | Sedação máx. | Hipnose máx. | Dissociação máx. | PCR |\n|---|---|---:|---:|---:|---:|---:|---|\n${table}\n\nValores numéricos completos, mecanismos ativos e estados biológicos por minuto em [auditoria-temporal-especies.json](./auditoria-temporal-especies.json). As expectativas qualitativas são as do contrato farmacológico existente; precisam ser confrontadas com os pareceres independentes dos anestesiologistas.\n`);
console.log(`Auditoria concluída: ${rows.length} execuções, ${rows.length * 10} minutos documentados. Relatório em docs/auditoria-temporal-especies.md`);
