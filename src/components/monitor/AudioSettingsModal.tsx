import React, { useEffect, useState } from 'react';
import {
  Volume2,
  Sliders,
  X,
  Play,
  Zap,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import { AudioSynthesizer, SoundProfile } from '../../engine/audioSynthesizer';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPulseMuted: boolean;
  onTogglePulseMute: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  isPulseMuted,
  onTogglePulseMute,
}) => {

  const [currentProfile, setCurrentProfile] = useState<SoundProfile>(AudioSynthesizer.getSoundProfile());
  const [pulseVolume, setPulseVolume] = useState<number>(AudioSynthesizer.getPulseVolume());
  const [alarmVolume, setAlarmVolume] = useState<number>(AudioSynthesizer.getAlarmVolume());
  const [masterVolume, setMasterVolume] = useState<number>(AudioSynthesizer.getMasterVolume());

  const [alarmProfile, setAlarmProfile] = useState(AudioSynthesizer.getAlarmProfile());
  useEffect(() => {
    if (!isOpen) AudioSynthesizer.stopAlarmPreview();
    return () => AudioSynthesizer.stopAlarmPreview();
  }, [isOpen]);
  if (!isOpen) return null;

  const handleSelectProfile = (profile: SoundProfile) => {
    AudioSynthesizer.setSoundProfile(profile);
    setCurrentProfile(profile);
    // Play a preview pulse beep immediately with selected profile
    AudioSynthesizer.playPulseBeep(99);
  };

  const handleChangeMasterVolume = (val: number) => {
    setMasterVolume(val);
    AudioSynthesizer.setMasterVolume(val);
  };

  const handleChangePulseVolume = (val: number) => {
    setPulseVolume(val);
    AudioSynthesizer.setPulseVolume(val);
  };

  const handleChangeAlarmVolume = (val: number) => {
    setAlarmVolume(val);
    AudioSynthesizer.setAlarmVolume(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0f1117] border border-cyan-500/30 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-cyan-950/60 via-zinc-900 to-indigo-950/60 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Sons do monitor
              </h2>
              <p className="text-[11px] text-zinc-400">
                Pulso, alertas e volume
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar ajustes de som"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-zinc-300">
          <section className="space-y-3">
            <h3 className="font-bold text-white">Som dos alertas</h3>
            <p className="text-zinc-400">Escolha a cadência. O bip cardíaco tem um ajuste independente.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                ['iec', 'Rajadas de monitor', 'Crítico: 3 + 2 bips, pausa e repetição. Atenção: 3 bips mais espaçados.'],
                ['traditional', 'Tons tradicionais', 'Cadência inspirada no Philips: crítico a cada 1 s; atenção a cada 2 s.'],
              ] as const).map(([id, title, description]) => (
                <button key={id} type="button" aria-pressed={alarmProfile === id}
                  onClick={() => { AudioSynthesizer.setAlarmProfile(id); setAlarmProfile(id); }}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${alarmProfile === id ? 'border-cyan-400 bg-cyan-950/40' : 'border-zinc-700 bg-zinc-900'}`}>
                  <span className="block font-bold text-white mb-1">{title}</span>
                  <span className="text-zinc-400">{description}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">Síntese aproximada baseada em referências de monitores; o som varia conforme o modelo e a configuração.</p>
            <label className="block space-y-2">
              <span className="font-bold text-white">Timbre do bip cardíaco</span>
              <select aria-label="Timbre do bip cardíaco" value={currentProfile}
                onChange={e => handleSelectProfile(e.target.value as SoundProfile)}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2">
                <option value="mindray">Padrão (atual)</option>
                <option value="mindray_dixtal">Padrão clássico</option>
                <option value="mindray_dualtone">Padrão alternativo</option>
                <option value="dixtal_contec">Digital</option>
                <option value="contec_cms">Digital clássico</option>
                <option value="philips">Suave</option>
                <option value="philips_gold">Suave clássico</option>
                <option value="midi_bell">Legado</option>
              </select>
            </label>
          </section>

          {/* Section 2: Volume Controls */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 space-y-4">
            <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Controle de Níveis de Áudio</span>
            </h3>

            {/* Master Volume */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-300">Volume Geral (Master)</span>
                <span className="font-mono-code font-bold text-cyan-400">
                  {Math.round(masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label="Volume geral"
                value={masterVolume}
                onChange={(e) => handleChangeMasterVolume(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Pulse Beep Volume */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-300">Volume do Bip de Pulso (QRS)</span>
                  <button
                    onClick={onTogglePulseMute}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition ${
                      isPulseMuted
                        ? 'bg-amber-950 border border-amber-500/50 text-amber-300'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {isPulseMuted ? 'MUDO' : 'ATIVO'}
                  </button>
                </div>
                <span className="font-mono-code font-bold text-cyan-400">
                  {Math.round(pulseVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label="Volume do pulso"
                value={pulseVolume}
                onChange={(e) => handleChangePulseVolume(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Alarm Volume */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-300">Volume dos alertas</span>
                <span className="font-mono-code font-bold text-cyan-400">
                  {Math.round(alarmVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label="Volume dos alertas"
                value={alarmVolume}
                onChange={(e) => handleChangeAlarmVolume(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Interactive Sound Tester */}
          <div>
            <h3 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ouvir uma sequência de teste</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => AudioSynthesizer.playPulseBeep(99)}
                className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-emerald-500/60 hover:bg-zinc-800/80 text-zinc-200 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[11px]">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Bip SpO₂ 99%</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono-code mt-0.5">Buzzer 980 Hz · Normal</span>
              </button>

              <button
                type="button"
                onClick={() => AudioSynthesizer.playPulseBeep(85)}
                className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/60 hover:bg-zinc-800/80 text-zinc-200 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[11px]">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Bip SpO₂ 85%</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono-code mt-0.5">Buzzer 660 Hz · Hipóxia</span>
              </button>

              <button
                type="button"
                onClick={() => AudioSynthesizer.playPulseBeep(98, true)}
                className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-purple-500/60 hover:bg-zinc-800/80 text-zinc-200 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-purple-400 text-[11px]">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Bip Ectópico</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono-code mt-0.5">CPV ventricular</span>
              </button>

              <button
                type="button"
                onClick={() => AudioSynthesizer.playHighPriorityAlarm()}
                className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/60 hover:border-red-500 hover:bg-red-950/70 text-red-200 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-red-400 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Alarme Severo</span>
                </div>
                <span className="text-[10px] text-red-400/70 font-mono-code mt-0.5">{alarmProfile === 'iec' ? 'Duas rajadas de 5 bips' : 'Tom agudo'}</span>
              </button>

              <button
                type="button"
                onClick={() => AudioSynthesizer.playMediumPriorityAlarm()}
                className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-900/60 hover:border-amber-500 hover:bg-amber-950/70 text-amber-200 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-amber-400 text-[11px]">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Alarme Atenção</span>
                </div>
                <span className="text-[10px] text-amber-400/70 font-mono-code mt-0.5">{alarmProfile === 'iec' ? '3 bips espaçados' : 'Tom grave'}</span>
              </button>

              <button
                type="button"
                onClick={() => AudioSynthesizer.playContinuousAsystoleTone(2.0)}
                className="p-2.5 rounded-lg bg-red-950/60 border border-red-500 hover:bg-red-900/80 text-red-100 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-red-300 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span>Assistolia / Parada</span>
                </div>
                <span className="text-[10px] text-red-300/80 font-mono-code mt-0.5">Alerta de alta prioridade</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  AudioSynthesizer.playDefibrillatorCharging();
                }}
                className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500/60 hover:bg-zinc-800/80 text-zinc-200 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-cyan-400 text-[11px]">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Carga Desfib.</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono-code mt-0.5">Inversor capacitor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  AudioSynthesizer.playDefibrillatorShock();
                }}
                className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/60 hover:bg-zinc-800/80 text-zinc-200 flex flex-col items-start transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-red-400 text-[11px]">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Disparo Choque</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono-code mt-0.5">Estalo relé + choque</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-3 text-xs text-zinc-400">
          Os testes respeitam os volumes e o silenciamento dos alarmes.
          <button type="button" onClick={() => AudioSynthesizer.stopAlarmPreview()}
            className="ml-2 underline text-cyan-300 cursor-pointer">Parar teste de alerta</button>
        </div>
        {/* Footer */}
        <div className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
          >
            Concluir & Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
