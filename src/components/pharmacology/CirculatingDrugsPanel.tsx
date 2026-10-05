import React, { useState } from 'react';
import type { DrugExposureAnalysis } from '../../engine/exposureAnalysis';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Biohazard,
  CheckCircle2,
  Clock3,
  Cpu,
  Dna,
  Flame,
  Gauge,
  HeartPulse,
  Info,
  Layers,
  Pill,
  Sparkles,
  TrendingDown,
  Wind,
  Zap,
} from 'lucide-react';
import { VETERINARY_DRUG_DATABASE } from '../../data/drugDatabase';
import { analyzeDrugExposure } from '../../engine/exposureAnalysis';
import { analyzePatientDrugKinetics } from '../../engine/biotransformationEngine';
import type { PatientDrugKinetics } from '../../engine/biotransformationEngine';
import { getRoutePharmacokinetics } from '../../engine/drugAdministration';
import {
  ENZYME_PATHWAY_LABELS,
  ENZYME_PATHWAYS,
  EnzymePathway,
  SPECIES_ORGAN_PHYSIOLOGY,
} from '../../engine/pk/speciesDrugDisposition';
import type { ActiveDrugDose, AnesthesiaEquipmentState, PatientProfile, VitalSigns } from '../../types/simulator';
import { formatDecimal, formatSpecies } from '../../utils/formatters';

interface CirculatingDrugsPanelProps {
  patient: PatientProfile;
  activeDoses: ActiveDrugDose[];
  equipment: AnesthesiaEquipmentState;
  vitals: VitalSigns;
}

const mechanismSummary = (drugId: string): string => {
  const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === drugId);
  if (!drug) return 'Mecanismo não cadastrado';
  const profile = drug.receptorProfile;
  if (profile?.muOpioid) return drug.specialTraits?.isOpioidAntagonist ? 'antagonismo competitivo μ-opioide' : 'agonismo μ-opioide';
  if (profile?.alpha2) return drug.specialTraits?.isAlpha2Antagonist ? 'antagonismo competitivo α2' : 'agonismo α2';
  if (profile?.gabaA) return drug.specialTraits?.isBenzoAntagonist ? 'antagonismo competitivo GABA-A/BZD' : 'modulação GABA-A';
  if (profile?.nmdaPoreBlock) return 'bloqueio NMDA';
  if (profile?.naVChannelBlock) return 'bloqueio de canais NaV';
  if (profile?.beta1 || profile?.alpha1) return 'ação adrenérgica';
  if (profile?.m2) return 'bloqueio muscarínico';
  if (profile?.nm) return 'bloqueio neuromuscular';
  return drug.description.split('.')[0];
};

const organEffectSummary = (drugId: string): string => {
  const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === drugId);
  if (!drug) return '';
  if (drug.specialTraits?.isOpioidAntagonist) return 'reversão de depressão respiratória e bradicardia vagal';
  if (drug.specialTraits?.isAlpha2Antagonist) return 'reversão de bradicardia, vasoconstrição e sedação alfa-2';
  if (drug.specialTraits?.isBenzoAntagonist) return 'reversão de sedação e relaxamento muscular';
  const effects: string[] = [];
  if (Math.abs(drug.effectHR) >= 0.15) effects.push(`FC ${drug.effectHR > 0 ? '↑' : '↓'}`);
  if (Math.abs(drug.effectBP) >= 0.15) effects.push(`PAM ${drug.effectBP > 0 ? '↑' : '↓'}`);
  if (Math.abs(drug.effectRR) >= 0.15) effects.push(`ventilação ${drug.effectRR > 0 ? '↑' : '↓'}`);
  if (drug.effectAnalgesia > 0.1) effects.push('antinocicepção ↑');
  if (drug.effectDepth > 0.1) effects.push('hipnose/sedação ↑');
  if (drug.muscleRelaxation > 0.15) effects.push('relaxamento ↑');
  return effects.slice(0, 3).join(' · ') || 'efeito sistêmico discreto';
};

/**
 * Badge indicating the current clinical effect status of a drug.
 */
