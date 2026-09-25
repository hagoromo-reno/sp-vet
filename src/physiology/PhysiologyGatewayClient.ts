import type { PatientProfile, VitalSigns, ActiveDrugDose, AnesthesiaEquipmentState, ActiveSurgicalProcedure } from '../types/simulator';
import { createCaninePatientConfiguration } from './canineReferenceModel';
import { mapDoseToPulseAction } from './pulseActionMapping';
import { buildHybridPharmacologyInput } from './pulseHybridBridge';
import {
  PHYSIOLOGY_PROTOCOL_VERSION,
  type PhysiologyClientMessage,
  type PhysiologyServerMessage,
  type PhysiologySnapshot,
} from './protocol';

export interface PhysiologyGatewayState {
  connection: 'disconnected' | 'connecting' | 'connected' | 'error';
  nativeWorkerAvailable: boolean;
  messagePt: string;
  latestSnapshot?: PhysiologySnapshot;
}

type Listener = (state: PhysiologyGatewayState) => void;

const requestId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `phys-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export class PhysiologyGatewayClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private pendingPatient: PatientProfile | null = null;
  private initialized = false;
  private initializeRequestId: string | null = null;
  private advanceRequestId: string | null = null;
  private pendingAdvance: Parameters<PhysiologyGatewayClient['advance']>[0] | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private state: PhysiologyGatewayState = {
    connection: 'disconnected',
    nativeWorkerAvailable: false,
    messagePt: 'Motor fisiológico local ativo.',
  };

  private static resolveDefaultUrl(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PHYSIOLOGY_WS_URL) {
      return import.meta.env.VITE_PHYSIOLOGY_WS_URL;
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `ws://${window.location.hostname}:8787/physiology`;
    }
    return 'ws://127.0.0.1:8787/physiology';
  }

  public constructor(
    private readonly url = PhysiologyGatewayClient.resolveDefaultUrl()
  ) {}

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    this.shouldReconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.update({ connection: 'connecting', messagePt: 'Conectando ao gateway fisiológico…' });

    try {
      this.socket = new WebSocket(this.url);
    } catch (error) {
      this.update({
        connection: 'error',
        messagePt: error instanceof Error ? error.message : 'Falha ao criar o canal fisiológico.',
      });
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener('open', () => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.update({ connection: 'connected', messagePt: 'Gateway fisiológico conectado.' });
      if (this.pendingPatient) this.initialize(this.pendingPatient);
    });
    this.socket.addEventListener('message', (event) => this.handleMessage(event.data));
    this.socket.addEventListener('error', () => {
      this.update({
        connection: 'error',
        nativeWorkerAvailable: false,
        messagePt: 'Gateway fisiológico indisponível; simulação local preservada.',
      });
      this.scheduleReconnect();
    });
    this.socket.addEventListener('close', () => {
      this.socket = null;
      this.initialized = false;
      this.initializeRequestId = null;
      this.advanceRequestId = null;
      this.update({
        connection: 'disconnected',
        nativeWorkerAvailable: false,
        messagePt: 'Gateway desconectado; simulação local preservada.',
      });
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect && (!this.socket || this.socket.readyState === WebSocket.CLOSED)) {
        this.connect();
      }
    }, 2500);
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  public initialize(patient: PatientProfile): void {
    this.pendingPatient = patient;
    this.initialized = false;
    this.pendingAdvance = null;
    if (patient.species !== 'canine' || this.socket?.readyState !== WebSocket.OPEN) return;
    const id = requestId();
    this.initializeRequestId = id;
    this.send({
      type: 'initialize',
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      requestId: id,
      requestedMode: 'shadow',
      patient: createCaninePatientConfiguration(patient),
    });
  }

  public advance(input: {
    deltaTimeSeconds: number;
    simulationTimeSeconds: number;
    vitals: VitalSigns;
    activeDoses: ActiveDrugDose[];
    equipment: AnesthesiaEquipmentState;
    surgicalStimulus: number;
    surgicalProcedure?: ActiveSurgicalProcedure | null;
  }): void {
    if (this.pendingPatient?.species !== 'canine' || this.socket?.readyState !== WebSocket.OPEN) return;
    if (!this.initialized || this.advanceRequestId) {
      this.pendingAdvance = this.pendingAdvance
        ? {
            ...input,
            deltaTimeSeconds: this.pendingAdvance.deltaTimeSeconds + input.deltaTimeSeconds,
          }
        : input;
      return;
    }
    this.dispatchAdvance(input);
  }

  private dispatchAdvance(input: Parameters<PhysiologyGatewayClient['advance']>[0]): void {
    const id = requestId();
    this.advanceRequestId = id;
    this.send({
      type: 'advance',
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      requestId: id,
      deltaTimeSeconds: input.deltaTimeSeconds,
      inputs: {
        simulationTimeSeconds: input.simulationTimeSeconds,
        localPrediction: {
          heartRate: input.vitals.heartRate,
          systolicBP: input.vitals.systolicBP,
          diastolicBP: input.vitals.diastolicBP,
          meanArterialPressure: input.vitals.meanArterialPressure,
          respiratoryRate: input.vitals.respiratoryRate,
          pulseOximetrySpO2: input.vitals.pulseOximetrySpO2,
          etCO2: input.vitals.etCO2,
          bodyTemperatureC: input.vitals.bodyTemperatureC,
        },
        activeDrugs: input.activeDoses.map((dose) => ({
          id: dose.id,
          drugId: dose.drugId,
          drugName: dose.drugName,
          route: dose.route,
          dosePerKg: dose.dosePerKg,
          currentCp: dose.currentCp,
          currentCe: dose.currentCe,
          isCRI: dose.isCRI,
          criRatePerKgMin: dose.criRatePerKgMin,
          isInfusionRunning: dose.isInfusionRunning,
          nativeAction: mapDoseToPulseAction(dose),
        })),
        equipment: {
          oxygenFlowLMin: input.equipment.oxygenFlowLMin,
          nitrousOxideFlowLMin: input.equipment.nitrousOxideFlowLMin,
          vaporizerType: input.equipment.vaporizerType,
          vaporizerDialPct: input.equipment.vaporizerDialPct,
          isVaporizerOn: input.equipment.isVaporizerOn,
          intubationStatus: input.equipment.intubationStatus,
          tubeSizeMm: input.equipment.tubeSizeMm,
          cuffPressureCmH2O: input.equipment.cuffPressureCmH2O,
          ventilatorMode: input.equipment.ventilatorMode,
          isVentilatorActive: input.equipment.isVentilatorActive,
          ventilatorSettings: input.equipment.ventilatorSettings,
          circuitType: input.equipment.circuitType,
          activeFluidType: input.equipment.activeFluidType,
          totalFluidsInfusedMl: input.equipment.totalFluidsInfusedMl,
          fluidRateMlPerHour: input.equipment.fluidRateMlPerHour,
          isFluidPumpRunning: input.equipment.isFluidPumpRunning,
        },
        surgicalStimulus: input.surgicalStimulus,
        surgicalProcedure: input.surgicalProcedure ? {
          id: input.surgicalProcedure.id,
          name: input.surgicalProcedure.name,
          tissueLayer: input.surgicalProcedure.tissueLayer,
        } : undefined,
        hybridPharmacology: this.pendingPatient
          ? buildHybridPharmacologyInput(this.pendingPatient, input.activeDoses, input.equipment, input.vitals)
          : undefined,
      },
    });
  }

  public reset(patient: PatientProfile | null = this.pendingPatient): void {
    this.initialized = false;
    this.initializeRequestId = null;
    this.advanceRequestId = null;
    this.pendingAdvance = null;
    this.send({
      type: 'reset',
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      requestId: requestId(),
    });
    if (patient) this.initialize(patient);
  }

  private send(message: PhysiologyClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private handleMessage(raw: unknown): void {
    try {
      const message = JSON.parse(String(raw)) as PhysiologyServerMessage;
      if (message.protocolVersion !== PHYSIOLOGY_PROTOCOL_VERSION) {
        this.update({ connection: 'error', messagePt: 'Versão incompatível do protocolo fisiológico.' });
        return;
      }
      if (message.type === 'status') {
        this.update({
          connection: message.connected ? 'connected' : 'disconnected',
          nativeWorkerAvailable: message.nativeWorkerAvailable,
          messagePt: message.messagePt,
        });
      } else if (message.type === 'snapshot') {
        this.update({ latestSnapshot: message.snapshot });
        if (message.requestId === this.advanceRequestId) {
          this.advanceRequestId = null;
          this.flushPendingAdvance();
        }
      } else if (message.type === 'ack') {
        if (message.requestId === this.initializeRequestId) {
          this.initializeRequestId = null;
          this.initialized = true;
          this.flushPendingAdvance();
        }
      } else if (message.type === 'error') {
        this.update({ messagePt: message.messagePt });
        if (message.requestId === this.initializeRequestId) {
          this.initializeRequestId = null;
          this.initialized = false;
        }
        if (message.requestId === this.advanceRequestId) {
          this.advanceRequestId = null;
          this.flushPendingAdvance();
        }
      }
    } catch {
      this.update({ connection: 'error', messagePt: 'Gateway enviou uma resposta inválida.' });
    }
  }

  private flushPendingAdvance(): void {
    if (!this.initialized || this.advanceRequestId || !this.pendingAdvance) return;
    const pending = this.pendingAdvance;
    this.pendingAdvance = null;
    this.dispatchAdvance(pending);
  }

  private update(patch: Partial<PhysiologyGatewayState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
