
import { detectChord } from './chordAnalyzer';

// Test 1: C add11
// C (0), E (4), G (7), F (5)
// Sorted: 0, 4, 5, 7.
// Template check: add11 [0, 4, 5, 7]
const cAdd11 = [{ midi: 60 }, { midi: 64 }, { midi: 65 }, { midi: 67 }];

console.log('Testing C add11...');
const res1 = detectChord(cAdd11);
console.log('Results:', res1.map(r => `${r.name} (${r.confidence})`));

// Test 2: C dim7 (Symmetrical)
// C (0), Eb (3), Gb (6), A (9)
const cDim7 = [{ midi: 60 }, { midi: 63 }, { midi: 66 }, { midi: 69 }];

console.log('\nTesting C dim7...');
const res2 = detectChord(cDim7);
console.log('Results:', res2.map(r => `${r.name} (${r.confidence})`).join(', '));

// Expectation: Cdim7 (1.0), Ebdim7 (0.95), Gbdim7 (0.95), Adim7 (0.95)
