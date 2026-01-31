import useStore from '@/store/useStore';
import * as Tone from 'tone';
import p5 from 'p5';
import {
  calculateMeasureMap, getBarInfoAtTime, cacheNotesForBar, getDrumStepsForMeasure,
  drawBackground, drawNotes, drawPreviousNotes, drawCursor, drawIdleScreen
} from './P5Utils';
import { drawPercussionGrid } from './PercussionGridP5';

export const createSketch = (containerRef: React.RefObject<HTMLDivElement>) => (p: p5) => {
  // Runtime State
  let measureMap = [];
  let manualTime: number | null = null; // For offline rendering

  // Melodic Notes
  let cachedNotesCurrent = [];
  let cachedNotesPrev = [];

  // Percussion Steps
  let cachedDrumSteps = [];

  // Logic Flags
  let cachedPageIndex = -2;
  let lastPageIndex = -1;

  let lastMidiData = null;
  let lastVisibleTracksRef = null;
  let lastPercussionEnabledRef = null;
  let lastMeasuresPerPage = -1;
  let lastTrackColors = null;
  let lastUseDefaultTrackColors = true;

  // Page turn timing
  let transitionStartTime = 0;

  p.setup = () => {
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    p.createCanvas(w, h);
    p.frameRate(60);
    p.rectMode(p.CORNER);
    p.noStroke();

    // Export internal control methods
    (p as any).renderFrame = (time: number) => {
      manualTime = time;
      p.redraw();
    };

    (p as any).setManualMode = (enabled: boolean) => {
      if (enabled) {
        manualTime = 0;
        p.noLoop();
      } else {
        manualTime = null;
        p.loop();
      }
    };
  };

  p.windowResized = () => {
    if (containerRef.current) {
      p.resizeCanvas(containerRef.current.clientWidth, containerRef.current.clientHeight);
      cachedPageIndex = -2;
    }
  };

  p.draw = () => {
    const state = useStore.getState();
    const { midiData, p5Settings, percussionSettings, visibleTrackIndices, backgroundColor, trackColors, useDefaultTrackColors } = state;

    // 1. Idle Screen
    if (!midiData) {
      drawIdleScreen(p, backgroundColor);
      return;
    }

    // 2. Data Change Detection
    if (midiData !== lastMidiData) {
      measureMap = calculateMeasureMap(midiData);
      lastMidiData = midiData;
      cachedPageIndex = -2;
      lastPageIndex = -1;
      cachedNotesPrev = [];
      cachedNotesCurrent = [];
      lastVisibleTracksRef = null;
      lastPercussionEnabledRef = null;
    }

    // Timing Calculation (Multi-Measure Page Logic)
    const audioTime = manualTime !== null ? manualTime : Tone.Transport.seconds;

    const actualActiveMeasure = getBarInfoAtTime(measureMap, audioTime) || (measureMap.length > 0 ? measureMap[0] : { index: 0, startTime: 0, duration: 2, endTime: 2 });
    const measuresPerPage = Math.max(1, p5Settings.measuresPerPage || 1);
    const currentPageIndex = Math.floor(actualActiveMeasure.index / measuresPerPage);

    const startMeasureIndex = currentPageIndex * measuresPerPage;
    const endMeasureIndex = Math.min(startMeasureIndex + measuresPerPage, measureMap.length);

    // Page window calculation
    const pageStartTime = measureMap[startMeasureIndex] ? measureMap[startMeasureIndex].startTime : 0;
    const lastMeasureOfPage = measureMap[endMeasureIndex - 1];
    const pageEndTime = lastMeasureOfPage ? lastMeasureOfPage.endTime : pageStartTime + 2;
    const pageDuration = pageEndTime - pageStartTime;

    // "Virtual" Measure for rendering
    const activePageWindow = {
      index: currentPageIndex,
      startTime: pageStartTime,
      endTime: pageEndTime,
      duration: pageDuration,
      realStartBar: startMeasureIndex,
      realEndBar: endMeasureIndex
    };

    const barProgress = (audioTime - activePageWindow.startTime) / activePageWindow.duration;


    // 4. Background
    if ((p as any).transparentBackground) {
      p.clear();
    } else {
      drawBackground(p, backgroundColor, p5Settings);
    }

    // --- State Update Logic ---

    // A. Page Turn Detection (based on Page Index)
    if (currentPageIndex !== lastPageIndex) {
      if (lastPageIndex !== -1 && currentPageIndex === lastPageIndex + 1) {
        cachedNotesPrev = [...cachedNotesCurrent];
        cachedNotesPrev.forEach((n: any) => n.shrinkScale = 1.0);
        (cachedNotesPrev as any).prevBarDuration = activePageWindow.duration;
        transitionStartTime = audioTime;
      } else {
        cachedNotesPrev = [];
      }
      lastPageIndex = currentPageIndex;
    }

    // B. Cache Update
    const isVisibilityChanged = visibleTrackIndices !== lastVisibleTracksRef;
    const isPercussionToggled = percussionSettings?.enabled !== lastPercussionEnabledRef;
    const isSettingsChanged = measuresPerPage !== lastMeasuresPerPage;
    const isColorChanged = trackColors !== lastTrackColors || useDefaultTrackColors !== lastUseDefaultTrackColors;

    if (currentPageIndex !== cachedPageIndex || isVisibilityChanged || isPercussionToggled || isSettingsChanged || isColorChanged) {
      cachedNotesCurrent = cacheNotesForBar(
        p,
        midiData,
        activePageWindow,
        p5Settings,
        visibleTrackIndices,
        percussionSettings,
        trackColors,
        useDefaultTrackColors
      );
      cachedDrumSteps = getDrumStepsForMeasure(midiData, activePageWindow, visibleTrackIndices);

      cachedPageIndex = currentPageIndex;
      lastVisibleTracksRef = visibleTrackIndices;
      lastPercussionEnabledRef = percussionSettings?.enabled;
      lastMeasuresPerPage = measuresPerPage;
      lastTrackColors = trackColors;
      lastUseDefaultTrackColors = useDefaultTrackColors;
    }

    // Render Layers

    // Layer A: Percussion Grid
    drawPercussionGrid(p, cachedDrumSteps, audioTime, percussionSettings, backgroundColor);

    // Layer B: Previous Melodic Notes
    const timeSinceTransition = audioTime - transitionStartTime;

    const allGone = drawPreviousNotes(
      p,
      cachedNotesPrev,
      audioTime,
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