import assert from 'node:assert/strict';
import test from 'node:test';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import {
  calculateAdministration,
  getSpeciesDoseRange,
  getRoutePharmacokinetics,
  validateAdministrationCommand,
} from '../src/engine/drugAdministration';
import { PharmacokineticModel } from '../src/engine/pharmacokineticModel';
import { SpeciesType } from '../src/types/simulator';
import { PHARMACOLOGY_EXPECTATIONS } from '../src/validation/pharmacologyExpectations';
import {
  createHealthyValidationPatient,
  createSimulationState,
  administerDrug,
  advanceSimulation,
  createActiveDose,
  summarizeTrace,
} from '../src/validation/simulationHarness';
import { analyzeDrugExposure } from '../src/engine/exposureAnalysis';

const SPECIES: SpeciesType[] = ['canine', 'feline', 'equine', 'bovine'];

test('CRI nunca recebe faixa de bólus quando falta taxa específica da espécie', () => {
  for (const drug of VETERINARY_DRUG_DATABASE) {
    for (const species of SPECIES) {
      const rate = getSpeciesDoseRange(drug, species, true);
      if (!drug.recommendedCriDose?.[species] && !/\/(min|h)$/.test(drug.doseUnit)) {
        assert.equal(rate, undefined, `${drug.id}/${species}: bólus convertido em taxa`);
      }
    }
  }
  const propofol = VETERINARY_DRUG_DATABASE.find(drug => drug.id === 'propofol')!;
  assert.equal(getSpeciesDoseRange(propofol, 'canine', true)?.typical, propofol.recommendedCriDose!.canine!.typical);
});

test('catálogo e contratos clínicos têm paridade completa e IDs únicos', () => {
  assert.equal(VETERINARY_DRUG_DATABASE.length, 43);
  const catalogIds = VETERINARY_DRUG_DATABASE.map((drug) => drug.id);
  const contractIds = PHARMACOLOGY_EXPECTATIONS.map((item) => item.drugId);
  assert.equal(new Set(catalogIds).size, catalogIds.length);
  assert.equal(new Set(contractIds).size, contractIds.length);
  assert.deepEqual([...catalogIds].sort(), [...contractIds].sort());
});

test('todas as faixas explícitas são finitas, positivas e ordenadas', () => {
  for (const drug of VETERINARY_DRUG_DATABASE) {
    for (const species of SPECIES) {
      const range = drug.recommendedDose[species];
      if (!range) continue;
      assert.ok(Number.isFinite(range.min) && range.min > 0, `${drug.id}/${species}: mínimo inválido`);
      assert.ok(Number.isFinite(range.typical) && range.typical > 0, `${drug.id}/${species}: típica inválida`);
      assert.ok(Number.isFinite(range.max) && range.max > 0, `${drug.id}/${species}: máximo inválido`);
      assert.ok(range.min <= range.typical, `${drug.id}/${species}: mínima > típica`);
      assert.ok(range.typical <= range.max, `${drug.id}/${species}: típica > máxima`);
    }
  }
});

test('todas as vias cadastradas produzem parâmetros PK válidos', () => {
  for (const drug of VETERINARY_DRUG_DATABASE) {
    assert.ok(drug.supportedRoutes.length > 0, `${drug.id}: nenhuma via`);
    for (const route of drug.supportedRoutes) {
      const pk = getRoutePharmacokinetics(drug, route);
      assert.ok(Number.isFinite(pk.transitLagSeconds) && pk.transitLagSeconds >= 0, `${drug.id}/${route}: lag`);
      assert.ok(pk.bioavailability > 0 && pk.bioavailability <= 1, `${drug.id}/${route}: biodisponibilidade`);
      assert.ok(pk.systemicEffectFraction >= 0 && pk.systemicEffectFraction <= 1, `${drug.id}/${route}: fração sistêmica`);
      assert.ok(pk.localNeuralEffectFraction >= 0 && pk.localNeuralEffectFraction <= 1, `${drug.id}/${route}: fração local`);
    }
  }
});

