import { getDrumVisuals } from '@/lib/percussionMap';

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

// --- 辅助函数 & 缓动函数 ---

const easeOutExpo = (x) => {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

export const getTrackHue = (index) => (index * 137) % 360;

/**
 * [辅助函数] 计算布局参数
 * 统一管理 Note 的缩放、偏移和边距
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

// --- MIDI 数据处理核心 ---

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

/**
 * [UPDATED] cacheNotesForBar
 * 注入 measureStart 和 measureDuration 以便在 drawNotes 中计算进度
 */
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
              color: col,
              shrinkScale: 1.0,
              // [NEW] 注入上下文，用于进度计算
              measureStart: barStart,
              measureDuration: barDuration
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

// 定义衔接参数
const FADE_START_RATIO = 0.45;    // 接近 50% 时开始
const FADE_TARGET_RATIO = 0.95;   // 小节结束时，裁切到 95%（留 5% 的尾巴给 drawPreviousNotes）

/**
 * [UPDATED] drawNotes
 *
 * 核心逻辑：极度缓慢的启动
 * 使用 Math.pow(x, 4) 曲线。
 * 当进度刚过 0.45 时，fadeProgress 很小，pow(small, 4) 几乎为 0。
 * 只有当接近小节尾声时，裁切线才会显著移动。
 */
export const drawNotes = (p, notes, audioTime, settings) => {
  if (!notes || notes.length === 0) return;
  p.noStroke();

  const growSpeed = settings?.growSpeed || 3.0;
  const { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH } = getLayout(p, settings);
  const isFadeMode = settings?.pageTurnMode === 'fade';

  // 1. 获取小节进度
  const measureStart = notes[0].measureStart || 0;
  const measureDuration = notes[0].measureDuration || 4.0;
  const playheadRatio = (audioTime - measureStart) / measureDuration;

  // 2. 计算裁切位置
  let globalClipRatio = 0;

  if (isFadeMode && playheadRatio > FADE_START_RATIO) {
      // 归一化进度 (0.0 ~ 1.0)
      const linearP = (playheadRatio - FADE_START_RATIO) / (1.0 - FADE_START_RATIO);

      // [关键] 使用 4 次方曲线，实现“极度缓慢”的启动
      // 例如：linearP = 0.2 (刚开始) -> 0.2^4 = 0.0016 (几乎不动)
      //       linearP = 0.8 (快结束) -> 0.8^4 = 0.4096 (加速)
      //       linearP = 1.0 (结束)   -> 1.0
      const easedP = Math.pow(linearP, 4);

      globalClipRatio = easedP * FADE_TARGET_RATIO;
  }

  for (let n of notes) {
    if (audioTime >= n.time) {
        // A. 生长 (Extension)
        const age = audioTime - n.time;
        const linearProgress = Math.min(1, age * growSpeed);
        const easedProgress = easeOutExpo(linearProgress);

        const originalStartRatio = n.ratioX;
        const currentEndRatio = originalStartRatio + (n.ratioW * easedProgress);

        // B. 裁切 (Clipping)
        // 只有当 globalClipRatio 追上音符起点时，音符才开始变短
        const visibleStartRatio = Math.max(originalStartRatio, globalClipRatio);
        const visibleEndRatio = currentEndRatio;

        if (visibleStartRatio >= visibleEndRatio) continue;

        // C. 绘制
        const visibleW = visibleEndRatio - visibleStartRatio;
        const x = leftMargin + (visibleStartRatio * effectiveWidth);
        const w = Math.max(0, visibleW * effectiveWidth);
        const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);

        if (w > 0) {
            p.fill(n.color);
            p.rect(x, y, w, noteH);
        }
    }
  }
};

/**
 * [UPDATED] drawPreviousNotes
 *
 * 逻辑更新：
 * 这里的起点必须是 drawNotes 的终点 (FADE_TARGET_RATIO = 0.95)。
 * 这样切换小节时，视觉上是从 95% 的位置继续向右扫除，直到完全消失。
 */
export const drawPreviousNotes = (p, notes, settings, timeSinceTransition, delay = 0.25, wipeProgress = 0) => {
  p.noStroke();
  const { effectiveHeight, topMargin, effectiveWidth, leftMargin, noteH } = getLayout(p, settings);
  const mode = settings?.pageTurnMode || 'wipe';

  if (mode === 'fade') {
      const shrinkSpeed = settings?.shrinkSpeed || 0.08;
      // 过渡时间不用太长，因为只剩下最后一点点了
      const transitionDuration = 0.5 - (shrinkSpeed * 2);

      const progress = timeSinceTransition / Math.max(0.1, transitionDuration);

      // [关键] 起点衔接 drawNotes 的 0.95
      const startClip = FADE_TARGET_RATIO;
      const endClip = 1.2; // 扫出屏幕即可

      const wavePosition = startClip + (progress * (endClip - startClip));

      if (progress >= 1.2) return true;

      for (let n of notes) {
          const noteStart = n.ratioX;
          const noteEnd = n.ratioX + n.ratioW;

          const visibleStart = Math.max(noteStart, wavePosition);
          const visibleEnd = noteEnd;

          if (visibleStart < visibleEnd) {
              const startX = leftMargin + (visibleStart * effectiveWidth);
              const w = (visibleEnd - visibleStart) * effectiveWidth;
              const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
              p.fill(n.color);
              p.rect(startX, y, w, noteH);
          }
      }
      return false;
  }

  // Wipe Mode (保持不变)
  else {
      if (wipeProgress <= 1.0) {
        const wipeLine = wipeProgress;
        for (let n of notes) {
            const noteStart = n.ratioX;
            const noteEnd = n.ratioX + n.ratioW;
            if (noteEnd < wipeLine) continue;

            p.fill(n.color);
            if (noteStart > wipeLine) {
                const baseW = Math.max(4, n.ratioW * effectiveWidth);
                const x = leftMargin + (n.ratioX * effectiveWidth);
                const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
                p.rect(x, y, baseW, noteH);
            } else {
                const visibleStart = wipeLine;
                const visibleLen = noteEnd - visibleStart;
                if (visibleLen > 0) {
                    const startX = leftMargin + (visibleStart * effectiveWidth);
                    const w = Math.max(0, visibleLen * effectiveWidth);
                    const y = topMargin + effectiveHeight - (n.normPitch * effectiveHeight) - (noteH / 2);
                    p.rect(startX, y, w, noteH);
                }
            }
        }
        return false;
      }
      return wipeProgress > 1.2;
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
