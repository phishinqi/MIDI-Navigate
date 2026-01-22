
import { detect, Note, ChordDetectionResult } from './chord_detection';

console.log("=== Chord Detection Test ===");
console.log("Testing symmetrical chords, enharmonic spellings, and merge rules\n");
const cases: { notes: string[], description: string }[] = [
    {
        notes: ["C3", "E3", "G3", "Bb3"],
        description: "C7 (omit 5) - The most common Jazz shell. (Expect C7)"
    }
];

function printResults(notes: string[], description: string) {
    console.log("=".repeat(70));
    console.log(`Input: ${notes.join(", ")}`);
    console.log(`Description: ${description}`);
    console.log("-".repeat(70));

    const results = detect(notes, { mode: 'loose', maxResults: 5 });

    if (results.length > 0) {
        results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.formatted}`);
            console.log(`   Confidence: ${result.confidence.toFixed(2)}`);
            console.log(`   Reasoning: ${result.reasoning}`);
            if (result.bass) {
                console.log(`   Bass: ${result.bass}`);
            }
            if (result.alterations.length > 0) {
                console.log(`   Alterations: ${result.alterations.join(", ")}`);
            }
            if (result.omissions.length > 0) {
                console.log(`   Omissions: ${result.omissions.join(", ")}`);
            }
            console.log("");
        });
    } else {
        console.log("❌ No chord detected.");
    }
    console.log("");
}

// Run all test cases
cases.forEach(testCase => {
    printResults(testCase.notes, testCase.description);
});
