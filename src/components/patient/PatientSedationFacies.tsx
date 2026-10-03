import React, { useState } from 'react';
import { VitalSigns, PatientProfile } from '../../types/simulator';
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Eye,
  Hand,
  Moon,
  Shield,
  Smile,
  Sparkles,
  Zap,
} from 'lucide-react';

export type SedationVisualStage = 1 | 2 | 3 | 4;

export interface SedationStageInfo {
  stage: SedationVisualStage;
  label: string;
  shortLabel: string;
  badgeClass: string;
  borderClass: string;
  glowClass: string;
  ringClass: string;
  textClass: string;
  imageSrc: string;
  summary: string;
  clinicalDescription: string;
  clinicalSigns: {
    eyes: string;
    jawTone: string;
    reflexes: string;
    responsiveness: string;
  };
  typicalDrugs: string;
}

export const SEDATION_STAGES: Record<SedationVisualStage, SedationStageInfo> = {
  1: {
    stage: 1,
    label: 'Normal / Alerta (Consciente)',
    shortLabel: 'Normal / Alerta',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
    borderClass: 'border-emerald-500/60',
    glowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.30)]',
    ringClass: 'ring-2 ring-emerald-500/70',
    textClass: 'text-emerald-400',
    imageSrc: '/assets/png/dog-1.png',
    summary: 'Animal totalmente acordado, olhos bem abertos e atentos, postura ereta e alerta.',
    clinicalDescription:
      'Paciente plenamente consciente, responsivo a estímulos ambientais e comandos. Reflexos palpebral e corneal vivos, tônus mandibular rígido e sem sinais de depressão farmacológica do sistema nervoso central.',
    clinicalSigns: {
      eyes: 'Olhos abertos, atentos e brilhantes; reflexo palpebral e corneal enérgicos (imediatos).',
      jawTone: 'Tônus mandibular rígido, boca fechada com forte resistência à abertura passiva.',
      reflexes: 'Reflexo podal e de retirada vivos com fuga imediata ao pinçamento.',
      responsiveness: 'Totalmente orientado; responde prontamente a ruídos, toque e aproximação.',
    },
    typicalDrugs: 'Estado basal pré-anestésico ou recuperação anestésica completa / reversão.',
  },
  2: {
    stage: 2,
    label: 'Pouco Sedado (Sedação Leve / Abatimento)',
    shortLabel: 'Pouco Sedado',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
    borderClass: 'border-amber-500/60',
    glowClass: 'shadow-[0_0_20px_rgba(245,158,11,0.30)]',
    ringClass: 'ring-2 ring-amber-500/70',
    textClass: 'text-amber-400',
    imageSrc: '/assets/png/dog-2.png',
    summary: 'Ptose palpebral leve, olhar sonolento/abatido com olhos entreabertos; acalmado.',
    clinicalDescription:
      'Tranquilização e sedação leve. O paciente apresenta diminuição da agressividade e da ansiedade, olhar sonolento (olhos caídos/entreabertos), porém permanece perfeitamente acordável ao estímulo tátil ou auditivo.',
    clinicalSigns: {
      eyes: 'Pálpebras parcialmente caídas (ptose palpebral leve), olhar calmo ou sonolento.',
      jawTone: 'Tônus mandibular moderadamente diminuído, mas ainda resiste à abertura.',
      reflexes: 'Reflexo palpebral moderado a vivo; reflexo de retirada podal preservado.',
      responsiveness: 'Acorda prontamente ao ser chamado ou tocado; sedação cooperativa e dócil.',
    },
    typicalDrugs: 'Fenotiazínicos (Acepromazina isolada), Benzodiazepínicos isolados (Midazolam/Diazepam).',
  },
  3: {
    stage: 3,
    label: 'Moderadamente Sedado (Neuroleptanalgesia)',
    shortLabel: 'Moderado',
    badgeClass: 'bg-violet-950/80 text-violet-300 border-violet-500/50',
    borderClass: 'border-violet-500/60',
    glowClass: 'shadow-[0_0_20px_rgba(139,92,246,0.35)]',
    ringClass: 'ring-2 ring-violet-500/70',
    textClass: 'text-violet-400',
    imageSrc: '/assets/png/dog-3.png',
    summary: 'Olhos suavemente fechados, focinho relaxado, cabeça apoiada em decúbito; sereno.',
    clinicalDescription:
      'Sedação moderada a profunda ou neuroleptoanalgesia. Paciente em decúbito calmo, olhos fechados e sono evidente. Não se levanta espontaneamente e tolera manipulações clínicas não invasivas, mas mantém reflexos protetores laríngeos.',
    clinicalSigns: {
      eyes: 'Olhos suavemente fechados; reflexo palpebral lento/enfraquecido.',
      jawTone: 'Relaxamento muscular evidente; moderada facilidade para inspecionar cavidade oral.',
      reflexes: 'Reflexo podal diminuído (retirada lenta); reflexos protetores laríngeos preservados.',
      responsiveness: 'Indiferente a sons suaves; responde com movimentação lenta apenas a estímulos intensos.',
    },
    typicalDrugs: 'Agonistas alfa-2 (Dexmedetomidina/Xilazina), Neuroleptanalgesia (Acepromazina + Metadona/Morfina).',
  },
  4: {
    stage: 4,
    label: 'Profundamente Sedado / Anestesiado (Sono Profundo / Zzz)',
    shortLabel: 'Profundo (Zzz)',
    badgeClass: 'bg-purple-950/80 text-purple-200 border-purple-500/50',
    borderClass: 'border-purple-500/60',
    glowClass: 'shadow-[0_0_25px_rgba(168,85,247,0.40)]',
    ringClass: 'ring-2 ring-purple-600/80',
    textClass: 'text-purple-300',
    imageSrc: '/assets/png/dog-4.png',
    summary: 'Sono profundo ("Z Z Z"), inconsciência cirúrgica completa, ausência de reflexos.',
    clinicalDescription:
      'Plano anestésico cirúrgico (Guedel Estágio III) ou anestesia geral profunda. Paciente inconsciente, imóvel, com rotação ocular ventromedial cirúrgica ou miose/midríase profunda, relaxamento muscular completo e tolerância a procedimentos invasivos.',
    clinicalSigns: {
      eyes: 'Olhos rotacionados ventromedialmente ou pupila central anestesiada; "Z Z Z" de sono cirúrgico.',
      jawTone: 'Completamente relaxado a flácido; mandíbula livre para intubação orotraqueal.',
      reflexes: 'Reflexo palpebral e pedal abolidos / ausentes; reflexo de deglutição ausente.',
      responsiveness: 'Inconsciente; sem resposta voluntária a qualquer estímulo doloroso ou sonoro.',
    },
    typicalDrugs: 'Indutores (Propofol, Alfaxalona), Inalatórios (Isoflurano, Sevoflurano), Infusão TIVA.',
  },
};

