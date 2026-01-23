// Detailed analysis
import { detectChord, parseNote } from './chordAnalyzer';
import { getIntervals } from './chordNameFinder'; // Keep for utility if needed, or replace with Analyzer's internal utils if exported

console.log('=== 详细分析 ===\n');

// Test 1: C#3 F4 C#5 D#5
console.log('组合 1: C#3 F4 C#5 D#5');
console.log('音符含义: 根音C# + F(#11?) + C#八度 + D#(9)');
const m1 = [49, 65, 61, 63].sort((a, b) => a - b); // 排序后: 49, 61, 63, 65
console.log('排序后MIDI:', m1, '→', m1.map(m => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const oct = Math.floor(m / 12) - 1;
    return names[m % 12] + oct;
}));

// Use Parser from new Analyzer? Or keep raw MIDI
// detectChord accepts number[] directly.
console.log('');

// Test 2: C#2 G#3 D#4 F4  
console.log('组合 2: C#2 G#3 D#4 F4');
console.log('音符含义: 根音C# + G#(5) + D#(9) + F(#11?)');
const m2 = [37, 56, 63, 65].sort((a, b) => a - b); // 已经排序
console.log('排序后MIDI:', m2, '→', m2.map(m => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const oct = Math.floor(m / 12) - 1;
    return names[m % 12] + oct;
}));
console.log('');

console.log('=== 和弦检测结果 (ChordAnalyzer) ===');
const r1 = detectChord(m1);
const r2 = detectChord(m2);

console.log('组合1 结果:', r1.slice(0, 3).map(r => r.name).join(', '));
if (r1.length > 0) {
    console.log('   详细:', JSON.stringify(r1[0], null, 2));
}

console.log('组合2 结果:', r2.slice(0, 3).map(r => r.name).join(', '));
if (r2.length > 0) {
    console.log('   详细:', JSON.stringify(r2[0], null, 2));
}
