// frontend/src/lib/theory.js
import { Chord, Note } from "@tonaljs/tonal";

export const midiToNoteName = (midi) => {
  return Note.fromMidi(midi);
};

// Optimized Note Fetcher
export const getActiveNoteDetails = (midiData, currentTime, trackIndices, lookbackWindow = 0) => {
  if (!midiData) return [];
  const activeNotes = [];
  const windowStart = currentTime - lookbackWindow;
  // 稍微放宽结束窗口，确保短音符能被捕捉
  const windowEnd = currentTime + 0.05;

  midiData.tracks.forEach((track, i) => {
    // Filter by specific tracks if indices provided
    if (trackIndices && trackIndices.length > 0 && !trackIndices.includes(i)) return;
    // Ignore percussion
    if (track.instrument.percussion) return;

    for (const note of track.notes) {
        const noteStart = note.time;
        if (noteStart > windowEnd) break;

        const noteEnd = note.time + note.duration;
        // Check if note is active in the window
        if (noteEnd > windowStart && noteStart < windowEnd) {
            activeNotes.push(note);
        }
    }
  });
  return activeNotes;
};

// 比较两个音符集合是否相同（用于减少 API 调用）
export const areNotesEqual = (prevNotes, nextNotes) => {
    if (!prevNotes || !nextNotes) return false;
    if (prevNotes.length !== nextNotes.length) return false;

    // 提取 MIDI Pitch 并排序比较
    const prevPitches = prevNotes.map(n => n.midi).sort((a, b) => a - b);
    const nextPitches = nextNotes.map(n => n.midi).sort((a, b) => a - b);

    for (let i = 0; i < prevPitches.length; i++) {
        if (prevPitches[i] !== nextPitches[i]) return false;
    }
    return true;
};

// 本地快速检测 (作为服务端的 Fallback 或预览)
export const detectLocalChord = (midiNumbers) => {
  if (!midiNumbers || midiNumbers.length < 2) return { name: "---", confidence: 0 };
  const noteNames = midiNumbers.map(m => Note.fromMidi(m));
  const possibleChords = Chord.detect(noteNames);

  if (!possibleChords || possibleChords.length === 0) return { name: "---", confidence: 0 };

  // 优先返回最简单的和弦名称
  const bestMatch = possibleChords.sort((a, b) => a.length - b.length)[0];
  return { name: bestMatch, confidence: 0.8 }; // 本地检测置信度略低
};
