import React, { useState } from 'react';
import {
  ActiveNociceptiveTest,
  ActiveSurgicalProcedure,
  AnatomicalRegion,
  CardiacRhythm,
  CapillaryRefillTime,
  EyePosition,
  JawTone,
  MucousMembraneColor,
  NociceptiveTestDefinition,
  ReflexStrength,
  PatientProfile,
  SurgicalProcedureDefinition,
  VitalSigns,
} from '../../types/simulator';
import { SURGICAL_PROCEDURES } from '../../data/surgicalProcedures';
import { NOCICEPTIVE_TESTS } from '../../data/nociceptiveTests';
import { PatientSedationPanel } from './PatientSedationFacies';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flame,
  Hand,
  Heart,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  Zap,
} from 'lucide-react';

interface PatientPhysicalExamProps {
  patient: PatientProfile;
  vitals: VitalSigns;
  onStartSurgicalProcedure: (procedure: SurgicalProcedureDefinition) => void;
  onStopSurgicalProcedure: () => void;
  activeSurgicalProcedure: ActiveSurgicalProcedure | null;
  activeNociceptiveTest?: ActiveNociceptiveTest | null;
  onStartNociceptiveTest?: (test: NociceptiveTestDefinition) => void;
  onStopNociceptiveTest?: () => void;
  simTimeSeconds?: number;
  onOpenConsciousnessBoard?: () => void;
}

// ---------------------------------------------------------------------------
// Clinical Portuguese Formatters for Visual Exam Parameters
// ---------------------------------------------------------------------------

function formatEyePosition(position: EyePosition): { title: string; subtitle: string; color: string } {
  switch (position) {
    case 'ventromedial_surgical':
      return {
        title: 'Rotacionado Ventromedial',
        subtitle: 'Plano Cirúrgico (Estágio III - Plano 2)',
        color: 'text-emerald-400',
      };
    case 'central_deep_dilated':
      return {
        title: 'Central com Midríase',
        subtitle: 'Plano Muito Profundo / Risco (Estágio III-3 ou IV)',
        color: 'text-rose-400',
      };
    case 'central_light':
      return {
        title: 'Central com Pupila Normal',
        subtitle: 'Plano Superficial / Sedação Leve (Estágio I ou III-1)',
        color: 'text-amber-300',
      };
    default:
      return {
        title: 'Central',
        subtitle: 'Fase de transição',
        color: 'text-zinc-300',
      };
  }
}

function formatPalpebralReflex(reflex: ReflexStrength): { label: string; desc: string } {
  switch (reflex) {
    case 'brisk':
      return { label: 'Enérgico / Presente', desc: 'Piscamento imediato e vigoroso ao toque medial/lateral.' };
    case 'moderate':
      return { label: 'Moderado', desc: 'Piscamento leve a moderado presente (sedação inicial).' };
    case 'sluggish':
      return { label: 'Lento / Fraco', desc: 'Piscamento fraco e tardio (transição para plano cirúrgico).' };
    case 'absent':
      return { label: 'Ausente', desc: 'Sem reação palpebral. Interpretar com espécie, fármacos, ventilação e demais reflexos.' };
    default:
      return { label: reflex, desc: '' };
  }
}

function formatPedalReflex(reflex: ReflexStrength): { label: string; desc: string } {
  switch (reflex) {
    case 'brisk':
      return { label: 'Enérgico / Retirada Imediata', desc: 'Flexão rápida e vigorosa do membro.' };
    case 'moderate':
      return { label: 'Moderado', desc: 'Retirada lenta do membro sob compressão interdigital.' };
    case 'sluggish':
      return { label: 'Lento / Muito Fraco', desc: 'Movimento mínimo ou incompleto de flexão.' };
    case 'absent':
      return { label: 'Ausente / Bloqueado', desc: 'Sem flexão motora (plano profundo, analgesia regional ou NMBA).' };
    default:
      return { label: reflex, desc: '' };
  }
}

function formatJawTone(tone: JawTone): { label: string; desc: string; color: string } {
  switch (tone) {
    case 'rigid':
      return { label: 'Rígida', desc: 'Mandíbula fechada com forte resistência (acordado / superficial).', color: 'text-rose-400' };
    case 'moderate':
      return { label: 'Moderada', desc: 'Resistência moderada à abertura (início de plano anestésico).', color: 'text-amber-300' };
    case 'relaxed_surgical':
      return { label: 'Relaxada (Ideal)', desc: 'Relaxamento muscular ideal para intubação e cirurgia.', color: 'text-emerald-400' };
    case 'flaccid':
      return { label: 'Flácida', desc: 'Sem qualquer tônus (plano muito profundo ou bloqueador NMBA).', color: 'text-purple-300' };
    default:
      return { label: tone, desc: '', color: 'text-zinc-300' };
  }
}

