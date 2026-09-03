import React from 'react';
import { AnesthesiaEquipmentState, PatientProfile, VitalSigns } from '../../types/simulator';
import {
  Wind,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Gauge,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface AirwayQuickBarProps {
  equipment: AnesthesiaEquipmentState;
  patient: PatientProfile;
  vitals: VitalSigns;
  onUpdateEquipment: (updates: Partial<AnesthesiaEquipmentState>) => void;
  onTriggerManualBreath: () => void;
  onQuickIntubate: () => void;
  onExtubate: () => void;
}

export const AirwayQuickBar: React.FC<AirwayQuickBarProps> = ({
  equipment,
  patient,
  vitals,
  onUpdateEquipment,
  onTriggerManualBreath,
  onQuickIntubate,
  onExtubate,
}) => {
  const isIntubated = equipment.intubationStatus === 'intubated_tracheal';
  const isEsophageal = equipment.intubationStatus === 'intubated_esophageal';
  const isApneic = vitals.isRespiratoryArrest;

  const currentCadence = equipment.manualVentilationCadenceSeconds || 0;

  return (
    <div className="w-full bg-[#0d0d12] border border-[#232330] rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
      {/* Left: Airway Status Badge & Quick Intubation */}
      <div className="flex items-center space-x-3 w-full md:w-auto">
        <div
          className={`p-2 rounded-lg border flex items-center justify-center shrink-0 ${
            isIntubated
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : isEsophageal
              ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
              : isApneic
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
              : 'bg-[#181824] border-[#2c2c3e] text-[#8e8e9f]'
          }`}
        >
          <Wind className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm text-[#f5f5f5] tracking-tight">
              Via Aérea:
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase border ${
                isIntubated
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : isEsophageal
                  ? 'bg-red-950/80 border-red-500 text-red-200'
                  : 'bg-[#181820] border-[#2a2a38] text-[#a0a0b2]'
              }`}
            >
              {isIntubated
                ? `Intubado (${equipment.tubeSizeMm} mm)`
                : isEsophageal
                ? 'INTUBAÇÃO ESOFÁGICA!'
                : 'Não Intubado (Espontâneo)'}
            </span>

            {isApneic && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500 text-amber-300 text-[10px] font-bold animate-pulse">
                APNEIA ATIVA
              </span>
            )}
          </div>

          <div className="text-[11px] text-[#8e8e9f] flex items-center space-x-2 mt-0.5 font-mono">
            <span>Balonete: <strong>{equipment.cuffPressureCmH2O} cmH₂O</strong></span>
            <span>·</span>
            <span>Pressão Via Aérea (Paw): <strong>{equipment.currentAirwayPressureCmH2O} cmH₂O</strong></span>
          </div>
        </div>
      </div>

      {/* Center/Right: Action Buttons (Intubar / Apertar Balão / Cadência) */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
        {/* Quick Intubate / Extubate Button */}
        {!isIntubated ? (
          <button
            onClick={onQuickIntubate}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm text-xs ${
              isApneic
                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-bounce'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Intubar Paciente</span>
          </button>
        ) : (
          <button
            onClick={onExtubate}
            className="px-2.5 py-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#252533] border border-[#333346] text-[#b0b0c0] hover:text-white font-medium transition text-xs"
          >
            Extubar
          </button>
        )}

        {/* Manual Bag Squeeze Button (Apertar Balão) */}
        <button
          onClick={onTriggerManualBreath}
          disabled={!isIntubated}
          className={`px-3.5 py-1.5 rounded-lg font-extrabold transition flex items-center gap-1.5 text-xs shadow-md ${
            !isIntubated
              ? 'bg-[#181820] text-[#555566] border border-[#262633] cursor-not-allowed opacity-50'
              : 'bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white border border-cyan-400 shadow-cyan-900/40'
          }`}
          title={isIntubated ? 'Fornecer 1 incursão respiratória manual (12 ml/kg)' : 'Intube o paciente para ventilar manualmente'}
        >
          <Wind className="w-3.5 h-3.5 text-cyan-200" />
          <span>Apertar Balão (Manual)</span>
        </button>

        {/* Manual Cadence Selector */}
        <div className="flex items-center space-x-1.5 bg-[#14141e] px-2.5 py-1 rounded-lg border border-[#2a2a3c]">
          <span className="text-[10px] text-[#8e8e9f] font-semibold whitespace-nowrap">
            Cadência:
          </span>
          <select
            value={currentCadence}
            onChange={(e) => onUpdateEquipment({ manualVentilationCadenceSeconds: Number(e.target.value) })}
            disabled={!isIntubated}
            className="bg-[#1c1c2b] text-white text-[11px] font-mono rounded px-1.5 py-0.5 border border-[#333349] focus:outline-none focus:border-cyan-500 disabled:opacity-40"
          >
            <option value="0">Desligado (Manual)</option>
            <option value="5">A cada 5s (12 rpm)</option>
            <option value="6">A cada 6s (10 rpm)</option>
            <option value="8">A cada 8s (7.5 rpm)</option>
            <option value="10">A cada 10s (6 rpm)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
