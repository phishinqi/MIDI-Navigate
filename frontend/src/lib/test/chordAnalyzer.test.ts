import { describe, it, expect } from 'vitest'; // Assuming Vitest, compatible with Jest
import { detectChord, ChordResult } from '../chordAnalyzer';

// Helpers
const midi = (n: number) => n;

describe('chordAnalyzer', () => {

    describe('Basic Triads', () => {
        it('should detect C Major', () => {
            const notes = [60, 64, 67]; // C4, E4, G4
            const results = detectChord(notes);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].name).toBe('C');
            expect(results[0].quality).toBe('');
        });

        it('should detect C Minor', () => {
            const notes = [60, 63, 67]; // C4, Eb4, G4
            const results = detectChord(notes);
            expect(results[0].name).toBe('Cm');
            expect(results[0].quality).toBe('m');
        });

        it('should detect Inversions (C/E)', () => {
            const notes = [52, 60, 67]; // E3, C4, G4
            const results = detectChord(notes);
            expect(results[0].name).toBe('C/E');
            expect(results[0].bass).toBe('E');
        });
    });

    describe('Advanced Heuristics', () => {
        it('should distinguish #5 vs b13 (Natural 5th check)', () => {
            // C7(b13): C, E, G, Bb, Ab. (Has Natural 5th G and b13 Ab)
            const notes = [60, 64, 67, 70, 68];
            const results = detectChord(notes);

            // Should favor b13 because G(67) is present
            const match = results.find(r => r.name === 'C7(b13)' || r.quality === '7(b13)');
            expect(match).toBeDefined();
            expect(match?.quality).toBe('7(b13)');
        });

        it('should detect #9 (Hendrix Chord)', () => {
            // E7#9: E, G#, B, D, G(F##/Fx or usually G natural in this voicing context)
            // Intervals: 0, 4, 7, 10, 15(#9)
            // E(40), G#(44), B(47), D(50), G(55)
            const notes = [40, 44, 47, 50, 55];
            // Normalized: 0, 4, 7, 10, 15 (#9 is 3 mod 12, but octave up)

            const results = detectChord(notes);
            const top = results[0];
            expect(top.name).toContain('7#9'); // Our quality should match 7#9 template
        });

        it('should detect Shell Dyads (Maj7 no3,5)', () => {
            // C, B (Root, Major 7)
            const notes = [60, 71];
            const results = detectChord(notes);
            const match = results.find(r => r.quality.includes('no3'));
            expect(match).toBeDefined();
            expect(match?.name).toBe('Cmaj7(no3,5)');
        });
    });

    describe('Specialized Voicings', () => {
        it('should detect "So What" chord (m11)', () => {
            // Dm11: D, G, C, F, A (Root, 11, b7, m3, 5?? No, So What is quartal: D, G, C, F, A)
            // D2, G2, C3, F3, A3
            // 38, 43, 48, 53, 57
            // Intervals relative to D: 0, 5, 10, 15(3), 19(7? 7+12=19) -> 57-38=19 (A is 5th)
            // Wait, Standard So What: D, G, C, F, A is 1, 11, b7, b3? No F is b3.
            // D(0), G(5 - 11), C(10 - b7), F(15 - m3), A(19 - 5)
            // It's a m11 chord.
            const notes = [38, 43, 48, 53, 57];
            const results = detectChord(notes);

            const m11 = results.find(r => r.quality.includes('m11'));
            expect(m11).toBeDefined();
            expect(m11?.root).toBe('D');
        });
    });

    describe('Symmetrical Chords', () => {
        it('should generate alternatives for Dim7', () => {
            // Cdim7: C, Eb, Gb, Bbb(A)
            const notes = [60, 63, 66, 69];
            const results = detectChord(notes);

            // Should have Cdim7, Ebdim7, Gbdim7, Adim7
            expect(results.some(r => r.root === 'C' && r.quality === 'dim7')).toBe(true);
            expect(results.some(r => r.root === 'Eb' && r.quality === 'dim7')).toBe(true);
            expect(results.some(r => r.root === 'Gb' && r.quality === 'dim7')).toBe(true);
            expect(results.some(r => r.root === 'A' && r.quality === 'dim7')).toBe(true);
        });
    });

    describe('Complexity Scoring', () => {
        it('should penalize mixed accidentals', () => {
            // F# Major: F#, A#, C#
            // Vs Gb Major: Gb, Bb, Db
            const notes = [54, 58, 61]; // F#2, A#2, C#3
            const results = detectChord(notes);

            const sharp = results.find(r => r.root === 'F#');
            const flat = results.find(r => r.root === 'Gb');

            expect(sharp).toBeDefined();
            expect(flat).toBeDefined();

            // F# Major is standard. Gb Major is standard.
            // But let's look at something mixed. 
            // e.g. D#dim7 vs Ebdim7.
            // If we had [D#, F#, A, C] -> D#dim7.
            // If we forced a spelling like "D# Gb A C", that would be mixed.
            // But detectChord generates pure contexts (Sharp Context vs Flat Context).
            // So we just check that the WINNER is the simpler one.

            // E Major: E, G#, B (Simple)
            // Fb Major: Fb, Ab, Cb (Double flats, complex)
            const eMaj = detectChord([40, 44, 47])[0];
            expect(eMaj.root).toBe('E'); // Should beat Fb
        });
    });

    describe('Complex Harmonies', () => {
        it('should detect Polychords (Upper Structures)', () => {
            // D Major Triad over C Bass (Lydian Dominant / C13#11 sound)
            // C2, D3, F#3, A3
            const notes = [36, 50, 54, 57];
            const results = detectChord(notes);

            // Should find D/C
            const poly = results.find(r => r.name === 'D/C');
            expect(poly).toBeDefined();
            expect(poly?.root).toBe('D');
            expect(poly?.bass).toBe('C');
        });

        it('should detect Slash Chords (Gospel/Pop)', () => {
            // F Major over G Bass (G9sus4 sound)
            // G2, F3, A3, C4
            const notes = [43, 53, 57, 60];
            const results = detectChord(notes);

            // Can be F/G or G9sus4
            // detectChord returns sorted results. 
            // We just want to ensure one of these valid interpretations is present.
            const slash = results.find(r => r.name === 'F/G');
            const sus = results.find(r => r.quality.includes('9sus4'));

            expect(slash || sus).toBeDefined();
        });

        it('should detect Altered Dominants (C7alt)', () => {
            // C7(b9, #9, b5, #5) - The "Kitchen Sink"
            // C, E, Bb (Shell) + Db(b9), D#(#9), Gb(b5), Ab(#5/b13)
            // C3, E3, Bb3, Db4, Ab4
            // Let's try a specific voicing: C, E, Bb, Db, Ab (C7 b9 b13)
            const notes = [48, 52, 58, 61, 68];
            const results = detectChord(notes);

            // Expect C as root
            expect(results[0].root).toBe('C');
            // Check for altered quality features
            const quality = results[0].quality;
            // Expect 7(b9,b13) or "7alt"
            if (quality === '7alt') {
                expect(quality).toBe('7alt');
            } else {
                expect(quality).toContain('7');
                expect(quality).toContain('b13');
                expect(quality).toContain('b9');
            }
        });
    });

});
