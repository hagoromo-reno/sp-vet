import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveDrugDose,
  AnesthesiaEquipmentState,
  LogEntry,
  MonitorAlarmLimits,
  PatientProfile,
  ResuscitationState,
  VitalRecordPoint,
  VitalSigns,
} from './types/simulator';
import { PRESET_SCENARIOS } from './data/scenarios';
import { SPECIES_DATABASE } from './data/speciesData';
import { PKPDEngine } from './engine/pkpdEngine';
import { AudioSynthesizer } from './engine/audioSynthesizer';
import { CanvasWaveforms } from './components/monitor/CanvasWaveforms';
import { VitalNumbers } from './components/monitor/VitalNumbers';
import { ClinicalAlertRibbon } from './components/monitor/ClinicalAlertRibbon';
import { PatientPhysicalExam } from './components/patient/PatientPhysicalExam';
import { VaporizerMachine } from './components/anesthesia/VaporizerMachine';
import { VentilatorAirway } from './components/airway/VentilatorAirway';
import { DrugAdministrationModal } from './components/pharmacology/DrugAdministrationModal';
import { FluidTherapyPanel } from './components/fluids/FluidTherapyPanel';
import { CPCRResuscitationPanel } from './components/emergency/CPCRResuscitationPanel';
import { AnesthesiaRecordSheet } from './components/records/AnesthesiaRecordSheet';
import { ScenarioSelectorModal } from './components/scenarios/ScenarioSelectorModal';
import { DeathReportModal } from './components/emergency/DeathReportModal';
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
} from 'lucide-react';

