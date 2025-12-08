import React, { useState, useEffect } from 'react';
import useStore from '@/store/useStore';
import { Eye, EyeOff, Check, Music, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { audioEngine } from '@/audio/AudioEngine';
import { getTrackColorCSS, fixEncoding } from '@/lib/utils';
import { api } from '@/lib/api';

const MixerTab = () => {
  const midiData = useStore(state => state.midiData);
  const rawFile = useStore(state => state.rawFile);
  const analysisData = useStore(state => state.analysisData);
  const setAnalysisData = useStore(state => state.setAnalysisData);
  const visibleTrackIndices = useStore(state => state.visibleTrackIndices);
  const analysisTrackIndices = useStore(state => state.analysisTrackIndices);
  const toggleTrackVisibility = useStore(state => state.toggleTrackVisibility);
  const toggleAnalysisTrack = useStore(state => state.toggleAnalysisTrack);
  const mutedTrackIndices = useStore(state => state.mutedTrackIndices);
  const toggleTrackMute = useStore(state => state.toggleTrackMute);
  const analysisSensitivity = useStore(state => state.analysisSensitivity);
  const analysisComplexity = useStore(state => state.analysisComplexity);

  const [previewTrackIndex, setPreviewTrackIndex] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 当静音状态改变时同步音频引擎
  useEffect(() => {
    audioEngine.updateTrackMuteState(mutedTrackIndices);
  }, [mutedTrackIndices]);

  // 组件卸载时停止预览
  useEffect(() => {
    return () => {
      if (previewTrackIndex !== null) {
        audioEngine.unmuteAll();
      }
    };
  }, [previewTrackIndex]);

  const togglePreview = (e, index) => {
    e.stopPropagation();
    if (previewTrackIndex === index) {
      audioEngine.unmuteAll();
      setPreviewTrackIndex(null);
    } else {
      audioEngine.soloTrack(index);
      setPreviewTrackIndex(index);
      useStore.getState().setIsPlaying(true);
      audioEngine.play();
    }
  };

  const handleReAnalyze = async () => {
    if (!rawFile) return;
    setIsAnalyzing(true);
    try {
      audioEngine.unmuteAll();
      setPreviewTrackIndex(null);
      const data = await api.analyzeMidi(rawFile, analysisTrackIndices, analysisComplexity, analysisSensitivity);
      const currentData = useStore.getState().analysisData;
      const newData = currentData ? { ...currentData, music_theory: data.music_theory } : data;
      setAnalysisData(newData);
    } catch (e) {
      console.error("Analysis Failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const rowHover = 'hover:bg-white/5';

  return (
    <>
      <div className="grid grid-cols-[30px_30px_30px_1fr_50px_30px] gap-2 px-4 py-2 bg-white/5 text-[10px] uppercase tracking-wider text-white/30 font-mono text-center">
        <div>Vis</div><div>Src</div><div>Mute</div><div className="text-left pl-2">Track Name</div><div className="text-right pr-2">Notes</div><div>Solo</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {midiData.tracks.map((track, index) => {
          const isVisible = visibleTrackIndices.includes(index);
          const isSource = analysisTrackIndices.includes(index);
          const isMuted = mutedTrackIndices.includes(index);
          const trackColor = getTrackColorCSS(index) || 'white';
          const cleanName = fixEncoding(track.name);
          const cleanInst = fixEncoding(track.instrument.name);
          return (
            <div key={index} className={`grid grid-cols-[30px_30px_30px_1fr_50px_30px] gap-2 items-center p-3 rounded-lg border border-transparent transition-all ${rowHover}`} style={{ backgroundColor: isSource ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
              <div className="flex justify-center"><button onClick={() => toggleTrackVisibility(index)} className="transition-all hover:scale-110" style={{ color: isVisible ? trackColor : 'rgba(255,255,255,0.2)' }}>{isVisible ? <Eye size={16} /> : <EyeOff size={16} />}</button></div>
              <div className="flex justify-center"><button onClick={() => toggleAnalysisTrack(index)} className="w-4 h-4 rounded border flex items-center justify-center transition-all" style={{ borderColor: isSource ? trackColor : 'rgba(255,255,255,0.2)', backgroundColor: isSource ? trackColor : 'transparent' }}>{isSource && <Check size={12} className="text-black" />}</button></div>
              <div className="flex justify-center"><button onClick={() => toggleTrackMute(index)} className={`transition-all hover:scale-110 ${isMuted ? 'text-red-500' : 'opacity-20 hover:opacity-100'}`}>{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button></div>
              <div className="overflow-hidden pl-2 flex flex-col justify-center text-left"><div className="text-xs font-mono truncate font-bold" style={{ color: trackColor }} title={cleanName || `Track ${index + 1}`}>{cleanName || `Track ${index + 1}`}</div><div className="text-[10px] opacity-40 truncate" title={cleanInst || "Instrument"}>{cleanInst || "Instrument"}</div></div>
              <div className="text-right pr-2 text-[10px] font-mono opacity-50">{track.notes.length}</div>
              <div className="flex justify-center"><button onClick={(e) => togglePreview(e, index)} className={`p-1.5 rounded-full transition-colors ${previewTrackIndex === index ? 'bg-midi-accent text-white animate-pulse' : 'opacity-20 hover:opacity-100 bg-white'}`}><Music size={14} /></button></div>
            </div>
          )
        })}
      </div>
      <div className="p-4 border-t border-white/10 bg-black/20">
        <button onClick={handleReAnalyze} disabled={isAnalyzing} className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-midi-accent flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isAnalyzing ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : "Apply Analysis Changes"}</button>
      </div>
    </>
  );
};

export default MixerTab;
