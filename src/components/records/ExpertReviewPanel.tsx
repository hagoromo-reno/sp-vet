import React, { useEffect, useState } from 'react';
import { Download, MessageSquare, Save, X } from 'lucide-react';
import { compareReview, currentReviews, exportRefinementRows, METRICS, SPECIES_CODES, validateReview, type ExpertReview, type Metric, type SimulationRun } from '../../records/simulationRecord';
import { importRunArchive, listRuns, saveReview } from '../../records/recordStore';
import { analyzeInterval, summarizeFeedback } from '../../records/feedbackAnalysis';

export function downloadRecord(text: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const number = (value: number) => Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 'Indisponível';
const verdicts = { plausible: 'Plausível', adjust: 'Precisa de ajuste', uncertain: 'Inconclusivo' };

export function ExpertReviewPanel({ initialRuns, activeId, onClose, onFinish, onRefresh }: {
  initialRuns: SimulationRun[]; activeId: string; onClose: () => void;
  onFinish: () => Promise<SimulationRun[]>; onRefresh: () => Promise<SimulationRun[]>;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [runId, setRunId] = useState(activeId);
  const [species, setSpecies] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [qualification, setQualification] = useState('');
  const [verdict, setVerdict] = useState<ExpertReview['verdict']>('uncertain');
  const [confidence, setConfidence] = useState<ExpertReview['confidence']>('medium');
  const [ranges, setRanges] = useState<Partial<Record<Metric, { min: string; max: string }>>>({});
  const [narrative, setNarrative] = useState('');
  const [rationale, setRationale] = useState('');
  const [eventId, setEventId] = useState('');
  const [delay, setDelay] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = runs.find(r => r.id === runId) ?? runs[0];
  const snapshot = run?.snapshots.find(s => s.id === snapshotId) ?? run?.snapshots[0];
  useEffect(() => { setRanges({}); setNarrative(''); setRationale(''); setEventId(''); setDelay(''); setVerdict('uncertain'); setMessage(''); }, [runId, snapshotId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await fn(); } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  };
  if (!run || !snapshot) return null;
  const reviews = currentReviews(run);
  const covered = new Set(reviews.map(r => r.snapshotId));
  const minutes = run.snapshots.filter(s => s.kind === 'minute');
  const selectedReviews = reviews.filter(r => r.snapshotId === snapshot.id);
  const interval = analyzeInterval(run, snapshot.id);
  const save = () => act(async () => {
    const expected = (Object.entries(ranges) as [Metric, { min: string; max: string }][]).flatMap(([metric, range]) => {
      if (!range.min.trim() && !range.max.trim()) return [];
      if (!range.min.trim() || !range.max.trim()) throw new Error(`Preencha os dois limites de ${METRICS[metric].label}.`);
      return [{ metric, min: Number(range.min.replace(',', '.')), max: Number(range.max.replace(',', '.')) }];
    });
    const previous = selectedReviews.find(r => r.reviewer === reviewer.trim());
    const review: ExpertReview = { id: crypto.randomUUID(), runId: run.id, snapshotId: snapshot.id,
      createdAt: new Date().toISOString(), reviewer: reviewer.trim(), qualification: qualification.trim(),
      verdict, confidence, expected, expectedNarrative: narrative.trim(), rationale: rationale.trim(),
      relatedEventId: eventId || undefined, expectedResponseSeconds: delay.trim() ? Number(delay.replace(',', '.')) : undefined,
      supersedes: previous?.id };
    validateReview(run, review); await saveReview(review, run); setRuns(await listRuns()); setMessage('Parecer salvo com sucesso no banco de dados da sua conta e disponível para auditoria.');
  });
  return <div className="expert-overlay" role="dialog" aria-modal="true" aria-label="Revisão de simulações por anestesiologistas">
    <section className="expert-panel">
      <header className="expert-heading"><div><span className="expert-eyebrow">VALIDAÇÃO POR ESPECIALISTAS</span><h2><MessageSquare size={22} /> Revisão da simulação</h2><p>Compare a evolução registrada com o que você esperava neste caso.</p></div><button autoFocus className="ui-button" onClick={onClose} aria-label="Fechar revisão"><X size={20} /></button></header>
      <div className="expert-toolbar">
        <label>Espécie<select value={species} onChange={e => setSpecies(e.target.value)}><option value="">Todas as espécies</option>{Object.entries(SPECIES_CODES).map(([key, code]) => <option key={key} value={key}>{code}</option>)}</select></label>
        <label className="expert-grow">Rodada<select value={run.id} onChange={e => { setRunId(e.target.value); setSnapshotId(''); }}>{runs.filter(r => !species || r.patient.species === species || r.id === run.id).map(r => <option key={r.id} value={r.id}>{r.speciesCode} · {r.patient.name} · {new Date(r.startedAt).toLocaleString('pt-BR')} · {r.status === 'active' && r.id !== activeId ? 'interrompida' : r.status === 'completed' ? 'encerrada' : r.status === 'active' ? 'em andamento' : 'interrompida'} · {r.id.slice(0, 8)}</option>)}</select></label>
        <button className="ui-button" disabled={busy} onClick={() => act(async () => setRuns(await onRefresh()))}>Atualizar registros</button>
        {run.id === activeId && run.status === 'active' && <button className="ui-button" disabled={busy} onClick={() => act(async () => { setRuns(await onFinish()); setMessage('Rodada encerrada e salva. Reinicie o caso para uma nova execução.'); })}>Encerrar rodada</button>}
      </div>
      <div className="expert-summary"><span><strong>{minutes.filter(s => covered.has(s.id)).length}/{minutes.length}</strong> minutos avaliados</span><span><strong>{run.events.length}</strong> eventos</span><span><strong>{reviews.filter(r => r.verdict === 'adjust').length}</strong> pedidos de ajuste</span><span>Modelo {run.modelVersion} · {run.buildFingerprint.slice(0, 12)}</span></div>
      <div className="expert-body"><aside className="expert-minutes" aria-label="Pontos da simulação">{run.snapshots.map(s => <button key={s.id} className={s.id === snapshot.id ? 'selected' : ''} onClick={() => setSnapshotId(s.id)}><strong>{time(s.scheduledSimTimeSeconds)}</strong><span>{s.kind === 'baseline' ? 'Inicial' : s.kind === 'final' ? 'Final' : covered.has(s.id) ? 'Avaliado' : 'Pendente'}</span></button>)}</aside>
        <div className="expert-content">
          <div className="expert-point"><h3>Ponto {time(snapshot.simTimeSeconds)} · {run.patient.scenarioTitle}</h3><p>{new Date(snapshot.recordedAt).toLocaleString('pt-BR')} · {run.patient.weightKg} kg · ASA {run.patient.asa} · amostragem solicitada {time(snapshot.scheduledSimTimeSeconds)}</p><p>Pressão no monitor: {snapshot.monitor.continuousBP ? 'invasiva contínua' : snapshot.monitor.nibp ? `NIBP ${snapshot.monitor.nibp.sys}/${snapshot.monitor.nibp.dia} (${snapshot.monitor.nibp.map}) mmHg, medida em ${time(snapshot.monitor.nibp.timestampSimSec)}` : 'NIBP ainda não medida'}. A tabela abaixo compara os valores fisiológicos calculados.</p></div>
          <details className="expert-timeline"><summary>Feedback da evolução: {time(interval.from)} → {time(interval.to)}</summary><p>{interval.interpretation}</p>{interval.deltas.filter(d => ['hr', 'map', 'spo2', 'etco2', 'temp', 'lactate', 'cardiacOutput'].includes(d.metric)).map(d => <p key={d.metric}>{METRICS[d.metric].label}: {number(d.observed)} {d.unit} · variação {d.change === null ? 'ponto inicial' : number(d.change)}</p>)}{interval.signals?.map(signal => <p key={signal.id}>{signal.label} · {signal.source} → {signal.targets.join(', ')}</p>)}</details>
          <form onSubmit={e => { e.preventDefault(); void save(); }}>
            <div className="expert-fields"><label>Avaliador<input required value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Nome ou identificador profissional" /></label><label>Qualificação / registro<input required value={qualification} onChange={e => setQualification(e.target.value)} placeholder="Anestesiologista, CRMV / instituição" /></label><label>Avaliação<select value={verdict} onChange={e => setVerdict(e.target.value as ExpertReview['verdict'])}>{Object.entries(verdicts).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>Confiança<select value={confidence} onChange={e => setConfidence(e.target.value as ExpertReview['confidence'])}><option value="low">Baixa</option><option value="medium">Moderada</option><option value="high">Alta</option></select></label></div>
            <div className="expert-table-wrap"><table><thead><tr><th>Parâmetro</th><th>Observado</th><th>Esperado mínimo</th><th>Esperado máximo</th></tr></thead><tbody>{(Object.entries(METRICS) as [Metric, typeof METRICS[Metric]][]).map(([key, metric]) => <tr key={key}><td>{metric.label} <small>{metric.unit}</small></td><td>{number(metric.read(snapshot.vitals))}</td>{(['min', 'max'] as const).map(bound => <td key={bound}><input aria-label={`${metric.label} ${bound === 'min' ? 'mínimo' : 'máximo'} esperado`} inputMode="decimal" value={ranges[key]?.[bound] ?? ''} placeholder="Não avaliado" onChange={e => setRanges(prev => ({ ...prev, [key]: { min: prev[key]?.min ?? '', max: prev[key]?.max ?? '', [bound]: e.target.value } }))} /></td>)}</tr>)}</tbody></table></div>
            <p className="expert-note">Preencha somente os parâmetros avaliados. Um valor exato pode ser informado nos dois limites. Campos vazios não são tratados como aprovação.</p>
            <label>Resposta esperada para este momento<textarea required value={narrative} onChange={e => setNarrative(e.target.value)} placeholder="Evolução, reflexos, ritmo, analgesia, ventilação e recuperação esperados neste contexto." /></label>
            <label>Justificativa e proposta de ajuste<textarea required value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Explique a divergência ou concordância, considerando espécie, dose, via, tempo e condição clínica. Inclua referências, quando disponíveis." /></label>
            <div className="expert-fields"><label>Intervenção / evento relacionado<select value={eventId} onChange={e => setEventId(e.target.value)}><option value="">Sem associação específica</option>{run.events.filter(e => e.simTimeSeconds <= snapshot.simTimeSeconds).map(e => <option key={e.id} value={e.id}>{time(e.simTimeSeconds)} · {e.message}</option>)}</select></label><label>Tempo esperado de resposta após o evento (s)<input inputMode="decimal" value={delay} onChange={e => setDelay(e.target.value)} placeholder="Opcional" /></label></div>
            <button className="ui-button expert-save" disabled={busy} type="submit"><Save size={16} />Salvar parecer deste ponto</button>
          </form>
          <div role="status" className="expert-message">{message}</div>
          {selectedReviews.map(review => <article key={review.id} className="expert-review"><strong>{review.reviewer} · {verdicts[review.verdict]}</strong><p>{review.expectedNarrative}</p><p>{review.rationale}</p>{compareReview(run, review).map(c => <p key={c.metric}>{METRICS[c.metric].label}: observado {number(c.observed)}, esperado {c.min}–{c.max} {c.unit} · desvio {number(c.deviation)}</p>)}<button className="ui-button" onClick={() => { setReviewer(review.reviewer); setQualification(review.qualification); setVerdict(review.verdict); setConfidence(review.confidence); setNarrative(review.expectedNarrative); setRationale(review.rationale); setRanges(Object.fromEntries(review.expected.map(r => [r.metric, { min: String(r.min), max: String(r.max) }]))); setEventId(review.relatedEventId ?? ''); setDelay(review.expectedResponseSeconds === undefined ? '' : String(review.expectedResponseSeconds)); }}>Revisar parecer</button></article>)}
          <details className="expert-timeline"><summary>Ações e desdobramentos até este momento</summary><p>Associações por proximidade temporal não demonstram causalidade.</p>{run.events.filter(e => e.simTimeSeconds <= snapshot.simTimeSeconds).map(e => <details key={e.id}><summary>{time(e.simTimeSeconds)} · #{e.sequence} · {e.message}</summary><p>{e.recordedAt} · {e.kind}</p><pre>{JSON.stringify(e, null, 2)}</pre></details>)}</details>
          <details className="expert-timeline"><summary>Estado completo: fármacos, equipamento, reflexos e sistemas</summary><pre>{JSON.stringify(snapshot, null, 2)}</pre></details>
        </div>
      </div>
      <footer className="expert-footer"><p>✓ Pareceres e rodadas registrados no Banco de Dados Central (PostgreSQL) sob a conta do profissional, disponíveis para auditoria da coordenação médica e do Administrador.</p><div>
        <button className="ui-button" onClick={() => downloadRecord(JSON.stringify(run, null, 2), `simpet-${run.speciesCode}-${run.id}.json`)}><Download size={16} />Rodada JSON</button>
        <button className="ui-button" disabled={!reviews.length} onClick={() => downloadRecord(exportRefinementRows(run), `refino-${run.id}.jsonl`, 'application/x-ndjson')}>Dados para refino / IA</button>
        <button className="ui-button" onClick={() => downloadRecord(JSON.stringify(summarizeFeedback(runs), null, 2), 'analise-feedback-especies.json')}>Análise dos pareceres</button>
        <label className="ui-button">Importar rodada / pareceres<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void act(async () => { if (file.size > 50_000_000) throw new Error('Limite de importação: 50 MB.'); const id = await importRunArchive(await file.text()); setRuns(await listRuns()); setRunId(id); setSnapshotId(''); setMessage('Rodada e pareceres importados.'); }); }} /></label>
      </div></footer>
    </section>
  </div>;
}
