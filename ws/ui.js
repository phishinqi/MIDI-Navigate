// ws/ui.js
import { SCALES, NOTE_NAMES } from './constants.js';

const DEFAULT_CONFIG = {
    // Basic
    scrollDirection: -1,
    pitchScale: 6,
    noteHeight: 5,
    playheadPosition: 0.2,
    channelMask: 65535,

    // Analysis
    showAnalysis: true,
    analysisMode: 'roman',
    autoKey: true,
    keyRoot: 0,
    keyType: 'Major (Ionian)',
    keyHalfLife: 3.0,   // 记忆时间 (秒)
    keySensitivity: 1.0,// 灵敏度倍率

    // Percussion
    percEnabled: true,
    percChannel: 10,
    percRows: 2,
    percCols: 8,
    percBaseSize: 50,
    percSpacing: 10
};

export class SettingsManager {
    constructor(onConfigChange) {
        this.config = { ...DEFAULT_CONFIG };
        this.onConfigChange = onConfigChange;
        this.isOpen = false;
        this.toggleModal = this.toggleModal.bind(this);
        this.loadSettings();

        // Defaults check
        if (this.config.keyHalfLife === undefined) this.config.keyHalfLife = 3.0;
        if (this.config.keySensitivity === undefined) this.config.keySensitivity = 1.0;
        if (!Object.keys(SCALES).includes(this.config.keyType)) this.config.keyType = 'Major (Ionian)';

        this.injectStyles();
        this.createFloatingButton();
        this.createModal();
    }
    loadSettings() { const saved = localStorage.getItem('midi_viz_settings'); if (saved) { try { this.config = { ...this.config, ...JSON.parse(saved) }; } catch (e) {} } }
    saveSettings() { localStorage.setItem('midi_viz_settings', JSON.stringify(this.config)); }
    updateSetting(key, value) { this.config[key] = value; this.saveSettings(); if (this.onConfigChange) this.onConfigChange(key, value); }
    get(key) { return this.config[key]; }
    toggleChannel(ch) { this.updateSetting('channelMask', this.config.channelMask ^ (1 << ch)); }
    isChannelEnabled(ch) { return (this.config.channelMask >> ch) & 1; }
    toggleModal() { this.isOpen = !this.isOpen; const m = document.getElementById('viz-settings-modal'); const b = document.getElementById('viz-settings-btn'); if (m && b) { m.classList.toggle('visible', this.isOpen); b.classList.toggle('active', this.isOpen); } }

    createFloatingButton() {
        const btn = document.createElement('button');
        btn.id = 'viz-settings-btn';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        btn.onclick = this.toggleModal;
        document.body.appendChild(btn);
    }

