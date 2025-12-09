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
  let lastVisibleTracksRef = null;
  // [NEW] 记录 Percussion Grid 开关状态，用于触发重绘
  let lastPercussionEnabledRef = null;

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
    const { midiData, p5Settings, percussionSettings, visibleTrackIndices } = state;

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
        lastVisibleTracksRef = null;
        lastPercussionEnabledRef = null;
    }

    // 3. Timing Calculation
    const audioTime = Tone.Transport.seconds;
    const activeMeasure = getBarInfoAtTime(measureMap, audioTime) || (measureMap.length > 0 ? measureMap[0] : { index: 0, startTime: 0, duration: 2, endTime: 2 });

    const currentBarIndex = activeMeasure.index;
    const barProgress = (audioTime - activeMeasure.startTime) / activeMeasure.duration;

    // 4. Background
    drawBackground(p);

    // --- State Update Logic ---

    // A. 翻页检测
    if (currentBarIndex !== lastBarIndex) {
      if (lastBarIndex !== -1 && currentBarIndex === lastBarIndex + 1) {
        cachedNotesPrev = [...cachedNotesCurrent];
        cachedNotesPrev.forEach(n => n.shrinkScale = 1.0);
        transitionStartTime = audioTime;
      } else {
        cachedNotesPrev = [];
      }
      lastBarIndex = currentBarIndex;
    }

    // B. 加载新数据 (Cache Update)
    const isVisibilityChanged = visibleTrackIndices !== lastVisibleTracksRef;
    // [NEW] 如果打击乐开关状态改变，也需要重新生成音符（因为要隐藏/显示鼓轨道）
    const isPercussionToggled = percussionSettings?.enabled !== lastPercussionEnabledRef;

    if (currentBarIndex !== cachedBarIndex || isVisibilityChanged || isPercussionToggled) {
        // [MODIFIED] 传入 percussionSettings 以便 cacheNotesForBar 进行过滤
        cachedNotesCurrent = cacheNotesForBar(
            p,
            midiData,
            activeMeasure,
            p5Settings,
            visibleTrackIndices,
            percussionSettings // 新增参数
        );

        cachedDrumSteps = getDrumStepsForMeasure(midiData, activeMeasure, visibleTrackIndices);

        cachedBarIndex = currentBarIndex;
        lastVisibleTracksRef = visibleTrackIndices;
        lastPercussionEnabledRef = percussionSettings?.enabled;
    }

    // --- Render Layers ---

    // Layer A: Percussion Grid
    drawPercussionGrid(p, cachedDrumSteps, audioTime, percussionSettings);

    // Layer B: Previous Melodic Notes (Wipe & Fade)
    const timeSinceTransition = audioTime - transitionStartTime;
    const allGone = drawPreviousNotes(
        p,
        cachedNotesPrev,
        p5Settings,
        timeSinceTransition,
        0.3,
        barProgress
    );

    if (allGone) cachedNotesPrev = [];

    // Layer C: Current Melodic Notes (Grow)
    drawNotes(p, cachedNotesCurrent, audioTime, p5Settings);

    // Layer D: Playhead Cursor
    if (p5Settings?.showCursor) {
        const clampedProgress = Math.max(0, Math.min(1, barProgress));
        const hZoom = p5Settings.horizontalZoom || 1.0;
        const effectiveWidth = p.width * hZoom;
        const leftMargin = (p.width - effectiveWidth) / 2;
        const cursorX = leftMargin + (clampedProgress * effectiveWidth);
        drawCursor(p, cursorX, true);
    }
  };
};
