import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SimulationHeader, WORKSTATIONS, WorkstationId } from './components/SimulationHeader';
import { ClinicalSnapshot } from './components/monitor/ClinicalSnapshot';
import {
  ActiveDrugDose,
  ActiveNociceptiveTest,
  ActiveSurgicalProcedure,
  AnesthesiaEquipmentState,
  LogEntry,
  MonitorAlarmLimits,
  NociceptiveTestDefinition,
  PatientProfile,
  ResuscitationState,
  SurgicalProcedureDefinition,
  VitalRecordPoint,
  VitalSigns,
} from './types/simulator';
import { PRESET_SCENARIOS } from './data/scenarios';
import { SPECIES_DATABASE } from './data/speciesData';
import { VETERINARY_DRUG_DATABASE } from './data/drugDatabase';
import { PKPDEngine } from './engine/pkpdEngine';
import {
  calculateAdministration,
  getRoutePharmacokinetics,
  getSpeciesDoseRange,
  isTimeBasedDoseUnit,
  validateAdministrationCommand,
} from './engine/drugAdministration';
import { AudioSynthesizer, ActiveAlarmStatus } from './engine/audioSynthesizer';
import { formatSpecies } from './utils/formatters';
import { CanvasWaveforms } from './components/monitor/CanvasWaveforms';
import { VitalNumbers } from './components/monitor/VitalNumbers';
import { ClinicalAlertRibbon } from './components/monitor/ClinicalAlertRibbon';
import { ClinicalOccurrenceCenter } from './components/monitor/ClinicalOccurrenceCenter';
import { PatientPhysicalExam } from './components/patient/PatientPhysicalExam';
import { VaporizerMachine } from './components/anesthesia/VaporizerMachine';
import { VentilatorAirway } from './components/airway/VentilatorAirway';
import { DrugAdministrationModal } from './components/pharmacology/DrugAdministrationModal';
import { CirculatingDrugsPanel } from './components/pharmacology/CirculatingDrugsPanel';
import { FluidTherapyPanel } from './components/fluids/FluidTherapyPanel';
import { CPCRResuscitationPanel } from './components/emergency/CPCRResuscitationPanel';
import { AnesthesiaRecordSheet } from './components/records/AnesthesiaRecordSheet';
import { ScenarioSelectorModal } from './components/scenarios/ScenarioSelectorModal';
import { DeathReportModal } from './components/emergency/DeathReportModal';
import { CellularPhysiologyModal } from './components/monitor/CellularPhysiologyModal';
import { AirwayQuickBar } from './components/airway/AirwayQuickBar';
import { AnestheticDepthBoard } from './components/monitor/AnestheticDepthBoard';
import { GeneralEventLogModal } from './components/records/GeneralEventLogModal';
import { EmergencyFeedbackToast, EmergencyFeedbackItem } from './components/emergency/EmergencyFeedbackToast';
import { LaryngealReflexModal } from './components/airway/LaryngealReflexModal';
import { AudioSettingsModal } from './components/monitor/AudioSettingsModal';
import { ExpertReviewPanel, downloadRecord } from './components/records/ExpertReviewPanel';
import { useSimulationRecording } from './records/useSimulationRecording';
import type { SimulationRun } from './records/simulationRecord';
import { speciesAlarmLimits } from './data/monitorDefaults';
import { nextSimulationStep } from './engine/simulationClock';
import { useAuth } from './context/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { PendingPaymentScreen } from './components/auth/PendingPaymentScreen';
import { AdminManagementModal } from './components/admin/AdminManagementModal';
import { SavePerspectiveModal } from './components/records/SavePerspectiveModal';
import { AdminMonitorOverrideModal } from './components/monitor/AdminMonitorOverrideModal';
import { applyAdminMonitorOverrides } from './engine/adminMonitorProfile';
import { AdminMonitorOverrides, DEFAULT_MONITOR_OVERRIDES } from './types/simulator';
import {
  Activity,
  Syringe,
  Wind,
  Droplet,
  HeartPulse,
  FileText,
  Stethoscope,
} from 'lucide-react';