    createModal() {
        const modal = document.createElement('div');
        modal.id = 'viz-settings-modal';
        const title = document.createElement('h3'); title.innerText = 'Visualizer Settings'; modal.appendChild(title);

        // --- Analysis Engine ---
        this.addSectionHeader(modal, 'Analysis Engine');
        modal.appendChild(this.createToggle('Active', this.config.showAnalysis, v => this.updateSetting('showAnalysis', v)));
        modal.appendChild(this.createSegmentedControl('Mode', [{ label: 'Chord', value: 'chord' }, { label: 'Roman', value: 'roman' }], this.config.analysisMode, v => { this.updateSetting('analysisMode', v); this.refreshKeyUI(); }));

        // Key Controls
        const keySection = document.createElement('div');
        keySection.id = 'key-control-section';
        keySection.style.cssText = 'margin-top:8px; padding:8px; background:rgba(255,255,255,0.05); border-radius:4px;';
        keySection.appendChild(this.createToggle('Auto Detect Scale', this.config.autoKey, v => { this.updateSetting('autoKey', v); this.refreshKeyUI(); }));

        // Tweaks: Memory & Sensitivity
        const tweaks = document.createElement('div');
        tweaks.id = 'key-tweaks';
        tweaks.style.marginTop = '10px';
        tweaks.appendChild(this.createSlider('Memory (s)', 0.5, 10.0, 0.5, this.config.keyHalfLife, v => this.updateSetting('keyHalfLife', v)));
        tweaks.appendChild(this.createSlider('Sensitivity', 0.1, 5.0, 0.1, this.config.keySensitivity, v => this.updateSetting('keySensitivity', v)));
        keySection.appendChild(tweaks);

        // Manual Selectors
        const selectorRow = document.createElement('div');
        selectorRow.id = 'key-manual-selectors';
        selectorRow.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:8px; transition:opacity 0.2s;';

        const rootSel = document.createElement('select'); rootSel.className = 'viz-select';
        NOTE_NAMES.forEach((name, idx) => {
            const o = document.createElement('option'); o.value = idx; o.text = name;
            if (idx === this.config.keyRoot) o.selected = true;
            rootSel.appendChild(o);
        });
        rootSel.onchange = (e) => this.updateSetting('keyRoot', parseInt(e.target.value));

        const typeSel = document.createElement('select'); typeSel.className = 'viz-select';
        Object.keys(SCALES).forEach(scaleName => {
            const o = document.createElement('option'); o.value = scaleName; o.text = scaleName;
            if (o.value === this.config.keyType) o.selected = true;
            typeSel.appendChild(o);
        });
        typeSel.onchange = (e) => this.updateSetting('keyType', e.target.value);

        selectorRow.append(rootSel, typeSel);
        keySection.appendChild(selectorRow);
        modal.appendChild(keySection);

        // --- Sequencer & Others ---
        this.addSectionHeader(modal, 'Sequencer');
        modal.appendChild(this.createSegmentedControl('Dir', [{ label: 'Left', value: -1 }, { label: 'Right', value: 1 }], this.config.scrollDirection, v => this.updateSetting('scrollDirection', v)));
        modal.appendChild(this.createSlider('Playhead', 0.05, 0.95, 0.01, this.config.playheadPosition, v => this.updateSetting('playheadPosition', v)));
        modal.appendChild(this.createSlider('Y-Scale', 2, 20, 0.5, this.config.pitchScale, v => this.updateSetting('pitchScale', v)));
        modal.appendChild(this.createSlider('Note Height', 1, 20, 0.5, this.config.noteHeight, v => this.updateSetting('noteHeight', v)));

        this.addSectionHeader(modal, 'Percussion');
        modal.appendChild(this.createToggle('Enabled', this.config.percEnabled, v => this.updateSetting('percEnabled', v)));
        modal.appendChild(this.createSlider('Midi CH', 1, 16, 1, this.config.percChannel, v => this.updateSetting('percChannel', v)));

        this.addSectionHeader(modal, 'Channels');
        modal.appendChild(this.createChannelGrid());

        document.body.appendChild(modal);
        this.refreshKeyUI();
    }

    refreshKeyUI() {
        const selectors = document.getElementById('key-manual-selectors');
        const tweaks = document.getElementById('key-tweaks');
        if (!selectors || !tweaks) return;

        if (this.config.autoKey) {
            selectors.style.opacity = '0.3'; selectors.style.pointerEvents = 'none';
            tweaks.style.opacity = '1.0'; tweaks.style.pointerEvents = 'all';
        } else {
            selectors.style.opacity = '1.0'; selectors.style.pointerEvents = 'all';
            tweaks.style.opacity = '0.3'; tweaks.style.pointerEvents = 'none';
        }
    }

