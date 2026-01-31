// ws/ui.ts
import type { VisualizerConfig, ConfigChangeCallback } from './types';
import { SCALES, NOTE_NAMES } from './constants';
import { t, onLanguageChanged } from './i18n';
import { injectStyles } from './ui/styles';
import * as Controls from './ui/controls';

const DEFAULT_CONFIG: VisualizerConfig = {
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
    keyHalfLife: 3.0,
    keySensitivity: 1.0,

    // Percussion
    percEnabled: true,
    percChannel: 10,
    percRows: 2,
    percCols: 4,
    percBaseSize: 50,
    percSpacing: 10
};

export class SettingsManager {
    private config: VisualizerConfig;
    private onConfigChange: ConfigChangeCallback | null;
    private isOpen: boolean;

    constructor(onConfigChange?: ConfigChangeCallback) {
        this.config = { ...DEFAULT_CONFIG };
        this.onConfigChange = onConfigChange || null;
        this.isOpen = false;
        this.toggleModal = this.toggleModal.bind(this);
        this.loadSettings();

        // Defaults check
        if (this.config.keyHalfLife === undefined) this.config.keyHalfLife = 3.0;
        if (this.config.keySensitivity === undefined) this.config.keySensitivity = 1.0;
        if (!Object.keys(SCALES).includes(this.config.keyType)) this.config.keyType = 'Major (Ionian)';

        injectStyles();
        this.createFloatingButton();
        this.createModal();
    }

    private loadSettings(): void {
        const saved = localStorage.getItem('midi_viz_settings');
        if (saved) {
            try {
                this.config = { ...this.config, ...JSON.parse(saved) };
            } catch (e) { }
        }
    }

    private saveSettings(): void {
        localStorage.setItem('midi_viz_settings', JSON.stringify(this.config));
    }

    updateSetting<K extends keyof VisualizerConfig>(key: K, value: VisualizerConfig[K]): void {
        this.config[key] = value;
        this.saveSettings();
        if (this.onConfigChange) this.onConfigChange(key, value);
    }

    get<K extends keyof VisualizerConfig>(key: K): VisualizerConfig[K] {
        return this.config[key];
    }

    toggleChannel(ch: number): void {
        this.updateSetting('channelMask', this.config.channelMask ^ (1 << ch));
    }

    isChannelEnabled(ch: number): boolean {
        return Boolean((this.config.channelMask >> ch) & 1);
    }

    toggleModal(): void {
        this.isOpen = !this.isOpen;
        const m = document.getElementById('viz-settings-modal');
        const b = document.getElementById('viz-settings-btn');
        const backdrop = document.getElementById('viz-settings-backdrop');

        if (m && b && backdrop) {
            m.classList.toggle('visible', this.isOpen);
            b.classList.toggle('active', this.isOpen);
            backdrop.classList.toggle('visible', this.isOpen);
        }
    }

    private createFloatingButton(): void {
        const btn = document.createElement('button');
        btn.id = 'viz-settings-btn';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        btn.onclick = this.toggleModal;
        document.body.appendChild(btn);
    }

