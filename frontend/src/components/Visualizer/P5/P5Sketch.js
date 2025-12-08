import useStore from '@/store/useStore';
import * as Tone from 'tone';
import {
  calculateMeasureMap, getBarInfoAtTime, cacheNotesForBar, getDrumStepsForMeasure,
  drawBackground, drawNotes, drawPreviousNotes, drawCursor, drawIdleScreen
} from './P5Utils';
import { drawPercussionGrid } from './PercussionGridP5';

export const createSketch = (containerRef) => (p) => {
  // --- Runtime State ---
  let measureMap = [];

  // Melodic Notes
  let cachedNotesCurrent = [];
  let cachedNotesPrev = [];

  // Percussion Steps
  let cachedDrumSteps = [];

  // Logic Flags
  let cachedBarIndex = -2;
  let lastBarIndex = -1;
  let lastMidiData = null;

  // 记录翻页发生的时间，用于延迟消散
  let transitionStartTime = 0;

  p.setup = () => {
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    p.createCanvas(w, h);
    p.frameRate(60);
    p.rectMode(p.CORNER);
    p.noStroke();
  };

  p.windowResized = () => {
    if (containerRef.current) {
      p.resizeCanvas(containerRef.current.clientWidth, containerRef.current.clientHeight);
      cachedBarIndex = -2;
    }
  };

  p.draw = () => {
    const state = useStore.getState();
    const { midiData, p5Settings, percussionSettings } = state;

    // 1. Idle Screen
    if (!midiData) {
      drawIdleScreen(p);
      return;
    }

    // 2. Data Change Detection
    if (midiData !== lastMidiData) {
        measureMap = calculateMeasureMap(midiData);
        lastMidiData = midiData;
        cachedBarIndex = -2;
        lastBarIndex = -1;
        cachedNotesPrev = [];
        cachedNotesCurrent = [];
    }

    // 3. Timing Calculation
    const audioTime = Tone.Transport.seconds;
    const activeMeasure = getBarInfoAtTime(measureMap, audioTime) || (measureMap.length > 0 ? measureMap[0] : { index: 0, startTime: 0, duration: 2, endTime: 2 });

    const currentBarIndex = activeMeasure.index;

    // [关键] 计算当前小节内的进度 (0.0 ~ 1.0)，这也就是光标位置，也是“擦除进度”
    const barProgress = (audioTime - activeMeasure.startTime) / activeMeasure.duration;

    // 4. Background
    drawBackground(p);

    // --- State Update Logic ---

    // A. 翻页检测
    if (currentBarIndex !== lastBarIndex) {
      if (lastBarIndex !== -1 && currentBarIndex === lastBarIndex + 1) {
        // 顺序播放：触发翻页，保存旧数据
        cachedNotesPrev = [...cachedNotesCurrent];

        // 重置旧数据的消散状态
        cachedNotesPrev.forEach(n => n.shrinkScale = 1.0);

        // 记录时间戳
        transitionStartTime = audioTime;
      } else {
        // 跳转/重置：直接清空旧数据
        cachedNotesPrev = [];
      }
      lastBarIndex = currentBarIndex;
    }

    // B. 加载新数据
    if (currentBarIndex !== cachedBarIndex) {
        cachedNotesCurrent = cacheNotesForBar(p, midiData, activeMeasure, p5Settings);
        cachedDrumSteps = getDrumStepsForMeasure(midiData, activeMeasure);
        cachedBarIndex = currentBarIndex;
    }

    // --- Render Layers ---

    // Layer A: Percussion Grid
    drawPercussionGrid(p, cachedDrumSteps, audioTime, percussionSettings);

    // Layer B: Previous Melodic Notes (Wipe & Fade)
    // 传入 barProgress 作为 wipeProgress
    const timeSinceTransition = audioTime - transitionStartTime;
    const allGone = drawPreviousNotes(
        p,
        cachedNotesPrev,
        p5Settings,
        timeSinceTransition,
        0.3,         // 延迟时间 (秒)
        barProgress  // 擦除进度 (0-1)，光标扫过的地方旧音符会消失
    );

    if (allGone) cachedNotesPrev = [];

    // Layer C: Current Melodic Notes (Grow)
    drawNotes(p, cachedNotesCurrent, audioTime, p5Settings);

    // Layer D: Playhead Cursor
    if (p5Settings?.showCursor) {
        const clampedProgress = Math.max(0, Math.min(1, barProgress));

        // 获取水平缩放后的布局
        const hZoom = p5Settings.horizontalZoom || 1.0;
        const effectiveWidth = p.width * hZoom;
        const leftMargin = (p.width - effectiveWidth) / 2;

        // 计算光标位置
        const cursorX = leftMargin + (clampedProgress * effectiveWidth);
        drawCursor(p, cursorX, true);
    }
  };
};