/**
 * Derives the active visual sedation stage (1 to 4) from real-time vital signs.
 */
export function getSedationStageInfo(vitals?: VitalSigns): SedationStageInfo {
  if (!vitals) return SEDATION_STAGES[1];

  const isDeadOrArrest = vitals.isDead || vitals.isCardiacArrest;
  const stage = vitals.guedelStage;
  const consciousness = vitals.consciousnessScore ?? 100;
  const depth = vitals.anestheticDepthScore ?? 0;
  const centralSedation = vitals.cellularState?.centralSedation ?? vitals.biologicalState?.neurological?.sedativeDepth ?? 0;
  const hypnotic = vitals.cellularState?.hypnoticEffect ?? vitals.biologicalState?.neurological?.hypnoticDepth ?? 0;
  const temp = vitals.bodyTemperatureC ?? 38.0;
  const etco2 = vitals.etCO2 ?? 38;
  const spo2 = vitals.spO2 ?? 98;
  const palpebral = vitals.palpebralReflex;

  // 1. Stage 4: Surgical Anesthesia / Deep Sedation / Severe Hypothermic Coma / Arrest / Absent Reflexes
  if (
    isDeadOrArrest ||
    stage === 'Estágio III Plano 2 (Cirúrgico)' ||
    stage === 'Estágio III Plano 3 (Profundo)' ||
    stage === 'Estágio IV (Depressão Bulbar / Parada)' ||
    consciousness < 25 ||
    depth >= 55 ||
    hypnotic >= 0.50 ||
    temp < 30.0 || // Critical hypothermia (< 30 °C produces hypothermic coma/stupor)
    (etco2 >= 75 && spo2 < 85) || // Extreme hypercapnic narcosis & hypoxia
    (palpebral === 'absent' && (hypnotic >= 0.35 || temp < 32.0 || depth >= 40))
  ) {
    return SEDATION_STAGES[4];
  }

  // 2. Stage 3: Moderate Sedation / Neuroleptanalgesia / Moderate Hypothermia / CO2 Narcosis
  if (
    stage === 'Estágio I (Sedação Profunda / Neuroleptanalgesia)' ||
    stage === 'Estágio II (Excitação/Delírio)' ||
    stage === 'Estágio III Plano 1 (Leve)' ||
    stage === 'Anestesia Dissociativa (Reflexos Preservados)' ||
    (consciousness < 55 && consciousness >= 25) ||
    centralSedation >= 0.40 ||
    depth >= 30 ||
    temp < 34.0 || // Moderate hypothermia (30-34 °C produces marked somnolence/stupor)
    etco2 >= 62 || // Significant CO2 narcosis
    spo2 < 78 || // Severe hypoxemia
    palpebral === 'absent'
  ) {
    return SEDATION_STAGES[3];
  }

  // 3. Stage 2: Light Sedation / Tranquilization / Drowsiness / Mild Hypothermia / Sluggish Reflexes
  if (
    stage === 'Estágio I (Sedação Leve / Abatimento)' ||
    (consciousness < 85 && consciousness >= 55) ||
    centralSedation >= 0.16 ||
    hypnotic >= 0.12 ||
    depth >= 15 ||
    temp < 36.5 || // Mild hypothermia produces apathy, shivering or somnolence
    etco2 >= 55 || // Moderate hypercapnia
    spo2 < 90 || // Hypoxemia
    palpebral === 'sluggish'
  ) {
    return SEDATION_STAGES[2];
  }

  // 4. Stage 1: Awake / Alert / Baseline (strictly requires normal temperature, oxygenation and brisk reflexes)
  return SEDATION_STAGES[1];
}

