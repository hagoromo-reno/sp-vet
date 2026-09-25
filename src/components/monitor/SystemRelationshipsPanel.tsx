import React from 'react';
import type { PatientProfile, VitalSigns } from '../../types/simulator';
import { formatSpecies } from '../../utils/formatters';
import { getCompensationStatus, getPatientReserveCapacity } from '../../engine/patientReserve';

const systemNames: Record<string, string> = {
  farmacologia: 'Medicamentos', neurologico: 'Sistema nervoso', autonomico: 'Sistema autônomo',
  cardiovascular: 'Circulação', respiratorio: 'Respiração', metabolico: 'Metabolismo',
  hepatico: 'Fígado', renal: 'Rins', celular: 'Tecidos',
};

export function SystemRelationshipsPanel({ patient, vitals }: { patient: PatientProfile; vitals: VitalSigns }) {
  const biology = vitals.biologicalState;
  const drivers = vitals.cellularState.hemodynamicDrivers;
  const signedBpm = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} bpm`;
  const signals = [...(vitals.activePhysiologicalSignals ?? [])].sort((a, b) => b.severity - a.severity);
  const relationships = [
    { title: 'Fluidos → circulação, pulmões e metabolismo', value: `Expansão ${biology.fluids.effectiveCirculatingExpansionMl.toFixed(0)} mL · congestão ${((biology.fluids.congestionSeverity ?? 0) * 100).toFixed(0)}% · Na⁺ ${(biology.fluids.sodiumMmolL ?? 145).toFixed(1)} mmol/L`, detail: 'Composição e velocidade determinam a expansão transitória, redistribuição, hemodiluição, carga de glicose e cloreto. Excesso e baixa tolerância podem causar congestão e edema.' },
    { title: 'Antimuscarínicos → cognição, vísceras e rins', value: `Motilidade ${((biology.visceral?.gutMotilityFraction ?? 1) * 100).toFixed(0)}% · secreções ${((biology.visceral?.secretionsFraction ?? 1) * 100).toFixed(0)}% · retenção vesical ${(biology.visceral?.urinaryRetentionMl ?? 0).toFixed(1)} mL`, detail: 'O butilbrometo age predominantemente na periferia; o bromidrato também bloqueia M1 central. Bloqueio M2 altera FC, M3 reduz motilidade e esvaziamento vesical; associações podem amplificar os efeitos.' },
    { title: 'Medicamentos → consciência e respiração', value: `${Math.round(vitals.consciousnessScore)}% de consciência · FR ${vitals.respiratoryRate}/min`, detail: 'Sedação, hipnose, analgesia e paralisia são efeitos distintos. A associação de depressores pode reduzir a ventilação.' },
    { title: 'Pulmões + circulação → oxigênio nos tecidos', value: `SpO₂ ${vitals.pulseOximetrySpO2.toFixed(0)}% · oferta de O₂ ${biology.organPerfusion.oxygenDeliveryMlKgMin.toFixed(1)} mL/kg/min`, detail: 'A oferta depende da oxigenação, do hematócrito e do débito cardíaco. Saturação normal pode coexistir com baixa oferta.' },
    { title: 'Perfusão → fígado e rins → eliminação', value: `Perfusão hepática ${(biology.organPerfusion.hepaticFraction * 100).toFixed(0)}% · renal ${(biology.organPerfusion.renalFraction * 100).toFixed(0)}% da referência`, detail: 'Hipoperfusão e redução de capacidade orgânica alteram a depuração dos medicamentos e a recuperação metabólica.' },
    { title: 'Ventilação + metabolismo → equilíbrio ácido-base', value: `PaCO₂ ${vitals.arterialBloodGases.paCO2.toFixed(0)} mmHg · pH ${vitals.arterialBloodGases.pH.toFixed(2)} · lactato ${vitals.arterialBloodGases.lactate.toFixed(1)} mmol/L`, detail: 'Retenção de CO₂ e acúmulo de lactato reduzem o pH; acidemia pode comprometer contratilidade e estabilidade elétrica.' },
  ];

  return (
    <section className="rounded-xl border border-cyan-900/60 bg-cyan-950/10 p-4 space-y-3" aria-label="Relações entre sistemas">
      <div>
        <h3 className="font-bold text-sm text-cyan-200">Relações entre sistemas · {formatSpecies(patient.species)}</h3>
        <p className="text-xs text-zinc-400 mt-1">Acompanhe como os efeitos se propagam neste paciente. Índices internos são estimativas do simulador.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2 rounded-lg border border-amber-900/60 p-3 bg-amber-950/10">
          <h4 className="font-semibold text-amber-200">{getCompensationStatus(patient, biology)}</h4>
          <p className="text-zinc-300 mt-1">Reserva disponível: {(biology.systemicRegulation.compensatoryReserve * 100).toFixed(0)}% · capacidade basal deste paciente: {(getPatientReserveCapacity(patient) * 100).toFixed(0)}% · dívida de O₂: {(biology.organPerfusion.cumulativeOxygenDebt * 100).toFixed(0)}%</p>
          <p className="text-zinc-400 mt-1">Pressão recuperada não garante fluxo adequado. A reserva e a função dos órgãos podem levar mais tempo para se recuperar.</p>
        </div>
        {relationships.map(item => (
          <div key={item.title} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
            <h4 className="text-xs font-semibold text-zinc-200">{item.title}</h4>
            <p className="text-xs text-cyan-300 tabular-nums">{item.value}</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>
      {drivers && <details className="rounded-lg border border-zinc-700 p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-cyan-200">Entender a FC e a pressão deste paciente</summary>
        <p className="mt-3 text-zinc-400">A pressão resulta do débito cardíaco e da resistência vascular. Os valores abaixo explicam o cálculo atual; a FC do monitor acompanha o alvo gradualmente. Durante PCR, prevalece o estado de reanimação.</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-zinc-300">
          {[
            ['Pré-carga efetiva', `${(drivers.preloadRatio * 100).toFixed(0)}% da referência`],
            ['Resistência vascular', `${(drivers.vascularResistanceRatio * 100).toFixed(0)}% da referência`],
            ['Contratilidade', `${(drivers.contractilityRatio * 100).toFixed(0)}% da referência`],
            ['Débito cardíaco', `${vitals.cellularState.cardiacOutputLMin.toFixed(2)} L/min`],
            ['Ação no nó sinusal', signedBpm(drivers.nodalDeltaBpm)],
            ['Reflexo da pressão', signedBpm(drivers.baroreflexDeltaBpm)],
            ['Respostas sistêmicas', signedBpm(drivers.systemicDeltaBpm)],
            ['Dor, oscilação respiratória e ajustes', signedBpm(drivers.otherDeltaBpm)],
          ].map(([label,value]) => <div key={label}><dt className="text-zinc-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
        </dl>
        <p className="mt-3 text-zinc-400">FC basal {patient.baselineVitals.hr} + contribuições = alvo {drivers.targetHeartRate.toFixed(1)} bpm. Estimativas do modelo; não são medições independentes.</p>
      </details>}
      <h4 className="font-semibold text-zinc-200">Respostas ativas no paciente</h4>
      {signals.length === 0 ? <p className="text-zinc-400">Sem respostas adicionais de interação ou compensação neste momento. As relações basais continuam ativas.</p> : (
        <ul className="space-y-2">
          {signals.map(signal => (
            <li key={signal.id} className={`rounded-lg border p-3 ${signal.severity >= 0.65 ? 'border-rose-800/60 bg-rose-950/20' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <p className="font-medium text-zinc-200">{signal.label}</p>
              <p className="mt-1 text-zinc-400">{systemNames[signal.source] ?? signal.source} → {signal.targets.map(target => systemNames[target] ?? target).join(' · ')}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
