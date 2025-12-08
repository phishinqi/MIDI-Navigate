import { getDrumVisuals } from '@/lib/percussionMap';

export const CONFIG = {
  SHRINK_SPEED: 0.05,
  GROW_SPEED: 3.0,
  MIN_PITCH: 0,
  MAX_PITCH: 127,
  // --- 动画参数 (已调整为更显著的效果) ---
  PRE_SHRINK_FACTOR: 0.25, // 收缩动画在音符时长的25%处开始 (动画时间更长)
  MAX_SHRINK_RATIO: 0.9,   // 从左侧最大收缩90%的宽度 (收缩幅度更大)
  THEME: {
    BG: [10, 11, 14],
    GRID: [30, 32, 36],
    CURSOR: [255, 200, 0],
    WIPE_LINE: [255, 255, 255, 100],
    WIPE_FILL: [20, 20, 30, 0]
  }
};

// --- 辅助函数 & 缓动函数 ---

const easeOutExpo = (x) => {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

// 使用四次方缓入函数，使动画加速感更强
const easeInQuart = (t) => t * t * t * t;

export const getTrackHue = (index) => (index * 137) % 360;

/**
 * [辅助函数] 计算布局参数
 */
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

// --- MIDI 数据处理核心 (无变动) ---
export const calculateMeasureMap = (midi) => {
  if (!midi || !midi.header) return [];
  const ppq = midi.header.ppq || 480;
  const rawTempos = midi.header.tempos || [];
  const rawMeters = midi.header.timeSignatures || [];
  const duration = midi.duration || 0;

  const sortedTempos = [...rawTempos].sort((a, b) => a.ticks - b.ticks);
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
  const sortedMeters = [...rawMeters].sort((a, b) => a.ticks - b.ticks);
  if (sortedMeters.length === 0) sortedMeters.push({ ticks: 0, timeSignature: [4, 4] });
  if (sortedMeters[0].ticks > 0) sortedMeters.unshift({ ticks: 0, timeSignature: [4, 4] });

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

export const cacheNotesForBar = (p, midi, measure, settings) => {
  const notes = [];
  if (!measure) return notes;

  const barStart = measure.startTime;
  const barDuration = measure.duration;
  const buffer = 0.1;
  const barEnd = measure.endTime;

  midi.tracks.forEach((track, tIdx) => {
    const hue = getTrackHue(tIdx);
    p.colorMode(p.HSB);
    const col = p.color(hue, 70, 90);
    p.colorMode(p.RGB);

    track.notes.forEach(n => {
      const overlaps = (n.time < barEnd + buffer) && (n.time + n.duration > barStart - buffer);

      if (overlaps) {
        const relTime = n.time - barStart;
        const ratioX = relTime / barDuration;
        const ratioW = n.duration / barDuration;
        const normPitch = (n.midi - CONFIG.MIN_PITCH) / (CONFIG.MAX_PITCH - CONFIG.MIN_PITCH);

        if (ratioX + ratioW > -0.1 && ratioX < 1.1) {
            notes.push({
              ratioX,
              ratioW,
              normPitch,
              time: n.time,
              duration: n.duration,
              color: col
            });
        }
      }
    });
  });
  return notes;
};

export const getDrumStepsForMeasure = (midi, measure) => {
    if (!midi || !measure) return [];
    let rawNotes = [];
    const { startTime, endTime } = measure;
    midi.tracks.forEach((t) => {
        const name = (t.name || "").toLowerCase();
        const inst = t.instrument || {};
        const instName = (inst.name || "").toLowerCase();
        const isDrum = name.includes('drum') || name.includes('perc') ||
            instName.includes('drum') || instName.includes('perc') ||
            inst.percussion === true || (t.channel === 9 || t.channel === 10);
        if (isDrum && t.notes) {
            t.notes.forEach(n => {
                if (n.time >= startTime && n.time < endTime) {
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


// --- 绘制核心逻辑 ---

export const drawBackground = (p) => {
  p.background(...CONFIG.THEME.BG);
  p.stroke(...CONFIG.THEME.GRID);
  p.strokeWeight(1);
  const beatX = p.width / 4;
  for (let i = 1; i < 4; i++) p.line(beatX * i, 0, beatX * i, p.height);
  p.line(0, p.height / 2, p.width, p.height / 2);
};

/**
 * [MODIFIED] 统一的音符绘制函数
 * 动画逻辑更新，分离了“预收缩”和“光标裁切”，使效果更明显。
 */
export const drawNotes = (p, notes, audioTime, currentMeasure, settings) => {
  if (!currentMeasure) return;

  p.noStroke();
  const growSpeed = settings?.growSpeed || CONFIG.GROW_SPEED;
  const { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH } = getLayout(p, settings);

  const playheadRatio = (audioTime - currentMeasure.startTime) / currentMeasure.duration;

  for (let n of notes) {
    if (audioTime < n.time) {
      continue;
    }

    const noteStartTime = n.time;
    const noteEndTime = noteStartTime + n.duration;

    // --- 1. 在相对坐标空间中计算边界 ---

    let noteStartRatio = n.ratioX;
    const noteEndRatio = n.ratioX + n.ratioW;

    // --- 预收缩动画逻辑 ---
    const preShrinkFactor = settings?.preShrinkFactor || CONFIG.PRE_SHRINK_FACTOR;
    const maxShrinkRatio = settings?.maxShrinkRatio || CONFIG.MAX_SHRINK_RATIO;

    const preShrinkStartTime = noteStartTime + (n.duration * preShrinkFactor);
    const preShrinkDuration = noteEndTime - preShrinkStartTime;
    const maxShrinkAmountRatio = n.ratioW * maxShrinkRatio;

    if (audioTime > preShrinkStartTime && preShrinkDuration > 0) {
        const rawProgress = (audioTime - preShrinkStartTime) / preShrinkDuration;
        // [MODIFIED] 使用更强的缓动函数，让动画更有冲击力
        const shrinkProgress = easeInQuart(Math.min(1.0, rawProgress));
        const shrinkAmountRatio = maxShrinkAmountRatio * shrinkProgress;
        noteStartRatio += shrinkAmountRatio;
    }

    // --- 生长动画逻辑 ---
    const age = audioTime - noteStartTime;
    const growthProgress = easeOutExpo(Math.min(1, age * growSpeed));
    const growthEndRatio = n.ratioX + (n.ratioW * growthProgress);

    // --- 裁切逻辑 (仅在音符结束后启动) ---
    let clipStartRatio = 0; // 默认无裁切
    // [MODIFIED] 裁切只在音符自身时长结束后才开始
    if (audioTime > noteEndTime) {
        clipStartRatio = playheadRatio;
    }

    // --- 2. 确定最终可见的区间 ---
    const finalVisibleStartRatio = Math.max(noteStartRatio, clipStartRatio);
    const finalVisibleEndRatio = Math.min(noteEndRatio, growthEndRatio);

    if (finalVisibleStartRatio >= finalVisibleEndRatio) {
      continue;
    }

    // --- 3. 将相对坐标转换为像素并绘制 ---
    const visibleWidthRatio = finalVisibleEndRatio - finalVisibleStartRatio;

    const x = leftMargin + (finalVisibleStartRatio * effectiveWidth);
    const w = visibleWidthRatio * effectiveWidth;
    const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);

    if (w > 0) {
      p.fill(n.color);
      p.rect(x, y, w, noteH);
    }
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

export const drawIdleScreen = (p) => {
  p.background(...CONFIG.THEME.BG);
  p.fill(255, 50);
  p.textAlign(p.CENTER, p.CENTER);
  p.text("READY", p.width / 2, p.height / 2);
};
