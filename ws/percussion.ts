// ws/percussion.ts
import * as PIXI from 'pixi.js';
import { gsap } from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";


gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

type NoteType = 'KICK' | 'SNARE' | 'RIM' | 'CLAP' | 'HAT_CLOSED' | 'HAT_OPEN' |
    'TOM_HI' | 'TOM_MID' | 'TOM_LOW' | 'CRASH' | 'SPLASH' | 'CHINA' | 'RIDE' |
    'SHAKER' | 'COWBELL' | 'TAMBOURINE' | 'BONGO' | 'CONGA' | 'TIMBALE' |
    'WOODBLOCK' | 'CLAVES' | 'TRIANGLE';

const NOTE_TYPES: Record<NoteType, readonly number[]> = {
    KICK: [35, 36],
    SNARE: [38, 40],
    RIM: [37],
    CLAP: [39],
    HAT_CLOSED: [42, 44],
    HAT_OPEN: [46],
    TOM_HI: [48, 50],
    TOM_MID: [45, 47],
    TOM_LOW: [41, 43],
    CRASH: [49, 57],
    SPLASH: [55],
    CHINA: [52],
    RIDE: [51, 59, 53],
    SHAKER: [69, 70, 82],
    COWBELL: [56],
    TAMBOURINE: [54],
    BONGO: [60, 61],
    CONGA: [62, 63, 64],
    TIMBALE: [65, 66],
    WOODBLOCK: [76, 77],
    CLAVES: [75],
    TRIANGLE: [80, 81]
};

const getType = (midi: number): NoteType | null => {
    for (const [type, ids] of Object.entries(NOTE_TYPES)) {
        if (ids.includes(midi)) return type as NoteType;
    }
    return null;
};

interface PercStep {
    types: NoteType[];
    velocity: number;
    absoluteIndex: number;
    energy: number;
    isDead: boolean;
}

interface SettingsWithGet {
    get(key: string): any;
}

export class PercussionGrid {
    private app: PIXI.Application;
    private container: PIXI.Container;
    private graphics: PIXI.Graphics;
    private steps: PercStep[];
    private stepCounter: number;
    private groupingThreshold: number;
    private lastHitTime: number;

    constructor(app: PIXI.Application) {
        this.app = app;
        this.container = new PIXI.Container();
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        app.stage.addChild(this.container);

        // State
        this.steps = [];
        this.stepCounter = 0;

        this.groupingThreshold = 0.05;
        this.lastHitTime = 0;
    }

    addHit(note: number, velocity: number): void {
        const type = getType(note);
        if (!type) return;

        const now = performance.now() / 1000;
        const timeDiff = now - this.lastHitTime;
        let targetStep: PercStep;

        // If two hits are very close, treat as same step (e.g. Kick + Hat)
        if (timeDiff < this.groupingThreshold && this.steps.length > 0) {
            targetStep = this.steps[this.steps.length - 1];
            if (!targetStep.types.includes(type)) {
                targetStep.types.push(type);
                targetStep.velocity = Math.max(targetStep.velocity, velocity / 127);
            }
        } else {
            // Create new step
            targetStep = {
                types: [type],
                velocity: velocity / 127,
                absoluteIndex: this.stepCounter++,
                energy: 0,
                isDead: false
            };
            this.steps.push(targetStep);
            this.lastHitTime = now;
        }

        // 1. Kill old tweens to prevent conflict
        gsap.killTweensOf(targetStep);

        // 2. Reset Energy
        targetStep.energy = 1.0;

        // 3. Start Decay
        gsap.to(targetStep, {
            energy: 0,
            duration: 0.6,
            ease: "power2.out",
            onComplete: () => {
                targetStep.isDead = true;
            }
        });

        // Limit max steps to prevent memory overflow
        if (this.steps.length > 64) {
            const removed = this.steps.shift();
            if (removed) {
                gsap.killTweensOf(removed);
            }
        }
    }

