/** Educational reconstructions. Cadence references and tuning limits: docs/audio-monitor.md. */
export type AlarmProfile = 'iec' | 'traditional';
export type AlarmPriority = 'critical' | 'warning';

export function getAlarmPattern(profile: AlarmProfile, priority: AlarmPriority) {
  const high = priority === 'critical';
  const traditional = profile === 'traditional';
  return {
    // Traditional red/yellow intervals follow Philips PIC iX, chapter 6.
    repeatSeconds: traditional ? (high ? 1 : 2) : (high ? 8 : 10),
    offsets: traditional ? [0] : high
      ? [0, 0.25, 0.5, 0.9, 1.15, 3.3, 3.55, 3.8, 4.2, 4.45]
      : [0, 0.45, 0.9],
    duration: traditional ? (high ? 0.22 : 0.3) : (high ? 0.15 : 0.25),
    frequency: traditional ? (high ? 880 : 440) : (high ? 528 : 440),
    // A voiced alarm speaker, distinct from the short QRS buzzer. Sum = 1.
    harmonics: [0.42, 0.28, 0.18, 0.12],
    attack: 0.012,
    release: 0.025,
    amplitude: high ? 0.24 : 0.17,
  };
}
