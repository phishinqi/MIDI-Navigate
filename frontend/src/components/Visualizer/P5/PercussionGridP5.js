import { getDrumVisuals } from '@/lib/percussionMap';

// ... (NOTE_TYPES 和 getType 保持不变) ...
const NOTE_TYPES = {
    KICK: [35, 36],
    SNARE: [38, 40, 37, 39],
    HAT_CLOSED: [42, 44],
    HAT_OPEN: [46],
    TOM_HI: [48, 50],
    TOM_MID: [45, 47],
    TOM_LOW: [41, 43],
    CRASH: [49, 57, 52, 55],
    RIDE: [51, 59, 53],
    PERC: [54, 56, 58]
};

const getType = (midi) => {
    for (const [type, ids] of Object.entries(NOTE_TYPES)) {
        if (ids.includes(midi)) return type;
    }
    return 'OTHER';
};

export const drawPercussionGrid = (p, drumSteps, audioTime, settings) => {
  if (!settings.enabled) return;

  // 1. [回归] 严格使用设置中的行列数，不再动态扩展
  const { rows, cols, p5Spacing } = settings;
  const totalCells = rows * cols; // 网格总容量

  // 2. 基础布局计算 (含屏幕适配)
  const availableWidth = p.width - 80;
  const maxCellWidth = (availableWidth - (cols - 1) * p5Spacing) / cols;

  const maxGridHeight = p.height * 0.35;
  const maxCellHeight = (maxGridHeight - (rows - 1) * p5Spacing) / rows;

  const defaultSize = settings.p5CellSize || 40;
  const cellSize = Math.min(defaultSize, maxCellWidth, maxCellHeight);

  const gridWidth = cols * cellSize + (cols - 1) * p5Spacing;
  const gridHeight = rows * cellSize + (rows - 1) * p5Spacing;

  const startX = (p.width - gridWidth) / 2;
  const startY = p.height - gridHeight - 40;

  p.push();
  p.translate(startX, startY);

  // 3. 绘制固定的网格底座
  p.noStroke();
  p.rectMode(p.CORNER);

  for (let i = 0; i < totalCells; i++) {
     const c = i % cols;
     const r = Math.floor(i / cols);
     const x = c * (cellSize + p5Spacing);
     const y = r * (cellSize + p5Spacing);

     p.fill(255, 4);
     p.rect(x, y, cellSize, cellSize, 2);
  }

  // 4. 绘制步进符号 (支持循环覆盖)
  for (let i = 0; i < drumSteps.length; i++) {
      const step = drumSteps[i];
      if (audioTime >= step.time) {
          // [关键修复] 使用取模运算 (%) 实现“从头再来”
          // 如果 i = 32, totalCells = 32，则 visualIndex = 0，回到第一个格子
          const visualIndex = i % totalCells;

          const c = visualIndex % cols;
          const r = Math.floor(visualIndex / cols);

          const x = c * (cellSize + p5Spacing);
          const y = r * (cellSize + p5Spacing);

          const comp = analyzeStepComponents(step.notes);
          drawStepGlyph(p, x, y, cellSize, comp, audioTime - step.time);
      }
  }
  p.pop();
};

const analyzeStepComponents = (notes) => {
    const c = {
        kick: null, snare: null, toms: [], hat: null, cymbals: [], perc: null, baseColor: null
    };
    notes.forEach(n => {
        const type = getType(n.midi);
        const visual = getDrumVisuals(n.midi);
        const vel = n.velocity || 0.8;

        if (type === 'KICK') {
            if (!c.kick || vel > c.kick.vel) c.kick = { vel, color: visual.color };
            c.baseColor = visual.color;
        }
        else if (type === 'SNARE') c.snare = { type: 'SNARE', color: visual.color };
        else if (type === 'STICK') c.snare = { type: 'STICK', color: visual.color };
        else if (type === 'CLAP')  c.snare = { type: 'CLAP',  color: visual.color };
        else if (type === 'HAT_CLOSED') c.hat = { type: 'CLOSED', color: visual.color };
        else if (type === 'HAT_OPEN')   c.hat = { type: 'OPEN',   color: visual.color };
        else if (type === 'TOM_HI')  c.toms.push({ type: 'HI', color: visual.color });
        else if (type === 'TOM_MID') c.toms.push({ type: 'MID', color: visual.color });
        else if (type === 'TOM_LOW') c.toms.push({ type: 'LOW', color: visual.color });
        else if (type === 'CRASH') c.cymbals.push({ type: 'CRASH', color: visual.color });
        else if (type === 'RIDE')  c.cymbals.push({ type: 'RIDE',  color: visual.color });
        else if (type === 'PERC') c.perc = { color: visual.color };

        if (!c.baseColor && !c.kick) c.baseColor = visual.color;
    });
    return c;
};

