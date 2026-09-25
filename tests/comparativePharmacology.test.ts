import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHealthyValidationPatient,
  createSimulationState,
  administerDrug,
  advanceSimulation,
  summarizeTrace,
  createActiveDose,
  createDefaultEquipment,
} from '../src/validation/simulationHarness';
import { CellularReceptorsEngine } from '../src/engine/cellularReceptors';

test('Comparativo Hemodinâmico: Vasopressores e Inotrópicos vs Vasodilatador Direto', () => {
  const canine = createHealthyValidationPatient('canine');
  const baseMAP = canine.baselineVitals.map;
  const baseHR = canine.baselineVitals.hr;

  // 1. Noradrenalina (Vasopressor Alfa-1 > Beta-1)
  const noraState = createSimulationState(canine);
  administerDrug(noraState, 'norepinephrine', 'typical', { route: 'CRI' });
  advanceSimulation(noraState, 180, { dtSeconds: 1 });
  const noraTrace = summarizeTrace(noraState.frames);

  assert.ok(
    noraTrace.maxMap > baseMAP + 10,
    `Noradrenalina deve elevar a PAM significativamente (base: ${baseMAP}, obtido: ${noraTrace.maxMap})`
  );
  assert.ok(
    noraState.vitals.cellularState.systemicVascularResistanceDyne > 3100,
    `Noradrenalina deve elevar a RVP por vasoconstrição alfa-1 (obtido: ${noraState.vitals.cellularState.systemicVascularResistanceDyne})`
  );

  // 2. Dobutamina (Inotrópico Positivo Beta-1 seletivo)
  const dobutaState = createSimulationState(canine);
  administerDrug(dobutaState, 'dobutamine', 'typical', { route: 'CRI' });
  advanceSimulation(dobutaState, 180, { dtSeconds: 1 });
  const dobutaTrace = summarizeTrace(dobutaState.frames);

  assert.ok(
    dobutaState.vitals.cellularState.intracellularCalcium > 1.02 || dobutaState.vitals.cellularState.inotropicStateEmax > 1.02,
    'Dobutamina deve aumentar a contratilidade miocárdica (inotropismo positivo)'
  );
  assert.ok(
    dobutaTrace.maxHeartRate >= baseHR,
    'Dobutamina deve manter ou elevar moderadamente a FC'
  );

  // 3. Nitroprussiato de Sódio (Vasodilatador Direto / Anti-hipertensivo potente)
  const niprideState = createSimulationState(canine);
  administerDrug(niprideState, 'sodium_nitroprusside', 'typical', { route: 'CRI' });
  advanceSimulation(niprideState, 180, { dtSeconds: 1 });
  const niprideTrace = summarizeTrace(niprideState.frames);

  assert.ok(
    niprideTrace.minMap < baseMAP,
    `Nitroprussiato deve reduzir agudamente a PAM (base: ${baseMAP}, obtido: ${niprideTrace.minMap})`
  );
  const highNipride = createSimulationState(canine);
  administerDrug(highNipride, 'sodium_nitroprusside', 'max', { route: 'CRI' });
  advanceSimulation(highNipride, 180, { dtSeconds: 1 });
  assert.ok(summarizeTrace(highNipride.frames).minMap < niprideTrace.minMap,
    'Maior taxa de nitroprussiato deve produzir maior queda de PAM no mesmo paciente');
  assert.ok(
    niprideState.vitals.cellularState.systemicVascularResistanceDyne < 2700,
    `Nitroprussiato deve reduzir a RVP por vasodilatação direta (obtido: ${niprideState.vitals.cellularState.systemicVascularResistanceDyne} dynes)`
  );
  assert.ok(
    niprideTrace.maxHeartRate > baseHR,
    `Hipotensão por nitroprussiato deve induzir taquicardia compensatória reflexa (base: ${baseHR}, obtido: ${niprideTrace.maxHeartRate})`
  );

  // 4. Efedrina (Ação adrenérgica mista com taquifilaxia)
  const ephedrineState = createSimulationState(canine);
  administerDrug(ephedrineState, 'ephedrine', 'typical', { route: 'IV_slow' });
  advanceSimulation(ephedrineState, 120, { dtSeconds: 1 });
  const firstDoseMap = ephedrineState.vitals.meanArterialPressure;
  const delta1 = firstDoseMap - baseMAP;

  // Doses repetidas para verificar taquifilaxia
  administerDrug(ephedrineState, 'ephedrine', 'typical', { route: 'IV_slow' });
  advanceSimulation(ephedrineState, 120, { dtSeconds: 1 });
  administerDrug(ephedrineState, 'ephedrine', 'typical', { route: 'IV_slow' });
  advanceSimulation(ephedrineState, 120, { dtSeconds: 1 });

  assert.ok(
    delta1 > 5,
    `Primeira dose de efedrina deve elevar a PAM (delta: +${delta1.toFixed(1)} mmHg)`
  );
  assert.ok(
    ephedrineState.vitals.meanArterialPressure > baseMAP && ephedrineState.vitals.heartRate >= baseHR,
    'Efedrina deve sustentar pressão arterial e frequência cardíaca'
  );
});

