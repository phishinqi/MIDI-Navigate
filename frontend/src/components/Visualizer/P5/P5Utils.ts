import p5 from 'p5';
import { getDrumVisuals } from '@/lib/percussionMap';

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const kSplineTableSize = 11;
const kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

const A = (aA1, aA2) => 1.0 - 3.0 * aA2 + 3.0 * aA1;
const B = (aA1, aA2) => 3.0 * aA2 - 6.0 * aA1;
const C = (aA1) => 3.0 * aA1;

const CalcBezier = (aT, aA1, aA2) => ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
const GetSlope = (aT, aA1, aA2) => 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);

const GetTForX = (aX, mX1, mX2) => {
  let aGuessT = aX;
  for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
    const currentSlope = GetSlope(aGuessT, mX1, mX2);
    if (currentSlope === 0.0) return aGuessT;
    const currentX = CalcBezier(aGuessT, mX1, mX2) - aX;
    aGuessT -= currentX / currentSlope;
  }
  return aGuessT;
};

export const createBezier = (mX1: number, mY1: number, mX2: number, mY2: number) => {
  if (mX1 < 0 || mX1 > 1 || mX2 < 0 || mX2 > 1) {
    throw new Error('Bezier x values must be in [0, 1] range.');
  }
  const mSampleValues = new Float32Array(kSplineTableSize);
  if (mX1 !== mY1 || mX2 !== mY2) {
    for (let i = 0; i < kSplineTableSize; ++i) {
      mSampleValues[i] = CalcBezier(i * kSampleStepSize, mX1, mX2);
    }
  }
  const getT = (aX: number) => {
    if (mX1 === mY1 && mX2 === mY2) return aX;
    if (aX === 0) return 0;
    if (aX === 1) return 1;
    let iStart = 0.0, lastSample = 0;
    for (; lastSample < kSplineTableSize - 1 && mSampleValues[lastSample] <= aX; ++lastSample) {
      iStart += kSampleStepSize;
    }
    --lastSample;
    const dist = (aX - mSampleValues[lastSample]) / (mSampleValues[lastSample + 1] - mSampleValues[lastSample]);
    const guessForT = iStart + dist * kSampleStepSize;
    const initialSlope = GetSlope(guessForT, mX1, mX2);
    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return GetTForX(aX, mX1, mX2);
    }
    return guessForT;
  };
  return (x: number) => {
    if (x === 0 || x === 1) return x;
    return CalcBezier(getT(x), mY1, mY2);
  };
};

export const CONFIG = {
  SHRINK_SPEED: 0.05,
  GROW_SPEED: 3.0,
  MIN_PITCH: 0,
  MAX_PITCH: 127,
  THEME: {
    BG: [10, 11, 14] as const,
    GRID: [30, 32, 36] as const,
    CURSOR: [255, 200, 0] as const,
    WIPE_LINE: [255, 255, 255, 100] as const,
    WIPE_FILL: [20, 20, 30, 0] as const
  }
} as const;

// Use updated color system from utils
import { getTrackColor as getTrackColorFromUtils } from '@/lib/utils';

export const getTrackHue = (index: number) => {
  return (index * 137.5 + 20) % 360;
};

export const getLayout = (p: p5, settings: any) => {
  const scaleY = settings?.noteAreaScale ?? 0.8;
  const offsetY = settings?.noteAreaOffsetY ?? 0;
  const hZoom = settings?.horizontalZoom ?? 1.0;
  const noteH = settings?.noteHeight ?? 6;

  const effectiveHeight = p.height * scaleY;
  const topMargin = (p.height - effectiveHeight) / 2 + offsetY;
  const effectiveWidth = p.width * hZoom;
  const leftMargin = (p.width - effectiveWidth) / 2;

  return { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH };
};

