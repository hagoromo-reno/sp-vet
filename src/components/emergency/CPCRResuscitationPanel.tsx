import React, { useState, useEffect } from 'react';
import { ActiveDrugDose, PatientProfile, ResuscitationState, VitalSigns } from '../../types/simulator';
import { AudioSynthesizer } from '../../engine/audioSynthesizer';
import { VETERINARY_DRUG_DATABASE } from '../../data/drugDatabase';
import { getSpeciesDoseRange, isTimeBasedDoseUnit } from '../../engine/drugAdministration';
import { HeartPulse, Zap, ShieldAlert, Play, Square, Syringe, Clock } from 'lucide-react';

interface CPCRResuscitationPanelProps {
  patient: PatientProfile;
  activeDoses: ActiveDrugDose[];
  vitals: VitalSigns;
  resuscitation: ResuscitationState;
  onUpdateResuscitation: (updates: Partial<ResuscitationState>) => void;
  onAdministerQuickEmergencyDrug: (drugId: string) => void;
}

export const CPCRResuscitationPanel: React.FC<CPCRResuscitationPanelProps> = ({
  patient,
  activeDoses,
  vitals,
  resuscitation,
  onUpdateResuscitation,
  onAdministerQuickEmergencyDrug,
}) => {
  const [cprCycleSeconds, setCprCycleSeconds] = useState(0);
  const [isChargingDefib, setIsChargingDefib] = useState(false);

  // Recommended Shock Energy (RECOVER 2024: 2 - 4 J/kg)
  const recommendedJoules = Math.round(patient.weightKg * 3);

  const quickDose = (drugId: string): { value: number; unit: string } | undefined => {
    const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === drugId);
    if (!drug || isTimeBasedDoseUnit(drug.doseUnit)) return undefined;
    const range = getSpeciesDoseRange(drug, patient.species);
    return range ? { value: range.typical, unit: drug.doseUnit } : undefined;
  };
  const hasActive = (predicate: (dose: ActiveDrugDose) => boolean): boolean => activeDoses.some(
    (dose) => dose.currentCe > 0.01 && predicate(dose)
  );
  const hasAlpha2 = hasActive((dose) => ['dexmedetomidine', 'xylazine', 'detomidine'].includes(dose.drugId));
  const hasOpioid = hasActive((dose) => ['morphine', 'methadone', 'fentanyl', 'butorphanol', 'buprenorphine'].includes(dose.drugId));
  const hasBenzodiazepine = hasActive((dose) => ['midazolam', 'diazepam'].includes(dose.drugId));
  const hasAminosteroidalNmba = hasActive((dose) => ['rocuronium', 'vecuronium'].includes(dose.drugId));
  const hasLocalAnestheticBurden = hasActive((dose) => ['lidocaine_2pct', 'bupivacaine_05'].includes(dose.drugId));
  const buttonDisabledClass = 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit';

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
              onClick={() => onAdministerQuickEmergencyDrug('epinephrine')}
              disabled={!quickDose('epinephrine')}
              className={`p-1.5 rounded bg-[#2b0c0f] hover:bg-[#3d1217] border border-red-800/70 text-red-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Dose típica específica da espécie cadastrada"
            >
              ⚡ Adrenalina {quickDose('epinephrine') ? `(${quickDose('epinephrine')?.value} ${quickDose('epinephrine')?.unit})` : '(sem faixa)'}
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('atropine')}
              disabled={!quickDose('atropine')}
              className={`p-1.5 rounded bg-[#2b1708] hover:bg-[#3d210b] border border-amber-800/70 text-amber-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Dose típica específica da espécie cadastrada"
            >
              💉 Atropina {quickDose('atropine') ? `(${quickDose('atropine')?.value} ${quickDose('atropine')?.unit})` : '(sem faixa)'}
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('lidocaine_2pct')}
              disabled={!quickDose('lidocaine_2pct')}
              className={`p-1.5 rounded bg-[#0b1f24] hover:bg-[#112d35] border border-cyan-800/70 text-cyan-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Dose antiarrítmica típica específica da espécie cadastrada"
            >
              🛡️ Lidocaína {quickDose('lidocaine_2pct') ? `(${quickDose('lidocaine_2pct')?.value} ${quickDose('lidocaine_2pct')?.unit})` : '(sem faixa)'}
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('calcium_gluconate')}
              disabled={!quickDose('calcium_gluconate')}
              className={`p-1.5 rounded bg-[#0f2415] hover:bg-[#15331e] border border-emerald-800/70 text-emerald-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Gluconato de Cálcio 10% (Hipercalemia/Cardioproteção)"
            >
              🧪 Cálcio {quickDose('calcium_gluconate') ? `(${quickDose('calcium_gluconate')?.value} ${quickDose('calcium_gluconate')?.unit})` : '(sem faixa)'}
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
                onClick={() => onAdministerQuickEmergencyDrug('atipamezole')}
                disabled={!quickDose('atipamezole') || !hasAlpha2}
                className={`p-1 rounded bg-[#0c222b] hover:bg-[#12303d] border border-cyan-700/80 text-cyan-200 font-bold transition truncate ${buttonDisabledClass}`}
                title={hasAlpha2 ? 'Reversão de agonista alfa-2 ativo' : 'Nenhum agonista alfa-2 ativo'}
              >
                🔄 Atipamezol
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('naloxone')}
                disabled={!quickDose('naloxone') || !hasOpioid}
                className={`p-1 rounded bg-[#1c0c2b] hover:bg-[#29123d] border border-purple-700/80 text-purple-200 font-bold transition truncate ${buttonDisabledClass}`}
                title={hasOpioid ? 'Reversão de opioide ativo' : 'Nenhum opioide ativo'}
              >
                🔄 Naloxona
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('flumazenil')}
                disabled={!quickDose('flumazenil') || !hasBenzodiazepine}
                className={`p-1 rounded bg-[#1a142b] hover:bg-[#261d3f] border border-violet-700/80 text-violet-200 font-bold transition truncate ${buttonDisabledClass}`}
                title={hasBenzodiazepine ? 'Reversão de benzodiazepínico ativo' : 'Nenhum benzodiazepínico ativo'}
              >
                🔄 Flumazenil
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('sugammadex')}
                disabled={!quickDose('sugammadex') || !hasAminosteroidalNmba}
                className={`p-1 rounded bg-[#0f2415] hover:bg-[#163620] border border-emerald-700/80 text-emerald-200 font-bold transition truncate ${buttonDisabledClass}`}
                title="Requer rocurônio/vecurônio ativo; não reverte atracúrio"
              >
                🔄 Sugamadex
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('lipid_emulsion_20')}
                disabled={!quickDose('lipid_emulsion_20') || !hasLocalAnestheticBurden}
                className={`col-span-2 p-1 rounded bg-[#2b220c] hover:bg-[#3d3112] border border-yellow-700/80 text-yellow-200 font-bold transition truncate ${buttonDisabledClass}`}
                title={hasLocalAnestheticBurden ? 'Resgate para carga sistêmica de anestésico local' : 'Nenhum anestésico local ativo'}
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
