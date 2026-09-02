import React from 'react';
import { AnesthesiaEquipmentState, PatientProfile } from '../../types/simulator';
import { Droplet, Flame, Power, Plus, Sparkles } from 'lucide-react';

interface FluidTherapyPanelProps {
  equipment: AnesthesiaEquipmentState;
  patient: PatientProfile;
  onUpdateEquipment: (updates: Partial<AnesthesiaEquipmentState>) => void;
  onGiveFluidBolus: (bolusMl: number, fluidName: string) => void;
}

export const FluidTherapyPanel: React.FC<FluidTherapyPanelProps> = ({
  equipment,
  patient,
  onUpdateEquipment,
  onGiveFluidBolus,
}) => {
  const surgicalRateMlPerHour = Math.round(
    patient.weightKg * (patient.species === 'feline' ? 3 : 5)
  );
  const maintenanceRateMlPerHour = Math.round(patient.weightKg * 2.5);
  const shockBolusMl = Math.round(patient.weightKg * 10);

  return (
    <div className="bg-[#0d0d0d] border border-[#222222] rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1f1f1f]">
        <div className="flex items-center space-x-2">
          <Droplet className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-[#f5f5f5]">FLUIDOTERAPIA & SUPORTE TÉRMICO</h3>
        </div>
        <span className="text-[11px] font-mono-code text-cyan-300">
          Infusão Total: <strong className="text-[#f5f5f5]">{equipment.totalFluidsInfusedMl.toFixed(0)} mL</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. FLUID INFUSION PUMP */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Bomba de Infusão Contínua</span>
            <button
              onClick={() => onUpdateEquipment({ isFluidPumpRunning: !equipment.isFluidPumpRunning })}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded font-mono-code transition ${
                equipment.isFluidPumpRunning
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-[#181818] border border-[#282828] text-[#888888] hover:text-[#e5e5e5]'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{equipment.isFluidPumpRunning ? 'EM INFUSÃO' : 'PARADA'}</span>
            </button>
          </div>

          {/* Solution Selector */}
          <div>
            <label className="text-[10px] text-[#888888] font-mono-code block mb-1">
              Solução / Cristaloide / Sangue:
            </label>
            <select
              value={equipment.activeFluidType}
              onChange={(e) => onUpdateEquipment({ activeFluidType: e.target.value })}
              className="w-full bg-[#0d0d0d] border border-[#333333] text-[#e5e5e5] text-xs rounded px-2 py-1.5 font-mono-code focus:outline-none"
            >
              <option value="Ringer com Lactato (LRS)">Ringer com Lactato (LRS)</option>
              <option value="NaCl 0.9% (Fisiológico)">NaCl 0.9% (Fisiológico)</option>
              <option value="Salina Hipertônica 7.2%">Salina Hipertônica 7.2%</option>
              <option value="Hetastarch (Coloide)">Hetastarch (Coloide)</option>
              <option value="Sangue Total Fresco">Sangue Total Fresco (Hemotransfusão)</option>
            </select>
          </div>

          {/* Rate presets & Slider */}
          <div>
            <div className="flex justify-between text-xs font-mono-code mb-1">
              <span className="text-[#888888]">Vazão da Bomba:</span>
              <strong className="text-cyan-300">
                {equipment.fluidRateMlPerHour} mL/h ({(equipment.fluidRateMlPerHour / patient.weightKg).toFixed(1)} ml/kg/h)
              </strong>
            </div>

            <input
              type="range"
              min="0"
              max={Math.max(100, Math.round(patient.weightKg * 30))}
              step="5"
              value={equipment.fluidRateMlPerHour}
              onChange={(e) => onUpdateEquipment({ fluidRateMlPerHour: parseInt(e.target.value) })}
              className="w-full accent-cyan-500 h-2 bg-[#222222] rounded-lg cursor-pointer"
            />

            {/* Quick Rate Presets */}
            <div className="grid grid-cols-3 gap-1 mt-2 text-[10px] font-mono-code">
              <button
                onClick={() => onUpdateEquipment({ fluidRateMlPerHour: maintenanceRateMlPerHour, isFluidPumpRunning: true })}
                className="py-1 rounded bg-[#181818] hover:bg-[#222222] border border-[#282828] text-[#a3a3a3]"
              >
                Manutenção ({maintenanceRateMlPerHour} ml/h)
              </button>
              <button
                onClick={() => onUpdateEquipment({ fluidRateMlPerHour: surgicalRateMlPerHour, isFluidPumpRunning: true })}
                className="py-1 rounded bg-[#0b1f24] hover:bg-[#112d35] border border-cyan-800/80 text-cyan-300 font-bold"
              >
                Cirúrgico ({surgicalRateMlPerHour} ml/h)
              </button>
              <button
                onClick={() => onGiveFluidBolus(shockBolusMl, equipment.activeFluidType)}
                className="py-1 rounded bg-[#2b1708] hover:bg-[#3d210b] border border-amber-800/80 text-amber-300 font-bold"
                title="Bólus rápido de ressuscitação"
              >
                Bólus ({shockBolusMl} mL)
              </button>
            </div>
          </div>
        </div>

        {/* 2. THERMAL SUPPORT & BLANKET */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Aquecimento Ativo (Bair Hugger / Colchão Térmico)</span>
            <button
              onClick={() => onUpdateEquipment({ warmingBlanketActive: !equipment.warmingBlanketActive })}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded font-mono-code transition ${
                equipment.warmingBlanketActive
                  ? 'bg-orange-600 text-white font-bold'
                  : 'bg-[#181818] border border-[#282828] text-[#888888] hover:text-[#e5e5e5]'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>{equipment.warmingBlanketActive ? 'AQUECEDOR ON' : 'DESLIGADO'}</span>
            </button>
          </div>

          <p className="text-xs text-[#888888]">
            A anestesia geral compromete o centro termorregulador hipotalâmico, favorecendo perda de calor por radiação, convecção e evaporação cirúrgica.
          </p>

          <div className="p-2 rounded bg-[#171717] border border-[#262626] flex items-center justify-between text-xs font-mono-code">
            <span className="text-[#888888]">Temperatura Alvo do Colchão:</span>
            <span className="font-bold text-orange-400">{equipment.warmingBlanketTempC}°C</span>
          </div>

          <div className="text-[10px] text-[#737373] font-mono-code">
            Impacto: Previne bradicardias hipotérmicas, coagulopatias e prolongamento da recuperação anestésica.
          </div>
        </div>
      </div>
    </div>
  );
};
