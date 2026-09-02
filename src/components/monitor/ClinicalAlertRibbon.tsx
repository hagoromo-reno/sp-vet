import React, { useState } from 'react';
import { VitalSigns } from '../../types/simulator';
import {
  Skull,
  HeartPulse,
  Wind,
  AlertOctagon,
  AlertTriangle,
  Info,
  FileText,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
} from 'lucide-react';

interface ClinicalAlertRibbonProps {
  vitals: VitalSigns;
  onOpenDeathReport?: () => void;
  onSwitchToEmergencyTab?: () => void;
}

export const ClinicalAlertRibbon: React.FC<ClinicalAlertRibbonProps> = ({
  vitals,
  onOpenDeathReport,
  onSwitchToEmergencyTab,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasDead = vitals.isDead;
  const hasPCR = !vitals.isDead && vitals.isCardiacArrest;
  const hasApnea = !vitals.isDead && !vitals.isCardiacArrest && vitals.isRespiratoryArrest;
  const hasInteractions = !vitals.isDead && vitals.activeDrugInteractions && vitals.activeDrugInteractions.length > 0;
  const hasIschemia = !vitals.isDead && !vitals.isCardiacArrest && (vitals.hypoxiaExposureSeconds > 25 || vitals.myocardialIschemiaScore > 0.40);

  const totalAlertsCount = (hasDead ? 1 : 0) + (hasPCR ? 1 : 0) + (hasApnea ? 1 : 0) + (hasInteractions ? vitals.activeDrugInteractions.length : 0) + (hasIschemia ? 1 : 0);

  if (totalAlertsCount === 0) return null;

  return (
    <div className="w-full bg-[#0d0708] border border-red-900/60 rounded-xl overflow-hidden shadow-2xl transition-all duration-300">
      {/* Alert Ribbon Header Bar */}
      <div className="px-3.5 py-2 bg-gradient-to-r from-red-950/80 via-[#150a0d] to-red-950/80 border-b border-red-900/50 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          </div>
          <span className="text-xs font-bold font-mono-code text-red-200 tracking-wide uppercase flex items-center gap-1.5">
            <span>ALERTA CLÍNICO EM TEMPO REAL</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/90 border border-red-500/60 text-white font-sans font-extrabold">
              {totalAlertsCount} {totalAlertsCount === 1 ? 'OCORRÊNCIA' : 'OCORRÊNCIAS'}
            </span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {hasPCR && onSwitchToEmergencyTab && (
            <button
              onClick={onSwitchToEmergencyTab}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-mono-code font-bold flex items-center space-x-1 shadow-md shadow-red-950/80 transition animate-pulse"
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>IR PARA ABA CPCR RECOVER</span>
            </button>
          )}

          {hasDead && onOpenDeathReport && (
            <button
              onClick={onOpenDeathReport}
              className="px-2.5 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-[11px] font-mono-code font-bold flex items-center space-x-1 shadow-md shadow-red-950/80 transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>LAUDO NECROSCÓPICO</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-red-300 hover:text-white rounded hover:bg-red-900/40 transition"
            title={isExpanded ? 'Recolher Alertas' : 'Expandir Alertas'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Alert Details Container */}
      {isExpanded && (
        <div className="p-3 space-y-2 max-h-[220px] overflow-y-auto">
          {/* 1. FATAL DEATH CONFIRMATION */}
          {hasDead && (
            <div className="p-2.5 rounded-lg bg-red-950/90 border border-red-500 text-red-100 text-xs font-mono-code flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Skull className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <div className="font-extrabold text-xs text-red-100 uppercase tracking-wide">
                    ☠️ ÓBITO CLÍNICO CONFIRMADO · MORTE BIOLÓGICA
                  </div>
                  <div className="text-[11px] text-red-300 mt-0.5">
                    {vitals.deathCause || 'Assistolia refratária e anóxia tecidual generalizada'}
                  </div>
                </div>
              </div>
              {onOpenDeathReport && (
                <button
                  onClick={onOpenDeathReport}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] transition shrink-0 ml-2"
                >
                  Abrir Laudo
                </button>
              )}
            </div>
          )}

          {/* 2. CARDIAC ARREST (PCR) */}
          {hasPCR && (
            <div className="p-2.5 rounded-lg bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-mono-code flex items-start gap-2.5">
              <HeartPulse className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-red-100 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🚨 PARADA CARDIORRESPIRATÓRIA (PCR)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-800 text-white uppercase font-sans font-bold">
                      RECOVER CODE RED
                    </span>
                  </span>
                  <span className="text-[10px] text-red-300 font-mono-code uppercase">
                    Ritmo: {vitals.cardiacArrestType?.replace(/_/g, ' ') || vitals.cardiacRhythm.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-red-300 font-sans mt-0.5">
                  {vitals.cardiacArrestCause || 'Colapso Cardiocirculatório Agudo'}
                </p>
                <p className="text-[10px] text-red-400 font-mono-code mt-1">
                  ⚡ Conduta Imediata: Iniciar Compressões Torácicas (100-120/min), ventilação 100% O₂, aplicar Reversor de MPA e Epinefrina 0.01 mg/kg IV.
                </p>
              </div>
            </div>
          )}

          {/* 3. RESPIRATORY ARREST (APNEA) */}
          {hasApnea && (
            <div className="p-2.5 rounded-lg bg-orange-950/90 border border-orange-500/80 text-orange-200 text-xs font-mono-code flex items-start gap-2.5">
              <Wind className="w-5 h-5 text-orange-400 shrink-0 mt-0.5 animate-spin" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-orange-100 uppercase tracking-wide flex items-center gap-1.5">
                    <span>⚠️ PARADA RESPIRATÓRIA (APNEIA AGUDA · FR = 0 RPM)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-800 text-orange-100 uppercase font-sans font-bold">
                      RISCO DE ASFIXIA
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-orange-300 font-sans mt-0.5">
                  {vitals.respiratoryArrestCause || 'Cessação espontânea do drive respiratório bulbar'}
                </p>
                <p className="text-[10px] text-orange-400 font-mono-code mt-1">
                  💡 Conduta: Acionar ventilação controlada (CMV/PCV) ou manual com 100% O₂ imediatamente para evitar hipóxia e PCR por anóxia.
                </p>
              </div>
            </div>
          )}

          {/* 4. DRUG INTERACTIONS */}
          {hasInteractions &&
            vitals.activeDrugInteractions.map((interaction, idx) => {
              const isLethal = interaction.severity === 'lethal';
              const isDanger = interaction.severity === 'danger';

              const bgClass = isLethal
                ? 'bg-red-950/90 border-red-500 text-red-100 shadow-md animate-pulse'
                : isDanger
                ? 'bg-amber-950/90 border-amber-500 text-amber-100'
                : 'bg-blue-950/80 border-blue-500 text-blue-100';

              const badgeClass = isLethal
                ? 'bg-red-800 text-white'
                : isDanger
                ? 'bg-amber-800 text-amber-100'
                : 'bg-blue-800 text-blue-100';

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs font-mono-code flex items-start gap-2.5 ${bgClass}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isLethal ? (
                      <AlertOctagon className="w-4 h-4 text-red-400" />
                    ) : isDanger ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-xs tracking-wide">{interaction.title}</span>
                      <span className={`text-[9px] font-sans uppercase px-1.5 py-0.5 rounded font-bold ${badgeClass}`}>
                        {interaction.severity === 'lethal'
                          ? 'INTERAÇÃO LETAL'
                          : interaction.severity === 'danger'
                          ? 'ALERTA FARMACOLÓGICO'
                          : 'INTERAÇÃO'}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90 mt-0.5 font-sans">{interaction.description}</p>
                    <p className="text-[10px] opacity-80 mt-1 font-mono-code">
                      ⚡ Mecanismo: {interaction.pharmacologyMechanism}
                    </p>
                  </div>
                </div>
              );
            })}

          {/* 5. ISCHEMIA / HYPOXIA */}
          {hasIschemia && (
            <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-500 text-amber-200 text-xs font-mono-code flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-[11px]">
                <strong className="text-amber-100">SOFRIMENTO MIOCÁRDICO & ISQUEMIA ({Math.round(vitals.myocardialIschemiaScore * 100)}%):</strong>
                <span className="text-amber-300 ml-1 font-sans">
                  Hipóxia acumulada {Math.round(vitals.hypoxiaExposureSeconds)}s. Risco iminente de Taquicardia Ventricular e Fibrilação!
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
