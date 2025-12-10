// frontend/src/components/UI/SettingTabs/InterfaceTab.jsx
import React, { useRef } from 'react';
import useStore from '@/store/useStore';
import {
  Layout, Sliders, Palette, Sun, Moon, Zap, Gauge, List, Cable,
  Volume2, VolumeX, Monitor, Box, MoveHorizontal, MoveVertical,
  MousePointer2, Video, ArrowRightLeft, ScanLine, GripVertical,
  Server, Cpu, Download, Upload, Wind, Maximize, ArrowUpDown,
  Scaling, AlignJustify, ArrowRight, Grid3X3, BrainCircuit, Star, Timer, Hourglass
} from 'lucide-react';
import { audioEngine } from '@/audio/AudioEngine';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import BezierCurveEditor from '../Common/BezierCurveEditor.jsx';

const InterfaceTab = () => {
  // --- Store Access ---
  const setViewSettings = useStore(state => state.setViewSettings);
  const renderEngine = useStore(state => state.renderEngine);
  const setRenderEngine = useStore(state => state.setRenderEngine);
  const p5Settings = useStore(state => state.p5Settings);
  const setP5Settings = useStore(state => state.setP5Settings);
  const addP5CurvePreset = useStore(state => state.addP5CurvePreset);
  const removeP5CurvePreset = useStore(state => state.removeP5CurvePreset);
  const applyP5CurvePreset = useStore(state => state.applyP5CurvePreset);
  const backgroundColor = useStore(state => state.backgroundColor);
  const setBackgroundColor = useStore(state => state.setBackgroundColor);
  const midiOutputs = useStore(state => state.midiOutputs);
  const selectedMidiOutput = useStore(state => state.selectedMidiOutput);
  const setSelectedMidiOutput = useStore(state => state.setSelectedMidiOutput);
  const useInternalAudio = useStore(state => state.useInternalAudio);
  const toggleInternalAudio = useStore(state => state.toggleInternalAudio);
  const chordDetectionMode = useStore(state => state.chordDetectionMode);
  const setChordDetectionMode = useStore(state => state.setChordDetectionMode);
  const analysisSensitivity = useStore(state => state.analysisSensitivity);
  const setAnalysisSensitivity = useStore(state => state.setAnalysisSensitivity);
  const analysisComplexity = useStore(state => state.analysisComplexity);
  const setAnalysisComplexity = useStore(state => state.setAnalysisComplexity);
  const isGlowEnabled = useStore(state => state.isGlowEnabled);
  const toggleGlow = useStore(state => state.toggleGlow);
  const autoTextContrast = useStore(state => state.autoTextContrast);
  const toggleAutoTextContrast = useStore(state => state.toggleAutoTextContrast);
  const forceDarkText = useStore(state => state.forceDarkText);
  const toggleForceDarkText = useStore(state => state.toggleForceDarkText);
  const showPlayerWidget = useStore(state => state.showPlayerWidget);
  const togglePlayerWidget = useStore(state => state.togglePlayerWidget);
  const showAnalysisWidget = useStore(state => state.showAnalysisWidget);
  const toggleAnalysisWidget = useStore(state => state.toggleAnalysisWidget);
  const viewSettings = useStore(state => state.viewSettings);

  const fileInputRef = useRef(null);

  // Color Palette
  const colors = ['#040405', '#1a1a1a', '#2d1b2e', '#0f172a', '#f5f5f4', '#e2e8f0', '#E0F2FE', '#FAE8FF', '#FEF9C3', '#DCFCE7'];

  // --- Default Fallback with Safe Guards ---
  const currentP5Settings = p5Settings || {
    showCursor: true,
    showGrid: true,
    shrinkSpeed: 0.08,
    noteAreaScale: 0.8,
    noteAreaOffsetY: 0,
    horizontalZoom: 1.0,
    noteHeight: 6,
    pageTurnMode: 'wipe',
    growCurve: [0.1, 0.85, 0.75, 0.9],
    fadeCurve: [0.42, 0, 1, 1],
    curvePresets: [],
    meteorHoldTime: 0.5,
    meteorFadeTime: 1.5,
  };

  // --- Handlers ---
  const handleMidiOutputChange = (e) => {
    const val = e.target.value;
    setSelectedMidiOutput(val);
    audioEngine.selectMidiOutput(val);
  };

  const handleExportConfig = () => {
    const state = useStore.getState();
    const config = {
      version: 8,
      timestamp: new Date().toISOString(),
      settings: {
        backgroundColor: state.backgroundColor,
        autoTextContrast: state.autoTextContrast,
        forceDarkText: state.forceDarkText,
        isGlowEnabled: state.isGlowEnabled,
        renderEngine: state.renderEngine,
        p5Settings: state.p5Settings,
        analysisSensitivity: state.analysisSensitivity,
        analysisComplexity: state.analysisComplexity,
        chordDetectionMode: state.chordDetectionMode,
        showPlayerWidget: state.showPlayerWidget,
        showAnalysisWidget: state.showAnalysisWidget,
        viewSettings: state.viewSettings,
        percussionSettings: state.percussionSettings,
      }
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midi-navigate-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.settings) {
          useStore.setState(data.settings);
          alert("Configuration imported successfully!");
        } else {
          alert("Invalid configuration file.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse configuration file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- UI Helpers ---
  const toggleBgOn = 'bg-midi-accent';
  const toggleBgOff = 'bg-white/10';
  const toggleDot = 'bg-white shadow-sm';
  const toggleClassOn = 'left-[18px]';
  const toggleClassOff = 'left-0.5';

  return (
    <div className="flex-1 p-6 space-y-8 overflow-y-auto">

      {/* 1. Render Engine Selection */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Render Engine</h3>
        <div className="flex gap-2 p-1 bg-black/20 rounded-lg">
          <button onClick={() => setRenderEngine('three')} className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${renderEngine === 'three' ? 'bg-midi-accent text-black shadow' : 'text-white/50 hover:text-white'}`}><Box size={14} /> Three.js (Neon)</button>
          <button onClick={() => setRenderEngine('p5')} className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${renderEngine === 'p5' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'}`}><Monitor size={14} /> p5.js (Flow)</button>
        </div>
      </div>

      {/* 2. Viewport & Playback (THREE.JS ONLY) */}
      {renderEngine === 'three' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
          <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Viewport (Three.js)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><MoveHorizontal size={12} /> Time Scale</span> <span className="font-mono">{viewSettings.zoomX}x</span></div>
              <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.zoomX]} min={10} max={200} step={5} onValueChange={(v) => setViewSettings({ zoomX: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><MoveVertical size={12} /> Vertical Zoom</span> <span className="font-mono">{viewSettings.zoomY}x</span></div>
              <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.zoomY]} min={0.5} max={3.0} step={0.1} onValueChange={(v) => setViewSettings({ zoomY: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><ArrowRightLeft size={12} /> Playhead Position</span> <span className="font-mono">{Math.round((viewSettings.playheadOffset || 0.2) * 100)}%</span></div>
            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.playheadOffset || 0.2]} min={0.1} max={0.9} step={0.05} onValueChange={(v) => setViewSettings({ playheadOffset: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
          </div>
          <div className="flex flex-col gap-2 bg-white/5 p-2 rounded-lg">
            {[{ l: 'Follow Playhead', k: 'followCursor', i: Video }, { l: 'Show Playhead', k: 'showPlayhead', i: ScanLine }, { l: 'Show Bar Lines', k: 'showBarLines', i: GripVertical }, { l: 'Click to Seek', k: 'enableClickToSeek', i: MousePointer2 }].map(opt => (
              <div key={opt.k} className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors cursor-pointer" onClick={() => setViewSettings({ [opt.k]: !viewSettings[opt.k] })}>
                <div className="flex items-center gap-2 opacity-80"><opt.i size={14} /><span className="text-xs font-bold">{opt.l}</span></div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${viewSettings[opt.k] !== false ? toggleBgOn : toggleBgOff}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all ${toggleDot} ${viewSettings[opt.k] !== false ? toggleClassOn : toggleClassOff}`} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. P5 Settings (P5.JS ONLY) */}
      {renderEngine === 'p5' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Visualization (p5.js)</h3>

          <div className="space-y-4 bg-white/5 p-3 rounded-lg">

            {/* MODIFIED: Final Page Turn Mode Control */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="flex items-center gap-1 opacity-80"><ArrowRight size={14} /> Page Turn Mode</span>
                </div>
                <div className="flex bg-black/20 rounded p-1 text-[10px] font-bold">
                    <button onClick={() => setP5Settings({ pageTurnMode: 'wipe' })} className={`flex-1 px-3 py-1.5 rounded transition-all flex items-center justify-center gap-1 ${currentP5Settings.pageTurnMode === 'wipe' ? 'bg-midi-accent text-black shadow' : 'text-white/40 hover:text-white'}`}><ScanLine size={12} /> Wipe</button>
                    <button onClick={() => setP5Settings({ pageTurnMode: 'fade' })} className={`flex-1 px-3 py-1.5 rounded transition-all flex items-center justify-center gap-1 ${currentP5Settings.pageTurnMode === 'fade' ? 'bg-white text-black shadow' : 'text-white/40 hover:text-white'}`}><Wind size={12} /> Fade</button>
                    <button onClick={() => setP5Settings({ pageTurnMode: 'meteor' })} className={`flex-1 px-3 py-1.5 rounded transition-all flex items-center justify-center gap-1 ${(currentP5Settings.pageTurnMode === 'meteor' || currentP5Settings.pageTurnMode === 'fade-stagger' /* Legacy support */) ? 'bg-white text-black shadow' : 'text-white/40 hover:text-white'}`}><Star size={12} /> Meteor</button>
                </div>
            </div>


             {/* Note Growth Curve Editor with Presets */}
             <div className="pt-2 border-t border-white/5 mt-3 space-y-2">
                <div className="flex justify-between text-[10px] font-bold mb-2">
                    <span className="flex items-center gap-1 opacity-80"><BrainCircuit size={14} /> Note Growth Curve</span>
                </div>
                <BezierCurveEditor
                  value={currentP5Settings.growCurve || [0.1, 0.85, 0.75, 0.9]}
                  onChange={(newCurve) => setP5Settings({ growCurve: newCurve })}
                  presets={currentP5Settings.curvePresets || []}
                  onAddPreset={addP5CurvePreset}
                  onRemovePreset={removeP5CurvePreset}
                  onApplyPreset={applyP5CurvePreset}
                />
             </div>

             {/* MODIFIED: Conditional Settings for Meteor Mode */}
             {currentP5Settings.pageTurnMode === 'meteor' && (
                 <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200 border-t border-white/10 pt-4 mt-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><Hourglass size={12} /> Meteor Hold Time</span> <span className="font-mono">{(currentP5Settings.meteorHoldTime || 0.5).toFixed(2)}s</span></div>
                        <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.meteorHoldTime || 0.5]} min={0.0} max={2.0} step={0.1} onValueChange={(v) => setP5Settings({ meteorHoldTime: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><Timer size={12} /> Meteor Fade Time</span> <span className="font-mono">{(currentP5Settings.meteorFadeTime || 1.5).toFixed(2)}s</span></div>
                        <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.meteorFadeTime || 1.5]} min={0.1} max={5.0} step={0.1} onValueChange={(v) => setP5Settings({ meteorFadeTime: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                    </div>
                    <div className="pt-2 space-y-2">
                        <div className="flex justify-between text-[10px] font-bold mb-2">
                            <span className="flex items-center gap-1 opacity-80"><Star size={14} /> Meteor Fade Curve</span>
                        </div>
                        <BezierCurveEditor
                            value={currentP5Settings.fadeCurve || [0.42, 0, 1, 1]}
                            onChange={(newCurve) => setP5Settings({ fadeCurve: newCurve })}
                        />
                    </div>
                 </div>
             )}

             {/* Layout Controls */}
             <div className="pt-2 border-t border-white/5 mt-2 space-y-3">
                <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><Maximize size={12} /> Vertical Scale</span> <span className="font-mono">{Math.round((currentP5Settings.noteAreaScale || 0.8) * 100)}%</span></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.noteAreaScale || 0.8]} min={0.3} max={1.0} step={0.05} onValueChange={(v) => setP5Settings({ noteAreaScale: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>

                <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><ArrowUpDown size={12} /> Vertical Offset</span> <span className="font-mono">{currentP5Settings.noteAreaOffsetY || 0}px</span></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.noteAreaOffsetY || 0]} min={-300} max={300} step={10} onValueChange={(v) => setP5Settings({ noteAreaOffsetY: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>

                <div className="flex justify-between text-[10px] font-bold mt-4"><span className="flex items-center gap-1 opacity-60"><Scaling size={12} /> Horizontal Scale</span> <span className="font-mono">{Math.round((currentP5Settings.horizontalZoom || 1.0) * 100)}%</span></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.horizontalZoom || 1.0]} min={0.1} max={3.0} step={0.1} onValueChange={(v) => setP5Settings({ horizontalZoom: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>

                <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><AlignJustify size={12} /> Note Thickness</span> <span className="font-mono">{currentP5Settings.noteHeight || 6}px</span></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.noteHeight || 6]} min={2} max={20} step={1} onValueChange={(v) => setP5Settings({ noteHeight: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
             </div>

             {/* Toggles */}
             <div className="flex flex-col gap-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 opacity-80"><ScanLine size={14} /><span className="text-xs font-bold">Show Playhead</span></div>
                   <Switch.Root className={`w-8 h-4 rounded-full relative transition-colors ${currentP5Settings.showCursor !== false ? toggleBgOn : toggleBgOff}`} checked={currentP5Settings.showCursor !== false} onCheckedChange={(c) => setP5Settings({ showCursor: c })}><Switch.Thumb className={`block w-3 h-3 bg-white rounded-full shadow transition-transform translate-x-0.5 ${currentP5Settings.showCursor !== false ? 'translate-x-[18px]' : ''}`} /></Switch.Root>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 opacity-80"><Grid3X3 size={14} /><span className="text-xs font-bold">Show Background Grid</span></div>
                   <Switch.Root className={`w-8 h-4 rounded-full relative transition-colors ${currentP5Settings.showGrid !== false ? toggleBgOn : toggleBgOff}`} checked={currentP5Settings.showGrid !== false} onCheckedChange={(c) => setP5Settings({ showGrid: c })}><Switch.Thumb className={`block w-3 h-3 bg-white rounded-full shadow transition-transform translate-x-0.5 ${currentP5Settings.showGrid !== false ? 'translate-x-[18px]' : ''}`} /></Switch.Root>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* 4. Canvas Colors */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Canvas Appearance</h3>
        <div className="flex gap-3 flex-wrap">
          {colors.map(c => (<button key={c} onClick={() => setBackgroundColor(c)} className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${backgroundColor === c ? 'border-midi-accent scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}
          <div className="relative group overflow-hidden w-10 h-10 rounded-full border border-white/20 opacity-50 hover:opacity-100 cursor-pointer flex items-center justify-center transition-all"><Palette size={16} /><input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} /></div>
        </div>
      </div>

      {/* 5. Audio IO */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Audio & MIDI I/O</h3>
        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-bold"><div className="flex items-center gap-2"><Cable size={16} /> MIDI Output</div><span className="font-mono opacity-50 text-[10px]">{midiOutputs.length > 0 ? 'Active' : 'No Devices'}</span></div>
            <select value={selectedMidiOutput || 'none'} onChange={handleMidiOutputChange} className="w-full bg-black/20 border border-white/10 rounded p-2 text-sm focus:outline-none focus:border-midi-accent"><option value="none">-- Use Browser Audio Only --</option>{midiOutputs.map(out => (<option key={out.name} value={out.name}>{out.name}</option>))}</select>
          </div>
          <div className="flex items-center justify-between p-2 rounded border border-white/5 bg-white/5">
            <div className="flex items-center gap-2 text-sm opacity-80">{useInternalAudio ? <Volume2 size={14} /> : <VolumeX size={14} />}<span>Browser Internal Synth</span></div>
            <div onClick={toggleInternalAudio} className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${useInternalAudio ? toggleBgOn : toggleBgOff}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all bg-white ${useInternalAudio ? toggleClassOn : toggleClassOff}`} /></div>
          </div>
        </div>
      </div>

      {/* 6. Analysis Engine */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Analysis Engine</h3>
        <div className="flex flex-col gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold flex items-center gap-2">
                {chordDetectionMode === 'server' ? <Server size={14} className="text-green-400" /> : <Cpu size={14} className="text-blue-400" />}
                Deep Analysis Mode
              </span>
              <span className="text-[10px] text-white/40 mt-0.5">
                {chordDetectionMode === 'server' ? "Server (Musicpy): Complex chords, inversions, omits." : "Local (Tonal.js): Fast basic detection, zero-latency."}
              </span>
            </div>
            <Switch.Root className={`w-10 h-6 rounded-full relative transition-colors duration-300 cursor-pointer ${chordDetectionMode === 'server' ? 'bg-green-500/20 border border-green-500/50' : 'bg-white/10 border border-white/10'}`} checked={chordDetectionMode === 'server'} onCheckedChange={(checked) => setChordDetectionMode(checked ? 'server' : 'local')}>
              <Switch.Thumb className={`block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 translate-x-1 will-change-transform ${chordDetectionMode === 'server' ? 'translate-x-5' : 'translate-x-1'}`} />
            </Switch.Root>
          </div>
        </div>
        <div className="space-y-2 pt-2 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex justify-between text-sm"><div className="flex items-center gap-2 font-bold"><Gauge size={16} /> Sensitivity</div><span className="font-mono opacity-50">{analysisSensitivity === 1 ? "High (2s)" : (analysisSensitivity === 3 ? "Low (10s)" : "Med (5s)")}</span></div>
          <div className="flex gap-1">{[1, 2, 3].map(v => (<button key={v} onClick={() => setAnalysisSensitivity(v)} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-all ${analysisSensitivity === v ? 'bg-midi-accent text-black border-midi-accent' : 'border-white/10 hover:border-white/30'}`}>{v === 1 ? "High" : (v === 2 ? "Med" : "Low")}</button>))}</div>
        </div>
        <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex justify-between text-sm"><div className="flex items-center gap-2 font-bold"><List size={16} /> Scale Library</div><span className="font-mono opacity-50 capitalize">{analysisComplexity}</span></div>
          <div className="flex gap-1">{['basic', 'standard', 'all'].map(v => (<button key={v} onClick={() => setAnalysisComplexity(v)} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-all ${analysisComplexity === v ? 'bg-midi-accent text-black border-midi-accent' : 'border-white/10 hover:border-white/30'}`}>{v}</button>))}</div>
          <p className="text-[10px] opacity-40 text-right mt-1">Tip: Click 'Apply Analysis Changes' in Mixer tab to take effect.</p>
        </div>
      </div>

      {/* 7. Visuals */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Visuals</h3>
        <div className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 transition-all cursor-pointer" onClick={toggleGlow}><div className="flex items-center gap-3"><Zap size={18} className="opacity-50" /><span className="text-sm font-bold">Note Glow</span></div><div className={`w-8 h-4 rounded-full relative transition-colors ${isGlowEnabled ? toggleBgOn : toggleBgOff}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all ${toggleDot} ${isGlowEnabled ? toggleClassOn : toggleClassOff}`} /></div></div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 transition-all"><div className="flex items-center gap-3"><Sun size={18} className="opacity-50" /><span className="text-sm font-bold">UI Text Color</span></div><div className="flex items-center gap-2"><button onClick={toggleAutoTextContrast} className={`px-3 py-1 rounded text-xs font-bold border transition-all ${autoTextContrast ? 'bg-midi-accent text-black border-midi-accent' : 'border-white/20 text-white/50 hover:text-white'}`}>Auto</button>{!autoTextContrast && (<div className="flex bg-white/10 rounded p-0.5 border border-white/5"><button onClick={() => forceDarkText && toggleForceDarkText()} className={`p-1.5 rounded transition-all ${!forceDarkText ? 'bg-white/20 text-white shadow' : 'text-white/30 hover:text-white'}`}><Moon size={14} /></button><button onClick={() => !forceDarkText && toggleForceDarkText()} className={`p-1.5 rounded transition-all ${forceDarkText ? 'bg-white text-black shadow' : 'text-white/30 hover:text-white'}`}><Sun size={14} /></button></div>)}</div></div>
      </div>

      {/* 8. Widgets */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">Widgets</h3>
        {[{ label: 'Timeline & Controls', state: showPlayerWidget, toggle: togglePlayerWidget, icon: Layout }, { label: 'Analysis HUD', state: showAnalysisWidget, toggle: toggleAnalysisWidget, icon: Sliders }].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 transition-all cursor-pointer" onClick={item.toggle}><div className="flex items-center gap-3"><item.icon size={18} className="opacity-50" /><span className="text-sm font-bold">{item.label}</span></div><div className={`w-8 h-4 rounded-full relative transition-colors ${item.state ? toggleBgOn : toggleBgOff}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all ${toggleDot} ${item.state ? toggleClassOn : toggleClassOff}`} /></div></div>
        ))}
      </div>

      {/* 9. System Config */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">System</h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={handleExportConfig} className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all group">
            <Download size={18} className="opacity-50 group-hover:opacity-100 mb-1" />
            <span>Export Config</span>
          </button>
          <button onClick={() => fileInputRef.current.click()} className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all group">
            <Upload size={18} className="opacity-50 group-hover:opacity-100 mb-1" />
            <span>Import Config</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImportConfig} accept=".json" className="hidden" />
        </div>
      </div>
    </div>
  );
};

export default InterfaceTab;
