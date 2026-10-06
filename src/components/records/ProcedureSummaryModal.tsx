import React from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Heart,
  Activity,
  Wind,
  Syringe,
  Printer,
  Download,
  X,
  User,
  Laptop,
} from 'lucide-react';
import { formatSpecies } from '../../utils/formatters';

export interface ProcedureLogData {
  id?: string;
  studentName: string;
  sessionDeviceId?: string;
  patientId: string;
  patientName: string;
  species: string;
  weightKg?: number;
  asa?: string;
  procedureName: string;
  durationSeconds: number;
  outcome: 'death' | 'finished' | 'restarted' | 'switched_patient' | 'ongoing';
  deathCause?: string | null;
  finalHr?: number | null;
  finalMap?: number | null;
  finalSpo2?: number | null;
  finalEtco2?: number | null;
  finalRr?: number | null;
  administeredDrugs?: Array<{
    name: string;
    dosePerKg?: number;
    doseUnit?: string;
    route?: string;
    simTimeSec?: number;
    isCRI?: boolean;
    volumeMl?: number;
  }>;
  vitalRecords?: any[];
  eventsSummary?: Array<{
    id?: string;
    simTimeSec?: number;
    type?: string;
    message: string;
    severity?: string;
  }>;
  clinicalNotes?: string | null;
  createdAt?: string;
}

interface ProcedureSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProcedureLogData | null;
  onUpdateNotes?: (notes: string) => void;
}