const ClinicalEffectBadge: React.FC<{ analysis: DrugExposureAnalysis }> = ({ analysis }) => {
  if (analysis.clinicalEffectStatus === 'em trânsito') {
    return (
      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
        EM TRÂNSITO
      </span>
    );
  }
  if (analysis.isEffectActive) {
    return (
      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
        EFEITO ATIVO
      </span>
    );
  }
  if (analysis.clinicalEffectStatus === 'efeito subterapêutico') {
    return (
      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code font-bold bg-zinc-800 text-amber-400 border border-amber-800/40">
        SUBTERAPÊUTICO
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code font-bold bg-zinc-800 text-zinc-500 border border-zinc-700/40">
      SEM EFEITO
    </span>
  );
};

/**
 * Therapeutic window badge.
 */
const TherapeuticWindowBadge: React.FC<{ kinetics: PatientDrugKinetics }> = ({ kinetics }) => {
  const band = kinetics.therapeuticBand;
  if (!band) return null;
  const toneClasses = {
    therapeutic: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70',
    high: 'bg-amber-950/80 text-amber-300 border-amber-700/70',
    toxic: 'bg-rose-950/90 text-rose-300 border-rose-700/90 animate-pulse font-black',
    sub: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50',
  }[band.tone];

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-mono-code border ${toneClasses} inline-flex items-center gap-1`}
      title={`Janela Terapêutica: ${band.label} (${band.min} - ${band.max === Infinity ? '∞' : band.max} ${kinetics.therapeuticWindow?.unit})`}
    >
      <HeartPulse className="h-2.5 w-2.5" />
      <span>{band.label.toUpperCase()}</span>
    </span>
  );
};

const computeDistributionWithEliminated = (
  kinetics: PatientDrugKinetics,
  analysis: DrugExposureAnalysis,
): { centralPct: number; rapidPct: number; deepPct: number; depotPct: number; elimPct: number } => {
  const elim = analysis.eliminatedFraction;
  const bodyFraction = 1 - elim;
  const centralPct = Math.round(kinetics.centralFraction * bodyFraction * 100);
  const rapidPct = Math.round(kinetics.rapidTissueFraction * bodyFraction * 100);
  const deepPct = Math.round(kinetics.deepTissueFraction * bodyFraction * 100);
  const depotPct = Math.round(kinetics.depotFraction * bodyFraction * 100);
  const elimPct = Math.round(elim * 100);
  return { centralPct, rapidPct, deepPct, depotPct, elimPct };
};

export const CirculatingDrugsPanel: React.FC<CirculatingDrugsPanelProps> = ({
  patient,
  activeDoses,
  equipment,
  vitals,
}) => {
  const [activeTab, setActiveTab] = useState<'drugs' | 'biophysics' | 'biotransformation'>('drugs');

  const inhalant = vitals.biologicalState.inhalant;
  const inhalantPresent = equipment.isVaporizerOn || inhalant.alveolarMac > 0.005 || inhalant.vesselRichMac > 0.005;
  const metabolicAlerts: { label: string; detail: string; severity: 'warning' | 'danger' }[] = [];
  const labs = vitals.arterialBloodGases;
  const perfusion = vitals.biologicalState.organPerfusion;
  const nitroprussideBurden = vitals.biologicalState.metabolic.nitroprussideToxicMetaboliteBurden || 0;
  const transformation = vitals.biologicalState.biotransformation;
  const neurological = vitals.biologicalState.neurological;
  const autonomic = vitals.biologicalState.autonomic;
  const respiratory = vitals.biologicalState.respiratory;
  const cellular = vitals.cellularState;
  const speciesOrgan = SPECIES_ORGAN_PHYSIOLOGY[patient.species] || SPECIES_ORGAN_PHYSIOLOGY.canine;

  const feedbackRows = [
    {
      system: 'Sistema nervoso central',
      state: neurological.hypnoticDepth > 0.45 ? 'inibição cortical dominante' : neurological.excitationDrive > 0.25 ? 'excitação de transição' : 'autorregulação preservada',
      detail: `vigília ${Math.round(neurological.corticalArousalPct)}% · sedação ${neurological.sedativeDepth.toFixed(2)} · hipnose ${neurological.hypnoticDepth.toFixed(2)}`,
    },
    {
      system: 'Barorreflexo autonômico',
      state: cellular.baroreceptorVagalTone > 0.15 ? 'retroalimentação vagal negativa' : cellular.baroreceptorVagalTone < -0.15 ? 'compensação simpática' : 'equilíbrio pressórico',
      detail: `ganho reflexo ${cellular.baroreceptorGain.toFixed(2)} · reserva catecolaminas ${autonomic.catecholamineReserve.toFixed(2)}`,
    },
    {
      system: 'Centro respiratório bulbar',
      state: respiratory.centralDrive < 0.55 ? 'impulso bulbar deprimido' : vitals.arterialBloodGases.paCO2 > 48 ? 'quimiorreflexo por CO₂' : 'controle ventilatório compensado',
      detail: `impulso central ${respiratory.centralDrive.toFixed(2)} · PaCO₂ ${vitals.arterialBloodGases.paCO2.toFixed(1)} mmHg`,
    },
    {
      system: 'Junção neuromuscular',
      state: cellular.nmbaReceptorBlockade > 0.25 ? 'bloqueio nicotínico ativo' : 'transmissão preservada',
      detail: `trem de quatro: ${vitals.trainOfFourCount}/4 · capacidade motora ${neurological.motorCapacity.toFixed(2)}`,
    },
    {
      system: 'Nocicepção e analgesia',
      state: neurological.centralSensitization > 0.18 ? 'sensibilização central' : cellular.nociceptiveInhibition > 0.45 ? 'analgesia eficaz' : 'estímulo basal',
      detail: `estresse autonômico ${(vitals.nociceptiveStressLevel || 0).toFixed(2)} · inibição ${(cellular.nociceptiveInhibition * 100).toFixed(0)}%`,
    },
    {
      system: 'Fígado e rins (Clearance)',
      state: transformation.hepaticEnzymeSaturation > 0.35 || transformation.renalTransportSaturation > 0.35 ? 'depuração saturada' : 'eliminação preservada',
      detail: `capacidade hepática ${(transformation.hepaticEnzymeCapacity * 100).toFixed(0)}% · filtração renal ${(transformation.renalFiltrationCapacity * 100).toFixed(0)}%`,
    },
  ];

  if (labs.pH < 7.3) metabolicAlerts.push({ label: 'Acidose em curso', detail: `pH ${labs.pH.toFixed(2)} · lactato ${labs.lactate.toFixed(1)} mmol/L`, severity: labs.pH < 7.15 ? 'danger' : 'warning' });
  if (labs.lactate > 3) metabolicAlerts.push({ label: 'Hipoperfusão / hiperlactatemia', detail: `${labs.lactate.toFixed(1)} mmol/L`, severity: labs.lactate > 6 ? 'danger' : 'warning' });
  if (labs.potassium > 5.5) metabolicAlerts.push({ label: 'Hipercalemia', detail: `${labs.potassium.toFixed(1)} mEq/L`, severity: labs.potassium > 6.5 ? 'danger' : 'warning' });
  if (labs.glucoseMgDl > 180 || labs.glucoseMgDl < 60) metabolicAlerts.push({ label: 'Disglicemia', detail: `${Math.round(labs.glucoseMgDl)} mg/dL`, severity: labs.glucoseMgDl > 300 || labs.glucoseMgDl < 45 ? 'danger' : 'warning' });
  if (perfusion.hepaticFraction < 0.65 || perfusion.renalFraction < 0.65) metabolicAlerts.push({ label: 'Depuração orgânica reduzida', detail: `hepática ${Math.round(perfusion.hepaticFraction * 100)}% · renal ${Math.round(perfusion.renalFraction * 100)}%`, severity: Math.min(perfusion.hepaticFraction, perfusion.renalFraction) < 0.4 ? 'danger' : 'warning' });
  if (vitals.cellularState.systemicNaVBlockade > 0.2) metabolicAlerts.push({ label: 'Toxicidade por anestésico local (LAST)', detail: `bloqueio NaV sistêmico ${Math.round(vitals.cellularState.systemicNaVBlockade * 100)}%`, severity: vitals.cellularState.systemicNaVBlockade > 0.45 ? 'danger' : 'warning' });
  if (nitroprussideBurden > 0.15) metabolicAlerts.push({ label: 'Metabólitos do nitroprussiato (Cianeto/Tiocianato)', detail: `carga tóxica ${Math.round(nitroprussideBurden * 100)}%`, severity: nitroprussideBurden > 0.5 ? 'danger' : 'warning' });
  if ((transformation.toxicMetaboliteBurden ?? 0) > 0.25) metabolicAlerts.push({ label: 'Sobrecarga de metabólitos ativos/tóxicos', detail: `carga circulante ${Math.round((transformation.toxicMetaboliteBurden ?? 0) * 100)}%`, severity: (transformation.toxicMetaboliteBurden ?? 0) > 0.55 ? 'danger' : 'warning' });

  return (
    <aside className="sticky top-[76px] max-h-[calc(100vh-92px)] overflow-y-auto rounded-xl border border-zinc-800 bg-[#0f0f11] p-3.5 shadow-2xl flex flex-col gap-3 font-sans">
      {/* Header with patient info & species characteristics */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-bold text-white">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>Farmacocinética & Telemetria</span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono-code flex items-center gap-1.5 mt-0.5">
            <span>{patient.name}</span>
            <span>·</span>
            <span>{patient.weightKg} kg</span>
            <span>·</span>
            <span className="text-cyan-300 font-bold">{formatSpecies(patient.species).toUpperCase()}</span>
            {patient.species === 'feline' && (
              <span className="px-1 py-0.2 rounded bg-amber-950 text-amber-300 text-[9px] border border-amber-800/60 font-semibold" title="Gene UGT1A6 deficiente; metabolização lenta de fenóis">
                UGT1A6⁻
              </span>
            )}
            {patient.species === 'canine' && (
              <span className="px-1 py-0.2 rounded bg-blue-950 text-blue-300 text-[9px] border border-blue-800/60 font-semibold" title="NAT deficiente; oxidação CYP predominante">
                NAT⁻
              </span>
            )}
            {patient.species === 'bovine' && (
              <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[9px] border border-emerald-800/60 font-semibold" title="Hipersensibilidade a alfa-2 via receptor alfa-2D">
                α2D-Hiper
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-900/90 p-1 border border-zinc-800 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('drugs')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-md transition cursor-pointer ${
            activeTab === 'drugs'
              ? 'bg-zinc-800 text-white font-bold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Pill className="h-3.5 w-3.5 text-emerald-400" />
          <span>Fármacos ({activeDoses.length + (inhalantPresent ? 1 : 0)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('biophysics')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-md transition cursor-pointer ${
            activeTab === 'biophysics'
              ? 'bg-cyan-950/80 text-cyan-200 border border-cyan-800/50 font-bold shadow-sm'
              : 'text-zinc-400 hover:text-cyan-300'
          }`}
        >
          <Cpu className="h-3.5 w-3.5 text-cyan-400" />
          <span>Biofísica PBPK</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('biotransformation')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-md transition cursor-pointer ${
            activeTab === 'biotransformation'
              ? 'bg-indigo-950/80 text-indigo-200 border border-indigo-800/50 font-bold shadow-sm'
              : 'text-zinc-400 hover:text-indigo-300'
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-indigo-400" />
          <span>Biotransf.</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE DRUGS */}
      {activeTab === 'drugs' && (
        <div className="space-y-2.5">
          {activeDoses.length === 0 && !inhalantPresent && (
            <div className="rounded-lg border border-dashed border-zinc-700/60 p-4 text-center text-xs text-zinc-400 bg-zinc-900/40">
              Nenhum fármaco ativo ou inalatório em curso.
            </div>
          )}

          {activeDoses.map((dose) => {
            const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
            if (!drug) return null;
            const analysis = analyzeDrugExposure(dose, drug);
            const kinetics = analyzePatientDrugKinetics(patient, dose, vitals.biologicalState);
            if (!kinetics) return null;
            const route = getRoutePharmacokinetics(drug, dose.route);
            const TrendIcon = kinetics.plasmaTrend === 'subindo' ? ArrowUp : kinetics.plasmaTrend === 'diminuindo' ? ArrowDown : ArrowRight;
            const concentration = kinetics.estimatedPlasmaConcentration;
            const freeConcentration = kinetics.estimatedFreeConcentration;
            const concentrationDigits = concentration !== undefined && concentration < 0.1 ? 3 : 2;
            const isResidual = !analysis.isEffectActive;
            const distribWithElim = computeDistributionWithEliminated(kinetics, analysis);

            return (
              <div
                key={dose.id}
                className={`rounded-xl border p-3 transition space-y-2.5 ${
                  isResidual
                    ? 'border-zinc-800/50 bg-[#111113] opacity-75'
                    : 'border-zinc-800 bg-[#141416] hover:border-zinc-700'
                }`}
              >
                {/* Drug name & status row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate flex items-center gap-1.5 flex-wrap">
                      <span>{dose.drugName}</span>
                      {drug.category === 'antagonist_reversal' && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-200 text-[10px] font-mono-code border border-purple-700 font-bold">
                          REVERSOR
                        </span>
                      )}
                      {dose.isCRI && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 text-[10px] font-mono-code border border-cyan-800/60 font-semibold">
                          CRI
                        </span>
                      )}
                      <ClinicalEffectBadge analysis={analysis} />
                      <TherapeuticWindowBadge kinetics={kinetics} />
                      {dose.blockSite && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[10px] font-mono-code border border-amber-700/60 font-semibold">
                          🎯 {dose.blockSite.replace('epidural_', 'Epidural ').replace('block_', 'Bloqueio ').replace('local_', 'Local ')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono-code mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{analysis.phaseLabel} · via {dose.route}</span>
                      <span className={analysis.isEffectActive ? 'text-emerald-300 font-bold' : 'text-zinc-500'}>Ce: {dose.currentCe.toFixed(3)}×</span>
                      <span className="text-cyan-300">Cp: {dose.currentCp.toFixed(3)}×</span>
                      <span>· {Math.round(route.bioavailability * 100)}% biodisp.</span>
                    </div>
                  </div>

                  <span
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold font-mono-code shrink-0 ${
                      kinetics.plasmaTrend === 'subindo'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        : kinetics.plasmaTrend === 'diminuindo'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                          : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {kinetics.plasmaTrend.toUpperCase()}
                  </span>
                </div>

                {/* Big Concentration Metric & Therapeutic Targets */}
                <div className="rounded-lg bg-[#1a1a1d] p-2.5 border border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                      Concentração Plasmática
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono-code mt-0.5">
                      Livre: <b className="text-white">{freeConcentration === undefined ? '—' : `${formatDecimal(freeConcentration, concentrationDigits)} µg/mL`}</b>
                      {' '}({Math.round((1 - kinetics.profile.proteinBindingFraction) * 100)}%)
                    </div>
                    {kinetics.therapeuticWindow && (
                      <div className="text-[10px] text-zinc-500 font-mono-code mt-0.5">
                        Alvo terapêutico: <span className="text-emerald-300">{kinetics.therapeuticWindow.bands.find(b => b.tone === 'therapeutic')?.min ?? 0}–{kinetics.therapeuticWindow.bands.find(b => b.tone === 'therapeutic')?.max ?? '—'} {kinetics.therapeuticWindow.unit}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`font-mono-code text-lg font-black ${isResidual ? 'text-zinc-500' : 'text-cyan-400'}`}>
                      {concentration === undefined ? `${dose.currentCp.toFixed(3)} idx` : `${formatDecimal(concentration, concentrationDigits)} µg/mL`}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono-code">
                      ligação proteica {Math.round(kinetics.profile.proteinBindingFraction * 100)}%
                    </div>
                  </div>
                </div>

                {/* Multicompartment Distribution Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono-code">
                    <span>Distribuição tecidual · Destino da dose</span>
                    <span>{Math.round(analysis.eliminatedFraction * 100)}% eliminado</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="bg-cyan-400" style={{ width: `${distribWithElim.centralPct}%` }} title="Plasma / Central" />
                    <div className="bg-emerald-400" style={{ width: `${distribWithElim.rapidPct}%` }} title="Tecidos de Equilíbrio Rápido (VRG / músculo)" />
                    <div className="bg-violet-400" style={{ width: `${distribWithElim.deepPct}%` }} title="Tecidos Profundos (gordura / osso)" />
                    <div className="bg-amber-400" style={{ width: `${distribWithElim.depotPct}%` }} title="Depósito de Absorção" />
                    <div className="bg-zinc-600" style={{ width: `${distribWithElim.elimPct}%` }} title="Eliminado (metabolismo + excreção)" />
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[10px] text-zinc-400 font-mono-code pt-0.5">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
                      Plasma: <b className="text-zinc-200">{distribWithElim.centralPct}%</b>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                      Tec. rápidos: <b className="text-zinc-200">{distribWithElim.rapidPct}%</b>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-violet-400 inline-block" />
                      Tec. profundos: <b className="text-zinc-200">{distribWithElim.deepPct}%</b>
                    </span>
                    {distribWithElim.depotPct > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                        Absorção: <b className="text-zinc-200">{distribWithElim.depotPct}%</b>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-zinc-600 inline-block" />
                      Eliminado: <b className="text-zinc-200">{distribWithElim.elimPct}%</b>
                    </span>
                  </div>
                </div>

                {/* Active/Toxic Metabolite Sub-Card */}
                {kinetics.metaboliteExposure && kinetics.metaboliteExposure.amountNormalized > 0.005 && (
                  <div className={`rounded-lg p-2 text-xs font-mono-code border ${
                    kinetics.metaboliteExposure.isToxic
                      ? 'bg-rose-950/40 border-rose-900/60 text-rose-200'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                  }`}>
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span className="flex items-center gap-1">
                        {kinetics.metaboliteExposure.isToxic ? <Biohazard className="h-3 w-3 text-rose-400" /> : <Sparkles className="h-3 w-3 text-cyan-400" />}
                        Metabólito: {kinetics.metaboliteExposure.name}
                      </span>
                      <span className={kinetics.metaboliteExposure.isToxic ? 'text-rose-400' : 'text-cyan-300'}>
                        {kinetics.metaboliteExposure.amountNormalized.toFixed(3)}x
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                      {kinetics.metaboliteExposure.clinicalNote}
                    </div>
                  </div>
                )}

                {/* Clinical effect, organ clearance & decrement prediction */}
                <div className="border-t border-zinc-800/80 pt-2 text-[11px] space-y-1 font-mono-code leading-relaxed">
                  {analysis.isEffectActive ? (
                    <div className="text-emerald-300">
                      <span className="text-zinc-400">Ação:</span> {mechanismSummary(dose.drugId)} · {organEffectSummary(dose.drugId)}
                    </div>
                  ) : (
                    <div className="text-zinc-500 italic">
                      {analysis.clinicalEffectStatus === 'efeito subterapêutico'
                        ? 'Concentração subterapêutica – efeito clínico direto negligível; redistribuição/eliminação em curso.'
                        : 'Sem efeito clínico direto sobre o paciente. Traços residuais em eliminação.'}
                    </div>
                  )}

                  <div className="text-zinc-300 text-[10px] flex items-center justify-between flex-wrap gap-1">
                    <span>
                      <span className="text-zinc-400">Regime:</span> {kinetics.clearanceBreakdown?.clearanceRegime || 'fisiológico'} ({kinetics.feedbackExplanation})
                    </span>
                    {kinetics.contextSensitiveHalfTimeMin !== undefined && (
                      <span className="text-cyan-300 font-semibold" title="Tempo para queda de 50% na concentração plasmática se a infusão/entrada cessar agora">
                        t½CS: ~{formatDecimal(kinetics.contextSensitiveHalfTimeMin, 1)} min
                      </span>
                    )}
                  </div>

                  {analysis.estimatedEffectMinutesRemaining !== undefined && (
                    <div className="text-amber-300 text-[10px] font-semibold flex items-center justify-end gap-1">
                      <Clock3 className="h-3 w-3" />
                      Término de efeito estimado: ~{formatDecimal(analysis.estimatedEffectMinutesRemaining, 0)} min
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inhalant Card */}
          {inhalantPresent && (
            <div className="rounded-xl border border-violet-800/50 bg-[#161220] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-violet-200">
                  <Wind className="h-4 w-4 text-violet-400" />
                  {equipment.vaporizerType.toUpperCase()}
                </span>
                <span className="rounded bg-violet-950 px-2 py-0.5 text-[10px] font-bold text-violet-300 border border-violet-800/40">
                  {equipment.isVaporizerOn ? 'Entrada Alveolar' : 'Eliminação Pulmonar'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono-code rounded bg-violet-950/30 p-2 border border-violet-900/30">
                <div>Inspirado: <b className="text-white">{inhalant.inspiredMac.toFixed(2)} MAC</b></div>
                <div>Alveolar: <b className="text-white">{inhalant.alveolarMac.toFixed(2)} MAC</b></div>
                <div>Cérebro: <b className="text-cyan-300">{inhalant.vesselRichMac.toFixed(2)} MAC</b></div>
                <div>Tecidos: <b className="text-zinc-300">{(inhalant.muscleMac + inhalant.fatMac).toFixed(2)} MAC</b></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NATIVE BIOPHYSICS & PBPK */}
      {activeTab === 'biophysics' && (
        <div className="space-y-3">
          {/* Header Card: Native Engine Status */}
          <div className="rounded-xl border border-cyan-800/60 bg-cyan-950/25 p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                <Cpu className="h-4 w-4 text-cyan-400" />
                <span>Biofísica Celular & Transdução Nativa</span>
              </div>
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono-code text-emerald-300 border border-emerald-700/60 font-bold">
                100% NATIVO · PBPK
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Equilíbrio de segundo mensageiro intracelular, fluxo sanguíneo de órgãos (modelo well-stirred) e dinâmica de canais iônicos calculados a cada ciclo.
            </p>
          </div>

          {/* Organ Perfusion & Blood Flow Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-2 text-xs font-mono-code">
            <div className="font-bold text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <HeartPulse className="h-4 w-4" />
                Perfusão e Fluxo de Órgãos (Well-Stirred)
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">
                {patient.species.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded bg-[#141416] p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Fluxo Hepático (Qh)</span>
                <b className="text-emerald-300 text-sm">{Math.round(speciesOrgan.hepaticBloodFlowMlMinKg * perfusion.hepaticFraction)}</b>
                <span className="text-[10px] text-zinc-500 ml-1">mL/min/kg ({Math.round(perfusion.hepaticFraction * 100)}%)</span>
              </div>
              <div className="rounded bg-[#141416] p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Filtração Glomerular (TFG)</span>
                <b className="text-cyan-300 text-sm">{(speciesOrgan.gfrMlMinKg * perfusion.renalFraction).toFixed(1)}</b>
                <span className="text-[10px] text-zinc-500 ml-1">mL/min/kg ({Math.round(perfusion.renalFraction * 100)}%)</span>
              </div>
              <div className="rounded bg-[#141416] p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Perfusão Cerebral</span>
                <b className="text-violet-300 text-sm">{Math.round(perfusion.cerebralFraction * 100)}%</b>
                <span className="text-[10px] text-zinc-500 ml-1">da autorregulação</span>
              </div>
              <div className="rounded bg-[#141416] p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Entrega de Oxigênio (DO₂)</span>
                <b className="text-amber-300 text-sm">{perfusion.oxygenDeliveryMlKgMin.toFixed(1)}</b>
                <span className="text-[10px] text-zinc-500 ml-1">mL/kg/min</span>
              </div>
            </div>
          </div>

          {/* Key Cellular Drives Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono-code">
            {/* Cl- / GABA-A */}
            <div className="rounded-lg bg-zinc-900/90 p-2.5 border border-zinc-800 space-y-1">
              <div className="text-[10px] uppercase text-zinc-400 font-bold">Condutância Cl⁻ (GABA-A)</div>
              <div className="text-base font-black text-violet-300">
                {(cellular?.chlorideConductanceGabaA ?? 0.10).toFixed(2)}
                <span className="text-[10px] font-normal text-zinc-500 ml-1">(basal 0.10)</span>
              </div>
              <div className="text-[10px] text-zinc-400">
                {(cellular?.chlorideConductanceGabaA ?? 0.10) > 1.2
                  ? 'Hiperpolarização cortical cirúrgica'
                  : (cellular?.chlorideConductanceGabaA ?? 0.10) > 0.3
                  ? 'Sedação / inibição moderada'
                  : 'Condução sináptica basal'}
              </div>
            </div>

            {/* RVP */}
            <div className="rounded-lg bg-zinc-900/90 p-2.5 border border-zinc-800 space-y-1">
              <div className="text-[10px] uppercase text-zinc-400 font-bold">RVP Sistêmica</div>
              <div className="text-base font-black text-rose-300">
                {Math.round(cellular?.systemicVascularResistanceDyne ?? 2800)}
                <span className="text-[10px] font-normal text-zinc-500 ml-1">dyn·s/cm⁵</span>
              </div>
              <div className="text-[10px] text-zinc-400">
                {(cellular?.systemicVascularResistanceDyne ?? 2800) < 2400
                  ? 'Vasodilatação arteriolar potente'
                  : (cellular?.systemicVascularResistanceDyne ?? 2800) > 3800
                  ? 'Vasoconstrição reflexa / alfa-1'
                  : 'Tônus arteriolar equilibrado'}
              </div>
            </div>

            {/* Inotropism */}
            <div className="rounded-lg bg-zinc-900/90 p-2.5 border border-zinc-800 space-y-1">
              <div className="text-[10px] uppercase text-zinc-400 font-bold">Inotropismo Miocárdico</div>
              <div className="text-base font-black text-amber-300">
                {(cellular?.inotropicStateEmax ?? 1.0).toFixed(2)}
                <span className="text-[10px] font-normal text-zinc-500 ml-1">Emax (ref 1.0)</span>
              </div>
              <div className="text-[10px] text-zinc-400">
                {(cellular?.inotropicStateEmax ?? 1.0) < 0.85
                  ? 'Contratilidade miocárdica deprimida'
                  : (cellular?.inotropicStateEmax ?? 1.0) > 1.2
                  ? 'Estímulo inotrópico positivo'
                  : 'Contratilidade fisiológica normal'}
              </div>
            </div>

            {/* Baroreceptor Gain */}
            <div className="rounded-lg bg-zinc-900/90 p-2.5 border border-zinc-800 space-y-1">
              <div className="text-[10px] uppercase text-zinc-400 font-bold">Ganho Barorreflexo</div>
              <div className="text-base font-black text-cyan-300">
                {Math.round((cellular?.baroreceptorGain ?? 1.0) * 100)}%
                <span className="text-[10px] font-normal text-zinc-500 ml-1">
                  {(cellular?.baroreceptorVagalTone ?? 0) > 0.1 ? 'vagal' : 'simpático'}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400">
                {(cellular?.baroreceptorGain ?? 1.0) < 0.60
                  ? 'Reflexo atenuado por anestésico'
                  : 'Autorregulação autonômica ativa'}
              </div>
            </div>

            {/* Nociceptive Blockade */}
            <div className="rounded-lg bg-zinc-900/90 p-2.5 border border-zinc-800 space-y-1">
              <div className="text-[10px] uppercase text-zinc-400 font-bold">Inibição Nociceptiva</div>
              <div className="text-base font-black text-emerald-300">
                {Math.round((cellular?.nociceptiveInhibition ?? 0) * 100)}%
              </div>
              <div className="text-[10px] text-zinc-400">
                {(cellular?.nociceptiveInhibition ?? 0) > 0.6
                  ? 'Analgesia cirúrgica eficaz'
                  : (cellular?.nociceptiveInhibition ?? 0) > 0.25
                  ? 'Antinocicepção parcial'
                  : 'Vias de dor não bloqueadas'}
              </div>
            </div>

            {/* Systemic NaV Blockade (LAST Safety) */}
            <div className="rounded-lg bg-zinc-900/90 p-2.5 border border-zinc-800 space-y-1">
              <div className="text-[10px] uppercase text-zinc-400 font-bold">Bloqueio NaV Sistêmico</div>
              <div className={`text-base font-black ${
                (cellular?.systemicNaVBlockade ?? 0) > 0.35 ? 'text-red-400' : 'text-zinc-200'
              }`}>
                {Math.round((cellular?.systemicNaVBlockade ?? 0) * 100)}%
              </div>
              <div className="text-[10px] text-zinc-400">
                {(cellular?.systemicNaVBlockade ?? 0) > 0.35
                  ? 'Alerta LAST: cardiotoxicidade'
                  : 'Sem toxicidade de anestésico local'}
              </div>
            </div>
          </div>

          {/* Multicompartment PBPK for Active Drugs */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span>Cinética de Compartimentos & Biofase</span>
              <span className="text-[10px] text-zinc-400 font-normal">Mammillary 3-Compartment</span>
            </div>

            {activeDoses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700/60 p-4 text-center text-xs text-zinc-400 bg-zinc-900/40">
                Nenhum fármaco em circulação ativa no momento.
              </div>
            ) : (
              activeDoses.map((dose) => {
                const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
                const analysis = drug ? analyzeDrugExposure(dose, drug) : undefined;
                const kinetics = drug ? analyzePatientDrugKinetics(patient, dose, vitals.biologicalState) : undefined;
                const isResidual = analysis ? !analysis.isEffectActive : false;
                return (
                  <div
                    key={dose.id}
                    className={`rounded-xl border p-3 space-y-2 font-mono-code ${
                      isResidual
                        ? 'border-zinc-800/50 bg-[#0d0d0f] opacity-70'
                        : 'border-zinc-800 bg-[#101416]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{dose.drugName}</span>
                        {analysis && <ClinicalEffectBadge analysis={analysis} />}
                      </div>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[9px] text-zinc-300">
                        {dose.dosePerKg} {dose.route}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                        <div className="text-[10px] uppercase text-zinc-400">Plasma (Cp)</div>
                        <div className={`text-sm font-black ${isResidual ? 'text-zinc-500' : 'text-cyan-300'}`}>
                          {(dose.currentCp ?? 0).toFixed(3)}
                        </div>
                      </div>

                      <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                        <div className="text-[10px] uppercase text-zinc-400">Sítio efetor (Ce)</div>
                        <div className={`text-sm font-bold ${isResidual ? 'text-zinc-500' : 'text-emerald-300'}`}>
                          {(dose.currentCe ?? 0).toFixed(3)}
                        </div>
                      </div>
                    </div>

                    {dose.pkCompartments && (
                      <div className="space-y-1.5 border-t border-zinc-800/80 pt-1.5">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span>V₂ Tec. rápidos: <b className="text-zinc-200">{(dose.pkCompartments.rapidPeripheralAmountNormalized ?? 0).toFixed(3)}</b></span>
                          <span>V₃ Tec. profundos: <b className="text-zinc-200">{(dose.pkCompartments.deepPeripheralAmountNormalized ?? 0).toFixed(3)}</b></span>
                          <span>Depuração: <b className="text-emerald-300">{(dose.pkCompartments.effectiveClearanceMultiplier || 1).toFixed(2)}x</b></span>
                        </div>
                        {kinetics?.clearanceBreakdown && (
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>Regime: <b className="text-cyan-300">{kinetics.clearanceBreakdown.clearanceRegime}</b></span>
                            <span>ER: <b className="text-amber-300">{(kinetics.clearanceBreakdown.extractionRatioCurrent * 100).toFixed(0)}%</b></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BIOTRANSFORMATION, ENZYMATIC MATRIX & REFLEXES */}
      {activeTab === 'biotransformation' && (
        <div className="space-y-3">
          {/* Subsystem 1: Global Clearance Capacity */}
          <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-3 space-y-2 font-mono-code text-xs">
            <div className="font-bold text-indigo-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Dna className="h-4 w-4 text-indigo-400" />
                Capacidade de Eliminação e Filtração Orgânica
              </span>
              <span className="text-[10px] text-zinc-400">
                {patient.species.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Capacidade Hepática</span>
                <b className="text-emerald-300 text-sm">{Math.round(transformation.hepaticEnzymeCapacity * 100)}%</b>
              </div>
              <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Filtração Renal</span>
                <b className="text-cyan-300 text-sm">{Math.round(transformation.renalFiltrationCapacity * 100)}%</b>
              </div>
              <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Saturação Enzimática</span>
                <b className="text-amber-300 text-sm">{Math.round(transformation.hepaticEnzymeSaturation * 100)}%</b>
              </div>
              <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800">
                <span className="text-zinc-400 block text-[10px]">Carga Metabólitos Tóxicos</span>
                <b className="text-rose-300 text-sm">{Math.round((transformation.toxicMetaboliteBurden ?? 0) * 100)}%</b>
              </div>
            </div>
          </div>

          {/* Subsystem 2: Enzymatic Pathways Matrix (CYP, UGT, SULT, NAT, Esterases) */}
          <div className="rounded-xl border border-zinc-800 bg-[#121214] p-3 space-y-2 font-mono-code text-xs">
            <div className="font-bold text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <Zap className="h-4 w-4 text-indigo-400" />
                Matriz de Vias Enzimáticas (Fase I / Fase II / Esterases)
              </span>
            </div>

            <div className="space-y-1.5">
              {ENZYME_PATHWAYS.map((pathway) => {
                const info = ENZYME_PATHWAY_LABELS[pathway];
                const pathwayState = transformation.enzymePathways?.[pathway];
                const saturationPct = Math.round((pathwayState?.saturation ?? 0) * 100);
                const activityPct = Math.round((pathwayState?.activity ?? 1) * 100);
                const load = pathwayState?.load ?? 0;
                const isFelineUgtDeficit = patient.species === 'feline' && pathway === 'ugt';
                const isCanineNatDeficit = patient.species === 'canine' && pathway === 'nat';

                return (
                  <div key={pathway} className="rounded bg-zinc-900/70 p-2 border border-zinc-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <span>{info.label}</span>
                        <span className="text-[9px] text-zinc-500 uppercase">({info.phase})</span>
                        {isFelineUgtDeficit && (
                          <span className="px-1 py-0.2 rounded bg-amber-950 text-amber-300 text-[8px] font-bold border border-amber-800/60">
                            DEFICITÁRIA NO GATO
                          </span>
                        )}
                        {isCanineNatDeficit && (
                          <span className="px-1 py-0.2 rounded bg-blue-950 text-blue-300 text-[8px] font-bold border border-blue-800/60">
                            AUSENTE NO CÃO
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        Atividade: <b className={activityPct < 70 ? 'text-amber-400' : 'text-emerald-400'}>{activityPct}%</b>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            saturationPct > 60 ? 'bg-rose-500' : saturationPct > 25 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(load > 0 ? 5 : 0, saturationPct))}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[9px] font-mono-code">
                        {load > 0.01 ? `${saturationPct}% sat (carga ${load.toFixed(2)})` : 'livre'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Species metabolic notes */}
            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800/70 text-[10px] text-zinc-400 space-y-0.5">
              <div className="font-bold text-zinc-300 flex items-center gap-1">
                <Info className="h-3 w-3 text-cyan-400" />
                Particularidades metabólicas da espécie ({patient.species.toUpperCase()}):
              </div>
              {speciesOrgan.metabolicNotes.map((note, idx) => (
                <div key={idx} className="leading-snug">
                  • {note}
                </div>
              ))}
            </div>
          </div>

          {/* Subsystem 3: Integrated Autonomic Reflexes */}
          <div className="rounded-xl border border-sky-900/50 bg-sky-950/15 p-3 space-y-2">
            <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-sky-400" />
              <span>Reflexos Autonômicos & Alças de Retroalimentação</span>
            </div>
            <div className="space-y-1.5">
              {feedbackRows.map((feedback) => (
                <div key={feedback.system} className="rounded bg-zinc-900/70 p-2 border border-zinc-800/80 text-xs">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-zinc-200">{feedback.system}</span>
                    <span className="text-sky-300 text-[10px] font-mono-code">{feedback.state}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono-code mt-0.5">{feedback.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Subsystem 4: Metabolic Toxicity & Critical Alerts */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span>Alertas e Toxicidade Metabólica</span>
            </div>
            {metabolicAlerts.length === 0 ? (
              <div className="text-xs text-emerald-400 p-2 rounded bg-emerald-950/30 border border-emerald-900/40 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Nenhum sinal tóxico ou metabólico em curso.
              </div>
            ) : (
              <div className="space-y-1.5">
                {metabolicAlerts.map((alert) => (
                  <div
                    key={alert.label}
                    className={`rounded p-2 border text-xs ${
                      alert.severity === 'danger'
                        ? 'border-red-900/60 bg-red-950/40 text-red-200'
                        : 'border-amber-900/50 bg-amber-950/30 text-amber-200'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5" />
                      {alert.label}
                    </div>
                    <div className="text-[11px] opacity-80 font-mono-code mt-0.5">{alert.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer disclaimer */}
      <div className="border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-500 font-mono-code flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3 text-zinc-400" />
          Modelo mecanístico PBPK estocástico
        </span>
        <span className="flex items-center gap-1">
          <Clock3 className="h-3 w-3 text-zinc-400" />
          10 Hz
        </span>
      </div>
    </aside>
  );
};
