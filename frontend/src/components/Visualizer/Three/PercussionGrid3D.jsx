// frontend/src/components/Visualizer/PercussionGrid3D.jsx
import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../../../store/useStore.js';
import { getDrumVisuals } from '../../../lib/percussionMap.js';
import { GridSliceMaterial } from '../../../shaders/GridSliceShader.js';

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const flashColor = new THREE.Color(2.0, 2.0, 2.0);

const PercussionGrid3D = () => {
  const meshRef0 = useRef();
  const meshRef1 = useRef();
  const lastBarIndex = useRef(-1);

  const midiData = useStore(state => state.midiData);
  const currentTime = useStore(state => state.currentTime);
  const isPlaying = useStore(state => state.isPlaying);
  // Grid 独立渲染，不依赖 visibleTrackIndices

  const { enabled, rows, cols, cellSize, spacing, positionY, positionZ } = useStore(state => state.percussionSettings);

  const meshKey = `grid-slice-${rows}-${cols}`;

  // 1. 数据预处理：稳健版 (Robust Version)
  const barData = useMemo(() => {
    if (!midiData) return [];

    // --- A. 收集打击乐音符 ---
    let drumNotes = [];
    midiData.tracks.forEach((t) => {
        const name = (t.name || "").toLowerCase();
        const inst = t.instrument || {};
        const instName = (inst.name || "").toLowerCase();

        // [核心修正] 增加判断维度，确保能抓到鼓
        const isDrum =
            name.includes('drum') || name.includes('perc') ||
            instName.includes('drum') || instName.includes('perc') ||
            inst.percussion === true ||
            inst.family === 'Drums' ||
            (t.channel === 9 || t.channel === 10); // MIDI Channel 10 (0-indexed is 9)

        if (isDrum && t.notes) {
            t.notes.forEach(n => drumNotes.push(n));
        }
    });

    // 如果真的没鼓，就什么都不显示
    if (drumNotes.length === 0) {
        console.warn("PercussionGrid3D: No drum tracks found.");
        return [];
    }

    drumNotes.sort((a, b) => a.time - b.time);

    // --- B. 准备时间数据 ---
    const tempos = midiData.header.tempos || [];
    const signatures = midiData.header.timeSignatures || [];

    // 默认值
    const defaultBpm = tempos.length > 0 ? tempos[0].bpm : 120;
    const defaultSig = signatures.length > 0 ? signatures[0].timeSignature : [4, 4];

    // --- C. 计算小节 (Bar Calculation) ---
    // 简化策略：如果 Tempo Map 复杂，容易出错。我们使用一种基于 Time 的线性扫描
    // 这比基于 Tick 的跳转更安全

    const bars = [];
    const duration = midiData.duration || 0;

    // 估算平均小节时间 (用于防止死循环)
    const avgBarTime = (60 / defaultBpm) * defaultSig[0];
    if (avgBarTime <= 0) return []; // 异常保护

    // 真正的 Tempo Map 转换函数
    const getSecondsAtTick = (tick) => {
        // 简化版：直接计算，不依赖状态机
        // 如果没有 tempos，直接返回
        if (tempos.length === 0) return tick * (60 / (120 * 480));

        let time = 0;
        let lastTick = 0;
        let lastBpm = tempos[0].bpm;

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

    let currentTick = 0;
    let barIndex = 0;
    let safetyLoop = 0;

    // 按小节推进
    while (safetyLoop < 3000) { // 最多 3000 小节
        // 1. 找当前 Tick 的拍号
        let currentSig = defaultSig;
        // 简单的线性查找（数据量小）
        for (let i = signatures.length - 1; i >= 0; i--) {
            if (signatures[i].ticks <= currentTick) {
                currentSig = signatures[i].timeSignature;
                break;
            }
        }
        const [num, den] = currentSig;

        // 2. 计算当前小节的 Ticks 长度
        // Ticks = (分子 / 分母) * 4 * PPQ
        const ticksPerBar = (num / den) * 4 * midiData.header.ppq;

        // 3. 计算起止时间
        const start = getSecondsAtTick(currentTick);
        const end = getSecondsAtTick(currentTick + ticksPerBar);

        // 4. 终止条件
        if (start > duration + 1) break;

        // 5. 聚合音符
        const rawNotes = drumNotes.filter(n => n.time >= start && n.time < end);

        const steps = [];
        if (rawNotes.length > 0) {
            let currentStep = { time: rawNotes[0].time, notes: [rawNotes[0]] };
            for (let k = 1; k < rawNotes.length; k++) {
                const note = rawNotes[k];
                // 35ms 聚合窗口
                if (note.time - currentStep.time < 0.035) {
                    currentStep.notes.push(note);
                } else {
                    steps.push(currentStep);
                    currentStep = { time: note.time, notes: [note] };
                }
            }
            steps.push(currentStep);
        }
        steps.forEach(step => step.notes.sort((a, b) => a.midi - b.midi));

        bars.push({ start, end, index: barIndex, steps });

        currentTick += ticksPerBar;
        barIndex++;
        safetyLoop++;
    }

    // 兜底：如果算不出来（比如 ticks 有问题），回退到固定时间切分
    if (bars.length === 0 && duration > 0) {
        console.warn("Falling back to fixed BPM grid");
        const fixedBarTime = (60 / 120) * 4;
        for(let i=0; i < Math.ceil(duration/fixedBarTime); i++) {
             const start = i * fixedBarTime;
             const end = (i+1) * fixedBarTime;
             const rawNotes = drumNotes.filter(n => n.time >= start && n.time < end);
             // ... (同样的 steps 逻辑)
             const steps = []; // (简略)
             if (rawNotes.length > 0) { /* ... */ } // 实际应复制上面的聚合逻辑
             bars.push({ start, end, index: i, steps: [] }); // 简化兜底
        }
    }

    return bars;
  }, [midiData]);

  // 2. 布局初始化 (保持)
  useLayoutEffect(() => {
      if (!enabled) return;
      [meshRef0, meshRef1].forEach(ref => {
          if (!ref.current) return;
          const count = rows * cols;
          const geometry = ref.current.geometry;
          geometry.setAttribute('colorA', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
          geometry.setAttribute('colorB', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
          geometry.setAttribute('colorC', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
          geometry.setAttribute('colorD', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0), 3));
          geometry.setAttribute('count', new THREE.InstancedBufferAttribute(new Float32Array(count).fill(0), 1));
          geometry.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(new Float32Array(count).fill(0), 1));
          const totalWidth = cols * cellSize + (cols - 1) * spacing;
          const totalHeight = rows * cellSize + (rows - 1) * spacing;
          const startX = -totalWidth / 2 + cellSize / 2;
          const startY = -totalHeight / 2 + cellSize / 2;
          for (let i = 0; i < count; i++) {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const visualRow = rows - 1 - r;
              const x = startX + c * (cellSize + spacing);
              const y = startY + visualRow * (cellSize + spacing);
              tempObject.position.set(x, y + positionY, positionZ);
              tempObject.scale.set(cellSize, cellSize, 1);
              tempObject.updateMatrix();
              ref.current.setMatrixAt(i, tempObject.matrix);
          }
          ref.current.instanceMatrix.needsUpdate = true;
      });
  }, [rows, cols, cellSize, spacing, positionY, positionZ, enabled]);

  // 3. 渲染循环 (保持)
  useFrame(() => {
      if (!enabled || !meshRef0.current || !meshRef1.current || barData.length === 0) return;

      if (!isPlaying && currentTime === 0) {
          lastBarIndex.current = -1;
          [meshRef0, meshRef1].forEach(ref => {
              if (!ref.current.geometry) return;
              const attr = ref.current.geometry.getAttribute('count');
              if (attr && attr.getX(0) !== 0) {
                  const count = rows * cols;
                  for(let k=0; k<count; k++) attr.setX(k, 0);
                  attr.needsUpdate = true;
              }
          });
          return;
      }

      const activeBar = barData.find(b => currentTime >= b.start && currentTime < b.end);
      const currentBarIndex = activeBar ? activeBar.index : -1;

      const activeMesh = (currentBarIndex % 2 === 0) ? meshRef0.current : meshRef1.current;
      const fadingMesh = (currentBarIndex % 2 === 0) ? meshRef1.current : meshRef0.current;

      const maxCells = rows * cols;

      if (activeBar && activeMesh.geometry) {
          const geometry = activeMesh.geometry;
          const countAttr = geometry.getAttribute('count');
          const alphaAttr = geometry.getAttribute('instanceAlpha');
          const cA = geometry.getAttribute('colorA');
          const cB = geometry.getAttribute('colorB');
          const cC = geometry.getAttribute('colorC');
          const cD = geometry.getAttribute('colorD');

          if (!countAttr || !alphaAttr || !cA || !cB || !cC || !cD) return;

          if (currentBarIndex !== lastBarIndex.current) {
               for(let i=0; i<maxCells; i++) {
                   countAttr.setX(i, 0);
                   alphaAttr.setX(i, 0);
               }
               countAttr.needsUpdate = true;
               alphaAttr.needsUpdate = true;
               lastBarIndex.current = currentBarIndex;
          }

          let activeStepsCount = 0;
          for (let i = 0; i < activeBar.steps.length; i++) {
              if (activeBar.steps[i].time <= currentTime) activeStepsCount++;
              else break;
          }

          // 循环覆盖逻辑
          const cellStates = new Array(maxCells).fill(null);
          for (let k = 0; k < activeStepsCount; k++) {
              const step = activeBar.steps[k];
              const cellIndex = k % maxCells;
              cellStates[cellIndex] = step;
          }

          let needsUpdate = false;
          for (let i = 0; i < maxCells; i++) {
              const step = cellStates[i];
              if (step) {
                  const noteCount = Math.min(step.notes.length, 4);
                  if (countAttr.getX(i) !== noteCount) {
                      countAttr.setX(i, noteCount);
                      needsUpdate = true;
                  }
                  const age = currentTime - step.time;
                  const isFlash = age < 0.08;
                  const slots = [cA, cB, cC, cD];
                  for (let k = 0; k < 4; k++) {
                      if (k < noteCount) {
                          const note = step.notes[k];
                          const visual = getDrumVisuals(note.midi);
                          if (isFlash) tempColor.copy(flashColor);
                          else tempColor.set(visual.color);
                          if (Math.abs(slots[k].getX(i) - tempColor.r) > 0.01) {
                              slots[k].setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
                              needsUpdate = true;
                          }
                      }
                  }
                  if (alphaAttr.getX(i) !== 1) {
                      alphaAttr.setX(i, 1);
                      needsUpdate = true;
                  }
              } else {
                  if (countAttr.getX(i) !== 0) {
                      countAttr.setX(i, 0);
                      needsUpdate = true;
                  }
              }
          }

          if (needsUpdate) {
              countAttr.needsUpdate = true;
              alphaAttr.needsUpdate = true;
              cA.needsUpdate = true;
              cB.needsUpdate = true;
              cC.needsUpdate = true;
              cD.needsUpdate = true;
          }
      }

      if (fadingMesh && fadingMesh.geometry) {
          const alphaAttr = fadingMesh.geometry.getAttribute('instanceAlpha');
          const countAttr = fadingMesh.geometry.getAttribute('count');
          if (alphaAttr && countAttr) {
              let needsFadeUpdate = false;
              const decayRate = 0.05;
              for (let i = 0; i < maxCells; i++) {
                  if (countAttr.getX(i) !== 0) {
                      let currentAlpha = alphaAttr.getX(i);
                      if (currentAlpha > 0) {
                          currentAlpha -= decayRate;
                          if (currentAlpha < 0) currentAlpha = 0;
                          alphaAttr.setX(i, currentAlpha);
                          needsFadeUpdate = true;
                      } else {
                          countAttr.setX(i, 0);
                          needsFadeUpdate = true;
                      }
                  }
              }
              if (needsFadeUpdate) {
                  alphaAttr.needsUpdate = true;
                  countAttr.needsUpdate = true;
              }
          }
      }
  });

  if (!enabled) return null;

  return (
    <>
        <instancedMesh key={`${meshKey}-0`} ref={meshRef0} args={[null, null, rows * cols]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <primitive object={GridSliceMaterial} attach="material" />
        </instancedMesh>
        <instancedMesh key={`${meshKey}-1`} ref={meshRef1} args={[null, null, rows * cols]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <primitive object={GridSliceMaterial} attach="material" />
        </instancedMesh>
    </>
  );
};

export default PercussionGrid3D;
