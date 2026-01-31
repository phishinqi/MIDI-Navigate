import React from 'react';
import useStore from '@/store/useStore';
import { MoveHorizontal, MoveVertical, ArrowRightLeft, Video, ScanLine, GripVertical, MousePointer2, Activity, Waves } from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import * as Slider from '@radix-ui/react-slider';
import { useTranslation } from 'react-i18next'; // 1. 引入

const ThreeJsSettings = () => {
    const { t } = useTranslation(); // 2. 初始化
    const viewSettings = useStore(state => state.viewSettings);
    const setViewSettings = useStore(state => state.setViewSettings);

    const toggleBgOn = 'bg-midi-accent';
    const toggleBgOff = 'bg-white/10';
    const toggleDot = 'bg-white shadow-sm';
    const toggleClassOn = 'left-[18px]';
    const toggleClassOff = 'left-0.5';

    // 定义选项列表，包含翻译 Key
    const toggleOptions = [
        { key: 'follow_playhead', def: 'Follow Playhead', stateKey: 'followCursor', icon: Video },
        { key: 'show_playhead', def: 'Show Playhead', stateKey: 'showPlayhead', icon: ScanLine },
        { key: 'show_bar_lines', def: 'Show Bar Lines', stateKey: 'showBarLines', icon: GripVertical },
        { key: 'click_to_seek', def: 'Click to Seek', stateKey: 'enableClickToSeek', icon: MousePointer2 }
    ];

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-sans tabular-nums border-b border-white/10 pb-2">
                {t('three_settings.title', { defaultValue: 'Viewport (Three.js)' })}
            </h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="flex items-center gap-1 opacity-60">
                            <MoveHorizontal size={12} />
                            {t('three_settings.time_scale', { defaultValue: 'Time Scale' })}
                        </span>
                        <span className="font-sans tabular-nums">{viewSettings.zoomX}x</span>
                    </div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.zoomX]} min={10} max={200} step={5} onValueChange={(v) => setViewSettings({ zoomX: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="flex items-center gap-1 opacity-60">
                            <MoveVertical size={12} />
                            {t('three_settings.vertical_zoom', { defaultValue: 'Vertical Zoom' })}
                        </span>
                        <span className="font-sans tabular-nums">{viewSettings.zoomY}x</span>
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
                    <span className="font-sans tabular-nums">{Math.round((viewSettings.playheadOffset || 0.2) * 100)}%</span>
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
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${toggleDot} ${viewSettings[opt.stateKey] !== false ? toggleClassOn : toggleClassOff}`} />
                        </div>
                    </div>
                ))}
            </div>


            {/* Screen Shake (Global) */}
            <div className="pt-2 border-t border-white/5 mt-3 space-y-2">
                <div className="flex justify-between text-[10px] font-bold mb-2">
                    <span className="flex items-center gap-1 opacity-80">
                        <Waves size={14} />
                        {t('three_settings.screen_shake.title', { defaultValue: 'Screen Shake' })}
                    </span>
                    <Switch.Root
                        className={`w-8 h-4 rounded-full relative transition-colors ${viewSettings.jitter?.enabled ? 'bg-midi-accent' : 'bg-white/10'}`}
                        checked={viewSettings.jitter?.enabled || false}
                        onCheckedChange={(c) => setViewSettings({ jitter: { ...viewSettings.jitter, enabled: c } })}
                    >
                        <Switch.Thumb className={`block w-3 h-3 bg-white rounded-full shadow transition-transform translate-x-0.5 ${viewSettings.jitter?.enabled ? 'translate-x-[18px]' : ''}`} />
                    </Switch.Root>
                </div>

                {viewSettings.jitter?.enabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* 算法模式选择 */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.screen_shake.mode', { defaultValue: 'Algorithm Mode' })}</span>
                            </div>
                            <div className="flex bg-black/20 p-1 rounded-lg gap-1">
                                <button
                                    className={`flex-1 flex items-center justify-center px-2 py-1.5 text-[10px] font-bold rounded-md transition-all whitespace-nowrap ${(viewSettings.jitter?.mode || 'emotion') === 'emotion'
                                            ? 'bg-white text-black shadow-sm'
                                            : 'text-zinc-400 hover:text-white'
                                        }`}
                                    onClick={() => setViewSettings({ jitter: { ...viewSettings.jitter, mode: 'emotion' } })}
                                >
                                    <Activity className="w-3 h-3 mr-1.5" />
                                    {t('three_settings.screen_shake.mode_emotion', { defaultValue: 'Emotion' })}
                                </button>
                                <button
                                    className={`flex-1 flex items-center justify-center px-2 py-1.5 text-[10px] font-bold rounded-md transition-all whitespace-nowrap ${viewSettings.jitter?.mode === 'density'
                                            ? 'bg-white text-black shadow-sm'
                                            : 'text-zinc-400 hover:text-white'
                                        }`}
                                    onClick={() => setViewSettings({ jitter: { ...viewSettings.jitter, mode: 'density' } })}
                                >
                                    <Waves className="w-3 h-3 mr-1.5" />
                                    {t('three_settings.screen_shake.mode_density', { defaultValue: 'Density' })}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.screen_shake.threshold', { defaultValue: 'Note Threshold' })}</span>
                                <span className="font-sans tabular-nums">{viewSettings.jitter?.threshold || 10}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.jitter?.threshold || 10]} min={1} max={50} step={1} onValueChange={(v) => setViewSettings({ jitter: { ...viewSettings.jitter, threshold: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.screen_shake.intensity', { defaultValue: 'Intensity' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.jitter?.intensity || 0.5).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.jitter?.intensity || 0.5]} min={0} max={2} step={0.05} onValueChange={(v) => setViewSettings({ jitter: { ...viewSettings.jitter, intensity: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.screen_shake.speed', { defaultValue: 'Frequency' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.jitter?.speed || 0.5).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.jitter?.speed || 0.5]} min={0} max={2} step={0.05} onValueChange={(v) => setViewSettings({ jitter: { ...viewSettings.jitter, speed: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.screen_shake.decay', { defaultValue: 'Decay' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.jitter?.decay || 0).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.jitter?.decay || 0]} min={0} max={1} step={0.05} onValueChange={(v) => setViewSettings({ jitter: { ...viewSettings.jitter, decay: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.screen_shake.axis_spread', { defaultValue: 'Axis Spread' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.jitter?.axisSpread || 0).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.jitter?.axisSpread || 0]} min={0} max={1} step={0.05} onValueChange={(v) => setViewSettings({ jitter: { ...viewSettings.jitter, axisSpread: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.screen_shake.smoothness', { defaultValue: 'Smoothness' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.jitter?.smoothness !== undefined ? viewSettings.jitter.smoothness : 1).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.jitter?.smoothness !== undefined ? viewSettings.jitter.smoothness : 1]} min={0} max={1} step={0.05} onValueChange={(v) => setViewSettings({ jitter: { ...viewSettings.jitter, smoothness: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>
                    </div>
                )}
            </div>

            {/* Note Bounce (Active) */}
            <div className="pt-2 border-t border-white/5 mt-3 space-y-2">
                <div className="flex justify-between text-[10px] font-bold mb-2">
                    <span className="flex items-center gap-1 opacity-80">
                        <Activity size={14} />
                        {t('three_settings.note_bounce.title', { defaultValue: 'Note Bounce' })}
                    </span>
                    <Switch.Root
                        className={`w-8 h-4 rounded-full relative transition-colors ${viewSettings.bounce?.enabled ? 'bg-midi-accent' : 'bg-white/10'}`}
                        checked={viewSettings.bounce?.enabled || false}
                        onCheckedChange={(c) => setViewSettings({ bounce: { ...viewSettings.bounce, enabled: c } })}
                    >
                        <Switch.Thumb className={`block w-3 h-3 bg-white rounded-full shadow transition-transform translate-x-0.5 ${viewSettings.bounce?.enabled ? 'translate-x-[18px]' : ''}`} />
                    </Switch.Root>
                </div>

                {viewSettings.bounce?.enabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.note_bounce.intensity', { defaultValue: 'Intensity' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.bounce?.intensity || 0.5).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.bounce?.intensity || 0.5]} min={0} max={2} step={0.05} onValueChange={(v) => setViewSettings({ bounce: { ...viewSettings.bounce, intensity: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.note_bounce.speed', { defaultValue: 'Frequency' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.bounce?.speed || 0.5).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.bounce?.speed || 0.5]} min={0} max={2} step={0.05} onValueChange={(v) => setViewSettings({ bounce: { ...viewSettings.bounce, speed: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.note_bounce.decay', { defaultValue: 'Decay' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.bounce?.decay || 0).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.bounce?.decay || 0]} min={0} max={1} step={0.05} onValueChange={(v) => setViewSettings({ bounce: { ...viewSettings.bounce, decay: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.note_bounce.axis_spread', { defaultValue: 'Axis Spread' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.bounce?.axisSpread || 0).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.bounce?.axisSpread || 0]} min={0} max={1} step={0.05} onValueChange={(v) => setViewSettings({ bounce: { ...viewSettings.bounce, axisSpread: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span className="opacity-60">{t('three_settings.note_bounce.smoothness', { defaultValue: 'Smoothness' })}</span>
                                <span className="font-sans tabular-nums">{(viewSettings.bounce?.smoothness !== undefined ? viewSettings.bounce.smoothness : 1).toFixed(2)}</span>
                            </div>
                            <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[viewSettings.bounce?.smoothness !== undefined ? viewSettings.bounce.smoothness : 1]} min={0} max={1} step={0.05} onValueChange={(v) => setViewSettings({ bounce: { ...viewSettings.bounce, smoothness: v[0] } })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default ThreeJsSettings;
