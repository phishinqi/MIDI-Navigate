import { SoundFont2 } from 'soundfont2';
import * as Tone from 'tone';

// Helper to convert MIDI note number to Note Name (e.g. 60 -> C4)
const midiToNoteName = (midi: number): string => {
    return Tone.Frequency(midi, "midi").toNote();
};

export class SoundFontAdapter {
    static sf: SoundFont2 | null = null;
    static cachedBuffers: Map<string, AudioBuffer> = new Map(); // key: "sampleName_originalPitch"
    static isRemoteMode: boolean = false;
    static remoteBaseUrl: string = "http://localhost:8080/api/v1/sf2";

    static async load(arrayBuffer: ArrayBuffer) {
        console.log(`[SF2Adapter] maintain SF2 load... Buffer size: ${arrayBuffer.byteLength}`);
        this.isRemoteMode = false;
        try {
            // soundfont2 expects Uint8Array
            const uint8 = new Uint8Array(arrayBuffer);
            console.log("[SF2Adapter] Parsing SF2...");
            this.sf = new SoundFont2(uint8);
            console.log("[SF2Adapter] SF2 Parsed:", this.sf);

            if (!this.sf) throw new Error("SF2 parser returned null/undefined");

            this.cachedBuffers.clear();
            console.log("[SF2Adapter] Cache cleared. Ready.");
            return true;
        } catch (e) {
            console.error("[SF2Adapter] Failed to load SF2:", e);
            return false;
        }
    }

    static enableRemoteMode() {
        this.isRemoteMode = true;
        this.sf = null; // Clear local SF structure
        this.cachedBuffers.clear();
        console.log("[SF2Adapter] Remote Mode Enabled");
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
     * Preloads notes from backend for Offline Rendering or Playback.
     */
    static async preloadNotes(notes: number[], program: number, bank: number, context: any = Tone.context): Promise<void> {
        if (!this.isRemoteMode) return;

        console.log(`[SF2Adapter] Preloading ${notes.length} notes from remote. Prog: ${program}, Bank: ${bank}`);

        // Deduplicate notes
        const uniqueNotes = [...new Set(notes)];

        await Promise.all(uniqueNotes.map(async (note) => {
            const key = `remote_${bank}_${program}_${note}`;
            if (this.cachedBuffers.has(key)) return;

            try {
                const response = await fetch(`${this.remoteBaseUrl}/sample?bank=${bank}&program=${program}&note=${note}`);
                if (!response.ok) return; // Skip if not found

                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await context.decodeAudioData(arrayBuffer);
                this.cachedBuffers.set(key, audioBuffer);
            } catch (e) {
                console.warn(`[SF2Adapter] Failed to fetch sample for note ${note}:`, e);
            }
        }));
    }

    /**
     * Returns options for Tone.Sampler
     * @param program MIDI Program Number (0-127)
     * @param isPercussion Whether this is a drum track (Bank 128)
     * @param context AudioContext (usually Tone.context, or OfflineContext)
     * @param notesOptional Optional array of MIDI notes to optimize loading
     */
    /**
     * Returns options for Tone.Sampler
     * @param program MIDI Program Number (0-127)
     * @param isPercussion Whether this is a drum track (Bank 128)
     * @param context AudioContext (usually Tone.context, or OfflineContext)
     * @param notesOptional Optional array of MIDI notes to optimize loading
     */
    static async getSamplerOptions(program: number, isPercussion: boolean, context: any = Tone.context, notesOptional?: number[]): Promise<Partial<Tone.SamplerOptions>> {
        // REMOTE MODE LOGIC
        if (this.isRemoteMode) {
            const urls: Record<string, AudioBuffer | string> = {};
            const bank = isPercussion ? 128 : 0;

            try {
                // Fetch mapping from backend to ensure correct pitch/root keys
                const mapRes = await fetch(`${this.remoteBaseUrl}/map?bank=${bank}&program=${program}`);
                const mapData = await mapRes.json();

                if (mapData.status === "ok" && mapData.map) {
                    for (const entry of mapData.map) {
                        // entry: { root_key, trigger_note, name }
                        // We map the ROOT KEY to the URL.
                        // The URL asks for the TRIGGER NOTE (so backend finds the sample).
                        // Tone.Sampler sees "C4" -> URL(Trigger=C4_Sample_Trigger)
                        // If Tone plays D4, it shifts C4.

                        const rootName = midiToNoteName(entry.root_key);
                        // Add root mapping only if not present (or overwrite, doesn't matter for duplicates)
                        if (!urls[rootName]) {
                            urls[rootName] = `${this.remoteBaseUrl}/sample?bank=${bank}&program=${program}&note=${entry.trigger_note}`;
                        }
                    }
                } else {
                    console.warn("[SF2Adapter] Failed to fetch sample map or empty.");
                }

            } catch (e) {
                console.error("[SF2Adapter] Map fetch error:", e);
            }

            return {
                urls,
                baseUrl: ""
            };
        }

        if (!this.sf) return {};

        const urls: Record<string, AudioBuffer> = {};
        const notesToCheck = notesOptional || Array.from({ length: 128 }, (_, i) => i);

        // Bank Selection: Melodic=0, Percussion=128
        const bank = isPercussion ? 128 : 0;

        const processedRoots = new Set<string>();

        for (const note of notesToCheck) {
            // bank 0 for standard, 128 for drums.
            const keyData = this.sf.getKeyData(note, bank, program);

            if (keyData && keyData.sample) {
                // Determine Root Key (Original Pitch)
                let rootKey = keyData.sample.header.originalPitch;

                // Check for OverridingRootKey (Generator ID 58)
                const gens = keyData.generators as any;

                if (gens && gens[58]) { // OverridingRootKey
                    const val = gens[58].value;
                    // value -1 means use originalPitch
                    if (val !== undefined && val !== -1) {
                        rootKey = val;
                    }
                }

                // Check for CoarseTune (51) - Semitone offset
                // EffectiveBase = Base - CoarseTune to achieve correct pitch shifting in Tone.Sampler
                let coarseTune = 0;
                if (gens && gens[51]) coarseTune = gens[51].value || 0;

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