test('Matriz Comparativa de Indutores: Propofol vs Alfaxolona vs Cetamina vs Etomidato', () => {
  const canine = createHealthyValidationPatient('canine');
  const baseMAP = canine.baselineVitals.map;
  const baseHR = canine.baselineVitals.hr;

  // Pacientes com vias aéreas protegidas para indução
  const makeInductionState = () => {
    const eq = createDefaultEquipment(canine, {
      intubationStatus: 'intubated_tracheal',
      cuffPressureCmH2O: 18,
      ventilatorMode: 'cmv_volume',
      isVentilatorActive: true,
    });
    return createSimulationState(canine, eq);
  };

  // 1. Propofol (4.0 mg/kg IV)
  const propState = makeInductionState();
  administerDrug(propState, 'propofol', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });
  advanceSimulation(propState, 120, { dtSeconds: 1 });
  const propTrace = summarizeTrace(propState.frames);

  // 2. Alfaxolona (2.0 mg/kg IV)
  const alfaxState = makeInductionState();
  administerDrug(alfaxState, 'alfaxalone', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });
  advanceSimulation(alfaxState, 120, { dtSeconds: 1 });
  const alfaxTrace = summarizeTrace(alfaxState.frames);

  // 3. Etomidato (1.0 mg/kg IV)
  const etomidateState = makeInductionState();
  administerDrug(etomidateState, 'etomidate', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });
  advanceSimulation(etomidateState, 120, { dtSeconds: 1 });
  const etomidateTrace = summarizeTrace(etomidateState.frames);

  // 4. Cetamina (5.0 mg/kg IV)
  const ketState = makeInductionState();
  administerDrug(ketState, 'ketamine', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });
  advanceSimulation(ketState, 120, { dtSeconds: 1 });
  const ketTrace = summarizeTrace(ketState.frames);

  // Todos os 4 indutores devem atingir perda de consciência cirúrgica ou dissociação profunda
  assert.equal(propTrace.minConsciousness, 0, 'Propofol deve zerar consciência');
  assert.equal(alfaxTrace.minConsciousness, 0, 'Alfaxolona deve zerar consciência');
  assert.equal(etomidateTrace.minConsciousness, 0, 'Etomidato deve zerar consciência');
  assert.ok(
    ketTrace.minConsciousness <= 40 && ketState.vitals.cellularState.dissociativeEffect > 0.40,
    'Cetamina deve atingir plano dissociativo com dissociação cortical profunda'
  );

  // A. Etomidato deve apresentar a maior estabilidade hemodinâmica (delta PAM mínima)
  const etomidateDeltaMap = Math.abs(etomidateTrace.minMap - baseMAP);
  assert.ok(
    etomidateDeltaMap <= 8,
    `Etomidato deve preservar a PAM sem choque hipotensivo (delta: ${etomidateDeltaMap.toFixed(1)} mmHg)`
  );
  assert.ok(
    etomidateState.vitals.cellularState.intracellularCalcium >= 0.90,
    'Etomidato deve preservar o inotropismo miocárdico basal'
  );

  // B. Cetamina deve produzir suporte simpático (FC e PAM superiores ao basal)
  assert.ok(
    ketTrace.maxHeartRate >= baseHR,
    `Cetamina deve sustentar/elevar a FC (base: ${baseHR}, máx: ${ketTrace.maxHeartRate})`
  );
  assert.ok(
    ketTrace.maxMap >= baseMAP - 2,
    'Cetamina não deve causar vasodilatação hipotensiva'
  );

  // C. Propofol causa vasodilatação fisiológica mais pronunciada
  assert.ok(
    propTrace.minMap < baseMAP - 12,
    `Propofol deve produzir vasodilatação esperada (base: ${baseMAP}, mín: ${propTrace.minMap})`
  );

  // D. Alfaxolona preserva a pressão melhor que o propofol
  assert.ok(
    alfaxTrace.minMap >= propTrace.minMap - 2,
    `Alfaxolona deve manter perfil hemodinâmico estável frente ao propofol (${alfaxTrace.minMap} vs ${propTrace.minMap})`
  );
});

