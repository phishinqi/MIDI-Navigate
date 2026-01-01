// ws/constants.js

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// --- 音阶定义 ---
export const SCALES = {
    'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11],
    'Minor (Aeolian)': [0, 2, 3, 5, 7, 8, 10],
    'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
    'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
    'Dorian': [0, 2, 3, 5, 7, 9, 10],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10],
    'Lydian': [0, 2, 4, 6, 7, 9, 11],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'Locrian': [0, 1, 3, 5, 6, 8, 10],
    'Major Pentatonic': [0, 2, 4, 7, 9],
    'Minor Pentatonic': [0, 3, 5, 7, 10],
    'Blues': [0, 3, 5, 6, 7, 10],
    'Whole Tone': [0, 2, 4, 6, 8, 10],
    'Diminished (W-H)': [0, 2, 3, 5, 6, 8, 9, 11],
    'Diminished (H-W)': [0, 1, 3, 4, 6, 7, 9, 10],
    'Augmented': [0, 3, 4, 7, 8, 11],
    'Phrygian Dom.': [0, 1, 4, 5, 7, 8, 10],
    'Double Harmonic': [0, 1, 4, 5, 7, 8, 11],
    'Hungarian Minor': [0, 2, 3, 6, 7, 8, 11],
    'Hirajoshi': [0, 2, 3, 7, 8],
    'In Sen': [0, 1, 5, 7, 10]
};

// 简化查找表
export const SCALES_LOOKUP = {
    'Major': SCALES['Major (Ionian)'],
    'Minor': SCALES['Minor (Aeolian)']
};

// --- 和弦模板 ---
export const CHORD_TEMPLATES = [
    // Triads
    { name: '',       intervals: [0, 4, 7], quality: 'Maj' },
    { name: 'm',      intervals: [0, 3, 7], quality: 'Min' },
    { name: 'dim',    intervals: [0, 3, 6], quality: 'Dim' },
    { name: 'aug',    intervals: [0, 4, 8], quality: 'Aug' },
    { name: 'sus2',   intervals: [0, 2, 7], quality: 'Sus2' },
    { name: 'sus4',   intervals: [0, 5, 7], quality: 'Sus4' },

    // Sevenths
    { name: 'maj7',   intervals: [0, 4, 7, 11], quality: 'Maj7' },
    { name: 'm7',     intervals: [0, 3, 7, 10], quality: 'Min7' },
    { name: '7',      intervals: [0, 4, 7, 10], quality: 'Dom7' },
    { name: 'dim7',   intervals: [0, 3, 6, 9],  quality: 'Dim7' },
    { name: 'm7b5',   intervals: [0, 3, 6, 10], quality: 'HalfDim' },
    { name: 'mM7',    intervals: [0, 3, 7, 11], quality: 'MinMaj7' },
    { name: 'aug7',   intervals: [0, 4, 8, 10], quality: 'Aug7' },
    { name: 'maj7#5', intervals: [0, 4, 8, 11], quality: 'Maj7Sharp5' },
    { name: '7sus4',  intervals: [0, 5, 7, 10], quality: 'Dom7sus4' },

    // Extensions
    { name: '6',      intervals: [0, 4, 7, 9], quality: 'Maj6' },
    { name: 'm6',     intervals: [0, 3, 7, 9], quality: 'Min6' },
    { name: 'add9',   intervals: [0, 2, 4, 7], quality: 'Add9' },
    { name: 'm(add9)',intervals: [0, 2, 3, 7], quality: 'mAdd9' },
    { name: '9',      intervals: [0, 2, 4, 7, 10], quality: 'Dom9' },
    { name: 'maj9',   intervals: [0, 2, 4, 7, 11], quality: 'Maj9' },
    { name: 'min9',   intervals: [0, 2, 3, 7, 10], quality: 'Min9' }
];
