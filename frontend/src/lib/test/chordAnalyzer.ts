/* ============================================================
 *  chordAnalyzer.ts
 *  Structure-first chord analyzer
 * ============================================================
 */

export interface MidiNote {
    midi: number;
}

/* ===================== Config ===================== */

export const NAMING_MODE: 'jazz' | 'classical' = 'jazz';

/* ===================== Utils ===================== */

function pc(n: number) {
    return ((n % 12) + 12) % 12;
}

function buildMask(notes: MidiNote[]): number {
    let mask = 0;
    for (const n of notes) mask |= 1 << pc(n.midi);
    return mask;
}

function rotateMask(mask: number, root: number): number {
    return ((mask << root) | (mask >> (12 - root))) & 0xfff;
}

/* ===================== Templates ===================== */

const CHORD_TEMPLATES: Record<string, number[]> = {
    // triads
    maj: [0, 4, 7],
    min: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],

    // suspended
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],

    // sixth
    '6': [0, 4, 7, 9],
    m6: [0, 3, 7, 9],

    // sevenths
    '7': [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    mMaj7: [0, 3, 7, 11],
    dim7: [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10],

    // extensions
    '9': [0, 4, 7, 10, 2],
    maj9: [0, 4, 7, 11, 2],
    min9: [0, 3, 7, 10, 2],

    '11': [0, 4, 7, 10, 5],
    min11: [0, 3, 7, 10, 5],

    '13': [0, 4, 7, 10, 9],
    min13: [0, 3, 7, 10, 9],

    // altered dominant
    '7b9': [0, 4, 7, 10, 1],
    '7#9': [0, 4, 7, 10, 3],
    '7b5': [0, 4, 6, 10],
    '7#5': [0, 4, 8, 10],
    '7alt': [0, 4, 6, 8, 10, 1, 3],

    // quartal / cluster / power
    quartal: [0, 5, 10],
    cluster: [0, 1, 2],
    '5': [0, 7],
};

const TEMPLATE_MASKS: Record<string, number> = Object.fromEntries(
    Object.entries(CHORD_TEMPLATES).map(([k, v]) => [
        k,
        v.reduce((m, i) => m | (1 << (i % 12)), 0)
    ])
);

/* ===================== Analysis ===================== */

interface Analysis {
    notes: MidiNote[];
    mask: number;
    bass: number;
}

function analyze(notes: MidiNote[]): Analysis {
    const sorted = [...notes].sort((a, b) => a.midi - b.midi);
    return {
        notes: sorted,
        mask: buildMask(sorted),
        bass: sorted[0].midi
    };
}

/* ===================== Voicing Helpers ===================== */

function hasLowCluster(notes: MidiNote[]): boolean {
    for (let i = 0; i < notes.length - 1; i++) {
        if (notes[i + 1].midi - notes[i].midi <= 2) return true;
    }
    return false;
}

function isAdd9(notes: MidiNote[], rootPc: number): boolean {
    const root = notes.find(n => pc(n.midi) === rootPc);
    if (!root) return false;

    const thirds = notes.filter(n => {
        const i = (n.midi - root.midi) % 12;
        return i === 3 || i === 4;
    });

    const seconds = notes.filter(n => (n.midi - root.midi) % 12 === 2);

    return seconds.some(s =>
        thirds.every(t => s.midi - t.midi >= 12)
    );
}

/* ===================== Polychord ===================== */

function detectPolychord(a: Analysis) {
    if (a.notes.length < 4) return null;

    const bassPc = pc(a.bass);
    const upper = a.notes.slice(1);
    const upperMask = buildMask(upper);

    for (const [type, tmpl] of Object.entries(TEMPLATE_MASKS)) {
        for (let r = 0; r < 12; r++) {
            const rot = rotateMask(tmpl, r);
            if ((upperMask & rot) === rot &&
                !(rot & (1 << bassPc))) {
                return {
                    root: r,
                    name: `${pcName(r)}${type}/${pcName(bassPc)}`,
                    reasoning: ['Upper-structure chord', 'Bass outside upper chord']
                };
            }
        }
    }
    return null;
}

/* ===================== Interpretation ===================== */

function interpret(a: Analysis) {
    const results: any[] = [];

    const poly = detectPolychord(a);
    if (poly) return [poly];

    for (const [type, tmpl] of Object.entries(TEMPLATE_MASKS)) {
        for (let root = 0; root < 12; root++) {
            const rot = rotateMask(tmpl, root);
            if ((a.mask & rot) !== rot) continue;

            // sus / cluster
            if (type === 'sus2' && hasLowCluster(a.notes)) {
                results.push({
                    root,
                    name: `${pcName(root)}sus2`,
                    reasoning: ['Low cluster voicing']
                });
                continue;
            }

            // add9
            if (type === 'maj' && isAdd9(a.notes, root)) {
                results.push({
                    root,
                    name: `${pcName(root)}add9`,
                    reasoning: ['9th above octave']
                });
                continue;
            }

            results.push({
                root,
                name: `${pcName(root)}${type}`,
                reasoning: ['Template match']
            });
        }
    }
    return results;
}

/* ===================== Naming ===================== */

const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function pcName(pc: number) {
    return PC_NAMES[pc % 12];
}

/* ===================== Public API ===================== */

export function detectChord(notes: MidiNote[]) {
    if (notes.length < 2) return [];
    const analysis = analyze(notes);
    return interpret(analysis);
}
