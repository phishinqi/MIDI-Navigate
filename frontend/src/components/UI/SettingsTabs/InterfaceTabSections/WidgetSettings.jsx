// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/WidgetSettings.jsx
import React from 'react';
import useStore from '@/store/useStore';
import { Layout, Sliders } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WidgetSettings = () => {
    const { t } = useTranslation();
    const showPlayerWidget = useStore(state => state.showPlayerWidget);
    const togglePlayerWidget = useStore(state => state.togglePlayerWidget);
    const showAnalysisWidget = useStore(state => state.showAnalysisWidget);
    const toggleAnalysisWidget = useStore(state => state.toggleAnalysisWidget);

    const toggleBgOn = 'bg-midi-accent';
    const toggleBgOff = 'bg-white/10';
    const toggleDot = 'bg-white shadow-sm';
    const toggleClassOn = 'left-[18px]';
    const toggleClassOff = 'left-0.5';

    const items = [
        {
            label: t('widgets.timeline_controls', { defaultValue: 'Timeline & Controls' }),
            state: showPlayerWidget,
            toggle: togglePlayerWidget,
            icon: Layout
        },
        {
            label: t('widgets.analysis_hud', { defaultValue: 'Analysis HUD' }),
            state: showAnalysisWidget,
            toggle: toggleAnalysisWidget,
            icon: Sliders
        }
    ];

    return (
        <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
                {t('widgets.title', { defaultValue: 'Widgets' })}
            </h3>
            {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 transition-all cursor-pointer" onClick={item.toggle}>
                    <div className="flex items-center gap-3">
                        <item.icon size={18} className="opacity-50" />
                        <span className="text-sm font-bold">{item.label}</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${item.state ? toggleBgOn : toggleBgOff}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all ${toggleDot} ${item.state ? toggleClassOn : toggleClassOff}`} />
                    </div>
                </div>
            ))}
        </div>
    );
};
export default WidgetSettings;