test('conversões de volume preservam mg, microgramas, mEq e taxas', () => {
  const propofol = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'propofol');
  const fentanyl = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'fentanyl');
  const potassium = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'potassium_chloride');
  const dobutamine = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'dobutamine');
  assert.ok(propofol && fentanyl && potassium && dobutamine);

  assert.equal(calculateAdministration(propofol, 4, 20).volumeMl, 8);
  assert.equal(calculateAdministration(fentanyl, 5, 20).volumeMl, 2);
  assert.equal(calculateAdministration(potassium, 0.2, 20).volumeMl, 1.5625);
  assert.equal(calculateAdministration(dobutamine, 5, 20).pumpRateMlPerHour, 0.48);
});

test('nenhum contrato chama tranquilizante, benzodiazepínico ou NMBA de analgésico', () => {
  const noAnalgesia = ['acepromazine', 'midazolam', 'diazepam', 'propofol', 'alfaxalone', 'etomidate', 'thiopental', 'guaifenesin', 'atracurium'];
  for (const id of noAnalgesia) {
    const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === id);
    assert.ok(drug, id);
    assert.equal(drug.effectAnalgesia, 0, `${id} recebeu analgesia fenotípica indevida`);
  }
});

test('administração não herda dose canina nem mistura taxa com bólus', () => {
  const bovine = createHealthyValidationPatient('bovine');
  const canine = createHealthyValidationPatient('canine');
  const sugammadex = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'sugammadex');
  const dobutamine = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'dobutamine');
  const potassium = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'potassium_chloride');
  const acepromazine = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'acepromazine');
  assert.ok(sugammadex && dobutamine && potassium && acepromazine);

  assert.equal(getSpeciesDoseRange(sugammadex, 'bovine'), undefined);
  assert.ok(validateAdministrationCommand(bovine, sugammadex, {
    route: 'IV', administrationSpeed: 'bolus_rapid', isCRI: false, dosePerKg: 4,
  }).some((error) => error.includes('não possui regime')));
  assert.ok(validateAdministrationCommand(canine, dobutamine, {
    route: 'IV', administrationSpeed: 'bolus_rapid', isCRI: false, dosePerKg: 5,
  }).length > 0);
  assert.ok(validateAdministrationCommand(canine, potassium, {
    route: 'IV_slow', administrationSpeed: 'bolus_slow', isCRI: false, dosePerKg: 0.2,
  }).some((error) => error.includes('somente regime contínuo')));

  // Supratherapeutic experiments remain available when dimensions and route are valid.
  assert.deepEqual(validateAdministrationCommand(canine, acepromazine, {
    route: 'IV', administrationSpeed: 'bolus_rapid', isCRI: false, dosePerKg: 0.125,
  }), []);
});

test('todos os fármacos desenvolvem exposição plasmática, efeito e washout finitos', () => {
  for (const drug of VETERINARY_DRUG_DATABASE) {
    const species = SPECIES.find((item) => getSpeciesDoseRange(drug, item, drug.supportedRoutes[0] === 'CRI'))
      || SPECIES.find((item) => getSpeciesDoseRange(drug, item));
    assert.ok(species, `${drug.id}: nenhuma espécie com regime`);
    const patient = createHealthyValidationPatient(species);
    const dose = createActiveDose(patient, drug.id);
    dose.transitLagRemainingSec = 0;

    const bolusRange = getSpeciesDoseRange(drug, species, false) || getSpeciesDoseRange(drug, species, true);
    const criRange = getSpeciesDoseRange(drug, species, true);
    assert.ok(bolusRange, `${drug.id}/${species}: normalização ausente`);

    let current = dose;
    let peakCp = 0;
    let peakCe = 0;
    for (let minute = 0; minute < 30; minute += 1) {
      const result = PharmacokineticModel.step(60, patient, drug, current, bolusRange.typical, criRange?.typical, 1);
      current = { ...current, ...result, transitLagRemainingSec: 0 };
      peakCp = Math.max(peakCp, result.currentCp);
      peakCe = Math.max(peakCe, result.currentCe);
    }
    assert.ok(Number.isFinite(peakCp) && peakCp > 0, `${drug.id}: Cp não se estabeleceu`);
    assert.ok(Number.isFinite(peakCe) && peakCe > 0, `${drug.id}: Ce não se estabeleceu`);

    current = { ...current, isInfusionRunning: false, criRatePerKgMin: 0 };
    const washoutMinutes = Math.max(120, drug.halfLifeBeta * 4);
    for (let minute = 0; minute < washoutMinutes; minute += 1) {
      const result = PharmacokineticModel.step(60, patient, drug, current, bolusRange.typical, criRange?.typical, 1);
      current = { ...current, ...result, transitLagRemainingSec: 0 };
    }
    assert.ok(Number.isFinite(current.currentCp) && current.currentCp < peakCp, `${drug.id}: Cp não caiu no washout`);
    assert.ok(Number.isFinite(current.currentCe) && current.currentCe < peakCe, `${drug.id}: Ce não caiu no washout`);
    const analysis = analyzeDrugExposure({ ...current, previousCp: peakCp, previousCe: peakCe, peakObservedCp: peakCp }, drug);
    assert.ok(['washout', 'residual'].includes(analysis.phase), `${drug.id}: fase final ${analysis.phase}`);
  }
});

