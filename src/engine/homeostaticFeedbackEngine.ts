import type { BiologicalState, PatientProfile, VitalSigns } from '../types/simulator';
import type { PhysiologicalSignal } from './systemCoupling';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

/** Converts delayed organ state into negative and positive feedback messages. */
export class HomeostaticFeedbackEngine {
  public static evaluate(
    patient: PatientProfile,
    state: BiologicalState,
    previousVitals?: VitalSigns
  ): PhysiologicalSignal[] {
    const signals: PhysiologicalSignal[] = [];
    const regulation = state.systemicRegulation || {
      cellularOxygenUtilizationFraction: 1,
      cellularHypoxia: 0,
      myocardialStress: 0,
      arrhythmogenicBurden: 0,
      endothelialDysfunction: 0,
      hepaticInjury: 0,
      renalInjury: 0,
      compensatoryReserve: 1,
    };
    const reserve = clamp(regulation.compensatoryReserve);

    if (regulation.cellularHypoxia > 0.05) {
      const severity = clamp(regulation.cellularHypoxia);
      const compensation = severity * reserve;
      signals.push({
        id: 'cellular-hypoxia-autonomic-feedback',
        source: 'celular',
        targets: ['autonomico', 'cardiovascular', 'respiratorio'],
        topology: 'one-to-many',
        severity,
        label: 'Quimiorreflexo compensatório por hipóxia celular',
        effects: {
          heartRateMultiplier: 1 + compensation * 0.16 - severity * (1 - reserve) * 0.22,
          vascularResistanceMultiplier: 1 + compensation * 0.1 - severity * (1 - reserve) * 0.16,
          respiratoryDriveMultiplier: 1 + compensation * 0.18,
          metabolicCo2Multiplier: 1 + severity * 0.12,
        },
      });
    }

    if (regulation.myocardialStress > 0.08) {
      const stress = clamp(regulation.myocardialStress);
      signals.push({
        id: 'myocardial-stress-positive-feedback',
        source: 'cardiovascular',
        targets: ['cardiovascular', 'celular'],
        topology: 'one-to-many',
        severity: stress,
        label: 'Retroalimentação positiva entre demanda, isquemia e instabilidade elétrica',
        effects: {
          contractilityMultiplier: 1 - stress * 0.16,
          myocardialIschemiaRatePerMinute: stress * 0.08,
          arrhythmogenicBurden: stress * 0.35,
        },
      });
    }

    if (regulation.hepaticInjury > 0.05 || regulation.renalInjury > 0.05) {
      const hepatic = clamp(regulation.hepaticInjury);
      const renal = clamp(regulation.renalInjury);
      signals.push({
        id: 'organ-injury-clearance-feedback',
        source: 'metabolico',
        targets: ['hepatico', 'renal', 'farmacologia'],
        topology: 'one-to-many',
        severity: Math.max(hepatic, renal),
        label: 'Lesão orgânica reduz depuração e amplia exposição farmacológica',
        effects: {
          hepaticPerfusionMultiplier: 1 - hepatic * 0.55,
          renalPerfusionMultiplier: 1 - renal * 0.6,
        },
      });
    }

    const pH = previousVitals?.arterialBloodGases.pH ?? 7.4;
    const acidemia = clamp((7.28 - pH) / 0.38);
    if (acidemia > 0.02) {
      signals.push({
        id: 'acidemia-cardiovascular-depression',
        source: 'metabolico',
        targets: ['cardiovascular', 'respiratorio'],
        topology: 'one-to-many',
        severity: acidemia,
        label: 'Depressão cardiovascular e compensação ventilatória por acidemia',
        effects: {
          contractilityMultiplier: 1 - acidemia * 0.18,
          respiratoryDriveMultiplier: 1 + acidemia * 0.24,
          arrhythmogenicBurden: acidemia * 0.3,
        },
      });
    }

    void patient;
    return signals;
  }
}
