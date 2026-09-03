import {
  ActiveDrugDose,
  DrugDefinition,
  PatientProfile,
} from '../types/simulator';
import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';
import { getRoutePharmacokinetics, getSpeciesDoseRange } from './drugAdministration';

export interface ReceptorStateSnapshot {
  // Normalized receptor drives. Negative values represent functional antagonism.
  alpha1Drive: number;
  alpha2Drive: number;
  beta1Drive: number;
  beta2Drive: number;
  m2Drive: number;
  m3Drive: number;
  dopamineD2Drive: number;
  histamineH1Drive: number;
  serotonin2Drive: number;
  nmOccupancy: number;

  // GABA-A and central-state axes
  gabaAChlorideConductance: number;
  bzdAllostericOccupancy: number;
  propofolSiteOccupancy: number;
  neurosteroidSiteOccupancy: number;
  volatileSiteOccupancy: number;
  volatileMacExposure: number;
  centralSedation: number;
  hypnoticEffect: number;
  dissociativeEffect: number;
  muscleRelaxation: number;
  respiratoryDepression: number;
  macSparingFraction: number;

  // Opioid, nociception and ion-channel systems
  muOpioidDrive: number;
  kappaOpioidDrive: number;
  nmdaBlockade: number;
  naVBlockade: number;
  localNeuralBlockade: number;
  caVBlockade: number;
  acheInhibition: number;
  nociceptiveInhibition: number;

  // Integrated calibrated organ-level effects from the catalog
  directHeartRateEffect: number;
  directBloodPressureEffect: number;
  acuteBolusHypotension: number;
  acuteBolusRespiratoryDepression: number;
  acuteBolusBradycardia: number;
  acuteBolusArrhythmia: number;
  histamineRelease: number;

  // Supportive therapies / biochemical interventions
  volumeExpansion: number;
  oxygenCarryingSupport: number;
  potassiumLoad: number;
  calciumMembraneStabilization: number;
  alkalinization: number;
  hyperkalemicCardiotoxicity: number;
  antiarrhythmicIbProtection: number;

  // Intracellular second messengers
  cAMPMyocardial: number;
  cAMPVascular: number;
  intracellularCalcium: number;

  reversalCe: {
    atipamezole: number;
    naloxone: number;
    flumazenil: number;
    sugammadex: number;
    neostigmine: number;
    lipidEmulsion: number;
  };
}

