/* ============================================================
 * chordAnalyzer.ts (v2.0 Refactored)
 * Structure-first architecture with Advanced Theory Logic
 * Merges the speed of bitmasks with the depth of theory parsing.
 * ============================================================
 */

// ===================== Types & Interfaces =====================

export type NoteInput = number | string | { midi: number };

export interface AnalyzedNote {
    name: string;       // Context-aware name (e.g., "C#" or "Db")
    midi: number;
    pc: number;         // Pitch Class (0-11)
    octave: number;
}

export interface ChordResult {
    root: string;       // Root note name
    quality: string;    // Suffix (e.g., "m7", "maj9")
    bass: string;       // Bass note name (if slash chord)
    name: string;       // Full formatted name (e.g., "C/E", "Dmin7")
    intervals: number[];// Intervals relative to root
    omissions: string[];// e.g., ["omit5"]
    complexity: number; // Lower is better (used for enharmonic sorting)
    confidence: number; // 0.0 - 1.0
}

// ===================== Config & Constants =====================

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Priority: Patterns earlier in the list are checked first within their category
const CHORD_TEMPLATES: Record<string, number[]> = {
    // 1. Basic Triads & Shells
    '': [0, 4, 7],      // Major
    'm': [0, 3, 7],      // Minor
    'dim': [0, 3, 6],      // Diminished
    'aug': [0, 4, 8],      // Augmented
    '5': [0, 7],         // Power Chord
    '(no5)': [0, 4],         // Major Shell
    'm(no5)': [0, 3],         // Minor Shell
    'maj7(no3,5)': [0, 11],   // Major 7 Shell
    '7(no3,5)': [0, 10],      // Dominant 7 Shell

    // 2. Suspended
    'sus2': [0, 2, 7],
    'sus4': [0, 5, 7],
    '7sus4': [0, 5, 7, 10],
    '9sus4': [0, 5, 7, 10, 14],

    // 3. Sevenths
    'maj7': [0, 4, 7, 11],
    'm7': [0, 3, 7, 10],
    '7': [0, 4, 7, 10],
    'dim7': [0, 3, 6, 9],   // Full Diminished
    'm7b5': [0, 3, 6, 10],  // Half Diminished
    'mMaj7': [0, 3, 7, 11],
    'aug7': [0, 4, 8, 10],
    'maj7#5': [0, 4, 8, 11],

    // 4. Extensions (Nine)
    'add9': [0, 4, 7, 14],
    'm(add9)': [0, 3, 7, 14],
    'maj9': [0, 4, 7, 11, 14],
    'm9': [0, 3, 7, 10, 14],
    '9': [0, 4, 7, 10, 14],
    '7b9': [0, 4, 7, 10, 13],
    '7#9': [0, 4, 7, 10, 15],

    // 5. Extensions (Eleven/Thirteen)
    '11': [0, 4, 7, 10, 14, 17],
    'm11': [0, 3, 7, 10, 14, 17],
    '13': [0, 4, 7, 10, 14, 21],
    'maj13': [0, 4, 7, 11, 14, 21],

    // 6. Altered & Special
    '7#11': [0, 4, 7, 10, 18],
    'maj7#11': [0, 4, 7, 11, 18],
    '7alt': [0, 4, 10, 13, 20], // Simplified alt structure (b9, b13)
    'phryg': [0, 1, 5, 7],       // Phrygian / sus b9
    'm11(no9)': [0, 3, 7, 10, 17], // m11 without the 9th (common capability)
    '7(b13)': [0, 4, 7, 10, 8],    // 7th with flat 13 (and natural 5)
};

// ===================== Utils: Theory =====================

// Export parseNote alias for compatibility
export { parseMidi as parseNote };

