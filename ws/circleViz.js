// ws/circleViz.js
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { NOTE_NAMES } from './constants.js';

const CONFIG = {
    radius: 80,
    colorBase: 0x333333,
    colorText: 0x888888,
    colorActive: 0x00FFFF,
    colorCursorMajor: 0xFF0055,
    colorCursorMinor: 0x0055FF,
    colorChord: 0xFFFFFF
};

const FIFTHS_ORDER = [
    { name: 'C',  pc: 0 }, { name: 'G',  pc: 7 }, { name: 'D',  pc: 2 },
    { name: 'A',  pc: 9 }, { name: 'E',  pc: 4 }, { name: 'B',  pc: 11 },
    { name: 'F#', pc: 6 }, { name: 'Db', pc: 1 }, { name: 'Ab', pc: 8 },
    { name: 'Eb', pc: 3 }, { name: 'Bb', pc: 10 }, { name: 'F', pc: 5 }
];

export class CircleViz {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.app.stage.addChild(this.container);

        this.layers = {
            bg: new PIXI.Container(),
            notes: new PIXI.Container(),
            cursor: new PIXI.Container(),
            ui: new PIXI.Container()
        };
        this.container.addChild(this.layers.bg, this.layers.notes, this.layers.cursor, this.layers.ui);

        this.noteSprites = new Map();
        this.cursorState = { angle: -Math.PI / 2, radius: 0, color: CONFIG.colorCursorMajor };

        this.cursorArrow = null;
        this.cursorLine = null;