test('Reversões Farmacológicas Rápidas e Seletividade de Antagonistas', () => {
  const canine = createHealthyValidationPatient('canine');

  // 1. Reversão de Alfa-2: Atipamezol vs Dexmedetomidina
  {
    const dexState = createSimulationState(canine);
    administerDrug(dexState, 'dexmedetomidine', 'typical');
    advanceSimulation(dexState, 240, { dtSeconds: 1 });
    const sedBefore = dexState.vitals.cellularState.centralSedation;
    const hrBefore = dexState.vitals.heartRate;

    assert.ok(hrBefore <= 68, `Dexmedetomidina deve induzir bradicardia reflexa (obtido: ${hrBefore})`);

    // Administra Atipamezol
    administerDrug(dexState, 'atipamezole', 'typical');
    // IM reversal requires absorption; assess after five minutes.
    advanceSimulation(dexState, 300, { dtSeconds: 1 });

    assert.ok(
      dexState.vitals.heartRate > hrBefore * 1.15,
      `Atipamezol deve reduzir progressivamente a bradicardia (antes: ${hrBefore}, depois: ${dexState.vitals.heartRate})`
    );
    assert.ok(
      dexState.vitals.cellularState.centralSedation < sedBefore * 0.45,
      'Atipamezol deve reduzir a sedação em mais de 55%'
    );
  }

  // 2. Reversão de Opioide: Naloxona vs Fentanil
  {
    const fentState = createSimulationState(canine);
    administerDrug(fentState, 'fentanyl', 'typical');
    advanceSimulation(fentState, 180, { dtSeconds: 1 });
    const analgesiaBefore = fentState.vitals.cellularState.nociceptiveInhibition;
    const rrBefore = fentState.vitals.respiratoryRate;

    assert.ok(analgesiaBefore > 0.60, 'Fentanil deve fornecer forte analgesia');

    // Administra Naloxona
    administerDrug(fentState, 'naloxone', 'typical');
    advanceSimulation(fentState, 90, { dtSeconds: 1 });

    assert.ok(
      fentState.vitals.cellularState.nociceptiveInhibition < analgesiaBefore * 0.35,
      'Naloxona deve reverter imediatamente a analgesia do fentanil'
    );
    assert.ok(
      fentState.vitals.respiratoryRate >= rrBefore,
      'Naloxona deve restaurar a ventilação espontânea'
    );
  }

  // 3. Reversão de Benzodiazepínico: Flumazenil vs Midazolam e Seletividade vs Propofol
  {
    const midState = createSimulationState(canine);
    administerDrug(midState, 'midazolam', 'typical');
    advanceSimulation(midState, 180, { dtSeconds: 1 });
    const relaxBefore = midState.vitals.cellularState.muscleRelaxation;

    // Administra Flumazenil
    administerDrug(midState, 'flumazenil', 'typical');
    advanceSimulation(midState, 90, { dtSeconds: 1 });

    assert.ok(
      midState.vitals.cellularState.muscleRelaxation < relaxBefore * 0.40,
      'Flumazenil deve reverter o relaxamento muscular do midazolam'
    );

    // Teste de seletividade: Flumazenil NÃO deve reverter a hipnose do propofol
    const propState = createSimulationState(canine);
    administerDrug(propState, 'propofol', 'typical');
    advanceSimulation(propState, 120, { dtSeconds: 1 });
    const propDepthBefore = propState.vitals.anestheticDepthScore;

    administerDrug(propState, 'flumazenil', 'typical');
    advanceSimulation(propState, 60, { dtSeconds: 1 });
    const propDepthAfter = propState.vitals.anestheticDepthScore;

    assert.ok(
      Math.abs(propDepthAfter - propDepthBefore) < 5,
      'Flumazenil não deve alterar a profundidade anestésica do propofol'
    );
  }

  // 4. Reversão de Bloqueio Neuromuscular: Neostigmina vs Atracúrio
  {
    const eq = createDefaultEquipment(canine, {
      intubationStatus: 'intubated_tracheal',
      cuffPressureCmH2O: 18,
      ventilatorMode: 'cmv_volume',
      isVentilatorActive: true,
    });
    const nmbaState = createSimulationState(canine, eq);
    administerDrug(nmbaState, 'atracurium', 'typical');
    advanceSimulation(nmbaState, 180, { dtSeconds: 1 });

    assert.ok(nmbaState.vitals.trainOfFourCount <= 2, `Atracúrio deve induzir bloqueio neuromuscular evidente (obtido TOF: ${nmbaState.vitals.trainOfFourCount})`);

    // Reverte com Neostigmina + Atropina (para evitar colapso colinérgico muscarínico)
    administerDrug(nmbaState, 'atropine', 'typical');
    administerDrug(nmbaState, 'neostigmine', 'typical');
    advanceSimulation(nmbaState, 240, { dtSeconds: 1 });

    assert.ok(
      nmbaState.vitals.trainOfFourCount >= 3,
      `Neostigmina deve recuperar o Train-of-Four (obtido: ${nmbaState.vitals.trainOfFourCount})`
    );
  }

  // 5. Reversão de LAST: Emulsão Lipídica 20% vs Bupivacaína
  {
    const bupiDose = createActiveDose(canine, 'bupivacaine_05', 'max', { route: 'Local', dosePerKg: 6 });
    bupiDose.route = 'IV_slow'; // injeção intravascular inadvertida
    bupiDose.currentCe = 5.0;

    const lipidDose = createActiveDose(canine, 'lipid_emulsion_20', 'typical', { route: 'IV' });
    lipidDose.currentCe = 1.0;

    const intoxicated = CellularReceptorsEngine.computeReceptorState(canine, [bupiDose], 0, 'isoflurane');
    const rescued = CellularReceptorsEngine.computeReceptorState(canine, [bupiDose, lipidDose], 0, 'isoflurane');

    assert.ok(
      rescued.naVBlockade < intoxicated.naVBlockade * 0.55,
      `Emulsão lipídica 20% deve sequestrar bupivacaína e reduzir o bloqueio NaV tóxico em >45% (${intoxicated.naVBlockade.toFixed(2)} -> ${rescued.naVBlockade.toFixed(2)})`
    );
  }
});