interface AggregatedExposure {
  drugDef: DrugDefinition;
  totalCe: number;
  systemicCe: number;
  centralCe: number;
  localCe: number;
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

// These agents express their clinical benefit only by removing a matching
// pharmacological burden. Their catalog vectors describe the net bedside
// observation, not an independent sedative/respiratory/pressor effect. Applying
// both the target-specific mechanism and those vectors would double-count the
// reversal and could make an antidote stimulate an otherwise normal patient.
const TARGET_DEPENDENT_REVERSAL_IDS = new Set([
  'atipamezole',
  'naloxone',
  'flumazenil',
  'neostigmine',
  'sugammadex',
  'lipid_emulsion_20',
]);

/** Saturable Emax/Hill response for normalized effect-site exposure. */
export function hillResponse(exposure: number, ec50 = 0.45, hill = 1.35): number {
  const ce = Math.max(0, exposure);
  if (ce === 0) return 0;
  const numerator = Math.pow(ce, hill);
  return numerator / (Math.pow(Math.max(0.0001, ec50), hill) + numerator);
}

/** Bliss-independent combination avoids impossible linear receptor/effect growth. */
const combineEffects = (effects: number[]): number => {
  let remaining = 1;
  for (const effect of effects) remaining *= 1 - clamp(effect);
  return clamp(1 - remaining);
};

export class CellularReceptorsEngine {
  /**
   * Integrates saturable target occupancy, competitive reversal and separate
   * sedation, hypnosis, analgesia, dissociation and motor-block axes.
   */
  public static computeReceptorState(
    patient: PatientProfile,
    activeDoses: ActiveDrugDose[],
    inhalantCe: number,
    _inhalantAgent: 'isoflurane' | 'sevoflurane'
  ): ReceptorStateSnapshot {
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;
    const exposures = new Map<string, AggregatedExposure>();

    for (const dose of activeDoses) {
      const drugDef = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
      if (!drugDef || dose.currentCe <= 0.00001) continue;
      if (!getSpeciesDoseRange(drugDef, patient.species)) continue;
      const route = getRoutePharmacokinetics(drugDef, dose.route);
      const current = exposures.get(drugDef.id) || {
        drugDef,
        totalCe: 0,
        systemicCe: 0,
        centralCe: 0,
        localCe: 0,
      };
      current.totalCe += dose.currentCe;
      current.systemicCe += dose.currentCe * route.systemicEffectFraction;
      current.localCe += dose.currentCe * route.localNeuralEffectFraction;
      // Neuraxial opioids retain a strong spinal effect with limited systemic exposure.
      const neuraxialOpioidFactor = dose.route === 'Epidural' && drugDef.specialTraits?.isOpioid ? 0.7 : 0;
      current.centralCe += dose.currentCe * Math.max(route.systemicEffectFraction, neuraxialOpioidFactor);
      exposures.set(drugDef.id, current);
    }

    const ceFor = (id: string): number => exposures.get(id)?.totalCe || 0;
    const atipamezoleCe = ceFor('atipamezole');
    const naloxoneCe = ceFor('naloxone');
    const flumazenilCe = ceFor('flumazenil');
    const sugammadexCe = ceFor('sugammadex');
    const neostigmineCe = ceFor('neostigmine');
    const lipidEmulsionCe = ceFor('lipid_emulsion_20');

    // Competitive antagonist shifts. Concentrations are normalized to a usual dose.
    const alpha2SchildFactor = 1 + 7 * hillResponse(atipamezoleCe, 0.3, 1.2);
    const muSchildFactor = 1 + 8 * hillResponse(naloxoneCe, 0.25, 1.2);
    const kappaSchildFactor = 1 + 3 * hillResponse(naloxoneCe, 0.35, 1.2);
    const bzdSchildFactor = 1 + 8 * hillResponse(flumazenilCe, 0.25, 1.2);
    const lipidSinkReduction = 1 - 0.9 * hillResponse(lipidEmulsionCe, 0.35, 1.2);

    let rawAlpha1 = 0;
    let rawAlpha2 = 0;
    let rawBeta1 = 0;
    let rawBeta2 = 0;
    let rawM2 = 0;
    let rawM3 = 0;
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

    const sedationEffects: number[] = [];
    const hypnoticEffects: number[] = [];
    const dissociativeEffects: number[] = [];
    const relaxationEffects: number[] = [];
    const respiratoryDepressants: number[] = [];
    const respiratoryStimulants: number[] = [];
    const analgesicEffects: number[] = [];
    const macSparingEffects: number[] = [];
    let rigidityDrive = 0;
    let arousalDrive = 0;
    let directHeartRateEffect = 0;
    let directBloodPressureEffect = 0;
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
      const speciesResponseFactor = drugDef.id === 'atropine'
        ? speciesConfig.atropineResponseFactor
        : 1;
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
      if (profile?.m2) rawM2 += systemicResponse * profile.m2.affinity * profile.m2.intrinsicEfficacy;
      if (profile?.m3) rawM3 += systemicResponse * profile.m3.affinity * profile.m3.intrinsicEfficacy;
      if (profile?.dopamineD2) rawD2 += centralResponse * profile.dopamineD2.affinity * profile.dopamineD2.intrinsicEfficacy;
      if (profile?.histamineH1) rawH1 += centralResponse * profile.histamineH1.affinity * profile.histamineH1.intrinsicEfficacy;
      if (profile?.serotonin2) raw5HT2 += systemicResponse * profile.serotonin2.affinity * profile.serotonin2.intrinsicEfficacy;
      if (profile?.nm) rawNMBA += systemicResponse * profile.nm.affinity;

      if (profile?.gabaA) {
        const gabaResponse = hillResponse(centralExposure * speciesConfig.gabaSensitivityFactor);
        bzdSite += (gabaResponse * (profile.gabaA.bzdAllosteric || 0));
        propofolSite += gabaResponse * Math.max(
          profile.gabaA.propofolBarbiturateDirect || 0,
          profile.gabaA.directChlorideGating || 0
        );
        neurosteroidSite += gabaResponse * Math.max(
          profile.gabaA.neurosteroidSite || 0,
          profile.gabaA.directChlorideGating || 0
        );
      }

      if (profile?.muOpioid) {
        const response = hillResponse(exposure.centralCe / muSchildFactor);
        rawMu += response * profile.muOpioid.affinity * profile.muOpioid.intrinsicEfficacy
          * speciesConfig.muOpioidSensitivityFactor;
      }
      if (profile?.kappaOpioid) {
        const response = hillResponse(exposure.centralCe / kappaSchildFactor);
        rawKappa += response * profile.kappaOpioid.affinity * profile.kappaOpioid.intrinsicEfficacy
          * speciesConfig.kappaOpioidSensitivityFactor;
      }
      if (profile?.nmdaPoreBlock) rawNMDA += centralResponse * profile.nmdaPoreBlock * speciesConfig.nmdaSensitivityFactor;
      if (profile?.caVChannelBlock) rawCaV += systemicResponse * profile.caVChannelBlock;
      if (profile?.acheInhibition) rawAChE += systemicResponse * profile.acheInhibition;

      if (profile?.naVChannelBlock) {
        const recommended = getSpeciesDoseRange(drugDef, patient.species);
        const typicalDose = Math.max(0.0001, recommended?.typical || 1);
        const toxicDose = speciesConfig.lidocaineIvCardiotoxicityThresholdMgKg;
        const normalizedToxicThreshold = drugDef.id === 'lidocaine_2pct'
          ? Math.max(2.5, toxicDose / typicalDose)
          : 3.5;
        rawSystemicNaV += hillResponse(exposure.systemicCe, normalizedToxicThreshold * 0.8, 2.2)
          * profile.naVChannelBlock * lipidSinkReduction;
        rawLocalNaV += hillResponse(exposure.localCe, 0.35, 1.5) * profile.naVChannelBlock;
      }

      // Every catalog vector now has a physiological consumer. Receptor mechanisms
      // remain causal; these bounded vectors calibrate net observed organ effects.
      if (applyCatalogPhenotype && drugDef.effectDepth > 0) {
        const depthEffect = clamp(drugDef.effectDepth * centralResponse);
        if (drugDef.specialTraits?.isDissociative) {
          dissociativeEffects.push(depthEffect);
        } else if (drugDef.category === 'induction' && drugDef.id !== 'guaifenesin') {
          hypnoticEffects.push(depthEffect);
        } else if (drugDef.category === 'premedication' || drugDef.category === 'opioid_analgesic' || drugDef.id === 'guaifenesin') {
          sedationEffects.push(depthEffect);
        }
      } else if (applyCatalogPhenotype && drugDef.effectDepth < 0) {
        arousalDrive += Math.abs(drugDef.effectDepth) * centralResponse;
      }

      if (applyCatalogPhenotype) {
        const effectiveAnalgesicExposure = (drugDef.category === 'local_anesthetic' || drugDef.supportedRoutes.includes('Local') || drugDef.supportedRoutes.includes('Epidural'))
          ? Math.max(centralResponse, hillResponse(exposure.localCe, 0.25, 1.2))
          : centralResponse;
        if (drugDef.effectAnalgesia > 0) analgesicEffects.push(drugDef.effectAnalgesia * effectiveAnalgesicExposure);
        if (drugDef.macReductionPct > 0) macSparingEffects.push(drugDef.macReductionPct * centralResponse);
        if (drugDef.muscleRelaxation > 0) relaxationEffects.push(drugDef.muscleRelaxation * centralResponse);
        if (drugDef.muscleRelaxation < 0) rigidityDrive += Math.abs(drugDef.muscleRelaxation) * centralResponse;
        if (drugDef.effectRR < 0) respiratoryDepressants.push(Math.abs(drugDef.effectRR) * centralResponse);
        if (drugDef.effectRR > 0) respiratoryStimulants.push(drugDef.effectRR * systemicResponse);

        directHeartRateEffect += drugDef.effectHR * systemicResponse;
        directBloodPressureEffect += drugDef.effectBP * systemicResponse;
      }

      if (drugDef.id === 'fluid_lrs') volumeExpansion += systemicResponse * 0.45;
      if (drugDef.id === 'hypertonic_saline_72') volumeExpansion += systemicResponse * 0.8;
      if (drugDef.id === 'whole_blood') {
        volumeExpansion += systemicResponse * 0.65;
        oxygenCarryingSupport += systemicResponse;
      }
      if (drugDef.id === 'potassium_chloride') potassiumLoad += systemicResponse;
      if (drugDef.id === 'calcium_gluconate') calciumMembraneStabilization += systemicResponse;
      if (drugDef.id === 'sodium_bicarbonate') alkalinization += systemicResponse;
    }

