// frontend/src/lib/percussionMap.js

export const GM_DRUM_MAP = {
  // Kick (底鼓)
  35: { label: "Acoustic Bass Drum", color: "#FF3D00", shapeID: 0 },
  36: { label: "Bass Drum 1",        color: "#FF1744", shapeID: 0 },

  // Snare (军鼓)
  38: { label: "Acoustic Snare",     color: "#E0FFFF", shapeID: 1 },
  40: { label: "Electric Snare",     color: "#84FFFF", shapeID: 1 },
  37: { label: "Side Stick",         color: "#FFD740", shapeID: 2 },

  // Clap
  39: { label: "Hand Clap",          color: "#FF00FF", shapeID: 1 },

  // Hats (镲片)
  42: { label: "Closed Hi Hat",      color: "#00E676", shapeID: 3 },
  44: { label: "Pedal Hi-Hat",       color: "#69F0AE", shapeID: 3 },
  46: { label: "Open Hi-Hat",        color: "#B2FF59", shapeID: 3 },
  
  // Toms (通鼓)
  41: { label: "Low Floor Tom",      color: "#304FFE", shapeID: 2 },
  43: { label: "High Floor Tom",     color: "#6200EA", shapeID: 2 },
  45: { label: "Low Tom",            color: "#2962FF", shapeID: 2 },
  47: { label: "Low-Mid Tom",        color: "#00B0FF", shapeID: 2 },

  // Cymbals (吊镲)
  49: { label: "Crash Cymbal 1",     color: "#FFAB00", shapeID: 3 },
  57: { label: "Crash Cymbal 2",     color: "#FFD600", shapeID: 3 },
  51: { label: "Ride Cymbal 1",      color: "#AA00FF", shapeID: 3 },
  59: { label: "Ride Cymbal 2",      color: "#D500F9", shapeID: 3 },

  // Percussion (其他打击乐)
  54: { label: "Tambourine",         color: "#76FF03", shapeID: 4 },
  56: { label: "Cowbell",            color: "#FFFF00", shapeID: 4 },
};

export const getDrumVisuals = (midi) => {
    // 默认颜色：一种中性的深灰色，避免未映射的音符太抢眼
    return GM_DRUM_MAP[midi] || { label: "Unknown", color: "#607D8B", shapeID: 0 };
};