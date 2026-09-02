import React, { useState, useEffect } from 'react';
import { PatientProfile, ResuscitationState, VitalSigns } from '../../types/simulator';
import { AudioSynthesizer } from '../../engine/audioSynthesizer';
import { HeartPulse, Zap, ShieldAlert, Play, Square, Syringe, Clock } from 'lucide-react';

interface CPCRResuscitationPanelProps {
  patient: PatientProfile;
  vitals: VitalSigns;
  resuscitation: ResuscitationState;
  onUpdateResuscitation: (updates: Partial<ResuscitationState>) => void;
  onAdministerQuickEmergencyDrug: (drugId: string, dosePerKg: number, route: 'IV' | 'IV_slow') => void;
}

export const CPCRResuscitationPanel: React.FC<CPCRResuscitationPanelProps> = ({
  patient,
  vitals,
  resuscitation,
  onUpdateResuscitation,
  onAdministerQuickEmergencyDrug,
}) => {
  const [cprCycleSeconds, setCprCycleSeconds] = useState(0);
  const [isChargingDefib, setIsChargingDefib] = useState(false);

  // Recommended Shock Energy (RECOVER 2024: 2 - 4 J/kg)
  const recommendedJoules = Math.round(patient.weightKg * 3);

  // CPR Timer cycle (2-minute cycles recommended by RECOVER)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resuscitation.isCPRActive) {
      interval = setInterval(() => {
        setCprCycleSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCprCycleSeconds(0);
    }
    return () => clearInterval(interval);
  }, [resuscitation.isCPRActive]);

  const handleToggleCPR = () => {
    onUpdateResuscitation({
      isCPRActive: !resuscitation.isCPRActive,
      compressionsPerMin: 110,
      compressionDepthQuality: 0.85,
    });
  };

  const handleChargeDefib = () => {
    setIsChargingDefib(true);
    setTimeout(() => {
      onUpdateResuscitation({
        defibrillatorChargedJoules: recommendedJoules,
        isDefibrillatorArmed: true,
      });
      setIsChargingDefib(false);
    }, 1500);
  };

  const handleDeliverShock = () => {
    AudioSynthesizer.playDefibrillatorShock();
    onUpdateResuscitation({
      defibrillatorChargedJoules: 0,
      isDefibrillatorArmed: false,
    });
  };

  const formatCycleTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#0d0d0d] border border-red-900/40 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-2xl">
      {/* Station Title */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1f1f1f]">
        <div className="flex items-center space-x-2">
          <HeartPulse className="w-5 h-5 text-red-500 animate-pulse" />
          <h3 className="text-sm font-bold text-[#f5f5f5]">RESSUSCITAÇÃO CARDIOPULMONAR (CPCR · DIRETRIZES RECOVER)</h3>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono-code">
          <Clock className="w-3.5 h-3.5 text-[#888888]" />
          <span className="text-[#888888]">Ciclo CPR (2 min):</span>
          <strong className={cprCycleSeconds >= 120 ? 'text-red-400 animate-pulse' : 'text-[#f5f5f5]'}>
            {formatCycleTime(cprCycleSeconds)}
          </strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* 1. CHEST COMPRESSIONS STATION */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Compressões Torácicas</span>
            <span className="text-[10px] text-[#737373] font-mono-code">100-120 /min</span>
          </div>

          <p className="text-[11px] text-[#888888]">
            Comprima 1/3 a 1/2 da largura torácica com retorno total do tórax entre compressões ininterruptas por 2 minutos.
          </p>

          <button
            onClick={handleToggleCPR}
            className={`w-full py-2.5 px-3 rounded-lg text-xs font-extrabold font-mono-code transition flex items-center justify-center space-x-2 shadow-lg ${
              resuscitation.isCPRActive
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-red-950/60'
                : 'bg-[#181818] hover:bg-[#222222] text-[#e5e5e5] border border-[#2c2c2c]'
            }`}
          >
            {resuscitation.isCPRActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{resuscitation.isCPRActive ? 'PARAR MASSAGEM CARDÍACA' : 'INICIAR COMPRESSÕES TORÁCICAS'}</span>
          </button>
        </div>

        {/* 2. ELECTRICAL DEFIBRILLATOR (VFIB / VTACH) */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Desfibrilador Bifásico</span>
            <span className="text-[10px] font-mono-code text-amber-400 font-bold">
              {recommendedJoules} Joules (3 J/kg)
            </span>
          </div>

          <div className="text-[11px] text-[#888888]">
            Ritmos Chocáveis: <strong className="text-amber-300">Fibrilação Ventricular (FV) / TV Sem Pulso</strong>.
          </div>

          <div className="flex space-x-2 pt-1">
            <button
              onClick={handleChargeDefib}
              disabled={isChargingDefib || resuscitation.isDefibrillatorArmed}
              className={`flex-1 py-2 px-2 rounded text-xs font-bold font-mono-code transition ${
                resuscitation.isDefibrillatorArmed
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#181818] text-amber-400 hover:bg-[#222222] border border-amber-800/40'
              }`}
            >
              {isChargingDefib ? 'CARREGANDO...' : resuscitation.isDefibrillatorArmed ? 'CARREGADO' : '1. CARREGAR (J)'}
            </button>

            <button
              onClick={handleDeliverShock}
              disabled={!resuscitation.isDefibrillatorArmed}
              className={`flex-1 py-2 px-2 rounded text-xs font-extrabold font-mono-code transition flex items-center justify-center space-x-1 shadow-lg ${
                resuscitation.isDefibrillatorArmed
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-bounce shadow-red-950/60'
                  : 'bg-[#141414] text-[#525252] border border-[#222222] cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>2. DISPARAR CHOQUE</span>
            </button>
          </div>
        </div>

        {/* 3. QUICK-ACCESS EMERGENCY DRUGS */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Fármacos de Emergência (Dose Rápida 1-Clique)</span>
            <Syringe className="w-3.5 h-3.5 text-red-400" />
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono-code">
            <button
              onClick={() => onAdministerQuickEmergencyDrug('epinephrine', 0.01, 'IV')}
              className="p-1.5 rounded bg-[#2b0c0f] hover:bg-[#3d1217] border border-red-800/70 text-red-300 font-bold transition truncate"
              title="Adrenalina dose baixa (0.01 mg/kg)"
            >
              ⚡ Adrenalina (0.01 mg/kg)
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('atropine', 0.04, 'IV')}
              className="p-1.5 rounded bg-[#2b1708] hover:bg-[#3d210b] border border-amber-800/70 text-amber-300 font-bold transition truncate"
              title="Atropina dose alta de PCR (0.04 mg/kg)"
            >
              💉 Atropina (0.04 mg/kg)
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('lidocaine_2pct', 2.0, 'IV_slow')}
              className="p-1.5 rounded bg-[#0b1f24] hover:bg-[#112d35] border border-cyan-800/70 text-cyan-300 font-bold transition truncate"
              title="Lidocaína 2% para VPCs/TV (2 mg/kg)"
            >
              🛡️ Lidocaína 2% (2 mg/kg)
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('calcium_gluconate', 100.0, 'IV_slow')}
              className="p-1.5 rounded bg-[#0f2415] hover:bg-[#15331e] border border-emerald-800/70 text-emerald-300 font-bold transition truncate"
              title="Gluconato de Cálcio 10% (Hipercalemia/Cardioproteção)"
            >
              🧪 Cálcio 10% (1 ml/kg)
            </button>
          </div>

          {/* RECOVER Protocol Reversal Actions */}
          <div className="pt-2 border-t border-[#1f1f1f]">
            <div className="text-[10px] text-[#a3a3a3] font-bold uppercase mb-1 flex items-center justify-between">
              <span>Reversão Imediata de MPA (RECOVER)</span>
              <span className="text-[9px] text-cyan-400 font-mono-code">1-Clique</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[9px] font-mono-code">
              <button
                onClick={() => onAdministerQuickEmergencyDrug('atipamezole', 0.20, 'IV')}
                className="p-1 rounded bg-[#0c222b] hover:bg-[#12303d] border border-cyan-700/80 text-cyan-200 font-bold transition truncate"
                title="Atipamezol Reversão de Alfa-2 (Dexmedetomidina/Xilazina)"
              >
                🔄 Atipamezol
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('naloxone', 0.04, 'IV')}
                className="p-1 rounded bg-[#1c0c2b] hover:bg-[#29123d] border border-purple-700/80 text-purple-200 font-bold transition truncate"
                title="Naloxona Reversão de Opioides (Metadona/Fentanil/Morfina)"
              >
                🔄 Naloxona
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('flumazenil', 0.02, 'IV')}
                className="p-1 rounded bg-[#1a142b] hover:bg-[#261d3f] border border-violet-700/80 text-violet-200 font-bold transition truncate"
                title="Flumazenil Reversão de Benzodiazepínicos (Midazolam)"
              >
                🔄 Flumazenil
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('sugammadex', 4.0, 'IV')}
                className="p-1 rounded bg-[#0f2415] hover:bg-[#163620] border border-emerald-700/80 text-emerald-200 font-bold transition truncate"
                title="Sugamadex Reversão de NMBA (Atracúrio)"
              >
                🔄 Sugamadex
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('lipid_emulsion_20', 2.0, 'IV')}
                className="col-span-2 p-1 rounded bg-[#2b220c] hover:bg-[#3d3112] border border-yellow-700/80 text-yellow-200 font-bold transition truncate"
                title="Intralipid 20% Resgate Intoxicação Anestésico Local"
              >
                🛡️ Intralipid 20% (Lipid Sink)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