    // Fallbacks are additive only when the explicit target is absent; a partial
    // receptor profile can no longer silence the rest of a drug's mechanism.
    const ensureTarget = (id: string, targetExists: boolean | undefined, apply: (response: number) => void): void => {
      const exposure = exposures.get(id);
      if (exposure && !targetExists) apply(hillResponse(exposure.centralCe));
    };
    for (const id of ['dexmedetomidine', 'xylazine', 'detomidine']) {
      const def = exposures.get(id)?.drugDef;
      ensureTarget(id, Boolean(def?.receptorProfile?.alpha2), (response) => {
        rawAlpha2 += response * speciesConfig.alpha2SensitivityFactor / alpha2SchildFactor;
      });
    }
    ensureTarget('epinephrine', Boolean(exposures.get('epinephrine')?.drugDef.receptorProfile?.beta1), (r) => {
      rawAlpha1 += r * 0.85; rawBeta1 += r; rawBeta2 += r * 0.75;
    });
    ensureTarget('norepinephrine', Boolean(exposures.get('norepinephrine')?.drugDef.receptorProfile?.alpha1), (r) => {
      rawAlpha1 += r; rawBeta1 += r * 0.65;
    });
    ensureTarget('dobutamine', Boolean(exposures.get('dobutamine')?.drugDef.receptorProfile?.beta1), (r) => {
      rawBeta1 += r; rawBeta2 += r * 0.3;
    });
    ensureTarget('ephedrine', Boolean(exposures.get('ephedrine')?.drugDef.receptorProfile?.beta1), (r) => {
      // Direct alpha-1, beta-1, beta-2 plus indirect endogenous noradrenaline release
      const ephedrineDoses = activeDoses.filter((d) => d.drugId === 'ephedrine');
      const cumulativeDose = ephedrineDoses.reduce((acc, d) => acc + d.dosePerKg, 0);
      const typicalDose = getSpeciesDoseRange(exposures.get('ephedrine')!.drugDef, patient.species)?.typical || 0.1;
      const tachyphylaxisRatio = Math.max(0.25, 1.0 - Math.min(0.75, Math.max(0, (cumulativeDose / typicalDose - 1.2) * 0.45)));
      rawAlpha1 += r * 0.45 + (r * 0.40 * tachyphylaxisRatio);
      rawBeta1 += r * 0.50 + (r * 0.35 * tachyphylaxisRatio);
      rawBeta2 += r * 0.35;
    });
    ensureTarget('guaifenesin', false, () => undefined);
    ensureTarget('ketamine', false, (r) => {
      // Sympathetic tone stimulation via central stimulation and catecholamine reuptake inhibition
      rawBeta1 += r * 0.40;
      rawAlpha1 += r * 0.30;
    });

