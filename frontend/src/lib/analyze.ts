// Detailed analysis
import { detect, parseNote, getIntervals } from './chordNameFinder';

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
const notes1 = m1.map(m => parseNote(m));
const int1 = getIntervals(notes1);
console.log('间隔 (从C#3):', int1);
console.log('归一化 mod 12:', int1.map(i => i % 12));
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
const notes2 = m2.map(m => parseNote(m));
const int2 = getIntervals(notes2);
console.log('间隔 (从C#2):', int2);
console.log('归一化 mod 12:', int2.map(i => i % 12));
console.log('');

console.log('=== 对比 ===');
console.log('两组归一化后的间隔:');
console.log('组合1:', int1.map(i => i % 12));
console.log('组合2:', int2.map(i => i % 12));
console.log('是否相同?', JSON.stringify(int1.map(i => i % 12)) === JSON.stringify(int2.map(i => i % 12)));
console.log('');

console.log('=== 和弦检测结果 ===');
const r1 = detect(m1, { mode: 'loose', maxResults: 3 });
const r2 = detect(m2, { mode: 'loose', maxResults: 3 });
console.log('组合1 结果:', r1.map(r => r.formatted).join(', '));
console.log('组合2 结果:', r2.map(r => r.formatted).join(', '));