export default function App() {
  // 1. ACTIVE PATIENT & SCENARIO
  const [patient, setPatient] = useState<PatientProfile>(PRESET_SCENARIOS[0]);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);

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
  const [isSurgicalStimulationActive, setIsSurgicalStimulationActive] = useState(false);

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
      message: `Simulação iniciada para ${PRESET_SCENARIOS[0].name} (${PRESET_SCENARIOS[0].species.toUpperCase()})`,
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

  // 9. ACTIVE WORKSTATION TAB
  const [activeTab, setActiveTab] = useState<
    'drugs' | 'machine_airway' | 'physical_exam' | 'fluids_thermal' | 'emergency_cpr' | 'records'
  >('drugs');
  const [isDeathModalOpen, setIsDeathModalOpen] = useState(false);
  const prevDeadStateRef = useRef<boolean>(false);

  // Auto-open death report on transition to dead
  useEffect(() => {
    if (vitals.isDead && !prevDeadStateRef.current) {
      setIsDeathModalOpen(true);
    }
    prevDeadStateRef.current = vitals.isDead;
  }, [vitals.isDead]);

  // Periodic Vital Log recording (every simulated 30 seconds)
  const lastLogSimTimeRef = useRef<number>(0);

  // SIMULATION TICK LOOP (Interval at 10 Hz)
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSimPaused) return;

      const dt = 0.1 * simSpeed;
      const newSimTime = simTimeSeconds + dt;
      setSimTimeSeconds(newSimTime);

      // Run PK/PD integration
      const { vitals: newVitals, updatedDoses, equipmentUpdates } = PKPDEngine.stepSimulation(
        dt,
        newSimTime,
        patient,
        activeDoses,
        equipment,
        resuscitation,
        isSurgicalStimulationActive,
        vitals
      );

      setVitals(newVitals);
      setActiveDoses(updatedDoses);

      if (Object.keys(equipmentUpdates).length > 0) {
        setEquipment((prev) => ({ ...prev, ...equipmentUpdates }));
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
            hr: newVitals.heartRate,
            sysBP: newVitals.systolicBP,
            diaBP: newVitals.diastolicBP,
            map: newVitals.meanArterialPressure,
            spo2: newVitals.pulseOximetrySpO2,
            etco2: newVitals.etCO2,
            rr: newVitals.respiratoryRate,
            tempC: newVitals.bodyTemperatureC,
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
    isSurgicalStimulationActive,
  ]);

  // RESET SIMULATION
  const handleResetSimulation = () => {
    const defaultSpeciesInfo = SPECIES_DATABASE[patient.species];
    setSimTimeSeconds(0);
    setActiveDoses([]);
    setVitalLogs([]);
    setEquipment({
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
      tubeSizeMm: defaultSpeciesInfo.recommendedEtTubeRange.min + 1.0,
      cuffPressureCmH2O: 0,
      ventilatorMode: 'spontaneous',
      isVentilatorActive: false,
      ventilatorSettings: {
        rateBpm: defaultSpeciesInfo.normalVitals.rrTypical,
        tidalVolumeMl: Math.round(patient.weightKg * 12),
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
    });
    setResuscitation({
      isCPRActive: false,
      compressionsPerMin: 110,
      lastCompressionSimTime: 0,
      compressionDepthQuality: 0.8,
      defibrillatorChargedJoules: 0,
      isDefibrillatorArmed: false,
    });
    setEventLogs([
      {
        id: `reset_${Date.now()}`,
        simTimeSeconds: 0,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'system',
        message: 'Simulação reiniciada.',
        severity: 'normal',
      },
    ]);
  };

  // CHANGE PATIENT / SCENARIO
  const handleSelectScenario = (newPatient: PatientProfile) => {
    setPatient(newPatient);
    setIsScenarioModalOpen(false);
    handleResetSimulation();
  };

  // ADMINISTER DRUG
  const handleAdministerDrug = (
    doseData: Omit<ActiveDrugDose, 'id' | 'administeredAtSimTime' | 'peakEffectSimTime' | 'currentCe' | 'currentCp' | 'deliveryElapsedSec' | 'isFullyDelivered' | 'isFastBolusShockTriggered'>
  ) => {
    const newDose: ActiveDrugDose = {
      ...doseData,
      id: `dose_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      administeredAtSimTime: simTimeSeconds,
      peakEffectSimTime: simTimeSeconds + 60,
      deliveryElapsedSec: 0,
      deliveryDurationSec: doseData.deliveryDurationSec || (doseData.administrationSpeed === 'bolus_rapid' ? 4 : 60),
      transitLagRemainingSec: doseData.transitLagRemainingSec !== undefined ? doseData.transitLagRemainingSec : 20,
      isFullyDelivered: false,
      isFastBolusShockTriggered: false,
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
    setActiveDoses((prev) => prev.filter((d) => d.id !== doseId));
    setEventLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'drug',
        message: `Infusão contínua (CRI) interrompida.`,
        severity: 'warning',
      },
    ]);
  };

  // INTUBATION
  const handlePerformIntubation = (isCorrectTracheal: boolean, tubeSizeMm: number) => {
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

  // SURGICAL STIMULATION TRIGGER
  const handleStimulateSurgical = () => {
    setIsSurgicalStimulationActive(true);
    setEventLogs((prev) => [
      ...prev,
      {
        id: `surg_${Date.now()}`,
        simTimeSeconds,
        realTimestamp: new Date().toLocaleTimeString(),
        type: 'surgical',
        message: 'Estímulo nociceptivo cirúrgico aplicado (Incisão / Tração visceral).',
        severity: vitals.anestheticDepthScore < 50 ? 'warning' : 'normal',
      },
    ]);

    setTimeout(() => {
      setIsSurgicalStimulationActive(false);
    }, 4000);
  };

  // FLUID BOLUS
  const handleGiveFluidBolus = (bolusMl: number, fluidName: string) => {
    setEquipment((prev) => ({
      ...prev,
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
  const handleAdministerQuickEmergencyDrug = (
    drugId: string,
    dosePerKg: number,
    route: 'IV' | 'IV_slow'
  ) => {
    const drugName = drugId === 'epinephrine' ? 'Epinefrina (Adrenalina)' :
      drugId === 'atropine' ? 'Sulfato de Atropina' :
      drugId === 'lidocaine_2pct' ? 'Lidocaína 2%' : 'Gluconato de Cálcio 10%';

    handleAdministerDrug({
      drugId,
      drugName,
      category: 'emergency_inotrope',
      route,
      doseAmount: Number((dosePerKg * patient.weightKg).toFixed(2)),
      dosePerKg,
      volumeMl: Number(((dosePerKg * patient.weightKg) / 1.0).toFixed(2)),
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
          </div>

          {/* Clock & Speed Multipliers */}
          <div className="flex items-center space-x-3 font-mono-code text-xs">
            {/* Simulation Timer */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-[#101010] border border-[#222222] rounded-lg">
              <span className="text-[#737373] text-[10px]">TEMPO DE ANESTESIA:</span>
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
                className="p-1.5 text-[#737373] hover:text-red-400 rounded transition"
                title="Reiniciar Simulação"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col space-y-4">
        {/* Real-time Non-Disruptive Clinical Alert Ribbon (PCR, Apnea, Interactions, Death) */}
        <ClinicalAlertRibbon
          vitals={vitals}
          onOpenDeathReport={() => setIsDeathModalOpen(true)}
          onSwitchToEmergencyTab={() => setActiveTab('emergency_cpr')}
        />

        {/* Top Half: Real-Time Waveform Monitor & Numeric LED Tiles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[380px]">
          {/* Waveform Sweeping Canvas (7 cols) */}
          <div className="lg:col-span-7 h-[380px]">
            <CanvasWaveforms vitals={vitals} isSimPaused={isSimPaused} />
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
              onTriggerNibpMeasurement={() => {
                setEventLogs((prev) => [
                  ...prev,
                  {
                    id: `nibp_${Date.now()}`,
                    simTimeSeconds,
                    realTimestamp: new Date().toLocaleTimeString(),
                    type: 'vital',
                    message: `Medição NIBP manual: ${vitals.systolicBP}/${vitals.diastolicBP} (PAM ${vitals.meanArterialPressure} mmHg)`,
                    severity: 'normal',
                  },
                ]);
              }}
              onOpenDeathReport={() => setIsDeathModalOpen(true)}
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
                    setTimeout(() => {
                      setEquipment((prev) => ({ ...prev, isOxygenFlushActive: false }));
                    }, 1500);
                  }}
                  onManualBagSqueeze={() => {
                    setEventLogs((prev) => [
                      ...prev,
                      {
                        id: `bag_${Date.now()}`,
                        simTimeSeconds,
                        realTimestamp: new Date().toLocaleTimeString(),
                        type: 'equipment',
                        message: 'Ventilação manual / Compressão do balão reservatório.',
                        severity: 'normal',
                      },
                    ]);
                  }}
                />

                <VentilatorAirway
                  equipment={equipment}
                  patient={patient}
                  onUpdateEquipment={(updates) => setEquipment((prev) => ({ ...prev, ...updates }))}
                  onPerformIntubation={handlePerformIntubation}
                  onExtubate={handleExtubate}
                />
              </div>
            )}

            {activeTab === 'physical_exam' && (
              <PatientPhysicalExam
                patient={patient}
                vitals={vitals}
                onStimulateSurgical={handleStimulateSurgical}
                isSurgicalStimulationActive={isSurgicalStimulationActive}
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
        onRestartScenario={handleResetSimulation}
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

      {/* 5. FOOTER */}
      <footer className="border-t border-[#1a1a1a] bg-[#080808] px-4 py-2.5 text-center text-xs text-[#525252] font-mono-code">
        Open VetSim Simulator · Modelagem Farmacocinética Multicompartimental · Diretrizes RECOVER 2024
      </footer>
    </div>
  );
}
