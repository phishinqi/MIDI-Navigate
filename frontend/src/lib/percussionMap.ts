
export const GM_DRUM_MAP: Record<number, { label: string, color: string, shapeID: number }> = {
  35: { label: "Acoustic Bass Drum", color: "#FF3D00", shapeID: 0 },
  36: { label: "Bass Drum 1", color: "#FF1744", shapeID: 0 },
  38: { label: "Acoustic Snare", color: "#E0FFFF", shapeID: 1 },
  40: { label: "Electric Snare", color: "#84FFFF", shapeID: 1 },
  37: { label: "Side Stick", color: "#FFD740", shapeID: 2 },
  39: { label: "Hand Clap", color: "#FF00FF", shapeID: 1 },
  42: { label: "Closed Hi Hat", color: "#00E676", shapeID: 3 },
  44: { label: "Pedal Hi-Hat", color: "#69F0AE", shapeID: 3 },
  46: { label: "Open Hi-Hat", color: "#B2FF59", shapeID: 3 },
  41: { label: "Low Floor Tom", color: "#304FFE", shapeID: 2 },
  43: { label: "High Floor Tom", color: "#6200EA", shapeID: 2 },
  45: { label: "Low Tom", color: "#2962FF", shapeID: 2 },
  47: { label: "Low-Mid Tom", color: "#00B0FF", shapeID: 2 },
  49: { label: "Crash Cymbal 1", color: "#FFAB00", shapeID: 3 },
  57: { label: "Crash Cymbal 2", color: "#FFD600", shapeID: 3 },
  51: { label: "Ride Cymbal 1", color: "#AA00FF", shapeID: 3 },
  59: { label: "Ride Cymbal 2", color: "#D500F9", shapeID: 3 },
  54: { label: "Tambourine", color: "#76FF03", shapeID: 4 },
  56: { label: "Cowbell", color: "#FFFF00", shapeID: 4 },
};

export const getDrumVisuals = (midi: number) => {
  return GM_DRUM_MAP[midi] || { label: "Unknown", color: "#607D8B", shapeID: 0 };
};
