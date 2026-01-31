import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as Tone from 'tone';
import useStore from '@/store/useStore';
import MidiScene from './MidiScene';
import PercussionGrid3D from './PercussionGrid3D';
import { isLightColor } from '@/lib/utils';

const EngineThree = () => {
  const backgroundColor = useStore((state) => state.backgroundColor);
  const isPlaying = useStore((state) => state.isPlaying);
  const setCurrentTime = useStore((state) => state.setCurrentTime);
  const midiData = useStore((state) => state.midiData);

  const lastUiUpdate = useRef(0);

  React.useLayoutEffect(() => {
    let frameId;
    const loop = () => {
      if (isPlaying) {
        const time = Tone.Transport.seconds;
        const now = performance.now();

        if (now - lastUiUpdate.current > 16) {
          setCurrentTime(time);
          lastUiUpdate.current = now;
        }

        if (midiData && time > midiData.duration + 1) {
          Tone.Transport.pause();
          useStore.getState().setIsPlaying(false);
        }
      }
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, midiData, setCurrentTime]);

  const isLight = isLightColor(backgroundColor);
  const composerRef = useRef<any>(null);

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        orthographic
        camera={{ zoom: 40, position: [0, 0, 100] }}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: true, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[backgroundColor]} />

        <MidiScene composerRef={composerRef} />
        <PercussionGrid3D />

        {!isLight && (
          <EffectComposer ref={composerRef} enableNormalPass={false}>
            <Bloom
              luminanceThreshold={0.2}
              mipmapBlur
              intensity={1.5}
              radius={0.6}
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
};

export default EngineThree;
