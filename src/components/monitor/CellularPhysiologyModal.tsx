import React, { useState } from 'react';
import { PatientProfile, VitalSigns } from '../../types/simulator';
import {
  Activity,
  Dna,
  Zap,
  Heart,
  Wind,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  X,
  Sparkles,
  Gauge,
  Flame,
} from 'lucide-react';

interface CellularPhysiologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientProfile;
  vitals: VitalSigns;
}

export const CellularPhysiologyModal: React.FC<CellularPhysiologyModalProps> = ({
  isOpen,
  onClose,
  patient,
  vitals,
}) => {
  if (!isOpen) return null;

  const cellular = vitals.cellularState;
  const particularities = cellular?.speciesParticularities || [];
  const interactions = vitals.activeDrugInteractions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-[#0d0d0f] border border-[#2a2a32] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f26] bg-[#121217]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Dna className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold text-[#f5f5f5] tracking-tight">
                  Biofísica Celular & Dinâmica de Sistemas
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                  {patient.species.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#8e8e9f]">
                Emulação em tempo real de receptores, segundos mensageiros, alças hemodinâmicas e particularidades de espécie
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#181820] hover:bg-[#22222d] text-[#8e8e9f] hover:text-[#f5f5f5] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#d0d0dc]">
          {/* Top Grid: Cellular Telemetry & Second Messengers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* cAMP Myocardial */}
            <div className="p-3.5 rounded-xl bg-[#13131a] border border-[#232330] flex flex-col justify-between space-y-2">
              <span className="text-[11px] text-[#8e8e9f] font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>AMPc Miocárdio</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-mono font-bold text-white">
                  {cellular?.cAMPMyocardial?.toFixed(2) ?? '1.00'}
                </span>
                <span className="text-[10px] text-[#717182]">rel.</span>
              </div>
              <div className="w-full bg-[#20202d] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${Math.min(100, ((cellular?.cAMPMyocardial ?? 1.0) / 2.5) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-[#717182]">Equilíbrio Gs (β1) vs Gi (M2/α2)</span>
            </div>

            {/* Intracellular Calcium */}
            <div className="p-3.5 rounded-xl bg-[#13131a] border border-[#232330] flex flex-col justify-between space-y-2">
              <span className="text-[11px] text-[#8e8e9f] font-semibold flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>[Ca²⁺]i Inotropia</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-mono font-bold text-white">
                  {cellular?.intracellularCalcium?.toFixed(2) ?? '1.00'}
                </span>
                <span className="text-[10px] text-[#717182]">Emax</span>
              </div>
              <div className="w-full bg-[#20202d] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-rose-400 h-full transition-all"
                  style={{ width: `${Math.min(100, ((cellular?.intracellularCalcium ?? 1.0) / 2.5) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-[#717182]">Fosforilação de canais CaV-L</span>
            </div>

            {/* GABA-A Chloride Conductance */}
            <div className="p-3.5 rounded-xl bg-[#13131a] border border-[#232330] flex flex-col justify-between space-y-2">
              <span className="text-[11px] text-[#8e8e9f] font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>gCl⁻ (GABA-A)</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-mono font-bold text-cyan-300">
                  {cellular?.chlorideConductanceGabaA?.toFixed(2) ?? '0.08'}
                </span>
                <span className="text-[10px] text-[#717182]">mS</span>
              </div>
              <div className="w-full bg-[#20202d] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cyan-400 h-full transition-all"
                  style={{ width: `${Math.min(100, ((cellular?.chlorideConductanceGabaA ?? 0.1) / 3.0) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-[#717182]">Cooperação Alostérica</span>
            </div>

            {/* Nociceptive Inhibition */}
            <div className="p-3.5 rounded-xl bg-[#13131a] border border-[#232330] flex flex-col justify-between space-y-2">
              <span className="text-[11px] text-[#8e8e9f] font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Analgesia Central</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-mono font-bold text-emerald-300">
                  {Math.round((cellular?.nociceptiveInhibition ?? 0) * 100)}%
                </span>
              </div>
              <div className="w-full bg-[#20202d] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all"
                  style={{ width: `${(cellular?.nociceptiveInhibition ?? 0) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-[#717182]">Bloqueio corno dorsal/PAG</span>
            </div>

            {/* Cardiac Output */}
            <div className="p-3.5 rounded-xl bg-[#13131a] border border-[#232330] flex flex-col justify-between space-y-2">
              <span className="text-[11px] text-[#8e8e9f] font-semibold flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-purple-400" />
                <span>Débito Cardíaco</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-mono font-bold text-purple-300">
                  {cellular?.cardiacOutputLMin?.toFixed(2) ?? '0.00'}
                </span>
                <span className="text-[10px] text-[#717182]">L/min</span>
              </div>
              <span className="text-[10px] text-[#8e8e9f] font-mono">
                VS: {cellular?.strokeVolumeMl?.toFixed(1) ?? '0'} mL
              </span>
              <span className="text-[9px] text-[#717182]">FC × Volume Sistólico</span>
            </div>

            {/* SVR Systemic Vascular Resistance */}
            <div className="p-3.5 rounded-xl bg-[#13131a] border border-[#232330] flex flex-col justify-between space-y-2">
              <span className="text-[11px] text-[#8e8e9f] font-semibold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>RVS (Pós-Carga)</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-mono font-bold text-blue-300">
                  {cellular?.systemicVascularResistanceDyne ?? '0'}
                </span>
                <span className="text-[10px] text-[#717182]">dyn</span>
              </div>
              <span className="text-[10px] text-[#8e8e9f] font-mono">
                Barorreflexo: {cellular?.baroreceptorGain?.toFixed(2) ?? '1.0'}x
              </span>
              <span className="text-[9px] text-[#717182]">Tônus arteriolar sistêmico</span>
            </div>
          </div>

          {/* Section: Species Specific Particularities Panel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Particularidades Biológicas da Espécie ({patient.species.toUpperCase()})</span>
              </h3>
              <span className="text-[11px] text-[#8e8e9f]">
                Shunt V/Q Atual: <strong className="text-white font-mono">{cellular?.pulmonaryShuntFractionPct ?? 5}%</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {particularities.map((item, idx) => {
                const isLethal = item.severity === 'lethal';
                const isDanger = item.severity === 'danger';
                const isWarning = item.severity === 'warning';

                const borderClass = isLethal
                  ? 'border-red-500/80 bg-red-950/40'
                  : isDanger
                  ? 'border-rose-500/60 bg-rose-950/30'
                  : isWarning
                  ? 'border-amber-500/50 bg-amber-950/20'
                  : 'border-[#282836] bg-[#121218]';

                const badgeBg = isLethal
                  ? 'bg-red-900/80 text-red-200'
                  : isDanger
                  ? 'bg-rose-900/80 text-rose-200'
                  : isWarning
                  ? 'bg-amber-900/80 text-amber-200'
                  : 'bg-blue-900/60 text-blue-200';

                return (
                  <div key={idx} className={`p-4 rounded-xl border ${borderClass} space-y-2 transition-all`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        {isLethal || isDanger ? (
                          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                        <span>{item.name}</span>
                      </span>
                      <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold ${badgeBg}`}>
                        {item.severity}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#b0b0c2] leading-relaxed">
                      {item.clinicalImpact}
                    </p>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-[#7b7b90] font-mono">
                      <span>⚡ Mecanismo: {item.mechanism}</span>
                      <span>Intensidade: {Math.round(item.intensity * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Dynamic Emergent Interactions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span>Interações & Sinergismos Emergentes (Cálculo em Tempo Real)</span>
              </h3>
              <span className="text-[11px] text-[#8e8e9f]">
                {interactions.length} {interactions.length === 1 ? 'interação ativa' : 'interações ativas'}
              </span>
            </div>

            {interactions.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#121217] border border-[#22222d] text-center text-[#717182]">
                Nenhuma interação medicamentosa crítica ou sinergismo ativo no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {interactions.map((interaction, idx) => {
                  const isLethal = interaction.severity === 'lethal';
                  const isDanger = interaction.severity === 'danger';

                  const cardClass = isLethal
                    ? 'border-red-500 bg-red-950/40 text-red-100 shadow-lg shadow-red-950/50 animate-pulse'
                    : isDanger
                    ? 'border-amber-500/60 bg-amber-950/30 text-amber-100'
                    : 'border-indigo-500/40 bg-indigo-950/20 text-indigo-100';

                  return (
                    <div key={idx} className={`p-4 rounded-xl border ${cardClass} space-y-2`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-white flex items-center gap-1.5">
                          {isLethal ? (
                            <AlertOctagon className="w-4 h-4 text-red-400" />
                          ) : isDanger ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Info className="w-4 h-4 text-indigo-400" />
                          )}
                          <span>{interaction.title}</span>
                        </span>
                        <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold bg-black/40 border border-white/10">
                          {interaction.severity}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{interaction.description}</p>
                      <p className="text-[10px] opacity-75 font-mono pt-1.5 border-t border-white/5">
                        ⚡ {interaction.pharmacologyMechanism}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#1f1f26] bg-[#121217] text-xs text-[#717182]">
          <span>Motor Fisiológico Vet v2.0 · Alça Fechada de Biofísica Celular</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
