import assert from 'node:assert/strict';
import test from 'node:test';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import { CellularReceptorsEngine } from '../src/engine/cellularReceptors';
import { getOrganClearanceModifier } from '../src/engine/organClearance';
import {
  createHealthyValidationPatient,
  createSimulationState,
  administerDrug,
  advanceSimulation,
  createActiveDose,
} from '../src/validation/simulationHarness';

test('alpha2-selectivity: xilazina produz significativamente maior ativação alfa-1 residual do que dexmedetomidina', () => {
  const dexSim = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(dexSim, 'dexmedetomidine', 'typical');
  advanceSimulation(dexSim, 180);
  const dexReceptors = CellularReceptorsEngine.computeReceptorState(dexSim.patient, dexSim.doses, 0, 'isoflurane');

  const xylSim = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(xylSim, 'xylazine', 'typical');
  advanceSimulation(xylSim, 180);
  const xylReceptors = CellularReceptorsEngine.computeReceptorState(xylSim.patient, xylSim.doses, 0, 'isoflurane');

  // Ambas ativam alfa-2 produzindo sedação e bradicardia
  assert.ok(dexReceptors.alpha2Drive > 0.35, 'Dexmedetomidina deve ativar alfa-2');
  assert.ok(xylReceptors.alpha2Drive > 0.30, 'Xilazina deve ativar alfa-2');

  // Dexmedetomidina tem alta seletividade alfa-2:alfa-1 (>1600:1) -> mínimo alfa-1
  // Xilazina tem menor refinamento (~160:1) -> ativação alfa-1 residual substancialmente maior
  assert.ok(dexReceptors.alpha1Drive < 0.12, 'Dexmedetomidina deve ter drive alfa-1 residual baixo');
  assert.ok(xylReceptors.alpha1Drive > 0.20, 'Xilazina deve ter drive alfa-1 residual marcante');
  assert.ok(xylReceptors.alpha1Drive > dexReceptors.alpha1Drive * 1.8,
    'Xilazina deve ter ativação alfa-1 muito superior à da dexmedetomidina');
});

test('alpha2-myocardial: xilazina causa maior depressão inotrópica miocárdica direta que dexmedetomidina', () => {
  const dexSim = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(dexSim, 'dexmedetomidine', 'typical');
  advanceSimulation(dexSim, 120);

  const xylSim = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(xylSim, 'xylazine', 'typical');
  advanceSimulation(xylSim, 120);

  // Xilazina possui efeito inotrópico negativo miocárdico direto, resultando em menor Emax
  assert.ok(xylSim.vitals.cellularState.inotropicStateEmax < dexSim.vitals.cellularState.inotropicStateEmax,
    'Xilazina deve causar maior depressão inotrópica miocárdica direta');
});

test('alpha2-cardiac-failure: alfa-2 descompensa gravemente paciente com DCM/ICC por sobrecarga de pós-carga', () => {
  const dcmPatient = createHealthyValidationPatient('canine');
  dcmPatient.pathologyConditions.cardiacFailureDCM = true;

  // Paciente DCM com Dexmedetomidina
  const dcmDexSim = createSimulationState(dcmPatient);
  administerDrug(dcmDexSim, 'dexmedetomidine', 'typical');
  advanceSimulation(dcmDexSim, 180);

  // Paciente DCM com Midazolam (estável hemodinamicamente)
  const dcmBzdSim = createSimulationState(dcmPatient);
  administerDrug(dcmBzdSim, 'midazolam', 'typical');
  advanceSimulation(dcmBzdSim, 180);

  // A pós-carga do alfa-2 reduz drasticamente o débito cardíaco do cardiopata
  assert.ok(dcmDexSim.vitals.cellularState.cardiacOutputLMin < dcmBzdSim.vitals.cellularState.cardiacOutputLMin * 0.70,
    'Alfa-2 deve deprimir criticamente o débito cardíaco no paciente com DCM comparado ao BZD');
  assert.ok(dcmDexSim.vitals.cellularState.systemicVascularResistanceDyne > dcmBzdSim.vitals.cellularState.systemicVascularResistanceDyne * 1.3,
    'Alfa-2 deve elevar maciçamente a RVS');
});

