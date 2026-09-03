import React from 'react';
import { VitalSigns, PatientProfile } from '../../types/simulator';
import {
  Activity,
  Eye,
  Brain,
  Sparkles,
  Shield,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  X,
  Smile,
  Moon,
  Zap,
} from 'lucide-react';

interface AnestheticDepthBoardProps {
  isOpen: boolean;
  onClose: () => void;
  vitals: VitalSigns;
  patient: PatientProfile;
}

export const AnestheticDepthBoard: React.FC<AnestheticDepthBoardProps> = ({
  isOpen,
  onClose,
  vitals,
  patient,
}) => {
  if (!isOpen) return null;

  const consciousness = vitals.consciousnessScore ?? 100;
  const depthScore = vitals.anestheticDepthScore;
  const stage = vitals.guedelStage;
  const tolerance = vitals.surgicalTolerancePct;
  const nociceptionInhibition = Math.round((vitals.cellularState?.nociceptiveInhibition ?? 0) * 100);

  // Eye position label
  const eyeLabels: Record<string, { label: string; desc: string }> = {
    central_light: { label: 'Central (Reflexo Vivo)', desc: 'Globo ocular no centro, paciente alerta ou em sedação leve' },
    ventromedial_surgical: { label: 'Rotacionado Ventromedial', desc: 'Sinal patognomônico de plano cirúrgico adequado (Plano 1 e 2)' },
    central_deep_dilated: { label: 'Central Dilatado (Midríase)', desc: 'Plano profundo (Plano 3) ou depressão bulbar (Estágio IV)' },
  };

  // Jaw tone label
  const jawLabels: Record<string, { label: string; color: string }> = {
    rigid: { label: 'Rígido / Resistente', color: 'text-rose-400 bg-rose-950/40 border-rose-500/40' },
    moderate: { label: 'Moderado (Sedação/Abatimento)', color: 'text-amber-400 bg-amber-950/40 border-amber-500/40' },
    relaxed_surgical: { label: 'Relaxado (Ideal p/ Intubação e Cirurgia)', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40' },
    flaccid: { label: 'Flácido / Sem Tônus', color: 'text-purple-400 bg-purple-950/40 border-purple-500/40' },
  };

  const currentEye = eyeLabels[vitals.eyePosition] || { label: vitals.eyePosition, desc: '' };
  const currentJaw = jawLabels[vitals.jawTone] || { label: vitals.jawTone, color: 'text-white' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0c0c10] border border-[#232330] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c26] bg-[#121218]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold text-[#f5f5f5] tracking-tight">
                  Quadro de Profundidade Anestésica & Consciência
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  {patient.species.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#8e8e9f]">
                Avaliação dinâmica do plano de Guedel, estado de consciência, reflexos e tolerância cirúrgica
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#181822] hover:bg-[#232332] text-[#8e8e9f] hover:text-[#f5f5f5] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#d0d0dc]">
          {/* Main Stage Ribbon */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-[#14141e] to-indigo-950/40 border border-purple-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider font-mono">
                Estágio Atual de Guedel
              </span>
              <h3 className="text-xl font-extrabold text-white">
                {stage}
              </h3>
              <p className="text-xs text-[#a5a5bb]">
                Condutância GABA-A gCl⁻: <strong className="text-cyan-300 font-mono">{vitals.cellularState?.chlorideConductanceGabaA ?? 0.08} mS</strong> · Escore de Profundidade: <strong className="text-purple-300 font-mono">{depthScore}/100</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-[#8e8e9f] block">Tolerância à Incisão:</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {tolerance}%
                </span>
              </div>
            </div>
          </div>

          {/* Triad of Balanced Anesthesia */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Consciousness / Hypnosis */}
            <div className="p-4 rounded-xl bg-[#12121a] border border-[#222230] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span>Consciência / Alerta</span>
                </span>
                <span className="font-mono font-extrabold text-sm text-purple-300">
                  {consciousness}%
                </span>
              </div>
              <div className="w-full bg-[#1c1c28] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-full transition-all duration-300"
                  style={{ width: `${consciousness}%` }}
                />
              </div>
              <p className="text-[11px] text-[#8e8e9f]">
                {consciousness > 80
                  ? 'Alerta total; responsivo ao ambiente.'
                  : consciousness > 50
                  ? 'Sedação Leve / Abatimento (ex: Midazolam em dose clínica).'
                  : consciousness > 20
                  ? 'Excitação / Delírio cortical transitório.'
                  : consciousness > 0
                  ? 'Indução anestésica em andamento.'
                  : 'Inconsciência cirúrgica completa (hipnose).'}
              </p>
            </div>

            {/* 2. Analgesia / Nociception */}
            <div className="p-4 rounded-xl bg-[#12121a] border border-[#222230] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Bloqueio Nociceptivo</span>
                </span>
                <span className="font-mono font-extrabold text-sm text-emerald-300">
                  {nociceptionInhibition}%
                </span>
              </div>
              <div className="w-full bg-[#1c1c28] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${nociceptionInhibition}%` }}
                />
              </div>
              <p className="text-[11px] text-[#8e8e9f]">
                {nociceptionInhibition > 80
                  ? 'Analgesia cirúrgica excelente (Opioide + Adjuvantes).'
                  : nociceptionInhibition > 40
                  ? 'Analgesia moderada; pode responder a estímulos fortes.'
                  : 'Analgesia ausente ou mínima; risco de dor e taquicardia.'}
              </p>
            </div>

            {/* 3. Muscle Relaxation / Jaw Tone */}
            <div className="p-4 rounded-xl bg-[#12121a] border border-[#222230] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Relaxamento Mandibular</span>
                </span>
              </div>
              <div className={`p-1.5 rounded-lg border text-[11px] font-bold text-center ${currentJaw.color}`}>
                {currentJaw.label}
              </div>
              <p className="text-[11px] text-[#8e8e9f]">
                {vitals.jawTone === 'relaxed_surgical'
                  ? 'Mandíbula perfeitamente livre para laringoscopia e intubação.'
                  : vitals.jawTone === 'moderate'
                  ? 'Resistência leve a moderada; reflexo mastigatório presente.'
                  : vitals.jawTone === 'rigid'
                  ? 'Mandíbula rígida e resistente; intubação perigosa sem indutor.'
                  : 'Paralisia flácida profunda ou bloqueio neuromuscular.'}
              </p>
            </div>
          </div>

          {/* Clinical Reflexes Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-[#8e8e9f] tracking-wider font-mono">
              Reflexos & Sinais Clínicos de Guedel
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Eye Position */}
              <div className="p-3.5 rounded-xl bg-[#14141e] border border-[#242432] space-y-1.5">
                <span className="text-[11px] text-[#8e8e9f] flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Posição Ocular</span>
                </span>
                <div className="font-bold text-white text-xs">
                  {currentEye.label}
                </div>
                <p className="text-[10px] text-[#78788c]">{currentEye.desc}</p>
              </div>

              {/* Palpebral Reflex */}
              <div className="p-3.5 rounded-xl bg-[#14141e] border border-[#242432] space-y-1.5">
                <span className="text-[11px] text-[#8e8e9f] flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-blue-400" />
                  <span>Reflexo Palpebral</span>
                </span>
                <div className="font-bold text-white text-xs uppercase font-mono">
                  {vitals.palpebralReflex === 'brisk' ? 'Vigoroso / Presente' : vitals.palpebralReflex === 'sluggish' ? 'Lento (Indução)' : 'Ausente (Cirúrgico)'}
                </div>
                <p className="text-[10px] text-[#78788c]">
                  {vitals.palpebralReflex === 'absent' ? 'Ideal para manutenção cirúrgica' : 'Presente em sedação ou plano superficial'}
                </p>
              </div>

              {/* Corneal Reflex */}
              <div className="p-3.5 rounded-xl bg-[#14141e] border border-[#242432] space-y-1.5">
                <span className="text-[11px] text-[#8e8e9f] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reflexo Corneal</span>
                </span>
                <div className="font-bold text-white text-xs uppercase font-mono">
                  {vitals.cornealReflex === 'brisk' ? 'Presente (Seguro)' : vitals.cornealReflex === 'moderate' ? 'Moderado' : 'Ausente (Perigo Bulbar)'}
                </div>
                <p className="text-[10px] text-[#78788c]">
                  {vitals.cornealReflex === 'absent' ? 'Atenção: Ausência indica plano excessivo/risco fatal!' : 'Reflexo de segurança preservado'}
                </p>
              </div>

              {/* Pedal / Withdrawal Reflex */}
              <div className="p-3.5 rounded-xl bg-[#14141e] border border-[#242432] space-y-1.5">
                <span className="text-[11px] text-[#8e8e9f] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Reflexo Podal (Retirada)</span>
                </span>
                <div className="font-bold text-white text-xs uppercase font-mono">
                  {vitals.pedalReflex === 'brisk' ? 'Presente' : vitals.pedalReflex === 'sluggish' ? 'Deprimido' : 'Abolido (Cirúrgico)'}
                </div>
                <p className="text-[10px] text-[#78788c]">
                  Abolido quando há boa profundidade anestésica ou analgesia profunda
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#1c1c26] bg-[#121218] text-xs text-[#717182]">
          <span>Guedel Veterinário · Avaliação de Consciência e Plano Cirúrgico</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-md"
          >
            Fechar Quadro
          </button>
        </div>
      </div>
    </div>
  );
};
