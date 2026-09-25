import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUG_FORMULATIONS, getDrugFormulations, volumePerDoseUnit } from '../src/data/drugFormulations';
import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import { calculateAdministration, getSpeciesDoseRange } from '../src/engine/drugAdministration';

const drug = (id: string) => VETERINARY_DRUG_DATABASE.find(d => d.id === id)!;
test('same volume contains five times the acepromazine mass in the 1% vial', () => {
  const d = drug('acepromazine');
  assert.equal(volumePerDoseUnit(d, 10, 2, false) / volumePerDoseUnit(d, 10, 10, false), 5);
});
test('microgram concentrations and minute/hour CRI conversion stay dimensionally correct', () => {
  assert.equal(volumePerDoseUnit(drug('fentanyl'), 10, 0.05, false), 0.2);
  assert.equal(volumePerDoseUnit(drug('dexmedetomidine'), 10, 0.5, true), 0.02);
  assert.equal(volumePerDoseUnit(drug('dobutamine'), 10, 12.5, true), 0.048);
  assert.ok(Number.isNaN(volumePerDoseUnit(drug('propofol'), 0, 10, false)));
  assert.ok(Number.isNaN(volumePerDoseUnit(drug('propofol'), 10, NaN, false)));
});
for (const species of ['canine', 'feline', 'bovine', 'equine'] as const) {
  test(`${species}: all available formulations preserve dose-volume conversion in bolus and CRI`, () => {
    for (const d of VETERINARY_DRUG_DATABASE) for (const isCRI of [false, true]) {
      const range = getSpeciesDoseRange(d, species, isCRI);
      if (!range || (!isCRI && /\/(min|h)$/.test(d.doseUnit))) continue;
      for (const preparation of getDrugFormulations(d)) {
        const midpoint = (range.min + range.max) / 2;
        const factor = volumePerDoseUnit(d, 17, preparation.concentrationMgMl, isCRI);
        assert.ok(Number.isFinite(factor) && factor > 0, d.id);
        const calc = calculateAdministration(d, midpoint, 17, preparation.concentrationMgMl, isCRI);
        assert.ok(Math.abs(midpoint * factor - (isCRI ? calc.pumpRateMlPerHour! : calc.volumeMl)) < 0.00051, d.id);
        assert.ok(Math.abs((midpoint * factor) / factor - midpoint) < 1e-8, d.id);
      }
    }
  });
}
test('commercial products carry traceable sources and positive concentrations', () => {
  for (const preparations of Object.values(DRUG_FORMULATIONS)) for (const p of preparations) {
    assert.ok(p.sourceUrl?.startsWith('https://'));
    assert.ok(p.concentrationMgMl > 0);
  }
});