function formatMucousMembraneColor(color: MucousMembraneColor): { label: string; dotClass: string; textClass: string; desc: string } {
  switch (color) {
    case 'pink':
      return { label: 'Róseas', dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]', textClass: 'text-emerald-300', desc: 'Perfusão e oxigenação teciduais adequadas.' };
    case 'pale':
      return { label: 'Pálidas', dotClass: 'bg-rose-300 shadow-[0_0_8px_#fda4af]', textClass: 'text-rose-200', desc: 'Vasoconstrição periférica intensa, hipovolemia ou anemia.' };
    case 'cyanotic':
      return { label: 'Cianóticas', dotClass: 'bg-blue-500 shadow-[0_0_8px_#3b82f6]', textClass: 'text-blue-300 font-bold', desc: 'Hipoxemia crítica com dessaturação de hemoglobina (PaO₂ < 60 mmHg).' };
    case 'brick_red':
      return { label: 'Congestas / Hiperêmicas', dotClass: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]', textClass: 'text-amber-300', desc: 'Vasodilatação tóxica, sepse ou hipercapnia aguda.' };
    case 'icteric':
      return { label: 'Ictéricas', dotClass: 'bg-yellow-400 shadow-[0_0_8px_#facc15]', textClass: 'text-yellow-300', desc: 'Bilirrubina plasmática elevada (doença hepato-biliar ou hemólise).' };
    case 'gray_moribund':
      return { label: 'Acinzentadas (Choque)', dotClass: 'bg-zinc-500 shadow-[0_0_8px_#71717a]', textClass: 'text-zinc-400 font-bold', desc: 'Colapso cardiovascular grave / Choque descompensado.' };
    default:
      return { label: 'Róseas', dotClass: 'bg-emerald-400', textClass: 'text-emerald-300', desc: 'Normal' };
  }
}

function formatCapillaryRefillTime(crt: CapillaryRefillTime): { label: string; desc: string } {
  switch (crt) {
    case '1 - 2s (normal)':
      return { label: '< 2 segundos (Normal)', desc: 'Perfusão microvascular satisfatória.' };
    case '2 - 3s (sluggish)':
    case '> 3s (poor perfusion)':
      return { label: '> 2 segundos (Lento)', desc: 'Tempo aumentado: vasoconstrição, desidratação ou baixo débito.' };
    case '< 1s (hyperdynamic)':
      return { label: '< 1 segundo (Hiperdinâmico)', desc: 'Retorno excessivamente rápido: sepse ou vasodilatação intensa.' };
    case 'absent':
      return { label: 'Ausente (Colapso)', desc: 'Sem retorno capilar identificável.' };
    default:
      return { label: crt, desc: '' };
  }
}

function formatCardiacRhythmPt(rhythm: CardiacRhythm): string {
  switch (rhythm) {
    case 'sinus': return 'Ritmo Sinusal Normal';
    case 'sinus_arrhythmia': return 'Arritmia Sinusal Respiratória (Fisiológica)';
    case 'sinus_bradycardia': return 'Bradicardia Sinusal';
    case 'sinus_tachycardia': return 'Taquicardia Sinusal';
    case 'ventricular_premature_complexes': return 'Complexos Ventriculares Prematuros (CPVs)';
    case 'ventricular_tachycardia': return 'Taquicardia Ventricular (TV)';
    case 'ventricular_fibrillation': return 'Fibrilação Ventricular (FV - Ritmo Chocável)';
    case 'supraventricular_tachycardia': return 'Taquicardia Supraventricular (TSV)';
    case 'atrial_flutter': return 'Flutter Atrial (Ondas F)';
    case 'atrial_fibrillation': return 'Fibrilação Atrial (AFib)';
    case 'av_block_1st_degree': return 'Bloqueio AV de 1º Grau';
    case 'av_block_2nd_degree': return 'Bloqueio AV de 2º Grau';
    case 'av_block_2nd_degree_mobitz1': return 'Bloqueio AV de 2º Grau Mobitz I (Wenckebach)';
    case 'av_block_2nd_degree_mobitz2': return 'Bloqueio AV de 2º Grau Mobitz II';
    case 'av_block_3rd_degree': return 'Bloqueio AV Total (3º Grau)';
    case 'st_depression_ischemia': return 'Isquemia Miocárdica (Infradesnível ST)';
    case 'st_elevation_injury': return 'Corrente de Lesão (Supradesnível ST)';
    case 't_wave_inversion': return 'Inversão Primária de Onda T';
    case 'hyperkalemia': return 'Hipercalemia (Ondas T Apiculadas)';
    case 'hypokalemia': return 'Hipocalemia (Achatamento T e Onda U)';
    case 'pulseless_electrical_activity': return 'Atividade Elétrica Sem Pulso (AESP)';
    case 'asystole': return 'Assistolia (Parada)';
    default: return rhythm;
  }
}

