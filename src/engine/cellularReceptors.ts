import {
  ActiveDrugDose,
  DrugDefinition,
  DrugReceptorProfile,
  PatientProfile,
} from '../types/simulator';
import { VETERINARY_DRUG_DATABASE } from '../data/drugDatabase';
import { SPECIES_CELLULAR_CONFIGS } from './speciesPhysiology';

export interface ReceptorStateSnapshot {
  // Normalized Occupancies / Drives (0 to 1+)
  alpha1Drive: number;
  alpha2Drive: number;
  beta1Drive: number;
  beta2Drive: number;
  m2Drive: number;
  m3Drive: number;
  nmOccupancy: number; // Motor endplate block
  
  // GABA-A System
  gabaAChlorideConductance: number; // 0.1 awake, 1.0 surgical, > 3.0 deep/toxic
  bzdAllostericOccupancy: number;
  propofolSiteOccupancy: number;
  neurosteroidSiteOccupancy: number;
  volatileSiteOccupancy: number;
  
  // Opioid & Analgesic System
  muOpioidDrive: number;
  kappaOpioidDrive: number;
  nmdaBlockade: number; // 0 to 1
  
  // Ion Channels & Enzymes
  naVBlockade: number; // Local anesthetic cardiac/neuronal effect
  acheInhibition: number;
  
  // Intracellular Second Messengers (relative to baseline 1.0)
  cAMPMyocardial: number; // beta1 (Gs) vs M2/alpha2 (Gi)
  cAMPVascular: number; // beta2 (Gs) relaxation vs alpha1 (Gq) constriction
  intracellularCalcium: number; // Cardiomyocyte inotropic drive
  nociceptiveInhibition: number; // Total surgical analgesia index (0 to 1)
  
  // Active Antagonists Ce
  reversalCe: {
    atipamezole: number;
    naloxone: number;
    flumazenil: number;
    sugammadex: number;
    neostigmine: number;
    lipidEmulsion: number;
  };
}

