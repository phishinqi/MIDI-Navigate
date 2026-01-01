import React from 'react';
import useStore from '@/store/useStore';
import { Bug, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DebugTab = () => {
  const { t } = useTranslation();
  const analysisData = useStore(state => state.analysisData);
  const midiData = useStore(state => state.midiData);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black/20">
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2 border-b border-white/10 pb-1">
            <Database size={14} />
            {t('debug.analysis_dump', { defaultValue: 'Analysis Data Dump' })}
        </h3>
        <div className="w-full p-4 rounded-lg text-[10px] font-mono overflow-auto max-h-[400px] border border-white/10 bg-black/40 text-green-400/80 shadow-inner">
            {analysisData ? (
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(analysisData, null, 2)}</pre>
            ) : (
                <div className="opacity-50 italic text-white">
                    {t('debug.no_data', { defaultValue: 'No analysis data. Upload MIDI first.' })}
                </div>
            )}
        </div>
      </div>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2 border-b border-white/10 pb-1">
            <Bug size={14} />
            {t('debug.midi_header', { defaultValue: 'MIDI Header' })}
        </h3>
        <div className="w-full p-4 rounded-lg text-[10px] font-mono overflow-auto border border-white/10 bg-black/40 text-blue-400/80 shadow-inner">
            <pre>{JSON.stringify(midiData?.header || {}, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default DebugTab;
