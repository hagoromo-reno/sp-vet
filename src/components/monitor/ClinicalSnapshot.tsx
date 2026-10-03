import React from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { MonitorAlarmLimits, VitalSigns } from '../../types/simulator';
import { PatientSedationAvatar } from '../patient/PatientSedationFacies';

/** Keeps the patient's live readings in view while operating a workstation. */
export function ClinicalSnapshot({ vitals, limits, paused }: { vitals: VitalSigns; limits: MonitorAlarmLimits; paused: boolean }) {
  const readings = [
    { label: 'FC', value: vitals.isDead || vitals.cardiacRhythm === 'asystole' ? 0 : Math.round(vitals.heartRate), unit: 'bpm', alarm: vitals.heartRate < limits.hrLow || vitals.heartRate > limits.hrHigh },
    { label: 'SpO₂', value: vitals.isDead ? 0 : Math.round(vitals.pulseOximetrySpO2), unit: '%', alarm: vitals.pulseOximetrySpO2 < limits.spo2Low },
    { label: 'EtCO₂', value: vitals.isDead ? 0 : Math.round(vitals.etCO2), unit: 'mmHg', alarm: vitals.etCO2 < limits.etco2Low || vitals.etCO2 > limits.etco2High },
    { label: 'Temp.', value: vitals.bodyTemperatureC.toFixed(1), unit: '°C', alarm: vitals.bodyTemperatureC < limits.tempLow || vitals.bodyTemperatureC > limits.tempHigh },
  ];
  const critical = vitals.isDead ? 'Óbito' : vitals.isCardiacArrest ? 'Parada cardíaca' : vitals.impendingArrestWarning ? 'Risco de colapso' : vitals.isRespiratoryArrest ? 'Apneia' : null;
  return <div className="clinical-snapshot" aria-label="Resumo dos sinais vitais">
    <div className="flex items-center gap-2">
      <PatientSedationAvatar vitals={vitals} size="sm" showLabel={false} />
      <a href="#monitor"><Activity size={16} /><span>{paused ? 'Monitor · pausado' : 'Monitor ao vivo'}</span></a>
    </div>
    <div className="snapshot-readings">
      {readings.map(reading => <span key={reading.label} className={reading.alarm ? 'snapshot-alarm' : ''}>
        <span>{reading.label}</span><strong>{reading.value}</strong><small>{reading.unit}</small>
        {reading.alarm && <AlertTriangle size={12} aria-label="Fora dos limites de alarme" />}
      </span>)}
    </div>
    {critical && <strong className="snapshot-critical" role="status">{critical}</strong>}
  </div>;
}