    // Neostigmine reverses atracurium. Sugammadex is deliberately not applied to
    // atracurium (it only encapsulates aminosteroidal blockers).
    const neostigmineReversal = 0.9 * hillResponse(neostigmineCe, 0.35, 1.4);
    const effectiveNMBABlock = clamp(rawNMBA * (1 - neostigmineReversal));

    const macSparingFraction = Math.min(0.75, combineEffects(macSparingEffects));
    const effectiveInhalantCe = Math.max(0, inhalantCe) / Math.max(0.3, 1 - macSparingFraction);
    const volatileSite = hillResponse(effectiveInhalantCe, 0.65, 1.5);

    const allostericBZDMultiplier = 1 + 1.15 * clamp(bzdSite);
    const directGating = 0.78 * propofolSite + 0.82 * neurosteroidSite + 0.86 * volatileSite;
    const gabaAChlorideConductance = 0.08 + directGating * allostericBZDMultiplier + 0.11 * clamp(bzdSite);

    const receptorSedation = clamp(
      0.5 * Math.abs(Math.min(0, rawD2)) +
      0.18 * Math.abs(Math.min(0, rawH1)) +
      0.45 * Math.max(0, rawAlpha2) +
      0.12 * Math.max(0, rawMu) +
      0.08 * Math.max(0, rawKappa) +
      0.22 * clamp(bzdSite)
    );
    let centralSedation = combineEffects([...sedationEffects, receptorSedation]);
    if (speciesConfig.opioidManiaSusceptibility && rawMu > 0.45 && rawAlpha2 < 0.2 && propofolSite < 0.15 && neurosteroidSite < 0.15) {
      // Pure-mu opioids can cause dysphoria/excitation in cats and especially
      // horses when not balanced by an alpha-2 or hypnotic.
      arousalDrive += Math.min(0.35, (rawMu - 0.45) * 0.55);
      directHeartRateEffect += Math.min(0.18, (rawMu - 0.45) * 0.28);
    }
    centralSedation = clamp(centralSedation - clamp(arousalDrive) * 0.45);

