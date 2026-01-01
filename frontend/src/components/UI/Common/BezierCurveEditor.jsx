// frontend/src/components/UI/Common/BezierCurveEditor.jsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';

// 0. CONSTANTS & CONFIG
const SIZE = 180;
const PADDING = 40;
const TOTAL_SIZE = SIZE + PADDING * 2;
const DEFAULT_CURVE = [0.1, 0.85, 0.75, 0.9];

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const kSplineTableSize = 11;
const kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

// 1. SELF-CONTAINED: Cubic Bezier Easing Function Generator
const A = (aA1, aA2) => 1.0 - 3.0 * aA2 + 3.0 * aA1;
const B = (aA1, aA2) => 3.0 * aA2 - 6.0 * aA1;
const C = (aA1) => 3.0 * aA1;

const CalcBezier = (aT, aA1, aA2) => ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
const GetSlope = (aT, aA1, aA2) => 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);

const GetTForX = (aX, mX1, mX2) => {
  let aGuessT = aX;
  for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
    const currentSlope = GetSlope(aGuessT, mX1, mX2);
    if (currentSlope === 0.0) return aGuessT;
    const currentX = CalcBezier(aGuessT, mX1, mX2) - aX;
    aGuessT -= currentX / currentSlope;
  }
  return aGuessT;
};

const createBezier = (mX1, mY1, mX2, mY2) => {
  if (mX1 < 0 || mX1 > 1 || mX2 < 0 || mX2 > 1) {
    // Safeguard for X values. Y can be out of bounds.
  }
  const mSampleValues = new Float32Array(kSplineTableSize);
  if (mX1 !== mY1 || mX2 !== mY2) {
    for (let i = 0; i < kSplineTableSize; ++i) {
      mSampleValues[i] = CalcBezier(i * kSampleStepSize, mX1, mX2);
    }
  }
  const getT = (aX) => {
    if (mX1 === mY1 && mX2 === mY2) return aX;
    if (aX === 0) return 0;
    if (aX === 1) return 1;
    let intervalStart = 0.0;
    let lastSample = 0;
    for (; lastSample < kSplineTableSize - 1 && mSampleValues[lastSample] <= aX; ++lastSample) {
      intervalStart += kSampleStepSize;
    }
    --lastSample;
    const dist = (aX - mSampleValues[lastSample]) / (mSampleValues[lastSample + 1] - mSampleValues[lastSample]);
    const guessForT = intervalStart + dist * kSampleStepSize;
    const initialSlope = GetSlope(guessForT, mX1, mX2);
    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return GetTForX(aX, mX1, mX2);
    }
    return guessForT;
  };
  return (x) => {
    if (x === 0) return 0;
    if (x === 1) return 1;
    return CalcBezier(getT(x), mY1, mY2);
  };
};

