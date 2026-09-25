import type { DrugDefinition } from '../types/simulator';

// PK affinities/half-lives below are simulator calibration parameters, not clinical estimates.
export const SCOPOLAMINE_DRUGS: DrugDefinition[] = [
  {
    id: 'hyoscine_butylbromide', name: 'Butilbrometo de Escopolamina 20 mg/mL', brandName: 'Buscopan simples / Hioscina butilbrometo',
    category: 'emergency_inotrope',
    description: 'Antiespasmódico antimuscarínico periférico. Bloqueia M2/M3: pode aumentar a FC, reduzir secreções e motilidade digestiva e favorecer retenção urinária. A pressão depende de débito, pré-carga e resistência vascular. Não produz analgesia cirúrgica, hipnose ou bloqueio neuromuscular. Não contém dipirona.',
    defaultConcentrationMgMl: 20, unit: 'mg', doseUnit: 'mg/kg',
    recommendedDose: { canine: { min: 0.2, max: 0.2, typical: 0.2 }, equine: { min: 0.3, max: 0.3, typical: 0.3 }, bovine: { min: 0.2, max: 0.4, typical: 0.3 } },
    supportedRoutes: ['IV_slow'], onsetMinutes: 1, durationMinutes: 30, transitLagSecondsIV: 8, ke0: 1.2, halfLifeAlpha: 2, halfLifeBeta: 18,
    receptorProfile: { m2: { affinity: 0.75, intrinsicEfficacy: -1 }, m3: { affinity: 0.95, intrinsicEfficacy: -1 } },
    effectHR: 0.12, effectBP: 0, effectRR: 0, effectDepth: 0, effectAnalgesia: 0, macReductionPct: 0, muscleRelaxation: 0,
    specialTraits: { isParasympatholytic: true },
    biotransformation: { primaryPathway: 'renal', pathwayLabel: 'Eliminação renal e hepatobiliar; ação periférica', hepaticClearanceFraction: 0.5, renalClearanceFraction: 0.5, lipidSolubility: 0.02, proteinBindingFraction: 0.08, apparentCentralVolumeLKg: 0.2 },
    evidenceNote: 'Equinos: bula Buscopan/FDA, 0,3 mg/kg IV lenta. Bovinos: bula Spasmipur/VMD, 0,2–0,4 mg/kg IV. Cães: 0,2 mg/kg IV em estudo piloto CBAV 2025 (7 tratados); evidência limitada. Não há regime felino verificado neste catálogo. Evitar interpretar taquicardia como medida isolada de dor; cautela com íleo, glaucoma e outros antimuscarínicos.',
  },
  {
    id: 'scopolamine_hydrobromide', name: 'Bromidrato de Escopolamina 0.4 mg/mL', brandName: 'Hioscina / Scopolamine hydrobromide',
    category: 'premedication',
    description: 'Antimuscarínico com penetração central. Além do bloqueio M2/M3 periférico, inibe sinalização M1: alteração cognitiva, sonolência e, com exposição elevada, excitação anticolinérgica. Potencializa efeitos centrais de sedativos/opioides. Não é equivalente ao Buscopan e não fornece analgesia cirúrgica.',
    defaultConcentrationMgMl: 0.4, unit: 'mg', doseUnit: 'mg/kg',
    recommendedDose: { canine: { min: 0.005, max: 0.015, typical: 0.015 }, feline: { min: 0.02, max: 0.02, typical: 0.02 } },
    supportedRoutes: ['SC', 'IM'], speciesRoutes: { canine: ['SC'], feline: ['IM'] },
    onsetMinutes: 10, durationMinutes: 120, transitLagSecondsIV: 10, ke0: 0.5, halfLifeAlpha: 8, halfLifeBeta: 120,
    receptorProfile: { m1: { affinity: 0.95, intrinsicEfficacy: -1 }, m2: { affinity: 0.8, intrinsicEfficacy: -1 }, m3: { affinity: 0.9, intrinsicEfficacy: -1 } },
    effectHR: 0.1, effectBP: 0, effectRR: 0, effectDepth: 0.12, effectAnalgesia: 0, macReductionPct: 0, muscleRelaxation: 0,
    specialTraits: { isParasympatholytic: true }, experimentalRegimen: true,
    biotransformation: { primaryPathway: 'hepatic_phase_i', pathwayLabel: 'Biotransformação hepática e excreção renal; penetração central', hepaticClearanceFraction: 0.75, renalClearanceFraction: 0.25, lipidSolubility: 0.75, proteinBindingFraction: 0.1, apparentCentralVolumeLKg: 0.7 },
    evidenceNote: 'Regimes experimentais para simulação, não recomendações de rotina: cães 5–15 µg/kg SC (PMID 15029470); gatos 0,02 mg/kg IM em estudo de requerimento anestésico (PMID 3434920). A concentração de 0,4 mg/mL corresponde à apresentação de bromidrato, não ao butilbrometo. Sem extrapolação de dose a equinos/bovinos.',
  },
];