function SimulatorApp() {
  const { isAuthenticated, isPendingPayment, isLoading } = useAuth();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSavePerspectiveModalOpen, setIsSavePerspectiveModalOpen] = useState(false);

  // Guard Audio and Alarms against unauthenticated or pending payment state
  useEffect(() => {
    const isFullyActive = isAuthenticated && !isPendingPayment;
    AudioSynthesizer.setAuthenticated(isFullyActive);
    if (!isFullyActive) {
      AudioSynthesizer.stopAlarmPlayback();
    }
  }, [isAuthenticated, isPendingPayment]);

  // 1. ACTIVE PATIENT & SCENARIO
  const [patient, setPatient] = useState<PatientProfile>(PRESET_SCENARIOS[0]);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [isCellularModalOpen, setIsCellularModalOpen] = useState(false);

  // 2. SIMULATION CLOCK & CONTROLS
  const [isSimPaused, setIsSimPaused] = useState(false);
  useEffect(() => {
    if (isSimPaused || !isAuthenticated) AudioSynthesizer.stopAlarmPlayback();
    return () => AudioSynthesizer.stopAlarmPlayback();
  }, [isSimPaused, isAuthenticated]);
  const [simSpeed, setSimSpeed] = useState<number>(1.0); // 1x, 2x, 5x
  const [simTimeSeconds, setSimTimeSeconds] = useState<number>(0);

  // 3. EQUIPMENT STATE
  const [equipment, setEquipment] = useState<AnesthesiaEquipmentState>(() => {
    const defaultSpeciesInfo = SPECIES_DATABASE[PRESET_SCENARIOS[0].species];
    return {
      oxygenFlowLMin: 1.5,
      nitrousOxideFlowLMin: 0.0,
      vaporizerType: 'isoflurane',
      vaporizerDialPct: 0.0,
      isVaporizerOn: false,
      circuitType: 'circle_rebreathing_adult',
      sodaLimeExhaustionPct: 5.0,
      aplValveState: 'open',
      reservoirBagVolumeMl: 1000,
      isOxygenFlushActive: false,
      intubationStatus: 'unintubated',
      tubeSizeMm: 8.5,
      cuffPressureCmH2O: 0,
      ventilatorMode: 'spontaneous',
      isVentilatorActive: false,
      ventilatorSettings: {
        rateBpm: defaultSpeciesInfo.normalVitals.rrTypical,
        tidalVolumeMl: Math.round(PRESET_SCENARIOS[0].weightKg * 12),
        peepCmH2O: 0,
        ieRatio: '1:2',
        pipPressureLimitCmH2O: 18,
        inspiratoryPausePct: 10,
      },
      currentAirwayPressureCmH2O: 0,
      activeFluidType: 'Ringer com Lactato (LRS)',
      fluidRateMlPerHour: 0,
      totalFluidsInfusedMl: 0,
      fluidBoluses: [],
      fluidTemperatureC: 22,
      isFluidPumpRunning: false,
      warmingBlanketActive: false,
      warmingBlanketTempC: 38.5,
      isLarynxDesensitized: false,
      larynxDesensitizedUntilSimTime: 0,
    };
  });

  // 4. ACTIVE DRUGS & RESUSCITATION
  const [activeDoses, setActiveDoses] = useState<ActiveDrugDose[]>([]);
  const [resuscitation, setResuscitation] = useState<ResuscitationState>({
    isCPRActive: false,
    compressionsPerMin: 110,
    lastCompressionSimTime: 0,
    compressionDepthQuality: 0.8,
    defibrillatorChargedJoules: 0,
    isDefibrillatorArmed: false,
  });

  // 5. STIMULATION & INTERACTION
  const [activeSurgicalProcedure, setActiveSurgicalProcedure] = useState<ActiveSurgicalProcedure | null>(null);
  const [activeNociceptiveTest, setActiveNociceptiveTest] = useState<ActiveNociceptiveTest | null>(null);

  // 6. VITALS STATE
  const [vitals, setVitals] = useState<VitalSigns>(() => {
    const { vitals } = PKPDEngine.stepSimulation(
      0.1,
      0,
      PRESET_SCENARIOS[0],
      [],
      equipment,
      resuscitation,
      false
    );
    return vitals;
  });

  // 7. LOGS & RECORDS
  const [vitalLogs, setVitalLogs] = useState<VitalRecordPoint[]>([]);
  const [eventLogs, setEventLogs] = useState<LogEntry[]>([
    {
      id: 'init',
      simTimeSeconds: 0,
      realTimestamp: new Date().toLocaleTimeString(),
      type: 'system',
      message: `Simulação iniciada para ${PRESET_SCENARIOS[0].name} (${formatSpecies(PRESET_SCENARIOS[0].species).toUpperCase()})`,
      severity: 'normal',
    },
  ]);

  // 8. ALARMS & SOUND
  const [alarmLimits, setAlarmLimits] = useState<MonitorAlarmLimits>(() => speciesAlarmLimits(PRESET_SCENARIOS[0].species));
  const [activeAlarmStatus, setActiveAlarmStatus] = useState<ActiveAlarmStatus | null>(null);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);

  // 9. ACTIVE WORKSTATION TAB & MODALS
  const [requestedDrugId, setRequestedDrugId] = useState<string>();
  const [activeTab, setActiveTab] = useState<
    'drugs' | 'machine_airway' | 'physical_exam' | 'fluids_thermal' | 'emergency_cpr' | 'records'
  >('drugs');
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const workstationRef = useRef<HTMLElement>(null);
  const selectWorkstation = (tab: WorkstationId) => {
    setActiveTab(tab);
    workstationRef.current?.scrollIntoView({ block: 'start' });
  };
  const [isDeathModalOpen, setIsDeathModalOpen] = useState(false);
  const [isDepthBoardOpen, setIsDepthBoardOpen] = useState(false);
  const [isGeneralLogOpen, setIsGeneralLogOpen] = useState(false);
  const [isLaryngealReflexModalOpen, setIsLaryngealReflexModalOpen] = useState(false);
  const [pendingIntubationTubeSize, setPendingIntubationTubeSize] = useState<number>(8.5);
  const [feedbackToast, setFeedbackToast] = useState<EmergencyFeedbackItem | null>(null);
  const [clinicalOccurrenceHistory, setClinicalOccurrenceHistory] = useState<EmergencyFeedbackItem[]>([]);
  const [isOccurrenceCenterOpen, setIsOccurrenceCenterOpen] = useState(false);

  // Admin / Instructor Monitor Overrides
  const [adminMonitorOverrides, setAdminMonitorOverrides] = useState<AdminMonitorOverrides>(DEFAULT_MONITOR_OVERRIDES);
  const [isAdminMonitorModalOpen, setIsAdminMonitorModalOpen] = useState<boolean>(false);

  // 10. NIBP / IBP STATE
  const [isNibpMeasuring, setIsNibpMeasuring] = useState(false);
  const [lastNibpMeasurement, setLastNibpMeasurement] = useState<{
    sys: number;
    dia: number;
    map: number;
    timestampSimSec: number;
  } | null>(null);
  const [nibpAutoIntervalMin, setNibpAutoIntervalMin] = useState<number>(3);
  const [isContinuousIbpActive, setIsContinuousIbpActive] = useState<boolean>(false);

  const prevDeadStateRef = useRef<boolean>(false);
  const prevArrestStateRef = useRef<boolean>(false);
  const lastNibpAutoTriggerRef = useRef<number>(0);
  const nibpMeasureStartRef = useRef<number>(0);
  const lastLogSimTimeRef = useRef<number>(0);
  const oxygenFlushEndSimTimeRef = useRef<number>(0);
  const previousClinicalAlertKeysRef = useRef<Set<string>>(new Set());

  const observation = {
    simTimeSeconds, vitals, equipment, doses: activeDoses, resuscitation,
    surgical: activeSurgicalProcedure, nociceptive: activeNociceptiveTest, paused: isSimPaused, speed: simSpeed,
    monitor: { continuousBP: isContinuousIbpActive, nibp: lastNibpMeasurement, measuring: isNibpMeasuring, autoIntervalMin: nibpAutoIntervalMin, alarmLimits },
  };
  const recording = useSimulationRecording(patient, observation, eventLogs);
  const [reviewRuns, setReviewRuns] = useState<SimulationRun[] | null>(null);
  const openExpertReview = async () => {
    setIsSimPaused(true);
    try { setReviewRuns(await recording.flush()); }
    catch { setReviewRuns([structuredClone(recording.recorder.current!.run)]); }
  };

  // Effective vitals displayed on monitor (including forced instructor/admin overrides)
  const displayVitals = useMemo(() => {
    return applyAdminMonitorOverrides(vitals, adminMonitorOverrides);
  }, [vitals, adminMonitorOverrides]);

  // Auto-open death report on transition to dead
  useEffect(() => {
    if (vitals.isDead && !prevDeadStateRef.current) {
      setIsDeathModalOpen(true);
      setIsSimPaused(true);
    }
    prevDeadStateRef.current = vitals.isDead;
  }, [vitals.isDead]);

  // Every transient feedback is also retained in the occurrence center.
  useEffect(() => {
    if (!feedbackToast) return;
    const storedItem = { ...feedbackToast, simTimeSeconds: feedbackToast.simTimeSeconds ?? simTimeSeconds };
    setClinicalOccurrenceHistory((previous) => previous.some((item) => item.id === storedItem.id)
      ? previous
      : [...previous, storedItem]);
  }, [feedbackToast]);

  // Convert newly-emergent interactions and physiological warnings into
  // dismissible notifications without repeating them on every simulation tick.
  useEffect(() => {
    const active = new Map<string, Omit<EmergencyFeedbackItem, 'id' | 'simTimeSeconds'>>();
    for (const interaction of vitals.activeDrugInteractions) {
      active.set(`interacao:${interaction.title}`, {
        title: interaction.title,
        message: `${interaction.description} Mecanismo: ${interaction.pharmacologyMechanism}`,
        type: interaction.severity === 'lethal' || interaction.severity === 'danger' ? 'danger' : 'drug',
        category: 'Interação farmacológica',
        severity: interaction.severity === 'lethal' || interaction.severity === 'danger' ? 'crítico' : interaction.severity === 'warning' ? 'atenção' : 'informação',
      });
    }
    if (vitals.impendingArrestWarning) {
      active.set(`deterioracao:${vitals.impendingArrestWarning.type}`, {
        title: vitals.impendingArrestWarning.headline,
        message: `${vitals.impendingArrestWarning.details} Conduta sugerida: ${vitals.impendingArrestWarning.recommendedAction}`,
        type: 'danger', category: 'Deterioração fisiológica', severity: 'crítico',
      });
    }
    if (vitals.isRespiratoryArrest) active.set('parada:respiratoria', {
      title: 'Parada respiratória', message: vitals.respiratoryArrestCause || 'Cessação do impulso respiratório espontâneo.',
      type: 'danger', category: 'Sistema respiratório', severity: 'crítico',
    });
    if (vitals.isCardiacArrest) active.set('parada:cardiaca', {
      title: 'Parada cardiorrespiratória', message: vitals.cardiacArrestCause || 'Ausência de circulação espontânea efetiva.',
      type: 'danger', category: 'Sistema cardiovascular', severity: 'crítico',
    });
    if (vitals.biologicalState.metabolic.nitroprussideToxicMetaboliteBurden > 0.2) active.set('toxicidade:nitroprussiato', {
      title: 'Acúmulo de metabólitos do nitroprussiato',
      message: 'A formação de cianeto/tiocianato está superando a capacidade hepatorrenal de depuração. Reavaliar taxa e duração da infusão.',
      type: 'danger', category: 'Toxicidade metabólica', severity: 'crítico',
    });

    const newItems: EmergencyFeedbackItem[] = [];
    for (const [key, item] of active) {
      if (!previousClinicalAlertKeysRef.current.has(key)) {
        newItems.push({ ...item, id: `${key}:${Math.round(simTimeSeconds * 10)}`, simTimeSeconds });
      }
    }
    previousClinicalAlertKeysRef.current = new Set(active.keys());
    if (newItems.length > 0) {
      setClinicalOccurrenceHistory((previous) => [...previous, ...newItems.filter((item) => !previous.some((old) => old.id === item.id))]);
      setFeedbackToast(newItems.find((item) => item.severity === 'crítico') || newItems[0]);
    }
  }, [vitals.activeDrugInteractions, vitals.impendingArrestWarning, vitals.isRespiratoryArrest, vitals.isCardiacArrest, vitals.biologicalState.metabolic.nitroprussideToxicMetaboliteBurden]);

  // SIMULATION TICK LOOP (Interval at 10 Hz)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isAuthenticated || isSimPaused) return;

      const { dt, newSimTime } = nextSimulationStep(simTimeSeconds, simSpeed);
      setSimTimeSeconds(newSimTime);

      // Check NIBP auto-cycle
      if (
        nibpAutoIntervalMin > 0 &&
        !isNibpMeasuring &&
        !vitals.isDead &&
        newSimTime - lastNibpAutoTriggerRef.current >= nibpAutoIntervalMin * 60
      ) {
        lastNibpAutoTriggerRef.current = newSimTime;
        nibpMeasureStartRef.current = newSimTime;
        setIsNibpMeasuring(true);
      }

      // Check NIBP inflation completion (3.0 simulated seconds)
      if (isNibpMeasuring && newSimTime - nibpMeasureStartRef.current >= 3.0) {
        setIsNibpMeasuring(false);
        setLastNibpMeasurement({
          sys: Math.round(vitals.systolicBP),
          dia: Math.round(vitals.diastolicBP),
          map: Math.round(vitals.meanArterialPressure),
          timestampSimSec: newSimTime,
        });
      }

      // Check Manual Ventilation Cadence (e.g. squeeze every 6s)
      let cadenceUpdates: Partial<AnesthesiaEquipmentState> = {};
      if (activeSurgicalProcedure && newSimTime >= activeSurgicalProcedure.endsAtSimTime) {
        setActiveSurgicalProcedure(null);
      }
      let activeSurgicalStimulus = activeSurgicalProcedure
        && newSimTime < activeSurgicalProcedure.endsAtSimTime
        ? activeSurgicalProcedure.intensity
        : 0;
      if (activeSurgicalProcedure && activeSurgicalStimulus > 0) {
        const targetReg = activeSurgicalProcedure.targetRegion || 'abdomen_flank';
        const block = vitals.cellularState?.regionalBlockByRegion?.[targetReg] ?? vitals.cellularState?.localNeuralBlockade ?? 0;
        activeSurgicalStimulus *= Math.max(0, 1 - block * 1.15);
      }

      if (activeNociceptiveTest && newSimTime >= activeNociceptiveTest.endsAtSimTime) {
        setActiveNociceptiveTest(null);
      }
      let activeNociceptiveStimulus = activeNociceptiveTest
        && newSimTime < activeNociceptiveTest.endsAtSimTime
        ? activeNociceptiveTest.intensity
        : 0;
      if (activeNociceptiveTest && activeNociceptiveStimulus > 0) {
        const targetReg = activeNociceptiveTest.targetRegion || 'pelvic_limb';
        const block = vitals.cellularState?.regionalBlockByRegion?.[targetReg] ?? vitals.cellularState?.localNeuralBlockade ?? 0;
        activeNociceptiveStimulus *= Math.max(0, 1 - block * 1.15);
      }

      const combinedNoxiousStimulus = Math.max(activeSurgicalStimulus, activeNociceptiveStimulus);

      if (equipment.isOxygenFlushActive && newSimTime >= oxygenFlushEndSimTimeRef.current) {
        cadenceUpdates.isOxygenFlushActive = false;
      }
      if (
        equipment.manualVentilationCadenceSeconds &&
        equipment.manualVentilationCadenceSeconds > 0 &&
        equipment.intubationStatus === 'intubated_tracheal' &&
        newSimTime - (equipment.manualBreathLastTriggerTime || 0) >= equipment.manualVentilationCadenceSeconds
      ) {
        cadenceUpdates = {
          ...cadenceUpdates,
          isManualBreathTriggered: true,
          manualBreathLastTriggerTime: newSimTime,
        };
      }

      const activeEquipment = Object.keys(cadenceUpdates).length > 0 ? { ...equipment, ...cadenceUpdates } : equipment;

      // Run PK/PD integration
      const { vitals: newVitals, updatedDoses, equipmentUpdates } = PKPDEngine.stepSimulation(
        dt,
        newSimTime,
        patient,
        activeDoses,
        activeEquipment,
        resuscitation,
        combinedNoxiousStimulus,
        vitals
      );

      // Evaluate medical monitor alarms (IEC 60601-1-8 standard)
      const alarmStatus = AudioSynthesizer.evaluateAndTriggerAlarms(newVitals, alarmLimits, dt);
      setActiveAlarmStatus(alarmStatus);

      // Check ROSC transition (Return of Spontaneous Circulation)
      if (prevArrestStateRef.current && !newVitals.isCardiacArrest && !newVitals.isDead) {
        setFeedbackToast({
          id: `rosc_${Date.now()}`,
          title: 'RETORNO DA CIRCULAÇÃO ESPONTÂNEA (ROSC)!',
          message: `Ritmo sinusal restabelecido! Pico de EtCO2 detectado (${newVitals.etCO2} mmHg).`,
          type: 'rosc',
        });
        setEventLogs((prev) => [
          ...prev,
          {
            id: `rosc_${Date.now()}`,
            simTimeSeconds: newSimTime,
            realTimestamp: new Date().toLocaleTimeString(),
            type: 'emergency',
            message: 'ROSC ALCANÇADO COM SUCESSO! Ritmo sinusal restabelecido.',
            details: `FC: ${newVitals.heartRate} bpm · PAM: ${newVitals.meanArterialPressure} mmHg · EtCO2: ${newVitals.etCO2} mmHg`,
            severity: 'success',
          },
        ]);
      }
      prevArrestStateRef.current = newVitals.isCardiacArrest;

      setVitals(newVitals);
      setActiveDoses(updatedDoses);

      const mergedEquipmentUpdates = { ...cadenceUpdates, ...equipmentUpdates };
      if (Object.keys(mergedEquipmentUpdates).length > 0) {
        setEquipment((prev) => ({ ...prev, ...mergedEquipmentUpdates }));
      }

      // Check for automatic 30-sec vital record
      if (newSimTime >= lastLogSimTimeRef.current + 30) {
        lastLogSimTimeRef.current = Math.floor(newSimTime / 30) * 30;
        const mins = Math.floor(newSimTime / 60);
        const secs = Math.floor(newSimTime % 60);
        const timeLabel = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        setVitalLogs((prev) => [
          ...prev,
          {
            simTimeSeconds: newSimTime,
            timeLabel,
            hr: Math.round(newVitals.heartRate),
            sysBP: Math.round(newVitals.systolicBP),
            diaBP: Math.round(newVitals.diastolicBP),
            map: Math.round(newVitals.meanArterialPressure),
            spo2: Math.round(newVitals.pulseOximetrySpO2),
            etco2: Math.round(newVitals.etCO2),
            rr: Math.round(newVitals.respiratoryRate),
            tempC: Number(newVitals.bodyTemperatureC.toFixed(1)),
            glucoseMgDl: Math.round(newVitals.arterialBloodGases.glucoseMgDl),
            painScore: newVitals.painScore,
            activityLevelPct: newVitals.activityLevelPct,
            vaporizerPct: equipment.vaporizerDialPct,
            depthScore: newVitals.anestheticDepthScore,
          },
        ]);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [
    isAuthenticated,
    isSimPaused,
    simSpeed,
    simTimeSeconds,
    patient,
    activeDoses,
    equipment,
    resuscitation,
    activeSurgicalProcedure,
    activeNociceptiveTest,
    isNibpMeasuring,
    nibpAutoIntervalMin,
    vitals,
    alarmLimits,
  ]);

  // RESET SIMULATION
  const resetSimulationForPatient = (targetPatient: PatientProfile) => {
    const defaultSpeciesInfo = SPECIES_DATABASE[targetPatient.species];
    const freshEquipment: AnesthesiaEquipmentState = {
      oxygenFlowLMin: 1.5,
      nitrousOxideFlowLMin: 0.0,
      vaporizerType: 'isoflurane',
      vaporizerDialPct: 0.0,
      isVaporizerOn: false,
      circuitType: 'circle_rebreathing_adult',
      sodaLimeExhaustionPct: 5.0,
      aplValveState: 'open',
      reservoirBagVolumeMl: 1000,
      isOxygenFlushActive: false,
      intubationStatus: 'unintubated',
      tubeSizeMm: defaultSpeciesInfo.recommendedEtTubeRange.min + 0.5,
      cuffPressureCmH2O: 0,
      ventilatorMode: 'spontaneous',
      isVentilatorActive: false,
      ventilatorSettings: {
        rateBpm: defaultSpeciesInfo.normalVitals.rrTypical,
        tidalVolumeMl: Math.round(targetPatient.weightKg * 12),
        peepCmH2O: 0,
        ieRatio: '1:2',
        pipPressureLimitCmH2O: 18,
        inspiratoryPausePct: 10,
      },
      currentAirwayPressureCmH2O: 0,
      manualVentilationCadenceSeconds: 0,
      activeFluidType: 'Ringer com Lactato (LRS)',
      fluidRateMlPerHour: 0,
      totalFluidsInfusedMl: 0,
      fluidBoluses: [],
      fluidTemperatureC: 22,
      isFluidPumpRunning: false,
      warmingBlanketActive: false,
      warmingBlanketTempC: 38.5,
      isLarynxDesensitized: false,
      larynxDesensitizedUntilSimTime: 0,
    };

    const freshResuscitation: ResuscitationState = {
      isCPRActive: false,
      compressionsPerMin: 110,
      lastCompressionSimTime: 0,
      compressionDepthQuality: 0.8,
      defibrillatorChargedJoules: 0,
      isDefibrillatorArmed: false,
    };

    // Calculate fresh vitals with undefined previousVitals to clear all death/arrest accumulators
    const { vitals: freshVitals } = PKPDEngine.stepSimulation(
      0.1,
      0,
      targetPatient,
      [],
      freshEquipment,
      freshResuscitation,
      false,
      undefined
    );

    const freshAlarmLimits = speciesAlarmLimits(targetPatient.species, alarmLimits.isAudioMuted);
    setAlarmLimits(freshAlarmLimits);
    setActiveAlarmStatus(null);
    recording.restart(targetPatient, { ...observation, simTimeSeconds: 0, vitals: freshVitals,
      equipment: freshEquipment, resuscitation: freshResuscitation, doses: [], surgical: null, nociceptive: null,
      paused: false, monitor: { ...observation.monitor, nibp: null, measuring: false, alarmLimits: freshAlarmLimits } });
    setVitals(freshVitals);
    setEquipment(freshEquipment);
    setResuscitation(freshResuscitation);
    setActiveDoses([]);
    setVitalLogs([]);
    setSimTimeSeconds(0);
    setIsSimPaused(false);
    setIsDeathModalOpen(false);
    setIsNibpMeasuring(false);
    setLastNibpMeasurement(null);
    lastLogSimTimeRef.current = 0;
    lastNibpAutoTriggerRef.current = 0;
    prevDeadStateRef.current = false;
    prevArrestStateRef.current = false;
    oxygenFlushEndSimTimeRef.current = 0;
    setActiveSurgicalProcedure(null);
    setActiveNociceptiveTest(null);
    setClinicalOccurrenceHistory([]);
    previousClinicalAlertKeysRef.current = new Set();

    setFeedbackToast({
      id: `reset_${Date.now()}`,
      title: 'Caso Reiniciado do Início',
      message: `Simulação para ${targetPatient.name} (${formatSpecies(targetPatient.species).toUpperCase()}) retornou ao estado basal (00:00).`,
      type: 'airway',
    });

    setEventLogs([
      {
        id: `reset_${Date.now()}`,
        simTimeSeconds: 0,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'system',
        message: `Simulação reiniciada para ${targetPatient.name} (${formatSpecies(targetPatient.species).toUpperCase()})`,
        severity: 'normal',
      },
    ]);
  };

  const handleResetSimulation = () => {
    AudioSynthesizer.stopAlarmPlayback();
    resetSimulationForPatient(patient);
  };

  // QUICK MANUAL BREATH TRIGGER (Apertar Balão)
  const handleTriggerManualBreath = () => {
    if (equipment.intubationStatus !== 'intubated_tracheal') {
      setFeedbackToast({
        id: `manual_fail_${Date.now()}`,
        title: 'Intubação Necessária',
        message: 'Para ventilar manualmente com o balão do circuito, o paciente deve estar intubado.',
        type: 'danger',
      });
      return;
    }

    setEquipment((prev) => ({
      ...prev,
      isManualBreathTriggered: true,
      manualBreathLastTriggerTime: simTimeSeconds,
    }));

    setFeedbackToast({
      id: `manual_breath_${Date.now()}`,
      title: 'Incursão Respiratória Fornecida',
      message: `Volume corrente de ${Math.round(patient.weightKg * 12)} mL administrado via balão. Paw ~16 cmH2O.`,
      type: 'airway',
    });

    setEventLogs((prev) => [
      ...prev,
      {
        id: `breath_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'equipment',
        message: 'Ventilação manual fornecida (Apertar balão)',
        details: `Vol: ${Math.round(patient.weightKg * 12)} mL · Expansão torácica visualizada`,
        severity: 'normal',
      },
    ]);
  };

  // QUICK INTUBATE
  const handleQuickIntubate = () => {
    const isRelaxed = vitals.jawTone === 'relaxed_surgical' || vitals.jawTone === 'flaccid' || vitals.anestheticDepthScore > 40;
    const recommendedTube = SPECIES_DATABASE[patient.species].recommendedEtTubeRange.min + 0.5;

    // Check if laryngeal reflex is active and larynx is NOT desensitized
    if (!isRelaxed && !equipment.isLarynxDesensitized) {
      setPendingIntubationTubeSize(recommendedTube);
      setIsLaryngealReflexModalOpen(true);
      return;
    }

    handlePerformIntubation(true, recommendedTube);
  };

  // TOPICAL LIDOCAINE 2% SPRAY
  const handleApplyLidocaineSpray = () => {
    setEquipment((prev) => ({
      ...prev,
      isLarynxDesensitized: true,
      larynxDesensitizedUntilSimTime: simTimeSeconds + 480,
    }));
    setFeedbackToast({
      id: `lido_spray_${Date.now()}`,
      title: 'Spray de Lidocaína 2% Aplicado',
      message: 'Instilado 0,1 mL de Lidocaína 2% tópica na fenda glótica. Dessensibilização ativa por 8 minutos.',
      type: 'success',
    });
    setEventLogs((prev) => [
      ...prev,
      {
        id: `lido_topical_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'drug',
        message: 'Instilação de Lidocaína 2% tópica na glote/aritenoides para dessensibilização laringotraqueal.',
        severity: 'success',
      },
    ]);
  };

  const handleLidocaineSprayAndIntubate = () => {
    handleApplyLidocaineSpray();
    setIsLaryngealReflexModalOpen(false);
    setEquipment((prev) => ({
      ...prev,
      isLarynxDesensitized: true,
      larynxDesensitizedUntilSimTime: simTimeSeconds + 480,
      intubationStatus: 'intubated_tracheal',
      tubeSizeMm: pendingIntubationTubeSize,
      cuffPressureCmH2O: 20,
    }));
    setEventLogs((prev) => [
      ...prev,
      {
        id: `intub_lido_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'equipment',
        message: `Intubação orotraqueal suave realizada após dessensibilização com Lidocaína 2% (Sonda #${pendingIntubationTubeSize} mm)`,
        severity: 'success',
      },
    ]);
    setFeedbackToast({
      id: `intub_success_${Date.now()}`,
      title: 'Intubação Concluída com Sucesso!',
      message: `Tubo #${pendingIntubationTubeSize} mm posicionado na traqueia sem espasmo ou resistência glótica.`,
      type: 'success',
    });
  };

  const handleForceIntubationWithSpasm = () => {
    setIsLaryngealReflexModalOpen(false);
    setEquipment((prev) => ({
      ...prev,
      intubationStatus: 'intubated_tracheal',
      tubeSizeMm: pendingIntubationTubeSize,
      cuffPressureCmH2O: 20,
    }));
    setFeedbackToast({
      id: `laryngospasm_${Date.now()}`,
      title: 'Laringoespasmo & Tosse Intensa!',
      message: 'Intubação forçada com reflexo ativo desencadeou espasmo laríngeo, tosse e bradicardia reflexa.',
      type: 'danger',
    });
    setEventLogs((prev) => [
      ...prev,
      {
        id: `intub_forced_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'emergency',
        message: 'Intubação forçada sem bloqueio: tosse vigorosa, laringoespasmo e reflexo vagal ativado.',
        severity: 'warning',
      },
    ]);
  };

  // TRIGGER NIBP MEASUREMENT
  const handleTriggerNibp = () => {
    if (vitals.isDead || isNibpMeasuring) return;
    setIsNibpMeasuring(true);
    nibpMeasureStartRef.current = simTimeSeconds;

    setFeedbackToast({
      id: `nibp_toast_${Date.now()}`,
      title: 'Aferindo PNI (NIBP STAT)',
      message: 'Manguito insuflando... Aguarde desinsuflação oscilométrica.',
      type: 'cpr',
    });
  };

  // CHANGE PATIENT / SCENARIO
  const handleSelectScenario = (newPatient: PatientProfile) => {
    setPatient(newPatient);
    setIsScenarioModalOpen(false);
    resetSimulationForPatient(newPatient);
  };

  // ADMINISTER DRUG
  const handleAdministerDrug = (
    doseData: Omit<ActiveDrugDose, 'id' | 'administeredAtSimTime' | 'peakEffectSimTime' | 'currentCe' | 'currentCp' | 'deliveryElapsedSec' | 'isFullyDelivered' | 'isFastBolusShockTriggered'>
  ) => {
    const drugDefinition = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === doseData.drugId);
    if (!drugDefinition) {
      setEventLogs((prev) => [...prev, {
        id: `drug_rejected_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'system',
        message: `Administração rejeitada: fármaco desconhecido (${doseData.drugId}).`,
        severity: 'danger',
      }]);
      return;
    }
    const validationErrors = validateAdministrationCommand(patient, drugDefinition, {
      route: doseData.route,
      administrationSpeed: doseData.administrationSpeed,
      isCRI: doseData.isCRI,
      dosePerKg: doseData.dosePerKg,
      concentrationMgMl: doseData.preparation?.concentrationMgMl,
      deliveryDurationSec: doseData.isCRI ? undefined : doseData.deliveryDurationSec,
    });
    if (validationErrors.length > 0) {
      setEventLogs((prev) => [...prev, {
        id: `drug_rejected_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'system',
        message: `Administração rejeitada: ${drugDefinition.name}.`,
        details: validationErrors.join(' '),
        severity: 'danger',
      }]);
      return;
    }
    const defaultTransitLag = drugDefinition
      ? getRoutePharmacokinetics(drugDefinition, doseData.route).transitLagSeconds
      : 20;
    const newDose: ActiveDrugDose = {
      ...doseData,
      id: `dose_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      administeredAtSimTime: simTimeSeconds,
      peakEffectSimTime: simTimeSeconds + (drugDefinition?.onsetMinutes || 1) * 60,
      deliveryElapsedSec: 0,
      deliveryDurationSec: doseData.deliveryDurationSec ?? (doseData.administrationSpeed === 'bolus_rapid' ? 4 : 60),
      transitLagRemainingSec: doseData.transitLagRemainingSec ?? defaultTransitLag,
      isFullyDelivered: false,
      isFastBolusShockTriggered: false,
      isInfusionRunning: doseData.isCRI ? doseData.isInfusionRunning !== false : false,
      bolusShockMagnitude: 0,
      bolusShockRemainingSec: 0,
      currentCp: 0, // starts at zero and is absorbed/infused based on transit lag and bolus speed
      currentCe: 0,
    };

    setActiveDoses((prev) => [...prev, newDose]);
    setIsTelemetryOpen(true);

    // Add log
    setEventLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'drug',
        message: `Administrado ${newDose.drugName} (${newDose.administrationSpeed?.replace('_', ' ') || 'bolus'})`,
        details: `${newDose.preparation ? `${newDose.preparation.name} · ${newDose.preparation.label} · Frasco: ${newDose.preparation.vialVolumeMl ?? 'não informado'} mL · ` : ''}${newDose.dosePerKg} ${newDose.isCRI ? drugDefinition.criDoseUnit || drugDefinition.doseUnit : drugDefinition.doseUnit} · Via: ${newDose.route} · Vol: ${newDose.volumeMl} mL · Entrega: ${newDose.isCRI ? 'contínua' : `${newDose.deliveryDurationSec}s`} · Lag: ${newDose.transitLagRemainingSec}s · ID: ${newDose.id}`,
        severity: newDose.administrationSpeed === 'bolus_rapid' ? 'warning' : 'success',
      },
    ]);
  };

  const handleStopCRI = (doseId: string) => {
    setActiveDoses((prev) => prev.map((dose) => dose.id === doseId
      ? { ...dose, isInfusionRunning: false, criRatePerKgMin: 0 }
      : dose));
    setEventLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'drug',
        message: `Infusão contínua (CRI) interrompida; concentração residual em fase de eliminação.`,
        severity: 'warning',
      },
    ]);
  };

  // INTUBATION
  const handlePerformIntubation = (isCorrectTracheal: boolean, tubeSizeMm: number) => {
    const isRelaxed = vitals.jawTone === 'relaxed_surgical' || vitals.jawTone === 'flaccid' || vitals.anestheticDepthScore > 40;

    // Check if laryngeal reflex is active and larynx is NOT desensitized
    if (!isRelaxed && !equipment.isLarynxDesensitized && isCorrectTracheal) {
      setPendingIntubationTubeSize(tubeSizeMm);
      setIsLaryngealReflexModalOpen(true);
      return;
    }

    setEquipment((prev) => ({
      ...prev,
      intubationStatus: isCorrectTracheal ? 'intubated_tracheal' : 'intubated_esophageal',
      tubeSizeMm,
      cuffPressureCmH2O: isCorrectTracheal ? 20 : 0,
    }));

    setEventLogs((prev) => [
      ...prev,
      {
        id: `intub_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'equipment',
        message: isCorrectTracheal
          ? `Intubação orotraqueal realizada com sucesso (Sonda #${tubeSizeMm} mm)`
          : 'ALERTA: Intubação acidental no esôfago!',
        severity: isCorrectTracheal ? 'success' : 'danger',
      },
    ]);
  };

  const handleExtubate = () => {
    setEquipment((prev) => ({
      ...prev,
      intubationStatus: 'extubated',
      cuffPressureCmH2O: 0,
      isVentilatorActive: false,
      ventilatorMode: 'spontaneous',
    }));

    setEventLogs((prev) => [
      ...prev,
      {
        id: `extub_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'equipment',
        message: 'Paciente extubado com sucesso.',
        severity: 'normal',
      },
    ]);
  };

  // GRADED SURGICAL PROCEDURE TRIGGER
  const handleStartSurgicalProcedure = (procedure: SurgicalProcedureDefinition) => {
    setActiveSurgicalProcedure({
      ...procedure,
      startedAtSimTime: simTimeSeconds,
      endsAtSimTime: simTimeSeconds + procedure.durationSeconds,
    });
    setEventLogs((prev) => [
      ...prev,
      {
        id: `surg_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'surgical',
        message: `Procedimento iniciado: ${procedure.name}.`,
        details: `${procedure.tissueLayer} · intensidade aferente ${Math.round(procedure.intensity * 100)}% · duração ${procedure.durationSeconds}s`,
        severity: vitals.anestheticDepthScore < 50 ? 'warning' : 'normal',
      },
    ]);
  };

  const handleStopSurgicalProcedure = () => {
    if (!activeSurgicalProcedure) return;
    const procedureName = activeSurgicalProcedure.name;
    setActiveSurgicalProcedure(null);
    setEventLogs((prev) => [...prev, {
      id: `surg_stop_${Date.now()}`,
      simTimeSeconds,
      realTimestamp: new Date().toLocaleTimeString(),
      type: 'surgical',
      message: `Procedimento encerrado: ${procedureName}. Resposta neuroendócrina em recuperação.`,
      severity: 'normal',
    }]);
  };

  // NOCICEPTIVE SENSITIVITY TESTING (Separate from surgical procedures)
  const handleStartNociceptiveTest = (test: NociceptiveTestDefinition) => {
    setActiveNociceptiveTest({
      ...test,
      startedAtSimTime: simTimeSeconds,
      endsAtSimTime: simTimeSeconds + test.durationSeconds,
    });
    setEventLogs((prev) => [
      ...prev,
      {
        id: `pain_test_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'surgical',
        message: `Teste de Nocicepção: ${test.name} aplicado.`,
        details: `${test.targetTissue} · intensidade ${Math.round(test.intensity * 100)}% · duração ${test.durationSeconds}s`,
        severity: 'warning',
      },
    ]);
  };

  const handleStopNociceptiveTest = () => {
    if (!activeNociceptiveTest) return;
    const testName = activeNociceptiveTest.name;
    setActiveNociceptiveTest(null);
    setEventLogs((prev) => [
      ...prev,
      {
        id: `pain_test_stop_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'surgical',
        message: `Estímulo álgico encerrado: ${testName}.`,
        severity: 'normal',
      },
    ]);
  };

  // FLUID BOLUS
  const handleGiveFluidBolus = (bolusMl: number, fluidName: string, durationSec: number) => {
    if (!Number.isFinite(bolusMl) || bolusMl <= 0 || !Number.isFinite(durationSec) || durationSec < 1) return;
    setEquipment((prev) => ({
      ...prev,
      fluidBoluses: [...(prev.fluidBoluses ?? []).filter(bolus => bolus.deliveredMl < bolus.volumeMl - 1e-8), { id: `fluid_${Date.now()}`, fluidName, volumeMl: bolusMl, durationSec, deliveredMl: 0, isRunning: true }],
    }));

    setEventLogs((prev) => [
      ...prev,
      {
        id: `fluid_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'vital',
        message: `Bólus programado: ${bolusMl.toFixed(1)} mL de ${fluidName} em ${(durationSec / 60).toFixed(1)} min (${(bolusMl * 3600 / durationSec).toFixed(1)} mL/h).`,
        severity: 'success',
      },
    ]);
  };

  const handleSelectEmergencyDrug = (drugId: string) => {
    setRequestedDrugId(drugId);
    selectWorkstation('drugs');
  };

  const formatSimTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div className="vetsim-app min-h-screen flex flex-col">
      <SimulationHeader
        patient={patient} vitals={vitals} paused={isSimPaused} speed={simSpeed} time={formatSimTime(simTimeSeconds)}
        consciousness={vitals.consciousnessScore ?? 100} eventCount={eventLogs.length}
        occurrenceCount={clinicalOccurrenceHistory.length}
        onPause={() => recording.recorder.current!.run.status === 'active' ? setIsSimPaused(prev => !prev) : handleResetSimulation()} onSpeed={setSimSpeed} onReset={handleResetSimulation}
        onPatient={() => setIsScenarioModalOpen(true)} onBiophysics={() => setIsCellularModalOpen(true)}
        onConsciousness={() => setIsDepthBoardOpen(true)} onEvents={() => setIsGeneralLogOpen(true)}
        onOccurrences={() => setIsOccurrenceCenterOpen(true)} onEmergency={() => selectWorkstation('emergency_cpr')}
        onAdminPanel={() => setIsAdminPanelOpen(true)}
        onSavePerspective={() => setIsSavePerspectiveModalOpen(true)}
      />

      <div className="review-access"><button className="ui-button" onClick={openExpertReview}>Revisão por anestesiologista</button><span>{recording.storageError || (recording.savedAt ? `Rodada salva neste dispositivo às ${recording.savedAt}` : 'Preparando registro da rodada…')}</span>{recording.storageError && <button className="ui-button" onClick={() => downloadRecord(JSON.stringify(recording.recorder.current!.run, null, 2), `resgate-${recording.recorder.current!.run.id}.json`)}>Exportar cópia agora</button>}</div>
      {reviewRuns && <ExpertReviewPanel initialRuns={reviewRuns} activeId={recording.recorder.current!.run.id}
        onClose={() => setReviewRuns(null)} onRefresh={recording.flush}
        onFinish={async () => { setIsSimPaused(true); return recording.finish(); }} />}

      {/* 2. MAIN WORKSPACE */}
      <main className="app-main">
        {/* Real-time Non-Disruptive Clinical Alert Ribbon (PCR, Apnea, Interactions, Death) */}
        <ClinicalAlertRibbon
          vitals={vitals}
          onOpenDeathReport={() => setIsDeathModalOpen(true)}
          onSwitchToEmergencyTab={() => selectWorkstation('emergency_cpr')}
        />

        <section id="monitor" className="monitor-section" aria-labelledby="monitor-title">
          <div className="section-heading">
            <div><p className="eyebrow">Acompanhamento do paciente</p><h2 id="monitor-title">Monitorização</h2></div>
            <a className="ui-button" href="#interventions">Ir para intervenções ↓</a>
          </div>


        {/* Top Half: Real-Time Waveform Monitor & Numeric LED Tiles */}
        <div className="monitor-layout">
          {/* Waveform Sweeping Canvas (7 cols) */}
          <div className="waveform-panel">
            <CanvasWaveforms
              vitals={displayVitals}
              isSimPaused={isSimPaused}
              equipment={equipment}
              adminOverrides={adminMonitorOverrides}
              onOpenAdminMenu={() => setIsAdminMonitorModalOpen(true)}
            />
          </div>

          {/* Numeric Vital Readouts (5 cols) */}
          <div className="vitals-panel">
            <VitalNumbers
              vitals={displayVitals}
              equipment={equipment}
              alarmLimits={alarmLimits}
              activeAlarmStatus={activeAlarmStatus}
              adminOverrides={adminMonitorOverrides}
              onOpenAdminMenu={() => setIsAdminMonitorModalOpen(true)}
              onToggleAudioMute={() => {
                const nextMuted = !alarmLimits.isAudioMuted;
                setAlarmLimits((prev) => ({ ...prev, isAudioMuted: nextMuted }));
                AudioSynthesizer.setPulseMuted(nextMuted);
              }}
              onToggleAlarmsSilence={() => {
                AudioSynthesizer.toggleAlarmsSilence(120);
                setActiveAlarmStatus((prev) =>
                  prev
                    ? {
                        ...prev,
                        isSilenced: AudioSynthesizer.getAlarmSilenceRemainingSec() > 0,
                        silenceRemainingSec: AudioSynthesizer.getAlarmSilenceRemainingSec(),
                      }
                    : null
                );
              }}
              onTriggerNibpMeasurement={handleTriggerNibp}
              isNibpMeasuring={isNibpMeasuring}
              lastNibpMeasurement={lastNibpMeasurement}
              nibpAutoIntervalMin={nibpAutoIntervalMin}
              onChangeNibpAutoInterval={(min) => setNibpAutoIntervalMin(min)}
              isContinuousIbpActive={isContinuousIbpActive}
              onToggleContinuousIbp={() => setIsContinuousIbpActive(!isContinuousIbpActive)}
              simTimeSeconds={simTimeSeconds}
              onOpenDeathReport={() => setIsDeathModalOpen(true)}
              onOpenDepthBoard={() => setIsDepthBoardOpen(true)}
              onOpenAudioSettings={() => setIsAudioSettingsOpen(true)}
            />
          </div>
        </div>

        {/* Airway Quick Actions Bar (Intubation / Manual Bag Squeeze / Cadence) */}
        <AirwayQuickBar
          equipment={equipment}
          patient={patient}
          vitals={vitals}
          onUpdateEquipment={(updates) => setEquipment((prev) => ({ ...prev, ...updates }))}
          onTriggerManualBreath={handleTriggerManualBreath}
          onQuickIntubate={handleQuickIntubate}
          onExtubate={handleExtubate}
          onApplyLidocaineSpray={handleApplyLidocaineSpray}
        />

        </section>

        <section className="telemetry-disclosure" aria-label="Farmacocinética e telemetria">
          <button className="telemetry-toggle" aria-expanded={isTelemetryOpen} aria-controls="telemetry-content" onClick={() => setIsTelemetryOpen(open => !open)}>
            <span><Activity size={18} /><strong>Farmacocinética e telemetria</strong><span className="quiet-badge">{activeDoses.length} {activeDoses.length === 1 ? 'administração' : 'administrações'}</span></span>
            <span>{isTelemetryOpen ? 'Recolher −' : 'Explorar detalhes +'}</span>
          </button>
          <div id="telemetry-content" hidden={!isTelemetryOpen}>
            <CirculatingDrugsPanel patient={patient} activeDoses={activeDoses} equipment={equipment} vitals={vitals} />
          </div>
        </section>

        <section id="interventions" ref={workstationRef} className="interventions-section" aria-labelledby="interventions-title" tabIndex={-1}>
          <ClinicalSnapshot vitals={vitals} limits={alarmLimits} paused={isSimPaused} />
          <div className="section-heading">
            <div><p className="eyebrow">Conduta clínica</p><h2 id="interventions-title">Intervenções e registros</h2></div>
            <a className="subtle-link" href="#monitor">Voltar ao monitor ↑</a>
          </div>
          <div className="workstation-tabs" role="tablist" aria-label="Área de intervenção">
            {WORKSTATIONS.map((tab, index) => {
              const Icon = [Syringe, Wind, Stethoscope, Droplet, HeartPulse, FileText][index];
              return <button key={tab.id} id={`tab-${tab.id}`} role="tab" aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1}
                className={tab.id === 'emergency_cpr' ? 'emergency-tab' : ''}
                onClick={() => selectWorkstation(tab.id)}
                onKeyDown={event => {
                  let next = index;
                  if (event.key === 'ArrowRight') next = (index + 1) % WORKSTATIONS.length;
                  else if (event.key === 'ArrowLeft') next = (index + WORKSTATIONS.length - 1) % WORKSTATIONS.length;
                  else if (event.key === 'Home') next = 0;
                  else if (event.key === 'End') next = WORKSTATIONS.length - 1;
                  else return;
                  event.preventDefault();
                  selectWorkstation(WORKSTATIONS[next].id);
                  document.getElementById(`tab-${WORKSTATIONS[next].id}`)?.focus({ preventScroll: true });
                }}><Icon size={17} /><span>{tab.label}</span></button>;
            })}
          </div>
          <p className="workstation-description">{WORKSTATIONS.find(tab => tab.id === activeTab)?.description}</p>
          {/* Active Workstation Panels */}
          <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={0}>
            {activeTab === 'drugs' && (
              <DrugAdministrationModal
                requestedDrugId={requestedDrugId}
                patient={patient}
                activeDoses={activeDoses}
                onAdministerDrug={handleAdministerDrug}
                onStopCRI={handleStopCRI}
              />
            )}

            {activeTab === 'machine_airway' && (
              <div className="space-y-3">
                <VaporizerMachine
                  equipment={equipment}
                  species={patient.species}
                  onUpdateEquipment={(updates) => setEquipment((prev) => ({ ...prev, ...updates }))}
                  onOxygenFlush={() => {
                    oxygenFlushEndSimTimeRef.current = simTimeSeconds + 1.5;
                    setEquipment((prev) => ({ ...prev, isOxygenFlushActive: true }));
                    setEventLogs((prev) => [
                      ...prev,
                      {
                        id: `flush_${Date.now()}`,
                        simTimeSeconds,
                        realTimestamp: new Date().toLocaleTimeString(),
                        type: 'equipment',
                        message: 'Purga rápida com flush de oxigênio a 50 L/min realizada.',
                        severity: 'normal',
                      },
                    ]);
                  }}
                  onManualBagSqueeze={handleTriggerManualBreath}
                />

                <VentilatorAirway
                  equipment={equipment}
                  patient={patient}
                  onUpdateEquipment={(updates) => setEquipment((prev) => ({ ...prev, ...updates }))}
                  onPerformIntubation={handlePerformIntubation}
                  onExtubate={handleExtubate}
                  onApplyLidocaineSpray={handleApplyLidocaineSpray}
                />
              </div>
            )}

            {activeTab === 'physical_exam' && (
              <PatientPhysicalExam
                patient={patient}
                vitals={vitals}
                onStartSurgicalProcedure={handleStartSurgicalProcedure}
                onStopSurgicalProcedure={handleStopSurgicalProcedure}
                activeSurgicalProcedure={activeSurgicalProcedure}
                activeNociceptiveTest={activeNociceptiveTest}
                onStartNociceptiveTest={handleStartNociceptiveTest}
                onStopNociceptiveTest={handleStopNociceptiveTest}
                simTimeSeconds={simTimeSeconds}
                onOpenConsciousnessBoard={() => setIsDepthBoardOpen(true)}
              />
            )}

            {activeTab === 'fluids_thermal' && (
              <FluidTherapyPanel
                vitals={vitals}
                equipment={equipment}
                patient={patient}
                onUpdateEquipment={(updates) => setEquipment((prev) => ({ ...prev, ...updates }))}
                onGiveFluidBolus={handleGiveFluidBolus}
              />
            )}

            {activeTab === 'emergency_cpr' && (
              <CPCRResuscitationPanel
                patient={patient}
                activeDoses={activeDoses}
                vitals={vitals}
                resuscitation={resuscitation}
                onUpdateResuscitation={(updates) => setResuscitation((prev) => ({ ...prev, ...updates }))}
                onSelectEmergencyDrug={handleSelectEmergencyDrug}
              />
            )}

            {activeTab === 'records' && (
              <AnesthesiaRecordSheet
                patient={patient}
                vitalLogs={vitalLogs}
                eventLogs={eventLogs}
                totalSimDurationSeconds={simTimeSeconds}
              />
            )}
          </div>
        </section>
      </main>

      {/* 3. SCENARIO SELECTOR MODAL */}
      {isScenarioModalOpen && (
        <ScenarioSelectorModal
          currentPatientId={patient.id}
          onSelectScenario={handleSelectScenario}
          onClose={() => setIsScenarioModalOpen(false)}
        />
      )}

      {/* 4. CLINICAL DEATH & AUTOPSY REPORT MODAL */}
      <DeathReportModal
        patient={patient}
        vitals={vitals}
        isOpen={isDeathModalOpen}
        onClose={() => setIsDeathModalOpen(false)}
        onRestartScenario={() => resetSimulationForPatient(patient)}
        onAttemptHeroicCPR={() => {
          setIsDeathModalOpen(false);
          setIsSimPaused(false);
          selectWorkstation('emergency_cpr');
          setResuscitation((prev) => ({
            ...prev,
            isCPRActive: true,
            compressionsPerMin: 115,
            lastCompressionSimTime: simTimeSeconds,
          }));
        }}
      />

      {/* 5. CELLULAR BIOPHYSICS & SPECIES MODAL */}
      <CellularPhysiologyModal
        isOpen={isCellularModalOpen}
        onClose={() => setIsCellularModalOpen(false)}
        patient={patient}
        vitals={vitals}
      />

      {/* 6. ANESTHETIC DEPTH & CONSCIOUSBOARD MODAL */}
      <AnestheticDepthBoard
        isOpen={isDepthBoardOpen}
        onClose={() => setIsDepthBoardOpen(false)}
        vitals={vitals}
        patient={patient}
      />

      {/* 7. GENERAL EVENT LOG MODAL */}
      <GeneralEventLogModal
        isOpen={isGeneralLogOpen}
        onClose={() => setIsGeneralLogOpen(false)}
        eventLogs={eventLogs}
        patient={patient}
        totalSimTimeSeconds={simTimeSeconds}
      />

      {/* 8. LARYNGEAL REFLEX & TOPICAL LIDOCAINE MODAL */}
      <LaryngealReflexModal
        isOpen={isLaryngealReflexModalOpen}
        patient={patient}
        vitals={vitals}
        tubeSizeMm={pendingIntubationTubeSize}
        onClose={() => setIsLaryngealReflexModalOpen(false)}
        onApplyLidocaineSpray={handleLidocaineSprayAndIntubate}
        onForceIntubation={handleForceIntubationWithSpasm}
        onOpenDrugAdministration={() => {
          setIsLaryngealReflexModalOpen(false);
          selectWorkstation('drugs');
        }}
      />

      {/* 9. EMERGENCY & RESUSCITATION REAL-TIME FEEDBACK TOAST */}
      <EmergencyFeedbackToast
        item={feedbackToast}
        onDismiss={() => setFeedbackToast(null)}
      />

      {/* 10. AUDIO SYNTHESIZER & TIMBRE SETTINGS MODAL */}
      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
        isPulseMuted={alarmLimits.isAudioMuted}
        onTogglePulseMute={() => {
          const nextMuted = !alarmLimits.isAudioMuted;
          setAlarmLimits((prev) => ({ ...prev, isAudioMuted: nextMuted }));
          AudioSynthesizer.setPulseMuted(nextMuted);
        }}
      />


      {/* 12. ADMIN MANAGEMENT DASHBOARD */}
      {isAdminPanelOpen && (
        <AdminManagementModal
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
        />
      )}

      {/* 13. PROFESSIONAL CLINICAL PERSPECTIVE MODAL */}
      {isSavePerspectiveModalOpen && (
        <SavePerspectiveModal
          isOpen={isSavePerspectiveModalOpen}
          onClose={() => setIsSavePerspectiveModalOpen(false)}
          patient={patient}
          vitals={vitals}
          simTimeSeconds={simTimeSeconds}
        />
      )}

      {/* 14. ADMIN & INSTRUCTOR MONITOR OVERRIDE MODAL */}
      <AdminMonitorOverrideModal
        isOpen={isAdminMonitorModalOpen}
        onClose={() => setIsAdminMonitorModalOpen(false)}
        overrides={adminMonitorOverrides}
        onUpdateOverrides={setAdminMonitorOverrides}
      />

      {/* 11. FOOTER */}
      <footer className="border-t border-[#1a1a1a] bg-[#080808] px-4 py-2.5 text-center text-xs text-[#525252] font-mono-code">
        Simulador anest-vet · Modelagem farmacocinética multicompartimental · Diretrizes RECOVER 2024
      </footer>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isPendingPayment, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07080e] flex flex-col items-center justify-center gap-3 text-white">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Iniciando anest-vet...</p>
      </div>
    );
  }

  // 1. Desacoplamento Total: Quando não autenticado, renderiza a tela de login / compra / recuperação
  // Zero áudio, zero sintetizador, zero timers da simulação rodando em segundo plano!
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // 2. Autenticado mas aguardando confirmação do pagamento
  if (isPendingPayment) {
    return <PendingPaymentScreen />;
  }

  // 3. Usuário autenticado com licença vitalícia ativa: inicia a simulação veterinária
  return <SimulatorApp />;
}
