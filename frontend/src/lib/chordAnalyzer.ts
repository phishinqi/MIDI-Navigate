// Advanced Chord Detection System
// Supports symmetrical chords, enharmonic spellings, and multiple interpretations

// Configuration & Defaults
// ============================================================================

export const DEFAULT_OPTIONS = {
    change_from_first: true,     // Prioritize alterations detection
    original_first: true,        // Prefer original voicing analysis first
    original_first_ratio: 0.8,   // Confidence threshold to accept original match immediately
    same_note_special: false,    // Prioritize exact pitch class set matches
    whole_detect: true,          // Fallback to exhaustive inversion search
    poly_chord_first: false,     // Attempt polychord splitting first
    root_preference: false,      // Bias towards lowest note as root
    show_degree: false,          // Show intervals (omit 3) instead of notes
    similarity_ratio: 0.6,       // Threshold for loose matches
    normalization_octave: 4,     // Default octave for pitch-class only inputs
};

// Type Definitions

export type Note = string | number;

export interface NormalizedNote {
    name: string;           // E.g., "C", "F#", "Bb"
    pitchClass: number;     // 0-11
    octave: number;         // MIDI octave
    midi: number;           // MIDI note number
}

export interface ChordDetectionResult {
    root: string;                   // Root note name
    chordType: string;              // E.g., "maj7", "m11", "dim7"
    bass: string | null;            // Bass note for slash chords
    extensions: number[];           // E.g., [9, 13]
    alterations: string[];          // E.g., ["b5", "#9"]
    omissions: string[];            // E.g., ["omit3"]
    confidence: number;             // 0-1
    reasoning: string;              // Human-readable explanation
    formatted: string;              // E.g., "Cmaj7", "A/C"
    complexity: number;             // Accidental penalty score
    aliases?: string[];             // Alternative names (e.g., Tritone Sub)
    // New fields for internal logic
    isPolychord?: boolean;
    upperStructure?: string;
    lowerStructure?: string;
}

export type DetectionMode = 'strict' | 'loose';

export interface ChordAnalysisOptions {
    mode?: DetectionMode;
    maxResults?: number;
    minConfidence?: number;

    // Algorithm flags
    change_from_first?: boolean;
    original_first?: boolean;
    original_first_ratio?: number;
    same_note_special?: boolean;
    whole_detect?: boolean;
    poly_chord_first?: boolean;
    root_preference?: boolean;
    show_degree?: boolean;
    get_chord_type?: boolean; // If true, return object (default behavior here), if false return string (not used in TS usually)
    similarity_ratio?: number;
    custom_mapping?: any[]; // Placeholder for custom mapping injection
}

// Constants

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const INTERVAL_NAMES = [
    'Unison', 'b2', '2', 'm3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7'
];

const ENHARMONIC_MAP: { [key: string]: string } = {
    'C#': 'Db', 'Db': 'C#',
    'D#': 'Eb', 'Eb': 'D#',
    'F#': 'Gb', 'Gb': 'F#',
    'G#': 'Ab', 'Ab': 'G#',
    'A#': 'Bb', 'Bb': 'A#',
    'E#': 'F', 'Fb': 'E',
    'B#': 'C', 'Cb': 'B'
};