    const injectableHypnosis = combineEffects(hypnoticEffects);
    const hypnoticEffect = combineEffects([
      injectableHypnosis,
      volatileSite * 0.94,
      Math.min(0.35, centralSedation * 0.22),
    ]);
    const dissociativeEffect = combineEffects(dissociativeEffects);
    const muscleRelaxation = clamp(combineEffects(relaxationEffects) - clamp(rigidityDrive) * 0.75);

    const phenotypicRespiratoryDepression = combineEffects(respiratoryDepressants);
    const respiratoryStimulation = combineEffects(respiratoryStimulants);
    const respiratoryDepression = clamp(
      combineEffects([
        phenotypicRespiratoryDepression,
        clamp(Math.max(0, rawMu) * 0.42),
        clamp(hypnoticEffect * 0.38),
      ]) - respiratoryStimulation * 0.6
    );

    const mechanisticAnalgesicSignal =
      1.75 * Math.max(0, rawMu) +
      1.05 * Math.max(0, rawKappa) +
      1.1 * Math.max(0, rawAlpha2) +
      1.0 * Math.max(0, rawNMDA) +
      3.2 * Math.max(0, rawLocalNaV);
    const mechanisticAnalgesia = hillResponse(mechanisticAnalgesicSignal, 1.0, 1.7);
    const localNeuralBlockAfferent = hillResponse(rawLocalNaV, 0.28, 2.0);
    const phenotypicAnalgesia = combineEffects(analgesicEffects);
    const nociceptiveInhibition = clamp(Math.max(mechanisticAnalgesia, phenotypicAnalgesia, localNeuralBlockAfferent));

    // Acute bolus envelope. It persists across ticks instead of being calculated
    // and discarded on the single arrival frame.
    let acuteBolusHypotension = 0;
    let acuteBolusRespiratoryDepression = 0;
    let acuteBolusBradycardia = 0;
    let acuteBolusArrhythmia = 0;
    let histamineRelease = 0;
    for (const dose of activeDoses) {
      if ((dose.bolusShockRemainingSec || 0) <= 0 || (dose.bolusShockMagnitude || 0) <= 0) continue;
      const def = VETERINARY_DRUG_DATABASE.find((item) => item.id === dose.drugId);
      if (!def?.fastBolusRisk) continue;
      // If competitive antagonist is present, abrogate acute bolus bradycardia/arrhythmia
      if (def.specialTraits?.isAlpha2Agonist && atipamezoleCe > 0.05) continue;
      if (def.specialTraits?.isOpioid && naloxoneCe > 0.05) continue;
      if (def.specialTraits?.isBenzodiazepine && flumazenilCe > 0.05) continue;
      const fade = clamp((dose.bolusShockRemainingSec || 0) / 25);
      const magnitude = clamp((dose.bolusShockMagnitude || 0) * fade, 0, 1.5);
      acuteBolusHypotension = Math.max(acuteBolusHypotension, def.fastBolusRisk.hypotensionSeverity * magnitude);
      acuteBolusRespiratoryDepression = Math.max(acuteBolusRespiratoryDepression, def.fastBolusRisk.apneaRisk * magnitude);
      acuteBolusBradycardia = Math.max(acuteBolusBradycardia, def.fastBolusRisk.reflexBradycardiaRisk * magnitude);
      acuteBolusArrhythmia = Math.max(acuteBolusArrhythmia, def.fastBolusRisk.arrhythmiaRisk * magnitude);
      if (def.fastBolusRisk.histamineRelease) histamineRelease = Math.max(histamineRelease, magnitude);
    }

    // Central vagotonic activation from mu-opioids (fentanyl, methadone, morphine)
    // Produces dose-dependent physiological vagal bradycardia, reversible by atropine (negative M2) or naloxone
    const opioidVagalDrive = rawMu > 0.05 ? rawMu * 0.35 * speciesConfig.muOpioidSensitivityFactor : 0;
    const effectiveM2 = rawM2 + opioidVagalDrive;

