import React, { useEffect, useRef, useState } from 'react';
import { VitalSigns } from '../../types/simulator';
import { AudioSynthesizer } from '../../engine/audioSynthesizer';

interface CanvasWaveformsProps {
  vitals: VitalSigns;
  isSimPaused: boolean;
}

export const CanvasWaveforms: React.FC<CanvasWaveformsProps> = ({ vitals, isSimPaused }) => {
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
      const w1 = Math.sin(simTimeSec * 2 * Math.PI * 5.2) * 0.42;
      const w2 = Math.sin(simTimeSec * 2 * Math.PI * 7.8 + 1.2) * 0.32;
      const w3 = Math.sin(simTimeSec * 2 * Math.PI * 3.1 + 2.4) * 0.22;
      const noise = (Math.random() - 0.5) * 0.08;
      return w1 + w2 + w3 + noise;
    }

    // 3. Ventricular Tachycardia (VT) - Wide, bizarre monomorphic QRS complexes (160-220 bpm)
    if (rhythm === 'ventricular_tachycardia') {
      // Wide notched tombstone complexes
      const vt = Math.sin(p * Math.PI * 2 - Math.PI / 2) * 0.85 + Math.sin(p * Math.PI * 4) * 0.2;
      return vt;
    }

    // 4. Ventricular Premature Complex (VPC / PVC) beat
    if (isPvc) {
      if (p >= 0.0 && p < 0.35) {
        // Broad, notched negative/biphasic deep complex followed by huge inverted T wave
        const pNorm = p / 0.35;
        if (pNorm < 0.4) {
          return -0.95 * Math.sin((pNorm / 0.4) * Math.PI);
        } else if (pNorm < 0.6) {
          return 0.35 * Math.sin(((pNorm - 0.4) / 0.2) * Math.PI);
        } else {
          return 0.65 * Math.sin(((pNorm - 0.6) / 0.4) * Math.PI);
        }
      }
      return (Math.random() - 0.5) * 0.01;
    }

    // 5. Atrial Fibrillation (AFib) - Irregular baseline f-waves with normal narrow QRS
    let baselineNoise = 0;
    if (rhythm === 'atrial_fibrillation') {
      baselineNoise = Math.sin(simTimeSec * 2 * Math.PI * 6.5) * 0.08 + (Math.random() - 0.5) * 0.04;
    }

    // 6. Standard Normal / Sinus / Brady / Tachy / AV Blocks (P-Q-R-S-T synthesis)
    // Gaussian helper: A * exp(-((p - mu)^2) / (2 * sigma^2))
    const gauss = (pos: number, center: number, width: number, amp: number) => {
      const diff = pos - center;
      return amp * Math.exp(-(diff * diff) / (2 * width * width));
    };

    let ecg = baselineNoise;

    // Potassium level check for hyperkalemia ECG alterations
    const kLevel = vitals.arterialBloodGases?.potassium ?? 4.0;
    const isHyperkalemic = kLevel > 6.0;
    const isSevereHyperkalemic = kLevel > 7.5;

    // P WAVE (Center: 0.12, width: 0.028)
    // In AFib: no P wave. In severe hyperkalemia: flattened/absent P wave.
    if (rhythm !== 'atrial_fibrillation' && !isSevereHyperkalemic) {
      const pAmp = isHyperkalemic ? 0.04 : 0.16;
      ecg += gauss(p, 0.12, 0.026, pAmp);
    }

    // Q WAVE (Center: 0.20, width: 0.008, negative)
    ecg += gauss(p, 0.20, 0.008, -0.12);

    // R WAVE (Center: 0.23, width: 0.014, sharp tall positive spike)
    const rAmp = isHyperkalemic ? 0.85 : 1.15;
    ecg += gauss(p, 0.23, 0.012, rAmp);

    // S WAVE (Center: 0.26, width: 0.011, sharp negative dip)
    ecg += gauss(p, 0.26, 0.010, -0.28);

    // ST SEGMENT (Isoelectric or elevated/depressed in ischemia)
    if (p >= 0.28 && p < 0.38) {
      const isHypoxemic = vitals.pulseOximetrySpO2 < 85;
      if (isHypoxemic) {
        ecg += -0.15 * Math.sin(((p - 0.28) / 0.10) * Math.PI); // ST depression
      }
    }

    // T WAVE (Center: 0.44, width: 0.055, smooth asymmetric wave)
    if (isHyperkalemic) {
      // Tented, tall, peaked, narrow symmetrical T wave of hyperkalemia
      const tAmp = Math.min(1.0, 0.45 + (kLevel - 6.0) * 0.35);
      ecg += gauss(p, 0.44, 0.028, tAmp);
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
    if (vitals.cardiacRhythm === 'asystole' || vitals.pulseOximetrySpO2 <= 0) {
      return 0.02 * (Math.random() - 0.5);
    }

    // Pulse wave arrives with ~0.10s delay relative to R-wave (p offset ~0.12)
    const pp = (p + 0.88) % 1.0;

    let pleth = 0;
    if (pp < 0.26) {
      // Anacrotic steep systolic upstroke (Sigmoidal curve to crest)
      pleth = Math.sin((pp / 0.26) * (Math.PI / 2));
      pleth = Math.pow(pleth, 1.2);
    } else if (pp < 0.44) {
      // Catacrotic limb with sharp Dicrotic Notch (Incisura) at pp = 0.34
      const tNotch = (pp - 0.26) / 0.18;
      if (tNotch < 0.45) {
        // Descent to notch
        pleth = 1.0 - 0.42 * (tNotch / 0.45);
      } else {
        // Dicrotic wave rebound crest
        const tRebound = (tNotch - 0.45) / 0.55;
        pleth = 0.58 + 0.16 * Math.sin(tRebound * Math.PI);
      }
    } else {
      // Diastolic runoff decay towards baseline
      const tDecay = (pp - 0.44) / 0.56;
      pleth = 0.58 * Math.exp(-3.2 * tDecay);
    }

    // Perfusion Index scaling (vasoconstriction/hypothermia reduces amplitude)
    const pi = Math.max(0.15, Math.min(1.5, vitals.perfusionIndex));
    pleth = Math.max(0, pleth * pi);

    return pleth;
  };

  /**
   * Evaluates Capnography (EtCO2) waveform in mmHg at breath phase p in [0, 1).
   * Range: 0 mmHg to ~60 mmHg.
   */
  const calculateCapnogram = (p: number, vitals: VitalSigns): number => {
    const etCO2 = vitals.etCO2;
    const fiCO2 = vitals.fiCO2;

    // 1. Cardiac Arrest / Apnea / Flatline
    if (vitals.respiratoryRate === 0 || vitals.capnogramType === 'cardiac_arrest_flat') {
      return fiCO2;
    }

    // 2. Esophageal Intubation - Immediate flatline at 0
    if (etCO2 === 0) {
      return 0;
    }

    // 3. Obstructive / Bronchospasm "Shark-Fin" pattern (Asthma, COPD, kinked tube)
    if (vitals.capnogramType === 'obstructive_shark_fin') {
      if (p < 0.65) {
        // Prolonged upward curving Phase II/III with no distinct alpha angle
        const curve = Math.pow(p / 0.65, 1.85);
        return fiCO2 + (etCO2 - fiCO2) * curve;
      } else if (p < 0.75) {
        // Rapid inspiratory downstroke
        const tDown = (p - 0.65) / 0.10;
        return fiCO2 + (etCO2 - fiCO2) * (1.0 - tDown);
      } else {
        return fiCO2;
      }
    }

    // 4. Standard 4-Phase Capnogram (Phase I -> II -> III -> Phase 0)
    // Expiration occupies ~65% of cycle (I:E = 1:2)
    if (p < 0.08) {
      // Phase I: Inspiratory Baseline (0 mmHg or FiCO2 in rebreathing)
      return fiCO2;
    } else if (p < 0.22) {
      // Phase II: Rapid Expiratory S-Curve Upstroke (Anatomic dead space gas emptying)
      const tUp = (p - 0.08) / 0.14;
      // Sigmoidal smooth transition (alpha angle ~ 105 degrees)
      const sCurve = 1 / (1 + Math.exp(-12 * (tUp - 0.5)));
      return fiCO2 + (etCO2 * 0.90 - fiCO2) * sCurve;
    } else if (p < 0.64) {
      // Phase III: Alveolar Plateau (Gently upsloping to peak EtCO2)
      const tPlateau = (p - 0.22) / 0.42;
      let plateauCo2 = etCO2 * (0.90 + 0.10 * tPlateau);

      // Curare Cleft pathology check (diaphragmatic notch during neuromuscular recovery)
      if (vitals.capnogramType === 'curare_cleft') {
        const cleftPos = (tPlateau - 0.55);
        if (Math.abs(cleftPos) < 0.15) {
          const dip = 0.35 * etCO2 * Math.exp(-(cleftPos * cleftPos) / 0.005);
          plateauCo2 -= dip;
        }
      }

      // Cardiogenic Oscillations pathology check
      if (vitals.capnogramType === 'cardiogenic_oscillations') {
        plateauCo2 += Math.sin(tPlateau * Math.PI * 12) * 2.2;
      }

      return Math.max(fiCO2, plateauCo2);
    } else if (p < 0.72) {
      // Phase 0: Rapid, crisp inspiratory downstroke back to baseline (beta angle ~ 90 degrees)
      const tDown = (p - 0.64) / 0.08;
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
    if (vitals.cardiacRhythm === 'asystole' || vitals.cardiacRhythm === 'ventricular_fibrillation') {
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
          heartPhaseRef.current = 0;

          // Arrhythmia logic: VPC trigger probability
          if (vitals.cardiacRhythm === 'ventricular_premature_complexes') {
            isPvcBeatRef.current = Math.random() < 0.28;
          } else {
            isPvcBeatRef.current = false;
          }

          // 2nd Degree AV Block (Wenckebach / Mobitz): drop 1 out of 4 beats
          if (vitals.cardiacRhythm === 'av_block_2nd_degree') {
            droppedBeatCountRef.current = (droppedBeatCountRef.current + 1) % 4;
          }

          // Pulse audio beep trigger (synchronized with SpO2 and pulse presence)
          if (
            vitals.cardiacRhythm !== 'asystole' &&
            vitals.cardiacRhythm !== 'pulseless_electrical_activity' &&
            vitals.pulseOximetrySpO2 > 0
          ) {
            AudioSynthesizer.playPulseBeep(vitals.pulseOximetrySpO2);
          }
        }

        const rr = Math.max(1, vitals.respiratoryRate);
        const respIntervalSec = 60.0 / rr;
        const timeSinceResp = (currentTime - lastRespTimeRef.current) / 1000;

        if (timeSinceResp >= respIntervalSec) {
          lastRespTimeRef.current = currentTime;
          respPhaseRef.current = 0;
        }

        // ---------------------------------------------------------
        // MULTI-SAMPLE CONTINUOUS VECTOR DRAWING
        // Evaluates every single sub-pixel column between prevSweepX and nextSweepX
        // Eliminates any dashes, gaps, dots or aliasing completely!
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

          // Prepare subpixel paths for crisp anti-aliased strokes
          for (let step = 0; step < stepCount; step++) {
            const currentSubX = prevSweepX + (step + 1) * ((nextSweepX - prevSweepX) / stepCount);
            const subDt = (dt / stepCount);
            const subTimeSec = (currentTime - (stepCount - step - 1) * (dt / stepCount * 1000)) / 1000;

            // Advance phases smoothly
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

            // 3. Capnogram Y coordinate (Calibrated 0-60 mmHg)
            const capnoValMmHg = calculateCapnogram(pResp, vitals);
            const normCapno = Math.min(1.0, Math.max(0, capnoValMmHg / 55.0));
            const capnoY = capnoBaseY - normCapno * capnoMaxH;

            // 4. Arterial Pressure Y coordinate (Calibrated 0-200 mmHg)
            const artValMmHg = calculateArterialLine(pHeart, vitals);
            const normArt = Math.min(1.0, Math.max(0, artValMmHg / 180.0));
            const artY = artBaseY - normArt * artMaxH;

            const x0 = step === 0 ? prevSweepX : prevSweepX + step * ((nextSweepX - prevSweepX) / stepCount);
            const x1 = currentSubX;

            // --- DRAW TRACK 1: ECG (GREEN #22c55e) ---
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 1.9;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, lastYRef.current.ecg || ecgY);
            ctx.lineTo(x1, ecgY);
            ctx.stroke();

            // --- DRAW TRACK 2: PLETH / SpO2 (CYAN #06b6d4) ---
            if (showShading) {
              ctx.fillStyle = 'rgba(6, 182, 212, 0.10)';
              ctx.beginPath();
              ctx.moveTo(x0, plethBaseY);
              ctx.lineTo(x0, lastYRef.current.pleth || plethY);
              ctx.lineTo(x1, plethY);
              ctx.lineTo(x1, plethBaseY);
              ctx.closePath();
              ctx.fill();
            }
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.9;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, lastYRef.current.pleth || plethY);
            ctx.lineTo(x1, plethY);
            ctx.stroke();

            // --- DRAW TRACK 3: CAPNOGRAPHY / EtCO2 (YELLOW #eab308) ---
            if (showShading && capnoValMmHg > 0) {
              ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
              ctx.beginPath();
              ctx.moveTo(x0, capnoBaseY);
              ctx.lineTo(x0, lastYRef.current.capno || capnoY);
              ctx.lineTo(x1, capnoY);
              ctx.lineTo(x1, capnoBaseY);
              ctx.closePath();
              ctx.fill();
            }
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2.1;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, lastYRef.current.capno || capnoY);
            ctx.lineTo(x1, capnoY);
            ctx.stroke();

            // --- DRAW TRACK 4: ARTERIAL LINE / PAI (RED #ef4444) ---
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.9;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, lastYRef.current.art || artY);
            ctx.lineTo(x1, artY);
            ctx.stroke();

            // Update last points
            lastYRef.current = {
              ecg: ecgY,
              pleth: plethY,
              capno: capnoY,
              art: artY,
            };
          }

          // Draw Glowing Sweep Leading Edge Cursor Dots (Mindray/Philips style)
          const cursorX = nextSweepX;
          const drawGlowCursor = (y: number, color: string) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cursorX, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          };

          drawGlowCursor(lastYRef.current.ecg, '#4ade80');
          drawGlowCursor(lastYRef.current.pleth, '#67e8f9');
          drawGlowCursor(lastYRef.current.capno, '#fde047');
          drawGlowCursor(lastYRef.current.art, '#f87171');
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
  }, [vitals, isSimPaused, sweepSpeedMmPerSec, showShading]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#050505] rounded-xl overflow-hidden border border-[#222222] shadow-2xl select-none"
    >
      {/* ----------------- TRACK 1: ECG (GREEN) ----------------- */}
      <div className="absolute top-2 left-3 z-10 flex items-center space-x-2 pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-emerald-400">
          II · ECG (1.0 mV/cm)
        </span>
        <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono-code">
          {vitals.cardiacRhythm.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>
      <div className="absolute top-2 right-3 z-10 flex items-center space-x-3 text-[10px] text-[#737373] font-mono-code pointer-events-none">
        <span>Filtro: DIAG (0.05-150Hz)</span>
        <span>Ganho: x1.0</span>
      </div>

      {/* ----------------- TRACK 2: PLETH (CYAN) ----------------- */}
      <div className="absolute top-[26%] left-3 z-10 flex items-center space-x-2 pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-cyan-400">
          PLETH · SpO₂ OXIMETRIA
        </span>
        <span className="text-[11px] px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 font-mono-code">
          PI: {vitals.perfusionIndex}%
        </span>
      </div>
      <div className="absolute top-[26%] right-3 z-10 text-[10px] text-[#737373] font-mono-code pointer-events-none">
        AutoGanho: Normal
      </div>

      {/* ----------------- TRACK 3: CAPNOGRAPHY (YELLOW) ----------------- */}
      <div className="absolute top-[51%] left-3 z-10 flex items-center space-x-2 pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-yellow-400">
          CO₂ · CAPNÓGRAFO (mmHg)
        </span>
        <span className="text-[11px] px-1.5 py-0.2 rounded bg-yellow-950/60 border border-yellow-800/50 text-yellow-300 font-mono-code">
          {vitals.capnogramType === 'normal' ? 'FASE I-IV ADEQUADA' : vitals.capnogramType.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>
      {/* Capnography scale tick markers (0, 20, 40 mmHg) */}
      <div className="absolute top-[52%] right-3 z-10 flex flex-col items-end text-[9px] text-[#888888] font-mono-code pointer-events-none space-y-2">
        <span>50 mmHg —</span>
        <span>25 mmHg —</span>
        <span>0 mmHg —</span>
      </div>

      {/* ----------------- TRACK 4: ARTERIAL LINE (RED) ----------------- */}
      <div className="absolute top-[76%] left-3 z-10 flex items-center space-x-2 pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
        <span className="text-xs font-bold font-mono-code tracking-wider text-red-400">
          ART · PAI PRESSÃO ARTERIAL INVASIVA (mmHg)
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
          {showShading ? 'Sombra ON' : 'Sombra OFF'}
        </button>
      </div>

      {/* Main High-DPI HTML5 Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
    </div>
  );
};