// Chord patterns: intervals from root
const CHORD_PATTERNS: { [key: string]: number[] } = {
    // Two-note voicings (incomplete chords) - MUST come before triads for priority
    '5': [0, 7],                        // Power Chord (perfect 5th)
    '(no5)': [0, 4],                    // Major no5 (root + major 3rd)
    'm(no5)': [0, 3],                   // Minor no5 (root + minor 3rd)
    'sus2(no5)': [0, 2],                // Sus2 no5 (root + major 2nd)
    'sus4(no5)': [0, 5],                // Sus4 no5 (root + perfect 4th)

    // Three-note incomplete voicings
    'sus2add3': [0, 2, 4],              // Sus2 with added major 3rd (cluster)

    // Triads
    '': [0, 4, 7],                      // Major
    'm': [0, 3, 7],                     // Minor
    'dim': [0, 3, 6],                   // Diminished
    'aug': [0, 4, 8],                   // Augmented
    'sus2': [0, 2, 7],                  // Suspended 2
    'sus4': [0, 5, 7],                  // Suspended 4

    // Shell Voicings (Jazz)
    'maj7 shell': [0, 4, 11],
    '7 shell': [0, 4, 10],
    'm7 shell': [0, 3, 10],

    // Add chords (4-note)
    'add9': [0, 2, 4, 7],               // Major add 9
    'add6': [0, 4, 7, 9],               // Major add 6
    'm add6': [0, 3, 7, 9],             // Minor add 6
    'add#9': [0, 4, 7, 15],             // Major add #9 (spanning octave)
    'add11': [0, 4, 5, 7],              // Major add 11 (Cluster)
    'm add11': [0, 3, 5, 7],            // Minor add 11 (Cluster)

    // Seventh chords
    'maj7': [0, 4, 7, 11],              // Major 7
    'm7': [0, 3, 7, 10],                // Minor 7
    '7': [0, 4, 7, 10],                 // Dominant 7
    'dim7': [0, 3, 6, 9],               // Diminished 7
    'm7b5': [0, 3, 6, 10],              // Half-diminished
    'mMaj7': [0, 3, 7, 11],             // Minor-Major 7
    'mMaj7#5': [0, 3, 8, 11],           // Minor-Major 7 augmented 5th
    'maj7#5': [0, 4, 8, 11],            // Major 7 augmented 5th
    'mMaj9': [0, 3, 7, 11, 14],         // Minor-Major 9
    'aug7': [0, 4, 8, 10],              // Augmented 7

    // Extended chords (9ths)
    'maj9': [0, 4, 7, 11, 14],          // Major 9
    'm9': [0, 3, 7, 10, 14],            // Minor 9
    '9': [0, 4, 7, 10, 14],             // Dominant 9

    // Lydian chords (#11)
    'maj7#11': [0, 4, 7, 11, 18],       // Major 7 #11
    'maj9#11': [0, 4, 7, 11, 14, 18],   // Major 9 #11
    'maj#4': [0, 4, 6],                 // Lydian Triad (Simpsons)

    // Extended chords (11ths)
    'maj11': [0, 4, 7, 11, 14, 17],     // Major 11
    'm11': [0, 3, 7, 10, 14, 17],       // Minor 11
    'm11(no9)': [0, 3, 7, 10, 17],      // Minor 11 (omit 9)
    '11': [0, 4, 7, 10, 14, 17],        // Dominant 11

    // Extended chords (13ths)
    'maj13': [0, 4, 7, 11, 14, 21],     // Major 13
    'm13': [0, 3, 7, 10, 14, 21],       // Minor 13
    '13': [0, 4, 7, 10, 14, 21],        // Dominant 13
    '13(no11)': [0, 4, 7, 10, 14, 21],  // Dominant 13 (omit 11) - same as 13 but useful for explicit naming if needed
    '13(no9)': [0, 4, 7, 10, 21],       // Dominant 13 (omit 9)
};

// Note Parsing and Normalization

