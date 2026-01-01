// ws/main.js
import * as PIXI from 'pixi.js';
import { SettingsManager } from './ui.js';
import { PercussionGrid } from './percussion.js';
import { ChordAnalyzer, KeyDetector } from './theory.js';
import { CircleViz } from './circleViz.js';
import { NOTE_NAMES } from './constants.js';

const WEBSOCKET_URL = 'ws://127.0.0.1:8080/ws/midi';
const SCROLL_SPEED = 150;
const MIN_MIDI_NOTE = 21;
const MAX_MIDI_NOTE = 108;
const MID_NOTE = (MIN_MIDI_NOTE + MAX_MIDI_NOTE) / 2;

let app;
let noteContainer;
let playhead;
const activeNotes = new Map();
let settings;
let percussionGrid;

let chordAnalyzer;
let keyDetector;
let circleViz;

// --- Helper Functions ---
function getNoteY(note, pitchScale) {
    if (!app || !app.screen) return 0;
    const anchorY = app.screen.height * 0.5;
    const offset = (note - MID_NOTE) * pitchScale;
    return anchorY - offset;
}

function hslToHex(h, s, l) {
    l /= 100; const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
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

// --- WebSocket ---
function connectWebSocket() {
  console.log(`Connecting to ${WEBSOCKET_URL}...`);
  const ws = new WebSocket(WEBSOCKET_URL);
  ws.onopen = () => { console.log('Connected'); showStatusMessage('Connected', '#4ade80'); };
  ws.onmessage = (event) => { try { handleMidiEvent(JSON.parse(event.data)); } catch (e) {} };
  ws.onclose = () => { console.log('Closed. Reconnecting...'); showStatusMessage('Disconnected', '#f87171'); setTimeout(connectWebSocket, 3000); };
}

function handleMidiEvent(event) {
  if (!app || !event.type || !settings) return;
  const { type, note, velocity, channel } = event;
  const noteId = `${channel}-${note}`;

  const mask = settings ? (settings.get('channelMask') || 65535) : 65535;
  const ch = channel || 0;
  const isEnabled = (mask >> ch) & 1;

  if (isEnabled) {
      if (type === 'note_on' && velocity > 0) {
          chordAnalyzer.addNote(note);
          const sens = settings ? settings.get('keySensitivity') : 1.0;
          keyDetector.noteOn(note, sens);
          if (circleViz) circleViz.animateNoteOn(note);
      } else if (type === 'note_off' || (type === 'note_on' && velocity === 0)) {
          chordAnalyzer.removeNote(note);
          keyDetector.noteOff(note);
          if (circleViz) circleViz.animateNoteOff(note);
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

function spawnNote(id, note, velocity, channel) {
    if (activeNotes.has(id)) return;
    if (!noteContainer) return;

    const noteRectangle = new PIXI.Graphics();
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
    noteRectangle.midiData = { note, channel };

    noteContainer.addChild(noteRectangle);
    activeNotes.set(id, noteRectangle);
}

function releaseNote(id) { if (activeNotes.has(id)) activeNotes.delete(id); }

// --- Game Loop ---
function gameLoop(ticker) {
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

  if (settings && settings.get('showAnalysis')) {
      const keyResult = keyDetector.detect();
      const chordResult = chordAnalyzer.detect();

      // 计算最终显示文本 (Chord Name vs Roman)
      let displayText = "";
      if (chordResult) {
          const mode = settings.get('analysisMode');

          if (mode === 'roman') {
              // 确定当前的 Root 和 Scale Name
              let root, scale;
              if (settings.get('autoKey')) {
                  root = keyResult.root;
                  scale = keyResult.scaleName;
              } else {
                  root = settings.get('keyRoot');
                  scale = settings.get('keyType');
              }
              displayText = chordAnalyzer.getRoman(chordResult, root, scale);
          } else {
              displayText = chordResult.name;
          }
      }

      // 传递给 CircleViz
      if (circleViz) {
          circleViz.update(chordResult, keyResult, displayText);
          circleViz.container.visible = true;
      }
  } else {
      if (circleViz) circleViz.container.visible = false;
  }
}

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
    playhead.moveTo(x, 0).lineTo(x, app.screen.height).stroke({ width: 1, color: 0xFFFFFF, alpha: 0.5 });
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

    chordAnalyzer = new ChordAnalyzer();
    keyDetector = new KeyDetector();

    try {
        circleViz = new CircleViz(app);
    } catch (e) {
        console.error("CircleViz init failed:", e);
    }

    let lastPlayheadPos = 0.2;
    settings = new SettingsManager((key, value) => {
        if (key === 'playheadPosition') {
            const width = app.screen.width;
            const deltaX = (width * value) - (width * lastPlayheadPos);
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
        if (circleViz) circleViz.resize();
    });

    app.ticker.add(gameLoop);
    connectWebSocket();
}

main();
