import React from 'react';
import useStore from '@/store/useStore';
import { Grid, Box, Monitor, Sparkles, Shapes, Activity } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { useTranslation } from 'react-i18next';

const GridTab = () => {
    const { t } = useTranslation();
    const percussionSettings = useStore(state => state.percussionSettings);
    const setPercussionSettings = useStore(state => state.setPercussionSettings);
    const renderEngine = useStore(state => state.renderEngine);

    if (!percussionSettings) return null;

    return (
        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono">
                        {t('grid.title', { defaultValue: 'Percussion Grid' })}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-mono opacity-50">
                        {renderEngine === 'three' ? <Box size={12} /> : <Monitor size={12} />}
                        <span>
                            {renderEngine === 'three'
                                ? t('grid.mode_three', { defaultValue: 'Three.js Mode' })
                                : t('grid.mode_p5', { defaultValue: 'P5.js Mode' })}
                        </span>
                    </div>
                </div>

                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-3">
                        <Grid size={18} className="opacity-50" />
                        <span className="text-sm font-bold">{t('grid.enable', { defaultValue: 'Enable Grid' })}</span>
                    </div>
                    <Switch.Root className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${percussionSettings.enabled ? 'bg-midi-accent' : 'bg-white/10'}`} checked={percussionSettings.enabled} onCheckedChange={(c) => setPercussionSettings({ enabled: c })}><Switch.Thumb className={`block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 will-change-transform ${percussionSettings.enabled ? 'translate-x-5' : 'translate-x-1'}`} /></Switch.Root>
                </div>

                {/* Shared Layout */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-white/70">
                            <span>{t('grid.rows', { defaultValue: 'Rows' })}</span>
                            <span className="font-mono text-midi-accent">{percussionSettings.rows}</span>
                        </div>
                        <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[percussionSettings.rows]} min={1} max={16} step={1} onValueChange={(v) => setPercussionSettings({ rows: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-white/70">
                            <span>{t('grid.cols', { defaultValue: 'Columns' })}</span>
                            <span className="font-mono text-midi-accent">{percussionSettings.cols}</span>
                        </div>
                        <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[percussionSettings.cols]} min={1} max={32} step={1} onValueChange={(v) => setPercussionSettings({ cols: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                    </div>
                </div>

                {/* Engine Specific Controls */}
                <div className="space-y-4 pt-4 border-t border-white/5">

                    {/* Three.js Settings */}
                    {renderEngine === 'three' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-white/70">
                                    <span>{t('grid.cell_size_world', { defaultValue: 'Cell Size (World Units)' })}</span>
                                    <span className="font-mono">{percussionSettings.cellSize}</span>
                                </div>
                                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[percussionSettings.cellSize]} min={0.5} max={3.0} step={0.1} onValueChange={(v) => setPercussionSettings({ cellSize: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-white/70">
                                    <span>{t('grid.position_y', { defaultValue: 'Vertical Y' })}</span>
                                    <span className="font-mono">{percussionSettings.positionY}</span>
                                </div>
                                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[percussionSettings.positionY]} min={-15} max={10} step={0.5} onValueChange={(v) => setPercussionSettings({ positionY: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                            </div>
                        </div>
                    )}

                    {/* P5.js Settings */}
                    {renderEngine === 'p5' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div className="p-3 bg-white/5 border border-white/10 rounded text-xs text-white/50 mb-2 flex items-center gap-2">
                                <Monitor size={14} />
                                <span>{t('grid.p5_settings_title', { defaultValue: 'P5 Renderer Settings' })}</span>
                            </div>

                            {/* Visual Style Selector */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-white/70">
                                    <span>{t('grid.visual_style', { defaultValue: 'Visual Style' })}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {/* Style 1: Geometric */}
                                    <button
                                        onClick={() => setPercussionSettings({ p5Style: 'geometry' })}
                                        className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${(percussionSettings.p5Style === 'geometry' || !percussionSettings.p5Style)
                                                ? 'bg-midi-accent text-black border-midi-accent'
                                                : 'bg-white/5 text-white/50 border-transparent hover:bg-white/10'
                                            }`}
                                    >
                                        <Shapes size={16} className="mb-1" />
                                        <span className="text-[9px] uppercase">{t('grid.styles.geometric', { defaultValue: 'Geometric' })}</span>
                                    </button>

                                    {/* Style 2: Energy */}
                                    <button
                                        onClick={() => setPercussionSettings({ p5Style: 'energy' })}
                                        className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${percussionSettings.p5Style === 'energy'
                                                ? 'bg-midi-accent text-black border-midi-accent'
                                                : 'bg-white/5 text-white/50 border-transparent hover:bg-white/10'
                                            }`}
                                    >
                                        <Sparkles size={16} className="mb-1" />
                                        <span className="text-[9px] uppercase">{t('grid.styles.energy', { defaultValue: 'Energy' })}</span>
                                    </button>

                                    {/* Style 3: Blueprint / Monochrome */}
                                    <button
                                        onClick={() => setPercussionSettings({ p5Style: 'monochrome' })}
                                        className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${percussionSettings.p5Style === 'monochrome'
                                                ? 'bg-midi-accent text-black border-midi-accent'
                                                : 'bg-white/5 text-white/50 border-transparent hover:bg-white/10'
                                            }`}
                                    >
                                        <Activity size={16} className="mb-1" />
                                        <span className="text-[9px] uppercase">{t('grid.styles.blueprint', { defaultValue: 'Blueprint' })}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-white/70">
                                    <span>{t('grid.cell_size_px', { defaultValue: 'Cell Size (px)' })}</span>
                                    <span className="font-mono">{percussionSettings.p5CellSize}px</span>
                                </div>
                                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[percussionSettings.p5CellSize || 40]} min={20} max={100} step={5} onValueChange={(v) => setPercussionSettings({ p5CellSize: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-white/70">
                                    <span>{t('grid.spacing_px', { defaultValue: 'Spacing (px)' })}</span>
                                    <span className="font-mono">{percussionSettings.p5Spacing}px</span>
                                </div>
                                <Slider.Root className="relative flex items-center select-none touch-none w-full h-4" value={[percussionSettings.p5Spacing || 10]} min={0} max={50} step={2} onValueChange={(v) => setPercussionSettings({ p5Spacing: v[0] })}><Slider.Track className="bg-white/10 relative grow rounded-full h-[3px]"><Slider.Range className="absolute bg-midi-accent h-full rounded-full" /></Slider.Track><Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none" /></Slider.Root>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default GridTab;
