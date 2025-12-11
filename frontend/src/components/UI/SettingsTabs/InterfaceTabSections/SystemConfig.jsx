// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/SystemConfig.jsx
import React, { useRef } from 'react';
import useStore from '@/store/useStore';
import { Download, Upload } from 'lucide-react';

const SystemConfig = () => {
    const fileInputRef = useRef(null);

    const handleExportConfig = () => {
        const state = useStore.getState();
        const configToPersist = {
            backgroundColor: state.backgroundColor, autoTextContrast: state.autoTextContrast, forceDarkText: state.forceDarkText,
            isGlowEnabled: state.isGlowEnabled, renderEngine: state.renderEngine, p5Settings: state.p5Settings,
            pixiSettings: state.pixiSettings, analysisSensitivity: state.analysisSensitivity, analysisComplexity: state.analysisComplexity,
            chordDetectionMode: state.chordDetectionMode, showPlayerWidget: state.showPlayerWidget, showAnalysisWidget: state.showAnalysisWidget,
            viewSettings: state.viewSettings, percussionSettings: state.percussionSettings,
        };
        const config = {
            version: 8,
            timestamp: new Date().toISOString(),
            settings: configToPersist
        };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `midi-navigate-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportConfig = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.settings) {
                    useStore.setState(data.settings);
                    alert("Configuration imported successfully!");
                } else {
                    alert("Invalid configuration file.");
                }
            } catch (err) {
                console.error(err);
                alert("Failed to parse configuration file.");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">System</h3>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={handleExportConfig} className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all group">
                    <Download size={18} className="opacity-50 group-hover:opacity-100 mb-1" />
                    <span>Export Config</span>
                </button>
                <button onClick={() => fileInputRef.current.click()} className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all group">
                    <Upload size={18} className="opacity-50 group-hover:opacity-100 mb-1" />
                    <span>Import Config</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImportConfig} accept=".json" className="hidden" />
            </div>
        </div>
    );
};
export default SystemConfig;
