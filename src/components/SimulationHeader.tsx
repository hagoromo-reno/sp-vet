import React from 'react';
import {
  Bell,
  Brain,
  ChevronRight,
  Dna,
  FolderHeart,
  HeartPulse,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Shield,
  FileText,
  LogOut,
  User,
} from 'lucide-react';
import { PatientProfile } from '../types/simulator';
import { formatSpecies } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

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
  onAdminPanel?: () => void;
  onSavePerspective?: () => void;
}

export function SimulationHeader(props: SimulationHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <>
      <a className="skip-link" href="#interventions">
        Ir para intervenções
      </a>
      <header className="app-header">
        <div className="app-header-inner flex items-center justify-between">
          <a href="#monitor" className="app-brand" aria-label="SP-VET — ir para monitor">
            <span className="brand-mark">
              <HeartPulse size={23} />
            </span>
            <span>
              <strong>SP-VET</strong>
              <small>Anestesia e cuidados críticos</small>
            </span>
          </a>

          <div className="simulation-controls" aria-label="Controles da simulação">
            <div className="simulation-clock">
              <span>{props.paused ? 'Pausada' : 'Em simulação'}</span>
              <strong>{props.time}</strong>
            </div>
            <button
              className="ui-button cursor-pointer"
              onClick={props.onPause}
              aria-label={props.paused ? 'Retomar simulação' : 'Pausar simulação'}
            >
              {props.paused ? <Play size={16} /> : <Pause size={16} />}
              <span>{props.paused ? 'Retomar' : 'Pausar'}</span>
            </button>
            <div className="speed-control" role="group" aria-label="Velocidade da simulação">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  aria-pressed={props.speed === speed}
                  onClick={() => props.onSpeed(speed)}
                  aria-label={`Velocidade ${speed}x`}
                  className="cursor-pointer"
                >
                  {speed}×
                </button>
              ))}
            </div>
            <button
              className="ui-button reset-button cursor-pointer"
              onClick={props.onReset}
              title="Reiniciar o caso desde o início"
            >
              <RotateCcw size={15} />
              <span>Reiniciar</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="ui-button emergency-button cursor-pointer"
              onClick={props.onEmergency}
            >
              <HeartPulse size={17} />
              Emergência
            </button>

            {/* User Session & Status Badge */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-700/60">
                {user.role === 'admin' && props.onAdminPanel && (
                  <button
                    onClick={props.onAdminPanel}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition cursor-pointer"
                    title="Abrir Painel de Gestão e Assinaturas (Admin)"
                  >
                    <Shield size={14} />
                    <span>Admin</span>
                  </button>
                )}

                <div className="hidden lg:flex flex-col text-right leading-tight">
                  <span className="text-xs font-bold text-white truncate max-w-[130px]">{user.name}</span>
                  <span className={`text-[10px] font-mono ${
                    user.subscription_status === 'active' ? 'text-emerald-400' : 'text-cyan-400'
                  }`}>
                    {user.subscription_status === 'active' ? '● Assinatura Ativa' : '● Free Trial'}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border border-zinc-700/60 transition cursor-pointer"
                  title="Encerrar sessão"
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="patient-context">
        <button
          className="patient-selector cursor-pointer"
          onClick={props.onPatient}
          title="Trocar paciente ou cenário clínico"
        >
          <FolderHeart size={23} />
          <span>
            <small>Paciente atual</small>
            <strong>
              {props.patient.name}{' '}
              <span>
                · {formatSpecies(props.patient.species)} · {props.patient.weightKg} kg · ASA{' '}
                {props.patient.asa}
              </span>
            </strong>
          </span>
          <ChevronRight size={17} />
        </button>

        <nav className="context-tools flex items-center gap-1.5" aria-label="Consultas do caso">
          {props.onSavePerspective && (
            <button
              onClick={props.onSavePerspective}
              className="bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 cursor-pointer font-bold"
              title="Salvar conduta anestésica e reflexões clínicas no banco de dados"
            >
              <FileText size={16} />
              Gravar Parecer
            </button>
          )}
          <button onClick={props.onConsciousness} className="cursor-pointer">
            <Brain size={16} />
            Consciência <span className="quiet-badge">{props.consciousness}%</span>
          </button>
          <button onClick={props.onBiophysics} className="cursor-pointer">
            <Dna size={16} />
            Biofísica
          </button>
          <button onClick={props.onEvents} className="cursor-pointer">
            <ScrollText size={16} />
            Eventos <span className="quiet-badge">{props.eventCount}</span>
          </button>
          <button onClick={props.onOccurrences} className="cursor-pointer">
            <Bell size={16} />
            Ocorrências <span className="quiet-badge">{props.occurrenceCount}</span>
          </button>
        </nav>
      </div>
    </>
  );
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

