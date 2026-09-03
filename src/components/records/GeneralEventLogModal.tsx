import React, { useState, useMemo } from 'react';
import { LogEntry, PatientProfile } from '../../types/simulator';
import {
  FileText,
  Search,
  Filter,
  Syringe,
  Wind,
  HeartPulse,
  Sliders,
  AlertOctagon,
  CheckCircle2,
  X,
  Download,
  Clock,
} from 'lucide-react';

interface GeneralEventLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventLogs: LogEntry[];
  patient: PatientProfile;
  totalSimTimeSeconds: number;
}

export const GeneralEventLogModal: React.FC<GeneralEventLogModalProps> = ({
  isOpen,
  onClose,
  eventLogs,
  patient,
  totalSimTimeSeconds,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const formatSimTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredLogs = useMemo(() => {
    return eventLogs
      .filter((log) => {
        if (filterType !== 'all' && log.type !== filterType) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            log.message.toLowerCase().includes(q) ||
            (log.details && log.details.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .slice()
      .reverse(); // Most recent first
  }, [eventLogs, filterType, searchQuery]);

  if (!isOpen) return null;

  const handleExportText = () => {
    const lines = [
      `=== LOG GERAL DE ANESTESIA & CUIDADOS CRÍTICOS VETERINÁRIOS ===`,
      `Paciente: ${patient.name} (${patient.species.toUpperCase()} - ${patient.weightKg} kg)`,
      `Procedimento: ${patient.surgicalProcedure}`,
      `Tempo Total de Anestesia: ${formatSimTime(totalSimTimeSeconds)}`,
      `Total de Eventos: ${eventLogs.length}`,
      `------------------------------------------------------------`,
      ...eventLogs.map(
        (l) =>
          `[${formatSimTime(l.simTimeSeconds)}] [${l.type.toUpperCase()}] ${l.message} ${l.details ? `(${l.details})` : ''}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_anestesia_${patient.name.toLowerCase().replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0c0c10] border border-[#232330] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c26] bg-[#121218]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold text-[#f5f5f5] tracking-tight">
                  Log Geral de Acontecimentos & Respostas
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                  {eventLogs.length} EVENTOS
                </span>
              </div>
              <p className="text-xs text-[#8e8e9f]">
                Registro cronológico completo de fármacos, vias aéreas, manobras e respostas fisiológicas
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportText}
              className="px-2.5 py-1.5 rounded-lg bg-[#181822] hover:bg-[#232332] border border-[#2c2c3e] text-xs font-mono text-[#a0a0b5] hover:text-white transition flex items-center gap-1.5"
              title="Exportar Log em TXT"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#181822] hover:bg-[#232332] text-[#8e8e9f] hover:text-[#f5f5f5] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-[#1c1c26] bg-[#0f0f15] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'drug', label: 'Fármacos' },
              { id: 'equipment', label: 'Vias Aéreas/Equip' },
              { id: 'emergency', label: 'Emergência/PCR' },
              { id: 'vital', label: 'Sinais Vitais' },
              { id: 'system', label: 'Sistema' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`px-2.5 py-1 rounded-lg font-mono font-medium transition ${
                  filterType === t.id
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-[#181824] text-[#8e8e9f] hover:text-white hover:bg-[#202030]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#6c6c80]" />
            <input
              type="text"
              placeholder="Buscar no histórico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#14141e] border border-[#262638] rounded-lg text-white placeholder-[#606072] text-xs focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Logs List */}
        <div className="p-6 overflow-y-auto space-y-2.5 text-xs text-[#d0d0dc]">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-[#707085] space-y-1">
              <FileText className="w-8 h-8 mx-auto opacity-40 mb-2" />
              <p>Nenhum registro encontrado para este filtro.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isDanger = log.severity === 'danger';
              const isWarning = log.severity === 'warning';
              const isSuccess = log.severity === 'success';

              const borderClass = isDanger
                ? 'border-red-500/50 bg-red-950/20'
                : isWarning
                ? 'border-amber-500/50 bg-amber-950/20'
                : isSuccess
                ? 'border-emerald-500/50 bg-emerald-950/20'
                : 'border-[#20202c] bg-[#121218]';

              const badgeColor = isDanger
                ? 'bg-red-950 text-red-300 border-red-800/80'
                : isWarning
                ? 'bg-amber-950 text-amber-300 border-amber-800/80'
                : isSuccess
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                : 'bg-[#1a1a26] text-[#9a9ab0] border-[#2c2c3e]';

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border ${borderClass} flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 bg-black/40 border border-white/10 text-cyan-300">
                      {formatSimTime(log.simTimeSeconds)}
                    </span>

                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs">
                          {log.message}
                        </span>
                        <span
                          className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border font-bold ${badgeColor}`}
                        >
                          {log.type}
                        </span>
                      </div>

                      {log.details && (
                        <p className="text-[11px] text-[#9090a6] font-mono leading-relaxed">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-[#606072] font-mono shrink-0 text-right">
                    {log.realTimestamp}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#1c1c26] bg-[#121218] text-xs text-[#717182]">
          <span>Open VetSim Audit Trail · Log Geral Contínuo</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
