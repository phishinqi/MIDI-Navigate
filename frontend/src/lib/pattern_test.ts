// Final test to understand pattern matching
import { detect, parseNote, getIntervals, matchPattern } from './chordNameFinder';

// Recreate the exact scenario
console.log('=== Pattern Matching Analysis ===\n');

// Test what [0, 2, 4] matches
console.log('Test: 3-note interval [0, 2, 4]');
const pattern1 = matchPattern([0, 2, 4]);
console.log('Matched pattern:', pattern1);
console.log('');

// Test what [0, 2, 4, 7] matches  
console.log('Test: 4-note interval [0, 2, 4, 7]');
const pattern2 = matchPattern([0, 2, 4, 7]);
console.log('Matched pattern:', pattern2);
console.log('');

// Test wide voicing intervals
console.log('Test: Wide voicing [0, 12, 14, 16]');
const pattern3 = matchPattern([0, 12, 14, 16]);
console.log('Matched pattern:', pattern3);
console.log('');

console.log('Test: Wide voicing [0, 19, 26, 28]');
const pattern4 = matchPattern([0, 19, 26, 28]);
console.log('Matched pattern:', pattern4);
