import React from 'react';
import useStore from '@/store/useStore';
import { getAudioEngine } from '@/audio/AudioEngine';
import { Cable, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CustomSelect from '../Common/CustomSelect';

const AudioTab = () => {
    const { t } = useTranslation();
    const midiOutputs = useStore(state => state.midiOutputs);
    const selectedMidiOutput = useStore(state => state.selectedMidiOutput);
    const setSelectedMidiOutput = useStore(state => state.setSelectedMidiOutput);
    const useInternalAudio = useStore(state => state.useInternalAudio);
    const toggleInternalAudio = useStore(state => state.toggleInternalAudio);
    const isSoundFontLoaded = useStore(state => state.isSoundFontLoaded);
    const isUploadingSoundFont = useStore(state => state.isUploadingSoundFont);
    const uploadProgress = useStore(state => state.uploadProgress);

    const toggleBgOn = 'bg-midi-accent';
    const toggleBgOff = 'bg-white/10';
    const toggleClassOn = 'left-[18px]';
    const toggleClassOff = 'left-0.5';

    return (
        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
            {/* Header */}
            <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest text-white/30 font-sans tabular-nums border-b border-white/10 pb-2">
                    {t('audio_io.title', { defaultValue: 'Audio & MIDI I/O' })}
                </h3>
            </div>


            <div className="space-y-6">
                {/* MIDI Output Select */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm font-bold">
                        <div className="flex items-center gap-2">
                            <Cable size={16} />
                            {t('audio_io.midi_output', { defaultValue: 'MIDI Output' })}
                        </div>
                        <span className="font-sans tabular-nums opacity-50 text-[10px]">
                            {midiOutputs.length > 0
                                ? t('audio_io.status.active', { defaultValue: 'Active' })
                                : t('audio_io.status.no_devices', { defaultValue: 'No Devices' })}
                        </span>
                    </div>

                    <CustomSelect
                        value={selectedMidiOutput || 'none'}
                        onChange={(val) => {
                            setSelectedMidiOutput(val);
                            getAudioEngine().selectMidiOutput(val);
                        }}
                        options={[
                            { value: 'none', label: t('audio_io.browser_only', { defaultValue: '-- Use Browser Audio Only --' }) },
                            ...midiOutputs.map((out: any) => ({ value: out.name, label: out.name }))
                        ]}
                    />
                </div>

                {/* Internal Synth Toggle */}
                <div className="flex items-center justify-between p-3 rounded border border-white/5 bg-white/5">
                    <div className="flex items-center gap-2 text-sm opacity-80">
                        {useInternalAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        <span>{t('audio_io.internal_synth', { defaultValue: 'Browser Internal Synth' })}</span>
                    </div>
                    <div
                        onClick={toggleInternalAudio}
                        className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${useInternalAudio ? toggleBgOn : toggleBgOff}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all bg-white ${useInternalAudio ? toggleClassOn : toggleClassOff}`} />
                    </div>
                </div>

                {/* SoundFont Settings */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex justify-between text-sm font-bold">
                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-widest text-white/50">{t('audio_io.sound_source', { defaultValue: 'Sound Source (SF2)' })}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {isUploadingSoundFont ? (
                            <div className="space-y-2 p-3 rounded bg-white/5 border border-white/10 animate-pulse">
                                <div className="flex justify-between text-xs text-white/70">
                                    <span>
                                        {uploadProgress >= 100
                                            ? t('audio_io.processing', { defaultValue: 'Processing SoundFont...' })
                                            : t('audio_io.uploading', { defaultValue: 'Uploading SF2...' })
                                        }
                                    </span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ease-out ${uploadProgress >= 100 ? 'bg-green-400' : 'bg-midi-accent'}`}
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                {uploadProgress >= 100 && (
                                    <div className="text-[10px] text-white/30 text-center pt-1">
                                        {t('audio_io.large_file_wait', { defaultValue: 'Large files may take a moment to parse.' })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="text-xs text-white/40">
                                    {t('audio_io.upload_help', { defaultValue: 'Upload a .sf2 file to replace default sounds. Large files may take time to load.' })}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <label className="flex-1 flex items-center justify-center p-3 rounded bg-black/20 border border-white/10 hover:bg-white/5 cursor-pointer text-sm transition-colors">
                                        <span>{isSoundFontLoaded ? t('audio_io.change_file', { defaultValue: 'Change SF2 File (Loaded)' }) : t('audio_io.load_file', { defaultValue: 'Load .sf2 File' })}</span>
                                        <input
                                            type="file"
                                            accept=".sf2"
                                            className="hidden"
                                            disabled={isUploadingSoundFont}
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    useStore.getState().loadSoundFont(e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </label>
                                    {isSoundFontLoaded && (
                                        <button
                                            onClick={() => useStore.getState().resetSoundFont()}
                                            className="px-4 py-3 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-sm hover:bg-red-500/30 transition-colors"
                                        >
                                            {t('audio_io.reset', { defaultValue: 'Reset' })}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioTab;
