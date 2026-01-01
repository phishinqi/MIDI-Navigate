// frontend/src/components/Visualizer/P5/PercussionGridP5.js
import { getDrumVisuals } from '@/lib/percussionMap';

// --- 音符类型映射 ---
const NOTE_TYPES = {
    KICK: [35, 36], // Acoustic Bass Drum, Bass Drum 1
    SNARE: [38, 40],       // Acoustic Snare, Electric Snare
    RIM: [37],             // Side Stick
    CLAP: [39],            // Hand Clap
    HAT_CLOSED: [42, 44],  // Closed Hi-Hat, Pedal Hi-Hat (44是脚踩，通常也算闭镲类)
    HAT_OPEN: [46],        // Open Hi-Hat
    TOM_HI: [48, 50],      // Hi-Mid Tom, High Tom
    TOM_MID: [45, 47],     // Low Tom, Low-Mid Tom
    TOM_LOW: [41, 43],     // Low Floor Tom, High Floor Tom
    CRASH: [49, 57],       // Crash Cymbal 1, Crash Cymbal 2
    SPLASH: [55],          // Splash Cymbal
    CHINA: [52],           // Chinese Cymbal 
    RIDE: [51, 59, 53],    // Ride Cymbal 1, Ride Cymbal 2, Ride Bell
    SHAKER: [69, 70, 82],  // Cabasa, Maracas, Shaker
    COWBELL: [56],         // Cowbell
    TAMBOURINE: [54],      // Tambourine
    BONGO: [60, 61],       // Hi/Lo Bongo
    CONGA: [62, 63, 64],   // Mute/Open/Lo Conga
    TIMBALE: [65, 66],     // Hi/Lo Timbale
    WOODBLOCK: [76, 77],   // Hi/Lo Wood Block
    CLAVES: [75],          // Claves
    TRIANGLE: [80, 81]     // Mute/Open Triangle
};

const getType = (midi) => {
    for (const [type, ids] of Object.entries(NOTE_TYPES)) {
        if (ids.includes(midi)) return type;
    }
    return 'OTHER';
};
export const drawPercussionGrid = (p, drumSteps, audioTime, settings, backgroundColor = '#000000') => {
  if (!settings.enabled) return;

  // 使用 P5 的 color() 解析颜色，然后计算感知亮度 (Luma)
  // 阈值设为 128 (0-255中间值)，大于此值认为是浅色背景
  const bgCol = p.color(backgroundColor);
  const isLightMode = (p.red(bgCol) * 0.299 + p.green(bgCol) * 0.587 + p.blue(bgCol) * 0.114) > 128;

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

  // --- 2. 绘制网格底座---
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

          if (settings.p5Style === 'energy') {
              drawStyleEnergy(p, x, y, cellSize, comp, age);
          } else if (settings.p5Style === 'monochrome') {
              drawStyleMonochrome(p, x, y, cellSize, comp, age, isLightMode);
          } else {
              // 默认风格: Geometric
              drawStepGlyph(p, x, y, cellSize, comp, age);
          }
      }
  }
  p.pop();
};
// 数据分析辅助函数
const analyzeStepComponents = (notes) => {
    // 初始化对象：既包含旧风格需要的数组，也包含新风格需要的独立属性
    const c = {
        kick: null,
        snare: null,
        toms: [],
        tom: null,
        hat: null,
        cymbals: [],
        crash: null,
        ride: null,
        perc: null,
        shaker: null,
        cowbell: null,
        baseColor: null
    };

    notes.forEach(n => {
        const type = getType(n.midi);
        const visual = getDrumVisuals(n.midi);
        const vel = n.velocity || 0.8;

        // 记录颜色
        if (!c.baseColor && type !== 'OTHER') c.baseColor = visual.color;

        if (type === 'KICK') {
            if (!c.kick || vel > c.kick.vel) c.kick = { vel, color: visual.color };
        }
        else if (type === 'SNARE') c.snare = { type: 'STANDARD', color: visual.color };
        else if (type === 'RIM')   c.snare = { type: 'RIM', color: visual.color };
        else if (type === 'CLAP')  c.snare = { type: 'CLAP', color: visual.color };
        else if (type === 'HAT_CLOSED') c.hat = { type: 'CLOSED', color: visual.color };
        else if (type === 'HAT_OPEN')   c.hat = { type: 'OPEN', color: visual.color };
        else if (type.startsWith('TOM')) {
            let tomType = 'MID';
            if (type === 'TOM_HI') tomType = 'HIGH';
            if (type === 'TOM_LOW') tomType = 'LOW';
            c.toms.push({ type: tomType, color: visual.color });
            c.tom = { type: tomType, color: visual.color };
        }
        else if (type === 'RIDE') {
            c.cymbals.push({ type: 'RIDE', color: visual.color });
            c.ride = { type: 'RIDE', color: visual.color };
        }
        else if (type === 'CRASH' || type === 'CHINA' || type === 'SPLASH') {
            c.cymbals.push({ type: type, color: visual.color });
            c.crash = { type: type, color: visual.color };
        }
        else if (type === 'SHAKER') {
            c.shaker = true;
            c.perc = { type: 'SHAKER', color: visual.color };
        }
        else if (type === 'COWBELL') {
            c.cowbell = true;
            c.perc = { type: 'COWBELL', color: visual.color };
        }
        else if (type === 'TAMBOURINE') {
            c.perc = { type: 'TAMBOURINE', color: visual.color };
        }
        else if (type === 'BONGO' || type === 'CONGA' || type === 'TIMBALE') {
             c.tom = { type: 'HIGH', color: visual.color };
        }
        else if (type === 'PERC' || type === 'WOODBLOCK' || type === 'CLAVES' || type === 'TRIANGLE') {
            c.perc = { type: 'GENERIC', color: visual.color };
        }
    });

    // 如果 Kick 是主要元素，强制覆盖 baseColor
    if (c.kick) c.baseColor = c.kick.color;

    return c;
};

