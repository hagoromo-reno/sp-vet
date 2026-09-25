import { VETERINARY_DRUG_DATABASE } from '../src/data/drugDatabase';
import { resolveBiotransformationProfile } from '../src/engine/biotransformationEngine';
import {
  createHealthyValidationPatient,
  createSimulationState,
  createDefaultEquipment,
  administerDrug,
  advanceSimulation,
  summarizeTrace,
} from '../src/validation/simulationHarness';
import { DrugDefinition, SpeciesType } from '../src/types/simulator';

interface DrugAuditResult {
  id: string;
  name: string;
  category: string;
  speciesTested: SpeciesType;
  dosePerKg: number;
  route: string;
  tOnsetDesign: number;
  tPeakObservedMin: number;
  durationDesignMin: number;
  durationObservedMin: number | string;
  peakCe: number;
  peakCp: number;
  deltaHR: number;
  deltaMAP: number;
  peakEffectLabel: string;
  peakEffectValue: number;
  eliminatedPct: number;
  biotransformationPathway: string;
  status: 'OPTIMAL' | 'REFINED' | 'FLAGGED';
  notes: string;
}

export function runFullAudit(): DrugAuditResult[] {
  const results: DrugAuditResult[] = [];

  for (const drug of VETERINARY_DRUG_DATABASE) {
    // Choose most representative species for testing
    let species: SpeciesType = 'canine';
    if (!drug.recommendedDose.canine) {
      const available = Object.keys(drug.recommendedDose) as SpeciesType[];
      species = available[0] || 'feline';
    }

    const patient = createHealthyValidationPatient(species);
    const isInductionOrNMBA = drug.category === 'induction' || drug.category === 'nmba';
    const equipment = createDefaultEquipment(patient, isInductionOrNMBA ? {
      intubationStatus: 'intubated_tracheal',
      cuffPressureCmH2O: 18,
      ventilatorMode: 'cmv_volume',
      isVentilatorActive: true,
      oxygenFlowLMin: Math.max(1, patient.weightKg * 0.05),
    } : {});

    const baseHR = patient.baselineVitals.hr;
    const baseMAP = patient.baselineVitals.map;

    const state = createSimulationState(patient, equipment);
    administerDrug(state, drug.id, 'typical');

    const administered = state.doses[0];
    const dosePerKg = administered.dosePerKg;
    const route = administered.route;

    // Simulate for up to 30 minutes or 1.5x duration (max 45 min)
    const simMinutes = Math.min(45, Math.max(15, Math.round(drug.durationMinutes * 1.2)));
    const simSeconds = simMinutes * 60;
    const dt = 2;

    let peakCe = 0;
    let peakCp = 0;
    let tPeakSec = 0;
    let offsetSec: number | undefined;

    const isHypnotic = drug.category === 'induction' || drug.category === 'inhalation';
    const cutoffCe = isHypnotic ? 0.20 : 0.15;

    for (let t = 0; t < simSeconds; t += dt) {
      advanceSimulation(state, dt, { dtSeconds: dt });
      const currentDose = state.doses.find(d => d.drugId === drug.id);
      if (currentDose) {
        if (currentDose.currentCe > peakCe) {
          peakCe = currentDose.currentCe;
          tPeakSec = t + dt;
        }
        if (currentDose.currentCp > peakCp) {
          peakCp = currentDose.currentCp;
        }
        if (peakCe > cutoffCe && currentDose.currentCe <= cutoffCe && offsetSec === undefined) {
          offsetSec = t + dt;
        }
      }
    }

    const trace = summarizeTrace(state.frames);
    const bio = resolveBiotransformationProfile(drug);

    const finalDose = state.doses.find(d => d.drugId === drug.id);
    const eliminatedFrac = finalDose?.pkCompartments?.cumulativeEliminatedNormalized ?? 0;
    const deliveredFrac = finalDose?.pkCompartments?.cumulativeDeliveredNormalized ?? 1;
    const eliminatedPct = deliveredFrac > 0 ? Math.round((eliminatedFrac / deliveredFrac) * 100) : 0;

    // Determine primary PD effect
    let peakEffectLabel = 'Sedação';
    let peakEffectValue = trace.maxSedation;
    if (drug.category === 'induction') {
      peakEffectLabel = 'Hipnose';
      peakEffectValue = trace.maxHypnosis;
    } else if (drug.category === 'opioid_analgesic') {
      peakEffectLabel = 'Analgesia';
      peakEffectValue = trace.maxAnalgesia;
    } else if (drug.category === 'nmba') {
      peakEffectLabel = 'Bloqueio Nm';
      peakEffectValue = trace.maxMuscleRelaxation;
    } else if (drug.category === 'local_anesthetic') {
      peakEffectLabel = 'Bloqueio Local';
      peakEffectValue = trace.maxLocalBlockade;
    } else if (drug.category === 'emergency_inotrope' || drug.category === 'antihypertensive') {
      peakEffectLabel = 'Δ PAM';
      peakEffectValue = Math.round(trace.maxMap - baseMAP);
    }

    const tPeakObservedMin = Math.round((tPeakSec / 60) * 10) / 10;
    const durationObservedMin = offsetSec ? Math.round((offsetSec / 60) * 10) / 10 : `> ${simMinutes} min`;

    // Health / Consistency status
    let status: 'OPTIMAL' | 'REFINED' | 'FLAGGED' = 'OPTIMAL';
    const notes: string[] = [];

    if (peakCe < 0.05 && drug.category !== 'fluid_crystalloid' && drug.category !== 'blood_product') {
      status = 'FLAGGED';
      notes.push('Exposição Ce excessivamente baixa');
    }

    if (drug.category === 'induction' && trace.minConsciousness > 0 && drug.id !== 'guaifenesin' && drug.id !== 'ketamine') {
      status = 'FLAGGED';
      notes.push('Indutor não atingiu inconsciência cirúrgica');
    }

    if (drug.id === 'ketamine' && trace.maxDissociation < 0.40) {
      status = 'FLAGGED';
      notes.push('Cetamina não atingiu plano dissociativo');
    }

    if (drug.category === 'nmba' && trace.maxMuscleRelaxation < 0.75) {
      status = 'FLAGGED';
      notes.push('NMBA não atingiu relaxamento profundo');
    }

    const minAnalgesiaExpected = drug.id === 'butorphanol' ? 0.28 : (drug.id === 'tramadol' ? 0.18 : 0.40);
    if (drug.category === 'opioid_analgesic' && trace.maxAnalgesia < minAnalgesiaExpected) {
      status = 'FLAGGED';
      notes.push('Opioide com analgesia insuficiente');
    }

    results.push({
      id: drug.id,
      name: drug.name,
      category: drug.category,
      speciesTested: species,
      dosePerKg: Math.round(dosePerKg * 1000) / 1000,
      route,
      tOnsetDesign: drug.onsetMinutes,
      tPeakObservedMin,
      durationDesignMin: drug.durationMinutes,
      durationObservedMin,
      peakCe: Math.round(peakCe * 100) / 100,
      peakCp: Math.round(peakCp * 100) / 100,
      deltaHR: Math.round(trace.maxHeartRate - baseHR),
      deltaMAP: Math.round(trace.maxMap - baseMAP),
      peakEffectLabel,
      peakEffectValue: Math.round(peakEffectValue * 100) / 100,
      eliminatedPct,
      biotransformationPathway: bio.primaryPathway,
      status: notes.length > 0 ? 'FLAGGED' : 'OPTIMAL',
      notes: notes.join('; ') || 'Conforme padrões de referência veterinária',
    });
  }

  return results;
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('audit-full-pharmacopeia')) {
  console.log('=== AUDITORIA FARMACOLÓGICA INTEGRADA (40 FÁRMACOS) ===\n');
  const results = runFullAudit();
  console.table(results.map(r => ({
    Fármaco: r.name,
    Categoria: r.category,
    Dose: `${r.dosePerKg} (${r.route})`,
    't_pico (min)': r.tPeakObservedMin,
    'Duração Obs': r.durationObservedMin,
    'Duração Ref': r.durationDesignMin,
    'Ce Pico': r.peakCe,
    'Efeito Pico': `${r.peakEffectLabel}: ${r.peakEffectValue}`,
    'Elimin (%)': `${r.eliminatedPct}%`,
    Status: r.status,
  })));

  const flagged = results.filter(r => r.status === 'FLAGGED');
  console.log(`\nResumo: ${results.length} auditados | ${results.length - flagged.length} ÓTIMOS | ${flagged.length} FLAGGED`);
  if (flagged.length > 0) {
    console.log('\nFármacos com flags:', flagged.map(f => `${f.name}: ${f.notes}`).join('\n'));
  }
}
