// frontend/src/components/Visualizer/P5/P5Sketch.js
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
  let lastPercussionEnabledRef = null;

  // 记录翻页时间与上一小节时长
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
    const { midiData, p5Settings, percussionSettings, visibleTrackIndices, backgroundColor } = state;

    // 1. Idle Screen
    if (!midiData) {
      drawIdleScreen(p, backgroundColor);
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
    drawBackground(p, backgroundColor, p5Settings);

    // --- State Update Logic ---

    // A. 翻页检测 (Page Turn Detection)
    if (currentBarIndex !== lastBarIndex) {
      if (lastBarIndex !== -1 && currentBarIndex === lastBarIndex + 1) {
        cachedNotesPrev = [...cachedNotesCurrent];
        cachedNotesPrev.forEach(n => n.shrinkScale = 1.0);
        cachedNotesPrev.prevBarDuration = activeMeasure.duration;
        transitionStartTime = audioTime;
      } else {
        cachedNotesPrev = [];
      }
      lastBarIndex = currentBarIndex;
    }

    // B. 加载新数据 (Cache Update)
    const isVisibilityChanged = visibleTrackIndices !== lastVisibleTracksRef;
    const isPercussionToggled = percussionSettings?.enabled !== lastPercussionEnabledRef;

    if (currentBarIndex !== cachedBarIndex || isVisibilityChanged || isPercussionToggled) {
        cachedNotesCurrent = cacheNotesForBar(
            p,
            midiData,
            activeMeasure,
            p5Settings,
            visibleTrackIndices,
            percussionSettings
        );
        cachedDrumSteps = getDrumStepsForMeasure(midiData, activeMeasure, visibleTrackIndices);
        cachedBarIndex = currentBarIndex;
        lastVisibleTracksRef = visibleTrackIndices;
        lastPercussionEnabledRef = percussionSettings?.enabled;
    }

    // --- Render Layers ---

    // Layer A: Percussion Grid
    drawPercussionGrid(p, cachedDrumSteps, audioTime, percussionSettings);

    // Layer B: Previous Melodic Notes
    const timeSinceTransition = audioTime - transitionStartTime;
    // ================================================================
    // 关键修改：为 drawPreviousNotes 传入 audioTime
    // The key change is to pass audioTime into drawPreviousNotes
    // ================================================================
    const allGone = drawPreviousNotes(
        p,
        cachedNotesPrev,
        audioTime,          // <-- 此处添加了 audioTime
        p5Settings,
        timeSinceTransition,
        0.3,
        barProgress
    );

    if (allGone) cachedNotesPrev = [];

    // Layer C: Current Melodic Notes
    drawNotes(
        p,
        cachedNotesCurrent,
        audioTime,
        p5Settings,
        p5Settings.growCurve
    );

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