// ---------------------------------------------------------------------------
// Compact / Header / Floating Avatar Component
// ---------------------------------------------------------------------------

interface PatientSedationAvatarProps {
  vitals?: VitalSigns;
  patient?: PatientProfile;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

export const PatientSedationAvatar: React.FC<PatientSedationAvatarProps> = ({
  vitals,
  patient,
  size = 'md',
  showLabel = true,
  onClick,
  className = '',
}) => {
  const info = getSedationStageInfo(vitals);
  const isDeadOrArrest = Boolean(vitals?.isDead || vitals?.isCardiacArrest);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-16 h-16 rounded-2xl',
  }[size];

  const imgSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-9 h-9',
    lg: 'w-13 h-13',
  }[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title={`Fácies do Paciente: ${info.label}\n${info.summary}\nClique para ver o quadro de profundidade anestésica.`}
    >
      <div className="relative">
        <div
          className={`${sizeClasses} bg-white flex items-center justify-center p-1 transition-all duration-300 shadow-md ${
            isDeadOrArrest
              ? 'grayscale border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
              : `${info.ringClass} ${info.glowClass} group-hover:scale-105`
          }`}
        >
          <img
            src={info.imageSrc}
            alt={info.label}
            className={`${imgSizeClasses} object-contain select-none transition-transform duration-300 ${
              info.stage === 4 ? 'animate-pulse' : ''
            }`}
          />
        </div>

        {/* Small active badge dot */}
        <span
          className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0c0c10] flex items-center justify-center text-[8px] font-bold ${
            isDeadOrArrest
              ? 'bg-rose-600 text-white'
              : info.stage === 1
              ? 'bg-emerald-500 text-white'
              : info.stage === 2
              ? 'bg-amber-500 text-black'
              : info.stage === 3
              ? 'bg-violet-500 text-white'
              : 'bg-purple-600 text-white animate-bounce'
          }`}
        >
          {isDeadOrArrest ? '!' : info.stage}
        </span>
      </div>

      {showLabel && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-mono">
              Fácies Clínica
            </span>
            {isDeadOrArrest && (
              <span className="text-[9px] font-bold px-1 rounded bg-rose-950 text-rose-300 border border-rose-600">
                PARADA / ÓBITO
              </span>
            )}
          </div>
          <span className={`text-xs font-extrabold truncate max-w-[150px] sm:max-w-none ${info.textClass}`}>
            {info.shortLabel}
          </span>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Full Interactive Physical Exam & Depth Board Panel Component
// ---------------------------------------------------------------------------

interface PatientSedationPanelProps {
  vitals?: VitalSigns;
  patient?: PatientProfile;
  onOpenConsciousnessBoard?: () => void;
}

export const PatientSedationPanel: React.FC<PatientSedationPanelProps> = ({
  vitals,
  patient,
  onOpenConsciousnessBoard,
}) => {
  const currentInfo = getSedationStageInfo(vitals);
  const [selectedPreviewStage, setSelectedPreviewStage] = useState<SedationVisualStage | null>(null);

  const activeDisplayInfo = selectedPreviewStage ? SEDATION_STAGES[selectedPreviewStage] : currentInfo;
  const isCurrentActive = activeDisplayInfo.stage === currentInfo.stage;
  const isDeadOrArrest = Boolean(vitals?.isDead || vitals?.isCardiacArrest);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#13131c] to-[#0c0c12] p-4.5 space-y-4 shadow-xl font-sans">
      {/* Top Banner: Title & Current Stage Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-extrabold text-white tracking-tight">
                Inspeção da Fácies & Nível de Sedação do Paciente
              </h4>
              <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700">
                Visual 4 Estágios
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Acompanhamento gráfico em tempo real da expressão facial, tônus e profundidade clínica
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${activeDisplayInfo.badgeClass}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isCurrentActive ? `Atual: ${activeDisplayInfo.shortLabel}` : `Previsão: ${activeDisplayInfo.shortLabel}`}</span>
          </span>

          {onOpenConsciousnessBoard && (
            <button
              onClick={onOpenConsciousnessBoard}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition cursor-pointer flex items-center gap-1"
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Ver Guedel Completo</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Showcase: Big Avatar + 4-Stage Pathway */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left Column: Big Animated Face Container (4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-[#09090d] border border-zinc-800/80 shadow-inner">
          <div className="relative">
            <div
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white flex items-center justify-center p-2.5 transition-all duration-500 shadow-xl ${
                isDeadOrArrest && isCurrentActive
                  ? 'grayscale border-4 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.5)] animate-pulse'
                  : `${activeDisplayInfo.ringClass} ${activeDisplayInfo.glowClass}`
              }`}
            >
              <img
                src={activeDisplayInfo.imageSrc}
                alt={activeDisplayInfo.label}
                className={`w-24 h-24 sm:w-28 sm:h-28 object-contain select-none transition-all duration-500 ${
                  activeDisplayInfo.stage === 4 ? 'animate-pulse scale-95' : 'hover:scale-105'
                }`}
              />
            </div>

            {/* Stage Indicator Pill */}
            <span
              className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-mono-code font-bold uppercase tracking-wider border shadow-md ${
                isDeadOrArrest && isCurrentActive
                  ? 'bg-rose-900 border-rose-500 text-rose-200'
                  : activeDisplayInfo.badgeClass
              }`}
            >
              Estágio {activeDisplayInfo.stage} / 4
            </span>
          </div>

          <div className="text-center mt-4 space-y-1">
            <h5 className={`text-sm font-extrabold ${activeDisplayInfo.textClass}`}>
              {activeDisplayInfo.label}
            </h5>
            <p className="text-[11px] text-zinc-400 max-w-[240px] leading-relaxed">
              {activeDisplayInfo.summary}
            </p>
          </div>
        </div>

        {/* Right Column: 4 Sequential Interactive Cards (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
            <span>Sequência de Evolução da Sedação:</span>
            {selectedPreviewStage && (
              <button
                onClick={() => setSelectedPreviewStage(null)}
                className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
              >
                Voltar ao estado em tempo real
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {([1, 2, 3, 4] as SedationVisualStage[]).map((stg) => {
              const item = SEDATION_STAGES[stg];
              const isLive = currentInfo.stage === stg;
              const isSelected = activeDisplayInfo.stage === stg;

              return (
                <button
                  key={stg}
                  onClick={() => setSelectedPreviewStage(stg)}
                  className={`relative p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? `bg-zinc-900/90 ${item.borderClass} ${item.glowClass} ring-1 ${item.ringClass}`
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                  }`}
                >
                  {/* Top: Mini Image & Live Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm">
                      <img
                        src={item.imageSrc}
                        alt={item.shortLabel}
                        className="w-8 h-8 object-contain"
                      />
                    </div>
                    {isLive && (
                      <span className="flex h-2.5 w-2.5 relative" title="Estado Atual do Paciente">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>

                  {/* Stage Title */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono-code font-bold uppercase text-zinc-400">
                      Estágio {stg}
                    </span>
                    <div className={`text-xs font-bold truncate ${item.textClass}`}>
                      {item.shortLabel}
                    </div>
                  </div>

                  {/* Footer status indicator */}
                  <div className="mt-2 pt-1 border-t border-zinc-800/80 text-[9px] text-zinc-400 flex items-center justify-between font-mono">
                    <span>{isLive ? '● Em tempo real' : 'Ver detalhes'}</span>
                    {isSelected && <span className="text-white font-bold">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Clinical Parameter Breakdown for the Displayed Stage */}
          <div className="p-3 rounded-xl bg-[#0e0e16] border border-zinc-800 text-[11px] space-y-2">
            <div className="text-zinc-300 font-sans leading-relaxed">
              <strong>Achados Semiológicos:</strong> {activeDisplayInfo.clinicalDescription}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono-code text-[10px]">
              <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-start gap-2">
                <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-300 block">Olhos & Pálpebras:</strong>
                  <span className="text-zinc-400">{activeDisplayInfo.clinicalSigns.eyes}</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-start gap-2">
                <Hand className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-300 block">Tônus Mandibular:</strong>
                  <span className="text-zinc-400">{activeDisplayInfo.clinicalSigns.jawTone}</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-300 block">Reflexos Protetores:</strong>
                  <span className="text-zinc-400">{activeDisplayInfo.clinicalSigns.reflexes}</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-300 block">Fármacos Típicos:</strong>
                  <span className="text-zinc-400">{activeDisplayInfo.typicalDrugs}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
