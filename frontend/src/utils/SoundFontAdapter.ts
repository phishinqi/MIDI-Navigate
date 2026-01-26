
import { SoundFont2 } from 'soundfont2';
import * as Tone from 'tone';

// Helper to convert MIDI note number to Note Name (e.g. 60 -> C4)
const midiToNoteName = (midi: number): string => {
    return Tone.Frequency(midi, "midi").toNote();
};

export class SoundFontAdapter {
    static sf: SoundFont2 | null = null;
    static cachedBuffers: Map<string, AudioBuffer> = new Map(); // key: "sampleName_originalPitch"

    static async load(arrayBuffer: ArrayBuffer) {
        try {
            // soundfont2 expects Uint8Array
            this.sf = new SoundFont2(new Uint8Array(arrayBuffer));
            console.log("SF2 Loaded", this.sf);
            this.cachedBuffers.clear();
            return true;
        } catch (e) {
            console.error("Failed to load SF2", e);
            return false;
        }
    }

    // Helper to decode Int16 to Float32 AudioBuffer
    private static getAudioBuffer(sample: any, context: any): AudioBuffer {
        const dataInt16 = sample.data; // Int16Array
        const float32 = new Float32Array(dataInt16.length);
        for (let i = 0; i < dataInt16.length; i++) {
            // Convert Int16 to Float32 (-1.0 to 1.0)
            float32[i] = dataInt16[i] / 32768.0;
        }

        // Use standard AudioBuffer constructor if available for context independence
        try {
            const buffer = new AudioBuffer({
                length: float32.length,
                sampleRate: sample.header.sampleRate,
                numberOfChannels: 1
            });
            buffer.copyToChannel(float32, 0);
            return buffer;
        } catch (e) {
            // Fallback to context
            const buffer = context.createBuffer(1, float32.length, sample.header.sampleRate);
            buffer.getChannelData(0).set(float32);
            return buffer;
        }
    }

