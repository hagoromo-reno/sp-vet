import React, { useState } from 'react';
import type { AnesthesiaEquipmentState, PatientProfile, VitalSigns } from '../../types/simulator';
import { FLUID_SOLUTIONS, fluidSolution } from '../../engine/fluidTherapy';

interface Props {
  equipment: AnesthesiaEquipmentState;
  patient: PatientProfile;
  vitals?: VitalSigns;
  onUpdateEquipment: (updates: Partial<AnesthesiaEquipmentState>) => void;
  onGiveFluidBolus: (volumeMl: number, fluidName: string, durationSec: number) => void;
}
export function FluidInfusionControls({ equipment, patient, vitals, onUpdateEquipment, onGiveFluidBolus }: Props) {
  const [bolusMlKg, setBolusMlKg] = useState(patient.species === 'feline' ? 5 : 10);
  const [minutes, setMinutes] = useState(15);
  const solution = fluidSolution(equipment.activeFluidType);
  const f = vitals?.biologicalState.fluids;
  const running = equipment.fluidBoluses ?? [];
  const specialSolution = ['hypertonic', 'colloid', 'blood', 'dextrose'].includes(solution.kind);
  const validBolus = Number.isFinite(bolusMlKg) && bolusMlKg > 0 && bolusMlKg <= 100 && Number.isFinite(minutes) && minutes >= 1 && minutes <= 120;
  return <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-zinc-100">Bomba e desafios volêmicos</h4>
      <button className="ui-button" aria-pressed={equipment.isFluidPumpRunning} onClick={() => onUpdateEquipment({ isFluidPumpRunning: !equipment.isFluidPumpRunning })}>{equipment.isFluidPumpRunning ? 'Pausar bomba' : 'Iniciar bomba'}</button>
    </div>
    <label className="block text-zinc-300">Solução da bomba e do próximo bólus
      <select className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 p-2" value={equipment.activeFluidType} onChange={event => onUpdateEquipment({ activeFluidType: event.target.value })}>
        {FLUID_SOLUTIONS.map(fluid => <option key={fluid.name}>{fluid.name}</option>)}
      </select>
    </label>
    <p className="text-zinc-400">Na⁺ {solution.sodium} · Cl⁻ {solution.chloride} mmol/L · glicose {solution.glucoseMgMl / 10}%{solution.kind === 'blood' ? ' · Ht do doador: 40%' : ''}</p>
    <div className="grid grid-cols-2 gap-3">
      <label>Taxa (mL/kg/h)<input aria-label="Taxa em mL por kg por hora" className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 p-2" type="number" min="0" max="100" step="0.1" value={Number((equipment.fluidRateMlPerHour / patient.weightKg).toFixed(2))} onChange={e => onUpdateEquipment({ fluidRateMlPerHour: Math.min(100, Math.max(0, Number(e.target.value) || 0)) * patient.weightKg })} /></label>
      <label>Temperatura do fluido (°C)<input className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 p-2" type="number" min="4" max="40" value={equipment.fluidTemperatureC ?? 22} onChange={e => onUpdateEquipment({ fluidTemperatureC: Math.min(40, Math.max(4, Number(e.target.value) || 22)) })} /></label>
    </div>
    <p className="text-cyan-300">Bomba: {equipment.fluidRateMlPerHour.toFixed(1)} mL/h · total efetivamente entrando: {(f?.currentDeliveryMlPerHour ?? 0).toFixed(1)} mL/h</p>
    {!specialSolution && <div className="flex flex-wrap gap-2">
      <button className="ui-button" onClick={() => onUpdateEquipment({ fluidRateMlPerHour: patient.weightKg * 2.5, isFluidPumpRunning: true })}>Manutenção · 2,5 mL/kg/h</button>
      <button className="ui-button" onClick={() => onUpdateEquipment({ fluidRateMlPerHour: patient.weightKg * (patient.species === 'feline' ? 3 : 5), isFluidPumpRunning: true })}>Anestesia · {patient.species === 'feline' ? 3 : 5} mL/kg/h</button>
    </div>}
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <h4 className="font-semibold">Bólus com tempo definido</h4>
      <div className="grid grid-cols-2 gap-3">
        <label>Volume (mL/kg)<input className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 p-2" type="number" min="0.1" max="100" step="0.5" value={bolusMlKg} onChange={e => setBolusMlKg(Number(e.target.value))} /></label>
        <label>Duração (min)<input className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 p-2" type="number" min="1" max="120" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>
      </div>
      <p className="text-zinc-400">{(bolusMlKg * patient.weightKg).toFixed(1)} mL em {minutes} min{validBolus ? ` · ${(bolusMlKg * 60 / minutes).toFixed(1)} mL/kg/h` : ''}. A entrega soma-se à bomba e pode ser interrompida.</p>
      {specialSolution && <p className="text-amber-300">Revise o volume para esta composição. Hipertônica, coloide, sangue e glicose não usam o mesmo regime dos cristaloides balanceados. Glicose em água não é fluido de ressuscitação.</p>}
      <button className="ui-button" disabled={!validBolus} onClick={() => onGiveFluidBolus(bolusMlKg * patient.weightKg, equipment.activeFluidType, minutes * 60)}>Iniciar bólus</button>
      {running.filter(bolus => bolus.deliveredMl < bolus.volumeMl - 1e-8).map(bolus => <div key={bolus.id} className="space-y-2 rounded border border-zinc-700 p-3">
        <p>{bolus.fluidName} · {bolus.isRunning ? 'Em curso' : 'Interrompido'}</p>
        <progress className="h-2 w-full accent-cyan-400" max={bolus.volumeMl} value={bolus.deliveredMl} aria-label={`Progresso do bólus de ${bolus.fluidName}`} />
        <div className="flex items-center justify-between gap-2"><span>{bolus.deliveredMl.toFixed(1)} / {bolus.volumeMl.toFixed(1)} mL</span><button className="ui-button" onClick={() => onUpdateEquipment({ fluidBoluses: running.map(item => item.id === bolus.id ? { ...item, isRunning: !item.isRunning } : item) })}>{bolus.isRunning ? 'Interromper' : 'Retomar'} bólus</button></div>
      </div>)}
    </div>
    {f && <details className="rounded border border-zinc-700 p-3" open>
      <summary className="font-semibold text-cyan-200">Balanço e repercussões no paciente</summary>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-zinc-300">
        {[
          ['Expansão circulante', `${f.effectiveCirculatingExpansionMl.toFixed(0)} mL`], ['Fluido intersticial adicional', `${(f.interstitialMl ?? 0).toFixed(0)} mL`],
          ['Eliminação do volume infundido', `${(f.eliminatedMl ?? 0).toFixed(0)} mL`], ['Depuração hídrica estimada', `${(f.renalOutputMlKgHour ?? 0).toFixed(2)} mL/kg/h`],
          ['Hematócrito', `${f.currentHematocritPct.toFixed(1)}%`], ['Glicemia', `${vitals.arterialBloodGases.glucoseMgDl.toFixed(0)} mg/dL`],
          ['Na⁺ / Cl⁻ estimados', `${(f.sodiumMmolL ?? 145).toFixed(1)} / ${(f.chlorideMmolL ?? 110).toFixed(1)} mmol/L`], ['pH / Lactato', `${vitals.arterialBloodGases.pH.toFixed(2)} / ${vitals.arterialBloodGases.lactate.toFixed(1)} mmol/L`],
        ].map(([label, value]) => <div key={label}><dt className="text-zinc-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
      </dl>
      <p className="mt-3 text-zinc-400">Índices estimados: congestão {((f.congestionSeverity ?? 0) * 100).toFixed(0)}% · edema pulmonar {((f.pulmonaryEdemaSeverity ?? 0) * 100).toFixed(0)}%. Depuração hídrica refere-se ao volume adicional infundido, não à diurese basal.</p>
      {(f.pulmonaryEdemaSeverity ?? 0) > 0.15 && <p className="mt-2 text-rose-300" role="status">Sobrecarga com repercussão pulmonar. Reavalie volume, taxa e tolerância do paciente.</p>}
    </details>}
  </div>;
}
