// frontend/src/store/useStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 辅助函数：识别打击乐轨道
const getDrumTrackIndices = (tracks) => {
    return tracks.map((t, i) => {
        const name = (t.name || "").toLowerCase();
        const instName = (t.instrument?.name || "").toLowerCase();
        const isDrum = name.match(/drum|perc/) || instName.match(/drum|perc/) || t.instrument?.percussion;
        return isDrum ? i : -1;
    }).filter(i => i !== -1);
};

const useStore = create(
  persist(
    (set, get) => ({
      // --- Visual Settings ---
      isZenMode: false,
      toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

      showPlayerWidget: true,
      showAnalysisWidget: true,
      togglePlayerWidget: () => set((state) => ({ showPlayerWidget: !state.showPlayerWidget })),
      toggleAnalysisWidget: () => set((state) => ({ showAnalysisWidget: !state.showAnalysisWidget })),

      backgroundColor: '#040405',
      setBackgroundColor: (color) => set({ backgroundColor: color }),

      autoTextContrast: true,
      toggleAutoTextContrast: () => set(s => ({ autoTextContrast: !s.autoTextContrast })),
      forceDarkText: false,
      toggleForceDarkText: () => set(s => ({ forceDarkText: !s.forceDarkText })),

      isGlowEnabled: true,
      toggleGlow: () => set(s => ({ isGlowEnabled: !s.isGlowEnabled })),

      // --- P5 Settings [整合版] ---
    p5Settings: {
        showCursor: true,
        shrinkSpeed: 0.08,
        showGrid: true,
        noteAreaScale: 0.8,
        noteAreaOffsetY: 0,
        horizontalZoom: 1.0,
        noteHeight: 6,
        pageTurnMode: 'wipe',
        growCurve: [0.1, 0.85, 0.75, 0.9],
        meteorHoldTime: 0.5,
        meteorFadeTime: 1.5,
        // *** 1. 新增 fadeCurve，并设置一个默认的“慢进快出”曲线 ***
        fadeCurve: [0.42, 0, 1, 1],
        curvePresets: [
            { name: 'Default Plateau', curve: [0.1, 0.85, 0.75, 0.9], isDefault: true },
            { name: 'Linear', curve: [0.0, 0.0, 1.0, 1.0], isDefault: true },
            { name: 'Elastic Bounce', curve: [0.34, 1.56, 0.64, 1], isDefault: true },
        ],
      },
      setP5Settings: (settings) => set((state) => ({
        p5Settings: { ...state.p5Settings, ...settings }
      })),
      addP5CurvePreset: (name, curve) => {
        if (!name) return;
        set((state) => {
            const newPreset = { name, curve };
            const currentPresets = state.p5Settings.curvePresets || [];
            const existingIndex = currentPresets.findIndex(p => p.name === name);
            let newPresetsArray;
            if (existingIndex > -1) {
                newPresetsArray = currentPresets.map((p, index) => index === existingIndex ? newPreset : p);
            } else {
                newPresetsArray = [...currentPresets, newPreset];
            }
            return { p5Settings: { ...state.p5Settings, curvePresets: newPresetsArray } };
        });
      },
      removeP5CurvePreset: (name) => {
        set((state) => ({
            p5Settings: { ...state.p5Settings, curvePresets: (state.p5Settings.curvePresets || []).filter(p => p.name !== name) }
        }));
      },
      applyP5CurvePreset: (name) => {
        const preset = get().p5Settings.curvePresets.find(p => p.name === name);
        if (preset) {
            set((state) => ({ p5Settings: { ...state.p5Settings, growCurve: preset.curve } }));
        }
      },


      // --- Percussion Grid Settings (整合版) ---
      percussionSettings: {
        enabled: true,
        rows: 4,
        cols: 8,
        // Three.js 参数
        cellSize: 1.5,
        spacing: 0.2,
        positionY: -15,
        positionZ: -20,
        decaySpeed: 0.08,
        // P5 专属参数
        p5CellSize: 40,
        p5Spacing: 10,
      },

      // 拦截设置，自动处理轨道可见性
      setPercussionSettings: (settings) => set((state) => {
        const newSettings = { ...state.percussionSettings, ...settings };
        const midiData = state.midiData;

        // 如果 'enabled' 状态发生改变，且有 MIDI 数据
        if (midiData && settings.enabled !== undefined && settings.enabled !== state.percussionSettings.enabled) {
            const drumIndices = getDrumTrackIndices(midiData.tracks);
            let newVisibleIndices = [...state.visibleTrackIndices];

            if (newSettings.enabled) {
                // 开启 Grid -> 隐藏主视图中的打击乐轨道
                newVisibleIndices = newVisibleIndices.filter(i => !drumIndices.includes(i));
            } else {
                // 关闭 Grid -> 恢复主视图中的打击乐轨道
                drumIndices.forEach(i => {
                    if (!newVisibleIndices.includes(i)) newVisibleIndices.push(i);
                });
                newVisibleIndices.sort((a, b) => a - b); // 保持索引顺序
            }

            return {
                percussionSettings: newSettings,
                visibleTrackIndices: newVisibleIndices
            };
        }

        return { percussionSettings: newSettings };
      }),

      // --- View Settings ---
      viewSettings: {
        zoomX: 50,
        zoomY: 1.0,
        laneHeight: 1.5,
        enableClickToSeek: true,
        followCursor: true,
        playheadOffset: 0.2,
        showPlayhead: true,
        showBarLines: true,
      },
      setViewSettings: (newSettings) => set((state) => ({
        viewSettings: { ...state.viewSettings, ...newSettings }
      })),

      renderEngine: 'three',
      setRenderEngine: (engine) => set({ renderEngine: engine }),

      analysisSensitivity: 2,
      setAnalysisSensitivity: (val) => set({ analysisSensitivity: val }),

      analysisComplexity: 'standard',
      setAnalysisComplexity: (val) => set({ analysisComplexity: val }),

      chordDetectionMode: 'tonal',
      setChordDetectionMode: (mode) => set({ chordDetectionMode: mode }),

      // --- Data State ---
      incomingMidiEvent: null,
      setIncomingMidiEvent: (event) => set({ incomingMidiEvent: event }),
      rawFile: null,
      midiData: null,
      analysisData: null,
      isAnalyzing: false,
      visibleTrackIndices: [],
      analysisTrackIndices: [],
      mutedTrackIndices: [],

      toggleTrackMute: (index) => set((state) => {
          const current = state.mutedTrackIndices;
          const next = current.includes(index) ? current.filter(i => i !== index) : [...current, index];
          return { mutedTrackIndices: next };
      }),

      // --- Playback State ---
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: -10,
      isMuted: false,
      pedalActive: false,
      setPedalActive: (val) => set({ pedalActive: val }),
      ccValues: {},
      setCcValue: (channel, cc, val) => set((state) => ({
          ccValues: { ...state.ccValues, [channel]: { ...(state.ccValues[channel] || {}), [cc]: val } }
      })),
      midiOutputs: [],
      selectedMidiOutput: null,
      useInternalAudio: true,
      setMidiOutputs: (outputs) => set({ midiOutputs: outputs }),

      autoSelectMidiDevice: (outputs) => {
          const current = get();
          if (outputs.length > 0) {
              let targetId = current.selectedMidiOutput;
              const isValid = targetId && outputs.find(o => o.id === targetId || o.name === targetId);
              if (!isValid) targetId = outputs[0].name;
              set({ midiOutputs: outputs, selectedMidiOutput: targetId, useInternalAudio: false });
              return targetId;
          } else {
              set({ midiOutputs: [] });
              return null;
          }
      },
      setSelectedMidiOutput: (id) => set({ selectedMidiOutput: id }),
      toggleInternalAudio: () => set(s => ({ useInternalAudio: !s.useInternalAudio })),
      showExportMenu: false,
      toggleExportMenu: () => set(s => ({ showExportMenu: !s.showExportMenu })),
      isRecording: false,
      setIsRecording: (val) => set({ isRecording: val }),

      // --- setMidiData: 智能轨道分析 ---
      setMidiData: (data, file) => {
        const { percussionSettings } = get();

        // 1. 智能分析：自动识别钢琴轨作为分析对象
        const pianoIndices = data.tracks.map((t, i) => ({ t, i }))
          .filter(({ t }) => {
            const name = (t.instrument?.name || t.name || "").toLowerCase();
            return name.includes('piano') || name.includes('key');
          })
          .map(({ i }) => i);

        const defaultAnalysisIndices = pianoIndices.length > 0 ? pianoIndices : data.tracks.map((_, i) => i);

        // 2. 智能可见性：根据打击乐设置自动过滤轨道
        const drumIndices = getDrumTrackIndices(data.tracks);
        let initialVisibleIndices = data.tracks.map((_, i) => i);

        if (percussionSettings.enabled) {
            initialVisibleIndices = initialVisibleIndices.filter(i => !drumIndices.includes(i));
        }

        set({
          midiData: data,
          duration: data.duration,
          rawFile: file,
          visibleTrackIndices: initialVisibleIndices,
          analysisTrackIndices: defaultAnalysisIndices,
          mutedTrackIndices: [],
          isPlaying: false,
          currentTime: 0,
          pedalActive: false,
          ccValues: {}
        });
      },

      toggleTrackVisibility: (index) => set((state) => {
        const current = state.visibleTrackIndices;
        if (current.includes(index)) {
          return { visibleTrackIndices: current.filter(i => i !== index) };
        } else {
          return { visibleTrackIndices: [...current, index] };
        }
      }),

      toggleAnalysisTrack: (index) => set((state) => {
        const current = state.analysisTrackIndices;
        const next = current.includes(index) ? current.filter(i => i !== index) : [...current, index];
        return { analysisTrackIndices: next };
      }),

      setAnalysisData: (data) => set({ analysisData: data }),
      setIsAnalyzing: (status) => set({ isAnalyzing: status }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setCurrentTime: (time) => set({ currentTime: time }),
      setVolume: (val) => set({ volume: val }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      reset: () => set({
          midiData: null,
          rawFile: null,
          analysisData: null,
          isPlaying: false,
          currentTime: 0,
          pedalActive: false,
          ccValues: {},
          mutedTrackIndices: []
      }),
    }),

    {
      name: 'midi-navigate-storage',
      storage: createJSONStorage(() => localStorage),
      // *** 3. 持久化设置更新 ***
      partialize: (state) => ({
        // 仅持久化用户偏好设置
        backgroundColor: state.backgroundColor,
        autoTextContrast: state.autoTextContrast,
        forceDarkText: state.forceDarkText,
        isGlowEnabled: state.isGlowEnabled,
        renderEngine: state.renderEngine,

        // 分析设置
        analysisSensitivity: state.analysisSensitivity,
        analysisComplexity: state.analysisComplexity,
        chordDetectionMode: state.chordDetectionMode,

        // UI 状态
        selectedMidiOutput: state.selectedMidiOutput,
        showPlayerWidget: state.showPlayerWidget,
        showAnalysisWidget: state.showAnalysisWidget,
        viewSettings: state.viewSettings,

        // 引擎专属设置
        percussionSettings: state.percussionSettings,
        p5Settings: state.p5Settings, // 现在包含了 growCurve 和 curvePresets
      }),
      version: 8, // 升级版本号，确保结构变更生效
      migrate: (persistedState, version) => {
          // 之前的版本处理
          if (version < 7) {
              return {};
          }
          // 对于版本 7，我们可以尝试保留数据，但由于 p5Settings 结构变化较小，
          // 直接返回 persistedState 通常是安全的，或者为了保险起见，重置 p5Settings
          // 这里保持原有的保守策略
          return persistedState;
      },
    }
  )
)

export default useStore;