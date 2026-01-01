// ws/percussion.js
import * as PIXI from 'pixi.js';
import { gsap } from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";

// 注册 GSAP 插件
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

const NOTE_TYPES = {
    KICK: [35, 36], SNARE: [38, 40], RIM: [37], CLAP: [39],
    HAT_CLOSED: [42, 44], HAT_OPEN: [46],
    TOM_HI: [48, 50], TOM_MID: [45, 47], TOM_LOW: [41, 43],
    CRASH: [49, 57], SPLASH: [55], CHINA: [52], RIDE: [51, 59, 53],
    SHAKER: [69, 70, 82], COWBELL: [56], TAMBOURINE: [54],
    BONGO: [60, 61], CONGA: [62, 63, 64], TIMBALE: [65, 66],
    WOODBLOCK: [76, 77], CLAVES: [75], TRIANGLE: [80, 81]
};

const getType = (midi) => {
    for (const [type, ids] of Object.entries(NOTE_TYPES)) {
        if (ids.includes(midi)) return type;
    }
    return null;
};

export class PercussionGrid {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        app.stage.addChild(this.container);

        // 状态
        this.steps = [];
        this.stepCounter = 0;

        this.groupingThreshold = 0.05;
        this.lastHitTime = 0;
    }

    addHit(note, velocity) {
        const type = getType(note);
        if (!type) return;

        const now = performance.now() / 1000;
        const timeDiff = now - this.lastHitTime;
        let targetStep;

        // 如果两次击打时间极短，视为同一个时间步（例如底鼓和踩镲同时响）
        if (timeDiff < this.groupingThreshold && this.steps.length > 0) {
            targetStep = this.steps[this.steps.length - 1];
            if (!targetStep.types.includes(type)) {
                targetStep.types.push(type);
                targetStep.velocity = Math.max(targetStep.velocity, velocity / 127);
            }
        } else {
            // 创建新的时间步
            targetStep = {
                types: [type],
                velocity: velocity / 127,
                absoluteIndex: this.stepCounter++,
                energy: 0, // 初始能量，将由 GSAP 设置为 1 并缓动
                isDead: false // 标记是否动画结束
            };
            this.steps.push(targetStep);
            this.lastHitTime = now;
        }

        // 1. 先清理该对象上可能存在的旧动画（防止快速连击时的冲突）
        gsap.killTweensOf(targetStep);

        // 2. 重置能量为 1.0 (最大亮度/大小)
        targetStep.energy = 1.0;

        // 3. 开始衰减动画
        gsap.to(targetStep, {
            energy: 0,
            duration: 0.6, // 动画持续 0.6 秒
            ease: "power2.out", // 缓动曲线：开始快，结束慢，比线性更自然
            onComplete: () => {
                // 动画结束后标记为死亡，等待 update 清理
                targetStep.isDead = true;
            }
        });

        // 限制最大步数，防止极端情况下的内存溢出
        if (this.steps.length > 64) {
            const removed = this.steps.shift();
            // 移除时务必清理动画，防止 GSAP 继续引用已移除的对象
            gsap.killTweensOf(removed);
        }
    }

    update(timeInSeconds, settings) {
        const g = this.graphics;
        g.clear();

        if (!settings.get('percEnabled')) return;

        // 这样就不需要手动计算 age > 1.0 了
        this.steps = this.steps.filter(s => !s.isDead);

        const rows = settings.get('percRows');
        const cols = settings.get('percCols');
        const spacing = settings.get('percSpacing');
        const baseSize = settings.get('percBaseSize');
        const totalSlots = rows * cols;

        // 自适应布局计算
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

        // 绘制背景网格
        for (let i = 0; i < totalSlots; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cellSize + spacing);
            const y = startY + row * (cellSize + spacing);

            g.rect(x, y, cellSize, cellSize);
            g.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.05 });
            g.fill({ color: 0x000000, alpha: 0.2 });
        }

        // 绘制 Steps (倒序绘制，新的在上面)
        for (let i = this.steps.length - 1; i >= 0; i--) {
            const step = this.steps[i];

            // 如果能量极低，跳过绘制
            if (step.energy <= 0.01) continue;

            const visualIndex = step.absoluteIndex % totalSlots;
            const col = visualIndex % cols;
            const row = Math.floor(visualIndex / cols);
            const x = startX + col * (cellSize + spacing);
            const y = startY + row * (cellSize + spacing);

            // 直接传入由 GSAP 控制的 step.energy
            this.drawStepGlyph(g, x, y, cellSize, step.types, step.energy);
        }
    }

    drawStepGlyph(g, x, y, s, types, energy) {

        const cx = x + s / 2;
        const cy = y + s / 2;
        const baseColor = 0xFFFFFF;

        // 1. Layer Bottom: Kick
        if (types.includes('KICK')) {
            g.circle(cx, cy, s * 0.4 * energy).fill({ color: baseColor, alpha: energy * 0.9 });
            g.circle(cx, cy, s * 0.4 + (s * 0.3 * (1 - energy))).stroke({width:1, color:baseColor, alpha: energy*0.5});
        }

        // 2. Layer Mid: Toms / Percs
        const hasTom = types.some(t => t.startsWith('TOM') || ['BONGO', 'CONGA'].includes(t));
        if (hasTom) {
            const sz = s * 0.35 * energy;
            g.poly([cx, cy-sz, cx+sz*0.86, cy+sz*0.5, cx-sz*0.86, cy+sz*0.5]);
            g.stroke({width:2, color:baseColor, alpha:energy * 0.8});
        }

        // 3. Layer Core: Snare / Clap
        if (types.includes('SNARE') || types.includes('RIM')) {
             const sz = s * 0.5 * energy;
             g.rect(cx-sz/2, cy-sz/2, sz, sz).fill({color:baseColor, alpha:energy});
        }
        else if (types.includes('CLAP')) {
             const sz = s * 0.5 * energy;
             g.rect(cx-sz/2, cy-sz/2, sz, sz).stroke({width:2, color:baseColor, alpha:energy});
             g.rect(cx-sz/2+4, cy-sz/2+4, sz, sz).stroke({width:1, color:baseColor, alpha:energy*0.5});
        }

        // 4. Layer Top: Hats
        const hasHat = types.some(t => t.startsWith('HAT'));
        if (hasHat) {
            const isSolo = types.length === 1;
            if (isSolo) {
                g.circle(cx, cy, s*0.1*energy).fill({color:baseColor, alpha:energy});
                if (types.includes('HAT_OPEN')) g.circle(cx, cy, s*0.3).stroke({width:1, color:baseColor, alpha:energy*0.5});
            } else {
                g.circle(cx - s*0.3, cy - s*0.3, 2).fill({color:baseColor, alpha:energy});
                g.circle(cx + s*0.3, cy + s*0.3, 2).fill({color:baseColor, alpha:energy});
            }
        }

        // 5. Layer Splash: Cymbals
        const hasCymbal = types.some(t => ['CRASH', 'RIDE', 'CHINA', 'SPLASH'].includes(t));
        if (hasCymbal) {
             g.circle(cx, cy, s*1.2*(1-energy)).stroke({width:1, color:baseColor, alpha:energy});
             g.star(cx, cy, 4, s*0.3*energy, s*0.1*energy).fill({color:baseColor, alpha:energy});
        }
    }
}