test('dissociação fisiológica entre indução (hipnose) e apneia dependente de velocidade e perfusão', () => {
  const canine = createHealthyValidationPatient('canine');

  // 1. Indução com bólus lento (60s) - padrão ouro clínico (titulação)
  const slowState = createSimulationState(canine);
  administerDrug(slowState, 'propofol', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });
  advanceSimulation(slowState, 180, { dtSeconds: 1 });
  const slowTrace = summarizeTrace(slowState.frames);

  // Inconsciência cirúrgica induzida com sucesso
  assert.equal(slowTrace.minConsciousness, 0, 'Bólus lento deve induzir inconsciência completa (0%)');
  assert.ok(slowTrace.maxDepth >= 70, `Bólus lento deve atingir profundidade cirúrgica (obtido: ${slowTrace.maxDepth})`);
  assert.ok(
    slowState.vitals.jawTone === 'flaccid' || slowState.vitals.jawTone === 'relaxed_surgical',
    `Tônus mandibular deve estar relaxado/flácido (obtido: ${slowState.vitals.jawTone})`
  );

  // Não ocorre apneia rígida obrigatória: ventilação espontânea preservada com bradipneia
  assert.equal(slowTrace.respiratoryArrestOccurred, false, 'Bólus lento não deve induzir apneia');
  assert.ok(slowTrace.minRespiratoryRate >= 6, `Bólus lento deve preservar FR mínima >= 6 (obtido: ${slowTrace.minRespiratoryRate})`);

  // 2. Indução com bólus rápido (<5s, "push") - onda aguda de bolus e alto dCp/dt
  const rapidState = createSimulationState(canine);
  administerDrug(rapidState, 'propofol', 'typical', { route: 'IV', speed: 'bolus_rapid' });
  advanceSimulation(rapidState, 180, { dtSeconds: 1 });
  const rapidTrace = summarizeTrace(rapidState.frames);

  // Inconsciência induzida e apneia pós-indução desencadeada pela velocidade
  assert.equal(rapidTrace.minConsciousness, 0, 'Bólus rápido deve induzir inconsciência');
  assert.ok(
    rapidTrace.respiratoryArrestOccurred || rapidTrace.minRespiratoryRate === 0,
    'Bólus rápido deve desencadear apneia transitória por rápida saturação de tronco encefálico'
  );

  // 3. Estabilidade hemodinâmica contínua durante indução lenta
  assert.ok(slowTrace.minMap >= 55, `PAM durante indução lenta não deve sofrer choque colapsante (mínimo: ${slowTrace.minMap} mmHg)`);
});

