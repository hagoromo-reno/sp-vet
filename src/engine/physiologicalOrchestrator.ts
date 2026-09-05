import type { BiologicalState, PatientProfile, VitalSigns } from '../types/simulator';
import type { ReceptorStateSnapshot } from './cellularReceptors';
import { DrugInteractionEffectsEngine } from './drugInteractionEffects';
import { HomeostaticFeedbackEngine } from './homeostaticFeedbackEngine';
import { ToxicologyEngine } from './toxicologyEngine';
import {
  aggregatePhysiologicalSignals,
  type PhysiologicalModifiers,
  type PhysiologicalSignal,
} from './systemCoupling';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const approach = (current: number, target: number, dt: number, tau: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / Math.max(0.1, tau)));

export interface PhysiologicalOrchestrationResult {
  state: BiologicalState;
  signals: PhysiologicalSignal[];
  modifiers: PhysiologicalModifiers;
}

/**
 * Message-bus orchestrator. Engines do not call each other; they publish typed
 * signals, which are merged deterministically and then consumed by organ solvers.
 */
export class PhysiologicalOrchestrator {
  public static step(
    dtSeconds: number,
    patient: PatientProfile,
    state: BiologicalState,
    receptors: ReceptorStateSnapshot,
    previousVitals?: VitalSigns
  ): PhysiologicalOrchestrationResult {
    const signals = [
      ...DrugInteractionEffectsEngine.evaluate(patient, receptors),
      ...ToxicologyEngine.evaluate(patient, state, receptors),
      ...HomeostaticFeedbackEngine.evaluate(patient, state, previousVitals),
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
      compensatoryReserve: 1,
    };
    // Systemic cellular oxygen stress follows effective DO2 primarily. The
    // lowest regional perfusion is retained as a smaller local-organ component;
    // using it alone would incorrectly label isolated renal hypoperfusion as
    // near-total whole-body hypoxia.
    const deliveryDeficit = clamp((10 - state.organPerfusion.oxygenDeliveryMlKgMin) / 10);
    const regionalPerfusionDeficit = clamp(
      1 - Math.min(
        state.organPerfusion.cerebralFraction,
        state.organPerfusion.hepaticFraction,
        state.organPerfusion.renalFraction
      )
    );
    const oxygenSupplyDeficit = clamp(Math.max(deliveryDeficit, regionalPerfusionDeficit * 0.38));
    const utilizationDeficit = 1 - modifiers.cellularOxygenUtilizationFraction;
    const cellularHypoxiaTarget = clamp(Math.max(oxygenSupplyDeficit, utilizationDeficit));
    const myocardialStressTarget = clamp(
      modifiers.arrhythmogenicBurden * 0.55
        + modifiers.myocardialIschemiaRatePerMinute * 1.8
        + (previousVitals?.myocardialIschemiaScore || 0) * 0.7
    );
    const sustainedCellularInjury = Math.max(0, previous.cellularHypoxia - 0.22);
    const hepaticInjuryTarget = clamp(sustainedCellularInjury * 0.55 + state.biotransformation.hepaticEnzymeSaturation * 0.12);
    const renalInjuryTarget = clamp(sustainedCellularInjury * 0.62 + state.biotransformation.renalTransportSaturation * 0.15);
    const stressLoad = clamp(cellularHypoxiaTarget * 0.55 + myocardialStressTarget * 0.45);
    const reserveTarget = clamp(1 - stressLoad * 0.9);

    const nextRegulation: BiologicalState['systemicRegulation'] = {
      cellularOxygenUtilizationFraction: approach(
        previous.cellularOxygenUtilizationFraction,
        modifiers.cellularOxygenUtilizationFraction,
        dtSeconds,
        modifiers.cellularOxygenUtilizationFraction < previous.cellularOxygenUtilizationFraction ? 8 : 180
      ),
      cellularHypoxia: approach(previous.cellularHypoxia, cellularHypoxiaTarget, dtSeconds, cellularHypoxiaTarget > previous.cellularHypoxia ? 18 : 240),
      myocardialStress: approach(previous.myocardialStress, myocardialStressTarget, dtSeconds, myocardialStressTarget > previous.myocardialStress ? 12 : 180),
      arrhythmogenicBurden: approach(previous.arrhythmogenicBurden, modifiers.arrhythmogenicBurden, dtSeconds, modifiers.arrhythmogenicBurden > previous.arrhythmogenicBurden ? 5 : 90),
      endothelialDysfunction: approach(previous.endothelialDysfunction, clamp(utilizationDeficit * 0.45), dtSeconds, utilizationDeficit > 0.2 ? 120 : 1200),
      hepaticInjury: approach(previous.hepaticInjury, hepaticInjuryTarget, dtSeconds, hepaticInjuryTarget > previous.hepaticInjury ? 900 : 7200),
      renalInjury: approach(previous.renalInjury, renalInjuryTarget, dtSeconds, renalInjuryTarget > previous.renalInjury ? 1200 : 10800),
      compensatoryReserve: approach(previous.compensatoryReserve, reserveTarget, dtSeconds, reserveTarget < previous.compensatoryReserve ? 300 : 1800),
    };

    return {
      state: { ...state, systemicRegulation: nextRegulation },
      signals,
      modifiers: {
        ...modifiers,
        cellularOxygenUtilizationFraction: nextRegulation.cellularOxygenUtilizationFraction,
      },
    };
  }
}
