import React, { useState, useEffect, useRef } from 'react';
import FileUpload from '@/components/UI/FileUpload';
import Visualizer from '@/components/Visualizer/Visualizer';
import PlayerControls from '@/components/UI/PlayerControls';
import AnalysisHUD from '@/components/UI/AnalysisHUD';
import TrackSettings from '@/components/UI/TrackSettings';
import useStore from '@/store/useStore';
import { Eye, EyeOff, Settings } from 'lucide-react';
import { isLightColor } from '@/lib/utils';
import { audioEngine } from '@/audio/AudioEngine';

function App() {
  const midiData = useStore((state) => state.midiData);
  const isZenMode = useStore((state) => state.isZenMode);
  const toggleZenMode = useStore((state) => state.toggleZenMode);
  const showPlayerWidget = useStore((state) => state.showPlayerWidget);
  const showAnalysisWidget = useStore((state) => state.showAnalysisWidget);
  const backgroundColor = useStore((state) => state.backgroundColor);

  const autoTextContrast = useStore((state) => state.autoTextContrast);
  const forceDarkText = useStore((state) => state.forceDarkText);

  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const toggleMute = useStore((state) => state.toggleMute);

  const [showSettings, setShowSettings] = useState(false);

  const handleGlobalFileUpload = (e) => {
      const input = document.getElementById('global-file-input');
      if (input) input.click();
  };

  // --- 快捷键监听 ---
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
        case 'KeyO':
          e.preventDefault();
          handleGlobalFileUpload();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyZ':
          e.preventDefault();
          toggleZenMode();
          break;
        case 'KeyS':
          e.preventDefault();
          if (midiData) setShowSettings(prev => !prev);
          break;
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [midiData, toggleMute, toggleZenMode, setIsPlaying]);

  // [FIX] 逻辑分离：存在性 vs 可见性
  // 组件是否应该被渲染（基于有没有数据和用户设置开关）
  const renderPlayer = midiData && showPlayerWidget;
  const renderAnalysis = midiData && showAnalysisWidget;

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
      {/* 背景可视化层 */}
      <div className="absolute inset-0 z-0">
        {midiData ? (
          <Visualizer />
        ) : (
          <div className={`w-full h-full flex items-center justify-center opacity-10 select-none ${textColorClass}`}>
            <h1 className="text-[20vw] font-bold tracking-tighter">MIDI</h1>
          </div>
        )}
      </div>

      {/* 顶层 UI 容器：使用 opacity 控制 Zen 模式显隐，保留 DOM 以维持组件状态 */}
      <div
        className={`absolute inset-0 z-50 flex flex-col justify-between p-6 transition-opacity duration-500 
        ${isZenMode ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
      >
        <header className="flex justify-between items-start">
          <div>
              <h1 className="text-2xl font-bold tracking-tighter font-mono">MIDI-Navigate</h1>
              <p className={`text-xs tracking-widest uppercase mt-1 opacity-50`}>        -By. Ume Hamami</p>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center w-full">
          {/* 初始上传按钮 */}
          {!midiData && <div className="pointer-events-auto w-full max-w-xl"><FileUpload inputId="global-file-input" /></div>}

          {/* 隐藏的上传代理 (用于快捷键) */}
          {midiData && (
             <div className="hidden">
                <FileUpload inputId="global-file-input" hidden={true} />
             </div>
          )}
        </main>

        {/* [FIX] 始终渲染组件，仅通过父级 div 控制显隐 */}
        {renderPlayer && <div className="contents"><PlayerControls isLight={useDarkText} /></div>}
        {renderAnalysis && <div className="contents"><AnalysisHUD isLight={useDarkText} /></div>}
      </div>

      {/* 固定悬浮按钮 (始终可点击，或在 Zen 模式下淡出？通常保留退出按钮更好，但遵循 Zen 模式全隐藏原则) */}
      <div className={`absolute top-6 right-6 z-[60] flex items-center gap-3 transition-opacity duration-500 ${isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'} pointer-events-auto`}>
         {midiData && (
            <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition-all backdrop-blur-sm cursor-pointer ${btnClass}`} title="Settings [S]"><Settings size={20} /></button>
         )}
        <button onClick={toggleZenMode} className={`p-2 rounded-full transition-all backdrop-blur-sm cursor-pointer ${btnClass}`} title="Zen Mode [Z]">{isZenMode ? <EyeOff size={20} /> : <Eye size={20} />}</button>
      </div>

      {showSettings && <TrackSettings onClose={() => setShowSettings(false)} isLight={useDarkText} />}
    </div>
  );
}

export default App;