test('Sinergismos Multimodais: Protocolo FLK, Cetamina + Benzodiazepínico e Neuroleptanalgesia', () => {
  const canine = createHealthyValidationPatient('canine');

  // 1. Protocolo FLK (Fentanil + Lidocaína + Cetamina em infusão contínua)
  {
    const flkState = createSimulationState(canine);
    // The early multimodal response includes explicitly prescribed loading doses.
    administerDrug(flkState, 'fentanyl', 'typical', { route: 'IV' });
    administerDrug(flkState, 'lidocaine_2pct', 'typical', { route: 'IV_slow' });
    administerDrug(flkState, 'ketamine', 'typical', { route: 'IV' });
    administerDrug(flkState, 'fentanyl', 'typical', { route: 'CRI' });
    administerDrug(flkState, 'lidocaine_2pct', 'typical', { route: 'CRI' });
    administerDrug(flkState, 'ketamine', 'typical', { route: 'CRI' });
    advanceSimulation(flkState, 300, { dtSeconds: 1 });

    assert.ok(
      flkState.vitals.cellularState.nociceptiveInhibition > 0.80,
      `FLK deve fornecer inibição nociceptiva multimodal quase completa (obtido: ${flkState.vitals.cellularState.nociceptiveInhibition.toFixed(2)})`
    );
    assert.ok(
      flkState.vitals.cellularState.macSparingFraction > 0.40,
      `FLK deve proporcionar poupança de CAM (MAC-sparing) superior a 40% (obtido: ${(flkState.vitals.cellularState.macSparingFraction * 100).toFixed(0)}%)`
    );
  }

  // 2. Cetamina + Midazolam (Abolição da rigidez cataleptóide)
  {
    const ketAlone = createSimulationState(canine);
    administerDrug(ketAlone, 'ketamine', 'typical');
    advanceSimulation(ketAlone, 180, { dtSeconds: 1 });

    const ketCombo = createSimulationState(canine);
    administerDrug(ketCombo, 'ketamine', 'typical');
    administerDrug(ketCombo, 'midazolam', 'typical');
    advanceSimulation(ketCombo, 180, { dtSeconds: 1 });

    assert.ok(
      ketAlone.vitals.cellularState.muscleRelaxation <= 0.05,
      'Cetamina isolada não deve permitir relaxamento muscular adequado (hipertonia/rigidez)'
    );
    assert.ok(
      ketCombo.vitals.cellularState.muscleRelaxation > 0.25,
      'Adição de Midazolam deve converter rigidez em relaxamento cirúrgico suave'
    );
    assert.ok(
      ketCombo.vitals.cellularState.dissociativeEffect > 0.35,
      'Plano dissociativo da cetamina deve permanecer intacto na associação'
    );
  }

  // 3. Neuroleptanalgesia: Acepromazina + Metadona
  {
    const aceState = createSimulationState(canine);
    administerDrug(aceState, 'acepromazine', 'typical');
    advanceSimulation(aceState, 240, { dtSeconds: 1 });

    const metState = createSimulationState(canine);
    administerDrug(metState, 'methadone', 'typical');
    advanceSimulation(metState, 240, { dtSeconds: 1 });

    const comboState = createSimulationState(canine);
    administerDrug(comboState, 'acepromazine', 'typical');
    administerDrug(comboState, 'methadone', 'typical');
    advanceSimulation(comboState, 240, { dtSeconds: 1 });

    assert.ok(
      comboState.vitals.cellularState.centralSedation > Math.max(
        aceState.vitals.cellularState.centralSedation,
        metState.vitals.cellularState.centralSedation
      ),
      'Sedação combinada da neuroleptanalgesia deve superar monoterapias'
    );
    assert.ok(
      comboState.vitals.cellularState.nociceptiveInhibition > 0.50,
      'Metadona deve garantir analgesia visceral potente na neuroleptanalgesia'
    );
  }
});

