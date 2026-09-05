import React from 'react';
import { LogEntry, PatientProfile, VitalRecordPoint } from '../../types/simulator';
import { FileText, Printer, Clock, CheckCircle2 } from 'lucide-react';
import { formatDecimal, formatPressure, formatRate, formatSpecies } from '../../utils/formatters';

interface AnesthesiaRecordSheetProps {
  patient: PatientProfile;
  vitalLogs: VitalRecordPoint[];
  eventLogs: LogEntry[];
  totalSimDurationSeconds: number;
}

export const AnesthesiaRecordSheet: React.FC<AnesthesiaRecordSheetProps> = ({
  patient,
  vitalLogs,
  eventLogs,
  totalSimDurationSeconds,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#0d0d0d] border border-[#222222] rounded-xl p-4 flex flex-col space-y-4 shadow-2xl">
      {/* Header & Print Action */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1f1f1f]">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-[#f5f5f5]">FICHA DE ANESTESIOLOGIA VETERINÁRIA (REGISTRO OFICIAL)</h3>
            <span className="text-[11px] text-[#888888]">
              Duração da Anestesia: <strong className="text-[#e5e5e5]">{formatTime(totalSimDurationSeconds)}</strong>
            </span>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono-code transition shadow"
        >
          <Printer className="w-4 h-4" />
          <span>IMPRIMIR FICHA</span>
        </button>
      </div>

      {/* Patient & Surgical Metadata Header Table */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-[#121212] border border-[#222222] rounded-lg text-xs font-mono-code">
        <div>
          <span className="text-[#737373] block text-[10px]">PACIENTE:</span>
          <strong className="text-[#f5f5f5]">{patient.name} ({formatSpecies(patient.species).toUpperCase()})</strong>
        </div>
        <div>
          <span className="text-[#737373] block text-[10px]">RAÇA / PESO:</span>
          <strong className="text-[#f5f5f5]">{patient.breed} · {patient.weightKg} kg</strong>
        </div>
        <div>
          <span className="text-[#737373] block text-[10px]">CLASSIFICAÇÃO ASA:</span>
          <strong className="text-emerald-400 font-bold">Classe ASA {patient.asa}</strong>
        </div>
        <div>
          <span className="text-[#737373] block text-[10px]">PROCEDIMENTO CIRÚRGICO:</span>
          <strong className="text-[#f5f5f5] truncate block">{patient.surgicalProcedure}</strong>
        </div>
      </div>

      {/* Vital Signs Periodic Log Table (5-min intervals) */}
      <div>
        <h4 className="text-xs font-bold text-[#d4d4d4] mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          Mapeamento Cronológico dos Parâmetros Vitais
        </h4>

        {vitalLogs.length === 0 ? (
          <div className="p-4 rounded-lg bg-[#121212] border border-[#222222] text-center text-xs text-[#737373] font-mono-code">
            Nenhum registro gravado ainda. Os registros são salvos automaticamente a cada intervalo da simulação.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#222222]">
            <table className="w-full text-left text-xs font-mono-code">
              <thead className="bg-[#0a0a0a] text-[#888888] text-[10px] uppercase border-b border-[#222222]">
                <tr>
                  <th className="p-2">Tempo</th>
                  <th className="p-2 text-emerald-400">FC (bpm)</th>
                  <th className="p-2 text-red-400">PA (Sys/Dia)</th>
                  <th className="p-2 text-red-300">PAM</th>
                  <th className="p-2 text-cyan-400">SpO₂ (%)</th>
                  <th className="p-2 text-yellow-400">EtCO₂</th>
                  <th className="p-2 text-yellow-300">FR (rpm)</th>
                  <th className="p-2 text-orange-400">Temp (°C)</th>
                  <th className="p-2 text-pink-300">Glicemia</th>
                  <th className="p-2 text-rose-300">Dor</th>
                  <th className="p-2 text-indigo-300">Atividade</th>
                  <th className="p-2 text-purple-400">Inalatório %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f] bg-[#121212]">
                {vitalLogs.slice(-10).map((log, idx) => (
                  <tr key={idx} className="hover:bg-[#181818]">
                    <td className="p-2 font-bold text-[#e5e5e5]">{log.timeLabel}</td>
                    <td className="p-2 text-emerald-300 font-bold">{formatRate(log.hr)}</td>
                    <td className="p-2 text-red-300">{formatPressure(log.sysBP)}/{formatPressure(log.diaBP)}</td>
                    <td className="p-2 text-red-400 font-bold">({formatPressure(log.map)})</td>
                    <td className="p-2 text-cyan-300">{formatRate(log.spo2)}%</td>
                    <td className="p-2 text-yellow-300">{formatPressure(log.etco2)}</td>
                    <td className="p-2 text-yellow-200">{formatRate(log.rr)}</td>
                    <td className="p-2 text-orange-300">{formatDecimal(log.tempC, 1)}°C</td>
                    <td className="p-2 text-pink-200">{formatRate(log.glucoseMgDl)} mg/dL</td>
                    <td className="p-2 text-rose-200">{formatDecimal(log.painScore, 1)}/10</td>
                    <td className="p-2 text-indigo-200">{formatRate(log.activityLevelPct)}%</td>
                    <td className="p-2 text-purple-300">{formatDecimal(log.vaporizerPct, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event Logs & Administered Interventions Timeline */}
      <div>
        <h4 className="text-xs font-bold text-[#d4d4d4] mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Registro Cronológico de Eventos & Medicações
        </h4>

        <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-[#222222] bg-[#0e0e0e] p-2.5 text-xs font-mono-code">
          {eventLogs.length === 0 ? (
            <div className="text-[#737373] text-center py-2">Sem eventos registrados.</div>
          ) : (
            eventLogs.slice(-15).reverse().map((entry) => (
              <div
                key={entry.id}
                className={`p-1.5 rounded flex items-start space-x-2 ${
                  entry.severity === 'danger'
                    ? 'bg-[#2b0c0f]/80 border border-red-900/60 text-red-300'
                    : entry.severity === 'warning'
                    ? 'bg-[#2b1708]/80 border border-amber-900/60 text-amber-300'
                    : entry.severity === 'success'
                    ? 'bg-[#0f2415]/80 border border-emerald-900/60 text-emerald-300'
                    : 'bg-[#171717] text-[#d4d4d4] border border-[#262626]'
                }`}
              >
                <span className="text-[10px] text-[#737373] shrink-0 mt-0.5">
                  [{formatTime(entry.simTimeSeconds)}]
                </span>
                <div className="flex-1">
                  <span className="font-bold">{entry.message}</span>
                  {entry.details && <span className="text-[11px] text-[#888888] ml-1.5">{entry.details}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
