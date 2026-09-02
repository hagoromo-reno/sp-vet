import React from 'react';
import { AnesthesiaEquipmentState, SpeciesType } from '../../types/simulator';
import { SPECIES_DATABASE } from '../../data/speciesData';
import { Wind, Power, RotateCcw, AlertOctagon } from 'lucide-react';

interface VaporizerMachineProps {
  equipment: AnesthesiaEquipmentState;
  species: SpeciesType;
  onUpdateEquipment: (updates: Partial<AnesthesiaEquipmentState>) => void;
  onOxygenFlush: () => void;
  onManualBagSqueeze: () => void;
}

export const VaporizerMachine: React.FC<VaporizerMachineProps> = ({
  equipment,
  species,
  onUpdateEquipment,
  onOxygenFlush,
  onManualBagSqueeze,
}) => {
  const speciesInfo = SPECIES_DATABASE[species] || SPECIES_DATABASE.canine;
  const currentMac = equipment.vaporizerType === 'isoflurane' 
    ? speciesInfo.macValues.isoflurane 
    : speciesInfo.macValues.sevoflurane;

  const deliveredMacMultiplier = equipment.isVaporizerOn && equipment.oxygenFlowLMin > 0.2
    ? (equipment.vaporizerDialPct / currentMac).toFixed(2)
    : '0.00';

  return (
    <div className="bg-[#0d0d0d] border border-[#222222] rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-2xl">
      {/* Station Title */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1f1f1f]">
        <div className="flex items-center space-x-2">
          <Wind className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-[#f5f5f5]">APARELHO DE ANESTESIA INALATÓRIA</h3>
        </div>
        <span className="text-[11px] font-mono-code px-2 py-0.5 rounded bg-[#171717] border border-[#262626] text-[#a3a3a3]">
          Circuito: {equipment.circuitType.includes('circle') ? 'Valvular Fechado (Baraka/Circle)' : 'Não-Reinalatório (Bain)'}
        </span>
      </div>

      {/* Grid: Gas Flowmeter & Vaporizer Dial */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. OXYGEN FLOWMETER */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#a3a3a3]">
            <span className="font-semibold text-emerald-400">Fluxômetro O₂</span>
            <span className="font-mono-code text-[#f5f5f5] font-bold">{equipment.oxygenFlowLMin.toFixed(1)} L/min</span>
          </div>

          {/* Flowmeter Slider */}
          <div className="my-2">
            <input
              type="range"
              min="0.0"
              max="5.0"
              step="0.1"
              value={equipment.oxygenFlowLMin}
              onChange={(e) => onUpdateEquipment({ oxygenFlowLMin: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-[#222222] rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-[#737373] font-mono-code mt-1">
              <span>0.0 L/m</span>
              <span>1.0</span>
              <span>2.5</span>
              <span>5.0 L/m</span>
            </div>
          </div>

          {/* O2 Flush Purge Button */}
          <button
            onClick={onOxygenFlush}
            className="w-full py-1.5 px-2 rounded bg-[#0f1f16] hover:bg-[#162d20] border border-emerald-700/60 text-emerald-300 text-xs font-bold font-mono-code transition flex items-center justify-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>FLUSH O₂ RÁPIDO (Purga)</span>
          </button>
        </div>

        {/* 2. VAPORIZER CALIBRATED DIAL */}
        <div
          className={`p-3 border rounded-lg flex flex-col justify-between transition ${
            equipment.isVaporizerOn
              ? equipment.vaporizerType === 'isoflurane'
                ? 'bg-[#180f24] border-purple-800/70'
                : 'bg-[#221c0b] border-yellow-800/70'
              : 'bg-[#121212] border-[#222222]'
          }`}
        >
          <div className="flex items-center justify-between">
            {/* Vaporizer Agent Selector */}
            <div className="flex rounded bg-[#0a0a0a] p-0.5 border border-[#262626] text-[10px] font-bold">
              <button
                onClick={() => onUpdateEquipment({ vaporizerType: 'isoflurane' })}
                className={`px-2 py-0.5 rounded transition ${
                  equipment.vaporizerType === 'isoflurane'
                    ? 'bg-purple-600 text-white'
                    : 'text-[#737373] hover:text-[#d4d4d4]'
                }`}
              >
                Isoflurano (Roxo)
              </button>
              <button
                onClick={() => onUpdateEquipment({ vaporizerType: 'sevoflurane' })}
                className={`px-2 py-0.5 rounded transition ${
                  equipment.vaporizerType === 'sevoflurane'
                    ? 'bg-yellow-600 text-black font-bold'
                    : 'text-[#737373] hover:text-[#d4d4d4]'
                }`}
              >
                Sevoflurano (Amarelo)
              </button>
            </div>

            {/* Power Toggle */}
            <button
              onClick={() => onUpdateEquipment({ isVaporizerOn: !equipment.isVaporizerOn })}
              className={`p-1.5 rounded transition ${
                equipment.isVaporizerOn
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#1a1a1a] border border-[#2c2c2c] text-[#737373] hover:text-[#e5e5e5]'
              }`}
              title="Ligar / Desligar Vaporizador"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Vaporizer Dial Readout */}
          <div className="my-1 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold font-digital tracking-wide ${
                equipment.isVaporizerOn
                  ? equipment.vaporizerType === 'isoflurane' ? 'text-purple-300' : 'text-yellow-300'
                  : 'text-[#525252]'
              }`}
            >
              {equipment.isVaporizerOn ? `${equipment.vaporizerDialPct.toFixed(1)} %` : '0.0 % (OFF)'}
            </span>
            <span className="text-[11px] font-mono-code text-[#888888]">
              CAM Entregue: <strong className="text-[#f5f5f5]">{deliveredMacMultiplier}x MAC</strong>
            </span>
          </div>

          {/* Dial Slider */}
          <input
            type="range"
            min="0.0"
            max="5.0"
            step="0.1"
            disabled={!equipment.isVaporizerOn}
            value={equipment.vaporizerDialPct}
            onChange={(e) => onUpdateEquipment({ vaporizerDialPct: parseFloat(e.target.value) })}
            className={`w-full cursor-pointer h-2 bg-[#222222] rounded-lg ${
              equipment.vaporizerType === 'isoflurane' ? 'accent-purple-500' : 'accent-yellow-500'
            }`}
          />
          <div className="text-[10px] text-[#737373] font-mono-code flex justify-between">
            <span>CAM Espécie ({speciesInfo.namePt.split(' ')[0]}): {currentMac}%</span>
            <span>{equipment.isVaporizerOn ? 'Ativo' : 'Desligado'}</span>
          </div>
        </div>

        {/* 3. APL POP-OFF VALVE & SODA LIME CANISTER */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#d4d4d4]">Válvula Pop-Off (APL)</span>
            <span
              className={`font-mono-code text-[11px] px-1.5 py-0.5 rounded font-bold ${
                equipment.aplValveState === 'open'
                  ? 'bg-[#0f2415] text-emerald-400 border border-emerald-800'
                  : 'bg-[#2b0c0f] text-red-400 border border-red-800 animate-pulse'
              }`}
            >
              {equipment.aplValveState === 'open' ? 'ABERTA (Segura)' : 'FECHADA (Perigo Barotrauma!)'}
            </span>
          </div>

          <div className="flex space-x-1.5 my-2">
            <button
              onClick={() => onUpdateEquipment({ aplValveState: 'open' })}
              className={`flex-1 py-1 text-xs rounded font-medium transition ${
                equipment.aplValveState === 'open'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-[#181818] border border-[#282828] text-[#888888] hover:text-[#f5f5f5]'
              }`}
            >
              Aberta
            </button>
            <button
              onClick={() => onUpdateEquipment({ aplValveState: 'closed' })}
              className={`flex-1 py-1 text-xs rounded font-medium transition ${
                equipment.aplValveState === 'closed'
                  ? 'bg-red-600 text-white font-bold'
                  : 'bg-[#181818] border border-[#282828] text-[#888888] hover:text-[#f5f5f5]'
              }`}
            >
              Fechada
            </button>
          </div>

          {/* Bag Squeeze button */}
          <button
            onClick={onManualBagSqueeze}
            className="w-full py-1.5 px-2 rounded bg-[#16122b] hover:bg-[#201a3d] border border-indigo-700/60 text-indigo-300 text-xs font-bold font-mono-code transition flex items-center justify-center space-x-1"
          >
            <span>AMBU / COMPRIMIR BALÃO RESERVATÓRIO</span>
          </button>

          {/* Soda Lime Exhaustion Indicator */}
          {equipment.circuitType.includes('circle') && (
            <div className="mt-1 flex items-center justify-between text-[10px] text-[#888888] font-mono-code">
              <span>Cal Sodada:</span>
              <span className={equipment.sodaLimeExhaustionPct > 70 ? 'text-purple-400 font-bold' : 'text-[#f5f5f5]'}>
                {equipment.sodaLimeExhaustionPct > 70 ? '🟣 Saturada (Risco Reinalação!)' : '⚪ Fresca'} ({equipment.sodaLimeExhaustionPct.toFixed(0)}%)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
