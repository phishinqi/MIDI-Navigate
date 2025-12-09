// frontend/src/components/Visualizer/P5/PercussionGridP5.js
import { getDrumVisuals } from '@/lib/percussionMap';

// --- 音符类型映射 ---
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

// ==================================================================================
// 主入口函数
// ==================================================================================
export const drawPercussionGrid = (p, drumSteps, audioTime, settings) => {
  if (!settings.enabled) return;

  const { rows, cols, p5Spacing } = settings;
  const totalCells = rows * cols;

  // --- 1. 布局计算 ---
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

  // --- 2. 绘制网格底座 (Dim Background) ---
  p.noStroke();
  p.rectMode(p.CORNER);

  for (let i = 0; i < totalCells; i++) {
     const c = i % cols;
     const r = Math.floor(i / cols);
     const x = c * (cellSize + p5Spacing);
     const y = r * (cellSize + p5Spacing);

     // 稍微淡一点的底色
     p.fill(255, 5);
     p.rect(x, y, cellSize, cellSize, 2);
  }

  // --- 3. 绘制动态鼓点 ---
  for (let i = 0; i < drumSteps.length; i++) {
      const step = drumSteps[i];
      if (audioTime >= step.time) {
          // 循环利用格子
          const visualIndex = i % totalCells;
          const c = visualIndex % cols;
          const r = Math.floor(visualIndex / cols);
          const x = c * (cellSize + p5Spacing);
          const y = r * (cellSize + p5Spacing);

          const comp = analyzeStepComponents(step.notes);
          const age = audioTime - step.time;

          // [路由逻辑] 根据设置切换风格
          if (settings.p5Style === 'energy') {
              drawStyleEnergy(p, x, y, cellSize, comp, age);
          } else if (settings.p5Style === 'monochrome') {
              drawStyleMonochrome(p, x, y, cellSize, comp, age);
          } else {
              // 默认风格: Geometric
              drawStepGlyph(p, x, y, cellSize, comp, age);
          }
      }
  }
  p.pop();
};

// ==================================================================================
// 数据分析辅助函数
// ==================================================================================
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

const getEnergy = (age, decaySpeed = 8) => {
    return Math.max(0, Math.exp(-age * decaySpeed) - 0.01);
};

