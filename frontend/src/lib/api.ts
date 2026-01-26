const API_BASE = '/api/v1';

export const api = {
  uploadMidi: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('complexity', 'standard');
    formData.append('window_size', '5.0');

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
    return response.json();
  },

  analyzeMidi: async (file: File, trackIndices: number[], complexity = 'standard', sensitivity = 2) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('track_indices', JSON.stringify(trackIndices));

    const winSize = sensitivity === 1 ? 2.0 : (sensitivity === 3 ? 10.0 : 5.0);

    formData.append('complexity', complexity);
    formData.append('window_size', winSize.toString());

    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analysis failed: ${response.status} ${errorText}`);
    }
    return response.json();
  },

  analyzeChord: async (notes: any[]) => {
    const response = await fetch(`${API_BASE}/analyze/chord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notes: notes,
        detect_type: "standard"
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Chord API Error:", response.status, err);
      throw new Error("Chord analysis failed: " + err);
    }
    return response.json();
  }
};
