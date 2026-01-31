
import { useEffect } from 'react';
import useStore from '@/store/useStore';
import { getAudioEngine } from '@/audio/AudioEngine';

const AudioEngineManager = () => {
  const midiData = useStore((state) => state.midiData);

  useEffect(() => {
    // Manage AudioEngine lifecycle
    console.log('[AudioEngineManager] MIDI data changed. Reloading engine.');

    getAudioEngine().cleanup();

    if (midiData) {
      getAudioEngine().loadMidi(midiData);
    }

    return () => {
      console.log('[AudioEngineManager] Cleaning up on component unmount.');
      getAudioEngine().cleanup();
    };
  }, [midiData]);

  return null;
};

export default AudioEngineManager;
