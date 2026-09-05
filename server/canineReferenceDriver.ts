import {
  CANINE_MODEL_ID,
  PHYSIOLOGY_PROTOCOL_VERSION,
  type CaninePatientConfiguration,
  type PhysiologySnapshot,
  type PhysiologyStepInputs,
} from '../src/physiology/protocol';
import { CANINE_REFERENCE_PROFILE_VERSION } from '../src/physiology/canineReferenceModel';

const quantity = (value: number, unit: string) => ({ value, unit });

/**
 * Transport-development fallback. It proves the WebSocket and state contract
 * without pretending to be a physiology engine and can never become monitor
 * authority because its validation grade is `not_validated`.
 */
export class CanineReferenceDriver {
  private patient: CaninePatientConfiguration | null = null;
  private sequence = 0;

  public initialize(patient: CaninePatientConfiguration): void {
    this.patient = patient;
    this.sequence = 0;
  }

  public reset(): void {
    this.sequence = 0;
  }

  public advance(inputs: PhysiologyStepInputs): PhysiologySnapshot {
    if (!this.patient) throw new Error('Paciente canino ainda não inicializado.');
    this.sequence += 1;

    const target = this.patient.targets;
    const cardiacOutputLMin = this.patient.weightKg * 0.165;
    const strokeVolumeMl = cardiacOutputLMin * 1000 / target.heartRatePerMin;
    const centralVenousPressureMmHg = 3.1 / 1.35951;
    const systemicResistance = (target.meanArterialPressureMmHg - centralVenousPressureMmHg)
      / cardiacOutputLMin * 80;
    const tidalVolumeMl = this.patient.weightKg * 12;
    const minuteVentilationLMin = tidalVolumeMl * target.respirationRatePerMin / 1000;

    return {
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      modelId: CANINE_MODEL_ID,
      sequence: this.sequence,
      simulationTimeSeconds: inputs.simulationTimeSeconds,
      generatedAt: new Date().toISOString(),
      executionMode: 'shadow',
      validation: {
        grade: 'not_validated',
        profileVersion: CANINE_REFERENCE_PROFILE_VERSION,
        passedChecks: ['protocol_schema', 'explicit_units', 'finite_baseline'],
        failedChecks: ['native_pulse_execution', 'dynamic_canine_validation'],
      },
      cardiovascular: {
        heartRate: quantity(target.heartRatePerMin, '1/min'),
        systolicPressure: quantity(target.systolicPressureMmHg, 'mmHg'),
        diastolicPressure: quantity(target.diastolicPressureMmHg, 'mmHg'),
        meanArterialPressure: quantity(target.meanArterialPressureMmHg, 'mmHg'),
        cardiacOutput: quantity(cardiacOutputLMin, 'L/min'),
        strokeVolume: quantity(strokeVolumeMl, 'mL'),
        systemicVascularResistance: quantity(systemicResistance, 'dyn*s/cm^5'),
        centralVenousPressure: quantity(centralVenousPressureMmHg, 'mmHg'),
      },
      respiratory: {
        respirationRate: quantity(target.respirationRatePerMin, '1/min'),
        tidalVolume: quantity(tidalVolumeMl, 'mL'),
        minuteVentilation: quantity(minuteVentilationLMin, 'L/min'),
        arterialPaO2: quantity(target.arterialPaO2MmHg, 'mmHg'),
        arterialPaCO2: quantity(target.arterialPaCO2MmHg, 'mmHg'),
        arterialPh: quantity(target.arterialPh, '1'),
        oxygenSaturation: quantity(97, '%'),
      },
      homeostasis: {
        metabolic: {
          oxygenConsumptionRate: quantity(this.patient.weightKg * 6.0, 'mL/min'),
          carbonDioxideProductionRate: quantity(this.patient.weightKg * 6.0 * 0.8, 'mL/min'),
          intracellularFluidPh: quantity(7.0, '1'),
        },
      },
      substances: [],
      events: [{
        id: 'reference-driver-active',
        severity: 'warning',
        messagePt: 'Canal ativo em modo de referência; o worker Pulse canino nativo ainda não está controlando o paciente.',
      }],
    };
  }
}