        this.createGeometry();
        this.createCursor();
        this.createUI();
        this.resize();
    }

    resize() {
        if (!this.app || !this.app.screen) return;
        const margin = 20;
        const size = CONFIG.radius * 2.4;
        const x = this.app.screen.width - size / 2 - margin;
        const y = this.app.screen.height - size / 2 - margin;
        this.container.position.set(x, y);
    }

    createGeometry() {
        const angleStep = (Math.PI * 2) / 12;
        FIFTHS_ORDER.forEach((item, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = Math.cos(angle) * CONFIG.radius;
            const y = Math.sin(angle) * CONFIG.radius;

            const bg = new PIXI.Graphics();
            bg.circle(0, 0, 12).stroke({ width: 2, color: CONFIG.colorBase });
            bg.position.set(x, y);
            this.layers.bg.addChild(bg);

            const text = new PIXI.Text({ text: item.name, style: {
                fontFamily: 'Arial', fontSize: 12, fill: CONFIG.colorText, fontWeight: 'bold'
            }});
            text.anchor.set(0.5);
            const tx = Math.cos(angle) * (CONFIG.radius * 1.2);
            const ty = Math.sin(angle) * (CONFIG.radius * 1.2);
            text.position.set(tx, ty);
            this.layers.bg.addChild(text);

            const active = new PIXI.Graphics();
            active.circle(0, 0, 10).fill(CONFIG.colorActive);
            active.position.set(x, y);
            active.alpha = 0;
            active.blendMode = 'add';
            this.layers.notes.addChild(active);

            this.noteSprites.set(item.pc, { sprite: active, angle: angle });
        });
    }

    createCursor() {
        this.cursorArrow = new PIXI.Graphics();
        this.cursorArrow.moveTo(0, 0).lineTo(-6, -15).lineTo(6, -15).fill(0xFFFFFF);
        this.layers.cursor.addChild(this.cursorArrow);

        this.cursorLine = new PIXI.Graphics();
        this.layers.cursor.addChildAt(this.cursorLine, 0);
    }

    createUI() {
        this.chordText = new PIXI.Text({ text: '', style: {
            fontFamily: 'Arial', fontSize: 24, fill: 0xffffff,
            stroke: { width: 3, color: 0x000000 }
        }});
        this.chordText.anchor.set(0.5);
        this.layers.ui.addChild(this.chordText);

        this.keyText = new PIXI.Text({ text: '', style: {
            fontFamily: 'Arial', fontSize: 12, fill: 0x666666
        }});
        this.keyText.anchor.set(0.5);
        this.keyText.position.set(0, 30);
        this.layers.ui.addChild(this.keyText);

        this.confBarBg = new PIXI.Graphics();
        this.confBarBg.rect(-30, 45, 60, 4).fill(0x222222);
        this.layers.ui.addChild(this.confBarBg);

        this.confBar = new PIXI.Graphics();
        this.confBar.rect(0, 0, 60, 4).fill(0x4ade80);
        this.confBar.position.set(-30, 45);
        this.confBar.scale.x = 0;
        this.layers.ui.addChild(this.confBar);
    }

    animateNoteOn(note) {
        const pc = note % 12;
        const target = this.noteSprites.get(pc);
        if (target) {
            gsap.killTweensOf(target.sprite);
            gsap.killTweensOf(target.sprite.scale);
            target.sprite.alpha = 1;
            gsap.fromTo(target.sprite.scale, { x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5, duration: 0.1, ease: "back.out(3)" });
            gsap.to(target.sprite.scale, { x: 1.2, y: 1.2, duration: 0.5, yoyo: true, repeat: -1, ease: "sine.inOut" });
        }
    }

    animateNoteOff(note) {
        const pc = note % 12;
        const target = this.noteSprites.get(pc);
        if (target) {
            gsap.killTweensOf(target.sprite);
            gsap.killTweensOf(target.sprite.scale);
            gsap.to(target.sprite, { alpha: 0, duration: 0.3 });
            gsap.to(target.sprite.scale, { x: 1, y: 1, duration: 0.3 });
        }
    }

    update(chordResult, keyResult, overrideText) {
        this.updateCursorLogic(keyResult);
        this.updateCursorVisuals();
        this.updateText(chordResult, keyResult, overrideText);
    }

    updateCursorLogic(detectedKey) {
        if (!detectedKey || detectedKey.confidence < 0.1) return;
        const targetObj = this.noteSprites.get(detectedKey.root);
        if (!targetObj) return;

        let targetAngle = targetObj.angle;
        const targetRadius = detectedKey.type === 'Major' ? CONFIG.radius * 0.85 : CONFIG.radius * 0.55;
        const targetColor = detectedKey.type === 'Major' ? CONFIG.colorCursorMajor : CONFIG.colorCursorMinor;

        let currentAngle = this.cursorState.angle;
        const normalize = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
        let diff = normalize(targetAngle - currentAngle);

        gsap.to(this.cursorState, {
            angle: currentAngle + diff,
            radius: targetRadius,
            duration: 1.5,
            ease: "elastic.out(1, 0.5)",
            overwrite: 'auto'
        });
        this.cursorState.color = targetColor;
    }

    updateCursorVisuals() {
        if (!this.cursorArrow || !this.cursorLine) return;
        const { angle, radius, color } = this.cursorState;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        this.cursorArrow.position.set(x, y);
        this.cursorArrow.rotation = angle + Math.PI / 2;
        this.cursorArrow.clear().moveTo(0,0).lineTo(-6,-15).lineTo(6,-15).fill(color);
        this.cursorLine.clear().moveTo(0,0).lineTo(x,y).stroke({ width: 2, color: color, alpha: 0.5 });
    }

    updateText(chordResult, keyResult, overrideText) {
        if (!this.chordText || !this.keyText) return;

        if (chordResult) {
            const displayText = overrideText || chordResult.name;

            if (this.chordText.text !== displayText) {
                this.chordText.text = displayText;
                this.chordText.scale.set(0.5);
                this.chordText.alpha = 0;
                gsap.to(this.chordText, { alpha: 1, duration: 0.1 });
                gsap.to(this.chordText.scale, { x: 1, y: 1, duration: 0.5, ease: "back.out(1.7)" });
            }
        } else {
            gsap.to(this.chordText, { alpha: 0, duration: 0.2 });
        }

        if (keyResult && keyResult.confidence > 0.01) {
            this.keyText.text = keyResult.name;
            this.keyText.alpha = 1;
            gsap.to(this.confBar.scale, { x: keyResult.confidence, duration: 0.5 });
            const color = keyResult.confidence > 0.8 ? 0x4ade80 : (keyResult.confidence > 0.4 ? 0xfacc15 : 0xf87171);
            this.confBar.clear().rect(0, 0, 60, 4).fill(color);
            this.confBarBg.visible = true;
            this.confBar.visible = true;
        } else {
            this.keyText.text = "";
            this.confBarBg.visible = false;
            this.confBar.visible = false;
        }
    }
}