export const calculateMeasureMap = (midi: any) => {
  if (!midi || !midi.header) return [];
  const ppq = midi.header.ppq || 480;
  const rawTempos = midi.header.tempos || [];
  const rawMeters = midi.header.timeSignatures || [];
  const duration = midi.duration || 0;

  const sortedTempos = [...rawTempos].sort((a, b) => a.ticks - b.ticks);
  const sortedMeters = [...rawMeters].sort((a, b) => a.ticks - b.ticks);

  if (sortedMeters.length === 0) sortedMeters.push({ ticks: 0, timeSignature: [4, 4] });
  if (sortedMeters[0].ticks > 0) sortedMeters.unshift({ ticks: 0, timeSignature: [4, 4] });

  const tempoMap = [];
  let accTime = 0;
  let lastTick = 0;
  let curBpm = sortedTempos[0]?.bpm || 120;

  sortedTempos.forEach(t => {
    const delta = t.ticks - lastTick;
    accTime += delta * (60 / (curBpm * ppq));
    tempoMap.push({ time: accTime, bpm: t.bpm, tick: t.ticks });
    lastTick = t.ticks;
    curBpm = t.bpm;
  });

  const measures = [];
  let currentTick = 0;
  let currentTime = 0;
  let meterIdx = 0;
  let barIndex = 0;

  while (currentTime < duration + 5) {
    while (meterIdx < sortedMeters.length - 1 && currentTick >= sortedMeters[meterIdx + 1].ticks) {
      meterIdx++;
    }
    const meter = sortedMeters[meterIdx];
    const [num, den] = meter.timeSignature;
    const ticksPerMeasure = num * (ppq * 4 / den);

    let refTempo = tempoMap[0];
    for (let i = tempoMap.length - 1; i >= 0; i--) {
      if (tempoMap[i].tick <= currentTick) { refTempo = tempoMap[i]; break; }
    }
    const bpm = refTempo ? refTempo.bpm : 120;

    const measureDuration = (60 / bpm) * (ticksPerMeasure / ppq);

    measures.push({
      index: barIndex,
      startTime: currentTime,
      endTime: currentTime + measureDuration,
      duration: measureDuration,
      ticks: currentTick
    });

    currentTime += measureDuration;
    currentTick += ticksPerMeasure;
    barIndex++;
  }
  return measures;
};

export const getBarInfoAtTime = (measures: any[], time: number) => {
  if (!measures || measures.length === 0) return null;
  for (let i = 0; i < measures.length; i++) {
    if (time >= measures[i].startTime && time < measures[i].endTime) {
      return measures[i];
    }
  }
  return measures[measures.length - 1];
};

// Cache notes for current measure (Meteor mode uses greedy selection)
export const cacheNotesForBar = (p: p5, midi: any, measure: any, settings: any, visibleTracks: any, percussionSettings: any, trackColors: any = {}, useDefaultColors = true) => {
  const notes = [];
  if (!measure) return notes;

  const barStart = measure.startTime;
  const barDuration = measure.duration;
  const barEnd = measure.endTime;
  const mode = settings?.pageTurnMode;

  midi.tracks.forEach((track, tIdx) => {
    if (visibleTracks && !visibleTracks.includes(tIdx)) return;

    const name = (track.name || "").toLowerCase();
    const inst = track.instrument || {};
    const instName = (inst.name || "").toLowerCase();
    const isDrum = name.includes('drum') || name.includes('perc') ||
      instName.includes('drum') || instName.includes('perc') ||
      inst.percussion === true || (track.channel === 9 || track.channel === 10);
    if (percussionSettings?.enabled && isDrum) return;

    // Unified color retrieval
    const colorHex = getTrackColorFromUtils(tIdx, trackColors, useDefaultColors);
    p.colorMode(p.RGB);
    const col = p.color(colorHex);


    track.notes.forEach(n => {
      let overlaps = false;
      if (mode === 'meteor') {
        // Greedy logic: check if note's lifecycle overlaps with measure
        const holdDuration = settings.meteorHoldTime || 0.5;
        const fadeDuration = settings.meteorFadeTime || 1.5;
        const noteLifecycleEnd = n.time + holdDuration + fadeDuration;
        overlaps = (n.time < barEnd) && (noteLifecycleEnd > barStart);
      } else {
        // Standard overlap logic
        const buffer = 0.1;
        overlaps = (n.time < barEnd + buffer) && (n.time + n.duration > barStart - buffer);
      }

      if (overlaps) {
        const relTime = n.time - barStart;
        const ratioX = relTime / barDuration;
        const ratioW = n.duration / barDuration;
        const normPitch = (n.midi - CONFIG.MIN_PITCH) / (CONFIG.MAX_PITCH - CONFIG.MIN_PITCH);

        notes.push({
          ratioX, ratioW, normPitch, time: n.time, color: col,
          measureStart: barStart, measureDuration: barDuration
        });
      }
    });
  });
  return notes;
};


