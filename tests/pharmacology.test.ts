import assert from 'node:assert/strict';
import test from 'node:test';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import {
  calculateAdministration,
  getSpeciesDoseRange,
  getRoutePharmacokinetics,
  validateAdministrationCommand,
} from '../src/engine/drugAdministration';
import { PHARMACOLOGY_EXPECTATIONS } from '../src/validation/pharmacologyExpectations';
import { createHealthyValidationPatient } from '../src/validation/simulationHarness';
import { SpeciesType } from '../src/types/simulator';
import { PharmacokineticModel } from '../src/engine/pharmacokineticModel';
import { createActiveDose } from '../src/validation/simulationHarness';
import { analyzeDrugExposure } from '../src/engine/exposureAnalysis';

const SPECIES: SpeciesType[] = ['canine', 'feline', 'equine', 'bovine', 'rabbit', 'avian'];

test('catálogo e contratos clínicos têm paridade completa e IDs únicos', () => {
  assert.equal(VETERINARY_DRUG_DATABASE.length, 40);
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
  const avian = createHealthyValidationPatient('avian');
  const canine = createHealthyValidationPatient('canine');
  const sugammadex = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'sugammadex');
  const dobutamine = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'dobutamine');
  const potassium = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'potassium_chloride');
  const acepromazine = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === 'acepromazine');
  assert.ok(sugammadex && dobutamine && potassium && acepromazine);

  assert.equal(getSpeciesDoseRange(sugammadex, 'avian'), undefined);
  assert.ok(validateAdministrationCommand(avian, sugammadex, {
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
