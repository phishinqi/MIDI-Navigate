// src/audio/AudioEngineManager.jsx
import { useEffect } from 'react';
import useStore from '@/store/useStore';
import { audioEngine } from '@/audio/AudioEngine';

const AudioEngineManager = () => {
  const midiData = useStore((state) => state.midiData);

  useEffect(() => {
    // 这个 Effect 负责 AudioEngine 的核心生命周期
    console.log('[AudioEngineManager] MIDI data changed. Reloading engine.');

    audioEngine.cleanup();

    if (midiData) {
      audioEngine.loadMidi(midiData);
    }

    // 这个 effect 的清理函数只会在整个组件被卸载时（即应用关闭）执行
    return () => {
      console.log('[AudioEngineManager] Cleaning up on component unmount.');
      audioEngine.cleanup();
    };
  }, [midiData]);

  return null;
};

export default AudioEngineManager;
