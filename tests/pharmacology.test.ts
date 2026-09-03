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

const SPECIES: SpeciesType[] = ['canine', 'feline', 'equine', 'bovine', 'rabbit', 'avian'];

test('catálogo e contratos clínicos têm paridade completa e IDs únicos', () => {
  assert.equal(VETERINARY_DRUG_DATABASE.length, 37);
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
