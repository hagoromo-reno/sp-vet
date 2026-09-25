import type { AnesthesiaEquipmentState, PatientProfile } from '../types/simulator';

/** Educational heat balance. Keep full precision between steps; round only on the monitor. */
export function stepThermalBalance(dt: number, patient: PatientProfile, equipment: AnesthesiaEquipmentState,
  previousC: number, suppression: number, deliveredFluidMl: number): number {
  if (!Number.isFinite(dt) || dt < 0) throw new Error('Passo térmico inválido.');
  const loss = patient.weightKg < 2 ? 0.0011 : patient.weightKg < 8 ? 0.0005 : 0.0002;
  let temperature = previousC - loss * suppression * dt;
  // A warming blanket cannot instantaneously clamp a febrile animal to 38.8 C.
  // Heat input is limited by both its setting and the patient's baseline target.
  const target = Math.min(equipment.warmingBlanketTempC, patient.baselineVitals.tempC);
  if (equipment.warmingBlanketActive && temperature < target) temperature = Math.min(target, temperature + 0.0007 * dt);
  const fluidTemperature = equipment.fluidTemperatureC ?? 22;
  return temperature + (fluidTemperature - temperature)
    * (1 - Math.exp(-Math.max(0, deliveredFluidMl) / Math.max(1, patient.weightKg * 830)));
}