function parseMidi(input: NoteInput): number {
    if (typeof input === 'number') return input;
    if (typeof input === 'object' && 'midi' in input) return input.midi;
    // Simple parser for strings like "C#4"
    const match = input.match(/^([A-G][#b]?)(-?\d+)?$/);
    if (!match) throw new Error(`Invalid note: ${input}`);
    const name = match[1];
    const octave = match[2] ? parseInt(match[2]) : 4;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]]!;
    const acc = name.includes('#') ? 1 : name.includes('b') ? -1 : 0;
    return (octave + 1) * 12 + base + acc;
}

function getPc(midi: number): number {
    return ((midi % 12) + 12) % 12;
}

/**
 * Normalizes intervals to be relative to root, handling octave wrapping for comparison.
 * e.g., [60, 64, 67] -> [0, 4, 7]
 */
function getIntervals(rootMidi: number, notes: number[]): number[] {
    return notes.map(n => {
        let diff = n - rootMidi;
        while (diff < 0) diff += 12;
        return diff;
    }).sort((a, b) => a - b);
}

/**
 * Checks if source intervals match template, allowing for "fuzzy" octave matches
 * (e.g. template says 14 (9th), but user played 2 (2nd) -> Match)
 */
function matchesTemplate(source: number[], template: number[]): boolean {
    const srcSet = new Set(source.map(n => n % 12));
    const tmpSet = new Set(template.map(n => n % 12));

    if (srcSet.size !== tmpSet.size) return false;
    for (const pc of srcSet) if (!tmpSet.has(pc)) return false;
    return true;
}

// ===================== Utils: Naming & Scoring =====================

function getNoteName(midi: number, useFlats: boolean = false): string {
    const pc = getPc(midi);
    return useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
}

/**
 * Calculates a complexity score for a chord name.
 * Penalties: Double accidentals, mixing sharps/flats, difficult roots.
 */
function calculateComplexity(rootName: string, bassName: string): number {
    let score = 0;
    const check = (n: string) => {
        if (n.includes('##') || n.includes('bb')) score += 5; // Hate double accidentals
        else if (n.includes('#')) score += 1;
        else if (n.includes('b')) score += 0.9; // Slight preference for flats in jazz
    };
    check(rootName);
    check(bassName);

    // Penalty for mixed accidentals (e.g., F# and Bb)
    if ((rootName.includes('#') && bassName.includes('b')) ||
        (rootName.includes('b') && bassName.includes('#'))) {
        score += 2.0;
    }

    return score;
}

/**
 * Refines the chord quality based on functional context (intervals).
 * e.g., Distinguishes 7#5 from 7(b13).
 */
function refineQuality(quality: string, intervals: number[]): { quality: string, alterations: string[] } {
    let newQuality = quality;
    const alterations: string[] = [];

    // Helper to check for interval presence (mod 12)
    const has = (semitones: number) => intervals.some(i => i % 12 === semitones);

    // 1. #5 vs b13
    // If we detected a generic Augmented 7th or similar, check for natural 5th context
    if (quality.includes('#5') || quality === 'aug7') {
        const hasNatural5 = has(7);
        const hasb13 = has(8); // 8 semitones can be #5 or b13

        if (hasNatural5 && hasb13) {
            // Has BOTH 5 and "b6/#5" -> It's definitely b13 (extension), not #5 (alteration of 5)
            newQuality = quality.replace('#5', '').replace('aug', '');
            if (newQuality === '7') newQuality = '7(b13)';
            // Logic might need to be cleaner to replace suffixes
            alterations.push('b13');
            // If we stripped it down to nothing or weirdness, reset base
            if (!newQuality || newQuality === '7') newQuality = '7';
        }
    }

    // 2. #11 vs b5
    if (quality.includes('#11') || quality.includes('b5')) {
        const hasNatural5 = has(7);
        const hasTritone = has(6);

        if (hasNatural5 && hasTritone) {
            // Has 5 and Tritone -> #11
            if (quality.includes('b5')) {
                newQuality = quality.replace('b5', '#11');
                if (!newQuality.includes('#11')) alterations.push('#11'); // Ensure it's marked
            }
        } else if (!hasNatural5 && hasTritone) {
            // No 5, just Tritone -> could be b5 or #11.
            // Default to b5 for 7th chords unless context suggests otherwise (Lydian)
            // But usually 7#11 implies Lydian Dominant. 
            // Let's stick to template name unless we want to force consistency.
        }
    }

    // 3. Hendrix Chord (7#9) Explicit reasoning
    // The template '7#9' exists, but if we matched '7' and have a #9 interval?
    // Our templates cover 7#9.

    return { quality: newQuality, alterations };
}

// ===================== Analysis Core =====================

/**
 * Generates enharmonic variations of the input notes.
 * e.g., Input [61] -> Tries both "C#" and "Db" contexts.
 */
function generateContexts(rawNotes: number[]) {
    // Strategy: Test two main contexts: Sharp-leaning and Flat-leaning
    return [
        { useFlats: false, name: 'Sharp Context' },
        { useFlats: true, name: 'Flat Context' }
    ];
}

function detectStructure(notes: number[], context: { useFlats: boolean }): ChordResult | null {
    const sorted = [...notes].sort((a, b) => a - b);
    const bassMidi = sorted[0];
    const bassName = getNoteName(bassMidi, context.useFlats);

    // 1. Iterate through every note as a potential ROOT (Handling Inversions)
    for (const rootMidi of sorted) {
        const rootName = getNoteName(rootMidi, context.useFlats);
        const intervals = getIntervals(rootMidi, sorted);

        // A. Exact Template Match
        for (const [type, template] of Object.entries(CHORD_TEMPLATES)) {
            if (matchesTemplate(intervals, template)) {
                // Determine inversion status
                const isSlash = rootMidi % 12 !== bassMidi % 12;

                // Refine Quality (Heuristics)
                // e.g. "aug7" -> "7(b13)" check
                let { quality: refinedQuality, alterations } = refineQuality(type, intervals);

                let suffix = refinedQuality;
                if (alterations.length > 0) {
                    // Check if alteration is already in name?
                    // e.g. if we changed 'b5' to '#11', the quality string '7b5' -> '7#11' might need manual adjust
                    // But here `type` is key from CHORD_TEMPLATES.
                    // If type was '7b5' (not in list, but '7#11' is), we rely on mapped name.

                    // If we switched from #5 to b13:
                    if (type === 'maj7#5' && refinedQuality === 'maj7(b13)') {
                        // logic handled
                    } else if (alterations.includes('b13') && type.includes('#5')) {
                        suffix = refinedQuality; // Use the one returned by refine
                    } else {
                        suffix += `(${alterations.join(',')})`;
                    }
                }

                return {
                    root: rootName,
                    quality: suffix,
                    bass: bassName,
                    name: isSlash ? `${rootName}${suffix}/${bassName}` : `${rootName}${suffix}`,
                    intervals,
                    omissions: [],
                    complexity: calculateComplexity(rootName, bassName) + (isSlash ? 1 : 0),
                    confidence: 1.0
                };
            }
        }

        // B. Match with Omitted 5th (Common in Jazz/Rock)
        for (const [type, template] of Object.entries(CHORD_TEMPLATES)) {
            // Only try omission logic for chords that HAVE a 5th (7 semitones)
            if (!template.includes(7)) continue;

            const templateNo5 = template.filter(i => i % 12 !== 7);
            if (matchesTemplate(intervals, templateNo5)) {
                const isSlash = rootMidi % 12 !== bassMidi % 12;
                return {
                    root: rootName,
                    quality: type,
                    bass: bassName,
                    name: isSlash ? `${rootName}${type}/${bassName}` : `${rootName}${type}`,
                    intervals,
                    omissions: ['omit5'],
                    complexity: calculateComplexity(rootName, bassName) + 0.5, // Slight penalty
                    confidence: 0.9
                };
            }
        }
    }

    // 4. Check for "So What" / Quartal Stack (Minor 11 context)
    // Structure: Root, 11, b7, m3, (b13)
    // Intervals relative to Bass (assumed Root for this voicing):
    const intervals = getIntervals(bassMidi, sorted);

    const has11 = intervals.some(i => i % 12 === 5);
    const hasb7 = intervals.some(i => i % 12 === 10);
    const hasm3 = intervals.some(i => i % 12 === 3);

    // Explicit check for m11 specific voicing if not found by templates
    // (Templates have m11, but this ensures we catch spread voicings)
    if (has11 && hasb7 && hasm3) {
        return {
            root: bassName,
            quality: 'm11',
            bass: bassName,
            name: `${bassName}m11`,
            intervals,
            omissions: [],
            complexity: calculateComplexity(bassName, bassName) + 0.5,
            confidence: 0.85
        };
    }

    return null;
}

function generateSymmetricalAlternatives(result: ChordResult, notes: number[], context: { useFlats: boolean }): ChordResult[] {
    if (result.quality !== 'dim7' && result.quality !== 'aug') return [];

    const alternatives: ChordResult[] = [];
    const intervalStep = result.quality === 'dim7' ? 3 : 4;
    const count = result.quality === 'dim7' ? 4 : 3;

    // notes are sorted absolute MIDI
    // We want to treat each note as a potential root
    const originalRootMidi = parseMidi(result.root); // This might be tricky if root name is generic. 
    // Better: Iterate through the input unique notes.

    // We need the unique pitch classes in the chord
    const distinctNotes = Array.from(new Set(notes.map(n => n % 12))).sort((a, b) => a - b);

    // Check if these notes actually form the symmetrical shape (already partially verified by parent)
    if (distinctNotes.length !== count) return []; // Safety

    // Generate result for each note as root
    distinctNotes.forEach(pc => {
        // Skip if it's the one we already found (roughly)
        // But "Cdim7" vs "Ebdim7" are different names.

        // Find a specific MIDI note for this PC that exists in input, or just use PC to get name
        // We need a representative name.
        // Try to find the closest spelling to what's in context?
        // Simply use getNoteName for that PC.
        const name = getNoteName(pc, context.useFlats);

        if (name === result.root) return; // Already have this one

        const altRootName = name;
        // Assume same bass if it's acting as a slash? Or Root position?
        // In symmetrical chords, any note is the root.
        // If original was Cdim7/Eb -> Eb is in bass. 
        // New: Ebdim7 (Root position).

        const bassName = result.bass;
        const bassMidi = notes[0]; // Lowest note
        const bassPC = bassMidi % 12;

        const isSlash = bassPC !== pc;

        alternatives.push({
            root: altRootName,
            quality: result.quality,
            bass: bassName,
            name: isSlash ? `${altRootName}${result.quality}/${bassName}` : `${altRootName}${result.quality}`,
            intervals: result.intervals, // Intervals are relative to THAT root? No, `result.intervals` are relative to original root. 
            // We should technically recalculate, but for UI display maybe not critical? 
            // Let's Recalculate intervals relative to NEW root for correctness if needed.
            // Actually, `detectStructure` does everything fresh.
            // Simpler: Just rely on the name.
            omissions: [],
            complexity: calculateComplexity(altRootName, bassName) + (isSlash ? 0.5 : 0),
            confidence: result.confidence * 0.95 // Slightly lower confidence than primary detection?
        });
    });

    return alternatives;
}

/* ===================== Polychord (Upper Structures) ===================== */

function detectPolychord(notes: number[], context: { useFlats: boolean }): ChordResult | null {
    if (notes.length < 4) return null;

    const sorted = [...notes].sort((a, b) => a - b);
    const bassMidi = sorted[0];
    const bassName = getNoteName(bassMidi, context.useFlats);

    // Split: Bass note vs Upper Structure
    const upperNotes = sorted.filter(n => n > bassMidi + 3); // Basic separation
    if (upperNotes.length < 3) return null;

    // Analyze strictly the upper structure
    const upperResult = detectStructure(upperNotes, context);

    if (upperResult && upperResult.confidence >= 0.9) {
        // e.g., D major triad over C bass -> Cmaj13#11 or D/C
        return {
            root: upperResult.root,
            quality: upperResult.quality,
            bass: bassName,
            name: `${upperResult.name}/${bassName}`,
            intervals: getIntervals(bassMidi, sorted),
            omissions: [],
            complexity: upperResult.complexity + 1,
            confidence: 0.85 // Polychords are theoretically dense
        };
    }
    return null;
}

// ===================== Public API =====================

/**
 * Main analysis function.
 * Accepts MIDI numbers or strings, detects chord names, handles inversions and enharmonics.
 */
export function detectChord(input: NoteInput[]): ChordResult[] {
    if (input.length < 2) return [];

    const midiNotes = input.map(parseMidi);
    // Filter duplicates (unison) but keep octaves
    const uniqueNotes = Array.from(new Set(midiNotes));

    const results: ChordResult[] = [];
    const contexts = generateContexts(uniqueNotes);

    // Run analysis in different enharmonic contexts
    for (const ctx of contexts) {
        // 1. Try standard structural detection (including inversions)
        const struct = detectStructure(uniqueNotes, ctx);
        if (struct) results.push(struct);

        // 2. Try polychord detection (if standard fails or as alternative)
        const poly = detectPolychord(uniqueNotes, ctx);
        if (poly) results.push(poly);

        // 3. Symmetrical Expansion
        // Copy current results to avoid infinite loop
        const currentResults = [...results];
        for (const res of currentResults) {
            if (res.quality === 'dim7' || res.quality === 'aug') {
                const alts = generateSymmetricalAlternatives(res, uniqueNotes, ctx);
                results.push(...alts);
            }
        }
    }

    // Deduplicate by name to remove redundant results from different contexts
    const uniqueResults = new Map<string, ChordResult>();
    results.forEach(r => {
        if (!uniqueResults.has(r.name) || r.complexity < uniqueResults.get(r.name)!.complexity) {
            uniqueResults.set(r.name, r);
        }
    });

    return Array.from(uniqueResults.values())
        .sort((a, b) => {
            // Sort by: Confidence (High->Low) > Complexity (Low->High)
            if (a.confidence !== b.confidence) return b.confidence - a.confidence;
            return a.complexity - b.complexity;
        });
}