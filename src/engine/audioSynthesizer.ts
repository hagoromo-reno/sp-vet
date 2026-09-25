/** Procedural monitor audio; see docs/audio-monitor.md for sources and limits. */
import { AlarmProfile, AlarmPriority, getAlarmPattern } from './alarmPatterns';
import { VitalSigns, MonitorAlarmLimits } from '../types/simulator';

export type SoundProfile =
  | 'mindray'
  | 'mindray_dixtal'
  | 'mindray_dualtone'
  | 'dixtal_contec'
  | 'contec_cms'
  | 'philips_gold'
  | 'philips'
  | 'midi_bell';

export interface ActiveAlarmStatus {
  severity: 'critical' | 'warning' | 'normal';
  message: string | null;
  isSilenced: boolean;
  silenceRemainingSec: number;
  isPulseMuted: boolean;
  activeProfile: SoundProfile;
}

export class AudioSynthesizer {
  private static audioCtx: AudioContext | null = null;
  private static soundProfile: SoundProfile = 'mindray';
  private static isGloballyMuted = true; // Muted by default until login
  private static isPulseMuted = false;
  private static isAlarmsMuted = false;
  private static silenceRemainingSec = 0;
  private static lastAlarmTriggerTimestamp = -Infinity;
  private static lastPriority: AlarmPriority | 'normal' = 'normal';
  private static alarmProfile: AlarmProfile = 'iec';
  private static isAlarmPreview = false;

  public static setAuthenticated(auth: boolean) {
    this.isGloballyMuted = !auth;
    if (!auth) {
      this.stopAlarmPlayback();
    }
  }

  public static getIsAuthenticated() {
    return !this.isGloballyMuted;
  }

  public static stopAlarmPreview() {
    if (this.isAlarmPreview) this.stopAlarmPlayback();
  }
  private static alarmVoices = new Set<{ osc: OscillatorNode; gain: GainNode }>();

  public static getAlarmProfile() { return this.alarmProfile; }
  public static setAlarmProfile(profile: AlarmProfile) {
    this.stopAlarmPlayback();
    this.alarmProfile = profile;
  }

  public static stopAlarmPlayback() {
    this.isAlarmPreview = false;
    for (const { osc, gain } of this.alarmVoices) {
      gain.disconnect();
      try { osc.stop(); } catch { /* Already ended. */ }
      osc.disconnect();
    }
    this.alarmVoices.clear();
    this.lastAlarmTriggerTimestamp = -Infinity;
    this.lastPriority = 'normal';
  }
  private static masterVolume = 0.85;
  private static pulseVolume = 0.65;
  private static alarmVolume = 0.80;
  private static isChargingPlaying = false;

  public static getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // PROFILE & VOLUME CONTROLS
  // ---------------------------------------------------------------------------

  public static setSoundProfile(profile: SoundProfile) {
    this.soundProfile = profile;
  }

  public static getSoundProfile(): SoundProfile {
    return this.soundProfile;
  }

  public static setPulseMuted(muted: boolean) {
    this.isPulseMuted = muted;
  }

  public static getIsPulseMuted(): boolean {
    return this.isPulseMuted;
  }

  public static setMuted(muted: boolean) {
    this.isPulseMuted = muted;
  }

  public static getIsMuted(): boolean {
    return this.isPulseMuted;
  }

  public static toggleAlarmsSilence(durationSec: number = 120): boolean {
    if (this.silenceRemainingSec > 0) {
      this.silenceRemainingSec = 0;
      this.stopAlarmPlayback();
      return false; // unpaused
    } else {
      this.stopAlarmPlayback();
      this.silenceRemainingSec = durationSec;
      return true; // paused
    }
  }

  public static getAlarmSilenceRemainingSec(): number {
    return Math.ceil(this.silenceRemainingSec);
  }

