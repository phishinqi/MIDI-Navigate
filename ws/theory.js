// ws/theory.js
import { NOTE_NAMES, ROMAN_NUMERALS, SCALES, SCALES_LOOKUP, CHORD_TEMPLATES } from './constants.js';

/**
 * 调性检测 (Statistical Accumulation)
 */
export class KeyDetector {
    constructor() {
        // 12个音级 (Pitch Classes) 的能量池
        this.weights = new Array(12).fill(0);

        // 记录当前按下的音符
        this.heldNotes = new Set();

        // 预生成检测模板
        this.profiles = this.generateProfiles();

        // 状态
        this.currentKey = {
            root: 0,
            scaleName: 'Major (Ionian)',
            name: 'Detecting...',
            confidence: 0
        };
        this.currentScore = 0;
    }

    /**
     * 生成匹配模板
     */
    generateProfiles() {
        const profiles = [];
        for (const [scaleName, intervals] of Object.entries(SCALES)) {
            const template = new Array(12).fill(-5.0);
            intervals.forEach((interval, index) => {
                let weight = 2.0;
                if (index === 0) weight = 10.0;     // Root
                else if (interval === 7) weight = 7.0; // 5th
                else if (interval === 5) weight = 6.0; // 4th
                else if (interval === 4 || interval === 3) weight = 5.0; // 3rd
                template[interval] = weight;
            });
            profiles.push({ name: scaleName, template });
        }
        return profiles;
    }

    noteOn(note, sensitivity = 1.0) {
        this.heldNotes.add(note);
        this.weights[note % 12] += 10.0 * sensitivity;
    }

    noteOff(note) {
        this.heldNotes.delete(note);
    }

    update(dt, halfLife = 3.0) {
        const sustainRate = 20.0;
        for (const note of this.heldNotes) {
            this.weights[note % 12] += sustainRate * dt;
        }

        const safeHalfLife = Math.max(0.1, halfLife);
        const decayFactor = Math.pow(0.5, dt / safeHalfLife);

        for (let i = 0; i < 12; i++) {
            this.weights[i] *= decayFactor;
        }
    }

    detect() {
        const totalEnergy = this.weights.reduce((a, b) => a + b, 0);
        if (totalEnergy < 5) {
            this.currentKey.confidence = 0;
            return this.currentKey;
        }

        let bestScore = -Infinity;
        let secondBestScore = -Infinity;
        let bestCandidate = this.currentKey;

        for (let root = 0; root < 12; root++) {
            for (const profile of this.profiles) {
                let score = 0;
                for (let i = 0; i < 12; i++) {
                    const offset = (i - root + 12) % 12;
                    score += this.weights[i] * profile.template[offset];
                }

                if (score > bestScore) {
                    secondBestScore = bestScore;
                    bestScore = score;
                    // 简单的 Major/Minor 归类，用于UI指针颜色
                    const type = (profile.name.includes('Minor') || profile.name.includes('Dorian')) ? 'Minor' : 'Major';

                    bestCandidate = {
                        root: root,
                        type: type,
                        scaleName: profile.name, // 传递完整的 scaleName (如 'Harmonic Minor')
                        name: `${NOTE_NAMES[root]} ${profile.name}`
                    };
                } else if (score > secondBestScore) {
                    secondBestScore = score;
                }
            }
        }

        let confidence = 0;
        if (bestScore > 0) {
            confidence = Math.min(1.0, Math.max(0, (bestScore - secondBestScore) / bestScore));
        }
        bestCandidate.confidence = confidence;

        const switchThreshold = 1.2;

        if (bestCandidate.name !== this.currentKey.name) {
            if (bestScore > this.currentScore * switchThreshold) {
                this.currentKey = bestCandidate;
                this.currentScore = bestScore;
            } else {
                this.currentScore *= 0.99;
                this.currentKey.confidence = confidence * 0.5;
            }
        } else {
            this.currentScore = bestScore;
            this.currentKey.confidence = confidence;
        }

        return this.currentKey;
    }
}

/**
 * 和弦分析
 */
export class ChordAnalyzer {
    constructor() { this.activeNotes = new Set(); }
    addNote(note) { this.activeNotes.add(note); }
    removeNote(note) { this.activeNotes.delete(note); }

