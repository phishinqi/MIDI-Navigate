// frontend/src/components/UI/FileUpload.jsx
import React, { useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import { UploadCloud } from 'lucide-react';
import useStore from '@/store/useStore';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

const FileUpload = ({ inputId, hidden }) => {
  const setMidiData = useStore((state) => state.setMidiData);
  const setAnalysisData = useStore((state) => state.setAnalysisData);
  const setIsAnalyzing = useStore((state) => state.setIsAnalyzing);
  const { t } = useTranslation(); // 2. 初始化 Hook

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        await Tone.start();
    } catch (err) {
        console.warn("Audio context start failed", err);
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      midi.name = file.name;

      setAnalysisData(null);
      setIsAnalyzing(true);
      setMidiData(midi, file);

      api.uploadMidi(file).then(data => {
        setAnalysisData(data);
        setIsAnalyzing(false);
      }).catch(err => {
        console.error("Backend upload error:", err);
        setIsAnalyzing(false);
      });

    } catch (error) {
      console.error("Error processing MIDI:", error);
      setIsAnalyzing(false);
    }

    // 重置 input，允许重复上传同一文件
    e.target.value = '';
  }, [setMidiData, setAnalysisData, setIsAnalyzing]);

  if (hidden) {
      return <input id={inputId} type="file" accept=".mid,.midi" onChange={handleFileChange} className="hidden" />;
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto mt-20 p-8 border-2 border-dashed border-midi-gray rounded-xl bg-midi-dark/50 hover:bg-midi-gray/30 transition-colors group cursor-pointer relative">
      <input id={inputId} type="file" accept=".mid,.midi" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
      <div className="flex flex-col items-center space-y-4 text-midi-accent/70 group-hover:text-midi-accent transition-colors">
        <div className="p-4 rounded-full bg-midi-gray group-hover:bg-midi-gray/80"><UploadCloud className="w-8 h-8" /></div>
        <div className="text-center">
            <h3 className="text-lg font-medium">
                {t('controls.upload_prompt', { defaultValue: 'Drag MIDI here or click to upload' })}
            </h3>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
