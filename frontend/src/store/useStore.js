import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

      // --- Track Color Settings ---
      trackColors: {},
      useDefaultTrackColors: true,
      setTrackColor: (trackIndex, color) => set((state) => ({
        trackColors: { ...state.trackColors, [trackIndex]: color }
      })),
      resetTrackColors: () => set({ trackColors: {}, useDefaultTrackColors: true }),
      setUseDefaultTrackColors: (value) => set({ useDefaultTrackColors: value }),

      // --- P5 Settings ---
      p5Settings: {
        showCursor: true,
        shrinkSpeed: 0.08,
        showGrid: true,
        noteAreaScale: 0.8,
        noteAreaOffsetY: 0,
        horizontalZoom: 1.0,
        noteHeight: 6,
        pageTurnMode: 'wipe',
        measuresPerPage: 1,

        growCurve: [0.1, 0.85, 0.75, 0.9],
        meteorHoldTime: 0.5,
        meteorFadeTime: 1.5,
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


      // --- Percussion Grid Settings---
      percussionSettings: {
        enabled: true,
        rows: 4,
        cols: 8,
        cellSize: 1.5,
        spacing: 0.2,
        positionY: -15,
        positionZ: -20,
        decaySpeed: 0.08,
        p5CellSize: 40,
        p5Spacing: 10,
      },

      setPercussionSettings: (settings) => set((state) => {
        const newSettings = { ...state.percussionSettings, ...settings };
        const midiData = state.midiData;

        if (midiData && settings.enabled !== undefined && settings.enabled !== state.percussionSettings.enabled) {
          const drumIndices = getDrumTrackIndices(midiData.tracks);
          let newVisibleIndices = [...state.visibleTrackIndices];

          if (newSettings.enabled) {
            newVisibleIndices = newVisibleIndices.filter(i => !drumIndices.includes(i));
          } else {
            drumIndices.forEach(i => {
              if (!newVisibleIndices.includes(i)) newVisibleIndices.push(i);
            });
            newVisibleIndices.sort((a, b) => a - b);
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

      setMidiData: (data, file) => {
        const { percussionSettings } = get();

        const pianoIndices = data.tracks.map((t, i) => ({ t, i }))
          .filter(({ t }) => {
            const name = (t.instrument?.name || t.name || "").toLowerCase();
            return name.includes('piano') || name.includes('key');
          })
          .map(({ i }) => i);

        const defaultAnalysisIndices = pianoIndices.length > 0 ? pianoIndices : data.tracks.map((_, i) => i);

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
      partialize: (state) => ({
        backgroundColor: state.backgroundColor,
        autoTextContrast: state.autoTextContrast,
        forceDarkText: state.forceDarkText,
        isGlowEnabled: state.isGlowEnabled,
        renderEngine: state.renderEngine,
        analysisSensitivity: state.analysisSensitivity,
        analysisComplexity: state.analysisComplexity,
        chordDetectionMode: state.chordDetectionMode,
        selectedMidiOutput: state.selectedMidiOutput,
        showPlayerWidget: state.showPlayerWidget,
        showAnalysisWidget: state.showAnalysisWidget,
        viewSettings: state.viewSettings,
        percussionSettings: state.percussionSettings,
        p5Settings: state.p5Settings,
        trackColors: state.trackColors,
        useDefaultTrackColors: state.useDefaultTrackColors,
      }),
      version: 10,
      migrate: (persistedState, version) => {
        if (version < 10) {
          return {};
        }
        return persistedState;
      },
    }
  )
)

export default useStore;