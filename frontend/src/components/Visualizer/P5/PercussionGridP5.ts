import p5 from 'p5';
import { getDrumVisuals } from '@/lib/percussionMap';

// Note Type Mapping
const NOTE_TYPES = {
    // Kick & Snare
    KICK: [35, 36],
    SNARE: [38, 40],
    RIM: [37],
    CLAP: [39],

    // Hats
    HAT_CLOSED: [42, 44],
    HAT_OPEN: [46],

    // Toms
    TOM_HI: [48, 50],
    TOM_MID: [45, 47],
    TOM_LOW: [41, 43],

    // Cymbals
    CRASH: [49, 57],
    SPLASH: [55],
    CHINA: [52],
    RIDE: [51, 59, 53],

    // Percussion
    SHAKER: [69, 70, 82],
    COWBELL: [56],
    TAMBOURINE: [54],

    // Mapped to Toms/Perc
    BONGO: [60, 61],
    CONGA: [62, 63, 64],
    TIMBALE: [65, 66],
    WOODBLOCK: [76, 77],
    CLAVES: [75],
    TRIANGLE: [80, 81]
};

const getType = (midi: number) => {
    for (const [type, ids] of Object.entries(NOTE_TYPES)) {
        if (ids.includes(midi)) return type;
    }
    return 'OTHER';
};

// ==================================================================================
// ==================================================================================
// Main Entry Point
// ==================================================================================
export const drawPercussionGrid = (p: p5, drumSteps: any[], audioTime: number, settings: any, backgroundColor = '#000000') => {
    if (!settings.enabled) return;

    // Check for Light Mode (Luma > 128)
    const bgCol = p.color(backgroundColor);
    const isLightMode = (p.red(bgCol) * 0.299 + p.green(bgCol) * 0.587 + p.blue(bgCol) * 0.114) > 128;

    const { rows, cols, p5Spacing } = settings;
    const totalCells = rows * cols;

    // Layout Calculation
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

    // Draw Grid Base
    p.noStroke();
    p.rectMode(p.CORNER);

    for (let i = 0; i < totalCells; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = c * (cellSize + p5Spacing);
        const y = r * (cellSize + p5Spacing);

        // Faint background
        p.fill(255, 5);
        p.rect(x, y, cellSize, cellSize, 2);
    }

    // Draw Steps
    for (let i = 0; i < drumSteps.length; i++) {
        const step = drumSteps[i];
        if (audioTime >= step.time) {
            // Recycle grid structure
            const visualIndex = i % totalCells;
            const c = visualIndex % cols;
            const r = Math.floor(visualIndex / cols);
            const x = c * (cellSize + p5Spacing);
            const y = r * (cellSize + p5Spacing);

            const comp = analyzeStepComponents(step.notes);
            const age = audioTime - step.time;

            // Router Logic
            if (settings.p5Style === 'energy') {
                drawStyleEnergy(p, x, y, cellSize, comp, age);
            } else if (settings.p5Style === 'monochrome') {
                drawStyleMonochrome(p, x, y, cellSize, comp, age, isLightMode);
            } else {
                // Default: Geometric
                drawStepGlyph(p, x, y, cellSize, comp, age);
            }
        }
    }
    p.pop();
};

const analyzeStepComponents = (notes: any[]) => {
    // Initialize component object
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

        // Record Color

        // Kick
        if (type === 'KICK') {
            if (!c.kick || vel > c.kick.vel) c.kick = { vel, color: visual.color };
        }

        // Snare / Rim / Clap
        else if (type === 'SNARE') c.snare = { type: 'STANDARD', color: visual.color };
        else if (type === 'RIM') c.snare = { type: 'RIM', color: visual.color };
        else if (type === 'CLAP') c.snare = { type: 'CLAP', color: visual.color };

        // Hats
        else if (type === 'HAT_CLOSED') c.hat = { type: 'CLOSED', color: visual.color };
        else if (type === 'HAT_OPEN') c.hat = { type: 'OPEN', color: visual.color };

        // Toms
        else if (type.startsWith('TOM')) {
            let tomType = 'MID';
            if (type === 'TOM_HI') tomType = 'HIGH';
            if (type === 'TOM_LOW') tomType = 'LOW';

            c.toms.push({ type: tomType, color: visual.color });
            c.tom = { type: tomType, color: visual.color };
        }

        // Cymbals
        else if (type === 'RIDE') {
            c.cymbals.push({ type: 'RIDE', color: visual.color });
            c.ride = { type: 'RIDE', color: visual.color };
        }
        else if (type === 'CRASH' || type === 'CHINA' || type === 'SPLASH') {
            c.cymbals.push({ type: type, color: visual.color });
            c.crash = { type: type, color: visual.color };
        }

        // Percussion
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

    // Override baseColor if Kick is prominent
    if (c.kick) c.baseColor = c.kick.color;

    return c;
};

