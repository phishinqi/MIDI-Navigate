// ws/main.ts
import type * as PIXI from 'pixi.js';
import type { MidiEvent } from './types';
import * as PIXINamespace from 'pixi.js';
import { SettingsManager } from './ui';
import { PercussionGrid } from './percussion';
import { ChordAnalyzer, KeyDetector } from './theory';
import './i18n'; // 初始化i18n
import { t } from './i18n';

const WEBSOCKET_URL = 'ws://127.0.0.1:8080/ws/midi';
const SCROLL_SPEED = 150;
const MIN_MIDI_NOTE = 21;
const MAX_MIDI_NOTE = 108;
const MID_NOTE = (MIN_MIDI_NOTE + MAX_MIDI_NOTE) / 2;

let app: PIXI.Application;
let noteContainer: PIXI.Container;
let playhead: PIXI.Graphics;
const activeNotes = new Map<string, PIXI.Graphics>();
let settings: SettingsManager;
let percussionGrid: PercussionGrid;

let chordAnalyzer: ChordAnalyzer;
let keyDetector: KeyDetector;

// ✅ 五度圈已移除 - circleViz相关代码已完全删除

// --- Helper Functions ---
function getNoteY(note: number, pitchScale: number): number {
    if (!app || !app.screen) return 0;
    const anchorY = app.screen.height * 0.5;
    const offset = (note - MID_NOTE) * pitchScale;
    return anchorY - offset;
}

function hslToHex(h: number, s: number, l: number): number {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
}

function showStatusMessage(text: string, color: string): void {
    if (!app) return;
    let statusText = app.stage.getChildByLabel('statusText') as PIXI.Text | undefined;
    if (!statusText) {
        statusText = new PIXINamespace.Text({ text, style: { fontFamily: 'Arial', fontSize: 14, fill: color, align: 'left' } });
        statusText.label = 'statusText';
        statusText.x = 10;
        statusText.y = 10;
        app.stage.addChild(statusText);
    }
    statusText.text = text;
    statusText.style.fill = color;
    statusText.alpha = 1.0;
    let lifetime = 3000;
    const fade = (ticker: PIXI.Ticker) => {
        lifetime -= ticker.deltaMS;
        if (lifetime <= 1000) { statusText!.alpha = lifetime / 1000; }
        if (lifetime <= 0) { app.ticker.remove(fade); statusText!.alpha = 0; }
    };
    app.ticker.add(fade);
}

// --- WebSocket ---
function connectWebSocket(): void {
    console.log(`Connecting to ${WEBSOCKET_URL}...`);
    const ws = new WebSocket(WEBSOCKET_URL);
    ws.onopen = () => { console.log('Connected'); showStatusMessage(t('ws_visualizer.status.connected'), '#4ade80'); };
    ws.onmessage = (event) => { try { handleMidiEvent(JSON.parse(event.data)); } catch (e) { } };
    ws.onclose = () => { console.log('Closed. Reconnecting...'); showStatusMessage(t('ws_visualizer.status.disconnected'), '#f87171'); setTimeout(connectWebSocket, 3000); };
}

function handleMidiEvent(event: MidiEvent): void {
    if (!app || !event.type || !settings) return;
    const { type, note, velocity, channel } = event;
    const noteId = `${channel}-${note}`;

    const mask = settings ? (settings.get('channelMask') || 65535) : 65535;
    const ch = channel || 0;
    const isEnabled = Boolean((mask >> ch) & 1);

    if (isEnabled) {
        if (type === 'note_on' && velocity > 0) {
            chordAnalyzer.addNote(note);
            const sens = settings ? settings.get('keySensitivity') : 1.0;
            keyDetector.noteOn(note, sens);
            // ✅ circleViz.animateNoteOn已移除
        } else if (type === 'note_off' || (type === 'note_on' && velocity === 0)) {
            chordAnalyzer.removeNote(note);
            keyDetector.noteOff(note);
            // ✅ circleViz.animateNoteOff已移除
        }
    }

    if (type === 'note_on' && velocity > 0) {
        if (isEnabled) spawnNote(noteId, note, velocity, ch);
        const targetCh = (settings ? (settings.get('percChannel') || 10) : 10) - 1;
        if (percussionGrid && ch === targetCh) percussionGrid.addHit(note, velocity);
    } else if (type === 'note_off' || (type === 'note_on' && velocity === 0)) {
        releaseNote(noteId);
    }
}

function spawnNote(id: string, note: number, velocity: number, channel: number): void {
    if (activeNotes.has(id)) return;
    if (!noteContainer) return;

    const noteRectangle = new PIXINamespace.Graphics();
    const pitchScale = settings ? settings.get('pitchScale') : 6;
    const noteHeight = settings ? settings.get('noteHeight') : 5;
    const playheadPos = settings ? settings.get('playheadPosition') : 0.2;
    const hue = (channel * 22.5) % 360;
    const color = hslToHex(hue, 90, 60);
    const alpha = 0.5 + (velocity / 127) * 0.5;

    noteRectangle.rect(0, 0, 1, 1).fill({ color, alpha });
    noteRectangle.width = 0;
    noteRectangle.height = noteHeight;
    noteRectangle.y = getNoteY(note, pitchScale);
    noteRectangle.x = (app.screen.width * playheadPos) - noteContainer.x;
    (noteRectangle as any).midiData = { note, channel };

    noteContainer.addChild(noteRectangle);
    activeNotes.set(id, noteRectangle);
}

