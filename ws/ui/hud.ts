// ws/ui/hud.ts
import { t } from '../i18n';
import type { ChordResult, KeyResult } from '../types';
import { NOTE_NAMES } from '../constants';

export class AnalysisHUD {
    private container: HTMLElement;
    private chordNameEl: HTMLElement;
    private confBarEl: HTMLElement;
    private sourceBadgeEl: HTMLElement;
    private aliasesEl: HTMLElement;
    private activeNotesEl: HTMLElement;

    private statsPanel: HTMLElement;
    private bpmEl: HTMLElement;
    private meterEl: HTMLElement;
    private keyNameEl: HTMLElement;
    private keyConfEl: HTMLElement;
    private keyBarEl: HTMLElement;
    private fpsEl: HTMLElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'hud-container';

        const chordSection = document.createElement('div');
        chordSection.className = 'hud-chord-section';

        const header = document.createElement('div');
        header.className = 'hud-header';

        this.sourceBadgeEl = document.createElement('span');
        this.sourceBadgeEl.className = 'hud-source-badge local';
        this.sourceBadgeEl.innerHTML = `<span>⚡</span> LEGACY`;

        const confWrapper = document.createElement('div');
        confWrapper.className = 'hud-conf-wrapper';
        this.confBarEl = document.createElement('div');
        this.confBarEl.className = 'hud-conf-bar';
        confWrapper.appendChild(this.confBarEl);

        header.append(this.sourceBadgeEl, confWrapper);

        this.chordNameEl = document.createElement('div');
        this.chordNameEl.className = 'hud-chord-name';
        this.chordNameEl.textContent = '---';

        this.aliasesEl = document.createElement('div');
        this.aliasesEl.className = 'hud-aliases';
        this.aliasesEl.innerHTML = `<span class="label">ALTERNATIVES</span><span class="value">---</span>`;

        const notesRow = document.createElement('div');
        notesRow.className = 'hud-notes-row';
        notesRow.innerHTML = `<span class="label">ACTIVE NOTES</span>`;
        this.activeNotesEl = document.createElement('div');
        this.activeNotesEl.className = 'hud-active-notes';
        notesRow.appendChild(this.activeNotesEl);

        chordSection.append(header, this.chordNameEl, this.aliasesEl, notesRow);

        this.statsPanel = document.createElement('div');
        this.statsPanel.className = 'hud-stats-panel';

        const statsHeader = document.createElement('div');
        statsHeader.className = 'hud-stats-header';
        statsHeader.innerHTML = `
            <span class="label"><span class="icon">Activity</span> GLOBAL ANALYSIS</span>
        `;
        this.fpsEl = document.createElement('span');
        this.fpsEl.className = 'hud-fps';
        this.fpsEl.textContent = '60 FPS';
        statsHeader.appendChild(this.fpsEl);

        const statsGrid = document.createElement('div');
        statsGrid.className = 'hud-stats-grid';

        const bpmCol = this.createStatCol('BPM');
        this.bpmEl = bpmCol.querySelector('.value') as HTMLElement;
        this.bpmEl.textContent = '120';

        const meterCol = this.createStatCol('METER');
        this.meterEl = meterCol.querySelector('.value') as HTMLElement;
        this.meterEl.classList.add('accent');
        this.meterEl.textContent = '4/4';

        const keyCol = document.createElement('div');
        keyCol.className = 'hud-stat-col';
        keyCol.innerHTML = `
            <div class="row">
                <span class="label">KEY</span>
                <span class="conf-text">0%</span>
                <div class="mini-bar-bg"><div class="mini-bar-fill"></div></div>
            </div>
            <div class="value key-name">C Major</div>
            <div class="sub-value">or ---</div>
        `;
        this.keyNameEl = keyCol.querySelector('.key-name') as HTMLElement;
        this.keyConfEl = keyCol.querySelector('.conf-text') as HTMLElement;
        this.keyBarEl = keyCol.querySelector('.mini-bar-fill') as HTMLElement;

        statsGrid.append(bpmCol, this.createDivider(), meterCol, this.createDivider(), keyCol);

        this.statsPanel.append(statsHeader, statsGrid);

        this.container.append(chordSection, this.statsPanel);
        document.body.appendChild(this.container);
    }

    private createStatCol(label: string): HTMLElement {
        const el = document.createElement('div');
        el.className = 'hud-stat-col center';
        el.innerHTML = `<span class="label">${label}</span><span class="value">--</span>`;
        return el;
    }

    private createDivider(): HTMLElement {
        const d = document.createElement('div');
        d.className = 'hud-divider';
        return d;
    }

    update(chord: ChordResult | null, key: KeyResult, activeNotes: number[], fps: number): void {
        this.fpsEl.textContent = `${Math.round(fps)} FPS`;
        if (fps < 30) this.fpsEl.classList.add('low');
        else this.fpsEl.classList.remove('low');

        this.activeNotesEl.innerHTML = '';
        if (activeNotes.length > 0) {
            const sorted = [...activeNotes].sort((a, b) => a - b);
            const noteNames = [...new Set(sorted.map(n => NOTE_NAMES[n % 12] + Math.floor(n / 12)))];

            noteNames.forEach(name => {
                const s = document.createElement('span');
                s.className = 'hud-note-pill';
                s.textContent = name;
                this.activeNotesEl.appendChild(s);
            });
        } else {
            const s = document.createElement('span');
            s.className = 'hud-note-empty';
            s.textContent = '...';
            this.activeNotesEl.appendChild(s);
        }

        if (chord) {
            this.chordNameEl.textContent = chord.name;
            this.confBarEl.style.width = '100%';
            this.container.classList.add('has-chord');
        } else {
            this.chordNameEl.textContent = '---';
            this.confBarEl.style.width = '0%';
            this.container.classList.remove('has-chord');
        }

        if (key) {
            this.keyNameEl.textContent = key.name;
            const conf = Math.round(key.confidence * 100);
            this.keyConfEl.textContent = `${conf}%`;
            this.keyBarEl.style.width = `${Math.max(5, conf)}%`;
            this.keyBarEl.style.opacity = `${key.confidence}`;
        }
    }
}
