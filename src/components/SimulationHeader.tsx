import React from 'react';
import { Bell, Brain, ChevronRight, Dna, FolderHeart, HeartPulse, Pause, Play, RotateCcw, ScrollText } from 'lucide-react';
import { PatientProfile } from '../types/simulator';
import { formatSpecies } from '../utils/formatters';

interface SimulationHeaderProps {
  patient: PatientProfile;
  paused: boolean;
  speed: number;
  time: string;
  consciousness: number;
  eventCount: number;
  occurrenceCount: number;
  onPause: () => void;
  onSpeed: (speed: number) => void;
  onReset: () => void;
  onPatient: () => void;
  onBiophysics: () => void;
  onConsciousness: () => void;
  onEvents: () => void;
  onOccurrences: () => void;
  onEmergency: () => void;
}

export function SimulationHeader(props: SimulationHeaderProps) {
  return <>
    <a className="skip-link" href="#interventions">Ir para intervenções</a>
    <header className="app-header">
      <div className="app-header-inner">
        <a href="#monitor" className="app-brand" aria-label="SimPet — ir para monitor">
          <span className="brand-mark"><HeartPulse size={23} /></span>
          <span><strong>SimPet</strong><small>Anestesia e cuidados críticos</small></span>
        </a>
        <div className="simulation-controls" aria-label="Controles da simulação">
          <div className="simulation-clock"><span>{props.paused ? 'Pausada' : 'Em simulação'}</span><strong>{props.time}</strong></div>
          <button className="ui-button" onClick={props.onPause} aria-label={props.paused ? 'Retomar simulação' : 'Pausar simulação'}>
            {props.paused ? <Play size={16} /> : <Pause size={16} />}<span>{props.paused ? 'Retomar' : 'Pausar'}</span>
          </button>
          <div className="speed-control" role="group" aria-label="Velocidade da simulação">
            {[1, 2, 5].map(speed => <button key={speed} aria-pressed={props.speed === speed} onClick={() => props.onSpeed(speed)} aria-label={`Velocidade ${speed}x`}>{speed}×</button>)}
          </div>
          <button className="ui-button reset-button" onClick={props.onReset} title="Reiniciar o caso desde o início"><RotateCcw size={15} /><span>Reiniciar</span></button>
        </div>
        <button className="ui-button emergency-button" onClick={props.onEmergency}><HeartPulse size={17} />Emergência</button>
      </div>
    </header>
    <div className="patient-context">
      <button className="patient-selector" onClick={props.onPatient} title="Trocar paciente ou cenário clínico">
        <FolderHeart size={23} /><span><small>Paciente atual</small><strong>{props.patient.name} <span>· {formatSpecies(props.patient.species)} · {props.patient.weightKg} kg · ASA {props.patient.asa}</span></strong></span><ChevronRight size={17} />
      </button>
      <nav className="context-tools" aria-label="Consultas do caso">
        <button onClick={props.onConsciousness}><Brain size={16} />Consciência <span className="quiet-badge">{props.consciousness}%</span></button>
        <button onClick={props.onBiophysics}><Dna size={16} />Biofísica</button>
        <button onClick={props.onEvents}><ScrollText size={16} />Eventos <span className="quiet-badge">{props.eventCount}</span></button>
        <button onClick={props.onOccurrences}><Bell size={16} />Ocorrências <span className="quiet-badge">{props.occurrenceCount}</span></button>
      </nav>
    </div>
  </>;
}

export const WORKSTATIONS = [
  { id: 'drugs', label: 'Medicamentos', description: 'Busque um medicamento, ajuste a dose e revise a administração.' },
  { id: 'machine_airway', label: 'Anestesia e ventilação', description: 'Ajuste o aparelho de anestesia, a via aérea e o suporte ventilatório.' },
  { id: 'physical_exam', label: 'Exame físico', description: 'Avalie reflexos, realize testes e acompanhe os estímulos cirúrgicos.' },
  { id: 'fluids_thermal', label: 'Fluidos e temperatura', description: 'Controle a reposição de fluidos e o aquecimento do paciente.' },
  { id: 'emergency_cpr', label: 'Emergência', description: 'Acesse as intervenções de ressuscitação e os fármacos de emergência.' },
  { id: 'records', label: 'Ficha anestésica', description: 'Consulte a evolução dos sinais vitais e os registros do caso.' },
] as const;

export type WorkstationId = typeof WORKSTATIONS[number]['id'];