    /**
     * Returns options for Tone.Sampler
     * @param program MIDI Program Number (0-127)
     * @param isPercussion Whether this is a drum track (Bank 128)
     * @param context AudioContext (usually Tone.context, or OfflineContext)
     * @param notesOptional Optional array of MIDI notes to optimize loading
     */
    static getSamplerOptions(program: number, isPercussion: boolean, context: any = Tone.context, notesOptional?: number[]): Partial<Tone.SamplerOptions> {
        if (!this.sf) return {};

        const urls: Record<string, AudioBuffer> = {};
        const notesToCheck = notesOptional || Array.from({ length: 128 }, (_, i) => i);

        // Bank Selection:
        // Melodic: Bank 0 (Default)
        // Percussion: Bank 128
        const bank = isPercussion ? 128 : 0;

        const processedRoots = new Set<string>();

        for (const note of notesToCheck) {
            // bank 0 for standard, 128 for drums.
            const keyData = this.sf.getKeyData(note, bank, program);

            if (keyData && keyData.sample) {
                // Determine Root Key (Original Pitch)
                let rootKey = keyData.sample.header.originalPitch;

                // Check for OverridingRootKey (Generator ID 58)
                // keyData.generators is likely a plain object or map? 
                // typings say ZoneMap<Generator>. ZoneMap is likely an object where keys are Generator IDs (numbers)
                // Let's check safely.

                // Note: soundfont2 ZoneMap implementation details:
                // It seems to be an object where keys are generator IDs.
                // We cast to any to safely access numeric keys.
                const gens = keyData.generators as any;

                if (gens && gens[58]) { // OverridingRootKey
                    const val = gens[58].value;
                    // value -1 means use originalPitch
                    if (val !== undefined && val !== -1) {
                        rootKey = val;
                    }
                }

                // Check for CoarseTune (51) - Semitone offset
                // Note: This shifts the PITCH of the sample. 
                // Tone.Sampler maps "Note" -> "Buffer".
                // If Coarse Tune is +12, the sample sounds an octave higher than recorded.
                // So effectively, its "Root Key" (the note it sounds like) is Original + 12.
                // We should adjusting rootKey accordingly so Tone plays it at correct pitch for the mapped note.
                // Wait. 
                // If sample is C3. Coarse Tune +12. It sounds like C4.
                // We map C4 -> Buffer. (rootKey = 60).
                // When we play C4, Tone plays Buffer (C3 pitched up 12? No, Tone plays Buffer at rate 1).
                // Buffer is raw C3. Tone playing at rate 1 sounds like C3. 
                // ERROR: We need to tell Tone that this buffer IS C3, but we map it to C4?
                // No.
                // If "Root Key" is 60 (C4). We map "C4": Buffer.
                // Tone.Sampler assumes the Buffer *IS* C4.
                // If the Buffer is actually C3 (OriginalPitch=48), but the Instrument has CoarseTune=+12...
                // The Buffer contains a C3 sound.
                // We want to map it such that when we play C4, it plays C3+12.
                // If we map "C3": Buffer.
                // Play C4 -> Tone shifts C3 up 12 semitones -> Sounds like C4. Correct.

                // So `rootKey` for Tone.Sampler URL map must be the **Pitch of the Audio Buffer itself** (OriginalPitch).
                // The `CoarseTune` generator doesn't change the Buffer file. It changes how the synth SHOULD play it.
                // But Tone.Sampler URL map is { "Note_Note_Buffer_Is_At": Buffer }.
                // Tone automatically calculates playback rate: `rate = interval(urlNote, triggeredNote)`.

                // If SF2 says: Sample is 60. Generator says CoarseTune +12.
                // This means when I press key 60, play sample 60 + 12 semitones.
                // Wait, CoarseTune usually means "Shift the headers pitch".
                // If I press 60. standard is play 60. +12 means play 72.
                // Sample 60 played as 72 sounds like 72.

                // This is equivalent to saying the Sample's "Base Pitch" is effectively 60-12 = 48?
                // If I map "C3" (48) -> Buffer (60).
                // Play 60 (C4). Tone shifts C3 -> C4 (+12). Buffer (60) shifted +12 sounds like 72. Correct.
                // So, effectiveRootKey = originalPitch - coarseTune.

                // Let's apply CoarseTune (51) and FineTune (52).
                let coarseTune = 0;
                if (gens && gens[51]) coarseTune = gens[51].value || 0;

                // Calculate Effective Root Key for Tone.Sampler
                // This is the note that, when played at rate=1, matches the buffer's sound.
                // Since Buffer is static, its pitch is `originalPitch`.
                // However, we want to capture the `adjustment`.
                // Tone.Sampler logic: Play(Note). Look up nearest Buffer(Base). Rate = distance(Base, Note).
                // We want Play(Note) -> Play Buffer + CoarseTune.
                // Rate should be `distance(Base, Note) + CoarseTune`.
                // Tone doesn't support adding offset. It only supports `distance`.
                // dist = Note - Base.
                // We want dist_effective = (Note - Base) + CoarseTune.
                // (Note - Base) + CoarseTune = Note - (Base - CoarseTune).
                // So EffectiveBase = Base - CoarseTune.

                // Example: Sample = 60. Tune = +12.
                // Press 60. Want sound 72.
                // Sampler plays Rate(60, Base).
                // Rate should match +12 semitones.
                // 60 - Base = 12 => Base = 48.
                // So EffectiveBase = 60 - 12 = 48.

                rootKey = rootKey - coarseTune;

                // Cache Key (Name + Root + Start) - Use OriginalPitch for caching to avoid duplication logic errors
                const cacheKey = `${keyData.sample.header.name}_${keyData.sample.header.originalPitch}_${keyData.sample.header.start}`;

                if (!this.cachedBuffers.has(cacheKey)) {
                    const buffer = this.getAudioBuffer(keyData.sample, context);
                    this.cachedBuffers.set(cacheKey, buffer);
                }
                const buffer = this.cachedBuffers.get(cacheKey)!;

                if (isPercussion) {
                    // Drums: Map specific note to buffer
                    const mapNoteName = midiToNoteName(note);
                    urls[mapNoteName] = buffer;
                } else {
                    // Melodic: Map ROOT key to buffer (Tone.js handles pitch shifting)
                    const rootNoteName = midiToNoteName(rootKey);
                    urls[rootNoteName] = buffer;
                }

                processedRoots.add(note + "_" + rootKey);
            }
        }

        // Fallback or empty checked by caller
        return {
            urls,
            baseUrl: ""
        };
    }
}
