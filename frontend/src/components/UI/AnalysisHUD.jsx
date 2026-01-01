// frontend/src/components/UI/AnalysisHUD.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import useStore from '@/store/useStore';
import { Zap, Waves, Loader2, ChevronDown, ChevronUp, Activity, Server, Cpu } from 'lucide-react';
import { getActiveNoteDetails, areNotesEqual, detectLocalChord } from '@/lib/theory';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
const useFps = () => {
  const [fps, setFps] = useState(60);
  useEffect(() => {
    let frameCount = 0;
    let startTime = performance.now();
    let rafId;
    const tick = () => {
      frameCount++;
      const now = performance.now();
      if (now - startTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        startTime = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return fps;
};

// --- Enharmonic Utils ---
const SHARP_KEYS = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];

const resolveEnharmonicName = (name, globalKey) => {
    if (!name || !globalKey || name === '---') return name;
    const globalRoot = globalKey.split(' ')[0];
    const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    const sharpToFlat = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
    const isSharpContext = SHARP_KEYS.includes(globalRoot) || globalKey.includes('#');
    const isFlatContext = FLAT_KEYS.includes(globalRoot) || globalKey.includes('b');
    const parts = name.split(' ');
    const root = parts[0];
    const suffix = parts.slice(1).join(' ');
    if (isSharpContext && flatToSharp[root]) return `${flatToSharp[root]} ${suffix}`;
    if (isFlatContext && sharpToFlat[root]) return `${sharpToFlat[root]} ${suffix}`;
    return name;
};

// --- Smoothing & Timeline Components ---
const smoothTimelineData = (rawTimeline, totalDuration, minDuration = 3.0) => {
    if (!rawTimeline || rawTimeline.length === 0) return [];
    let segments = rawTimeline.map((entry, i) => {
        const nextTime = rawTimeline[i + 1] ? rawTimeline[i + 1].time : totalDuration;
        return { name: entry.main.name, conf: entry.main.conf, startTime: entry.time, duration: nextTime - entry.time };
    });
    let merged = [];
    segments.forEach(seg => {
        const last = merged[merged.length - 1];
        if (last && last.name === seg.name) {
            last.duration += seg.duration;
            last.conf = Math.max(last.conf, seg.conf);
        } else {
            merged.push({ ...seg });
        }
    });
    // Simple Denoise
    for(let pass=0; pass<2; pass++) {
        const cleaned = [];
        for(let i=0; i<merged.length; i++) {
            const curr = merged[i];
            const prev = cleaned[cleaned.length-1];
            if (curr.duration < minDuration && prev) { prev.duration += curr.duration; }
            else if (prev && prev.name === curr.name) { prev.duration += curr.duration; }
            else { cleaned.push(curr); }
        }
        merged = cleaned;
    }
    return merged;
};

const getKeyColor = (keyName) => {
    if (!keyName || keyName === '---') return 'transparent';
    const parts = keyName.split(' ');
    const root = parts[0];
    const mode = parts[1]?.toLowerCase() || 'major';
    const circlePos = { 'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'Gb': 6, 'C#': 7, 'Db': 7, 'Ab': 8, 'G#': 8, 'Eb': 9, 'D#': 9, 'Bb': 10, 'A#': 10, 'F': 11 };
    let pos = circlePos[root] !== undefined ? circlePos[root] : 0;
    if (mode.includes('minor')) pos = (pos + 3) % 12;
    const hue = (pos / 12) * 360;
    const sat = mode.includes('major') ? '80%' : '50%';
    const light = mode.includes('major') ? '60%' : '40%';
    return `hsl(${hue}, ${sat}, ${light})`;
};

const KeyTimeline = ({ timeline, duration, currentTime, globalKey }) => {
    const smoothedData = useMemo(() => smoothTimelineData(timeline, duration, 2.0), [timeline, duration]);
    if (!smoothedData || smoothedData.length === 0) return null;
    return (
        <div className="w-full h-4 bg-black/20 rounded-full overflow-hidden relative mt-2 flex">
            {smoothedData.map((seg, i) => {
                const widthPct = (seg.duration / duration) * 100;
                const displayName = resolveEnharmonicName(seg.name, globalKey);
                return (
                    <div key={i} className="h-full transition-all hover:brightness-110 relative group" style={{ width: `${widthPct}%`, backgroundColor: getKeyColor(seg.name), opacity: 0.5 + (seg.conf * 0.5) }}>
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black/80 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50">{displayName} ({seg.duration.toFixed(1)}s)</div>
                    </div>
                );
            })}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_5px_white] z-10 pointer-events-none" style={{ left: `${(currentTime / duration) * 100}%` }} />
        </div>
    );
};

// --- MAIN COMPONENT ---
const AnalysisHUD = ({ isLight }) => {
  const { t } = useTranslation(); // 2. 初始化 Hook
  const {
    analysisData,
    midiData,
    isAnalyzing,
    currentTime,
    analysisTrackIndices,
    visibleTrackIndices,
    chordDetectionMode
  } = useStore();

  const [chordData, setChordData] = useState({ name: "---", confidence: 0, source: 'local', aliases: [] });
  const [activeNoteNames, setActiveNoteNames] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isServerPending, setIsServerPending] = useState(false);

  // Refs for change detection
  const prevNotesRef = useRef([]);
  const debounceTimerRef = useRef(null);

  const fps = useFps();

  // --- 1. Dynamic Key Logic ---
  const keyInfo = useMemo(() => {
    const globalKey = analysisData?.music_theory?.key || "---";
    const defaultResult = { name: globalKey, conf: 90, alts: [] };
    const timeline = analysisData?.music_theory?.key_timeline;
    if (!timeline || !midiData) return defaultResult;
    let currentEntry = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
        if (currentTime >= timeline[i].time) { currentEntry = timeline[i]; break; }
    }
    if (!currentEntry) return defaultResult;
    const resolvedName = resolveEnharmonicName(currentEntry.main.name, globalKey);
    const resolvedAlts = (currentEntry.alts || []).map(a => ({ ...a, name: resolveEnharmonicName(a.name, globalKey) }));
    return { name: resolvedName, conf: Math.round(currentEntry.main.conf * 100), alts: resolvedAlts };
  }, [analysisData, currentTime, midiData]);
  const showAlt = keyInfo.alts.length > 0 && (keyInfo.conf < 85 || (keyInfo.conf - (keyInfo.alts[0]?.conf * 100 || 0)) < 20);

  // --- 2. Hybrid Chord Detection Logic ---
  useEffect(() => {
    if (!midiData) return;
    const targetIndices = analysisTrackIndices.length > 0 ? analysisTrackIndices : visibleTrackIndices;

    const currentNotes = getActiveNoteDetails(midiData, currentTime, targetIndices, 0);

    if (!areNotesEqual(prevNotesRef.current, currentNotes)) {
        prevNotesRef.current = currentNotes;
        const noteNames = [...new Set(currentNotes.map(n => n.name.replace(/\d+/, '')))].sort();
        setActiveNoteNames(noteNames);

        const midiNumbers = currentNotes.map(n => n.midi);

        if (currentNotes.length < 2) {
             setChordData({ name: "---", confidence: 0, source: 'none', aliases: [] });
             return;
        }

        const localResult = detectLocalChord(midiNumbers);
        setChordData({ ...localResult, source: 'local', aliases: [] });

        if (chordDetectionMode === 'tonal' || chordDetectionMode === 'server') {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

            setIsServerPending(true);
            debounceTimerRef.current = setTimeout(async () => {
                try {
                    const apiPayload = currentNotes
                        .filter(n => typeof n.midi === 'number')
                        .map(n => ({
                            pitch: Math.round(n.midi),
                            velocity: Math.round((n.velocity || 0.5) * 127)
                        }));

                    if (apiPayload.length > 0) {
                        const serverRes = await api.analyzeChord(apiPayload);
                        if (areNotesEqual(prevNotesRef.current, currentNotes)) {
                            setChordData({
                                name: serverRes.chord.name,
                                confidence: serverRes.chord.confidence,
                                source: 'server',
                                quality: serverRes.chord.quality,
                                aliases: serverRes.chord.aliases || []
                            });
                        }
                    }
                } catch (e) {
                    console.error("Server analysis failed, keeping local", e);
                } finally {
                    setIsServerPending(false);
                }
            }, 100);
        }
    }
  }, [currentTime, midiData, analysisTrackIndices, visibleTrackIndices, chordDetectionMode]);

  // --- 3. Maps & Stats ---
  const unifiedMaps = useMemo(() => {
    if (!midiData?.header) return { tempoMap: [], meterMap: [] };
    const ppq = midiData.header.ppq || 480;
    const rawTempos = midiData.header.tempos || [];
    const rawMeters = midiData.header.timeSignatures || [];
    const sortedTempos = [...rawTempos].sort((a, b) => a.ticks - b.ticks);
    const tempoMap = [];
    let accTime = 0, lastTick = 0, curBpm = sortedTempos[0]?.bpm || 120;
    sortedTempos.forEach(t => {
        accTime += (t.ticks - lastTick) * (60 / (curBpm * ppq));
        tempoMap.push({ time: accTime, bpm: t.bpm, tick: t.ticks });
        lastTick = t.ticks; curBpm = t.bpm;
    });
    let meterMap = [];
    const backendMeters = analysisData?.music_theory?.meter_map;
    if (backendMeters && backendMeters.length > 1 && backendMeters[backendMeters.length-1].time > 0) { meterMap = backendMeters; }
    else {
        meterMap = rawMeters.map(m => {
            let ref = tempoMap[0];
            for (let i = tempoMap.length - 1; i >= 0; i--) { if (tempoMap[i].tick <= m.ticks) { ref = tempoMap[i]; break; } }
            const refBpm = ref ? ref.bpm : 120;
            const time = (ref ? ref.time : 0) + (m.ticks - (ref ? ref.tick : 0)) * (60 / (refBpm * ppq));
            return { time, str: m.timeSignature ? `${m.timeSignature[0]}/${m.timeSignature[1]}` : "4/4" };
        }).sort((a, b) => a.time - b.time);
    }
    return { tempoMap, meterMap };
  }, [midiData, analysisData]);

  const dynamicStats = useMemo(() => {
    const findEvent = (map, time) => {
        if (!map || map.length === 0) return null;
        for (let i = map.length - 1; i >= 0; i--) { if (time >= map[i].time - 0.05) return map[i]; }
        return map[0];
    };
    let bpm = 120; const tEvent = findEvent(unifiedMaps.tempoMap, currentTime); if (tEvent) bpm = Math.round(tEvent.bpm);
    let meter = "4/4"; const mEvent = findEvent(unifiedMaps.meterMap, currentTime); if (mEvent) meter = mEvent.str;
    return { bpm, meter };
  }, [unifiedMaps, currentTime]);

  if (!midiData) return null;

  const textColor = isLight ? 'text-black' : 'text-white';
  const textDim = isLight ? 'text-black/40' : 'text-white/40';
  const noteBg = isLight ? 'bg-black/5 border-black/5 text-black' : 'bg-white/10 border-white/5 text-midi-accent';
  const borderCol = isLight ? 'border-black/10' : 'border-white/10';
  const barBg = isLight ? 'bg-black/10' : 'bg-white/10';
  const barFill = isLight ? 'bg-black' : 'bg-white';
  const panelBg = isLight ? 'bg-white/80 backdrop-blur-md shadow-lg border-black/5' : 'bg-black/40 backdrop-blur-md border-white/5';

  return (
    <div className={`fixed bottom-8 right-8 flex flex-col items-end space-y-4 z-40 select-none ${textColor}`}>

      {/* --- CHORDS DISPLAY SECTION --- */}
      <div className="flex flex-col items-end space-y-2 mb-4 pointer-events-none">
        <div className="flex items-start gap-3">
          <div className="text-right flex flex-col items-end">
             {/* Header with Source Badge */}
             <div className="flex items-center justify-end gap-2 mb-1">
                {chordData.source === 'server' ? (
                    <span className="flex items-center gap-1 text-[9px] text-green-400 font-mono bg-green-400/10 px-1.5 py-0.5 rounded border border-green-400/20"><Server size={8} /> MUSICPY</span>
                ) : (
                    <span className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 ${textDim}`}><Cpu size={8} /> LOCAL</span>
                )}

                <div className={`w-8 h-1.5 rounded-full ${barBg}`}>
                    <div className="h-full bg-midi-accent rounded-full transition-all duration-200" style={{ width: `${chordData.confidence * 100}%` }}></div>
                </div>
             </div>

             {/* Main Chord Name with Loader */}
             <div className="text-3xl font-mono font-bold transition-all duration-100 flex items-center justify-end gap-2 leading-none mt-1">
                 {isServerPending && <Loader2 size={16} className="animate-spin opacity-50 text-midi-accent" />}
                 <span className="tracking-tight filter drop-shadow-lg">{chordData.name}</span>
             </div>

             {/* Aliases / Alternatives List */}
             {chordData.aliases && chordData.aliases.length > 1 && (
                 <div className={`flex flex-col items-end gap-0.5 mt-2 animate-in slide-in-from-top-2 fade-in duration-300`}>
                     <span className={`text-[8px] uppercase tracking-widest mb-0.5 opacity-50`}>
                         {t('analysis.alternatives', { defaultValue: 'Alternatives' })}
                     </span>
                     {chordData.aliases.slice(1, 4).map((alias, idx) => (
                         <span key={idx} className={`text-[10px] font-mono opacity-60 border-b border-dashed border-white/10`}>
                             {alias}
                         </span>
                     ))}
                 </div>
             )}
          </div>

          <Waves size={32} className={`text-midi-accent mt-2 ${chordData.name !== "---" ? "animate-pulse opacity-100" : "opacity-20"}`} />
        </div>

        {/* Active Notes */}
        <div className="flex items-center gap-3 mt-2">
          <div className="text-right">
             <div className={`text-[9px] uppercase tracking-widest ${textDim} mb-1`}>
                 {t('analysis.active_notes', { defaultValue: 'Active Notes' })}
             </div>
             <div className="h-6 flex items-center justify-end gap-1 flex-wrap max-w-[200px]">
               {activeNoteNames.length > 0 ? ( activeNoteNames.map((note, i) => (<span key={i} className={`px-1.5 py-0.5 rounded text-xs font-mono border shadow-sm ${noteBg}`}>{note}</span>)) ) : <span className={`text-xs font-mono ${textDim}`}>...</span>}
             </div>
          </div>
          <Zap size={18} className={`text-midi-accent transition-opacity ${activeNoteNames.length > 0 ? 'opacity-100' : 'opacity-20'}`} />
        </div>
      </div>

      {/* --- STATS PANEL --- */}
      <div className={`flex flex-col items-end space-y-2 border rounded-xl p-4 transition-all duration-500 ${panelBg} ${borderCol} pointer-events-auto`}>
         <div className="flex items-center justify-between w-full gap-8">
             <button onClick={() => setIsExpanded(!isExpanded)} className={`text-[10px] uppercase tracking-[0.2em] flex items-center gap-1 hover:text-midi-accent transition-colors ${textDim}`}>
                 <Activity size={12} /> 
                 {t('analysis.global_analysis', { defaultValue: 'Global Analysis' })} 
                 {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
             </button>

             {/* FPS & Status */}
             <div className={`flex items-center gap-3 text-[9px] font-mono ${textDim}`}>
                 <span>{isAnalyzing ? t('analysis.processing', { defaultValue: 'Processing...' }) : t('analysis.ready', { defaultValue: 'Ready' })}</span>
                 <span className="w-px h-2 bg-current opacity-20"></span>
                 <span className={fps < 30 ? "text-red-500 font-bold" : ""}>{fps} FPS</span>
             </div>
         </div>

        {isAnalyzing ? (
          <div className="flex items-center gap-4 opacity-50 animate-pulse py-2">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-xs">{t('analysis.reanalyzing', { defaultValue: 'Re-analyzing...' })}</span>
          </div>
        ) : (
          <div className="flex items-center gap-6 opacity-90 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="flex flex-col items-end"><span className={`text-[9px] ${textDim}`}>BPM</span><span className="font-bold font-mono tabular-nums">{dynamicStats.bpm}</span></div>
             <div className={`w-px h-6 ${borderCol}`}></div>
             <div className="flex flex-col items-end"><span className={`text-[9px] ${textDim}`}>METER</span><span className="font-bold font-mono tabular-nums text-midi-accent">{dynamicStats.meter}</span></div>
             <div className={`w-px h-6 ${borderCol}`}></div>
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] ${textDim}`}>KEY</span>
                    <span className={`text-[9px] font-mono ${textDim}`}>{keyInfo.conf}%</span>
                    <div className={`w-8 h-1 rounded-full ${barBg}`} title={`Confidence: ${keyInfo.conf}%`}>
                        <div className={`h-full rounded-full ${barFill}`} style={{ width: `${Math.min(100, Math.max(5, keyInfo.conf))}%`, opacity: keyInfo.conf / 100 }}></div>
                    </div>
                </div>
                <span className="font-bold font-mono text-lg leading-none mt-1">{keyInfo.name}</span>
                {showAlt && keyInfo.alts[0] && (
                    <div className={`text-[9px] font-mono mt-0.5 flex items-center gap-1 ${textDim}`}>
                        <span className="opacity-50">or</span>
                        <span className="font-bold border-b border-dashed border-current">{keyInfo.alts[0].name}</span>
                        <span className="opacity-70">({Math.round(keyInfo.alts[0].conf * 100)}%)</span>
                    </div>
                )}
             </div>
          </div>
        )}

        {isExpanded && !isAnalyzing && analysisData?.music_theory?.key_timeline && (
            <div className="w-full pt-2 animate-in slide-in-from-top-2 fade-in duration-300 border-t border-black/5 mt-2">
                <div className="flex justify-between text-[9px] uppercase tracking-widest opacity-50 mb-1">
                    <span>{t('analysis.structure', { defaultValue: 'Structure & Modulation' })}</span>
                    <span>{midiData.duration.toFixed(1)}s</span>
                </div>
                <KeyTimeline
                    timeline={analysisData.music_theory.key_timeline}
                    duration={midiData.duration}
                    currentTime={currentTime}
                    globalKey={analysisData.music_theory.key}
                />
                <div className="flex gap-2 mt-2 justify-end">
                    <div className="flex items-center gap-1 text-[9px] opacity-50"><div className="w-2 h-2 rounded-full bg-red-400"></div> {t('analysis.major', { defaultValue: 'Major' })}</div>
                    <div className="flex items-center gap-1 text-[9px] opacity-50"><div className="w-2 h-2 rounded-full bg-blue-400"></div> {t('analysis.minor', { defaultValue: 'Minor' })}</div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisHUD;
