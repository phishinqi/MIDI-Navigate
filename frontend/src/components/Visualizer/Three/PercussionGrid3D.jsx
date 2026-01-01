// frontend/src/components/Visualizer/PercussionGrid3D.jsx
import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../../../store/useStore.js';
import { getDrumVisuals } from '../../../lib/percussionMap.js';
import { GridSliceMaterial } from '../../../shaders/GridSliceShader.js';

// --- 常量定义 ---
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
// 闪光颜色：超亮的白色，配合 Bloom 产生爆发感
const flashColor = new THREE.Color(2.5, 2.5, 2.5);

const PercussionGrid3D = () => {
  const meshRef0 = useRef();
  const meshRef1 = useRef();
  const lastBarIndex = useRef(-1);

  const { viewport } = useThree();

  const midiData = useStore(state => state.midiData);
  const currentTime = useStore(state => state.currentTime);
  const isPlaying = useStore(state => state.isPlaying);

  const { enabled, rows, cols, cellSize, spacing, positionY, positionZ } = useStore(state => state.percussionSettings);

  const meshKey = `grid-slice-${rows}-${cols}`;

  // 1. 数据解析 - 将 MIDI 转换为基于小节(Bar)的步进数据
  const barData = useMemo(() => {
    if (!midiData) return [];
    let drumNotes = [];

    // 筛选所有打击乐轨道
    midiData.tracks.forEach((t) => {
        const name = (t.name || "").toLowerCase();
        const inst = t.instrument || {};
        const instName = (inst.name || "").toLowerCase();
        const isDrum = name.includes('drum') || name.includes('perc') ||
                       instName.includes('drum') || instName.includes('perc') ||
                       inst.percussion === true || inst.family === 'Drums' ||
                       (t.channel === 9 || t.channel === 10);
        if (isDrum && t.notes) {
            t.notes.forEach(n => drumNotes.push(n));
        }
    });

    if (drumNotes.length === 0) return [];
    drumNotes.sort((a, b) => a.time - b.time);

    // 获取 BPM 和 拍号信息
    const tempos = midiData.header.tempos || [];
    const signatures = midiData.header.timeSignatures || [];
    const defaultBpm = tempos.length > 0 ? tempos[0].bpm : 120;
    const defaultSig = signatures.length > 0 ? signatures[0].timeSignature : [4, 4];

    // 辅助函数：Tick 转 Seconds
    const getSecondsAtTick = (tick) => {
        if (tempos.length === 0) return tick * (60 / (120 * 480));
        let time = 0; let lastTick = 0; let lastBpm = tempos[0].bpm;
        for (let i = 0; i < tempos.length; i++) {
            if (tempos[i].ticks > tick) break;
            const dt = tempos[i].ticks - lastTick;
            time += dt * (60 / (lastBpm * midiData.header.ppq));
            lastTick = tempos[i].ticks;
            lastBpm = tempos[i].bpm;
        }
        const dt = tick - lastTick;
        time += dt * (60 / (lastBpm * midiData.header.ppq));
        return time;
    };

    const bars = [];
    const duration = midiData.duration || 0;

    // 简单的防止死循环
    if ((60 / defaultBpm) * defaultSig[0] <= 0) return [];

    let currentTick = 0;
    let barIndex = 0;
    let safetyLoop = 0;

    // 分割小节
    while (safetyLoop < 3000) {
        let currentSig = defaultSig;
        for (let i = signatures.length - 1; i >= 0; i--) {
            if (signatures[i].ticks <= currentTick) {
                currentSig = signatures[i].timeSignature;
                break;
            }
        }
        const [num, den] = currentSig;
        const ticksPerBar = (num / den) * 4 * midiData.header.ppq;
        const start = getSecondsAtTick(currentTick);
        const end = getSecondsAtTick(currentTick + ticksPerBar);

        if (start > duration + 1) break;

        // 获取当前小节内的音符并量化合并
        const rawNotes = drumNotes.filter(n => n.time >= start && n.time < end);
        const steps = [];
        if (rawNotes.length > 0) {
            let currentStep = { time: rawNotes[0].time, notes: [rawNotes[0]] };
            for (let k = 1; k < rawNotes.length; k++) {
                const note = rawNotes[k];
                if (note.time - currentStep.time < 0.035) { // 35ms 内视为同时触发
                    currentStep.notes.push(note);
                } else {
                    steps.push(currentStep);
                    currentStep = { time: note.time, notes: [note] };
                }
            }
            steps.push(currentStep);
        }
        // 确保每个步骤里的音符按音高排序（为了视觉一致性）
        steps.forEach(step => step.notes.sort((a, b) => a.midi - b.midi));

        bars.push({ start, end, index: barIndex, steps });
        currentTick += ticksPerBar; barIndex++; safetyLoop++;
    }
    return bars;
  }, [midiData]);

  // 2. 布局初始化
  useLayoutEffect(() => {
      if (!enabled) return;

      // 计算自适应缩放和中心位置
      const desiredWidth = cols * cellSize + (cols - 1) * spacing;
      const safeAreaWidth = viewport.width * 0.9;
      let scaleFactor = 1;
      if (desiredWidth > safeAreaWidth) {
          scaleFactor = safeAreaWidth / desiredWidth;
      }
      const effectiveCellSize = cellSize * scaleFactor;
      const effectiveSpacing = spacing * scaleFactor;

      const totalWidth = cols * effectiveCellSize + (cols - 1) * effectiveSpacing;
      const totalHeight = rows * effectiveCellSize + (rows - 1) * effectiveSpacing;

      // 垂直位置计算
      const sliderMin = -15; const sliderMax = 10;
      const normalizedY = (positionY - sliderMin) / (sliderMax - sliderMin);
      const paddingY = 0.5;
      const minY = -viewport.height / 2 + totalHeight / 2 + paddingY;
      const maxY = viewport.height / 2 - totalHeight / 2 - paddingY;
      const finalGridCenterY = minY + normalizedY * Math.max(0, maxY - minY);

      // 初始化两个 Mesh 的 Instance
      [meshRef0, meshRef1].forEach(ref => {
          if (!ref.current) return;
          const count = rows * cols;
          const geometry = ref.current.geometry;

          // 初始化属性 Attribute
          if (!geometry.getAttribute('colorA')) {
              geometry.setAttribute('colorA', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
              geometry.setAttribute('colorB', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
              geometry.setAttribute('colorC', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
              geometry.setAttribute('colorD', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
              geometry.setAttribute('count', new THREE.InstancedBufferAttribute(new Float32Array(count).fill(0), 1));
              geometry.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(new Float32Array(count).fill(0), 1));
          }

          const startX = -totalWidth / 2 + effectiveCellSize / 2;
          const startY = -totalHeight / 2 + effectiveCellSize / 2;

          for (let i = 0; i < count; i++) {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const visualRow = rows - 1 - r;

              const x = startX + c * (effectiveCellSize + effectiveSpacing);
              const y = startY + visualRow * (effectiveCellSize + effectiveSpacing);

              tempObject.position.set(x, y + finalGridCenterY, positionZ);
              tempObject.scale.set(effectiveCellSize, effectiveCellSize, 1);
              tempObject.updateMatrix();
              ref.current.setMatrixAt(i, tempObject.matrix);
          }
          ref.current.instanceMatrix.needsUpdate = true;
      });
  }, [rows, cols, cellSize, spacing, positionY, positionZ, enabled, viewport.width, viewport.height]);

  // 3. 渲染循环
  useFrame(() => {
    if (!enabled || !meshRef0.current || !meshRef1.current || barData.length === 0) return;

    // 停止播放时重置
    if (!isPlaying && currentTime === 0) {
        lastBarIndex.current = -1;
        [meshRef0, meshRef1].forEach(ref => {
            const count = rows * cols;
            const countAttr = ref.current.geometry?.getAttribute('count');
            const alphaAttr = ref.current.geometry?.getAttribute('instanceAlpha');
            if (countAttr) {
                for(let k=0; k<count; k++) { countAttr.setX(k, 0); alphaAttr.setX(k, 0); }
                countAttr.needsUpdate = true;
                alphaAttr.needsUpdate = true;
            }
        });
        return;
    }

    // 双缓冲逻辑：决定哪个是 Active，哪个是 Fading
    const activeBar = barData.find(b => currentTime >= b.start && currentTime < b.end);
    const currentBarIndex = activeBar ? activeBar.index : -1;
    const activeMesh = (currentBarIndex % 2 === 0) ? meshRef0.current : meshRef1.current;
    const fadingMesh = (currentBarIndex % 2 === 0) ? meshRef1.current : meshRef0.current;
    const maxCells = rows * cols;

    // --- 预计算每一帧的布局参数 (为了在循环中计算物理回弹位置) ---
    // 注意：这里简单复用 LayoutEffect 的逻辑。在高性能场景下可以将这些值存为 ref
    const desiredWidth = cols * cellSize + (cols - 1) * spacing;
    const safeAreaWidth = viewport.width * 0.9;
    const scaleFactor = desiredWidth > safeAreaWidth ? safeAreaWidth / desiredWidth : 1;
    const effectiveCellSize = cellSize * scaleFactor;
    const effectiveSpacing = spacing * scaleFactor;
    const totalWidth = cols * effectiveCellSize + (cols - 1) * effectiveSpacing;
    const totalHeight = rows * effectiveCellSize + (rows - 1) * effectiveSpacing;
    const startX = -totalWidth / 2 + effectiveCellSize / 2;
    const startY = -totalHeight / 2 + effectiveCellSize / 2;

    const sliderMin = -15; const sliderMax = 10;
    const normalizedY = (positionY - sliderMin) / (sliderMax - sliderMin);
    const paddingY = 0.5;
    const minY = -viewport.height / 2 + totalHeight / 2 + paddingY;
    const maxY = viewport.height / 2 - totalHeight / 2 - paddingY;
    const finalGridCenterY = minY + normalizedY * Math.max(0, maxY - minY);

    // --- 处理活跃网格 (Active Mesh) ---
    if (activeBar && activeMesh.geometry) {
        const { geometry } = activeMesh;
        const countAttr = geometry.getAttribute('count');
        const alphaAttr = geometry.getAttribute('instanceAlpha');
        const [cA, cB, cC, cD] = ['colorA', 'colorB', 'colorC', 'colorD'].map(n => geometry.getAttribute(n));

        // 切换小节时重置状态
        if (currentBarIndex !== lastBarIndex.current) {
            for(let i=0; i<maxCells; i++) {
                countAttr.setX(i, 0);
                alphaAttr.setX(i, 0);
                // 重置矩阵到初始状态 (必须，否则上一轮缩放的格子会卡住)
                const r = Math.floor(i / cols);
                const c = i % cols;
                const visualRow = rows - 1 - r;
                const x = startX + c * (effectiveCellSize + effectiveSpacing);
                const y = startY + visualRow * (effectiveCellSize + effectiveSpacing);

                tempObject.position.set(x, y + finalGridCenterY, positionZ);
                tempObject.scale.set(effectiveCellSize, effectiveCellSize, 1);
                tempObject.updateMatrix();
                activeMesh.setMatrixAt(i, tempObject.matrix);
            }
            activeMesh.instanceMatrix.needsUpdate = true;
            countAttr.needsUpdate = true;
            alphaAttr.needsUpdate = true;
            lastBarIndex.current = currentBarIndex;
        }

        // 计算当前所有步进
        const activeStepsCount = activeBar.steps.filter(s => s.time <= currentTime).length;
        const cellStates = new Array(maxCells).fill(null);
        for (let k = 0; k < activeStepsCount; k++) {
            cellStates[k % maxCells] = activeBar.steps[k];
        }

        let matrixNeedsUpdate = false;
        let colorNeedsUpdate = false;

        for (let i = 0; i < maxCells; i++) {
            const step = cellStates[i];

            const r = Math.floor(i / cols);
            const c = i % cols;
            const visualRow = rows - 1 - r;
            const baseX = startX + c * (effectiveCellSize + effectiveSpacing);
            const baseY = startY + visualRow * (effectiveCellSize + effectiveSpacing);

            if (step) {
                const age = currentTime - step.time;

                // 1. 设置乐器数量 (Count)
                if (countAttr.getX(i) !== Math.min(step.notes.length, 4)) {
                    countAttr.setX(i, Math.min(step.notes.length, 4));
                    countAttr.needsUpdate = true;
                }

                // 2. 物理动画 (Matrix Physics)
                // 指数衰减 Punch: 触发瞬间 1.0 -> 随时间迅速归零
                const punch = Math.exp(-age * 12);
                const scaleAnim = 1.0 + punch * 0.4;
                const zAnim = punch * 0.5;

                tempObject.position.set(baseX, baseY + finalGridCenterY, positionZ + zAnim);
                tempObject.scale.set(effectiveCellSize * scaleAnim, effectiveCellSize * scaleAnim, 1);
                tempObject.updateMatrix();
                activeMesh.setMatrixAt(i, tempObject.matrix);
                matrixNeedsUpdate = true;

                // 3. 颜色动画 (Color Heat)
                const slots = [cA, cB, cC, cD];
                for (let k = 0; k < 4; k++) {
                    if (k < step.notes.length) {
                        const baseColorHex = getDrumVisuals(step.notes[k].midi).color;
                        tempColor.set(baseColorHex);

                        // 颜色热量衰减：前 0.12秒 混合白色
                        if (age < 0.12) {
                            const flashAmt = 1.0 - (age / 0.12);
                            tempColor.lerp(flashColor, flashAmt);
                        }

                        // 简单的脏检查，减少 GPU 总线压力
                        if (Math.abs(slots[k].getX(i) - tempColor.r) > 0.001) {
                            slots[k].setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
                            colorNeedsUpdate = true;
                        }
                    }
                }

                // 4. Alpha
                if (alphaAttr.getX(i) !== 1) {
                    alphaAttr.setX(i, 1);
                    alphaAttr.needsUpdate = true;
                }

            } else {
                // 未激活的格子：不做矩阵更新，以节省性能 (除非你需要它们有呼吸效果)
                if (countAttr.getX(i) !== 0) {
                    countAttr.setX(i, 0);
                    countAttr.needsUpdate = true;
                }
            }
        }

        if (matrixNeedsUpdate) activeMesh.instanceMatrix.needsUpdate = true;
        if (colorNeedsUpdate) [cA, cB, cC, cD].forEach(a => a.needsUpdate = true);
    }

    // --- 处理淡出网格 (Fading Mesh) ---
    if (fadingMesh?.geometry) {
        const alphaAttr = fadingMesh.geometry.getAttribute('instanceAlpha');
        const countAttr = fadingMesh.geometry.getAttribute('count');

        if (alphaAttr && countAttr) {
            let needsFadeUpdate = false;
            let needsMatrixUpdate = false;

            for (let i = 0; i < maxCells; i++) {
                let alpha = alphaAttr.getX(i);
                if (alpha > 0) {
                    // 每一帧减少透明度
                    alpha = Math.max(0, alpha - 0.08);
                    alphaAttr.setX(i, alpha);

                    fadingMesh.getMatrixAt(i, tempObject.matrix);
                    tempObject.matrix.decompose(tempObject.position, tempObject.quaternion, tempObject.scale);

                    tempObject.scale.multiplyScalar(0.92);
                    tempObject.position.z -= 0.02;

                    tempObject.updateMatrix();
                    fadingMesh.setMatrixAt(i, tempObject.matrix);

                    if (alpha === 0) countAttr.setX(i, 0);

                    needsFadeUpdate = true;
                    needsMatrixUpdate = true;
                }
            }
            if (needsFadeUpdate) {
                alphaAttr.needsUpdate = true;
                countAttr.needsUpdate = true;
            }
            if (needsMatrixUpdate) {
                fadingMesh.instanceMatrix.needsUpdate = true;
            }
        }
    }
  });

  if (!enabled) return null;

  return (
    <>
        <instancedMesh key={`${meshKey}-0`} ref={meshRef0} args={[null, null, rows * cols]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            {/* 传递 Uniforms 控制 Shader 效果 */}
            <primitive
                object={GridSliceMaterial}
                attach="material"
                uniforms-uGap-value={0.04}
                uniforms-uIntensity-value={3.0}
                uniforms-uGlowFalloff-value={0.4}
            />
        </instancedMesh>
        <instancedMesh key={`${meshKey}-1`} ref={meshRef1} args={[null, null, rows * cols]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <primitive
                object={GridSliceMaterial}
                attach="material"
                uniforms-uGap-value={0.04}
                uniforms-uIntensity-value={3.0}
                uniforms-uGlowFalloff-value={0.4}
            />
        </instancedMesh>
    </>
  );
};

export default PercussionGrid3D;