function releaseNote(id: string): void {
    if (activeNotes.has(id)) activeNotes.delete(id);
}

// --- Game Loop ---
function gameLoop(ticker: PIXI.Ticker): void {
    if (!app || !noteContainer) return;

    const deltaTime = ticker.deltaMS / 1000.0;
    const now = performance.now() / 1000;

    // 1. Scroll
    const direction = settings ? settings.get('scrollDirection') : -1;
    const moveDistance = SCROLL_SPEED * deltaTime;
    noteContainer.x += moveDistance * direction;

    for (const noteRectangle of activeNotes.values()) {
        noteRectangle.width += moveDistance;
        if (direction === 1) noteRectangle.x -= moveDistance;
    }

    // 2. Cleanup
    const buffer = 500;
    for (let i = noteContainer.children.length - 1; i >= 0; i--) {
        const child = noteContainer.children[i];
        const visualX = child.x + noteContainer.x;
        if (direction === -1 && visualX + child.width < -buffer) child.destroy();
        else if (direction === 1 && visualX > app.screen.width + buffer) child.destroy();
    }

    // 3. Update Components
    if (percussionGrid && settings) percussionGrid.update(now, settings);

    if (keyDetector && settings) {
        const halfLife = settings.get('keyHalfLife');
        const safeHalfLife = Math.max(0.1, halfLife);
        keyDetector.update(deltaTime, safeHalfLife);
    }

    // ✅ 4. CircleViz更新逻辑已完全移除
    // 不再显示五度圈或HUD
}

function updateAllActiveNotesVisuals(): void {
    if (!settings || !noteContainer) return;
    const pitchScale = settings.get('pitchScale');
    const noteHeight = settings.get('noteHeight');
    const channelMask = settings.get('channelMask');
    noteContainer.children.forEach(child => {
        const midiData = (child as any).midiData;
        if (midiData) {
            const { note, channel } = midiData;
            child.visible = Boolean((channelMask >> channel) & 1);
            child.y = getNoteY(note, pitchScale);
            child.height = noteHeight;
        }
    });
}

function updatePlayhead(): void {
    if (!playhead || !app || !settings) return;
    const x = app.screen.width * settings.get('playheadPosition');
    playhead.clear();
    playhead.moveTo(x, 0);
    playhead.lineTo(x, app.screen.height);
    playhead.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.6 });
}

async function main(): Promise<void> {
    app = new PIXINamespace.Application();
    await app.init({ resizeTo: window, backgroundColor: 0x111111, antialias: true });
    document.body.appendChild(app.canvas);

    noteContainer = new PIXINamespace.Container();
    app.stage.addChild(noteContainer);

    percussionGrid = new PercussionGrid(app);

    playhead = new PIXINamespace.Graphics();
    app.stage.addChild(playhead);

    chordAnalyzer = new ChordAnalyzer();
    keyDetector = new KeyDetector();

    // ✅ CircleViz初始化已移除

    let lastPlayheadPos: number;

    settings = new SettingsManager((key, value) => {
        if (key === 'playheadPosition') {
            // 计算播放头位置变化
            const width = app.screen.width;
            const oldX = width * (lastPlayheadPos || 0.2); // Fallback if undefined initially
            const newX = width * (value as number);
            const deltaX = newX - oldX;

            // 调整noteContainer位置
            noteContainer.x += deltaX;

            // 调整所有音符的x坐标，使它们相对播放头保持位置不变
            noteContainer.children.forEach(child => {
                child.x -= deltaX;
            });

            lastPlayheadPos = value as number;
            updatePlayhead();
        } else {
            updateAllActiveNotesVisuals();
        }
    });

    lastPlayheadPos = settings.get('playheadPosition');

    updatePlayhead();

    let lastWidth = app.screen.width;
    let lastHeight = app.screen.height;
    let resizeTimeout: number | null = null;

    window.addEventListener('resize', () => {
        // 清除之前的resize处理
        if (resizeTimeout !== null) {
            cancelAnimationFrame(resizeTimeout);
        }

        // 使用requestAnimationFrame确保在PIXI更新screen尺寸后执行
        resizeTimeout = requestAnimationFrame(() => {
            resizeTimeout = null;

            if (!app || !app.screen || !settings || !noteContainer) return;

            // 只有当尺寸真正改变时才处理
            if (app.screen.width === lastWidth && app.screen.height === lastHeight) return;

            // 计算窗口大小变化导致的播放线位置变化
            const playheadPos = settings.get('playheadPosition');
            const oldPlayheadX = lastWidth * playheadPos;
            const newPlayheadX = app.screen.width * playheadPos;
            const deltaX = newPlayheadX - oldPlayheadX;

            // 只有当deltaX有意义时才调整
            if (isFinite(deltaX) && Math.abs(deltaX) > 0.01) {
                // 调整noteContainer位置以保持音符相对播放线的位置
                noteContainer.x += deltaX;

                // 调整所有音符的x坐标（包括活动和非活动的）
                noteContainer.children.forEach(child => {
                    child.x -= deltaX;
                });
            }

            // 更新记录的尺寸
            lastWidth = app.screen.width;
            lastHeight = app.screen.height;

            updatePlayhead();
            updateAllActiveNotesVisuals();
            if (percussionGrid) percussionGrid.resize();
            // ✅ circleViz.resize()调用已移除
        });
    });

    app.ticker.add(gameLoop);
    connectWebSocket();
}

main();
