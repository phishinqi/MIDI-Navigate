// frontend/src/lib/api.js
const API_BASE = '/api/v1';

export const api = {
  uploadMidi: async (file) => {
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

  analyzeMidi: async (file, trackIndices, complexity = 'standard', sensitivity = 2) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('track_indices', JSON.stringify(trackIndices));

    // Map sensitivity (1=High, 2=Med, 3=Low) to Window Size (Seconds)
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

  // Real-time Chord Analysis
  analyzeChord: async (notes) => {
    const response = await fetch(`${API_BASE}/analyze/chord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // 必须是对象结构 { notes: [...] }，不能直接是 notes 数组
      body: JSON.stringify({
          notes: notes,
          detect_type: "standard"
      }),
    });

    // 增加错误日志帮助调试
    if (!response.ok) {
        const err = await response.text();
        console.error("Chord API Error:", response.status, err);
        throw new Error("Chord analysis failed: " + err);
    }
    return response.json();
  }
};