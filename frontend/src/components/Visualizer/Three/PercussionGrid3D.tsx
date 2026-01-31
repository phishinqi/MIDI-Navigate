import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../../../store/useStore.js';
import { getDrumVisuals } from '../../../lib/percussionMap.js';
import { GridSliceMaterial } from '../../../shaders/GridSliceShader.js';

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const flashColor = new THREE.Color(2.5, 2.5, 2.5);

const PercussionGrid3D = () => {
    const meshRef0 = useRef<THREE.InstancedMesh>(null);
    const meshRef1 = useRef<THREE.InstancedMesh>(null);
    const lastBarIndex = useRef(-1);

    const { viewport } = useThree();

    const midiData = useStore(state => state.midiData);
    const currentTime = useStore(state => state.currentTime);
    const isPlaying = useStore(state => state.isPlaying);

    const { enabled, rows, cols, cellSize, spacing, positionY, positionZ } = useStore(state => state.percussionSettings);

    const meshKey = `grid-slice-${rows}-${cols}`;

    const barData = useMemo(() => {
        if (!midiData) return [];
        let drumNotes = [];

        // Filter all percussion tracks
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

        // Get BPM and Time Signature
        const tempos = midiData.header.tempos || [];
        const signatures = midiData.header.timeSignatures || [];
        const defaultBpm = tempos.length > 0 ? tempos[0].bpm : 120;
        const defaultSig = signatures.length > 0 ? signatures[0].timeSignature : [4, 4];

        // Helper: Tick to Seconds
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

        // Prevent infinite loop
        if ((60 / defaultBpm) * defaultSig[0] <= 0) return [];

        let currentTick = 0;
        let barIndex = 0;
        let safetyLoop = 0;

        // Split Bars
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

            // Quantize and merge notes within the bar
            const rawNotes = drumNotes.filter(n => n.time >= start && n.time < end);
            const steps = [];
            if (rawNotes.length > 0) {
                let currentStep = { time: rawNotes[0].time, notes: [rawNotes[0]] };
                for (let k = 1; k < rawNotes.length; k++) {
                    const note = rawNotes[k];
                    if (note.time - currentStep.time < 0.035) { // 35ms threshold
                        currentStep.notes.push(note);
                    } else {
                        steps.push(currentStep);
                        currentStep = { time: note.time, notes: [note] };
                    }
                }
                steps.push(currentStep);
            }
            // Sort notes in each step by pitch
            steps.forEach(step => step.notes.sort((a, b) => a.midi - b.midi));

            bars.push({ start, end, index: barIndex, steps });
            currentTick += ticksPerBar; barIndex++; safetyLoop++;
        }
        return bars;
    }, [midiData]);

    useLayoutEffect(() => {
        if (!enabled) return;

        // Calculate adaptive scaling and center position
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

        // Vertical position calculation
        const sliderMin = -15; const sliderMax = 10;
        const normalizedY = (positionY - sliderMin) / (sliderMax - sliderMin);
        const paddingY = 0.5;
        const minY = -viewport.height / 2 + totalHeight / 2 + paddingY;
        const maxY = viewport.height / 2 - totalHeight / 2 - paddingY;
        const finalGridCenterY = minY + normalizedY * Math.max(0, maxY - minY);

        // Initialize Mesh Instances
        [meshRef0, meshRef1].forEach(ref => {
            if (!ref.current) return;
            const count = rows * cols;
            const geometry = ref.current.geometry;

            // Initialize Attributes
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

    useFrame(() => {
        if (!enabled || !meshRef0.current || !meshRef1.current || barData.length === 0) return;

        // Reset on stop
        if (!isPlaying && currentTime === 0) {
            lastBarIndex.current = -1;
            [meshRef0, meshRef1].forEach(ref => {
                const count = rows * cols;
                const countAttr = ref.current.geometry?.getAttribute('count');
                const alphaAttr = ref.current.geometry?.getAttribute('instanceAlpha');
                if (countAttr) {
                    for (let k = 0; k < count; k++) { countAttr.setX(k, 0); alphaAttr.setX(k, 0); }
                    countAttr.needsUpdate = true;
                    alphaAttr.needsUpdate = true;
                }
            });
            return;
        }

        // Double buffering logic: Active vs Fading
        const activeBar = barData.find(b => currentTime >= b.start && currentTime < b.end);
        const currentBarIndex = activeBar ? activeBar.index : -1;
        const activeMesh = (currentBarIndex % 2 === 0) ? meshRef0.current : meshRef1.current;
        const fadingMesh = (currentBarIndex % 2 === 0) ? meshRef1.current : meshRef0.current;
        const maxCells = rows * cols;

        // --- Pre-calculate layout parameters per frame ---
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

        // --- Process Active Mesh ---
        if (activeBar && activeMesh.geometry) {
            const { geometry } = activeMesh;
            const countAttr = geometry.getAttribute('count');
            const alphaAttr = geometry.getAttribute('instanceAlpha');
            const [cA, cB, cC, cD] = ['colorA', 'colorB', 'colorC', 'colorD'].map(n => geometry.getAttribute(n));

            // Reset state on bar switch
            if (currentBarIndex !== lastBarIndex.current) {
                for (let i = 0; i < maxCells; i++) {
                    countAttr.setX(i, 0);
                    alphaAttr.setX(i, 0);
                    // Reset matrix to initial state
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

            // Calculate active steps
            const activeStepsCount = activeBar.steps.filter(s => s.time <= currentTime).length;
            const cellStates = new Array(maxCells).fill(null);
            for (let k = 0; k < activeStepsCount; k++) {
                cellStates[k % maxCells] = activeBar.steps[k];
            }

            let matrixNeedsUpdate = false;
            let colorNeedsUpdate = false;

            for (let i = 0; i < maxCells; i++) {
                const step = cellStates[i];

                // Calculate base physics position
                const r = Math.floor(i / cols);
                const c = i % cols;
                const visualRow = rows - 1 - r;
                const baseX = startX + c * (effectiveCellSize + effectiveSpacing);
                const baseY = startY + visualRow * (effectiveCellSize + effectiveSpacing);

                if (step) {
                    const age = currentTime - step.time;

                    // 1. Set Instrument Count
                    if (countAttr.getX(i) !== Math.min(step.notes.length, 4)) {
                        countAttr.setX(i, Math.min(step.notes.length, 4));
                        countAttr.needsUpdate = true;
                    }

                    // 2. Physics Animation (Punch)
                    // Exponential decay punch
                    const punch = Math.exp(-age * 12);
                    const scaleAnim = 1.0 + punch * 0.4; // Scale up 1.4x instantaneously
                    const zAnim = punch * 0.5; // Pop forward

                    tempObject.position.set(baseX, baseY + finalGridCenterY, positionZ + zAnim);
                    tempObject.scale.set(effectiveCellSize * scaleAnim, effectiveCellSize * scaleAnim, 1);
                    tempObject.updateMatrix();
                    activeMesh.setMatrixAt(i, tempObject.matrix);
                    matrixNeedsUpdate = true;

                    // 3. Color Animation (Heat)
                    const slots = [cA, cB, cC, cD];
                    for (let k = 0; k < 4; k++) {
                        if (k < step.notes.length) {
                            const baseColorHex = getDrumVisuals(step.notes[k].midi).color;
                            tempColor.set(baseColorHex);

                            // Heat decay: flash white for first 0.12s
                            if (age < 0.12) {
                                const flashAmt = 1.0 - (age / 0.12);
                                tempColor.lerp(flashColor, flashAmt);
                            }

                            // Simple dirty check
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
                    // Inactive cells: skip matrix update to save performance
                    if (countAttr.getX(i) !== 0) {
                        countAttr.setX(i, 0);
                        countAttr.needsUpdate = true;
                    }
                }
            }

            if (matrixNeedsUpdate) activeMesh.instanceMatrix.needsUpdate = true;
            if (colorNeedsUpdate) [cA, cB, cC, cD].forEach(a => a.needsUpdate = true);
        }

        // --- Process Fading Mesh ---
        if (fadingMesh?.geometry) {
            const alphaAttr = fadingMesh.geometry.getAttribute('instanceAlpha');
            const countAttr = fadingMesh.geometry.getAttribute('count');

            if (alphaAttr && countAttr) {
                let needsFadeUpdate = false;
                let needsMatrixUpdate = false;

                for (let i = 0; i < maxCells; i++) {
                    let alpha = alphaAttr.getX(i);
                    if (alpha > 0) {
                        // Fade out opacity
                        alpha = Math.max(0, alpha - 0.08);
                        alphaAttr.setX(i, alpha);

                        // Disappear effect: shrink and retreat
                        fadingMesh.getMatrixAt(i, tempObject.matrix);
                        tempObject.matrix.decompose(tempObject.position, tempObject.quaternion, tempObject.scale);

                        tempObject.scale.multiplyScalar(0.92); // Shrink
                        tempObject.position.z -= 0.02; // Retreat

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
                {/* Pass Uniforms */}
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