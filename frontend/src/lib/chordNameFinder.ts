// Advanced Chord Detection System
// Supports symmetrical chords, enharmonic spellings, and multiple interpretations

// ============================================================================
// Type Definitions
// ============================================================================

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
}

export type DetectionMode = 'strict' | 'loose';

export interface DetectionOptions {
    mode?: DetectionMode;
    maxResults?: number;
    minConfidence?: number;
}

// ============================================================================
// Constants
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

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
    // Triads
    '': [0, 4, 7],                      // Major
    'm': [0, 3, 7],                     // Minor
    'dim': [0, 3, 6],                   // Diminished
    'aug': [0, 4, 8],                   // Augmented
    'sus2': [0, 2, 7],                  // Suspended 2
    'sus4': [0, 5, 7],                  // Suspended 4
    'add9': [0, 2, 4, 7],               // Major add 9
    '5': [0, 7],                        // Power Chord
    'add11': [0, 4, 5, 7],              // Major add 11 (Cluster)
    'm add11': [0, 3, 5, 7],            // Minor add 11 (Cluster)

    // Seventh chords
    'maj7': [0, 4, 7, 11],              // Major 7
    'm7': [0, 3, 7, 10],                // Minor 7
    '7': [0, 4, 7, 10],                 // Dominant 7
    'dim7': [0, 3, 6, 9],               // Diminished 7
    'm7b5': [0, 3, 6, 10],              // Half-diminished
    'mMaj7': [0, 3, 7, 11],             // Minor-Major 7
    'mMaj9': [0, 3, 7, 11, 14],         // Minor-Major 9
    'aug7': [0, 4, 8, 10],              // Augmented 7

    // Extended chords (9ths)
    'maj9': [0, 4, 7, 11, 14],          // Major 9
    'm9': [0, 3, 7, 10, 14],            // Minor 9
    '9': [0, 4, 7, 10, 14],             // Dominant 9

    // Lydian chords (#11)
    'maj7#11': [0, 4, 7, 11, 18],       // Major 7 #11
    'maj9#11': [0, 4, 7, 11, 14, 18],   // Major 9 #11

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

// ============================================================================
// Note Parsing and Normalization
// ============================================================================

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
    const rootPitch = rootNote.pitchClass;

    // We need to calculate intervals relative to the specific root.
    // However, the original logic handled octave spacing based on the *lowest* note (notes[0]).
    // Code expects intervals to be roughly sorted or at least capture the spread.
    // If we rotate roots, the "lowest note" physically remains notes[0].
    // But the "musical root" changes.

    // When detecting inversions (e.g. C/E), we want to see if the notes form "C Major".
    // So we calculate intervals relative to C.
    // E (4), G (7), C (0).  Sorted: 0, 4, 7. -> C Major.

    // So:
    return notes.map(n => {
        let interval = (n.pitchClass - rootPitch + 12) % 12;
        // Optimization: For detection, we often just need pitch class intervals (mod 12).
        // Extended chords need specific octaves (e.g. b9 vs b2).
        // If we change the root, the relative octaves change complexity.
        // For basic detection like "C Major", PC intervals are enough.
        // For "C13", we need to know if D is 2 or 9.

        // Let's preserve the existing logic of adding 12 for wide chords, 
        // BUT relative to the physical bass (notes[0]) to keep voicing structure?
        // Actually, for identification, normalized PC sorting is often used in basic matching.
        // The `intervalsMatch` function sorts intervals.

        let val = (n.pitchClass - rootPitch + 12) % 12;

        return val;
    }).sort((a, b) => a - b); // Sorted PC intervals are easier for `matchPattern`
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

// ============================================================================
// Pattern Matching
// ============================================================================

