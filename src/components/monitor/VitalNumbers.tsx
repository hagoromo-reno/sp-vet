import React from 'react';
import { VitalSigns, MonitorAlarmLimits, AnesthesiaEquipmentState, CardiacRhythm, MucousMembraneColor, CapillaryRefillTime } from '../../types/simulator';
import {
  Activity,
  Heart,
  Wind,
  Gauge,
  Flame,
  Eye,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Sliders,
  AlertTriangle,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import { ActiveAlarmStatus } from '../../engine/audioSynthesizer';

interface VitalNumbersProps {
  vitals: VitalSigns;
  equipment: AnesthesiaEquipmentState;
  alarmLimits: MonitorAlarmLimits;
  activeAlarmStatus?: ActiveAlarmStatus | null;
  onToggleAudioMute: () => void;
  onToggleAlarmsSilence?: () => void;
  onOpenAudioSettings?: () => void;
  onTriggerNibpMeasurement: () => void;
  isNibpMeasuring?: boolean;
  lastNibpMeasurement?: { sys: number; dia: number; map: number; timestampSimSec: number } | null;
  nibpAutoIntervalMin?: number;
  onChangeNibpAutoInterval?: (intervalMin: number) => void;
  isContinuousIbpActive?: boolean;
  onToggleContinuousIbp?: () => void;
  simTimeSeconds?: number;
  onOpenDeathReport?: () => void;
  onOpenDepthBoard?: () => void;
}

function formatRhythm(rhythm: CardiacRhythm): string {
  switch (rhythm) {
    case 'sinus': return 'Sinusal';
    case 'sinus_arrhythmia': return 'Arritmia Sinusal';
    case 'sinus_bradycardia': return 'Bradicardia Sinusal';
    case 'sinus_tachycardia': return 'Taquicardia Sinusal';
    case 'ventricular_premature_complexes': return 'CPVs Ventriculares';
    case 'ventricular_tachycardia': return 'Taquicardia Ventricular';
    case 'ventricular_fibrillation': return 'Fibrilação Ventricular';
    case 'pulseless_electrical_activity': return 'AESP';
    case 'asystole': return 'Assistolia';
    case 'av_block_2nd_degree': return 'BAV 2º Grau';
    case 'av_block_3rd_degree': return 'BAV 3º Grau';
    default: return rhythm;
  }
}

function formatMucousMembrane(color: MucousMembraneColor): { label: string; colorClass: string } {
  switch (color) {
    case 'pink': return { label: 'Róseas', colorClass: 'text-emerald-400' };
    case 'pale': return { label: 'Pálidas', colorClass: 'text-rose-300' };
    case 'cyanotic': return { label: 'Cianóticas', colorClass: 'text-cyan-300 font-bold' };
    case 'brick_red': return { label: 'Congestas', colorClass: 'text-amber-400' };
    case 'icteric': return { label: 'Ictéricas', colorClass: 'text-yellow-400' };
    case 'gray_moribund': return { label: 'Cinza', colorClass: 'text-zinc-400' };
    default: return { label: 'Normal', colorClass: 'text-zinc-300' };
  }
}

function formatCRT(crt: CapillaryRefillTime): { label: string; colorClass: string } {
  switch (crt) {
    case '< 1s (hyperdynamic)': return { label: '< 1s', colorClass: 'text-amber-300' };
    case '1 - 2s (normal)': return { label: '1-2s', colorClass: 'text-emerald-300' };
    case '2 - 3s (sluggish)': return { label: '2-3s', colorClass: 'text-yellow-300' };
    case '> 3s (poor perfusion)': return { label: '> 3s', colorClass: 'text-rose-400 font-bold' };
    case 'absent': return { label: 'Ausente', colorClass: 'text-red-500 font-bold' };
    default: return { label: crt, colorClass: 'text-zinc-300' };
  }
}

function formatGuedelStage(stage: string): { badge: string; sub: string } {
  if (stage.includes('Óbito') || stage.includes('ÓBITO')) return { badge: 'ÓBITO', sub: 'Sem atividade' };
  if (stage.includes('Dissociativa')) return { badge: 'DISSOCIATIVO', sub: 'Reflexos ativos' };
  if (stage.includes('Consciente')) return { badge: 'ESTÁGIO I', sub: 'Consciente / Alerta' };
  if (stage.includes('Sedação')) return { badge: 'ESTÁGIO I', sub: 'Sedação Profunda' };
  if (stage.includes('Excitação')) return { badge: 'ESTÁGIO II', sub: 'Excitação / Delírio' };
  if (stage.includes('Plano 1')) return { badge: 'ESTÁGIO III · P1', sub: 'Anestesia Leve' };
  if (stage.includes('Plano 2')) return { badge: 'ESTÁGIO III · P2', sub: 'Plano Cirúrgico' };
  if (stage.includes('Plano 3')) return { badge: 'ESTÁGIO III · P3', sub: 'Anestesia Profunda' };
  if (stage.includes('Estágio IV') || stage.includes('Depressão')) return { badge: 'ESTÁGIO IV', sub: 'Parada Bulbar' };
  return { badge: 'ESTÁGIO I', sub: stage };
}

export const VitalNumbers: React.FC<VitalNumbersProps> = ({
  vitals,
  equipment,
  alarmLimits,
  activeAlarmStatus,
  onToggleAudioMute,
  onToggleAlarmsSilence,
  onOpenAudioSettings,
  onTriggerNibpMeasurement,
  isNibpMeasuring = false,
  lastNibpMeasurement = null,
  nibpAutoIntervalMin = 3,
  onChangeNibpAutoInterval,
  isContinuousIbpActive = false,
  onToggleContinuousIbp,
  simTimeSeconds = 0,
  onOpenDeathReport,
  onOpenDepthBoard,
}) => {
  const isHrAlarm = vitals.heartRate < alarmLimits.hrLow || vitals.heartRate > alarmLimits.hrHigh;
  const isMapAlarm = vitals.meanArterialPressure < alarmLimits.mapLow || vitals.meanArterialPressure > alarmLimits.mapHigh;
  const isSpo2Alarm = vitals.pulseOximetrySpO2 < alarmLimits.spo2Low;
  const isEtco2Alarm = vitals.etCO2 < alarmLimits.etco2Low || vitals.etCO2 > alarmLimits.etco2High;
  const isTempAlarm = vitals.bodyTemperatureC < alarmLimits.tempLow || vitals.bodyTemperatureC > alarmLimits.tempHigh;

  const isAnyAlarm = isHrAlarm || isMapAlarm || isSpo2Alarm || isEtco2Alarm || isTempAlarm || vitals.isCardiacArrest || vitals.isRespiratoryArrest;
  const guedel = formatGuedelStage(vitals.guedelStage);
  const mucous = formatMucousMembrane(vitals.mucousMembraneColor);
  const crt = formatCRT(vitals.capillaryRefillTime);

  const isAlarmSilenced = activeAlarmStatus?.isSilenced || false;
  const silenceSec = activeAlarmStatus?.silenceRemainingSec || 0;
  const isCriticalAlarm = activeAlarmStatus?.severity === 'critical';
  const isWarningAlarm = activeAlarmStatus?.severity === 'warning';

  return (
    <div className="flex flex-col h-full space-y-2 select-none justify-between">
      {/* Top Monitor Status Bar */}
      <div className="monitor-toolbar flex items-center justify-between px-3 py-1.5 bg-[#0d0d0f] border border-zinc-800/80 rounded-xl text-xs shrink-0 shadow-sm">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              vitals.isDead
                ? 'bg-red-600'
                : isCriticalAlarm || vitals.isCardiacArrest
                ? 'bg-red-500 animate-ping'
                : isWarningAlarm || isAnyAlarm
                ? 'bg-amber-400 animate-ping'
                : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
            }`}
          />
          <span className="font-bold text-zinc-200 tracking-wide text-xs">Sinais vitais</span>
          
          {vitals.isDead ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/80 border border-red-500 text-red-300 font-mono-code font-bold">
              ÓBITO
            </span>
          ) : vitals.isCardiacArrest ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/90 border border-red-500 text-red-200 font-mono-code font-bold animate-pulse">
              PCR ATIVA
            </span>
          ) : vitals.impendingArrestWarning ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-900/90 border border-red-500 text-white font-mono-code font-bold animate-pulse flex items-center gap-1">
              <AlertOctagon className="w-3 h-3 text-red-300" />
              <span>COLAPSO EM ~{vitals.impendingArrestWarning.secondsRemainingEstimate}s</span>
            </span>
          ) : vitals.isRespiratoryArrest ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950/80 border border-orange-500 text-orange-200 font-mono-code font-bold animate-pulse">
              APNEIA
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-400 font-mono-code">
              RECOVER 2024
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {vitals.isDead && onOpenDeathReport && (
            <button
              onClick={onOpenDeathReport}
              className="text-[10px] px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <FileText className="w-3 h-3" />
              <span>Laudo</span>
            </button>
          )}

          {/* Alarm Silence / Pause Button (120s pause) */}
          {onToggleAlarmsSilence && (
            <button
              onClick={onToggleAlarmsSilence}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs transition font-semibold cursor-pointer ${
                isAlarmSilenced
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse shadow-sm shadow-amber-950/50'
                  : isCriticalAlarm || isWarningAlarm
                  ? 'bg-red-950/60 border border-red-500 text-red-200 hover:bg-red-900/80 animate-bounce'
                  : 'bg-zinc-900 border border-zinc-700/60 text-zinc-400 hover:bg-zinc-800'
              }`}
              title={isAlarmSilenced ? `Alarmes pausados por mais ${silenceSec}s (clique para reativar)` : 'Pausar/Silenciar apitos de alarme por 120s'}
            >
              {isAlarmSilenced ? <BellOff className="w-3.5 h-3.5 text-amber-400" /> : <Bell className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-mono-code">
                {isAlarmSilenced ? `PAUSA ${silenceSec}s` : 'SILENCIAR'}
              </span>
            </button>
          )}

          {/* Pulse QRS Audio Beep Toggle */}
          <button
            onClick={onToggleAudioMute}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs transition font-semibold cursor-pointer ${
              alarmLimits.isAudioMuted
                ? 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:bg-zinc-800'
                : 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 shadow-sm shadow-emerald-950/30'
            }`}
            title={alarmLimits.isAudioMuted ? 'Bip de pulso silenciado (clique para ativar)' : 'Bip de pulso SpO2 ativo (clique para mutar)'}
          >
            {alarmLimits.isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="text-[10px]">{alarmLimits.isAudioMuted ? 'BIP OFF' : 'BIP ON'}</span>
          </button>

          {/* Sound Synthesizer / Audio Profile Config Button */}
          {onOpenAudioSettings && (
            <button
              onClick={onOpenAudioSettings}
              className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs transition font-semibold cursor-pointer bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-800 hover:text-cyan-300 hover:border-cyan-500/40"
              title="Configurar Acústica do Monitor, Perfis de Som e Testar Alarmes"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] hidden sm:inline">TIMBRE</span>
            </button>
          )}
        </div>
      </div>

      {/* IEC 60601-1-8 Authentic Clinical Alarm Banner */}
      {activeAlarmStatus && activeAlarmStatus.severity !== 'normal' && activeAlarmStatus.message && (
        <div
          className={`px-3 py-1.5 rounded-xl border text-xs font-mono-code flex items-center justify-between shadow-lg shrink-0 ${
            isCriticalAlarm
              ? 'bg-gradient-to-r from-red-950/95 via-red-900/90 to-red-950/95 border-red-500 text-red-100 animate-pulse'
              : 'bg-gradient-to-r from-amber-950/95 via-amber-900/80 to-amber-950/95 border-amber-500 text-amber-100'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                isCriticalAlarm ? 'text-red-400 animate-bounce' : 'text-amber-400'
              }`}
            />
            <div className="truncate flex items-center gap-2">
              <span className="font-extrabold uppercase tracking-wide">
                {isCriticalAlarm ? '*** ALARME ALTA PRIORIDADE: ' : '** ALARME: '}
                {activeAlarmStatus.message}
                {isCriticalAlarm ? ' ***' : ' **'}
              </span>
            </div>
          </div>
          {isAlarmSilenced && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/80 text-amber-300 font-bold shrink-0">
              ÁUDIO EM PAUSA ({silenceSec}s)
            </span>
          )}
        </div>
      )}

      {/* Impending Arrest Warning Banner */}
      {vitals.impendingArrestWarning && !vitals.isDead && !vitals.isCardiacArrest && (
        <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-950/95 via-red-900/80 to-red-950/95 border border-red-500 text-red-100 text-xs font-mono-code flex items-center justify-between animate-pulse shadow-xl shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
            <div className="truncate">
              <span className="font-extrabold text-red-200 uppercase tracking-wide">
                ⚠️ {vitals.impendingArrestWarning.headline}
              </span>
              <span className="text-[11px] text-red-300 ml-2 font-sans hidden sm:inline truncate">
                {vitals.impendingArrestWarning.details}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono-code font-extrabold px-2 py-0.5 rounded bg-red-800 border border-red-400 text-white shrink-0 ml-2">
            PARADA EM ~{vitals.impendingArrestWarning.secondsRemainingEstimate}s
          </span>
        </div>
      )}

      {/* Grid of Main Vital Parameter Tiles (2 Columns x 3 Rows) */}
      <div className="grid grid-cols-2 gap-2.5 flex-1">
        {/* 1. HEART RATE (EMERALD) */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
            vitals.isDead
              ? 'bg-[#14080a] border-red-900/60'
              : isHrAlarm
              ? 'bg-[#260a0d] border-red-500 animate-pulse'
              : 'bg-[#0a140f] border-emerald-900/40 hover:border-emerald-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-emerald-400 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-emerald-400" />
              FC (bpm)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono-code">
              {alarmLimits.hrLow}-{alarmLimits.hrHigh}
            </span>
          </div>

          <div className="my-1 flex items-baseline justify-between gap-2">
            <span className={`text-3xl xl:text-4xl font-black font-digital tracking-tight ${vitals.isDead ? 'text-red-500' : 'text-emerald-400'}`}>
              {vitals.isDead || vitals.cardiacRhythm === 'asystole' ? '0' : Math.round(vitals.heartRate)}
            </span>
            <span className="text-[11px] font-mono-code text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 truncate max-w-[130px]" title={vitals.cardiacRhythm}>
              {formatRhythm(vitals.cardiacRhythm)}
            </span>
          </div>

          <div className="text-[11px] text-zinc-300 font-mono-code flex items-center justify-between pt-1.5 border-t border-emerald-900/30">
            <span>Pulso: <strong className="text-white font-semibold">{vitals.pulseQuality}</strong></span>
            <span>TPC: <strong className={crt.colorClass}>{crt.label}</strong></span>
          </div>
        </div>

        {/* 2. SpO2 & PLETH (CYAN) */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
            vitals.isDead
              ? 'bg-[#0b1013] border-cyan-950/60'
              : isSpo2Alarm
              ? 'bg-[#260a0d] border-red-500 animate-pulse'
              : 'bg-[#08151b] border-cyan-900/40 hover:border-cyan-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-cyan-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              SpO₂ (%)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono-code">&gt; {alarmLimits.spo2Low}%</span>
          </div>

          <div className="my-1 flex items-baseline justify-between gap-2">
            <span className={`text-3xl xl:text-4xl font-black font-digital tracking-tight ${vitals.isDead ? 'text-red-400' : 'text-cyan-400'}`}>
              {vitals.isDead ? '---' : `${Math.round(vitals.pulseOximetrySpO2)}%`}
            </span>
            <span className="text-[11px] font-mono-code text-cyan-300 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
              PI: {vitals.perfusionIndex}%
            </span>
          </div>

          <div className="text-[11px] text-zinc-300 font-mono-code flex items-center justify-between pt-1.5 border-t border-cyan-900/30">
            <span>PaO₂: <strong className="text-cyan-200 font-bold">{Math.round(vitals.arterialBloodGases.paO2)}</strong></span>
            <span>Mucosas: <strong className={mucous.colorClass}>{mucous.label}</strong></span>
          </div>
        </div>

        {/* 3. BLOOD PRESSURE (NIBP / IBP) (ROSE / RED) */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
            vitals.isDead
              ? 'bg-[#14080a] border-red-900/60'
              : isMapAlarm
              ? 'bg-[#260a0d] border-red-500 animate-pulse'
              : 'bg-[#170a0e] border-rose-900/40 hover:border-rose-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-rose-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-rose-400" />
              {isContinuousIbpActive ? 'PA Invasiva (IBP)' : 'PNI (NIBP)'}
            </span>

            <div className="flex items-center space-x-1">
              <button
                onClick={onTriggerNibpMeasurement}
                disabled={vitals.isDead || isNibpMeasuring}
                className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700/60 font-mono-code transition disabled:opacity-40 font-bold cursor-pointer"
                title="Aferir Pressão Arterial Não-Invasiva Imediatamente"
              >
                {isNibpMeasuring ? 'MEDINDO...' : 'PNI STAT'}
              </button>

              {onChangeNibpAutoInterval && (
                <select
                  value={nibpAutoIntervalMin}
                  onChange={(e) => onChangeNibpAutoInterval(Number(e.target.value))}
                  className="bg-zinc-950 text-rose-300 text-[9px] font-mono rounded px-1 py-0.5 border border-zinc-800 focus:outline-none"
                  title="Ciclo Automático de PNI"
                >
                  <option value="0">Auto: Off</option>
                  <option value="1">1 min</option>
                  <option value="2.5">2.5 min</option>
                  <option value="3">3 min</option>
                  <option value="5">5 min</option>
                </select>
              )}
            </div>
          </div>

          <div className="my-1 flex items-baseline justify-between gap-2">
            {isNibpMeasuring ? (
              <div className="w-full py-1 text-center font-mono-code text-xs text-rose-300 animate-pulse flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Insuflador NIBP (140... 100... 70)</span>
              </div>
            ) : isContinuousIbpActive ? (
              <>
                <span className="text-2xl xl:text-3xl font-bold font-digital text-rose-300">
                  {vitals.isDead ? '0/0' : `${Math.round(vitals.systolicBP)}/${Math.round(vitals.diastolicBP)}`}
                </span>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 font-mono-code mr-1">PAM</span>
                  <span className="text-3xl xl:text-4xl font-black font-digital text-rose-400">
                    ({vitals.isDead ? '0' : Math.round(vitals.meanArterialPressure)})
                  </span>
                </div>
              </>
            ) : lastNibpMeasurement ? (
              <>
                <span className="text-2xl xl:text-3xl font-bold font-digital text-rose-300">
                  {vitals.isDead ? '0/0' : `${lastNibpMeasurement.sys}/${lastNibpMeasurement.dia}`}
                </span>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 font-mono-code mr-1">PAM</span>
                  <span className="text-3xl xl:text-4xl font-black font-digital text-rose-400">
                    ({vitals.isDead ? '0' : lastNibpMeasurement.map})
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full py-1 text-center font-mono-code text-xs text-rose-400/80">
                -- / -- (--) · Clique PNI STAT
              </div>
            )}
          </div>

          <div className="text-[11px] text-zinc-300 font-mono-code flex items-center justify-between pt-1.5 border-t border-rose-900/30">
            <span className="truncate">
              {isContinuousIbpActive
                ? 'Contínua (Artéria)'
                : lastNibpMeasurement
                ? `Aferido há ${Math.floor((simTimeSeconds - lastNibpMeasurement.timestampSimSec) / 60)}m ${Math.floor((simTimeSeconds - lastNibpMeasurement.timestampSimSec) % 60)}s`
                : 'Aguardando 1ª Aferição'}
            </span>

            {onToggleContinuousIbp && (
              <button
                onClick={onToggleContinuousIbp}
                className="text-[10px] underline text-rose-300 hover:text-white cursor-pointer font-semibold ml-1 shrink-0"
              >
                {isContinuousIbpActive ? 'Usar PNI' : 'Usar IBP'}
              </button>
            )}
          </div>
        </div>

        {/* 4. CAPNOGRAPHY (EtCO2 / FiCO2) (AMBER / YELLOW) */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
            vitals.isDead
              ? 'bg-[#121008] border-yellow-950/60'
              : isEtco2Alarm
              ? 'bg-[#2b1805] border-yellow-500 animate-pulse'
              : 'bg-[#15120a] border-amber-900/40 hover:border-amber-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-amber-400 flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-amber-400" />
              EtCO₂ (mmHg)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono-code">
              {alarmLimits.etco2Low}-{alarmLimits.etco2High}
            </span>
          </div>

          <div className="my-1 flex items-baseline justify-between gap-2">
            <span className="text-3xl xl:text-4xl font-black font-digital text-amber-400 tracking-tight">
              {vitals.isDead ? '0' : Math.round(vitals.etCO2)}
            </span>
            <span className="text-[11px] font-mono-code text-amber-300 font-semibold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40">
              FiCO₂: {vitals.fiCO2}
            </span>
          </div>

          <div className="text-[11px] text-zinc-300 font-mono-code flex items-center justify-between pt-1.5 border-t border-amber-900/30">
            <span>FR: <strong className="text-amber-200 font-bold">{vitals.isDead ? '0' : Math.round(vitals.respiratoryRate)} rpm</strong></span>
            {equipment?.intubationStatus === 'intubated_tracheal' ? (
              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${
                vitals.isSpontaneousApnea
                  ? 'bg-amber-950 border-amber-600 text-amber-200'
                  : 'bg-emerald-950 border-emerald-600 text-emerald-200'
              }`}>
                {vitals.isSpontaneousApnea ? 'APNEIA · VENT.' : `Tubo #${equipment.tubeSizeMm}`}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300 font-mono-code">
                Espontâneo
              </span>
            )}
          </div>
        </div>

        {/* 5. TEMPERATURE & GLUCOSE (ORANGE) */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all shadow-sm ${
            isTempAlarm
              ? 'bg-[#2b1805] border-amber-500 animate-pulse'
              : 'bg-[#150f09] border-orange-900/40 hover:border-orange-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-orange-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              TEMP (°C)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono-code">
              {alarmLimits.tempLow}-{alarmLimits.tempHigh}°C
            </span>
          </div>

          <div className="my-1 flex items-baseline justify-between gap-2">
            <span className="text-3xl xl:text-4xl font-black font-digital text-orange-400">
              {vitals.bodyTemperatureC.toFixed(1)}°C
            </span>
            <span className={`text-[10px] font-mono-code px-1.5 py-0.5 rounded font-bold border ${
              equipment.warmingBlanketActive
                ? 'bg-orange-900/60 text-orange-200 border-orange-600/60'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700/50'
            }`}>
              {equipment.warmingBlanketActive ? 'Manta ON' : 'Manta OFF'}
            </span>
          </div>

          <div className="text-[11px] text-zinc-300 font-mono-code flex justify-between items-center pt-1.5 border-t border-orange-900/30">
            <span>Estado: <strong className={vitals.bodyTemperatureC < 37.0 ? 'text-amber-300 font-semibold' : 'text-zinc-100'}>
              {vitals.bodyTemperatureC < 36.5 ? 'Hipotermia' : vitals.bodyTemperatureC < 37.5 ? 'Leve' : 'Normotermia'}
            </strong></span>
            <span>Glicemia: <strong className="text-white font-bold">{vitals.arterialBloodGases.glucoseMgDl.toFixed(0)} mg/dL</strong></span>
          </div>
        </div>

        {/* 6. ANESTHETIC DEPTH & GUEDEL (PURPLE) */}
        <div className="p-3 rounded-xl border bg-[#120a1a] border-purple-900/40 hover:border-purple-700/60 flex flex-col justify-between transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-purple-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              PLANO ANESTÉSICO
            </span>
            {onOpenDepthBoard && (
              <button
                onClick={onOpenDepthBoard}
                className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700/60 font-mono-code transition font-bold cursor-pointer"
                title="Abrir Quadro Detalhado de Consciência e Guedel"
              >
                DETALHES
              </button>
            )}
          </div>

          <div className="my-1 space-y-1">
            <div className="flex items-baseline justify-between gap-1">
              <div className="truncate">
                <span className="text-xs font-black font-mono-code text-purple-200">
                  {guedel.badge}
                </span>
                <span className="text-[10px] text-purple-300/80 ml-1.5 font-sans hidden sm:inline">
                  ({guedel.sub})
                </span>
              </div>
              <span className="text-[11px] text-purple-300 font-mono-code font-bold shrink-0">
                {vitals.consciousnessScore ?? 100}%
              </span>
            </div>

            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full transition-all duration-300 ${
                  vitals.isDead
                    ? 'bg-rose-700'
                    : vitals.anestheticDepthScore < 40
                    ? 'bg-amber-500'
                    : vitals.anestheticDepthScore <= 80
                    ? 'bg-emerald-500'
                    : 'bg-purple-500'
                }`}
                style={{ width: `${vitals.anestheticDepthScore}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-300 font-mono-code flex justify-between pt-1.5 border-t border-purple-900/30">
            <span>Mandíbula: <strong className="text-purple-200 font-semibold">{vitals.jawTone === 'relaxed_surgical' ? 'Relaxada' : vitals.jawTone === 'moderate' ? 'Moderada' : vitals.jawTone === 'rigid' ? 'Rígida' : 'Flácida'}</strong></span>
            <span>Tolerância: <strong className="text-purple-200 font-bold">{Math.round(vitals.surgicalTolerancePct)}%</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
