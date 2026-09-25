import { DrugDefinition } from '../types/simulator';

export interface DrugPreparation {
  id: string;
  name: string;
  concentrationMgMl: number;
  label: string;
  vialVolumeMl?: number;
  sourceUrl?: string;
}

// Concentrations refer to the active drug, not the mass of its citrate/salt.
const product = (id: string, name: string, concentrationMgMl: number, label: string, vialVolumeMl: number, sourceUrl: string): DrugPreparation =>
  ({ id, name, concentrationMgMl, label, vialVolumeMl, sourceUrl });
const cristalia = (letter: string) => `https://www.cristalia.com.br/produtos?L=${letter}&categorias=9`;
export const DRUG_FORMULATIONS: Record<string, DrugPreparation[]> = {
  acepromazine: [
    product('acepran-02', 'Acepran 0,2%', 2, '2 mg/mL', 20, 'https://vetnil.com.br/produto/acepran-r-0-2-2/'),
    product('acepran-1', 'Acepran 1%', 10, '10 mg/mL', 20, 'https://vetnil.com.br/produto/acepran-r-1/'),
  ],
  dexmedetomidine: [
    { id: 'dexdomitor', name: 'Dexdomitor', concentrationMgMl: 0.5, label: '500 mcg/mL', sourceUrl: 'https://www.zoetis.com.br/_locale-assets/arquivos/animais-de-companhia/dex.pdf' },
    product('dex-100', 'DEX', 0.1, '100 mcg/mL', 2, cristalia('d')),
  ],
  midazolam: [product('dormire-5', 'Dormire', 5, '5 mg/mL', 3, cristalia('d')), product('dormire-1', 'Dormire', 1, '1 mg/mL', 5, cristalia('d'))],
  propofol: [product('propovan-20', 'Propovan 1%', 10, '10 mg/mL', 20, 'https://www.cristalia.com.br/produto/emulsao-injetavel-10-mgml-132'), product('propovan-50', 'Propovan 1%', 10, '10 mg/mL', 50, 'https://www.cristalia.com.br/produto/203/bula-profissional')],
  xylazine: [product('xilazin-2', 'Xilazin 2%', 20, '20 mg/mL', 10, 'https://syntec.com.br/produtos/xilazin-anestesico-syntec-2')],
  fentanyl: [product('fentanest-2', 'Fentanest sem conservantes', 0.05, '50 mcg/mL de fentanila', 2, cristalia('f')), product('fentanest-5', 'Fentanest sem conservantes', 0.05, '50 mcg/mL de fentanila', 5, cristalia('f'))],
  flumazenil: [product('flumazil', 'Flumazil', 0.1, '0,1 mg/mL', 5, cristalia('f'))],
  naloxone: [
    product('narcan-04', 'Naloxona 0,04% (Narcan)', 0.4, '0,4 mg/mL (400 mcg/mL)', 1, cristalia('n')),
  ],
  atipamezole: [
    { id: 'antisedan-5', name: 'Antisedan 0,5%', concentrationMgMl: 5.0, label: '5 mg/mL', vialVolumeMl: 10, sourceUrl: 'https://www.zoetis.com.br' },
  ],
};

export function getDrugFormulations(drug: DrugDefinition): DrugPreparation[] {
  return DRUG_FORMULATIONS[drug.id] ?? [{
    id: `${drug.id}-reference`, name: 'Preparação de referência do simulador',
    concentrationMgMl: drug.defaultConcentrationMgMl,
    label: drug.doseUnit.startsWith('ml/kg') ? 'Solução do catálogo (dose em volume)' : drug.unit === 'mEq'
      ? `${drug.concentrationInDoseUnitPerMl} mEq/mL`
      : drug.unit === 'mcg' ? `${drug.defaultConcentrationMgMl * 1000} mcg/mL` : `${drug.defaultConcentrationMgMl} mg/mL`,
  }];
}

/** Exact linear conversion; CRI controls always use mL/hour. No display rounding here. */
export function volumePerDoseUnit(drug: DrugDefinition, weightKg: number, concentrationMgMl: number, isCRI: boolean): number {
  if (![weightKg, concentrationMgMl].every(n => Number.isFinite(n) && n > 0)) return NaN;
  const unit = isCRI && drug.criDoseUnit ? drug.criDoseUnit : drug.doseUnit;
  const concentration = unit.startsWith('ml/kg') ? 1 : drug.unit === 'mEq'
    ? drug.concentrationInDoseUnitPerMl! : unit.startsWith('mcg') ? concentrationMgMl * 1000 : concentrationMgMl;
  return weightKg / concentration * (isCRI && unit.endsWith('/min') ? 60 : 1);
}