function intervalsMatch(intervals: number[], pattern: number[], allowSubset = false): boolean {
    if (allowSubset) {
        return pattern.every(p => intervals.includes(p));
    }

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

function matchPattern(intervals: number[], allowExtensions = false): string | null {
    // Try exact matches first
    for (const [chordType, pattern] of Object.entries(CHORD_PATTERNS)) {
        if (intervalsMatch(intervals, pattern)) {
            return chordType;
        }
    }

    // If allowing extensions, try subset matches
    if (allowExtensions) {
        const sortedByLength = Object.entries(CHORD_PATTERNS)
            .sort((a, b) => b[1].length - a[1].length);

        for (const [chordType, pattern] of sortedByLength) {
            if (intervalsMatch(intervals, pattern, true)) {
                return chordType;
            }
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

    // 2. Try Shell Dyads (2-note shells)
    // e.g. C, B (Major 7 Shell) -> {0, 11}. 
    // This is often just the Root and 7th. It implies 'maj7 omit 3, 5'. 
    // Or C, Bb (Dominant 7 Shell) -> {0, 10}. '7 omit 3, 5'.
    // Or C, Eb (Minor Shell) -> {0, 3}. 'm7 omit 5, 7'? No, m7 usually needs 7. 
    // C, Eb is just 'm'.

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

// ============================================================================
// Merge Rules
// ============================================================================


function detectDominantFeatures(intervals: number[], notes: NormalizedNote[]): ChordDetectionResult | null {
    // 1. Check for Dominant Shell or Strong Dominant Context
    // Shell: Root, 3, b7
    // Context: Root, b7 initially, plus extensions that imply dominant
    const hasMajor3 = intervals.includes(4) || intervals.includes(16) || intervals.includes(28);
    const hasMinor3 = intervals.includes(3) || intervals.includes(15) || intervals.includes(27);
    const has7 = intervals.includes(10) || intervals.includes(22); // b7
    const hasMaj7 = intervals.includes(11) || intervals.includes(23);

    // Basic requirement: Must be some kind of 7th chord or have enough extensions
    if (!has7 && !hasMaj7) return null;

    // If it has Maj7, it's not a standard dominant (unless it's some exotic hybrid, but let's stick to standard jazz theory)
    // We strictly look for b7 or "Shell-less" voiced dominants (rare but possible with just tritone)
    if (hasMaj7) return null; // We might want to handle Maj13(#11) elsewhere, this function is for DOMINANTS

    // 2. Scan for Extensions and Alterations
    const extensions: number[] = [];
    const alterations: string[] = [];
    const omissions: string[] = [];

    // Helper to check for interval presence across multiple octaves
    const hasInterval = (targetMod12: number) => {
        return intervals.some(i => (i % 12) === targetMod12);
    };

    // Calculate all flags first
    const has5 = hasInterval(7);
    const hasb5 = hasInterval(6); // tritone
    const hasSharp5 = hasInterval(8); // minor 6th

    const hasb9 = hasInterval(1);
    const has9 = hasInterval(2);
    const hasSharp9 = hasInterval(3);

    const has11 = hasInterval(5);
    const hasSharp11 = hasInterval(6); // tritone

    const hasb13 = hasInterval(8); // minor 6th
    const has13 = hasInterval(9);

    // Analyze Extensions first to inform Alteration naming
    if (has9) extensions.push(9);
    if (has13) extensions.push(13);

    // 5th / Tritone Logic
    // Tritone (6) can be b5 or #11
    if (hasb5) {
        if (has5) {
            alterations.push('#11'); // 7(#11)
        } else {
            // Ambiguous. 
            const hasNaturalTensions = extensions.includes(9) || extensions.includes(13);
            if (hasNaturalTensions) {
                alterations.push('#11');
                omissions.push('omit5'); // It's #11 but no 5
            } else {
                alterations.push('b5'); // Default to b5 for 7b5, 7alt
            }
        }
    } else if (!has5 && !hasSharp5) {
        omissions.push('omit5');
    }

    // Augmented / b13 Logic
    if (hasSharp5) {
        // Distinguish #5 vs b13
        if (has5) {
            alterations.push('b13'); // 7(b13)
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

    // 3. Construct Chord Name and Result
    // Base type is 7
    let chordType = '7';
    // Logic: 
    // 13 beats 11 beats 9 beats 7.
    // But alterations are appended.

    // Sus4 Check
    // If NO 3rd (Major or Minor) is present, but we have 4 (5 semitones) or 11 (17 semitones)
    // Then it is a Sus4 chord.
    // Note: has11 checks for interval 5. 
    // hasMajor3 = 4, 16. hasMinor3 = 3, 15.

    let isSus4 = false;
    if (!hasMajor3 && !hasMinor3 && (has11 || extensions.includes(11))) {
        isSus4 = true;
        // Remove 11 from extensions if it's the defining Sus4 tone
        const idx = extensions.indexOf(11);
        if (idx > -1) extensions.splice(idx, 1);

        // Also remove 'omit5' if it was added only because we didn't find a 5th? 
        // Sus4 usually has 5th. If no 5th, it's still Sus4 ish.
    }

    if (extensions.includes(13)) {
        chordType = isSus4 ? '13sus4' : '13';
        // Remove 13 from extensions list to avoid "13(13)"
        // extensions = extensions.filter(e => e !== 13); // Keep it in data, remove from name logic if needed
    } else if (extensions.includes(11)) {
        chordType = isSus4 ? '9sus4' : '11';
        if (isSus4 && !extensions.includes(9)) chordType = '7sus4';
    } else if (extensions.includes(9)) {
        chordType = isSus4 ? '9sus4' : '9';
    } else {
        if (isSus4) chordType = '7sus4';
    }

    // Special case: Altered chord "7alt"
    // If we have (b5 or #5) AND (b9 or #9)
    const isAltered = (alterations.includes('b5') || alterations.includes('#5') || alterations.includes('b13')) &&
        (alterations.includes('b9') || alterations.includes('#9'));

    if (isAltered && !extensions.includes(13) && !extensions.includes(11) && !extensions.includes(9)) {
        // If NO natural extensions are present, we can call it "7alt" or "7(alts)"
        // But user asked for specific "swallowed" notes.
        // Let's be explicit: G7(b9, b13) instead of G7alt, OR provide both.
        // For now, let's enable explicit listing as requested.
        // But if it's maximally altered (b5, #5, b9, #9), 7alt is cleaner?
        // "G7(b9, #9, b5, #5)" is too long.
        // Let's stick to explicit names for clarity unless it's the specific "Altered" set.
    }

    // Filter out extensions that are implied by the chordType
    // e.g. G13 implies 9? Not necessarily in symbol, but G13 often includes 9.
    // If we call it G13, we don't need to add (9).
    // G13(b9) is valid.

    const relevantAlterations = [...alterations];

    // Formatting
    let formatted = `${notes[0].name}${chordType}`;
    if (relevantAlterations.length > 0) {
        formatted += `(${relevantAlterations.join(',')})`;
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
        confidence: 0.95, // High confidence for these specific jazz structures
        reasoning: `Detected dominant structure with extensions: ${[...extensions, ...alterations].join(', ')}`,
        formatted,
        complexity: complexityScore
    };
}


// ============================================================================
// Symmetrical Chord Handlers
// ============================================================================

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
    options: DetectionOptions = {}
): ChordDetectionResult[] {
    const {
        mode = 'loose',
        maxResults = 10,
        minConfidence = 0.5
    } = options;

    if (inputNotes.length === 0) return [];

    // Parse and normalize notes
    const notes = inputNotes.map(parseNote);

    // Remove duplicates by pitch class, keeping lowest octave
    const uniqueNotes = Array.from(
        notes.reduce((map, note) => {
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

    // ============================================================================
    // Minor / Quartal Detection
    // ============================================================================

    function detectMinorQuartalFeatures(intervals: number[], notes: NormalizedNote[]): ChordDetectionResult | null {
        // 1. Check for Minor Context (Root + m3 + b7 + 11 usually, or just m7)
        // "So What" chord: Root, 11, b7, m3, b13 (stacked 4ths approximately)
        // Intervals: 0, 5, 10, 3, 8 (normalized) or similar permutations

        // Key Intervals
        const hasMinor3 = intervals.includes(3) || intervals.includes(15) || intervals.includes(27);
        const has7 = intervals.includes(10) || intervals.includes(22); // b7
        const has11 = intervals.includes(5) || intervals.includes(17) || intervals.includes(29);

        // Check for "So What" specific features: 11 is prominent, m3 might be high
        if (has7 && has11) {
            // Can be m11 or Sus4
            // If has m3, it's m11
            if (hasMinor3) {
                const extensions: number[] = [11];
                const alterations: string[] = [];
                const omissions: string[] = [];

                // Check 5th
                const has5 = intervals.includes(7) || intervals.includes(19) || intervals.includes(31);
                if (!has5) omissions.push('omit5');

                // Check 9th
                const has9 = intervals.includes(2) || intervals.includes(14) || intervals.includes(26);
                if (has9) extensions.push(9);

                // Check 13th/b13
                const has13 = intervals.includes(9) || intervals.includes(21) || intervals.includes(33);
                const hasb13 = intervals.includes(8) || intervals.includes(20) || intervals.includes(32);

                if (has13) extensions.push(13);
                // In minor, b6/b13 is diatonic (Aeolian). 
                // Dm11(b13) is unusual but So What chord often analyzed as such or just m11 with b13 color.
                if (hasb13) alterations.push('b13');

                // Base chord
                let chordType = 'm11';
                if (hasb13 && !has13) {
                    // Format: m11(b13)
                }

                let formatted = `${notes[0].name}${chordType}`;
                if (alterations.length > 0) formatted += `(${alterations.join(',')})`;

                return {
                    root: notes[0].name,
                    chordType,
                    bass: null,
                    extensions,
                    alterations,
                    omissions,
                    confidence: 0.9,
                    reasoning: 'Detected minor 11th / quartal structure',
                    formatted,
                    complexity: calculateComplexity(notes[0].name)
                };
            }
        }

        return null;
    }

    // 1. Try merge rules first (highest priority)
    const dominantFeatures = detectDominantFeatures(intervals, sortedNotes);
    if (dominantFeatures) results.push(dominantFeatures);

    const minorQuartal = detectMinorQuartalFeatures(intervals, sortedNotes);
    if (minorQuartal) results.push(minorQuartal);

    // 2. Check symmetrical chords
    if (matchDiminished7(intervals)) {
        results.push(...generateDim7Alternatives(sortedNotes));
    } else if (matchAugmented(intervals)) {
        results.push(...generateAugAlternatives(sortedNotes));
    } else {
        // 3. Try standard pattern matching
        let chordType = matchPattern(intervals);
        let omissions: string[] = [];
        let confidence = 0.95;
        let reasoning = 'Exact pattern match';

        // If no exact match, try detection with omitted 5th
        if (!chordType) {
            const matchOmit = matchPatternWithOmissions(intervals);
            if (matchOmit) {
                chordType = matchOmit.type;
                omissions = matchOmit.omissions;
                confidence = 0.85;
                reasoning = 'Pattern match with omitted 5th';
            }
        }

        if (chordType !== null) {
            results.push({
                root: sortedNotes[0].name,
                chordType,
                bass: null,
                extensions: [],
                alterations: [],
                omissions: omissions,
                confidence: confidence,
                reasoning: reasoning,
                formatted: `${sortedNotes[0].name}${chordType}`,
                complexity: calculateComplexity(sortedNotes[0].name)
            });
        }

        // 4. Try functional enharmonics
        if (mode === 'loose') {
            results.push(...detectFunctionalEnharmonics(intervals, sortedNotes));
        }

        // 5. Try slash chords for discrete voicings
        const slashChord = trySlashChord(sortedNotes);
        if (slashChord) results.push(slashChord);

        // 6. Rotating Root Scan (Inversions & Slash Chords)
        // Iterate through unique pitch classes as candidate roots
        for (const candidateRoot of sortedNotes) {
            if (candidateRoot.pitchClass === sortedNotes[0].pitchClass) continue; // Already checked as Primary Root

            const rotatingIntervals = getIntervals(sortedNotes, candidateRoot);

            // Check for standard patterns
            let matchType = matchPattern(rotatingIntervals);
            let omissions: string[] = [];

            if (matchType === null) {
                const matchOmit = matchPatternWithOmissions(rotatingIntervals);
                if (matchOmit) {
                    matchType = matchOmit.type;
                    omissions = matchOmit.omissions;
                } else {
                    // Fallback check for exact triad intervals if `matchPattern` failed due to strictness
                    // (e.g. if getIntervals returned something slightly unexpected)
                    // But let's assume getIntervals is correct: [0, 4, 7] etc.
                    // C/E (E, G, C) -> relative to C: E(4), G(7), C(0) -> [0, 4, 7] -> Major

                    // If still null, maybe it's Sus?
                }
            }

            // Check for dominant/minor features on rotated intervals
            // const dom = detectDominantFeatures(rotatingIntervals, sortedNotes); 
            // NOTE: detectDominantFeatures logic is tied to "Bass = Root" assumption for some checks.
            // Be careful reusing it here.
            // For now, Slash chords logic mainly covers Triads/7ths.

            if (matchType !== null) {
                const isBassInChord = rotatingIntervals.includes((sortedNotes[0].pitchClass - candidateRoot.pitchClass + 12) % 12);
                // In slash chord, bass might not be in the chord (e.g. F/G).
                // In inversion, bass IS in the chord.

                // Complexity penalty: Slash chords are complex.
                // Inversion penalty: mild.
                let penalty = 0;
                let bassName = sortedNotes[0].name;

                // Check if it's a standard inversion
                // 1st inversion (3rd in bass), 2nd inversion (5th in bass), 3rd inversion (7th in bass)
                // We can know this by checking the interval of the Bass Note relative to Candidate Root.
                // Bass is sortedNotes[0].
                const bassInterval = (sortedNotes[0].pitchClass - candidateRoot.pitchClass + 12) % 12;

                if (matchType === '' || matchType === 'm') {
                    // Triad Inversions
                    if (bassInterval === 4 || bassInterval === 3) penalty = 0.5; // 1st inv
                    else if (bassInterval === 7) penalty = 0.5; // 2nd inv
                    else penalty = 1.0; // Slash chord
                } else {
                    penalty = 1.0; // 7th chord inversion or slash
                }

                results.push({
                    root: candidateRoot.name,
                    chordType: matchType,
                    bass: bassName,
                    extensions: [],
                    alterations: [],
                    omissions: omissions,
                    confidence: 0.85 - (penalty * 0.1),
                    reasoning: `Inversion/Slash: ${candidateRoot.name}${matchType} over ${bassName}`,
                    formatted: `${candidateRoot.name}${matchType}/${bassName}`,
                    complexity: calculateComplexity(candidateRoot.name) + penalty
                });
            }
        }
    } // Closing Rotating Root Loop

    // 6. Generate enharmonic alternatives (in loose mode)
    if (mode === 'loose') {
        const enharmonicResults: ChordDetectionResult[] = [];
        for (const result of results) {
            const enharmonic = generateEnharmonicAlternative(result);
            if (enharmonic) enharmonicResults.push(enharmonic);
        }
        results.push(...enharmonicResults);
    }

    // 7. Filter and sort results
    const filteredResults = results
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
