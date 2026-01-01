// frontend/src/components/Visualizer/Three/MidiScene.jsx
import React, { useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../../../store/useStore.js';
import { getTrackHue, isLightColor, getTrackColor, hexToRgb } from '../../../lib/utils.js';
import { audioEngine } from '../../../audio/AudioEngine.js';

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const whiteColor = new THREE.Color(1, 1, 1);
const blackColor = new THREE.Color(0, 0, 0);

function findStartIndex(instances, viewLeft) {
  let low = 0, high = instances.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (instances[mid].x + instances[mid].w < viewLeft) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, low);
}

function findEndIndex(instances, viewRight, startIdx) {
  let low = startIdx, high = instances.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (instances[mid].x <= viewRight) low = mid + 1;
    else high = mid - 1;
  }
  return Math.min(instances.length, low);
}

function useGlowTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);
}

const MidiScene = () => {
  const meshRef = useRef();
  const glowRef = useRef();
  const barLinesRef = useRef();
  const groupRef = useRef();
  const playheadRef = useRef();

  // 增加一个 Ref 标记是否已初始化矩阵
  const isInitialized = useRef(false);

  const midiData = useStore(state => state.midiData);
  const isGlowEnabled = useStore(state => state.isGlowEnabled);
  const visibleTrackIndices = useStore(state => state.visibleTrackIndices);
  const backgroundColor = useStore(state => state.backgroundColor);
  const trackColors = useStore(state => state.trackColors);
  const useDefaultTrackColors = useStore(state => state.useDefaultTrackColors);

  const viewSettings = useStore(state => state.viewSettings);
  const zoomX = viewSettings?.zoomX || 50;
  const zoomY = viewSettings?.zoomY || 1.0;
  const laneHeightScale = viewSettings?.laneHeight || 1.5;
  const followCursor = viewSettings?.followCursor ?? true;
  const enableClickToSeek = viewSettings?.enableClickToSeek ?? true;
  const playheadOffsetRatio = viewSettings?.playheadOffset || 0.2;
  const showPlayhead = viewSettings?.showPlayhead ?? true;
  const showBarLines = viewSettings?.showBarLines ?? true;

  const { viewport } = useThree();
  const glowTexture = useGlowTexture();
  const isLight = isLightColor(backgroundColor);

  // 每次数据变化时，重置初始化标记
  useEffect(() => {
    isInitialized.current = false;
  }, [midiData, zoomX, zoomY, laneHeightScale, trackColors, useDefaultTrackColors]);

  // 1. Data Prep
  const { count, instances } = useMemo(() => {
    if (!midiData) return { count: 0, instances: [] };

    const data = [];
    const minMidi = 21;
    const maxMidi = 108;
    const totalRange = maxMidi - minMidi;
    const baseKeyHeight = (viewport.height * 0.9) / totalRange;
    const keyHeight = baseKeyHeight * zoomY * laneHeightScale;

    midiData.tracks.forEach((track, tIdx) => {
      // 使用统一的颜色工具函数
      const colorHex = getTrackColor(tIdx, trackColors, useDefaultTrackColors);
      const rgb = hexToRgb(colorHex);
      const baseColor = new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);

      track.notes.forEach(note => {
        const relativePitch = note.midi - minMidi - (totalRange / 2);
        const vel = note.velocity || 0.7;
        const velScale = 0.5 + (vel * 0.8);

        data.push({
          trackIndex: tIdx,
          time: note.time,
          duration: note.duration,
          velocity: vel,
          baseColor: baseColor,
          x: note.time * zoomX,
          y: relativePitch * keyHeight,
          w: Math.max(note.duration * zoomX, 0.2),
          h: keyHeight * 0.8 * velScale,
          velScale: velScale
        });
      });
    });

    data.sort((a, b) => a.x - b.x);
    return { count: data.length, instances: data };
  }, [midiData, viewport.height, zoomX, zoomY, laneHeightScale, trackColors, useDefaultTrackColors]);

  // 2. Bar Lines
  const barLineData = useMemo(() => {
    if (!midiData || !showBarLines) return { count: 0, instances: [] };
    const ppq = midiData.header.ppq || 480;
    const rawTempos = midiData.header.tempos || [];
    const rawMeters = midiData.header.timeSignatures || [];
    const duration = midiData.duration || 0;

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

    const bars = [];
    const sortedMeters = [...rawMeters].sort((a, b) => a.ticks - b.ticks);
    if (sortedMeters.length === 0) sortedMeters.push({ ticks: 0, timeSignature: [4, 4] });
    if (sortedMeters[0].ticks > 0) sortedMeters.unshift({ ticks: 0, timeSignature: [4, 4] });

    let currentTick = 0;
    let meterIdx = 0;
    let safetyLimit = 10000;

    while (currentTick < (duration * 120 * ppq / 60) * 2 && safetyLimit > 0) {
      while (meterIdx < sortedMeters.length - 1 && currentTick >= sortedMeters[meterIdx + 1].ticks) {
        meterIdx++;
      }
      const meter = sortedMeters[meterIdx];
      const [num, den] = meter.timeSignature;
      const ticksPerBar = num * (ppq * 4 / den);

      let refTempo = tempoMap[0];
      for (let i = tempoMap.length - 1; i >= 0; i--) {
        if (tempoMap[i].tick <= currentTick) { refTempo = tempoMap[i]; break; }
      }
      const refBpm = refTempo ? refTempo.bpm : 120;
      const refTime = refTempo ? refTempo.time : 0;
      const refTick = refTempo ? refTempo.tick : 0;
      const time = refTime + (currentTick - refTick) * (60 / (refBpm * ppq));

      if (time > duration) break;
      bars.push(time);
      currentTick += ticksPerBar;
      safetyLimit--;
    }
    bars.sort((a, b) => a - b);
    return { count: bars.length, instances: bars };
  }, [midiData, showBarLines]);

  // 3. Matrix Updates (Initial Setup)
  // 这里的逻辑保持不变，但我们不再完全依赖它，因为 render loop 也会检查初始化
  useLayoutEffect(() => {
    if (!meshRef.current || !glowRef.current || count === 0) return;
    updateAllMatrices();
    isInitialized.current = true;
  }, [count, instances]);

  useLayoutEffect(() => {
    if (!barLinesRef.current || barLineData.count === 0) return;
    barLineData.instances.forEach((time, i) => {
      const x = time * zoomX;
      tempObject.position.set(x, 0, -2);
      tempObject.scale.set(0.05, viewport.height * 2, 1);
      tempObject.updateMatrix();
      barLinesRef.current.setMatrixAt(i, tempObject.matrix);
      barLinesRef.current.setColorAt(i, new THREE.Color(1, 1, 1));
    });
    barLinesRef.current.instanceMatrix.needsUpdate = true;
  }, [barLineData, zoomX, viewport.height]);

  // 辅助：强制刷新所有矩阵
  const updateAllMatrices = () => {
    if (!meshRef.current || !glowRef.current) return;
    instances.forEach((data, i) => {
      tempObject.position.set(data.x + data.w / 2, data.y, 0);
      tempObject.scale.set(data.w, data.h, 1);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);

      const glowPadding = 0.5 * data.velScale;
      const glowW = data.w + glowPadding;
      const glowH = data.h * 4.0 * data.velScale;
      tempObject.position.set(data.x + data.w / 2, data.y, -0.01);
      tempObject.scale.set(glowW, glowH, 1);
      tempObject.updateMatrix();
      glowRef.current.setMatrixAt(i, tempObject.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
  };

  // 4. Animation Loop
  useFrame(() => {
    if (!meshRef.current || !glowRef.current || !groupRef.current) return;

    // 如果发现还没初始化（比如刚切换回来），强制跑一次全量更新
    // 这解决了 React 调度导致的 useLayoutEffect 偶尔失效或 WebGL 上下文重建的问题
    if (!isInitialized.current && count > 0) {
      updateAllMatrices();
      isInitialized.current = true;
    }

    const currentTime = useStore.getState().currentTime;
    const currentX = currentTime * zoomX;

    if (followCursor) {
      const screenLeft = -viewport.width / 2;
      const screenOffset = viewport.width * playheadOffsetRatio;
      groupRef.current.position.x = -currentX + screenLeft + screenOffset;
    }

    if (playheadRef.current && showPlayhead) {
      playheadRef.current.position.x = currentX;
    }

    const screenLeftX = currentX - (viewport.width * (1 - playheadOffsetRatio)) - 50;
    const screenRightX = currentX + (viewport.width * playheadOffsetRatio) + 50;

    const startIdx = findStartIndex(instances, screenLeftX);
    const endIdx = findEndIndex(instances, screenRightX, startIdx);

    let needsMatrixUpdate = false;

    for (let i = startIdx; i < endIdx; i++) {
      const data = instances[i];

      // 可见性逻辑
      if (!visibleTrackIndices.includes(data.trackIndex)) {
        meshRef.current.getMatrixAt(i, tempObject.matrix);
        tempObject.matrix.decompose(tempObject.position, tempObject.quaternion, tempObject.scale);

        if (tempObject.scale.x !== 0) {
          tempObject.scale.set(0, 0, 0);
          tempObject.updateMatrix();
          meshRef.current.setMatrixAt(i, tempObject.matrix);
          glowRef.current.setMatrixAt(i, tempObject.matrix);
          needsMatrixUpdate = true;
        }
        continue;
      }

      meshRef.current.getMatrixAt(i, tempObject.matrix);
      tempObject.matrix.decompose(tempObject.position, tempObject.quaternion, tempObject.scale);

      if (tempObject.scale.x === 0) {
        // 恢复时必须重新设置 Position，否则它会呆在 (0,0,0)
        tempObject.position.set(data.x + data.w / 2, data.y, 0);
        tempObject.scale.set(data.w, data.h, 1);
        tempObject.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObject.matrix);

        const glowPadding = 0.5 * data.velScale;
        const glowW = data.w + glowPadding;
        const glowH = data.h * 4.0 * data.velScale;
        tempObject.position.z = -0.01;
        tempObject.scale.set(glowW, glowH, 1);
        tempObject.updateMatrix();
        glowRef.current.setMatrixAt(i, tempObject.matrix);

        needsMatrixUpdate = true;
      }

      // 颜色逻辑
      const isPlaying = currentTime >= data.time && currentTime < (data.time + data.duration);
      const isPast = (data.time + data.duration) < currentTime;

      if (isPlaying) {
        if (isLight) {
          tempColor.copy(data.baseColor);
          const hsl = { h: 0, s: 0, l: 0 };
          tempColor.getHSL(hsl);
          tempColor.setHSL(hsl.h, 1.0, 0.45);
          meshRef.current.setColorAt(i, tempColor);
          glowRef.current.setColorAt(i, isGlowEnabled ? data.baseColor : whiteColor);
        } else {
          const velBoost = 1 + data.velocity;
          tempColor.copy(data.baseColor).multiplyScalar((isGlowEnabled ? 4.0 : 1.5) * velBoost);
          tempColor.lerp(whiteColor, 0.5 * data.velocity);
          meshRef.current.setColorAt(i, tempColor);
          glowRef.current.setColorAt(i, blackColor);
        }
      } else {
        glowRef.current.setColorAt(i, isLight ? whiteColor : blackColor);
        if (isLight) {
          if (isPast) { tempColor.copy(data.baseColor).lerp(whiteColor, 0.7); }
          else { tempColor.copy(data.baseColor).lerp(whiteColor, 0.2); }
          meshRef.current.setColorAt(i, tempColor);
        } else {
          const dimFactor = isPast ? 0.1 : 0.3;
          tempColor.copy(data.baseColor).multiplyScalar(dimFactor);
          meshRef.current.setColorAt(i, tempColor);
        }
      }
    }

    meshRef.current.instanceColor.needsUpdate = true;
    glowRef.current.instanceColor.needsUpdate = true;

    if (needsMatrixUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      glowRef.current.instanceMatrix.needsUpdate = true;
    }

    if (barLinesRef.current) {
      const barColor = isLight ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 1, 1);
      for (let i = 0; i < barLineData.count; i++) {
        barLinesRef.current.setColorAt(i, barColor);
      }
      barLinesRef.current.instanceColor.needsUpdate = true;
    }
  });

  const handlePointerDown = (e) => {
    if (!enableClickToSeek || !midiData) return;
    e.stopPropagation();
    const groupX = groupRef.current.position.x;
    const localX = e.point.x - groupX;
    const targetTime = localX / zoomX;
    if (targetTime >= 0 && targetTime <= midiData.duration) {
      audioEngine.seek(targetTime);
      useStore.getState().setCurrentTime(targetTime);
    }
  };

  return (
    <group ref={groupRef}>
      {enableClickToSeek && (
        <mesh position={[midiData ? (midiData.duration * zoomX) / 2 : 0, 0, -1]} onPointerDown={handlePointerDown} visible={false}>
          <planeGeometry args={[midiData ? midiData.duration * zoomX * 1.5 : 100, 10000]} />
        </mesh>
      )}

      {showBarLines && (
        <instancedMesh ref={barLinesRef} args={[null, null, barLineData.count]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={isLight ? "black" : "white"} transparent opacity={0.1} depthWrite={false} />
        </instancedMesh>
      )}

      <instancedMesh ref={glowRef} args={[null, null, count]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTexture} transparent opacity={0.8} depthWrite={false} blending={THREE.NormalBlending} />
      </instancedMesh>

      <instancedMesh ref={meshRef} args={[null, null, count]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <mesh position={[0, 0, 1]} ref={playheadRef} visible={showPlayhead}>
        <planeGeometry args={[0.05, 1000]} />
        <meshBasicMaterial color={isLight ? "black" : "white"} transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

export default MidiScene;