    update(_timeInSeconds: number, settings: SettingsWithGet): void {
        const g = this.graphics;
        g.clear();

        if (!settings.get('percEnabled')) return;

        this.steps = this.steps.filter(s => !s.isDead);

        const rows = settings.get('percRows');
        const cols = settings.get('percCols');
        const spacing = settings.get('percSpacing');
        const baseSize = settings.get('percBaseSize');
        const totalSlots = rows * cols;

        const screenW = this.app.screen.width;
        const screenH = this.app.screen.height;
        const availableW = screenW - 80;
        const availableH = screenH * 0.35;

        const maxW = (availableW - (cols - 1) * spacing) / cols;
        const maxH = (availableH - (rows - 1) * spacing) / rows;
        const cellSize = Math.min(baseSize, maxW, maxH);

        const gridWidth = cols * cellSize + (cols - 1) * spacing;
        const gridHeight = rows * cellSize + (rows - 1) * spacing;

        const startX = (screenW - gridWidth) / 2;
        const startY = screenH - gridHeight - 40;

        for (let i = 0; i < totalSlots; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cellSize + spacing);
            const y = startY + row * (cellSize + spacing);

            g.rect(x, y, cellSize, cellSize);
            g.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.05 });
            g.fill({ color: 0x000000, alpha: 0.2 });
        }

        for (let i = this.steps.length - 1; i >= 0; i--) {
            const step = this.steps[i];

            if (step.energy <= 0.01) continue;

            const visualIndex = step.absoluteIndex % totalSlots;
            const col = visualIndex % cols;
            const row = Math.floor(visualIndex / cols);
            const x = startX + col * (cellSize + spacing);
            const y = startY + row * (cellSize + spacing);

            this.drawStepGlyph(g, x, y, cellSize, step.types, step.energy);
        }
    }

    resize(): void {
    }

    private drawStepGlyph(g: PIXI.Graphics, x: number, y: number, s: number, types: NoteType[], energy: number): void {
        const cx = x + s / 2;
        const cy = y + s / 2;
        const baseColor = 0xFFFFFF;

        if (types.includes('KICK')) {
            g.circle(cx, cy, s * 0.4 * energy).fill({ color: baseColor, alpha: energy * 0.9 });
            g.circle(cx, cy, s * 0.4 + (s * 0.3 * (1 - energy))).stroke({ width: 1, color: baseColor, alpha: energy * 0.5 });
        }

        const hasTom = types.some(t => t.startsWith('TOM') || ['BONGO', 'CONGA'].includes(t));
        if (hasTom) {
            const sz = s * 0.35 * energy;
            g.poly([cx, cy - sz, cx + sz * 0.86, cy + sz * 0.5, cx - sz * 0.86, cy + sz * 0.5]);
            g.stroke({ width: 2, color: baseColor, alpha: energy * 0.8 });
        }

        if (types.includes('SNARE') || types.includes('RIM')) {
            const sz = s * 0.5 * energy;
            g.rect(cx - sz / 2, cy - sz / 2, sz, sz).fill({ color: baseColor, alpha: energy });
        }
        else if (types.includes('CLAP')) {
            const sz = s * 0.5 * energy;
            g.rect(cx - sz / 2, cy - sz / 2, sz, sz).stroke({ width: 2, color: baseColor, alpha: energy });
            g.rect(cx - sz / 2 + 4, cy - sz / 2 + 4, sz, sz).stroke({ width: 1, color: baseColor, alpha: energy * 0.5 });
        }

        const hasHat = types.some(t => t.startsWith('HAT'));
        if (hasHat) {
            const isSolo = types.length === 1;
            if (isSolo) {
                g.circle(cx, cy, s * 0.1 * energy).fill({ color: baseColor, alpha: energy });
                if (types.includes('HAT_OPEN')) g.circle(cx, cy, s * 0.3).stroke({ width: 1, color: baseColor, alpha: energy * 0.5 });
            } else {
                g.circle(cx - s * 0.3, cy - s * 0.3, 2).fill({ color: baseColor, alpha: energy });
                g.circle(cx + s * 0.3, cy + s * 0.3, 2).fill({ color: baseColor, alpha: energy });
            }
        }

        const hasCymbal = types.some(t => ['CRASH', 'RIDE', 'CHINA', 'SPLASH'].includes(t));
        if (hasCymbal) {
            g.circle(cx, cy, s * 1.2 * (1 - energy)).stroke({ width: 1, color: baseColor, alpha: energy });
            g.star(cx, cy, 4, s * 0.3 * energy, s * 0.1 * energy).fill({ color: baseColor, alpha: energy });
        }
    }
}
