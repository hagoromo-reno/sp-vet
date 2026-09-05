import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveDrugDose,
  ActiveSurgicalProcedure,
  AnesthesiaEquipmentState,
  LogEntry,
  MonitorAlarmLimits,
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
import { AudioSynthesizer } from './engine/audioSynthesizer';
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
import {
  Activity,
  Syringe,
  Wind,
  Droplet,
  HeartPulse,
  FileText,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  FolderHeart,
  Sparkles,
  Stethoscope,
  Dna,
  Brain,
  ListRestart,
  ScrollText,
  Bell,
} from 'lucide-react';

export default function App() {
  // 1. ACTIVE PATIENT & SCENARIO
  const [patient, setPatient] = useState<PatientProfile>(PRESET_SCENARIOS[0]);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [isCellularModalOpen, setIsCellularModalOpen] = useState(false);

  // 2. SIMULATION CLOCK & CONTROLS
  const [isSimPaused, setIsSimPaused] = useState(false);
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
  const [alarmLimits, setAlarmLimits] = useState<MonitorAlarmLimits>({
    hrLow: 50,
    hrHigh: 160,
    mapLow: 60,
    mapHigh: 120,
    spo2Low: 94,
    etco2Low: 30,
    etco2High: 50,
    tempLow: 36.5,
    tempHigh: 39.5,
    isAudioMuted: false,
  });

  // 9. ACTIVE WORKSTATION TAB & MODALS
  const [activeTab, setActiveTab] = useState<
    'drugs' | 'machine_airway' | 'physical_exam' | 'fluids_thermal' | 'emergency_cpr' | 'records'
  >('drugs');
  const [isDeathModalOpen, setIsDeathModalOpen] = useState(false);
  const [isDepthBoardOpen, setIsDepthBoardOpen] = useState(false);
  const [isGeneralLogOpen, setIsGeneralLogOpen] = useState(false);
  const [isLaryngealReflexModalOpen, setIsLaryngealReflexModalOpen] = useState(false);
  const [pendingIntubationTubeSize, setPendingIntubationTubeSize] = useState<number>(8.5);
  const [feedbackToast, setFeedbackToast] = useState<EmergencyFeedbackItem | null>(null);
  const [clinicalOccurrenceHistory, setClinicalOccurrenceHistory] = useState<EmergencyFeedbackItem[]>([]);
  const [isOccurrenceCenterOpen, setIsOccurrenceCenterOpen] = useState(false);

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

  // Auto-open death report on transition to dead
  useEffect(() => {
    if (vitals.isDead && !prevDeadStateRef.current) {
      setIsDeathModalOpen(true);
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
      if (isSimPaused) return;

      const dt = 0.1 * simSpeed;
      const newSimTime = simTimeSeconds + dt;
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
      const activeSurgicalStimulus = activeSurgicalProcedure
        && newSimTime < activeSurgicalProcedure.endsAtSimTime
        ? activeSurgicalProcedure.intensity
        : 0;
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
        activeSurgicalStimulus,
        vitals
      );

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
      if (newSimTime - lastLogSimTimeRef.current >= 30) {
        lastLogSimTimeRef.current = newSimTime;
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
    isSimPaused,
    simSpeed,
    simTimeSeconds,
    patient,
    activeDoses,
    equipment,
    resuscitation,
    activeSurgicalProcedure,
    isNibpMeasuring,
    nibpAutoIntervalMin,
    vitals,
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

  const handleResetSimulation = () => resetSimulationForPatient(patient);

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

    // Add log
    setEventLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'drug',
        message: `Administrado ${newDose.drugName} (${newDose.administrationSpeed?.replace('_', ' ') || 'bolus'})`,
        details: `${newDose.dosePerKg} ${newDose.route} · Vol: ${newDose.volumeMl} mL · Lag: ${newDose.transitLagRemainingSec}s`,
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

  // FLUID BOLUS
  const handleGiveFluidBolus = (bolusMl: number, fluidName: string) => {
    setEquipment((prev) => ({
      ...prev,
      activeFluidType: fluidName,
      totalFluidsInfusedMl: prev.totalFluidsInfusedMl + bolusMl,
    }));

    setEventLogs((prev) => [
      ...prev,
      {
        id: `fluid_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'vital',
        message: `Bólus volêmico de ${bolusMl} mL administrado (${fluidName}).`,
        severity: 'success',
      },
    ]);
  };

  // QUICK EMERGENCY DRUG
  const handleAdministerQuickEmergencyDrug = (drugId: string) => {
    const drug = VETERINARY_DRUG_DATABASE.find((item) => item.id === drugId);
    if (!drug) return;
    const range = getSpeciesDoseRange(drug, patient.species);
    if (!range || isTimeBasedDoseUnit(drug.doseUnit)) {
      setEventLogs((prev) => [...prev, {
        id: `quick_drug_rejected_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'system',
        message: `Atalho indisponível para ${drug.name} em ${patient.species}.`,
        details: 'Não existe dose rápida específica validada para esta espécie/contexto.',
        severity: 'danger',
      }]);
      return;
    }
    const route = drug.supportedRoutes.includes('IV')
      ? 'IV'
      : drug.supportedRoutes.includes('IV_slow')
        ? 'IV_slow'
        : undefined;
    if (!route) return;
    const dosePerKg = range.typical;
    const calculated = calculateAdministration(drug, dosePerKg, patient.weightKg);
    const speed = route === 'IV' ? 'bolus_rapid' : 'bolus_slow';

    handleAdministerDrug({
      drugId,
      drugName: drug.name,
      category: drug.category,
      route,
      administrationSpeed: speed,
      doseAmount: calculated.doseAmount,
      dosePerKg,
      volumeMl: calculated.volumeMl,
      deliveryDurationSec: speed === 'bolus_rapid' ? 4 : 60,
      transitLagRemainingSec: getRoutePharmacokinetics(drug, route).transitLagSeconds,
      isCRI: false,
    });
  };

  const formatSimTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] flex flex-col justify-between">
      {/* 1. TOP GLOBAL NAVIGATION & CONTROLS */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 border-b border-[#1f1f1f] backdrop-blur-md px-4 py-2.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Scenario Name */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-lg shadow-black/60">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-sm font-extrabold tracking-wide text-[#f5f5f5] flex items-center gap-1.5">
                    <span>Open VetSim</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono-code font-bold">
                      v2.5 PRO
                    </span>
                  </h1>
                </div>
                <div className="text-[11px] text-[#737373] font-mono-code">
                  Simulador Anestésico & Cuidados Críticos Veterinários
                </div>
              </div>
            </div>

            {/* Scenario Button */}
            <button
              onClick={() => setIsScenarioModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#121212] hover:bg-[#1a1a1a] border border-[#262626] text-xs font-mono-code transition text-[#e5e5e5]"
            >
              <FolderHeart className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-[#f5f5f5]">{patient.name}</span>
              <span className="text-[#888888]">({patient.weightKg}kg · ASA {patient.asa})</span>
            </button>

            {/* Cellular Biophysics & Receptors Button */}
            <button
              onClick={() => setIsCellularModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/70 border border-indigo-500/40 text-xs font-mono-code transition text-indigo-200 shadow-md shadow-indigo-950/30 cursor-pointer"
              title="Inspecionar Receptores Celulares, Segundos Mensageiros e Particularidades de Espécie"
            >
              <Dna className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="font-bold hidden sm:inline">Biofísica</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-mono font-bold">
                {formatSpecies(patient.species).toUpperCase()}
              </span>
            </button>

            {/* Depth & Consciousness Board Button */}
            <button
              onClick={() => setIsDepthBoardOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/40 text-xs font-mono-code transition text-purple-200 shadow-md shadow-purple-950/30 cursor-pointer"
              title="Visualizar Nível de Consciência, Plano de Guedel e Reflexos"
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-bold hidden sm:inline">Consciência</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 font-mono font-bold">
                {vitals.consciousnessScore ?? 100}%
              </span>
            </button>

            {/* General Log Button */}
            <button
              onClick={() => setIsGeneralLogOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/40 text-xs font-mono-code transition text-cyan-200 shadow-md shadow-cyan-950/30 cursor-pointer"
              title="Abrir Log Geral de Acontecimentos e Respostas Fisiológicas"
            >
              <ScrollText className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold hidden sm:inline">Log Geral</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-200 font-mono font-bold">
                {eventLogs.length}
              </span>
            </button>

            <button
              onClick={() => setIsOccurrenceCenterOpen(true)}
              className="relative flex items-center space-x-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 shadow-md shadow-amber-950/30 transition hover:bg-amber-900/60"
              title="Abrir histórico de alertas e interações"
            >
              <Bell className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden font-bold sm:inline">Ocorrências</span>
              {clinicalOccurrenceHistory.length > 0 && (
                <span className="rounded bg-amber-500/25 px-1.5 text-[10px] font-bold text-amber-100">{clinicalOccurrenceHistory.length}</span>
              )}
            </button>
          </div>

          {/* Clock & Speed Multipliers */}
          <div className="flex items-center space-x-2 font-mono-code text-xs">
            {/* Simulation Timer */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-[#101010] border border-[#222222] rounded-lg">
              <span className="text-[#737373] text-[10px]">TEMPO:</span>
              <strong className="text-sm font-digital text-emerald-400 font-extrabold tracking-wider">
                {formatSimTime(simTimeSeconds)}
              </strong>
            </div>

            {/* Play/Pause & Speed Buttons */}
            <div className="flex items-center space-x-1 bg-[#101010] p-1 rounded-lg border border-[#222222]">
              <button
                onClick={() => setIsSimPaused(!isSimPaused)}
                className={`p-1.5 rounded transition ${
                  isSimPaused
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-[#1a1a1a] text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#242424]'
                }`}
                title={isSimPaused ? 'Retomar' : 'Pausar'}
              >
                {isSimPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setSimSpeed(1.0)}
                className={`px-2 py-0.5 rounded text-[10px] transition ${
                  simSpeed === 1.0 ? 'bg-emerald-600 text-white font-bold' : 'text-[#737373] hover:text-[#d4d4d4]'
                }`}
              >
                1x
              </button>

              <button
                onClick={() => setSimSpeed(2.0)}
                className={`px-2 py-0.5 rounded text-[10px] transition ${
                  simSpeed === 2.0 ? 'bg-emerald-600 text-white font-bold' : 'text-[#737373] hover:text-[#d4d4d4]'
                }`}
              >
                2x
              </button>

              <button
                onClick={() => setSimSpeed(5.0)}
                className={`px-2 py-0.5 rounded text-[10px] transition ${
                  simSpeed === 5.0 ? 'bg-emerald-600 text-white font-bold' : 'text-[#737373] hover:text-[#d4d4d4]'
                }`}
              >
                5x
              </button>

              <button
                onClick={handleResetSimulation}
                className="flex items-center space-x-1 px-2 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 hover:text-white rounded text-[10px] font-bold transition ml-1"
                title="Reiniciar Caso do Início (00:00)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="max-w-[1600px] mx-auto w-full p-4 flex-1 flex flex-col space-y-4">
        {/* Real-time Non-Disruptive Clinical Alert Ribbon (PCR, Apnea, Interactions, Death) */}
        <ClinicalAlertRibbon
          vitals={vitals}
          onOpenDeathReport={() => setIsDeathModalOpen(true)}
          onSwitchToEmergencyTab={() => setActiveTab('emergency_cpr')}
        />

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

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">

        {/* Top Half: Real-Time Waveform Monitor & Numeric LED Tiles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[380px]">
          {/* Waveform Sweeping Canvas (7 cols) */}
          <div className="lg:col-span-7 h-[380px]">
            <CanvasWaveforms vitals={vitals} isSimPaused={isSimPaused} equipment={equipment} />
          </div>

          {/* Numeric Vital Readouts (5 cols) */}
          <div className="lg:col-span-5 h-[380px]">
            <VitalNumbers
              vitals={vitals}
              equipment={equipment}
              alarmLimits={alarmLimits}
              onToggleAudioMute={() => {
                const nextMuted = !alarmLimits.isAudioMuted;
                setAlarmLimits((prev) => ({ ...prev, isAudioMuted: nextMuted }));
                AudioSynthesizer.setMuted(nextMuted);
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
            />
          </div>
        </div>

        {/* Bottom Half: Clinical Interventions & Anesthetic Workstations */}
        <div className="flex flex-col space-y-3">
          {/* Workstation Navigation Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs font-mono-code font-bold border-b border-[#1f1f1f]">
            <button
              onClick={() => setActiveTab('drugs')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg transition border-b-2 ${
                activeTab === 'drugs'
                  ? 'bg-[#121212] border-emerald-500 text-emerald-400'
                  : 'text-[#737373] hover:text-[#d4d4d4] border-transparent'
              }`}
            >
              <Syringe className="w-4 h-4" />
              <span>1. FARMACOPEIA & DOSES</span>
              {activeDoses.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('machine_airway')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg transition border-b-2 ${
                activeTab === 'machine_airway'
                  ? 'bg-[#121212] border-emerald-500 text-emerald-400'
                  : 'text-[#737373] hover:text-[#d4d4d4] border-transparent'
              }`}
            >
              <Wind className="w-4 h-4" />
              <span>2. APARELHO DE ANESTESIA & VENTILADOR</span>
            </button>

            <button
              onClick={() => setActiveTab('physical_exam')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg transition border-b-2 ${
                activeTab === 'physical_exam'
                  ? 'bg-[#121212] border-emerald-500 text-emerald-400'
                  : 'text-[#737373] hover:text-[#d4d4d4] border-transparent'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>3. EXAME FÍSICO & REFLEXOS</span>
            </button>

            <button
              onClick={() => setActiveTab('fluids_thermal')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg transition border-b-2 ${
                activeTab === 'fluids_thermal'
                  ? 'bg-[#121212] border-emerald-500 text-emerald-400'
                  : 'text-[#737373] hover:text-[#d4d4d4] border-transparent'
              }`}
            >
              <Droplet className="w-4 h-4" />
              <span>4. FLUIDOS & TÉRMICO</span>
            </button>

            <button
              onClick={() => setActiveTab('emergency_cpr')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg transition border-b-2 ${
                activeTab === 'emergency_cpr'
                  ? 'bg-[#121212] border-red-500 text-red-400'
                  : 'text-[#737373] hover:text-[#d4d4d4] border-transparent'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              <span>5. EMERGÊNCIA & CPCR RECOVER</span>
            </button>

            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg transition border-b-2 ${
                activeTab === 'records'
                  ? 'bg-[#121212] border-indigo-500 text-indigo-400'
                  : 'text-[#737373] hover:text-[#d4d4d4] border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>6. FICHA ANESTÉSICA & LOGS</span>
            </button>
          </div>

          {/* Active Workstation Panels */}
          <div>
            {activeTab === 'drugs' && (
              <DrugAdministrationModal
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
              />
            )}

            {activeTab === 'fluids_thermal' && (
              <FluidTherapyPanel
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
                onAdministerQuickEmergencyDrug={handleAdministerQuickEmergencyDrug}
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
        </div>
          </div>

          <CirculatingDrugsPanel
            patient={patient}
            activeDoses={activeDoses}
            equipment={equipment}
            vitals={vitals}
          />
        </div>
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
          setActiveTab('emergency_cpr');
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
          setActiveTab('drugs');
        }}
      />

      {/* 9. EMERGENCY & RESUSCITATION REAL-TIME FEEDBACK TOAST */}
      <EmergencyFeedbackToast
        item={feedbackToast}
        onDismiss={() => setFeedbackToast(null)}
      />

      <ClinicalOccurrenceCenter
        isOpen={isOccurrenceCenterOpen}
        items={clinicalOccurrenceHistory}
        onClose={() => setIsOccurrenceCenterOpen(false)}
        onClear={() => setClinicalOccurrenceHistory([])}
      />

      {/* 11. FOOTER */}
      <footer className="border-t border-[#1a1a1a] bg-[#080808] px-4 py-2.5 text-center text-xs text-[#525252] font-mono-code">
        Simulador Open VetSim · Modelagem farmacocinética multicompartimental · Diretrizes RECOVER 2024
      </footer>
    </div>
  );
}
