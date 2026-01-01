// frontend/src/components/UI/SettingsTabs/InterfaceTabSections/AudioIOSettings.jsx
import React from 'react';
import useStore from '@/store/useStore';
import { audioEngine } from '@/audio/AudioEngine';
import { Cable, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AudioIOSettings = () => {
    const { t } = useTranslation();
    const midiOutputs = useStore(state => state.midiOutputs);
    const selectedMidiOutput = useStore(state => state.selectedMidiOutput);
    const setSelectedMidiOutput = useStore(state => state.setSelectedMidiOutput);
    const useInternalAudio = useStore(state => state.useInternalAudio);
    const toggleInternalAudio = useStore(state => state.toggleInternalAudio);

    const handleMidiOutputChange = (e) => {
        const val = e.target.value;
        setSelectedMidiOutput(val);
        audioEngine.selectMidiOutput(val);
    };

    const toggleBgOn = 'bg-midi-accent';
    const toggleBgOff = 'bg-white/10';
    const toggleClassOn = 'left-[18px]';
    const toggleClassOff = 'left-0.5';

    return (
        <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-white/30 font-mono border-b border-white/10 pb-2">
                {t('audio_io.title', { defaultValue: 'Audio & MIDI I/O' })}
            </h3>

            <div className="space-y-3">
                {/* MIDI Output Select */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm font-bold">
                        <div className="flex items-center gap-2">
                            <Cable size={16} />
                            {t('audio_io.midi_output', { defaultValue: 'MIDI Output' })}
                        </div>
                        <span className="font-mono opacity-50 text-[10px]">
                            {midiOutputs.length > 0
                                ? t('audio_io.status.active', { defaultValue: 'Active' })
                                : t('audio_io.status.no_devices', { defaultValue: 'No Devices' })}
                        </span>
                    </div>

                    <select
                        value={selectedMidiOutput || 'none'}
                        onChange={handleMidiOutputChange}
                        className="w-full bg-black/20 border border-white/10 rounded p-2 text-sm focus:outline-none focus:border-midi-accent"
                    >
                        <option value="none">
                            {t('audio_io.browser_only', { defaultValue: '-- Use Browser Audio Only --' })}
                        </option>
                        {midiOutputs.map(out => (
                            <option key={out.name} value={out.name}>{out.name}</option>
                        ))}
                    </select>
                </div>

                {/* Internal Synth Toggle */}
                <div className="flex items-center justify-between p-2 rounded border border-white/5 bg-white/5">
                    <div className="flex items-center gap-2 text-sm opacity-80">
                        {useInternalAudio ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        <span>{t('audio_io.internal_synth', { defaultValue: 'Browser Internal Synth' })}</span>
                    </div>
                    <div
                        onClick={toggleInternalAudio}
                        className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${useInternalAudio ? toggleBgOn : toggleBgOff}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all bg-white ${useInternalAudio ? toggleClassOn : toggleClassOff}`} />
                    </div>
                </div>
            </div>
        </div>
    );
};
export default AudioIOSettings;
