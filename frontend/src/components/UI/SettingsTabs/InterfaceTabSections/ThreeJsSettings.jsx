// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/ThreeJsSettings.jsx
import React from 'react';
import useStore from '@/store/useStore';
import { MoveHorizontal, MoveVertical, ArrowRightLeft, Video, ScanLine, GripVertical, MousePointer2 } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { useTranslation } from 'react-i18next';

const ThreeJsSettings = () => {
    const { t } = useTranslation();
    const viewSettings = useStore(state => state.viewSettings);
    const setViewSettings = useStore(state => state.setViewSettings);

    const toggleBgOn = 'bg-midi-accent';
    const toggleBgOff = 'bg-white/10';
    const toggleDot = 'bg-white shadow-sm';
    const toggleClassOn = 'left-[18px]';
    const toggleClassOff = 'left-0.5';

    const toggleOptions = [
        { key: 'follow_playhead', def: 'Follow Playhead', stateKey: 'followCursor', icon: Video },
        { key: 'show_playhead', def: 'Show Playhead', stateKey: 'showPlayhead', icon: ScanLine },
        { key: 'show_bar_lines', def: 'Show Bar Lines', stateKey: 'showBarLines', icon: GripVertical },
        { key: 'click_to_seek', def: 'Click to Seek', stateKey: 'enableClickToSeek', icon: MousePointer2 }
    ];

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
                {t('three_settings.title', { defaultValue: 'Viewport (Three.js)' })}
            </h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="flex items-center gap-1 opacity-60">
                            <MoveHorizontal size={12} />
                            {t('three_settings.time_scale', { defaultValue: 'Time Scale' })}
                        </span>
                        <span className="font-mono">{viewSettings.zoomX}x</span>
                    </div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.zoomX]} min={10} max={200} step={5} onValueChange={(v) => setViewSettings({ zoomX: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="flex items-center gap-1 opacity-60">
                            <MoveVertical size={12} />
                            {t('three_settings.vertical_zoom', { defaultValue: 'Vertical Zoom' })}
                        </span>
                        <span className="font-mono">{viewSettings.zoomY}x</span>
                    </div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.zoomY]} min={0.5} max={3.0} step={0.1} onValueChange={(v) => setViewSettings({ zoomY: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold">
                    <span className="flex items-center gap-1 opacity-60">
                        <ArrowRightLeft size={12} />
                        {t('three_settings.playhead_position', { defaultValue: 'Playhead Position' })}
                    </span>
                    <span className="font-mono">{Math.round((viewSettings.playheadOffset || 0.2) * 100)}%</span>
                </div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.playheadOffset || 0.2]} min={0.1} max={0.9} step={0.05} onValueChange={(v) => setViewSettings({ playheadOffset: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
            </div>

            <div className="flex flex-col gap-2 bg-white/5 p-2 rounded-lg">
                {toggleOptions.map(opt => (
                    <div key={opt.stateKey} className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors cursor-pointer" onClick={() => setViewSettings({ [opt.stateKey]: !viewSettings[opt.stateKey] })}>
                        <div className="flex items-center gap-2 opacity-80">
                            <opt.icon size={14} />
                            <span className="text-xs font-bold">
                                {t(`three_settings.toggles.${opt.key}`, { defaultValue: opt.def })}
                            </span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${viewSettings[opt.stateKey] !== false ? toggleBgOn : toggleBgOff}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all ${toggleDot} ${viewSettings[opt.stateKey] !== false ? toggleClassOn : toggleClassOff}`} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default ThreeJsSettings;