export const getDrumStepsForMeasure = (midi: any, measure: any, visibleTracks: any) => {
  if (!midi || !measure) return [];
  let rawNotes = [];
  const { startTime, endTime } = measure;

  midi.tracks.forEach((t, tIdx) => {
    const name = (t.name || "").toLowerCase();
    const inst = t.instrument || {};
    const instName = (inst.name || "").toLowerCase();
    const isDrum = name.includes('drum') || name.includes('perc') ||
      instName.includes('drum') || instName.includes('perc') ||
      inst.percussion === true || (t.channel === 9 || t.channel === 10);

    if (isDrum && t.notes) {
      t.notes.forEach(n => {
        if (n.time >= startTime && n.time < endTime) {
          n.instrumentName = instName || name || "drum";
          rawNotes.push(n);
        }
      });
    }
  });

  if (rawNotes.length === 0) return [];
  rawNotes.sort((a, b) => a.time - b.time);

  const steps = [];
  const THRESHOLD = 0.035;
  let currentStep = { time: rawNotes[0].time, notes: [rawNotes[0]] };

  for (let i = 1; i < rawNotes.length; i++) {
    const note = rawNotes[i];
    if (note.time - currentStep.time < THRESHOLD) {
      currentStep.notes.push(note);
    } else {
      steps.push(currentStep);
      currentStep = { time: note.time, notes: [note] };
    }
  }
  steps.push(currentStep);
  return steps;
};

export const drawBackground = (p: p5, bgColor: any, settings: any) => {
  if (bgColor) {
    p.background(bgColor);
  } else {
    p.background(CONFIG.THEME.BG[0], CONFIG.THEME.BG[1], CONFIG.THEME.BG[2]);
  }
  if (settings?.showGrid === false) {
    return;
  }
  p.stroke(CONFIG.THEME.GRID[0], CONFIG.THEME.GRID[1], CONFIG.THEME.GRID[2]);
  p.strokeWeight(1);
  const beatX = p.width / 4;
  for (let i = 1; i < 4; i++) p.line(beatX * i, 0, beatX * i, p.height);
  p.line(0, p.height / 2, p.width, p.height / 2);
};

// Meteor mode animation logic
const getMeteorShrinkProgress = (note: any, audioTime: number, settings: any, fadeCurve: number[]) => {
  const curve = fadeCurve || [0.42, 0, 1, 1];
  const fadeEaser = createBezier(curve[0], curve[1], curve[2], curve[3]);
  const holdDuration = settings.meteorHoldTime || 0.5;
  const baseFadeDuration = settings.meteorFadeTime || 1.5;

  // Scale fade duration with note length
  // Longer notes fade slower (min: baseFadeDuration, max: 1.5x note duration)
  const noteDuration = note.ratioW * note.measureDuration;
  const scaledFadeDuration = Math.max(baseFadeDuration, Math.min(noteDuration * 1.5, baseFadeDuration * 3));

  const animStartTime = note.time + holdDuration;
  if (audioTime < animStartTime) return 0;
  if (scaledFadeDuration <= 0) return 1.0;

  const animAge = audioTime - animStartTime;
  const linearProgress = Math.min(1.0, animAge / scaledFadeDuration);
  return fadeEaser(linearProgress);
}