export class CellularReceptorsEngine {
  /**
   * Evaluates competitive binding, allosteric multi-site modulation on GABA-A,
   * second-messenger transductions (cAMP, Ca2+, Cl-), and antinociceptive summation.
   */
  public static computeReceptorState(
    patient: PatientProfile,
    activeDoses: ActiveDrugDose[],
    inhalantCe: number, // 1.0 = 1 MAC
    inhalantAgent: 'isoflurane' | 'sevoflurane'
  ): ReceptorStateSnapshot {
    const speciesConfig = SPECIES_CELLULAR_CONFIGS[patient.species] || SPECIES_CELLULAR_CONFIGS.canine;

    // Collect effective bio-phase concentrations (Ce) by drug ID
    const drugCeMap: Record<string, number> = {};
    for (const dose of activeDoses) {
      drugCeMap[dose.drugId] = (drugCeMap[dose.drugId] || 0) + dose.currentCe;
    }

    // ----------------------------------------------------
    // 1. ANTAGONIST CONCENTRATIONS (REVERSAL AGENTS)
    // ----------------------------------------------------
    const atipamezoleCe = drugCeMap['atipamezole'] || 0;
    const naloxoneCe = drugCeMap['naloxone'] || 0;
    const flumazenilCe = drugCeMap['flumazenil'] || 0;
    const sugammadexCe = drugCeMap['sugammadex'] || 0;
    const neostigmineCe = drugCeMap['neostigmine'] || 0;
    const lipidEmulsionCe = drugCeMap['lipid_emulsion_20'] || 0;

    // Local anesthetic lipid sink sequestration
    let localAnestheticSinkReduction = 1.0;
    if (lipidEmulsionCe > 0.05) {
      localAnestheticSinkReduction = Math.max(0.05, 1.0 - lipidEmulsionCe * 2.5);
    }

    // ----------------------------------------------------
    // 2. COMPETITIVE ANTAGONISM (SCHILD / CHENG-PRUSOFF LAW)
    // ----------------------------------------------------
    // Alpha-2 displacement by Atipamezole
    const alpha2SchildFactor = 1.0 + atipamezoleCe * 4.5;
    
    // Mu-Opioid displacement by Naloxone
    const muOpioidSchildFactor = 1.0 + naloxoneCe * 5.0;

    // Benzodiazepine displacement by Flumazenil
    const bzdSchildFactor = 1.0 + flumazenilCe * 4.8;

    // ----------------------------------------------------
    // 3. RECEPTOR OCCUPANCY ACCUMULATION
    // ----------------------------------------------------
    let rawAlpha1 = 0;
    let rawAlpha2 = 0;
    let rawBeta1 = 0;
    let rawBeta2 = 0;
    let rawM2 = 0;
    let rawM3 = 0;
    let rawNMBA = 0;
    let rawMuOpioid = 0;
    let rawKappaOpioid = 0;
    let rawNMDABlock = 0;
    let rawNaVBlock = 0;
    let rawAChEInhib = 0;

    // GABA-A Allosteric Sites
    let bzdSiteOccupancy = 0;
    let propofolSiteOccupancy = 0;
    let neurosteroidSiteOccupancy = 0;

    for (const dose of activeDoses) {
      const drugDef = VETERINARY_DRUG_DATABASE.find((d) => d.id === dose.drugId);
      if (!drugDef) continue;
      const Ce = dose.currentCe;
      if (Ce <= 0.001) continue;

      const profile = drugDef.receptorProfile;

      // If explicit receptor profile exists, integrate directly:
      if (profile) {
        if (profile.alpha1) {
          rawAlpha1 += Ce * profile.alpha1.affinity * profile.alpha1.intrinsicEfficacy;
        }
        if (profile.alpha2) {
          const speciesSensitivity = speciesConfig.alpha2SensitivityFactor;
          rawAlpha2 += (Ce * profile.alpha2.affinity * profile.alpha2.intrinsicEfficacy * speciesSensitivity) / alpha2SchildFactor;
        }
        if (profile.beta1) {
          rawBeta1 += Ce * profile.beta1.affinity * profile.beta1.intrinsicEfficacy;
        }
        if (profile.beta2) {
          rawBeta2 += Ce * profile.beta2.affinity * profile.beta2.intrinsicEfficacy;
        }
        if (profile.m2) {
          rawM2 += Ce * profile.m2.affinity * profile.m2.intrinsicEfficacy;
        }
        if (profile.m3) {
          rawM3 += Ce * profile.m3.affinity * profile.m3.intrinsicEfficacy;
        }
        if (profile.nm) {
          rawNMBA += Ce * profile.nm.affinity;
        }
        if (profile.gabaA) {
          if (profile.gabaA.bzdAllosteric) {
            bzdSiteOccupancy += (Ce * profile.gabaA.bzdAllosteric) / bzdSchildFactor;
          }
          if (profile.gabaA.propofolBarbiturateDirect) {
            propofolSiteOccupancy += Ce * profile.gabaA.propofolBarbiturateDirect;
          }
          if (profile.gabaA.neurosteroidSite) {
            neurosteroidSiteOccupancy += Ce * profile.gabaA.neurosteroidSite;
          }
        }
        if (profile.muOpioid) {
          rawMuOpioid += (Ce * profile.muOpioid.affinity * profile.muOpioid.intrinsicEfficacy) / muOpioidSchildFactor;
        }
        if (profile.kappaOpioid) {
          rawKappaOpioid += (Ce * profile.kappaOpioid.affinity * profile.kappaOpioid.intrinsicEfficacy) / muOpioidSchildFactor;
        }
        if (profile.nmdaPoreBlock) {
          rawNMDABlock += Ce * profile.nmdaPoreBlock;
        }
        if (profile.naVChannelBlock) {
          rawNaVBlock += Ce * profile.naVChannelBlock * localAnestheticSinkReduction;
        }
        if (profile.acheInhibition) {
          rawAChEInhib += Ce * profile.acheInhibition;
        }
      } else {
        // Fallback mapping from drug IDs & specialTraits for any unprofiled drugs
        if (drugDef.id === 'dexmedetomidine' || drugDef.id === 'xylazine' || drugDef.id === 'detomidine') {
          const speciesSens = speciesConfig.alpha2SensitivityFactor;
          rawAlpha2 += (Ce * 1.5 * speciesSens) / alpha2SchildFactor;
          rawAlpha1 += Ce * 0.25; // Peripheral vasoconstriction
        } else if (drugDef.id === 'acepromazine') {
          rawAlpha1 -= Ce * 1.4; // Alpha-1 competitive blockade
        } else if (drugDef.id === 'epinephrine') {
          rawAlpha1 += Ce * 1.6;
          rawBeta1 += Ce * 2.2;
          rawBeta2 += Ce * 1.2;
        } else if (drugDef.id === 'norepinephrine') {
          rawAlpha1 += Ce * 2.5;
          rawBeta1 += Ce * 1.4;
        } else if (drugDef.id === 'dobutamine') {
          rawBeta1 += Ce * 2.4;
          rawBeta2 += Ce * 0.6;
        } else if (drugDef.id === 'atropine' || drugDef.id === 'glycopyrrolate') {
          rawM2 -= Ce * 2.2; // Muscarinic M2 competitive blockade
          rawM3 -= Ce * 2.0;
        } else if (drugDef.id === 'propofol' || drugDef.id === 'etomidate' || drugDef.id === 'thiopental') {
          propofolSiteOccupancy += Ce * 1.2;
        } else if (drugDef.id === 'alfaxalone') {
          neurosteroidSiteOccupancy += Ce * 1.4;
        } else if (drugDef.id === 'midazolam' || drugDef.id === 'diazepam') {
          bzdSiteOccupancy += (Ce * 1.3) / bzdSchildFactor;
        } else if (drugDef.id === 'ketamine') {
          rawNMDABlock += Ce * 1.4;
        } else if (drugDef.id === 'fentanyl' || drugDef.id === 'methadone' || drugDef.id === 'morphine') {
          rawMuOpioid += (Ce * 1.6) / muOpioidSchildFactor;
        } else if (drugDef.id === 'butorphanol') {
          rawKappaOpioid += (Ce * 1.4) / muOpioidSchildFactor;
          rawMuOpioid += (Ce * 0.2) / muOpioidSchildFactor; // Partial / weak mu
        } else if (drugDef.id === 'atracurium') {
          rawNMBA += Ce * 1.5;
        } else if (drugDef.id === 'lidocaine_2pct' || drugDef.id === 'bupivacaine_05') {
          rawNaVBlock += Ce * 1.3 * localAnestheticSinkReduction;
        } else if (drugDef.id === 'neostigmine') {
          rawAChEInhib += Ce * 1.8;
        }
      }
    }

    // Neuromuscular Block Reversal Kinetics
    let effectiveNMBABlock = Math.max(0, rawNMBA);
    if (sugammadexCe > 0.05) {
      effectiveNMBABlock = Math.max(0, effectiveNMBABlock - sugammadexCe * 3.5);
    }
    if (rawAChEInhib > 0.05) {
      // Accumulation of endogenous acetylcholine displaces NMBA at the motor endplate
      effectiveNMBABlock = Math.max(0, effectiveNMBABlock - rawAChEInhib * 2.2);
      // Concomitant parasympathetic overdrive if atropine is not co-administered
      rawM2 += rawAChEInhib * 1.4;
      rawM3 += rawAChEInhib * 1.6;
    }

    // ----------------------------------------------------
    // 4. ALLOSTERIC COOPERATIVITY AT GABA-A COMPLEX
    // ----------------------------------------------------
    // Direct gating components: Propofol, Etomidate, Barbiturate, Alfaxalone, Inhalation
    const volatileSiteOccupancy = Math.max(0, inhalantCe);
    const directGatingSum = 
      0.95 * propofolSiteOccupancy + 
      1.10 * neurosteroidSiteOccupancy + 
      1.25 * volatileSiteOccupancy;

    // Allosteric potentiators: Benzodiazepines act as pure positive allosteric modulators
    // (they have low direct chloride conductance alone, but multiply the effect of direct gating agents!)
    const allostericBZDMultiplier = 1.0 + 2.6 * Math.min(2.0, bzdSiteOccupancy);
    const allostericVolatileSynergy = 1.0 + 0.8 * Math.min(2.0, volatileSiteOccupancy);

    // Dynamic Chloride Conductance (gCl-):
    // Baseline resting neuronal conductance = 0.08
    const baseChloride = 0.08;
    const chlorideConductanceGabaA = 
      baseChloride + 
      (directGatingSum * allostericBZDMultiplier * allostericVolatileSynergy) +
      0.25 * Math.min(1.0, bzdSiteOccupancy); // mild standalone sedation

    // ----------------------------------------------------
    // 5. SECOND MESSENGER TRANSDUCTION (cAMP & Ca2+)
    // ----------------------------------------------------
    // Baseline cAMP = 1.0
    // Gs stimulation: Beta-1, Beta-2
    // Gi inhibition: Alpha-2, M2, Mu-opioid
    const netMyocardialGsDrive = Math.max(0, rawBeta1);
    const netMyocardialGiDrive = Math.max(0, rawM2 * 1.2 + rawAlpha2 * 0.8 + rawMuOpioid * 0.4);
    const cAMPMyocardial = Math.max(0.15, Math.min(3.5, 1.0 + 0.85 * netMyocardialGsDrive - 0.75 * netMyocardialGiDrive));

    // Vascular cAMP & IP3 (Smooth Muscle Tone)
    const netVasodilationDrive = 0.6 * rawBeta2 + (rawAlpha1 < 0 ? Math.abs(rawAlpha1) * 0.9 : 0);
    const netVasoconstrictionDrive = Math.max(0, rawAlpha1) * 1.4 + Math.max(0, rawAlpha2) * 0.7;
    const cAMPVascular = Math.max(0.2, Math.min(3.0, 1.0 + 0.7 * netVasodilationDrive - 0.8 * netVasoconstrictionDrive));

    // Cardiomyocyte Intracellular Calcium [Ca2+]i transient
    // Modulated by cAMP (PKA phosphorylation of L-type Ca channels & phospholamban)
    // Directly depressed by local anesthetics (NaV/CaV inhibition) and high inhalants
    const directMyocardialDepression = 0.45 * rawNaVBlock + 0.35 * Math.max(0, volatileSiteOccupancy - 1.0);
    const intracellularCalcium = Math.max(0.1, Math.min(3.0, cAMPMyocardial * (1.0 - directMyocardialDepression)));

    // ----------------------------------------------------
    // 6. NOCICEPTIVE INHIBITION (SURGICAL ANALGESIA INDEX)
    // ----------------------------------------------------
    // Integrated spinal dorsal horn & descending PAG-RVM antinociceptive summation
    const rawAnalgesicSignal = 
      1.9 * rawMuOpioid + 
      1.2 * rawKappaOpioid + 
      1.3 * rawAlpha2 + 
      1.1 * rawNMDABlock + 
      1.8 * rawNaVBlock; // local anesthetic block is complete antinociception

    // Sigmoidal saturation curve for analgesia (0 to 1)
    const nociceptiveInhibition = Math.min(1.0, Math.pow(rawAnalgesicSignal, 2) / (Math.pow(1.1, 2) + Math.pow(rawAnalgesicSignal, 2)));

    return {
      alpha1Drive: rawAlpha1,
      alpha2Drive: rawAlpha2,
      beta1Drive: rawBeta1,
      beta2Drive: rawBeta2,
      m2Drive: rawM2,
      m3Drive: rawM3,
      nmOccupancy: Math.min(1.0, effectiveNMBABlock),
      gabaAChlorideConductance: chlorideConductanceGabaA,
      bzdAllostericOccupancy: bzdSiteOccupancy,
      propofolSiteOccupancy,
      neurosteroidSiteOccupancy,
      volatileSiteOccupancy,
      muOpioidDrive: rawMuOpioid,
      kappaOpioidDrive: rawKappaOpioid,
      nmdaBlockade: Math.min(1.0, rawNMDABlock),
      naVBlockade: Math.min(1.0, rawNaVBlock),
      acheInhibition: Math.min(1.0, rawAChEInhib),
      cAMPMyocardial,
      cAMPVascular,
      intracellularCalcium,
      nociceptiveInhibition,
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