function parseNote(note: Note): NormalizedNote {
    if (typeof note === 'number') {
        // MIDI number
        const octave = Math.floor(note / 12) - 1;
        const pitchClass = note % 12;
        const name = NOTE_NAMES[pitchClass];
        return { name, pitchClass, octave, midi: note };
    } else {
        // String notation (e.g., "C4", "F#3", "Bb2")
        const match = note.match(/^([A-G][#b]?)(\d+)?$/);
        if (!match) {
            throw new Error(`Invalid note format: ${note}`);
        }

        const noteName = match[1];
        const octave = match[2] ? parseInt(match[2]) : 4;

        // Convert note name to pitch class
        let pitchClass = 0;
        const baseNote = noteName[0];
        const baseIndex = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(baseNote);
        const semitones = [0, 2, 4, 5, 7, 9, 11][baseIndex];
        pitchClass = semitones;

        if (noteName.includes('#')) pitchClass += 1;
        if (noteName.includes('b')) pitchClass -= 1;

        pitchClass = (pitchClass + 12) % 12;
        const midi = (octave + 1) * 12 + pitchClass;

        return { name: noteName, pitchClass, octave, midi };
    }
}

function getPitchClass(note: NormalizedNote): number {
    return note.pitchClass;
}

function getIntervals(notes: NormalizedNote[], explicitRoot?: NormalizedNote): number[] {
    if (notes.length === 0) return [];

    // If explicitRoot is provided, use it. Otherwise use the first note (lowest).
    const rootNote = explicitRoot || notes[0];

    // Calculate intervals based on actual MIDI pitch difference
    // This preserves octave information which is critical for extended chords
    return notes.map(n => {
        // Calculate the semitone distance from root
        let interval = n.midi - rootNote.midi;

        // Normalize to positive intervals
        while (interval < 0) {
            interval += 12;
        }

        return interval;
    }).sort((a, b) => a - b);
}

function calculateComplexity(noteName: string): number {
    let complexity = 0;
    // Prefer flats over sharps (b = 1, # = 1.5)
    complexity += (noteName.match(/#/g) || []).length * 1.5;
    complexity += (noteName.match(/b/g) || []).length * 1.0;
    // Double sharps/flats are more complex
    complexity += (noteName.match(/x/g) || []).length * 3;
    complexity += (noteName.match(/bb/g) || []).length * 2.5;
    return complexity;
}

function getEnharmonicEquivalent(note: string): string {
    // Remove octave number if present
    const noteName = note.replace(/\d+$/, '');
    const octave = note.match(/\d+$/)?.[0] || '';

    const enharmonic = ENHARMONIC_MAP[noteName];
    return enharmonic ? enharmonic + octave : note;
}

/**
 * Generate all reasonable enharmonic spellings for a MIDI note number
 * Returns both sharp and flat versions where applicable
 */
function getEnharmonicSpellings(midi: number): string[] {
    const octave = Math.floor(midi / 12) - 1;
    const pitchClass = midi % 12;

    const spellings: string[] = [];

    // Add sharp spelling
    const sharpName = NOTE_NAMES[pitchClass];
    spellings.push(sharpName);

    // Add flat spelling if it exists and is different
    const flatName = FLAT_NOTE_NAMES[pitchClass];
    if (flatName !== sharpName) {
        spellings.push(flatName);
    }

    return spellings;
}

/**
 * Score a set of note names based on enharmonic simplicity
 * Lower score = better (simpler spelling)
 */
function scoreEnharmonicSpelling(noteNames: string[]): number {
    let score = 0;
    let sharpCount = 0;
    let flatCount = 0;

    for (const name of noteNames) {
        const baseName = name.replace(/\d+$/, ''); // Remove octave

        // Count accidentals
        const sharps = (baseName.match(/#/g) || []).length;
        const flats = (baseName.match(/b/g) || []).length;

        sharpCount += sharps;
        flatCount += flats;

        // Penalize accidentals (flats slightly preferred over sharps in classical theory)
        score += sharps * 1.5;
        score += flats * 1.0;

        // Penalize double accidentals heavily
        if (baseName.includes('##') || baseName.includes('bb')) {
            score += 10;
        }
    }

    // Penalize mixed accidentals (inconsistent spelling)
    if (sharpCount > 0 && flatCount > 0) {
        score += 2;
    }

    return score;
}

// ============================================================================
// Helper Functions for New Logic
// ============================================================================

/**
 * Split a large chord into upper and lower structures (Polychord)
 */
function splitPolychord(notes: NormalizedNote[]): { upper: NormalizedNote[], lower: NormalizedNote[] } | null {
    if (notes.length < 4) return null;

    const sorted = [...notes].sort((a, b) => a.midi - b.midi);

    // Strategy:
    // < 6 notes: Bottom note vs Rest (Slash chord style)
    // >= 6 notes: Bottom N/2 vs Top N/2

    if (notes.length < 6) {
        return {
            lower: [sorted[0]],
            upper: sorted.slice(1)
        };
    } else {
        const splitIndex = Math.floor(notes.length / 2);
        return {
            lower: sorted.slice(0, splitIndex),
            upper: sorted.slice(splitIndex)
        };
    }
}

/**
 * Format note names based on degree preference
 */
function formattedNoteName(root: NormalizedNote, target: NormalizedNote, showDegree: boolean): string {
    if (!showDegree) return target.name;

    const interval = (target.midi - root.midi + 1200) % 12; // Mod 12 positive
    return INTERVAL_NAMES[interval] || target.name;
}

/**
 * Helper to format a note list (extensions/alterations) based on options
 */
function formatNoteList(root: NormalizedNote, noteIndices: number[], notes: NormalizedNote[], showDegree: boolean): string[] {
    // If we have indices (intervals), use them for degree mode
    // If we have note objects, use them for note name mode
    // This helper might need to be specific to the context.

    // Actually, detectDominantFeatures logic constructs strings like "b9", "#11" directly.
    // If show_degree is FALSE, we want to convert "b9" -> "Db" (relative to C).
    // This requires calculating the actual note from root + interval.
    return [];
}

/**
 * Analyze a specific voicing (fixed order)
 */
function analyzeVoicing(notes: NormalizedNote[], options: ChordAnalysisOptions): ChordDetectionResult | null {
    const intervals = getIntervals(notes);

    // 1. Exact Pattern Match
    let chordType = matchPattern(intervals, options.custom_mapping);
    let omissions: string[] = [];
    let alterations: string[] = [];
    let extensions: number[] = [];

    // 2. Logic for 'change_from_first' (Alterations)
    if (options.change_from_first) {
        const domFeatures = detectDominantFeatures(intervals, notes, options);
        if (domFeatures) {
            // Merge results
            return domFeatures;
        }
    }

    if (!chordType) {
        // Try omissions
        const matchOmit = matchPatternWithOmissions(intervals);
        if (matchOmit) {
            chordType = matchOmit.type;
            omissions = matchOmit.omissions;
        }
    }

    if (chordType) {
        // Format omissions with degrees if needed
        const formattedOmissions = options.show_degree
            ? omissions // Omissions are usually static strings like "omit5", logic needed if specific notes
            : omissions;

        return {
            root: notes[0].name,
            chordType,
            bass: null,
            extensions,
            alterations,
            omissions: formattedOmissions,
            confidence: omissions.length > 0 ? 0.8 : 0.95,
            reasoning: 'Voicing analysis match',
            formatted: `${notes[0].name}${chordType}`,
            complexity: calculateComplexity(notes[0].name)
        };
    }

    return null;
}

// Pattern Matching

function intervalsMatch(intervals: number[], pattern: number[]): boolean {
    // STRICT MATCHING: Only allow exact matches (same length, same intervals)
    // This prevents [0, 2, 4] from matching add9 [0, 2, 4, 7]

    if (intervals.length !== pattern.length) return false;

    // Normalize both arrays to single octave for comparison
    const normalizeToOctave = (arr: number[]) => arr.map(n => n % 12).sort((a, b) => a - b);

    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const sortedPattern = [...pattern].sort((a, b) => a - b);

    // Try exact match first
    if (sortedIntervals.every((val, idx) => val === sortedPattern[idx])) {
        return true;
    }

    // For wide voicings, try octave-normalized match
    const normalizedIntervals = normalizeToOctave(intervals);
    const normalizedPattern = normalizeToOctave(pattern);

    return normalizedIntervals.every((val, idx) => val === normalizedPattern[idx]);
}

function matchDiminished7(intervals: number[]): boolean {
    return intervalsMatch(intervals, [0, 3, 6, 9]);
}

function matchAugmented(intervals: number[]): boolean {
    return intervalsMatch(intervals, [0, 4, 8]);
}

function matchPattern(intervals: number[], customPatterns?: any): string | null {
    // Use custom patterns if provided, otherwise default
    const patterns = customPatterns || CHORD_PATTERNS;

    // Try exact matches only - patterns are ordered, so earlier patterns have priority
    for (const [chordType, pattern] of Object.entries(patterns)) {
        if (intervalsMatch(intervals, pattern as number[])) {
            return chordType;
        }
    }

    return null;
}

function matchPatternWithOmissions(intervals: number[]): { type: string, omissions: string[] } | null {
    // 1. Try matching patterns assuming the 5th (7) is omitted
    for (const [chordType, pattern] of Object.entries(CHORD_PATTERNS)) {
        // Only consider patterns that actually have a perfect 5th
        if (!pattern.includes(7)) continue;

        // Remove 5th from pattern
        const patternWithout5 = pattern.filter(i => i !== 7);

        if (intervalsMatch(intervals, patternWithout5)) {
            // Note: If patternWithout5 is just [0, 4] (C, E) -> Major Triad omit 5. Valid.
            return { type: chordType, omissions: ['omit5'] };
        }
    }

    // 2. Try matching patterns assuming the 3rd (3 or 4) is omitted (omit3)
    for (const [chordType, pattern] of Object.entries(CHORD_PATTERNS)) {
        // Check for 3rd inclusion
        const hasMajor3 = pattern.includes(4);
        const hasMinor3 = pattern.includes(3);

        if (!hasMajor3 && !hasMinor3) continue;

        let patternWithout3: number[] = [];

        if (hasMajor3) {
            patternWithout3 = pattern.filter(i => i !== 4);
        } else if (hasMinor3) {
            patternWithout3 = pattern.filter(i => i !== 3);
        }

        if (intervalsMatch(intervals, patternWithout3)) {
            return { type: chordType, omissions: ['omit3'] };
        }

        // 3. Try matching patterns assuming BOTH 3rd and 5th are omitted (omit3,5)
        // Only if it has both 3rd and 5th
        if (pattern.includes(7)) {
            const patternWithout3and5 = patternWithout3.filter(i => i !== 7);
            if (intervalsMatch(intervals, patternWithout3and5)) {
                return { type: chordType, omissions: ['omit3', 'omit5'] };
            }
        }
    }

    // 4. Try Shell Dyads (2-note shells)
    // e.g. C, B (Major 7 Shell); C, Bb (Dominant 7 Shell)

    // Explicit 2-note Dyad Checks (normalized to single octave)
    const normalized = intervals.map(n => n % 12).sort((a, b) => a - b);
    // Remove duplicates
    const finalSet = [...new Set(normalized)];
    if (finalSet.length === 2 && finalSet[0] === 0) {
        const interval = finalSet[1];
        if (interval === 11) return { type: 'maj7', omissions: ['no3', 'omit5'] };
        if (interval === 10) return { type: '7', omissions: ['no3', 'omit5'] };
        // interval 7 is Power Chord (handled by '5' pattern)
        // interval 4 is Major (omit 5)
        // interval 3 is Minor (omit 5)
    }

    return null;
}

// Merge Rules



function detectDominantFeatures(intervals: number[], notes: NormalizedNote[], options: ChordAnalysisOptions = {}): ChordDetectionResult | null {
    // 1. Check for Dominant Shell or Strong Dominant Context
    const hasMajor3 = intervals.includes(4) || intervals.includes(16) || intervals.includes(28);
    const hasMinor3 = intervals.includes(3) || intervals.includes(15) || intervals.includes(27);
    const has7 = intervals.includes(10) || intervals.includes(22); // b7
    const hasMaj7 = intervals.includes(11) || intervals.includes(23);

    // Basic requirement
    if (!has7 && !hasMaj7) return null;
    // We strictly look for b7 or "Shell-less" voiced dominants
    if (hasMaj7) return null;

    // 2. Scan for Extensions and Alterations
    const extensions: number[] = [];
    const alterations: string[] = [];
    const omissions: string[] = [];

    const hasInterval = (targetMod12: number) => {
        return intervals.some(i => (i % 12) === targetMod12);
    };

    const has5 = hasInterval(7);
    const hasb5 = hasInterval(6); // tritone
    const hasSharp5 = hasInterval(8); // minor 6th

    const hasb9 = hasInterval(1);
    const has9 = hasInterval(2);
    const hasSharp9 = hasInterval(3);

    const has11 = hasInterval(5);
    const hasb13 = hasInterval(8); // minor 6th
    const has13 = hasInterval(9);

    // Analyze Extensions
    if (has9) extensions.push(9);
    if (has13) extensions.push(13);

    // 5th / Tritone Logic
    if (hasb5) {
        if (has5) {
            alterations.push('#11'); // 7(#11)
        } else {
            const hasNaturalTensions = extensions.includes(9) || extensions.includes(13);
            if (hasNaturalTensions) {
                alterations.push('#11');
                omissions.push('omit5');
            } else {
                alterations.push('b5');
            }
        }
    } else if (!has5 && !hasSharp5) {
        omissions.push('omit5');
    }

    // Augmented / b13 Logic
    if (hasSharp5) {
        if (has5) {
            alterations.push('b13');
        } else {
            alterations.push('b13');
        }
    }

    // 9th Alterations
    if (hasb9) alterations.push('b9');

    // #9 vs Minor 3rd
    if (hasMajor3 && hasSharp9) {
        alterations.push('#9');
    } else if (!hasMajor3 && hasSharp9 && has7) {
        return null; // Minor 7th context
    }

    // Construct Chord Name
    let chordType = '7';
    let isSus4 = false;

    // Sus4 Check
    if (!hasMajor3 && !hasMinor3 && (has11 || extensions.includes(11))) {
        isSus4 = true;
        const idx = extensions.indexOf(11);
        if (idx > -1) extensions.splice(idx, 1);
    } else if (!hasMajor3 && !hasMinor3) {
        omissions.push('omit3');
    }

    if (extensions.includes(13)) {
        chordType = isSus4 ? '13sus4' : '13';
    } else if (extensions.includes(11)) {
        chordType = isSus4 ? '9sus4' : '11';
        if (isSus4 && !extensions.includes(9)) chordType = '7sus4';
    } else if (extensions.includes(9)) {
        chordType = isSus4 ? '9sus4' : '9';
    } else {
        if (isSus4) chordType = '7sus4';
    }

    const relevantAlterations = [...alterations];
    let displayAlterations = relevantAlterations;

    // Map alterations to note names for display
    displayAlterations = relevantAlterations.map(alt => {
        const altMap: Record<string, number> = {
            'b9': 1, '9': 2, '#9': 3,
            'b5': 6, '#11': 6, '5': 7, '#5': 8, 'b13': 8,
            '13': 9
        };

        const semi = altMap[alt];
        if (typeof semi === 'number') {
            const rootMidi = notes[0].midi;
            const targetMidi = rootMidi + semi;
            const targetPC = targetMidi % 12;
            const found = notes.find(n => n.pitchClass === targetPC);
            if (found) return found.name;
            const pc = targetPC;
            return NOTE_NAMES[pc];
        }
        return alt;
    });

    let formatted = `${notes[0].name}${chordType}`;
    if (displayAlterations.length > 0) {
        formatted += `(${displayAlterations.join(',')})`;
    }
    if (omissions.includes('omit3')) {
        formatted += '(no3)';
    }

    // Complexity Score
    let complexityScore = calculateComplexity(notes[0].name);
    complexityScore += alterations.length * 0.5;
    if (omissions.length > 0) complexityScore += 0.2;

    return {
        root: notes[0].name,
        chordType,
        bass: null,
        extensions: extensions,
        alterations: alterations,
        omissions: omissions,
        confidence: 0.95,
        reasoning: `Detected dominant structure with extensions: ${[...extensions, ...alterations].join(', ')}`,
        formatted,
        complexity: complexityScore
    };
}

function generateTritoneSubForFinder(notes: NormalizedNote[], extensions: number[]): string | null {
    // Basic checks are done by caller (must be Dominant type)
    if (notes.length === 0) return null;
    const rootMidi = notes[0].midi;
    const subRootMidi = rootMidi + 6;

    // We need a context-aware name, but here we just need a string. 
    // Just pick a standard name based on pitch class. 
    // Tonal.js or just hardcoded array? We have NOTE_NAMES.
    const pc = ((subRootMidi % 12) + 12) % 12;
    const subRootName = FLAT_NOTE_NAMES[pc]; // Prefer flats for Tritone Subs of Sharps usually? 
    // e.g. G7 -> Db7. C7 -> Gb7. 

    return `${subRootName}7 (SubV)`;
}


// Symmetrical Chord Handlers

function generateDim7Alternatives(notes: NormalizedNote[]): ChordDetectionResult[] {
    if (notes.length !== 4) return [];

    const results: ChordDetectionResult[] = [];
    const bassNote = notes[0];

    // Each note can be the root of a dim7 chord
    for (let i = 0; i < 4; i++) {
        const root = notes[i];
        const isRootInBass = root.pitchClass === bassNote.pitchClass;

        results.push({
            root: root.name,
            chordType: 'dim7',
            bass: isRootInBass ? null : bassNote.name,
            extensions: [],
            alterations: [],
            omissions: [],
            confidence: isRootInBass ? 0.85 : 0.6,
            reasoning: isRootInBass
                ? 'Diminished 7th in root position'
                : `Diminished 7th with ${root.name} as root, ${bassNote.name} in bass`,
            formatted: isRootInBass
                ? `${root.name}dim7`
                : `${root.name}dim7/${bassNote.name}`,
            complexity: calculateComplexity(root.name) + (isRootInBass ? 0 : 1)
        });
    }

    return results;
}

function generateAugAlternatives(notes: NormalizedNote[]): ChordDetectionResult[] {
    if (notes.length !== 3) return [];

    const results: ChordDetectionResult[] = [];
    const bassNote = notes[0];

    // Each note can be the root of an aug chord
    for (let i = 0; i < 3; i++) {
        const root = notes[i];
        const isRootInBass = root.pitchClass === bassNote.pitchClass;

        results.push({
            root: root.name,
            chordType: 'aug',
            bass: isRootInBass ? null : bassNote.name,
            extensions: [],
            alterations: [],
            omissions: [],
            confidence: isRootInBass ? 0.85 : 0.6,
            reasoning: isRootInBass
                ? 'Augmented triad in root position'
                : `Augmented triad with ${root.name} as root, ${bassNote.name} in bass`,
            formatted: isRootInBass
                ? `${root.name}aug`
                : `${root.name}aug/${bassNote.name}`,
            complexity: calculateComplexity(root.name) + (isRootInBass ? 0 : 1)
        });
    }

    return results;
}

// ============================================================================
// Enharmonic Handlers
// ============================================================================

function generateEnharmonicAlternative(result: ChordDetectionResult): ChordDetectionResult | null {
    const enharmonicRoot = getEnharmonicEquivalent(result.root);
    if (enharmonicRoot === result.root) return null;

    const originalComplexity = calculateComplexity(result.root);
    const enharmonicComplexity = calculateComplexity(enharmonicRoot);

    const formatted = result.bass
        ? `${enharmonicRoot}${result.chordType}/${getEnharmonicEquivalent(result.bass)}`
        : `${enharmonicRoot}${result.chordType}`;

    return {
        ...result,
        root: enharmonicRoot,
        bass: result.bass ? getEnharmonicEquivalent(result.bass) : null,
        formatted,
        complexity: enharmonicComplexity,
        confidence: result.confidence * (enharmonicComplexity < originalComplexity ? 1.1 : 0.9),
        reasoning: `${result.reasoning} (enharmonic spelling)`
    };
}

// ============================================================================
// Slash Chord Detection
// ============================================================================

function trySlashChord(notes: NormalizedNote[]): ChordDetectionResult | null {
    if (notes.length < 4) return null;

    const bass = notes[0];
    const upperNotes = notes.slice(1);

    // Calculate spread/discreteness
    const avgInterval = upperNotes.reduce((sum, n, i) => {
        if (i === 0) return 0;
        return sum + (n.midi - upperNotes[i - 1].midi);
    }, 0) / Math.max(1, upperNotes.length - 1);

    // If notes are very spread out (avg > 7 semitones), try slash chord
    if (avgInterval < 7) return null;

    const upperIntervals = getIntervals(upperNotes);
    const chordType = matchPattern(upperIntervals);

    if (chordType && (chordType === '' || chordType === 'm' || chordType === 'dim')) {
        return {
            root: upperNotes[0].name,
            chordType: chordType || 'maj',
            bass: bass.name,
            extensions: [],
            alterations: [],
            omissions: [],
            confidence: 0.8,
            reasoning: 'Discrete voicing interpreted as slash chord',
            formatted: `${upperNotes[0].name}${chordType === 'm' ? 'm' : ''}/${bass.name}`,
            complexity: calculateComplexity(upperNotes[0].name) + calculateComplexity(bass.name)
        };
    }

    return null;
}

// ============================================================================
// Functional Enharmonic Detection
// ============================================================================

function detectFunctionalEnharmonics(intervals: number[], notes: NormalizedNote[]): ChordDetectionResult[] {
    const results: ChordDetectionResult[] = [];

    // #5 vs b13 - check both within octave and across octaves
    const has7 = intervals.includes(10) || intervals.includes(11) || intervals.includes(22) || intervals.includes(23);
    const has5 = intervals.includes(7) || intervals.includes(19) || intervals.includes(31);
    const hasAb = intervals.includes(8) || intervals.includes(20) || intervals.includes(32); // Could be #5 or b13
    const hasMajor3 = intervals.includes(4) || intervals.includes(16) || intervals.includes(28);

    if (has7 && hasAb && !has5 && hasMajor3) {
        // Could be either #5 or b13
        results.push({
            root: notes[0].name,
            chordType: '7',
            bass: null,
            extensions: [],
            alterations: ['b13'],
            omissions: ['omit5'],
            confidence: 0.75,
            reasoning: 'Interpreted as b13 (more common in jazz)',
            formatted: `${notes[0].name}7(b13)`,
            complexity: calculateComplexity(notes[0].name)
        });

        results.push({
            root: notes[0].name,
            chordType: '7',
            bass: null,
            extensions: [],
            alterations: ['#5'],
            omissions: [],
            confidence: 0.7,
            reasoning: 'Alternative interpretation as #5',
            formatted: `${notes[0].name}7(#5)`,
            complexity: calculateComplexity(notes[0].name)
        });
    }

    // #9 vs b3 (Hendrix chord) - check both within octave and across octaves
    const hasEb = intervals.includes(3) || intervals.includes(15) || intervals.includes(27); // Could be b3 or #9

    if (has7 && hasMajor3 && hasEb) {
        // This is 7#9 (Hendrix chord)
        results.push({
            root: notes[0].name,
            chordType: '7',
            bass: null,
            extensions: [],
            alterations: ['#9'],
            omissions: [],
            confidence: 0.9,
            reasoning: 'Hendrix chord (7#9) - has both major 3rd and #9',
            formatted: `${notes[0].name}7(#9)`,
            complexity: calculateComplexity(notes[0].name)
        });
    }

    return results;
}

// ============================================================================
// Main Detection Function
// ============================================================================

export function detect(
    inputNotes: Note[],
    inputOptions: ChordAnalysisOptions = {}
): ChordDetectionResult[] {
    const options: ChordAnalysisOptions = { ...DEFAULT_OPTIONS, ...inputOptions };
    const {
        maxResults = 10,
        minConfidence = options.similarity_ratio || 0.5
    } = options;

    if (inputNotes.length === 0) return [];

    // Parse and normalize notes - try both sharp and flat spellings
    const allNoteVariants: NormalizedNote[][] = [];

    // For each MIDI number, generate possible enharmonic spellings
    for (const note of inputNotes) {
        if (typeof note === 'number') {
            const spellings = getEnharmonicSpellings(note);
            // normalization_octave handled by default parsing if needed? 
            // In current logic, MIDI numbers preserve their octave. 
            // If we needed pitch-class only input support (without octaves), we'd need a separate parser or default octave injection.
            // Assuming inputNotes are MIDI or strings with octaves for now as per current system support.
            const variants: NormalizedNote[] = spellings.map(spelling => parseNote(spelling + Math.floor(note / 12 - 1)));
            allNoteVariants.push(variants);
        } else {
            // String note - still parse it but also try enharmonic
            try {
                const parsed = parseNote(note);
                const enharmonic = getEnharmonicEquivalent(note);
                if (enharmonic !== note) {
                    allNoteVariants.push([parsed, parseNote(enharmonic)]);
                } else {
                    allNoteVariants.push([parsed]);
                }
            } catch (e) {
                // Ignore invalid notes or handle custom strings
                continue;
            }
        }
    }

    // Generate all reasonable combinations (limit to avoid explosion)
    // Strategy: Try all-sharp, all-flat, and original combinations
    const noteCombinations: NormalizedNote[][] = [];

    // Combination 1: All sharp spellings (first variant)
    if (allNoteVariants.length > 0) noteCombinations.push(allNoteVariants.map(variants => variants[0]));

    // Combination 2: All flat spellings (second variant if exists)
    if (allNoteVariants.every(v => v.length > 1)) {
        noteCombinations.push(allNoteVariants.map(variants => variants[1] || variants[0]));
    }

    // Process each combination and collect results
    const allResults: ChordDetectionResult[] = [];

    for (const noteCombo of noteCombinations) {
        // Remove duplicates by pitch class, keeping lowest octave
        const uniqueNotes = Array.from(
            noteCombo.reduce((map, note) => {
                const existing = map.get(note.pitchClass);
                if (!existing || note.midi < existing.midi) {
                    map.set(note.pitchClass, note);
                }
                return map;
            }, new Map<number, NormalizedNote>()).values()
        );

        // Sort by MIDI pitch (NOT pitch class) to preserve voicing
        const sortedNotes = [...uniqueNotes].sort((a, b) => a.midi - b.midi);
        const intervals = getIntervals(sortedNotes);
        const results: ChordDetectionResult[] = [];

        // -------------------------------------------------------------------------
        // 1. Original First Strategy / Change From First
        // -------------------------------------------------------------------------
        if (options.original_first) {
            // Analyze the exact voicing provided (lowest note is root candidate)
            const originalResult = analyzeVoicing(sortedNotes, options);

            if (originalResult && originalResult.confidence >= (options.original_first_ratio || 0.8)) {
                // Check if it's "just" a clean match or allowed alteration
                // If it's pure pattern match, return immediately preference
                // If it relies on complex alterations, we might want to check Polychord too
                results.push(originalResult);

                // If extremely high confidence, we might stop here for this combo?
                // But let's allow finding alternatives still, just ranked lower?
                // User requirement: "similarity >= threshold AND NOT alteration -> return directly"

                const isSimple = originalResult.alterations.length === 0 && !originalResult.chordType.includes('alt');
                if (isSimple) {
                    // Boost confidence significantly
                    originalResult.confidence = 1.0;
                }
            }
        }

        // -------------------------------------------------------------------------
        // 2. Polychord Strategy
        // -------------------------------------------------------------------------
        if (options.poly_chord_first) {
            const split = splitPolychord(sortedNotes);
            if (split) {
                // Recursive detection on Upper and Lower
                // Using 'strict' mode or simpler options to avoid recursion loop
                const subOptions: ChordAnalysisOptions = { ...options, poly_chord_first: false, whole_detect: true, maxResults: 1 };

                // Lower Chord
                const lowerRes = detect(split.lower.map(n => n.midi), subOptions)[0];
                // Upper Chord
                const upperRes = detect(split.upper.map(n => n.midi), subOptions)[0];

                if (lowerRes && upperRes) {
                    const polyResult: ChordDetectionResult = {
                        root: lowerRes.root, // Usually named by bottom chord? Or notation Upper/Lower?
                        chordType: 'polychord',
                        bass: lowerRes.bass,
                        extensions: [],
                        alterations: [],
                        omissions: [],
                        confidence: 0.9,
                        reasoning: `Polychord: ${upperRes.formatted} over ${lowerRes.formatted}`,
                        formatted: `${upperRes.formatted}/${lowerRes.formatted}`, // Jazz notation Upper/Lower
                        complexity: lowerRes.complexity + upperRes.complexity + 1,
                        isPolychord: true,
                        upperStructure: upperRes.formatted,
                        lowerStructure: lowerRes.formatted
                    };
                    results.push(polyResult);
                } else if (upperRes && split.lower.length === 1) {
                    // Single bass note -> Slash chord (handled by regular detection usually, but specific path here)
                    // Already handled by slash chord logic?
                }
            }
        }

        // -------------------------------------------------------------------------
        // 3. Whole Detect (Rotating Root / Inversions)
        // -------------------------------------------------------------------------
        if (options.whole_detect) {
            // Iterate through unique pitch classes as candidate roots
            for (const candidateRoot of sortedNotes) {
                // If we already did original_first and this is the first note, we technically did it.
                // But analyzeVoicing might allow differnet things than Rotating logic.
                // Lets re-run to be safe or optimize?

                const rotatingIntervals = getIntervals(sortedNotes, candidateRoot);

                // Use existing pattern matching logic or analyzeVoicing?
                // analyzeVoicing assumes notes[0] is root. 
                // We need to re-order notes so candidateRoot is first to use analyzeVoicing? 
                // Or just use interval matching.

                // Let's use matchPattern manually here to reuse existing logic including omissions
                let matchType = matchPattern(rotatingIntervals, options.custom_mapping);
                let omissions: string[] = [];

                if (matchType === null) {
                    const matchOmit = matchPatternWithOmissions(rotatingIntervals);
                    if (matchOmit) {
                        matchType = matchOmit.type;
                        omissions = matchOmit.omissions;
                    }
                }

                if (matchType !== null) {
                    // Check for Bass (Slash Chord)
                    const bassNote = sortedNotes[0];
                    const isSlash = candidateRoot.pitchClass !== bassNote.pitchClass;

                    // Penalty for Inversions/Slash
                    let penalty = isSlash ? 1.0 : 0.0;

                    // Root Preference Bonus
                    if (options.root_preference && !isSlash) {
                        penalty -= 0.5; // Bonus
                    }

                    results.push({
                        root: candidateRoot.name,
                        chordType: matchType,
                        bass: isSlash ? bassNote.name : null,
                        extensions: [],
                        alterations: [],
                        omissions: omissions,
                        confidence: (0.85 - (penalty * 0.1)) + (options.same_note_special ? 0.1 : 0),
                        reasoning: isSlash
                            ? `Inversion/Slash: ${candidateRoot.name}${matchType} over ${bassNote.name}`
                            : 'Inversion/Root Position match',
                        formatted: isSlash
                            ? `${candidateRoot.name}${matchType}/${bassNote.name}`
                            : `${candidateRoot.name}${matchType}`,
                        complexity: calculateComplexity(candidateRoot.name) + penalty
                    });
                }
            }
        }

        // [Existing] Symmetrical Chords Logic (Aug/Dim) - Preserve existing?
        if (matchDiminished7(intervals)) {
            results.push(...generateDim7Alternatives(sortedNotes));
        } else if (matchAugmented(intervals)) {
            results.push(...generateAugAlternatives(sortedNotes));
        }

        // [Existing] Enharmonic Scoring & Merge
        // Score results based on enharmonic simplicity
        const scoredResults = results.map(r => ({
            ...r,
            enharmonicScore: scoreEnharmonicSpelling([r.root, r.bass || ''].filter(Boolean))
        }));

        // Add to global results with combined complexity score
        allResults.push(...scoredResults.map(r => ({
            ...r,
            complexity: r.complexity + r.enharmonicScore * 0.1
        })));

    } // Close noteCombo loop

    // Filter and sort all results from all enharmonic combinations
    const filteredResults = allResults
        .filter(r => r.confidence >= minConfidence)
        .sort((a, b) => {
            // Sort by confidence (desc), then complexity (asc)
            if (Math.abs(a.confidence - b.confidence) > 0.01) {
                return b.confidence - a.confidence;
            }
            return a.complexity - b.complexity;
        })
        .slice(0, maxResults);

    return filteredResults;
}

// Export for testing
export { parseNote, getIntervals, matchPattern };
