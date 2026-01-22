// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/AnalysisSettings.jsx
import React from 'react';
import useStore from '@/store/useStore';
import * as Switch from '@radix-ui/react-switch';
import { Server, Cpu, Gauge, List } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // 1. 引入

const AnalysisSettings = () => {
    const { t } = useTranslation(); // 2. 初始化
    const chordDetectionMode = useStore(state => state.chordDetectionMode);
    const setChordDetectionMode = useStore(state => state.setChordDetectionMode);
    const analysisSensitivity = useStore(state => state.analysisSensitivity);
    const setAnalysisSensitivity = useStore(state => state.setAnalysisSensitivity);
    const analysisComplexity = useStore(state => state.analysisComplexity);
    const setAnalysisComplexity = useStore(state => state.setAnalysisComplexity);

    // 辅助函数：获取灵敏度的显示文本
    const getSensitivityLabel = (val) => {
        if (val === 1) return t('analysis_settings.sensitivity.high_label', { defaultValue: 'High (2s)' });
        if (val === 3) return t('analysis_settings.sensitivity.low_label', { defaultValue: 'Low (10s)' });
        return t('analysis_settings.sensitivity.med_label', { defaultValue: 'Med (5s)' });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-sans tabular-nums border-b border-white/10 pb-2">
                {t('analysis_settings.title', { defaultValue: 'Analysis Engine' })}
            </h3>

            <div className="flex flex-col gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold flex items-center gap-2">
                            {chordDetectionMode === 'server' ? <Server size={14} className="text-green-400" /> : <Cpu size={14} className="text-blue-400" />}
                            {t('analysis_settings.deep_analysis_mode', { defaultValue: 'Deep Analysis Mode' })}
                        </span>
                        <span className="text-[10px] text-white/40 mt-0.5">
                            {chordDetectionMode === 'server'
                                ? t('analysis_settings.mode_desc.server', { defaultValue: "Server (Python): Deep analysis, inversions, context-aware." })
                                : t('analysis_settings.mode_desc.local', { defaultValue: "Local (ChordNameFinder): Fast, responsive, advanced detection." })}
                        </span>
                    </div>
                    <Switch.Root className={`w-10 h-6 rounded-full relative transition-colors duration-300 cursor-pointer ${chordDetectionMode === 'server' ? 'bg-green-500/20 border border-green-500/50' : 'bg-white/10 border border-white/10'}`} checked={chordDetectionMode === 'server'} onCheckedChange={(checked) => setChordDetectionMode(checked ? 'server' : 'local')}>
                        <Switch.Thumb className={`block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 translate-x-1 will-change-transform ${chordDetectionMode === 'server' ? 'translate-x-5' : 'translate-x-1'}`} />
                    </Switch.Root>
                </div>
            </div>

            <p className="text-[10px] opacity-40 text-right mt-1">
                {t('analysis_settings.tip', { defaultValue: "Tip: Click 'Apply Analysis Changes' in Mixer tab to take effect." })}
            </p>
        </div>
    );
};
export default AnalysisSettings;