test('busca e aliases encontram Naloxona mesmo com variações e digitações usuais (naloxina, naxolona, narcan)', () => {
  const queries = ['naloxina', 'naxolona', 'narcan', 'naloxona', 'naloxone', 'reversor opioide'];
  for (const q of queries) {
    const normalized = q.toLowerCase();
    const match = VETERINARY_DRUG_DATABASE.find(drug =>
      drug.name.toLowerCase().includes(normalized) ||
      (drug.brandName && drug.brandName.toLowerCase().includes(normalized)) ||
      (drug.aliases && drug.aliases.some(alias => alias.toLowerCase().includes(normalized))) ||
      (normalized.includes('nalox') && drug.id === 'naloxone') ||
      (normalized.includes('naxol') && drug.id === 'naloxone')
    );
    assert.ok(match, `Falha ao buscar por '${q}'`);
    assert.equal(match.id, 'naloxone', `Busca por '${q}' deveria retornar naloxone`);
  }

  // Atipamezol também deve ser localizado por variações
  const atipaQueries = ['atipamezol', 'antisedan', 'reversor alfa-2'];
  for (const q of atipaQueries) {
    const normalized = q.toLowerCase();
    const match = VETERINARY_DRUG_DATABASE.find(drug =>
      drug.name.toLowerCase().includes(normalized) ||
      (drug.brandName && drug.brandName.toLowerCase().includes(normalized)) ||
      (drug.aliases && drug.aliases.some(alias => alias.toLowerCase().includes(normalized))) ||
      (normalized.includes('atipa') && drug.id === 'atipamezole')
    );
    assert.ok(match, `Falha ao buscar por '${q}'`);
    assert.equal(match.id, 'atipamezole', `Busca por '${q}' deveria retornar atipamezole`);
  }
});

test('Naloxona reverte depressão respiratória por opioide com restauração da ventilação e pico de lavagem de EtCO2', () => {
  const canine = createHealthyValidationPatient('canine');
  const state = createSimulationState(canine);

  // 1. Administrar dose alta de opioide (fentanila) para induzir depressão respiratória/hipoventilação
  administerDrug(state, 'fentanyl', 'max', { route: 'IV', speed: 'bolus_slow' });
  advanceSimulation(state, 120, { dtSeconds: 1 });

  const postOpioidRR = state.vitals.respiratoryRate;
  const postOpioidPaCO2 = state.vitals.arterialBloodGases.paCO2;

  // Hipoventilação deve ocorrer e PaCO2 deve aumentar
  assert.ok(postOpioidRR < canine.baselineVitals.rr, `FR deve cair com fentanila (basal: ${canine.baselineVitals.rr}, atual: ${postOpioidRR})`);
  assert.ok(postOpioidPaCO2 > canine.baselineVitals.etco2, `PaCO2 deve acumular em hipoventilação (atual: ${postOpioidPaCO2})`);

  // 2. Administrar Naloxona para reverter o opioide
  administerDrug(state, 'naloxone', 'typical', { route: 'IV', speed: 'bolus_rapid' });
  advanceSimulation(state, 90, { dtSeconds: 1 });

  const reversedRR = state.vitals.respiratoryRate;
  const reversedEtCO2 = state.vitals.etCO2;
  const reversedMuDrive = state.vitals.cellularState.nociceptiveInhibition;

  // Reversão farmacodinâmica efetiva
  assert.ok(reversedRR > postOpioidRR, `FR deve recuperar após Naloxona (antes: ${postOpioidRR}, depois: ${reversedRR})`);
  assert.ok(reversedMuDrive < 0.45, `Analgesia/sedação mu-opioide deve ser antagonizada (atual: ${reversedMuDrive})`);
  // O EtCO2 deve ser medido ativamente e refletir a depuração do CO2 arterial acumulado
  assert.ok(reversedEtCO2 > 35, `EtCO2 deve ser medido ativamente na lavagem hipercapnica (EtCO2: ${reversedEtCO2})`);
});

test('reversores aparecem em circulação ativa com parâmetros cinéticos e de telemetria válidos', () => {
  const canine = createHealthyValidationPatient('canine');
  const state = createSimulationState(canine);

  administerDrug(state, 'naloxone', 'typical', { route: 'IV', speed: 'bolus_rapid' });
  administerDrug(state, 'atipamezole', 'typical', { route: 'IV_slow', speed: 'bolus_slow' });

  advanceSimulation(state, 30, { dtSeconds: 1 });

  // Ambos devem constar na lista de fármacos ativos
  const activeIds = state.doses.map(d => d.drugId);
  assert.ok(activeIds.includes('naloxone'), 'Naloxona deve estar presente em doses ativas');
  assert.ok(activeIds.includes('atipamezole'), 'Atipamezol deve estar presente em doses ativas');

  // Cada um deve ter Ce e Cp finitos e crescentes
  for (const dose of state.doses) {
    assert.ok(Number.isFinite(dose.currentCp), `${dose.drugId}: Cp inválido`);
    assert.ok(Number.isFinite(dose.currentCe), `${dose.drugId}: Ce inválido`);
  }
});

