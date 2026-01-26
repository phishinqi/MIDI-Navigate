
import { detectChord } from './chordAnalyzer';

// A#3 (58), D4 (62), E3 (52), E4 (64)
// Sorted: 52 (E3), 58 (A#3), 62 (D4), 64 (E4).
// Intervals from E3: 0, 6, 10, 12.
// Notes: E, Bb, D, E.
const notes = [{ midi: 58 }, { midi: 62 }, { midi: 52 }, { midi: 64 }];

console.log('Testing A#3 D4 E3 E4...');
const results = detectChord(notes);
if (results.length > 0) {
    console.log('Detected:', results.map(r => r.name).join(', '));
} else {
    console.log('FAILURE: No chord detected.');
}
