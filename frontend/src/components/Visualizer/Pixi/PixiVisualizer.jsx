// frontend/src/components/Visualizer/Pixi/PixiVisualizer.jsx
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import useStore from '@/store/useStore';

gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

const PixiVisualizer = () => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const activeNotesRef = useRef(new Map());
  const pixiSettings = useStore(state => state.pixiSettings);

  useEffect(() => {
    const setup = async () => {
        if (!containerRef.current) return;

        const app = new PIXI.Application();
        await app.init({
            resizeTo: containerRef.current,
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        containerRef.current.appendChild(app.canvas);
        appRef.current = app;

        const noteContainer = new PIXI.Container();
        app.stage.addChild(noteContainer);

        const blurFilter = new PIXI.BlurFilter();
        noteContainer.filters = [blurFilter];

        const unsub = useStore.subscribe(
            (state) => state.incomingMidiEvent,
            (event) => {
                if (event && appRef.current) {
                    handleMidiEvent(event, noteContainer);
                }
            }
        );

        return { app, unsub };
    };

    let cleanup = () => {};

    setup().then(result => {
      if (result) {
        cleanup = () => {
          result.unsub();
          if (result.app) {
              result.app.destroy(true, { children: true, texture: true, baseTexture: true });
          }
          gsap.killTweensOf("*");
        };
      }
    });

    return () => {
        cleanup();
    };
  }, []);

  useEffect(() => {
    if (appRef.current && appRef.current.stage.children[0]?.filters) {
        const noteContainer = appRef.current.stage.children[0];
        const blurFilter = noteContainer.filters[0];
        if (blurFilter) {
            gsap.to(blurFilter, { blur: pixiSettings.bloom || 0, duration: 0.5 });
        }
    }
  }, [pixiSettings.bloom]);


  // --- handleMidiEvent ---
  const handleMidiEvent = (event, container) => {
    if(!event) return;
    const { type, note, velocity, channel } = event;
    const noteId = `${channel}-${note}`;
    const app = appRef.current;
    if (!app) return;

    const screenW = app.screen.width;
    const x = gsap.utils.mapRange(21, 108, screenW * 0.05, screenW * 0.95, note);

    if (type === 'note_on' && velocity > 0) {
      // 修改 1: 传入 channel
      spawnNote(noteId, x, velocity, container, note, channel);
    } else if (type === 'note_off' || (type === 'note_on' && velocity === 0)) {
      releaseNote(noteId);
    }
  };

  const spawnNote = (id, x, velocity, container, note, channel) => {
    const app = appRef.current;
    if (!app) return;

    if (activeNotesRef.current.has(id)) {
      releaseNote(id);
    }

    const graphics = new PIXI.Graphics();

    let hue;
    if (pixiSettings.particleColor === 'velocity') {
        hue = gsap.utils.mapRange(0, 127, 240, 0, velocity);
    } else {
        // Use note for pitch color mapping, not x
        hue = (channel * 22.5) % 360;
    }
    const color = hslToHex(hue, 90, 65);

    graphics.fill(color);
    graphics.circle(0, 0, 15);
    graphics.fill();

    graphics.x = x;
    graphics.y = app.screen.height - 50;
    graphics.alpha = 0;
    graphics.scale.set(0);

    graphics.blendMode = pixiSettings.blendMode || 'add';

    container.addChild(graphics);
    activeNotesRef.current.set(id, graphics);

    const sizeScale = gsap.utils.mapRange(0, 127, 0.5, 2.0, velocity) * (pixiSettings.particleSize || 1.0);

    gsap.to(graphics, {
      pixi: { scale: sizeScale, alpha: 0.9, y: app.screen.height - 100 },
      duration: 0.4,
      ease: "back.out(1.7)",
    });

    gsap.to(graphics, {
      pixi: { y: `+=${gsap.utils.random(-30, 30)}` },
      duration: 3,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true
    });
  };

  const releaseNote = (id) => {
    const graphics = activeNotesRef.current.get(id);
    if (!graphics) return;

    activeNotesRef.current.delete(id);
    gsap.killTweensOf(graphics);

    gsap.to(graphics, {
      pixi: { y: `-=200`, alpha: 0, scale: 0 },
      duration: 0.75,
      ease: "power2.in",
      onComplete: () => {
        graphics.destroy();
      }
    });
  };

  const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative" />
  );
};

export default PixiVisualizer;