// [核心] 通用绘制函数：支持自动描边
const drawStepGlyph = (p, x, y, s, comp, age) => {
    const isFlash = age < 0.06;
    const padding = s * 0.05;
    const innerS = s - padding * 2;

    const hasSolidBg = comp.kick && comp.kick.vel > 0.7;
    const needsMask = true;

    const maskColor = p.color(10, 11, 14); // 背景色
    const maskWeight = s * 0.36; // 描边宽度

    p.push();
    p.translate(x + padding, y + padding);

    // --- Helper: Draw Layer with Auto-Mask ---
    const drawLayer = (color, drawFn, isLine = false) => {
        if (needsMask) {
            p.stroke(maskColor);
            p.strokeWeight(maskWeight);
            p.strokeCap(p.ROUND);
            p.strokeJoin(p.ROUND);
            p.noFill();
            drawFn(); // Mask Pass
        }

        if (isLine) {
            p.stroke(color);
            p.strokeWeight(s * 0.08); // 线条本身的宽度
            p.noFill();
        } else {
            p.noStroke();
            p.fill(color);
        }
        drawFn(); // Color Pass
    };

    // 1. Kick (Base)
    if (comp.kick) {
        const kColor = isFlash ? '#FFFFFF' : comp.kick.color;
        if (comp.kick.vel > 0.7) {
            p.noStroke();
            p.fill(kColor);
            p.rect(0, 0, innerS, innerS, 3);
        } else {
            p.noFill();
            p.stroke(kColor);
            p.strokeWeight(s * 0.1);
            p.rect(0, 0, innerS, innerS, 3);
        }
    }

    // 2. Toms (Bars)
    if (comp.toms.length > 0) {
        comp.toms.forEach(tom => {
            drawLayer(hasSolidBg ? '#FFFFFF' : tom.color, () => {
                const barH = innerS * 0.15;
                const barW = innerS * 0.6;
                const barX = (innerS - barW) / 2;
                if (tom.type === 'HI')  p.rect(barX, innerS * 0.05, barW, barH, 2);
                if (tom.type === 'MID') {
                    p.rect(0, innerS * 0.4, barH, barH * 2, 2);
                    p.rect(innerS - barH, innerS * 0.4, barH, barH * 2, 2);
                }
                if (tom.type === 'LOW') p.rect(barX, innerS * 0.8, barW, barH, 2);
            });
        });
    }

    // 3. Snare / Center
    if (comp.snare || comp.perc) {
        p.rectMode(p.CENTER);
        const cx = innerS / 2;
        const cy = innerS / 2;
        const sz = innerS * 0.45;
        const color = comp.snare?.type === 'CLAP' ? '#FF4081' : (hasSolidBg ? '#FFFFFF' : (comp.snare?.color || comp.perc?.color));

        if (comp.snare?.type === 'CLAP') {
            drawLayer(color, () => {
                const d = sz * 0.7;
                p.line(cx - d, cy - d, cx + d, cy + d);
                p.line(cx + d, cy - d, cx - d, cy + d);
            }, true);
        } else {
            drawLayer(color, () => {
                if (comp.snare?.type === 'SNARE') p.rect(cx, cy, sz, sz, 2);
                else if (comp.snare?.type === 'STICK') p.rect(cx, cy, innerS * 0.7, innerS * 0.15, 2);
                else if (comp.perc) {
                    const tsz = innerS * 0.22;
                    p.triangle(cx - tsz, cy - tsz, cx + tsz, cy - tsz, cx, cy + tsz);
                }
            });
        }
        p.rectMode(p.CORNER);
    }

    // 4. Hats
    if (comp.hat) {
        const hColor = hasSolidBg ? '#FFFFFF' : comp.hat.color;
        if (comp.hat.type === 'CLOSED') {
            drawLayer(hColor, () => {
                p.line(innerS * 0.6, innerS * 0.4, innerS, 0);
            }, true);
        } else {
            drawLayer(hColor, () => {
                p.triangle(innerS, 0, innerS, innerS * 0.4, innerS * 0.6, 0);
            });
        }
    }

    // 5. Cymbals
    comp.cymbals.forEach(cym => {
        const cColor = hasSolidBg ? '#FFD740' : cym.color;
        drawLayer(cColor, () => {
            if (cym.type === 'CRASH') {
                const sz = innerS * 0.28;
                p.push();
                p.translate(sz/1.5, sz/1.5);
                p.rotate(p.QUARTER_PI);
                p.rectMode(p.CENTER);
                p.rect(0, 0, sz, sz);
                p.pop();
            } else {
                const sz = innerS * 0.28;
                p.ellipse(innerS - sz/2, innerS - sz/2, sz);
            }
        });
    });

    p.pop();
};