    addSectionHeader(parent, text) {
         const h = document.createElement('div');
          h.innerText = text;
          h.style.cssText = 'font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px; margin: 15px 0 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;';
          parent.appendChild(h); 
    }
    createToggle(label, checked, onChange) { const wrapper = document.createElement('div'); wrapper.className = 'control-wrapper'; wrapper.style.cssText = 'display:flex; justify-content:space-between; align-items:center;'; const lbl = document.createElement('div'); lbl.className = 'control-label'; lbl.innerText = label; lbl.style.marginBottom = '0'; const toggle = document.createElement('div'); toggle.style.cssText = `width: 36px; height: 20px; border-radius: 10px; background: ${checked ? '#4ade80' : 'rgba(255,255,255,0.2)'}; position: relative; cursor: pointer; transition: background 0.2s;`; const thumb = document.createElement('div'); thumb.style.cssText = `width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.2s; transform: translateX(${checked ? '16px' : '0'}); box-shadow: 0 1px 3px rgba(0,0,0,0.3);`; toggle.appendChild(thumb); toggle.onclick = () => { checked = !checked; toggle.style.background = checked ? '#4ade80' : 'rgba(255,255,255,0.2)'; thumb.style.transform = `translateX(${checked ? '16px' : '0'})`; onChange(checked); }; wrapper.append(lbl, toggle); return wrapper; }
    createSegmentedControl(label, options, curr, onChange) { const wrapper = document.createElement('div'); wrapper.className = 'control-wrapper'; const lbl = document.createElement('div'); lbl.className = 'control-label'; lbl.innerText = label; wrapper.appendChild(lbl); const group = document.createElement('div'); group.className = 'seg-group'; options.forEach(opt => { const btn = document.createElement('button'); btn.innerText = opt.label; btn.className = `seg-btn ${opt.value === curr ? 'active' : ''}`; btn.onclick = () => { group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); onChange(opt.value); }; group.appendChild(btn); }); wrapper.appendChild(group); return wrapper; }
    createSlider(label, min, max, step, val, onChange) { const wrapper = document.createElement('div'); wrapper.className = 'control-wrapper'; const header = document.createElement('div'); header.style.cssText = 'display:flex;justify-content:space-between'; const lbl = document.createElement('div'); lbl.className = 'control-label'; lbl.innerText = label; const valDisplay = document.createElement('span'); valDisplay.className = 'val-display'; valDisplay.innerText = val; header.append(lbl, valDisplay); wrapper.appendChild(header); const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = val; input.className = 'viz-slider-input'; input.oninput = (e) => { const v = parseFloat(e.target.value); valDisplay.innerText = v; onChange(v); }; wrapper.appendChild(input); return wrapper; }
    createChannelGrid() { const wrapper = document.createElement('div'); wrapper.className = 'control-wrapper'; const grid = document.createElement('div'); grid.className = 'ch-grid'; for (let i = 0; i < 16; i++) { const btn = document.createElement('button'); btn.innerText = i + 1; const enabled = this.isChannelEnabled(i); btn.className = `ch-btn ${enabled ? 'active' : ''}`; btn.onclick = () => { this.toggleChannel(i); btn.classList.toggle('active'); }; grid.appendChild(btn); } wrapper.appendChild(grid); return wrapper; }

    injectStyles() { const css = ` #viz-settings-btn { position: absolute; top: 20px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: rgba(30, 30, 30, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); transition: all 0.3s ease; z-index: 2000; } #viz-settings-btn:hover { background: rgba(50, 50, 50, 0.8); transform: rotate(90deg); } #viz-settings-btn.active { background: #fff; color: #000; } #viz-settings-modal { position: absolute; top: 80px; right: 20px; width: 280px; background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 20px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 40px rgba(0,0,0,0.5); opacity: 0; transform: translateY(-10px) scale(0.95); pointer-events: none; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); z-index: 1999; font-family: -apple-system, sans-serif; color: #fff; max-height: 80vh; overflow-y: auto; } #viz-settings-modal.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; } #viz-settings-modal h3 { margin: 0 0 20px 0; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; } .control-wrapper { margin-bottom: 16px; } .control-label { font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 6px; text-transform: uppercase; font-weight: 600; } .seg-group { display: flex; background: rgba(0,0,0,0.3); padding: 3px; border-radius: 8px; } .seg-btn { flex: 1; background: transparent; border: none; padding: 8px; color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer; border-radius: 6px; transition: all 0.2s; } .seg-btn:hover { color: #fff; } .seg-btn.active { background: rgba(255,255,255,0.15); color: #fff; font-weight: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.2); } .val-display { font-size: 11px; color: #4ade80; font-family: monospace; } .viz-slider-input { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; outline: none; } .viz-slider-input::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.1s; } .viz-slider-input::-webkit-slider-thumb:hover { transform: scale(1.2); } .ch-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; } .ch-btn { background: rgba(255,255,255,0.05); border: none; border-radius: 4px; color: rgba(255,255,255,0.3); font-size: 10px; height: 24px; cursor: pointer; transition: all 0.2s; } .ch-btn.active { background: #4ade80; color: #000; font-weight: bold; box-shadow: 0 0 8px rgba(74, 222, 128, 0.4); } .viz-select { width: 100%; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 6px; font-size: 11px; outline: none; } `; const style = document.createElement('style'); style.innerHTML = css; document.head.appendChild(style); }
}
