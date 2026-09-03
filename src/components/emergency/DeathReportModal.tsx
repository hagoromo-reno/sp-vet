import React from 'react';
import { PatientProfile, VitalSigns } from '../../types/simulator';
import { Skull, AlertTriangle, RotateCcw, HeartPulse, FileText, CheckCircle2, X } from 'lucide-react';

interface DeathReportModalProps {
  patient: PatientProfile;
  vitals: VitalSigns;
  isOpen: boolean;
  onClose: () => void;
  onRestartScenario: () => void;
  onAttemptHeroicCPR: () => void;
}

export const DeathReportModal: React.FC<DeathReportModalProps> = ({
  patient,
  vitals,
  isOpen,
  onClose,
  onRestartScenario,
  onAttemptHeroicCPR,
}) => {
  if (!isOpen || !vitals.isDead) return null;

  const summary = vitals.deathDetailedSummary;
  const timeFormatted = vitals.deathTimeSeconds
    ? `${Math.floor(vitals.deathTimeSeconds / 60)
        .toString()
        .padStart(2, '0')}:${Math.floor(vitals.deathTimeSeconds % 60)
        .toString()
        .padStart(2, '0')}`
    : '00:00';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0e0a0b] border-2 border-red-600/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950 via-[#1c080a] to-[#0e0a0b] p-5 border-b border-red-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500 flex items-center justify-center text-red-400 shrink-0">
              <Skull className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black tracking-wide text-red-100 uppercase">
                  Óbito Clínico & Encefálico Confirmado
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-red-900/80 border border-red-500/60 text-red-200 font-mono-code">
                  T = {timeFormatted}
                </span>
              </div>
              <p className="text-xs text-red-300/80 mt-0.5 font-sans">
                Laudo Necroscópico & Fisiopatológico · Open VetSim v2.5
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1b1b1b] text-[#a3a3a3] hover:text-white hover:bg-[#282828] transition"
            title="Fechar Relatório"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#d4d4d4]">
          {/* Patient Card Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#140b0d] border border-red-900/40">
            <div>
              <span className="text-[#888888] block text-[11px]">Paciente:</span>
              <strong className="text-white text-sm">{patient.name}</strong>
            </div>
            <div>
              <span className="text-[#888888] block text-[11px]">Espécie / Porte:</span>
              <strong className="text-[#f5f5f5]">
                {patient.species.toUpperCase()} · {patient.weightKg} kg
              </strong>
            </div>
            <div>
              <span className="text-[#888888] block text-[11px]">Idade:</span>
              <strong className="text-[#f5f5f5]">
                {patient.ageYears > 0 ? `${patient.ageYears} anos` : `${patient.ageMonths} meses`}
              </strong>
            </div>
            <div>
              <span className="text-[#888888] block text-[11px]">Classificação ASA:</span>
              <strong className="text-amber-300">{patient.asa}</strong>
            </div>
          </div>

          {/* Primary Cause of Death Banner */}
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/70">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block mb-1">
              Causa Mortis Primária:
            </span>
            <p className="text-sm font-extrabold text-red-100 font-mono-code leading-relaxed">
              {summary?.primaryCause || vitals.deathCause || 'Parada Cardiorrespiratória Irreversível'}
            </p>
          </div>

          {/* Clinical Resuscitation Audit & Inevitability Assessment */}
          {summary?.wasResuscitationExemplary ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#0d2316] to-[#091b11] border-2 border-emerald-500/80 shadow-lg shadow-emerald-950/40">
              <div className="flex items-center space-x-2 text-emerald-300 font-extrabold text-xs uppercase mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Auditoria de Conduta: Ressuscitação Correta & Oportuna (RECOVER)</span>
              </div>
              <p className="text-xs text-emerald-100 font-sans leading-relaxed">
                {summary.inevitabilityStatement}
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-800/40 text-[11px] text-emerald-400/90 font-mono">
                ✓ Compressões adequadas (100-120/min) · ✓ Ventilação 100% O₂ (10 rpm) · ✓ Eletroterapia/Suporte inotrópico no tempo hábil
              </div>
            </div>
          ) : summary?.preventabilityOpportunities && summary.preventabilityOpportunities.length > 0 ? (
            <div className="p-4 rounded-xl bg-[#1f1308] border-2 border-amber-600/80 shadow-lg shadow-amber-950/40 space-y-2">
              <div className="flex items-center space-x-2 text-amber-300 font-extrabold text-xs uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Oportunidades de Intervenção & Conduta Preventiva (RECOVER)</span>
              </div>
              <p className="text-[11px] text-amber-200/90 font-sans">
                A análise cronológica indica que o desfecho poderia ter sido atenuado ou revertido com as seguintes condutas precoces:
              </p>
              <ul className="space-y-1.5 pl-1">
                {summary.preventabilityOpportunities.map((opp, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] text-amber-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Reversal Aggravation Alert (If Applicable) */}
          {summary?.reversalAggravationEvent && (
            <div className="p-3.5 rounded-xl bg-[#290d11] border border-red-700/80 text-xs">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block mb-1">
                ⚠️ Fator Farmacológico Descompensador:
              </span>
              <p className="text-[11px] text-red-200 leading-relaxed font-sans">
                {summary.reversalAggravationEvent}
              </p>
            </div>
          )}

          {/* Active Lethal Drug Interactions */}
          {vitals.activeDrugInteractions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Interações Medicamentosas Críticas Identificadas
              </h4>
              <div className="space-y-2">
                {vitals.activeDrugInteractions.map((inter, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[#1f1207] border border-amber-700/60 space-y-1">
                    <div className="flex items-center justify-between font-bold text-amber-200">
                      <span>{inter.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900 text-amber-100 uppercase">
                        {inter.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-300/90">{inter.description}</p>
                    <p className="text-[10px] text-amber-400/70 font-mono-code">{inter.pharmacologyMechanism}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contributing Pathophysiological Factors */}
          {summary?.contributingFactors && summary.contributingFactors.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-red-400" />
                Fatores Fisiopatológicos Contribuintes
              </h4>
              <ul className="space-y-1.5 bg-[#121212] p-3 rounded-lg border border-[#222222]">
                {summary.contributingFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] text-[#cccccc]">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5"></span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Terminal Organ Findings */}
          {summary?.autopsyFindings && summary.autopsyFindings.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-wider mb-2">
                Achados Celulares & Gasometria Terminal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-[#121212] p-3 rounded-lg border border-[#222222]">
                {summary.autopsyFindings.map((finding, idx) => (
                  <div key={idx} className="p-2 rounded bg-[#171717] text-[11px] text-[#b3b3b3] border border-[#262626]">
                    {finding}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#120809] border-t border-red-900/40 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-[#1f1f1f] hover:bg-[#2b2b2b] text-[#e5e5e5] text-xs font-bold transition"
          >
            Revisar Dados & Ficha Anestésica
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onAttemptHeroicCPR}
              className="px-4 py-2.5 rounded-lg bg-red-800 hover:bg-red-700 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-red-950/80 animate-pulse"
            >
              <HeartPulse className="w-4 h-4" />
              <span>Tentar Ressuscitação Heroica (RCP)</span>
            </button>

            <button
              onClick={onRestartScenario}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition flex items-center space-x-1.5 shadow-lg shadow-emerald-950/80"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reiniciar Caso Clínico</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
