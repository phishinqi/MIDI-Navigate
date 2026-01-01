// frontend\src\App.jsx
import React, { useState, useEffect } from 'react';
import FileUpload from '@/components/UI/FileUpload';
import Visualizer from '@/components/Visualizer/Visualizer';
import PlayerControls from '@/components/UI/PlayerControls';
import AnalysisHUD from '@/components/UI/AnalysisHUD';
import TrackSettings from '@/components/UI/TrackSettings';
import useStore from '@/store/useStore';
import { Eye, EyeOff, Settings } from 'lucide-react';
import { isLightColor } from '@/lib/utils';
import { audioEngine } from '@/audio/AudioEngine';
import AudioEngineManager from '@/audio/AudioEngineManager';

function App() {
  const midiData = useStore((state) => state.midiData);
  const isZenMode = useStore((state) => state.isZenMode);
  const toggleZenMode = useStore((state) => state.toggleZenMode);
  const showPlayerWidget = useStore((state) => state.showPlayerWidget);
  const showAnalysisWidget = useStore((state) => state.showAnalysisWidget);
  const backgroundColor = useStore((state) => state.backgroundColor);
  const autoTextContrast = useStore((state) => state.autoTextContrast);
  const forceDarkText = useStore((state) => state.forceDarkText);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const toggleMute = useStore((state) => state.toggleMute);

  const [showSettings, setShowSettings] = useState(false);

  const handleGlobalFileUpload = () => {
    const input = document.getElementById('global-file-input');
    if (input) input.click();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (midiData) {
            audioEngine.ensureContext().then(() => {
              if (useStore.getState().isPlaying) {
                audioEngine.pause();
                setIsPlaying(false);
              } else {
                audioEngine.play();
                setIsPlaying(true);
              }
            });
          }
          break;
        case 'KeyO': e.preventDefault(); handleGlobalFileUpload(); break;
        case 'KeyM': e.preventDefault(); toggleMute(); break;
        case 'KeyZ': e.preventDefault(); toggleZenMode(); break;
        case 'KeyS': e.preventDefault(); setShowSettings((prev) => !prev); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [midiData, toggleMute, toggleZenMode, setIsPlaying]);

  let useDarkText = false;
  if (autoTextContrast) {
    useDarkText = isLightColor(backgroundColor);
  } else {
    useDarkText = forceDarkText;
  }

  const textColorClass = useDarkText ? 'text-black' : 'text-white';
  const btnClass = useDarkText
    ? 'bg-black/5 hover:bg-black/10 text-black/50 hover:text-black'
    : 'bg-white/10 hover:bg-white/20 text-white/50 hover:text-white';

  return (
    <div
      className={`relative w-full h-screen overflow-hidden font-sans transition-colors duration-500 ${textColorClass}`}
      style={{ backgroundColor: backgroundColor }}
    >
      <AudioEngineManager />
      <div className="absolute inset-0 z-0">
        {midiData ? (
          <Visualizer />
        ) : (
          <div className={`w-full h-full flex items-center justify-center opacity-10 select-none ${textColorClass}`}>
            <h1 className="text-[20vw] font-bold tracking-tighter">MIDI</h1>
          </div>
        )}
      </div>
      <div
        className={`absolute inset-0 z-50 flex flex-col justify-between p-6 transition-opacity duration-500 ${
          isZenMode ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter font-mono">MIDI-Navigate</h1>
            <p className={`text-xs tracking-widest uppercase mt-1 opacity-50`}>- By. PurrNeko</p>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center w-full">
          {!midiData && <div className="pointer-events-auto w-full max-w-xl"><FileUpload inputId="global-file-input" /></div>}
          {midiData && (
            <div className="hidden">
              <FileUpload inputId="global-file-input" hidden={true} />
            </div>
          )}
        </main>

        {midiData && (
          <>
            <div className={`transition-opacity duration-300 ${showPlayerWidget ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <PlayerControls isLight={useDarkText} />
            </div>
            <div className={`transition-opacity duration-300 ${showAnalysisWidget ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <AnalysisHUD isLight={useDarkText} />
            </div>
          </>
        )}
      </div>

      <div className={`absolute top-6 right-6 z-[60] flex items-center gap-3 transition-opacity duration-500 ${isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'} pointer-events-auto`}>
        <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition-all backdrop-blur-sm cursor-pointer ${btnClass}`} title="Settings [S]">
          <Settings size={20} />
        </button>
        <button onClick={toggleZenMode} className={`p-2 rounded-full transition-all backdrop-blur-sm cursor-pointer ${btnClass}`} title="Zen Mode [Z]">
          {isZenMode ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {showSettings && <TrackSettings onClose={() => setShowSettings(false)} isLight={useDarkText} />}
    </div>
  );
}

export default App;