    // Class Ib antiarrhythmic protection: therapeutic systemic NaV exposure
    // (e.g. Lidocaine 2 mg/kg IV bolus / CRI) stabilizes Purkinje membrane and suppresses VPCs/VT
    let antiarrhythmicIbProtection = 0;
    for (const exposure of exposures.values()) {
      if (exposure.drugDef.specialTraits?.isAntiarrhythmicClass1b) {
        const therapeuticLevel = hillResponse(exposure.systemicCe, 0.40, 1.8);
        antiarrhythmicIbProtection = Math.max(antiarrhythmicIbProtection, therapeuticLevel);
      }
    }

    const netMyocardialGs = Math.max(0, rawBeta1);
    const netMyocardialGi = Math.max(0, effectiveM2 * 0.72 + rawAlpha2 * 0.35 + rawMu * 0.18);
    const cAMPMyocardial = clamp(1 + 0.78 * netMyocardialGs - 0.68 * netMyocardialGi, 0.15, 3.5);
    const vasodilationDrive = 0.6 * Math.max(0, rawBeta2) + Math.abs(Math.min(0, rawAlpha1)) * 0.8;
    const vasoconstrictionDrive = Math.max(0, rawAlpha1) * 1.2 + Math.max(0, rawAlpha2) * 0.5;
    const cAMPVascular = clamp(1 + 0.65 * vasodilationDrive - 0.72 * vasoconstrictionDrive, 0.2, 3);
    const estimatedPotassium = patient.baselineVitals.potassiumMeqL + clamp(potassiumLoad) * 1.2 - clamp(alkalinization) * 0.65;
    const untreatedHyperkalemicToxicity = clamp((estimatedPotassium - 5.5) / 2.5);
    const hyperkalemicCardiotoxicity = clamp(
      untreatedHyperkalemicToxicity * (1 - clamp(calciumMembraneStabilization) * 0.82)
    );
    const myocardialDepression = 0.5 * rawSystemicNaV + 0.35 * rawCaV + 0.18 * volatileSite
      + hyperkalemicCardiotoxicity * 0.42;
    const intracellularCalcium = clamp(
      cAMPMyocardial * (1 - myocardialDepression) + calciumMembraneStabilization * 0.12,
      0.1,
      3
    );

    return {
      alpha1Drive: rawAlpha1,
      alpha2Drive: rawAlpha2,
      beta1Drive: rawBeta1,
      beta2Drive: rawBeta2,
      m2Drive: effectiveM2,
      m3Drive: rawM3,
      dopamineD2Drive: rawD2,
      histamineH1Drive: rawH1,
      serotonin2Drive: raw5HT2,
      nmOccupancy: effectiveNMBABlock,
      gabaAChlorideConductance,
      bzdAllostericOccupancy: clamp(bzdSite),
      propofolSiteOccupancy: clamp(propofolSite),
      neurosteroidSiteOccupancy: clamp(neurosteroidSite),
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
      nmdaBlockade: clamp(rawNMDA),
      naVBlockade: clamp(rawSystemicNaV),
      localNeuralBlockade: clamp(rawLocalNaV),
      caVBlockade: clamp(rawCaV),
      acheInhibition: clamp(rawAChE),
      nociceptiveInhibition,
      directHeartRateEffect: clamp(directHeartRateEffect, -1.5, 1.5),
      directBloodPressureEffect: clamp(directBloodPressureEffect, -1.5, 1.5),
      acuteBolusHypotension: clamp(acuteBolusHypotension),
      acuteBolusRespiratoryDepression: clamp(acuteBolusRespiratoryDepression),
      acuteBolusBradycardia: clamp(acuteBolusBradycardia),
      acuteBolusArrhythmia: clamp(acuteBolusArrhythmia),
      histamineRelease: clamp(histamineRelease),
      volumeExpansion: clamp(volumeExpansion),
      oxygenCarryingSupport: clamp(oxygenCarryingSupport),
      potassiumLoad: clamp(potassiumLoad),
      calciumMembraneStabilization: clamp(calciumMembraneStabilization),
      alkalinization: clamp(alkalinization),
      hyperkalemicCardiotoxicity,
      antiarrhythmicIbProtection: clamp(antiarrhythmicIbProtection),
      cAMPMyocardial,
      cAMPVascular,
      intracellularCalcium,
      reversalCe: {
        atipamezole: atipamezoleCe,
        naloxone: naloxoneCe,
        flumazenil: flumazenilCe,
        sugammadex: sugammadexCe,
        neostigmine: neostigmineCe,
        lipidEmulsion: lipidEmulsionCe,
      },
    };
  }
}
