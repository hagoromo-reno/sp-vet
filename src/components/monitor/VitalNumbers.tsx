import React from 'react';
import { VitalSigns, MonitorAlarmLimits, AnesthesiaEquipmentState } from '../../types/simulator';
import {
  Activity,
  Heart,
  Wind,
  Gauge,
  Flame,
  Eye,
  Volume2,
  VolumeX,
  Skull,
  AlertTriangle,
  AlertOctagon,
  FileText,
} from 'lucide-react';

interface VitalNumbersProps {
  vitals: VitalSigns;
  equipment: AnesthesiaEquipmentState;
  alarmLimits: MonitorAlarmLimits;
  onToggleAudioMute: () => void;
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

export const VitalNumbers: React.FC<VitalNumbersProps> = ({
  vitals,
  equipment,
  alarmLimits,
  onToggleAudioMute,
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
  // Check Alarm Conditions
  const isHrAlarm = vitals.heartRate < alarmLimits.hrLow || vitals.heartRate > alarmLimits.hrHigh;
  const isMapAlarm = vitals.meanArterialPressure < alarmLimits.mapLow || vitals.meanArterialPressure > alarmLimits.mapHigh;
  const isSpo2Alarm = vitals.pulseOximetrySpO2 < alarmLimits.spo2Low;
  const isEtco2Alarm = vitals.etCO2 < alarmLimits.etco2Low || vitals.etCO2 > alarmLimits.etco2High;
  const isTempAlarm = vitals.bodyTemperatureC < alarmLimits.tempLow || vitals.bodyTemperatureC > alarmLimits.tempHigh;

  const isAnyAlarm = isHrAlarm || isMapAlarm || isSpo2Alarm || isEtco2Alarm || isTempAlarm || vitals.isCardiacArrest || vitals.isRespiratoryArrest;

  // Format Guedel Stage cleanly without truncation
  const getGuedelDisplay = () => {
    if (vitals.isDead) return { stage: 'ÓBITO', sub: 'Sem atividade' };
    if (vitals.anestheticDepthScore < 20) return { stage: 'Estágio I', sub: 'Consciente / Sedação Leve' };
    if (vitals.anestheticDepthScore < 40) return { stage: 'Estágio II', sub: 'Excitação / Delírio' };
    if (vitals.anestheticDepthScore < 55) return { stage: 'Estágio III · P1', sub: 'Anestesia Superficial' };
    if (vitals.anestheticDepthScore < 75) return { stage: 'Estágio III · P2', sub: 'Cirúrgico Adequado' };
    if (vitals.anestheticDepthScore < 90) return { stage: 'Estágio III · P3', sub: 'Anestesia Profunda' };
    return { stage: 'Estágio IV', sub: 'Parada Bulbar Iminente' };
  };

  const guedel = getGuedelDisplay();

  return (
    <div className="flex flex-col h-full space-y-2 select-none justify-between">
      {/* Top Monitor Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d0d0d] border border-[#222222] rounded-lg text-xs shrink-0">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              vitals.isDead
                ? 'bg-red-600'
                : vitals.isCardiacArrest
                ? 'bg-red-500 animate-ping'
                : isAnyAlarm
                ? 'bg-amber-400 animate-ping'
                : 'bg-emerald-400 animate-ping'
            }`}
          ></span>
          <span className="font-semibold text-[#e5e5e5] text-xs">MONITOR MULTIPARAMÉTRICO VET</span>
          
          {vitals.isDead ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 border border-red-500 text-red-300 font-mono-code font-bold">
              ÓBITO
            </span>
          ) : vitals.isCardiacArrest ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 border border-red-500 text-red-300 font-mono-code font-bold animate-pulse">
              PCR ATIVA
            </span>
          ) : vitals.isRespiratoryArrest ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-950 border border-orange-500 text-orange-300 font-mono-code font-bold animate-pulse">
              APNEIA
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#171717] border border-[#262626] text-[#888888] font-mono-code">
              RECOVER 2024
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {vitals.isDead && onOpenDeathReport && (
            <button
              onClick={onOpenDeathReport}
              className="text-[10px] px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white font-bold flex items-center gap-1 transition"
            >
              <FileText className="w-3 h-3" />
              <span>Laudo</span>
            </button>
          )}

          <button
            onClick={onToggleAudioMute}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs transition font-medium ${
              alarmLimits.isAudioMuted
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-[#181818] border border-[#282828] text-[#d4d4d4] hover:bg-[#222222]'
            }`}
            title={alarmLimits.isAudioMuted ? 'Áudio Mutado' : 'Áudio Ativo'}
          >
            {alarmLimits.isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{alarmLimits.isAudioMuted ? 'MUDO' : 'BIP'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Main Vital Parameter Tiles (Guaranteed 2x3 Grid Proportion) */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-[320px]">
        {/* 1. HEART RATE (GREEN) */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
            vitals.isDead
              ? 'bg-[#14080a] border-red-900/60'
              : isHrAlarm
              ? 'bg-[#24080a] border-red-500/80 animate-pulse'
              : 'bg-[#0a0f0c] border-[#1b3824]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-emerald-400 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-emerald-400" />
              FC (bpm)
            </span>
            <span className="text-[10px] text-[#737373] font-mono-code">
              {alarmLimits.hrLow}-{alarmLimits.hrHigh}
            </span>
          </div>

          <div className="my-0.5 flex items-baseline justify-between">
            <span className={`text-3xl lg:text-4xl font-extrabold font-digital tracking-wider ${vitals.isDead ? 'text-red-500' : 'text-emerald-400'}`}>
              {vitals.isDead || vitals.cardiacRhythm === 'asystole' ? '0' : vitals.heartRate}
            </span>
            <span className="text-[11px] font-mono-code text-emerald-500/80 uppercase truncate max-w-[110px]">
              {vitals.cardiacRhythm.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="text-[10px] text-[#888888] font-mono-code truncate flex items-center justify-between">
            <span>Pulso: <strong className="text-[#f5f5f5]">{vitals.pulseQuality}</strong></span>
            <span className="text-[9px] text-[#666666]">ECG DII</span>
          </div>
        </div>

        {/* 2. SpO2 & PLETH (CYAN) */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
            vitals.isDead
              ? 'bg-[#0b1013] border-cyan-950/60'
              : isSpo2Alarm
              ? 'bg-[#24080a] border-red-500/80 animate-pulse'
              : 'bg-[#080f13] border-[#153440]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-cyan-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              SpO₂ (%)
            </span>
            <span className="text-[10px] text-[#737373] font-mono-code">&gt; {alarmLimits.spo2Low}%</span>
          </div>

          <div className="my-0.5 flex items-baseline justify-between">
            <span className={`text-3xl lg:text-4xl font-extrabold font-digital tracking-wider ${vitals.isDead ? 'text-red-400' : 'text-cyan-400'}`}>
              {vitals.isDead ? '---' : `${vitals.pulseOximetrySpO2}%`}
            </span>
            <span className="text-[11px] font-mono-code text-cyan-400/90 font-bold">
              PI: {vitals.perfusionIndex}%
            </span>
          </div>

          <div className="text-[10px] text-[#888888] font-mono-code truncate flex items-center justify-between">
            <span>PaO₂ est.: <strong className="text-cyan-200">{vitals.arterialBloodGases.paO2} mmHg</strong></span>
            <span className="text-[9px] text-[#666666]">Oximetria</span>
          </div>
        </div>

        {/* 3. BLOOD PRESSURE (NIBP / IBP) (RED) */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
            vitals.isDead
              ? 'bg-[#14080a] border-red-900/60'
              : isMapAlarm
              ? 'bg-[#24080a] border-red-500/80 animate-pulse'
              : 'bg-[#12080a] border-[#381619]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-red-400 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-red-400" />
              {isContinuousIbpActive ? 'PA Invasiva (IBP)' : 'PNI (NIBP)'}
            </span>

            <div className="flex items-center space-x-1">
              <button
                onClick={onTriggerNibpMeasurement}
                disabled={vitals.isDead || isNibpMeasuring}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#260c0f] hover:bg-[#381216] text-red-300 border border-red-800/60 font-mono-code transition disabled:opacity-40 font-bold"
                title="Aferir Pressão Arterial Não-Invasiva Imediatamente"
              >
                {isNibpMeasuring ? 'MEDINDO...' : 'PNI STAT'}
              </button>

              {onChangeNibpAutoInterval && (
                <select
                  value={nibpAutoIntervalMin}
                  onChange={(e) => onChangeNibpAutoInterval(Number(e.target.value))}
                  className="bg-[#1e0a0d] text-red-300 text-[9px] font-mono rounded px-1 py-0.5 border border-red-900/60 focus:outline-none"
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

          <div className="my-0.5 flex items-baseline justify-between">
            {isNibpMeasuring ? (
              <div className="w-full py-1 text-center font-mono-code text-xs text-red-300 animate-pulse flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>Insuflador NIBP (140... 110... 80)</span>
              </div>
            ) : isContinuousIbpActive ? (
              <>
                <div>
                  <span className="text-xl lg:text-2xl font-bold font-digital text-red-400">
                    {vitals.isDead ? '0/0' : `${vitals.systolicBP}/${vitals.diastolicBP}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#888888] font-mono-code mr-1">PAM</span>
                  <span className="text-2xl lg:text-3xl font-extrabold font-digital text-red-400">
                    ({vitals.isDead ? '0' : vitals.meanArterialPressure})
                  </span>
                </div>
              </>
            ) : lastNibpMeasurement ? (
              <>
                <div>
                  <span className="text-xl lg:text-2xl font-bold font-digital text-red-400">
                    {vitals.isDead ? '0/0' : `${lastNibpMeasurement.sys}/${lastNibpMeasurement.dia}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#888888] font-mono-code mr-1">PAM</span>
                  <span className="text-2xl lg:text-3xl font-extrabold font-digital text-red-400">
                    ({vitals.isDead ? '0' : lastNibpMeasurement.map})
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full py-1 text-center font-mono-code text-xs text-red-400/60">
                -- / -- (--) · Pressione PNI STAT
              </div>
            )}
          </div>

          <div className="text-[10px] text-[#888888] font-mono-code truncate flex items-center justify-between">
            <span>
              {isContinuousIbpActive
                ? 'Contínuo (Artéria)'
                : lastNibpMeasurement
                ? `Aferido há ${Math.floor((simTimeSeconds - lastNibpMeasurement.timestampSimSec) / 60)}m ${Math.floor((simTimeSeconds - lastNibpMeasurement.timestampSimSec) % 60)}s`
                : 'Aguardando 1ª Aferição'}
            </span>

            {onToggleContinuousIbp && (
              <button
                onClick={onToggleContinuousIbp}
                className="text-[9px] underline text-red-400/80 hover:text-red-300"
              >
                {isContinuousIbpActive ? 'Usar PNI' : 'Usar IBP'}
              </button>
            )}
          </div>
        </div>

        {/* 4. CAPNOGRAPHY (EtCO2 / FiCO2) (YELLOW) */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
            vitals.isDead
              ? 'bg-[#121008] border-yellow-950/60'
              : isEtco2Alarm
              ? 'bg-[#2b1805] border-yellow-500/80 animate-pulse'
              : 'bg-[#121008] border-[#383015]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-yellow-400 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-yellow-400" />
              EtCO₂ (mmHg)
            </span>
            <span className="text-[10px] text-[#737373] font-mono-code">
              {alarmLimits.etco2Low}-{alarmLimits.etco2High}
            </span>
          </div>

          <div className="my-0.5 flex items-baseline justify-between">
            <span className="text-3xl lg:text-4xl font-extrabold font-digital text-yellow-400 tracking-wider">
              {vitals.isDead ? '0' : vitals.etCO2}
            </span>
            <span className="text-[11px] font-mono-code text-yellow-500/90 font-bold">
              FiCO₂: {vitals.fiCO2}
            </span>
          </div>

          <div className="text-[10px] text-[#888888] font-mono-code truncate flex items-center justify-between">
            <span>FR: <strong className="text-yellow-200 font-bold">{vitals.isDead ? '0' : vitals.respiratoryRate} rpm</strong></span>
            <span className="text-[9px] text-[#666666]">Capnografia</span>
          </div>
        </div>

        {/* 5. TEMPERATURE & WARMING (ORANGE) */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
            isTempAlarm
              ? 'bg-[#2b1805] border-amber-500/80 animate-pulse'
              : 'bg-[#130b07] border-[#382114]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-orange-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              TEMP (°C)
            </span>
            <span className="text-[10px] text-[#737373] font-mono-code">
              {alarmLimits.tempLow}-{alarmLimits.tempHigh}°C
            </span>
          </div>

          <div className="my-0.5 flex items-baseline justify-between">
            <span className="text-2xl lg:text-3xl font-extrabold font-digital text-orange-400">
              {vitals.bodyTemperatureC}°C
            </span>
            <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-[#26150b] text-orange-300 border border-orange-800/40 font-bold">
              {equipment.warmingBlanketActive ? 'Aquecedor ON' : 'Aquecedor OFF'}
            </span>
          </div>

          <div className="text-[10px] text-[#888888] font-mono-code truncate">
            Estado: <span className={vitals.bodyTemperatureC < 37.0 ? 'text-amber-300 font-bold' : 'text-[#f5f5f5]'}>
              {vitals.bodyTemperatureC < 36.5 ? 'Hipotermia Moderada' : vitals.bodyTemperatureC < 37.5 ? 'Hipotermia Leve' : 'Normotermia'}
            </span>
          </div>
        </div>

        {/* 6. ANESTHETIC DEPTH & GUEDEL (PURPLE) */}
        <div className="p-2.5 rounded-xl border bg-[#0f0914] border-[#2c173d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono-code text-purple-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              PLANO ANESTÉSICO
            </span>
            {onOpenDepthBoard && (
              <button
                onClick={onOpenDepthBoard}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#2a1339] hover:bg-[#3d1a53] text-purple-300 border border-purple-700/60 font-mono-code transition font-bold"
                title="Abrir Quadro Detalhado de Consciência e Guedel"
              >
                VER QUADRO
              </button>
            )}
          </div>

          <div className="my-0.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-extrabold font-mono-code text-purple-200">
                {vitals.guedelStage}
              </span>
              <span className="text-[10px] text-purple-300 font-mono-code font-bold">
                Consciência: {vitals.consciousnessScore ?? 100}%
              </span>
            </div>

            <div className="w-full bg-[#1c1c1c] h-1.5 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  vitals.isDead
                    ? 'bg-red-700'
                    : vitals.anestheticDepthScore < 40
                    ? 'bg-amber-500'
                    : vitals.anestheticDepthScore <= 80
                    ? 'bg-emerald-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${vitals.anestheticDepthScore}%` }}
              ></div>
            </div>
          </div>

          <div className="text-[10px] text-[#888888] font-mono-code flex justify-between">
            <span>Mandíbula: <strong className="text-purple-200">{vitals.jawTone === 'relaxed_surgical' ? 'Relaxada (Intubável)' : vitals.jawTone === 'moderate' ? 'Moderada' : vitals.jawTone === 'rigid' ? 'Rígida' : 'Flácida'}</strong></span>
            <span>Tol: <strong className="text-purple-200">{vitals.surgicalTolerancePct}%</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