export const drawNotes = (p: p5, notes: any[], audioTime: number, settings: any, growCurve = [0.1, 0.85, 0.75, 0.9]) => {
  if (!notes || notes.length === 0) return;
  p.noStroke();

  const midlifePlateauEase = createBezier(growCurve[0], growCurve[1], growCurve[2], growCurve[3]);
  const { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH } = getLayout(p, settings);
  const mode = settings?.pageTurnMode || 'wipe';

  let globalClipRatio = 0; // Only for 'fade' mode
  if (mode === 'fade') {
    const measureStart = notes[0]?.measureStart || 0;
    const measureDuration = notes[0]?.measureDuration || 4.0;
    const playheadRatio = (audioTime - measureStart) / measureDuration;

    // 1. Get fade start ratio (default 0.45)
    const FADE_START_RATIO = settings?.fadeStartRatio ?? 0.45;

    if (playheadRatio > FADE_START_RATIO) {
      const shrinkSetting = settings?.shrinkSpeed || 0.08;
      const speedFactor = shrinkSetting * 20.0;

      // Calculate linear progress (0.0 -> 1.0) from fade start to measure end
      const linearP = (playheadRatio - FADE_START_RATIO) / (1.0 - FADE_START_RATIO);

      // 2. Generate Easing
      // Default curve: [0.6, 0.05, 0.9, 0.9]
      const fadeCurve = settings?.fadeCurve || [0.6, 0.05, 0.9, 0.9];
      const fadeEaser = createBezier(fadeCurve[0], fadeCurve[1], fadeCurve[2], fadeCurve[3]);

      // 3. Apply easing curve
      const easedP = fadeEaser(linearP);

      const maxPossibleCut = speedFactor * 0.5;
      globalClipRatio = easedP * maxPossibleCut;
    }
  }
  // Screen Shake System
  const jitter = settings?.jitter;
  let globalShakeY = 0;

  if (jitter?.enabled) {
    const mode = (jitter as any).mode || 'emotion';
    // Collect active notes
    const activeNotes: any[] = [];
    for (const note of notes) {
      const noteEnd = note.time + (note.ratioW * note.measureDuration);
      if (audioTime >= note.time && audioTime < noteEnd) {
        activeNotes.push(note);
      }
    }

    let triggerValue = 0;

    // Algorithm 1: Emotion-Driven (Multi-Dimensional)
    if (mode === 'emotion') {
      let emotionFactors = {
        density: 0,
        velocity: 0,
        pitch: 0,
        tension: 0,
        rhythmic: 0
      };

      if (activeNotes.length > 0) {
        // A. Density Factor (Logarithmic)
        emotionFactors.density = Math.min(1.0, Math.log(activeNotes.length + 1) / Math.log(16));

        // B. Velocity Factor (Max 70% + Avg 30%)
        const velocities = activeNotes.map((n: any) => n.velocity || 64);
        const maxVel = Math.max(...velocities);
        const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
        // Use squared function to increase contrast
        emotionFactors.velocity = Math.pow((maxVel * 0.7 + avgVel * 0.3) / 127, 2);

        // C. Pitch Extremes Factor
        const centerDistances = activeNotes.map(n => {
          const midi = (n as any).midi || Math.round(n.normPitch * 88 + 21);
          // Distance from C4 (60), normalized to approx 40 semitones
          return Math.min(1.0, Math.abs(midi - 60) / 40);
        });
        emotionFactors.pitch = centerDistances.reduce((sum, d) => sum + d, 0) / activeNotes.length;

        // D. Harmonic Tension Factor
        if (activeNotes.length >= 2) {
          let totalTension = 0;
          let pairCount = 0;
          // Limit calculation to first 10 notes for performance
          const notesToCheck = activeNotes.slice(0, 10);
          for (let i = 0; i < notesToCheck.length; i++) {
            for (let j = i + 1; j < notesToCheck.length; j++) {
              const midi1 = (notesToCheck[i] as any).midi || Math.round(notesToCheck[i].normPitch * 88 + 21);
              const midi2 = (notesToCheck[j] as any).midi || Math.round(notesToCheck[j].normPitch * 88 + 21);
              const interval = Math.abs(midi1 - midi2) % 12;
              const tensionMap: { [key: number]: number } = {
                0: 0.0, 1: 1.0, 2: 0.4, 3: 0.2, 4: 0.1, 5: 0.3,
                6: 0.8, 7: 0.0, 8: 0.2, 9: 0.1, 10: 0.4, 11: 0.9
              };
              totalTension += tensionMap[interval] || 0;
              pairCount++;
            }
          }
          emotionFactors.tension = pairCount > 0 ? totalTension / pairCount : 0;
        }

        // Bass Drop / Impact Boost
        const hasLowEndImpact = maxVel > 100 && activeNotes.some((n: any) => ((n as any).midi || Math.round(n.normPitch * 88 + 21)) < 45);
        if (hasLowEndImpact) {
          // Instant impact boost applied later
        }

        // Emotion Weights
        const weights = {
          density: 0.20,
          velocity: 0.30,
          pitch: 0.20,
          tension: 0.30,
          rhythmic: 0.0
        };

        let rawEmotion =
          emotionFactors.density * weights.density +
          emotionFactors.velocity * weights.velocity +
          emotionFactors.pitch * weights.pitch +
          emotionFactors.tension * weights.tension;

        // Apply Bass Drop Boost (Max 1.2x)
        if (hasLowEndImpact) {
          rawEmotion = Math.min(1.0, rawEmotion * 1.5); // 50% boost for bass drops
        }

        // Smoothing
        const smoothingFactor = 0.15;
        if (!(jitter as any)._prevEmotion) {
          (jitter as any)._prevEmotion = rawEmotion;
        }
        const smoothedEmotion = (jitter as any)._prevEmotion * (1 - smoothingFactor) + rawEmotion * smoothingFactor;
        (jitter as any)._prevEmotion = smoothedEmotion;

        triggerValue = smoothedEmotion;
      }
    }
    // Algorithm 2: Density-Driven (Simple Note Count)
    // ============================================================
    else {
      const density = activeNotes.length;
      triggerValue = Math.min(1.0, density / 20); // 20 notes = max value
    }

    // Common Trigger Logic
    // Common Trigger Logic
    const threshold = jitter.threshold !== undefined ? jitter.threshold : 10;

    if (activeNotes.length > threshold) {
      // Calculate intensity based on mode
      let intensityFactor = 0;

      if (mode === 'emotion') {
        intensityFactor = Math.min(1.0, triggerValue);
      } else {
        // Density Mode: Ratio of notes above threshold
        const maxNotes = 50;
        intensityFactor = Math.min(1.0, (activeNotes.length - threshold) / (maxNotes - threshold));
      }

      const speed = (jitter.speed || 0.5) * 40;
      const baseAmp = (jitter.intensity || 0.5) * 6;

      // Jitter amplitude increases with intensity
      const finalAmp = baseAmp * (0.2 + Math.sqrt(intensityFactor) * 0.8);
      globalShakeY = Math.sin(audioTime * speed) * finalAmp;
    }
  }

  // Render Notes (Three-Phase Pipeline)
  for (let n of notes) {
    // Phase 1: Time-based Rendering & Lifecycle
    if (audioTime < n.time) continue; // Note hasn't started yet

    const age = audioTime - n.time;
    const noteDurationInSeconds = n.ratioW * n.measureDuration;

    // Define timeline boundaries
    const GROWTH_DURATION = settings?.noteGrowthTime || 0.2;
    const growthEnd = n.time + GROWTH_DURATION;
    const playEnd = n.time + noteDurationInSeconds;
    // Phase 2: Independent Parameter Calculation
    // (Growth Scale, Bounce Offset)
    // A. Calculate growth scale (0 → 1)
    let scaleX = 1.0;
    if (audioTime < growthEnd) {
      // During growth phase
      const growthProgress = age / GROWTH_DURATION;
      scaleX = midlifePlateauEase(Math.min(1.0, growthProgress));
    }
    // After growth: scaleX stays at 1.0
    // Phase 3: Dimensional Calculation (Width & Clipping)
    const baseStartRatio = n.ratioX;
    const baseWidthRatio = n.ratioW;
    // Apply growth scale to width
    const scaledWidthRatio = baseWidthRatio * scaleX;
    const scaledEndRatio = baseStartRatio + scaledWidthRatio;
    // Apply page-turn mode clipping
    let visibleStartRatio = baseStartRatio;
    let visibleEndRatio = scaledEndRatio;
    if (mode === 'fade') {
      visibleStartRatio = Math.max(baseStartRatio, globalClipRatio);
    } else if (mode === 'meteor') {
      const shrinkProgress = getMeteorShrinkProgress(n, audioTime, settings, settings.fadeCurve);
      visibleStartRatio = baseStartRatio + (baseWidthRatio * shrinkProgress);
    }
    // Clamp to valid range
    const finalVisibleStart = Math.max(0, Math.min(1, visibleStartRatio));
    const finalVisibleEnd = Math.max(0, Math.min(1, visibleEndRatio));
    // Skip if no visible width
    if (finalVisibleStart >= finalVisibleEnd) continue;
    // Convert to pixels
    const x = leftMargin + (finalVisibleStart * effectiveWidth);
    const w = (finalVisibleEnd - finalVisibleStart) * effectiveWidth;
    const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
    const h = noteH;
    // Phase 4: Final Rendering
    const renderW = Math.max(w, 1); // Minimum width for visibility
    if (renderW > 0) {
      p.fill(n.color);
      p.rect(x, y + globalShakeY, renderW, h);
    }
  }
};

