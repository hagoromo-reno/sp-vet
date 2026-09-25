import { FluidInfusionControls } from './FluidInfusionControls';
import React from 'react';
import { AnesthesiaEquipmentState, PatientProfile, VitalSigns } from '../../types/simulator';
import { Droplet, Flame, Power, Plus, Sparkles } from 'lucide-react';

interface FluidTherapyPanelProps {
  equipment: AnesthesiaEquipmentState;
  patient: PatientProfile;
  vitals?: VitalSigns;
  onUpdateEquipment: (updates: Partial<AnesthesiaEquipmentState>) => void;
  onGiveFluidBolus: (bolusMl: number, fluidName: string, durationSec: number) => void;
}

export const FluidTherapyPanel: React.FC<FluidTherapyPanelProps> = ({
  equipment,
  patient,
  vitals,
  onUpdateEquipment,
  onGiveFluidBolus,
}) => {
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
        <FluidInfusionControls equipment={equipment} patient={patient} vitals={vitals} onUpdateEquipment={onUpdateEquipment} onGiveFluidBolus={onGiveFluidBolus} />

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
              <span>{equipment.warmingBlanketActive ? 'AQUECEDOR ATIVO' : 'DESLIGADO'}</span>
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