// ==================================================================================
// 风格 1: Geometric / Reactor (同心圆几何风格 - 默认)
// ==================================================================================
const drawStepGlyph = (p, x, y, s, comp, age) => {
    const energy = Math.max(0, Math.exp(-age * 6) - 0.01);
    if (energy < 0.01) return;

    const cx = x + s / 2;
    const cy = y + s / 2;
    const maxR = s * 0.45;

    p.push();
    p.translate(cx, cy);

    // Glow Effect
    p.drawingContext.shadowBlur = s * 0.2 * energy;
    p.drawingContext.shadowColor = comp.baseColor || '#FFFFFF';

    const getHotColor = (hex) => {
        const c = p.color(hex);
        const flashAmt = Math.pow(energy, 3);
        return p.lerpColor(c, p.color(255), flashAmt);
    };

    // Kick: 实心圆
    if (comp.kick) {
        const kColor = getHotColor(comp.kick.color);
        p.noStroke();
        p.fill(kColor);
        const punch = 1 + Math.sin(age * 20) * 0.1 * energy;
        const kickSize = maxR * 2 * (0.8 + energy * 0.2) * (age < 0.1 ? punch : 1);
        p.circle(0, 0, kickSize);
    }
    // Toms: 空心圆
    else if (comp.toms.length > 0) {
        const tColor = getHotColor(comp.toms[0].color);
        p.noStroke();
        p.fill(tColor);
        p.circle(0, 0, maxR * 1.6 * energy);
    }

    // Hats: 轨道光环
    if (comp.hat) {
        const hColor = getHotColor(comp.hat.color);
        p.noFill();
        p.stroke(hColor);
        p.strokeWeight(s * (comp.hat.type === 'OPEN' ? 0.08 : 0.04));
        const ringSize = comp.hat.type === 'OPEN' ? maxR * 1.5 : maxR * 0.8;
        const jitter = (Math.random() - 0.5) * s * 0.05 * energy;
        if (comp.hat.type === 'OPEN') {
            p.drawingContext.setLineDash([s*0.1, s*0.1]);
            p.circle(0, 0, ringSize + jitter);
            p.drawingContext.setLineDash([]);
        } else {
            p.circle(0, 0, ringSize + jitter);
        }
    }

    // Snare/Core: 中心几何体
    if (comp.snare || comp.perc) {
        let coreColor = comp.kick ? p.color(255) : getHotColor(comp.snare?.color || comp.perc.color);
        p.noStroke();
        p.fill(coreColor);
        p.rectMode(p.CENTER);
        const coreScale = 1.0 + energy * 0.5;

        if (comp.snare?.type === 'CLAP') {
            const size = maxR * 0.6 * coreScale;
            p.push();
            p.rotate(p.QUARTER_PI);
            p.rect(0, 0, size, size * 0.3, 2);
            p.rect(0, 0, size * 0.3, size, 2);
            p.pop();
        } else if (comp.snare?.type === 'STICK') {
             p.rect(0, 0, maxR * 1.2, maxR * 0.15, 2);
        } else if (comp.perc) {
            const size = maxR * 0.4 * coreScale;
            p.triangle(0, -size, -size*0.86, size*0.5, size*0.86, size*0.5);
        } else {
            const size = maxR * 0.5 * coreScale;
            p.rect(0, 0, size, size, 3);
        }
    }

    // Cymbals: 扩散圈
    if (comp.cymbals.length > 0) {
        const cColor = getHotColor(comp.cymbals[0].color);
        p.noFill();
        p.stroke(cColor);
        const waveR = maxR * (0.5 + (1.0 - energy) * 2.0);
        p.strokeWeight(s * 0.05 * energy);
        p.circle(0, 0, waveR * 2);
    }
    p.drawingContext.shadowBlur = 0;
    p.pop();
};

