// ws/main.js

import * as PIXI from 'pixi.js';
import { SettingsManager } from './ui.js';
import { PercussionGrid } from './percussion.js';

// --- 全局常量 ---
const WEBSOCKET_URL = 'ws://127.0.0.1:8080/ws/midi';
const SCROLL_SPEED = 150;
const MIN_MIDI_NOTE = 21;
const MAX_MIDI_NOTE = 108;
const MID_NOTE = (MIN_MIDI_NOTE + MAX_MIDI_NOTE) / 2;

// --- 全局变量 ---
let app;
let noteContainer;
let playhead;
const activeNotes = new Map();
let settings;
let percussionGrid;

// --- 核心数学逻辑 ---
function getNoteY(note, pitchScale) {
    if (!app || !app.screen) return 0;
    const anchorY = app.screen.height * 0.5;
    const offset = (note - MID_NOTE) * pitchScale;
    return anchorY - offset;
}

// --- WebSocket ---
function connectWebSocket() {
  console.log(`Connecting to ${WEBSOCKET_URL}...`);
  const ws = new WebSocket(WEBSOCKET_URL);
  ws.onopen = () => { console.log('Connected'); showStatusMessage('Connected', '#4ade80'); };
  ws.onmessage = (event) => { try { handleMidiEvent(JSON.parse(event.data)); } catch (e) {} };
  ws.onclose = () => { console.log('Closed. Reconnecting...'); showStatusMessage('Disconnected', '#f87171'); setTimeout(connectWebSocket, 3000); };
}

// --- 可视化逻辑 ---
function handleMidiEvent(event) {
  if (!app || !event.type || !settings) return;
  const { type, note, velocity, channel } = event;
  const noteId = `${channel}-${note}`;

  const mask = settings.get('channelMask') || 65535;
  const ch = channel || 0;
  const isEnabled = (mask >> ch) & 1;

  if (type === 'note_on' && velocity > 0) {
    // 1. 钢琴卷帘 (所有启用通道)
    if (isEnabled) {
        spawnNote(noteId, note, velocity, ch);
    }

    // 2. 打击乐网格 (✅ 读取设置的通道)
    // UI 设置的是 1-16, 事件是 0-15
    const targetCh = (settings.get('percChannel') || 10) - 1;

    if (percussionGrid && ch === targetCh) {
        percussionGrid.addHit(note, velocity);
    }

  } else if (type === 'note_off' || (type === 'note_on' && velocity === 0)) {
    releaseNote(noteId);
  }
}

function spawnNote(id, note, velocity, channel) {
    if (activeNotes.has(id)) return;
    const noteRectangle = new PIXI.Graphics();

    const pitchScale = settings.get('pitchScale') || 6;
    const noteHeight = settings.get('noteHeight') || 5;
    const playheadPos = settings.get('playheadPosition') || 0.2;

    const hue = (channel * 22.5) % 360;
    const color = hslToHex(hue, 90, 60);
    const alpha = 0.5 + (velocity / 127) * 0.5;

    noteRectangle.rect(0, 0, 1, 1).fill({color, alpha});
    noteRectangle.width = 0;
    noteRectangle.height = noteHeight;
    noteRectangle.y = getNoteY(note, pitchScale);
    noteRectangle.x = (app.screen.width * playheadPos) - noteContainer.x;
    noteRectangle.midiData = { note, channel };

    noteContainer.addChild(noteRectangle);
    activeNotes.set(id, noteRectangle);
}

function releaseNote(id) {
  if (activeNotes.has(id)) activeNotes.delete(id);
}

function gameLoop(ticker) {
  if (!app || !noteContainer || !settings) return;

  const deltaTime = ticker.deltaMS / 1000.0;
  const now = performance.now() / 1000;

  const direction = settings.get('scrollDirection');
  const moveDistance = SCROLL_SPEED * deltaTime;

  noteContainer.x += moveDistance * direction;

  for (const noteRectangle of activeNotes.values()) {
    noteRectangle.width += moveDistance;
    if (direction === 1) noteRectangle.x -= moveDistance;
  }

  const buffer = 500;
  for (let i = noteContainer.children.length - 1; i >= 0; i--) {
    const child = noteContainer.children[i];
    const visualX = child.x + noteContainer.x;
    if (direction === -1 && visualX + child.width < -buffer) child.destroy();
    else if (direction === 1 && visualX > app.screen.width + buffer) child.destroy();
  }

  // ✅ 传入 settings
  if (percussionGrid) percussionGrid.update(now, settings);
}

// --- 实时更新 ---
function updateAllActiveNotesVisuals() {
    if (!settings || !noteContainer) return;
    const pitchScale = settings.get('pitchScale');
    const noteHeight = settings.get('noteHeight');
    const channelMask = settings.get('channelMask');

    noteContainer.children.forEach(child => {
        if (child.midiData) {
            const { note, channel } = child.midiData;
            child.visible = Boolean((channelMask >> channel) & 1);
            child.y = getNoteY(note, pitchScale);
            child.height = noteHeight;
        }
    });
}

function updatePlayhead() {
    if (!playhead || !app || !settings) return;
    const x = app.screen.width * settings.get('playheadPosition');
    playhead.clear();
    playhead.moveTo(x, 0).lineTo(x, app.screen.height);
    playhead.stroke({width: 1, color: 0xFFFFFF, alpha: 0.5});
}

function showStatusMessage(text, color) {
    if (!app) return;
    let statusText = app.stage.getChildByLabel('statusText');
    if (!statusText) {
        statusText = new PIXI.Text({text, style: { fontFamily: 'Arial', fontSize: 14, fill: color, align: 'left' }});
        statusText.label = 'statusText';
        statusText.x = 10;
        statusText.y = 10;
        app.stage.addChild(statusText);
    }
    statusText.text = text;
    statusText.style.fill = color;
    statusText.alpha = 1.0;
    let lifetime = 3000;
    const fade = (ticker) => {
        lifetime -= ticker.deltaMS;
        if (lifetime <= 1000) { statusText.alpha = lifetime / 1000; }
        if (lifetime <= 0) { app.ticker.remove(fade); statusText.alpha = 0; }
    };
    app.ticker.add(fade);
}

function hslToHex(h, s, l) {
    l /= 100; const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => { const k = (n + h / 30) % 12; const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * color).toString(16).padStart(2, '0'); };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
}

async function main() {
    app = new PIXI.Application();
    await app.init({ resizeTo: window, backgroundColor: 0x111111, antialias: true });
    document.body.appendChild(app.canvas);

    noteContainer = new PIXI.Container();
    app.stage.addChild(noteContainer);

    percussionGrid = new PercussionGrid(app);

    playhead = new PIXI.Graphics();
    app.stage.addChild(playhead);

    let lastPlayheadPos = 0.2;

    // 初始化 SettingsManager
    settings = new SettingsManager((key, value) => {
        if (key === 'playheadPosition') {
            const width = app.screen.width;
            const deltaX = (width * value) - (width * lastPlayheadPos);
            noteContainer.children.forEach(child => child.x += deltaX);
            lastPlayheadPos = value;
            updatePlayhead();
        } else {
            updateAllActiveNotesVisuals();
        }
    });

    if (settings.get('playheadPosition')) lastPlayheadPos = settings.get('playheadPosition');
    updatePlayhead();

    window.addEventListener('resize', () => {
        if (!app || !app.screen) return;
        updatePlayhead();
        updateAllActiveNotesVisuals();
        if (percussionGrid) percussionGrid.resize();
    });

    app.ticker.add(gameLoop);
    connectWebSocket();
}

main();
