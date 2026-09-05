import React from 'react';
import { Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Clock3, Dna, Gauge, Wind } from 'lucide-react';
import { VETERINARY_DRUG_DATABASE } from '../../data/drugDatabase';
import { analyzeDrugExposure } from '../../engine/exposureAnalysis';
import { analyzePatientDrugKinetics } from '../../engine/biotransformationEngine';
import { getRoutePharmacokinetics } from '../../engine/drugAdministration';
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
  if (profile?.muOpioid) return drug.specialTraits?.isOpioidAntagonist ? 'antagonismo μ-opioide' : 'agonismo μ-opioide';
  if (profile?.alpha2) return drug.specialTraits?.isAlpha2Antagonist ? 'antagonismo α2' : 'agonismo α2';
  if (profile?.gabaA) return drug.specialTraits?.isBenzoAntagonist ? 'antagonismo GABA-A/BZD' : 'modulação GABA-A';
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
  const effects: string[] = [];
  if (Math.abs(drug.effectHR) >= 0.15) effects.push(`FC ${drug.effectHR > 0 ? '↑' : '↓'}`);
  if (Math.abs(drug.effectBP) >= 0.15) effects.push(`PAM ${drug.effectBP > 0 ? '↑' : '↓'}`);
  if (Math.abs(drug.effectRR) >= 0.15) effects.push(`ventilação ${drug.effectRR > 0 ? '↑' : '↓'}`);
  if (drug.effectAnalgesia > 0.1) effects.push('antinocicepção ↑');
  if (drug.effectDepth > 0.1) effects.push('hipnose/sedação ↑');
  if (drug.muscleRelaxation > 0.15) effects.push('relaxamento ↑');
  return effects.slice(0, 3).join(' · ') || 'efeito sistêmico discreto';
};