// ==================================================================================
// 风格 2: Energy / Particle (粒子爆炸风格)
// ==================================================================================
const drawStyleEnergy = (p, x, y, s, comp, age) => {
    const energy = getEnergy(age, 7);
    if (energy < 0.01) return;

    const cx = x + s / 2;
    const cy = y + s / 2;

    p.push();
    p.translate(cx, cy);
    p.blendMode(p.ADD);

    // Kick: 呼吸圈
    if (comp.kick) {
        p.noFill();
        p.stroke(comp.kick.color);
        p.strokeWeight(s * 0.08 * energy);
        p.circle(0, 0, s * 0.8 * (1 - energy));
        p.circle(0, 0, s * 0.8 * energy);
    }

    // Snare: 放射线
    if (comp.snare || comp.perc) {
        const c = comp.snare?.color || comp.perc.color;
        p.stroke(c);
        p.strokeWeight(s * 0.05);
        const numLines = comp.snare?.type === 'CLAP' ? 8 : 4;
        const radius = s * 0.6 * energy;
        p.rotate(age * 10);
        for (let i = 0; i < numLines; i++) {
            const angle = (p.TWO_PI / numLines) * i;
            p.line(0, 0, Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        p.rotate(-age * 10);
    }

    // Hat: 故障噪点
    if (comp.hat) {
        const hColor = comp.hat.color;
        p.stroke(hColor);
        p.strokeWeight(s * 0.04);
        const noiseW = s * 0.8;
        const yPos = (Math.random() - 0.5) * s * 0.6 * energy;
        const xLen = Math.random() * noiseW * energy;
        p.line(-xLen/2, yPos, xLen/2, yPos);
        if (comp.hat.type === 'OPEN') {
             p.noFill();
             p.strokeWeight(1);
             p.circle(0, 0, s * 0.6 * energy);
        }
    }
    p.pop();
};

// ==================================================================================
// 风格 3: Monochrome / Blueprint (单色蓝图/战术风格) - [NEW]
// ==================================================================================
const drawStyleMonochrome = (p, x, y, s, comp, age) => {
    const energy = Math.max(0, Math.exp(-age * 8) - 0.01);
    if (energy < 0.01) return;

    const cx = x + s / 2;
    const cy = y + s / 2;

    // 统一定义单色 (例如：高科技白 或 终端绿)
    // 这里使用纯白配合透明度，通过 blendMode(ADD) 产生发光感
    const monoColor = p.color(255, 255, 255);

    p.push();
    p.translate(cx, cy);
    p.blendMode(p.ADD);

    const setAlpha = (alpha) => {
        const c = p.color(monoColor);
        c.setAlpha(alpha * 255);
        return c;
    };

    // 1. Kick: 实心雷达波 (填充区分)
    if (comp.kick) {
        p.noStroke();
        p.fill(setAlpha(energy * 0.9));
        p.circle(0, 0, s * 0.6 * energy);

        p.noFill();
        p.stroke(setAlpha(energy * 0.5));
        p.strokeWeight(2);
        const waveR = s * 0.4 + (s * 0.4 * (1 - energy));
        p.circle(0, 0, waveR);
    }

    // 2. Snare/Clap: 粗线条几何 (形状区分)
    if (comp.snare || comp.perc) {
        p.noFill();
        p.stroke(setAlpha(energy));
        p.strokeWeight(s * 0.06);
        p.rectMode(p.CENTER);
        const rotateAnim = (1 - energy) * p.HALF_PI;

        p.push();
        if (comp.snare?.type === 'CLAP') {
            p.rotate(p.QUARTER_PI + rotateAnim);
            const size = s * 0.5 * energy;
            p.rect(0, 0, size, size, 2);
            p.strokeWeight(s * 0.1);
            p.point(size, 0); p.point(-size, 0);
        } else {
            p.rotate(rotateAnim);
            const size = s * 0.5;
            const gap = size * 0.3;
            // 绘制锁定框 [ ]
            p.beginShape(); p.vertex(-size/2, -gap); p.vertex(-size/2, -size/2); p.vertex(-gap, -size/2); p.endShape();
            p.beginShape(); p.vertex(size/2, gap); p.vertex(size/2, size/2); p.vertex(gap, size/2); p.endShape();
            p.strokeWeight(s * 0.15 * energy);
            p.point(0, 0);
        }
        p.pop();
    }

    // 3. Hats: 点阵/虚线 (纹理区分)
    if (comp.hat) {
        p.stroke(setAlpha(energy * 0.8));
        p.strokeWeight(s * 0.03);
        p.noFill();
        const r = s * 0.35;

        if (comp.hat.type === 'OPEN') {
            p.drawingContext.setLineDash([s*0.05, s*0.05]);
            p.push(); p.rotate(age * 5); p.circle(0, 0, r * 2.2); p.pop();
            p.drawingContext.setLineDash([]);
        } else {
            // 刻度线闪烁
            const numTicks = 8;
            for(let i=0; i<numTicks; i++) {
                const angle = (p.TWO_PI / numTicks) * i + age * 10;
                p.line(Math.cos(angle)*r, Math.sin(angle)*r, Math.cos(angle)*(r + s*0.1), Math.sin(angle)*(r + s*0.1));
            }
        }
    }

    // 4. Cymbals: 全屏扫描线 (极细)
    if (comp.cymbals.length > 0) {
        p.noFill();
        p.stroke(setAlpha(energy * 0.4));
        p.strokeWeight(1);
        p.circle(0, 0, s * 2.0 * (1 - energy));
    }

    p.pop();
};