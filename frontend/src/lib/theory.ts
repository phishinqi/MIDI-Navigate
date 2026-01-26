import { Chord, Note } from "@tonaljs/tonal";
import { detect } from './chordNameFinder';
import { detectChord } from './chordAnalyzer';


export const midiToNoteName = (midi: number) => {
  return Note.fromMidi(midi);
};

export const getActiveNoteDetails = (midiData: any, currentTime: number, trackIndices: number[], lookbackWindow = 0) => {
  if (!midiData) return [];
  const activeNotes = [];
  const windowStart = currentTime - lookbackWindow;
  const windowEnd = currentTime + 0.05;

  midiData.tracks.forEach((track, i) => {
    if (trackIndices && trackIndices.length > 0 && !trackIndices.includes(i)) return;
    // Ignore percussion
    if (track.instrument.percussion) return;

    for (const note of track.notes) {
      const noteStart = note.time;
      if (noteStart > windowEnd) break;

      const noteEnd = note.time + note.duration;
      if (noteEnd > windowStart && noteStart < windowEnd) {
        activeNotes.push(note);
      }
    }
  });
  return activeNotes;
};
export const areNotesEqual = (prevNotes: any[], nextNotes: any[]) => {
  if (!prevNotes || !nextNotes) return false;
  if (prevNotes.length !== nextNotes.length) return false;

  const prevPitches = prevNotes.map(n => n.midi).sort((a, b) => a - b);
  const nextPitches = nextNotes.map(n => n.midi).sort((a, b) => a - b);

  for (let i = 0; i < prevPitches.length; i++) {
    if (prevPitches[i] !== nextPitches[i]) return false;
  }
  return true;
};

export const detectLocalChord = (midiNumbers: number[], engine: 'legacy' | 'experimental' = 'legacy') => {
  if (!midiNumbers || midiNumbers.length < 2) return { name: "---", confidence: 0, aliases: [] };
  if (engine === 'experimental') {
    const results = detectChord(midiNumbers);
    if (!results || results.length === 0) return { name: "---", confidence: 0, aliases: [] };

    const best = results[0];
    const aliases = results.slice(1).map(r => r.name);

    return {
      name: best.name,
      confidence: best.confidence,
      aliases: aliases,
      quality: best.quality
    };
  }

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
