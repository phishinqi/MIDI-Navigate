import React from 'react';
import useStore from '@/store/useStore';
import { ScanLine, Wind, Star, BrainCircuit, Hourglass, Timer, Maximize, ArrowUpDown, Scaling, AlignJustify, ArrowRight, Grid3X3, ArrowRightToLine, Ruler } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import BezierCurveEditor from '../../Common/BezierCurveEditor';
import { useTranslation } from 'react-i18next';

const P5JsSettings = () => {
    const { t } = useTranslation();
    const { p5Settings, setP5Settings, addP5CurvePreset, removeP5CurvePreset, applyP5CurvePreset } = useStore(state => ({
        p5Settings: state.p5Settings,
        setP5Settings: state.setP5Settings,
        addP5CurvePreset: state.addP5CurvePreset,
        removeP5CurvePreset: state.removeP5CurvePreset,
        applyP5CurvePreset: state.applyP5CurvePreset
    }));

    const currentP5Settings = p5Settings || {
        showCursor: true, showGrid: true, shrinkSpeed: 0.08, noteAreaScale: 0.8, noteAreaOffsetY: 0,
        horizontalZoom: 1.0, noteHeight: 6, pageTurnMode: 'wipe', growCurve: [0.1, 0.85, 0.75, 0.9],
        fadeCurve: [0.42, 0, 1, 1], curvePresets: [], meteorHoldTime: 0.5, meteorFadeTime: 1.5,
        fadeStartRatio: 0.45,
        measuresPerPage: 1
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
                {t('p5_settings.title', { defaultValue: 'Visualization (p5.js)' })}
            </h3>

            <div className="space-y-4 bg-white/5 p-3 rounded-lg">

                {/* 翻页模式选择 */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="flex items-center gap-1 opacity-80"><ArrowRight size={14} />
                            {t('p5_settings.page_turn_mode', { defaultValue: 'Page Turn Mode' })}
                        </span>
                    </div>
                    <div className="flex bg-black/20 rounded p-1 text-[10px] font-bold">
                        <button onClick={() => setP5Settings({ pageTurnMode: 'wipe' })} className={`flex-1 px-3 py-1.5 rounded transition-all flex items-center justify-center gap-1 ${currentP5Settings.pageTurnMode === 'wipe' ? 'bg-midi-accent text-black shadow' : 'text-white/40 hover:text-white'}`}>
                            <ScanLine size={12} /> {t('p5_settings.modes.wipe', { defaultValue: 'Wipe' })}
                        </button>
                        <button onClick={() => setP5Settings({ pageTurnMode: 'fade' })} className={`flex-1 px-3 py-1.5 rounded transition-all flex items-center justify-center gap-1 ${currentP5Settings.pageTurnMode === 'fade' ? 'bg-white text-black shadow' : 'text-white/40 hover:text-white'}`}>
                            <Wind size={12} /> {t('p5_settings.modes.fade', { defaultValue: 'Fade' })}
                        </button>
                        <button onClick={() => setP5Settings({ pageTurnMode: 'meteor' })} className={`flex-1 px-3 py-1.5 rounded transition-all flex items-center justify-center gap-1 ${(currentP5Settings.pageTurnMode === 'meteor' || currentP5Settings.pageTurnMode === 'fade-stagger') ? 'bg-white text-black shadow' : 'text-white/40 hover:text-white'}`}>
                            <Star size={12} /> {t('p5_settings.modes.meteor', { defaultValue: 'Meteor' })}
                        </button>
                    </div>
                </div>

                {/* 每页小节数设置 */}
                <div className="pt-2 border-t border-white/5 mt-3 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="flex items-center gap-1 opacity-80">
                            <Ruler size={14} /> {t('p5_settings.measures_per_page', { defaultValue: 'Bar' })}
                        </span>
                        <span className="font-mono text-midi-accent">
                            {currentP5Settings.measuresPerPage || 1}
                        </span>
                    </div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.measuresPerPage || 1]} min={1} max={8} step={1} onValueChange={(v) => setP5Settings({ measuresPerPage: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                </div>

                {/* 曲线 */}
                <div className="pt-2 border-t border-white/5 mt-3 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold mb-2">
                        <span className="flex items-center gap-1 opacity-80"><BrainCircuit size={14} />
                            {t('p5_settings.note_growth_curve', { defaultValue: 'Note Growth Curve' })}
                        </span>
                    </div>
                    <BezierCurveEditor
                        value={currentP5Settings.growCurve}
                        onChange={(newCurve) => setP5Settings({ growCurve: newCurve })}
                        presets={currentP5Settings.curvePresets}
                        onAddPreset={addP5CurvePreset}
                        onRemovePreset={removeP5CurvePreset}
                        onApplyPreset={applyP5CurvePreset}
                    />
                </div>

                {/* 消失动画设置区域 */}
                {(currentP5Settings.pageTurnMode === 'meteor' || currentP5Settings.pageTurnMode === 'fade') && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200 border-t border-white/10 pt-4 mt-4">

                        {/* Meteor 独有设置 */}
                        {currentP5Settings.pageTurnMode === 'meteor' && (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><Hourglass size={12} /> {t('p5_settings.meteor_hold_time', { defaultValue: 'Meteor Hold Time' })}</span> <span className="font-mono">{(currentP5Settings.meteorHoldTime || 0.5).toFixed(2)}s</span></div>
                                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.meteorHoldTime || 0.5]} min={0.0} max={2.0} step={0.1} onValueChange={(v) => setP5Settings({ meteorHoldTime: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><Timer size={12} /> {t('p5_settings.meteor_fade_time', { defaultValue: 'Meteor Fade Time' })}</span> <span className="font-mono">{(currentP5Settings.meteorFadeTime || 1.5).toFixed(2)}s</span></div>
                                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.meteorFadeTime || 1.5]} min={0.1} max={5.0} step={0.1} onValueChange={(v) => setP5Settings({ meteorFadeTime: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                                </div>
                            </>
                        )}

                        {/* Fade 独有设置 */}
                        {currentP5Settings.pageTurnMode === 'fade' && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold">
                                    <span className="flex items-center gap-1 opacity-60"><ArrowRightToLine size={12} /> {t('p5_settings.shrink_start_point', { defaultValue: 'Shrink Start Point' })}</span>
                                    <span className="font-mono">{Math.round((currentP5Settings.fadeStartRatio !== undefined ? currentP5Settings.fadeStartRatio : 0.45) * 100)}%</span>
                                </div>
                                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.fadeStartRatio !== undefined ? currentP5Settings.fadeStartRatio : 0.45]} min={0.0} max={0.9} step={0.05} onValueChange={(v) => setP5Settings({ fadeStartRatio: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                            </div>
                        )}

                        {/* 共享的曲线编辑器 */}
                        <div className="pt-2 space-y-2">
                            <div className="flex justify-between text-[10px] font-bold mb-2">
                                <span className="flex items-center gap-1 opacity-80"><Star size={14} />
                                    {currentP5Settings.pageTurnMode === 'meteor'
                                        ? t('p5_settings.meteor_fade_curve', { defaultValue: 'Meteor Fade Curve' })
                                        : t('p5_settings.shrink_curve', { defaultValue: 'Shrink Curve' })}
                                </span>
                            </div>
                            <BezierCurveEditor
                                value={currentP5Settings.fadeCurve || [0.42, 0, 1, 1]}
                                onChange={(newCurve) => setP5Settings({ fadeCurve: newCurve })}
                            />
                        </div>
                    </div>
                )}

                {/* 布局设置 (通用) */}
                <div className="pt-2 border-t border-white/5 mt-2 space-y-3">
                    <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><Maximize size={12} /> {t('p5_settings.vertical_scale', { defaultValue: 'Vertical Scale' })}</span> <span className="font-mono">{Math.round((currentP5Settings.noteAreaScale || 0.8) * 100)}%</span></div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.noteAreaScale || 0.8]} min={0.3} max={1.0} step={0.05} onValueChange={(v) => setP5Settings({ noteAreaScale: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>

                    <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><ArrowUpDown size={12} /> {t('p5_settings.vertical_offset', { defaultValue: 'Vertical Offset' })}</span> <span className="font-mono">{currentP5Settings.noteAreaOffsetY || 0}px</span></div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.noteAreaOffsetY || 0]} min={-300} max={300} step={10} onValueChange={(v) => setP5Settings({ noteAreaOffsetY: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>

                    <div className="flex justify-between text-[10px] font-bold mt-4"><span className="flex items-center gap-1 opacity-60"><Scaling size={12} /> {t('p5_settings.horizontal_scale', { defaultValue: 'Horizontal Scale' })}</span> <span className="font-mono">{Math.round((currentP5Settings.horizontalZoom || 1.0) * 100)}%</span></div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.horizontalZoom || 1.0]} min={0.1} max={3.0} step={0.1} onValueChange={(v) => setP5Settings({ horizontalZoom: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>

                    <div className="flex justify-between text-[10px] font-bold"><span className="flex items-center gap-1 opacity-60"><AlignJustify size={12} /> {t('p5_settings.note_thickness', { defaultValue: 'Note Thickness' })}</span> <span className="font-mono">{currentP5Settings.noteHeight || 6}px</span></div>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[currentP5Settings.noteHeight || 6]} min={2} max={20} step={1} onValueChange={(v) => setP5Settings({ noteHeight: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                </div>

                {/* 开关设置 (通用) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-white/5 mt-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 opacity-80"><ScanLine size={14} /><span className="text-xs font-bold">{t('p5_settings.show_playhead', { defaultValue: 'Show Playhead' })}</span></div>
                        <Switch.Root className={`w-8 h-4 rounded-full relative transition-colors ${currentP5Settings.showCursor !== false ? 'bg-midi-accent' : 'bg-white/10'}`} checked={currentP5Settings.showCursor !== false} onCheckedChange={(c) => setP5Settings({ showCursor: c })}><Switch.Thumb className={`block w-3 h-3 bg-white rounded-full shadow transition-transform translate-x-0.5 ${currentP5Settings.showCursor !== false ? 'translate-x-[18px]' : ''}`} /></Switch.Root>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 opacity-80"><Grid3X3 size={14} /><span className="text-xs font-bold">{t('p5_settings.show_background_grid', { defaultValue: 'Show Background Grid' })}</span></div>
                        <Switch.Root className={`w-8 h-4 rounded-full relative transition-colors ${currentP5Settings.showGrid !== false ? 'bg-midi-accent' : 'bg-white/10'}`} checked={currentP5Settings.showGrid !== false} onCheckedChange={(c) => setP5Settings({ showGrid: c })}><Switch.Thumb className={`block w-3 h-3 bg-white rounded-full shadow transition-transform translate-x-0.5 ${currentP5Settings.showGrid !== false ? 'translate-x-[18px]' : ''}`} /></Switch.Root>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default P5JsSettings;
