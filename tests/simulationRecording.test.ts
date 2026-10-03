import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationRecorder, currentReviews, compareReview, exportRefinementRows, validateReview, type Observation, type ExpertReview } from '../src/records/simulationRecord';
import { parseRunArchive, mergeRunArchive } from '../src/records/recordStore';
import { createHealthyValidationPatient, createSimulationState, advanceSimulation } from '../src/validation/simulationHarness';
import { stepThermalBalance } from '../src/engine/thermalBalance';
import { analyzeInterval, summarizeFeedback } from '../src/records/feedbackAnalysis';
import { speciesAlarmLimits } from '../src/data/monitorDefaults';
import { nextSimulationStep } from '../src/engine/simulationClock';

const species = ['canine', 'feline', 'bovine', 'equine'] as const;
const at = () => '2026-09-10T12:00:00.000Z';
function fixture(sp: typeof species[number] = 'canine') {
  const patient = createHealthyValidationPatient(sp), state = createSimulationState(patient);
  const o: Observation = { simTimeSeconds: 0, vitals: state.vitals, equipment: state.equipment, doses: [], resuscitation: state.resuscitation,
    surgical: null, nociceptive: null, paused: false, speed: 1,
    monitor: { continuousBP: false, nibp: null, measuring: false, autoIntervalMin: 3,
      alarmLimits: { hrLow: 50, hrHigh: 160, mapLow: 60, mapHigh: 120, spo2Low: 94, etco2Low: 30, etco2High: 50, tempLow: 36.5, tempHigh: 39.5, isAudioMuted: true } } };
  return { patient, state, o, recorder: new SimulationRecorder(patient, o, at, 'test-build') };
}
for (const sp of species) {
  test(`${sp}: compressão com profundidade ou frequência zero não gera perfusão ou ROSC`, () => {
    for (const zero of [{ compressionDepthQuality: 0 }, { compressionsPerMin: 0 }]) {
      const state = createSimulationState(createHealthyValidationPatient(sp));
      state.vitals = { ...state.vitals, isCardiacArrest: true, cardiacArrestType: 'asystole', cardiacRhythm: 'asystole', heartRate: 0, meanArterialPressure: 0 };
      state.resuscitation = { ...state.resuscitation, isCPRActive: true, isCPRVentilationActive: true, ...zero };
      advanceSimulation(state, 15, { dtSeconds: .1 });
      assert.equal(state.vitals.isCardiacArrest, true);
      assert.equal(state.vitals.meanArterialPressure, 0);
      assert.equal(state.vitals.heartRate, 0);
      assert.equal(state.vitals.cprSecondsElapsed, 0);
      assert.ok(Math.abs(state.vitals.asystoleSecondsElapsed - 15) < 1e-6);
      assert.equal(state.resuscitation.isCPRActive, true); // Operator command remains intact for audit.
    }
  });
  test(`${sp}: limites de alarme respeitam frequência basal e limiar de perfusão da espécie`, () => {
    const patient = createHealthyValidationPatient(sp), limits = speciesAlarmLimits(sp, true);
    assert.ok(patient.baselineVitals.hr > limits.hrLow && patient.baselineVitals.hr < limits.hrHigh);
    assert.equal(limits.isAudioMuted, true);
    if (sp === 'equine') assert.equal(limits.mapLow, 70);
  });
  test(`${sp}: minutos sem deriva nas velocidades 1×, 2×, 5× e 10×, sem duplicação em pausa`, () => {
    for (const dt of [.1, .2, .5, 1.0]) {
      const { o, recorder } = fixture(sp);
      for (let t = dt; t < 180.00001; t += dt) recorder.observe({ ...o, simTimeSeconds: t });
      assert.deepEqual(recorder.run.snapshots.map(s => s.scheduledSimTimeSeconds), [0, 60, 120, 180]);
      recorder.observe({ ...o, simTimeSeconds: 180.000001, paused: true });
      recorder.observe({ ...o, simTimeSeconds: 180.000001, paused: true });
      assert.equal(recorder.run.snapshots.length, 4);
      assert.equal(recorder.run.events.filter(e => e.kind === 'action').length, 1);
    }
  });
  test(`${sp}: temperatura conserva evolução temporal, manta não resfria febre instantaneamente`, () => {
    const { patient, o } = fixture(sp);
    const temperatures = [.1, .2, .5, 1].map(dt => {
      let temp = patient.baselineVitals.tempC;
      for (let i = 0; i < 600 / dt; i++) temp = stepThermalBalance(dt, patient, o.equipment, temp, 1.5, 0);
      return temp;
    });
    assert.ok(Math.max(...temperatures) - Math.min(...temperatures) < 1e-8);
    assert.ok(temperatures[0] < patient.baselineVitals.tempC - .1);
    const febrile = stepThermalBalance(.1, patient, { ...o.equipment, warmingBlanketActive: true }, 40, 1, 0);
    assert.ok(febrile > 39.99);
    const warming = { ...o.equipment, warmingBlanketActive: true, warmingBlanketTempC: 38 };
    assert.ok(stepThermalBalance(10, patient, warming, 35, 1, 0) > stepThermalBalance(10, patient, o.equipment, 35, 1, 0));
    assert.ok(stepThermalBalance(10, patient, { ...warming, warmingBlanketTempC: 34 }, 35, 1, 0) < 35);
  });
  test(`${sp}: motor mantém precisão térmica e estado basal nas velocidades da interface`, () => {
    const results = [.1, .2, .5].map(dtSeconds => {
      const state = createSimulationState(createHealthyValidationPatient(sp));
      advanceSimulation(state, 180, { dtSeconds }); return state.vitals;
    });
    for (const v of results) {
      assert.equal(v.isDead, false);
      assert.ok(Math.abs(v.bodyTemperatureC - results[0].bodyTemperatureC) < .001);
      assert.ok(Math.abs(v.heartRate - results[0].heartRate) < 1);
      assert.ok(Math.abs(v.meanArterialPressure - results[0].meanArterialPressure) < 1);
    }
  });
  test(`${sp}: tempos de assistolia e RCP acumulam frações de segundo e não dependem da velocidade`, () => {
    for (const dtSeconds of [.1, .2, .5]) {
      const noFlow = createSimulationState(createHealthyValidationPatient(sp));
      noFlow.vitals = { ...noFlow.vitals, isCardiacArrest: true, cardiacArrestType: 'asystole', cardiacRhythm: 'asystole', heartRate: 0, meanArterialPressure: 0 };
      advanceSimulation(noFlow, 15, { dtSeconds });
      assert.ok(Math.abs(noFlow.vitals.asystoleSecondsElapsed - 15) < 1e-6);
      advanceSimulation(noFlow, 200, { dtSeconds });
      assert.equal(noFlow.vitals.isDead, true);
      assert.ok(noFlow.vitals.deathTimeSeconds! >= 210 && noFlow.vitals.deathTimeSeconds! <= 210.51);
      const cpr = createSimulationState(createHealthyValidationPatient(sp));
      cpr.vitals = { ...cpr.vitals, isCardiacArrest: true, cardiacArrestType: 'asystole', cardiacRhythm: 'asystole', heartRate: 0, meanArterialPressure: 0 };
      cpr.resuscitation.isCPRActive = true; // No airway support, so no ROSC in this timer test.
      advanceSimulation(cpr, 15, { dtSeconds });
      assert.ok(Math.abs(cpr.vitals.cprSecondsElapsed - 15) < 1e-6);
      assert.equal(cpr.vitals.asystoleSecondsElapsed, 0);
    }
  });
}
test('auditoria retém alterações, desdobramentos e valores originais; resoluções são registradas', () => {
  const { o, recorder } = fixture();
  recorder.observe({ ...o, simTimeSeconds: 2, equipment: { ...o.equipment, vaporizerDialPct: 2 } });
  recorder.observe({ ...o, simTimeSeconds: 3, vitals: { ...o.vitals, isRespiratoryArrest: true } });
  recorder.observe({ ...o, simTimeSeconds: 4 });
  const outcomes = recorder.run.events.filter(e => e.kind === 'outcome');
  assert.equal(outcomes.length, 2);
  assert.ok(outcomes[0].precedingActionIds.length);
  assert.equal(outcomes[0].before!.isRespiratoryArrest, false);
  assert.equal(outcomes[0].after!.isRespiratoryArrest, true);
  o.vitals.heartRate = 900;
  assert.notEqual(recorder.run.snapshots[0].vitals.heartRate, 900);
  const log = { id: 'same', simTimeSeconds: 2, realTimestamp: '09:00', type: 'system' as const, message: 'Comando rejeitado' };
  recorder.ingestLogs([log, log]);
  assert.equal(recorder.run.events.filter(e => e.kind === 'log').length, 1);
  assert.ok(recorder.run.events.every((e, i) => e.sequence === i + 1));
});
test('lacunas são explícitas; reinício e óbito isolam e encerram rodadas', () => {
  const { o, recorder, patient } = fixture();
  recorder.observe({ ...o, simTimeSeconds: 185 });
  assert.equal(recorder.run.events.filter(e => e.kind === 'gap').length, 1);
  assert.deepEqual(recorder.run.snapshots.map(s => s.scheduledSimTimeSeconds), [0, 180]);
  assert.throws(() => recorder.observe({ ...o, simTimeSeconds: 1 }));
  recorder.observe({ ...o, simTimeSeconds: 190, vitals: { ...o.vitals, isDead: true } });
  assert.equal(recorder.run.status, 'completed');
  assert.equal(recorder.run.snapshots.at(-1)!.kind, 'final');
  const length = recorder.run.snapshots.length;
  recorder.observe({ ...o, simTimeSeconds: 240 }); recorder.finish('reinício');
  assert.equal(recorder.run.snapshots.length, length);
  assert.notEqual(new SimulationRecorder(patient, o).run.id, recorder.run.id);
});
function reviewFixture() {
  const { recorder } = fixture(); const run = recorder.run;
  const review: ExpertReview = { id: 'review-1', runId: run.id, snapshotId: run.snapshots[0].id, createdAt: at(),
    reviewer: 'Especialista 1', qualification: 'CRMV teste', verdict: 'adjust', confidence: 'high',
    expected: [{ metric: 'hr', min: 1, max: 2 }], expectedNarrative: 'Resposta esperada do caso', rationale: 'Justificativa clínica' };
  return { run, review };
}
test('parecer valida faixas, autoria, instantes, tempo e vínculo; compara distância da faixa', () => {
  const { run, review } = reviewFixture();
  validateReview(run, review);
  for (const patch of [{ reviewer: '' }, { snapshotId: 'other' }, { runId: 'other' }, { expectedResponseSeconds: -1 },
    { expected: [{ metric: 'hr', min: NaN, max: 2 }] }, { expected: [{ metric: 'hr', min: 4, max: 2 }] }, { relatedEventId: 'invalid' }]) {
    assert.throws(() => validateReview(run, { ...review, ...patch } as ExpertReview));
  }
  assert.equal(compareReview(run, review)[0].deviation, run.snapshots[0].vitals.heartRate - 2);
  assert.equal(compareReview(run, { ...review, expected: [] }).length, 0);
});
test('exportação preserva opiniões discordantes e histórico; versões anteriores não duplicam pares de refino', () => {
  const { run, review } = reviewFixture();
  run.reviews.push(review, { ...review, id: 'review-2', supersedes: review.id, expected: [] }, { ...review, id: 'review-3', reviewer: 'Especialista 2', verdict: 'plausible' });
  assert.equal(currentReviews(run).length, 2);
  const rows = exportRefinementRows(run).split('\n').map(line => JSON.parse(line));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].labelStatus, 'expert_opinion_not_adjudicated');
  assert.equal(rows[0].comparison.length, 0);
  const imported = parseRunArchive(JSON.stringify(run));
  assert.equal(imported.reviews.length, 3);
  assert.throws(() => parseRunArchive(JSON.stringify({ ...run, schemaVersion: 99 })));
  assert.throws(() => parseRunArchive(JSON.stringify({ ...run, snapshots: [] })));
  assert.throws(() => parseRunArchive(JSON.stringify({ ...run, reviews: [{ ...review, snapshotId: 'wrong' }] })));
});
test('retroalimentação agrega desvios por espécie e detecta discordância sem misturar unidades', () => {
  const { run, review } = reviewFixture();
  run.reviews.push(review, { ...review, id: 'second', reviewer: 'Especialista 2', expected: [{ metric: 'hr', min: 90, max: 110 }] });
  const summary = summarizeFeedback([run]);
  assert.equal(summary.groups[0].species, 'CAN');
  assert.equal(summary.groups[0].independentReviewers, 2);
  assert.equal(summary.groups[0].outsideRange, 1);
  assert.equal(summary.disagreements.length, 1);
  assert.equal(analyzeInterval(run, run.snapshots[0].id).deltas[0].change, null);
  assert.throws(() => parseRunArchive(JSON.stringify({ ...run, patient: { ...run.patient, species: '__proto__' } })));
  assert.throws(() => validateReview(run, { ...review, expected: [{ metric: '__proto__' as any, min: 1, max: 2 }] }));
});
test('importação reúne avaliadores sem duplicar pareceres nem aceitar telemetria ou opiniões sobrescritas', () => {
  const { run, review } = reviewFixture();
  run.reviews.push(review);
  const remote = structuredClone(run);
  remote.reviews.push({ ...review, id: 'remote', reviewer: 'Avaliador remoto' });
  const combined = mergeRunArchive(run, remote);
  assert.equal(combined.reviews.length, 2);
  assert.equal(mergeRunArchive(combined, remote).reviews.length, 2);
  assert.equal(run.reviews.length, 1);
  const altered = structuredClone(remote);
  altered.snapshots[0].vitals.heartRate = 300;
  assert.throws(() => mergeRunArchive(run, altered));
  const overwritten = structuredClone(remote);
  overwritten.reviews[0].rationale = 'Alteração silenciosa';
  assert.throws(() => mergeRunArchive(run, overwritten));
  assert.equal(mergeRunArchive(undefined, remote).status, 'interrupted');
});
test('troca de velocidade fora da grade ainda produz leituras reais exatamente no minuto', () => {
  const { recorder, o } = fixture();
  let t = 0;
  while (t < 180) {
    const speed = t < 12.3 ? 1 : t < 79.5 ? 5 : 2;
    const step = nextSimulationStep(t, speed);
    assert.ok(step.dt > 0 && step.dt <= speed / 10);
    t = step.newSimTime;
    recorder.observe({ ...o, simTimeSeconds: t, speed });
  }
  assert.deepEqual(recorder.run.snapshots.map(s => s.simTimeSeconds), [0, 60, 120, 180]);
  assert.throws(() => nextSimulationStep(NaN, 1));
  assert.throws(() => nextSimulationStep(1, 0));
});
