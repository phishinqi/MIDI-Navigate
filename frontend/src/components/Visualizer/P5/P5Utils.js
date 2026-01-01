// frontend/src/components/Visualizer/P5/P5Utils.js
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

export const createBezier = (mX1, mY1, mX2, mY2) => {
  if (mX1 < 0 || mX1 > 1 || mX2 < 0 || mX2 > 1) {
    throw new Error('Bezier x values must be in [0, 1] range.');
  }
  const mSampleValues = new Float32Array(kSplineTableSize);
  if (mX1 !== mY1 || mX2 !== mY2) {
    for (let i = 0; i < kSplineTableSize; ++i) {
      mSampleValues[i] = CalcBezier(i * kSampleStepSize, mX1, mX2);
    }
  }
  const getT = (aX) => {
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
  return (x) => {
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
    BG: [10, 11, 14],
    GRID: [30, 32, 36],
    CURSOR: [255, 200, 0],
    WIPE_LINE: [255, 255, 255, 100],
    WIPE_FILL: [20, 20, 30, 0]
  }
};

// NOTE: 颜色系统已统一使用 lib/utils.js 中的 getTrackColor
// 保留此函数仅用于向后兼容
import { getTrackColor as getTrackColorFromUtils } from '@/lib/utils';

export const getTrackHue = (index) => {
  return (index * 137.5 + 20) % 360;
};

const getLayout = (p, settings) => {
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
// 2. MIDI DATA PROCESSING
export const calculateMeasureMap = (midi) => {
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

export const getBarInfoAtTime = (measures, time) => {
  if (!measures || measures.length === 0) return null;
  for (let i = 0; i < measures.length; i++) {
    if (time >= measures[i].startTime && time < measures[i].endTime) {
      return measures[i];
    }
  }
  return measures[measures.length - 1];
};

// MODIFIED: cacheNotesForBar now has special "greedy" logic for meteor mode.
export const cacheNotesForBar = (p, midi, measure, settings, visibleTracks, percussionSettings, trackColors = {}, useDefaultColors = true) => {
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

    // 使用统一的颜色获取函数
    const colorHex = getTrackColorFromUtils(tIdx, trackColors, useDefaultColors);
    p.colorMode(p.RGB);
    const col = p.color(colorHex);


    track.notes.forEach(n => {
      let overlaps = false;
      if (mode === 'meteor') {
        // "Greedy" logic for meteor: check if the note's *entire lifecycle* overlaps with the current measure.
        const holdDuration = settings.meteorHoldTime || 0.5;
        const fadeDuration = settings.meteorFadeTime || 1.5;
        const noteLifecycleEnd = n.time + holdDuration + fadeDuration;
        overlaps = (n.time < barEnd) && (noteLifecycleEnd > barStart);
      } else {
        // Original logic for wipe and fade modes.
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


export const getDrumStepsForMeasure = (midi, measure, visibleTracks) => {
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


// 3. RENDERING LOGIC (绘制逻辑)

export const drawBackground = (p, bgColor, settings) => {
  if (bgColor) {
    p.background(bgColor);
  } else {
    p.background(...CONFIG.THEME.BG);
  }
  if (settings?.showGrid === false) {
    return;
  }
  p.stroke(...CONFIG.THEME.GRID);
  p.strokeWeight(1);
  const beatX = p.width / 4;
  for (let i = 1; i < 4; i++) p.line(beatX * i, 0, beatX * i, p.height);
  p.line(0, p.height / 2, p.width, p.height / 2);
};
const getMeteorShrinkProgress = (note, audioTime, settings, fadeCurve) => {
  const fadeEaser = createBezier(...(fadeCurve || [0.42, 0, 1, 1]));
  const holdDuration = settings.meteorHoldTime || 0.5;
  const baseFadeDuration = settings.meteorFadeTime || 1.5;

  // 音符越长，给予更长的消逝时间（最小为baseFadeDuration，最大为音符时长的1.5倍）
  const noteDuration = note.ratioW * note.measureDuration;
  const scaledFadeDuration = Math.max(baseFadeDuration, Math.min(noteDuration * 1.5, baseFadeDuration * 3));

  const animStartTime = note.time + holdDuration;
  if (audioTime < animStartTime) return 0;
  if (scaledFadeDuration <= 0) return 1.0;

  const animAge = audioTime - animStartTime;
  const linearProgress = Math.min(1.0, animAge / scaledFadeDuration);
  return fadeEaser(linearProgress);
}

export const drawNotes = (p, notes, audioTime, settings, growCurve = [0.1, 0.85, 0.75, 0.9]) => {
  if (!notes || notes.length === 0) return;
  p.noStroke();

  const midlifePlateauEase = createBezier(...growCurve);
  const { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH } = getLayout(p, settings);
  const mode = settings?.pageTurnMode || 'wipe';

  let globalClipRatio = 0; // Only for 'fade' mode
  if (mode === 'fade') {
    const measureStart = notes[0]?.measureStart || 0;
    const measureDuration = notes[0]?.measureDuration || 4.0;
    const playheadRatio = (audioTime - measureStart) / measureDuration;

    // 1. 获取用户定义的开始时间，如果没有设置则默认为 0.45
    const FADE_START_RATIO = settings?.fadeStartRatio ?? 0.45;

    if (playheadRatio > FADE_START_RATIO) {
      const shrinkSetting = settings?.shrinkSpeed || 0.08;
      const speedFactor = shrinkSetting * 20.0;

      // 计算从开始点到小节结束的线性进度 (0.0 -> 1.0)
      const linearP = (playheadRatio - FADE_START_RATIO) / (1.0 - FADE_START_RATIO);

      // 2. 使用 fadeCurve 生成缓动函数
      // 如果 settings.fadeCurve 不存在，使用默认的较陡峭的曲线 [0.6, 0.05, 0.9, 0.9] 模拟之前的 pow(4) 效果
      const fadeCurve = settings?.fadeCurve || [0.6, 0.05, 0.9, 0.9];
      const fadeEaser = createBezier(...fadeCurve);

      // 3. 应用曲线
      const easedP = fadeEaser(linearP);

      const maxPossibleCut = speedFactor * 0.5;
      globalClipRatio = easedP * maxPossibleCut;
    }
  }

  for (let n of notes) {
    if (audioTime >= n.time) {
      const age = audioTime - n.time;
      const noteDurationInSeconds = n.ratioW * n.measureDuration;
      const growthProgress = (noteDurationInSeconds > 0.01) ? Math.min(1.0, age / noteDurationInSeconds) : 1.0;
      const easedProgress = midlifePlateauEase(growthProgress);

      const originalStartRatio = n.ratioX;
      const currentEndRatio = originalStartRatio + (n.ratioW * easedProgress);
      let visibleStartRatio = originalStartRatio;

      if (mode === 'fade') {
        visibleStartRatio = Math.max(originalStartRatio, globalClipRatio);
      } else if (mode === 'meteor') {
        const shrinkProgress = getMeteorShrinkProgress(n, audioTime, settings, settings.fadeCurve);
        visibleStartRatio = originalStartRatio + (n.ratioW * shrinkProgress);
      }

      // This clipping is now essential for the greedy caching in meteor mode
      const finalVisibleStart = Math.max(0, visibleStartRatio);
      const finalVisibleEnd = Math.min(1, currentEndRatio);

      if (finalVisibleStart >= finalVisibleEnd) continue;

      const x = leftMargin + (finalVisibleStart * effectiveWidth);
      const w = (finalVisibleEnd - finalVisibleStart) * effectiveWidth;
      const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
      const h = noteH;

      if (w > 0) {
        p.fill(n.color);
        p.rect(x, y, w, h);
      }
    }
  }
};

export const drawPreviousNotes = (p, notes, audioTime, settings, timeSinceTransition, delay = 0.25, wipeProgress = 0) => {
  const mode = settings?.pageTurnMode || 'wipe';

  if (!notes || notes.length === 0) return true;
  p.noStroke();

  const { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH } = getLayout(p, settings);
  let allNotesGone = true;

  if (mode === 'meteor') {
    // 'meteor' 模式的动画依赖于全局播放时间 audioTime
    if (audioTime === undefined) return true;

    for (let n of notes) {
      const holdDuration = settings.meteorHoldTime || 0.5;
      const baseFadeDuration = settings.meteorFadeTime || 1.5;

      // 使用与getMeteorShrinkProgress相同的缩放逻辑
      const noteDuration = n.ratioW * n.measureDuration;
      const scaledFadeDuration = Math.max(baseFadeDuration, Math.min(noteDuration * 1.5, baseFadeDuration * 3));

      // 如果音符的整个生命周期已经结束，则跳过
      if (audioTime > n.time + holdDuration + scaledFadeDuration) {
        continue;
      }
      allNotesGone = false; // 只要有一个音符还在，就不能算全部消失

      // 只绘制那些已经开始的音符
      if (audioTime >= n.time) {
        const shrinkProgress = getMeteorShrinkProgress(n, audioTime, settings, settings.fadeCurve);

        // 对于来自前一个小节的音符，我们视其已完成生长，只处理收缩动画
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

      // 如果音符结束位置在扫描线左侧，则无需绘制
      if (noteEnd < wipeLine) continue;

      allNotesGone = false;
      p.fill(n.color);

      // 计算可视的起始位置（被扫描线吃掉的部分）
      const visibleStart = Math.max(noteStart, wipeLine);

      // 计算可视的结束位置（限制在页面右边界 1.0 以内）
      // 防止音符绘制超出 effectiveWidth 区域
      const visibleEnd = Math.min(noteEnd, 1.0);

      // 只有当 起始点 < 结束点 时才绘制（防止负宽度）
      if (visibleStart < visibleEnd) {
        const startX = leftMargin + (visibleStart * effectiveWidth);
        // 宽度计算使用修正后的 visibleEnd
        const w = (visibleEnd - visibleStart) * effectiveWidth;
        const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);

        p.rect(startX, y, w, noteH);
      }
    }
    return allNotesGone;
  }
};



export const drawCursor = (p, x, isVisible = true) => {
  if (!isVisible) return;
  p.stroke(...CONFIG.THEME.CURSOR);
  p.strokeWeight(2);
  p.line(x, 0, x, p.height);

  p.fill(...CONFIG.THEME.CURSOR);
  p.noStroke();
  p.triangle(x - 6, 0, x + 6, 0, x, 10);
};

export const drawIdleScreen = (p, bgColor) => {
  if (bgColor) {
    p.background(bgColor);
  } else {
    p.background(...CONFIG.THEME.BG);
  }
  p.fill(255, 50);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(16);
  p.text("WAITING FOR MIDI", p.width / 2, p.height / 2);
};