    detect() {
        const notes = Array.from(this.activeNotes).sort((a, b) => a - b);
        if (notes.length < 2) return null;

        const bassNote = notes[0];
        const bassPC = bassNote % 12;
        const pcs = [...new Set(notes.map(n => n % 12))].sort((a, b) => a - b);

        if (pcs.length < 2) return null;

        let bestMatch = null;
        let maxScore = -Infinity;

        for (let i = 0; i < pcs.length; i++) {
            const root = pcs[i];
            const currentIntervals = new Set(pcs.map(pc => (pc - root + 12) % 12));

            for (const template of CHORD_TEMPLATES) {
                let matchCount = 0;
                let missingCount = 0;
                let extraCount = 0;
                let missingIsFifth = false;

                for (let interval of template.intervals) {
                    if (currentIntervals.has(interval)) {
                        matchCount++;
                    } else {
                        missingCount++;
                        if (interval === 7) missingIsFifth = true;
                    }
                }
                extraCount = currentIntervals.size - matchCount;

                let score = 100;
                if (extraCount > 0) score -= extraCount * 60;
                if (missingCount > 0) {
                    if (missingCount === 1 && missingIsFifth) score -= 5;
                    else score -= missingCount * 25;
                }
                if (root === bassPC) score += 20;
                score += matchCount * 10;

                if (score > maxScore) {
                    maxScore = score;
                    const confidence = Math.max(0, Math.min(1, score / 150));
                    if (confidence > 0.3) {
                        let display = `${NOTE_NAMES[root]}${template.name}`;
                        if (root !== bassPC) display += `/${NOTE_NAMES[bassPC]}`;

                        bestMatch = {
                            root,
                            quality: template.quality,
                            name: display,
                            bass: bassPC,
                            suffix: template.name,
                            confidence
                        };
                    }
                }
            }
        }
        return bestMatch;
    }

    getRoman(chord, keyRoot, scaleName) {
        if (!chord) return '';

        // 1. 优先在完整库 SCALES 中查找 (支持 Harmonic Minor, Phrygian 等)
        // 2. 其次在 SCALES_LOOKUP 中查找 (UI 传入的简化名称 'Major' / 'Minor')
        // 3. 智能回退：如果 scaleName 包含 'Minor' 即使没找到也用 Aeolian
        // 4. 默认回退到 Major (Ionian)

        let targetIntervals = SCALES[scaleName] || SCALES_LOOKUP[scaleName];

        if (!targetIntervals) {
            if (scaleName && scaleName.includes('Minor')) targetIntervals = SCALES['Minor (Aeolian)'];
            else targetIntervals = SCALES['Major (Ionian)'];
        }

        // 计算和弦根音相对于调性主音的距离 (0-11)
        const relativeSemitone = (chord.root - keyRoot + 12) % 12;

        let degreeIndex = targetIntervals.indexOf(relativeSemitone);
        let accidental = '';

        // 如果根音不在自然音阶内 (离调)
        if (degreeIndex === -1) {
            const flat = (relativeSemitone - 1 + 12) % 12;
            const sharp = (relativeSemitone + 1) % 12;

            // 尝试找邻居 (例如 bIII, #IV)
            if (targetIntervals.includes(flat)) {
                degreeIndex = targetIntervals.indexOf(flat); accidental = '#';
            } else if (targetIntervals.includes(sharp)) {
                degreeIndex = targetIntervals.indexOf(sharp); accidental = 'b';
            }
        }

        // 实在找不到，返回问号
        if (degreeIndex === -1) return '?';

        const base = ROMAN_NUMERALS[degreeIndex] || '?';
        let roman = accidental + base;

        // 大小写处理 (Minor, Dim, HalfDim 用小写)
        const q = chord.quality;
        const minorQualities = ['Min', 'Min7', 'Dim', 'Dim7', 'HalfDim', 'Min6', 'Min9', 'mAdd9'];
        if (minorQualities.includes(q)) roman = roman.toLowerCase();

        // 后缀处理 (映射为罗马级数常用符号)
        let suffix = chord.suffix;
        if (suffix === 'm' || suffix === '') suffix = '';

        const map = {
            'maj7': 'M7',
            'dim': '°',
            'dim7': '°7',
            'm7b5': 'ø7',
            'aug': '+',
            'aug7': '+7',
            'sus4': 'sus4',
            'sus2': 'sus2',
            'add9': '(add9)'
        };
        if (map[suffix]) suffix = map[suffix];

        return roman + suffix;
    }
}
