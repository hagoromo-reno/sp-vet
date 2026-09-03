import React, { useState, useEffect } from 'react';
import { ActiveDrugDose, PatientProfile, ResuscitationState, VitalSigns } from '../../types/simulator';
import { AudioSynthesizer } from '../../engine/audioSynthesizer';
import { VETERINARY_DRUG_DATABASE } from '../../data/drugDatabase';
import { isTimeBasedDoseUnit, getSpeciesDoseRange } from '../../engine/drugAdministration';
import { formatDecimal } from '../../utils/formatters';
import { HeartPulse, Zap, ShieldAlert, Play, Square, Syringe, Clock, Wind } from 'lucide-react';

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

  const quickDose = (drugId: string): { value: string; unit: string } | undefined => {
    const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === drugId);
    if (!drug || isTimeBasedDoseUnit(drug.doseUnit)) return undefined;
    const range = getSpeciesDoseRange(drug, patient.species);
    return range ? { value: formatDecimal(range.typical, 2), unit: drug.doseUnit } : undefined;
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
    const joules = resuscitation.defibrillatorChargedJoules || recommendedJoules;
    onUpdateResuscitation({
      defibrillatorChargedJoules: 0,
      isDefibrillatorArmed: false,
      lastShockDeliveredJoules: joules,
      lastShockSimTime: Date.now(),
      shocksDeliveredCount: (resuscitation.shocksDeliveredCount || 0) + 1,
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* 1. CHEST COMPRESSIONS STATION */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Compressões Torácicas</span>
            <span className="text-[10px] text-[#737373] font-mono-code">100-120 /min</span>
          </div>

          <p className="text-[11px] text-[#888888]">
            Comprima 1/3 a 1/2 da largura torácica com retorno total do tórax entre compressões ininterruptas por ciclos de 2 minutos.
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
            <span>{resuscitation.isCPRActive ? 'PARAR MASSAGEM' : 'INICIAR COMPRESSÕES'}</span>
          </button>
        </div>

        {/* 2. AIRWAY & VENTILATION STATION (RECOVER BLS) */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Via Aérea & Ventilação (BLS)</span>
            <span className="text-[10px] text-cyan-400 font-mono-code font-bold">10 rpm · 100% O₂</span>
          </div>

          <p className="text-[11px] text-[#888888]">
            Forneça 1 incursão a cada 6 segundos (tempo inspiratório de 1s). Evite hiperventilação que prejudica o retorno venoso.
          </p>

          <button
            onClick={() => onUpdateResuscitation({ isCPRVentilationActive: !resuscitation.isCPRVentilationActive })}
            className={`w-full py-2.5 px-3 rounded-lg text-xs font-extrabold font-mono-code transition flex items-center justify-center space-x-2 shadow-lg ${
              resuscitation.isCPRVentilationActive
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white animate-pulse shadow-cyan-950/60'
                : 'bg-[#181818] hover:bg-[#222222] text-[#e5e5e5] border border-[#2c2c2c]'
            }`}
          >
            <Wind className="w-4 h-4" />
            <span>{resuscitation.isCPRVentilationActive ? 'VENTILAÇÃO BLS ATIVA (10 RPM)' : 'INICIAR VENTILAÇÃO BLS (10 RPM)'}</span>
          </button>
        </div>

        {/* 3. ELECTRICAL DEFIBRILLATOR (VFIB / VTACH) */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Desfibrilador Bifásico</span>
            <span className="text-[10px] font-mono-code text-amber-400 font-bold">
              {recommendedJoules} J (3 J/kg)
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
              <span>2. DISPARAR</span>
            </button>
          </div>
        </div>

        {/* 4. QUICK-ACCESS EMERGENCY DRUGS & REVERSALS */}
        <div className="p-3 bg-[#121212] border border-[#222222] rounded-lg flex flex-col justify-between space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#d4d4d4] font-semibold">
            <span>Fármacos & Inotrópicos (1-Clique)</span>
            <Syringe className="w-3.5 h-3.5 text-red-400" />
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono-code">
            <button
              onClick={() => onAdministerQuickEmergencyDrug('epinephrine')}
              disabled={!quickDose('epinephrine')}
              className={`p-1.5 rounded bg-[#2b0c0f] hover:bg-[#3d1217] border border-red-800/70 text-red-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Adrenalina 0.01 mg/kg IV na PCR (RECOVER)"
            >
              ⚡ Adrenalina {quickDose('epinephrine') ? `(${quickDose('epinephrine')?.value} ${quickDose('epinephrine')?.unit})` : ''}
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('ephedrine')}
              disabled={!quickDose('ephedrine')}
              className={`p-1.5 rounded bg-[#241a08] hover:bg-[#38280d] border border-amber-600/70 text-amber-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Efedrina 0.1 mg/kg IV lento (Inotrópico/Vasopressor misto)"
            >
              ⚡ Efedrina {quickDose('ephedrine') ? `(${quickDose('ephedrine')?.value} ${quickDose('ephedrine')?.unit})` : ''}
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('atropine')}
              disabled={!quickDose('atropine')}
              className={`p-1.5 rounded bg-[#2b1708] hover:bg-[#3d210b] border border-amber-800/70 text-amber-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Atropina na bradicardia severa / PCR com tônus vagal alto"
            >
              💉 Atropina {quickDose('atropine') ? `(${quickDose('atropine')?.value} ${quickDose('atropine')?.unit})` : ''}
            </button>

            <button
              onClick={() => onAdministerQuickEmergencyDrug('lidocaine_2pct')}
              disabled={!quickDose('lidocaine_2pct')}
              className={`p-1.5 rounded bg-[#0b1f24] hover:bg-[#112d35] border border-cyan-800/70 text-cyan-300 font-bold transition truncate ${buttonDisabledClass}`}
              title="Lidocaína antiarrítmica para TV/VPCs"
            >
              🛡️ Lidocaína {quickDose('lidocaine_2pct') ? `(${quickDose('lidocaine_2pct')?.value} ${quickDose('lidocaine_2pct')?.unit})` : ''}
            </button>
          </div>

          {/* RECOVER Protocol Reversal Actions */}
          <div className="pt-2 border-t border-[#1f1f1f]">
            <div className="text-[10px] text-[#a3a3a3] font-bold uppercase mb-1 flex items-center justify-between">
              <span>Reversão de Fármacos (RECOVER)</span>
              <span className="text-[9px] text-cyan-400 font-mono-code">1-Clique</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[9px] font-mono-code">
              <button
                onClick={() => onAdministerQuickEmergencyDrug('atipamezole')}
                disabled={!quickDose('atipamezole')}
                className={`p-1 rounded ${hasAlpha2 ? 'bg-[#0c2e3d] border-cyan-500 text-cyan-200' : 'bg-[#0c222b] border-cyan-700/60 text-cyan-300/80'} hover:bg-[#12303d] border font-bold transition truncate ${buttonDisabledClass}`}
                title={hasAlpha2 ? 'Agonista alfa-2 ativo detectado' : 'Reversão empírica alfa-2 (RECOVER)'}
              >
                🔄 Atipamezol {hasAlpha2 ? '●' : ''}
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('naloxone')}
                disabled={!quickDose('naloxone')}
                className={`p-1 rounded ${hasOpioid ? 'bg-[#2e0f45] border-purple-500 text-purple-200' : 'bg-[#1c0c2b] border-purple-700/60 text-purple-300/80'} hover:bg-[#29123d] border font-bold transition truncate ${buttonDisabledClass}`}
                title={hasOpioid ? 'Opioide ativo detectado' : 'Reversão empírica de opioides (RECOVER)'}
              >
                🔄 Naloxona {hasOpioid ? '●' : ''}
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('flumazenil')}
                disabled={!quickDose('flumazenil')}
                className={`p-1 rounded ${hasBenzodiazepine ? 'bg-[#291e4a] border-violet-500 text-violet-200' : 'bg-[#1a142b] border-violet-700/60 text-violet-300/80'} hover:bg-[#261d3f] border font-bold transition truncate ${buttonDisabledClass}`}
                title={hasBenzodiazepine ? 'Benzodiazepínico ativo detectado' : 'Reversão empírica de benzo (RECOVER)'}
              >
                🔄 Flumazenil {hasBenzodiazepine ? '●' : ''}
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('sugammadex')}
                disabled={!quickDose('sugammadex')}
                className={`p-1 rounded ${hasAminosteroidalNmba ? 'bg-[#123b20] border-emerald-500 text-emerald-200' : 'bg-[#0f2415] border-emerald-700/60 text-emerald-300/80'} hover:bg-[#163620] border font-bold transition truncate ${buttonDisabledClass}`}
                title={hasAminosteroidalNmba ? 'Bloqueador NMBA ativo detectado' : 'Reversão de rocurônio/vecurônio'}
              >
                🔄 Sugamadex {hasAminosteroidalNmba ? '●' : ''}
              </button>
              <button
                onClick={() => onAdministerQuickEmergencyDrug('lipid_emulsion_20')}
                disabled={!quickDose('lipid_emulsion_20')}
                className={`col-span-2 p-1 rounded ${hasLocalAnestheticBurden ? 'bg-[#423412] border-yellow-500 text-yellow-200' : 'bg-[#2b220c] border-yellow-700/60 text-yellow-300/80'} hover:bg-[#3d3112] border font-bold transition truncate ${buttonDisabledClass}`}
                title={hasLocalAnestheticBurden ? 'Carga de anestésico local ativa detectada' : 'Resgate para toxicidade de anestésico local (LAST)'}
              >
                🛡️ Intralipid 20% {hasLocalAnestheticBurden ? '●' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
