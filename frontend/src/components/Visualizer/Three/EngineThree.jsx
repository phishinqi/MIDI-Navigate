// frontend/src/components/Visualizer/EngineThree.jsx
import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as Tone from 'tone';
import useStore from '../../../store/useStore.js';
import MidiScene from './MidiScene.jsx';
import PercussionGrid3D from './PercussionGrid3D.jsx';
import { isLightColor } from '../../../lib/utils.js';

const EngineThree = () => {
  const backgroundColor = useStore((state) => state.backgroundColor);
  const isPlaying = useStore((state) => state.isPlaying);
  const setCurrentTime = useStore((state) => state.setCurrentTime);
  const midiData = useStore((state) => state.midiData);

  const lastUiUpdate = useRef(0);

  // UI Sync Loop
  React.useLayoutEffect(() => {
    let frameId;
    const loop = () => {
      if (isPlaying) {
        const time = Tone.Transport.seconds;
        const now = performance.now();

        if (now - lastUiUpdate.current > 100) {
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

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        orthographic
        camera={{ zoom: 40, position: [0, 0, 100] }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[backgroundColor]} />

        <MidiScene />

        {/* 放置在 Z=-10 左右，或者更深，取决于设计。MidiScene 的 BarLines 在 Z=-2 */}
        {/* 在 PercussionGrid3D 内部控制位置，这里只需渲染 */}
        <PercussionGrid3D />

        {!isLight && (
          <EffectComposer disableNormalPass>
              <Bloom
                luminanceThreshold={0.2} // 稍微调低阈值让 Grid 也能发光
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
