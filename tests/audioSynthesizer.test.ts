import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHealthyValidationPatient, createSimulationState } from '../src/validation/simulationHarness';
import { AudioSynthesizer } from '../src/engine/audioSynthesizer';
import { VitalSigns, MonitorAlarmLimits } from '../src/types/simulator';

function createMockVitals(overrides: Partial<VitalSigns> = {}): VitalSigns {
  return {
    ...createSimulationState(createHealthyValidationPatient('canine')).vitals,
    ...overrides,
  };
}

const defaultLimits: MonitorAlarmLimits = {
  hrLow: 50,
  hrHigh: 160,
  mapLow: 60,
  mapHigh: 120,
  spo2Low: 94,
  etco2Low: 30,
  etco2High: 50,
  tempLow: 36.5,
  tempHigh: 39.5,
  isAudioMuted: false,
};

describe('Sons do Monitor & Alarmes Médicos IEC 60601-1-8', () => {
  it('parâmetros normais resultam em alarme desligado (normal)', () => {
    const vitals = createMockVitals();
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    assert.equal(status.severity, 'normal');
    assert.equal(status.message, null);
  });

  it('hipóxia severa (SpO2 < 85%) dispara alarme de Alta Prioridade (crítico)', () => {
    const vitals = createMockVitals({ pulseOximetrySpO2: 82 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    assert.equal(status.severity, 'critical');
    assert.ok(status.message?.includes('DESATURAÇÃO CRÍTICA'));
  });

  it('parada cardíaca ativa (PCR) dispara alarme de Alta Prioridade imediato', () => {
    const vitals = createMockVitals({
      isCardiacArrest: true,
      cardiacRhythm: 'ventricular_fibrillation',
    });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    assert.equal(status.severity, 'critical');
    assert.ok(status.message?.includes('FIBRILAÇÃO VENTRICULAR'));
  });

  it('parada respiratória (apneia) dispara alarme de Alta Prioridade', () => {
    const vitals = createMockVitals({ isRespiratoryArrest: true });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    assert.equal(status.severity, 'critical');
    assert.ok(status.message?.includes('APNEIA'));
  });

  it('taquicardia fora dos limites (FC > hrHigh) dispara alarme de Média Prioridade (warning)', () => {
    const vitals = createMockVitals({ heartRate: 185 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    assert.equal(status.severity, 'warning');
    assert.ok(status.message?.includes('TAQUICARDIA'));
  });

  it('hipotensão fora dos limites (PAM < mapLow) dispara alarme de Média Prioridade', () => {
    const vitals = createMockVitals({ meanArterialPressure: 52 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    assert.equal(status.severity, 'warning');
    assert.ok(status.message?.includes('HIPOTENSÃO'));
  });

  it('pausar alarme por 120s silencia os apitos e decrementa tempo restante', () => {
    // Ativa pausa de 120s
    const paused = AudioSynthesizer.toggleAlarmsSilence(120);
    assert.equal(paused, true);
    assert.equal(AudioSynthesizer.getAlarmSilenceRemainingSec(), 120);

    const vitals = createMockVitals({ heartRate: 190 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 2.0);
    assert.equal(status.isSilenced, true);
    assert.equal(status.silenceRemainingSec, 118);

    // Cancelar pausa (clicar novamente)
    const unpaused = AudioSynthesizer.toggleAlarmsSilence();
    assert.equal(unpaused, false);
    assert.equal(AudioSynthesizer.getAlarmSilenceRemainingSec(), 0);
  });

  it('suporta alternância de perfis acústicos (Mindray & Dixtal, Contec CMS, Philips)', () => {
    AudioSynthesizer.setSoundProfile('mindray_dixtal');
    assert.equal(AudioSynthesizer.getSoundProfile(), 'mindray_dixtal');

    AudioSynthesizer.setSoundProfile('contec_cms');
    assert.equal(AudioSynthesizer.getSoundProfile(), 'contec_cms');

    AudioSynthesizer.setSoundProfile('philips_gold');
    assert.equal(AudioSynthesizer.getSoundProfile(), 'philips_gold');
  });

  it('escala de frequências SpO2 decresce com a hipóxia', () => {
    const freq100 = AudioSynthesizer.getSpo2Frequency(100);
    const freq95 = AudioSynthesizer.getSpo2Frequency(95);
    const freq90 = AudioSynthesizer.getSpo2Frequency(90);
    const freq85 = AudioSynthesizer.getSpo2Frequency(85);
    const freq70 = AudioSynthesizer.getSpo2Frequency(70);

    assert.equal(freq100, 980.0);
    assert.ok(freq95 < freq100);
    assert.ok(freq90 < freq95);
    assert.ok(freq85 < freq90);
    assert.ok(freq70 < freq85);
  });

  it('métodos de áudio executam com segurança e sem erros em ambiente headless', () => {
    assert.doesNotThrow(() => {
      ['mindray_dixtal', 'contec_cms', 'philips_gold', 'philips', 'mindray', 'midi_bell'].forEach((profile) => {
        AudioSynthesizer.setSoundProfile(profile as any);
        AudioSynthesizer.playPulseBeep(98);
        AudioSynthesizer.playPulseBeep(85, true);
        AudioSynthesizer.playPulseBeep(65);
        AudioSynthesizer.playHighPriorityAlarm();
        AudioSynthesizer.playMediumPriorityAlarm();
        AudioSynthesizer.playContinuousAsystoleTone(0.5);
      });
      AudioSynthesizer.playDefibrillatorCharging();
      AudioSynthesizer.playDefibrillatorShock();
    });
  });
});

// Exercise scheduling and cancellation with actual Web Audio API-shaped nodes.
import { getAlarmPattern } from '../src/engine/alarmPatterns';

describe('Cadência e execução dos alertas', () => {
  it('separa grupos críticos por 2 s e reserva intervalo sem sobreposição', () => {
    for (const priority of ['critical', 'warning'] as const) {
      const pattern = getAlarmPattern('iec', priority);
      assert.equal(pattern.offsets.length, priority === 'critical' ? 10 : 3);
      assert.ok(pattern.offsets.at(-1)! + pattern.duration < pattern.repeatSeconds);
      assert.ok(pattern.attack + pattern.release < pattern.duration);
    }
    const high = getAlarmPattern('iec', 'critical');
    assert.ok(Math.abs(high.offsets[5] - high.offsets[4] - high.duration - 2) < 1e-9);
    assert.equal(getAlarmPattern('traditional', 'critical').repeatSeconds, 1);
    assert.equal(getAlarmPattern('traditional', 'warning').repeatSeconds, 2);
    assert.ok(getAlarmPattern('traditional', 'critical').frequency > getAlarmPattern('traditional', 'warning').frequency);
  });

  it('agenda harmônicos, prioriza PCR, cancela sons futuros e preserva perfil de pulso', () => {
    const oscillators: any[] = [];
    const gains: any[] = [];
    const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {} });
    const ctx = {
      state: 'running', currentTime: 10, destination: {},
      createOscillator() {
        const osc = { type: '', frequency: parameter(), starts: [] as number[], stops: [] as (number | undefined)[],
          connect() {}, disconnect() {}, onended: null,
          start(time: number) { this.starts.push(time); }, stop(time?: number) { this.stops.push(time); } };
        oscillators.push(osc); return osc;
      },
      createGain() {
        const gain = { gain: parameter(), disconnected: false, connect() {}, disconnect() { this.disconnected = true; } };
        gains.push(gain); return gain;
      },
    };
    const original = AudioSynthesizer.getContext;
    AudioSynthesizer.getContext = () => ctx as unknown as AudioContext;
    try {
      AudioSynthesizer.stopAlarmPlayback();
      AudioSynthesizer.setSoundProfile('contec_cms');
      AudioSynthesizer.setAlarmProfile('iec');
      assert.equal(AudioSynthesizer.getSoundProfile(), 'contec_cms');
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ heartRate: 185 }), defaultLimits, 0.1);
      assert.equal(oscillators.length, 12);
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ heartRate: 185 }), defaultLimits, 5);
      assert.equal(oscillators.length, 12, 'simulated time does not accelerate cadence');
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ isCardiacArrest: true, cardiacRhythm: 'asystole' }), defaultLimits, 0.1);
      assert.equal(oscillators.length, 52, 'critical immediately replaces warning with ten pulses');
      assert.ok(gains.slice(0, 12).every(g => g.disconnected));
      assert.equal(oscillators.at(-1).starts[0], 14.45);
      AudioSynthesizer.toggleAlarmsSilence();
      assert.ok(gains.every(g => g.disconnected));
      assert.ok(oscillators.every(o => o.stops.includes(undefined)), 'future oscillators cancelled too');
      AudioSynthesizer.playHighPriorityAlarm();
      assert.equal(oscillators.length, 52, 'silence also blocks previews');
      AudioSynthesizer.toggleAlarmsSilence();
      AudioSynthesizer.playHighPriorityAlarm();
      AudioSynthesizer.stopAlarmPreview();
      assert.ok(gains.every(g => g.disconnected));
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ heartRate: 185 }), defaultLimits, 0.1);
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals(), defaultLimits, 0.1);
      assert.ok(gains.every(g => g.disconnected), 'normal values cancel active warning');
    } finally {
      AudioSynthesizer.stopAlarmPlayback();
      AudioSynthesizer.getContext = original;
      AudioSynthesizer.setSoundProfile('mindray');
    }
  });
});