test('phenothiazine-alpha1-blockade: acepromazina bloqueia alfa-1 sem fornecer analgesia', () => {
  const sim = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(sim, 'acepromazine', 'typical');
  advanceSimulation(sim, 300);
  const receptors = CellularReceptorsEngine.computeReceptorState(sim.patient, sim.doses, 0, 'isoflurane');

  // Bloqueio alfa-1 vascular competitivo
  assert.ok(receptors.alpha1Drive < -0.30, 'Acepromazina deve produzir bloqueio alfa-1 negativo');
  // Ausência completa de antinocicepção
  assert.equal(receptors.nociceptiveInhibition, 0, 'Acepromazina não deve fornecer analgesia cirúrgica');
  // Vasodilatação e hipotensão
  assert.ok(sim.vitals.meanArterialPressure < sim.patient.baselineVitals.map - 8,
    'Acepromazina deve induzir redução da PAM por vasodilatação');
});

test('phenothiazine-splenic-hematocrit: acepromazina reduz hematócrito circulante por sequestro esplênico', () => {
  const sim = createSimulationState(createHealthyValidationPatient('canine'));
  const baselineHct = sim.patient.baselineVitals.hctPct;
  administerDrug(sim, 'acepromazine', 'typical');
  advanceSimulation(sim, 300);

  // O relaxamento capsular esplênico induz queda de 10% a 25% no Hct
  assert.ok(sim.vitals.biologicalState.fluids.currentHematocritPct < baselineHct * 0.90,
    'Hematócrito deve cair por sequestro esplênico sob acepromazina');
});

test('phenothiazine-hypovolemic-shock: acepromazina colapsa PAM em choque por anular vasoconstrição reflexa', () => {
  const shockPatient = createHealthyValidationPatient('canine');
  shockPatient.pathologyConditions.hypovolemiaSeverity = 0.55;

  // Choque sem acepromazina: compensação barorreflexa simpática preserva certa pressão
  const simUnsedated = createSimulationState(shockPatient);
  advanceSimulation(simUnsedated, 360);

  // Choque com acepromazina: bloqueio alfa-1 impede vasoconstrição compensatória
  const simAce = createSimulationState(shockPatient);
  administerDrug(simAce, 'acepromazine', 'typical');
  advanceSimulation(simAce, 360);

  assert.ok(simAce.vitals.meanArterialPressure < simUnsedated.vitals.meanArterialPressure - 8,
    'Acepromazina em choque deve colapsar a PAM por perda da compensação alfa-1');
});

test('bzd-hemodynamic-stability: midazolam e diazepam preservam estabilidade cardiovascular', () => {
  const simMid = createSimulationState(createHealthyValidationPatient('canine'));
  const baseMAP = simMid.patient.baselineVitals.map;
  administerDrug(simMid, 'midazolam', 'typical');
  advanceSimulation(simMid, 180);
  const receptors = CellularReceptorsEngine.computeReceptorState(simMid.patient, simMid.doses, 0, 'isoflurane');

  // Estabilidade pressórica e inotrópica
  assert.ok(Math.abs(simMid.vitals.meanArterialPressure - baseMAP) < baseMAP * 0.12,
    'Midazolam deve manter PAM dentro da faixa fisiológica estável');
  assert.ok(simMid.vitals.cellularState.inotropicStateEmax > 0.85,
    'Midazolam não deve deprimir a contratilidade miocárdica');
  assert.ok(receptors.bzdAllostericOccupancy > 0.30,
    'Ocupação alostérica BZD deve ser mensurável');
});