    private createModal(): void {
        // 1. Create Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'viz-settings-backdrop';
        backdrop.className = 'modal-backdrop';
        backdrop.onclick = () => this.toggleModal(); // Click outside to close
        document.body.appendChild(backdrop);

        // 2. Create Modal Window
        const modal = document.createElement('div');
        modal.id = 'viz-settings-modal';

        // 3. Create Header
        const header = document.createElement('div');
        header.className = 'viz-modal-header';

        const title = document.createElement('div');
        title.className = 'viz-modal-title';
        title.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            ${t('ws_visualizer.title')}
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'viz-modal-close';
        closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        closeBtn.onclick = this.toggleModal;

        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // 4. Create Content Wrapper
        const content = document.createElement('div');
        content.className = 'viz-modal-content';

        // --- Analysis Engine Section ---
        Controls.createSectionHeader(content, t('ws_visualizer.sections.analysis'));
        content.appendChild(Controls.createToggle(t('ws_visualizer.analysis.active'), this.config.showAnalysis, v => this.updateSetting('showAnalysis', v)));
        content.appendChild(Controls.createSegmentedControl(t('ws_visualizer.analysis.display_mode'), [
            { label: t('ws_visualizer.analysis.chord'), value: 'chord' },
            { label: t('ws_visualizer.analysis.roman'), value: 'roman' }
        ], this.config.analysisMode, v => {
            this.updateSetting('analysisMode', v as 'chord' | 'roman');
            this.refreshKeyUI();
        }));

        // Key Detection Card
        const keyCard = document.createElement('div');
        keyCard.className = 'settings-card';
        keyCard.id = 'key-control-section';

        keyCard.appendChild(Controls.createToggle(t('ws_visualizer.analysis.auto_detect'), this.config.autoKey, v => {
            this.updateSetting('autoKey', v);
            this.refreshKeyUI();
        }));

        // Auto-detection Tweaks
        const tweaks = document.createElement('div');
        tweaks.id = 'key-tweaks';
        tweaks.style.cssText = 'margin-top: 12px;';
        tweaks.appendChild(Controls.createSlider(t('ws_visualizer.analysis.memory'), 0.5, 10.0, 0.5, this.config.keyHalfLife, v => this.updateSetting('keyHalfLife', v)));
        tweaks.appendChild(Controls.createSlider(t('ws_visualizer.analysis.sensitivity'), 0.1, 5.0, 0.1, this.config.keySensitivity, v => this.updateSetting('keySensitivity', v)));
        keyCard.appendChild(tweaks);

        // Manual Key Selectors
        const selectorRow = document.createElement('div');
        selectorRow.id = 'key-manual-selectors';
        selectorRow.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 12px; transition: opacity 0.3s;';

        const rootSel = document.createElement('select');
        rootSel.className = 'viz-select';
        NOTE_NAMES.forEach((name, idx) => {
            const o = document.createElement('option');
            o.value = String(idx);
            o.text = name;
            if (idx === this.config.keyRoot) o.selected = true;
            rootSel.appendChild(o);
        });
        rootSel.onchange = (e) => this.updateSetting('keyRoot', parseInt((e.target as HTMLSelectElement).value));

        const typeSel = document.createElement('select');
        typeSel.className = 'viz-select';
        Object.keys(SCALES).forEach(scaleName => {
            const o = document.createElement('option');
            o.value = scaleName;
            o.text = scaleName;
            if (o.value === this.config.keyType) o.selected = true;
            typeSel.appendChild(o);
        });
        typeSel.onchange = (e) => this.updateSetting('keyType', (e.target as HTMLSelectElement).value);

        selectorRow.append(rootSel, typeSel);
        keyCard.appendChild(selectorRow);
        content.appendChild(keyCard);

        // --- Sequencer Section ---
        Controls.createSectionHeader(content, t('ws_visualizer.sections.sequencer'));
        content.appendChild(Controls.createSegmentedControl(t('ws_visualizer.sequencer.scroll_direction'), [
            { label: t('ws_visualizer.sequencer.left'), value: -1 },
            { label: t('ws_visualizer.sequencer.right'), value: 1 }
        ], this.config.scrollDirection, v => this.updateSetting('scrollDirection', v as -1 | 1)));

        content.appendChild(Controls.createSlider(t('ws_visualizer.sequencer.playhead_position'), 0.05, 0.95, 0.01, this.config.playheadPosition, v => this.updateSetting('playheadPosition', v)));
        content.appendChild(Controls.createSlider(t('ws_visualizer.sequencer.pitch_scale'), 2, 20, 0.5, this.config.pitchScale, v => this.updateSetting('pitchScale', v)));
        content.appendChild(Controls.createSlider(t('ws_visualizer.sequencer.note_height'), 1, 20, 0.5, this.config.noteHeight, v => this.updateSetting('noteHeight', v)));

        // --- Percussion Section ---
        Controls.createSectionHeader(content, t('ws_visualizer.sections.percussion'));
        content.appendChild(Controls.createToggle(t('ws_visualizer.percussion.enabled'), this.config.percEnabled, v => this.updateSetting('percEnabled', v)));
        content.appendChild(Controls.createSlider(t('ws_visualizer.percussion.midi_channel'), 1, 16, 1, this.config.percChannel, v => this.updateSetting('percChannel', v)));

        // --- Channel Mask Section ---
        Controls.createSectionHeader(content, t('ws_visualizer.sections.channels'));
        content.appendChild(Controls.createChannelGrid(
            (ch) => this.isChannelEnabled(ch),
            (ch) => this.toggleChannel(ch)
        ));

        modal.appendChild(content);
        document.body.appendChild(modal);
        this.refreshKeyUI();

        // Listen for language changes and recreate modal
        onLanguageChanged(() => {
            const existingModal = document.getElementById('viz-settings-modal');
            const existingBackdrop = document.getElementById('viz-settings-backdrop');
            if (existingModal) existingModal.remove();
            if (existingBackdrop) existingBackdrop.remove();
            this.createModal();
        });
    }

    private refreshKeyUI(): void {
        const selectors = document.getElementById('key-manual-selectors');
        const tweaks = document.getElementById('key-tweaks');
        if (!selectors || !tweaks) return;

        if (this.config.autoKey) {
            selectors.style.opacity = '0.3';
            selectors.style.pointerEvents = 'none';
            tweaks.style.opacity = '1.0';
            tweaks.style.pointerEvents = 'all';
        } else {
            selectors.style.opacity = '1.0';
            selectors.style.pointerEvents = 'all';
            tweaks.style.opacity = '0.3';
            tweaks.style.pointerEvents = 'none';
        }
    }
}