test('Cinética de Despertar e Duração Clínica: Propofol em bólus único emerge em 10-15 min e respeita dependência de dose', () => {
  const canine = createHealthyValidationPatient('canine');

  // 1. Bólus típico (4 mg/kg)
  const stateTypical = createSimulationState(canine);
  administerDrug(stateTypical, 'propofol', 'typical', { route: 'IV_slow' });

  // 2 minutos: pico de indução cirúrgica
  advanceSimulation(stateTypical, 120, { dtSeconds: 1 });
  const dose2m = stateTypical.doses.find((d) => d.drugId === 'propofol')!;
  assert.ok(dose2m.currentCe > 0.65, `Ce aos 2 min deve ser cirúrgica; obtido=${dose2m.currentCe.toFixed(3)}`);
  assert.equal(stateTypical.vitals.consciousnessScore, 0, 'Paciente deve estar inconsciente no pico');

  // 10 minutos (600s): início da fase de emergência (Ce deve estar em declínio acentuado por redistribuição e eliminação)
  advanceSimulation(stateTypical, 480, { dtSeconds: 1 });
  const dose10m = stateTypical.doses.find((d) => d.drugId === 'propofol')!;
  assert.ok(
    dose10m.currentCe < 0.25,
    `Ce aos 10 min deve ter caído abaixo de 0.25 para permitir emergência; obtido=${dose10m.currentCe.toFixed(3)}`
  );

  // 15 minutos (900s): paciente desperto / em recuperação superficial (Ce < 0.15)
  advanceSimulation(stateTypical, 300, { dtSeconds: 1 });
  const dose15m = stateTypical.doses.find((d) => d.drugId === 'propofol')!;
  assert.ok(
    dose15m.currentCe < 0.15,
    `Ce aos 15 min deve ser sub-hipnótica (<0.15); obtido=${dose15m.currentCe.toFixed(3)}`
  );
  assert.ok(
    stateTypical.vitals.consciousnessScore > 0,
    `Consciência aos 15 min deve estar retornando; obtido=${stateTypical.vitals.consciousnessScore}`
  );

  // 2. Dependência de dose: Dose máxima (6 mg/kg) deve produzir duração de hipnose mais longa que a típica (4 mg/kg)
  const stateHigh = createSimulationState(canine);
  administerDrug(stateHigh, 'propofol', 'max', { route: 'IV_slow' });
  advanceSimulation(stateHigh, 600, { dtSeconds: 1 }); // aos 10 min
  const doseHigh10m = stateHigh.doses.find((d) => d.drugId === 'propofol')!;
  assert.ok(
    doseHigh10m.currentCe > dose10m.currentCe * 1.25,
    `Dose máxima deve manter Ce superior aos 10 min frente à dose típica; dose típica=${dose10m.currentCe.toFixed(3)}, dose max=${doseHigh10m.currentCe.toFixed(3)}`
  );
});