export const ProcedureSummaryModal: React.FC<ProcedureSummaryModalProps> = ({
  isOpen,
  onClose,
  data,
  onUpdateNotes,
}) => {
  if (!isOpen || !data) return null;

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getOutcomeBadge = () => {
    switch (data.outcome) {
      case 'death':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertTriangle size={14} />
            Óbito Declarado / Assistolia
          </span>
        );
      case 'finished':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 size={14} />
            Procedimento Concluído com Sobrevida
          </span>
        );
      case 'restarted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Clock size={14} />
            Simulação Reiniciada
          </span>
        );
      case 'switched_patient':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <Activity size={14} />
            Transição de Paciente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            <Activity size={14} />
            Em Andamento
          </span>
        );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo_procedimento_${data.studentName.replace(/\s+/g, '_')}_${data.patientName}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-6 my-auto text-zinc-100 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 print:hidden">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white print:text-black">
                  Resumo do Procedimento Anestésico
                </h2>
                {getOutcomeBadge()}
              </div>
              <p className="text-xs text-zinc-400 print:text-zinc-600 mt-0.5">
                Relatório de desempenho cirúrgico e condutas anestesiológicas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition cursor-pointer"
              title="Imprimir Resumo"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={handleDownloadJson}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition cursor-pointer"
              title="Baixar Arquivo JSON"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition cursor-pointer"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Informações Básicas / Aluno / Aparelho */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold mb-1">
              <User size={14} /> Aluno / Operador
            </div>
            <div className="text-sm font-bold text-white truncate print:text-black">{data.studentName}</div>
            {data.sessionDeviceId && (
              <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                <Laptop size={11} /> {data.sessionDeviceId.slice(0, 12)}
              </div>
            )}
          </div>

          <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
            <div className="text-xs text-zinc-400 font-semibold mb-1">Paciente & Espécie</div>
            <div className="text-sm font-bold text-white truncate print:text-black">{data.patientName}</div>
            <div className="text-[10px] text-zinc-400">
              {formatSpecies(data.species)} {data.weightKg ? `· ${data.weightKg} kg` : ''} {data.asa ? `· ASA ${data.asa}` : ''}
            </div>
          </div>

          <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
            <div className="text-xs text-zinc-400 font-semibold mb-1">Procedimento</div>
            <div className="text-sm font-bold text-white truncate print:text-black">{data.procedureName || 'Procedimento Geral'}</div>
            <div className="text-[10px] text-zinc-400">Tempo: {formatSeconds(data.durationSeconds)}</div>
          </div>

          <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
            <div className="text-xs text-zinc-400 font-semibold mb-1">Data / Horário</div>
            <div className="text-sm font-bold text-white truncate print:text-black">
              {data.createdAt ? new Date(data.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
            </div>
            <div className="text-[10px] text-zinc-400">
              {data.createdAt ? new Date(data.createdAt).toLocaleTimeString() : new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Motivo de Óbito (se houver) */}
        {data.outcome === 'death' && (
          <div className="mb-4 p-3.5 bg-rose-950/30 border border-rose-800/60 rounded-xl text-rose-200 text-xs">
            <div className="font-bold flex items-center gap-1.5 text-rose-400 mb-1">
              <AlertTriangle size={15} /> Causa Registrada do Óbito:
            </div>
            <p>{data.deathCause || 'Parada cardiorrespiratória irreversível por colapso cardiovascular / choque refratário.'}</p>
          </div>
        )}

        {/* Sinais Vitais Finais */}
        <div className="mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Sinais Vitais Finais / Desfecho</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
              <span className="text-[11px] text-zinc-400 block">FC (bpm)</span>
              <strong className={`text-lg font-mono ${data.finalHr === 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                {data.finalHr ?? '--'}
              </strong>
            </div>
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
              <span className="text-[11px] text-zinc-400 block">PAM (mmHg)</span>
              <strong className={`text-lg font-mono ${(data.finalMap || 0) < 60 ? 'text-rose-400' : 'text-sky-400'}`}>
                {data.finalMap ?? '--'}
              </strong>
            </div>
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
              <span className="text-[11px] text-zinc-400 block">SpO₂ (%)</span>
              <strong className={`text-lg font-mono ${(data.finalSpo2 || 0) < 92 ? 'text-rose-400' : 'text-cyan-400'}`}>
                {data.finalSpo2 ?? '--'}%
              </strong>
            </div>
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
              <span className="text-[11px] text-zinc-400 block">EtCO₂ (mmHg)</span>
              <strong className="text-lg font-mono text-amber-400">
                {data.finalEtco2 ?? '--'}
              </strong>
            </div>
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-zinc-400 block">FR (mpm)</span>
              <strong className="text-lg font-mono text-indigo-400">
                {data.finalRr ?? '--'}
              </strong>
            </div>
          </div>
        </div>

        {/* Fármacos Administrados */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            <Syringe size={14} className="text-indigo-400" /> Fármacos e Doses Administrados ({data.administeredDrugs?.length || 0})
          </div>
          {data.administeredDrugs && data.administeredDrugs.length > 0 ? (
            <div className="max-h-40 overflow-y-auto border border-zinc-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 text-zinc-400 sticky top-0 border-b border-zinc-800">
                  <tr>
                    <th className="py-2 px-3">Tempo</th>
                    <th className="py-2 px-3">Fármaco</th>
                    <th className="py-2 px-3">Dose / kg</th>
                    <th className="py-2 px-3">Via / Tipo</th>
                    <th className="py-2 px-3">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                  {data.administeredDrugs.map((drug, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30">
                      <td className="py-1.5 px-3 text-zinc-500">
                        {drug.simTimeSec != null ? formatSeconds(drug.simTimeSec) : '--:--'}
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-white">{drug.name}</td>
                      <td className="py-1.5 px-3">
                        {drug.dosePerKg} {drug.doseUnit || 'mg/kg'}
                      </td>
                      <td className="py-1.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                          {drug.isCRI ? 'CRI' : drug.route || 'IV'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">{drug.volumeMl ? `${drug.volumeMl.toFixed(2)} mL` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic p-3 bg-zinc-950/40 rounded-xl border border-zinc-800">
              Nenhum fármaco administrado durante este período.
            </p>
          )}
        </div>

        {/* Resumo de Intercorrências / Eventos Críticos */}
        {data.eventsSummary && data.eventsSummary.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Principais Eventos e Intervenções ({data.eventsSummary.length})
            </h4>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {data.eventsSummary.slice(-10).map((ev, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                    ev.severity === 'danger'
                      ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                      : ev.severity === 'warning'
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <span>{ev.message}</span>
                  {ev.simTimeSec != null && (
                    <span className="text-[10px] font-mono text-zinc-500 ml-2 whitespace-nowrap">
                      {formatSeconds(ev.simTimeSec)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observações / Notas Clínicas */}
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Notas Clínicas e Comentários do Aluno / Instrutor:
          </label>
          <textarea
            value={data.clinicalNotes || ''}
            onChange={(e) => onUpdateNotes && onUpdateNotes(e.target.value)}
            placeholder="Insira aqui reflexões, justificativa de conduta, intercorrências observadas ou feedbacks da turma..."
            rows={2}
            className="w-full p-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-zinc-600 transition"
          />
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between print:hidden">
          <span className="text-xs text-zinc-500">
            Registro persistido no banco de dados para controle do administrador.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              Concluir e Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