export const CirculatingDrugsPanel: React.FC<CirculatingDrugsPanelProps> = ({
  patient, activeDoses, equipment, vitals,
}) => {
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
  const regulation = vitals.biologicalState.systemicRegulation;
  const cellular = vitals.cellularState;
  const feedbackRows = [
    {
      system: 'Sistema nervoso central',
      state: neurological.hypnoticDepth > 0.45 ? 'inibição cortical dominante' : neurological.excitationDrive > 0.25 ? 'excitação de transição' : 'autorregulação preservada',
      detail: `vigília ${Math.round(neurological.corticalArousalPct)}/100 · sedação ${neurological.sedativeDepth.toFixed(2)} · hipnose ${neurological.hypnoticDepth.toFixed(2)}`,
    },
    {
      system: 'Barorreflexo autonômico',
      state: cellular.baroreceptorVagalTone > 0.15 ? 'retroalimentação vagal negativa' : cellular.baroreceptorVagalTone < -0.15 ? 'compensação simpática' : 'equilíbrio pressórico',
      detail: `ganho reflexo ${cellular.baroreceptorGain.toFixed(2)} · reserva de catecolaminas ${autonomic.catecholamineReserve.toFixed(2)}`,
    },
    {
      system: 'Centro respiratório',
      state: respiratory.centralDrive < 0.55 ? 'impulso bulbar deprimido' : vitals.arterialBloodGases.paCO2 > 48 ? 'quimiorreflexo por CO₂' : 'controle ventilatório compensado',
      detail: `impulso central ${respiratory.centralDrive.toFixed(2)} · PaCO₂ ${vitals.arterialBloodGases.paCO2.toFixed(1)} mmHg`,
    },
    {
      system: 'Junção neuromuscular',
      state: cellular.nmbaReceptorBlockade > 0.25 ? 'transmissão nicotínica bloqueada' : 'transmissão motora preservada',
      detail: `respostas no trem de quatro ${vitals.trainOfFourCount}/4 · capacidade motora ${neurological.motorCapacity.toFixed(2)}`,
    },
    {
      system: 'Nocicepção e sensibilização',
      state: neurological.centralSensitization > 0.18 ? 'retroalimentação positiva da dor' : cellular.nociceptiveInhibition > 0.45 ? 'inibição descendente predominante' : 'processamento aferente basal',
      detail: `entrada nociceptiva ${neurological.nociceptiveInput.toFixed(2)} · sensibilização central ${neurological.centralSensitization.toFixed(2)} · estresse autonômico ${(vitals.nociceptiveStressLevel || 0).toFixed(2)}`,
    },
    {
      system: 'Fígado e rins',
      state: transformation.hepaticEnzymeSaturation > 0.35 || transformation.renalTransportSaturation > 0.35 ? 'depuração saturável limitante' : 'eliminação acompanha a exposição',
      detail: `capacidade hepática ${transformation.hepaticEnzymeCapacity.toFixed(2)} · filtração renal ${transformation.renalFiltrationCapacity.toFixed(2)}`,
    },
    ...(regulation ? [{
      system: 'Orquestra multissistêmica',
      state: regulation.cellularHypoxia > 0.2 ? 'hipóxia celular com repercussão sistêmica' : regulation.myocardialStress > 0.18 ? 'estresse miocárdico acoplado' : 'acoplamento homeostático compensado',
      detail: `uso celular de O₂ ${Math.round(regulation.cellularOxygenUtilizationFraction * 100)}% · reserva compensatória ${Math.round(regulation.compensatoryReserve * 100)}% · ${vitals.activePhysiologicalSignals.length} sinais causais`,
    }] : []),
  ];
  if (labs.pH < 7.3) metabolicAlerts.push({ label: 'Acidose em curso', detail: `pH ${labs.pH.toFixed(2)} · lactato ${labs.lactate.toFixed(1)} mmol/L`, severity: labs.pH < 7.15 ? 'danger' : 'warning' });
  if (labs.lactate > 3) metabolicAlerts.push({ label: 'Hipoperfusão / hiperlactatemia', detail: `${labs.lactate.toFixed(1)} mmol/L`, severity: labs.lactate > 6 ? 'danger' : 'warning' });
  if (labs.potassium > 5.5) metabolicAlerts.push({ label: 'Hipercalemia', detail: `${labs.potassium.toFixed(1)} mEq/L`, severity: labs.potassium > 6.5 ? 'danger' : 'warning' });
  if (labs.glucoseMgDl > 180 || labs.glucoseMgDl < 60) metabolicAlerts.push({ label: 'Disglicemia', detail: `${Math.round(labs.glucoseMgDl)} mg/dL`, severity: labs.glucoseMgDl > 300 || labs.glucoseMgDl < 45 ? 'danger' : 'warning' });
  if (perfusion.hepaticFraction < 0.65 || perfusion.renalFraction < 0.65) metabolicAlerts.push({ label: 'Depuração orgânica reduzida', detail: `hepática ${Math.round(perfusion.hepaticFraction * 100)}% · renal ${Math.round(perfusion.renalFraction * 100)}%`, severity: Math.min(perfusion.hepaticFraction, perfusion.renalFraction) < 0.4 ? 'danger' : 'warning' });
  if (vitals.cellularState.systemicNaVBlockade > 0.2) metabolicAlerts.push({ label: 'Toxicidade por anestésico local', detail: `bloqueio NaV sistêmico ${Math.round(vitals.cellularState.systemicNaVBlockade * 100)}%`, severity: vitals.cellularState.systemicNaVBlockade > 0.45 ? 'danger' : 'warning' });
  if (nitroprussideBurden > 0.2) metabolicAlerts.push({ label: 'Metabólitos do nitroprussiato', detail: `carga relativa ${Math.round(nitroprussideBurden * 100)}% · risco cianeto/tiocianato`, severity: nitroprussideBurden > 0.6 ? 'danger' : 'warning' });
  if (regulation?.cellularHypoxia > 0.18) metabolicAlerts.push({
    label: 'Hipóxia celular / falha de utilização de O₂',
    detail: `carga ${Math.round(regulation.cellularHypoxia * 100)}% · utilização efetiva ${Math.round(regulation.cellularOxygenUtilizationFraction * 100)}%`,
    severity: regulation.cellularHypoxia > 0.55 ? 'danger' : 'warning',
  });

  return (
    <aside className="sticky top-[76px] max-h-[calc(100vh-92px)] overflow-y-auto rounded-xl border border-[#252525] bg-[#0d0d0d] p-3 shadow-2xl">
      <div className="mb-3 border-b border-[#222] pb-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f5f5f5]"><Activity className="h-4 w-4 text-emerald-400" /> Farmacocinética circulante</div>
          <div className="text-[9px] text-[#737373]">Distribuição, biotransformação e resposta · {formatSpecies(patient.species).toUpperCase()}</div>
        </div>
      </div>

      <div className="space-y-2">
        {activeDoses.length === 0 && !inhalantPresent && (
          <div className="rounded-lg border border-dashed border-[#303030] p-3 text-center text-[10px] text-[#737373]">Nenhum fármaco detectável na circulação ou sítio efetor.</div>
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
          return (
            <div key={dose.id} className="rounded-lg border border-[#303030] bg-[#121212] p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold text-white">{dose.drugName}</div>
                  <div className="text-[9px] text-cyan-300">{analysis.phaseLabel} · via {dose.route} · biodisponibilidade {Math.round(route.bioavailability * 100)}%</div>
                </div>
                <span className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-bold ${kinetics.plasmaTrend === 'subindo' ? 'bg-emerald-950 text-emerald-300' : kinetics.plasmaTrend === 'diminuindo' ? 'bg-amber-950 text-amber-300' : 'bg-slate-900 text-slate-300'}`}>
                  <TrendIcon className="h-2.5 w-2.5" /> {kinetics.plasmaTrend}
                </span>
              </div>

              <div className="mt-2 rounded bg-[#181818] p-2">
                <div className="flex items-end justify-between">
                  <span className="text-[8px] uppercase text-[#737373]">Concentração plasmática estimada</span>
                  <strong className="font-mono-code text-sm text-cyan-300">
                    {concentration === undefined ? `${dose.currentCp.toFixed(3)} índice` : `${formatDecimal(concentration, concentrationDigits)} µg/mL`}
                  </strong>
                </div>
                <div className="mt-0.5 flex justify-between text-[8px] text-[#888]">
                  <span>fração livre: {freeConcentration === undefined ? 'não estimável' : `${formatDecimal(freeConcentration, concentrationDigits)} µg/mL`}</span>
                  <span>ligação proteica: {Math.round(kinetics.profile.proteinBindingFraction * 100)}%</span>
                </div>
              </div>

              <div className="mt-2">
                <div className="mb-1 flex justify-between text-[8px] text-[#777]"><span>Distribuição corporal atual</span><span>bioacumulação {kinetics.bioaccumulationLabel}</span></div>
                <div className="flex h-2 overflow-hidden rounded bg-[#252525]" title="Plasma/central · tecidos rápidos · tecidos profundos · depósito de absorção">
                  <div className="bg-cyan-400" style={{ width: `${kinetics.centralFraction * 100}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${kinetics.rapidTissueFraction * 100}%` }} />
                  <div className="bg-violet-500" style={{ width: `${kinetics.deepTissueFraction * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${kinetics.depotFraction * 100}%` }} />
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 text-[8px] text-[#777]">
                  <span><i className="mr-1 inline-block h-1.5 w-1.5 bg-cyan-400" />central {Math.round(kinetics.centralFraction * 100)}%</span>
                  <span><i className="mr-1 inline-block h-1.5 w-1.5 bg-emerald-500" />tecidos rápidos {Math.round(kinetics.rapidTissueFraction * 100)}%</span>
                  <span><i className="mr-1 inline-block h-1.5 w-1.5 bg-violet-500" />tecidos profundos {Math.round(kinetics.deepTissueFraction * 100)}%</span>
                  <span><i className="mr-1 inline-block h-1.5 w-1.5 bg-amber-500" />depósito {Math.round(kinetics.depotFraction * 100)}%</span>
                </div>
              </div>

              <div className="mt-2 space-y-1 border-t border-[#292929] pt-2 text-[8px] leading-relaxed">
                <div><span className="text-[#666]">Biotransformação:</span> <span className="text-[#bbb]">{kinetics.profile.pathwayLabel}{kinetics.profile.enzymeSystem ? ` · ${kinetics.profile.enzymeSystem}` : ''}</span></div>
                {kinetics.profile.activeMetabolite && <div><span className="text-[#666]">Metabólito:</span> <span className="text-amber-300">{kinetics.profile.activeMetabolite}</span></div>}
                <div><span className="text-[#666]">Depuração:</span> <span className="text-[#bbb]">hepática {Math.round(kinetics.profile.hepaticClearanceFraction * 100)}% · renal {Math.round(kinetics.profile.renalClearanceFraction * 100)}% · capacidade atual {Math.round(kinetics.effectiveClearance * 100)}%</span></div>
                <div><span className="text-[#666]">Eliminado:</span> <span className="text-[#bbb]">{Math.round(kinetics.eliminatedFraction * 100)}% da quantidade já disponibilizada</span></div>
                <div><span className="text-[#666]">Ação farmacodinâmica:</span> <span className="text-emerald-200">{mechanismSummary(dose.drugId)} · {organEffectSummary(dose.drugId)}</span></div>
                <div className="rounded border border-indigo-900/40 bg-indigo-950/20 p-1.5 text-indigo-200/80"><Dna className="mr-1 inline h-2.5 w-2.5" />{kinetics.feedbackExplanation}</div>
                {analysis.estimatedEffectMinutesRemaining !== undefined && <div className="text-right text-amber-300">concentração no sítio efetor abaixo do limiar em aproximadamente {formatDecimal(analysis.estimatedEffectMinutesRemaining, 0)} min</div>}
              </div>
            </div>
          );
        })}

        <div className={`rounded-lg border p-2.5 ${inhalantPresent ? 'border-violet-700/40 bg-violet-950/15' : 'border-[#292929] bg-[#111] opacity-70'}`}>
            <div className="flex items-center justify-between"><span className="flex items-center gap-1 text-[11px] font-bold text-violet-200"><Wind className="h-3.5 w-3.5" /> {equipment.vaporizerType}</span><span className="text-[9px] text-violet-300">{equipment.isVaporizerOn ? 'entrada alveolar' : inhalantPresent ? 'eliminação pulmonar' : 'desligado'}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] font-mono-code text-[#a3a3a3]">
              <span>Inspirado <b className="text-white">{inhalant.inspiredMac.toFixed(2)} MAC</b></span>
              <span>Alvéolo <b className="text-white">{inhalant.alveolarMac.toFixed(2)} MAC</b></span>
              <span>Cérebro <b className="text-white">{inhalant.vesselRichMac.toFixed(2)} MAC</b></span>
              <span>Tecidos <b className="text-white">{(inhalant.muscleMac + inhalant.fatMac).toFixed(2)} MAC</b></span>
            </div>
        </div>

        <div className="rounded-lg border border-indigo-900/40 bg-indigo-950/10 p-2.5 text-[8px]">
          <div className="mb-1 text-[9px] font-bold text-indigo-300">Estado de biotransformação do paciente</div>
          <div className="grid grid-cols-2 gap-1 text-[#999]">
            <span>capacidade hepática <b className="text-white">{Math.round(transformation.hepaticEnzymeCapacity * 100)}%</b></span>
            <span>saturação enzimática <b className="text-white">{Math.round(transformation.hepaticEnzymeSaturation * 100)}%</b></span>
            <span>filtração renal <b className="text-white">{Math.round(transformation.renalFiltrationCapacity * 100)}%</b></span>
            <span>carga de metabólitos <b className="text-white">{Math.round(transformation.circulatingMetaboliteBurden * 100)}%</b></span>
          </div>
        </div>

        <div className="rounded-lg border border-sky-900/40 bg-sky-950/10 p-2.5">
          <div className="mb-1.5 text-[9px] font-bold text-sky-300">Retroalimentações fisiológicas integradas</div>
          <div className="space-y-1.5">
            {feedbackRows.map((feedback) => (
              <div key={feedback.system} className="border-t border-sky-900/20 pt-1 first:border-0 first:pt-0">
                <div className="flex justify-between gap-2 text-[8px]"><span className="font-semibold text-[#bbb]">{feedback.system}</span><span className="text-right text-sky-300">{feedback.state}</span></div>
                <div className="text-[8px] text-[#666]">{feedback.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#292929] bg-[#111] p-2.5">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase text-amber-300"><AlertTriangle className="h-3 w-3" /> Toxicidade metabólica</div>
          {metabolicAlerts.length === 0 ? (
            <div className="text-[9px] text-emerald-400/80">Sem sinal metabólico relevante em curso.</div>
          ) : metabolicAlerts.map((alert) => (
            <div key={alert.label} className={`border-t py-1.5 first:border-0 ${alert.severity === 'danger' ? 'border-red-900/40 text-red-300' : 'border-amber-900/30 text-amber-200'}`}>
              <div className="text-[9px] font-semibold">{alert.label}</div>
              <div className="text-[8px] opacity-70">{alert.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-1.5 rounded border border-amber-800/40 bg-amber-950/15 p-2 text-[8px] leading-relaxed text-amber-200/80">
        <Gauge className="mt-0.5 h-3 w-3 shrink-0" /> Concentrações são estimativas mecanísticas, não exames laboratoriais. Variam com volume central, ligação proteica, perfusão, espécie, ASA, temperatura e via.
      </div>
      <div className="mt-1 flex items-center gap-1 text-[8px] text-[#555]"><Clock3 className="h-2.5 w-2.5" /> Atualização contínua a cada passo da simulação</div>
    </aside>
  );
};
