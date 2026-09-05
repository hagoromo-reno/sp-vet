import React, { useState } from 'react';
import { ActiveSurgicalProcedure, SurgicalProcedureDefinition, VitalSigns, PatientProfile } from '../../types/simulator';
import { SURGICAL_PROCEDURES } from '../../data/surgicalProcedures';
import { Eye, Hand, Stethoscope, Sparkles, CheckCircle2, AlertTriangle, Scissors, Square } from 'lucide-react';

interface PatientPhysicalExamProps {
  patient: PatientProfile;
  vitals: VitalSigns;
  onStartSurgicalProcedure: (procedure: SurgicalProcedureDefinition) => void;
  onStopSurgicalProcedure: () => void;
  activeSurgicalProcedure: ActiveSurgicalProcedure | null;
}

export const PatientPhysicalExam: React.FC<PatientPhysicalExamProps> = ({
  patient,
  vitals,
  onStartSurgicalProcedure,
  onStopSurgicalProcedure,
  activeSurgicalProcedure,
}) => {
  const [activeTestMessage, setActiveTestMessage] = useState<string | null>(null);

  const testJawTone = () => {
    setActiveTestMessage(`Tônus Mandibular: ${vitals.jawTone.toUpperCase()} - ${
      vitals.jawTone === 'rigid' ? 'Mandíbula rígida (Plano muito superficial / Acordado)' :
      vitals.jawTone === 'moderate' ? 'Tônus moderado (Início de plano anestésico)' :
      vitals.jawTone === 'relaxed_surgical' ? 'Mandíbula perfeitamente relaxada (Plano Cirúrgico ideal)' :
      'Mandíbula completamente flácida (Plano profundo / depressão acentuada)'
    }`);
  };

  const testPalpebral = () => {
    setActiveTestMessage(`Reflexo Palpebral: ${vitals.palpebralReflex.toUpperCase()} - ${
      vitals.palpebralReflex === 'brisk' ? 'Piscamento enérgico ao toque no canto medial/lateral dos olhos.' :
      vitals.palpebralReflex === 'moderate' ? 'Piscamento leve a moderado presente.' :
      vitals.palpebralReflex === 'sluggish' ? 'Piscamento lento e fraco (Plano III-1).' :
      'Reflexo totalmente ausente (Plano Cirúrgico adequado atingido).'
    }`);
  };

  const testPedal = () => {
    setActiveTestMessage(`Reflexo Podal (Pinçamento Interdigital): ${vitals.pedalReflex.toUpperCase()} - ${
      vitals.pedalReflex === 'brisk' ? 'Retirada rápida e vigorosa do membro com dor presente.' :
      vitals.pedalReflex === 'moderate' ? 'Retirada lenta do membro.' :
      'Ausente - Nocicepção bloqueada ou profundidade hipnótica suficiente.'
    }`);
  };

  const testCRT = () => {
    setActiveTestMessage(`Tempo de Preenchimento Capilar (TRC): ${vitals.capillaryRefillTime} | Cor da Mucosa: ${vitals.mucousMembraneColor.toUpperCase()}`);
  };

  const testAuscultation = () => {
    const rhythmDesc = vitals.cardiacRhythm.replace(/_/g, ' ');
    const lungDesc = vitals.respiratoryRate === 0 ? 'Silêncio respiratório (Apneia)' :
      vitals.respiratoryRate > 35 ? 'Taquipneia com murmúrio vesicular aumentado' :
      'Murmúrio vesicular bilateral límpido, sem estertores';

    setActiveTestMessage(`Auscultação Torácica: Bulhas cardíacas com ${rhythmDesc} (${Math.round(vitals.heartRate)} bpm) | Campos pulmonares: ${lungDesc}`);
  };

  return (
    <div className="bg-[#0d0d0d] border border-[#222222] rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-2xl">
      {/* Patient Header & Scenario Info */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1f1f1f]">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-[#f5f5f5] flex items-center gap-1.5">
              <span>{patient.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ASA {patient.asa}
              </span>
            </h3>
            <span className="text-xs text-[#888888]">
              {patient.breed} · {patient.weightKg} kg · {patient.ageYears}a {patient.ageMonths}m
            </span>
          </div>
          <p className="text-xs text-[#888888] mt-0.5 truncate max-w-lg">
            Cirurgia: <strong className="text-[#e5e5e5]">{patient.surgicalProcedure}</strong>
          </p>
        </div>

        {activeSurgicalProcedure && (
          <button
            onClick={onStopSurgicalProcedure}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-950/60"
          >
            <Square className="w-3.5 h-3.5" />
            Encerrar {activeSurgicalProcedure.name}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-rose-900/50 bg-rose-950/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-rose-400" />
            <div>
              <div className="text-xs font-bold text-rose-200">Procedimentos cirúrgicos graduados</div>
              <div className="text-[10px] text-[#888888]">Cada tecido aplica intensidade e duração nociceptiva próprias.</div>
            </div>
          </div>
          {activeSurgicalProcedure && (
            <span className="rounded border border-rose-500/50 bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-200">
              {Math.round(activeSurgicalProcedure.intensity * 100)}% · {activeSurgicalProcedure.tissueLayer}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {SURGICAL_PROCEDURES.map((procedure) => {
            const selected = activeSurgicalProcedure?.id === procedure.id;
            return (
              <button
                key={procedure.id}
                onClick={() => onStartSurgicalProcedure(procedure)}
                className={`rounded-lg border p-2 text-left transition ${selected
                  ? 'border-rose-500 bg-rose-900/40 text-white'
                  : 'border-[#2a2a2a] bg-[#141414] text-[#d4d4d4] hover:border-rose-700/70 hover:bg-[#1a1416]'}`}
                title={procedure.description}
              >
                <span className="flex items-center gap-1 text-[10px] font-bold">
                  <Sparkles className="h-3 w-3 text-rose-400" /> {procedure.name}
                </span>
                <span className="mt-1 block text-[9px] text-[#888888]">
                  {Math.round(procedure.intensity * 100)}% · {procedure.durationSeconds}s
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Physical Exam Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Eye Position & Pupil */}
        <div
          onClick={testPalpebral}
          className="p-3 bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#2e2e2e] rounded-lg cursor-pointer transition flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-xs text-[#888888] mb-1">
            <span className="flex items-center gap-1 font-semibold text-[#d4d4d4]">
              <Eye className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition" />
              Globo Ocular
            </span>
            <span className="text-[10px] text-cyan-400">Clique</span>
          </div>
          <div className="text-xs font-bold text-[#f5f5f5] truncate">
            {vitals.eyePosition === 'ventromedial_surgical' ? 'Rotacionado Ventromedial (Plano 2)' :
             vitals.eyePosition === 'central_deep_dilated' ? 'Central com Midríase (Profundo)' :
             'Central com Pupila Normal (Superficial)'}
          </div>
          <div className="text-[10px] text-[#888888] mt-1">
            Palpebral: <strong className="text-[#f5f5f5]">{vitals.palpebralReflex}</strong>
          </div>
        </div>

        {/* Jaw Tone Mandibular */}
        <div
          onClick={testJawTone}
          className="p-3 bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#2e2e2e] rounded-lg cursor-pointer transition flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-xs text-[#888888] mb-1">
            <span className="flex items-center gap-1 font-semibold text-[#d4d4d4]">
              <Hand className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition" />
              Tônus Mandibular
            </span>
            <span className="text-[10px] text-emerald-400">Clique</span>
          </div>
          <div className="text-xs font-bold text-emerald-300 truncate">
            {vitals.jawTone.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div className="text-[10px] text-[#888888] mt-1">
            Resistência: <strong className="text-[#f5f5f5]">{vitals.jawTone === 'relaxed_surgical' ? 'Relaxada (Ideal)' : vitals.jawTone}</strong>
          </div>
        </div>

        {/* Mucous Membrane & CRT */}
        <div
          onClick={testCRT}
          className="p-3 bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#2e2e2e] rounded-lg cursor-pointer transition flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-xs text-[#888888] mb-1">
            <span className="flex items-center gap-1 font-semibold text-[#d4d4d4]">
              <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition" />
              Mucosa / TRC
            </span>
            <span className="text-[10px] text-pink-400">Clique</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#f5f5f5]">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                vitals.mucousMembraneColor === 'pink' ? 'bg-pink-400' :
                vitals.mucousMembraneColor === 'pale' ? 'bg-slate-300 border border-slate-400' :
                vitals.mucousMembraneColor === 'cyanotic' ? 'bg-blue-600' :
                vitals.mucousMembraneColor === 'brick_red' ? 'bg-red-600' : 'bg-yellow-400'
              }`}
            ></span>
            <span className="capitalize">{vitals.mucousMembraneColor.replace(/_/g, ' ')}</span>
          </div>
          <div className="text-[10px] text-[#888888] mt-1">
            TRC: <strong className="text-[#f5f5f5]">{vitals.capillaryRefillTime}</strong>
          </div>
        </div>

        {/* Auscultation & Thoracic Exam */}
        <div
          onClick={testAuscultation}
          className="p-3 bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#2e2e2e] rounded-lg cursor-pointer transition flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-xs text-[#888888] mb-1">
            <span className="flex items-center gap-1 font-semibold text-[#d4d4d4]">
              <Stethoscope className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition" />
              Auscultação
            </span>
            <span className="text-[10px] text-indigo-400">Clique</span>
          </div>
          <div className="text-xs font-bold text-indigo-300 truncate">
            {Math.round(vitals.heartRate)} bpm · {Math.round(vitals.respiratoryRate)} rpm
          </div>
          <div className="text-[10px] text-[#888888] mt-1">
            Pedal: <strong className="text-[#f5f5f5]">{vitals.pedalReflex}</strong>
          </div>
        </div>
      </div>

      {/* Dynamic Physical Exam Feedback Banner */}
      {activeTestMessage && (
        <div className="p-2.5 rounded-lg bg-[#141414] border border-[#2c2c2c] text-xs text-[#e5e5e5] flex items-start space-x-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-mono-code">{activeTestMessage}</div>
          <button
            onClick={() => setActiveTestMessage(null)}
            className="text-[10px] text-[#737373] hover:text-[#d4d4d4] underline"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
};
