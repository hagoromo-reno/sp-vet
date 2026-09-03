import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import { CellularReceptorsEngine } from '../engine/cellularReceptors';
import { getRoutePharmacokinetics } from '../engine/drugAdministration';
import { AnesthesiaEquipmentState, PatientProfile, SpeciesType } from '../types/simulator';
import {
  SimulationState,
  administerDrug,
  advanceSimulation,
  createActiveDose,
  createDefaultEquipment,
  createHealthyValidationPatient,
  createSimulationState,
  stopInfusion,
  summarizeTrace,
} from './simulationHarness';

export interface BehaviorCheckResult {
  id: string;
  title: string;
  passed: boolean;
  expected: string;
  observed: string;
}

function check(
  results: BehaviorCheckResult[],
  id: string,
  title: string,
  condition: boolean,
  expected: string,
  observed: string
): void {
  results.push({ id, title, passed: condition, expected, observed });
}

function protectedEquipment(patient: PatientProfile): AnesthesiaEquipmentState {
  return createDefaultEquipment(patient, {
    intubationStatus: 'intubated_tracheal',
    cuffPressureCmH2O: 18,
    ventilatorMode: 'cmv_volume',
    isVentilatorActive: true,
    oxygenFlowLMin: Math.max(1, patient.weightKg * 0.05),
  });
}

function runSingle(
  species: SpeciesType,
  drugId: string,
  level: 'min' | 'typical' | 'max' = 'typical',
  durationSeconds = 360,
  protectAirway = false
): SimulationState {
  const patient = createHealthyValidationPatient(species);
  const state = createSimulationState(patient, protectAirway ? protectedEquipment(patient) : undefined);
  administerDrug(state, drugId, level);
  return advanceSimulation(state, durationSeconds, { dtSeconds: 1 });
}

function prepareReversalPair(
  target: string,
  reversal: string,
  preSeconds: number,
  postSeconds: number,
  protectAirway = false
): { control: SimulationState; reversed: SimulationState } {
  const prepare = (): SimulationState => {
    const patient = createHealthyValidationPatient('canine');
    const state = createSimulationState(patient, protectAirway ? protectedEquipment(patient) : undefined);
    administerDrug(state, target, 'typical');
    return advanceSimulation(state, preSeconds, { dtSeconds: 1 });
  };
  const control = prepare();
  const reversed = prepare();
  administerDrug(reversed, reversal, 'typical');
  advanceSimulation(control, postSeconds, { dtSeconds: 1 });
  advanceSimulation(reversed, postSeconds, { dtSeconds: 1 });
  return { control, reversed };
}

function firstTimeAbove(state: SimulationState, selector: (frame: SimulationState['frames'][number]) => number, threshold: number): number {
  return state.frames.find((frame) => selector(frame) >= threshold)?.timeSeconds ?? Number.POSITIVE_INFINITY;
}