// 2. SELF-CONTAINED: Sample Animator Component
const SampleAnimator = ({ curveValue }) => {
  const barRef = useRef(null);
  const animationFrameId = useRef(null);
  const easerRef = useRef(createBezier(...curveValue));

  useEffect(() => {
    easerRef.current = createBezier(...curveValue);
  }, [curveValue]);

  useEffect(() => {
    const duration = 2000;
    let startTime = performance.now();
    const animate = (timestamp) => {
      const elapsedTime = (timestamp - startTime) % duration;
      const linearProgress = elapsedTime / duration;
      if (barRef.current && easerRef.current) {
        const easedProgress = easerRef.current(linearProgress);
        barRef.current.style.transform = `scaleX(${Math.max(0, easedProgress)})`;
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };
    animationFrameId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, []);

  return (
    <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
      <div
        ref={barRef}
        className="h-full bg-midi-accent rounded-full"
        style={{ transformOrigin: 'left center', width: '100%' }}
      />
    </div>
  );
};

// 3. VELOCITY VISUALIZATION CURVE
const VelocityCurve = ({ value }) => {
  const segments = useMemo(() => {
    const SEGMENT_COUNT = 50;
    const [mX1, mY1, mX2, mY2] = value;
    const pts = [];
    let minSlope = Infinity;
    let maxSlope = -Infinity;

    for (let i = 0; i <= SEGMENT_COUNT; i++) {
      const t = i / SEGMENT_COUNT;
      const x = CalcBezier(t, mX1, mX2);
      const y = CalcBezier(t, mY1, mY2);
      const slopeX = GetSlope(t, mX1, mX2);
      const slopeY = GetSlope(t, mY1, mY2);

      // Prevent division by zero if slopeX is 0 (vertical line)
      const slope = slopeX === 0 ? Infinity : slopeY / slopeX;

      pts.push({ x: x * SIZE, y: (1 - y) * SIZE, slope });

      if (i > 0 && i < SEGMENT_COUNT) {
        minSlope = Math.min(minSlope, slope);
        maxSlope = Math.max(maxSlope, slope);
      }
    }

    const slopeRange = maxSlope - minSlope;
    // Avoid division by zero when normalizing color if range is tiny
    const safeRange = slopeRange < 0.01 ? 1 : slopeRange;

    return pts.slice(0, -1).map((p, i) => {
      const nextP = pts[i + 1];
      const normalizedSlope = (p.slope - minSlope) / safeRange;

      // Color Mapping: Blue (Slow/Flat) to Red/White (Fast/Steep)
      // Hue 240 is Blue, 0 is Red.
      const hue = 240 - (normalizedSlope * 240);
      const lightness = 50 + (normalizedSlope * 20);
      const color = `hsl(${hue}, 100%, ${lightness}%)`;

      return { d: `M ${p.x} ${p.y} L ${nextP.x} ${nextP.y}`, color };
    });
  }, [value]);

  return (
    <>
      {segments.map((seg, i) => (
        <path key={i} d={seg.d} stroke={seg.color} fill="none" strokeWidth="3" strokeLinecap="round" />
      ))}
    </>
  );
};

// 4. FINAL & COMPLETE: Main BezierCurveEditor Component
const format = (n, precision = 2) => parseFloat(n).toFixed(precision);

const BezierCurveEditor = ({
  value = DEFAULT_CURVE,
  onChange,
  presets = [],
  onAddPreset,
  onRemovePreset,
  onApplyPreset,
}) => {
  const [p1, setP1] = useState({ x: value[0] * SIZE, y: (1 - value[1]) * SIZE });
  const [p2, setP2] = useState({ x: value[2] * SIZE, y: (1 - value[3]) * SIZE });
  const [dragging, setDragging] = useState(null);
  const svgRef = useRef(null);
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  const [inputValues, setInputValues] = useState({
    p1x: format(value[0]), p1y: format(value[1]),
    p2x: format(value[2]), p2y: format(value[3]),
  });

  useEffect(() => {
    setP1({ x: value[0] * SIZE, y: (1 - value[1]) * SIZE });
    setP2({ x: value[2] * SIZE, y: (1 - value[3]) * SIZE });
    setInputValues({
      p1x: format(value[0]), p1y: format(value[1]),
      p2x: format(value[2]), p2y: format(value[3]),
    });
  }, [value]);

  const getLogicalCoords = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let logicalX = mouseX - PADDING;
    let logicalY = mouseY - PADDING;
    logicalX = Math.max(0, Math.min(SIZE, logicalX));
    // Y is allowed to go out of bounds technically in CSS beziers,
    // but usually clamped for UI editors or limited by canvas.
    return { x: logicalX, y: logicalY };
  };

  const handleMouseDown = (point) => (e) => {
    setDragging(point);
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const { x, y } = getLogicalCoords(e);
    const newP1 = dragging === 'p1' ? { x, y } : p1;
    const newP2 = dragging === 'p2' ? { x, y } : p2;

    if (dragging === 'p1') setP1({ x, y });
    if (dragging === 'p2') setP2({ x, y });

    onChange([
      newP1.x / SIZE,
      1 - (newP1.y / SIZE),
      newP2.x / SIZE,
      1 - (newP2.y / SIZE)
    ]);
  };

  const handleMouseUp = () => {
    setDragging(null);
    document.body.style.cursor = '';
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, p1, p2]);

  const handleInputChange = (field) => (e) => {
    setInputValues(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleInputCommit = () => {
    let p1x = parseFloat(inputValues.p1x) || 0;
    let p1y = parseFloat(inputValues.p1y) || 0;
    let p2x = parseFloat(inputValues.p2x) || 0;
    let p2y = parseFloat(inputValues.p2y) || 0;

    // Clamp X values to 0-1 range (valid bezier requirement)
    p1x = Math.max(0, Math.min(1, p1x));
    p2x = Math.max(0, Math.min(1, p2x));

    onChange([p1x, p1y, p2x, p2y]);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleInputCommit();
      e.target.blur();
    }
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onAddPreset(presetName.trim(), value);
      setPresetName("");
    }
  };

  const handleDeletePreset = () => {
    const presetToDelete = presets.find(p => p.name === selectedPreset);
    if (presetToDelete && !presetToDelete.isDefault) {
      onRemovePreset(selectedPreset);
      setSelectedPreset("");
    }
  };

  const handleApplyPreset = (e) => {
    const name = e.target.value;
    if (name) {
      onApplyPreset(name);
      setSelectedPreset(name);
    }
  };

  const currentSelectedPreset = presets.find(p => p.name === selectedPreset);
  const inputClasses = "w-14 bg-black/50 text-center text-white font-mono rounded border border-white/10 focus:border-midi-accent focus:outline-none";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {/* SVG GRAPH AREA */}
        <svg ref={svgRef} width={TOTAL_SIZE} height={TOTAL_SIZE} className="bg-black/20 rounded-lg flex-shrink-0">
          <g transform={`translate(${PADDING}, ${PADDING})`}>
            {/* Background Grid/Guides */}
            <rect x="0" y="0" width={SIZE} height={SIZE} fill="rgba(255,255,255,0.02)" />
            <line x1={0} y1={0} x2={0} y2={SIZE} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <line x1={0} y1={SIZE} x2={SIZE} y2={SIZE} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

            {/* Control Handles Lines */}
            <line x1={0} y1={SIZE} x2={p1.x} y2={p1.y} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <line x1={SIZE} y1={0} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

            {/* The Colored Velocity Curve */}
            <VelocityCurve value={value} />

            {/* Interactive Handles */}
            <circle cx={p1.x} cy={p1.y} r="15" fill="transparent" onMouseDown={handleMouseDown('p1')} className="cursor-grab active:cursor-grabbing" />
            <circle cx={p1.x} cy={p1.y} r="5" fill="white" className="pointer-events-none" />

            <circle cx={p2.x} cy={p2.y} r="15" fill="transparent" onMouseDown={handleMouseDown('p2')} className="cursor-grab active:cursor-grabbing" />
            <circle cx={p2.x} cy={p2.y} r="5" fill="white" className="pointer-events-none" />
          </g>
        </svg>

        {/* NUMERIC CONTROLS SIDEBAR */}
        <div className="text-[10px] font-mono text-white/50 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold w-4">P1</span>
            <label htmlFor="p1x">x:</label>
            <input id="p1x" type="number" step="0.01" value={inputValues.p1x} onChange={handleInputChange('p1x')} onBlur={handleInputCommit} onKeyDown={handleInputKeyDown} className={inputClasses} />
            <label htmlFor="p1y">y:</label>
            <input id="p1y" type="number" step="0.01" value={inputValues.p1y} onChange={handleInputChange('p1y')} onBlur={handleInputCommit} onKeyDown={handleInputKeyDown} className={inputClasses} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold w-4">P2</span>
            <label htmlFor="p2x">x:</label>
            <input id="p2x" type="number" step="0.01" value={inputValues.p2x} onChange={handleInputChange('p2x')} onBlur={handleInputCommit} onKeyDown={handleInputKeyDown} className={inputClasses} />
            <label htmlFor="p2y">y:</label>
            <input id="p2y" type="number" step="0.01" value={inputValues.p2y} onChange={handleInputChange('p2y')} onBlur={handleInputCommit} onKeyDown={handleInputKeyDown} className={inputClasses} />
          </div>
          <button onClick={() => onChange(DEFAULT_CURVE)} className="text-white/40 hover:text-white hover:bg-white/10 text-[9px] font-bold py-1 px-2 border border-white/20 rounded transition-colors mt-2">
            Reset
          </button>
        </div>
      </div>

      {/* ANIMATION PREVIEW */}
      <div>
        <label className="text-[10px] font-bold text-white/40 mb-1 block">Live Preview</label>
        <SampleAnimator curveValue={value} />
      </div>

      {/* PRESETS SECTION */}
      <div className="space-y-2 pt-3 border-t border-white/10">
        <label className="text-[10px] font-bold text-white/40 mb-1 block">Presets</label>
        <div className="flex gap-2 items-center">
          <select onChange={handleApplyPreset} value={selectedPreset} className="flex-grow bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-midi-accent">
            <option value="">-- Select a Preset --</option>
            {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button
            onClick={handleDeletePreset}
            disabled={!currentSelectedPreset || currentSelectedPreset.isDefault}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded disabled:opacity-30 disabled:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Save current as new preset..."
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            className="flex-grow bg-black/20 border border-white/10 rounded p-1.5 text-xs placeholder:text-white/30 focus:outline-none focus:border-midi-accent"
          />
          <button onClick={handleSavePreset} className="px-4 py-1.5 bg-midi-accent text-black text-xs font-bold rounded hover:brightness-110 transition-all">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default BezierCurveEditor;