import useStore from '@/store/useStore';
import * as Tone from 'tone';
import {
  calculateMeasureMap, getBarInfoAtTime, cacheNotesForBar, getDrumStepsForMeasure,
  drawBackground, drawNotes, drawPreviousNotes, drawCursor, drawIdleScreen
} from './P5Utils';
import { drawPercussionGrid } from './PercussionGridP5';

export const createSketch = (containerRef) => (p) => {
  let measureMap = [];
  let cachedNotesCurrent = [];
  let cachedNotesPrev = [];
  let cachedDrumSteps = [];
  let cachedPageIndex = -2;
  let lastPageIndex = -1;
  let lastMidiData = null;
  let lastVisibleTracksRef = null;
  let lastPercussionEnabledRef = null;
  let lastMeasuresPerPage = -1;
  let lastTrackColors = null;
  let lastUseDefaultTrackColors = true;
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

    // --- 3. Timing Calculation ---
    const audioTime = Tone.Transport.seconds;

    // 获取当前处于哪一个具体的小节
    const actualActiveMeasure = getBarInfoAtTime(measureMap, audioTime) || (measureMap.length > 0 ? measureMap[0] : { index: 0, startTime: 0, duration: 2, endTime: 2 });

    // 获取用户设置的每页小节数 (默认为1)
    const measuresPerPage = Math.max(1, p5Settings.measuresPerPage || 1);

    // 计算当前"页码"
    const currentPageIndex = Math.floor(actualActiveMeasure.index / measuresPerPage);

    // 计算该页面的起始小节和结束小节索引
    const startMeasureIndex = currentPageIndex * measuresPerPage;
    const endMeasureIndex = Math.min(startMeasureIndex + measuresPerPage, measureMap.length);

    // 计算整个页面的时间窗口
    // 页面的 startTime 是该页第一个小节的 startTime
    const pageStartTime = measureMap[startMeasureIndex] ? measureMap[startMeasureIndex].startTime : 0;

    // 页面的 endTime 是该页最后一个小节的 endTime
    // 注意：如果是最后一页，小节数可能少于 measuresPerPage，所以要用实际存在的最后一个小节
    const lastMeasureOfPage = measureMap[endMeasureIndex - 1];
    const pageEndTime = lastMeasureOfPage ? lastMeasureOfPage.endTime : pageStartTime + 2;
    const pageDuration = pageEndTime - pageStartTime;

    // 构造一个"虚拟"的 Measure 对象，欺骗渲染函数，让它们认为这是一个巨大的小节
    const activePageWindow = {
      index: currentPageIndex, // 逻辑索引改为页码
      startTime: pageStartTime,
      endTime: pageEndTime,
      duration: pageDuration,
      // 保留元数据
      realStartBar: startMeasureIndex,
      realEndBar: endMeasureIndex
    };

    // 计算页面内的进度 (0.0 - 1.0)
    const barProgress = (audioTime - activePageWindow.startTime) / activePageWindow.duration;


    // 4. Background
    drawBackground(p, backgroundColor, p5Settings);

    // --- State Update Logic ---

    // A. 翻页检测
    if (currentPageIndex !== lastPageIndex) {
      if (lastPageIndex !== -1 && currentPageIndex === lastPageIndex + 1) {
        cachedNotesPrev = [...cachedNotesCurrent];
        cachedNotesPrev.forEach(n => n.shrinkScale = 1.0);
        // 传递上一页的总时长，保证消失动画速率正确
        cachedNotesPrev.prevBarDuration = activePageWindow.duration;
        transitionStartTime = audioTime;
      } else {
        cachedNotesPrev = [];
      }
      lastPageIndex = currentPageIndex;
    }

    // B. 加载新数据
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

    // --- Render Layers ---

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