  public static setMasterVolume(vol: number) {
    this.stopAlarmPlayback();
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  public static getMasterVolume(): number {
    return this.masterVolume;
  }

  public static setPulseVolume(vol: number) {
    this.pulseVolume = Math.max(0, Math.min(1, vol));
  }

  public static getPulseVolume(): number {
    return this.pulseVolume;
  }

  public static setAlarmVolume(vol: number) {
    this.stopAlarmPlayback();
    this.alarmVolume = Math.max(0, Math.min(1, vol));
  }

  public static getAlarmVolume(): number {
    return this.alarmVolume;
  }

  // ---------------------------------------------------------------------------
  // FREQUENCY MAPPING: REAL CLINICAL SPO2 SCALE
  // ---------------------------------------------------------------------------
  public static getSpo2Frequency(spo2Pct: number): number {
    const clamped = Math.max(50, Math.min(100, spo2Pct));
    if (clamped >= 99) return 980.0;
    if (clamped >= 97) return 920.0;
    if (clamped >= 94) return 860.0;
    if (clamped >= 91) return 800.0;
    if (clamped >= 88) return 730.0;
    if (clamped >= 85) return 660.0;
    if (clamped >= 82) return 590.0;
    if (clamped >= 78) return 520.0;
    if (clamped >= 74) return 460.0;
    if (clamped >= 68) return 400.0;
    if (clamped >= 60) return 350.0;
    return 300.0;
  }

  // ---------------------------------------------------------------------------
  // 1. O AUTÊNTICO BIP DE PULSO CIRÚRGICO (QRS / SpO2)
  // ---------------------------------------------------------------------------
  /**
   * Produces the genuine electronic piezo beep of operating room monitors:
   * Short 50ms duration, instant digital onset, bandpass aperture resonance.
   */
  public static playPulseBeep(spo2Pct: number, isPvc: boolean = false) {
    if (this.isGloballyMuted || this.isPulseMuted || this.masterVolume <= 0 || this.pulseVolume <= 0) return;

    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      let freq = this.getSpo2Frequency(spo2Pct);

      if (isPvc) {
        freq *= 0.76; // lower pitch for ectopic ventricular beat
      }

      const duration = isPvc ? 0.042 : 0.050; // 50ms authentic machine beep
      const amplitude = 0.17 * this.pulseVolume * this.masterVolume;

      this.synthesizeBuzzerBeep(ctx, freq, now, duration, amplitude, this.soundProfile);
    } catch {
      // Audio catch
    }
  }

  public static playHighPriorityAlarm() { return this.playAlarm('critical'); }
  public static playMediumPriorityAlarm() { return this.playAlarm('warning'); }

  /** Legacy API: arrest uses the high-priority alarm, not a continuous flatline. */
  public static playContinuousAsystoleTone(_durationSec: number = 2.2) {
    return this.playHighPriorityAlarm();
  }

