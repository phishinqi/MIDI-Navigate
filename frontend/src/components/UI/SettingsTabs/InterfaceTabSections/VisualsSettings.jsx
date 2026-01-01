// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/VisualsSettings.jsx
import React from 'react';
import useStore from '@/store/useStore';
import { Zap, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const VisualsSettings = () => {
    const { t } = useTranslation();
    const isGlowEnabled = useStore(state => state.isGlowEnabled);
    const toggleGlow = useStore(state => state.toggleGlow);
    const autoTextContrast = useStore(state => state.autoTextContrast);
    const toggleAutoTextContrast = useStore(state => state.toggleAutoTextContrast);
    const forceDarkText = useStore(state => state.forceDarkText);
    const toggleForceDarkText = useStore(state => state.toggleForceDarkText);

    const toggleBgOn = 'bg-midi-accent';
    const toggleBgOff = 'bg-white/10';
    const toggleDot = 'bg-white shadow-sm';
    const toggleClassOn = 'left-[18px]';
    const toggleClassOff = 'left-0.5';

    return (
        <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
                {t('visuals.title', { defaultValue: 'Visuals' })}
            </h3>

            <div className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 transition-all cursor-pointer" onClick={toggleGlow}>
                <div className="flex items-center gap-3">
                    <Zap size={18} className="opacity-50" />
                    <span className="text-sm font-bold">{t('visuals.note_glow', { defaultValue: 'Note Glow' })}</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${isGlowEnabled ? toggleBgOn : toggleBgOff}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all ${toggleDot} ${isGlowEnabled ? toggleClassOn : toggleClassOff}`} />
                </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                    <Sun size={18} className="opacity-50" />
                    <span className="text-sm font-bold">{t('visuals.ui_text_color', { defaultValue: 'UI Text Color' })}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleAutoTextContrast}
                        className={`px-3 py-1 rounded text-xs font-bold border transition-all ${autoTextContrast ? 'bg-midi-accent text-black border-midi-accent' : 'border-white/20 text-white/50 hover:text-white'}`}
                    >
                        {t('visuals.auto', { defaultValue: 'Auto' })}
                    </button>

                    {!autoTextContrast && (
                        <div className="flex bg-white/10 rounded p-0.5 border border-white/5">
                            <button
                                onClick={() => forceDarkText && toggleForceDarkText()}
                                className={`p-1.5 rounded transition-all ${!forceDarkText ? 'bg-white/20 text-white shadow' : 'text-white/30 hover:text-white'}`}
                            >
                                <Moon size={14} />
                            </button>
                            <button
                                onClick={() => !forceDarkText && toggleForceDarkText()}
                                className={`p-1.5 rounded transition-all ${forceDarkText ? 'bg-white text-black shadow' : 'text-white/30 hover:text-white'}`}
                            >
                                <Sun size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default VisualsSettings;
