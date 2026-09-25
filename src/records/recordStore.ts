import { clone, METRICS, RECORD_VERSION, SPECIES_CODES, validateReview, type ExpertReview, type SimulationRun } from './simulationRecord';

const DB_NAME = 'simpet-expert-review';
const STORE = 'runs';
let database: Promise<IDBDatabase> | undefined;
function openDatabase(): Promise<IDBDatabase> {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = undefined; }; resolve(request.result); };
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error('Feche outras abas antigas para abrir o arquivo de rodadas.')); };
  });
  return database;
}
export async function listRuns(): Promise<SimulationRun[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    tx.oncomplete = () => resolve((request.result as SimulationRun[]).sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    tx.onerror = () => reject(tx.error);
  });
}
async function updateRun(id: string, update: (existing?: SimulationRun) => SimulationRun): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const get = store.get(id);
    let failure: unknown;
    get.onsuccess = () => {
      try { store.put(update(get.result)); } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? new Error('Falha ao salvar rodada.'));
  });
}
export async function saveRun(run: SimulationRun): Promise<void> {
  const copy = clone(run);
  await updateRun(copy.id, existing => ({ ...copy, reviews: existing?.reviews ?? copy.reviews }));
}
export async function saveReview(review: ExpertReview): Promise<void> {
  await updateRun(review.runId, existing => {
    if (!existing) throw new Error('Salve a rodada antes de avaliar.');
    validateReview(existing, review);
    if (existing.reviews.some(r => r.id === review.id)) throw new Error('Este parecer já foi salvo.');
    if (review.supersedes && existing.reviews.some(r => r.supersedes === review.supersedes)) throw new Error('O parecer já foi revisado. Atualize os registros antes de editar novamente.');
    return { ...existing, reviews: [...existing.reviews, clone(review)] };
  });
}

/** Strict envelope and referential validation; imports never execute instructions or change the engine. */
export function parseRunArchive(json: string): SimulationRun {
  if (json.length > 50_000_000) throw new Error('Arquivo excede 50 MB.');
  const run = JSON.parse(json) as SimulationRun;
  if (!run || run.schemaVersion !== RECORD_VERSION || typeof run.id !== 'string' || !run.id || !run.patient ||
    !Object.hasOwn(SPECIES_CODES, run.patient.species) || !Array.isArray(run.snapshots) || !run.snapshots.length ||
    !Array.isArray(run.events) || !Array.isArray(run.reviews) || !run.lastObservation ||
    !['active', 'completed', 'interrupted'].includes(run.status) || !Number.isFinite(Date.parse(run.startedAt)) ||
    !Number.isFinite(Date.parse(run.updatedAt)) || typeof run.modelVersion !== 'string' || typeof run.buildFingerprint !== 'string') throw new Error('Arquivo de rodada incompatível.');
  const ids = new Set<string>();
  let time = -1;
  for (const s of run.snapshots) {
    if (typeof s.id !== 'string' || ids.has(s.id) || !Number.isFinite(s.simTimeSeconds) || s.simTimeSeconds < time ||
      !Number.isFinite(s.scheduledSimTimeSeconds) || !Number.isFinite(Date.parse(s.recordedAt)) ||
      !s.vitals?.arterialBloodGases || !s.vitals?.cellularState || !s.vitals?.biologicalState || !s.equipment || !Array.isArray(s.doses) || !s.monitor) throw new Error('Amostras inválidas.');
    ids.add(s.id); time = s.simTimeSeconds;
    if (Object.values(METRICS).some(metric => !Number.isFinite(metric.read(s.vitals)))) throw new Error('Parâmetros fisiológicos inválidos.');
    if (!['baseline', 'minute', 'final'].includes(s.kind) || !Array.isArray(s.vitals.activePhysiologicalSignals)) throw new Error('Tipo de amostra ou mecanismos inválidos.');
  }
  const eventIds = new Set<string>();
  for (const [index, event] of run.events.entries()) {
    if (!event || typeof event.id !== 'string' || eventIds.has(event.id) || event.sequence !== index + 1 ||
      !Number.isFinite(event.simTimeSeconds) || event.simTimeSeconds < 0 || !Number.isFinite(Date.parse(event.recordedAt)) || typeof event.message !== 'string') throw new Error('Eventos inválidos.');
    eventIds.add(event.id);
  }
  const reviewIds = new Set<string>();
  for (const review of run.reviews) {
    if (!review || typeof review.id !== 'string' || reviewIds.has(review.id) || !Number.isFinite(Date.parse(review.createdAt)) || !Array.isArray(review.expected)) throw new Error('Pareceres inválidos.');
    if (review.supersedes && !reviewIds.has(review.supersedes)) throw new Error('Sequência de revisões inválida.');
    validateReview(run, review); reviewIds.add(review.id);
  }
  return run;
}
export async function importRunArchive(json: string): Promise<string> {
  const incoming = parseRunArchive(json);
  await updateRun(incoming.id, existing => mergeRunArchive(existing, incoming));
  return incoming.id;
}
export function mergeRunArchive(existing: SimulationRun | undefined, incoming: SimulationRun): SimulationRun {
    if (!existing) return incoming.status === 'active' ? { ...incoming, status: 'interrupted', endReason: 'Importada durante execução' } : incoming;
    // Reviewers exchange the same frozen run. Never replace local telemetry with an imported variant.
    if (JSON.stringify(existing.patient) !== JSON.stringify(incoming.patient) ||
      JSON.stringify(existing.snapshots) !== JSON.stringify(incoming.snapshots) ||
      JSON.stringify(existing.events) !== JSON.stringify(incoming.events) || existing.buildFingerprint !== incoming.buildFingerprint ||
      existing.modelVersion !== incoming.modelVersion || JSON.stringify(existing.configuration) !== JSON.stringify(incoming.configuration)) throw new Error('Esta rodada já existe com dados diferentes. Exporte uma rodada encerrada para revisão compartilhada.');
    const reviews = [...existing.reviews];
    for (const review of incoming.reviews) {
      const found = reviews.find(r => r.id === review.id);
      if (found && JSON.stringify(found) !== JSON.stringify(review)) throw new Error('Conflito em parecer existente.');
      if (!found) reviews.push(review);
    }
    return { ...existing, reviews };
}