const getEnergy = (age, decaySpeed = 8) => {
    return Math.max(0, Math.exp(-age * decaySpeed) - 0.01);
};

// ==================================================================================
// Style 1: Geometric / Reactor (Default)
// ==================================================================================
const drawStepGlyph = (p: p5, x: number, y: number, s: number, comp: any, age: number) => {
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

    // Kick: Solid Circle
    if (comp.kick) {
        const kColor = getHotColor(comp.kick.color);
        p.noStroke();
        p.fill(kColor);
        const punch = 1 + Math.sin(age * 20) * 0.1 * energy;
        const kickSize = maxR * 2 * (0.8 + energy * 0.2) * (age < 0.1 ? punch : 1);
        p.circle(0, 0, kickSize);
    }
    // Toms: Hollow Circle
    else if (comp.toms.length > 0) {
        const tColor = getHotColor(comp.toms[0].color);
        p.noStroke();
        p.fill(tColor);
        p.circle(0, 0, maxR * 1.6 * energy);
    }

    // Hats: Orbit Ring
    if (comp.hat) {
        const hColor = getHotColor(comp.hat.color);
        p.noFill();
        p.stroke(hColor);
        p.strokeWeight(s * (comp.hat.type === 'OPEN' ? 0.08 : 0.04));
        const ringSize = comp.hat.type === 'OPEN' ? maxR * 1.5 : maxR * 0.8;
        const jitter = (Math.random() - 0.5) * s * 0.05 * energy;
        if (comp.hat.type === 'OPEN') {
            p.drawingContext.setLineDash([s * 0.1, s * 0.1]);
            p.circle(0, 0, ringSize + jitter);
            p.drawingContext.setLineDash([]);
        } else {
            p.circle(0, 0, ringSize + jitter);
        }
    }

    // Snare/Core: Center Geometry
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
            p.triangle(0, -size, -size * 0.86, size * 0.5, size * 0.86, size * 0.5);
        } else {
            const size = maxR * 0.5 * coreScale;
            p.rect(0, 0, size, size, 3);
        }
    }

    // Cymbals: Ripple
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
// Style 2: Energy / Particle
// ==================================================================================
const drawStyleEnergy = (p: p5, x: number, y: number, s: number, comp: any, age: number) => {
    const energy = getEnergy(age, 7);
    if (energy < 0.01) return;

    const cx = x + s / 2;
    const cy = y + s / 2;

    p.push();
    p.translate(cx, cy);
    p.blendMode(p.ADD);

    // Kick: Breathing Ring
    if (comp.kick) {
        p.noFill();
        p.stroke(comp.kick.color);
        p.strokeWeight(s * 0.08 * energy);
        p.circle(0, 0, s * 0.8 * (1 - energy));
        p.circle(0, 0, s * 0.8 * energy);
    }

    // Snare: Radial Lines
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

    // Hat: Glitch Noise
    if (comp.hat) {
        const hColor = comp.hat.color;
        p.stroke(hColor);
        p.strokeWeight(s * 0.04);
        const noiseW = s * 0.8;
        const yPos = (Math.random() - 0.5) * s * 0.6 * energy;
        const xLen = Math.random() * noiseW * energy;
        p.line(-xLen / 2, yPos, xLen / 2, yPos);
        if (comp.hat.type === 'OPEN') {
            p.noFill();
            p.strokeWeight(1);
            p.circle(0, 0, s * 0.6 * energy);
        }
    }
    p.pop();
};

