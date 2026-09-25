/** Land on record boundaries even after changing speed off the 0.5-second grid. */
export function nextSimulationStep(timeSeconds: number, speed: number) {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0 || ![1, 2, 5].includes(speed)) throw new Error('Relógio ou velocidade inválidos.');
  const ticks = Math.round(timeSeconds * 10);
  const nextBoundary = (Math.floor(ticks / 300) + 1) * 300;
  const next = Math.min(ticks + speed, nextBoundary);
  return { dt: (next - ticks) / 10, newSimTime: next / 10 };
}