const getEnergy = (age, decaySpeed = 8) => {
    return Math.max(0, Math.exp(-age * decaySpeed) - 0.01);
};
// 风格 1: Geometric / Reactor
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

    if (comp.kick) {
        const kColor = getHotColor(comp.kick.color);
        p.noStroke();
        p.fill(kColor);
        const punch = 1 + Math.sin(age * 20) * 0.1 * energy;
        const kickSize = maxR * 2 * (0.8 + energy * 0.2) * (age < 0.1 ? punch : 1);
        p.circle(0, 0, kickSize);
    }
    else if (comp.toms.length > 0) {
        const tColor = getHotColor(comp.toms[0].color);
        p.noStroke();
        p.fill(tColor);
        p.circle(0, 0, maxR * 1.6 * energy);
    }
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

// 风格 2: Energy / Particle
const drawStyleEnergy = (p, x, y, s, comp, age) => {
    const energy = getEnergy(age, 7);
    if (energy < 0.01) return;

    const cx = x + s / 2;
    const cy = y + s / 2;

    p.push();
    p.translate(cx, cy);
    p.blendMode(p.ADD);

    if (comp.kick) {
        p.noFill();
        p.stroke(comp.kick.color);
        p.strokeWeight(s * 0.08 * energy);
        p.circle(0, 0, s * 0.8 * (1 - energy));
        p.circle(0, 0, s * 0.8 * energy);
    }

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

// 风格 3: Monochrome / Blueprint
// 增加了最后一个参数 useDarkInk (默认为 false)
const drawStyleMonochrome = (p, x, y, s, comp, age, useDarkInk = false) => {
    const energy = Math.max(0, Math.exp(-age * 8) - 0.01);
    if (energy < 0.01) return;

    const cx = x + s / 2;
    const cy = y + s / 2;

    // 根据模式决定颜色和混合模式
    // 如果是浅色背景(useDarkInk)，用深灰色；否则用纯白
    const monoColor = useDarkInk ? p.color(20, 20, 20) : p.color(255, 255, 255);

    p.push();
    p.translate(cx, cy);

    // 浅色背景用 BLEND (正常绘制)，深色背景用 ADD (发光叠加)
    p.blendMode(useDarkInk ? p.BLEND : p.ADD);

    // setAlpha 保持逻辑不变，但现在基于动态的 monoColor
    const setAlpha = (alpha) => {
        const c = p.color(monoColor);
        // 浅色背景下不需要太透明，否则看不清，所以稍微增加一点不透明度
        const adjustedAlpha = useDarkInk ? Math.min(255, alpha * 255 * 1.5) : alpha * 255;
        c.setAlpha(adjustedAlpha);
        return c;
    };

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
    if (comp.tom) {
        p.noFill();
        p.stroke(setAlpha(energy * 0.8));
        p.strokeWeight(s * 0.04);

        p.push();
        p.rotate(age * 3);

        let sides = 4;
        let scale = 1.0;
        if (comp.tom.type === 'HIGH') { sides = 3; scale = 0.8; }
        else if (comp.tom.type === 'LOW') { sides = 5; scale = 1.1; }
        else if (comp.tom.type === 'FLOOR') { sides = 6; scale = 1.2; }

        const r = s * 0.3 * energy * scale;
        p.beginShape();
        for (let i = 0; i < sides; i++) {
            const angle = p.TWO_PI / sides * i - p.HALF_PI;
            p.vertex(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        p.endShape(p.CLOSE);

        p.strokeWeight(1);
        p.line(0, 0, 0, -r);
        p.pop();
    }
    if (comp.snare || comp.clap) {
        p.noFill();
        p.stroke(setAlpha(energy));
        p.rectMode(p.CENTER);
        const rotateAnim = (1 - energy) * p.HALF_PI;

        p.push();
        if (comp.clap || comp.snare?.type === 'CLAP') {
            p.strokeWeight(s * 0.05);
            p.rotate(p.QUARTER_PI + rotateAnim);
            const size = s * 0.45 * energy;
            p.rect(0, 0, size, size, 2);
            p.stroke(setAlpha(energy * 0.5));
            p.rect(size*0.2, size*0.2, size, size, 2);
        }
        else if (comp.rim || comp.snare?.type === 'RIM') {
            p.strokeWeight(2);
            p.rotate(p.QUARTER_PI);
            const len = s * 0.6 * energy;
            p.line(-len, 0, len, 0);
            p.line(0, -len, 0, len);
            p.strokeWeight(1);
            p.circle(0, 0, s * 0.15);
        }
        else {
            p.strokeWeight(s * 0.06);
            p.rotate(rotateAnim);
            const size = s * 0.5;
            const gap = size * 0.3;
            p.beginShape(); p.vertex(-size/2, -gap); p.vertex(-size/2, -size/2); p.vertex(-gap, -size/2); p.endShape();
            p.beginShape(); p.vertex(size/2, gap); p.vertex(size/2, size/2); p.vertex(gap, size/2); p.endShape();
            p.strokeWeight(s * 0.15 * energy);
            p.point(0, 0);
        }
        p.pop();
    }
    if (comp.hat) {
        p.stroke(setAlpha(energy * 0.8));
        p.noFill();
        const r = s * 0.35;

        if (comp.hat.type === 'OPEN') {
            p.strokeWeight(s * 0.03);
            p.drawingContext.setLineDash([s*0.05, s*0.05]);
            p.push(); p.rotate(age * 5); p.circle(0, 0, r * 2.2); p.pop();
            p.drawingContext.setLineDash([]);
        }
        else if (comp.hat.type === 'PEDAL') {
            p.strokeWeight(s * 0.04);
            p.circle(0, 0, r * 2.0 * energy);
        }
        else {
            p.strokeWeight(s * 0.04);
            const numTicks = 8;
            for(let i=0; i<numTicks; i++) {
                const angle = (p.TWO_PI / numTicks) * i + age * 10;
                p.line(Math.cos(angle)*r, Math.sin(angle)*r, Math.cos(angle)*(r + s*0.1 * energy), Math.sin(angle)*(r + s*0.1 * energy));
            }
        }
    }
    if (comp.ride) {
        p.noFill();
        p.stroke(setAlpha(energy * 0.6));
        p.strokeWeight(s * 0.02);

        p.drawingContext.setLineDash([s*0.2, s*0.1]);
        p.push();
        p.rotate(age * 2);
        p.circle(0, 0, s * 0.9);
        p.pop();
        p.drawingContext.setLineDash([]);

        p.strokeWeight(s * 0.06);
        p.point(0, 0);
    }
    const isCrash = comp.crash || (Array.isArray(comp.cymbals) && comp.cymbals.length > 0);
    if (isCrash) {
        p.noFill();
        p.stroke(setAlpha(energy * 0.4));
        p.strokeWeight(1);
        p.circle(0, 0, s * 2.5 * (1 - energy));

        if (comp.crash?.type === 'CHINA') {
             p.stroke(setAlpha(energy * 0.6));
             p.beginShape();
             for(let i=0; i<20; i++){
                 const ang = p.TWO_PI/20 * i;
                 const rad = s * 0.8 * (1-energy*0.5) + (i%2)*10;
                 p.vertex(Math.cos(ang)*rad, Math.sin(ang)*rad);
             }
             p.endShape(p.CLOSE);
        }
    }
    if (comp.shaker || (comp.perc && comp.perc.type === 'SHAKER')) {
        p.stroke(setAlpha(energy * 0.7));
        p.strokeWeight(2);
        p.randomSeed(Math.floor(age * 100));
        for(let i=0; i<8; i++) {
            const angle = p.random(p.TWO_PI);
            const dist = p.random(s * 0.4 * energy);
            p.point(Math.cos(angle) * dist, Math.sin(angle) * dist);
        }
        p.randomSeed(null);
    }

    if (comp.cowbell || (comp.perc && comp.perc.type === 'COWBELL')) {
        p.noFill();
        p.stroke(setAlpha(energy));
        p.strokeWeight(s * 0.03);
        const sz = s * 0.25 * energy;
        p.quad(-sz*0.6, -sz, sz*0.6, -sz, sz, sz, -sz, sz);
    }

    p.pop();
};