// ==================================================================================
// Style 3: Monochrome / Blueprint
// ==================================================================================
const drawStyleMonochrome = (p: p5, x: number, y: number, s: number, comp: any, age: number, useDarkInk = false) => {
    // 1. Basic Setup
    const energy = Math.max(0, Math.exp(-age * 8) - 0.01);
    if (energy < 0.01) return;

    const cx = x + s / 2;
    const cy = y + s / 2;

    // Determine color and blend mode based on mode
    const monoColor = useDarkInk ? p.color(20, 20, 20) : p.color(255, 255, 255);

    p.push();
    p.translate(cx, cy);

    // Light background uses BLEND, Dark uses ADD
    p.blendMode(useDarkInk ? p.BLEND : p.ADD);

    // setAlpha logic
    const setAlpha = (alpha) => {
        const c = p.color(monoColor);
        // Slightly higher opacity for light mode
        const adjustedAlpha = useDarkInk ? Math.min(255, alpha * 255 * 1.5) : alpha * 255;
        c.setAlpha(adjustedAlpha);
        return c;
    };

    // 2. Kick
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

    // 3. Toms
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

    // 4. Snare / Clap / Rim
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
            p.rect(size * 0.2, size * 0.2, size, size, 2);
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
            p.beginShape(); p.vertex(-size / 2, -gap); p.vertex(-size / 2, -size / 2); p.vertex(-gap, -size / 2); p.endShape();
            p.beginShape(); p.vertex(size / 2, gap); p.vertex(size / 2, size / 2); p.vertex(gap, size / 2); p.endShape();
            p.strokeWeight(s * 0.15 * energy);
            p.point(0, 0);
        }
        p.pop();
    }

    // 5. Hats
    if (comp.hat) {
        p.stroke(setAlpha(energy * 0.8));
        p.noFill();
        const r = s * 0.35;

        if (comp.hat.type === 'OPEN') {
            p.strokeWeight(s * 0.03);
            p.drawingContext.setLineDash([s * 0.05, s * 0.05]);
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
            for (let i = 0; i < numTicks; i++) {
                const angle = (p.TWO_PI / numTicks) * i + age * 10;
                p.line(Math.cos(angle) * r, Math.sin(angle) * r, Math.cos(angle) * (r + s * 0.1 * energy), Math.sin(angle) * (r + s * 0.1 * energy));
            }
        }
    }

    // 6. Ride
    if (comp.ride) {
        p.noFill();
        p.stroke(setAlpha(energy * 0.6));
        p.strokeWeight(s * 0.02);

        p.drawingContext.setLineDash([s * 0.2, s * 0.1]);
        p.push();
        p.rotate(age * 2);
        p.circle(0, 0, s * 0.9);
        p.pop();
        p.drawingContext.setLineDash([]);

        p.strokeWeight(s * 0.06);
        p.point(0, 0);
    }

    // 7. Crash/Cymbals
    const isCrash = comp.crash || (Array.isArray(comp.cymbals) && comp.cymbals.length > 0);
    if (isCrash) {
        p.noFill();
        p.stroke(setAlpha(energy * 0.4));
        p.strokeWeight(1);
        p.circle(0, 0, s * 2.5 * (1 - energy));

        if (comp.crash?.type === 'CHINA') {
            p.stroke(setAlpha(energy * 0.6));
            p.beginShape();
            for (let i = 0; i < 20; i++) {
                const ang = p.TWO_PI / 20 * i;
                const rad = s * 0.8 * (1 - energy * 0.5) + (i % 2) * 10;
                p.vertex(Math.cos(ang) * rad, Math.sin(ang) * rad);
            }
            p.endShape(p.CLOSE);
        }
    }

    // 8. Percussion
    if (comp.shaker || (comp.perc && comp.perc.type === 'SHAKER')) {
        p.stroke(setAlpha(energy * 0.7));
        p.strokeWeight(2);
        p.randomSeed(Math.floor(age * 100));
        for (let i = 0; i < 8; i++) {
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
        p.quad(-sz * 0.6, -sz, sz * 0.6, -sz, sz, sz, -sz, sz);
    }

    p.pop();
};