  private static playAlarm(priority: AlarmPriority, preview = true): boolean {
    if (this.isAlarmsMuted || this.silenceRemainingSec > 0 ||
        this.masterVolume <= 0 || this.alarmVolume <= 0) return false;
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return false;
    this.stopAlarmPlayback();
    this.isAlarmPreview = preview;
    const pattern = getAlarmPattern(this.alarmProfile, priority);
    const now = ctx.currentTime;
    try {
      for (const offset of pattern.offsets) {
        const start = now + offset;
        pattern.harmonics.forEach((weight, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const voice = { osc, gain };
          this.alarmVoices.add(voice);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(pattern.frequency * (index + 1), start);
          const amplitude = pattern.amplitude * weight * this.masterVolume * this.alarmVolume;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(amplitude, start + pattern.attack);
          gain.gain.setValueAtTime(amplitude, start + pattern.duration - pattern.release);
          gain.gain.linearRampToValueAtTime(0, start + pattern.duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
            this.alarmVoices.delete(voice);
          };
          osc.start(start);
          osc.stop(start + pattern.duration + 0.005);
        });
      }
      return true;
    } catch {
      this.stopAlarmPlayback();
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. MOTOR DE SÍNTESE ACÚSTICA DO BUZZER PIEZOELÉTRICO DO MONITOR
  // ---------------------------------------------------------------------------
  /**
   * Physically simulates the acoustic transfer function of a ceramic piezo disc
   * inside a plastic patient monitor enclosure.
   */
  private static synthesizeBuzzerBeep(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    amplitude: number,
    profile: SoundProfile
  ) {
    // Primary square wave oscillator (the digital PWM drive of the monitor's MCU)
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const bandpass = ctx.createBiquadFilter();
    const chassisResonance = ctx.createBiquadFilter();

    if (profile === 'dixtal_contec' || profile === 'contec_cms') {
      // Contec / Dixtal fast mode: Sharp digital square wave
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      bandpass.type = 'lowpass';
      bandpass.frequency.setValueAtTime(3200, startTime);

      osc.connect(bandpass);
      bandpass.connect(gainNode);
    } else if (profile === 'philips_gold' || profile === 'philips') {
      // Philips: Dual harmonic wave
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 2.0, startTime);

      bandpass.type = 'lowpass';
      bandpass.frequency.setValueAtTime(2600, startTime);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(amplitude * 0.25, startTime);

      osc.connect(bandpass);
      subOsc.connect(subGain);
      bandpass.connect(gainNode);
      subGain.connect(gainNode);

      subOsc.start(startTime);
      subOsc.stop(startTime + duration + 0.02);
    } else {
      // Mindray Standard (Default / Global Veterinary Standard):
      // Square wave with chassis acoustic bandpass resonance around 2850 Hz
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      // Aperture acoustic bandpass
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(freq, startTime);
      bandpass.Q.setValueAtTime(1.6, startTime);

      // Ceramic piezo disc Helmholtz resonance peak at 2850 Hz
      chassisResonance.type = 'peaking';
      chassisResonance.frequency.setValueAtTime(2850, startTime);
      chassisResonance.Q.setValueAtTime(2.5, startTime);
      chassisResonance.gain.setValueAtTime(7.0, startTime);

      osc.connect(bandpass);
      bandpass.connect(chassisResonance);
      chassisResonance.connect(gainNode);
    }

    // Instant digital attack (1.5ms) without speaker DC click
    // Flat electronic buzzer sustain
    // Fast 5ms release
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(amplitude, startTime + 0.0015);
    gainNode.gain.setValueAtTime(amplitude, startTime + duration - 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  // ---------------------------------------------------------------------------
  // 6. DESFIBRILADOR (Carga & Disparo Realista)
  // ---------------------------------------------------------------------------
  public static playDefibrillatorCharging() {
    if (this.masterVolume <= 0) return;

    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== 'running') return;

      this.isChargingPlaying = true;
      const now = ctx.currentTime;
      const duration = 1.4;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(1650, now + duration);

      const effectiveGain = this.masterVolume * 0.08;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(effectiveGain, now + 0.04);
      gain.gain.setValueAtTime(effectiveGain, now + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);

      setTimeout(() => {
        if (!this.isChargingPlaying) return;
        this.playDefibrillatorReadyChime();
      }, 1420);
    } catch {
      // catch
    }
  }

  private static playDefibrillatorReadyChime() {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const chimeFreq = 1450;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(chimeFreq, now);

      gain.gain.setValueAtTime(0.08 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // catch
    }
  }

  public static playDefibrillatorShock() {
    this.isChargingPlaying = false;
    if (this.masterVolume <= 0) return;

    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;

      // 1. Relay contact mechanical snap (sharp transient click)
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(1200, now);
      clickGain.gain.setValueAtTime(0.22 * this.masterVolume, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.03);

      // 2. Heavy thoracic low-frequency discharge thump
      const thumpOsc = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thumpOsc.type = 'sawtooth';
      thumpOsc.frequency.setValueAtTime(140, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

      thumpGain.gain.setValueAtTime(0.35 * this.masterVolume, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      thumpOsc.connect(thumpGain);
      thumpGain.connect(ctx.destination);

      thumpOsc.start(now);
      thumpOsc.stop(now + 0.40);
    } catch {
      // catch
    }
  }

  // ---------------------------------------------------------------------------
  // 7. MONITOR ALARM EVALUATION & CADENCE SCHEDULER
  // ---------------------------------------------------------------------------
  public static evaluateAndTriggerAlarms(
    vitals: VitalSigns,
    alarmLimits: MonitorAlarmLimits,
    dtSeconds: number
  ): ActiveAlarmStatus {
    // 1. Decrement silence timer
    if (this.silenceRemainingSec > 0) {
      this.silenceRemainingSec = Math.max(0, this.silenceRemainingSec - dtSeconds);
    }

    if (vitals.isDead) {
      this.stopAlarmPlayback();
      return {
        severity: 'normal',
        message: null,
        isSilenced: this.silenceRemainingSec > 0,
        silenceRemainingSec: Math.ceil(this.silenceRemainingSec),
        isPulseMuted: this.isPulseMuted,
        activeProfile: this.soundProfile,
      };
    }

    // 2. Check HIGH-PRIORITY Conditions
    let isCritical = false;
    let criticalMessage: string | null = null;

    if (vitals.isCardiacArrest) {
      isCritical = true;
      if (vitals.cardiacRhythm === 'asystole') {
        criticalMessage = 'ASSISTOLIA (PCR)';
      } else if (vitals.cardiacRhythm === 'ventricular_fibrillation') {
        criticalMessage = 'FIBRILAÇÃO VENTRICULAR (CHOCÁVEL)';
      } else {
        criticalMessage = 'PARADA CARDIORRESPIRATÓRIA (PCR)';
      }
    } else if (vitals.impendingArrestWarning) {
      isCritical = true;
      criticalMessage = `COLAPSO IMINENTE (~${vitals.impendingArrestWarning.secondsRemainingEstimate}s)`;
    } else if (vitals.isRespiratoryArrest) {
      isCritical = true;
      criticalMessage = 'APNEIA / PARADA RESPIRATÓRIA';
    } else if (vitals.pulseOximetrySpO2 > 0 && vitals.pulseOximetrySpO2 < 85) {
      isCritical = true;
      criticalMessage = `DESATURAÇÃO CRÍTICA (SpO2 ${vitals.pulseOximetrySpO2.toFixed(0)}%)`;
    } else if (vitals.heartRate > 0 && vitals.heartRate < 35) {
      isCritical = true;
      criticalMessage = `BRADICARDIA SEVERA (${vitals.heartRate.toFixed(0)} bpm)`;
    } else if (vitals.heartRate > 205) {
      isCritical = true;
      criticalMessage = `TAQUICARDIA EXTREMA (${vitals.heartRate.toFixed(0)} bpm)`;
    } else if (vitals.meanArterialPressure > 0 && vitals.meanArterialPressure < 45) {
      isCritical = true;
      criticalMessage = `HIPOTENSÃO CRÍTICA (PAM ${vitals.meanArterialPressure.toFixed(0)} mmHg)`;
    }

    // 3. Check MEDIUM-PRIORITY Conditions
    let isWarning = false;
    let warningMessage: string | null = null;

    if (!isCritical) {
      if (vitals.pulseOximetrySpO2 > 0 && vitals.pulseOximetrySpO2 < alarmLimits.spo2Low) {
        isWarning = true;
        warningMessage = `HIPÓXIA (SpO2 ${vitals.pulseOximetrySpO2.toFixed(0)}%)`;
      } else if (vitals.heartRate < alarmLimits.hrLow) {
        isWarning = true;
        warningMessage = `BRADICARDIA (${vitals.heartRate.toFixed(0)} bpm)`;
      } else if (vitals.heartRate > alarmLimits.hrHigh) {
        isWarning = true;
        warningMessage = `TAQUICARDIA (${vitals.heartRate.toFixed(0)} bpm)`;
      } else if (vitals.meanArterialPressure < alarmLimits.mapLow) {
        isWarning = true;
        warningMessage = `HIPOTENSÃO (PAM ${vitals.meanArterialPressure.toFixed(0)} mmHg)`;
      } else if (vitals.meanArterialPressure > alarmLimits.mapHigh) {
        isWarning = true;
        warningMessage = `HIPERTENSÃO (PAM ${vitals.meanArterialPressure.toFixed(0)} mmHg)`;
      } else if (vitals.etCO2 < alarmLimits.etco2Low) {
        isWarning = true;
        warningMessage = `HIPOCAPNIA (EtCO2 ${vitals.etCO2.toFixed(0)} mmHg)`;
      } else if (vitals.etCO2 > alarmLimits.etco2High) {
        isWarning = true;
        warningMessage = `HIPERCAPNIA (EtCO2 ${vitals.etCO2.toFixed(0)} mmHg)`;
      } else if (vitals.bodyTemperatureC < alarmLimits.tempLow) {
        isWarning = true;
        warningMessage = `HIPOTERMIA (${vitals.bodyTemperatureC.toFixed(1)} °C)`;
      } else if (vitals.bodyTemperatureC > alarmLimits.tempHigh) {
        isWarning = true;
        warningMessage = `HIPERTERMIA (${vitals.bodyTemperatureC.toFixed(1)} °C)`;
      }
    }

    // 4. Auditory Scheduling
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isSilenced = this.silenceRemainingSec > 0;

    const priority = isCritical ? 'critical' : isWarning ? 'warning' : 'normal';
    if (priority === 'normal' || isSilenced) {
      if (!this.isAlarmPreview || isSilenced) this.stopAlarmPlayback();
    } else {
      const interval = getAlarmPattern(this.alarmProfile, priority).repeatSeconds * 1000;
      // Real clock: simulation speed must not accelerate audible cadence.
      if (priority !== this.lastPriority || nowMs - this.lastAlarmTriggerTimestamp >= interval) {
        if (this.playAlarm(priority, false)) {
          this.lastAlarmTriggerTimestamp = nowMs;
          this.lastPriority = priority;
        }
      }
    }

    return {
      severity: isCritical ? 'critical' : isWarning ? 'warning' : 'normal',
      message: isCritical ? criticalMessage : isWarning ? warningMessage : null,
      isSilenced,
      silenceRemainingSec: Math.ceil(this.silenceRemainingSec),
      isPulseMuted: this.isPulseMuted,
      activeProfile: this.soundProfile,
    };
  }
}

// Global browser unlock on first interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    AudioSynthesizer.getContext();
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}
