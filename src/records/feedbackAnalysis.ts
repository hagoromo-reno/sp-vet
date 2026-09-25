import { compareReview, currentReviews, METRICS, type Metric, type SimulationRun } from './simulationRecord';

/** Describes the recorded trajectory, without treating a normal range as a patient-specific target. */
export function analyzeInterval(run: SimulationRun, snapshotId: string) {
  const index = run.snapshots.findIndex(s => s.id === snapshotId);
  if (index < 0) throw new Error('Ponto inexistente.');
  const snapshot = run.snapshots[index];
  const previous = run.snapshots[index - 1];
  const deltas = (Object.keys(METRICS) as Metric[]).map(metric => ({ metric, unit: METRICS[metric].unit,
    observed: METRICS[metric].read(snapshot.vitals),
    change: previous ? METRICS[metric].read(snapshot.vitals) - METRICS[metric].read(previous.vitals) : null }));
  const events = run.events.filter(e => e.simTimeSeconds <= snapshot.simTimeSeconds && (!previous || e.simTimeSeconds > previous.simTimeSeconds));
  return { from: previous?.simTimeSeconds ?? snapshot.simTimeSeconds, to: snapshot.simTimeSeconds,
    deltas, events, signals: snapshot.vitals.activePhysiologicalSignals,
    interpretation: 'Mudanças observadas e mecanismos emitidos pelo modelo; causalidade e adequação clínica requerem avaliação do especialista.' };
}
export function summarizeFeedback(runs: SimulationRun[]) {
  const groups = new Map<string, { species: string; metric: Metric; unit: string; count: number; outside: number; absoluteDeviation: number; signedDeviation: number; reviewers: Set<string> }>();
  const disagreements: { runId: string; snapshotId: string; metric: Metric; reviewIds: string[] }[] = [];
  for (const run of runs) {
    const reviews = currentReviews(run);
    for (const review of reviews) for (const comparison of compareReview(run, review)) {
      const key = `${run.speciesCode}:${comparison.metric}`;
      const group = groups.get(key) ?? { species: run.speciesCode, metric: comparison.metric, unit: comparison.unit,
        count: 0, outside: 0, absoluteDeviation: 0, signedDeviation: 0, reviewers: new Set<string>() };
      group.count++; group.outside += comparison.deviation === 0 ? 0 : 1;
      group.absoluteDeviation += Math.abs(comparison.deviation); group.signedDeviation += comparison.deviation;
      group.reviewers.add(review.reviewer); groups.set(key, group);
    }
    for (const snapshot of run.snapshots) for (const metric of Object.keys(METRICS) as Metric[]) {
      const labels = reviews.filter(r => r.snapshotId === snapshot.id).flatMap(r => r.expected.filter(e => e.metric === metric).map(e => ({ ...e, id: r.id })));
      if (labels.length > 1 && Math.max(...labels.map(l => l.min)) > Math.min(...labels.map(l => l.max))) disagreements.push({ runId: run.id, snapshotId: snapshot.id, metric, reviewIds: labels.map(l => l.id) });
    }
  }
  return { groups: [...groups.values()].map(g => ({ species: g.species, metric: g.metric, unit: g.unit,
    labels: g.count, independentReviewers: g.reviewers.size, outsideRange: g.outside,
    meanAbsoluteDeviation: g.absoluteDeviation / g.count, meanSignedDeviation: g.signedDeviation / g.count })),
    disagreements, status: 'Para adjudicação; não aplicar automaticamente ao motor.' };
}