test('bzd-paradoxical-excitation: benzodiazepínico isolado em cão hígido pode desencadear excitação', () => {
  const sim = createSimulationState(createHealthyValidationPatient('canine'));
  administerDrug(sim, 'midazolam', 'typical');
  advanceSimulation(sim, 120);
  const receptors = CellularReceptorsEngine.computeReceptorState(sim.patient, sim.doses, 0, 'isoflurane');

  // Em cão hígido sem opioide associado, midazolam isolado induz excitação paradoxal
  // que atenua a sedação profunda
  assert.ok(receptors.centralSedation < 0.45,
    'Midazolam isolado em cão hígido não deve produzir sedação profunda');
  assert.ok(receptors.muscleRelaxation > 0.40,
    'Midazolam deve fornecer excelente relaxamento muscular');
});

test('opioid-vagal-bradycardia: opioide mu pleno ativa eferência vagal e reverte com atropina ou naloxona', () => {
  const sim = createSimulationState(createHealthyValidationPatient('canine'));
  const baseHR = sim.patient.baselineVitals.hr;
  administerDrug(sim, 'fentanyl', 'typical');
  advanceSimulation(sim, 120);
  const receptors = CellularReceptorsEngine.computeReceptorState(sim.patient, sim.doses, 0, 'isoflurane');

  // Bradicardia vagal via receptores M2
  assert.ok(sim.vitals.heartRate < baseHR - 8, 'Fentanil deve diminuir a frequência cardíaca');
  assert.ok(receptors.m2Drive > 0.10, 'Fentanil deve induzir tônus vagal M2');

  // Reversão com Naloxona
  administerDrug(sim, 'naloxone', 'typical');
  advanceSimulation(sim, 120);
  const postRevReceptors = CellularReceptorsEngine.computeReceptorState(sim.patient, sim.doses, 0, 'isoflurane');
  assert.ok(sim.vitals.heartRate >= baseHR - 8, 'Naloxona deve restabelecer a FC');
  assert.ok(postRevReceptors.nociceptiveInhibition < 0.25, 'Naloxona deve antagonizar substancialmente a antinocicepção');
});

test('opioid-histamine-contrast: morfina em bolus rápido libera histamina vs fentanil e metadona', () => {
  const simMorphine = createSimulationState(createHealthyValidationPatient('canine'));
  simMorphine.doses.push(createActiveDose(simMorphine.patient, 'morphine', 'typical', { route: 'IV_slow', speed: 'bolus_rapid' }));
  advanceSimulation(simMorphine, 12);
  const morphReceptors = CellularReceptorsEngine.computeReceptorState(simMorphine.patient, simMorphine.doses, 0, 'isoflurane');

  const simFentanyl = createSimulationState(createHealthyValidationPatient('canine'));
  simFentanyl.doses.push(createActiveDose(simFentanyl.patient, 'fentanyl', 'typical', { route: 'IV', speed: 'bolus_rapid' }));
  advanceSimulation(simFentanyl, 12);
  const fentReceptors = CellularReceptorsEngine.computeReceptorState(simFentanyl.patient, simFentanyl.doses, 0, 'isoflurane');

  assert.ok(morphReceptors.histamineRelease > 0.35, 'Morfina IV rápida deve liberar histamina');
  assert.equal(fentReceptors.histamineRelease, 0, 'Fentanil não deve liberar histamina');
});

test('hepatic-impairment: disfunção hepática reduz depuração de fármacos e prolonga biofase', () => {
  const healthyPatient = createHealthyValidationPatient('canine');
  const hepaticPatient = createHealthyValidationPatient('canine');
  hepaticPatient.pathologyConditions.hepaticDysfunctionSeverity = 0.85;

  const healthySim = createSimulationState(healthyPatient);
  const hepaticSim = createSimulationState(hepaticPatient);

  const midazolam = VETERINARY_DRUG_DATABASE.find(d => d.id === 'midazolam')!;
  const healthyClearance = getOrganClearanceModifier(healthyPatient, midazolam, healthySim.vitals.biologicalState, 38);
  const hepaticClearance = getOrganClearanceModifier(hepaticPatient, midazolam, hepaticSim.vitals.biologicalState, 38);

  assert.ok(hepaticClearance < healthyClearance * 0.50,
    'Comprometimento hepático severo deve reduzir drasticamente a depuração de midazolam');
});