export function runBehaviorScenarios(): BehaviorCheckResult[] {
  const results: BehaviorCheckResult[] = [];

  // Original clinical reproducer: two acepromazine administrations, including a
  // supratherapeutic rapid dose. It must be visible without becoming analgesia.
  {
    const patient = createHealthyValidationPatient('canine');
    const state = createSimulationState(patient);
    administerDrug(state, 'acepromazine', 'typical', { dosePerKg: 0.02, route: 'IV', speed: 'bolus_slow' });
    administerDrug(state, 'acepromazine', 'max', { dosePerKg: 0.125, route: 'IV', speed: 'bolus_rapid' });
    advanceSimulation(state, 600, { dtSeconds: 1 });
    const trace = summarizeTrace(state.frames);
    check(results, 'ace-high-visible', 'Acepromazina cumulativa supraterapêutica',
      trace.maxSedation >= 0.58 && trace.minConsciousness <= 60 && trace.maxAnalgesia <= 0.06,
      'tranquilização forte, consciência reduzida e analgesia ausente',
      `sed=${trace.maxSedation.toFixed(2)}, consciência mín=${trace.minConsciousness}, analgesia=${trace.maxAnalgesia.toFixed(2)}`);
    check(results, 'ace-high-not-general-anesthesia', 'Acepromazina não vira anestesia geral',
      trace.maxHypnosis < 0.25 && !trace.stages.some((stage) => stage.includes('Plano 2') || stage.includes('Plano 3')),
      'sem hipnose/plano cirúrgico mesmo em dose alta',
      `hipnose=${trace.maxHypnosis.toFixed(2)}, estágios=${trace.stages.join(' | ')}`);
  }

  // Transit boundary regression (lag exactly divisible by timestep).
  {
    const state = runSingle('canine', 'acepromazine', 'typical', 180);
    check(results, 'transit-boundary', 'Dose sobrevive ao limite exato do tempo de trânsito',
      summarizeTrace(state.frames).peakEffectSiteExposure > 0.2,
      'Ce deve subir após o lag, sem a dose desaparecer no frame de fronteira',
      `Ce pico=${summarizeTrace(state.frames).peakEffectSiteExposure.toFixed(2)}`);
  }

  // Route timing.
  {
    const patient = createHealthyValidationPatient('canine');
    const iv = createSimulationState(patient);
    const im = createSimulationState(patient);
    administerDrug(iv, 'dexmedetomidine', 'typical', { route: 'IV' });
    administerDrug(im, 'dexmedetomidine', 'typical', { route: 'IM' });
    advanceSimulation(iv, 600, { dtSeconds: 1 });
    advanceSimulation(im, 600, { dtSeconds: 1 });
    const ivOnset = firstTimeAbove(iv, (frame) => frame.vitals.cellularState.centralSedation, 0.18);
    const imOnset = firstTimeAbove(im, (frame) => frame.vitals.cellularState.centralSedation, 0.18);
    check(results, 'route-onset', 'Via IV tem início anterior à IM', ivOnset < imOnset,
      'início IV anterior ao IM', `IV=${ivOnset}s, IM=${imOnset}s`);
  }

  // Competitive reversals against time-matched controls.
  {
    const pair = prepareReversalPair('dexmedetomidine', 'atipamezole', 300, 180);
    const ratio = pair.reversed.vitals.cellularState.centralSedation / Math.max(0.01, pair.control.vitals.cellularState.centralSedation);
    check(results, 'reverse-alpha2', 'Atipamezol reverte alfa-2', ratio < 0.45 && pair.reversed.vitals.heartRate > pair.control.vitals.heartRate,
      'sedação <45% do controle e recuperação da FC',
      `sed reversão/controle=${ratio.toFixed(2)}, FC=${pair.reversed.vitals.heartRate.toFixed(0)}/${pair.control.vitals.heartRate.toFixed(0)}`);
  }
  {
    const pair = prepareReversalPair('fentanyl', 'naloxone', 240, 150);
    const ratio = pair.reversed.vitals.cellularState.nociceptiveInhibition / Math.max(0.01, pair.control.vitals.cellularState.nociceptiveInhibition);
    check(results, 'reverse-opioid', 'Naloxona reverte opioide', ratio < 0.45 && pair.reversed.vitals.respiratoryRate >= pair.control.vitals.respiratoryRate,
      'analgesia <45% do controle e ventilação igual/melhor',
      `analgesia reversão/controle=${ratio.toFixed(2)}, FR=${pair.reversed.vitals.respiratoryRate}/${pair.control.vitals.respiratoryRate}`);
  }
  {
    const pair = prepareReversalPair('midazolam', 'flumazenil', 240, 150);
    const ratio = pair.reversed.vitals.cellularState.muscleRelaxation / Math.max(0.01, pair.control.vitals.cellularState.muscleRelaxation);
    check(results, 'reverse-bzd', 'Flumazenil reverte benzodiazepínico', ratio < 0.45,
      'relaxamento <45% do controle', `relaxamento reversão/controle=${ratio.toFixed(2)}`);
  }
  {
    const pair = prepareReversalPair('propofol', 'flumazenil', 120, 90, true);
    const delta = Math.abs(pair.reversed.vitals.cellularState.hypnoticEffect - pair.control.vitals.cellularState.hypnoticEffect);
    check(results, 'reversal-selectivity', 'Flumazenil não reverte propofol', delta < 0.06,
      'hipnose por propofol praticamente igual ao controle', `diferença de hipnose=${delta.toFixed(3)}`);
  }

  // Balanced-anesthesia synergy.
  {
    const patient = createHealthyValidationPatient('canine');
    const propofol = createSimulationState(patient, protectedEquipment(patient));
    const combined = createSimulationState(patient, protectedEquipment(patient));
    administerDrug(propofol, 'propofol', 'min');
    administerDrug(combined, 'propofol', 'min');
    administerDrug(combined, 'midazolam', 'typical');
    advanceSimulation(propofol, 180, { dtSeconds: 1 });
    advanceSimulation(combined, 180, { dtSeconds: 1 });
    const mono = summarizeTrace(propofol.frames);
    const combo = summarizeTrace(combined.frames);
    check(results, 'gaba-synergy', 'Midazolam potencializa propofol', combo.maxDepth > mono.maxDepth + 4 && combo.maxMuscleRelaxation > mono.maxMuscleRelaxation + 0.15,
      'maior profundidade e relaxamento com a associação',
      `profundidade=${combo.maxDepth}/${mono.maxDepth}, relaxamento=${combo.maxMuscleRelaxation.toFixed(2)}/${mono.maxMuscleRelaxation.toFixed(2)}`);
  }
  {
    const patient = createHealthyValidationPatient('canine');
    const ketamine = createSimulationState(patient);
    const combined = createSimulationState(patient);
    administerDrug(ketamine, 'ketamine', 'typical');
    administerDrug(combined, 'ketamine', 'typical');
    administerDrug(combined, 'midazolam', 'typical');
    advanceSimulation(ketamine, 240, { dtSeconds: 1 });
    advanceSimulation(combined, 240, { dtSeconds: 1 });
    check(results, 'ketamine-bzd', 'Benzodiazepínico equilibra hipertonia da cetamina',
      combined.vitals.cellularState.muscleRelaxation > ketamine.vitals.cellularState.muscleRelaxation + 0.25
        && combined.vitals.cellularState.dissociativeEffect > 0.35,
      'relaxamento aumenta sem abolir dissociação',
      `relaxamento=${combined.vitals.cellularState.muscleRelaxation.toFixed(2)}/${ketamine.vitals.cellularState.muscleRelaxation.toFixed(2)}, diss=${combined.vitals.cellularState.dissociativeEffect.toFixed(2)}`);
  }
  {
    const ace = runSingle('canine', 'acepromazine', 'typical', 300);
    const methadone = runSingle('canine', 'methadone', 'typical', 300);
    const patient = createHealthyValidationPatient('canine');
    const combo = createSimulationState(patient);
    administerDrug(combo, 'acepromazine', 'typical');
    administerDrug(combo, 'methadone', 'typical');
    advanceSimulation(combo, 300, { dtSeconds: 1 });
    check(results, 'neuroleptanalgesia', 'Acepromazina + metadona integra sedação e analgesia',
      combo.vitals.cellularState.centralSedation > Math.max(ace.vitals.cellularState.centralSedation, methadone.vitals.cellularState.centralSedation)
        && combo.vitals.cellularState.nociceptiveInhibition > 0.45,
      'sedação combinada maior que monoterapias e analgesia forte',
      `sed combo/ace/met=${combo.vitals.cellularState.centralSedation.toFixed(2)}/${ace.vitals.cellularState.centralSedation.toFixed(2)}/${methadone.vitals.cellularState.centralSedation.toFixed(2)}, analg=${combo.vitals.cellularState.nociceptiveInhibition.toFixed(2)}`);
  }
  {
    const dex = runSingle('canine', 'dexmedetomidine', 'typical', 240);
    const fentanyl = runSingle('canine', 'fentanyl', 'typical', 240);
    const patient = createHealthyValidationPatient('canine');
    const combo = createSimulationState(patient);
    administerDrug(combo, 'dexmedetomidine', 'typical');
    administerDrug(combo, 'fentanyl', 'typical');
    advanceSimulation(combo, 240, { dtSeconds: 1 });
    check(results, 'alpha2-opioid-synergy', 'Alfa-2 + opioide soma analgesia e depressão',
      combo.vitals.cellularState.nociceptiveInhibition > Math.max(dex.vitals.cellularState.nociceptiveInhibition, fentanyl.vitals.cellularState.nociceptiveInhibition) + 0.08
        && combo.vitals.cellularState.respiratoryDepression > Math.max(dex.vitals.cellularState.respiratoryDepression, fentanyl.vitals.cellularState.respiratoryDepression),
      'analgesia e depressão respiratória maiores que em cada monoterapia',
      `analg=${combo.vitals.cellularState.nociceptiveInhibition.toFixed(2)}, respDep=${combo.vitals.cellularState.respiratoryDepression.toFixed(2)}`);
  }

  // Neuromuscular blockade and reversal selectivity.
  {
    const patient = createHealthyValidationPatient('canine');
    const state = createSimulationState(patient, protectedEquipment(patient));
    administerDrug(state, 'atracurium', 'typical');
    advanceSimulation(state, 240, { dtSeconds: 1 });
    check(results, 'nmba-awareness', 'Paralisia não implica anestesia/analgesia',
      state.vitals.trainOfFourCount <= 2 && state.vitals.consciousnessScore === 100
        && state.vitals.cellularState.nociceptiveInhibition <= 0.02
        && state.vitals.activeDrugInteractions.some((item) => item.title.includes('Consciência')),
      'TOF reduzido com consciência/ausência de analgesia e alerta de awareness',
      `TOF=${state.vitals.trainOfFourCount}, consciência=${state.vitals.consciousnessScore}, alertas=${state.vitals.activeDrugInteractions.map((item) => item.title).join(' | ')}`);
  }
  {
    const pair = prepareReversalPair('atracurium', 'neostigmine', 180, 180, true);
    check(results, 'reverse-atracurium', 'Neostigmina reverte atracúrio',
      pair.reversed.vitals.trainOfFourCount > pair.control.vitals.trainOfFourCount,
      'TOF maior que no controle temporal', `TOF reversão/controle=${pair.reversed.vitals.trainOfFourCount}/${pair.control.vitals.trainOfFourCount}`);
  }
  {
    const pair = prepareReversalPair('atracurium', 'sugammadex', 180, 120, true);
    check(results, 'sugammadex-selectivity', 'Sugamadex não reverte atracúrio',
      pair.reversed.vitals.trainOfFourCount === pair.control.vitals.trainOfFourCount,
      'TOF igual ao controle temporal', `TOF sugamadex/controle=${pair.reversed.vitals.trainOfFourCount}/${pair.control.vitals.trainOfFourCount}`);
  }

  // Local/regional effect stays separate from systemic toxicity.
  {
    const local = runSingle('canine', 'bupivacaine_05', 'typical', 600);
    check(results, 'regional-separation', 'Bupivacaína local bloqueia nervo sem toxicidade sistêmica',
      local.vitals.cellularState.localNeuralBlockade > 0.55
        && local.vitals.cellularState.systemicNaVBlockade < 0.12
        && local.vitals.consciousnessScore === 100,
      'bloqueio local forte, NaV sistêmico baixo e consciência preservada',
      `local=${local.vitals.cellularState.localNeuralBlockade.toFixed(2)}, sistêmico=${local.vitals.cellularState.systemicNaVBlockade.toFixed(2)}`);
  }
  {
    const patient = createHealthyValidationPatient('canine');
    const bupivacaine = createActiveDose(patient, 'bupivacaine_05', 'max', { route: 'Local', dosePerKg: 8 });
    bupivacaine.route = 'IV_slow'; // deliberate accidental intravascular exposure
    bupivacaine.currentCe = 6;
    const lipid = createActiveDose(patient, 'lipid_emulsion_20', 'typical', { route: 'IV' });
    lipid.currentCe = 1;
    const toxinOnly = CellularReceptorsEngine.computeReceptorState(patient, [bupivacaine], 0, 'isoflurane');
    const rescued = CellularReceptorsEngine.computeReceptorState(patient, [bupivacaine, lipid], 0, 'isoflurane');
    check(results, 'lipid-sink', 'Emulsão lipídica reduz exposição NaV em LAST',
      toxinOnly.naVBlockade > 0.65 && rescued.naVBlockade < toxinOnly.naVBlockade * 0.5,
      'toxicidade sistêmica alta e redução >50% com ILE',
      `NaV tóxico=${toxinOnly.naVBlockade.toFixed(2)}, com ILE=${rescued.naVBlockade.toFixed(2)}`);
  }

  // Electrolytes and emergency administration.
  {
    const safe = runSingle('canine', 'potassium_chloride', 'typical', 600);
    const patient = createHealthyValidationPatient('canine');
    const rapid = createSimulationState(patient);
    administerDrug(rapid, 'potassium_chloride', 'typical', { route: 'IV_slow', speed: 'bolus_rapid' });
    advanceSimulation(rapid, 90, { dtSeconds: 1 });
    check(results, 'kcl-rate-safety', 'KCl depende criticamente da velocidade',
      !safe.vitals.isCardiacArrest && safe.vitals.arterialBloodGases.potassium > patient.baselineVitals.potassiumMeqL
        && rapid.vitals.isCardiacArrest,
      'CRI eleva K sem parada; bólus rápido causa parada',
      `K CRI=${safe.vitals.arterialBloodGases.potassium}, parada CRI/bólus=${safe.vitals.isCardiacArrest}/${rapid.vitals.isCardiacArrest}`);
  }
  {
    const patient = createHealthyValidationPatient('feline');
    patient.baselineVitals.hr = 68;
    patient.baselineVitals.map = 61;
    patient.baselineVitals.potassiumMeqL = 7.9;
    patient.pathologyConditions.hyperkalemiaSeverity = 0.85;
    const control = createSimulationState(patient);
    const calcium = createSimulationState(patient);
    const bicarbonate = createSimulationState(patient);
    administerDrug(calcium, 'calcium_gluconate', 'typical');
    administerDrug(bicarbonate, 'sodium_bicarbonate', 'typical');
    advanceSimulation(control, 360, { dtSeconds: 1 });
    advanceSimulation(calcium, 360, { dtSeconds: 1 });
    advanceSimulation(bicarbonate, 360, { dtSeconds: 1 });
    check(results, 'hyperkalemia-calcium', 'Cálcio estabiliza membrana sem baixar K',
      calcium.vitals.cellularState.electrolyteCardiotoxicity < control.vitals.cellularState.electrolyteCardiotoxicity * 0.55
        && Math.abs(calcium.vitals.arterialBloodGases.potassium - control.vitals.arterialBloodGases.potassium) < 0.1,
      'toxicidade elétrica reduzida e K inalterado',
      `toxicidade=${calcium.vitals.cellularState.electrolyteCardiotoxicity.toFixed(2)}/${control.vitals.cellularState.electrolyteCardiotoxicity.toFixed(2)}, K=${calcium.vitals.arterialBloodGases.potassium}/${control.vitals.arterialBloodGases.potassium}`);
    check(results, 'hyperkalemia-bicarbonate', 'Bicarbonato alcaliniza e reduz K modelado',
      bicarbonate.vitals.arterialBloodGases.bicarbonate > control.vitals.arterialBloodGases.bicarbonate + 1
        && bicarbonate.vitals.arterialBloodGases.potassium < control.vitals.arterialBloodGases.potassium - 0.2,
      'HCO3 sobe e K cai',
      `HCO3=${bicarbonate.vitals.arterialBloodGases.bicarbonate}/${control.vitals.arterialBloodGases.bicarbonate}, K=${bicarbonate.vitals.arterialBloodGases.potassium}/${control.vitals.arterialBloodGases.potassium}`);
  }
  {
    const therapeutic = runSingle('feline', 'lidocaine_2pct', 'typical', 360);
    const patient = createHealthyValidationPatient('feline');
    const canineDose = createSimulationState(patient);
    administerDrug(canineDose, 'lidocaine_2pct', 'max', { route: 'IV_slow', dosePerKg: 2 });
    advanceSimulation(canineDose, 240, { dtSeconds: 1 });
    check(results, 'feline-lidocaine-window', 'Lidocaína respeita margem felina e via sistêmica',
      !therapeutic.vitals.isCardiacArrest && canineDose.vitals.isCardiacArrest,
      'dose felina terapêutica não fatal; dose canina IV causa toxicidade grave',
      `parada terapêutica/canina=${therapeutic.vitals.isCardiacArrest}/${canineDose.vitals.isCardiacArrest}`);
  }
  {
    const felineState = runSingle('feline', 'propofol', 'typical', 600, true);
    const canineState = runSingle('canine', 'propofol', 'typical', 600, true);
    const felineCe = felineState.doses.find((d) => d.drugId === 'propofol')?.currentCe || 0;
    const canineCe = canineState.doses.find((d) => d.drugId === 'propofol')?.currentCe || 0;
    check(results, 'feline-propofol-clearance', 'Déficit de UGT1A6 retarda depuração de propofol em felinos',
      felineCe > canineCe * 1.3,
      'Ce em felino permanece >30% superior ao canino devido à menor taxa de glicuronidação (0.18×)',
      `Ce gato/cão=${felineCe.toFixed(3)}/${canineCe.toFixed(3)} (${(felineCe / Math.max(0.001, canineCe)).toFixed(2)}×)`);
  }

  // Species-specific antimuscarinic response.
  {
    const atropine = runSingle('rabbit', 'atropine', 'typical', 300);
    const glycopyrrolate = runSingle('rabbit', 'glycopyrrolate', 'typical', 300);
    const baseline = createHealthyValidationPatient('rabbit').baselineVitals.hr;
    check(results, 'rabbit-atropinase', 'Glicopirrolato supera atropina no coelho',
      glycopyrrolate.vitals.heartRate - baseline > (atropine.vitals.heartRate - baseline) * 2,
      'resposta cronotrópica do glicopirrolato >2× atropina',
      `ΔFC glicopirrolato/atropina=${(glycopyrrolate.vitals.heartRate - baseline).toFixed(1)}/${(atropine.vitals.heartRate - baseline).toFixed(1)}`);
  }

  // Resuscitation fluids in a paired hypovolemic model.
  {
    const shockPatient = createHealthyValidationPatient('canine');
    shockPatient.baselineVitals.map = 55;
    shockPatient.baselineVitals.sysBP = 78;
    shockPatient.baselineVitals.diaBP = 40;
    shockPatient.baselineVitals.hctPct = 28;
    shockPatient.pathologyConditions.hypovolemiaSeverity = 0.55;
    const control = createSimulationState(shockPatient);
    const hypertonic = createSimulationState(shockPatient);
    const blood = createSimulationState(shockPatient);
    administerDrug(hypertonic, 'hypertonic_saline_72', 'typical');
    administerDrug(blood, 'whole_blood', 'typical');
    advanceSimulation(control, 360, { dtSeconds: 1 });
    advanceSimulation(hypertonic, 360, { dtSeconds: 1 });
    advanceSimulation(blood, 360, { dtSeconds: 1 });
    check(results, 'shock-volume-response', 'Reposição melhora choque hipovolêmico',
      hypertonic.vitals.meanArterialPressure > control.vitals.meanArterialPressure + 5
        && blood.vitals.meanArterialPressure > control.vitals.meanArterialPressure + 4,
      'PAM maior que controle com salina hipertônica e sangue',
      `PAM controle/HTS/sangue=${control.vitals.meanArterialPressure}/${hypertonic.vitals.meanArterialPressure}/${blood.vitals.meanArterialPressure}`);
    check(results, 'blood-oxygen-capacity', 'Sangue repõe Hct e cristaloide não',
      blood.vitals.arterialBloodGases.hematocritPct > hypertonic.vitals.arterialBloodGases.hematocritPct + 6,
      'Hct com sangue > cristaloide em pelo menos 6 pontos',
      `Hct sangue/HTS=${blood.vitals.arterialBloodGases.hematocritPct}/${hypertonic.vitals.arterialBloodGases.hematocritPct}`);
  }

  // Inhalant wash-in/out and MAC-sparing interaction.
  {
    const patient = createHealthyValidationPatient('canine');
    const equipment = protectedEquipment(patient);
    equipment.isVaporizerOn = true;
    equipment.vaporizerDialPct = 1.3;
    const state = createSimulationState(patient, equipment);
    advanceSimulation(state, 300, { dtSeconds: 1 });
    const atSteadyState = state.vitals.cellularState.volatileAnestheticMac;
    state.equipment.isVaporizerOn = false;
    advanceSimulation(state, 300, { dtSeconds: 1 });
    const afterWashout = state.vitals.cellularState.volatileAnestheticMac;
    check(results, 'volatile-washin-washout', 'Inalatório tem wash-in e wash-out graduais',
      atSteadyState > 0.75 && afterWashout > 0 && afterWashout < atSteadyState * 0.12,
      'aproxima 1 MAC e decai sem desaparecer instantaneamente',
      `MAC em equilíbrio/pós-washout=${atSteadyState.toFixed(2)}/${afterWashout.toFixed(3)}`);
  }
  {
    const patient = createHealthyValidationPatient('canine');
    const make = (): SimulationState => {
      const equipment = protectedEquipment(patient);
      equipment.isVaporizerOn = true;
      equipment.vaporizerDialPct = 0.9;
      return createSimulationState(patient, equipment);
    };
    const inhalant = make();
    const balanced = make();
    administerDrug(balanced, 'fentanyl', 'typical');
    advanceSimulation(inhalant, 300, { dtSeconds: 1 });
    advanceSimulation(balanced, 300, { dtSeconds: 1 });
    check(results, 'mac-sparing', 'Opioide aumenta efeito de uma mesma fração de MAC',
      balanced.vitals.cellularState.hypnoticEffect > inhalant.vitals.cellularState.hypnoticEffect + 0.05
        && balanced.vitals.cellularState.macSparingFraction > 0.25,
      'hipnose maior no mesmo dial e poupança de MAC >25%',
      `hipnose balanceada/isolada=${balanced.vitals.cellularState.hypnoticEffect.toFixed(2)}/${inhalant.vitals.cellularState.hypnoticEffect.toFixed(2)}, MAC-sparing=${balanced.vitals.cellularState.macSparingFraction.toFixed(2)}`);
  }

  // Equine field TIVA combination.
  {
    const patient = createHealthyValidationPatient('equine');
    const state = createSimulationState(patient, protectedEquipment(patient));
    administerDrug(state, 'xylazine', 'typical');
    administerDrug(state, 'ketamine', 'typical');
    administerDrug(state, 'guaifenesin', 'typical');
    advanceSimulation(state, 300, { dtSeconds: 1 });
    check(results, 'equine-triple-drip', 'Xilazina-cetamina-guaifenesina cobre os eixos TIVA',
      state.vitals.cellularState.centralSedation > 0.5
        && state.vitals.cellularState.dissociativeEffect > 0.4
        && state.vitals.cellularState.nociceptiveInhibition > 0.5
        && state.vitals.cellularState.muscleRelaxation > 0.45,
      'sedação, dissociação, analgesia e relaxamento simultâneos',
      `sed=${state.vitals.cellularState.centralSedation.toFixed(2)}, diss=${state.vitals.cellularState.dissociativeEffect.toFixed(2)}, analg=${state.vitals.cellularState.nociceptiveInhibition.toFixed(2)}, relax=${state.vitals.cellularState.muscleRelaxation.toFixed(2)}`);
  }

  // CRI stops input but retains a washout tail.
  {
    const state = runSingle('canine', 'dobutamine', 'typical', 600);
    const ceAtStop = state.doses.find((dose) => dose.drugId === 'dobutamine')?.currentCe || 0;
    stopInfusion(state, 'dobutamine');
    advanceSimulation(state, 300, { dtSeconds: 1 });
    const ceAfter = state.doses.find((dose) => dose.drugId === 'dobutamine')?.currentCe || 0;
    check(results, 'cri-washout', 'Interromper CRI preserva cauda farmacocinética',
      ceAtStop > 0.4 && ceAfter > 0.02 && ceAfter < ceAtStop,
      'Ce decai gradualmente, sem zerar no clique', `Ce parada/pós=${ceAtStop.toFixed(2)}/${ceAfter.toFixed(2)}`);
  }

  // Timestep invariance and continuous hypoxia integration.
  {
    const run = (dtSeconds: number): SimulationState => {
      const patient = createHealthyValidationPatient('canine');
      const state = createSimulationState(patient);
      administerDrug(state, 'acepromazine', 'typical');
      return advanceSimulation(state, 600, { dtSeconds });
    };
    const fine = run(0.1);
    const coarse = run(2);
    check(results, 'timestep-invariance', 'PK/PD é estável entre passos de 0,1 s e 2 s',
      Math.abs(fine.vitals.cellularState.centralSedation - coarse.vitals.cellularState.centralSedation) < 0.04
        && Math.abs(fine.vitals.meanArterialPressure - coarse.vitals.meanArterialPressure) < 4,
      'sedação difere <0,04 e PAM <4 mmHg',
      `sed=${fine.vitals.cellularState.centralSedation.toFixed(3)}/${coarse.vitals.cellularState.centralSedation.toFixed(3)}, PAM=${fine.vitals.meanArterialPressure}/${coarse.vitals.meanArterialPressure}`);
  }
  {
    const patient = createHealthyValidationPatient('canine');
    const state = createSimulationState(patient);
    administerDrug(state, 'atracurium', 'max');
    // At this dose the effect-site concentration crosses the paralytic threshold
    // near 69 s; continue long enough to observe sustained untreated apnea.
    advanceSimulation(state, 105, { dtSeconds: 0.1 });
    check(results, 'continuous-hypoxia', 'Apneia acumula dessaturação em dt=0,1 s',
      state.vitals.pulseOximetrySpO2 < 70 && state.vitals.hypoxiaExposureSeconds > 25
        && state.vitals.arterialBloodGases.lactate > patient.baselineVitals.lactateMmolL,
      'SpO2 cai, contador de hipóxia e lactato sobem',
      `SpO2=${state.vitals.pulseOximetrySpO2.toFixed(1)}, hipóxia=${state.vitals.hypoxiaExposureSeconds.toFixed(1)}s, lactato=${state.vitals.arterialBloodGases.lactate.toFixed(2)}`);
  }

  // All species remain numerically stable without drugs.
  {
    const species: SpeciesType[] = ['canine', 'feline', 'equine', 'bovine', 'rabbit', 'avian'];
    const unstable: string[] = [];
    for (const item of species) {
      const patient = createHealthyValidationPatient(item);
      const state = createSimulationState(patient);
      advanceSimulation(state, 300, { dtSeconds: 1 });
      if (state.vitals.isCardiacArrest || !Number.isFinite(state.vitals.meanArterialPressure) || state.vitals.meanArterialPressure <= 0) unstable.push(item);
    }
    check(results, 'species-baseline', 'Todas as espécies mantêm baseline estável', unstable.length === 0,
      'nenhuma parada/NaN em 5 minutos sem intervenção', `instáveis=${unstable.join(', ') || 'nenhuma'}`);
  }

  // Catalog route metadata itself remains compatible with the route engine.
  {
    const invalid: string[] = [];
    for (const drug of VETERINARY_DRUG_DATABASE) {
      for (const route of drug.supportedRoutes) {
        const routePk = getRoutePharmacokinetics(drug, route);
        if (![routePk.bioavailability, routePk.systemicEffectFraction, routePk.localNeuralEffectFraction].every(Number.isFinite)) {
          invalid.push(`${drug.id}/${route}`);
        }
      }
    }
    check(results, 'route-metadata', 'Todas as vias possuem parâmetros PK finitos', invalid.length === 0,
      'nenhuma via inválida', `inválidas=${invalid.join(', ') || 'nenhuma'}`);
  }

  return results;
}

export function behaviorScenarioSummary(results: BehaviorCheckResult[]): { passed: number; failed: number } {
  return {
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
  };
}
