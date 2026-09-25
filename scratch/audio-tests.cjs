var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tests/audioSynthesizer.test.ts
var import_node_test = require("node:test");
var import_strict = __toESM(require("node:assert/strict"), 1);

// src/engine/drugAdministration.ts
function getSpeciesDoseRange(drug, species, isCRI) {
  if (isCRI) {
    return drug.recommendedCriDose?.[species] ?? (isTimeBasedDoseUnit(drug.doseUnit) ? drug.recommendedDose[species] : void 0);
  }
  return drug.recommendedDose[species];
}
function isTimeBasedDoseUnit(doseUnit) {
  if (!doseUnit) return false;
  return doseUnit.endsWith("/min") || doseUnit.endsWith("/h");
}
function getRoutePharmacokinetics(drug, route) {
  const onset = Math.max(0.1, drug.onsetMinutes);
  const ivLag = Math.max(0, drug.transitLagSecondsIV);
  switch (route) {
    case "IM":
      return {
        transitLagSeconds: Math.max(20, onset * 60 * 0.22),
        bioavailability: 0.9,
        absorptionHalfLifeMinutes: Math.max(0.35, onset * 0.42),
        systemicEffectFraction: 1,
        localNeuralEffectFraction: 0
      };
    case "SC":
      return {
        transitLagSeconds: Math.max(45, onset * 60 * 0.35),
        bioavailability: 0.75,
        absorptionHalfLifeMinutes: Math.max(0.75, onset * 0.7),
        systemicEffectFraction: 1,
        localNeuralEffectFraction: 0
      };
    case "Epidural":
      return {
        transitLagSeconds: Math.max(20, onset * 60 * 0.18),
        bioavailability: 1,
        absorptionHalfLifeMinutes: Math.max(0.4, onset * 0.35),
        systemicEffectFraction: 0.18,
        localNeuralEffectFraction: 1
      };
    case "Local":
      return {
        transitLagSeconds: Math.max(8, onset * 60 * 0.12),
        bioavailability: 1,
        absorptionHalfLifeMinutes: Math.max(0.2, onset * 0.25),
        systemicEffectFraction: 0.08,
        localNeuralEffectFraction: 1
      };
    case "CRI":
      return {
        transitLagSeconds: ivLag,
        bioavailability: 1,
        absorptionHalfLifeMinutes: 0,
        systemicEffectFraction: 1,
        localNeuralEffectFraction: drug.category === "local_anesthetic" ? 0.25 : 0
      };
    case "IV_slow":
    case "IV":
    default:
      return {
        transitLagSeconds: ivLag,
        bioavailability: 1,
        absorptionHalfLifeMinutes: 0,
        systemicEffectFraction: 1,
        localNeuralEffectFraction: drug.category === "local_anesthetic" ? 0.25 : 0
      };
  }
}
function isExtravascularRoute(route) {
  return route === "IM" || route === "SC" || route === "Epidural" || route === "Local";
}

// src/data/scopolamine.ts
var SCOPOLAMINE_DRUGS = [
  {
    id: "hyoscine_butylbromide",
    name: "Butilbrometo de Escopolamina 20 mg/mL",
    brandName: "Buscopan simples / Hioscina butilbrometo",
    category: "emergency_inotrope",
    description: "Antiespasm\xF3dico antimuscar\xEDnico perif\xE9rico. Bloqueia M2/M3: pode aumentar a FC, reduzir secre\xE7\xF5es e motilidade digestiva e favorecer reten\xE7\xE3o urin\xE1ria. A press\xE3o depende de d\xE9bito, pr\xE9-carga e resist\xEAncia vascular. N\xE3o produz analgesia cir\xFArgica, hipnose ou bloqueio neuromuscular. N\xE3o cont\xE9m dipirona.",
    defaultConcentrationMgMl: 20,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: { canine: { min: 0.2, max: 0.2, typical: 0.2 }, equine: { min: 0.3, max: 0.3, typical: 0.3 }, bovine: { min: 0.2, max: 0.4, typical: 0.3 } },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 1,
    durationMinutes: 30,
    transitLagSecondsIV: 8,
    ke0: 1.2,
    halfLifeAlpha: 2,
    halfLifeBeta: 18,
    receptorProfile: { m2: { affinity: 0.75, intrinsicEfficacy: -1 }, m3: { affinity: 0.95, intrinsicEfficacy: -1 } },
    effectHR: 0.12,
    effectBP: 0,
    effectRR: 0,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: { isParasympatholytic: true },
    biotransformation: { primaryPathway: "renal", pathwayLabel: "Elimina\xE7\xE3o renal e hepatobiliar; a\xE7\xE3o perif\xE9rica", hepaticClearanceFraction: 0.5, renalClearanceFraction: 0.5, lipidSolubility: 0.02, proteinBindingFraction: 0.08, apparentCentralVolumeLKg: 0.2 },
    evidenceNote: "Equinos: bula Buscopan/FDA, 0,3 mg/kg IV lenta. Bovinos: bula Spasmipur/VMD, 0,2\u20130,4 mg/kg IV. C\xE3es: 0,2 mg/kg IV em estudo piloto CBAV 2025 (7 tratados); evid\xEAncia limitada. N\xE3o h\xE1 regime felino verificado neste cat\xE1logo. Evitar interpretar taquicardia como medida isolada de dor; cautela com \xEDleo, glaucoma e outros antimuscar\xEDnicos."
  },
  {
    id: "scopolamine_hydrobromide",
    name: "Bromidrato de Escopolamina 0.4 mg/mL",
    brandName: "Hioscina / Scopolamine hydrobromide",
    category: "premedication",
    description: "Antimuscar\xEDnico com penetra\xE7\xE3o central. Al\xE9m do bloqueio M2/M3 perif\xE9rico, inibe sinaliza\xE7\xE3o M1: altera\xE7\xE3o cognitiva, sonol\xEAncia e, com exposi\xE7\xE3o elevada, excita\xE7\xE3o anticolin\xE9rgica. Potencializa efeitos centrais de sedativos/opioides. N\xE3o \xE9 equivalente ao Buscopan e n\xE3o fornece analgesia cir\xFArgica.",
    defaultConcentrationMgMl: 0.4,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: { canine: { min: 5e-3, max: 0.015, typical: 0.015 }, feline: { min: 0.02, max: 0.02, typical: 0.02 } },
    supportedRoutes: ["SC", "IM"],
    speciesRoutes: { canine: ["SC"], feline: ["IM"] },
    onsetMinutes: 10,
    durationMinutes: 120,
    transitLagSecondsIV: 10,
    ke0: 0.5,
    halfLifeAlpha: 8,
    halfLifeBeta: 120,
    receptorProfile: { m1: { affinity: 0.95, intrinsicEfficacy: -1 }, m2: { affinity: 0.8, intrinsicEfficacy: -1 }, m3: { affinity: 0.9, intrinsicEfficacy: -1 } },
    effectHR: 0.1,
    effectBP: 0,
    effectRR: 0,
    effectDepth: 0.12,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: { isParasympatholytic: true },
    experimentalRegimen: true,
    biotransformation: { primaryPathway: "hepatic_phase_i", pathwayLabel: "Biotransforma\xE7\xE3o hep\xE1tica e excre\xE7\xE3o renal; penetra\xE7\xE3o central", hepaticClearanceFraction: 0.75, renalClearanceFraction: 0.25, lipidSolubility: 0.75, proteinBindingFraction: 0.1, apparentCentralVolumeLKg: 0.7 },
    evidenceNote: "Regimes experimentais para simula\xE7\xE3o, n\xE3o recomenda\xE7\xF5es de rotina: c\xE3es 5\u201315 \xB5g/kg SC (PMID 15029470); gatos 0,02 mg/kg IM em estudo de requerimento anest\xE9sico (PMID 3434920). A concentra\xE7\xE3o de 0,4 mg/mL corresponde \xE0 apresenta\xE7\xE3o de bromidrato, n\xE3o ao butilbrometo. Sem extrapola\xE7\xE3o de dose a equinos/bovinos."
  }
];

// src/data/drugDatabase.ts
var VETERINARY_DRUG_DATABASE = [
  // ==========================================
  // 1. PREMEDICATION & SEDATIVES
  // ==========================================
  {
    id: "acepromazine",
    name: "Acepromazina 0.2%",
    brandName: "Acepran / PromAce",
    category: "premedication",
    description: "Fenotiaz\xEDnico sedativo, bloqueador alfa-1 adren\xE9rgico (vasodilata\xE7\xE3o e hipotens\xE3o), antiem\xE9tico, sem analgesia.",
    defaultConcentrationMgMl: 2,
    // 2 mg/ml (0.2%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.01, max: 0.05, typical: 0.02 },
      feline: { min: 0.01, max: 0.05, typical: 0.025 },
      equine: { min: 0.02, max: 0.05, typical: 0.03 },
      bovine: { min: 0.01, max: 0.03, typical: 0.015 }
    },
    supportedRoutes: ["IV", "IM", "SC"],
    onsetMinutes: 10,
    durationMinutes: 240,
    // 4-6h
    transitLagSecondsIV: 6,
    ke0: 0.15,
    halfLifeAlpha: 12,
    halfLifeBeta: 240,
    fastBolusRisk: {
      apneaRisk: 0.05,
      hypotensionSeverity: 0.45,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0.15,
      warningDescription: "B\xF3lus r\xE1pido intensifica vasodilata\xE7\xE3o e hipotens\xE3o por bloqueio alfa-1."
    },
    receptorProfile: {
      alpha1: { affinity: 0.9, intrinsicEfficacy: -0.9 },
      // competitive antagonist of vascular alpha-1
      dopamineD2: { affinity: 0.92, intrinsicEfficacy: -1 },
      histamineH1: { affinity: 0.55, intrinsicEfficacy: -0.8 },
      serotonin2: { affinity: 0.45, intrinsicEfficacy: -0.7 }
    },
    effectHR: -0.05,
    effectBP: -0.35,
    // significant vasodilation / hypotension
    effectRR: -0.1,
    effectDepth: 0.35,
    effectAnalgesia: 0,
    macReductionPct: 0.3,
    muscleRelaxation: 0.4,
    specialTraits: {
      causesArrhythmogenicityReduction: true
    }
  },
  {
    id: "dexmedetomidine",
    name: "Dexmedetomidina",
    brandName: "Dexdomitor / Precedex",
    category: "premedication",
    description: "Agonista alfa-2 potente e seletivo. Provoca vasoconstri\xE7\xE3o perif\xE9rica inicial (hipertens\xE3o) com bradicardia reflexa intensa, seda\xE7\xE3o profunda e analgesia visceral.",
    defaultConcentrationMgMl: 0.5,
    // 0.5 mg/ml (500 mcg/ml)
    unit: "mcg",
    doseUnit: "mcg/kg",
    recommendedDose: {
      canine: { min: 1, max: 10, typical: 5 },
      feline: { min: 5, max: 25, typical: 15 },
      equine: { min: 2.5, max: 7.5, typical: 5 },
      bovine: { min: 0.5, max: 2, typical: 1 }
    },
    recommendedCriDose: {
      canine: { min: 0.5, max: 3, typical: 1 },
      feline: { min: 0.5, max: 2, typical: 1 },
      equine: { min: 0.5, max: 2.5, typical: 1.2 },
      bovine: { min: 0.2, max: 1, typical: 0.5 }
    },
    criDoseUnit: "mcg/kg/h",
    supportedRoutes: ["IV", "IM", "CRI"],
    onsetMinutes: 2,
    durationMinutes: 90,
    transitLagSecondsIV: 4,
    ke0: 0.45,
    halfLifeAlpha: 5,
    halfLifeBeta: 60,
    fastBolusRisk: {
      apneaRisk: 0.25,
      hypotensionSeverity: 0.1,
      reflexBradycardiaRisk: 0.85,
      arrhythmiaRisk: 0.65,
      histamineRelease: false,
      lethalityRiskScore: 0.4,
      warningDescription: "B\xF3lus IV r\xE1pido causa pico de vasoconstri\xE7\xE3o (PAM > 130) seguido de bradicardia severa imediata (FC < 35) e Bloqueio AV de 2\xBA grau!"
    },
    receptorProfile: {
      alpha2: { affinity: 0.98, intrinsicEfficacy: 1 },
      alpha1: { affinity: 0.25, intrinsicEfficacy: 0.85 }
      // peripheral vasoconstrictor component
    },
    effectHR: -0.65,
    effectBP: 0.2,
    effectRR: -0.3,
    effectDepth: 0.7,
    effectAnalgesia: 0.55,
    macReductionPct: 0.6,
    muscleRelaxation: 0.7,
    specialTraits: {
      isAlpha2Agonist: true,
      causesInitialHypertensionReflexBradycardia: true
    }
  },
  {
    id: "xylazine",
    name: "Xilazina 2%",
    brandName: "Rompum / Anased / Xilazin",
    category: "premedication",
    description: "Agonista alfa-2 cl\xE1ssico. ATEN\xC7\xC3O: Bovinos s\xE3o 10x mais sens\xEDveis que equinos (dose de 0.05 mg/kg vs 1.0 mg/kg). Causa bradicardia, seda\xE7\xE3o e relaxamento muscular.",
    defaultConcentrationMgMl: 20,
    // 20 mg/ml (2%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.2, max: 1, typical: 0.5 },
      feline: { min: 0.5, max: 1.5, typical: 0.8 },
      equine: { min: 0.6, max: 1.1, typical: 0.9 },
      bovine: { min: 0.03, max: 0.1, typical: 0.05 }
    },
    supportedRoutes: ["IV", "IM"],
    onsetMinutes: 2.5,
    durationMinutes: 60,
    transitLagSecondsIV: 4,
    ke0: 0.4,
    halfLifeAlpha: 6,
    halfLifeBeta: 50,
    fastBolusRisk: {
      apneaRisk: 0.3,
      hypotensionSeverity: 0.15,
      reflexBradycardiaRisk: 0.8,
      arrhythmiaRisk: 0.6,
      histamineRelease: false,
      lethalityRiskScore: 0.45,
      warningDescription: "B\xF3lus IV r\xE1pido provoca bradicardia s\xFAbita, bloqueios card\xEDacos e risco de parada respirat\xF3ria em ruminantes."
    },
    receptorProfile: {
      alpha2: { affinity: 0.94, intrinsicEfficacy: 1 },
      alpha1: { affinity: 0.35, intrinsicEfficacy: 0.7 }
    },
    effectHR: -0.6,
    effectBP: 0.15,
    effectRR: -0.3,
    effectDepth: 0.65,
    effectAnalgesia: 0.5,
    macReductionPct: 0.5,
    muscleRelaxation: 0.65,
    specialTraits: {
      isAlpha2Agonist: true,
      causesInitialHypertensionReflexBradycardia: true,
      isBovineHyperSensitive: true
    }
  },
  {
    id: "detomidine",
    name: "Detomidina 1%",
    brandName: "Dormosedan",
    category: "premedication",
    description: "Agonista alfa-2 de alta pot\xEAncia e longa dura\xE7\xE3o para seda\xE7\xE3o e analgesia visceral profunda em equinos e bovinos.",
    defaultConcentrationMgMl: 10,
    // 10 mg/ml
    unit: "mcg",
    doseUnit: "mcg/kg",
    recommendedDose: {
      canine: { min: 5, max: 20, typical: 10 },
      feline: { min: 5, max: 20, typical: 10 },
      equine: { min: 10, max: 30, typical: 20 },
      bovine: { min: 2, max: 10, typical: 5 }
    },
    supportedRoutes: ["IV", "IM"],
    onsetMinutes: 3,
    durationMinutes: 120,
    transitLagSecondsIV: 5,
    ke0: 0.35,
    halfLifeAlpha: 6,
    halfLifeBeta: 90,
    fastBolusRisk: {
      apneaRisk: 0.2,
      hypotensionSeverity: 0.1,
      reflexBradycardiaRisk: 0.8,
      arrhythmiaRisk: 0.5,
      histamineRelease: false,
      lethalityRiskScore: 0.35,
      warningDescription: "Bradicardia intensa com bloqueio AV em equinos."
    },
    receptorProfile: {
      alpha2: { affinity: 0.96, intrinsicEfficacy: 1 },
      alpha1: { affinity: 0.3, intrinsicEfficacy: 0.75 }
    },
    effectHR: -0.6,
    effectBP: 0.2,
    effectRR: -0.25,
    effectDepth: 0.75,
    effectAnalgesia: 0.65,
    macReductionPct: 0.6,
    muscleRelaxation: 0.7,
    specialTraits: {
      isAlpha2Agonist: true,
      causesInitialHypertensionReflexBradycardia: true
    }
  },
  {
    id: "midazolam",
    name: "Midazolam 0.5%",
    brandName: "Dormonid",
    category: "premedication",
    description: "Benzodiazep\xEDnico hidrossol\xFAvel. Potente modulador alost\xE9rico positivo do receptor GABA-A. Excelente relaxamento muscular e sinergismo com opioides e propofol.",
    defaultConcentrationMgMl: 5,
    // 5 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.1, max: 0.4, typical: 0.25 },
      feline: { min: 0.1, max: 0.3, typical: 0.2 },
      equine: { min: 0.05, max: 0.1, typical: 0.06 },
      bovine: { min: 0.05, max: 0.1, typical: 0.05 }
    },
    recommendedCriDose: {
      canine: { min: 0.1, max: 0.4, typical: 0.2 },
      feline: { min: 0.1, max: 0.3, typical: 0.15 },
      equine: { min: 0.05, max: 0.2, typical: 0.1 },
      bovine: { min: 0.05, max: 0.15, typical: 0.08 }
    },
    criDoseUnit: "mg/kg/h",
    supportedRoutes: ["IV", "IM", "SC", "CRI"],
    onsetMinutes: 1.5,
    durationMinutes: 60,
    transitLagSecondsIV: 4,
    ke0: 0.65,
    halfLifeAlpha: 3.5,
    halfLifeBeta: 60,
    fastBolusRisk: {
      apneaRisk: 0.1,
      hypotensionSeverity: 0.08,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0.05,
      warningDescription: "M\xEDnimo impacto hemodin\xE2mico; sinergismo potente com opioides."
    },
    receptorProfile: {
      gabaA: { bzdAllosteric: 0.95 }
    },
    effectHR: -0.04,
    effectBP: -0.06,
    effectRR: -0.12,
    effectDepth: 0.35,
    effectAnalgesia: 0,
    macReductionPct: 0.35,
    muscleRelaxation: 0.85,
    specialTraits: {
      isBenzodiazepine: true
    }
  },
  {
    id: "diazepam",
    name: "Diazepam 0.5%",
    brandName: "Valium / Compaz",
    category: "premedication",
    description: "Benzodiazep\xEDnico lipossol\xFAvel veiculado em propilenoglicol (deve ser aplicado IV lento para evitar flebite e arritmias). M\xEDnimo impacto hemodin\xE2mico.",
    defaultConcentrationMgMl: 5,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.2, max: 0.5, typical: 0.25 },
      feline: { min: 0.2, max: 0.4, typical: 0.25 },
      equine: { min: 0.05, max: 0.1, typical: 0.05 },
      bovine: { min: 0.05, max: 0.1, typical: 0.05 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 1.5,
    durationMinutes: 120,
    transitLagSecondsIV: 4,
    ke0: 0.55,
    halfLifeAlpha: 6,
    halfLifeBeta: 150,
    fastBolusRisk: {
      apneaRisk: 0.15,
      hypotensionSeverity: 0.25,
      reflexBradycardiaRisk: 0.2,
      arrhythmiaRisk: 0.35,
      histamineRelease: false,
      lethalityRiskScore: 0.2,
      warningDescription: "Propilenoglicol em b\xF3lus IV r\xE1pido causa hipotens\xE3o, flebite e arritmias card\xEDacas."
    },
    receptorProfile: {
      gabaA: { bzdAllosteric: 0.88 }
    },
    effectHR: -0.02,
    effectBP: -0.06,
    effectRR: -0.1,
    effectDepth: 0.32,
    effectAnalgesia: 0,
    macReductionPct: 0.3,
    muscleRelaxation: 0.85,
    specialTraits: {
      isBenzodiazepine: true
    }
  },
  // ==========================================
  // 2. OPIOIDS & ANALGESICS
  // ==========================================
  {
    id: "morphine",
    name: "Morfina 1%",
    brandName: "Dimorf",
    category: "opioid_analgesic",
    description: "Agonista puro de receptores mu-opioides. Analgesia som\xE1tica e visceral potente. Causa libera\xE7\xE3o de histamina se aplicada IV r\xE1pido.",
    defaultConcentrationMgMl: 10,
    // 10 mg/ml (1%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.2, max: 0.8, typical: 0.5 },
      feline: { min: 0.1, max: 0.3, typical: 0.2 },
      equine: { min: 0.05, max: 0.15, typical: 0.1 },
      bovine: { min: 0.05, max: 0.12, typical: 0.08 }
    },
    supportedRoutes: ["IV_slow", "IM", "SC", "Epidural"],
    onsetMinutes: 6,
    durationMinutes: 360,
    // 4-6h
    transitLagSecondsIV: 5,
    ke0: 0.25,
    halfLifeAlpha: 10,
    halfLifeBeta: 150,
    fastBolusRisk: {
      apneaRisk: 0.35,
      hypotensionSeverity: 0.6,
      reflexBradycardiaRisk: 0.4,
      arrhythmiaRisk: 0.15,
      histamineRelease: true,
      lethalityRiskScore: 0.3,
      warningDescription: "B\xF3lus IV r\xE1pido causa libera\xE7\xE3o aguda maci\xE7a de histamina, vasodilata\xE7\xE3o, broncoespasmo e colapso press\xF3rico."
    },
    receptorProfile: {
      muOpioid: { affinity: 0.88, intrinsicEfficacy: 0.95 },
      kappaOpioid: { affinity: 0.3, intrinsicEfficacy: 0.6 }
    },
    effectHR: -0.22,
    effectBP: -0.12,
    effectRR: -0.28,
    effectDepth: 0.3,
    effectAnalgesia: 0.92,
    macReductionPct: 0.45,
    muscleRelaxation: 0.25,
    specialTraits: {
      isOpioid: true,
      causesHistamineRelease: true
    }
  },
  {
    id: "methadone",
    name: "Metadona 1%",
    brandName: "Mytedom / Comfortan",
    category: "opioid_analgesic",
    description: "Agonista mu-opioide e antagonista NMDA. Excelente analgesia com estabilidade hemodin\xE2mica sem libera\xE7\xE3o de histamina. Sinergismo de neuroleptoanalgesia com midazolam.",
    defaultConcentrationMgMl: 10,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.1, max: 0.5, typical: 0.3 },
      feline: { min: 0.1, max: 0.3, typical: 0.2 },
      equine: { min: 0.05, max: 0.15, typical: 0.1 },
      bovine: { min: 0.05, max: 0.12, typical: 0.08 }
    },
    supportedRoutes: ["IV", "IM", "SC"],
    onsetMinutes: 3,
    durationMinutes: 420,
    transitLagSecondsIV: 4,
    ke0: 0.4,
    halfLifeAlpha: 8,
    halfLifeBeta: 180,
    fastBolusRisk: {
      apneaRisk: 0.25,
      hypotensionSeverity: 0.15,
      reflexBradycardiaRisk: 0.3,
      arrhythmiaRisk: 0.08,
      histamineRelease: false,
      lethalityRiskScore: 0.18,
      warningDescription: "Bradicardia vagal dose-dependente e discreta depress\xE3o respirat\xF3ria."
    },
    receptorProfile: {
      muOpioid: { affinity: 0.95, intrinsicEfficacy: 1 },
      nmdaPoreBlock: 0.4
    },
    effectHR: -0.18,
    effectBP: -0.06,
    effectRR: -0.2,
    effectDepth: 0.35,
    effectAnalgesia: 0.95,
    macReductionPct: 0.5,
    muscleRelaxation: 0.35,
    specialTraits: {
      isOpioid: true
    }
  },
  {
    id: "fentanyl",
    name: "Fentanil",
    brandName: "Fentanest / Sublimaze",
    category: "opioid_analgesic",
    description: "Agonista mu sint\xE9tico ultrarr\xE1pido e potente (80-100x morfina). Ideal para analgesia intraoperat\xF3ria em b\xF3lus ou infus\xE3o cont\xEDnua (CRI).",
    defaultConcentrationMgMl: 0.05,
    // 50 mcg/ml
    unit: "mcg",
    doseUnit: "mcg/kg",
    recommendedDose: {
      canine: { min: 2, max: 10, typical: 5 },
      feline: { min: 1, max: 5, typical: 2.5 },
      equine: { min: 1, max: 4, typical: 2 },
      bovine: { min: 1, max: 3, typical: 1.5 }
    },
    recommendedCriDose: {
      canine: { min: 0.1, max: 0.7, typical: 0.3 },
      feline: { min: 0.1, max: 0.5, typical: 0.2 },
      equine: { min: 0.05, max: 0.4, typical: 0.15 },
      bovine: { min: 0.05, max: 0.3, typical: 0.1 }
    },
    criDoseUnit: "mcg/kg/min",
    supportedRoutes: ["IV", "CRI"],
    onsetMinutes: 1,
    durationMinutes: 25,
    transitLagSecondsIV: 3,
    ke0: 1.4,
    halfLifeAlpha: 2,
    halfLifeBeta: 30,
    fastBolusRisk: {
      apneaRisk: 0.65,
      hypotensionSeverity: 0.2,
      reflexBradycardiaRisk: 0.55,
      arrhythmiaRisk: 0.15,
      histamineRelease: false,
      lethalityRiskScore: 0.4,
      warningDescription: "B\xF3lus r\xE1pido de fentanil induz apneia imediata e bradicardia vagal severa!"
    },
    receptorProfile: {
      muOpioid: { affinity: 0.99, intrinsicEfficacy: 1 }
    },
    effectHR: -0.3,
    effectBP: -0.08,
    effectRR: -0.4,
    effectDepth: 0.4,
    effectAnalgesia: 0.98,
    macReductionPct: 0.6,
    muscleRelaxation: 0.3,
    specialTraits: {
      isOpioid: true
    }
  },
  {
    id: "butorphanol",
    name: "Butorfanol 1%",
    brandName: "Torbugesic / Dolorex",
    category: "opioid_analgesic",
    description: "Agonista de receptores kappa e antagonista/agonista parcial mu. Seda\xE7\xE3o leve-moderada, analgesia visceral e potente antituss\xEDgeno.",
    defaultConcentrationMgMl: 10,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.1, max: 0.4, typical: 0.2 },
      feline: { min: 0.1, max: 0.4, typical: 0.2 },
      equine: { min: 0.02, max: 0.1, typical: 0.04 },
      bovine: { min: 0.02, max: 0.08, typical: 0.05 }
    },
    supportedRoutes: ["IV", "IM", "SC"],
    onsetMinutes: 3,
    durationMinutes: 90,
    transitLagSecondsIV: 4,
    ke0: 0.5,
    halfLifeAlpha: 6,
    halfLifeBeta: 90,
    fastBolusRisk: {
      apneaRisk: 0.15,
      hypotensionSeverity: 0.08,
      reflexBradycardiaRisk: 0.1,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0.1,
      warningDescription: "Efeito teto na depress\xE3o respirat\xF3ria; perfil muito seguro."
    },
    receptorProfile: {
      kappaOpioid: { affinity: 0.92, intrinsicEfficacy: 0.85 },
      muOpioid: { affinity: 0.88, intrinsicEfficacy: 0.2 }
    },
    effectHR: -0.08,
    effectBP: -0.04,
    effectRR: -0.12,
    effectDepth: 0.35,
    effectAnalgesia: 0.5,
    macReductionPct: 0.25,
    muscleRelaxation: 0.25,
    specialTraits: {
      isOpioid: true
    }
  },
  {
    id: "buprenorphine",
    name: "Buprenorfina",
    brandName: "Buprex / Temgesic",
    category: "opioid_analgesic",
    description: "Agonista parcial mu com alta afinidade. Analgesia prolongada (6-8h), excelente absor\xE7\xE3o transmucosa em felinos.",
    defaultConcentrationMgMl: 0.3,
    // 0.3 mg/ml
    unit: "mcg",
    doseUnit: "mcg/kg",
    recommendedDose: {
      canine: { min: 10, max: 30, typical: 20 },
      feline: { min: 10, max: 30, typical: 20 },
      equine: { min: 5, max: 10, typical: 6 },
      bovine: { min: 5, max: 10, typical: 6 }
    },
    supportedRoutes: ["IV", "IM", "SC"],
    onsetMinutes: 10,
    durationMinutes: 360,
    transitLagSecondsIV: 5,
    ke0: 0.2,
    halfLifeAlpha: 15,
    halfLifeBeta: 240,
    fastBolusRisk: {
      apneaRisk: 0.1,
      hypotensionSeverity: 0.08,
      reflexBradycardiaRisk: 0.08,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0.08,
      warningDescription: "Atraso longo de biofase para pico m\xE1ximo."
    },
    receptorProfile: {
      muOpioid: { affinity: 0.99, intrinsicEfficacy: 0.48 },
      kappaOpioid: { affinity: 0.35, intrinsicEfficacy: -0.2 }
    },
    effectHR: -0.08,
    effectBP: -0.04,
    effectRR: -0.12,
    effectDepth: 0.2,
    effectAnalgesia: 0.8,
    macReductionPct: 0.3,
    muscleRelaxation: 0.15,
    specialTraits: {
      isOpioid: true
    }
  },
  {
    id: "tramadol",
    name: "Tramadol 5%",
    brandName: "Dorless V / Tramal",
    category: "opioid_analgesic",
    description: "Opioide at\xEDpico com mecanismo duplo: agonismo fraco de receptores mu pelo metab\xF3lito M1 (O-desmetiltramadol) e inibi\xE7\xE3o da recapta\xE7\xE3o de serotonina e noradrenalina (SNRI). Not\xE1vel varia\xE7\xE3o interesp\xE9cies: potente analgesia em felinos (altos n\xEDveis de M1) e analgesia modesta/monoamin\xE9rgica em caninos (baixa convers\xE3o em M1 por CYP2D15).",
    defaultConcentrationMgMl: 50,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 2, max: 5, typical: 3 },
      feline: { min: 1, max: 4, typical: 2 },
      equine: { min: 1, max: 3, typical: 2 },
      bovine: { min: 1, max: 4, typical: 2 }
    },
    supportedRoutes: ["IV_slow", "IM", "SC"],
    onsetMinutes: 10,
    durationMinutes: 360,
    transitLagSecondsIV: 5,
    ke0: 0.25,
    halfLifeAlpha: 12,
    halfLifeBeta: 150,
    fastBolusRisk: {
      apneaRisk: 0.05,
      hypotensionSeverity: 0.25,
      reflexBradycardiaRisk: 0.15,
      arrhythmiaRisk: 0.05,
      histamineRelease: false,
      lethalityRiskScore: 0.1,
      warningDescription: "B\xF3lus IV r\xE1pido causa n\xE1usea, saliva\xE7\xE3o aguda, hipotens\xE3o transit\xF3ria e poss\xEDvel disforia/agita\xE7\xE3o."
    },
    receptorProfile: {
      muOpioid: { affinity: 0.45, intrinsicEfficacy: 0.65 },
      serotonin2: { affinity: 0.35, intrinsicEfficacy: 0.4 }
    },
    effectHR: -0.05,
    effectBP: -0.04,
    effectRR: -0.08,
    effectDepth: 0.15,
    effectAnalgesia: 0.75,
    macReductionPct: 0.2,
    muscleRelaxation: 0.1,
    specialTraits: {
      isOpioid: true,
      isAtypicalOpioidSNRI: true,
      isTramadol: true
    }
  },
  // ==========================================
  // 3. INDUCTION AGENTS
  // ==========================================
  {
    id: "propofol",
    name: "Propofol 1%",
    brandName: "Diprivan / Propovet",
    category: "induction",
    description: "Hipn\xF3tico alquilfenol n\xE3o barbit\xFArico. B\xF3lus r\xE1pido provoca apneia transit\xF3ria, queda na resist\xEAncia vascular perif\xE9rica (vasodilata\xE7\xE3o) e r\xE1pido relaxamento mandibular.",
    defaultConcentrationMgMl: 10,
    // 10 mg/ml (1%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 2, max: 6, typical: 4 },
      feline: { min: 3, max: 6, typical: 4.5 },
      equine: { min: 1.5, max: 2.5, typical: 2 },
      bovine: { min: 1.5, max: 3, typical: 2 }
    },
    recommendedCriDose: {
      canine: { min: 0.1, max: 0.4, typical: 0.25 },
      feline: { min: 0.1, max: 0.3, typical: 0.2 },
      equine: { min: 0.08, max: 0.25, typical: 0.15 },
      bovine: { min: 0.08, max: 0.25, typical: 0.15 }
    },
    criDoseUnit: "mg/kg/min",
    supportedRoutes: ["IV", "IV_slow", "CRI"],
    onsetMinutes: 0.4,
    durationMinutes: 10,
    transitLagSecondsIV: 3,
    ke0: 1.8,
    halfLifeAlpha: 1.8,
    halfLifeBeta: 15,
    fastBolusRisk: {
      apneaRisk: 0.85,
      hypotensionSeverity: 0.65,
      reflexBradycardiaRisk: 0.15,
      arrhythmiaRisk: 0.2,
      histamineRelease: false,
      lethalityRiskScore: 0.5,
      warningDescription: "B\xF3lus IV ultrarr\xE1pido causa vasodilata\xE7\xE3o s\xFAbita, apneia e queda press\xF3rica."
    },
    receptorProfile: {
      gabaA: { propofolBarbiturateDirect: 0.95, directChlorideGating: 0.85 }
    },
    effectHR: -0.05,
    effectBP: -0.35,
    // vasodilation
    effectRR: -0.7,
    // transient apnea
    effectDepth: 0.98,
    effectAnalgesia: 0,
    // zero analgesia
    macReductionPct: 0.55,
    muscleRelaxation: 0.92,
    specialTraits: { isDirectVasodilator: true }
  },
  {
    id: "alfaxalone",
    name: "Alfaxalona 1%",
    brandName: "Alfaxan Multidose",
    category: "induction",
    description: "Neuroesteroide anest\xE9sico sint\xE9tico. Promove excelente estabilidade cardiovascular e r\xE1pida redistribui\xE7\xE3o com m\xEDnima altera\xE7\xE3o no d\xE9bito card\xEDaco.",
    defaultConcentrationMgMl: 10,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 1.5, max: 3.5, typical: 2 },
      feline: { min: 2, max: 5, typical: 3 },
      equine: { min: 1, max: 2, typical: 1.2 },
      bovine: { min: 1, max: 2, typical: 1.2 }
    },
    supportedRoutes: ["IV", "IV_slow", "IM"],
    onsetMinutes: 0.5,
    durationMinutes: 15,
    transitLagSecondsIV: 3,
    ke0: 1.6,
    halfLifeAlpha: 2.2,
    halfLifeBeta: 22,
    fastBolusRisk: {
      apneaRisk: 0.55,
      hypotensionSeverity: 0.25,
      reflexBradycardiaRisk: 0.08,
      arrhythmiaRisk: 0.1,
      histamineRelease: false,
      lethalityRiskScore: 0.3,
      warningDescription: "B\xF3lus r\xE1pido pode induz apneia transit\xF3ria; excelente perfil hemodin\xE2mico."
    },
    receptorProfile: {
      gabaA: { neurosteroidSite: 0.95, directChlorideGating: 0.8 }
    },
    effectHR: 0.05,
    effectBP: -0.15,
    effectRR: -0.5,
    effectDepth: 0.95,
    effectAnalgesia: 0,
    macReductionPct: 0.5,
    muscleRelaxation: 0.88,
    specialTraits: { isDirectVasodilator: true }
  },
  {
    id: "ketamine",
    name: "Cetamina 10%",
    brandName: "Ketamin / Vetalar",
    category: "induction",
    description: "Anest\xE9sico dissociativo antagonista NMDA. Estimula t\xF4nus simp\xE1tico (aumenta FC e PA), preserva reflexos e causa hipertonia muscular se usada sem adjuvante.",
    defaultConcentrationMgMl: 100,
    // 100 mg/ml (10%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 3, max: 8, typical: 5 },
      feline: { min: 4, max: 10, typical: 6 },
      equine: { min: 1.5, max: 2.5, typical: 2.2 },
      bovine: { min: 1.5, max: 3, typical: 2 }
    },
    recommendedCriDose: {
      canine: { min: 10, max: 30, typical: 20 },
      feline: { min: 10, max: 30, typical: 20 },
      equine: { min: 10, max: 30, typical: 20 },
      bovine: { min: 10, max: 30, typical: 20 }
    },
    criDoseUnit: "mcg/kg/min",
    supportedRoutes: ["IV", "IV_slow", "IM", "CRI"],
    onsetMinutes: 1,
    durationMinutes: 25,
    transitLagSecondsIV: 4,
    ke0: 0.9,
    halfLifeAlpha: 3.5,
    halfLifeBeta: 45,
    fastBolusRisk: {
      apneaRisk: 0.35,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.4,
      histamineRelease: false,
      lethalityRiskScore: 0.25,
      warningDescription: "B\xF3lus r\xE1pido induz padr\xE3o respirat\xF3rio apn\xEAustico, rigidez muscular, taquicardia e pico hipertensivo."
    },
    receptorProfile: {
      nmdaPoreBlock: 0.95,
      beta1: { affinity: 0.3, intrinsicEfficacy: 0.7 }
    },
    effectHR: 0.35,
    effectBP: 0.3,
    effectRR: -0.15,
    effectDepth: 0.85,
    effectAnalgesia: 0.75,
    macReductionPct: 0.4,
    muscleRelaxation: -0.4,
    specialTraits: {
      isDissociative: true,
      isSympathomimetic: true
    }
  },
  {
    id: "etomidate",
    name: "Etomidato 0.2%",
    brandName: "Hypnomidate",
    category: "induction",
    description: "Derivado imidaz\xF3lico de alta estabilidade hemodin\xE2mica (ideal para cardiopatas com choque ou fra\xE7\xE3o de eje\xE7\xE3o reduzida).",
    defaultConcentrationMgMl: 2,
    // 2 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.5, max: 2, typical: 1 },
      feline: { min: 0.5, max: 2, typical: 1 },
      equine: { min: 0.3, max: 0.8, typical: 0.5 },
      bovine: { min: 0.3, max: 0.8, typical: 0.5 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 0.5,
    durationMinutes: 10,
    transitLagSecondsIV: 3,
    ke0: 1.8,
    halfLifeAlpha: 1.8,
    halfLifeBeta: 20,
    fastBolusRisk: {
      apneaRisk: 0.25,
      hypotensionSeverity: 0.08,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.1,
      histamineRelease: false,
      lethalityRiskScore: 0.15,
      warningDescription: "Mioclonias transit\xF3rias se administrado sem pr\xE9-medica\xE7\xE3o com benzodiazep\xEDnicos."
    },
    receptorProfile: {
      gabaA: { propofolBarbiturateDirect: 0.88, directChlorideGating: 0.72 }
    },
    effectHR: 0,
    effectBP: -0.05,
    effectRR: -0.3,
    effectDepth: 0.9,
    effectAnalgesia: 0,
    macReductionPct: 0.35,
    muscleRelaxation: 0.5,
    specialTraits: {}
  },
  {
    id: "thiopental",
    name: "Tiopental S\xF3dico 2.5%",
    brandName: "Thiopentax",
    category: "induction",
    description: "Barbit\xFArico de a\xE7\xE3o ultracurta. ATEN\xC7\xC3O: Contraindicado em galgos/sighthounds (recupera\xE7\xE3o muito prolongada) e extravasamento perivascular causa necrose tecidual severa.",
    defaultConcentrationMgMl: 25,
    // 25 mg/ml (2.5%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 8, max: 15, typical: 10 },
      feline: { min: 6, max: 12, typical: 8 },
      equine: { min: 6, max: 10, typical: 8 },
      bovine: { min: 6, max: 10, typical: 8 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 0.5,
    durationMinutes: 12,
    transitLagSecondsIV: 12,
    ke0: 1.4,
    halfLifeAlpha: 3,
    halfLifeBeta: 480,
    fastBolusRisk: {
      apneaRisk: 0.85,
      hypotensionSeverity: 0.65,
      reflexBradycardiaRisk: 0.1,
      arrhythmiaRisk: 0.6,
      histamineRelease: true,
      lethalityRiskScore: 0.6,
      warningDescription: "B\xF3lus r\xE1pido provoca taquicardia reflexa com bigeminismo ventricular e choque vasodilatador."
    },
    receptorProfile: {
      gabaA: { propofolBarbiturateDirect: 0.92, directChlorideGating: 0.82 }
    },
    effectHR: 0.15,
    effectBP: -0.35,
    effectRR: -0.7,
    effectDepth: 0.95,
    effectAnalgesia: 0,
    macReductionPct: 0.4,
    muscleRelaxation: 0.8,
    specialTraits: {}
  },
  {
    id: "guaifenesin",
    name: "Guaifenesina 5% (GG)",
    brandName: "\xC9ter Gliceril Guaiacol",
    category: "induction",
    description: "Relaxante muscular de a\xE7\xE3o central utilizado em grandes animais para indu\xE7\xE3o e manuten\xE7\xE3o TIVA (Triplo Gotejamento com Xilazina e Cetamina).",
    defaultConcentrationMgMl: 50,
    // 50 mg/ml (5%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 20, max: 50, typical: 30 },
      feline: { min: 20, max: 40, typical: 30 },
      equine: { min: 50, max: 100, typical: 75 },
      bovine: { min: 50, max: 100, typical: 70 }
    },
    supportedRoutes: ["IV_slow", "CRI"],
    onsetMinutes: 2,
    durationMinutes: 30,
    transitLagSecondsIV: 25,
    ke0: 0.5,
    halfLifeAlpha: 5,
    halfLifeBeta: 40,
    fastBolusRisk: {
      apneaRisk: 0.2,
      hypotensionSeverity: 0.3,
      reflexBradycardiaRisk: 0.1,
      arrhythmiaRisk: 0.1,
      histamineRelease: false,
      lethalityRiskScore: 0.25,
      warningDescription: "Concentra\xE7\xF5es > 5% causam hem\xF3lise intravascular em equinos."
    },
    effectHR: 0.05,
    effectBP: -0.15,
    effectRR: -0.1,
    effectDepth: 0.4,
    effectAnalgesia: 0,
    macReductionPct: 0.35,
    muscleRelaxation: 0.95,
    specialTraits: {}
  },
  // ==========================================
  // 4. ANTAGONISTS & REVERSAL AGENTS
  // ==========================================
  {
    id: "atipamezole",
    name: "Atipamezol 0.5%",
    brandName: "Antisedan",
    category: "antagonist_reversal",
    description: "Antagonista alfa-2 espec\xEDfico. Desloca competitivamente a dexmedetomidina e a xilazina, revertendo seda\xE7\xE3o, bradicardia e analgesia.",
    defaultConcentrationMgMl: 5,
    // 5 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.05, max: 0.2, typical: 0.1 },
      feline: { min: 0.05, max: 0.2, typical: 0.1 },
      equine: { min: 0.02, max: 0.08, typical: 0.04 },
      bovine: { min: 0.01, max: 0.04, typical: 0.02 }
    },
    supportedRoutes: ["IM", "IV_slow", "SC"],
    onsetMinutes: 3,
    durationMinutes: 120,
    transitLagSecondsIV: 20,
    ke0: 0.9,
    halfLifeAlpha: 3,
    halfLifeBeta: 90,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0.3,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.35,
      histamineRelease: false,
      lethalityRiskScore: 0.25,
      warningDescription: "B\xF3lus IV ultrarr\xE1pido pode causar hipotens\xE3o s\xFAbita e taquicardia por bloqueio simp\xE1tico abrupto."
    },
    receptorProfile: {
      alpha2: { affinity: 0.99, intrinsicEfficacy: 0 }
      // pure competitive antagonist
    },
    effectHR: 0.5,
    effectBP: -0.1,
    effectRR: 0.25,
    effectDepth: -0.9,
    effectAnalgesia: -0.8,
    macReductionPct: 0,
    muscleRelaxation: -0.6,
    specialTraits: {
      isAlpha2Antagonist: true
    }
  },
  {
    id: "naloxone",
    name: "Naloxona 0.04%",
    brandName: "Narcan",
    category: "antagonist_reversal",
    description: "Antagonista opioide puro. Reverte rapidamente a depress\xE3o respirat\xF3ria e a seda\xE7\xE3o induzida por opioides, abolindo tamb\xE9m a analgesia.",
    defaultConcentrationMgMl: 0.4,
    // 0.4 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.01, max: 0.04, typical: 0.02 },
      feline: { min: 0.01, max: 0.04, typical: 0.02 },
      equine: { min: 5e-3, max: 0.02, typical: 0.01 },
      bovine: { min: 5e-3, max: 0.02, typical: 0.01 }
    },
    supportedRoutes: ["IV", "IM"],
    onsetMinutes: 1.5,
    durationMinutes: 45,
    transitLagSecondsIV: 15,
    ke0: 1.1,
    halfLifeAlpha: 2,
    halfLifeBeta: 40,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.2,
      histamineRelease: false,
      lethalityRiskScore: 0.1,
      warningDescription: "Revers\xE3o abrupta pode causar dor aguda e descarga simp\xE1tica."
    },
    receptorProfile: {
      muOpioid: { affinity: 0.99, intrinsicEfficacy: 0 }
      // pure competitive antagonist
    },
    effectHR: 0.2,
    effectBP: 0.1,
    effectRR: 0.6,
    effectDepth: -0.5,
    effectAnalgesia: -0.95,
    macReductionPct: 0,
    muscleRelaxation: -0.2,
    specialTraits: {
      isOpioidAntagonist: true
    }
  },
  {
    id: "flumazenil",
    name: "Flumazenil 0.01%",
    brandName: "Lanexat",
    category: "antagonist_reversal",
    description: "Antagonista competitivo do receptor benzodiazep\xEDnico. Reverte a seda\xE7\xE3o e relaxamento muscular de midazolam e diazepam.",
    defaultConcentrationMgMl: 0.1,
    // 0.1 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.01, max: 0.04, typical: 0.02 },
      feline: { min: 0.01, max: 0.04, typical: 0.02 },
      equine: { min: 5e-3, max: 0.02, typical: 0.01 },
      bovine: { min: 5e-3, max: 0.02, typical: 0.01 }
    },
    supportedRoutes: ["IV"],
    onsetMinutes: 1,
    durationMinutes: 60,
    transitLagSecondsIV: 15,
    ke0: 1.2,
    halfLifeAlpha: 2,
    halfLifeBeta: 50,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0.05,
      warningDescription: "Revers\xE3o segura e bem tolerada."
    },
    receptorProfile: {
      gabaA: { bzdAllosteric: 0 }
      // neutral allosteric antagonist
    },
    effectHR: 0.05,
    effectBP: 0.05,
    effectRR: 0.15,
    effectDepth: -0.4,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: -0.7,
    specialTraits: {
      isBenzoAntagonist: true
    }
  },
  {
    id: "lipid_emulsion_20",
    name: "Emuls\xE3o Lip\xEDdica 20% (Intralipid / ILE)",
    brandName: "Intralipid 20% / Lipovenos",
    category: "antagonist_reversal",
    description: 'Resgate toxicol\xF3gico ("Lipid Sink") para intoxica\xE7\xE3o sist\xEAmica aguda por anest\xE9sicos locais (Lidoca\xEDna, Bupivaca\xEDna) e f\xE1rmacos lipof\xEDlicos. Liga-se a fra\xE7\xF5es livres no sangue revertendo arritmias e colapso circulat\xF3rio.',
    defaultConcentrationMgMl: 200,
    // 200 mg/ml (20%)
    unit: "ml",
    doseUnit: "ml/kg",
    recommendedDose: {
      canine: { min: 1.5, max: 4, typical: 2 },
      feline: { min: 1.5, max: 4, typical: 2 },
      equine: { min: 1, max: 2, typical: 1.5 },
      bovine: { min: 1, max: 2, typical: 1.5 }
    },
    supportedRoutes: ["IV", "CRI"],
    onsetMinutes: 1,
    durationMinutes: 90,
    transitLagSecondsIV: 10,
    ke0: 1.5,
    halfLifeAlpha: 3,
    halfLifeBeta: 60,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0,
      warningDescription: "B\xF3lus inicial de 1.5-2 mL/kg em 1 min, seguido de infus\xE3o cont\xEDnua."
    },
    effectHR: 0.15,
    effectBP: 0.2,
    effectRR: 0.05,
    effectDepth: -0.1,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isLipidSink: true
    }
  },
  // ==========================================
  // 5. EMERGENCY, INOTROPES & RESUSCITATION
  // ==========================================
  {
    id: "epinephrine",
    name: "Epinefrina (Adrenalina) 1:1000",
    brandName: "Adrenalina",
    category: "emergency_inotrope",
    description: "Agonista adren\xE9rgico n\xE3o seletivo (alfa-1, beta-1, beta-2). Vasopressor e inotr\xF3pico de 1\xAA linha na PCR (Diretrizes RECOVER) e choque anafil\xE1tico.",
    defaultConcentrationMgMl: 1,
    // 1 mg/ml (1:1000)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.01, max: 0.02, typical: 0.01 },
      feline: { min: 0.01, max: 0.02, typical: 0.01 },
      equine: { min: 5e-3, max: 0.01, typical: 8e-3 },
      bovine: { min: 5e-3, max: 0.01, typical: 8e-3 }
    },
    supportedRoutes: ["IV", "CRI", "IM"],
    onsetMinutes: 0.5,
    durationMinutes: 8,
    transitLagSecondsIV: 10,
    ke0: 1.8,
    halfLifeAlpha: 1,
    halfLifeBeta: 5,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.75,
      histamineRelease: false,
      lethalityRiskScore: 0.5,
      warningDescription: "Se aplicado em paciente com ritmo card\xEDaco normal ou isquemia, pode desencadear Taquicardia Ventricular e Fibrila\xE7\xE3o Ventricular!"
    },
    receptorProfile: {
      alpha1: { affinity: 0.85, intrinsicEfficacy: 1 },
      beta1: { affinity: 0.95, intrinsicEfficacy: 1 },
      beta2: { affinity: 0.8, intrinsicEfficacy: 1 }
    },
    effectHR: 0.85,
    effectBP: 0.9,
    effectRR: 0.3,
    effectDepth: -0.2,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isSympathomimetic: true
    }
  },
  {
    id: "atropine",
    name: "Atropina 0.05% (1:2000)",
    brandName: "Sulfato de Atropina",
    category: "emergency_inotrope",
    description: "Anticolin\xE9rgico parassimpatol\xEDtico. Bloqueia receptores muscar\xEDnicos, aumentando a frequ\xEAncia card\xEDaca ao inibir o t\xF4nus vagal. Interpretar a resposta junto \xE0 press\xE3o arterial e \xE0 perfus\xE3o.",
    defaultConcentrationMgMl: 0.5,
    // 0.5 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.02, max: 0.04, typical: 0.03 },
      feline: { min: 0.02, max: 0.04, typical: 0.03 },
      equine: { min: 5e-3, max: 0.02, typical: 0.01 },
      bovine: { min: 0.01, max: 0.03, typical: 0.02 }
    },
    supportedRoutes: ["IV", "IM", "SC"],
    onsetMinutes: 1.5,
    durationMinutes: 90,
    transitLagSecondsIV: 15,
    ke0: 0.8,
    halfLifeAlpha: 5,
    halfLifeBeta: 80,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.3,
      histamineRelease: false,
      lethalityRiskScore: 0.15,
      warningDescription: "Doses sub-terap\xEAuticas ou in\xEDcio de b\xF3lus podem causar bradicardia paradoxal tempor\xE1ria por estimula\xE7\xE3o vagal central."
    },
    receptorProfile: {
      m2: { affinity: 0.95, intrinsicEfficacy: -1 },
      // muscarinic M2 competitive antagonist
      m3: { affinity: 0.9, intrinsicEfficacy: -1 }
    },
    effectHR: 0.7,
    effectBP: 0.25,
    effectRR: 0.1,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isParasympatholytic: true
    }
  },
  {
    id: "glycopyrrolate",
    name: "Glicopirrolato 0.02%",
    brandName: "Robinul-V",
    category: "emergency_inotrope",
    description: "Anticolin\xE9rgico sint\xE9tico quatern\xE1rio com a\xE7\xE3o predominantemente perif\xE9rica. Reduz efeitos muscar\xEDnicos; a resposta depende do t\xF4nus vagal e das associa\xE7\xF5es farmacol\xF3gicas.",
    defaultConcentrationMgMl: 0.2,
    // 0.2 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 5e-3, max: 0.015, typical: 0.01 },
      feline: { min: 5e-3, max: 0.015, typical: 0.01 },
      equine: { min: 2e-3, max: 5e-3, typical: 3e-3 },
      bovine: { min: 2e-3, max: 5e-3, typical: 3e-3 }
    },
    supportedRoutes: ["IV", "IM", "SC"],
    onsetMinutes: 2,
    durationMinutes: 180,
    transitLagSecondsIV: 20,
    ke0: 0.6,
    halfLifeAlpha: 6,
    halfLifeBeta: 120,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.1,
      histamineRelease: false,
      lethalityRiskScore: 0.1,
      warningDescription: "Aumento gradual e sustentado da frequ\xEAncia card\xEDaca."
    },
    receptorProfile: {
      m2: { affinity: 0.92, intrinsicEfficacy: -1 },
      m3: { affinity: 0.95, intrinsicEfficacy: -1 }
    },
    effectHR: 0.55,
    effectBP: 0.2,
    effectRR: 0.05,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isParasympatholytic: true
    }
  },
  {
    id: "lidocaine_2pct",
    name: "Lidoca\xEDna 2% (sem vaso)",
    brandName: "Xylestesin / Lignoca\xEDna",
    category: "antiarrhythmic",
    description: "Antiarr\xEDtmico de classe 1b para taquicardias ventriculares e VPCs. ATEN\xC7\xC3O CR\xCDTICA: Felinos s\xE3o hiper-suscet\xEDveis \xE0 neuro/cardiotoxicidade (risco fatal se aplicada IV r\xE1pido ou em dose de c\xE3o!).",
    defaultConcentrationMgMl: 20,
    // 20 mg/ml (2%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 2, max: 4, typical: 2 },
      feline: { min: 0.2, max: 0.5, typical: 0.25 },
      // Extremely sensitive
      equine: { min: 1, max: 2, typical: 1.3 },
      bovine: { min: 1, max: 2, typical: 1.3 }
    },
    recommendedCriDose: {
      canine: { min: 25, max: 50, typical: 35 },
      equine: { min: 20, max: 50, typical: 30 },
      bovine: { min: 20, max: 50, typical: 30 }
    },
    criDoseUnit: "mcg/kg/min",
    supportedRoutes: ["IV_slow", "CRI", "Local", "Epidural"],
    onsetMinutes: 1,
    durationMinutes: 20,
    transitLagSecondsIV: 15,
    ke0: 1,
    halfLifeAlpha: 3,
    halfLifeBeta: 25,
    fastBolusRisk: {
      apneaRisk: 0.35,
      hypotensionSeverity: 0.5,
      reflexBradycardiaRisk: 0.6,
      arrhythmiaRisk: 0.5,
      histamineRelease: false,
      lethalityRiskScore: 0.65,
      warningDescription: "PERIGO EM FELINOS: B\xF3lus IV r\xE1pido em gatos induz colapso vascular fulminante, bradicardia extrema, convuls\xF5es e parada cardiorrespirat\xF3ria!"
    },
    receptorProfile: {
      naVChannelBlock: 0.92
    },
    effectHR: -0.1,
    effectBP: -0.08,
    effectRR: 0,
    effectDepth: 0.15,
    effectAnalgesia: 0.4,
    macReductionPct: 0.25,
    muscleRelaxation: 0.2,
    specialTraits: {
      isAntiarrhythmicClass1b: true,
      causesArrhythmogenicityReduction: true,
      isFelineToxicIV: true
    }
  },
  {
    id: "dobutamine",
    name: "Dobutamina (CRI)",
    brandName: "Dobutrex",
    category: "emergency_inotrope",
    description: "Inotr\xF3pico positivo sint\xE9tico agonista beta-1 seletivo. Aumenta a contratilidade mioc\xE1rdica e a press\xE3o arterial com m\xEDnima taquicardia.",
    defaultConcentrationMgMl: 12.5,
    // 12.5 mg/ml
    unit: "mcg",
    doseUnit: "mcg/kg/min",
    recommendedDose: {
      canine: { min: 2, max: 10, typical: 5 },
      feline: { min: 1, max: 5, typical: 2.5 },
      equine: { min: 1, max: 5, typical: 3 },
      bovine: { min: 1, max: 5, typical: 3 }
    },
    supportedRoutes: ["CRI"],
    onsetMinutes: 1.5,
    durationMinutes: 10,
    transitLagSecondsIV: 15,
    ke0: 1.2,
    halfLifeAlpha: 2,
    halfLifeBeta: 6,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.4,
      histamineRelease: false,
      lethalityRiskScore: 0.2,
      warningDescription: "Doses excessivas (> 15 mcg/kg/min) causam taquiarritmias ventriculares."
    },
    receptorProfile: {
      beta1: { affinity: 0.95, intrinsicEfficacy: 1 },
      beta2: { affinity: 0.4, intrinsicEfficacy: 0.6 }
    },
    effectHR: 0.15,
    effectBP: 0.65,
    effectRR: 0,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isSympathomimetic: true
    }
  },
  {
    id: "norepinephrine",
    name: "Norepinefrina (Noradrenalina CRI)",
    brandName: "Levophed / Hyponor",
    category: "emergency_inotrope",
    description: "Vasopressor potente de primeira linha para choque vasodilatador ou hipotens\xE3o refrat\xE1ria. Forte agonista alfa-1 e moderado beta-1.",
    defaultConcentrationMgMl: 1,
    // 1 mg/ml
    unit: "mcg",
    doseUnit: "mcg/kg/min",
    recommendedDose: {
      canine: { min: 0.05, max: 0.5, typical: 0.1 },
      feline: { min: 0.05, max: 0.3, typical: 0.1 },
      equine: { min: 0.05, max: 0.4, typical: 0.1 },
      bovine: { min: 0.05, max: 0.3, typical: 0.1 }
    },
    supportedRoutes: ["CRI"],
    onsetMinutes: 0.8,
    durationMinutes: 6,
    transitLagSecondsIV: 10,
    ke0: 1.5,
    halfLifeAlpha: 1,
    halfLifeBeta: 4,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0.3,
      arrhythmiaRisk: 0.5,
      histamineRelease: false,
      lethalityRiskScore: 0.35,
      warningDescription: "Vasoconstri\xE7\xE3o perif\xE9rica intensa com aumento de p\xF3s-carga."
    },
    receptorProfile: {
      alpha1: { affinity: 0.95, intrinsicEfficacy: 1 },
      beta1: { affinity: 0.7, intrinsicEfficacy: 0.8 }
    },
    effectHR: 0.1,
    effectBP: 0.85,
    effectRR: 0.05,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isSympathomimetic: true
    }
  },
  {
    id: "ephedrine",
    name: "Efedrina 50 mg/mL",
    brandName: "Sulfato de Efedrina",
    category: "emergency_inotrope",
    description: "Simpatomim\xE9tico de a\xE7\xE3o mista (direta: agonista alfa-1, beta-1 e beta-2; indireta: estimula libera\xE7\xE3o de noradrenalina das ves\xEDculas pr\xE9-sin\xE1pticas). F\xE1rmaco de 1\xAA escolha para hipotens\xE3o induzida por anest\xE9sicos inalat\xF3rios sob ritmo card\xEDaco est\xE1vel. Apresenta taquifilaxia com doses repetidas por deple\xE7\xE3o das reservas vesiculares.",
    defaultConcentrationMgMl: 50,
    // 50 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.05, max: 0.2, typical: 0.1 },
      feline: { min: 0.05, max: 0.15, typical: 0.1 },
      equine: { min: 0.03, max: 0.08, typical: 0.05 },
      bovine: { min: 0.03, max: 0.06, typical: 0.04 }
    },
    supportedRoutes: ["IV", "IV_slow", "IM"],
    onsetMinutes: 1,
    durationMinutes: 30,
    transitLagSecondsIV: 12,
    ke0: 0.7,
    halfLifeAlpha: 3,
    halfLifeBeta: 40,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.25,
      histamineRelease: false,
      lethalityRiskScore: 0.15,
      warningDescription: "B\xF3lus IV r\xE1pido excessivo pode precipitar taquicardia ou arritmias ventriculares em pacientes com isquemia pr\xE9via."
    },
    receptorProfile: {
      alpha1: { affinity: 0.65, intrinsicEfficacy: 0.75 },
      beta1: { affinity: 0.7, intrinsicEfficacy: 0.8 },
      beta2: { affinity: 0.5, intrinsicEfficacy: 0.6 }
    },
    effectHR: 0.25,
    effectBP: 0.7,
    effectRR: 0.1,
    effectDepth: -0.1,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isSympathomimetic: true,
      isMixedSympathomimetic: true,
      hasTachyphylaxisRisk: true
    }
  },
  {
    id: "potassium_chloride",
    name: "Cloreto de Pot\xE1ssio (KCl 19.1%)",
    brandName: "KCl 2.56 mEq/mL",
    category: "emergency_inotrope",
    description: "Solu\xE7\xE3o concentrada de pot\xE1ssio. ADVERT\xCANCIA EXTREMA: NUNCA aplicar em b\xF3lus IV direto! Provoca hipercalemia fulminante, fibrila\xE7\xE3o ventricular e parada card\xEDaca instant\xE2nea em di\xE1stole.",
    defaultConcentrationMgMl: 191,
    // 191 mg/ml (2.56 mEq/ml)
    concentrationInDoseUnitPerMl: 2.56,
    unit: "mEq",
    doseUnit: "mEq/kg/h",
    recommendedDose: {
      canine: { min: 0.1, max: 0.5, typical: 0.2 },
      // In infusion max 0.5 mEq/kg/h
      feline: { min: 0.1, max: 0.4, typical: 0.2 },
      equine: { min: 0.05, max: 0.3, typical: 0.15 },
      bovine: { min: 0.05, max: 0.3, typical: 0.15 }
    },
    supportedRoutes: ["CRI", "IV_slow"],
    onsetMinutes: 0.5,
    durationMinutes: 60,
    transitLagSecondsIV: 10,
    ke0: 1.5,
    halfLifeAlpha: 5,
    halfLifeBeta: 60,
    fastBolusRisk: {
      apneaRisk: 0.5,
      hypotensionSeverity: 0.9,
      reflexBradycardiaRisk: 0.95,
      arrhythmiaRisk: 1,
      histamineRelease: false,
      lethalityRiskScore: 1,
      warningDescription: "LETALIDADE M\xC1XIMA: B\xF3lus IV r\xE1pido de KCl causa hipercalemia aguda (> 9.0 mEq/L), onda T gigante em tenda, perda de onda P, alargamento de QRS, FV e PCR em Assistolia imediata!"
    },
    effectHR: -0.8,
    effectBP: -0.7,
    effectRR: -0.4,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      isPotassiumSalt: true
    }
  },
  {
    id: "calcium_gluconate",
    name: "Gluconato de C\xE1lcio 10%",
    brandName: "Gluconato de C\xE1lcio",
    category: "emergency_inotrope",
    description: "Cardioprotetor para estabiliza\xE7\xE3o de membrana mioc\xE1rdica em hipercalemia severa (DTUF em gatos) e hipocalcemia. Deve ser infundido lentamente em 10-15 min.",
    defaultConcentrationMgMl: 100,
    // 100 mg/ml (10%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 50, max: 150, typical: 100 },
      feline: { min: 50, max: 100, typical: 75 },
      equine: { min: 20, max: 50, typical: 30 },
      bovine: { min: 20, max: 50, typical: 30 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 3,
    durationMinutes: 45,
    transitLagSecondsIV: 20,
    ke0: 0.7,
    halfLifeAlpha: 5,
    halfLifeBeta: 45,
    fastBolusRisk: {
      apneaRisk: 0.1,
      hypotensionSeverity: 0.2,
      reflexBradycardiaRisk: 0.85,
      arrhythmiaRisk: 0.75,
      histamineRelease: false,
      lethalityRiskScore: 0.65,
      warningDescription: "B\xF3lus IV r\xE1pido provoca bradicardia severa, bloqueios atrioventriculares e risco de parada card\xEDaca em s\xEDstole!"
    },
    effectHR: 0.15,
    effectBP: 0.2,
    effectRR: 0,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {
      causesArrhythmogenicityReduction: true,
      isCalciumSalt: true
    }
  },
  {
    id: "sodium_bicarbonate",
    name: "Bicarbonato de S\xF3dio 8.4%",
    brandName: "Bicarbonato 1 mEq/mL",
    category: "emergency_inotrope",
    description: "Agente alcalinizante para corre\xE7\xE3o de acidose metab\xF3lica severa (pH < 7.15, HCO3 < 12) e hipercalemia.",
    defaultConcentrationMgMl: 84,
    // 84 mg/ml = 1 mEq/ml
    concentrationInDoseUnitPerMl: 1,
    unit: "mEq",
    doseUnit: "mEq/kg",
    recommendedDose: {
      canine: { min: 0.5, max: 2, typical: 1 },
      feline: { min: 0.5, max: 1.5, typical: 1 },
      equine: { min: 0.5, max: 1.5, typical: 0.8 },
      bovine: { min: 0.5, max: 1.5, typical: 0.8 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 3,
    durationMinutes: 60,
    transitLagSecondsIV: 20,
    ke0: 0.8,
    halfLifeAlpha: 4,
    halfLifeBeta: 60,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0.25,
      reflexBradycardiaRisk: 0.1,
      arrhythmiaRisk: 0.2,
      histamineRelease: false,
      lethalityRiskScore: 0.2,
      warningDescription: "B\xF3lus r\xE1pido causa hipercapnia transit\xF3ria por convers\xE3o em CO2 e hipocalcemia aguda ionizada."
    },
    effectHR: 0.05,
    effectBP: 0.05,
    effectRR: 0.1,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {}
  },
  // ==========================================
  // 6. NEUROMUSCULAR BLOCKING AGENTS (NMBA)
  // ==========================================
  {
    id: "atracurium",
    name: "Atrac\xFArio 1%",
    brandName: "Tracrium",
    category: "nmba",
    description: "Bloqueador neuromuscular n\xE3o despolarizante de elimina\xE7\xE3o de Hofmann (independente de fun\xE7\xE3o renal/hep\xE1tica). Promove paralisia muscular total, exigindo ventila\xE7\xE3o mec\xE2nica mandat\xF3ria.",
    defaultConcentrationMgMl: 10,
    // 10 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.2, max: 0.5, typical: 0.3 },
      feline: { min: 0.2, max: 0.5, typical: 0.3 },
      equine: { min: 0.1, max: 0.3, typical: 0.15 },
      bovine: { min: 0.1, max: 0.3, typical: 0.15 }
    },
    supportedRoutes: ["IV_slow", "CRI"],
    onsetMinutes: 2.5,
    durationMinutes: 35,
    transitLagSecondsIV: 20,
    ke0: 0.8,
    halfLifeAlpha: 3,
    halfLifeBeta: 25,
    fastBolusRisk: {
      apneaRisk: 1,
      // Guaranteed total paralysis
      hypotensionSeverity: 0.6,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.15,
      histamineRelease: true,
      lethalityRiskScore: 0.8,
      warningDescription: "B\xF3lus r\xE1pido libera histamina (hipotens\xE3o acentuada) e causa paralisia respirat\xF3ria total imediata!"
    },
    receptorProfile: {
      nm: { affinity: 0.98, intrinsicEfficacy: -1 }
      // competitive neuromuscular blocker
    },
    effectHR: 0,
    effectBP: -0.15,
    effectRR: -1,
    // complete respiratory paralysis
    effectDepth: 0,
    // zero sedation or analgesia!
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 1,
    specialTraits: {
      isNMBA: true,
      causesHistamineRelease: true
    }
  },
  {
    id: "neostigmine",
    name: "Neostigmina 0.05%",
    brandName: "Prostigmine",
    category: "nmba_reversal",
    description: "Anticolinester\xE1sico para revers\xE3o de bloqueadores neuromusculares. Sempre administrar associada a anticolin\xE9rgico (atropina) para prevenir bradicardia severa e broncorreia.",
    defaultConcentrationMgMl: 0.5,
    // 0.5 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.02, max: 0.05, typical: 0.04 },
      feline: { min: 0.02, max: 0.05, typical: 0.04 },
      equine: { min: 0.01, max: 0.03, typical: 0.02 },
      bovine: { min: 0.01, max: 0.03, typical: 0.02 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 3,
    durationMinutes: 60,
    transitLagSecondsIV: 25,
    ke0: 0.7,
    halfLifeAlpha: 4,
    halfLifeBeta: 50,
    fastBolusRisk: {
      apneaRisk: 0.1,
      hypotensionSeverity: 0.3,
      reflexBradycardiaRisk: 0.9,
      arrhythmiaRisk: 0.6,
      histamineRelease: false,
      lethalityRiskScore: 0.5,
      warningDescription: "B\xF3lus sem atropina pr\xE9via causa crise colin\xE9rgica, bradicardia extrema e PCR por assistolia!"
    },
    receptorProfile: {
      acheInhibition: 0.95,
      m2: { affinity: 0.6, intrinsicEfficacy: 0.8 },
      m3: { affinity: 0.7, intrinsicEfficacy: 0.9 }
    },
    effectHR: -0.5,
    effectBP: -0.15,
    effectRR: 0.3,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: -0.9,
    specialTraits: {
      isNMBAReversal: true
    }
  },
  {
    id: "sugammadex",
    name: "Sugamadex 100 mg/mL",
    brandName: "Bridion",
    category: "nmba_reversal",
    description: "Agente encapsulador seletivo de bloqueadores neuromusculares esteroidais. Reverte o bloqueio neuromuscular sem efeitos colin\xE9rgicos (n\xE3o necessita atropina).",
    defaultConcentrationMgMl: 100,
    // 100 mg/ml
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 2, max: 8, typical: 4 },
      feline: { min: 2, max: 8, typical: 4 },
      equine: { min: 2, max: 4, typical: 2.5 }
    },
    supportedRoutes: ["IV"],
    onsetMinutes: 1,
    durationMinutes: 120,
    transitLagSecondsIV: 15,
    ke0: 1.5,
    halfLifeAlpha: 2,
    halfLifeBeta: 90,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0,
      warningDescription: "Revers\xE3o direta por encapsulamento qu\xEDmico."
    },
    receptorProfile: {},
    effectHR: 0.05,
    effectBP: 0.05,
    effectRR: 0.5,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: -1,
    specialTraits: {
      isNMBAReversal: true
    }
  },
  // ==========================================
  // 7. LOCAL ANESTHETICS
  // ==========================================
  {
    id: "bupivacaine_05",
    name: "Bupivaca\xEDna 0.5% (Epidural / Bloqueio)",
    brandName: "Neoca\xEDna / Marcaine",
    category: "local_anesthetic",
    description: "Anest\xE9sico local do tipo amida de longa dura\xE7\xE3o (4-8h). Excelente para anestesia peridural lombossacra, bloqueios dos membros ou tronculares.",
    defaultConcentrationMgMl: 5,
    // 5 mg/ml (0.5%)
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.5, max: 2, typical: 1 },
      feline: { min: 0.5, max: 1.5, typical: 1 },
      equine: { min: 0.5, max: 1.5, typical: 0.8 },
      bovine: { min: 0.5, max: 1.5, typical: 0.8 }
    },
    supportedRoutes: ["Epidural", "Local"],
    onsetMinutes: 12,
    durationMinutes: 360,
    transitLagSecondsIV: 60,
    ke0: 0.15,
    halfLifeAlpha: 15,
    halfLifeBeta: 200,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0.3,
      reflexBradycardiaRisk: 0.2,
      arrhythmiaRisk: 0.7,
      histamineRelease: false,
      lethalityRiskScore: 0.6,
      warningDescription: "Inje\xE7\xE3o intravascular inadvertida causa cardiotoxicidade refrat\xE1ria!"
    },
    receptorProfile: {
      naVChannelBlock: 0.98
    },
    effectHR: -0.05,
    effectBP: -0.15,
    effectRR: 0,
    effectDepth: 0.1,
    effectAnalgesia: 0.95,
    macReductionPct: 0.4,
    muscleRelaxation: 0.75,
    specialTraits: {}
  },
  // ==========================================
  // 8. ACUTE SYSTEMIC ANTIHYPERTENSIVES
  // ==========================================
  {
    id: "sodium_nitroprusside",
    name: "Nitroprussiato de S\xF3dio (CRI)",
    brandName: "Nipride",
    category: "antihypertensive",
    description: "Vasodilatador arterial e venoso ultracurto, doador de \xF3xido n\xEDtrico. Uso titulado em emerg\xEAncia hipertensiva e redu\xE7\xE3o aguda de pr\xE9/p\xF3s-carga, sempre com press\xE3o arterial cont\xEDnua.",
    defaultConcentrationMgMl: 0.2,
    unit: "mcg",
    doseUnit: "mcg/kg/min",
    recommendedDose: {
      canine: { min: 0.5, max: 10, typical: 1 },
      feline: { min: 0.5, max: 3, typical: 1 }
    },
    supportedRoutes: ["CRI"],
    onsetMinutes: 0.25,
    durationMinutes: 2,
    transitLagSecondsIV: 10,
    ke0: 3.5,
    halfLifeAlpha: 0.5,
    halfLifeBeta: 2,
    fastBolusRisk: {
      apneaRisk: 0.05,
      hypotensionSeverity: 0.95,
      reflexBradycardiaRisk: 0.05,
      arrhythmiaRisk: 0.25,
      histamineRelease: false,
      lethalityRiskScore: 0.8,
      warningDescription: "Nunca administrar em b\xF3lus. Queda abrupta da perfus\xE3o e ac\xFAmulo de cianeto/tiocianato podem ocorrer com taxas altas ou infus\xE3o prolongada."
    },
    effectHR: 0.22,
    effectBP: -0.95,
    effectRR: 0.05,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: { isDirectVasodilator: true, hasCyanideToxicityRisk: true }
  },
  {
    id: "hydralazine",
    name: "Hidralazina Injet\xE1vel",
    brandName: "Apresolina",
    category: "antihypertensive",
    description: "Vasodilatador arteriolar direto para redu\xE7\xE3o aguda de p\xF3s-carga ou hipertens\xE3o grave. Resposta menos previs\xEDvel e mais longa que o nitroprussiato; requer titula\xE7\xE3o e monitoriza\xE7\xE3o.",
    defaultConcentrationMgMl: 20,
    unit: "mg",
    doseUnit: "mg/kg",
    recommendedDose: {
      canine: { min: 0.05, max: 0.2, typical: 0.1 }
    },
    recommendedCriDose: {
      canine: { min: 1.5, max: 5, typical: 2 }
    },
    criDoseUnit: "mcg/kg/min",
    supportedRoutes: ["IV_slow", "CRI"],
    onsetMinutes: 8,
    durationMinutes: 180,
    transitLagSecondsIV: 20,
    ke0: 0.45,
    halfLifeAlpha: 8,
    halfLifeBeta: 180,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0.75,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.35,
      histamineRelease: false,
      lethalityRiskScore: 0.45,
      warningDescription: "Redu\xE7\xE3o imprevis\xEDvel e prolongada da press\xE3o, com hipotens\xE3o e taquicardia reflexa se administrada rapidamente."
    },
    effectHR: 0.3,
    effectBP: -0.72,
    effectRR: 0,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: { isDirectVasodilator: true }
  },
  // ==========================================
  // 9. FLUID THERAPY & BLOOD
  // ==========================================
  {
    id: "fluid_lrs",
    name: "Ringer com Lactato (LRS)",
    brandName: "Solu\xE7\xE3o de Ringer c/ Lactato",
    category: "fluid_crystalloid",
    description: "Cristaloide balanceado isot\xF4nico. Padr\xE3o-ouro para reposi\xE7\xE3o vol\xEAmica transoperat\xF3ria, manuten\xE7\xE3o e corre\xE7\xE3o de desidrata\xE7\xE3o.",
    defaultConcentrationMgMl: 1,
    unit: "ml",
    doseUnit: "ml/kg/h",
    recommendedDose: {
      canine: { min: 5, max: 20, typical: 5 },
      feline: { min: 3, max: 10, typical: 3 },
      equine: { min: 5, max: 15, typical: 10 },
      bovine: { min: 5, max: 15, typical: 10 }
    },
    supportedRoutes: ["CRI"],
    onsetMinutes: 5,
    durationMinutes: 45,
    transitLagSecondsIV: 15,
    ke0: 0.5,
    halfLifeAlpha: 10,
    halfLifeBeta: 40,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0,
      histamineRelease: false,
      lethalityRiskScore: 0,
      warningDescription: "B\xF3lus seguro em hipovolemia, atentar para sobrecarga h\xEDdrica em cardiopatas."
    },
    effectHR: -0.05,
    effectBP: 0.25,
    effectRR: 0,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {}
  },
  {
    id: "hypertonic_saline_72",
    name: "Salina Hipert\xF4nica 7.2%",
    brandName: "NaCl 7.2%",
    category: "fluid_crystalloid",
    description: "Cristaloide hiperosmolar para ressuscita\xE7\xE3o vol\xEAmica ultra-r\xE1pida em choque hipovol\xEAmico descompensado ou hipertens\xE3o intracraniana.",
    defaultConcentrationMgMl: 72,
    unit: "ml",
    doseUnit: "ml/kg",
    recommendedDose: {
      canine: { min: 3, max: 5, typical: 4 },
      feline: { min: 2, max: 4, typical: 3 },
      equine: { min: 2, max: 4, typical: 3 },
      bovine: { min: 2, max: 4, typical: 3 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 2,
    durationMinutes: 40,
    transitLagSecondsIV: 20,
    ke0: 0.9,
    halfLifeAlpha: 4,
    halfLifeBeta: 30,
    fastBolusRisk: {
      apneaRisk: 0.05,
      hypotensionSeverity: 0.1,
      reflexBradycardiaRisk: 0.3,
      arrhythmiaRisk: 0.2,
      histamineRelease: false,
      lethalityRiskScore: 0.2,
      warningDescription: "B\xF3lus ultrarr\xE1pido pode causar hipotens\xE3o transit\xF3ria vagal."
    },
    effectHR: 0.05,
    effectBP: 0.55,
    effectRR: 0,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {}
  },
  {
    id: "whole_blood",
    name: "Sangue Total",
    brandName: "Hemotransfus\xE3o",
    category: "blood_product",
    description: "Transfus\xE3o de sangue total para corre\xE7\xE3o de hemorragia aguda maci\xE7a, hemat\xF3crito cr\xEDtico e restaura\xE7\xE3o da capacidade carreadora de oxig\xEAnio.",
    defaultConcentrationMgMl: 1,
    unit: "ml",
    doseUnit: "ml/kg",
    recommendedDose: {
      canine: { min: 10, max: 20, typical: 15 },
      feline: { min: 10, max: 15, typical: 12 },
      equine: { min: 5, max: 15, typical: 10 },
      bovine: { min: 5, max: 15, typical: 10 }
    },
    supportedRoutes: ["IV_slow"],
    onsetMinutes: 10,
    durationMinutes: 1440,
    transitLagSecondsIV: 30,
    ke0: 0.3,
    halfLifeAlpha: 30,
    halfLifeBeta: 1440,
    fastBolusRisk: {
      apneaRisk: 0,
      hypotensionSeverity: 0,
      reflexBradycardiaRisk: 0,
      arrhythmiaRisk: 0.1,
      histamineRelease: false,
      lethalityRiskScore: 0.1,
      warningDescription: "Administrar com filtro transfusional."
    },
    effectHR: -0.15,
    effectBP: 0.5,
    effectRR: -0.1,
    effectDepth: 0,
    effectAnalgesia: 0,
    macReductionPct: 0,
    muscleRelaxation: 0,
    specialTraits: {}
  },
  ...SCOPOLAMINE_DRUGS
];

// src/data/speciesData.ts
var SPECIES_DATABASE = {
  canine: {
    id: "canine",
    namePt: "Canino (C\xE3o)",
    nameEn: "Canine (Dog)",
    iconName: "Dog",
    typicalWeightRangeKg: [2, 60],
    bloodVolumeMlPerKg: 88,
    // 85-90 ml/kg
    normalVitals: {
      hrMin: 60,
      hrMax: 140,
      hrTypical: 90,
      rrMin: 10,
      rrMax: 30,
      rrTypical: 16,
      sysBpMin: 90,
      sysBpMax: 140,
      diaBpMin: 50,
      diaBpMax: 90,
      mapMin: 65,
      mapMax: 100,
      mapTypical: 78,
      tempMinC: 37.5,
      tempMaxC: 39.2,
      tempTypicalC: 38.3,
      spo2Normal: 98,
      etco2Min: 35,
      etco2Max: 45,
      etco2Typical: 38
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.3,
      sevoflurane: 2.36
    },
    recommendedEtTubeRange: {
      min: 4.5,
      max: 12
    },
    specialConsiderations: [
      "Alta varia\xE7\xE3o de tamanho corporal (Chihuahua 1.5kg a Dogue Alem\xE3o 70kg)",
      "Ra\xE7as braquicef\xE1licas com estenose de narinas, palato mole alongado e t\xF4nus vagal elevado",
      "Predisposi\xE7\xE3o a arritmias (VPCs) em afec\xE7\xF5es espl\xEAnicas, tor\xE7\xE3o g\xE1strica e trauma tor\xE1cico"
    ]
  },
  feline: {
    id: "feline",
    namePt: "Felino (Gato)",
    nameEn: "Feline (Cat)",
    iconName: "Cat",
    typicalWeightRangeKg: [2.5, 7.5],
    bloodVolumeMlPerKg: 60,
    // 55-66 ml/kg
    normalVitals: {
      hrMin: 120,
      hrMax: 200,
      hrTypical: 145,
      rrMin: 15,
      rrMax: 35,
      rrTypical: 22,
      sysBpMin: 90,
      sysBpMax: 140,
      diaBpMin: 55,
      diaBpMax: 90,
      mapMin: 65,
      mapMax: 100,
      mapTypical: 80,
      tempMinC: 38,
      tempMaxC: 39.2,
      tempTypicalC: 38.5,
      spo2Normal: 98,
      etco2Min: 35,
      etco2Max: 45,
      etco2Typical: 38
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.63,
      sevoflurane: 2.58
    },
    recommendedEtTubeRange: {
      min: 3,
      max: 5.5
    },
    specialConsiderations: [
      "Reflexo laringoesp\xE1stico intenso (obrigat\xF3rio uso de lidoca\xEDna t\xF3pica antes da intuba\xE7\xE3o)",
      "Extrema suscetibilidade a hipotermia r\xE1pida devido \xE0 grande rela\xE7\xE3o superf\xEDcie/massa corporal",
      "Menor capacidade de conjuga\xE7\xE3o hep\xE1tica por glicuronida\xE7\xE3o (cuidado com opioides e fenois)",
      "Predisposi\xE7\xE3o a laringoestenose p\xF3s-cuff hiperinsuflado (> 20 cmH2O)"
    ]
  },
  equine: {
    id: "equine",
    namePt: "Equino (Cavalo)",
    nameEn: "Equine (Horse)",
    iconName: "Horse",
    typicalWeightRangeKg: [350, 700],
    bloodVolumeMlPerKg: 75,
    normalVitals: {
      hrMin: 28,
      hrMax: 44,
      hrTypical: 36,
      rrMin: 8,
      rrMax: 16,
      rrTypical: 10,
      sysBpMin: 90,
      sysBpMax: 130,
      diaBpMin: 50,
      diaBpMax: 80,
      mapMin: 70,
      // In horses, MAP > 70 mmHg is strictly required to prevent myopathy
      mapMax: 95,
      mapTypical: 75,
      tempMinC: 37.2,
      tempMaxC: 38.5,
      tempTypicalC: 37.8,
      spo2Normal: 97,
      etco2Min: 35,
      etco2Max: 50,
      etco2Typical: 40
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.31,
      sevoflurane: 2.31
    },
    recommendedEtTubeRange: {
      min: 18,
      max: 30
    },
    specialConsiderations: [
      "PAM > 70 mmHg mandat\xF3ria sob anestesia inalat\xF3ria para prevenir rabdomi\xF3lise e neuropatia p\xF3s-anest\xE9sica",
      "Grande massa visceral causa compress\xE3o pulmonar em dec\xFAbito dorsal/lateral (atelectasia e shunt V/Q)",
      "Protocolo de TIVA (Triplo Gotejamento: Guafenesina + Xilazina + Cetamina) amplamente utilizado a campo",
      "Fase de recupera\xE7\xE3o e apoio de p\xE9 cr\xEDtica com risco de fraturas catastr\xF3ficas"
    ]
  },
  bovine: {
    id: "bovine",
    namePt: "Bovino (Boi/Vaca)",
    nameEn: "Bovine",
    iconName: "Beef",
    typicalWeightRangeKg: [300, 800],
    bloodVolumeMlPerKg: 60,
    normalVitals: {
      hrMin: 50,
      hrMax: 80,
      hrTypical: 65,
      rrMin: 12,
      rrMax: 28,
      rrTypical: 18,
      sysBpMin: 95,
      sysBpMax: 140,
      diaBpMin: 55,
      diaBpMax: 90,
      mapMin: 70,
      mapMax: 100,
      mapTypical: 80,
      tempMinC: 38,
      tempMaxC: 39.5,
      tempTypicalC: 38.6,
      spo2Normal: 97,
      etco2Min: 35,
      etco2Max: 45,
      etco2Typical: 38
    },
    tidalVolumeMlKg: [10, 15],
    macValues: {
      isoflurane: 1.18,
      sevoflurane: 2.15
    },
    recommendedEtTubeRange: {
      min: 16,
      max: 26
    },
    specialConsiderations: [
      "Alt\xEDssima sensibilidade a agonistas alfa-2 (xilazina requer 1/10 da dose de equinos)",
      "Risco de timpanismo ruminal agudo e regurgita\xE7\xE3o passiva com aspira\xE7\xE3o pulmonar severa",
      "Saliva\xE7\xE3o profusa cont\xEDnua n\xE3o inibida por atropina (anticolin\xE9rgicos aumentam viscosidade)"
    ]
  }
};

// src/engine/antimuscarinicSystems.ts
var clamp = (x) => Math.max(0, Math.min(1, x));
function stepAntimuscarinicSystems(dt, patient, state, receptors) {
  const old = state.visceral ?? { gutMotilityFraction: 1, secretionsFraction: 1, urinaryRetentionMl: 0, gutStasisSeconds: 0, centralAntimuscarinicBurden: 0 };
  const m3 = clamp(-receptors.m3Drive);
  const central = receptors.centralM1Blockade ?? 0;
  const targetMotility = Math.max(0.03, (1 - m3 * 0.8) * (1 - Math.max(0, receptors.muOpioidDrive) * 0.45) * (1 - Math.max(0, receptors.alpha2Drive) * 0.35));
  const motility = old.gutMotilityFraction + (targetMotility - old.gutMotilityFraction) * (1 - Math.exp(-dt / (targetMotility < old.gutMotilityFraction ? 45 : 300)));
  const retentionInput = patient.weightKg * (1 + (state.fluids.renalOutputMlKgHour ?? 0)) * dt / 3600 * m3;
  const retention = Math.max(0, old.urinaryRetentionMl + retentionInput - old.urinaryRetentionMl * (1 - m3) * (1 - Math.exp(-dt / 300)));
  return { ...state, visceral: {
    gutMotilityFraction: motility,
    secretionsFraction: old.secretionsFraction + (1 - m3 * 0.75 - old.secretionsFraction) * (1 - Math.exp(-dt / 60)),
    urinaryRetentionMl: retention,
    gutStasisSeconds: motility < 0.4 ? old.gutStasisSeconds + dt : Math.max(0, old.gutStasisSeconds - dt * 0.5),
    centralAntimuscarinicBurden: old.centralAntimuscarinicBurden + (central - old.centralAntimuscarinicBurden) * (1 - Math.exp(-dt / 40))
  } };
}
function antimuscarinicSignals(patient, state, receptors) {
  const signals = [];
  const central = receptors.centralM1Blockade ?? 0;
  if (central > 0.05) {
    const synergy = central * Math.max(receptors.centralSedation, receptors.muOpioidDrive, receptors.hypnoticEffect);
    signals.push({ id: "central-antimuscarinic", source: "farmacologia", targets: ["neurologico", "respiratorio"], topology: "one-to-many", severity: central, label: "Bloqueio muscar\xEDnico central: altera\xE7\xE3o de consci\xEAncia e soma\xE7\xE3o com depressores", effects: { respiratoryDriveMultiplier: 1 - synergy * 0.25 } });
  }
  const m3 = clamp(-receptors.m3Drive);
  if (m3 > 0.08) signals.push({ id: "peripheral-antimuscarinic", source: "farmacologia", targets: ["autonomico", "renal", "respiratorio"], topology: "one-to-many", severity: m3, label: "Bloqueio M3: redu\xE7\xE3o de secre\xE7\xF5es, motilidade e esvaziamento vesical", effects: { renalPerfusionMultiplier: 1 - clamp((state.visceral?.urinaryRetentionMl ?? 0) / Math.max(1, patient.weightKg * 20)) * 0.3 } });
  const stasis = clamp((state.visceral?.gutStasisSeconds ?? 0) / 7200);
  if (stasis > 0.05) signals.push({ id: "antimuscarinic-gut-stasis", source: "autonomico", targets: ["metabolico", "cardiovascular"], topology: "one-to-many", severity: stasis, label: "Hipomotilidade digestiva persistente: estase e estresse visceral", effects: { metabolicCo2Multiplier: 1 + stasis * 0.05, heartRateMultiplier: 1 + stasis * 0.08 } });
  return signals;
}

// src/engine/fluidTherapy.ts
var clamp2 = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));
var finite = (x) => Number.isFinite(x) ? Math.max(0, x) : 0;
var FLUID_SOLUTIONS = [
  { name: "Ringer com Lactato (LRS)", kind: "balanced", sodium: 130, chloride: 109, glucoseMgMl: 0 },
  { name: "NaCl 0.9% (Fisiol\xF3gico)", kind: "saline", sodium: 154, chloride: 154, glucoseMgMl: 0 },
  { name: "Salina Hipert\xF4nica 7.2%", kind: "hypertonic", sodium: 1232, chloride: 1232, glucoseMgMl: 0 },
  { name: "Hetastarch (Coloide)", kind: "colloid", sodium: 154, chloride: 154, glucoseMgMl: 0 },
  { name: "Sangue Total Fresco", kind: "blood", sodium: 145, chloride: 110, glucoseMgMl: 0 },
  { name: "Glicose 5% em \xE1gua", kind: "dextrose", sodium: 0, chloride: 0, glucoseMgMl: 50 },
  { name: "Ringer com Lactato + Glicose 2.5%", kind: "balanced", sodium: 130, chloride: 109, glucoseMgMl: 25 }
];
function fluidSolution(name) {
  const exact = FLUID_SOLUTIONS.find((fluid) => fluid.name === name);
  if (exact) return exact;
  const label = name.toLowerCase();
  if (/sangue|blood/.test(label)) return FLUID_SOLUTIONS[4];
  if (/hipert|hyperton/.test(label)) return FLUID_SOLUTIONS[2];
  if (/starch|coloide/.test(label)) return FLUID_SOLUTIONS[3];
  if (/nacl|fisiol/.test(label)) return FLUID_SOLUTIONS[1];
  return FLUID_SOLUTIONS[0];
}
var FLUID_DRUG_NAMES = {
  fluid_lrs: FLUID_SOLUTIONS[0].name,
  hypertonic_saline_72: FLUID_SOLUTIONS[2].name,
  whole_blood: FLUID_SOLUTIONS[4].name
};
function advanceFluidDelivery(dt, equipment, doses = [], updatedDoses = []) {
  const seconds = finite(dt);
  const deliveries = [];
  if (equipment.isFluidPumpRunning) deliveries.push({ fluidName: equipment.activeFluidType, volumeMl: finite(equipment.fluidRateMlPerHour) * seconds / 3600 });
  const fluidBoluses = (equipment.fluidBoluses ?? []).map((bolus) => {
    const volume = finite(bolus.volumeMl);
    const delivered = clamp2(finite(bolus.deliveredMl), 0, volume);
    const increment = bolus.isRunning ? Math.min(volume - delivered, volume * seconds / Math.max(1, finite(bolus.durationSec))) : 0;
    if (increment > 0) deliveries.push({ fluidName: bolus.fluidName, volumeMl: increment });
    return { ...bolus, deliveredMl: delivered + increment, isRunning: bolus.isRunning && delivered + increment < volume - 1e-8 };
  });
  for (const dose of doses) {
    const fluidName = FLUID_DRUG_NAMES[dose.drugId];
    if (!fluidName) continue;
    const updated = updatedDoses.find((candidate) => candidate.id === dose.id);
    const activeSeconds = Math.max(0, seconds - (dose.transitLagRemainingSec ?? 0));
    const duration = Math.max(0.1, dose.deliveryDurationSec ?? 1);
    const volumeMl = dose.isCRI ? dose.isInfusionRunning !== false ? finite(dose.criRateMlPerHour ?? 0) * activeSeconds / 3600 : 0 : finite(dose.volumeMl) * Math.max(0, Math.min(1, (updated?.deliveryElapsedSec ?? dose.deliveryElapsedSec ?? 0) / duration) - Math.min(1, (dose.deliveryElapsedSec ?? 0) / duration));
    if (volumeMl > 0) deliveries.push({ fluidName, volumeMl });
  }
  return { deliveries, fluidBoluses, totalFluidsInfusedMl: finite(equipment.totalFluidsInfusedMl) + deliveries.reduce((sum, delivery) => sum + delivery.volumeMl, 0) };
}
function stepFluidBalance(dt, patient, state, deliveries) {
  const f = { ...state.fluids };
  const weight = Math.max(0.1, patient.weightKg);
  const seconds = finite(dt);
  const expectedBlood = weight * SPECIES_DATABASE[patient.species].bloodVolumeMlPerKg;
  const deficit = Math.max(0, expectedBlood - patient.baselineVitals.bloodVolumeMl, expectedBlood * (patient.pathologyConditions.hypovolemiaSeverity ?? 0) * 0.45, patient.pathologyConditions.traumaHemorrhage ? expectedBlood * 0.3 : 0);
  const leak = clamp2((patient.pathologyConditions.sepsisVasodilation ? 0.5 : 0) + state.systemicRegulation.endothelialDysfunction * 0.5);
  const intrinsicRenal = clamp2(1 - (patient.pathologyConditions.renalDysfunctionSeverity ?? 0), 0.02, 1);
  const renal = clamp2(state.organPerfusion.renalFraction * intrinsicRenal * (1 - state.systemicRegulation.renalInjury * 0.65), 0.01, 1.1);
  f.interstitialMl ??= 0;
  f.eliminatedMl ??= 0;
  f.deliveredMl ??= 0;
  f.sodiumExcessMmol ??= 0;
  f.chlorideExcessMmol ??= 0;
  f.baseDeficitMmol ??= 0;
  f.freeWaterMl ??= 0;
  f.lastDeliveryMl = deliveries.reduce((sum, d) => sum + finite(d.volumeMl), 0);
  f.currentDeliveryMlPerHour = seconds > 0 ? f.lastDeliveryMl * 3600 / seconds : 0;
  f.glucoseInputMg = 0;
  const count = Math.max(1, Math.ceil(seconds / 2));
  const h = seconds / count;
  for (let step = 0; step < count; step++) {
    for (const delivery of deliveries) {
      const solution = fluidSolution(delivery.fluidName);
      const ml = finite(delivery.volumeMl) / count;
      f.deliveredMl += ml;
      f.glucoseInputMg += ml * solution.glucoseMgMl;
      if (solution.kind === "blood") f.wholeBloodCentralMl += ml;
      else if (solution.kind === "colloid") f.colloidCentralMl += ml;
      else {
        f.crystalloidCentralMl += ml;
        if (solution.kind === "dextrose") f.freeWaterMl += ml;
        if (solution.kind === "hypertonic") f.hypertonicExpansionMl += ml * 2.2 * clamp2(1 - deficit / expectedBlood, 0.3, 1);
      }
      if (solution.kind !== "blood") {
        f.sodiumExcessMmol += ml / 1e3 * (solution.sodium - 145);
        f.chlorideExcessMmol += ml / 1e3 * (solution.chloride - 110);
        if (solution.kind === "saline" || solution.kind === "hypertonic" || solution.kind === "colloid") f.baseDeficitMmol += ml / 1e3 * 35;
      }
    }
    f.hypertonicExpansionMl *= Math.exp(-Math.LN2 * h / 1500);
    const colloidLeak = f.colloidCentralMl * (1 - Math.exp(-h * (1 + leak * 3) / 14400));
    f.colloidCentralMl -= colloidLeak;
    f.interstitialMl += colloidLeak;
    const totalCrystalloid = f.crystalloidCentralMl + f.interstitialMl;
    const fillingDeficit = Math.max(0, deficit - f.wholeBloodCentralMl - f.colloidCentralMl - f.hypertonicExpansionMl);
    const freeFraction = clamp2(f.freeWaterMl / Math.max(1, totalCrystalloid));
    const equilibriumCentral = totalCrystalloid * (0.25 - freeFraction * 0.17) * (1 - leak * 0.4) + Math.min(totalCrystalloid * 0.35, fillingDeficit * 0.5);
    const exchange = (f.crystalloidCentralMl - equilibriumCentral) * (1 - Math.exp(-h * (1 + leak) / 600));
    f.crystalloidCentralMl -= exchange;
    f.interstitialMl += exchange;
    const expansion = f.crystalloidCentralMl + f.colloidCentralMl + f.wholeBloodCentralMl + f.hypertonicExpansionMl;
    const overload = Math.max(0, expansion - deficit) / expectedBlood;
    const retention = clamp2((expansion + 1) / (deficit + 1), 0.08, 1);
    const removable = Math.max(0, f.crystalloidCentralMl + f.interstitialMl);
    const osmoticDiuresis = Math.max(0, state.metabolic.bloodGlucoseMgDl - 180) / 120;
    const renalCapacityMlH = weight * (1 + overload * 18 + osmoticDiuresis) * renal * retention * (1 - (f.congestionSeverity ?? 0) * 0.6);
    const eliminated = Math.min(removable, renalCapacityMlH * h / 3600, removable * (1 - Math.exp(-h * renal / 3600)));
    const centralShare = f.crystalloidCentralMl / Math.max(1e-3, removable);
    f.crystalloidCentralMl -= eliminated * centralShare;
    f.interstitialMl -= eliminated * (1 - centralShare);
    f.eliminatedMl += eliminated;
    const washout = 1 - eliminated / Math.max(1, removable);
    f.freeWaterMl *= washout;
    f.sodiumExcessMmol *= washout;
    f.chlorideExcessMmol *= washout;
    f.baseDeficitMmol *= Math.exp(-h * renal / 7200);
    f.renalOutputMlKgHour = h > 0 ? eliminated / weight * 3600 / h : 0;
  }
  f.effectiveCirculatingExpansionMl = f.crystalloidCentralMl + f.hypertonicExpansionMl + f.colloidCentralMl + f.wholeBloodCentralMl;
  const circulatingBlood = Math.max(1, expectedBlood - deficit);
  const redCells = circulatingBlood * patient.baselineVitals.hctPct / 100 + f.wholeBloodCentralMl * 0.4;
  f.currentHematocritPct = clamp2(100 * redCells / (circulatingBlood + f.effectiveCirculatingExpansionMl), 5, 65);
  const ecfL = weight * 0.2 + (f.crystalloidCentralMl + f.interstitialMl) / 1e3;
  f.sodiumMmolL = clamp2(145 + f.sodiumExcessMmol / ecfL, 90, 210);
  f.chlorideMmolL = clamp2(110 + f.chlorideExcessMmol / ecfL, 60, 180);
  f.fluidBaseDeficitMmolL = clamp2(f.baseDeficitMmol / ecfL, 0, 18);
  const tolerance = patient.pathologyConditions.cardiacFailureDCM ? 0.08 : 0.25;
  const excessCentral = Math.max(0, f.effectiveCirculatingExpansionMl - deficit) / expectedBlood;
  const congestionTarget = clamp2((excessCentral - tolerance) / 0.5);
  f.congestionSeverity = (f.congestionSeverity ?? 0) + (congestionTarget - (f.congestionSeverity ?? 0)) * (1 - Math.exp(-seconds / 45));
  const interstitialExcess = Math.max(0, f.interstitialMl - deficit * 0.6) / weight;
  const edemaTarget = clamp2(f.congestionSeverity * 0.8 + Math.max(0, interstitialExcess - 25) / 110 * (0.3 + leak));
  f.pulmonaryEdemaSeverity = (f.pulmonaryEdemaSeverity ?? 0) + (edemaTarget - (f.pulmonaryEdemaSeverity ?? 0)) * (1 - Math.exp(-seconds / (edemaTarget > (f.pulmonaryEdemaSeverity ?? 0) ? 120 : 1800)));
  return f;
}
function fluidPhysiologicalSignals(state) {
  const f = state.fluids;
  const signals = [];
  const congestion = f.congestionSeverity ?? 0;
  if (congestion > 0.02) signals.push({ id: "fluid-congestion", source: "cardiovascular", targets: ["renal", "hepatico", "cardiovascular"], topology: "one-to-many", severity: congestion, label: "Congest\xE3o por sobrecarga reduz perfus\xE3o org\xE2nica e efici\xEAncia card\xEDaca", effects: { renalPerfusionMultiplier: 1 - congestion * 0.5, hepaticPerfusionMultiplier: 1 - congestion * 0.25, contractilityMultiplier: 1 - congestion * 0.25 } });
  const edema = f.pulmonaryEdemaSeverity ?? 0;
  if (edema > 0.02) signals.push({ id: "fluid-pulmonary-edema", source: "cardiovascular", targets: ["respiratorio"], topology: "one-to-one", severity: edema, label: "Edema intersticial pulmonar amplia shunt e esfor\xE7o ventilat\xF3rio", effects: { respiratoryDriveMultiplier: 1 + edema * 0.35 } });
  const acid = clamp2((f.fluidBaseDeficitMmolL ?? 0) / 12);
  if (acid > 0.05) signals.push({ id: "fluid-hyperchloremia", source: "metabolico", targets: ["cardiovascular", "renal"], topology: "one-to-many", severity: acid, label: "Carga de cloreto provoca acidose e reduz responsividade vascular", effects: { adrenergicResponsiveness: 1 - acid * 0.2, renalPerfusionMultiplier: 1 - acid * 0.15 } });
  const sodiumBurden = clamp2(Math.max(0, Math.abs((f.sodiumMmolL ?? 145) - 145) - 10) / 40);
  if (sodiumBurden > 0.02) signals.push({ id: "fluid-dysnatremia", source: "metabolico", targets: ["neurologico", "cardiovascular"], topology: "one-to-many", severity: sodiumBurden, label: "Dist\xFArbio osm\xF3tico por composi\xE7\xE3o e ac\xFAmulo de fluidos", effects: { respiratoryDriveMultiplier: 1 - sodiumBurden * 0.2, contractilityMultiplier: 1 - sodiumBurden * 0.1, arrhythmogenicBurden: sodiumBurden * 0.15 } });
  return signals;
}

// src/engine/speciesPhysiology.ts
var SPECIES_CELLULAR_CONFIGS = {
  canine: {
    species: "canine",
    cardiacOutputMlKgMin: 110,
    anatomicDeadSpaceMlKg: 3,
    dynamicComplianceMlKgCmH2O: 1.45,
    functionalResidualCapacityMlKg: 45,
    oxygenConsumptionMlKgMin: 5,
    muOpioidSensitivityFactor: 1.05,
    kappaOpioidSensitivityFactor: 1,
    gabaSensitivityFactor: 1,
    nmdaSensitivityFactor: 1,
    atropineResponseFactor: 1,
    restingVagalTone: 0.75,
    // Elevated resting vagal tone
    splenicContractionReserve: 0.16,
    // Contraction of rich splenic capsule releases 15-20% hematocrit
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 1,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1,
    laryngealReflexSensitivity: 1,
    lidocaineIvCardiotoxicityThresholdMgKg: 8,
    criticalMapThresholdMmHg: 60,
    recumbencyPulmonaryShuntBasePct: 5,
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 0.5,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: false,
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: true,
    tramadolM1ConversionEfficiency: 0.15
    // Dogs produce very little M1 (mostly inactive M2)
  },
  feline: {
    species: "feline",
    cardiacOutputMlKgMin: 140,
    anatomicDeadSpaceMlKg: 3.2,
    dynamicComplianceMlKgCmH2O: 1.25,
    functionalResidualCapacityMlKg: 38,
    oxygenConsumptionMlKgMin: 6.5,
    muOpioidSensitivityFactor: 1,
    kappaOpioidSensitivityFactor: 0.95,
    gabaSensitivityFactor: 1.05,
    nmdaSensitivityFactor: 1,
    atropineResponseFactor: 1,
    restingVagalTone: 0.3,
    splenicContractionReserve: 0.05,
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 1.1,
    ugt1a6Deficiency: true,
    // Gene UGT1A6 pseudogenized (inability to rapidly conjugate phenols, benzoic acid)
    glucuronidationClearanceMultiplier: 0.18,
    // 82% slower glucuronidation clearance
    laryngealReflexSensitivity: 4.5,
    // Violent laryngeal adductor reflex (laryngospasm risk without topical lidocaine)
    lidocaineIvCardiotoxicityThresholdMgKg: 1.2,
    // Extremely narrow window! > 1.2 mg/kg IV causes direct myocardial depression
    criticalMapThresholdMmHg: 60,
    recumbencyPulmonaryShuntBasePct: 4,
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 0.15,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: true,
    // High mu agonists provoke CNS excitation, hyperthermia, mydriasis
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: false,
    tramadolM1ConversionEfficiency: 0.85
    // Felines efficiently produce active M1 O-desmethyltramadol with potent mu-analgesia
  },
  equine: {
    species: "equine",
    cardiacOutputMlKgMin: 75,
    anatomicDeadSpaceMlKg: 2.5,
    dynamicComplianceMlKgCmH2O: 1.05,
    functionalResidualCapacityMlKg: 38,
    oxygenConsumptionMlKgMin: 3,
    muOpioidSensitivityFactor: 0.85,
    kappaOpioidSensitivityFactor: 1.1,
    gabaSensitivityFactor: 0.95,
    nmdaSensitivityFactor: 1,
    atropineResponseFactor: 1,
    restingVagalTone: 0.9,
    // Extremely high resting vagal tone (resting HR 28-40 bpm)
    splenicContractionReserve: 0.22,
    // Massive splenic reservoir (can raise HCT from 32% to 50% under stress)
    alpha2DReceptorExpression: false,
    alpha2SensitivityFactor: 1,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1,
    laryngealReflexSensitivity: 0.8,
    lidocaineIvCardiotoxicityThresholdMgKg: 5,
    criticalMapThresholdMmHg: 70,
    // STRICTLY >= 70 mmHg required to prevent post-anesthetic compartment myopathy
    recumbencyPulmonaryShuntBasePct: 26,
    // Visceral compression on diaphragm causes severe V/Q mismatch and atelectasis
    ruminalFermentationGasRateLPerHour: 0,
    continuousSalivaProductionLPerDay: 12,
    atropineSalivaryContraindication: false,
    opioidManiaSusceptibility: true,
    normalPhysiologicalSecondDegreeAVBlock: true,
    // Mobitz I (Wenckebach) is normal in healthy resting horse
    normalPhysiologicalSinusArrhythmia: false,
    tramadolM1ConversionEfficiency: 0.4
  },
  bovine: {
    species: "bovine",
    cardiacOutputMlKgMin: 95,
    anatomicDeadSpaceMlKg: 3,
    dynamicComplianceMlKgCmH2O: 0.95,
    functionalResidualCapacityMlKg: 35,
    oxygenConsumptionMlKgMin: 3.2,
    muOpioidSensitivityFactor: 0.9,
    kappaOpioidSensitivityFactor: 1,
    gabaSensitivityFactor: 1,
    nmdaSensitivityFactor: 0.95,
    atropineResponseFactor: 0.8,
    restingVagalTone: 0.45,
    splenicContractionReserve: 0.08,
    alpha2DReceptorExpression: true,
    // Specific alpha-2D subtype in ruminant brainstem
    // The roughly 10-fold clinical sensitivity is already represented by the
    // species-specific dose ranges. This residual factor models response at an
    // equi-effective normalized dose without applying the difference twice.
    alpha2SensitivityFactor: 1.35,
    ugt1a6Deficiency: false,
    glucuronidationClearanceMultiplier: 1.1,
    laryngealReflexSensitivity: 1.4,
    lidocaineIvCardiotoxicityThresholdMgKg: 5,
    criticalMapThresholdMmHg: 65,
    recumbencyPulmonaryShuntBasePct: 20,
    // Huge rumen pushes against diaphragm in dorsal/lateral recumbency
    ruminalFermentationGasRateLPerHour: 40,
    // Continuous 30-50 L/h gas accumulation without eructation
    continuousSalivaProductionLPerDay: 75,
    // Profuse 50-100 L/day secretion of alkaline saliva
    atropineSalivaryContraindication: true,
    // Anticholinergics cause thick, viscous mucus plugs that asphyxiate
    opioidManiaSusceptibility: false,
    normalPhysiologicalSecondDegreeAVBlock: false,
    normalPhysiologicalSinusArrhythmia: false,
    tramadolM1ConversionEfficiency: 0.35
  }
};
var SpeciesPhysiologyEngine = class {
  /**
   * Evaluates active species-specific particularities based on patient, current vitals, doses, and elapsed time.
   */
  static evaluateParticularities(patient, _simTimeSeconds, currentMAP, currentCeAlpha2, currentCeOpioid, currentCeLidocaine, currentCeInhalant, isRecumbent, isAtropineAdministered, persistentShuntFractionPct = 5, persistentMyopathyRisk = 0, persistentRuminalBloatSeverity = 0) {
    const config = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const particularities = [];
    let shuntFractionPct = persistentShuntFractionPct;
    let effectiveAlpha2Drive = currentCeAlpha2;
    let myopathyIschemiaRiskScore = persistentMyopathyRisk;
    let ruminalBloatSeverity = persistentRuminalBloatSeverity;
    if (patient.species === "canine") {
      particularities.push({
        id: "canine_vagotonia",
        name: "T\xF4nus Vagal Acentuado & Arritmia Sinusal",
        species: "canine",
        severity: "info",
        mechanism: "Alta densidade de receptores M2 no n\xF3 sinoatrial com modula\xE7\xE3o respirat\xF3ria do efluxo vagal.",
        clinicalImpact: "Varia\xE7\xE3o r\xEDtmica fisiol\xF3gica da FC com a ventila\xE7\xE3o; resposta intensa a opioides e excelente resposta a anticolin\xE9rgicos.",
        isActive: true,
        intensity: 0.75
      });
      if (currentCeOpioid > 0.4) {
        particularities.push({
          id: "canine_opioid_bradycardia",
          name: "Bradicardia Vagal Mediada por Opioides",
          species: "canine",
          severity: "warning",
          mechanism: "Estimula\xE7\xE3o de n\xFAcleos vagais bulbares por agonistas mu puros promovendo cronotropismo negativo.",
          clinicalImpact: "Bradicardia responsiva a atropina/glicopirrolato sem redu\xE7\xE3o prim\xE1ria do volume sist\xF3lico.",
          isActive: true,
          intensity: Math.min(1, currentCeOpioid)
        });
      }
    }
    if (patient.species === "feline") {
      particularities.push({
        id: "feline_ugt1a6_deficit",
        name: "D\xE9ficit Cong\xEAnito de Glicuronida\xE7\xE3o (Gene UGT1A6 Pseudogenizado)",
        species: "feline",
        severity: "warning",
        mechanism: "Incapacidade funcional da isoenzima microssomal UGT1A6 para conjugar compostos fen\xF3licos e carbox\xEDlicos.",
        clinicalImpact: "Metaboliza\xE7\xE3o lenta de propofol (risco de corp\xFAsculos de Heinz em infus\xF5es prolongadas), toxicidade por paracetamol e fenois.",
        isActive: true,
        intensity: 0.9
      });
      if (currentCeLidocaine > 0.15) {
        const toxRatio = currentCeLidocaine / 0.5;
        const isCritical = currentCeLidocaine > 0.45;
        particularities.push({
          id: "feline_lidocaine_sensitivity",
          name: isCritical ? "TOXICIDADE CARD\xCDACA AGUDA POR LIDOCA\xCDNA EM FELINO" : "Alta Sensibilidade Card\xEDaca a Anest\xE9sicos Locais IV",
          species: "feline",
          severity: isCritical ? "lethal" : "danger",
          mechanism: "Sensibilidade mioc\xE1rdica acentuada com bloqueio dos canais de s\xF3dio NaV1.5 e influxo de c\xE1lcio dependente.",
          clinicalImpact: isCritical ? "Depress\xE3o inotr\xF3pica fulminante, colapso de PAM, bradicardia intrat\xE1vel e parada em AESP/assistolia." : "Estreita margem de seguran\xE7a; evitar infus\xE3o IV rotineira de lidoca\xEDna em gatos.",
          isActive: true,
          intensity: Math.min(1, toxRatio)
        });
      }
      if (currentCeOpioid > 0.7 && currentCeAlpha2 < 0.1) {
        particularities.push({
          id: "feline_morphine_mania",
          name: 'Risco de Disforia / Hipertermia por Opioide ("Mania M\xF3rfica")',
          species: "feline",
          severity: "warning",
          mechanism: "Ativa\xE7\xE3o assim\xE9trica de receptores mu e kappa em vias dopamin\xE9rgicas e centro termorregulador hipotal\xE2mico.",
          clinicalImpact: "Midr\xEDase fixa, agita\xE7\xE3o psicomotora, desorienta\xE7\xE3o e hipertermia p\xF3s-operat\xF3ria.",
          isActive: true,
          intensity: 0.65
        });
      }
    }
    if (patient.species === "equine") {
      particularities.push({
        id: "equine_normal_av_block",
        name: "T\xF4nus Vagal Basal Extremo (BAV de 2\xBA Grau Fisiol\xF3gico)",
        species: "equine",
        severity: "info",
        mechanism: "Hipertonia vagal basal sobre o n\xF3 AV, produzindo pausas e bloqueio Mobitz Tipo I (Wenckebach) benigno em repouso.",
        clinicalImpact: "Fisiol\xF3gico em repouso; reverte imediatamente com atropina ou est\xEDmulo simp\xE1tico.",
        isActive: true,
        intensity: 0.85
      });
      if (currentMAP < config.criticalMapThresholdMmHg || myopathyIschemiaRiskScore > 0.01) {
        particularities.push({
          id: "equine_compartment_myopathy",
          name: "RISCO CR\xCDTICO: Isquemia Muscular & Miopatia P\xF3s-Anest\xE9sica (PAM < 70 mmHg)",
          species: "equine",
          severity: currentMAP < 55 ? "lethal" : "danger",
          mechanism: "Colapso da press\xE3o capilar de perfus\xE3o nos compartimentos musculares profundos dependentes (tr\xEDceps/gl\xFAteo).",
          clinicalImpact: "Rabdomi\xF3lise severa, libera\xE7\xE3o maci\xE7a de mioglobina, paralisia de nervo radial e incapacidade de apoio de p\xE9 na recupera\xE7\xE3o.",
          isActive: true,
          intensity: myopathyIschemiaRiskScore
        });
      }
      if (isRecumbent) {
        shuntFractionPct = Math.min(45, shuntFractionPct + (currentCeInhalant > 0.8 ? 3 : 0));
        particularities.push({
          id: "equine_vq_shunt",
          name: "Shunt Intrapulmonar Massivo por Compress\xE3o Visceral (Atelectasia V/Q)",
          species: "equine",
          severity: "warning",
          mechanism: "150+ kg de v\xEDsceras abdominais comprimem o hemidiafragma em dec\xFAbito, colapsando alv\xE9olos dependentes.",
          clinicalImpact: `Shunt direito-esquerdo estimado em ${shuntFractionPct.toFixed(0)}% (Qs/Qt), limitando a PaO2 arterial mesmo a 100% de O2.`,
          isActive: true,
          intensity: shuntFractionPct / 40
        });
      }
    }
    if (patient.species === "bovine") {
      effectiveAlpha2Drive = currentCeAlpha2 * config.alpha2SensitivityFactor;
      particularities.push({
        id: "bovine_alpha2d_hypersensitivity",
        name: "Hiper-sensibilidade a Alfa-2 (Isoforma Adren\xE9rgica alfa-2D)",
        species: "bovine",
        severity: currentCeAlpha2 > 0.15 ? "lethal" : "warning",
        mechanism: "Express\xE3o da isoforma alfa-2D no SNC com afinidade 10x maior pela xilazina do que equinos.",
        clinicalImpact: "Exige estritamente 1/10 da dose equina (0.05 mg/kg vs 0.5-1.0 mg/kg). Doses equinas causam colapso cardiovascular e edema pulmonar agudo.",
        isActive: true,
        intensity: Math.min(1, currentCeAlpha2 * 4)
      });
      if (isRecumbent && ruminalBloatSeverity > 0.25) {
        particularities.push({
          id: "bovine_ruminal_tympanism",
          name: "Timpanismo Ruminal Agudo & Restri\xE7\xE3o Diafragm\xE1tica",
          species: "bovine",
          severity: ruminalBloatSeverity > 0.65 ? "danger" : "warning",
          mechanism: "Fermenta\xE7\xE3o ruminal cont\xEDnua (30-50 L/h de g\xE1s) sem eructa\xE7\xE3o, comprimindo diafragma e veia cava caudal.",
          clinicalImpact: "Hipoventila\xE7\xE3o restritiva, reten\xE7\xE3o severa de CO2 e redu\xE7\xE3o do retorno venoso (queda do d\xE9bito card\xEDaco).",
          isActive: true,
          intensity: ruminalBloatSeverity
        });
      }
      particularities.push({
        id: "bovine_saliva_atropine_warning",
        name: isAtropineAdministered ? "ALERTA: Atropina em Ruminante (Rolhas Mucosas Obstrutivas)" : "Saliva\xE7\xE3o Alcalina Cont\xEDnua & Risco de Regurgita\xE7\xE3o Passiva",
        species: "bovine",
        severity: isAtropineAdministered ? "danger" : "info",
        mechanism: "Secre\xE7\xE3o salivar de at\xE9 75 L/dia n\xE3o \xE9 inibida por anticolin\xE9rgicos; atropina apenas aumenta a viscosidade.",
        clinicalImpact: isAtropineAdministered ? "Saliva espessa e aderente forma rolhas mucosas no tubo endotraqueal com risco de asfixia aguda." : "Manter via a\xE9rea vedada com cuff insuflado e cabe\xE7a posicionada declive para drenagem livre.",
        isActive: true,
        intensity: isAtropineAdministered ? 0.95 : 0.6
      });
    }
    return {
      particularities,
      shuntFractionPct,
      effectiveAlpha2Drive,
      myopathyIschemiaRiskScore,
      ruminalBloatSeverity
    };
  }
};

// src/engine/cellularReceptors.ts
var clamp3 = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
var TARGET_DEPENDENT_REVERSAL_IDS = /* @__PURE__ */ new Set([
  "atipamezole",
  "naloxone",
  "flumazenil",
  "neostigmine",
  "sugammadex",
  "lipid_emulsion_20"
]);
function hillResponse(exposure, ec50 = 0.45, hill = 1.35) {
  const ce = Math.max(0, exposure);
  if (ce === 0) return 0;
  const numerator = Math.pow(ce, hill);
  return numerator / (Math.pow(Math.max(1e-4, ec50), hill) + numerator);
}
var combineEffects = (effects) => {
  let remaining = 1;
  for (const effect of effects) remaining *= 1 - clamp3(effect);
  return clamp3(1 - remaining);
};
var CellularReceptorsEngine = class {
  /**
   * Integrates saturable target occupancy, competitive reversal and separate
   * sedation, hypnosis, analgesia, dissociation and motor-block axes.
   */
  static computeReceptorState(patient, activeDoses, inhalantCe, _inhalantAgent, receptorAdaptiveFeedback = 0) {
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const exposures = /* @__PURE__ */ new Map();
    for (const dose of activeDoses) {
      const drugDef = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
      if (!drugDef || dose.currentCe <= 1e-5) continue;
      if (!getSpeciesDoseRange(drugDef, patient.species)) continue;
      const route = getRoutePharmacokinetics(drugDef, dose.route);
      const isToleranceSensitive = Boolean(
        drugDef.specialTraits?.isOpioid || drugDef.specialTraits?.isAlpha2Agonist || drugDef.specialTraits?.isSympathomimetic
      );
      const adaptiveSensitivity = isToleranceSensitive ? Math.max(0.65, 1 - receptorAdaptiveFeedback * 0.35) : 1;
      const current = exposures.get(drugDef.id) || {
        drugDef,
        totalCe: 0,
        systemicCe: 0,
        centralCe: 0,
        localCe: 0
      };
      current.totalCe += dose.currentCe * adaptiveSensitivity;
      current.systemicCe += dose.currentCe * route.systemicEffectFraction * adaptiveSensitivity;
      current.localCe += dose.currentCe * route.localNeuralEffectFraction * adaptiveSensitivity;
      const neuraxialOpioidFactor = dose.route === "Epidural" && drugDef.specialTraits?.isOpioid ? 0.7 : 0;
      current.centralCe += dose.currentCe * Math.max(route.systemicEffectFraction, neuraxialOpioidFactor) * adaptiveSensitivity;
      exposures.set(drugDef.id, current);
    }
    const ceFor = (id) => exposures.get(id)?.totalCe || 0;
    const atipamezoleCe = ceFor("atipamezole");
    const naloxoneCe = ceFor("naloxone");
    const flumazenilCe = ceFor("flumazenil");
    const sugammadexCe = ceFor("sugammadex");
    const neostigmineCe = ceFor("neostigmine");
    const lipidEmulsionCe = ceFor("lipid_emulsion_20");
    const alpha2SchildFactor = 1 + 7 * hillResponse(atipamezoleCe, 0.3, 1.2);
    const muSchildFactor = 1 + 8 * hillResponse(naloxoneCe, 0.25, 1.2);
    const kappaSchildFactor = 1 + 3 * hillResponse(naloxoneCe, 0.35, 1.2);
    const bzdSchildFactor = 1 + 8 * hillResponse(flumazenilCe, 0.25, 1.2);
    const lipidSinkReduction = 1 - 0.9 * hillResponse(lipidEmulsionCe, 0.35, 1.2);
    let rawAlpha1 = 0;
    let rawAlpha2 = 0;
    let rawBeta1 = 0;
    let rawBeta2 = 0;
    let rawCentralM1 = 0;
    let centralAntimuscarinicExcitation = 0;
    let rawM2 = 0;
    let rawM3 = 0;
    const m2BlockadeEffects = [];
    const m3BlockadeEffects = [];
    let rawD2 = 0;
    let rawH1 = 0;
    let raw5HT2 = 0;
    let rawNMBA = 0;
    let rawMu = 0;
    let rawKappa = 0;
    let rawNMDA = 0;
    let rawSystemicNaV = 0;
    let rawLocalNaV = 0;
    let rawCaV = 0;
    let rawAChE = 0;
    let bzdSite = 0;
    let propofolSite = 0;
    let neurosteroidSite = 0;
    let etomidateChlorideSite = 0;
    const sedationEffects = [];
    const hypnoticEffects = [];
    const dissociativeEffects = [];
    const relaxationEffects = [];
    const respiratoryDepressants = [];
    const respiratoryStimulants = [];
    const analgesicEffects = [];
    const macSparingEffects = [];
    let rigidityDrive = 0;
    let arousalDrive = 0;
    let directHeartRateEffect = 0;
    let directBloodPressureEffect = 0;
    let directVenodilatorEffect = 0;
    let directVasodilatorEffect = 0;
    let volumeExpansion = 0;
    let oxygenCarryingSupport = 0;
    let potassiumLoad = 0;
    let calciumMembraneStabilization = 0;
    let alkalinization = 0;
    for (const exposure of exposures.values()) {
      const { drugDef } = exposure;
      const profile = drugDef.receptorProfile;
      const applyCatalogPhenotype = !TARGET_DEPENDENT_REVERSAL_IDS.has(drugDef.id);
      let systemicExposure = exposure.systemicCe;
      let centralExposure = exposure.centralCe;
      if (drugDef.specialTraits?.isAlpha2Agonist) {
        centralExposure /= alpha2SchildFactor;
        systemicExposure /= alpha2SchildFactor;
      }
      if (drugDef.specialTraits?.isOpioid) {
        centralExposure /= muSchildFactor;
        systemicExposure /= muSchildFactor;
      }
      if (drugDef.specialTraits?.isBenzodiazepine) {
        centralExposure /= bzdSchildFactor;
        systemicExposure /= bzdSchildFactor;
      }
      const speciesResponseFactor = drugDef.id === "atropine" ? speciesConfig.atropineResponseFactor : 1;
      if (FLUID_DRUG_NAMES[drugDef.id]) continue;
      const systemicResponse = hillResponse(systemicExposure) * speciesResponseFactor;
      const centralResponse = hillResponse(centralExposure);
      if (profile?.alpha1) {
        rawAlpha1 += systemicResponse * profile.alpha1.affinity * profile.alpha1.intrinsicEfficacy;
      }
      if (profile?.alpha2) {
        const targetResponse = hillResponse(exposure.centralCe / alpha2SchildFactor);
        rawAlpha2 += targetResponse * profile.alpha2.affinity * profile.alpha2.intrinsicEfficacy * speciesConfig.alpha2SensitivityFactor;
      }
      if (profile?.beta1) rawBeta1 += systemicResponse * profile.beta1.affinity * profile.beta1.intrinsicEfficacy;
      if (profile?.beta2) rawBeta2 += systemicResponse * profile.beta2.affinity * profile.beta2.intrinsicEfficacy;
      if (profile?.m1) {
        rawCentralM1 += centralResponse * profile.m1.affinity * Math.max(0, -profile.m1.intrinsicEfficacy);
        centralAntimuscarinicExcitation += hillResponse(centralExposure, 2.5, 3) * profile.m1.affinity;
      }
      if (profile?.m2) {
        const effect = systemicResponse * profile.m2.affinity * profile.m2.intrinsicEfficacy;
        if (effect < 0) m2BlockadeEffects.push(-effect);
        else rawM2 += effect;
      }
      if (profile?.m3) {
        const effect = systemicResponse * profile.m3.affinity * profile.m3.intrinsicEfficacy;
        if (effect < 0) m3BlockadeEffects.push(-effect);
        else rawM3 += effect;
      }
      if (profile?.dopamineD2) rawD2 += centralResponse * profile.dopamineD2.affinity * profile.dopamineD2.intrinsicEfficacy;
      if (profile?.histamineH1) rawH1 += centralResponse * profile.histamineH1.affinity * profile.histamineH1.intrinsicEfficacy;
      if (profile?.serotonin2) raw5HT2 += systemicResponse * profile.serotonin2.affinity * profile.serotonin2.intrinsicEfficacy;
      if (profile?.nm) rawNMBA += hillResponse(systemicExposure, 0.35, 2.2) * profile.nm.affinity;
      if (profile?.gabaA) {
        const gabaResponse = hillResponse(centralExposure * speciesConfig.gabaSensitivityFactor);
        bzdSite += gabaResponse * (profile.gabaA.bzdAllosteric || 0);
        const directGatingPower = Math.max(
          profile.gabaA.propofolBarbiturateDirect || 0,
          profile.gabaA.directChlorideGating || 0
        );
        if (drugDef.id === "propofol" || drugDef.id === "thiopental") {
          propofolSite += gabaResponse * directGatingPower;
        } else if (drugDef.id === "alfaxalone") {
          neurosteroidSite += gabaResponse * directGatingPower;
        } else {
          etomidateChlorideSite += gabaResponse * directGatingPower;
        }
      }
      if (profile?.muOpioid) {
        const response = hillResponse(exposure.centralCe / muSchildFactor);
        const m1ConversionFactor = drugDef.specialTraits?.isTramadol ? speciesConfig.tramadolM1ConversionEfficiency : 1;
        rawMu += response * profile.muOpioid.affinity * profile.muOpioid.intrinsicEfficacy * speciesConfig.muOpioidSensitivityFactor * m1ConversionFactor;
      }
      if (profile?.kappaOpioid) {
        const response = hillResponse(exposure.centralCe / kappaSchildFactor);
        rawKappa += response * profile.kappaOpioid.affinity * profile.kappaOpioid.intrinsicEfficacy * speciesConfig.kappaOpioidSensitivityFactor;
      }
      if (profile?.nmdaPoreBlock) rawNMDA += centralResponse * profile.nmdaPoreBlock * speciesConfig.nmdaSensitivityFactor;
      if (profile?.caVChannelBlock) rawCaV += systemicResponse * profile.caVChannelBlock;
      if (profile?.acheInhibition) rawAChE += systemicResponse * profile.acheInhibition;
      if (profile?.naVChannelBlock) {
        const recommended = getSpeciesDoseRange(drugDef, patient.species);
        const typicalDose = Math.max(1e-4, recommended?.typical || 1);
        const toxicDose = speciesConfig.lidocaineIvCardiotoxicityThresholdMgKg;
        const normalizedToxicThreshold = drugDef.id === "lidocaine_2pct" ? Math.max(2.5, toxicDose / typicalDose) : 3.5;
        rawSystemicNaV += hillResponse(exposure.systemicCe, normalizedToxicThreshold * 0.8, 2.2) * profile.naVChannelBlock * lipidSinkReduction;
        rawLocalNaV += hillResponse(exposure.localCe, 0.35, 1.5) * profile.naVChannelBlock;
      }
      if (applyCatalogPhenotype && drugDef.effectDepth > 0) {
        let sedativeResponse = centralResponse;
        if (drugDef.specialTraits?.isOpioid) {
          sedativeResponse = hillResponse(centralExposure, 0.48, 2);
          if (drugDef.specialTraits?.isTramadol) {
            sedativeResponse *= speciesConfig.tramadolM1ConversionEfficiency;
          }
        }
        const depthEffect = clamp3(drugDef.effectDepth * sedativeResponse);
        if (drugDef.specialTraits?.isDissociative) {
          dissociativeEffects.push(depthEffect);
        } else if (drugDef.category === "induction" && drugDef.id !== "guaifenesin") {
          hypnoticEffects.push(depthEffect);
        } else if (drugDef.category === "premedication" || drugDef.category === "opioid_analgesic" || drugDef.id === "guaifenesin") {
          sedationEffects.push(depthEffect);
        }
      } else if (applyCatalogPhenotype && drugDef.effectDepth < 0) {
        arousalDrive += Math.abs(drugDef.effectDepth) * centralResponse;
      }
      if (applyCatalogPhenotype) {
        const effectiveAnalgesicExposure = drugDef.category === "local_anesthetic" || drugDef.supportedRoutes.includes("Local") || drugDef.supportedRoutes.includes("Epidural") ? Math.max(centralResponse, hillResponse(exposure.localCe, 0.25, 1.2)) : centralResponse;
        let finalAnalgesia = drugDef.effectAnalgesia * effectiveAnalgesicExposure;
        if (drugDef.specialTraits?.isTramadol) {
          finalAnalgesia = drugDef.effectAnalgesia * (0.3 * centralResponse + 0.7 * effectiveAnalgesicExposure * speciesConfig.tramadolM1ConversionEfficiency);
        }
        if (drugDef.effectAnalgesia > 0) analgesicEffects.push(finalAnalgesia);
        if (drugDef.macReductionPct > 0) {
          const macFactor = drugDef.specialTraits?.isTramadol ? 0.25 + 0.75 * speciesConfig.tramadolM1ConversionEfficiency : 1;
          macSparingEffects.push(drugDef.macReductionPct * centralResponse * macFactor);
        }
        if (drugDef.muscleRelaxation > 0) relaxationEffects.push(drugDef.muscleRelaxation * centralResponse);
        if (drugDef.muscleRelaxation < 0) rigidityDrive += Math.abs(drugDef.muscleRelaxation) * centralResponse;
        if (drugDef.effectRR < 0) respiratoryDepressants.push(Math.abs(drugDef.effectRR) * centralResponse);
        if (drugDef.effectRR > 0) respiratoryStimulants.push(drugDef.effectRR * systemicResponse);
        const hasNodalMechanism = profile?.beta1 || profile?.m2 || profile?.alpha2 || drugDef.specialTraits?.isOpioid;
        const hasPressureMechanism = profile?.alpha1 || profile?.alpha2 || profile?.beta1 || profile?.beta2 || drugDef.specialTraits?.isDirectVasodilator;
        if (!hasNodalMechanism) directHeartRateEffect += drugDef.effectHR * systemicResponse;
        if (!hasPressureMechanism) directBloodPressureEffect += drugDef.effectBP * systemicResponse;
        if (drugDef.specialTraits?.isDirectVasodilator) {
          directVasodilatorEffect += Math.abs(drugDef.effectBP) * systemicResponse;
          if (drugDef.id === "sodium_nitroprusside") directVenodilatorEffect += Math.abs(drugDef.effectBP) * systemicResponse;
        }
      }
      if (drugDef.id === "potassium_chloride") potassiumLoad += systemicResponse;
      if (drugDef.id === "calcium_gluconate") calciumMembraneStabilization += systemicResponse;
      if (drugDef.id === "sodium_bicarbonate") alkalinization += systemicResponse;
    }
    const ensureTarget = (id, targetExists, apply) => {
      const exposure = exposures.get(id);
      if (exposure && !targetExists) apply(hillResponse(exposure.centralCe));
    };
    for (const id of ["dexmedetomidine", "xylazine", "detomidine"]) {
      const def = exposures.get(id)?.drugDef;
      ensureTarget(id, Boolean(def?.receptorProfile?.alpha2), (response) => {
        rawAlpha2 += response * speciesConfig.alpha2SensitivityFactor / alpha2SchildFactor;
      });
    }
    ensureTarget("epinephrine", Boolean(exposures.get("epinephrine")?.drugDef.receptorProfile?.beta1), (r) => {
      rawAlpha1 += r * 0.85;
      rawBeta1 += r;
      rawBeta2 += r * 0.75;
    });
    ensureTarget("norepinephrine", Boolean(exposures.get("norepinephrine")?.drugDef.receptorProfile?.alpha1), (r) => {
      rawAlpha1 += r;
      rawBeta1 += r * 0.65;
    });
    ensureTarget("dobutamine", Boolean(exposures.get("dobutamine")?.drugDef.receptorProfile?.beta1), (r) => {
      rawBeta1 += r;
      rawBeta2 += r * 0.3;
    });
    ensureTarget("ephedrine", Boolean(exposures.get("ephedrine")?.drugDef.receptorProfile?.beta1), (r) => {
      const ephedrineDoses = activeDoses.filter((d) => d.drugId === "ephedrine");
      const cumulativeDose = ephedrineDoses.reduce((acc, d) => acc + d.dosePerKg, 0);
      const typicalDose = getSpeciesDoseRange(exposures.get("ephedrine").drugDef, patient.species)?.typical || 0.1;
      const tachyphylaxisRatio = Math.max(0.25, 1 - Math.min(0.75, Math.max(0, (cumulativeDose / typicalDose - 1.2) * 0.45)));
      rawAlpha1 += r * 0.45 + r * 0.4 * tachyphylaxisRatio;
      rawBeta1 += r * 0.5 + r * 0.35 * tachyphylaxisRatio;
      rawBeta2 += r * 0.35;
    });
    ensureTarget("guaifenesin", false, () => void 0);
    ensureTarget("ketamine", false, (r) => {
      rawBeta1 += r * 0.4;
      rawAlpha1 += r * 0.3;
    });
    const neostigmineReversal = 0.9 * hillResponse(neostigmineCe, 0.35, 1.4);
    const effectiveNMBABlock = clamp3(rawNMBA * (1 - neostigmineReversal));
    const macSparingFraction = Math.min(0.75, combineEffects(macSparingEffects));
    const effectiveInhalantCe = Math.max(0, inhalantCe) / Math.max(0.3, 1 - macSparingFraction);
    const volatileSite = hillResponse(effectiveInhalantCe, 0.65, 1.5);
    const allostericBZDMultiplier = 1 + 1.15 * clamp3(bzdSite);
    const directGating = 1.48 * propofolSite + 1.48 * neurosteroidSite + 1.48 * etomidateChlorideSite + 0.86 * volatileSite;
    const gabaAChlorideConductance = 0.08 + directGating * allostericBZDMultiplier + 0.11 * clamp3(bzdSite);
    const receptorSedation = clamp3(
      0.5 * Math.abs(Math.min(0, rawD2)) + 0.18 * Math.abs(Math.min(0, rawH1)) + 0.45 * Math.max(0, rawAlpha2) + 0.12 * Math.max(0, rawMu) + 0.08 * Math.max(0, rawKappa) + 0.22 * clamp3(bzdSite)
    );
    let centralSedation = combineEffects([...sedationEffects, receptorSedation]);
    if (speciesConfig.opioidManiaSusceptibility && rawMu > 0.45 && rawAlpha2 < 0.2 && propofolSite < 0.15 && neurosteroidSite < 0.15) {
      arousalDrive += Math.min(0.35, (rawMu - 0.45) * 0.55);
      directHeartRateEffect += Math.min(0.18, (rawMu - 0.45) * 0.28);
    }
    centralSedation = clamp3(centralSedation - clamp3(arousalDrive) * 0.45);
    const injectableHypnosis = combineEffects(hypnoticEffects);
    const hypnoticEffect = combineEffects([
      injectableHypnosis,
      volatileSite * 0.94,
      Math.min(0.35, centralSedation * 0.22)
    ]);
    const dissociativeEffect = combineEffects(dissociativeEffects);
    const muscleRelaxation = clamp3(combineEffects([...relaxationEffects, effectiveNMBABlock]) - clamp3(rigidityDrive) * 0.75);
    const phenotypicRespiratoryDepression = combineEffects(respiratoryDepressants);
    const respiratoryStimulation = combineEffects(respiratoryStimulants);
    const respiratoryDepression = clamp3(
      combineEffects([
        phenotypicRespiratoryDepression,
        clamp3(Math.max(0, rawMu) * 0.42),
        clamp3(hypnoticEffect * 0.38)
      ]) - respiratoryStimulation * 0.6
    );
    const mechanisticAnalgesicSignal = 1.75 * Math.max(0, rawMu) + 1.05 * Math.max(0, rawKappa) + 1.1 * Math.max(0, rawAlpha2) + 1 * Math.max(0, rawNMDA) + 3.2 * Math.max(0, rawLocalNaV);
    const mechanisticAnalgesia = hillResponse(mechanisticAnalgesicSignal, 1, 1.7);
    const localNeuralBlockAfferent = hillResponse(rawLocalNaV, 0.28, 2);
    const phenotypicAnalgesia = combineEffects(analgesicEffects);
    const nociceptiveInhibition = clamp3(Math.max(mechanisticAnalgesia, phenotypicAnalgesia, localNeuralBlockAfferent));
    let acuteBolusHypotension = 0;
    let acuteBolusRespiratoryDepression = 0;
    let acuteBolusBradycardia = 0;
    let acuteBolusArrhythmia = 0;
    let histamineRelease = 0;
    for (const dose of activeDoses) {
      if ((dose.bolusShockRemainingSec || 0) <= 0 || (dose.bolusShockMagnitude || 0) <= 0) continue;
      const def = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
      if (!def?.fastBolusRisk) continue;
      if (def.specialTraits?.isAlpha2Agonist && atipamezoleCe > 0.05) continue;
      if (def.specialTraits?.isOpioid && naloxoneCe > 0.05) continue;
      if (def.specialTraits?.isBenzodiazepine && flumazenilCe > 0.05) continue;
      const fade = clamp3((dose.bolusShockRemainingSec || 0) / 25);
      const magnitude = clamp3((dose.bolusShockMagnitude || 0) * fade, 0, 1.5);
      acuteBolusHypotension = Math.max(acuteBolusHypotension, def.fastBolusRisk.hypotensionSeverity * magnitude);
      acuteBolusRespiratoryDepression = Math.max(acuteBolusRespiratoryDepression, def.fastBolusRisk.apneaRisk * magnitude);
      acuteBolusBradycardia = Math.max(acuteBolusBradycardia, def.fastBolusRisk.reflexBradycardiaRisk * magnitude);
      acuteBolusArrhythmia = Math.max(acuteBolusArrhythmia, def.fastBolusRisk.arrhythmiaRisk * magnitude);
      if (def.fastBolusRisk.histamineRelease) histamineRelease = Math.max(histamineRelease, magnitude);
    }
    const opioidVagalDrive = rawMu > 0.05 ? clamp3(rawMu) * 0.35 : 0;
    const muscarinicBlockade = combineEffects(m2BlockadeEffects);
    const effectiveM2 = clamp3(rawM2 + opioidVagalDrive) * (1 - muscarinicBlockade) - muscarinicBlockade;
    rawM3 = clamp3(rawM3) * (1 - combineEffects(m3BlockadeEffects)) - combineEffects(m3BlockadeEffects);
    let antiarrhythmicIbProtection = 0;
    for (const exposure of exposures.values()) {
      if (exposure.drugDef.specialTraits?.isAntiarrhythmicClass1b) {
        const therapeuticLevel = hillResponse(exposure.systemicCe, 0.4, 1.8);
        antiarrhythmicIbProtection = Math.max(antiarrhythmicIbProtection, therapeuticLevel);
      }
    }
    const netMyocardialGs = Math.max(0, rawBeta1);
    const netMyocardialGi = Math.max(0, effectiveM2) * 0.08 + Math.max(0, rawAlpha2) * 0.1;
    const cAMPMyocardial = clamp3(1 + 0.78 * netMyocardialGs - 0.68 * netMyocardialGi, 0.15, 3.5);
    const vasodilationDrive = 0.6 * Math.max(0, rawBeta2) + Math.abs(Math.min(0, rawAlpha1)) * 0.8;
    const vasoconstrictionDrive = Math.max(0, rawAlpha1) * 1.2 + Math.max(0, rawAlpha2) * 0.5;
    const cAMPVascular = clamp3(1 + 0.65 * vasodilationDrive - 0.72 * vasoconstrictionDrive, 0.2, 3);
    const estimatedPotassium = patient.baselineVitals.potassiumMeqL + clamp3(potassiumLoad) * 1.2 - clamp3(alkalinization) * 0.65;
    const untreatedHyperkalemicToxicity = clamp3((estimatedPotassium - 5.5) / 2.5);
    const hyperkalemicCardiotoxicity = clamp3(
      untreatedHyperkalemicToxicity * (1 - clamp3(calciumMembraneStabilization) * 0.82)
    );
    const myocardialDepression = 0.5 * rawSystemicNaV + 0.35 * rawCaV + Math.min(0.6, 0.18 * Math.max(0, inhalantCe)) + hyperkalemicCardiotoxicity * 0.42;
    const intracellularCalcium = clamp3(
      cAMPMyocardial * (1 - myocardialDepression) + calciumMembraneStabilization * 0.12,
      0.1,
      3
    );
    return {
      alpha1Drive: rawAlpha1,
      alpha2Drive: rawAlpha2,
      beta1Drive: rawBeta1,
      beta2Drive: rawBeta2,
      centralM1Blockade: clamp3(rawCentralM1),
      centralAntimuscarinicExcitation: clamp3(centralAntimuscarinicExcitation),
      m2Drive: effectiveM2,
      m3Drive: rawM3,
      dopamineD2Drive: rawD2,
      histamineH1Drive: rawH1,
      serotonin2Drive: raw5HT2,
      nmOccupancy: effectiveNMBABlock,
      gabaAChlorideConductance,
      bzdAllostericOccupancy: clamp3(bzdSite),
      propofolSiteOccupancy: clamp3(propofolSite),
      neurosteroidSiteOccupancy: clamp3(neurosteroidSite),
      volatileSiteOccupancy: volatileSite,
      volatileMacExposure: Math.max(0, inhalantCe),
      centralSedation,
      hypnoticEffect,
      dissociativeEffect,
      muscleRelaxation,
      respiratoryDepression,
      macSparingFraction,
      muOpioidDrive: rawMu,
      kappaOpioidDrive: rawKappa,
      nmdaBlockade: clamp3(rawNMDA),
      naVBlockade: clamp3(rawSystemicNaV),
      localNeuralBlockade: clamp3(rawLocalNaV),
      caVBlockade: clamp3(rawCaV),
      acheInhibition: clamp3(rawAChE),
      nociceptiveInhibition,
      directHeartRateEffect: clamp3(directHeartRateEffect, -1.5, 1.5),
      directBloodPressureEffect: clamp3(directBloodPressureEffect, -1.5, 1.5),
      directVenodilatorEffect: clamp3(directVenodilatorEffect, 0, 1.5),
      directVasodilatorEffect: clamp3(directVasodilatorEffect),
      acuteBolusHypotension: clamp3(acuteBolusHypotension),
      acuteBolusRespiratoryDepression: clamp3(acuteBolusRespiratoryDepression),
      acuteBolusBradycardia: clamp3(acuteBolusBradycardia),
      acuteBolusArrhythmia: clamp3(acuteBolusArrhythmia),
      histamineRelease: clamp3(histamineRelease),
      volumeExpansion: clamp3(volumeExpansion),
      oxygenCarryingSupport: clamp3(oxygenCarryingSupport),
      potassiumLoad: clamp3(potassiumLoad),
      calciumMembraneStabilization: clamp3(calciumMembraneStabilization),
      alkalinization: clamp3(alkalinization),
      hyperkalemicCardiotoxicity,
      antiarrhythmicIbProtection: clamp3(antiarrhythmicIbProtection),
      cAMPMyocardial,
      cAMPVascular,
      intracellularCalcium,
      reversalCe: {
        atipamezole: atipamezoleCe,
        naloxone: naloxoneCe,
        flumazenil: flumazenilCe,
        sugammadex: sugammadexCe,
        neostigmine: neostigmineCe,
        lipidEmulsion: lipidEmulsionCe
      }
    };
  }
};

// src/engine/systemCoupling.ts
var NEUTRAL_PHYSIOLOGICAL_MODIFIERS = {
  adrenergicResponsiveness: 1,
  heartRateMultiplier: 1,
  vascularResistanceMultiplier: 1,
  contractilityMultiplier: 1,
  respiratoryDriveMultiplier: 1,
  metabolicCo2Multiplier: 1,
  cellularOxygenUtilizationFraction: 1,
  additionalLactateMmolLMin: 0,
  myocardialIschemiaRatePerMinute: 0,
  arrhythmogenicBurden: 0,
  hepaticPerfusionMultiplier: 1,
  renalPerfusionMultiplier: 1
};
var clamp4 = (value, min, max) => Math.min(max, Math.max(min, value));
var aggregatePhysiologicalSignals = (signals) => {
  const result = { ...NEUTRAL_PHYSIOLOGICAL_MODIFIERS };
  for (const signal of signals) {
    const effects = signal.effects;
    if (effects.adrenergicResponsiveness !== void 0) result.adrenergicResponsiveness *= effects.adrenergicResponsiveness;
    if (effects.heartRateMultiplier !== void 0) result.heartRateMultiplier *= effects.heartRateMultiplier;
    if (effects.vascularResistanceMultiplier !== void 0) result.vascularResistanceMultiplier *= effects.vascularResistanceMultiplier;
    if (effects.contractilityMultiplier !== void 0) result.contractilityMultiplier *= effects.contractilityMultiplier;
    if (effects.respiratoryDriveMultiplier !== void 0) result.respiratoryDriveMultiplier *= effects.respiratoryDriveMultiplier;
    if (effects.metabolicCo2Multiplier !== void 0) result.metabolicCo2Multiplier *= effects.metabolicCo2Multiplier;
    if (effects.cellularOxygenUtilizationFraction !== void 0) result.cellularOxygenUtilizationFraction *= effects.cellularOxygenUtilizationFraction;
    result.additionalLactateMmolLMin += effects.additionalLactateMmolLMin || 0;
    result.myocardialIschemiaRatePerMinute += effects.myocardialIschemiaRatePerMinute || 0;
    result.arrhythmogenicBurden += effects.arrhythmogenicBurden || 0;
    if (effects.hepaticPerfusionMultiplier !== void 0) result.hepaticPerfusionMultiplier *= effects.hepaticPerfusionMultiplier;
    if (effects.renalPerfusionMultiplier !== void 0) result.renalPerfusionMultiplier *= effects.renalPerfusionMultiplier;
  }
  return {
    adrenergicResponsiveness: clamp4(result.adrenergicResponsiveness, 0.2, 1.1),
    heartRateMultiplier: clamp4(result.heartRateMultiplier, 0.35, 1.8),
    vascularResistanceMultiplier: clamp4(result.vascularResistanceMultiplier, 0.25, 2.2),
    contractilityMultiplier: clamp4(result.contractilityMultiplier, 0.18, 1.5),
    respiratoryDriveMultiplier: clamp4(result.respiratoryDriveMultiplier, 0.08, 1.5),
    metabolicCo2Multiplier: clamp4(result.metabolicCo2Multiplier, 0.7, 1.8),
    cellularOxygenUtilizationFraction: clamp4(result.cellularOxygenUtilizationFraction, 0.08, 1.1),
    additionalLactateMmolLMin: clamp4(result.additionalLactateMmolLMin, 0, 8),
    myocardialIschemiaRatePerMinute: clamp4(result.myocardialIschemiaRatePerMinute, 0, 0.8),
    arrhythmogenicBurden: clamp4(result.arrhythmogenicBurden, 0, 1),
    hepaticPerfusionMultiplier: clamp4(result.hepaticPerfusionMultiplier, 0.2, 1.15),
    renalPerfusionMultiplier: clamp4(result.renalPerfusionMultiplier, 0.2, 1.15)
  };
};

// src/engine/hemodynamicCircuit.ts
var HemodynamicCircuitEngine = class {
  /**
   * High-fidelity closed-loop hemodynamic simulation:
   * 1. Frank-Starling inotropy and stroke volume (preload, afterload, contractility).
   * 2. Arterial blood pressure dynamics (CO, SVR, aortic compliance).
   * 3. Baroreceptor reflex negative feedback loop with anesthetic gain depression.
   * 4. Myocardial oxygen balance (MVO2 vs coronary perfusion pressure).
   */
  static stepHemodynamics(dtSeconds, simTimeSeconds, patient, receptors, _equipment, resuscitation, isSurgicalStimulationActive, previousMAP, previousHR, previousIschemiaScore, ruminalBloatSeverity = 0, effectiveFluidExpansionMl = 0, previousCriticalTimers = {
    severeBradycardiaSeconds: 0,
    severeTachycardiaSeconds: 0,
    profoundHypotensionSeconds: 0
  }, previousSpO2 = 98, previousLactate = 1, previousNociceptiveStress = 0, integratedNociceptiveInput = 0, catecholamineReserve = 1, previousOxygenDeliveryMlKgMin = 20, coupling = NEUTRAL_PHYSIOLOGICAL_MODIFIERS) {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const baseHR = patient.baselineVitals.hr;
    const baseMAP = patient.baselineVitals.map;
    const adrenergicResponse = coupling.adrenergicResponsiveness;
    const alpha1Constriction = Math.max(0, receptors.alpha1Drive) * 0.65 * adrenergicResponse;
    const alpha2Constriction = Math.max(0, receptors.alpha2Drive) * 1.1;
    const alpha1Blockade = receptors.alpha1Drive < 0 ? Math.min(1, Math.abs(receptors.alpha1Drive)) * 0.16 : 0;
    const volatileVasodilation = Math.min(0.68, Math.max(0, receptors.volatileMacExposure) * 0.18);
    const beta2Dilation = Math.max(0, receptors.beta2Drive) * 0.25;
    const calibratedPressureDilation = Math.max(0, -receptors.directBloodPressureEffect) * 0.1;
    const titratableDirectVasodilation = receptors.directVasodilatorEffect * 0.52;
    const calibratedPressureSupport = Math.max(0, receptors.directBloodPressureEffect) * 0.16 * adrenergicResponse;
    const acuteVasodilation = receptors.acuteBolusHypotension * 0.28 + receptors.histamineRelease * 0.22;
    const sepsisDilation = patient.pathologyConditions.sepsisVasodilation ? 0.45 : 0;
    const analgesiaProt = receptors.nociceptiveInhibition;
    const dissociativeSomaticProt = Math.min(0.6, receptors.dissociativeEffect * 0.6);
    const totalAnalgesicProtection = Math.min(0.98, analgesiaProt + dissociativeSomaticProt * (1 - analgesiaProt));
    const afferentStimulus = integratedNociceptiveInput > 0 ? integratedNociceptiveInput : isSurgicalStimulationActive ? 1 : 0;
    const unblockedNociceptiveDrive = Math.max(0, afferentStimulus * (1 - totalAnalgesicProtection));
    const hypnoticAutonomicDampening = Math.min(0.28, Math.max(receptors.hypnoticEffect, receptors.volatileSiteOccupancy) * 0.28);
    const alpha2Sympatholysis = Math.min(0.85, Math.max(0, receptors.alpha2Drive) * 0.85);
    const targetBreakthrough = Math.max(0, Math.min(
      1,
      unblockedNociceptiveDrive * (1 - hypnoticAutonomicDampening) * (1 - alpha2Sympatholysis)
    ));
    let currentStress = previousNociceptiveStress;
    if (targetBreakthrough > currentStress) {
      const riseAlpha = 1 - Math.exp(-dtSeconds / 4.5);
      currentStress = currentStress + (targetBreakthrough - currentStress) * riseAlpha;
    } else {
      const decayAlpha = 1 - Math.exp(-dtSeconds / 18);
      currentStress = currentStress + (targetBreakthrough - currentStress) * decayAlpha;
    }
    const nociceptiveStressLevel = Number(Math.max(0, Math.min(1, currentStress)).toFixed(4));
    const surgicalVasoconstriction = nociceptiveStressLevel * 0.28 * Math.max(0.25, catecholamineReserve);
    const baselineCOApprox = patient.weightKg * speciesConfig.cardiacOutputMlKgMin / 1e3;
    const baseSVRApprox = Math.round((baseMAP - 4) / Math.max(0.1, baselineCOApprox) * 80);
    const baselineSV = baselineCOApprox * 1e3 / Math.max(1, baseHR);
    const expectedBloodVolumeMl = Math.max(1, patient.weightKg * speciesInfo.bloodVolumeMlPerKg);
    const observedDeficit = Math.max(0, 1 - patient.baselineVitals.bloodVolumeMl / expectedBloodVolumeMl);
    const declaredDeficit = Math.max(
      observedDeficit,
      (patient.pathologyConditions.hypovolemiaSeverity || 0) * 0.45,
      patient.pathologyConditions.traumaHemorrhage ? 0.3 : 0
    );
    let bloodVolumeRatio = 1 - declaredDeficit;
    if (receptors.alpha1Drive > 0.3 || receptors.beta1Drive > 0.4) {
      bloodVolumeRatio += speciesConfig.splenicContractionReserve * 0.5;
    }
    bloodVolumeRatio = Math.min(1.45, bloodVolumeRatio + effectiveFluidExpansionMl / expectedBloodVolumeMl);
    if (ruminalBloatSeverity > 0.15) {
      bloodVolumeRatio = Math.max(0.4, bloodVolumeRatio - ruminalBloatSeverity * 0.45);
    }
    const venousPooling = Math.min(1, Math.abs(Math.min(0, receptors.alpha1Drive))) * 0.22 + receptors.hypnoticEffect * 0.12 + calibratedPressureDilation * 0.45 + (receptors.directVenodilatorEffect ?? 0) * 0.12 + acuteVasodilation * 0.25;
    bloodVolumeRatio = Math.max(0.3, bloodVolumeRatio - venousPooling);
    bloodVolumeRatio = Math.min(1.4, bloodVolumeRatio + receptors.volumeExpansion * 0.28);
    const preloadEDV = baselineSV * 1.5 * Math.max(0.3, bloodVolumeRatio);
    const effectiveHypovolemicDeficit = Math.max(0, 1 - bloodVolumeRatio);
    let acidoticVasoplegia = 0;
    let acidoticInotropyDepression = 1;
    if (effectiveHypovolemicDeficit > 0.08 || patient.pathologyConditions.sepsisVasodilation) {
      if (previousLactate > 5) {
        const acidoticSeverity = Math.min(1, (previousLactate - 5) / 5);
        acidoticVasoplegia = acidoticSeverity * 0.25;
        acidoticInotropyDepression = Math.max(0.6, 1 - acidoticSeverity * 0.35);
      }
    }
    const baselineSVR = baseSVRApprox;
    const netVascularResistanceFactor = Math.max(
      0.3,
      (1 + alpha1Constriction + alpha2Constriction + calibratedPressureSupport + surgicalVasoconstriction - alpha1Blockade - volatileVasodilation - beta2Dilation - calibratedPressureDilation - acuteVasodilation - titratableDirectVasodilation - sepsisDilation - acidoticVasoplegia) * coupling.vascularResistanceMultiplier
    );
    const SVR = Math.round(baselineSVR * netVascularResistanceFactor);
    const responsiveCalcium = receptors.intracellularCalcium <= 1 ? receptors.intracellularCalcium : 1 + (receptors.intracellularCalcium - 1) * adrenergicResponse;
    let inotropyFactor = responsiveCalcium * acidoticInotropyDepression;
    if (patient.pathologyConditions.cardiacFailureDCM) {
      inotropyFactor *= 0.45;
    }
    let asaReserveFactor = 1;
    let asaBaroreflexFactor = 1;
    if (patient.asa === "II") {
      asaReserveFactor = 0.92;
      asaBaroreflexFactor = 0.9;
    } else if (patient.asa === "III") {
      asaReserveFactor = 0.75;
      asaBaroreflexFactor = 0.65;
    } else if (patient.asa === "IV" || patient.asa === "V") {
      asaReserveFactor = 0.52;
      asaBaroreflexFactor = 0.4;
    }
    inotropyFactor *= asaReserveFactor * coupling.contractilityMultiplier;
    if (patient.species === "feline" && receptors.naVBlockade > 0.25) {
      inotropyFactor = Math.max(0.1, inotropyFactor - receptors.naVBlockade * 0.7);
    }
    if (receptors.propofolSiteOccupancy > 0.15) {
      inotropyFactor = Math.max(0.35, inotropyFactor - (receptors.propofolSiteOccupancy - 0.15) * 0.22);
    }
    if (receptors.acuteBolusHypotension > 0.15) {
      inotropyFactor = Math.max(0.35, inotropyFactor - (receptors.acuteBolusHypotension - 0.15) * 0.2);
    }
    const inotropicStateEmax = Number(inotropyFactor.toFixed(2));
    const afterloadRatio = SVR / baselineSVR;
    let computedSV = preloadEDV * 0.65 * inotropyFactor / (0.4 + afterloadRatio * 0.6);
    computedSV = Math.max(baselineSV * 0.12, Math.min(baselineSV * 2.2, computedSV));
    let strokeVolumeMl = computedSV;
    const volatileSuppression = Math.min(0.85, Math.max(0, receptors.volatileMacExposure) * 0.27);
    const propofolSuppression = receptors.propofolSiteOccupancy * 0.3;
    const sedativeSuppression = receptors.centralSedation * 0.18 + Math.max(0, receptors.alpha2Drive) * 0.18;
    const baroreceptorGain = Math.max(0.08, (1 - volatileSuppression - propofolSuppression - sedativeSuppression) * asaBaroreflexFactor);
    const rawMapError = (previousMAP > 0 ? previousMAP : baseMAP) - baseMAP;
    const normalizedMapError = Math.max(-1, Math.min(1, rawMapError / 45));
    const baroreceptorEffector = -normalizedMapError * baroreceptorGain * 0.2;
    let autonomicHRMultiplier = 1;
    autonomicHRMultiplier += receptors.beta1Drive * 0.55 * adrenergicResponse;
    const vagolyticReserve = (0.2 + speciesConfig.restingVagalTone * 0.4) * Math.min(1, speciesInfo.normalVitals.hrTypical / Math.max(1, baseHR)) * Math.max(0.35, 1 - Math.max(0, receptors.beta1Drive) * 0.5 - nociceptiveStressLevel * 0.4);
    autonomicHRMultiplier -= Math.max(0, receptors.m2Drive) * 0.5;
    autonomicHRMultiplier += Math.max(0, -receptors.m2Drive) * vagolyticReserve;
    autonomicHRMultiplier -= receptors.alpha2Drive * 0.4;
    autonomicHRMultiplier += receptors.directHeartRateEffect * 0.32;
    autonomicHRMultiplier -= receptors.acuteBolusBradycardia * 0.28;
    autonomicHRMultiplier -= receptors.hyperkalemicCardiotoxicity * 0.3;
    const nodalDeltaBpm = baseHR * (autonomicHRMultiplier - 1);
    const systemicDeltaBpm = baseHR * autonomicHRMultiplier * (coupling.heartRateMultiplier - 1);
    autonomicHRMultiplier *= coupling.heartRateMultiplier;
    autonomicHRMultiplier += baroreceptorEffector;
    if (previousLactate > 8) {
      const terminalBradyDrive = Math.min(0.4, (previousLactate - 8) * 0.08);
      autonomicHRMultiplier -= terminalBradyDrive;
    }
    if (nociceptiveStressLevel > 0.01) {
      const nodalSympatholyticBraking = Math.max(0.35, 1 - Math.max(0, receptors.alpha2Drive) * 0.75);
      autonomicHRMultiplier += nociceptiveStressLevel * 0.36 * nodalSympatholyticBraking * Math.max(0.25, catecholamineReserve);
    }
    let targetHR = baseHR * autonomicHRMultiplier;
    if (speciesConfig.normalPhysiologicalSinusArrhythmia && receptors.respiratoryDepression < 0.65) {
      const respiratoryPhase = 2 * Math.PI * simTimeSeconds * patient.baselineVitals.rr / 60;
      const vagalAmplitude = baseHR * 0.055 * Math.max(0.2, 1 - Math.max(0, receptors.beta1Drive) * 0.7) * Math.max(0.2, 1 - nociceptiveStressLevel * 0.8);
      targetHR += Math.sin(respiratoryPhase) * vagalAmplitude;
    }
    const ageTotalYears = patient.ageYears + (patient.ageMonths || 0) / 12;
    if (ageTotalYears < 0.6) {
      targetHR = Math.max(baseHR * 0.7, targetHR);
    }
    targetHR = Math.max(0, Math.min(350, targetHR));
    const hrSmoothingAlpha = 1 - Math.exp(-dtSeconds / 1.8);
    const effectiveHR = previousHR > 0 ? previousHR + (targetHR - previousHR) * hrSmoothingAlpha : targetHR;
    const finalHR = Number(effectiveHR.toFixed(3));
    if (effectiveHR > 0 && effectiveHR < baseHR) {
      const fillingReserve = Math.min(1, Math.max(0, (bloodVolumeRatio - 0.45) / 0.55));
      strokeVolumeMl *= 1 + Math.min(0.45, (baseHR / effectiveHR - 1) * 0.6) * fillingReserve;
    }
    if (effectiveHR > baseHR * 1.2) {
      const fillingPenalty = 1 / (1 + (effectiveHR / baseHR - 1.2) * 0.75);
      strokeVolumeMl *= Math.max(0.42, fillingPenalty);
    }
    strokeVolumeMl = Number(strokeVolumeMl.toFixed(3));
    let cardiacOutputLMin = effectiveHR * strokeVolumeMl / 1e3;
    cardiacOutputLMin = Number(cardiacOutputLMin.toFixed(2));
    const cvp = 4;
    const rawMAP = cvp + cardiacOutputLMin * SVR / 80;
    const mapSmoothingAlpha = 1 - Math.exp(-dtSeconds / 1.4);
    const smoothedMAP = previousMAP > 0 ? previousMAP + (rawMAP - previousMAP) * mapSmoothingAlpha : rawMAP;
    const finalMAP = Number(smoothedMAP.toFixed(3));
    const targetMAP = finalMAP;
    const baselinePulsePressure = Math.max(
      18,
      (speciesInfo.normalVitals.sysBpMin + speciesInfo.normalVitals.sysBpMax) / 2 - (speciesInfo.normalVitals.diaBpMin + speciesInfo.normalVitals.diaBpMax) / 2
    );
    const normalizedStrokeVolume = strokeVolumeMl / Math.max(1e-3, baselineSV);
    const pulsePressure = Math.max(
      12,
      Math.round(baselinePulsePressure * normalizedStrokeVolume * Math.sqrt(Math.max(0.25, SVR / baselineSVR)))
    );
    let sysBP = Math.round(smoothedMAP + pulsePressure * 0.55);
    let diaBP = Math.round(Math.max(10, smoothedMAP - pulsePressure * 0.45));
    const baselineMVO2 = baseHR * baseMAP * 1;
    const currentMVO2 = targetHR * sysBP * inotropicStateEmax;
    const demandRatio = currentMVO2 / Math.max(1, baselineMVO2);
    const cpp = Math.max(0, diaBP - 8);
    const coronaryAdequacy = cpp / Math.max(1, baseMAP * 0.6);
    let ischemRatePerMinute = 0;
    if (demandRatio > 1.8 && coronaryAdequacy < 1.1) {
      ischemRatePerMinute = 0.08 * (demandRatio - 1.5);
    } else if (targetMAP < Math.max(32, baseMAP * 0.52)) {
      const myocardialCriticalMap = Math.max(32, baseMAP * 0.52);
      const deficit = myocardialCriticalMap - targetMAP;
      ischemRatePerMinute = 0.04 * (deficit / 20);
    } else if (previousIschemiaScore > 0) {
      ischemRatePerMinute = -0.015;
    }
    if (previousSpO2 < 80) ischemRatePerMinute += 0.12 * ((80 - previousSpO2) / 20);
    if (previousOxygenDeliveryMlKgMin < 8) {
      ischemRatePerMinute += 0.1 * ((8 - previousOxygenDeliveryMlKgMin) / 8);
    }
    if (previousLactate > 5) ischemRatePerMinute += 0.06 * ((previousLactate - 5) / 5);
    ischemRatePerMinute += coupling.myocardialIschemiaRatePerMinute;
    const myocardialIschemiaScore = Math.min(1, Math.max(
      0,
      previousIschemiaScore + ischemRatePerMinute * (dtSeconds / 60) + receptors.acuteBolusArrhythmia * 15e-4 * dtSeconds + coupling.arrhythmogenicBurden * 12e-4 * dtSeconds
    ));
    let rhythm = "sinus";
    let isArrestTriggered = false;
    let arrestType;
    let arrestCause;
    const hasAntiarrhythmicProtection = receptors.antiarrhythmicIbProtection > 0.3;
    if (myocardialIschemiaScore > 0.75) {
      isArrestTriggered = true;
      arrestType = "ventricular_fibrillation";
      arrestCause = "Parada Card\xEDaca por Fibrila\xE7\xE3o Ventricular (Isquemia Mioc\xE1rdica Transmural Cr\xEDtica por Descasamento MVO2 / Coronariano)";
      rhythm = "ventricular_fibrillation";
    } else if ((myocardialIschemiaScore > 0.4 || coupling.arrhythmogenicBurden > 0.78) && !hasAntiarrhythmicProtection) {
      rhythm = "ventricular_tachycardia";
    } else if ((myocardialIschemiaScore > 0.2 || receptors.acuteBolusArrhythmia > 0.55 || coupling.arrhythmogenicBurden > 0.28 || patient.pathologyConditions.gastricDilatationVolvulus) && !hasAntiarrhythmicProtection) {
      rhythm = "ventricular_premature_complexes";
    } else if (receptors.hyperkalemicCardiotoxicity > 0.72) {
      rhythm = "av_block_3rd_degree";
    } else if (speciesConfig.normalPhysiologicalSecondDegreeAVBlock && targetHR < baseHR * 0.95 && receptors.beta1Drive < 0.2) {
      rhythm = "av_block_2nd_degree";
    } else if (receptors.alpha2Drive > 0.5 && receptors.m2Drive > -0.2) {
      rhythm = "av_block_2nd_degree";
    } else if (targetHR < speciesInfo.normalVitals.hrMin * 0.75) {
      rhythm = "sinus_bradycardia";
    } else if (targetHR > speciesInfo.normalVitals.hrMax * 1.25) {
      rhythm = "sinus_tachycardia";
    } else if (speciesConfig.normalPhysiologicalSinusArrhythmia && receptors.m2Drive > -0.3) {
      rhythm = "sinus_arrhythmia";
    } else {
      rhythm = "sinus";
    }
    const legacyTachyThreshold = patient.species === "canine" ? 250 : patient.species === "feline" ? 285 : patient.species === "equine" ? 120 : 165;
    const fatalBradyThreshold = Math.max(8, speciesInfo.normalVitals.hrMin * 0.35);
    const fatalTachyThreshold = Math.max(legacyTachyThreshold, speciesInfo.normalVitals.hrMax * 1.55);
    const criticalEventTimers = {
      severeBradycardiaSeconds: targetHR <= fatalBradyThreshold ? previousCriticalTimers.severeBradycardiaSeconds + dtSeconds : Math.max(0, previousCriticalTimers.severeBradycardiaSeconds - dtSeconds * 2),
      severeTachycardiaSeconds: targetHR >= fatalTachyThreshold ? previousCriticalTimers.severeTachycardiaSeconds + dtSeconds : Math.max(0, previousCriticalTimers.severeTachycardiaSeconds - dtSeconds * 2),
      profoundHypotensionSeconds: targetMAP < 20 ? previousCriticalTimers.profoundHypotensionSeconds + dtSeconds : Math.max(0, previousCriticalTimers.profoundHypotensionSeconds - dtSeconds * 2)
    };
    if (criticalEventTimers.severeBradycardiaSeconds >= 12) {
      isArrestTriggered = true;
      arrestType = "asystole";
      arrestCause = `Assistolia Terminal por Bradicardia Refrat\xE1ria (FC ${Math.round(targetHR)} bpm)`;
    }
    if (criticalEventTimers.severeTachycardiaSeconds >= 10) {
      isArrestTriggered = true;
      arrestType = "ventricular_fibrillation";
      arrestCause = `Taquiarritmia e Fibrila\xE7\xE3o Ventricular Terminal (FC cr\xEDtica ${Math.round(targetHR)} bpm com perda de enchimento diast\xF3lico)`;
    }
    if (patient.species === "feline" && receptors.naVBlockade > 0.45) {
      isArrestTriggered = true;
      arrestType = "pea";
      arrestCause = "Dissocia\xE7\xE3o Eletromec\xE2nica (AESP) por Colapso Mioc\xE1rdico Fulminante por Lidoca\xEDna IV em Felino";
    }
    if (criticalEventTimers.profoundHypotensionSeconds >= 18) {
      isArrestTriggered = true;
      arrestType = "pea";
      arrestCause = "Parada Card\xEDaca por Choque Irrevers\xEDvel e Aus\xEAncia de Perfus\xE3o Sist\xEAmica (PAM < 20 mmHg)";
    }
    let pulseQuality = "Normal";
    if (targetMAP < 45 || strokeVolumeMl < baselineSV * 0.45) {
      pulseQuality = "Fraco / Filiforme";
    } else if (pulsePressure > 65 && targetMAP > 85) {
      pulseQuality = "C\xE9lere / Salt\xE3o";
    }
    return {
      drivers: {
        preloadRatio: bloodVolumeRatio,
        vascularResistanceRatio: netVascularResistanceFactor,
        contractilityRatio: inotropyFactor,
        nodalDeltaBpm,
        baroreflexDeltaBpm: baseHR * baroreceptorEffector,
        systemicDeltaBpm,
        otherDeltaBpm: targetHR - baseHR - nodalDeltaBpm - baseHR * baroreceptorEffector - systemicDeltaBpm,
        targetHeartRate: targetHR
      },
      heartRate: finalHR,
      cardiacRhythm: rhythm,
      systolicBP: Math.round(sysBP),
      diastolicBP: Math.round(diaBP),
      // Preserve solver precision between frames. Rounding here made the closed
      // baroreflex converge to different equilibria at 0.1 s versus 1-2 s steps;
      // presentation components remain responsible for integer display.
      meanArterialPressure: Number(targetMAP.toFixed(3)),
      cardiacOutputLMin,
      strokeVolumeMl,
      systemicVascularResistanceDyne: SVR,
      inotropicStateEmax,
      baroreceptorGain: Number(baroreceptorGain.toFixed(2)),
      baroreceptorVagalTone: Number(baroreceptorEffector.toFixed(2)),
      myocardialIschemiaScore: Number(myocardialIschemiaScore.toFixed(5)),
      criticalEventTimers: {
        severeBradycardiaSeconds: Number(criticalEventTimers.severeBradycardiaSeconds.toFixed(3)),
        severeTachycardiaSeconds: Number(criticalEventTimers.severeTachycardiaSeconds.toFixed(3)),
        profoundHypotensionSeconds: Number(criticalEventTimers.profoundHypotensionSeconds.toFixed(3))
      },
      isArrestTriggered,
      arrestType,
      arrestCause,
      pulseQuality,
      nociceptiveStressLevel
    };
  }
};

// src/engine/oxygenTransport.ts
function getOxygenDeliveryThresholds(species) {
  const demand = SPECIES_CELLULAR_CONFIGS[species].oxygenConsumptionMlKgMin;
  return { critical: demand * 1.5, recovery: demand * 1.8, reserve: demand * 0.8 };
}
function getOxygenDeliveryDeficit(species, delivery, utilization = 1) {
  const { critical } = getOxygenDeliveryThresholds(species);
  return Math.min(1, Math.max(0, (critical - delivery * utilization) / critical));
}
function getLactateClearanceMultiplier(hepaticPerfusion, renalPerfusion) {
  return Math.min(1.1, Math.max(0.05, hepaticPerfusion * 0.7 + renalPerfusion * 0.3));
}

// src/engine/respiratoryGasExchange.ts
var RespiratoryGasExchangeEngine = class {
  /**
   * Biomechanically accurate respiratory and blood-gas exchange model:
   * 1. Medullary pre-Bötzinger rhythm generation modulated by PaCO2, mu-opioids, and GABA-A hyperpolarization.
   * 2. Intrapulmonary shunt (Qs/Qt) reflecting species positional atelectasis (equine/bovine).
   * 3. Oxyhemoglobin dissociation and dynamic arterial PaO2/SpO2 desaturation.
   * 4. Alveolar gas equation and Henderson-Hasselbalch continuous acid-base balance.
   */
  static stepRespiration(dtSeconds, simTimeSeconds, patient, receptors, equipment, _isSurgicalStimulationActive, previousSpO2, previousPaO2, previousPaCO2, previousHypoxiaSeconds, previousLactate, pulmonaryShuntFractionPct, ruminalBloatSeverity = 0, cardiacOutputRatio = 1, meanArterialPressure = 80, previousRespiratoryRate, previousEtCO2, nociceptiveStressLevel = 0, persistentHematocritPct, integratedCentralDrive = 1, integratedNeuromuscularCapacity = 1, alveolarRecruitment = 1, coupling = NEUTRAL_PHYSIOLOGICAL_MODIFIERS, organPerfusion, fluidBaseDeficitMmolL = 0) {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const baselineRR = patient.baselineVitals.rr;
    const baselineVT = patient.weightKg * ((speciesInfo.tidalVolumeMlKg[0] + speciesInfo.tidalVolumeMlKg[1]) / 2);
    const isIntubated = equipment.intubationStatus === "intubated_tracheal";
    const isEsophageal = equipment.intubationStatus === "intubated_esophageal";
    const isUnintubated = equipment.intubationStatus === "unintubated" || equipment.intubationStatus === "extubated";
    let isRespiratoryArrest = false;
    let arrestCause;
    const coupledCentralDrive = integratedCentralDrive * coupling.respiratoryDriveMultiplier;
    let spontaneousRR = baselineRR;
    let spontaneousVT = baselineVT;
    if (integratedNeuromuscularCapacity < 0.6 || receptors.nmOccupancy > 0.62) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = "Aus\xEAncia de ventila\xE7\xE3o espont\xE2nea por Bloqueio Neuromuscular Perif\xE9rico (suporte ventilat\xF3rio obrigat\xF3rio)";
    } else if (receptors.acuteBolusRespiratoryDepression > 0.4 || coupledCentralDrive < 0.08 || receptors.hypnoticEffect > 0.95 || receptors.respiratoryDepression > 0.92 || receptors.propofolSiteOccupancy > 0.72 && receptors.bzdAllostericOccupancy > 0.28) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = receptors.hypnoticEffect > 0.96 ? "Parada Respirat\xF3ria por Depress\xE3o Bulbar Profunda (Plano Anest\xE9sico Excessivo / Est\xE1gio IV)" : "Apneia P\xF3s-Indu\xE7\xE3o por B\xF3lus R\xE1pido de Agente Indutor (Propofol/GABA-A)";
    } else if (receptors.muOpioidDrive > 0.88 && receptors.respiratoryDepression > 0.82) {
      spontaneousRR = 0;
      spontaneousVT = 0;
      isRespiratoryArrest = true;
      arrestCause = "Apneia Central por Sinergismo Depressor Bulbar (Opioide Mu-Puro + Anest\xE9sico Geral)";
    } else {
      const gabaSuppression = receptors.hypnoticEffect * 0.48;
      const opioidSuppression = Math.max(0, receptors.muOpioidDrive) * 0.26;
      const bzdSuppression = receptors.bzdAllostericOccupancy * 0.14;
      const netDepression = Math.max(
        receptors.respiratoryDepression * 0.7,
        gabaSuppression + opioidSuppression + bzdSuppression,
        1 - coupledCentralDrive
      );
      spontaneousRR = Math.max(0, baselineRR * (1 - Math.min(0.65, netDepression * 0.68)));
      spontaneousVT = Math.max(0, baselineVT * (1 - Math.min(0.42, netDepression * 0.4)));
      const co2Stimulus = Math.max(0, Math.min(1.2, (previousPaCO2 - 42) / 35));
      const chemoreflexGain = Math.max(0.08, 1 - Math.max(0, receptors.muOpioidDrive) * 0.65 - receptors.hypnoticEffect * 0.55);
      spontaneousRR *= 1 + co2Stimulus * chemoreflexGain * 0.55;
      spontaneousVT *= 1 + co2Stimulus * chemoreflexGain * 0.22;
      if (nociceptiveStressLevel > 0.02) {
        spontaneousRR *= 1 + nociceptiveStressLevel * 0.42;
        spontaneousVT *= 1 + nociceptiveStressLevel * 0.2;
      }
      if (ruminalBloatSeverity > 0.2) {
        spontaneousVT = Math.max(baselineVT * 0.35, spontaneousVT * (1 - ruminalBloatSeverity * 0.55));
        spontaneousRR *= 1 + ruminalBloatSeverity * 0.4;
      }
      if (patient.pathologyConditions.brachycephalicObstruction && isUnintubated) {
        spontaneousVT *= 0.68;
        spontaneousRR *= 1.18;
      }
    }
    spontaneousRR = isRespiratoryArrest ? 0 : spontaneousRR;
    spontaneousVT = isRespiratoryArrest ? 0 : spontaneousVT;
    let finalRR = spontaneousRR;
    let finalVT = spontaneousVT;
    let currentPaw = 0;
    const hasActiveTrachealTube = equipment.intubationStatus === "intubated_tracheal";
    const hasSealedAirway = hasActiveTrachealTube || equipment.intubationStatus === "laryngeal_mask";
    const isSingleManualBreathActive = Boolean(
      equipment.isManualBreathTriggered || equipment.manualBreathLastTriggerTime && simTimeSeconds - equipment.manualBreathLastTriggerTime < 2
    );
    const hasManualCadence = Boolean(
      equipment.manualVentilationCadenceSeconds && equipment.manualVentilationCadenceSeconds > 0
    );
    const baseCompliance = Math.max(0.1, speciesConfig.dynamicComplianceMlKgCmH2O * patient.weightKg);
    const restrictiveFactor = Math.max(0.38, 1 - ruminalBloatSeverity * 0.48 - Math.max(0, pulmonaryShuntFractionPct - 5) / 100);
    const effectiveCompliance = baseCompliance * restrictiveFactor * Math.max(0.65, alveolarRecruitment);
    if (hasSealedAirway && equipment.isVentilatorActive && equipment.ventilatorMode !== "spontaneous") {
      finalRR = equipment.ventilatorSettings.rateBpm;
      const peep = equipment.ventilatorSettings.peepCmH2O;
      const pressureLimit = Math.max(peep + 1, equipment.ventilatorSettings.pipPressureLimitCmH2O);
      const expiratoryParts = Number(equipment.ventilatorSettings.ieRatio.split(":")[1]) || 2;
      const inspiratoryTimeSeconds = 60 / Math.max(1, finalRR) / (1 + expiratoryParts);
      const pressureEquilibration = 1 - Math.exp(-inspiratoryTimeSeconds / 0.45);
      if (equipment.ventilatorMode === "pcv_pressure") {
        const drivingPressure = Math.max(0, pressureLimit - peep);
        finalVT = Math.min(patient.weightKg * 18, effectiveCompliance * drivingPressure * pressureEquilibration);
        currentPaw = pressureLimit;
      } else {
        const requestedVT = Math.max(0, equipment.ventilatorSettings.tidalVolumeMl);
        const inspiratoryFlowMlSec = requestedVT / Math.max(0.15, inspiratoryTimeSeconds);
        const resistancePressure = inspiratoryFlowMlSec * 0.018 / Math.sqrt(Math.max(0.1, patient.weightKg));
        const requiredPeakPressure = peep + requestedVT / effectiveCompliance + resistancePressure;
        currentPaw = Math.min(pressureLimit, requiredPeakPressure);
        finalVT = requiredPeakPressure > pressureLimit ? Math.max(0, effectiveCompliance * Math.max(0, pressureLimit - peep)) : requestedVT;
      }
    } else if (hasActiveTrachealTube && (isSingleManualBreathActive || hasManualCadence)) {
      const cadenceRate = hasManualCadence ? Math.round(60 / (equipment.manualVentilationCadenceSeconds || 6)) : 10;
      finalRR = Math.max(spontaneousRR, cadenceRate);
      const manualVT = baselineVT;
      finalVT = Math.max(spontaneousVT, manualVT);
      currentPaw = 16;
    } else {
      const closedCircuitPressure = equipment.aplValveState === "closed" && equipment.oxygenFlowLMin > 1.2 ? equipment.isOxygenFlushActive ? 42 : 32 : 2;
      currentPaw = spontaneousRR > 0 ? closedCircuitPressure : 0;
    }
    const minuteVolumeL = Number((finalRR * finalVT / 1e3).toFixed(2));
    const deadSpaceMl = patient.weightKg * speciesConfig.anatomicDeadSpaceMlKg;
    const alveolarVentilationLMin = Math.max(0, (finalVT - deadSpaceMl) * finalRR / 1e3);
    let sodaLimeExhaustionPct = equipment.sodaLimeExhaustionPct || 0;
    const isCircle = Boolean(equipment.circuitType && equipment.circuitType.includes("circle"));
    if (isCircle && equipment.oxygenFlowLMin > 0.1) {
      sodaLimeExhaustionPct = Math.min(100, sodaLimeExhaustionPct + dtSeconds / 3600 * 8);
    }
    let fico2 = 0;
    if (sodaLimeExhaustionPct > 55 && isCircle) {
      fico2 = Math.round((sodaLimeExhaustionPct - 55) / 45 * 16);
    }
    let capnogramType = "normal";
    let etco2 = 0;
    let paCO2Estimate = previousPaCO2 || patient.baselineVitals.etco2 + 4.5;
    const isAirwaySampled = equipment.intubationStatus === "intubated_tracheal" || equipment.intubationStatus === "laryngeal_mask";
    const baselineAlveolarV = (baselineVT - deadSpaceMl) * baselineRR / 1e3;
    const ventilationRatio = alveolarVentilationLMin / Math.max(0.1, baselineAlveolarV);
    let targetSteadyEtCO2 = patient.baselineVitals.etco2 * coupling.metabolicCo2Multiplier;
    if (finalRR === 0) {
      targetSteadyEtCO2 = 0;
    } else if (ventilationRatio < 0.8) {
      capnogramType = "hypoventilation";
      const severity = Math.min(1, (0.8 - ventilationRatio) / 0.45);
      const maxHypoventEt = patient.baselineVitals.etco2 / Math.max(0.35, ventilationRatio);
      const metabolicBaselineEtCO2 = patient.baselineVitals.etco2 * coupling.metabolicCo2Multiplier;
      targetSteadyEtCO2 = metabolicBaselineEtCO2 + (maxHypoventEt - metabolicBaselineEtCO2) * severity;
    } else if (ventilationRatio > 1.25) {
      capnogramType = "hyperventilation";
      const severity = Math.min(1, (ventilationRatio - 1.25) / 0.75);
      const minHyperventEt = patient.baselineVitals.etco2 / Math.min(2.5, ventilationRatio);
      const metabolicBaselineEtCO2 = patient.baselineVitals.etco2 * coupling.metabolicCo2Multiplier;
      targetSteadyEtCO2 = metabolicBaselineEtCO2 - (metabolicBaselineEtCO2 - minHyperventEt) * severity;
    } else {
      capnogramType = "normal";
    }
    if (fico2 > 0) {
      targetSteadyEtCO2 += fico2;
      capnogramType = "rebreathing_elevated_baseline";
    }
    if (!isAirwaySampled && finalRR > 0) {
      targetSteadyEtCO2 *= 0.95;
    }
    const targetPaCO2 = targetSteadyEtCO2 + 4.5;
    const co2Equilibration = 1 - Math.exp(-dtSeconds / 14);
    paCO2Estimate += (targetPaCO2 - paCO2Estimate) * co2Equilibration;
    if (isEsophageal || finalRR === 0) {
      etco2 = 0;
      capnogramType = "cardiac_arrest_flat";
    } else {
      const etco2Tau = 14;
      const washFraction = 1 - Math.exp(-dtSeconds / etco2Tau);
      const prevEt = previousEtCO2 !== void 0 && previousEtCO2 > 0 ? previousEtCO2 : targetSteadyEtCO2 * 0.96;
      let rawEtco2 = prevEt + (targetSteadyEtCO2 - prevEt) * washFraction;
      if (cardiacOutputRatio < 0.55) {
        rawEtco2 = rawEtco2 * Math.max(0.35, cardiacOutputRatio / 0.55);
      }
      etco2 = Number(rawEtco2.toFixed(1));
    }
    if (finalRR === 0 || isEsophageal) {
      paCO2Estimate = Math.min(140, paCO2Estimate + dtSeconds * 0.65);
    }
    const fio2 = hasSealedAirway && equipment.oxygenFlowLMin > 0.2 ? 0.98 : 0.21;
    const pAO2 = Math.max(10, fio2 * 713 - paCO2Estimate / 0.8);
    const peepRecruitment = hasSealedAirway && equipment.isVentilatorActive ? Math.min(0.32, Math.max(0, equipment.ventilatorSettings.peepCmH2O) * 0.025) : 0;
    const persistentRecruitment = Math.max(0, alveolarRecruitment - 1) * 0.55;
    const effectiveShuntPct = pulmonaryShuntFractionPct * (1 - peepRecruitment - persistentRecruitment);
    const shuntFraction = Math.max(0.04, effectiveShuntPct / 100);
    let targetPaO2 = pAO2 * (1 - shuntFraction * 1.8);
    targetPaO2 = Math.max(15, Math.min(480, targetPaO2));
    let isAdequatelyVentilating = finalRR > 0 && finalVT > deadSpaceMl && !isEsophageal;
    let currentPaO2 = previousPaO2;
    let currentSpO2 = previousSpO2;
    if (!isAdequatelyVentilating) {
      const desaturationRate = Math.min(24, Math.max(
        3,
        8.5 * (speciesConfig.oxygenConsumptionMlKgMin / 5) * (45 / speciesConfig.functionalResidualCapacityMlKg)
      ));
      currentPaO2 = Math.max(12, currentPaO2 - dtSeconds * desaturationRate);
    } else {
      if (currentPaO2 < targetPaO2) {
        currentPaO2 = Math.min(targetPaO2, currentPaO2 + dtSeconds * 22);
      } else {
        currentPaO2 = Math.max(targetPaO2, currentPaO2 - dtSeconds * 6);
      }
    }
    const p50 = 28;
    const hillN = 2.7;
    const calculatedSpO2 = 100 * (Math.pow(currentPaO2, hillN) / (Math.pow(p50, hillN) + Math.pow(currentPaO2, hillN)));
    currentSpO2 = Math.min(100, Math.max(0, calculatedSpO2));
    let hypoxiaSecondsAccumulated = previousHypoxiaSeconds;
    if (currentSpO2 < 75 || currentPaO2 < 40) {
      hypoxiaSecondsAccumulated += dtSeconds;
    } else if (currentSpO2 < 88 || currentPaO2 < 60) {
      hypoxiaSecondsAccumulated += dtSeconds * 0.15;
    } else {
      hypoxiaSecondsAccumulated = Math.max(0, hypoxiaSecondsAccumulated - dtSeconds * 0.5);
    }
    let lactate = previousLactate + coupling.additionalLactateMmolLMin * dtSeconds / 60;
    const perfusionDeficit = Math.max(0, (45 - meanArterialPressure) / 30) + Math.max(0, 0.45 - cardiacOutputRatio);
    const oxygenContent = 1.34 * (persistentHematocritPct ?? patient.baselineVitals.hctPct) / 3 * currentSpO2 / 100 + 3e-3 * currentPaO2;
    const delivery = oxygenContent * speciesConfig.cardiacOutputMlKgMin * cardiacOutputRatio / 100;
    const deliveryDeficit = getOxygenDeliveryDeficit(patient.species, delivery, coupling.cellularOxygenUtilizationFraction);
    if (currentSpO2 < 75 || hypoxiaSecondsAccumulated > 20 || perfusionDeficit > 0.25 || deliveryDeficit > 0.05) {
      const hypoxicRate = currentSpO2 < 75 || hypoxiaSecondsAccumulated > 20 || perfusionDeficit > 0.25 ? 1.2 : 0;
      lactate = Math.min(18, lactate + dtSeconds / 60 * (hypoxicRate + perfusionDeficit * 1.6 + deliveryDeficit * 1.2));
    } else if (lactate > patient.baselineVitals.lactateMmolL) {
      const clearanceMultiplier = getLactateClearanceMultiplier(
        organPerfusion?.hepaticFraction ?? Math.min(1, cardiacOutputRatio),
        organPerfusion?.renalFraction ?? Math.min(1, cardiacOutputRatio)
      );
      lactate = Math.max(patient.baselineVitals.lactateMmolL, lactate - dtSeconds / 60 * 0.45 * clearanceMultiplier);
    }
    const lactateBaseDeficit = Math.max(0, lactate - patient.baselineVitals.lactateMmolL) * 1.15;
    const bicarb = Math.max(8, Math.min(32, 24 - lactateBaseDeficit - fluidBaseDeficitMmolL + receptors.alkalinization * 12));
    const paCO2Final = paCO2Estimate;
    const finalPH = Math.max(6.7, Math.min(
      7.65,
      6.1 + Math.log10(bicarb / Math.max(0.3, 0.03 * paCO2Final))
    ));
    let pattern = "eupneic";
    if (finalRR === 0) {
      pattern = "apneic";
    } else if (finalRR > baselineRR * 1.6) {
      pattern = "tachypneic";
    } else if (finalRR < baselineRR * 0.6) {
      pattern = "bradypneic";
    } else if (patient.pathologyConditions.brachycephalicObstruction && isUnintubated) {
      pattern = "obstructive";
    }
    const hematocrit = Math.max(
      8,
      (persistentHematocritPct ?? patient.baselineVitals.hctPct) + receptors.oxygenCarryingSupport * 10 - Math.max(0, receptors.volumeExpansion - receptors.oxygenCarryingSupport * 0.65) * 5
    );
    const potassium = Math.max(
      2,
      patient.baselineVitals.potassiumMeqL + receptors.potassiumLoad * 1.2 - receptors.alkalinization * 0.65 + Math.max(0, 7.35 - finalPH) * 0.2
    );
    const hasAssistedVentilation = hasSealedAirway && (equipment.isVentilatorActive && equipment.ventilatorMode !== "spontaneous" || isSingleManualBreathActive || hasManualCadence);
    return {
      respiratoryRate: Number(finalRR.toFixed(3)),
      tidalVolumeMl: Number(finalVT.toFixed(3)),
      minuteVolumeL,
      respiratoryPattern: pattern,
      etCO2: etco2,
      fiCO2: fico2,
      capnogramType,
      pulseOximetrySpO2: Number(currentSpO2.toFixed(3)),
      arterialBloodGases: {
        pH: Number(finalPH.toFixed(2)),
        paO2: Number(currentPaO2.toFixed(3)),
        paCO2: Number(paCO2Final.toFixed(3)),
        bicarbonate: Number(bicarb.toFixed(2)),
        lactate: Number(lactate.toFixed(4)),
        potassium: Number(potassium.toFixed(2)),
        hematocritPct: Number(hematocrit.toFixed(2))
      },
      isRespiratoryArrest: isRespiratoryArrest && !hasAssistedVentilation,
      isSpontaneousApnea: isRespiratoryArrest,
      respiratoryArrestCause: arrestCause,
      hypoxiaSecondsAccumulated: Number(hypoxiaSecondsAccumulated.toFixed(3)),
      currentAirwayPressureCmH2O: currentPaw,
      sodaLimeExhaustionPct
    };
  }
};

// src/engine/dynamicInteractions.ts
var DynamicInteractionsEngine = class {
  /**
   * Dynamically inspects the cellular and physiological receptor states to detect
   * emergent drug-drug interactions, allosteric synergies, receptor displacements, and lethal toxicities.
   */
  static evaluateDynamicInteractions(patient, receptors, isVentilatorActive, isIntubated, activeDoses = []) {
    const interactions = [];
    const activeIds = new Set(activeDoses.filter((dose) => dose.currentCe > 0.01).map((dose) => dose.drugId));
    const hasAny = (ids) => ids.some((id) => activeIds.has(id));
    if (receptors.bzdAllostericOccupancy > 0.2 && (receptors.propofolSiteOccupancy > 0.2 || receptors.volatileSiteOccupancy > 0.4 || receptors.neurosteroidSiteOccupancy > 0.2)) {
      interactions.push({
        title: "Sinergismo Alost\xE9rico no Complexo GABA-A",
        severity: "info",
        description: "Potencializa\xE7\xE3o molecular positiva da condut\xE2ncia de Cloro (gCl-). Redu\xE7\xE3o sin\xE9rgica dr\xE1stica da necessidade de dose hipn\xF3tica (MAC sparing de 50-70%) e relaxamento mandibular imediato.",
        pharmacologyMechanism: "A liga\xE7\xE3o do benzodiazep\xEDnico no s\xEDtio alost\xE9rico gama/alfa aumenta a frequ\xEAncia de abertura do canal de cloreto ativado pelo propofol/isoflurano, hiperpolarizando os neur\xF4nios do c\xF3rtex e sistema reticular."
      });
    }
    if (receptors.alpha2Drive > 0.25 && receptors.m2Drive < -0.25) {
      interactions.push({
        title: "Descasamento de P\xF3s-Carga Cr\xEDtico: Alfa-2 + Anticolin\xE9rgico",
        severity: "lethal",
        description: "Taquicardia for\xE7ada contra resist\xEAncia vascular sist\xEAmica extrema. Eleva\xE7\xE3o catastr\xF3fica do consumo mioc\xE1rdico de oxig\xEAnio (MVO2), isquemia coronariana e alto risco de Fibrila\xE7\xE3o Ventricular.",
        pharmacologyMechanism: "Bloqueio muscar\xEDnico M2 abole o freio vagal protetor enquanto a vasoconstri\xE7\xE3o alfa-2 perif\xE9rica mant\xE9m a p\xF3s-carga em n\xEDveis cr\xEDticos, precipitando fal\xEAncia ventricular esquerda aguda."
      });
    }
    if (receptors.cAMPMyocardial > 2.2 || receptors.beta1Drive > 1.2) {
      interactions.push({
        title: "Tempestade Adren\xE9rgica e Sobrecarga de C\xE1lcio Intracelular",
        severity: "danger",
        description: "Hiperativa\xE7\xE3o adren\xE9rgica promovendo taquiarritmias ventriculares malignas (TV/FV) e encurtamento da di\xE1stole com hipoperfus\xE3o coronariana.",
        pharmacologyMechanism: "N\xEDveis suprafisiol\xF3gicos de AMPc via Gs fosforilam canais de c\xE1lcio do tipo L e fosfolambano no ret\xEDculo sarcoplasm\xE1tico, gerando p\xF3s-despolariza\xE7\xF5es tardias (DADs) arrhythmogenic."
      });
    }
    if (receptors.reversalCe.atipamezole > 0.08 && hasAny(["dexmedetomidine", "xylazine", "detomidine"])) {
      interactions.push({
        title: "Revers\xE3o Competitiva Alfa-2 por Atipamezol",
        severity: "info",
        description: "Deslocamento competitivo dos agonistas alfa-2 nos receptores pr\xE9 e p\xF3s-sin\xE1pticos. Restaura\xE7\xE3o imediata da frequ\xEAncia card\xEDaca, t\xF4nus vasomotor e consci\xEAncia.",
        pharmacologyMechanism: "Antagonismo competitivo puro de alt\xEDssima seletividade (alfa-2:alfa-1 de 8520:1), eliminando a inibi\xE7\xE3o Gi mediada na adenilil ciclase do locus coeruleus."
      });
    }
    if (receptors.reversalCe.naloxone > 0.08 && hasAny(["morphine", "methadone", "fentanyl", "butorphanol", "buprenorphine"])) {
      interactions.push({
        title: "Revers\xE3o Competitiva de Receptores Mu-Opioides por Naloxona",
        severity: "info",
        description: "Deslocamento competitivo de opioides puros dos receptores mu. Restaura\xE7\xE3o do drive respirat\xF3rio bulbar e da sensibilidade medular ao CO2.",
        pharmacologyMechanism: "Antagonista competitivo puro que reverte a inibi\xE7\xE3o Gi nos neur\xF4nios do complexo pre-B\xF6tzinger e reverte o bloqueio nociceptivo espinal."
      });
    }
    if (receptors.reversalCe.flumazenil > 0.08 && hasAny(["midazolam", "diazepam"])) {
      interactions.push({
        title: "Neutraliza\xE7\xE3o Alost\xE9rica GABA-A por Flumazenil",
        severity: "info",
        description: "Ocupa\xE7\xE3o do s\xEDtio de benzodiazep\xEDnicos com restaura\xE7\xE3o do t\xF4nus muscular mandibular e revers\xE3o da seda\xE7\xE3o residual.",
        pharmacologyMechanism: "Antagonista neutro competitivo no s\xEDtio omega-1/omega-2 do receptor GABA-A, impedindo a modula\xE7\xE3o alost\xE9rica positiva pelos benzodiazep\xEDnicos."
      });
    }
    if (receptors.nmOccupancy > 0.25 && (!isVentilatorActive || !isIntubated)) {
      interactions.push({
        title: "Bloqueio Neuromuscular Sem Suporte Ventilat\xF3rio Mec\xE2nico",
        severity: "lethal",
        description: "Paralisia diafragm\xE1tica e intercostal completa por bloqueio colin\xE9rgico nicot\xEDnico sem via a\xE9rea p\xE9rvia ou ventila\xE7\xE3o com press\xE3o positiva. Asfixia aguda iminente!",
        pharmacologyMechanism: "Antagonismo competitivo dos receptores nicot\xEDnicos (NM) na placa motora terminal impede a gera\xE7\xE3o de potenciais de placa terminal e contra\xE7\xE3o muscular."
      });
    }
    if (receptors.nmOccupancy > 0.35 && receptors.hypnoticEffect < 0.35) {
      interactions.push({
        title: "Consci\xEAncia Preservada sob Bloqueio Neuromuscular",
        severity: "lethal",
        description: "O paciente est\xE1 im\xF3vel, por\xE9m sem hipnose adequada. Aus\xEAncia de movimento n\xE3o significa inconsci\xEAncia ou analgesia.",
        pharmacologyMechanism: "O bloqueio nicot\xEDnico ocorre apenas na placa motora; n\xE3o atravessa a barreira hematoencef\xE1lica e n\xE3o deprime percep\xE7\xE3o cortical nem nocicep\xE7\xE3o."
      });
    }
    if (receptors.centralSedation > 0.45 && receptors.respiratoryDepression > 0.58) {
      interactions.push({
        title: "Soma\xE7\xE3o Depressora Central de Sedativos e Opioides",
        severity: receptors.respiratoryDepression > 0.78 ? "danger" : "warning",
        description: "A seda\xE7\xE3o combinada reduziu de forma n\xE3o linear o drive ventilat\xF3rio e a resposta ao CO\u2082; monitorar ventila\xE7\xE3o, n\xE3o apenas SpO\u2082.",
        pharmacologyMechanism: "Converg\xEAncia de Gi opioide/alfa-2 e hiperpolariza\xE7\xE3o GABA\xE9rgica nos circuitos bulbares reduz frequ\xEAncia e volume corrente."
      });
    }
    if (receptors.directBloodPressureEffect < -0.38 || receptors.acuteBolusHypotension > 0.5) {
      interactions.push({
        title: "Carga Vasodilatadora e Redu\xE7\xE3o de Retorno Venoso",
        severity: receptors.acuteBolusHypotension > 0.7 ? "danger" : "warning",
        description: "Bloqueio vasomotor, venodilata\xE7\xE3o e/ou libera\xE7\xE3o de histamina est\xE3o reduzindo pr\xE9-carga, d\xE9bito card\xEDaco e press\xE3o arterial.",
        pharmacologyMechanism: "Redu\xE7\xE3o aditiva do t\xF4nus arterial e da capacit\xE2ncia venosa por bloqueio alfa-1, anest\xE9sicos gerais e efeitos de b\xF3lus r\xE1pido."
      });
    }
    if (receptors.reversalCe.sugammadex > 0.05 && activeIds.has("atracurium")) {
      interactions.push({
        title: "Sugamadex Ineficaz para Atrac\xFArio",
        severity: "danger",
        description: "O bloqueio por atrac\xFArio permanece. Manter ventila\xE7\xE3o e usar revers\xE3o apropriada quando indicada.",
        pharmacologyMechanism: "Sugamadex encapsula bloqueadores aminosteroides; atrac\xFArio \xE9 benzilisoquinol\xEDnico e n\xE3o \xE9 seu substrato."
      });
    }
    if (patient.species === "feline" && receptors.naVBlockade > 0.2) {
      interactions.push({
        title: "Intoxica\xE7\xE3o Mioc\xE1rdica por Anest\xE9sico Local IV em Felino",
        severity: receptors.naVBlockade > 0.45 ? "lethal" : "danger",
        description: "Bloqueio acentuado dos canais r\xE1pidos de s\xF3dio NaV1.5 e depress\xE3o do influxo de c\xE1lcio mioc\xE1rdico em felinos. Risco iminente de AESP ou assistolia.",
        pharmacologyMechanism: "Sensibilidade de esp\xE9cie decorrente de menor densidade de canais de s\xF3dio e menor capacidade de tamponamento e depura\xE7\xE3o microssomal."
      });
    }
    if (receptors.muOpioidDrive > 0.3 && receptors.alpha2Drive > 0.25 && receptors.nmdaBlockade > 0.2) {
      interactions.push({
        title: "Analgesia Multimodal Preventiva Balanceada (Tr\xEDade O-A-K)",
        severity: "info",
        description: "Excelente sinergismo analg\xE9sico espinal e supraespinal com bloqueio de wind-up nociceptivo e estabiliza\xE7\xE3o hemodin\xE2mica completa.",
        pharmacologyMechanism: "A\xE7\xE3o sin\xE9rgica: ativa\xE7\xE3o de receptores mu e alfa-2 pr\xE9-sin\xE1pticos reduzindo libera\xE7\xE3o de subst\xE2ncia P e glutamato no corno dorsal, associada ao bloqueio p\xF3s-sin\xE1ptico dos receptores NMDA pela cetamina."
      });
    }
    if (activeIds.has("ephedrine") && receptors.volatileSiteOccupancy > 0.25) {
      interactions.push({
        title: "Resgate Hemodin\xE2mico por Efedrina na Hipotens\xE3o por Inalat\xF3rio",
        severity: "info",
        description: "A\xE7\xE3o mista alfa-1 e beta-1 restaura volume sist\xF3lico e PAM deprimidos pelo anest\xE9sico vol\xE1til sem provocar vasoconstri\xE7\xE3o perif\xE9rica excessiva ou bradicardia reflexa.",
        pharmacologyMechanism: "Agonismo beta-1 mioc\xE1rdico e alfa-1 vascular combinado \xE0 libera\xE7\xE3o de noradrenalina end\xF3gena compensa a depress\xE3o mioc\xE1rdica e a venodilata\xE7\xE3o induzidas pelo isoflurano/sevoflurano."
      });
    }
    const ephedrineDoses = activeDoses.filter((d) => d.drugId === "ephedrine");
    const totalEphedrineMgKg = ephedrineDoses.reduce((sum, d) => sum + d.dosePerKg, 0);
    if (activeIds.has("ephedrine") && totalEphedrineMgKg > 0.22) {
      interactions.push({
        title: "Taquifilaxia Adren\xE9rgica por Efedrina (Deple\xE7\xE3o Vesicular)",
        severity: "warning",
        description: "Doses repetidas de efedrina esgotaram as reservas pr\xE9-sin\xE1pticas de noradrenalina. A resposta vasopressora est\xE1 diminu\xEDda; considerar agonista direto (Norepinefrina ou Dobutamina).",
        pharmacologyMechanism: "A a\xE7\xE3o indireta da efedrina esvazia as ves\xEDculas de armazenamento de catecolaminas pr\xE9-sin\xE1pticas, reduzindo progressivamente a exocitose de noradrenalina a cada novo b\xF3lus."
      });
    }
    return interactions;
  }
};

// src/engine/patientReserve.ts
var clamp5 = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
function getPatientReserveCapacity(patient) {
  const asa = { I: 1, II: 0.9, III: 0.75, IV: 0.55, V: 0.35, E: 1 }[patient.asa];
  const years = patient.ageYears + patient.ageMonths / 12;
  const oldAge = { canine: 9.5, feline: 11, equine: 18, bovine: 10 }[patient.species];
  const age = years < 0.6 || years >= oldAge ? 0.85 : 1;
  return clamp5(asa * age * (patient.pathologyConditions.cardiacFailureDCM ? 0.85 : 1), 0.2, 1);
}

// src/engine/biologicalState.ts
var clamp6 = (value, min, max) => Math.min(max, Math.max(min, value));
var expApproach = (current, target, dtSeconds, tauSeconds) => current + (target - current) * (1 - Math.exp(-dtSeconds / Math.max(0.01, tauSeconds)));
var BASELINE_GLUCOSE = {
  canine: 95,
  feline: 105,
  equine: 92,
  bovine: 72
};
var STRESS_GLUCOSE_GAIN = {
  canine: 70,
  feline: 135,
  equine: 55,
  bovine: 48
};
var CARDIAC_OUTPUT_ML_KG_MIN = {
  canine: 110,
  feline: 140,
  equine: 75,
  bovine: 95
};
var CNS_KINETICS = {
  canine: { induction: 2.8, recovery: 8, excitation: 6 },
  feline: { induction: 2.4, recovery: 10, excitation: 7 },
  equine: { induction: 4.5, recovery: 20, excitation: 10 },
  bovine: { induction: 5.5, recovery: 25, excitation: 12 }
};
var BiologicalStateEngine = class {
  static initialize(patient) {
    const glucose = patient.baselineVitals.glucoseMgDl ?? BASELINE_GLUCOSE[patient.species] ?? 95;
    const baselineHemoglobinGdl = patient.baselineVitals.hctPct / 3;
    const baselineOxygenContent = 1.34 * baselineHemoglobinGdl * patient.baselineVitals.spo2 / 100;
    const baselineOxygenDelivery = baselineOxygenContent * CARDIAC_OUTPUT_ML_KG_MIN[patient.species] / 100;
    return {
      inhalant: {
        inspiredMac: 0,
        alveolarMac: 0,
        vesselRichMac: 0,
        muscleMac: 0,
        fatMac: 0
      },
      neurological: {
        corticalArousalPct: 100,
        hypnoticDepth: 0,
        sedativeDepth: 0,
        dissociativeDepth: 0,
        excitationDrive: 0,
        centralSensitization: 0,
        nociceptiveInput: 0,
        motorCapacity: 1,
        unconsciousnessSeconds: 0
      },
      autonomic: {
        sympatheticDrive: 0,
        parasympatheticDrive: 0.15,
        catecholamineReserve: 1
      },
      organPerfusion: {
        cerebralFraction: 1,
        hepaticFraction: 1,
        renalFraction: 1,
        oxygenDeliveryMlKgMin: baselineOxygenDelivery,
        cumulativeOxygenDebt: 0
      },
      species: {
        recumbencySeconds: 0,
        lowMapExposureSeconds: 0,
        pulmonaryShuntPct: 5,
        ruminalBloatSeverity: 0,
        myopathyRisk: 0
      },
      fluids: {
        lastObservedTotalInfusedMl: 0,
        crystalloidCentralMl: 0,
        hypertonicExpansionMl: 0,
        colloidCentralMl: 0,
        wholeBloodCentralMl: 0,
        effectiveCirculatingExpansionMl: 0,
        currentHematocritPct: patient.baselineVitals.hctPct
      },
      metabolic: {
        bloodGlucoseMgDl: glucose,
        insulinActivity: 1,
        counterRegulatoryDrive: 0,
        nitroprussideToxicMetaboliteBurden: 0
      },
      systemicRegulation: {
        cellularOxygenUtilizationFraction: 1,
        cellularHypoxia: 0,
        myocardialStress: 0,
        arrhythmogenicBurden: 0,
        endothelialDysfunction: 0,
        hepaticInjury: 0,
        renalInjury: 0,
        compensatoryReserve: getPatientReserveCapacity(patient)
      },
      biotransformation: {
        hepaticEnzymeCapacity: 1,
        hepaticEnzymeSaturation: 0,
        renalFiltrationCapacity: 1,
        renalTransportSaturation: 0,
        circulatingMetaboliteBurden: 0,
        receptorAdaptiveFeedback: 0
      },
      respiratory: {
        highAirwayPressureSeconds: 0,
        centralDrive: 1,
        neuromuscularCapacity: 1,
        alveolarRecruitment: 1
      },
      resuscitation: {
        roscReadinessSeconds: 0,
        processedShockCount: 0
      }
    };
  }
  /**
   * Couples receptor occupancy to slower neural, autonomic and respiratory
   * control loops. Different induction/recovery constants create hysteresis:
   * the same instantaneous Ce can therefore produce different states during
   * induction and emergence.
   */
  static stepRegulatorySystems(dtSeconds, patient, equipment, previous, receptors, surgicalStimulusIntensity, previousPaCO2, previousSpO2, previousMap) {
    const next = {
      ...previous,
      inhalant: { ...previous.inhalant },
      neurological: { ...previous.neurological },
      autonomic: { ...previous.autonomic },
      organPerfusion: { ...previous.organPerfusion },
      species: { ...previous.species },
      fluids: { ...previous.fluids },
      metabolic: { ...previous.metabolic },
      biotransformation: { ...previous.biotransformation },
      respiratory: { ...previous.respiratory },
      resuscitation: { ...previous.resuscitation }
    };
    const kinetics = CNS_KINETICS[patient.species] || CNS_KINETICS.canine;
    const hypnoticTarget = clamp6(receptors.hypnoticEffect, 0, 1);
    const sedationTarget = clamp6(receptors.centralSedation, 0, 1);
    const dissociationTarget = clamp6(receptors.dissociativeEffect, 0, 1);
    const hypnosisTau = hypnoticTarget > previous.neurological.hypnoticDepth ? kinetics.induction : kinetics.recovery;
    next.neurological.hypnoticDepth = expApproach(
      previous.neurological.hypnoticDepth,
      hypnoticTarget,
      dtSeconds,
      hypnosisTau
    );
    next.neurological.sedativeDepth = expApproach(
      previous.neurological.sedativeDepth,
      sedationTarget,
      dtSeconds,
      sedationTarget > previous.neurological.sedativeDepth ? kinetics.induction * 1.4 : kinetics.recovery * 1.3
    );
    next.neurological.dissociativeDepth = expApproach(
      previous.neurological.dissociativeDepth,
      dissociationTarget,
      dtSeconds,
      dissociationTarget > previous.neurological.dissociativeDepth ? kinetics.induction : kinetics.recovery * 0.8
    );
    const analgesicProtection = clamp6(receptors.nociceptiveInhibition, 0, 1);
    const activeNoxiousInput = Math.max(0, Math.min(1, surgicalStimulusIntensity));
    const rawNociception = activeNoxiousInput > 0 ? activeNoxiousInput * (1 - analgesicProtection) * (1 + previous.neurological.centralSensitization * 0.35) : previous.neurological.centralSensitization * 0.12;
    next.neurological.nociceptiveInput = expApproach(
      previous.neurological.nociceptiveInput,
      clamp6(rawNociception, 0, 1.3),
      dtSeconds,
      rawNociception > previous.neurological.nociceptiveInput ? 2.2 : 3.5
    );
    const sensitizationDelta = activeNoxiousInput > 0 && rawNociception > 0.2 ? rawNociception * dtSeconds / 720 : -dtSeconds * (0.15 + analgesicProtection * 0.65) / 3600;
    next.neurological.centralSensitization = clamp6(
      previous.neurological.centralSensitization + sensitizationDelta,
      0,
      1
    );
    const speciesExcitability = patient.species === "feline" || patient.species === "equine" ? 1.2 : 1;
    const dissociativeExcitation = dissociationTarget > 0.12 && hypnoticTarget < 0.42 ? dissociationTarget * speciesExcitability : 0;
    const transitionExcitation = hypnoticTarget > 0.12 && hypnoticTarget < 0.38 ? (1 - Math.abs(hypnoticTarget - 0.25) / 0.13) * 0.55 : 0;
    const opioidDysphoria = (patient.species === "feline" || patient.species === "equine") && receptors.muOpioidDrive > 0.45 && receptors.alpha2Drive < 0.18 ? (receptors.muOpioidDrive - 0.45) * 0.8 : 0;
    const excitationTarget = clamp6(
      Math.max(dissociativeExcitation, transitionExcitation, opioidDysphoria, receptors.centralAntimuscarinicExcitation ?? 0) + next.neurological.nociceptiveInput * 0.25,
      0,
      1.4
    );
    next.neurological.excitationDrive = expApproach(
      previous.neurological.excitationDrive,
      excitationTarget,
      dtSeconds,
      excitationTarget > previous.neurological.excitationDrive ? kinetics.excitation : kinetics.recovery
    );
    next.neurological.motorCapacity = expApproach(
      previous.neurological.motorCapacity,
      clamp6(1 - receptors.nmOccupancy, 0, 1),
      dtSeconds,
      1.8
    );
    const arousalTarget = clamp6(
      100 * (1 - next.neurological.hypnoticDepth) * (1 - next.neurological.sedativeDepth * 0.68) * (1 - next.neurological.dissociativeDepth * 0.82) + next.neurological.excitationDrive * 18 - previous.organPerfusion.cumulativeOxygenDebt * 45 - (receptors.centralM1Blockade ?? 0) * 12,
      0,
      125
    );
    next.neurological.corticalArousalPct = expApproach(
      previous.neurological.corticalArousalPct,
      arousalTarget,
      dtSeconds,
      arousalTarget < previous.neurological.corticalArousalPct ? kinetics.induction : kinetics.recovery
    );
    const isUnconscious = next.neurological.corticalArousalPct < 22 || next.neurological.hypnoticDepth > 0.5;
    next.neurological.unconsciousnessSeconds = isUnconscious ? previous.neurological.unconsciousnessSeconds + dtSeconds : Math.max(0, previous.neurological.unconsciousnessSeconds - dtSeconds * 2);
    const hypotensiveStimulus = clamp6((patient.baselineVitals.map - previousMap) / 45, 0, 1);
    const sympatheticTarget = clamp6(
      next.neurological.nociceptiveInput * 0.75 + Math.max(0, receptors.beta1Drive) * 0.55 + hypotensiveStimulus * 0.35 - Math.max(0, receptors.alpha2Drive) * 0.65,
      0,
      1.5
    );
    const parasympatheticTarget = clamp6(
      0.12 + Math.max(0, receptors.m2Drive) * 0.7 + Math.max(0, receptors.muOpioidDrive) * 0.22,
      0,
      1.3
    );
    next.autonomic.sympatheticDrive = expApproach(
      previous.autonomic.sympatheticDrive,
      sympatheticTarget,
      dtSeconds,
      sympatheticTarget > previous.autonomic.sympatheticDrive ? 3.5 : 22
    );
    next.autonomic.parasympatheticDrive = expApproach(
      previous.autonomic.parasympatheticDrive,
      parasympatheticTarget,
      dtSeconds,
      4.5
    );
    const reserveUse = Math.max(0, next.autonomic.sympatheticDrive - 0.65) * dtSeconds / 900;
    const reserveRecovery = Math.max(0, 1 - previous.autonomic.catecholamineReserve) * dtSeconds / 1800;
    next.autonomic.catecholamineReserve = clamp6(
      previous.autonomic.catecholamineReserve - reserveUse + reserveRecovery,
      0.18,
      1
    );
    const co2Drive = clamp6((previousPaCO2 - 40) / 35, 0, 1.2);
    const hypoxicDrive = clamp6((90 - previousSpO2) / 35, 0, 1);
    const chemoreflexSuppression = clamp6(
      receptors.muOpioidDrive * 0.58 + next.neurological.hypnoticDepth * 0.48,
      0,
      0.9
    );
    const respiratoryTarget = clamp6(
      1 - receptors.respiratoryDepression + (co2Drive * 0.45 + hypoxicDrive * 0.25) * (1 - chemoreflexSuppression),
      0,
      1.35
    );
    next.respiratory.centralDrive = expApproach(
      previous.respiratory.centralDrive,
      respiratoryTarget,
      dtSeconds,
      respiratoryTarget < previous.respiratory.centralDrive ? 2.2 : 7
    );
    next.respiratory.neuromuscularCapacity = next.neurological.motorCapacity;
    const peep = equipment.isVentilatorActive ? equipment.ventilatorSettings.peepCmH2O : 0;
    const recruitmentTarget = clamp6(1 + peep * 0.035 - previous.species.pulmonaryShuntPct / 100 * 0.35, 0.65, 1.28);
    next.respiratory.alveolarRecruitment = expApproach(
      previous.respiratory.alveolarRecruitment,
      recruitmentTarget,
      dtSeconds,
      recruitmentTarget > previous.respiratory.alveolarRecruitment ? 35 : 180
    );
    return next;
  }
  /** Advance the slow exposure and intravascular fluid compartments. */
  static stepSlowCompartments(dtSeconds, patient, equipment, previous, isRecumbent, currentMap, criticalMap, recumbencyShuntPct, deliveries) {
    const next = {
      ...previous,
      inhalant: { ...previous.inhalant },
      neurological: { ...previous.neurological },
      autonomic: { ...previous.autonomic },
      organPerfusion: { ...previous.organPerfusion },
      species: { ...previous.species },
      fluids: { ...previous.fluids },
      metabolic: { ...previous.metabolic },
      biotransformation: { ...previous.biotransformation },
      respiratory: { ...previous.respiratory },
      resuscitation: { ...previous.resuscitation }
    };
    next.species.recumbencySeconds = isRecumbent ? previous.species.recumbencySeconds + dtSeconds : Math.max(0, previous.species.recumbencySeconds - dtSeconds * 1.5);
    const mapDeficit = Math.max(0, criticalMap - currentMap);
    next.species.lowMapExposureSeconds = mapDeficit > 0 && isRecumbent ? previous.species.lowMapExposureSeconds + dtSeconds : Math.max(0, previous.species.lowMapExposureSeconds - dtSeconds * 0.25);
    if (patient.species === "bovine") {
      const bloatRate = isRecumbent ? 1 / 1350 : -1 / 650;
      next.species.ruminalBloatSeverity = clamp6(
        previous.species.ruminalBloatSeverity + bloatRate * dtSeconds,
        0,
        1
      );
    } else {
      next.species.ruminalBloatSeverity = 0;
    }
    const targetShunt = isRecumbent ? recumbencyShuntPct + next.species.ruminalBloatSeverity * 14 : 5;
    next.species.pulmonaryShuntPct = clamp6(
      expApproach(previous.species.pulmonaryShuntPct, targetShunt, dtSeconds, isRecumbent ? 75 : 210),
      4,
      45
    );
    if (patient.species === "equine" && isRecumbent && mapDeficit > 0) {
      const injuryRate = mapDeficit / 25 * dtSeconds / 7200;
      next.species.myopathyRisk = clamp6(previous.species.myopathyRisk + injuryRate, 0, 1);
    } else {
      next.species.myopathyRisk = clamp6(previous.species.myopathyRisk - dtSeconds / 28800, 0, 1);
    }
    const observedTotal = Math.max(0, equipment.totalFluidsInfusedMl);
    const inputs = deliveries ?? [{ fluidName: equipment.activeFluidType, volumeMl: Math.max(0, observedTotal - previous.fluids.lastObservedTotalInfusedMl) }];
    next.fluids = stepFluidBalance(dtSeconds, patient, previous, inputs);
    next.fluids.lastObservedTotalInfusedMl = observedTotal;
    return next;
  }
  /** Integrates endocrine stress instead of mapping glucose directly to one drug. */
  static stepMetabolism(dtSeconds, patient, state, alpha2Drive, beta1Drive, nociceptiveStress, spo2, meanArterialPressure, cardiacOutputRatio = 1, paO2 = 98, cellularOxygenUtilizationFraction = 1, hepaticPerfusionMultiplier = 1, renalPerfusionMultiplier = 1) {
    const next = {
      ...state,
      inhalant: { ...state.inhalant },
      neurological: { ...state.neurological },
      autonomic: { ...state.autonomic },
      organPerfusion: { ...state.organPerfusion },
      species: { ...state.species },
      fluids: { ...state.fluids },
      metabolic: { ...state.metabolic },
      biotransformation: { ...state.biotransformation },
      respiratory: { ...state.respiratory },
      resuscitation: { ...state.resuscitation }
    };
    const baseline = patient.baselineVitals.glucoseMgDl ?? BASELINE_GLUCOSE[patient.species] ?? 95;
    const hypoxicDrive = clamp6((88 - spo2) / 30, 0, 1);
    const hypotensiveDrive = clamp6((60 - meanArterialPressure) / 35, 0, 1);
    const counterTarget = clamp6(
      nociceptiveStress * 0.75 + Math.max(0, beta1Drive) * 0.3 + hypoxicDrive * 0.45 + hypotensiveDrive * 0.4,
      0,
      1.5
    );
    next.metabolic.counterRegulatoryDrive = expApproach(
      state.metabolic.counterRegulatoryDrive,
      counterTarget,
      dtSeconds,
      counterTarget > state.metabolic.counterRegulatoryDrive ? 35 : 600
    );
    const alpha2Inhibition = clamp6(Math.max(0, alpha2Drive) * 0.8, 0, 0.9);
    const glucoseFeedback = clamp6((state.metabolic.bloodGlucoseMgDl - baseline) / 140, 0, 0.8);
    const insulinTarget = clamp6(1 - alpha2Inhibition + glucoseFeedback, 0.08, 1.5);
    next.metabolic.insulinActivity = expApproach(state.metabolic.insulinActivity, insulinTarget, dtSeconds, 150);
    const glucoseTarget = baseline + STRESS_GLUCOSE_GAIN[patient.species] * next.metabolic.counterRegulatoryDrive + 65 * alpha2Inhibition - 28 * Math.max(0, next.metabolic.insulinActivity - 1);
    next.metabolic.bloodGlucoseMgDl = clamp6(
      expApproach(
        state.metabolic.bloodGlucoseMgDl,
        glucoseTarget,
        dtSeconds,
        glucoseTarget > state.metabolic.bloodGlucoseMgDl ? 210 : 1200
      ),
      25,
      900
    );
    next.metabolic.bloodGlucoseMgDl = clamp6(next.metabolic.bloodGlucoseMgDl + (state.fluids.glucoseInputMg ?? 0) / Math.max(1, patient.weightKg * 2) - Math.max(0, state.metabolic.bloodGlucoseMgDl - 180) * dtSeconds / 1800 * state.organPerfusion.renalFraction * (1 - (patient.pathologyConditions.renalDysfunctionSeverity ?? 0)), 20, 900);
    const oxygenFactor = clamp6(spo2 / 95, 0.2, 1.05);
    const flowAvailability = clamp6(cardiacOutputRatio / 0.85, 0.05, 1);
    const cerebralTarget = clamp6((meanArterialPressure - 25) / 45, 0.15, 1.1) * oxygenFactor * flowAvailability;
    const hepaticTarget = clamp6(
      (cardiacOutputRatio * 0.65 + oxygenFactor * 0.35) * hepaticPerfusionMultiplier,
      0.08,
      1.15
    );
    const renalTarget = clamp6(
      (meanArterialPressure - 30) / 50 * oxygenFactor * renalPerfusionMultiplier * flowAvailability,
      0.05,
      1.1
    );
    next.organPerfusion.cerebralFraction = expApproach(state.organPerfusion.cerebralFraction, cerebralTarget, dtSeconds, 12);
    next.organPerfusion.hepaticFraction = expApproach(state.organPerfusion.hepaticFraction, hepaticTarget, dtSeconds, 28);
    next.organPerfusion.renalFraction = expApproach(state.organPerfusion.renalFraction, renalTarget, dtSeconds, 45);
    const hemoglobinGdl = next.fluids.currentHematocritPct / 3;
    const arterialOxygenContentMlDl = 1.34 * hemoglobinGdl * clamp6(spo2 / 100, 0, 1) + 3e-3 * paO2;
    const baselineCardiacOutputLMin = patient.weightKg * (CARDIAC_OUTPUT_ML_KG_MIN[patient.species] || 110) / 1e3;
    next.organPerfusion.oxygenDeliveryMlKgMin = arterialOxygenContentMlDl * baselineCardiacOutputLMin * cardiacOutputRatio * 10 / Math.max(0.1, patient.weightKg);
    const effectiveCellularOxygen = next.organPerfusion.oxygenDeliveryMlKgMin * clamp6(cellularOxygenUtilizationFraction, 0.05, 1.1);
    const deliveryDeficit = getOxygenDeliveryDeficit(patient.species, effectiveCellularOxygen);
    const oxygenThresholds = getOxygenDeliveryThresholds(patient.species);
    const cerebralIschemicDebtRate = clamp6(1 - cerebralTarget / 0.3, 0, 1);
    const oxygenDebtRate = Math.max(deliveryDeficit, cerebralIschemicDebtRate);
    let recoveryRate = 0;
    if (oxygenDebtRate === 0) {
      if (effectiveCellularOxygen >= oxygenThresholds.recovery && meanArterialPressure >= 60 && spo2 >= 94) {
        const surplusFactor = clamp6((effectiveCellularOxygen - oxygenThresholds.recovery) / oxygenThresholds.reserve, 0.25, 2);
        recoveryRate = dtSeconds / 90 * surplusFactor;
      } else {
        recoveryRate = dtSeconds / 360;
      }
    }
    next.organPerfusion.cumulativeOxygenDebt = clamp6(
      state.organPerfusion.cumulativeOxygenDebt + oxygenDebtRate * dtSeconds / 300 - recoveryRate,
      0,
      1
    );
    return next;
  }
  static stepAirwayPressure(dtSeconds, state, airwayPressureCmH2O) {
    const next = {
      ...state,
      inhalant: { ...state.inhalant },
      neurological: { ...state.neurological },
      autonomic: { ...state.autonomic },
      organPerfusion: { ...state.organPerfusion },
      species: { ...state.species },
      fluids: { ...state.fluids },
      metabolic: { ...state.metabolic },
      biotransformation: { ...state.biotransformation },
      respiratory: { ...state.respiratory },
      resuscitation: { ...state.resuscitation }
    };
    next.respiratory.highAirwayPressureSeconds = airwayPressureCmH2O >= 30 ? state.respiratory.highAirwayPressureSeconds + dtSeconds : Math.max(0, state.respiratory.highAirwayPressureSeconds - dtSeconds * 2);
    return next;
  }
};

// src/engine/biotransformationEngine.ts
var clamp7 = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
var approach = (current, target, dt, tau) => current + (target - current) * (1 - Math.exp(-dt / Math.max(0.1, tau)));
var PROFILE_OVERRIDES = {
  propofol: { primaryPathway: "hepatic_phase_ii", pathwayLabel: "Conjuga\xE7\xE3o hep\xE1tica e extra-hep\xE1tica (pulm\xE3o/rim)", enzymeSystem: "UGT", hepaticClearanceFraction: 0.65, renalClearanceFraction: 0.15, proteinBindingFraction: 0.98, apparentCentralVolumeLKg: 0.35, lipidSolubility: 0.95, extrahepaticClearanceFraction: 0.2 },
  morphine: { primaryPathway: "hepatic_phase_ii", pathwayLabel: "Glucuronida\xE7\xE3o hep\xE1tica", enzymeSystem: "UGT2B", hepaticClearanceFraction: 0.78, renalClearanceFraction: 0.22, proteinBindingFraction: 0.35, apparentCentralVolumeLKg: 0.5, lipidSolubility: 0.55, activeMetabolite: "metab\xF3litos glucuron\xEDdeos" },
  methadone: { primaryPathway: "hepatic_phase_i", pathwayLabel: "N-desmetila\xE7\xE3o hep\xE1tica (CYP3A/CYP2B)", enzymeSystem: "CYP3A/CYP2B", hepaticClearanceFraction: 0.85, renalClearanceFraction: 0.15, proteinBindingFraction: 0.88, apparentCentralVolumeLKg: 0.65, lipidSolubility: 0.85, activeMetabolite: "EDDP (inativo)" },
  tramadol: { primaryPathway: "hepatic_phase_i", pathwayLabel: "O-desmetila\xE7\xE3o (CYP2D) e N-desmetila\xE7\xE3o (CYP3A)", enzymeSystem: "CYP2D/CYP3A", hepaticClearanceFraction: 0.82, renalClearanceFraction: 0.18, proteinBindingFraction: 0.2, apparentCentralVolumeLKg: 0.7, lipidSolubility: 0.6, activeMetabolite: "O-desmetiltramadol (M1)" },
  fentanyl: { primaryPathway: "hepatic_phase_i", pathwayLabel: "Oxida\xE7\xE3o hep\xE1tica", enzymeSystem: "CYP3A", hepaticClearanceFraction: 0.9, renalClearanceFraction: 0.1, proteinBindingFraction: 0.84, apparentCentralVolumeLKg: 0.55, lipidSolubility: 0.98 },
  ketamine: { primaryPathway: "hepatic_phase_i", pathwayLabel: "N-desmetila\xE7\xE3o hep\xE1tica", enzymeSystem: "CYP", hepaticClearanceFraction: 0.82, renalClearanceFraction: 0.18, proteinBindingFraction: 0.28, apparentCentralVolumeLKg: 0.65, lipidSolubility: 0.78, activeMetabolite: "norcetamina" },
  midazolam: { primaryPathway: "hepatic_phase_i", pathwayLabel: "Hidroxila\xE7\xE3o hep\xE1tica", enzymeSystem: "CYP3A", hepaticClearanceFraction: 0.86, renalClearanceFraction: 0.14, proteinBindingFraction: 0.95, apparentCentralVolumeLKg: 0.45, lipidSolubility: 0.82 },
  lidocaine_2pct: { primaryPathway: "hepatic_phase_i", pathwayLabel: "Desalquila\xE7\xE3o hep\xE1tica", enzymeSystem: "CYP", hepaticClearanceFraction: 0.88, renalClearanceFraction: 0.12, proteinBindingFraction: 0.65, apparentCentralVolumeLKg: 0.7, lipidSolubility: 0.72, activeMetabolite: "MEGX/GX" },
  atracurium: { primaryPathway: "hoffmann", pathwayLabel: "Elimina\xE7\xE3o de Hofmann e hidr\xF3lise ester\xE1sica", hepaticClearanceFraction: 0.08, renalClearanceFraction: 0.08, proteinBindingFraction: 0.82, apparentCentralVolumeLKg: 0.18, lipidSolubility: 0.15, activeMetabolite: "laudanosina" },
  remifentanil: { primaryPathway: "plasma_esterase", pathwayLabel: "Hidr\xF3lise por esterases plasm\xE1ticas", hepaticClearanceFraction: 0.05, renalClearanceFraction: 0.05, proteinBindingFraction: 0.7, apparentCentralVolumeLKg: 0.25, lipidSolubility: 0.7 },
  sodium_nitroprusside: { primaryPathway: "none", pathwayLabel: "Libera\xE7\xE3o de NO com forma\xE7\xE3o de cianeto/tiocianato", hepaticClearanceFraction: 0.55, renalClearanceFraction: 0.45, proteinBindingFraction: 0.02, apparentCentralVolumeLKg: 0.2, lipidSolubility: 0.08, activeMetabolite: "tiocianato" },
  hydralazine: { primaryPathway: "hepatic_phase_ii", pathwayLabel: "Acetila\xE7\xE3o e hidroxila\xE7\xE3o hep\xE1tica", enzymeSystem: "NAT", hepaticClearanceFraction: 0.78, renalClearanceFraction: 0.22, proteinBindingFraction: 0.9, apparentCentralVolumeLKg: 0.45, lipidSolubility: 0.4 },
  neostigmine: { primaryPathway: "renal", pathwayLabel: "Excre\xE7\xE3o renal e hidr\xF3lise", hepaticClearanceFraction: 0.25, renalClearanceFraction: 0.75, proteinBindingFraction: 0.2, apparentCentralVolumeLKg: 0.25, lipidSolubility: 0.05 },
  sugammadex: { primaryPathway: "renal", pathwayLabel: "Excre\xE7\xE3o renal do complexo encapsulado", hepaticClearanceFraction: 0.02, renalClearanceFraction: 0.98, proteinBindingFraction: 0.02, apparentCentralVolumeLKg: 0.2, lipidSolubility: 0.02 }
};
var resolveBiotransformationProfile = (drug) => {
  const isFluid = drug.category.startsWith("fluid_") || drug.category === "blood_product";
  const defaultProfile = isFluid ? {
    primaryPathway: "none",
    pathwayLabel: "Distribui\xE7\xE3o e redistribui\xE7\xE3o intravascular",
    hepaticClearanceFraction: 0,
    renalClearanceFraction: 0.65,
    proteinBindingFraction: 0,
    apparentCentralVolumeLKg: 0.08,
    lipidSolubility: 0
  } : {
    primaryPathway: "hepatic_phase_i",
    pathwayLabel: "Biotransforma\xE7\xE3o hep\xE1tica seguida de excre\xE7\xE3o renal",
    enzymeSystem: "CYP/UGT",
    hepaticClearanceFraction: 0.72,
    renalClearanceFraction: 0.28,
    proteinBindingFraction: 0.55,
    apparentCentralVolumeLKg: 0.45,
    lipidSolubility: drug.category === "induction" || drug.category === "opioid_analgesic" ? 0.75 : 0.45
  };
  return { ...defaultProfile, ...PROFILE_OVERRIDES[drug.id] || {}, ...drug.biotransformation || {} };
};
var BiotransformationEngine = class {
  static step(dtSeconds, doses, previous, hepaticPerfusion, renalPerfusion) {
    let hepaticLoad = 0;
    let renalLoad = 0;
    let metaboliteDrive = 0;
    let longestContinuousExposureHours = 0;
    for (const dose of doses) {
      const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
      if (!drug) continue;
      const profile = resolveBiotransformationProfile(drug);
      hepaticLoad += dose.currentCp * profile.hepaticClearanceFraction;
      renalLoad += dose.currentCp * profile.renalClearanceFraction;
      metaboliteDrive += dose.currentCp * profile.hepaticClearanceFraction * (profile.activeMetabolite ? 0.45 : 0.12);
      const isToleranceSensitive = Boolean(drug.specialTraits?.isOpioid || drug.specialTraits?.isAlpha2Agonist || drug.specialTraits?.isSympathomimetic);
      if (isToleranceSensitive && dose.isCRI && dose.isInfusionRunning !== false) {
        longestContinuousExposureHours = Math.max(longestContinuousExposureHours, (dose.deliveryElapsedSec || 0) / 3600);
      }
    }
    const hepaticSaturationTarget = clamp7(hepaticLoad / (2.5 + hepaticLoad));
    const renalSaturationTarget = clamp7(renalLoad / (3 + renalLoad));
    const hepaticEnzymeSaturation = approach(previous.hepaticEnzymeSaturation, hepaticSaturationTarget, dtSeconds, hepaticSaturationTarget > previous.hepaticEnzymeSaturation ? 45 : 420);
    const renalTransportSaturation = approach(previous.renalTransportSaturation, renalSaturationTarget, dtSeconds, renalSaturationTarget > previous.renalTransportSaturation ? 60 : 360);
    const metaboliteTarget = clamp7(metaboliteDrive / 4);
    const adaptationTarget = clamp7(longestContinuousExposureHours / 12, 0, 0.65);
    return {
      hepaticEnzymeSaturation,
      renalTransportSaturation,
      hepaticEnzymeCapacity: clamp7(hepaticPerfusion * (1 - hepaticEnzymeSaturation * 0.48), 0.12, 1.15),
      renalFiltrationCapacity: clamp7(renalPerfusion * (1 - renalTransportSaturation * 0.38), 0.12, 1.15),
      circulatingMetaboliteBurden: approach(previous.circulatingMetaboliteBurden, metaboliteTarget, dtSeconds, metaboliteTarget > previous.circulatingMetaboliteBurden ? 180 : 1800),
      receptorAdaptiveFeedback: approach(previous.receptorAdaptiveFeedback, adaptationTarget, dtSeconds, adaptationTarget > previous.receptorAdaptiveFeedback ? 900 : 3600)
    };
  }
};

// src/engine/pharmacokineticModel.ts
var CENTRAL_VOLUME_SCALE = {
  canine: 1,
  feline: 0.9,
  equine: 1.12,
  bovine: 1.18
};
var GENERIC_CLEARANCE_SCALE = {
  canine: 1,
  feline: 0.9,
  equine: 0.9,
  bovine: 0.82
};
var concentrationUnitScale = (unit) => {
  if (!unit) return 1;
  if (unit.startsWith("mcg")) return 1e-3;
  if (unit.startsWith("g/")) return 1e3;
  return 1;
};
var ratePerMinute = (rate, unit) => unit?.endsWith("/h") ? rate / 60 : rate;
var freshState = (dose) => ({
  centralAmountNormalized: Math.max(0, dose.currentCp),
  rapidPeripheralAmountNormalized: 0,
  deepPeripheralAmountNormalized: 0,
  absorptionDepotAmountNormalized: 0,
  cumulativeDeliveredNormalized: Math.max(0, dose.currentCp),
  cumulativeEliminatedNormalized: 0,
  bioavailableFraction: 1,
  effectiveClearanceMultiplier: 1,
  depotWasLoaded: false
});
var PharmacokineticModel = class {
  static step(dtSeconds, patient, drug, dose, typicalBolusDosePerKg, typicalCriRatePerKg, systemicClearanceModifier, peripheralPerfusion = 1) {
    const state = { ...dose.pkCompartments ?? freshState(dose) };
    const route = getRoutePharmacokinetics(drug, dose.route);
    const priorTransitLag = Math.max(0, dose.transitLagRemainingSec || 0);
    const activeSeconds = priorTransitLag <= 0 ? dtSeconds : Math.max(0, dtSeconds - priorTransitLag);
    let deliveryElapsedSec = dose.deliveryElapsedSec || 0;
    let isFullyDelivered = dose.isFullyDelivered || false;
    if (activeSeconds <= 0) {
      return {
        currentCp: dose.currentCp,
        currentCe: dose.currentCe,
        deliveryElapsedSec,
        isFullyDelivered,
        pkCompartments: state
      };
    }
    const normalizedBolus = Math.max(0, dose.dosePerKg / Math.max(1e-6, typicalBolusDosePerKg));
    const vcScale = CENTRAL_VOLUME_SCALE[patient.species] || 1;
    const speciesClearance = GENERIC_CLEARANCE_SCALE[patient.species] || 1;
    const clearance = Math.max(0.08, systemicClearanceModifier * speciesClearance);
    state.effectiveClearanceMultiplier = clearance;
    state.bioavailableFraction = route.bioavailability;
    const bioProfile = resolveBiotransformationProfile(drug);
    const lipidSolubility = bioProfile.lipidSolubility ?? 0.5;
    const alpha = Math.LN2 / Math.max(0.1, drug.halfLifeAlpha);
    const beta = Math.LN2 / Math.max(0.2, drug.halfLifeBeta);
    const hepaticFraction = bioProfile.hepaticClearanceFraction;
    const k10Factor = hepaticFraction > 0.7 ? 0.95 : hepaticFraction > 0.3 ? 0.82 : 0.7;
    const k10 = Math.max(5e-4, beta * k10Factor * clearance);
    const k12 = Math.max(1e-3, (alpha - beta) * 0.52);
    const k21k12Ratio = Math.max(0.15, 0.55 - lipidSolubility * 0.35);
    const k21 = Math.max(1e-3, k12 * k21k12Ratio);
    const deepUptakeFactor = Math.max(0.12, 0.1 + lipidSolubility * 0.22);
    const k13 = Math.max(2e-4, beta * deepUptakeFactor);
    const deepReturnFactor = Math.max(0.03, 0.1 - lipidSolubility * 0.065);
    const k31 = Math.max(1e-4, beta * deepReturnFactor);
    const effectiveK10 = k10;
    const ka = route.absorptionHalfLifeMinutes > 0 ? Math.LN2 / route.absorptionHalfLifeMinutes * Math.min(1.2, Math.max(0.08, peripheralPerfusion)) : 0;
    let directCentralInput = 0;
    if (dose.isCRI) {
      deliveryElapsedSec += activeSeconds;
      isFullyDelivered = dose.isInfusionRunning === false;
    } else if (isExtravascularRoute(dose.route)) {
      if (!state.depotWasLoaded) {
        state.absorptionDepotAmountNormalized += normalizedBolus * route.bioavailability;
        state.cumulativeDeliveredNormalized += normalizedBolus * route.bioavailability;
        state.depotWasLoaded = true;
      }
      deliveryElapsedSec += activeSeconds;
    } else {
      const deliveryDuration = Math.max(0.1, dose.deliveryDurationSec || 1);
      const previousFraction = Math.min(1, deliveryElapsedSec / deliveryDuration);
      deliveryElapsedSec += activeSeconds;
      const nextFraction = Math.min(1, deliveryElapsedSec / deliveryDuration);
      directCentralInput = normalizedBolus * Math.max(0, nextFraction - previousFraction);
      state.cumulativeDeliveredNormalized += directCentralInput;
      isFullyDelivered = nextFraction >= 1;
    }
    const substeps = Math.max(1, Math.ceil(activeSeconds / 1.5));
    const hMin = activeSeconds / substeps / 60;
    let effectSite = Math.max(0, dose.currentCe);
    for (let index = 0; index < substeps; index += 1) {
      let inputThisStep = directCentralInput / substeps;
      if (dose.isCRI && dose.isInfusionRunning !== false && (dose.criRatePerKgMin || 0) > 0) {
        const rateUnit = drug.criDoseUnit || drug.doseUnit;
        const configuredRate = (dose.criRatePerKgMin || 0) * concentrationUnitScale(rateUnit);
        const typicalRate = Math.max(
          1e-6,
          ratePerMinute(typicalCriRatePerKg || dose.dosePerKg, rateUnit) * concentrationUnitScale(rateUnit)
        );
        const referenceK10 = Math.max(5e-4, beta * k10Factor * speciesClearance);
        const referenceAmount = isTimeBasedDoseUnit(drug.doseUnit) ? typicalRate / (referenceK10 * vcScale) : typicalBolusDosePerKg * concentrationUnitScale(drug.doseUnit);
        const inputRate = configuredRate / Math.max(1e-6, referenceAmount);
        inputThisStep += inputRate * hMin;
        state.cumulativeDeliveredNormalized += inputRate * hMin;
      }
      if (state.absorptionDepotAmountNormalized > 0 && ka > 0) {
        const absorbed = state.absorptionDepotAmountNormalized * (1 - Math.exp(-ka * hMin));
        state.absorptionDepotAmountNormalized -= absorbed;
        inputThisStep += absorbed;
      }
      const central = Math.max(0, state.centralAmountNormalized + inputThisStep);
      const rapid = Math.max(0, state.rapidPeripheralAmountNormalized);
      const deep = Math.max(0, state.deepPeripheralAmountNormalized);
      const totalOutRate = k12 + k13 + effectiveK10;
      const outflow = central * (1 - Math.exp(-totalOutRate * hMin));
      const toRapid = outflow * k12 / totalOutRate;
      const toDeep = outflow * k13 / totalOutRate;
      const eliminated = outflow * effectiveK10 / totalOutRate;
      const fromRapid = rapid * (1 - Math.exp(-k21 * hMin));
      const fromDeep = deep * (1 - Math.exp(-k31 * hMin));
      state.centralAmountNormalized = Math.max(0, central - toRapid - toDeep - eliminated + fromRapid + fromDeep);
      state.rapidPeripheralAmountNormalized = Math.max(0, rapid + toRapid - fromRapid);
      state.deepPeripheralAmountNormalized = Math.max(0, deep + toDeep - fromDeep);
      state.cumulativeEliminatedNormalized += Math.max(0, eliminated);
      const plasma = state.centralAmountNormalized / vcScale;
      effectSite = Math.max(0, effectSite + (plasma - effectSite) * (1 - Math.exp(-drug.ke0 * hMin)));
    }
    if (isExtravascularRoute(dose.route)) {
      isFullyDelivered = state.depotWasLoaded && state.absorptionDepotAmountNormalized <= normalizedBolus * route.bioavailability * 5e-3;
    }
    return {
      currentCp: Math.max(0, state.centralAmountNormalized / vcScale),
      currentCe: effectSite,
      deliveryElapsedSec,
      isFullyDelivered,
      pkCompartments: state
    };
  }
};

// src/engine/inhalantKinetics.ts
var approach2 = (current, target, dtSeconds, tauSeconds) => current + (target - current) * (1 - Math.exp(-dtSeconds / Math.max(0.1, tauSeconds)));
var InhalantKineticsEngine = class {
  static step(dtSeconds, patient, equipment, previous, ventilationRatio, cardiacOutputRatio) {
    const species = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const hasGasPath = equipment.intubationStatus === "intubated_tracheal" || equipment.intubationStatus === "laryngeal_mask";
    const deliveredVaporizerPct = equipment.isVaporizerOn && !equipment.isOxygenFlushActive && equipment.oxygenFlowLMin > 0.1 && hasGasPath ? equipment.vaporizerDialPct : 0;
    const macPct = equipment.vaporizerType === "isoflurane" ? species.macValues.isoflurane : species.macValues.sevoflurane;
    const inspiredMac = deliveredVaporizerPct / Math.max(0.1, macPct);
    const flowRatio = Math.max(0.25, Math.min(
      1.6,
      equipment.oxygenFlowLMin / Math.max(0.5, patient.weightKg * 0.05)
    ));
    const effectiveVentilation = Math.max(0.12, Math.min(2.2, ventilationRatio));
    const bloodGasSolubility = equipment.vaporizerType === "sevoflurane" ? 0.65 : 1;
    const alveolarTau = 58 * bloodGasSolubility / Math.sqrt(flowRatio * effectiveVentilation);
    const tissueBackPressure = deliveredVaporizerPct === 0 ? previous.vesselRichMac * 0.07 + previous.muscleMac * 0.025 + previous.fatMac * 8e-3 : 0;
    const alveolarTarget = Math.max(0, inspiredMac + tissueBackPressure);
    const alveolarMac = approach2(previous.alveolarMac, alveolarTarget, dtSeconds, alveolarTau);
    const perfusion = Math.max(0.2, Math.min(1.5, cardiacOutputRatio));
    const vesselTau = (equipment.vaporizerType === "sevoflurane" ? 22 : 30) / perfusion;
    const vesselRichMac = approach2(previous.vesselRichMac, alveolarMac, dtSeconds, vesselTau);
    const muscleMac = approach2(previous.muscleMac, vesselRichMac, dtSeconds, 360 / perfusion);
    const fatMac = approach2(previous.fatMac, vesselRichMac, dtSeconds, 2400 / perfusion);
    return {
      state: {
        inspiredMac,
        alveolarMac: Math.max(0, alveolarMac),
        vesselRichMac: Math.max(0, vesselRichMac),
        muscleMac: Math.max(0, muscleMac),
        fatMac: Math.max(0, fatMac)
      },
      deliveredVaporizerPct
    };
  }
};

// src/engine/organClearance.ts
var clamp8 = (n, min = 0.05, max = 1.15) => Math.min(max, Math.max(min, n));
function getOrganClearanceModifier(patient, drug, state, temperature) {
  const profile = resolveBiotransformationProfile(drug);
  const hepatic = profile.hepaticClearanceFraction;
  const renal = profile.renalClearanceFraction;
  const extra = Math.max(0, 1 - hepatic - renal);
  const total = Math.max(1, hepatic + renal);
  const thermal = clamp8(1 - Math.max(0, 38 - temperature) * 0.09, 0.5, 1);
  const ugt = profile.primaryPathway === "hepatic_phase_ii" && profile.enzymeSystem?.startsWith("UGT") ? SPECIES_CELLULAR_CONFIGS[patient.species].glucuronidationClearanceMultiplier : 1;
  const hepaticFunction = clamp8(state.organPerfusion.hepaticFraction) * clamp8(state.biotransformation.hepaticEnzymeCapacity) * clamp8(1 - state.systemicRegulation.hepaticInjury * 0.7) * clamp8(1 - (patient.pathologyConditions.hepaticDysfunctionSeverity ?? 0) * 0.85);
  const renalFunction = clamp8(state.organPerfusion.renalFraction) * clamp8(state.biotransformation.renalFiltrationCapacity) * clamp8(1 - state.systemicRegulation.renalInjury * 0.8) * clamp8(1 - (patient.pathologyConditions.renalDysfunctionSeverity ?? 0) * 0.9);
  const extraFunction = profile.primaryPathway === "hoffmann" ? thermal * clamp8(1 - state.organPerfusion.cumulativeOxygenDebt * 0.4) : thermal;
  return clamp8((hepatic * hepaticFunction * ugt * thermal + renal * renalFunction + extra * extraFunction) / total);
}

// src/engine/drugInteractionEffects.ts
var clamp9 = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
var DrugInteractionEffectsEngine = class {
  static evaluate(patient, receptors) {
    const signals = [];
    const gabaPartner = Math.max(
      receptors.propofolSiteOccupancy,
      receptors.volatileSiteOccupancy,
      receptors.neurosteroidSiteOccupancy
    );
    const gabaSynergy = clamp9(receptors.bzdAllostericOccupancy * gabaPartner * 1.65);
    if (gabaSynergy > 0.08) {
      signals.push({
        id: "gaba-allosteric-synergy",
        source: "farmacologia",
        targets: ["neurologico", "respiratorio", "cardiovascular"],
        topology: "one-to-many",
        severity: gabaSynergy,
        label: "Sinergismo alost\xE9rico GABA-A com depress\xE3o sist\xEAmica",
        effects: {
          respiratoryDriveMultiplier: 1 - gabaSynergy * 0.28,
          contractilityMultiplier: 1 - gabaSynergy * 0.06
        }
      });
    }
    const afterloadMismatch = clamp9(Math.max(0, receptors.alpha2Drive - 0.18) * Math.max(0, -receptors.m2Drive) * 2.6);
    if (afterloadMismatch > 0.04) {
      signals.push({
        id: "alpha2-antimuscarinic-afterload-mismatch",
        source: "farmacologia",
        targets: ["cardiovascular"],
        topology: "one-to-one",
        severity: afterloadMismatch,
        label: "Descasamento entre p\xF3s-carga alfa-2 e bloqueio vagal",
        effects: {
          vascularResistanceMultiplier: 1 + afterloadMismatch * 0.12,
          myocardialIschemiaRatePerMinute: afterloadMismatch * 0.22,
          arrhythmogenicBurden: afterloadMismatch * 0.7
        }
      });
    }
    const adrenergicStorm = clamp9(Math.max(0, receptors.cAMPMyocardial - 1.75) / 1.25);
    if (adrenergicStorm > 0.04) {
      signals.push({
        id: "adrenergic-calcium-overload",
        source: "autonomico",
        targets: ["cardiovascular", "celular", "metabolico"],
        topology: "one-to-many",
        severity: adrenergicStorm,
        label: "Sobrecarga adren\xE9rgica de c\xE1lcio e consumo mioc\xE1rdico",
        effects: {
          metabolicCo2Multiplier: 1 + adrenergicStorm * 0.18,
          myocardialIschemiaRatePerMinute: adrenergicStorm * 0.14,
          arrhythmogenicBurden: adrenergicStorm * 0.65
        }
      });
    }
    const centralSynergy = clamp9(
      Math.max(0, receptors.centralSedation - 0.25) * Math.max(0, receptors.respiratoryDepression - 0.28) * 2.5
    );
    if (centralSynergy > 0.04) {
      signals.push({
        id: "central-respiratory-summation",
        source: "neurologico",
        targets: ["respiratorio"],
        topology: "one-to-one",
        severity: centralSynergy,
        label: "Soma\xE7\xE3o central sobre o drive ventilat\xF3rio",
        effects: { respiratoryDriveMultiplier: 1 - centralSynergy * 0.3 }
      });
    }
    const sodiumChannelToxicity = clamp9(
      receptors.naVBlockade * (patient.species === "feline" ? 1.65 : 1)
    );
    if (sodiumChannelToxicity > 0.12) {
      signals.push({
        id: "systemic-nav-toxicity",
        source: "farmacologia",
        targets: ["cardiovascular", "neurologico"],
        topology: "one-to-many",
        severity: sodiumChannelToxicity,
        label: "Bloqueio sist\xEAmico de canais de s\xF3dio",
        effects: {
          contractilityMultiplier: 1 - sodiumChannelToxicity * 0.32,
          arrhythmogenicBurden: sodiumChannelToxicity * 0.75
        }
      });
    }
    return signals;
  }
};

// src/engine/homeostaticFeedbackEngine.ts
var clamp10 = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
var HomeostaticFeedbackEngine = class {
  static evaluate(patient, state, previousVitals) {
    const signals = [];
    const regulation = state.systemicRegulation || {
      cellularOxygenUtilizationFraction: 1,
      cellularHypoxia: 0,
      myocardialStress: 0,
      arrhythmogenicBurden: 0,
      endothelialDysfunction: 0,
      hepaticInjury: 0,
      renalInjury: 0,
      compensatoryReserve: 1
    };
    const reserve = clamp10(regulation.compensatoryReserve / getPatientReserveCapacity(patient));
    if (regulation.cellularHypoxia > 0.05) {
      const severity = clamp10(regulation.cellularHypoxia);
      const compensation = severity * reserve;
      signals.push({
        id: "cellular-hypoxia-autonomic-feedback",
        source: "celular",
        targets: ["autonomico", "cardiovascular", "respiratorio"],
        topology: "one-to-many",
        severity,
        label: "Quimiorreflexo compensat\xF3rio por hip\xF3xia celular",
        effects: {
          heartRateMultiplier: 1 + compensation * 0.16 - severity * (1 - reserve) * 0.22,
          vascularResistanceMultiplier: 1 + compensation * 0.1 - severity * (1 - reserve) * 0.16,
          respiratoryDriveMultiplier: 1 + compensation * 0.18,
          metabolicCo2Multiplier: 1 + severity * 0.12
        }
      });
    }
    if (regulation.myocardialStress > 0.08) {
      const stress = clamp10(regulation.myocardialStress);
      signals.push({
        id: "myocardial-stress-positive-feedback",
        source: "cardiovascular",
        targets: ["cardiovascular", "celular"],
        topology: "one-to-many",
        severity: stress,
        label: "Retroalimenta\xE7\xE3o positiva entre demanda, isquemia e instabilidade el\xE9trica",
        effects: {
          contractilityMultiplier: 1 - stress * 0.16,
          myocardialIschemiaRatePerMinute: stress * 0.08,
          arrhythmogenicBurden: stress * 0.35
        }
      });
    }
    if (regulation.hepaticInjury > 0.05 || regulation.renalInjury > 0.05) {
      const hepatic = clamp10(regulation.hepaticInjury);
      const renal = clamp10(regulation.renalInjury);
      signals.push({
        id: "organ-injury-clearance-feedback",
        source: "metabolico",
        targets: ["hepatico", "renal", "farmacologia"],
        topology: "one-to-many",
        severity: Math.max(hepatic, renal),
        label: "Les\xE3o org\xE2nica reduz depura\xE7\xE3o e amplia exposi\xE7\xE3o farmacol\xF3gica",
        effects: {
          hepaticPerfusionMultiplier: 1 - hepatic * 0.55,
          renalPerfusionMultiplier: 1 - renal * 0.6
        }
      });
    }
    const pH = previousVitals?.arterialBloodGases.pH ?? 7.4;
    const acidemia = clamp10((7.28 - pH) / 0.38);
    const vascularInjury = clamp10(regulation.endothelialDysfunction);
    const refractoryBurden = clamp10(acidemia * 0.55 + vascularInjury * 0.35 + regulation.cellularHypoxia * 0.2);
    if (refractoryBurden > 0.04) {
      signals.push({
        id: "shock-adrenergic-resistance",
        source: "metabolico",
        targets: ["cardiovascular", "farmacologia"],
        topology: "one-to-many",
        severity: refractoryBurden,
        label: "Acidemia e disfun\xE7\xE3o vascular reduzem resposta a catecolaminas",
        effects: { adrenergicResponsiveness: 1 - refractoryBurden * 0.65 }
      });
    }
    const exhaustion = clamp10((1 - reserve) * Math.max(regulation.cellularHypoxia, state.organPerfusion.cumulativeOxygenDebt));
    if (exhaustion > 0.06) {
      signals.push({
        id: "circulatory-reserve-exhaustion",
        source: "cardiovascular",
        targets: ["cardiovascular", "hepatico", "renal"],
        topology: "one-to-many",
        severity: exhaustion,
        label: "Esgotamento de reserva: perda de t\xF4nus, for\xE7a de contra\xE7\xE3o e perfus\xE3o org\xE2nica",
        effects: {
          contractilityMultiplier: 1 - exhaustion * 0.3,
          vascularResistanceMultiplier: 1 - exhaustion * 0.22,
          hepaticPerfusionMultiplier: 1 - exhaustion * 0.2,
          renalPerfusionMultiplier: 1 - exhaustion * 0.25
        }
      });
    }
    if (acidemia > 0.02) {
      signals.push({
        id: "acidemia-cardiovascular-depression",
        source: "metabolico",
        targets: ["cardiovascular", "respiratorio"],
        topology: "one-to-many",
        severity: acidemia,
        label: "Depress\xE3o cardiovascular e compensa\xE7\xE3o ventilat\xF3ria por acidemia",
        effects: {
          contractilityMultiplier: 1 - acidemia * 0.18,
          respiratoryDriveMultiplier: 1 + acidemia * 0.24,
          arrhythmogenicBurden: acidemia * 0.3
        }
      });
    }
    return signals;
  }
};

// src/engine/toxicologyEngine.ts
var clamp11 = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
var ToxicologyEngine = class {
  static evaluate(patient, state, receptors) {
    const signals = [];
    const cyanideBurden = clamp11(state.metabolic.nitroprussideToxicMetaboliteBurden || 0);
    if (cyanideBurden > 0.08) {
      const toxicity = clamp11((cyanideBurden - 0.08) / 0.72);
      signals.push({
        id: "nitroprusside-cellular-toxicity",
        source: "metabolico",
        targets: ["celular", "cardiovascular", "hepatico", "renal", "neurologico"],
        topology: "broadcast",
        severity: toxicity,
        label: "Inibi\xE7\xE3o da respira\xE7\xE3o celular por metab\xF3litos do nitroprussiato",
        effects: {
          cellularOxygenUtilizationFraction: 1 - toxicity * 0.78,
          additionalLactateMmolLMin: toxicity * 4.2,
          contractilityMultiplier: 1 - toxicity * 0.38,
          vascularResistanceMultiplier: 1 - toxicity * 0.22,
          arrhythmogenicBurden: toxicity * 0.5,
          hepaticPerfusionMultiplier: 1 - toxicity * 0.18,
          renalPerfusionMultiplier: 1 - toxicity * 0.2
        }
      });
    }
    const metaboliteBurden = clamp11(state.biotransformation.circulatingMetaboliteBurden);
    const impairedClearance = clamp11(1 - Math.min(
      state.biotransformation.hepaticEnzymeCapacity,
      state.biotransformation.renalFiltrationCapacity
    ));
    const retainedBurden = metaboliteBurden * impairedClearance;
    if (retainedBurden > 0.08) {
      signals.push({
        id: "retained-metabolite-load",
        source: "hepatico",
        targets: ["renal", "neurologico", "respiratorio"],
        topology: "one-to-many",
        severity: clamp11(retainedBurden * 1.6),
        label: "Reten\xE7\xE3o de metab\xF3litos por depura\xE7\xE3o org\xE2nica limitada",
        effects: {
          respiratoryDriveMultiplier: 1 - clamp11(retainedBurden) * 0.12,
          renalPerfusionMultiplier: 1 - clamp11(retainedBurden) * 0.08
        }
      });
    }
    const membraneInstability = clamp11(receptors.hyperkalemicCardiotoxicity);
    if (membraneInstability > 0.08) {
      signals.push({
        id: "hyperkalemic-membrane-instability",
        source: "metabolico",
        targets: ["celular", "cardiovascular"],
        topology: "one-to-many",
        severity: membraneInstability,
        label: "Instabilidade de membrana por hipercalemia",
        effects: {
          heartRateMultiplier: 1 - membraneInstability * 0.2,
          contractilityMultiplier: 1 - membraneInstability * 0.16,
          arrhythmogenicBurden: membraneInstability * 0.82
        }
      });
    }
    void patient;
    return signals;
  }
};

// src/engine/physiologicalOrchestrator.ts
var clamp12 = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
var approach3 = (current, target, dt, tau) => current + (target - current) * (1 - Math.exp(-dt / Math.max(0.1, tau)));
var PhysiologicalOrchestrator = class {
  static step(dtSeconds, patient, state, receptors, previousVitals) {
    const signals = [
      ...antimuscarinicSignals(patient, state, receptors),
      ...fluidPhysiologicalSignals(state),
      ...DrugInteractionEffectsEngine.evaluate(patient, receptors),
      ...ToxicologyEngine.evaluate(patient, state, receptors),
      ...HomeostaticFeedbackEngine.evaluate(patient, state, previousVitals)
    ];
    const modifiers = aggregatePhysiologicalSignals(signals);
    const previous = state.systemicRegulation || {
      cellularOxygenUtilizationFraction: 1,
      cellularHypoxia: 0,
      myocardialStress: 0,
      arrhythmogenicBurden: 0,
      endothelialDysfunction: 0,
      hepaticInjury: 0,
      renalInjury: 0,
      compensatoryReserve: 1
    };
    const deliveryDeficit = getOxygenDeliveryDeficit(patient.species, state.organPerfusion.oxygenDeliveryMlKgMin);
    const regionalPerfusionDeficit = clamp12(
      1 - Math.min(
        state.organPerfusion.cerebralFraction,
        state.organPerfusion.hepaticFraction,
        state.organPerfusion.renalFraction
      )
    );
    const oxygenSupplyDeficit = clamp12(Math.max(deliveryDeficit, regionalPerfusionDeficit * 0.38));
    const utilizationDeficit = 1 - modifiers.cellularOxygenUtilizationFraction;
    const cellularHypoxiaTarget = clamp12(Math.max(oxygenSupplyDeficit, utilizationDeficit));
    const myocardialStressTarget = clamp12(
      modifiers.arrhythmogenicBurden * 0.55 + modifiers.myocardialIschemiaRatePerMinute * 1.8 + (previousVitals?.myocardialIschemiaScore || 0) * 0.7
    );
    const sustainedCellularInjury = Math.max(0, previous.cellularHypoxia - 0.22);
    const hepaticInjuryTarget = clamp12(sustainedCellularInjury * 0.55 + state.biotransformation.hepaticEnzymeSaturation * 0.12);
    const renalInjuryTarget = clamp12(sustainedCellularInjury * 0.62 + state.biotransformation.renalTransportSaturation * 0.15);
    const debt = state.organPerfusion.cumulativeOxygenDebt;
    const stressLoad = clamp12(cellularHypoxiaTarget * 0.55 + myocardialStressTarget * 0.25 + debt * 0.6);
    const capacity = getPatientReserveCapacity(patient);
    const reserveTarget = capacity * clamp12(1 - stressLoad * 1.15, 0.08, 1);
    const nextRegulation = {
      cellularOxygenUtilizationFraction: approach3(
        previous.cellularOxygenUtilizationFraction,
        modifiers.cellularOxygenUtilizationFraction,
        dtSeconds,
        modifiers.cellularOxygenUtilizationFraction < previous.cellularOxygenUtilizationFraction ? 8 : 180
      ),
      cellularHypoxia: approach3(previous.cellularHypoxia, cellularHypoxiaTarget, dtSeconds, cellularHypoxiaTarget > previous.cellularHypoxia ? 18 : 240),
      myocardialStress: approach3(previous.myocardialStress, myocardialStressTarget, dtSeconds, myocardialStressTarget > previous.myocardialStress ? 12 : 180),
      arrhythmogenicBurden: approach3(previous.arrhythmogenicBurden, modifiers.arrhythmogenicBurden, dtSeconds, modifiers.arrhythmogenicBurden > previous.arrhythmogenicBurden ? 5 : 90),
      endothelialDysfunction: approach3(previous.endothelialDysfunction, clamp12(utilizationDeficit * 0.45 + debt * 0.45 + sustainedCellularInjury * 0.3), dtSeconds, stressLoad > 0.2 ? 180 : 1800),
      hepaticInjury: approach3(previous.hepaticInjury, hepaticInjuryTarget, dtSeconds, hepaticInjuryTarget > previous.hepaticInjury ? 900 : 7200),
      renalInjury: approach3(previous.renalInjury, renalInjuryTarget, dtSeconds, renalInjuryTarget > previous.renalInjury ? 1200 : 10800),
      compensatoryReserve: approach3(previous.compensatoryReserve, reserveTarget, dtSeconds, reserveTarget < previous.compensatoryReserve ? 240 * capacity : 1800)
    };
    return {
      state: { ...state, systemicRegulation: nextRegulation },
      signals,
      modifiers: {
        ...modifiers,
        cellularOxygenUtilizationFraction: nextRegulation.cellularOxygenUtilizationFraction
      }
    };
  }
};

// src/engine/pkpdEngine.ts
var PKPDEngine = class {
  /**
   * Advanced multi-system biophysical simulation engine:
   * 1. Multi-compartment pharmacokinetics & bio-phase equilibration (ke0).
   * 2. Receptor-level allosteric cooperativity and competitive displacement (Schild law).
   * 3. Closed-loop cardiovascular mechanics (Frank-Starling inotropy, SVR, stroke volume, baroreceptor reflex).
   * 4. Medullary pre-Bötzinger respiratory rhythm, intrapulmonary V/Q shunt, and acid-base equilibrium.
   * 5. Deep species-specific abstraction (Canine vagotonia, Feline UGT1A6 deficit/lidocaine toxicity,
   *    Equine recumbency myopathy/shunt, Bovine alpha-2D hypersensitivity/ruminal bloat).
   * 6. Neurological Guedel planes, reflex mapping, and resuscitation kinetics.
   */
  static stepSimulation(dtSeconds, simTimeSeconds, patient, activeDoses, equipment, resuscitation, surgicalStimulation, previousVitals) {
    const speciesInfo = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const surgicalStimulusIntensity = typeof surgicalStimulation === "number" ? Math.max(0, Math.min(1, surgicalStimulation)) : surgicalStimulation ? 1 : 0;
    const isSurgicalStimulationActive = surgicalStimulusIntensity > 0;
    let biologicalState = previousVitals?.biologicalState ?? BiologicalStateEngine.initialize(patient);
    let hypoxiaSeconds = previousVitals?.hypoxiaExposureSeconds || 0;
    let ischemiaScore = previousVitals?.myocardialIschemiaScore || 0;
    let isAlreadyArrested = previousVitals?.isCardiacArrest || false;
    let arrestCause = previousVitals?.cardiacArrestCause;
    let arrestType = previousVitals?.cardiacArrestType || "asystole";
    let isAlreadyDead = previousVitals?.isDead || false;
    let deathTime = previousVitals?.deathTimeSeconds;
    let deathCause = previousVitals?.deathCause;
    let asystoleSeconds = previousVitals?.asystoleSecondsElapsed || 0;
    let cprSeconds = previousVitals?.cprSecondsElapsed || 0;
    const previousCriticalTimers = previousVitals?.criticalEventTimers || {
      severeBradycardiaSeconds: 0,
      severeTachycardiaSeconds: 0,
      profoundHypotensionSeconds: 0
    };
    const ageTotalYears = patient.ageYears + (patient.ageMonths || 0) / 12;
    const isPediatric = ageTotalYears < 0.6;
    const isGeriatric = patient.species === "canine" && ageTotalYears >= 9.5 || patient.species === "feline" && ageTotalYears >= 11 || patient.species === "equine" && ageTotalYears >= 18 || patient.species === "bovine" && ageTotalYears >= 10;
    let ageClearanceFactor = 1;
    if (isPediatric) ageClearanceFactor *= 0.65;
    if (isGeriatric) ageClearanceFactor *= 0.65;
    let asaClearanceFactor = 1;
    if (patient.asa === "II") {
      asaClearanceFactor = 0.9;
    } else if (patient.asa === "III") {
      asaClearanceFactor = 0.7;
    } else if (patient.asa === "IV" || patient.asa === "V") {
      asaClearanceFactor = 0.38;
    }
    const updatedDoses = [];
    const activeDrugEffects = {};
    let fatalOverdoseTriggered = false;
    let fatalToxicityReason = "";
    const cumulativeBolusDosePerKg = /* @__PURE__ */ new Map();
    for (const dose of activeDoses) {
      if (!dose.isCRI) {
        cumulativeBolusDosePerKg.set(
          dose.drugId,
          (cumulativeBolusDosePerKg.get(dose.drugId) || 0) + dose.dosePerKg
        );
      }
    }
    for (const dose of activeDoses) {
      const drugDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === dose.drugId);
      if (!drugDef) continue;
      const speciesDoseRange = getSpeciesDoseRange(drugDef, patient.species, Boolean(dose.isCRI));
      if (!speciesDoseRange) continue;
      let newCp = dose.currentCp;
      let newCe = dose.currentCe;
      let deliveryElapsed = dose.deliveryElapsedSec || 0;
      const priorTransitLag = Math.max(0, dose.transitLagRemainingSec || 0);
      const transitLagRemaining = Math.max(0, priorTransitLag - dtSeconds);
      let isFullyDelivered = dose.isFullyDelivered || false;
      let isFastBolusShockTriggered = dose.isFastBolusShockTriggered || false;
      let shockMagnitude = dose.bolusShockMagnitude || 0;
      let bolusShockRemainingSec = Math.max(0, (dose.bolusShockRemainingSec || 0) - dtSeconds);
      let pkCompartments = dose.pkCompartments;
      if (dose.administrationSpeed === "bolus_rapid" && !isFastBolusShockTriggered && transitLagRemaining <= 0) {
        isFastBolusShockTriggered = true;
        const doseRatio = dose.dosePerKg / speciesDoseRange.typical;
        if (drugDef.fastBolusRisk) {
          shockMagnitude = Math.min(1.5, doseRatio / (0.65 + doseRatio));
          bolusShockRemainingSec = 45;
        }
      }
      const baselineCardiacOutput = patient.weightKg * speciesConfig.cardiacOutputMlKgMin / 1e3;
      const priorCardiacOutputRatio = previousVitals ? previousVitals.cellularState.cardiacOutputLMin / Math.max(0.05, baselineCardiacOutput) : 1;
      const metabolicClearanceFactor = ageClearanceFactor * asaClearanceFactor * getOrganClearanceModifier(patient, drugDef, biologicalState, previousVitals?.bodyTemperatureC ?? patient.baselineVitals.tempC);
      const baselineSVR = Math.max(1, (patient.baselineVitals.map - 4) * 80 / Math.max(0.1, baselineCardiacOutput));
      const vascularResistanceRatio = previousVitals ? previousVitals.cellularState.systemicVascularResistanceDyne / baselineSVR : 1;
      const peripheralPerfusion = Math.max(0.08, Math.min(
        1.2,
        priorCardiacOutputRatio / Math.max(1, vascularResistanceRatio)
      ));
      const bolusRange = getSpeciesDoseRange(drugDef, patient.species, false) || speciesDoseRange;
      const criRange = getSpeciesDoseRange(drugDef, patient.species, true);
      const pkStep = PharmacokineticModel.step(
        dtSeconds,
        patient,
        drugDef,
        dose,
        bolusRange.typical,
        criRange?.typical,
        metabolicClearanceFactor,
        peripheralPerfusion
      );
      newCp = pkStep.currentCp;
      newCe = pkStep.currentCe;
      deliveryElapsed = pkStep.deliveryElapsedSec;
      isFullyDelivered = pkStep.isFullyDelivered;
      pkCompartments = pkStep.pkCompartments;
      const cumulativeDose = cumulativeBolusDosePerKg.get(drugDef.id) || dose.dosePerKg;
      const drugHasArrived = transitLagRemaining <= 0 && newCp > 5e-3;
      if (drugHasArrived && drugDef.id === "potassium_chloride" && !dose.isCRI && dose.administrationSpeed === "bolus_rapid" && newCp > 0.4) {
        fatalOverdoseTriggered = true;
        fatalToxicityReason = "Colapso el\xE9trico por exposi\xE7\xE3o r\xE1pida a cloreto de pot\xE1ssio concentrado";
      }
      if (!isFullyDelivered || newCp > 1e-4 || newCe > 1e-4 || (pkCompartments?.rapidPeripheralAmountNormalized || 0) > 1e-4 || (pkCompartments?.deepPeripheralAmountNormalized || 0) > 1e-4 || (pkCompartments?.absorptionDepotAmountNormalized || 0) > 1e-4 || transitLagRemaining > 0 || priorTransitLag > 0 || bolusShockRemainingSec > 0 || dose.isCRI && dose.isInfusionRunning !== false && (dose.criRatePerKgMin || 0) > 0) {
        const updatedDose = {
          ...dose,
          deliveryElapsedSec: deliveryElapsed,
          transitLagRemainingSec: transitLagRemaining,
          isFullyDelivered,
          isFastBolusShockTriggered,
          bolusShockMagnitude: shockMagnitude,
          bolusShockRemainingSec,
          previousCp: dose.currentCp,
          previousCe: dose.currentCe,
          currentCp: newCp,
          currentCe: newCe,
          peakObservedCp: Math.max(dose.peakObservedCp || 0, newCp),
          peakObservedCe: Math.max(dose.peakObservedCe || 0, newCe),
          pkCompartments
        };
        updatedDoses.push(updatedDose);
        const significantCe = newCe >= 5e-3;
        if (significantCe) {
          if (!activeDrugEffects[drugDef.id]) {
            activeDrugEffects[drugDef.id] = { drugDef, Ce: newCe, Cp: newCp, bolusShockMagnitude: shockMagnitude, totalDoseAdministered: cumulativeDose };
          } else {
            activeDrugEffects[drugDef.id].Ce = Math.min(4, activeDrugEffects[drugDef.id].Ce + newCe);
            activeDrugEffects[drugDef.id].Cp = Math.min(4, activeDrugEffects[drugDef.id].Cp + newCp);
            activeDrugEffects[drugDef.id].bolusShockMagnitude = Math.max(activeDrugEffects[drugDef.id].bolusShockMagnitude, shockMagnitude);
            activeDrugEffects[drugDef.id].totalDoseAdministered = cumulativeDose;
          }
        }
      }
    }
    biologicalState = {
      ...biologicalState,
      biotransformation: BiotransformationEngine.step(
        dtSeconds,
        updatedDoses,
        biologicalState.biotransformation,
        biologicalState.organPerfusion.hepaticFraction,
        biologicalState.organPerfusion.renalFraction
      )
    };
    const baselineMinuteVentilation = Math.max(0.1, patient.baselineVitals.rr * patient.weightKg * 0.012);
    const priorMinuteVentilation = Math.max(0.05, previousVitals?.minuteVolumeL || baselineMinuteVentilation);
    const ventilationFactor = Math.max(0.25, Math.min(2, priorMinuteVentilation / baselineMinuteVentilation));
    const priorCardiacOutputRatioForGas = previousVitals ? previousVitals.cellularState.cardiacOutputLMin / Math.max(0.05, patient.weightKg * speciesConfig.cardiacOutputMlKgMin / 1e3) : 1;
    const inhalantStep = InhalantKineticsEngine.step(
      dtSeconds,
      patient,
      equipment,
      biologicalState.inhalant,
      ventilationFactor,
      priorCardiacOutputRatioForGas
    );
    biologicalState = { ...biologicalState, inhalant: inhalantStep.state };
    const inhalantCe = inhalantStep.state.vesselRichMac;
    const receptors = CellularReceptorsEngine.computeReceptorState(
      patient,
      updatedDoses,
      inhalantCe,
      equipment.vaporizerType,
      biologicalState.biotransformation.receptorAdaptiveFeedback
    );
    const prevMAP = previousVitals?.meanArterialPressure ?? patient.baselineVitals.map;
    const prevHR = previousVitals?.heartRate ?? patient.baselineVitals.hr;
    biologicalState = BiologicalStateEngine.stepRegulatorySystems(
      dtSeconds,
      patient,
      equipment,
      biologicalState,
      receptors,
      surgicalStimulusIntensity,
      previousVitals?.arterialBloodGases.paCO2 ?? patient.baselineVitals.etco2 + 4.5,
      previousVitals?.pulseOximetrySpO2 ?? patient.baselineVitals.spo2,
      prevMAP
    );
    biologicalState = stepAntimuscarinicSystems(dtSeconds, patient, biologicalState, receptors);
    const nitroprussideRateMcgKgMin = updatedDoses.filter((dose) => dose.drugId === "sodium_nitroprusside" && dose.isInfusionRunning !== false).reduce((sum, dose) => sum + Math.max(0, dose.criRatePerKgMin || 0), 0);
    const previousNitroprussideBurden = biologicalState.metabolic.nitroprussideToxicMetaboliteBurden || 0;
    const hepaticDetoxification = biologicalState.organPerfusion.hepaticFraction;
    const renalExcretion = biologicalState.organPerfusion.renalFraction;
    const metaboliteInputPerSecond = nitroprussideRateMcgKgMin / (16 * 3600 * 3);
    const metaboliteClearancePerSecond = previousNitroprussideBurden * (hepaticDetoxification * 0.55 + renalExcretion * 0.45) / (12 * 3600);
    biologicalState = {
      ...biologicalState,
      metabolic: {
        ...biologicalState.metabolic,
        nitroprussideToxicMetaboliteBurden: Math.max(0, Math.min(
          1,
          previousNitroprussideBurden + dtSeconds * (metaboliteInputPerSecond - metaboliteClearancePerSecond)
        ))
      }
    };
    const isRecumbent = biologicalState.neurological.hypnoticDepth > 0.28 || biologicalState.neurological.dissociativeDepth > 0.46 || biologicalState.neurological.motorCapacity < 0.75;
    const fluidDelivery = advanceFluidDelivery(dtSeconds, equipment, activeDoses, updatedDoses);
    const legacyFluidMl = Math.max(0, equipment.totalFluidsInfusedMl - biologicalState.fluids.lastObservedTotalInfusedMl);
    if (legacyFluidMl > 0) fluidDelivery.deliveries.push({ fluidName: equipment.activeFluidType, volumeMl: legacyFluidMl });
    const isAtropineActive = (activeDrugEffects["atropine"]?.Ce || 0) > 0.05;
    biologicalState = BiologicalStateEngine.stepSlowCompartments(
      dtSeconds,
      patient,
      equipment,
      biologicalState,
      isRecumbent,
      prevMAP,
      speciesConfig.criticalMapThresholdMmHg,
      speciesConfig.recumbencyPulmonaryShuntBasePct,
      fluidDelivery.deliveries
    );
    biologicalState.fluids.lastObservedTotalInfusedMl = fluidDelivery.totalFluidsInfusedMl;
    const speciesEval = SpeciesPhysiologyEngine.evaluateParticularities(
      patient,
      simTimeSeconds,
      prevMAP,
      receptors.alpha2Drive,
      receptors.muOpioidDrive,
      receptors.naVBlockade,
      receptors.volatileSiteOccupancy,
      isRecumbent,
      isAtropineActive,
      biologicalState.species.pulmonaryShuntPct,
      biologicalState.species.myopathyRisk,
      biologicalState.species.ruminalBloatSeverity
    );
    const orchestration = PhysiologicalOrchestrator.step(
      dtSeconds,
      patient,
      biologicalState,
      receptors,
      previousVitals
    );
    biologicalState = orchestration.state;
    const hemodynamics = HemodynamicCircuitEngine.stepHemodynamics(
      dtSeconds,
      simTimeSeconds,
      patient,
      receptors,
      equipment,
      resuscitation,
      isSurgicalStimulationActive,
      prevMAP,
      prevHR,
      ischemiaScore,
      speciesEval.ruminalBloatSeverity,
      biologicalState.fluids.effectiveCirculatingExpansionMl,
      previousCriticalTimers,
      previousVitals?.pulseOximetrySpO2 ?? patient.baselineVitals.spo2,
      previousVitals?.arterialBloodGases.lactate ?? patient.baselineVitals.lactateMmolL,
      previousVitals?.nociceptiveStressLevel ?? 0,
      biologicalState.neurological.nociceptiveInput,
      biologicalState.autonomic.catecholamineReserve,
      previousVitals?.biologicalState.organPerfusion.oxygenDeliveryMlKgMin ?? 20,
      orchestration.modifiers
    );
    ischemiaScore = hemodynamics.myocardialIschemiaScore;
    const cardiacOutputRatio = hemodynamics.cardiacOutputLMin / Math.max(0.1, patient.weightKg * speciesConfig.cardiacOutputMlKgMin / 1e3);
    const respiration = RespiratoryGasExchangeEngine.stepRespiration(
      dtSeconds,
      simTimeSeconds,
      patient,
      receptors,
      equipment,
      isSurgicalStimulationActive,
      previousVitals?.pulseOximetrySpO2 ?? patient.baselineVitals.spo2,
      previousVitals?.arterialBloodGases.paO2 ?? 98,
      previousVitals?.arterialBloodGases.paCO2 ?? patient.baselineVitals.etco2 + 4.5,
      hypoxiaSeconds,
      previousVitals?.arterialBloodGases.lactate ?? patient.baselineVitals.lactateMmolL,
      Math.min(65, speciesEval.shuntFractionPct + (biologicalState.fluids.pulmonaryEdemaSeverity ?? 0) * 35),
      speciesEval.ruminalBloatSeverity,
      cardiacOutputRatio,
      hemodynamics.meanArterialPressure,
      previousVitals?.respiratoryRate ?? patient.baselineVitals.rr,
      previousVitals?.etCO2 ?? patient.baselineVitals.etco2,
      hemodynamics.nociceptiveStressLevel,
      biologicalState.fluids.currentHematocritPct,
      biologicalState.respiratory.centralDrive,
      biologicalState.respiratory.neuromuscularCapacity,
      biologicalState.respiratory.alveolarRecruitment,
      orchestration.modifiers,
      biologicalState.organPerfusion,
      biologicalState.fluids.fluidBaseDeficitMmolL ?? 0
    );
    hypoxiaSeconds = respiration.hypoxiaSecondsAccumulated;
    biologicalState = BiologicalStateEngine.stepAirwayPressure(
      dtSeconds,
      biologicalState,
      respiration.currentAirwayPressureCmH2O
    );
    biologicalState = BiologicalStateEngine.stepMetabolism(
      dtSeconds,
      patient,
      biologicalState,
      receptors.alpha2Drive,
      receptors.beta1Drive,
      hemodynamics.nociceptiveStressLevel,
      respiration.pulseOximetrySpO2,
      hemodynamics.meanArterialPressure,
      cardiacOutputRatio,
      respiration.arterialBloodGases.paO2,
      orchestration.modifiers.cellularOxygenUtilizationFraction,
      orchestration.modifiers.hepaticPerfusionMultiplier,
      orchestration.modifiers.renalPerfusionMultiplier
    );
    let barotraumaCollapse = biologicalState.respiratory.highAirwayPressureSeconds >= 8;
    if (barotraumaCollapse) {
      barotraumaCollapse = true;
      fatalOverdoseTriggered = true;
      fatalToxicityReason = "Pneumot\xF3rax Hipertensivo / Barotrauma Pulmonar (V\xE1lvula APL fechada com sobrepress\xE3o sustentada)";
    }
    const isVentilatorActive = equipment.isVentilatorActive && equipment.ventilatorMode !== "spontaneous";
    const isIntubated = equipment.intubationStatus === "intubated_tracheal";
    const activeDrugInteractions = DynamicInteractionsEngine.evaluateDynamicInteractions(
      patient,
      receptors,
      isVentilatorActive,
      isIntubated,
      updatedDoses
    );
    let triggeredArrestNow = false;
    let achievedROSCNow = false;
    if (hemodynamics.isArrestTriggered && !isAlreadyArrested && !isAlreadyDead) {
      triggeredArrestNow = true;
      arrestType = hemodynamics.arrestType || "ventricular_fibrillation";
      arrestCause = hemodynamics.arrestCause;
    }
    if (fatalOverdoseTriggered && !isAlreadyArrested && !isAlreadyDead) {
      triggeredArrestNow = true;
      arrestType = fatalToxicityReason.includes("Fibrila\xE7\xE3o") ? "ventricular_fibrillation" : "asystole";
      arrestCause = fatalToxicityReason;
    }
    if (hypoxiaSeconds > (isPediatric ? 55 : 110) && !isAlreadyArrested && !isAlreadyDead) {
      triggeredArrestNow = true;
      arrestType = "asystole";
      arrestCause = `Parada Cardiorrespirat\xF3ria por An\xF3xia Mioc\xE1rdica Aguda (${Math.round(hypoxiaSeconds)}s em hip\xF3xia cr\xEDtica)`;
    }
    if (biologicalState.organPerfusion.cumulativeOxygenDebt > 0.92 && !isAlreadyArrested && !isAlreadyDead) {
      triggeredArrestNow = true;
      arrestType = "pea";
      arrestCause = "Parada por fal\xEAncia de entrega sist\xEAmica de oxig\xEAnio (baixo d\xE9bito/anemia/hipoxemia prolongados)";
    }
    if (triggeredArrestNow) {
      isAlreadyArrested = true;
    }
    if (isAlreadyArrested && !isAlreadyDead) {
      const hasEffectiveCompressions = resuscitation.isCPRActive && resuscitation.compressionsPerMin >= 80 && (resuscitation.compressionDepthQuality || 0.8) >= 0.45;
      const hasAirwayVentilation = Boolean(resuscitation.isCPRVentilationActive) || equipment.intubationStatus === "intubated_tracheal" && equipment.oxygenFlowLMin > 0.1 && (equipment.isVentilatorActive || Boolean(equipment.manualVentilationCadenceSeconds && equipment.manualVentilationCadenceSeconds > 0) || Boolean(equipment.isManualBreathTriggered) || simTimeSeconds - (equipment.manualBreathLastTriggerTime || 0) < 6);
      const hasInotropicVasoSupport = (activeDrugEffects["epinephrine"]?.Ce || 0) > 0.03 || (activeDrugEffects["norepinephrine"]?.Ce || 0) > 0.05 || (activeDrugEffects["ephedrine"]?.Ce || 0) > 0.06 || (activeDrugEffects["dobutamine"]?.Ce || 0) > 0.08;
      const isHypoxiaCorrected = respiration.pulseOximetrySpO2 >= 85 || respiration.arterialBloodGases.paO2 >= 60 || hasAirwayVentilation && hasEffectiveCompressions;
      const isLethalOverdoseReversed = !fatalOverdoseTriggered || (activeDrugEffects["naloxone"]?.Ce || 0) > 0.08 || (activeDrugEffects["atipamezole"]?.Ce || 0) > 0.08 || (activeDrugEffects["flumazenil"]?.Ce || 0) > 0.08 || (activeDrugEffects["lipid_emulsion_20"]?.Ce || 0) > 0.08;
      const minShockJoules = Math.max(4, Math.round(patient.weightKg * 1.5));
      const observedShockCount = resuscitation.shocksDeliveredCount ?? (resuscitation.lastShockDeliveredJoules ? 1 : 0);
      const isNewShock = observedShockCount > biologicalState.resuscitation.processedShockCount;
      const hasDeliveredAdequateShock = Boolean(
        isNewShock && resuscitation.lastShockDeliveredJoules && resuscitation.lastShockDeliveredJoules >= minShockJoules
      );
      const isDefibrillatedVF = (arrestType === "ventricular_fibrillation" || arrestType === "pulseless_ventricular_tachycardia") && hasDeliveredAdequateShock;
      biologicalState.resuscitation.processedShockCount = observedShockCount;
      const canAchieveROSC = hasEffectiveCompressions && hasAirwayVentilation && (hasInotropicVasoSupport || isHypoxiaCorrected || isDefibrillatedVF) && isLethalOverdoseReversed;
      const biologicalInhibition = Math.min(0.8, hypoxiaSeconds / 90 * 0.35 + (ischemiaScore > 0.55 ? (ischemiaScore - 0.55) * 0.75 : 0) + (respiration.arterialBloodGases.pH < 7.08 ? (7.08 - respiration.arterialBloodGases.pH) * 1.4 : 0));
      const compressionQuality = resuscitation.compressionDepthQuality || 0.8;
      const cpm = resuscitation.compressionsPerMin || 110;
      const rateEfficiency = cpm >= 100 && cpm <= 120 ? 1 : cpm >= 80 && cpm <= 140 ? 0.75 : 0.45;
      if (canAchieveROSC) {
        const supportGain = hasInotropicVasoSupport ? 0.45 : 0;
        const shockGain = isDefibrillatedVF ? 4.5 : 0;
        biologicalState.resuscitation.roscReadinessSeconds = Math.min(
          20,
          biologicalState.resuscitation.roscReadinessSeconds + dtSeconds * (0.6 + compressionQuality * rateEfficiency * 0.65 + supportGain) * (1 - biologicalInhibition) + shockGain
        );
      } else {
        biologicalState.resuscitation.roscReadinessSeconds = Math.max(
          0,
          biologicalState.resuscitation.roscReadinessSeconds - dtSeconds * 0.75
        );
      }
      const hasBiologicalReadiness = biologicalState.resuscitation.roscReadinessSeconds >= 7.5;
      if (canAchieveROSC && (cprSeconds >= 6 || hasInotropicVasoSupport || isDefibrillatedVF) && hasBiologicalReadiness) {
        achievedROSCNow = true;
        isAlreadyArrested = false;
        arrestCause = void 0;
        arrestType = void 0;
        asystoleSeconds = 0;
        cprSeconds = 0;
        hypoxiaSeconds = 0;
        ischemiaScore = 0.1;
        biologicalState.resuscitation.roscReadinessSeconds = 0;
        previousCriticalTimers.severeBradycardiaSeconds = 0;
        previousCriticalTimers.severeTachycardiaSeconds = 0;
        previousCriticalTimers.profoundHypotensionSeconds = 0;
        hemodynamics.criticalEventTimers.severeBradycardiaSeconds = 0;
        hemodynamics.criticalEventTimers.severeTachycardiaSeconds = 0;
        hemodynamics.criticalEventTimers.profoundHypotensionSeconds = 0;
      } else {
        if (resuscitation.isCPRActive) {
          cprSeconds += dtSeconds;
        } else {
          asystoleSeconds += dtSeconds;
        }
        const deathThresholdSec = isPediatric ? 120 : 210;
        if ((asystoleSeconds > deathThresholdSec || cprSeconds > 480 && asystoleSeconds > 90) && !isAlreadyDead) {
          isAlreadyDead = true;
          deathTime = simTimeSeconds;
          deathCause = arrestCause || "Morte Biol\xF3gica Irrevers\xEDvel por Parada Cardiorrespirat\xF3ria Refrat\xE1ria";
        }
      }
    } else {
      biologicalState.resuscitation.roscReadinessSeconds = 0;
      biologicalState.resuscitation.processedShockCount = resuscitation.shocksDeliveredCount ?? biologicalState.resuscitation.processedShockCount;
    }
    let impendingArrestWarning = void 0;
    if (!isAlreadyDead && !isAlreadyArrested) {
      if (hemodynamics.criticalEventTimers.profoundHypotensionSeconds >= 2.5) {
        const remaining = Math.max(1, Math.round(18 - hemodynamics.criticalEventTimers.profoundHypotensionSeconds));
        impendingArrestWarning = {
          type: "hypotension",
          headline: "COLAPSO CIRCULAT\xD3RIO IMINENTE \xB7 CHOQUE DESCOMPENSADO",
          details: `Press\xE3o Arterial M\xE9dia em n\xEDvel cr\xEDtico (${Math.round(hemodynamics.meanArterialPressure)} mmHg) h\xE1 ${Math.round(hemodynamics.criticalEventTimers.profoundHypotensionSeconds)}s. Risco de AESP em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: "Reduzir ou suspender inalat\xF3rio, infundir b\xF3lus vol\xEAmico e aplicar Efedrina (0.1 mg/kg) ou Adrenalina (0.01 mg/kg IV).",
          urgency: hemodynamics.criticalEventTimers.profoundHypotensionSeconds >= 9 ? "critical" : "warning"
        };
      } else if (hemodynamics.criticalEventTimers.severeBradycardiaSeconds >= 2.5) {
        const remaining = Math.max(1, Math.round(12 - hemodynamics.criticalEventTimers.severeBradycardiaSeconds));
        impendingArrestWarning = {
          type: "bradycardia",
          headline: "BRADICARDIA CR\xCDTICA EXTREMA \xB7 RISCO DE ASSISTOLIA",
          details: `Frequ\xEAncia Card\xEDaca em colapso (${Math.round(hemodynamics.heartRate)} bpm) h\xE1 ${Math.round(hemodynamics.criticalEventTimers.severeBradycardiaSeconds)}s. Risco de assistolia terminal em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: "Administrar Atropina 0.03 mg/kg IV; se houver agonista alfa-2 ativo, aplicar Atipamezol imediatamente.",
          urgency: hemodynamics.criticalEventTimers.severeBradycardiaSeconds >= 6 ? "critical" : "warning"
        };
      } else if (hemodynamics.criticalEventTimers.severeTachycardiaSeconds >= 2.5) {
        const remaining = Math.max(1, Math.round(10 - hemodynamics.criticalEventTimers.severeTachycardiaSeconds));
        impendingArrestWarning = {
          type: "tachycardia",
          headline: "TAQUICARDIA MALIGNA \xB7 RISCO DE FIBRILA\xC7\xC3O VENTRICULAR",
          details: `FC extrema (${Math.round(hemodynamics.heartRate)} bpm) com tempo diast\xF3lico insuficiente para enchimento coronariano. Risco de FV em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: "Aprofundar plano anest\xE9sico se superficial, suspender infus\xF5es adren\xE9rgicas ou titular Lidoca\xEDna.",
          urgency: "critical"
        };
      } else if (hemodynamics.myocardialIschemiaScore >= 0.38) {
        const remaining = Math.max(2, Math.round((0.75 - hemodynamics.myocardialIschemiaScore) * 80));
        impendingArrestWarning = {
          type: "ischemia",
          headline: "ISQUEMIA MIOC\xC1RDICA GRAVE \xB7 RISCO DE FIBRILA\xC7\xC3O VENTRICULAR",
          details: `Desbalan\xE7o grave de MVO\u2082 (${Math.round(hemodynamics.myocardialIschemiaScore * 100)}% de isquemia). Risco iminente de Fibrila\xE7\xE3o Ventricular!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: "Se associado Alfa-2 + Atropina, aplicar Atipamezol imediatamente; otimizar oxigena\xE7\xE3o e reduzir consumo mioc\xE1rdico.",
          urgency: hemodynamics.myocardialIschemiaScore >= 0.58 ? "critical" : "warning"
        };
      } else if (hypoxiaSeconds >= 25 && respiration.pulseOximetrySpO2 < 82) {
        const deathSec = isPediatric ? 55 : 110;
        const remaining = Math.max(1, Math.round(deathSec - hypoxiaSeconds));
        impendingArrestWarning = {
          type: "hypoxia",
          headline: "HIP\xD3XIA TECIDUAL CR\xCDTICA \xB7 RISCO DE PCR AN\xD3XICA",
          details: `SpO\u2082 (${Math.round(respiration.pulseOximetrySpO2)}%) e PaO\u2082 (${Math.round(respiration.arterialBloodGases.paO2)} mmHg) cr\xEDticos h\xE1 ${Math.round(hypoxiaSeconds)}s. Risco de parada an\xF3xica em ~${remaining}s!`,
          secondsRemainingEstimate: remaining,
          recommendedAction: "Verificar via a\xE9rea, ventilar com 100% O\u2082 e aumentar fluxo de oxig\xEAnio.",
          urgency: hypoxiaSeconds >= (isPediatric ? 35 : 65) ? "critical" : "warning"
        };
      }
    }
    const gCl = receptors.gabaAChlorideConductance;
    const gabaHypnosis = Math.max(0, Math.min(1, (gCl - 0.08) / 1.1));
    const generalHypnosis = Math.max(
      biologicalState.neurological.hypnoticDepth,
      gabaHypnosis,
      receptors.hypnoticEffect
    );
    const dissociation = biologicalState.neurological.dissociativeDepth;
    const sedation = biologicalState.neurological.sedativeDepth;
    let anestheticDepthScore = Math.round(Math.min(100, Math.max(
      generalHypnosis * 100,
      gabaHypnosis * 100,
      receptors.hypnoticEffect * 100,
      receptors.dissociativeEffect * 82,
      receptors.centralSedation * 68
    )));
    let consciousnessScore = Math.round(biologicalState.neurological.corticalArousalPct);
    let guedelStage = "Est\xE1gio I (Consciente / Alerta)";
    let eyePosition = "central_light";
    let palpebralReflex = "brisk";
    let cornealReflex = "brisk";
    let jawTone = "rigid";
    let pedalReflex = "brisk";
    let surgicalTolerancePct = 0;
    const analgesiaPct = Math.round(receptors.nociceptiveInhibition * 100);
    if (isAlreadyDead || isAlreadyArrested) {
      consciousnessScore = 0;
      guedelStage = "Est\xE1gio IV (Depress\xE3o Bulbar / Parada)";
      eyePosition = "central_deep_dilated";
      palpebralReflex = "absent";
      cornealReflex = "absent";
      jawTone = "flaccid";
      pedalReflex = "absent";
      surgicalTolerancePct = 100;
    } else if (dissociation > 0.34 && dissociation > generalHypnosis + 0.08) {
      consciousnessScore = Math.max(4, Math.round(100 * (1 - Math.min(0.96, dissociation * 1.25)) * (1 - sedation * 0.35)));
      guedelStage = "Anestesia Dissociativa (Reflexos Preservados)";
      eyePosition = "central_light";
      palpebralReflex = dissociation > 0.72 ? "sluggish" : "moderate";
      cornealReflex = "brisk";
      jawTone = receptors.muscleRelaxation > 0.48 ? "moderate" : "rigid";
      pedalReflex = analgesiaPct > 75 ? "sluggish" : "moderate";
      surgicalTolerancePct = Math.round(Math.min(90, analgesiaPct * 0.72 + dissociation * 28));
    } else if (generalHypnosis >= 0.94 || gCl >= 2.8) {
      consciousnessScore = 0;
      guedelStage = "Est\xE1gio IV (Depress\xE3o Bulbar / Parada)";
      eyePosition = "central_deep_dilated";
      palpebralReflex = "absent";
      cornealReflex = "absent";
      jawTone = "flaccid";
      pedalReflex = "absent";
      surgicalTolerancePct = 100;
    } else if (generalHypnosis >= 0.78) {
      consciousnessScore = 0;
      guedelStage = "Est\xE1gio III Plano 3 (Profundo)";
      eyePosition = "central_deep_dilated";
      palpebralReflex = "absent";
      cornealReflex = "sluggish";
      jawTone = "flaccid";
      pedalReflex = "absent";
      surgicalTolerancePct = Math.round(Math.min(100, 88 + analgesiaPct * 0.12));
    } else if (generalHypnosis >= 0.5) {
      consciousnessScore = 0;
      guedelStage = "Est\xE1gio III Plano 2 (Cir\xFArgico)";
      eyePosition = "ventromedial_surgical";
      palpebralReflex = "absent";
      cornealReflex = "moderate";
      jawTone = receptors.propofolSiteOccupancy > 0.38 || receptors.muscleRelaxation > 0.65 ? "flaccid" : "relaxed_surgical";
      pedalReflex = analgesiaPct > 35 ? "absent" : "sluggish";
      surgicalTolerancePct = Math.round(Math.min(100, 72 + analgesiaPct * 0.28));
    } else if (generalHypnosis >= 0.36) {
      consciousnessScore = Math.max(5, Math.round(48 - (generalHypnosis - 0.36) * 155));
      guedelStage = "Est\xE1gio III Plano 1 (Leve)";
      eyePosition = "ventromedial_surgical";
      palpebralReflex = "sluggish";
      cornealReflex = "brisk";
      jawTone = receptors.muscleRelaxation > 0.38 ? "relaxed_surgical" : "moderate";
      pedalReflex = analgesiaPct > 65 ? "absent" : "sluggish";
      surgicalTolerancePct = Math.round(Math.min(82, 48 + analgesiaPct * 0.34));
    } else if (generalHypnosis >= 0.22) {
      consciousnessScore = Math.max(32, Math.round(68 - generalHypnosis * 85 - sedation * 20));
      guedelStage = "Est\xE1gio II (Excita\xE7\xE3o/Del\xEDrio)";
      eyePosition = "central_light";
      palpebralReflex = "moderate";
      cornealReflex = "brisk";
      jawTone = receptors.muscleRelaxation > 0.3 ? "moderate" : "rigid";
      pedalReflex = analgesiaPct > 60 ? "moderate" : "brisk";
      surgicalTolerancePct = Math.round(Math.min(55, 18 + analgesiaPct * 0.36));
    } else if (sedation >= 0.38 || sedation >= 0.2 && analgesiaPct >= 40 || receptors.alpha2Drive > 0.3) {
      consciousnessScore = Math.max(8, Math.round(100 - sedation * 90 - generalHypnosis * 55 - analgesiaPct * 0.22));
      guedelStage = "Est\xE1gio I (Seda\xE7\xE3o Profunda / Neuroleptanalgesia)";
      eyePosition = "central_light";
      palpebralReflex = sedation > 0.6 ? "sluggish" : "moderate";
      cornealReflex = "brisk";
      jawTone = receptors.muscleRelaxation > 0.3 ? "relaxed_surgical" : "moderate";
      pedalReflex = analgesiaPct > 50 ? "sluggish" : "moderate";
      surgicalTolerancePct = Math.round(Math.min(92, 35 + sedation * 42 + analgesiaPct * 0.45));
    } else if (sedation >= 0.1 || receptors.bzdAllostericOccupancy >= 0.08 || generalHypnosis >= 0.08) {
      consciousnessScore = Math.max(35, Math.round(100 - sedation * 70 - generalHypnosis * 55));
      guedelStage = "Est\xE1gio I (Seda\xE7\xE3o Leve / Abatimento)";
      eyePosition = "central_light";
      palpebralReflex = "brisk";
      cornealReflex = "brisk";
      jawTone = receptors.muscleRelaxation > 0.24 ? "moderate" : "rigid";
      pedalReflex = analgesiaPct > 65 ? "moderate" : "brisk";
      surgicalTolerancePct = Math.round(Math.min(50, analgesiaPct * 0.38 + generalHypnosis * 15 + sedation * 18));
    } else {
      consciousnessScore = 100;
      guedelStage = "Est\xE1gio I (Consciente / Alerta)";
      eyePosition = "central_light";
      palpebralReflex = "brisk";
      cornealReflex = "brisk";
      jawTone = "rigid";
      pedalReflex = receptors.localNeuralBlockade > 0.45 ? "absent" : analgesiaPct > 65 ? "moderate" : "brisk";
      if (receptors.localNeuralBlockade > 0.35) {
        surgicalTolerancePct = Math.round(Math.min(95, 45 + receptors.localNeuralBlockade * 45 + analgesiaPct * 0.15));
      } else {
        surgicalTolerancePct = Math.round(Math.min(45, analgesiaPct * 0.45));
      }
    }
    const activePainStress = hemodynamics.nociceptiveStressLevel;
    if (activePainStress > 0.05 && !isAlreadyDead && !isAlreadyArrested) {
      if (activePainStress > 0.4) {
        pedalReflex = generalHypnosis >= 0.56 ? "sluggish" : "brisk";
        if (consciousnessScore < 60 && consciousnessScore > 15) {
          consciousnessScore = Math.min(75, consciousnessScore + 12);
        }
      } else if (activePainStress > 0.15) {
        pedalReflex = generalHypnosis >= 0.56 ? analgesiaPct > 40 ? "absent" : "sluggish" : "moderate";
      } else {
        pedalReflex = analgesiaPct > 50 || generalHypnosis > 0.4 ? "absent" : "sluggish";
      }
    }
    if (!isAlreadyDead && !isAlreadyArrested && receptors.nmOccupancy > 0.4) {
      jawTone = receptors.nmOccupancy > 0.8 ? "flaccid" : "relaxed_surgical";
      pedalReflex = "absent";
      palpebralReflex = receptors.nmOccupancy > 0.75 ? "absent" : "sluggish";
    }
    if (!isAlreadyDead && !isAlreadyArrested) {
      consciousnessScore = Math.round(Math.max(
        0,
        Math.min(consciousnessScore, biologicalState.neurological.corticalArousalPct)
      ));
    }
    const painScore = Number(Math.min(
      10,
      biologicalState.neurological.nociceptiveInput * 8 + biologicalState.neurological.centralSensitization * 2
    ).toFixed(1));
    const activityLevelPct = Math.round(Math.max(0, Math.min(
      140,
      biologicalState.neurological.motorCapacity * (0.05 + consciousnessScore / 100 * 0.95) * (1 + biologicalState.neurological.excitationDrive * 0.55) * 100
    )));
    let mmColor = "pink";
    let crt = "1 - 2s (normal)";
    if (isAlreadyDead || isAlreadyArrested) {
      mmColor = "gray_moribund";
      crt = "absent";
    } else if (respiration.pulseOximetrySpO2 < 78) {
      mmColor = "cyanotic";
      crt = "> 3s (poor perfusion)";
    } else if (hemodynamics.meanArterialPressure < 45 || respiration.arterialBloodGases.hematocritPct < 20 || patient.pathologyConditions.hypovolemiaSeverity) {
      mmColor = "pale";
      crt = "> 3s (poor perfusion)";
    } else if (patient.pathologyConditions.sepsisVasodilation) {
      mmColor = "brick_red";
      crt = "< 1s (hyperdynamic)";
    } else if (receptors.alpha2Drive > 0.35) {
      mmColor = "pale";
      crt = "2 - 3s (sluggish)";
    }
    const tofCount = receptors.nmOccupancy > 0.85 ? 0 : receptors.nmOccupancy > 0.4 ? 2 : 4;
    let tempC = previousVitals?.bodyTemperatureC ?? patient.baselineVitals.tempC;
    const thermalLossRate = patient.weightKg < 2 ? 11e-4 : patient.weightKg < 8 ? 5e-4 : 2e-4;
    const thermoregulatorySuppression = 1 + receptors.centralSedation * 0.45 + receptors.hypnoticEffect * 0.85 + Math.max(0, receptors.cAMPVascular - 1) * 0.25;
    tempC -= thermalLossRate * thermoregulatorySuppression * dtSeconds;
    if (equipment.warmingBlanketActive) {
      tempC = Math.min(38.8, tempC + 7e-4 * dtSeconds);
    }
    const deliveredFluidMl = biologicalState.fluids.lastDeliveryMl ?? 0;
    const fluidTemp = equipment.fluidTemperatureC ?? 22;
    tempC += (fluidTemp - tempC) * (1 - Math.exp(-deliveredFluidMl / Math.max(1, patient.weightKg * 830)));
    let deathDetailedSummary;
    if (isAlreadyDead) {
      let reversalAggravationEvent;
      const atipamezoleActive = (activeDrugEffects["atipamezole"]?.Ce || 0) > 0.04;
      const naloxoneActive = (activeDrugEffects["naloxone"]?.Ce || 0) > 0.04;
      if (atipamezoleActive && (hemodynamics.meanArterialPressure < 35 || (patient.pathologyConditions.hypovolemiaSeverity || 0) > 0.65)) {
        reversalAggravationEvent = "Colapso Circulat\xF3rio Fulminante precipitado por Atipamezol em choque hipovol\xEAmico/vasomotor: a perda s\xFAbita do t\xF4nus vascular perif\xE9rico residual extinguiu o retorno venoso e a perfus\xE3o coronariana.";
      } else if (naloxoneActive && isSurgicalStimulationActive && hemodynamics.myocardialIschemiaScore > 0.38) {
        reversalAggravationEvent = "Arritmia Letal / Isquemia Transmural precipitada por Naloxona em estresse nociceptivo cir\xFArgico: descarga simp\xE1tica end\xF3gena maci\xE7a com consumo mioc\xE1rdico de O2 (MVO2) insustent\xE1vel.";
      }
      const hadCompressions = resuscitation.isCPRActive || cprSeconds > 10;
      const hadVentilation = Boolean(resuscitation.isCPRVentilationActive) || equipment.intubationStatus === "intubated_tracheal";
      const wasShockable = arrestType === "ventricular_fibrillation" || arrestType === "pulseless_ventricular_tachycardia";
      const hadShock = Boolean(resuscitation.lastShockDeliveredJoules && resuscitation.lastShockDeliveredJoules > 0);
      const hadInotrope = (activeDrugEffects["epinephrine"]?.Ce || 0) > 0.02 || (activeDrugEffects["ephedrine"]?.Ce || 0) > 0.04;
      const preventabilityOpportunities = [];
      if (!hadCompressions) {
        preventabilityOpportunities.push("Compress\xF5es tor\xE1cicas imediatas e de alta qualidade (100-120/min com recuo total do t\xF3rax) n\xE3o foram estabelecidas precocemente.");
      }
      if (!hadVentilation) {
        preventabilityOpportunities.push("Ventila\xE7\xE3o assistida com 100% de Oxig\xEAnio (10 rpm, tempo inspirat\xF3rio de 1s) n\xE3o foi institu\xEDda para revers\xE3o da hip\xF3xia.");
      }
      if (wasShockable && !hadShock) {
        preventabilityOpportunities.push("Desfibrila\xE7\xE3o el\xE9trica precoce (2 a 4 J/kg) n\xE3o foi disparada para ritmo choc\xE1vel (Fibrila\xE7\xE3o Ventricular / TVSP).");
      }
      if (!hadInotrope && cprSeconds > 100) {
        preventabilityOpportunities.push("Suporte vasopressor/inotr\xF3pico (Adrenalina 0.01 mg/kg ou Efedrina) n\xE3o foi administrado em ciclo avan\xE7ado de RCP.");
      }
      if (reversalAggravationEvent) {
        preventabilityOpportunities.push("A revers\xE3o de MPA (alfa-2 ou opioide) deve ser cautelosa ou precedida de ressuscita\xE7\xE3o vol\xEAmica quando houver choque descompensado ativo.");
      }
      const wasResuscitationExemplary = preventabilityOpportunities.length === 0 && hadCompressions && hadVentilation;
      let inevitabilityStatement;
      if (wasResuscitationExemplary) {
        inevitabilityStatement = "Todas as manobras e interven\xE7\xF5es de ressuscita\xE7\xE3o foram realizadas de acordo com as diretrizes internacionais (RECOVER) de forma correta e oportuna, contudo a gravidade da condi\xE7\xE3o cl\xEDnica subjacente, o esgotamento bioenerg\xE9tico e a an\xF3xia celular tornaram o \xF3bito biologicamente inevit\xE1vel.";
      }
      deathDetailedSummary = {
        primaryCause: deathCause || "Parada Cardiorrespirat\xF3ria Refrat\xE1ria",
        contributingFactors: [
          `Esp\xE9cie: ${patient.species.toUpperCase()} (${patient.weightKg} kg) \xB7 Classifica\xE7\xE3o ASA ${patient.asa}`,
          speciesEval.particularities.filter((p) => p.isActive).map((p) => `${p.name}: ${p.clinicalImpact}`).join(" | "),
          activeDrugInteractions.map((i) => `${i.title} (${i.severity.toUpperCase()})`).join(", "),
          hypoxiaSeconds > 25 ? `Exposi\xE7\xE3o a Hip\xF3xia Cr\xEDtica por ${Math.round(hypoxiaSeconds)} segundos` : "",
          ischemiaScore > 0.4 ? `Isquemia Mioc\xE1rdica Transmural Severa (${(ischemiaScore * 100).toFixed(0)}%)` : "",
          reversalAggravationEvent || ""
        ].filter(Boolean),
        chronology: [
          `Procedimento cir\xFArgico: ${patient.surgicalProcedure} em ${patient.name}`,
          respiration.isRespiratoryArrest ? `Apneia detectada: ${respiration.respiratoryArrestCause}` : "",
          arrestCause ? `Parada Cardiorrespirat\xF3ria: ${arrestCause}` : "",
          hadCompressions ? `Manobras de Ressuscita\xE7\xE3o CPCR (Compress\xF5es ativas por ${Math.round(cprSeconds)}s)` : "Sem compress\xF5es tor\xE1cicas registradas",
          asystoleSeconds > 0 ? `Per\xEDodo em colapso/assistolia: ${Math.round(asystoleSeconds)}s` : "",
          `Declara\xE7\xE3o de \xD3bito Encef\xE1lico e Cardiopulmonar Irrevers\xEDvel`
        ].filter(Boolean),
        autopsyFindings: [
          `Gasometria Terminal: pH ${respiration.arterialBloodGases.pH.toFixed(2)}, PaCO2 ${respiration.arterialBloodGases.paCO2.toFixed(1)} mmHg, Lactato ${respiration.arterialBloodGases.lactate.toFixed(2)} mmol/L`,
          `\xCDndice Isqu\xEAmico Card\xEDaco: ${(ischemiaScore * 100).toFixed(0)}%`,
          `Cianose/palidez profunda com tempo de enchimento capilar ausente`,
          `Pupilas em midr\xEDase paral\xEDtica fixa bilateral e aus\xEAncia de reflexo corneal`
        ],
        wasResuscitationExemplary,
        inevitabilityStatement,
        preventabilityOpportunities: preventabilityOpportunities.length > 0 ? preventabilityOpportunities : void 0,
        reversalAggravationEvent
      };
    }
    let finalHR = hemodynamics.heartRate;
    let finalMAP = hemodynamics.meanArterialPressure;
    let finalSysBP = hemodynamics.systolicBP;
    let finalDiaBP = hemodynamics.diastolicBP;
    let finalRhythm = hemodynamics.cardiacRhythm;
    let finalRR = respiration.respiratoryRate;
    let finalSpO2 = respiration.pulseOximetrySpO2;
    let finalEtCO2 = respiration.etCO2;
    let pulseQuality = hemodynamics.pulseQuality;
    let capnogramType = respiration.capnogramType;
    if (isAlreadyDead) {
      finalHR = 0;
      finalMAP = 0;
      finalSysBP = 0;
      finalDiaBP = 0;
      finalRR = 0;
      finalSpO2 = 0;
      finalEtCO2 = 0;
      finalRhythm = "asystole";
      pulseQuality = "Ausente";
      capnogramType = "cardiac_arrest_flat";
    } else if (achievedROSCNow) {
      finalHR = Math.round(speciesInfo.normalVitals.hrTypical * 1.15);
      finalMAP = Math.round(speciesInfo.normalVitals.mapTypical * 0.95);
      finalSysBP = finalMAP + 25;
      finalDiaBP = Math.max(20, finalMAP - 15);
      finalRhythm = "sinus_tachycardia";
      pulseQuality = "Forte e Cheio";
      const lactateWashout = (respiration.arterialBloodGases.lactate || 2) * 1.1;
      finalEtCO2 = Math.min(56, Math.max(38, Math.round(respiration.etCO2 + 16 + lactateWashout)));
      capnogramType = "normal";
    } else if (isAlreadyArrested) {
      if (resuscitation.isCPRActive) {
        const cpm = resuscitation.compressionsPerMin || 110;
        finalHR = cpm;
        const rateFactor = cpm >= 100 && cpm <= 120 ? 1 : cpm < 100 ? Math.max(0.35, cpm / 100) : Math.max(0.55, 1 - (cpm - 120) * 0.012);
        const depthQuality = Math.max(0.25, Math.min(1.1, resuscitation.compressionDepthQuality || 0.8));
        const expectedVol = Math.max(1, patient.weightKg * speciesInfo.bloodVolumeMlPerKg);
        const effectiveVol = Math.max(0.3, 1 - (patient.pathologyConditions.hypovolemiaSeverity || 0) * 0.45 + (biologicalState.fluids.effectiveCirculatingExpansionMl || 0) / expectedVol);
        const volFactor = Math.max(0.35, Math.min(1.15, effectiveVol));
        const epiCe = activeDrugEffects["epinephrine"]?.Ce || 0;
        const norepiCe = activeDrugEffects["norepinephrine"]?.Ce || 0;
        const vasoCe = activeDrugEffects["vasopressin"]?.Ce || 0;
        const ephedrineCe = activeDrugEffects["ephedrine"]?.Ce || 0;
        const vasoToneBoost = 1 + Math.min(0.95, epiCe * 1.6 + norepiCe * 1.2 + vasoCe * 1.5 + ephedrineCe * 0.8);
        const cprMAP = 22 * rateFactor * depthQuality * volFactor * vasoToneBoost;
        finalMAP = Math.max(6, Math.round(cprMAP));
        const diastolicFraction = 0.65 * (0.75 + 0.35 * (vasoToneBoost - 1));
        finalDiaBP = Math.max(4, Math.round(cprMAP * diastolicFraction));
        finalSysBP = Math.max(finalDiaBP + 8, Math.round(cprMAP + 18 * depthQuality * volFactor));
        finalRhythm = arrestType === "ventricular_fibrillation" ? "ventricular_fibrillation" : arrestType === "pulseless_ventricular_tachycardia" ? "ventricular_tachycardia" : arrestType === "pea" ? "pulseless_electrical_activity" : "asystole";
        pulseQuality = finalMAP >= 30 ? "Fraco / Filiforme" : "Ausente";
        const hasVent = Boolean(resuscitation.isCPRVentilationActive) || equipment.intubationStatus === "intubated_tracheal" && equipment.oxygenFlowLMin > 0.1;
        if (hasVent) {
          finalEtCO2 = Math.max(4, Math.round(18 * rateFactor * depthQuality * volFactor * (0.85 + 0.3 * (vasoToneBoost - 1))));
          capnogramType = "normal";
        } else {
          finalEtCO2 = 0;
          capnogramType = "cardiac_arrest_flat";
        }
      } else {
        finalHR = 0;
        finalMAP = 0;
        finalSysBP = 0;
        finalDiaBP = 0;
        finalRR = 0;
        finalSpO2 = 0;
        finalEtCO2 = 0;
        finalRhythm = arrestType === "ventricular_fibrillation" ? "ventricular_fibrillation" : arrestType === "pulseless_ventricular_tachycardia" ? "ventricular_tachycardia" : "asystole";
        pulseQuality = "Ausente";
        capnogramType = "cardiac_arrest_flat";
      }
    }
    const cellularState = {
      hemodynamicDrivers: hemodynamics.drivers,
      cAMPMyocardial: Number(receptors.cAMPMyocardial.toFixed(2)),
      cAMPVascular: Number(receptors.cAMPVascular.toFixed(2)),
      intracellularCalcium: Number(receptors.intracellularCalcium.toFixed(2)),
      chlorideConductanceGabaA: Number(receptors.gabaAChlorideConductance.toFixed(2)),
      nociceptiveInhibition: Number(receptors.nociceptiveInhibition.toFixed(2)),
      nmbaReceptorBlockade: Number(receptors.nmOccupancy.toFixed(2)),
      centralSedation: Number(receptors.centralSedation.toFixed(3)),
      hypnoticEffect: Number(receptors.hypnoticEffect.toFixed(3)),
      dissociativeEffect: Number(receptors.dissociativeEffect.toFixed(3)),
      muscleRelaxation: Number(receptors.muscleRelaxation.toFixed(3)),
      respiratoryDepression: Number(receptors.respiratoryDepression.toFixed(3)),
      macSparingFraction: Number(receptors.macSparingFraction.toFixed(3)),
      volatileAnestheticMac: Number(inhalantCe.toFixed(4)),
      localNeuralBlockade: Number(receptors.localNeuralBlockade.toFixed(3)),
      systemicNaVBlockade: Number(receptors.naVBlockade.toFixed(3)),
      electrolyteCardiotoxicity: Number(receptors.hyperkalemicCardiotoxicity.toFixed(3)),
      antiarrhythmicIbProtection: Number(receptors.antiarrhythmicIbProtection.toFixed(3)),
      cardiacOutputLMin: hemodynamics.cardiacOutputLMin,
      strokeVolumeMl: hemodynamics.strokeVolumeMl,
      systemicVascularResistanceDyne: hemodynamics.systemicVascularResistanceDyne,
      inotropicStateEmax: hemodynamics.inotropicStateEmax,
      baroreceptorGain: hemodynamics.baroreceptorGain,
      baroreceptorVagalTone: hemodynamics.baroreceptorVagalTone,
      pulmonaryShuntFractionPct: Number(speciesEval.shuntFractionPct.toFixed(1)),
      dependentMyopathyRisk: Number(speciesEval.myopathyIschemiaRiskScore.toFixed(3)),
      speciesParticularities: speciesEval.particularities
    };
    const vitals = {
      heartRate: finalHR,
      cardiacRhythm: finalRhythm,
      systolicBP: finalSysBP,
      diastolicBP: finalDiaBP,
      meanArterialPressure: finalMAP,
      pulseOximetrySpO2: finalSpO2,
      respiratoryRate: finalRR,
      tidalVolumeMl: respiration.tidalVolumeMl,
      minuteVolumeL: respiration.minuteVolumeL,
      respiratoryPattern: respiration.respiratoryPattern,
      etCO2: finalEtCO2,
      fiCO2: respiration.fiCO2,
      capnogramType,
      bodyTemperatureC: Number(tempC.toFixed(4)),
      arterialBloodGases: {
        ...respiration.arterialBloodGases,
        glucoseMgDl: Number(biologicalState.metabolic.bloodGlucoseMgDl.toFixed(1))
      },
      consciousnessScore,
      activityLevelPct,
      painScore,
      anestheticDepthScore,
      guedelStage,
      eyePosition,
      palpebralReflex,
      cornealReflex,
      jawTone,
      pedalReflex,
      surgicalTolerancePct: Math.round(surgicalTolerancePct),
      nociceptiveStressLevel: hemodynamics.nociceptiveStressLevel,
      trainOfFourCount: tofCount,
      mucousMembraneColor: mmColor,
      capillaryRefillTime: crt,
      pulseQuality,
      perfusionIndex: Number(Math.max(
        0,
        finalMAP / 85 * (finalSpO2 / 100) * Math.min(1.2, respiration.arterialBloodGases.hematocritPct / Math.max(20, patient.baselineVitals.hctPct))
      ).toFixed(2)),
      // Organ Failures & Arrest States
      isRespiratoryArrest: respiration.isRespiratoryArrest,
      isSpontaneousApnea: respiration.isSpontaneousApnea,
      respiratoryArrestCause: respiration.isSpontaneousApnea ? respiration.respiratoryArrestCause : void 0,
      isCardiacArrest: isAlreadyArrested,
      isChestCompressionPulse: isAlreadyArrested && resuscitation.isCPRActive,
      cardiacArrestCause: arrestCause,
      cardiacArrestType: arrestType,
      isDead: isAlreadyDead,
      deathTimeSeconds: deathTime,
      deathCause,
      deathDetailedSummary,
      asystoleSecondsElapsed: Math.round(asystoleSeconds),
      cprSecondsElapsed: Math.round(cprSeconds),
      activeDrugInteractions,
      activePhysiologicalSignals: orchestration.signals.map((signal) => ({
        id: signal.id,
        source: signal.source,
        targets: signal.targets,
        topology: signal.topology,
        severity: signal.severity,
        label: signal.label
      })),
      myocardialIschemiaScore: Number(ischemiaScore.toFixed(5)),
      hypoxiaExposureSeconds: Number(hypoxiaSeconds.toFixed(3)),
      severeAcidosisRisk: respiration.arterialBloodGases.pH < 7.15,
      barotraumaCollapse,
      felineLidocaineToxicity: patient.species === "feline" && (receptors.naVBlockade > 0.25 || fatalToxicityReason.includes("Lidoca\xEDna")),
      bovineBloatRespiratoryRestriction: patient.species === "bovine" && speciesEval.ruminalBloatSeverity > 0.4,
      criticalEventTimers: hemodynamics.criticalEventTimers,
      impendingArrestWarning,
      cellularState,
      biologicalState
    };
    return {
      vitals,
      updatedDoses,
      equipmentUpdates: {
        sodaLimeExhaustionPct: respiration.sodaLimeExhaustionPct,
        currentAirwayPressureCmH2O: respiration.currentAirwayPressureCmH2O,
        totalFluidsInfusedMl: fluidDelivery.totalFluidsInfusedMl,
        fluidBoluses: fluidDelivery.fluidBoluses,
        isManualBreathTriggered: false,
        manualBreathLastTriggerTime: equipment.isManualBreathTriggered ? simTimeSeconds : equipment.manualBreathLastTriggerTime
      }
    };
  }
};

// src/validation/simulationHarness.ts
var VALIDATION_WEIGHTS_KG = {
  canine: 20,
  feline: 4.5,
  equine: 500,
  bovine: 500
};
function createHealthyValidationPatient(species) {
  const profile = SPECIES_DATABASE[species];
  const weightKg = VALIDATION_WEIGHTS_KG[species];
  const normal = profile.normalVitals;
  return {
    id: `validation-${species}`,
    name: `Controle ${profile.namePt}`,
    species,
    breed: "Paciente padronizado",
    ageYears: species === "equine" || species === "bovine" ? 6 : 3,
    ageMonths: 0,
    weightKg,
    gender: "Indeterminado",
    asa: "I",
    scenarioTitle: "Valida\xE7\xE3o farmacol\xF3gica controlada",
    scenarioDescription: "Paciente h\xEDgido e padronizado para compara\xE7\xE3o pareada do motor.",
    clinicalHistory: "Sem comorbidades modeladas.",
    surgicalProcedure: "Nenhum procedimento",
    baselineVitals: {
      hr: normal.hrTypical,
      rr: normal.rrTypical,
      sysBP: Math.round((normal.sysBpMin + normal.sysBpMax) / 2),
      diaBP: Math.round((normal.diaBpMin + normal.diaBpMax) / 2),
      map: normal.mapTypical,
      tempC: normal.tempTypicalC,
      spo2: normal.spo2Normal,
      etco2: normal.etco2Typical,
      bloodVolumeMl: weightKg * profile.bloodVolumeMlPerKg,
      hctPct: species === "equine" || species === "bovine" ? 35 : 42,
      potassiumMeqL: 4.2,
      lactateMmolL: 1.2
    },
    pathologyConditions: {}
  };
}
function createDefaultEquipment(patient, overrides = {}) {
  const species = SPECIES_DATABASE[patient.species] || SPECIES_DATABASE.canine;
  const base = {
    oxygenFlowLMin: 1.5,
    nitrousOxideFlowLMin: 0,
    vaporizerType: "isoflurane",
    vaporizerDialPct: 0,
    isVaporizerOn: false,
    circuitType: "circle_rebreathing_adult",
    sodaLimeExhaustionPct: 5,
    aplValveState: "open",
    reservoirBagVolumeMl: 1e3,
    isOxygenFlushActive: false,
    intubationStatus: "unintubated",
    tubeSizeMm: 8.5,
    cuffPressureCmH2O: 0,
    ventilatorMode: "spontaneous",
    isVentilatorActive: false,
    ventilatorSettings: {
      rateBpm: species.normalVitals.rrTypical,
      tidalVolumeMl: Math.round(patient.weightKg * 12),
      peepCmH2O: 0,
      ieRatio: "1:2",
      pipPressureLimitCmH2O: 18,
      inspiratoryPausePct: 10
    },
    currentAirwayPressureCmH2O: 0,
    activeFluidType: "Ringer com Lactato (LRS)",
    fluidRateMlPerHour: 0,
    totalFluidsInfusedMl: 0,
    isFluidPumpRunning: false,
    warmingBlanketActive: false,
    warmingBlanketTempC: 38.5
  };
  return {
    ...base,
    ...overrides,
    ventilatorSettings: {
      ...base.ventilatorSettings,
      ...overrides.ventilatorSettings || {}
    }
  };
}
function createDefaultResuscitation() {
  return {
    isCPRActive: false,
    compressionsPerMin: 110,
    lastCompressionSimTime: 0,
    compressionDepthQuality: 0.8,
    defibrillatorChargedJoules: 0,
    isDefibrillatorArmed: false
  };
}
function createSimulationState(patient, equipment = createDefaultEquipment(patient)) {
  const resuscitation = createDefaultResuscitation();
  const initial = PKPDEngine.stepSimulation(
    0.1,
    0,
    patient,
    [],
    equipment,
    resuscitation,
    false
  );
  return {
    patient,
    equipment: { ...equipment, ...initial.equipmentUpdates },
    resuscitation,
    timeSeconds: 0,
    vitals: initial.vitals,
    doses: [],
    frames: [{ timeSeconds: 0, vitals: initial.vitals, doses: [] }]
  };
}

// src/engine/alarmPatterns.ts
function getAlarmPattern(profile, priority) {
  const high = priority === "critical";
  const traditional = profile === "traditional";
  return {
    // Traditional red/yellow intervals follow Philips PIC iX, chapter 6.
    repeatSeconds: traditional ? high ? 1 : 2 : high ? 8 : 10,
    offsets: traditional ? [0] : high ? [0, 0.25, 0.5, 0.9, 1.15, 3.3, 3.55, 3.8, 4.2, 4.45] : [0, 0.45, 0.9],
    duration: traditional ? high ? 0.22 : 0.3 : high ? 0.15 : 0.25,
    frequency: traditional ? high ? 880 : 440 : high ? 528 : 440,
    // A voiced alarm speaker, distinct from the short QRS buzzer. Sum = 1.
    harmonics: [0.42, 0.28, 0.18, 0.12],
    attack: 0.012,
    release: 0.025,
    amplitude: high ? 0.24 : 0.17
  };
}

// src/engine/audioSynthesizer.ts
var AudioSynthesizer = class {
  static {
    this.audioCtx = null;
  }
  static {
    this.soundProfile = "mindray";
  }
  static {
    this.isPulseMuted = false;
  }
  static {
    this.isAlarmsMuted = false;
  }
  static {
    this.silenceRemainingSec = 0;
  }
  static {
    this.lastAlarmTriggerTimestamp = -Infinity;
  }
  static {
    this.lastPriority = "normal";
  }
  static {
    this.alarmProfile = "iec";
  }
  static {
    this.isAlarmPreview = false;
  }
  static stopAlarmPreview() {
    if (this.isAlarmPreview) this.stopAlarmPlayback();
  }
  static {
    this.alarmVoices = /* @__PURE__ */ new Set();
  }
  static getAlarmProfile() {
    return this.alarmProfile;
  }
  static setAlarmProfile(profile) {
    this.stopAlarmPlayback();
    this.alarmProfile = profile;
  }
  static stopAlarmPlayback() {
    this.isAlarmPreview = false;
    for (const { osc, gain } of this.alarmVoices) {
      gain.disconnect();
      try {
        osc.stop();
      } catch {
      }
      osc.disconnect();
    }
    this.alarmVoices.clear();
    this.lastAlarmTriggerTimestamp = -Infinity;
    this.lastPriority = "normal";
  }
  static {
    this.masterVolume = 0.85;
  }
  static {
    this.pulseVolume = 0.65;
  }
  static {
    this.alarmVolume = 0.8;
  }
  static {
    this.isChargingPlaying = false;
  }
  static getContext() {
    if (typeof window === "undefined") return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {
        });
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }
  // ---------------------------------------------------------------------------
  // PROFILE & VOLUME CONTROLS
  // ---------------------------------------------------------------------------
  static setSoundProfile(profile) {
    this.soundProfile = profile;
  }
  static getSoundProfile() {
    return this.soundProfile;
  }
  static setPulseMuted(muted) {
    this.isPulseMuted = muted;
  }
  static getIsPulseMuted() {
    return this.isPulseMuted;
  }
  static setMuted(muted) {
    this.isPulseMuted = muted;
  }
  static getIsMuted() {
    return this.isPulseMuted;
  }
  static toggleAlarmsSilence(durationSec = 120) {
    if (this.silenceRemainingSec > 0) {
      this.silenceRemainingSec = 0;
      this.stopAlarmPlayback();
      return false;
    } else {
      this.stopAlarmPlayback();
      this.silenceRemainingSec = durationSec;
      return true;
    }
  }
  static getAlarmSilenceRemainingSec() {
    return Math.ceil(this.silenceRemainingSec);
  }
  static setMasterVolume(vol) {
    this.stopAlarmPlayback();
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }
  static getMasterVolume() {
    return this.masterVolume;
  }
  static setPulseVolume(vol) {
    this.pulseVolume = Math.max(0, Math.min(1, vol));
  }
  static getPulseVolume() {
    return this.pulseVolume;
  }
  static setAlarmVolume(vol) {
    this.stopAlarmPlayback();
    this.alarmVolume = Math.max(0, Math.min(1, vol));
  }
  static getAlarmVolume() {
    return this.alarmVolume;
  }
  // ---------------------------------------------------------------------------
  // FREQUENCY MAPPING: REAL CLINICAL SPO2 SCALE
  // ---------------------------------------------------------------------------
  static getSpo2Frequency(spo2Pct) {
    const clamped = Math.max(50, Math.min(100, spo2Pct));
    if (clamped >= 99) return 980;
    if (clamped >= 97) return 920;
    if (clamped >= 94) return 860;
    if (clamped >= 91) return 800;
    if (clamped >= 88) return 730;
    if (clamped >= 85) return 660;
    if (clamped >= 82) return 590;
    if (clamped >= 78) return 520;
    if (clamped >= 74) return 460;
    if (clamped >= 68) return 400;
    if (clamped >= 60) return 350;
    return 300;
  }
  // ---------------------------------------------------------------------------
  // 1. O AUTÊNTICO BIP DE PULSO CIRÚRGICO (QRS / SpO2)
  // ---------------------------------------------------------------------------
  /**
   * Produces the genuine electronic piezo beep of operating room monitors:
   * Short 50ms duration, instant digital onset, bandpass aperture resonance.
   */
  static playPulseBeep(spo2Pct, isPvc = false) {
    if (this.isPulseMuted || this.masterVolume <= 0 || this.pulseVolume <= 0) return;
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== "running") return;
      const now = ctx.currentTime;
      let freq = this.getSpo2Frequency(spo2Pct);
      if (isPvc) {
        freq *= 0.76;
      }
      const duration = isPvc ? 0.042 : 0.05;
      const amplitude = 0.17 * this.pulseVolume * this.masterVolume;
      this.synthesizeBuzzerBeep(ctx, freq, now, duration, amplitude, this.soundProfile);
    } catch {
    }
  }
  static playHighPriorityAlarm() {
    return this.playAlarm("critical");
  }
  static playMediumPriorityAlarm() {
    return this.playAlarm("warning");
  }
  /** Legacy API: arrest uses the high-priority alarm, not a continuous flatline. */
  static playContinuousAsystoleTone(_durationSec = 2.2) {
    return this.playHighPriorityAlarm();
  }
  static playAlarm(priority, preview = true) {
    if (this.isAlarmsMuted || this.silenceRemainingSec > 0 || this.masterVolume <= 0 || this.alarmVolume <= 0) return false;
    const ctx = this.getContext();
    if (!ctx || ctx.state !== "running") return false;
    this.stopAlarmPlayback();
    this.isAlarmPreview = preview;
    const pattern = getAlarmPattern(this.alarmProfile, priority);
    const now = ctx.currentTime;
    try {
      for (const offset of pattern.offsets) {
        const start = now + offset;
        pattern.harmonics.forEach((weight, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const voice = { osc, gain };
          this.alarmVoices.add(voice);
          osc.type = "sine";
          osc.frequency.setValueAtTime(pattern.frequency * (index + 1), start);
          const amplitude = pattern.amplitude * weight * this.masterVolume * this.alarmVolume;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(amplitude, start + pattern.attack);
          gain.gain.setValueAtTime(amplitude, start + pattern.duration - pattern.release);
          gain.gain.linearRampToValueAtTime(0, start + pattern.duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
            this.alarmVoices.delete(voice);
          };
          osc.start(start);
          osc.stop(start + pattern.duration + 5e-3);
        });
      }
      return true;
    } catch {
      this.stopAlarmPlayback();
      return false;
    }
  }
  // ---------------------------------------------------------------------------
  // 5. MOTOR DE SÍNTESE ACÚSTICA DO BUZZER PIEZOELÉTRICO DO MONITOR
  // ---------------------------------------------------------------------------
  /**
   * Physically simulates the acoustic transfer function of a ceramic piezo disc
   * inside a plastic patient monitor enclosure.
   */
  static synthesizeBuzzerBeep(ctx, freq, startTime, duration, amplitude, profile) {
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const bandpass = ctx.createBiquadFilter();
    const chassisResonance = ctx.createBiquadFilter();
    if (profile === "dixtal_contec" || profile === "contec_cms") {
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime);
      bandpass.type = "lowpass";
      bandpass.frequency.setValueAtTime(3200, startTime);
      osc.connect(bandpass);
      bandpass.connect(gainNode);
    } else if (profile === "philips_gold" || profile === "philips") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(freq * 2, startTime);
      bandpass.type = "lowpass";
      bandpass.frequency.setValueAtTime(2600, startTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(amplitude * 0.25, startTime);
      osc.connect(bandpass);
      subOsc.connect(subGain);
      bandpass.connect(gainNode);
      subGain.connect(gainNode);
      subOsc.start(startTime);
      subOsc.stop(startTime + duration + 0.02);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime);
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(freq, startTime);
      bandpass.Q.setValueAtTime(1.6, startTime);
      chassisResonance.type = "peaking";
      chassisResonance.frequency.setValueAtTime(2850, startTime);
      chassisResonance.Q.setValueAtTime(2.5, startTime);
      chassisResonance.gain.setValueAtTime(7, startTime);
      osc.connect(bandpass);
      bandpass.connect(chassisResonance);
      chassisResonance.connect(gainNode);
    }
    gainNode.gain.setValueAtTime(1e-4, startTime);
    gainNode.gain.linearRampToValueAtTime(amplitude, startTime + 15e-4);
    gainNode.gain.setValueAtTime(amplitude, startTime + duration - 5e-3);
    gainNode.gain.exponentialRampToValueAtTime(1e-4, startTime + duration);
    gainNode.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
  // ---------------------------------------------------------------------------
  // 6. DESFIBRILADOR (Carga & Disparo Realista)
  // ---------------------------------------------------------------------------
  static playDefibrillatorCharging() {
    if (this.masterVolume <= 0) return;
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== "running") return;
      this.isChargingPlaying = true;
      const now = ctx.currentTime;
      const duration = 1.4;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(1650, now + duration);
      const effectiveGain = this.masterVolume * 0.08;
      gain.gain.setValueAtTime(1e-4, now);
      gain.gain.linearRampToValueAtTime(effectiveGain, now + 0.04);
      gain.gain.setValueAtTime(effectiveGain, now + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
      setTimeout(() => {
        if (!this.isChargingPlaying) return;
        this.playDefibrillatorReadyChime();
      }, 1420);
    } catch {
    }
  }
  static playDefibrillatorReadyChime() {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== "running") return;
      const now = ctx.currentTime;
      const chimeFreq = 1450;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(chimeFreq, now);
      gain.gain.setValueAtTime(0.08 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(1e-4, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
    }
  }
  static playDefibrillatorShock() {
    this.isChargingPlaying = false;
    if (this.masterVolume <= 0) return;
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== "running") return;
      const now = ctx.currentTime;
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = "square";
      clickOsc.frequency.setValueAtTime(1200, now);
      clickGain.gain.setValueAtTime(0.22 * this.masterVolume, now);
      clickGain.gain.exponentialRampToValueAtTime(1e-4, now + 0.025);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.03);
      const thumpOsc = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thumpOsc.type = "sawtooth";
      thumpOsc.frequency.setValueAtTime(140, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
      thumpGain.gain.setValueAtTime(0.35 * this.masterVolume, now);
      thumpGain.gain.exponentialRampToValueAtTime(1e-4, now + 0.38);
      thumpOsc.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.4);
    } catch {
    }
  }
  // ---------------------------------------------------------------------------
  // 7. MONITOR ALARM EVALUATION & CADENCE SCHEDULER
  // ---------------------------------------------------------------------------
  static evaluateAndTriggerAlarms(vitals, alarmLimits, dtSeconds) {
    if (this.silenceRemainingSec > 0) {
      this.silenceRemainingSec = Math.max(0, this.silenceRemainingSec - dtSeconds);
    }
    if (vitals.isDead) {
      this.stopAlarmPlayback();
      return {
        severity: "normal",
        message: null,
        isSilenced: this.silenceRemainingSec > 0,
        silenceRemainingSec: Math.ceil(this.silenceRemainingSec),
        isPulseMuted: this.isPulseMuted,
        activeProfile: this.soundProfile
      };
    }
    let isCritical = false;
    let criticalMessage = null;
    if (vitals.isCardiacArrest) {
      isCritical = true;
      if (vitals.cardiacRhythm === "asystole") {
        criticalMessage = "ASSISTOLIA (PCR)";
      } else if (vitals.cardiacRhythm === "ventricular_fibrillation") {
        criticalMessage = "FIBRILA\xC7\xC3O VENTRICULAR (CHOC\xC1VEL)";
      } else {
        criticalMessage = "PARADA CARDIORRESPIRAT\xD3RIA (PCR)";
      }
    } else if (vitals.impendingArrestWarning) {
      isCritical = true;
      criticalMessage = `COLAPSO IMINENTE (~${vitals.impendingArrestWarning.secondsRemainingEstimate}s)`;
    } else if (vitals.isRespiratoryArrest) {
      isCritical = true;
      criticalMessage = "APNEIA / PARADA RESPIRAT\xD3RIA";
    } else if (vitals.pulseOximetrySpO2 > 0 && vitals.pulseOximetrySpO2 < 85) {
      isCritical = true;
      criticalMessage = `DESATURA\xC7\xC3O CR\xCDTICA (SpO2 ${vitals.pulseOximetrySpO2.toFixed(0)}%)`;
    } else if (vitals.heartRate > 0 && vitals.heartRate < 35) {
      isCritical = true;
      criticalMessage = `BRADICARDIA SEVERA (${vitals.heartRate.toFixed(0)} bpm)`;
    } else if (vitals.heartRate > 205) {
      isCritical = true;
      criticalMessage = `TAQUICARDIA EXTREMA (${vitals.heartRate.toFixed(0)} bpm)`;
    } else if (vitals.meanArterialPressure > 0 && vitals.meanArterialPressure < 45) {
      isCritical = true;
      criticalMessage = `HIPOTENS\xC3O CR\xCDTICA (PAM ${vitals.meanArterialPressure.toFixed(0)} mmHg)`;
    }
    let isWarning = false;
    let warningMessage = null;
    if (!isCritical) {
      if (vitals.pulseOximetrySpO2 > 0 && vitals.pulseOximetrySpO2 < alarmLimits.spo2Low) {
        isWarning = true;
        warningMessage = `HIP\xD3XIA (SpO2 ${vitals.pulseOximetrySpO2.toFixed(0)}%)`;
      } else if (vitals.heartRate < alarmLimits.hrLow) {
        isWarning = true;
        warningMessage = `BRADICARDIA (${vitals.heartRate.toFixed(0)} bpm)`;
      } else if (vitals.heartRate > alarmLimits.hrHigh) {
        isWarning = true;
        warningMessage = `TAQUICARDIA (${vitals.heartRate.toFixed(0)} bpm)`;
      } else if (vitals.meanArterialPressure < alarmLimits.mapLow) {
        isWarning = true;
        warningMessage = `HIPOTENS\xC3O (PAM ${vitals.meanArterialPressure.toFixed(0)} mmHg)`;
      } else if (vitals.meanArterialPressure > alarmLimits.mapHigh) {
        isWarning = true;
        warningMessage = `HIPERTENS\xC3O (PAM ${vitals.meanArterialPressure.toFixed(0)} mmHg)`;
      } else if (vitals.etCO2 < alarmLimits.etco2Low) {
        isWarning = true;
        warningMessage = `HIPOCAPNIA (EtCO2 ${vitals.etCO2.toFixed(0)} mmHg)`;
      } else if (vitals.etCO2 > alarmLimits.etco2High) {
        isWarning = true;
        warningMessage = `HIPERCAPNIA (EtCO2 ${vitals.etCO2.toFixed(0)} mmHg)`;
      } else if (vitals.bodyTemperatureC < alarmLimits.tempLow) {
        isWarning = true;
        warningMessage = `HIPOTERMIA (${vitals.bodyTemperatureC.toFixed(1)} \xB0C)`;
      } else if (vitals.bodyTemperatureC > alarmLimits.tempHigh) {
        isWarning = true;
        warningMessage = `HIPERTERMIA (${vitals.bodyTemperatureC.toFixed(1)} \xB0C)`;
      }
    }
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const isSilenced = this.silenceRemainingSec > 0;
    const priority = isCritical ? "critical" : isWarning ? "warning" : "normal";
    if (priority === "normal" || isSilenced) {
      if (!this.isAlarmPreview || isSilenced) this.stopAlarmPlayback();
    } else {
      const interval = getAlarmPattern(this.alarmProfile, priority).repeatSeconds * 1e3;
      if (priority !== this.lastPriority || nowMs - this.lastAlarmTriggerTimestamp >= interval) {
        if (this.playAlarm(priority, false)) {
          this.lastAlarmTriggerTimestamp = nowMs;
          this.lastPriority = priority;
        }
      }
    }
    return {
      severity: isCritical ? "critical" : isWarning ? "warning" : "normal",
      message: isCritical ? criticalMessage : isWarning ? warningMessage : null,
      isSilenced,
      silenceRemainingSec: Math.ceil(this.silenceRemainingSec),
      isPulseMuted: this.isPulseMuted,
      activeProfile: this.soundProfile
    };
  }
};
if (typeof window !== "undefined") {
  const unlock = () => {
    AudioSynthesizer.getContext();
    window.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("click", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

// tests/audioSynthesizer.test.ts
function createMockVitals(overrides = {}) {
  return {
    ...createSimulationState(createHealthyValidationPatient("canine")).vitals,
    ...overrides
  };
}
var defaultLimits = {
  hrLow: 50,
  hrHigh: 160,
  mapLow: 60,
  mapHigh: 120,
  spo2Low: 94,
  etco2Low: 30,
  etco2High: 50,
  tempLow: 36.5,
  tempHigh: 39.5,
  isAudioMuted: false
};
(0, import_node_test.describe)("Sons do Monitor & Alarmes M\xE9dicos IEC 60601-1-8", () => {
  (0, import_node_test.it)("par\xE2metros normais resultam em alarme desligado (normal)", () => {
    const vitals = createMockVitals();
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    import_strict.default.equal(status.severity, "normal");
    import_strict.default.equal(status.message, null);
  });
  (0, import_node_test.it)("hip\xF3xia severa (SpO2 < 85%) dispara alarme de Alta Prioridade (cr\xEDtico)", () => {
    const vitals = createMockVitals({ pulseOximetrySpO2: 82 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    import_strict.default.equal(status.severity, "critical");
    import_strict.default.ok(status.message?.includes("DESATURA\xC7\xC3O CR\xCDTICA"));
  });
  (0, import_node_test.it)("parada card\xEDaca ativa (PCR) dispara alarme de Alta Prioridade imediato", () => {
    const vitals = createMockVitals({
      isCardiacArrest: true,
      cardiacRhythm: "ventricular_fibrillation"
    });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    import_strict.default.equal(status.severity, "critical");
    import_strict.default.ok(status.message?.includes("FIBRILA\xC7\xC3O VENTRICULAR"));
  });
  (0, import_node_test.it)("parada respirat\xF3ria (apneia) dispara alarme de Alta Prioridade", () => {
    const vitals = createMockVitals({ isRespiratoryArrest: true });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    import_strict.default.equal(status.severity, "critical");
    import_strict.default.ok(status.message?.includes("APNEIA"));
  });
  (0, import_node_test.it)("taquicardia fora dos limites (FC > hrHigh) dispara alarme de M\xE9dia Prioridade (warning)", () => {
    const vitals = createMockVitals({ heartRate: 185 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    import_strict.default.equal(status.severity, "warning");
    import_strict.default.ok(status.message?.includes("TAQUICARDIA"));
  });
  (0, import_node_test.it)("hipotens\xE3o fora dos limites (PAM < mapLow) dispara alarme de M\xE9dia Prioridade", () => {
    const vitals = createMockVitals({ meanArterialPressure: 52 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 0.1);
    import_strict.default.equal(status.severity, "warning");
    import_strict.default.ok(status.message?.includes("HIPOTENS\xC3O"));
  });
  (0, import_node_test.it)("pausar alarme por 120s silencia os apitos e decrementa tempo restante", () => {
    const paused = AudioSynthesizer.toggleAlarmsSilence(120);
    import_strict.default.equal(paused, true);
    import_strict.default.equal(AudioSynthesizer.getAlarmSilenceRemainingSec(), 120);
    const vitals = createMockVitals({ heartRate: 190 });
    const status = AudioSynthesizer.evaluateAndTriggerAlarms(vitals, defaultLimits, 2);
    import_strict.default.equal(status.isSilenced, true);
    import_strict.default.equal(status.silenceRemainingSec, 118);
    const unpaused = AudioSynthesizer.toggleAlarmsSilence();
    import_strict.default.equal(unpaused, false);
    import_strict.default.equal(AudioSynthesizer.getAlarmSilenceRemainingSec(), 0);
  });
  (0, import_node_test.it)("suporta altern\xE2ncia de perfis ac\xFAsticos (Mindray & Dixtal, Contec CMS, Philips)", () => {
    AudioSynthesizer.setSoundProfile("mindray_dixtal");
    import_strict.default.equal(AudioSynthesizer.getSoundProfile(), "mindray_dixtal");
    AudioSynthesizer.setSoundProfile("contec_cms");
    import_strict.default.equal(AudioSynthesizer.getSoundProfile(), "contec_cms");
    AudioSynthesizer.setSoundProfile("philips_gold");
    import_strict.default.equal(AudioSynthesizer.getSoundProfile(), "philips_gold");
  });
  (0, import_node_test.it)("escala de frequ\xEAncias SpO2 decresce com a hip\xF3xia", () => {
    const freq100 = AudioSynthesizer.getSpo2Frequency(100);
    const freq95 = AudioSynthesizer.getSpo2Frequency(95);
    const freq90 = AudioSynthesizer.getSpo2Frequency(90);
    const freq85 = AudioSynthesizer.getSpo2Frequency(85);
    const freq70 = AudioSynthesizer.getSpo2Frequency(70);
    import_strict.default.equal(freq100, 980);
    import_strict.default.ok(freq95 < freq100);
    import_strict.default.ok(freq90 < freq95);
    import_strict.default.ok(freq85 < freq90);
    import_strict.default.ok(freq70 < freq85);
  });
  (0, import_node_test.it)("m\xE9todos de \xE1udio executam com seguran\xE7a e sem erros em ambiente headless", () => {
    import_strict.default.doesNotThrow(() => {
      ["mindray_dixtal", "contec_cms", "philips_gold", "philips", "mindray", "midi_bell"].forEach((profile) => {
        AudioSynthesizer.setSoundProfile(profile);
        AudioSynthesizer.playPulseBeep(98);
        AudioSynthesizer.playPulseBeep(85, true);
        AudioSynthesizer.playPulseBeep(65);
        AudioSynthesizer.playHighPriorityAlarm();
        AudioSynthesizer.playMediumPriorityAlarm();
        AudioSynthesizer.playContinuousAsystoleTone(0.5);
      });
      AudioSynthesizer.playDefibrillatorCharging();
      AudioSynthesizer.playDefibrillatorShock();
    });
  });
});
(0, import_node_test.describe)("Cad\xEAncia e execu\xE7\xE3o dos alertas", () => {
  (0, import_node_test.it)("separa grupos cr\xEDticos por 2 s e reserva intervalo sem sobreposi\xE7\xE3o", () => {
    for (const priority of ["critical", "warning"]) {
      const pattern = getAlarmPattern("iec", priority);
      import_strict.default.equal(pattern.offsets.length, priority === "critical" ? 10 : 3);
      import_strict.default.ok(pattern.offsets.at(-1) + pattern.duration < pattern.repeatSeconds);
      import_strict.default.ok(pattern.attack + pattern.release < pattern.duration);
    }
    const high = getAlarmPattern("iec", "critical");
    import_strict.default.ok(Math.abs(high.offsets[5] - high.offsets[4] - high.duration - 2) < 1e-9);
    import_strict.default.equal(getAlarmPattern("traditional", "critical").repeatSeconds, 1);
    import_strict.default.equal(getAlarmPattern("traditional", "warning").repeatSeconds, 2);
    import_strict.default.ok(getAlarmPattern("traditional", "critical").frequency > getAlarmPattern("traditional", "warning").frequency);
  });
  (0, import_node_test.it)("agenda harm\xF4nicos, prioriza PCR, cancela sons futuros e preserva perfil de pulso", () => {
    const oscillators = [];
    const gains = [];
    const parameter = () => ({ setValueAtTime() {
    }, linearRampToValueAtTime() {
    } });
    const ctx = {
      state: "running",
      currentTime: 10,
      destination: {},
      createOscillator() {
        const osc = {
          type: "",
          frequency: parameter(),
          starts: [],
          stops: [],
          connect() {
          },
          disconnect() {
          },
          onended: null,
          start(time) {
            this.starts.push(time);
          },
          stop(time) {
            this.stops.push(time);
          }
        };
        oscillators.push(osc);
        return osc;
      },
      createGain() {
        const gain = { gain: parameter(), disconnected: false, connect() {
        }, disconnect() {
          this.disconnected = true;
        } };
        gains.push(gain);
        return gain;
      }
    };
    const original = AudioSynthesizer.getContext;
    AudioSynthesizer.getContext = () => ctx;
    try {
      AudioSynthesizer.stopAlarmPlayback();
      AudioSynthesizer.setSoundProfile("contec_cms");
      AudioSynthesizer.setAlarmProfile("iec");
      import_strict.default.equal(AudioSynthesizer.getSoundProfile(), "contec_cms");
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ heartRate: 185 }), defaultLimits, 0.1);
      import_strict.default.equal(oscillators.length, 12);
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ heartRate: 185 }), defaultLimits, 5);
      import_strict.default.equal(oscillators.length, 12, "simulated time does not accelerate cadence");
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ isCardiacArrest: true, cardiacRhythm: "asystole" }), defaultLimits, 0.1);
      import_strict.default.equal(oscillators.length, 52, "critical immediately replaces warning with ten pulses");
      import_strict.default.ok(gains.slice(0, 12).every((g) => g.disconnected));
      import_strict.default.equal(oscillators.at(-1).starts[0], 14.45);
      AudioSynthesizer.toggleAlarmsSilence();
      import_strict.default.ok(gains.every((g) => g.disconnected));
      import_strict.default.ok(oscillators.every((o) => o.stops.includes(void 0)), "future oscillators cancelled too");
      AudioSynthesizer.playHighPriorityAlarm();
      import_strict.default.equal(oscillators.length, 52, "silence also blocks previews");
      AudioSynthesizer.toggleAlarmsSilence();
      AudioSynthesizer.playHighPriorityAlarm();
      AudioSynthesizer.stopAlarmPreview();
      import_strict.default.ok(gains.every((g) => g.disconnected));
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals({ heartRate: 185 }), defaultLimits, 0.1);
      AudioSynthesizer.evaluateAndTriggerAlarms(createMockVitals(), defaultLimits, 0.1);
      import_strict.default.ok(gains.every((g) => g.disconnected), "normal values cancel active warning");
    } finally {
      AudioSynthesizer.stopAlarmPlayback();
      AudioSynthesizer.getContext = original;
      AudioSynthesizer.setSoundProfile("mindray");
    }
  });
});