export const PatientPhysicalExam: React.FC<PatientPhysicalExamProps> = ({
  patient,
  vitals,
  onStartSurgicalProcedure,
  onStopSurgicalProcedure,
  activeSurgicalProcedure,
  activeNociceptiveTest,
  onStartNociceptiveTest,
  onStopNociceptiveTest,
  simTimeSeconds = 0,
  onOpenConsciousnessBoard,
}) => {
  const [activeTestMessage, setActiveTestMessage] = useState<string | null>(null);
  const [selectedTestLimb, setSelectedTestLimb] = useState<AnatomicalRegion>('pelvic_limb');

  // Biophysical states derived from engine
  const cellular = vitals.cellularState;
  const analgesiaProtection = cellular?.nociceptiveInhibition ?? 0;
  const dissociativeEffect = cellular?.dissociativeEffect ?? 0;
  const hypnoticDepth = cellular?.hypnoticEffect ?? 0;
  const centralSedation = cellular?.centralSedation ?? 0;
  const nmbaBlockade = cellular?.nmbaReceptorBlockade ?? 0;
  const isNmbaParalyzed = nmbaBlockade > 0.50;
  const stressLevel = vitals.nociceptiveStressLevel ?? 0;

  // Evaluate clinical pain response in real time
  const hasEffectiveAnalgesia = analgesiaProtection > 0.65;
  const hasPartialAnalgesia = analgesiaProtection > 0.25 || dissociativeEffect > 0.45;
  const isHypnotizedOrSedated = hypnoticDepth > 0.40 || centralSedation > 0.40;
  const isNociceptiveBreakthroughSurging = stressLevel > 0.15 || (vitals.heartRate > patient.baselineVitals.hr * 1.15);

  const testJawTone = () => {
    const toneInfo = formatJawTone(vitals.jawTone);
    setActiveTestMessage(`Tônus Mandibular: ${toneInfo.label.toUpperCase()} — ${toneInfo.desc}`);
  };

  const testPalpebral = () => {
    const palpebralInfo = formatPalpebralReflex(vitals.palpebralReflex);
    setActiveTestMessage(`Reflexo Palpebral: ${palpebralInfo.label.toUpperCase()} — ${palpebralInfo.desc}`);
  };

  const testPedal = (targetLimb?: AnatomicalRegion) => {
    const limb = targetLimb || selectedTestLimb;
    const isPelvicBlocked = (cellular?.regionalBlockByRegion?.pelvic_limb ?? 0) > 0.45;
    const isThoracicBlocked = (cellular?.regionalBlockByRegion?.thoracic_limb ?? 0) > 0.45;
    const isTargetBlocked = limb === 'pelvic_limb' ? isPelvicBlocked : isThoracicBlocked;
    const limbName = limb === 'pelvic_limb' ? 'Membro Pélvico (Pata Traseira)' : 'Membro Torácico (Pata Dianteira)';

    if (isNmbaParalyzed) {
      setActiveTestMessage(`Reflexo Podal (${limbName}): AUSENTE POR PARALISIA NMBA — Paciente sob bloqueador neuromuscular (atracúrio). O membro não retrai devido à paralisia da placa motora.`);
      return;
    }

    if (isTargetBlocked) {
      setActiveTestMessage(`Reflexo Podal (${limbName}): AUSENTE / BLOQUEADO 🎯 — Aferência e arco reflexo espinhal de retirada completamente abolidos pelo bloqueio neural regional ativo! Nocicepção somática local interrompida com sucesso.`);
      return;
    }

    const pedalInfo = formatPedalReflex(vitals.pedalReflex);
    setActiveTestMessage(`Reflexo Podal (${limbName}): ${pedalInfo.label.toUpperCase()} — ${pedalInfo.desc}${isPelvicBlocked && limb === 'thoracic_limb' ? ' (Nota: o membro pélvico está sob bloqueio anestésico regional).' : ''}`);
  };

  const testCRT = () => {
    const mucousInfo = formatMucousMembraneColor(vitals.mucousMembraneColor);
    const crtInfo = formatCapillaryRefillTime(vitals.capillaryRefillTime);
    setActiveTestMessage(`Mucosas: ${mucousInfo.label.toUpperCase()} (${mucousInfo.desc}) | TRC: ${crtInfo.label} (${crtInfo.desc})`);
  };

  const testAuscultation = () => {
    const baseRhythmDesc = formatCardiacRhythmPt(vitals.cardiacRhythm);
    const patientCardiacAusc = patient.clinicalAssessment?.cardiacAuscultation;
    let cardiacDetail = baseRhythmDesc;
    if (patientCardiacAusc === 'loud_murmur') {
      cardiacDetail += ' · Sopro holossistólico moderado/grave regurgitante audível (Grau III-VI/VI)';
    } else if (patientCardiacAusc === 'mild_murmur') {
      cardiacDetail += ' · Sopro sistólico suave em foco mitral/tricúspide (Grau I-II/VI)';
    } else if (patientCardiacAusc === 'gallop_rhythm') {
      cardiacDetail += ' · Ritmo de galope ventricular audível (som de B3/B4 por sobrecarga)';
    } else if (patientCardiacAusc === 'arrhythmic_irregular') {
      cardiacDetail += ' · Extrassístoles ventriculares audíveis com falhas/déficit de pulso';
    }

    let lungDesc = vitals.respiratoryRate === 0
      ? 'Silêncio respiratório completo (Apneia / Parada Respiratória)'
      : vitals.respiratoryRate > 35
      ? 'Taquipneia acentuada com esforço ventilatório'
      : vitals.respiratoryRate < 8
      ? 'Bradipneia marcante por depressão respiratória'
      : 'Murmúrio vesicular fisiológico bilateral';

    const patientRespAusc = patient.clinicalAssessment?.respiratoryAuscultation;
    if (vitals.respiratoryRate > 0) {
      if (patientRespAusc === 'moderate_crackles_wheezes') {
        lungDesc += ' com estertores crepitantes úmidos e sibilos expiratórios';
      } else if (patientRespAusc === 'mild_stridor') {
        lungDesc += ' com estridor inspiratório faríngeo/laríngeo (estenose/palato)';
      } else if (patientRespAusc === 'severe_respiratory_failure') {
        lungDesc = 'Hipoventilação crítica com estertores crepitantes difusos e padrão restritivo grave';
      } else {
        lungDesc += ' límpido bilateralmente, sem ruídos adventícios';
      }
    }

    setActiveTestMessage(`Auscultação Cardiopulmonar: ${cardiacDetail} (${Math.round(vitals.heartRate)} bpm) | Campos pulmonares: ${lungDesc} (${Math.round(vitals.respiratoryRate)} rpm).`);
  };

  const testSecondsRemaining = activeNociceptiveTest
    ? Math.max(0, Math.ceil(activeNociceptiveTest.endsAtSimTime - simTimeSeconds))
    : 0;

  return (
    <div className="bg-[#0b0b10] border border-[#222232] rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-2xl font-sans">
      {/* 1. Patient Header & Clinical Context */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e1e2d]">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold text-[#f5f5f5] tracking-tight">
                {patient.name}
              </h3>
              <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                ASA {patient.asa}
              </span>
              <span className="text-xs text-[#8e8e9f]">
                {patient.breed} · {patient.weightKg} kg · {patient.gender} · {patient.ageYears}a {patient.ageMonths}m
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-xs text-[#8e8e9f]">
                Cirurgia: <strong className="text-white">{patient.surgicalProcedure}</strong>
              </p>
              {patient.pathologyConditions.hepaticDysfunctionSeverity ? (
                <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/40">
                  Disf. Hepática: {Math.round(patient.pathologyConditions.hepaticDysfunctionSeverity * 100)}%
                </span>
              ) : null}
              {patient.pathologyConditions.renalDysfunctionSeverity ? (
                <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-800/40">
                  Disf. Renal: {Math.round(patient.pathologyConditions.renalDysfunctionSeverity * 100)}%
                </span>
              ) : null}
              {patient.labMarkers?.creatinineMgDl ? (
                <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Creat: {patient.labMarkers.creatinineMgDl} mg/dL | Alb: {patient.labMarkers.albuminGDl} g/dL
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {activeSurgicalProcedure && (
          <button
            onClick={onStopSurgicalProcedure}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-950/60 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            Encerrar {activeSurgicalProcedure.name}
          </button>
        )}
      </div>

      {/* 2. PATIENT SEDATION FACIES & VISUAL CLINICAL INSPECTION */}
      <PatientSedationPanel
        vitals={vitals}
        patient={patient}
        onOpenConsciousnessBoard={onOpenConsciousnessBoard}
      />

      {/* 3. DEDICATED NOCICEPTIVE PAIN SENSITIVITY TESTING SECTION */}
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/25 to-[#141018] p-3.5 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-amber-200 tracking-wide uppercase">
                  Testes de Sensibilidade Dolorosa & Nocicepção (Pré / Trans-Operatória)
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50 font-mono font-bold">
                  Autônomo & Somático
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Aplica estímulo nociceptivo controlado para testar se o sistema nervoso reconhece dor (alterando FC e FR) mesmo sob sedação profunda.
              </p>
            </div>
          </div>

          {activeNociceptiveTest && onStopNociceptiveTest && (
            <button
              onClick={onStopNociceptiveTest}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-700 hover:bg-rose-600 text-white border border-rose-500 shadow-md cursor-pointer animate-pulse"
              title="Soltar a pinça e interromper o estímulo doloroso imediatamente"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Soltar Pinça / Interromper ({testSecondsRemaining}s)</span>
            </button>
          )}
        </div>

        {/* Anatomical Targeting for Limb Nociceptive Tests */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
            <span>📍 Direcionamento do Teste Álgico / Reflexo:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedTestLimb('pelvic_limb')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedTestLimb === 'pelvic_limb'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <span>Pata Traseira (Membro Pélvico)</span>
              {(cellular?.regionalBlockByRegion?.pelvic_limb ?? 0) > 0.45 && (
                <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[9px] border border-emerald-600 font-bold">
                  BLOQUEADO 🛡️
                </span>
              )}
            </button>
            <button
              onClick={() => setSelectedTestLimb('thoracic_limb')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedTestLimb === 'thoracic_limb'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <span>Pata Dianteira (Membro Torácico)</span>
              {(cellular?.regionalBlockByRegion?.thoracic_limb ?? 0) > 0.45 && (
                <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[9px] border border-emerald-600 font-bold">
                  BLOQUEADO 🛡️
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 4 Standardized Pain Test Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {NOCICEPTIVE_TESTS.map((test) => {
            const isSelected = activeNociceptiveTest?.id === test.id;
            const isLimbTest = test.id === 'pinch_interdigital' || test.id === 'pressure_periosteal';
            const resolvedTarget = isLimbTest ? selectedTestLimb : test.targetRegion;
            const isTargetBlocked = (cellular?.regionalBlockByRegion?.[resolvedTarget || 'pelvic_limb'] ?? 0) > 0.45;
            return (
              <button
                key={test.id}
                onClick={() => onStartNociceptiveTest?.({
                  ...test,
                  targetRegion: resolvedTarget,
                  name: isLimbTest
                    ? `${test.name} (${resolvedTarget === 'pelvic_limb' ? 'Membro Pélvico' : 'Membro Torácico'})`
                    : test.name
                })}
                className={`rounded-xl border p-2.5 text-left transition relative cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-amber-950/70 text-white ring-2 ring-amber-400/50 shadow-lg shadow-amber-950/60'
                    : isTargetBlocked
                    ? 'border-emerald-600/50 bg-[#101814] text-[#d8e8dc] hover:border-emerald-500'
                    : 'border-[#2e2638] bg-[#16121e]/80 text-[#d8d0e0] hover:border-amber-600/70 hover:bg-[#20182a]'
                }`}
                title={test.description}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    {test.name}
                  </span>
                  <span className="text-[10px] font-mono-code font-bold px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-200 border border-amber-700/50">
                    {Math.round(test.intensity * 100)}%
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 leading-tight">
                  {isLimbTest
                    ? `Alvo: ${resolvedTarget === 'pelvic_limb' ? 'Membro Pélvico' : 'Membro Torácico'} · ${test.targetTissue}`
                    : test.targetTissue}
                </div>
                <div className="text-[9px] text-zinc-500 font-mono mt-1 flex items-center justify-between">
                  <span>Duração: {test.durationSeconds}s</span>
                  {isTargetBlocked && (
                    <span className="text-emerald-400 font-bold">🛡️ Dessensibilizado</span>
                  )}
                </div>
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Pain Sensitivity Real-Time Diagnostic Box */}
        {activeNociceptiveTest && (() => {
          const testTarget = activeNociceptiveTest.targetRegion || 'pelvic_limb';
          const isStimulusRegionBlocked = (cellular?.regionalBlockByRegion?.[testTarget] ?? 0) > 0.40;
          return (
            <div className="rounded-xl border border-amber-500/50 bg-[#120d18] p-3 space-y-2.5 animate-fadeIn font-mono-code text-xs">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                  <span className="font-bold text-amber-200 uppercase">
                    Estímulo Álgico Ativo: {activeNociceptiveTest.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900 text-amber-100 font-bold border border-amber-600">
                    Restam {testSecondsRemaining}s
                  </span>
                </div>

                {/* Analgesia Status Pill */}
                <div className="flex items-center gap-1.5">
                  {isStimulusRegionBlocked ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold text-[10px]">
                      <ShieldCheck className="w-3 h-3" /> Bloqueio Regional Efetivo (100% Protegido)
                    </span>
                  ) : hasEffectiveAnalgesia ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold text-[10px]">
                      <ShieldCheck className="w-3 h-3" /> Analgesia Eficaz (Protegido)
                    </span>
                  ) : hasPartialAnalgesia ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500 text-amber-300 font-bold text-[10px]">
                      <AlertTriangle className="w-3 h-3" /> Analgesia Parcial
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-200 font-bold text-[10px] animate-pulse">
                      <ShieldAlert className="w-3 h-3" /> FALHA ANALGÉSICA (Desprotegido)
                    </span>
                  )}
                </div>
              </div>

              {/* Detailed Triple Axis Clinical Evaluation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                {/* 1. Somatic / Motor Response */}
                <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-1">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                    <Hand className="w-3 h-3 text-cyan-400" />
                    1. Resposta Somática (Motora)
                  </div>
                  <div className="text-zinc-200 font-sans">
                    {isStimulusRegionBlocked ? (
                      <span className="text-emerald-300 font-bold">
                        Reflexo de retirada completamente abolido pelo bloqueio neural regional nesta região ({testTarget === 'pelvic_limb' ? 'Membro Pélvico' : testTarget === 'thoracic_limb' ? 'Membro Torácico' : 'Região anatômica bloqueada'}).
                      </span>
                    ) : isNmbaParalyzed ? (
                      <span className="text-amber-300 font-bold">
                        Sem reflexo de retirada por PARALISIA NMBA (Atracúrio). O animal sente dor mas não consegue mover o membro.
                      </span>
                    ) : vitals.pedalReflex === 'absent' ? (
                      <span className="text-emerald-300">
                        Membro flácido, reflexo de flexão abolido (plano cirúrgico profundo ou analgesia local plena).
                      </span>
                    ) : vitals.pedalReflex === 'sluggish' ? (
                      <span className="text-amber-300">
                        Retirada lenta e tardia do membro (plano cirúrgico superficial).
                      </span>
                    ) : (
                      <span className="text-rose-300 font-bold">
                        Retirada vigorosa e imediata do membro com tentativa de flexão e fuga!
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Autonomic / Sympathetic Response (The user's core clinical requirement) */}
                <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-1">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-400" />
                    2. Resposta Autonômica (Tronco Encefálico)
                  </div>
                  <div className="text-zinc-200 font-sans">
                    {isStimulusRegionBlocked ? (
                      <span className="text-emerald-300 font-bold">
                        BLOQUEIO NEURAL REGIONAL EFETIVO 🎯: Nocicepção interrompida na raiz nervosa. As fibras aferentes A-delta/C foram silenciadas, impedindo a resposta simpática (FC e PAM permanecem perfeitamente estáveis).
                      </span>
                    ) : hasEffectiveAnalgesia ? (
                      <span className="text-emerald-300">
                        Estabilidade autonômica excelente: FC, PAM e FR mantêm-se estáveis sob o estímulo álgico.
                      </span>
                    ) : isNociceptiveBreakthroughSurging ? (
                      <span className="text-rose-300 font-bold">
                        DISPARO SIMPÁTICO ATIVO: O tronco encefálico e a medula reconheceram o estímulo! Taquicardia (FC {Math.round(vitals.heartRate)} bpm) e hipertensão reflexas, {isHypnotizedOrSedated ? 'apesar de o animal estar sedado/hipnotizado.' : 'com paciente alerta.'}
                      </span>
                    ) : (
                      <span className="text-amber-300">
                        Discreto estresse simpático residual (analgesia parcial moderando o pico autonômico).
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Clinical Conduct Recommendation */}
                <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-1">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3 text-amber-400" />
                    3. Conduta Sugerida
                  </div>
                  <div className="text-zinc-300 font-sans">
                    {isStimulusRegionBlocked ? (
                      <span className="text-emerald-300">
                        Excelente bloqueio locorregional alcançado. Permite realização do procedimento com grande estabilidade hemodinâmica e menor exigência de anestésicos sistêmicos.
                      </span>
                    ) : hasEffectiveAnalgesia ? (
                      <span className="text-emerald-300">
                        Plano analgésico adequado para iniciar a incisão e manipulação cirúrgica com segurança.
                      </span>
                    ) : (
                      <span className="text-amber-200">
                        {isHypnotizedOrSedated
                          ? 'Paciente necessita de analgésico sistêmico (ex: Fentanil, Metadona) ou infiltração local de Lidocaína antes de iniciar a cirurgia.'
                          : 'Aprofundar a anestesia geral e instituir analgesia multimodal antes da incisão cirúrgica.'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. GRADED SURGICAL PROCEDURES */}
      <div className="rounded-xl border border-rose-900/50 bg-rose-950/15 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300">
              <Scissors className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                Procedimentos Cirúrgicos Graduados (Trans-Operatório)
              </div>
              <div className="text-[10px] text-zinc-400">
                Cada tecido aplica intensidade nociceptiva e recrutamento tecidual próprios.
              </div>
            </div>
          </div>
          {activeSurgicalProcedure && (
            <span className="rounded border border-rose-500/50 bg-rose-500/20 px-2.5 py-1 text-[10px] font-mono-code font-bold text-rose-200 shadow-sm animate-pulse">
              {Math.round(activeSurgicalProcedure.intensity * 100)}% · {activeSurgicalProcedure.tissueLayer.toUpperCase()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SURGICAL_PROCEDURES.map((procedure) => {
            const selected = activeSurgicalProcedure?.id === procedure.id;
            return (
              <button
                key={procedure.id}
                onClick={() => onStartSurgicalProcedure(procedure)}
                className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  selected
                    ? 'border-rose-500 bg-rose-900/50 text-white ring-1 ring-rose-500/60 shadow-lg shadow-rose-950/50'
                    : 'border-[#2a2228] bg-[#141014] text-[#d4d4d4] hover:border-rose-700/70 hover:bg-[#1c1216]'
                }`}
                title={procedure.description}
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-rose-200 truncate">
                  <Sparkles className="h-3 w-3 text-rose-400 shrink-0" />
                  <span>{procedure.name}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-[#90909f] font-mono-code">
                  <span>{Math.round(procedure.intensity * 100)}%</span>
                  <span>{procedure.durationSeconds}s</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. INTERACTIVE PHYSICAL EXAM & REFLEXES GRID (100% TRANSLATED TO CLINICAL PT-BR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Eye Position & Pupil */}
        <div
          onClick={testPalpebral}
          className="p-3 bg-[#111118] hover:bg-[#181822] border border-[#222230] hover:border-[#303046] rounded-xl cursor-pointer transition flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 font-bold text-[#f0f0f5]">
              <Eye className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
              Globo Ocular & Pupila
            </span>
            <span className="text-[10px] text-cyan-400 font-mono-code bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
              Testar
            </span>
          </div>
          <div className="text-xs font-bold truncate mt-1 text-cyan-300">
            {formatEyePosition(vitals.eyePosition).title}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            {formatEyePosition(vitals.eyePosition).subtitle}
          </div>
          <div className="text-[10px] text-[#8e8e9f] mt-2 pt-1.5 border-t border-[#1e1e2c] flex items-center justify-between">
            <span>Reflexo Palpebral:</span>
            <strong className="text-white font-mono">{formatPalpebralReflex(vitals.palpebralReflex).label}</strong>
          </div>
        </div>

        {/* Jaw Tone Mandibular */}
        <div
          onClick={testJawTone}
          className="p-3 bg-[#111118] hover:bg-[#181822] border border-[#222230] hover:border-[#303046] rounded-xl cursor-pointer transition flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 font-bold text-[#f0f0f5]">
              <Hand className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
              Tônus Mandibular
            </span>
            <span className="text-[10px] text-emerald-400 font-mono-code bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
              Testar
            </span>
          </div>
          <div className={`text-xs font-bold truncate mt-1 ${formatJawTone(vitals.jawTone).color}`}>
            {formatJawTone(vitals.jawTone).label}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
            {formatJawTone(vitals.jawTone).desc}
          </div>
          <div className="text-[10px] text-[#8e8e9f] mt-2 pt-1.5 border-t border-[#1e1e2c] flex items-center justify-between">
            <span>Resistência Mandibular:</span>
            <strong className="text-white font-mono">
              {vitals.jawTone === 'relaxed_surgical' ? 'Relaxada (Ideal)' : formatJawTone(vitals.jawTone).label}
            </strong>
          </div>
        </div>

        {/* Mucous Membrane & CRT */}
        <div
          onClick={testCRT}
          className="p-3 bg-[#111118] hover:bg-[#181822] border border-[#222230] hover:border-[#303046] rounded-xl cursor-pointer transition flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 font-bold text-[#f0f0f5]">
              <CheckCircle2 className="w-4 h-4 text-pink-400 group-hover:scale-110 transition" />
              Coloração de Mucosa & TRC
            </span>
            <span className="text-[10px] text-pink-400 font-mono-code bg-pink-950/60 px-1.5 py-0.2 rounded border border-pink-800/40">
              Testar
            </span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${formatMucousMembraneColor(vitals.mucousMembraneColor).dotClass}`}></span>
            <span className={`text-xs font-bold ${formatMucousMembraneColor(vitals.mucousMembraneColor).textClass}`}>
              {formatMucousMembraneColor(vitals.mucousMembraneColor).label}
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
            {formatMucousMembraneColor(vitals.mucousMembraneColor).desc}
          </div>
          <div className="text-[10px] text-[#8e8e9f] mt-2 pt-1.5 border-t border-[#1e1e2c] flex items-center justify-between">
            <span>Preenchimento Capilar (TRC):</span>
            <strong className="text-white font-mono">{formatCapillaryRefillTime(vitals.capillaryRefillTime).label}</strong>
          </div>
        </div>

        {/* Auscultation & Thoracic Exam */}
        <div
          onClick={testAuscultation}
          className="p-3 bg-[#111118] hover:bg-[#181822] border border-[#222230] hover:border-[#303046] rounded-xl cursor-pointer transition flex flex-col justify-between group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 font-bold text-[#f0f0f5]">
              <Stethoscope className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
              Auscultação Cardiopulmonar
            </span>
            <span className="text-[10px] text-indigo-400 font-mono-code bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/40">
              Ouvir
            </span>
          </div>
          <div className="text-xs font-bold text-indigo-300 truncate mt-1">
            FC: {Math.round(vitals.heartRate)} bpm · FR: {Math.round(vitals.respiratoryRate)} rpm
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
            {formatCardiacRhythmPt(vitals.cardiacRhythm)}
          </div>
          <div className="text-[10px] text-[#8e8e9f] mt-2 pt-1.5 border-t border-[#1e1e2c] space-y-1">
            <div className="flex items-center justify-between">
              <span>Reflexo Pedal (Pata Traseira):</span>
              <button
                onClick={(e) => { e.stopPropagation(); testPedal('pelvic_limb'); }}
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                  (cellular?.regionalBlockByRegion?.pelvic_limb ?? 0) > 0.45
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
                title="Clique para testar o reflexo podal no membro pélvico"
              >
                {(cellular?.regionalBlockByRegion?.pelvic_limb ?? 0) > 0.45 ? 'BLOQUEADO 🛡️' : formatPedalReflex(vitals.pedalReflex).label}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span>Reflexo Pedal (Pata Dianteira):</span>
              <button
                onClick={(e) => { e.stopPropagation(); testPedal('thoracic_limb'); }}
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                  (cellular?.regionalBlockByRegion?.thoracic_limb ?? 0) > 0.45
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
                title="Clique para testar o reflexo podal no membro torácico"
              >
                {(cellular?.regionalBlockByRegion?.thoracic_limb ?? 0) > 0.45 ? 'BLOQUEADO 🛡️' : formatPedalReflex(vitals.pedalReflex).label}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Dynamic Physical Exam Feedback Banner */}
      {activeTestMessage && (
        <div className="p-3 rounded-xl bg-[#14141c] border border-emerald-500/40 text-xs text-[#e5e5e5] flex items-start space-x-2.5 animate-fadeIn shadow-lg">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-mono-code text-[11px] leading-relaxed">
            {activeTestMessage}
          </div>
          <button
            onClick={() => setActiveTestMessage(null)}
            className="text-[10px] text-emerald-400 hover:text-emerald-200 font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
};