export const drawPreviousNotes = (p: p5, notes: any, audioTime: number, settings: any, timeSinceTransition: number, delay = 0.25, wipeProgress = 0) => {
  const mode = settings?.pageTurnMode || 'wipe';

  if (!notes || notes.length === 0) return true;
  p.noStroke();

  const { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH } = getLayout(p, settings);
  let allNotesGone = true;

  if (mode === 'meteor') {
    // 'meteor' mode depends on global audioTime
    if (audioTime === undefined) return true;

    for (let n of notes) {
      const holdDuration = settings.meteorHoldTime || 0.5;
      const baseFadeDuration = settings.meteorFadeTime || 1.5;

      // Use same logic as getMeteorShrinkProgress
      // Skip if note's lifecycle is over
      const noteEnd = n.end ?? (n.measureDuration ? n.time + (n.ratioW * n.measureDuration) : (n.startTime + n.duration));
      if (audioTime > noteEnd + 3.0) continue;

      allNotesGone = false;

      // Draw only notes that have started
      if (audioTime >= n.time) {
        const shrinkProgress = getMeteorShrinkProgress(n, audioTime, settings, settings.fadeCurve);

        // For previous notes, assume fully grown, only handle shrink
        const growthProgress = 1.0;
        const originalStartRatio = n.ratioX;
        const currentEndRatio = originalStartRatio + (n.ratioW * growthProgress);
        let visibleStartRatio = originalStartRatio + (n.ratioW * shrinkProgress);

        const finalVisibleStart = Math.max(0, visibleStartRatio);
        const finalVisibleEnd = Math.min(1, currentEndRatio);

        if (finalVisibleStart >= finalVisibleEnd) continue;

        const x = leftMargin + (finalVisibleStart * effectiveWidth);
        const w = (finalVisibleEnd - finalVisibleStart) * effectiveWidth;
        const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);

        if (w > 0) {
          p.fill(n.color);
          p.rect(x, y, w, noteH);
        }
      }
    }
    return allNotesGone;

  } else if (mode === 'kashiwade') {
    // Kashiwade Mode: Wait for interval, then shrink all notes simultaneously
    const waitTime = settings?.kashiwadeInterval ?? 0.0;
    const fadeDuration = settings?.kashiwadeDuration || 1.0;

    // Phase 1: Waiting (Notes are fully visible)
    if (timeSinceTransition < waitTime) {
      for (let n of notes) {
        const noteStart = n.ratioX;
        const noteEnd = n.ratioX + n.ratioW;

        // Clamp
        const visibleStart = Math.max(0, noteStart);
        const visibleEnd = Math.min(1, noteEnd);

        if (visibleStart < visibleEnd) {
          const startX = leftMargin + (visibleStart * effectiveWidth);
          const w = (visibleEnd - visibleStart) * effectiveWidth;
          const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
          if (w > 0) p.rect(startX, y, w, noteH);
        }
      }
      return false; // Not gone yet
    }

    // Phase 2: Disappearing
    const animTime = timeSinceTransition - waitTime;
    if (animTime >= fadeDuration) return true; // All gone

    const linearP = animTime / fadeDuration;
    // Use fadeCurve for the shrink easing
    const fadeCurve = settings?.fadeCurve || [0.42, 0, 1, 1];
    const fadeEaser = createBezier(fadeCurve[0], fadeCurve[1], fadeCurve[2], fadeCurve[3]);
    const easedP = fadeEaser(linearP); // 0.0 -> 1.0

    for (let n of notes) {
      const originalW = n.ratioW;

      // Shrink from LEFT to RIGHT (similar to Fade clipping)
      const eatenW = originalW * easedP;

      let visibleStart = n.ratioX + eatenW;
      let visibleEnd = n.ratioX + originalW;

      // Clamp
      visibleStart = Math.max(0, Math.max(visibleStart, n.ratioX));
      visibleEnd = Math.min(1, visibleEnd);

      if (visibleStart < visibleEnd) {
        allNotesGone = false;
        const startX = leftMargin + (visibleStart * effectiveWidth);
        const w = (visibleEnd - visibleStart) * effectiveWidth;
        const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
        p.fill(n.color);
        if (w > 0) p.rect(startX, y, w, noteH);
      }
    }
    return allNotesGone;

  } else if (mode === 'fade') {
    const shrinkSetting = settings?.shrinkSpeed || 0.08;
    const speedFactor = shrinkSetting * 20.0;
    const handoverPoint = speedFactor * 0.5;
    const endPoint = 1.2;
    const remainingDist = Math.max(0, endPoint - handoverPoint);
    const prevDuration = notes.prevBarDuration || 2.0;
    const transitionDuration = remainingDist * (prevDuration * 0.5 / (speedFactor || 1));
    const safeDuration = Math.max(0.1, transitionDuration);
    const progress = timeSinceTransition / safeDuration;

    if (progress >= 1.0) return true;
    const wavePosition = handoverPoint + (progress * (endPoint - handoverPoint));

    for (let n of notes) {
      const noteStart = n.ratioX;
      const noteEnd = n.ratioX + n.ratioW;
      let visibleStart = Math.max(noteStart, wavePosition);
      visibleStart = Math.max(0, visibleStart);
      const visibleEnd = Math.min(1, noteEnd);

      if (visibleStart < visibleEnd) {
        allNotesGone = false;
        const startX = leftMargin + (visibleStart * effectiveWidth);
        const w = (visibleEnd - visibleStart) * effectiveWidth;
        const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
        p.fill(n.color);
        p.rect(startX, y, w, noteH);
      }
    }
    return allNotesGone;
  }
  else { // 'wipe' mode
    const wipeLine = wipeProgress;
    if (wipeLine > 1.1) return true;

    for (let n of notes) {
      const noteStart = n.ratioX;
      const noteEnd = n.ratioX + n.ratioW;

      // Skip if note ends before scanline
      if (noteEnd < wipeLine) continue;

      allNotesGone = false;
      p.fill(n.color);

      // Calculate visible start (eaten by scanline)
      const visibleStart = Math.max(noteStart, wipeLine);

      // [FIX] Calculate visible end (clamped to 1.0)
      const visibleEnd = Math.min(noteEnd, 1.0);

      // Only draw if Start < End
      if (visibleStart < visibleEnd) {
        const startX = leftMargin + (visibleStart * effectiveWidth);
        // Calc width using visibleEnd
        const w = (visibleEnd - visibleStart) * effectiveWidth;
        const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);

        p.rect(startX, y, w, noteH);
      }
    }
    return allNotesGone;
  }
};



export const drawCursor = (p: p5, x: number, isVisible = true) => {
  if (!isVisible) return;
  p.stroke(CONFIG.THEME.CURSOR[0], CONFIG.THEME.CURSOR[1], CONFIG.THEME.CURSOR[2]);
  p.strokeWeight(2);
  p.line(x, 0, x, p.height);

  p.fill(CONFIG.THEME.CURSOR[0], CONFIG.THEME.CURSOR[1], CONFIG.THEME.CURSOR[2]);
  p.noStroke();
  p.triangle(x - 6, 0, x + 6, 0, x, 10);
};

export const drawIdleScreen = (p: p5, bgColor: any) => {
  if (bgColor) {
    p.background(bgColor);
  } else {
    p.background(CONFIG.THEME.BG[0], CONFIG.THEME.BG[1], CONFIG.THEME.BG[2]);
  }
  p.fill(255, 50);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(16);
  p.textFont('Inter');
  p.text("WAITING FOR MIDI", p.width / 2, p.height / 2);
};
