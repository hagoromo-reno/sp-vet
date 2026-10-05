import React, { useEffect, useRef, useState } from 'react';
import { VitalSigns, AnesthesiaEquipmentState, AdminMonitorOverrides } from '../../types/simulator';
import { AudioSynthesizer } from '../../engine/audioSynthesizer';
import { ShieldAlert, Sliders } from 'lucide-react';

interface CanvasWaveformsProps {
  vitals: VitalSigns;
  isSimPaused: boolean;
  equipment?: AnesthesiaEquipmentState;
  adminOverrides?: AdminMonitorOverrides;
  onOpenAdminMenu?: () => void;
}

export const CanvasWaveforms: React.FC<CanvasWaveformsProps> = ({
  vitals,
  isSimPaused,
  equipment,
  adminOverrides,
  onOpenAdminMenu,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sweep speed options: 25 mm/s (standard) or 50 mm/s (high-res)
  const [sweepSpeedMmPerSec, setSweepSpeedMmPerSec] = useState<number>(25);
  const [showShading, setShowShading] = useState<boolean>(true);

  // Animation & simulation persistent refs across render ticks
  const sweepXRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const lastBeatTimeRef = useRef<number>(performance.now());
  const lastRespTimeRef = useRef<number>(performance.now());

  // Multi-sampling state trackers
  const heartPhaseRef = useRef<number>(0);
  const respPhaseRef = useRef<number>(0);
  const lastPvcTimeRef = useRef<number>(0);
  const isPvcBeatRef = useRef<boolean>(false);
  const droppedBeatCountRef = useRef<number>(0);
  const smoothedEtco2Ref = useRef<number>(38);
  const smoothedRrRef = useRef<number>(15);

  // Store last Y values to ensure 100% continuous, non-broken connected lines
  const lastYRef = useRef<{
    ecg: number;
    pleth: number;
    capno: number;
    art: number;
  }>({ ecg: 0, pleth: 0, capno: 0, art: 0 });

  // Store canvas dimensions
  const dimsRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 800,
    height: 520,
    dpr: 1,
  });

  // Handle Resize & DPI Setup
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      dimsRef.current = { width, height, dpr };
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        // Fill initial background with medical monitor dark canvas
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);
        drawCompleteGrid(ctx, width, height);
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Function to draw authentic medical monitor millimeter grid
  const drawCompleteGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 5mm large grid squares (approx 20px) and 1mm small squares (approx 4px)
    const gridSizeLarge = 24;
    const gridSizeSmall = 6;

    // Small 1mm grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSizeSmall) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSizeSmall) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Large 5mm grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSizeLarge) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSizeLarge) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Channel separation horizontal dividers
    const trackH = height / 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(0, i * trackH);
      ctx.lineTo(width, i * trackH);
    }
    ctx.stroke();
  };

  // Redraw grid segment in the erase band ahead of sweep
  const drawEraseGridSegment = (
    ctx: CanvasRenderingContext2D,
    startX: number,
    eraseW: number,
    height: number
  ) => {
    const endX = startX + eraseW;
    const gridSizeLarge = 24;
    const gridSizeSmall = 6;

    // Small 1mm grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const firstSmallX = Math.floor(startX / gridSizeSmall) * gridSizeSmall;
    for (let x = firstSmallX; x <= endX; x += gridSizeSmall) {
      if (x >= startX) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
    }
    for (let y = 0; y < height; y += gridSizeSmall) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Large 5mm grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const firstLargeX = Math.floor(startX / gridSizeLarge) * gridSizeLarge;
    for (let x = firstLargeX; x <= endX; x += gridSizeLarge) {
      if (x >= startX) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
    }
    for (let y = 0; y < height; y += gridSizeLarge) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Dividers
    const trackH = height / 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(startX, i * trackH);
      ctx.lineTo(endX, i * trackH);
    }
    ctx.stroke();
  };

  // -------------------------------------------------------------
  // PHYSIOLOGICAL WAVEFORM MATHEMATICAL SYNTHESIS FUNCTIONS
  // -------------------------------------------------------------

  /**
   * Evaluates Lead II ECG waveform at normalized cardiac cycle phase p in [0, 1).
   * Range: -1.0 to +1.2 mV equivalent.
   */
  const calculateECG = (p: number, vitals: VitalSigns, isPvc: boolean, simTimeSec: number): number => {
    const rhythm = vitals.cardiacRhythm;

    // 1. Asystole
    if (rhythm === 'asystole') {
      // Subtle isoelectric micro-drift + 50Hz hospital line hum
      return (Math.sin(simTimeSec * 100) * 0.015 + (Math.random() - 0.5) * 0.02);
    }

    // 2. Ventricular Fibrillation (VF) - Chaotic undulating multi-frequency fibrillatory waves
    if (rhythm === 'ventricular_fibrillation') {
      const w1 = Math.sin(simTimeSec * 2 * Math.PI * 4.8) * 0.44;
      const w2 = Math.sin(simTimeSec * 2 * Math.PI * 6.9 + 0.8) * 0.32;
      const w3 = Math.sin(simTimeSec * 2 * Math.PI * 2.3 + 1.7) * 0.22;
      const w4 = Math.sin(simTimeSec * 2 * Math.PI * 9.1 + 2.5) * 0.14;
      const noise = (Math.random() - 0.5) * 0.05;
      return w1 + w2 + w3 + w4 + noise;
    }

    // 3. Ventricular Tachycardia (VT) - Wide, bizarre notched monomorphic QRS complexes
    if (rhythm === 'ventricular_tachycardia') {
      // Wide QRS duration (~50% of cardiac cycle), apical notch and discordant inverted T wave
      if (p < 0.46) {
        const qrsP = p / 0.46;
        const mainR = Math.sin(qrsP * Math.PI);
        const notch = 0.20 * Math.sin(qrsP * Math.PI * 3);
        return (mainR + notch) * 1.15;
      } else if (p < 0.80) {
        const tP = (p - 0.46) / 0.34;
        return -0.42 * Math.sin(tP * Math.PI);
      } else {
        return (Math.random() - 0.5) * 0.015;
      }
    }

    // 4. Ventricular Premature Complex (VPC / PVC) beat
    if (isPvc) {
      if (p < 0.44) {
        const pNorm = p / 0.44;
        if (pNorm < 0.35) {
          return -1.05 * Math.sin((pNorm / 0.35) * Math.PI);
        } else if (pNorm < 0.55) {
          return 0.38 * Math.sin(((pNorm - 0.35) / 0.20) * Math.PI);
        } else {
          return 0.68 * Math.sin(((pNorm - 0.55) / 0.45) * Math.PI);
        }
      }
      return (Math.random() - 0.5) * 0.01;
    }

    // 5. Atrial Flutter (ondas F em dente de serra a ~300 bpm com condução filtrada)
    if (rhythm === 'atrial_flutter') {
      const flutterPhase = (simTimeSec * 5.0) % 1.0;
      const sawTooth = (flutterPhase * 2.0 - 1.0) * -0.18;
      let ecgVal = sawTooth;

      const gauss = (pos: number, center: number, width: number, amp: number) => {
        const diff = pos - center;
        return amp * Math.exp(-(diff * diff) / (2 * width * width));
      };
      ecgVal += gauss(p, 0.23, 0.011, 1.10); // R wave
      ecgVal += gauss(p, 0.26, 0.009, -0.25); // S wave
      return ecgVal + (Math.random() - 0.5) * 0.01;
    }

    // 6. Atrial Fibrillation (AFib) - Irregular baseline f-waves with normal narrow QRS
    let baselineNoise = 0;
    if (rhythm === 'atrial_fibrillation') {
      baselineNoise = Math.sin(simTimeSec * 2 * Math.PI * 6.5) * 0.08 + (Math.random() - 0.5) * 0.04;
    }

    // 7. BAV 3º Grau (Dissociação AV Completa)
    if (rhythm === 'av_block_3rd_degree') {
      const gauss = (pos: number, center: number, width: number, amp: number) => {
        const diff = pos - center;
        return amp * Math.exp(-(diff * diff) / (2 * width * width));
      };
      const pAtrialCycle = (simTimeSec * 1.7) % 1.0;
      let ecgVal = gauss(pAtrialCycle, 0.20, 0.04, 0.18);

      if (p < 0.48) {
        const qrsP = p / 0.48;
        ecgVal += Math.sin(qrsP * Math.PI) * 0.95;
      } else if (p < 0.78) {
        const tP = (p - 0.48) / 0.30;
        ecgVal += -0.32 * Math.sin(tP * Math.PI);
      }
      return ecgVal + (Math.random() - 0.5) * 0.01;
    }

    // Gaussian helper: A * exp(-((p - mu)^2) / (2 * sigma^2))
    const gauss = (pos: number, center: number, width: number, amp: number) => {
      const diff = pos - center;
      return amp * Math.exp(-(diff * diff) / (2 * width * width));
    };

    let ecg = baselineNoise;

    // Potassium level check for hyperkalemia ECG alterations
    const kLevel = vitals.arterialBloodGases?.potassium ?? 4.0;
    const isHyperkalemic = rhythm === 'hyperkalemia' || kLevel > 6.0;
    const isSevereHyperkalemic = rhythm === 'hyperkalemia' || kLevel > 7.5;
    const isHypokalemic = rhythm === 'hypokalemia' || kLevel < 3.2;

    // Check dropped beat for 2nd degree AV blocks (Mobitz I / Wenckebach & Mobitz II)
    const isMobitz1 = rhythm === 'av_block_2nd_degree' || rhythm === 'av_block_2nd_degree_mobitz1';
    const isMobitz2 = rhythm === 'av_block_2nd_degree_mobitz2';
    const beatIndex = droppedBeatCountRef.current;
    const isQrsDroppedThisBeat = (isMobitz1 && beatIndex === 3) || (isMobitz2 && beatIndex === 2);

    // Dynamic PR interval offset for AV Blocks
    let pCenter = 0.12;
    if (rhythm === 'av_block_1st_degree') {
      pCenter = 0.04; // Long PR interval (0.19 normalized duration vs 0.11 normal)
    } else if (isMobitz1) {
      pCenter = Math.max(0.04, 0.12 - beatIndex * 0.026);
    }

    // P WAVE
    const isSvt = rhythm === 'supraventricular_tachycardia';
    if (rhythm !== 'atrial_fibrillation' && !isSvt && !isSevereHyperkalemic) {
      const pAmp = isHyperkalemic ? 0.04 : 0.16;
      ecg += gauss(p, pCenter, 0.026, pAmp);
    }

    // If QRS is dropped in 2nd degree AV block, skip QRS and T (isoelectric line following P)
    if (isQrsDroppedThisBeat && (p >= 0.18 && p <= 0.85)) {
      return ecg + (Math.random() - 0.5) * 0.01;
    }

    // Q WAVE (Center: 0.20, width: 0.008, negative)
    ecg += gauss(p, 0.20, 0.008, -0.12);

    // R WAVE (Center: 0.23, width: 0.014, sharp tall positive spike)
    const rAmp = isHyperkalemic ? 0.85 : isSvt ? 1.25 : 1.15;
    const rWidth = isSvt ? 0.009 : isHyperkalemic ? 0.019 : 0.012;
    ecg += gauss(p, 0.23, rWidth, rAmp);

    // S WAVE (Center: 0.26, width: 0.011, sharp negative dip)
    ecg += gauss(p, 0.26, 0.010, -0.28);

    // ST SEGMENT (Isoelectric or altered in Ischemia / Injury / Hypokalemia)
    if (p >= 0.27 && p < 0.38) {
      if (rhythm === 'st_elevation_injury') {
        ecg += 0.32 * Math.sin(((p - 0.27) / 0.11) * Math.PI); // Convex ST elevation
      } else if (rhythm === 'st_depression_ischemia') {
        ecg += -0.25; // ST depression
      } else if (isHypokalemic) {
        ecg += -0.09; // Mild ST depression in hypokalemia
      } else if (vitals.pulseOximetrySpO2 < 85) {
        ecg += -0.15 * Math.sin(((p - 0.27) / 0.11) * Math.PI); // Hypoxemic ST depression
      }
    }

    // T WAVE (Center: 0.44, width: 0.055, smooth asymmetric wave)
    if (isHyperkalemic) {
      // Tented, tall, peaked, narrow symmetrical T wave of hyperkalemia
      const tAmp = Math.min(1.1, 0.55 + (kLevel - 6.0) * 0.35);
      ecg += gauss(p, 0.44, 0.022, tAmp);
    } else if (rhythm === 't_wave_inversion') {
      // Deep symmetrical inverted T wave
      ecg += gauss(p, 0.44, 0.046, -0.35);
    } else if (isHypokalemic) {
      // Flattened T wave + prominent U wave
      ecg += gauss(p, 0.42, 0.040, 0.06);
      ecg += gauss(p, 0.56, 0.042, 0.18); // Prominent U wave
    } else if (isSvt) {
      // SVT rapid repolarization
      ecg += gauss(p, 0.42, 0.040, 0.18);
    } else {
      // Normal rounded asymmetrical T wave
      ecg += gauss(p, 0.44, 0.048, 0.24);
    }

    // Subtle baseline thermal noise
    ecg += (Math.random() - 0.5) * 0.01;

    return ecg;
  };

  /**
   * Evaluates SpO2 Arterial Photoplethysmogram (Pleth) waveform at phase p in [0, 1).
   * Range: 0.0 (baseline) to 1.0 (peak systole).
   */
  const calculatePleth = (p: number, vitals: VitalSigns): number => {
    // If Asystole or severe arrest, flatline
    if ((vitals.cardiacRhythm === 'asystole' && !vitals.isChestCompressionPulse) || vitals.pulseOximetrySpO2 <= 0) {
      return 0.02 * (Math.random() - 0.5);
    }

    // Pulse wave arrives with ~0.10s delay relative to R-wave (p offset ~0.12)
    const pp = (p + 0.88) % 1.0;

    const isVasodilation = adminOverrides?.oximetry === 'vasodilation';
    const isVasoconstriction = adminOverrides?.oximetry === 'vasoconstriction';

    let pleth = 0;
    if (pp < 0.26) {
      // Anacrotic steep systolic upstroke (Sigmoidal curve to crest)
      const upExponent = isVasoconstriction ? 1.6 : 1.1;
      pleth = Math.sin((pp / 0.26) * (Math.PI / 2));
      pleth = Math.pow(pleth, upExponent);
    } else if (pp < 0.44) {
      // Catacrotic limb with Dicrotic Notch (Incisura)
      const tNotch = (pp - 0.26) / 0.18;
      if (isVasoconstriction) {
        // Flattened slope with loss/attenuation of dicrotic notch
        pleth = 1.0 - 0.65 * tNotch;
      } else if (isVasodilation) {
        // Broad wave with low, rounded dicrotic notch
        if (tNotch < 0.55) {
          pleth = 1.0 - 0.32 * (tNotch / 0.55);
        } else {
          const tRebound = (tNotch - 0.55) / 0.45;
          pleth = 0.68 + 0.12 * Math.sin(tRebound * Math.PI);
        }
      } else {
        // Normal crisp dicrotic notch
        if (tNotch < 0.45) {
          pleth = 1.0 - 0.42 * (tNotch / 0.45);
        } else {
          const tRebound = (tNotch - 0.45) / 0.55;
          pleth = 0.58 + 0.16 * Math.sin(tRebound * Math.PI);
        }
      }
    } else {
      // Diastolic runoff decay towards baseline
      const tDecay = (pp - 0.44) / 0.56;
      const decayRate = isVasodilation ? 2.4 : 3.4;
      const baseLevel = isVasodilation ? 0.68 : 0.58;
      pleth = baseLevel * Math.exp(-decayRate * tDecay);
    }

    // Perfusion Index scaling (vasoconstriction/hypothermia reduces amplitude, vasodilation increases amplitude)
    let piScale = vitals.perfusionIndex / 2.0;
    if (isVasodilation) {
      piScale = 1.75;
    } else if (isVasoconstriction) {
      piScale = 0.26;
    }
    pleth = Math.max(0, pleth * piScale);

    return pleth;
  };

  /**
   * Evaluates Capnography (EtCO2) waveform in mmHg at breath phase p in [0, 1).
   * Range: 0 mmHg to ~60 mmHg.
   */
  const calculateCapnogram = (p: number, vitals: VitalSigns, effectiveEtCO2?: number): number => {
    const etCO2 = effectiveEtCO2 !== undefined ? effectiveEtCO2 : vitals.etCO2;
    const fiCO2 = vitals.fiCO2;

    // 1. Cardiac Arrest / Apnea / Flatline
    if (vitals.respiratoryRate === 0 || vitals.capnogramType === 'cardiac_arrest_flat') {
      return fiCO2;
    }

    // 2. Esophageal Intubation - Immediate flatline at 0
    if (vitals.capnogramType === 'esophageal_intubation' || etCO2 === 0) {
      return 0;
    }

    // 3. Obstructive / Bronchospasm "Shark-Fin" pattern (Asthma, COPD, kinked tube)
    if (vitals.capnogramType === 'obstructive_shark_fin') {
      if (p < 0.68) {
        // Prolonged upward curving Phase II/III with no distinct alpha angle (shark fin)
        const curve = Math.pow(p / 0.68, 1.95);
        return fiCO2 + (etCO2 - fiCO2) * curve;
      } else if (p < 0.78) {
        // Rapid inspiratory downstroke
        const tDown = (p - 0.68) / 0.10;
        return fiCO2 + (etCO2 - fiCO2) * (1.0 - tDown);
      } else {
        return fiCO2;
      }
    }

    // 4. Standard 4-Phase Capnogram (Phase I -> II -> III -> Phase 0)
    if (p < 0.08) {
      // Phase I: Inspiratory Baseline (0 mmHg or FiCO2 in rebreathing/exhausted soda lime)
      return fiCO2;
    } else if (p < 0.24) {
      // Phase II: Rapid Expiratory S-Curve Upstroke (Anatomic dead space gas emptying)
      const tUp = (p - 0.08) / 0.16;
      const sCurve = 1 / (1 + Math.exp(-10 * (tUp - 0.5)));
      return fiCO2 + (etCO2 * 0.92 - fiCO2) * sCurve;
    } else if (p < 0.68) {
      // Phase III: Alveolar Plateau (Gently upsloping to peak EtCO2)
      const tPlateau = (p - 0.24) / 0.44;
      let plateauCo2 = etCO2 * (0.92 + 0.08 * tPlateau);

      // Curare Cleft pathology (diaphragmatic notch during neuromuscular recovery / breathing against ventilator)
      if (vitals.capnogramType === 'curare_cleft') {
        const cleftPos = (tPlateau - 0.55);
        if (Math.abs(cleftPos) < 0.15) {
          const dip = 0.42 * etCO2 * Math.exp(-(cleftPos * cleftPos) / 0.004);
          plateauCo2 -= dip;
        }
      }

      // Cardiogenic Oscillations pathology (rhythmic pulses pushing alveolar gas)
      if (vitals.capnogramType === 'cardiogenic_oscillations') {
        plateauCo2 += Math.sin(tPlateau * Math.PI * 14) * 2.8;
      }

      return Math.max(fiCO2, plateauCo2);
    } else if (p < 0.78) {
      // Phase 0: Rapid inspiratory downstroke back to baseline
      const tDown = (p - 0.68) / 0.10;
      return Math.max(fiCO2, etCO2 * (1.0 - tDown));
    } else {
      // Rest of inspiration
      return fiCO2;
    }
  };

  /**
   * Evaluates Invasive Arterial Blood Pressure (ART / PAI) waveform in mmHg at phase p in [0, 1).
   * Calibrated strictly to Systolic, Diastolic, and Mean Arterial Pressure.
   */
  const calculateArterialLine = (p: number, vitals: VitalSigns): number => {
    // If Asystole / VFib, pressure collapses to static filling pressure (~10-15 mmHg)
    if ((vitals.cardiacRhythm === 'asystole' || vitals.cardiacRhythm === 'ventricular_fibrillation') && !vitals.isChestCompressionPulse) {
      return 12 + (Math.random() - 0.5) * 1.5;
    }

    const sys = Math.max(30, vitals.systolicBP);
    const dia = Math.max(15, vitals.diastolicBP);
    const pulsePressure = sys - dia;

    // Pulse wave arrives ~0.08s after R-wave
    const ap = (p + 0.90) % 1.0;

    let normArt = 0;
    if (ap < 0.18) {
      // Anacrotic steep systolic ejection upstroke (dP/dt)
      normArt = Math.sin((ap / 0.18) * (Math.PI / 2));
      normArt = Math.pow(normArt, 1.4);
    } else if (ap < 0.38) {
      // Systolic peak runoff and sharp Dicrotic Notch at ap ~ 0.28
      const tNotch = (ap - 0.18) / 0.20;
      if (tNotch < 0.50) {
        normArt = 1.0 - 0.48 * (tNotch / 0.50);
      } else {
        // Dicrotic rebound wave (closure of aortic valve)
        const tReb = (tNotch - 0.50) / 0.50;
        normArt = 0.52 + 0.14 * Math.sin(tReb * Math.PI);
      }
    } else {
      // Diastolic runoff decay curve down to end-diastolic pressure
      const tDecay = (ap - 0.38) / 0.62;
      normArt = 0.52 * Math.exp(-3.5 * tDecay);
    }

    return dia + pulsePressure * normArt;
  };

  // -------------------------------------------------------------
  // MAIN HIGH-DPI CANVAS RENDER LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;

    const render = (currentTime: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (currentTime - lastTimeRef.current) / 1000));
      lastTimeRef.current = currentTime;

      const width = dimsRef.current.width;
      const height = dimsRef.current.height;
      const trackHeight = height / 4;

      if (!isSimPaused && width > 0 && height > 0) {
        // Standard medical sweep speed: e.g., 25 mm/s -> approx 140 pixels/sec at screen scale
        const pixelsPerMm = 5.2;
        const sweepSpeedPxPerSec = sweepSpeedMmPerSec * pixelsPerMm;

        const prevSweepX = sweepXRef.current;
        let nextSweepX = prevSweepX + sweepSpeedPxPerSec * dt;
        let didWrap = false;

        if (nextSweepX >= width) {
          nextSweepX = 0;
          didWrap = true;
          sweepXRef.current = 0;
        } else {
          sweepXRef.current = nextSweepX;
        }

        // Erase corridor ahead of sweep head (24px wide)
        const eraseWidth = 26;
        const eraseStartX = nextSweepX;
        const eraseW = Math.min(eraseWidth, width - eraseStartX);

        ctx.fillStyle = '#050505';
        ctx.fillRect(eraseStartX, 0, eraseW, height);

        // If wrapping, also erase the start of screen
        if (eraseStartX + eraseWidth > width) {
          const wrapEraseW = (eraseStartX + eraseWidth) - width;
          ctx.fillRect(0, 0, wrapEraseW, height);
          drawEraseGridSegment(ctx, 0, wrapEraseW, height);
        }

        drawEraseGridSegment(ctx, eraseStartX, eraseW, height);

        // ---------------------------------------------------------
        // CARDIAC & RESPIRATORY TIME ACCUMULATORS
        // ---------------------------------------------------------
        const hr = Math.max(15, vitals.heartRate);
        const beatIntervalSec = 60.0 / hr;
        const timeSinceBeat = (currentTime - lastBeatTimeRef.current) / 1000;

        if (timeSinceBeat >= beatIntervalSec) {
          lastBeatTimeRef.current = currentTime;

          // Arrhythmia logic: VPC trigger probability
          if (vitals.cardiacRhythm === 'ventricular_premature_complexes') {
            isPvcBeatRef.current = Math.random() < 0.28;
          } else {
            isPvcBeatRef.current = false;
          }

          // 2nd Degree AV Block (Wenckebach / Mobitz): drop 1 out of 4 beats
          if (
            vitals.cardiacRhythm === 'av_block_2nd_degree' ||
            vitals.cardiacRhythm === 'av_block_2nd_degree_mobitz1' ||
            vitals.cardiacRhythm === 'av_block_2nd_degree_mobitz2'
          ) {
            droppedBeatCountRef.current = (droppedBeatCountRef.current + 1) % 4;
          }

          // Pulse audio beep trigger (synchronized with SpO2 and mechanical pulse presence)
          if (
            vitals.cardiacRhythm !== 'asystole' &&
            vitals.cardiacRhythm !== 'pulseless_electrical_activity' &&
            vitals.cardiacRhythm !== 'ventricular_fibrillation' &&
            !vitals.isDead &&
            vitals.pulseOximetrySpO2 > 0 &&
            vitals.meanArterialPressure > 15
          ) {
            AudioSynthesizer.playPulseBeep(vitals.pulseOximetrySpO2, isPvcBeatRef.current);
          }
        }

        const targetRR = Math.max(1, vitals.respiratoryRate);
        if (!smoothedRrRef.current || smoothedRrRef.current <= 0) {
          smoothedRrRef.current = targetRR;
        } else {
          smoothedRrRef.current += (targetRR - smoothedRrRef.current) * Math.min(1.0, dt * 2.0);
        }
        const respIntervalSec = 60.0 / smoothedRrRef.current;

        // ---------------------------------------------------------
        // MULTI-SAMPLE CONTINUOUS VECTOR DRAWING
        // Evaluates every single sub-pixel column between prevSweepX and nextSweepX
        // Fine 1.0px strokes for high-resolution authentic veterinary monitor look
        // ---------------------------------------------------------
        if (!didWrap && nextSweepX > prevSweepX) {
          const stepCount = Math.max(1, Math.ceil(nextSweepX - prevSweepX));

          // Base coordinate lines for each track
          const ecgCenterY = trackHeight * 0.50;
          const plethBaseY = trackHeight * 1.88;
          const plethMaxH = trackHeight * 0.72;
          const capnoBaseY = trackHeight * 2.88;
          const capnoMaxH = trackHeight * 0.74;
          const artBaseY = trackHeight * 3.88;
          const artMaxH = trackHeight * 0.74;

          // Collect subpixel points for single continuous path strokes
          const ecgPoints: { x: number; y: number }[] = [];
          const plethPoints: { x: number; y: number }[] = [];
          const capnoPoints: { x: number; y: number }[] = [];
          const artPoints: { x: number; y: number }[] = [];

          for (let step = 0; step < stepCount; step++) {
            const currentSubX = prevSweepX + (step + 1) * ((nextSweepX - prevSweepX) / stepCount);
            const subDt = (dt / stepCount);
            const subTimeSec = (currentTime - (stepCount - step - 1) * (dt / stepCount * 1000)) / 1000;

            // Advance phases purely smoothly without abrupt collisions
            heartPhaseRef.current = (heartPhaseRef.current + subDt / beatIntervalSec) % 1.0;
            respPhaseRef.current = (respPhaseRef.current + subDt / respIntervalSec) % 1.0;

            const pHeart = heartPhaseRef.current;
            const pResp = respPhaseRef.current;

            // 1. ECG Y coordinate
            const ecgVal = calculateECG(pHeart, vitals, isPvcBeatRef.current, subTimeSec);
            const ecgY = ecgCenterY - ecgVal * (trackHeight * 0.38);

            // 2. Pleth Y coordinate
            const plethVal = calculatePleth(pHeart, vitals);
            const plethY = plethBaseY - plethVal * plethMaxH;

            // 3. Capnogram Y coordinate (Calibrated 0-70 mmHg with continuous smooth transition)
            const targetEt = (vitals.isDead || vitals.respiratoryRate === 0) ? 0 : vitals.etCO2;
            smoothedEtco2Ref.current += (targetEt - smoothedEtco2Ref.current) * Math.min(1.0, subDt * 2.5);
            const capnoValMmHg = calculateCapnogram(pResp, vitals, smoothedEtco2Ref.current);
            const normCapno = Math.min(1.0, Math.max(0, capnoValMmHg / 70.0));
            const capnoY = capnoBaseY - normCapno * capnoMaxH;

            // 4. Arterial Pressure Y coordinate (Calibrated 0-200 mmHg)
            const artValMmHg = calculateArterialLine(pHeart, vitals);
            const normArt = Math.min(1.0, Math.max(0, artValMmHg / 180.0));
            const artY = artBaseY - normArt * artMaxH;

            ecgPoints.push({ x: currentSubX, y: ecgY });
            plethPoints.push({ x: currentSubX, y: plethY });
            capnoPoints.push({ x: currentSubX, y: capnoY });
            artPoints.push({ x: currentSubX, y: artY });
          }

          // Single continuous vector render per track with balanced medical monitor thickness
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // --- 1. ECG (GREEN #22c55e) ---
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.45;
          ctx.beginPath();
          ctx.moveTo(prevSweepX, lastYRef.current.ecg || (ecgPoints[0]?.y ?? ecgCenterY));
          for (let i = 0; i < ecgPoints.length; i++) {
            ctx.lineTo(ecgPoints[i].x, ecgPoints[i].y);
          }
          ctx.stroke();

          // --- 2. PLETH (CYAN #06b6d4) ---
          if (showShading && plethPoints.length > 0) {
            ctx.fillStyle = 'rgba(6, 182, 212, 0.09)';
            ctx.beginPath();
            ctx.moveTo(prevSweepX, plethBaseY);
            ctx.lineTo(prevSweepX, lastYRef.current.pleth || plethPoints[0].y);
            for (let i = 0; i < plethPoints.length; i++) {
              ctx.lineTo(plethPoints[i].x, plethPoints[i].y);
            }
            ctx.lineTo(nextSweepX, plethBaseY);
            ctx.closePath();
            ctx.fill();
          }
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.55;
          ctx.beginPath();
          ctx.moveTo(prevSweepX, lastYRef.current.pleth || (plethPoints[0]?.y ?? plethBaseY));
          for (let i = 0; i < plethPoints.length; i++) {
            ctx.lineTo(plethPoints[i].x, plethPoints[i].y);
          }
          ctx.stroke();

          // --- 3. CAPNOGRAPHY (YELLOW #eab308) ---
          if (showShading && capnoPoints.length > 0) {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.11)';
            ctx.beginPath();
            ctx.moveTo(prevSweepX, capnoBaseY);
            ctx.lineTo(prevSweepX, lastYRef.current.capno || capnoPoints[0].y);
            for (let i = 0; i < capnoPoints.length; i++) {
              ctx.lineTo(capnoPoints[i].x, capnoPoints[i].y);
            }
            ctx.lineTo(nextSweepX, capnoBaseY);
            ctx.closePath();
            ctx.fill();
          }
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1.65;
          ctx.beginPath();
          ctx.moveTo(prevSweepX, lastYRef.current.capno || (capnoPoints[0]?.y ?? capnoBaseY));
          for (let i = 0; i < capnoPoints.length; i++) {
            ctx.lineTo(capnoPoints[i].x, capnoPoints[i].y);
          }
          ctx.stroke();

          // --- 4. ART (RED #ef4444) ---
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.45;
          ctx.beginPath();
          ctx.moveTo(prevSweepX, lastYRef.current.art || (artPoints[0]?.y ?? artBaseY));
          for (let i = 0; i < artPoints.length; i++) {
            ctx.lineTo(artPoints[i].x, artPoints[i].y);
          }
          ctx.stroke();

          if (ecgPoints.length > 0) {
            lastYRef.current = {
              ecg: ecgPoints[ecgPoints.length - 1].y,
              pleth: plethPoints[plethPoints.length - 1].y,
              capno: capnoPoints[capnoPoints.length - 1].y,
              art: artPoints[artPoints.length - 1].y,
            };
          }

          // Sweep vector complete
        } else {
          // Wrapped around, reset previous Y markers
          lastYRef.current = {
            ecg: trackHeight * 0.50,
            pleth: trackHeight * 1.88,
            capno: trackHeight * 2.88,
            art: trackHeight * 3.88,
          };
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [vitals, isSimPaused, sweepSpeedMmPerSec, showShading, adminOverrides]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#050505] rounded-xl overflow-hidden border border-[#222222] shadow-2xl select-none"
    >
      {/* ----------------- TRACK 1: ECG (GREEN) ----------------- */}
      <div className="absolute top-2 left-3 z-10 flex items-center space-x-2 pointer-events-none waveform-label">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-emerald-400">
          ECG · II (1.0 mV/cm)
        </span>
        <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono-code">
          {vitals.cardiacRhythm.replace(/_/g, ' ').toUpperCase()}
        </span>
        {adminOverrides && adminOverrides.ecg !== 'auto' && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-500/70 text-purple-300 font-bold uppercase tracking-wider">
            FORÇADO
          </span>
        )}
      </div>
      <div className="waveform-settings absolute top-2 right-3 z-10 flex items-center space-x-3 text-[10px] text-[#737373] font-mono-code pointer-events-none">
        <span>Filtro: DIAG (0.05-150Hz)</span>
        <span>Ganho: x1.0</span>
      </div>

      {/* ----------------- TRACK 2: PLETH (CYAN) ----------------- */}
      <div className="absolute top-[26%] left-3 z-10 flex items-center space-x-2 pointer-events-none waveform-label">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-cyan-400">
          SpO₂ · Pletismografia
        </span>
        <span className="text-[11px] px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 font-mono-code">
          PI: {vitals.perfusionIndex}%
        </span>
        {adminOverrides && adminOverrides.oximetry !== 'auto' && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-500/70 text-purple-300 font-bold uppercase tracking-wider">
            FORÇADO ({adminOverrides.oximetry.toUpperCase()})
          </span>
        )}
      </div>
      <div className="absolute top-[26%] right-3 z-10 text-[10px] text-[#737373] font-mono-code pointer-events-none">
        AutoGanho: Normal
      </div>

      {/* ----------------- TRACK 3: CAPNOGRAPHY (YELLOW) ----------------- */}
      <div className="absolute top-[51%] left-3 z-10 flex items-center space-x-2 pointer-events-none waveform-label">
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-yellow-400">
          CO₂ · Capnografia (mmHg)
        </span>
        {adminOverrides && adminOverrides.capnography !== 'auto' && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-500/70 text-purple-300 font-bold uppercase tracking-wider">
            FORÇADO ({adminOverrides.capnography.toUpperCase()})
          </span>
        )}
        {equipment?.intubationStatus === 'intubated_tracheal' ? (
          <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono-code font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            SONDA TRAQUEAL #{equipment.tubeSizeMm}mm · {vitals.capnogramType === 'normal' ? 'EtCO₂ ATIVO' : vitals.capnogramType.replace(/_/g, ' ').toUpperCase()}
          </span>
        ) : equipment?.intubationStatus === 'intubated_esophageal' ? (
          <span className="text-[11px] px-1.5 py-0.2 rounded bg-red-950/80 border border-red-700/60 text-red-300 font-mono-code font-bold animate-pulse">
            ALERTA: SONDA NO ESÔFAGO (SEM CO₂ EXPIRADO)
          </span>
        ) : (
          <span className="text-[11px] px-1.5 py-0.2 rounded bg-yellow-950/60 border border-yellow-800/50 text-yellow-300 font-mono-code flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            ESPONTÂNEO (NASAL) · {vitals.capnogramType === 'normal' ? 'ATIVO' : vitals.capnogramType.replace(/_/g, ' ').toUpperCase()}
          </span>
        )}
      </div>
      {/* Capnography scale tick markers (0, 30, 60 mmHg) */}
      <div className="absolute top-[52%] right-3 z-10 flex flex-col items-end text-[9px] text-[#888888] font-mono-code pointer-events-none space-y-2">
        <span>60 mmHg —</span>
        <span>30 mmHg —</span>
        <span>0 mmHg —</span>
      </div>

      {/* ----------------- TRACK 4: ARTERIAL LINE (RED) ----------------- */}
      <div className="absolute top-[76%] left-3 z-10 flex items-center space-x-2 pointer-events-none waveform-label">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-red-400">
          PAI · Pressão invasiva (mmHg)
        </span>
        <span className="text-[11px] px-1.5 py-0.2 rounded bg-red-950/60 border border-red-800/50 text-red-300 font-mono-code">
          Escala 0-180
        </span>
      </div>
      {/* ART scale tick markers */}
      <div className="absolute top-[77%] right-3 z-10 flex flex-col items-end text-[9px] text-[#888888] font-mono-code pointer-events-none space-y-2">
        <span>150 —</span>
        <span>100 —</span>
        <span>50 —</span>
      </div>

      {/* Bottom Floating Monitor Controls (Sweep Speed & Shading Toggles) */}
      <div className="absolute bottom-2 right-3 z-20 flex items-center space-x-2 bg-[#0c0c0c]/90 border border-[#222222] backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono-code">
        <span className="text-[#888888]">Varredura:</span>
        <button
          onClick={() => setSweepSpeedMmPerSec(sweepSpeedMmPerSec === 25 ? 50 : 25)}
          className="px-1.5 py-0.5 rounded bg-[#1c1c1c] text-emerald-400 hover:bg-[#282828] transition font-bold"
          title="Alternar velocidade de varredura (25 mm/s / 50 mm/s)"
        >
          {sweepSpeedMmPerSec} mm/s
        </button>

        <span className="text-[#444444]">|</span>

        <button
          onClick={() => setShowShading(!showShading)}
          className={`px-1.5 py-0.5 rounded transition ${
            showShading
              ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-bold'
              : 'bg-[#1c1c1c] text-[#737373]'
          }`}
          title="Alternar preenchimento sombreado sob curvas (estilo Philips/Mindray)"
        >
          {showShading ? 'Sombra ativa' : 'Sombra desativada'}
        </button>

        {onOpenAdminMenu && (
          <>
            <span className="text-[#444444]">|</span>
            <button
              onClick={onOpenAdminMenu}
              className={`px-2 py-0.5 rounded transition font-bold flex items-center gap-1 cursor-pointer ${
                adminOverrides &&
                (adminOverrides.ecg !== 'auto' ||
                  adminOverrides.capnography !== 'auto' ||
                  adminOverrides.oximetry !== 'auto')
                  ? 'bg-purple-950/90 text-purple-200 border border-purple-500/80 animate-pulse shadow-sm shadow-purple-950'
                  : 'bg-[#1c1c1c] text-zinc-300 hover:text-white hover:bg-[#282828]'
              }`}
              title="Menu do Administrador/Instrutor: Forçar perfis de ECG, Capnógrafo e Oximetria"
            >
              <ShieldAlert className="w-3 h-3 text-purple-400" />
              <span>PERFIL / ADMIN</span>
            </button>
          </>
        )}
      </div>

      {/* Main High-DPI HTML5 Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
    </div>
  );
};
