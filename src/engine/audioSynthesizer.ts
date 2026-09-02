/**
 * Web Audio API based sound generator for realistic veterinary monitor beeps,
 * SpO2 pitch-modulated pulses, and medical alarms (IEC 60601-1-8 standard).
 */
export class AudioSynthesizer {
  private static audioCtx: AudioContext | null = null;
  private static isMuted = false;

  private static getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public static setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public static getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Plays a SpO2-pitch-modulated pulse beep.
   * Real medical monitors modulate pitch from ~900Hz (at 100% SpO2) down to ~220Hz (at 70% SpO2).
   */
  public static playPulseBeep(spo2Pct: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Formula mapping 70% - 100% SpO2 to 240Hz - 880Hz
      const clampedSpo2 = Math.max(70, Math.min(100, spo2Pct));
      const freq = 220 + Math.pow((clampedSpo2 - 70) / 30, 1.4) * 660;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy catch
    }
  }

  /**
   * Plays High-Priority Medical Alarm (IEC 60601-1-8 standard pattern)
   */
  public static playHighPriorityAlarm() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 659.25, 783.99]; // C5, E5, G5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.1);
      });
    } catch {
      // Audio autoplay policy catch
    }
  }

  /**
   * Plays Defibrillator Discharge sound effect
   */
  public static playDefibrillatorShock() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio catch
    }
  }
}
