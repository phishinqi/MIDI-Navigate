import React, { useEffect, useLayoutEffect, useRef } from 'react';
import p5 from 'p5';
import * as Tone from 'tone';
import useStore from '@/store/useStore';
import { createSketch } from './P5Sketch';

const EngineP5 = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Instance = useRef<p5 | null>(null);
  const lastUiUpdate = useRef(0);

  // Store Actions
  const setCurrentTime = useStore((state) => state.setCurrentTime);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const setP5Instance = useStore((state) => state.setP5Instance);

  // Time Sync Loop
  useLayoutEffect(() => {
    let frameId;
    const loop = () => {
      const state = useStore.getState();

      if (state.isPlaying) {
        const time = Tone.Transport.seconds;
        const now = performance.now();

        // Throttle UI updates
        if (now - lastUiUpdate.current > 16) {
          setCurrentTime(time);
          lastUiUpdate.current = now;
        }

        // Auto-Stop
        const duration = state.midiData?.duration || 0;
        if (duration > 0 && time > duration + 1) {
          Tone.Transport.pause();
          setIsPlaying(false);
        }
      }
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [setCurrentTime, setIsPlaying]);

  // Initialize P5
  useEffect(() => {
    if (containerRef.current) {
      const sketch = createSketch(containerRef);
      p5Instance.current = new p5(sketch, containerRef.current);
      setP5Instance(p5Instance.current);
    }

    return () => {
      if (p5Instance.current) {
        p5Instance.current.remove();
        p5Instance.current = null;
        setP5Instance(null);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black"
      style={{ overflow: 'hidden' }}
    />
  );
};

export default EngineP5;