test('Dissociação Temporal de Opioides Puros (Metadona e Morfina): Sedação Aguda Inicial vs. Analgesia Cirúrgica Sustentada', () => {
  const canine = createHealthyValidationPatient('canine');
  const state = createSimulationState(canine);
  administerDrug(state, 'methadone', 'typical');

  // 15 min: sedação aguda evidente e analgesia cirúrgica forte
  advanceSimulation(state, 900, { dtSeconds: 2 });
  const sed15m = state.vitals.cellularState.centralSedation;
  const analg15m = state.vitals.cellularState.nociceptiveInhibition;

  assert.ok(sed15m > 0.18, `Sedação aguda aos 15 min deve ser expressiva (>0.18); obtido=${sed15m.toFixed(3)}`);
  assert.ok(analg15m > 0.45, `Analgesia aos 15 min deve ser robusta (>0.45); obtido=${analg15m.toFixed(3)}`);

  // 90 min: sedação aguda dissipa-se fortemente (<0.10) enquanto analgesia permanece estável
  advanceSimulation(state, 4500, { dtSeconds: 5 });
  const sed90m = state.vitals.cellularState.centralSedation;
  const analg90m = state.vitals.cellularState.nociceptiveInhibition;

  assert.ok(
    sed90m < 0.10,
    `Sedação aos 90 min deve ter regredido drasticamente (<0.10); obtido=${sed90m.toFixed(3)}`
  );
  assert.ok(
    analg90m > 0.18,
    `Analgesia aos 90 min deve permanecer clinicamente relevante (>0.18); obtido=${analg90m.toFixed(3)}`
  );
  assert.ok(
    sed90m < sed15m * 0.40,
    `Sedação aos 90 min deve ser inferior a 40% do pico inicial (dissociação temporal); obtido=${(sed90m / sed15m * 100).toFixed(1)}%`
  );
});

test('Divergência de Espécies do Tramadol: Eficácia µ-Opioide Robusta em Felinos vs. Analgesia Predominantemente Monoaminérgica em Caninos', () => {
  const canine = createHealthyValidationPatient('canine');
  const feline = createHealthyValidationPatient('feline');

  const dogState = createSimulationState(canine);
  administerDrug(dogState, 'tramadol', 'typical');
  advanceSimulation(dogState, 900, { dtSeconds: 2 });

  const catState = createSimulationState(feline);
  administerDrug(catState, 'tramadol', 'typical');
  advanceSimulation(catState, 900, { dtSeconds: 2 });

  const dogAnalg = dogState.vitals.cellularState.nociceptiveInhibition;
  const catAnalg = catState.vitals.cellularState.nociceptiveInhibition;
  const dogSed = dogState.vitals.cellularState.centralSedation;
  const catSed = catState.vitals.cellularState.centralSedation;

  // Cão: baixa formação de M1 por CYP2D15 -> analgesia monoaminérgica modesta (~0.18 - 0.25)
  assert.ok(
    dogAnalg >= 0.15 && dogAnalg <= 0.30,
    `Canino sob tramadol deve apresentar analgesia modesta/monoaminérgica (0.15-0.30); obtido=${dogAnalg.toFixed(3)}`
  );
  assert.ok(
    dogSed < 0.05,
    `Canino não deve manifestar sedação opioide relevante com tramadol (<0.05); obtido=${dogSed.toFixed(3)}`
  );

  // Gato: alta formação de M1 -> analgesia µ-opioide potente (>0.40)
  assert.ok(
    catAnalg > 0.40,
    `Felino sob tramadol deve converter M1 e apresentar analgesia potente (>0.40); obtido=${catAnalg.toFixed(3)}`
  );
  assert.ok(
    catAnalg > dogAnalg * 1.8,
    `Analgesia felina do tramadol deve superar a canina em pelo menos 80% pela via M1 (obtido: gato=${catAnalg.toFixed(3)} vs cão=${dogAnalg.toFixed(3)})`
  );
  assert.ok(
    catSed > dogSed * 2.0,
    `Felino deve apresentar efeito central superior ao canino devido ao agonismo µ de M1`
  );
});
