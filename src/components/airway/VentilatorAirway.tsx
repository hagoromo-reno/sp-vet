import React from 'react';
import { AnesthesiaEquipmentState, PatientProfile } from '../../types/simulator';
import { SPECIES_DATABASE } from '../../data/speciesData';
import { Activity, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

interface VentilatorAirwayProps {
  equipment: AnesthesiaEquipmentState;
  patient: PatientProfile;
  onUpdateEquipment: (updates: Partial<AnesthesiaEquipmentState>) => void;
  onPerformIntubation: (isCorrectTracheal: boolean, tubeSizeMm: number) => void;
  onExtubate: () => void;
}

export const VentilatorAirway: React.FC<VentilatorAirwayProps> = ({
  equipment,
  patient,
  onUpdateEquipment,
  onPerformIntubation,
  onExtubate,
}) => {
  const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
  const isIntubated = equipment.intubationStatus === 'intubated_tracheal';
  const isEsophageal = equipment.intubationStatus === 'intubated_esophageal';

  return (
    <div className="bg-[#0d0d0d] border border-[#222222] rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-2xl">
      {/* Airway Management Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1f1f1f]">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-[#f5f5f5]">VIAS AÉREAS & VENTILADOR MECÂNICO</h3>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span
            className={`px-2 py-0.5 rounded-full font-bold font-mono-code ${
              isIntubated
                ? 'bg-[#0f2415] text-emerald-300 border border-emerald-700/80'
                : isEsophageal
                ? 'bg-[#2b0c0f] text-red-300 border border-red-700/80 animate-pulse'
                : 'bg-[#171717] border border-[#262626] text-[#888888]'
            }`}
          >
            {isIntubated
              ? `Tubo Traqueal #${equipment.tubeSizeMm} mm`
              : isEsophageal
              ? 'ALERTA: INTUBAÇÃO ESOFÁGICA!'
              : 'Não Intubado (Espontâneo)'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. ENDOTRACHEAL INTUBATION STATION */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Intubação Orotraqueal (IOT)</span>
            <span className="text-[10px] text-[#737373] font-mono-code">
              Recomendado: {speciesInfo.recommendedEtTubeRange.min} - {speciesInfo.recommendedEtTubeRange.max} mm
            </span>
          </div>

          {/* Tube Selection & Intubation Buttons */}
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              <label className="text-[10px] text-[#888888] font-mono-code block mb-1">
                Diâmetro Interno (ID mm):
              </label>
              <select
                value={equipment.tubeSizeMm}
                onChange={(e) => onUpdateEquipment({ tubeSizeMm: parseFloat(e.target.value) })}
                className="w-full bg-[#0d0d0d] border border-[#333333] text-[#e5e5e5] text-xs rounded px-2 py-1.5 font-mono-code focus:outline-none"
              >
                {[2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 11.0, 12.0, 14.0, 18.0, 22.0].map(
                  (size) => (
                    <option key={size} value={size}>
                      Sonda #{size} mm
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="flex-1">
              <label className="text-[10px] text-[#888888] font-mono-code block mb-1">
                Pressão do Balonete (Cuff):
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="range"
                  min="0"
                  max="35"
                  value={equipment.cuffPressureCmH2O}
                  onChange={(e) => onUpdateEquipment({ cuffPressureCmH2O: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-2 bg-[#222222] rounded"
                />
                <span className="text-xs font-mono-code text-[#f5f5f5] font-bold shrink-0">
                  {equipment.cuffPressureCmH2O} cmH₂O
                </span>
              </div>
            </div>
          </div>

          {/* Intubation Action Controls */}
          <div className="flex space-x-2 pt-1">
            {!isIntubated && !isEsophageal ? (
              <>
                <button
                  onClick={() => onPerformIntubation(true, equipment.tubeSizeMm)}
                  className="flex-1 py-1.5 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono-code transition flex items-center justify-center space-x-1 shadow-md shadow-black/40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>INTUBAR TRAQUEIA</span>
                </button>

                <button
                  onClick={() => onPerformIntubation(false, equipment.tubeSizeMm)}
                  className="py-1.5 px-2 rounded bg-[#2b0c0f] hover:bg-[#3d1217] border border-red-800/80 text-red-300 text-xs font-medium font-mono-code transition"
                  title="Simular acidente de intubação esofágica"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={onExtubate}
                className="w-full py-1.5 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-mono-code transition flex items-center justify-center space-x-1 shadow-md"
              >
                <span>EXTUBAR PACIENTE</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. MECHANICAL VENTILATOR SETTINGS */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Ventilador Mecânico</span>
            <div className="flex items-center space-x-2">
              {/* Ventilator Mode Selector */}
              <div className="flex rounded bg-[#0a0a0a] p-0.5 border border-[#262626] text-[10px] font-mono-code">
                <button
                  onClick={() => onUpdateEquipment({ ventilatorMode: 'spontaneous', isVentilatorActive: false })}
                  className={`px-1.5 py-0.5 rounded transition ${
                    equipment.ventilatorMode === 'spontaneous' ? 'bg-[#262626] text-white font-bold' : 'text-[#737373]'
                  }`}
                >
                  Espontâneo
                </button>
                <button
                  onClick={() => onUpdateEquipment({ ventilatorMode: 'cmv_volume', isVentilatorActive: true })}
                  className={`px-1.5 py-0.5 rounded transition ${
                    equipment.ventilatorMode === 'cmv_volume' ? 'bg-cyan-700 text-white font-bold' : 'text-[#737373]'
                  }`}
                >
                  VCV (Volume)
                </button>
                <button
                  onClick={() => onUpdateEquipment({ ventilatorMode: 'pcv_pressure', isVentilatorActive: true })}
                  className={`px-1.5 py-0.5 rounded transition ${
                    equipment.ventilatorMode === 'pcv_pressure' ? 'bg-indigo-700 text-white font-bold' : 'text-[#737373]'
                  }`}
                >
                  PCV (Pressão)
                </button>
              </div>
            </div>
          </div>

          {/* Ventilator Parameters Slider Controls */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono-code">
            <div>
              <div className="flex justify-between text-[10px] text-[#888888] mb-0.5">
                <span>Freq. Resp:</span>
                <strong className="text-cyan-300">{equipment.ventilatorSettings.rateBpm} rpm</strong>
              </div>
              <input
                type="range"
                min="4"
                max="40"
                disabled={equipment.ventilatorMode === 'spontaneous'}
                value={equipment.ventilatorSettings.rateBpm}
                onChange={(e) =>
                  onUpdateEquipment({
                    ventilatorSettings: {
                      ...equipment.ventilatorSettings,
                      rateBpm: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full accent-cyan-500 h-1.5 bg-[#222222] rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#888888] mb-0.5">
                <span>Vol. Corrente (VT):</span>
                <strong className="text-cyan-300">
                  {equipment.ventilatorSettings.tidalVolumeMl} mL ({(equipment.ventilatorSettings.tidalVolumeMl / patient.weightKg).toFixed(1)} ml/kg)
                </strong>
              </div>
              <input
                type="range"
                min={Math.round(patient.weightKg * 5)}
                max={Math.round(patient.weightKg * 25)}
                disabled={equipment.ventilatorMode === 'spontaneous'}
                value={equipment.ventilatorSettings.tidalVolumeMl}
                onChange={(e) =>
                  onUpdateEquipment({
                    ventilatorSettings: {
                      ...equipment.ventilatorSettings,
                      tidalVolumeMl: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full accent-cyan-500 h-1.5 bg-[#222222] rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#888888] mb-0.5">
                <span>Limite PIP:</span>
                <strong className="text-cyan-300">{equipment.ventilatorSettings.pipPressureLimitCmH2O} cmH₂O</strong>
              </div>
              <input
                type="range"
                min="10"
                max="35"
                disabled={equipment.ventilatorMode === 'spontaneous'}
                value={equipment.ventilatorSettings.pipPressureLimitCmH2O}
                onChange={(e) =>
                  onUpdateEquipment({
                    ventilatorSettings: {
                      ...equipment.ventilatorSettings,
                      pipPressureLimitCmH2O: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full accent-cyan-500 h-1.5 bg-[#222222] rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-[#888888] mb-0.5">
                <span>PEEP:</span>
                <strong className="text-cyan-300">{equipment.ventilatorSettings.peepCmH2O} cmH₂O</strong>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                disabled={equipment.ventilatorMode === 'spontaneous'}
                value={equipment.ventilatorSettings.peepCmH2O}
                onChange={(e) =>
                  onUpdateEquipment({
                    ventilatorSettings: {
                      ...equipment.ventilatorSettings,
                      peepCmH2O: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full accent-cyan-500 h-1.5 bg-[#222222] rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
