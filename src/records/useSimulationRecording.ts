import { useEffect, useRef, useState } from 'react';
import type { LogEntry, PatientProfile } from '../types/simulator';
import { SimulationRecorder, type Observation, type SimulationRun } from './simulationRecord';
import { listRuns, saveRun } from './recordStore';

export function useSimulationRecording(patient: PatientProfile, observation: Observation, logs: LogEntry[]) {
  const recorder = useRef<SimulationRecorder | null>(null);
  if (!recorder.current) recorder.current = new SimulationRecorder(patient, observation, undefined,
    typeof __SIM_BUILD__ === 'undefined' ? 'development' : __SIM_BUILD__);
  const [storageError, setStorageError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const lastPersist = useRef(0);
  const lastRevision = useRef('');
  const saving = useRef(Promise.resolve());
  const persist = (run: SimulationRun = recorder.current!.run) => {
    const copy = structuredClone(run);
    const task = saving.current.catch(() => {}).then(() => saveRun(copy));
    saving.current = task;
    task.then(() => { setStorageError(''); setSavedAt(new Date().toLocaleTimeString()); }, error => setStorageError(`Não foi possível salvar: ${String(error)}. Exporte o JSON antes de fechar.`));
    return task;
  };
  useEffect(() => {
    recorder.current!.observe(observation);
    recorder.current!.ingestLogs(logs);
    const now = Date.now();
    const run = recorder.current!.run;
    const revision = `${run.id}:${run.events.length}:${run.snapshots.length}:${run.status}`;
    if (revision !== lastRevision.current || now - lastPersist.current >= 5000) {
      lastRevision.current = revision; lastPersist.current = now; void persist().catch(() => {});
    }
  }, [observation, logs]);
  useEffect(() => {
    const flush = () => { void persist().catch(() => {}); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); };
  }, []);
  return {
    storageError, savedAt, recorder,
    flush: async () => { await persist(); return listRuns(); },
    restart: (nextPatient: PatientProfile, initial: Observation) => {
      recorder.current!.ingestLogs(logs);
      recorder.current!.finish('Reinício ou troca de paciente');
      void persist().catch(() => {});
      recorder.current = new SimulationRecorder(nextPatient, initial, undefined,
        typeof __SIM_BUILD__ === 'undefined' ? 'development' : __SIM_BUILD__);
      lastPersist.current = 0;
    },
    finish: async () => { recorder.current!.finish('Encerrada pelo avaliador'); await persist(); return listRuns(); },
  };
}
