// frontend/src/lib/theory.js
import { Chord, Note } from "@tonaljs/tonal";
import { detect } from './chordNameFinder';
import { detectChord } from './chordAnalyzer';

// --- Helpers ---

export const midiToNoteName = (midi: number) => {
  return Note.fromMidi(midi);
};

// Optimized Note Fetcher
export const getActiveNoteDetails = (midiData: any, currentTime: number, trackIndices: number[], lookbackWindow = 0) => {
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

// [NEW] 比较两个音符集合是否相同（用于减少 API 调用）
export const areNotesEqual = (prevNotes: any[], nextNotes: any[]) => {
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

// [NEW] Local detection using Advanced Chord System
export const detectLocalChord = (midiNumbers: number[], engine: 'legacy' | 'experimental' = 'legacy') => {
  if (!midiNumbers || midiNumbers.length < 2) return { name: "---", confidence: 0, aliases: [] };

  // Experimental: Use structure-based ChordAnalyzer
  if (engine === 'experimental') {
    const results = detectChord(midiNumbers); // Uses new analyzer
    if (!results || results.length === 0) return { name: "---", confidence: 0, aliases: [] };

    const best = results[0];
    const aliases = results.slice(1).map(r => r.name); // Using 'name' from new result structure

    return {
      name: best.name,
      confidence: best.confidence,
      aliases: aliases,
      quality: best.quality // New analyzer provides this
    };
  }

  // Legacy: Use original chordNameFinder
  const results = detect(midiNumbers, { mode: 'loose', maxResults: 5 });

  if (!results || results.length === 0) return { name: "---", confidence: 0, aliases: [] };

  const best = results[0];
  const aliases = results.slice(1).map(r => r.formatted);

  return {
    name: best.formatted,
    confidence: best.confidence,
    aliases: aliases,
    quality: best.chordType
  };
};
