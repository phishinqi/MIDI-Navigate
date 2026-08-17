import React, { useState, useRef, useEffect } from 'react';
import useStore from '@/store/useStore';
import { ExportManager } from '@/utils/ExportManager';
import { X, Download, Film, Image as ImageIcon, AlertTriangle } from 'lucide-react';
// @ts-ignore
import { useTranslation } from 'react-i18next';
import CustomSelect from './Common/CustomSelect';

const ExportModal = () => {
    const { t } = useTranslation();
    const { showExportMenu, toggleExportMenu, midiData, p5Instance, threeInstance, renderEngine } = useStore();

    // Audio Source Detection
    const selectedMidiOutput = useStore(state => state.selectedMidiOutput);
    const useInternalAudio = useStore(state => state.useInternalAudio);

    // UI State
    const [mode, setMode] = useState<'video' | 'sequence'>('video');
    const [format, setFormat] = useState<'mp4' | 'webm' | 'hevc'>('mp4'); // Default mp4
    const [resolution, setResolution] = useState<{ w: number, h: number }>({ w: 1920, h: 1080 });
    const [fps, setFps] = useState(60);
    const [bitrate, setBitrate] = useState(8); // Mbps
    const [enableAudio, setEnableAudio] = useState(true);
    const [renderMode, setRenderMode] = useState<'offline' | 'none'>('offline');
    const [transparentBackground, setTransparentBackground] = useState(false);

    // Process State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Detect audio source type
    const hasExternalMidi = selectedMidiOutput && selectedMidiOutput !== 'none';
    const canUseOfflineRender = !hasExternalMidi;

    // Auto-adjust render mode based on audio source
    useEffect(() => {
        if (hasExternalMidi) {
            // External MIDI detected - default to no audio or realtime
            setRenderMode('none');
        } else {
            // Browser audio - can use offline render
            setRenderMode('offline');
        }
    }, [hasExternalMidi]);

    if (!showExportMenu) return null;

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setStatusText(t('export_modal.cancelling', { defaultValue: "Cancelling..." }));
        }
    };

    const handleExport = async () => {
        const rendererInstance = renderEngine === 'three' ? threeInstance : p5Instance;

        if (!midiData || !rendererInstance) {
            setError(`No MIDI data or ${renderEngine === 'three' ? 'Three.js' : 'P5'} Renderer loaded.`);
            return;
        }

        setIsProcessing(true);
        setError(null);
        setProgress(0);
        setStatusText(t('export_modal.initializing', { defaultValue: "Initializing..." }));

        // Create new AbortController
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const options = {
                width: resolution.w,
                height: resolution.h,
                fps: fps,
                bitrate: bitrate * 1000000,
                enableAudio: renderMode !== 'none', // Audio enabled if not 'none'

                renderMode: renderMode, // Pass render mode to ExportManager
                transparentBackground,
                format: format, // Pass format
                signal: abortController.signal
            };

            const onProgress = (p: number, text: string) => {
                setProgress(p);

                // Simple translation mapping or raw text if not found
                if (text.startsWith("Rendering Frame")) {
                    const [current, total] = text.replace("Rendering Frame ", "").split("/");
                    setStatusText(t('export_modal.rendering_video', { current, total, defaultValue: text }));
                } else if (text.startsWith("Saving Frame")) {
                    const [current, total] = text.replace("Saving Frame ", "").split("/");
                    setStatusText(t('export_modal.saving_frame', { current, total, defaultValue: text }));
                } else if (text === "Rendering Audio...") {
                    setStatusText(t('export_modal.rendering_audio', { defaultValue: text }));
                } else if (text === "Zipping...") {
                    setStatusText(t('export_modal.zipping', { defaultValue: text }));
                } else if (text === "Finalizing...") {
                    setStatusText(t('export_modal.finalizing', { defaultValue: text }));
                } else {
                    setStatusText(text);
                }
            };

            if (mode === 'video') {
                await ExportManager.exportVideo(midiData, rendererInstance, options, onProgress);
            } else {
                await ExportManager.exportSequence(midiData, rendererInstance, options, onProgress);
            }

            setStatusText(t('export_modal.complete', { defaultValue: "Export Complete!" }));
            setTimeout(() => {
                setIsProcessing(false);
                toggleExportMenu();
            }, 1000);

        } catch (e: any) {
            console.error(e);
            setError(e.message || t('export_modal.check_console', { defaultValue: "Export Failed" }));
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-[500px] shadow-2xl flex flex-col max-h-[90vh] relative">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Download className="w-5 h-5 text-midi-accent" />
                        {t('export_modal.title', { defaultValue: 'Export' })}
                    </h2>
                    {!isProcessing && (
                        <button onClick={toggleExportMenu} className="text-white/40 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">

                    {/* Mode Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => {
                                setMode('video');
                                setTransparentBackground(false);
                            }}
                            disabled={isProcessing}
                            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${mode === 'video' ? 'bg-midi-accent/10 border-midi-accent text-midi-accent' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}`}
                        >
                            <Film className="w-6 h-6" />
                            <span className="text-sm font-medium">{t('export_modal.video', { defaultValue: 'MP4 Video' })}</span>
                        </button>
                        <button
                            onClick={() => setMode('sequence')}
                            disabled={isProcessing}
                            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${mode === 'sequence' ? 'bg-midi-accent/10 border-midi-accent text-midi-accent' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}`}
                        >
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-sm font-medium">{t('export_modal.sequence', { defaultValue: 'PNG Sequence' })}</span>
                        </button>
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs text-white/40 uppercase tracking-wider">{t('export_modal.resolution', { defaultValue: 'Resolution' })}</label>
                            <CustomSelect
                                disabled={isProcessing}
                                value={`${resolution.w}x${resolution.h}`}
                                onChange={(val) => {
                                    const [w, h] = String(val).split('x').map(Number);
                                    setResolution({ w, h });
                                }}
                                options={[
                                    { value: "1280x720", label: "HD (1280x720)" },
                                    { value: "1920x1080", label: "Full HD (1920x1080)" },
                                    { value: "2560x1440", label: "2K QHD (2560x1440)" },
                                    { value: "3840x2160", label: "4K UHD (3840x2160)" },
                                    { value: "1080x1920", label: "Vertical HD (1080x1920)" },
                                    { value: "1080x1080", label: "Square (1080x1080)" }
                                ]}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {mode === 'video' && (
                                <div className="space-y-2">
                                    <label className="text-xs text-white/40 uppercase tracking-wider">{t('export_modal.format', { defaultValue: 'Format' })}</label>
                                    <CustomSelect
                                        disabled={isProcessing}
                                        value={format}
                                        onChange={(val) => {
                                            setFormat(val as 'mp4' | 'webm' | 'hevc');
                                            // If switching to MP4 (H.264), disable transparency
                                            if (val === 'mp4') setTransparentBackground(false);
                                        }}
                                        options={[
                                            { value: "mp4", label: "MP4 (H.264)" },
                                            { value: "webm", label: "WebM (VP9/VP8)" },
                                            { value: "hevc", label: "MOV / MP4 (HEVC)" },
                                        ]}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs text-white/40 uppercase tracking-wider">{t('export_modal.fps', { defaultValue: 'FPS' })}</label>
                                <CustomSelect
                                    disabled={isProcessing}
                                    value={fps}
                                    onChange={(val) => setFps(Number(val))}
                                    options={[
                                        { value: 24, label: "24 FPS" },
                                        { value: 25, label: "25 FPS" },
                                        { value: 30, label: "30 FPS" },
                                        { value: 48, label: "48 FPS" },
                                        { value: 50, label: "50 FPS" },
                                        { value: 60, label: "60 FPS" },
                                        { value: 120, label: "120 FPS" },
                                        { value: 240, label: "240 FPS" }
                                    ]}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-white/40 uppercase tracking-wider">{t('export_modal.background', { defaultValue: 'Background' })}</label>
                                <label className={`flex items-center gap-3 p-3 rounded border transition-all cursor-pointer ${transparentBackground
                                    ? 'bg-midi-accent/10 border-midi-accent'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    } ${mode === 'video' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={transparentBackground}
                                        onChange={(e) => setTransparentBackground(e.target.checked)}
                                        disabled={isProcessing || mode === 'video'}
                                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-midi-accent focus:ring-midi-accent focus:ring-offset-0"
                                    />
                                    <span className="text-sm font-medium text-white">
                                        {t('export_modal.transparent_bg', { defaultValue: 'Transparent Background' })}
                                    </span>
                                </label>
                                {mode === 'video' && (
                                    <p className="text-[10px] text-white/40 px-1">
                                        {t('export_modal.video_transparency_hint', { defaultValue: '视频模式暂不支持透明导出，请使用序列帧模式' })}
                                    </p>
                                )}
                            </div>

                            {mode === 'video' && (
                                <div className="space-y-2">
                                    <label className="text-xs text-white/40 uppercase tracking-wider">{t('export_modal.bitrate', { defaultValue: 'Bitrate (Mbps)' })}</label>
                                    <input
                                        type="number"
                                        disabled={isProcessing}
                                        value={bitrate}
                                        onChange={(e) => setBitrate(Number(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-midi-accent"
                                        min={1} max={100}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Audio Settings - Smart UI based on audio source */}
                        {mode === 'video' && (
                            <div className="space-y-3">
                                {/* External MIDI Warning */}
                                {hasExternalMidi && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-2">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                            <div className="space-y-1 text-xs">
                                                <p className="text-yellow-300 font-medium">
                                                    {t('export_modal.external_midi_detected', { defaultValue: '检测到外部MIDI设备' })}
                                                </p>
                                                <p className="text-yellow-200/70 leading-relaxed">
                                                    {t('export_modal.external_midi_warning', {
                                                        defaultValue: '外部MIDI音源（如 VirtualMIDISynth）无法使用离线渲染。这是 Web Audio API 的技术限制。'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Render Mode Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs text-white/40 uppercase tracking-wider">
                                        {t('export_modal.audio_mode', { defaultValue: '音频模式' })}
                                    </label>
                                    <div className="space-y-2">
                                        {canUseOfflineRender && (
                                            <label className={`flex items-start gap-3 p-3 rounded border transition-all cursor-pointer ${renderMode === 'offline'
                                                ? 'bg-midi-accent/10 border-midi-accent'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                }`}>
                                                <input
                                                    type="radio"
                                                    name="renderMode"
                                                    value="offline"
                                                    checked={renderMode === 'offline'}
                                                    onChange={() => setRenderMode('offline')}
                                                    disabled={isProcessing}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-white">
                                                        {t('export_modal.offline_render', { defaultValue: '离线渲染（推荐）' })}
                                                    </div>
                                                    <div className="text-xs text-white/50 mt-0.5">
                                                        {t('export_modal.offline_render_desc', { defaultValue: '快速渲染，使用浏览器音源' })}
                                                    </div>
                                                </div>
                                            </label>
                                        )}
                                        <label className={`flex items-start gap-3 p-3 rounded border transition-all cursor-pointer ${renderMode === 'none'
                                            ? 'bg-midi-accent/10 border-midi-accent'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="renderMode"
                                                value="none"
                                                checked={renderMode === 'none'}
                                                onChange={() => setRenderMode('none')}
                                                disabled={isProcessing}
                                                className="mt-0.5"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-white">
                                                    {t('export_modal.no_audio', { defaultValue: '无音频' })}
                                                </div>
                                                <div className="text-xs text-white/50 mt-0.5">
                                                    {t('export_modal.no_audio_desc', { defaultValue: '仅导出视频，稍后添加音频' })}
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status & Error */}
                    {error && (
                        <div className="p-3 bg-red-500/20 text-red-200 text-xs rounded border border-red-500/30">
                            {error}
                        </div>
                    )}

                    {/* Progress Bar */}
                    {isProcessing && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-white/60">
                                <span>{statusText || t('export_modal.processing', { defaultValue: 'Processing' })}</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded overflow-hidden">
                                <div
                                    className="h-full bg-midi-accent transition-all duration-200"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <div className="flex gap-3">
                        {isProcessing && (
                            <button
                                onClick={handleCancel}
                                className="px-4 py-3 rounded-lg font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all"
                            >
                                {t('export_modal.cancel', { defaultValue: 'Cancel' })}
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            disabled={isProcessing}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all ${isProcessing ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-midi-accent text-black hover:brightness-110 shadow-[0_0_20px_rgba(45,212,191,0.2)]'}`}
                        >
                            {isProcessing ? t('export_modal.processing', { defaultValue: 'Processing...' }) : t('export_modal.start', { defaultValue: 'Start Export' })}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ExportModal;
