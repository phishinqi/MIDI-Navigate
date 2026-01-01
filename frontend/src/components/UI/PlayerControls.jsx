import React, { useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import useStore from '@/store/useStore';
import { audioEngine } from '@/audio/AudioEngine';
import * as Slider from '@radix-ui/react-slider';
import { useTranslation } from 'react-i18next';

const PlayerControls = ({ isLight }) => {
  const { t } = useTranslation(); // 初始化 hook
  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const midiData = useStore((state) => state.midiData);
  const analysisData = useStore((state) => state.analysisData);
  const currentTime = useStore((state) => state.currentTime);
  const duration = useStore((state) => state.duration);

  const volume = useStore((state) => state.volume);
  const isMuted = useStore((state) => state.isMuted);
  const setVolume = useStore((state) => state.setVolume);
  const toggleMute = useStore((state) => state.toggleMute);

  useEffect(() => { audioEngine.setMasterVolume(volume); }, [volume]);
  useEffect(() => { audioEngine.setMute(isMuted); }, [isMuted]);

  const togglePlay = async () => {
    await audioEngine.ensureContext();
    if (isPlaying) { audioEngine.pause(); setIsPlaying(false); }
    else { audioEngine.play(); setIsPlaying(true); }
  };

  const handleSeek = (value) => {
    audioEngine.seek(value[0]);
    useStore.getState().setCurrentTime(value[0]);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return { mins, secs, ms };
  };

  const timeObj = formatTime(currentTime);
  const secProgress = (currentTime % 60) / 60 * 100;
  const msProgress = (currentTime % 1) * 100;

  const maps = useMemo(() => {
    if (!midiData?.header) return { tempoMap: [], meterMap: [], ppq: 480 };
    const ppq = midiData.header.ppq || 480;
    const rawTempos = midiData.header.tempos || [];
    const rawMeters = midiData.header.timeSignatures || [];

    const sortedTempos = [...rawTempos].sort((a, b) => a.ticks - b.ticks);
    const tempoMap = [];
    let accTime = 0;
    let lastTick = 0;
    let curBpm = sortedTempos[0]?.bpm || 120;

    sortedTempos.forEach(t => {
      const delta = t.ticks - lastTick;
      accTime += delta * (60 / (curBpm * ppq));
      tempoMap.push({ time: accTime, bpm: t.bpm, tick: t.ticks });
      lastTick = t.ticks;
      curBpm = t.bpm;
    });

    const backendMeters = analysisData?.music_theory?.meter_map;
    const backendValid = backendMeters && backendMeters.length > 1 && backendMeters[backendMeters.length-1].time > 0;
    let meterMap = [];

    if (backendValid) {
        meterMap = backendMeters.map(m => {
            const parts = m.str.split('/');
            return { time: m.time, n: parseInt(parts[0]), d: parseInt(parts[1]) };
        });
    } else {
        meterMap = rawMeters.map(m => {
            let ref = tempoMap[0];
            for (let i = tempoMap.length - 1; i >= 0; i--) {
                if (tempoMap[i].tick <= m.ticks) { ref = tempoMap[i]; break; }
            }
            const refBpm = ref ? ref.bpm : 120;
            const refTime = ref ? ref.time : 0;
            const deltaTick = m.ticks - (ref ? ref.tick : 0);
            const seconds = refTime + deltaTick * (60 / (refBpm * ppq));
            return { time: seconds, n: m.timeSignature[0], d: m.timeSignature[1] };
        }).sort((a, b) => a.time - b.time);
    }
    if (meterMap.length === 0) meterMap.push({ time: 0, n: 4, d: 4 });
    if (meterMap[0].time > 0) meterMap.unshift({ time: 0, n: 4, d: 4 });

    return { tempoMap, meterMap, ppq };
  }, [midiData, analysisData]);

  const meterInfo = useMemo(() => {
    if (!maps.meterMap.length) return { bar: 1, currentBeatIndex: 0, beatsPerBar: 4 };

    const events = [
        ...maps.tempoMap.map(t => ({ t: t.time, type: 'tempo', val: t.bpm })),
        ...maps.meterMap.map(m => ({ t: m.time, type: 'meter', val: m })),
        { t: currentTime, type: 'cursor' }
    ].sort((a, b) => a.t - b.t);

    let totalMeasures = 0;
    let currentBpm = 120;
    if (maps.tempoMap.length) currentBpm = maps.tempoMap[0].bpm;

    let currentMeter = maps.meterMap[0];
    let lastTime = 0;

    for (const ev of events) {
        if (ev.t > currentTime) break;
        if (ev.t < 0) continue;

        const dt = ev.t - lastTime;
        if (dt > 0) {
            const beats = dt * (currentBpm / 60);
            const beatsPerMeasure = currentMeter.n * (4 / currentMeter.d);
            totalMeasures += beats / beatsPerMeasure;
        }

        lastTime = ev.t;
        if (ev.type === 'tempo') currentBpm = ev.val;
        if (ev.type === 'meter') currentMeter = ev.val;
    }

    const currentBar = Math.floor(totalMeasures) + 1;
    const measureProgress = totalMeasures % 1;

    const currentBeatIndex = Math.floor(measureProgress * currentMeter.n);

    return {
        bar: currentBar,
        currentBeatIndex: currentBeatIndex,
        beatsPerBar: currentMeter.n,
        denominator: currentMeter.d
    };

  }, [currentTime, maps]);

  if (!midiData) return null;

  const textColor = isLight ? 'text-black' : 'text-white';
  const textDim = isLight ? 'text-black/40' : 'text-white/40';
  const trackBg = isLight ? 'bg-black/10' : 'bg-white/10';
  const trackFill = isLight ? 'bg-black/60' : 'bg-white/60';
  const dotEmpty = isLight ? 'bg-black/10' : 'bg-white/20';
  const dotActive = isLight ? 'bg-black shadow-sm' : 'bg-white shadow-sm';
  const msTextColor = isLight ? 'text-black/60' : 'text-midi-accent';

  return (
    <div className="fixed bottom-12 left-12 z-50 flex items-end gap-8 select-none animate-in slide-in-from-bottom-10 fade-in duration-500 pointer-events-none">
      <div className={`flex items-end gap-6 pointer-events-auto ${textColor}`}>
          <button onClick={togglePlay} className={`mb-3 mr-2 hover:text-midi-accent hover:scale-110 transition-all ${isLight ? 'text-black/60' : 'text-white/60'}`}>
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>

          {/* MIN */}
          <div className="flex flex-col gap-1 group cursor-pointer w-16">
             <span className={`text-[10px] font-mono tracking-widest uppercase ${textDim}`}>
                 {t('controls.min', { defaultValue: 'MIN' })}
             </span>
             <span className="text-4xl font-mono font-bold tracking-tighter leading-none">{timeObj.mins}</span>
             <div className="h-1 w-full mt-1 relative flex items-center">
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentTime]} max={duration} step={0.01} onValueChange={handleSeek}>
                  <Slider.Track className={`relative grow h-[2px] rounded-full overflow-hidden transition-all group-hover:h-[4px] ${trackBg}`}><Slider.Range className="absolute bg-midi-accent h-full shadow-[0_0_10px_currentColor]" /></Slider.Track>
                  <Slider.Thumb className="block w-0 h-0 group-hover:w-2 group-hover:h-2 bg-white rounded-full shadow-lg transition-all" />
                </Slider.Root>
             </div>
          </div>

          {/* SEC */}
          <div className="flex flex-col gap-1 w-16 opacity-80">
             <span className={`text-[10px] font-mono tracking-widest uppercase ${textDim}`}>
                {t('controls.sec', { defaultValue: 'SEC' })}
             </span>
             <span className="text-4xl font-mono font-bold tracking-tighter leading-none">{timeObj.secs}</span>
             <div className={`h-1 w-full mt-1 relative rounded-full overflow-hidden ${trackBg}`}><div className={`h-full ${trackFill}`} style={{ width: `${secProgress}%`, transition: 'width 0.1s linear' }} /></div>
          </div>

          {/* MS */}
          <div className="flex flex-col gap-1 w-20 opacity-60">
             <span className={`text-[10px] font-mono tracking-widest uppercase ${textDim}`}>
                 {t('controls.ms', { defaultValue: 'MS' })}
             </span>
             <span className={`text-4xl font-mono font-bold tracking-tighter leading-none ${msTextColor}`}>{timeObj.ms}</span>
             <div className={`h-1 w-full mt-1 relative rounded-full overflow-hidden ${trackBg}`}><div className="h-full bg-midi-accent" style={{ width: `${msProgress}%` }} /></div>
          </div>
      </div>
      <div className={`h-12 w-px mx-2 mb-1 ${isLight ? 'bg-black/10' : 'bg-white/10'}`}></div>

      {/* Meter Section (Global Bar Count) */}
      <div className={`flex flex-col gap-1 pointer-events-auto w-24 ${textColor}`}>
         <span className={`text-[10px] font-mono tracking-widest uppercase ${textDim}`}>
             {t('controls.measure', { defaultValue: 'MEASURE' })}
         </span>
         <span className="text-4xl font-mono font-bold tracking-tighter leading-none">
             {meterInfo.bar.toString().padStart(3, '0')}
         </span>
         <div className="h-1 mt-1 flex items-center gap-2">
            {Array.from({ length: meterInfo.beatsPerBar }).map((_, i) => {
                const isActive = meterInfo.currentBeatIndex === i;
                const isDownbeat = i === 0;
                return (<div key={i} className={`rounded-full transition-all duration-75 ${isActive ? (isDownbeat ? 'w-2 h-2 bg-midi-accent shadow-[0_0_8px_currentColor]' : `w-1.5 h-1.5 ${dotActive}`) : `w-1 h-1 ${dotEmpty}`} `} />);
            })}
         </div>
      </div>
      <div className={`ml-4 mb-3 flex items-center gap-2 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-auto ${textColor}`}>
         <button onClick={toggleMute} className="hover:text-midi-accent transition-colors">{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
         <Slider.Root className="relative flex items-center select-none touch-none w-16 h-4 cursor-pointer" value={[isMuted ? -60 : volume]} min={-60} max={0} step={1} onValueChange={(v) => { if(isMuted) toggleMute(); setVolume(v[0]); }}>
            <Slider.Track className={`relative grow rounded-full h-[2px] overflow-hidden ${trackBg}`}><Slider.Range className={`absolute h-full ${isLight ? 'bg-black/60' : 'bg-white'}`} /></Slider.Track>
            <Slider.Thumb className={`block w-2 h-2 rounded-full shadow-sm ${isLight ? 'bg-black' : 'bg-white'}`} />
         </Slider.Root>
      </div>
    </div>
  );
};

export default PlayerControls;
