import * as Tone from 'tone';
import * as THREE from 'three';
import { Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebMMuxer, ArrayBufferTarget as WebMArrayBufferTarget } from 'webm-muxer';
import JSZip from 'jszip';
import useStore from '../store/useStore';
import { SoundFontAdapter } from './SoundFontAdapter';
import { getAudioEngine } from '@/audio/AudioEngine';

const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
};

export class ExportManager {
    private static audioCache: { midiData: any, buffer: Tone.ToneAudioBuffer } | null = null;

    static async renderAudio(midiData: any, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<Tone.ToneAudioBuffer> {
        // Cache Check
        if (this.audioCache && this.audioCache.midiData === midiData) {
            onProgress?.(100);
            return this.audioCache.buffer;
        }

        const duration = Math.max(0.1, (midiData.duration || 0)) + 2;
        const sampleRate = Tone.context.sampleRate;
        const numberOfChannels = 2;

        const chunkSize = 1.0;
        const totalChunks = Math.ceil(duration / chunkSize);
        const finalBuffer = Tone.context.createBuffer(numberOfChannels, sampleRate * duration, sampleRate);
        const preRoll = 2.0;

        for (let i = 0; i < totalChunks; i++) {
            if (signal?.aborted) throw new Error("Export Aborted");

            const chunkStartTime = i * chunkSize;
            const chunkDuration = Math.min(chunkSize, duration - chunkStartTime);

            // Render logic with Pre-roll:
            // Render window: [chunkStartTime - preRoll] to [chunkStartTime + chunkDuration]

            // Effective render start time (clamped to 0)
            const renderStartTime = Math.max(0, chunkStartTime - preRoll);
            // Effective relative start time of the chunk within the render buffer
            const sliceStartOffset = chunkStartTime - renderStartTime;

            // The duration we ask Tone.Offline to render
            const renderDuration = sliceStartOffset + chunkDuration;

            // Pre-calculate and pre-load Sampler Options for this chunk's relevant notes
            const chunkSamplersData = new Map<number, any>(); // trackIndex -> options
            const isSoundFontLoaded = useStore.getState().isSoundFontLoaded;

            if (isSoundFontLoaded) {
                await Promise.all(midiData.tracks.map(async (track: any, trackIndex: number) => {
                    const windowStart = renderStartTime;
                    const windowEnd = renderStartTime + renderDuration;
                    const relevantNotes = track.notes ? track.notes.filter((n: any) => {
                        const noteEnd = n.time + n.duration;
                        return noteEnd > windowStart && n.time < windowEnd;
                    }) : [];

                    if (relevantNotes.length > 0) {
                        const program = (track.instrument && track.instrument.number) || 0;
                        const isPercussion = !!track.instrument.percussion;
                        const uniqueNotes = [...new Set(relevantNotes.map((n: any) => n.midi))] as number[];
                        try {
                            // Fetch options outside Offline Context
                            const options = await SoundFontAdapter.getSamplerOptions(program, isPercussion, Tone.getContext(), uniqueNotes);
                            if (options && options.urls && Object.keys(options.urls).length > 0) {
                                chunkSamplersData.set(trackIndex, options);
                            }
                        } catch (e) {
                            console.warn(`[Export] Failed to load sampler for track ${trackIndex}`, e);
                        }
                    }
                }));
            }

            const chunkBuffer = await Tone.Offline(async ({ transport }) => {
                await Promise.all(midiData.tracks.map(async (track: any, trackIndex: number) => {
                    if (!track.notes) return;

                    const windowStart = renderStartTime;
                    const windowEnd = renderStartTime + renderDuration;

                    const relevantNotes = track.notes.filter((n: any) => {
                        const noteEnd = n.time + n.duration;
                        return noteEnd > windowStart && n.time < windowEnd;
                    });

                    if (relevantNotes.length === 0) return;

                    let synth: any = null;

                    if (chunkSamplersData.has(trackIndex)) {
                        const options = chunkSamplersData.get(trackIndex);
                        try {
                            // Re-instantiate sampler inside Offline context using pre-fetched options
                            // We must wait for 'onload' to ensure buffers are ready before scheduling
                            await new Promise<void>((resolve) => {
                                synth = new Tone.Sampler({
                                    ...options,
                                    onload: () => resolve()
                                }).toDestination();
                            });
                        } catch (e) { console.warn("Export Sampler Init Error", e); }
                    }

                    if (!synth) {
                        synth = new Tone.PolySynth(Tone.Synth, {
                            oscillator: { type: "triangle" },
                            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
                        }).toDestination();
                        (synth as any).maxPolyphony = 24;
                    }

                    synth.volume.value = -12;

                    relevantNotes.forEach((n: any) => {
                        const relativeTime = n.time - renderStartTime;

                        if (relativeTime >= 0) {
                            synth.triggerAttackRelease(
                                n.name,
                                Math.max(0.05, n.duration),
                                relativeTime,
                                n.velocity
                            );
                        } else {
                            // Fix: Only play the remaining duration if the note started in a previous chunk
                            const offset = -relativeTime;
                            const remaining = n.duration - offset;

                            if (remaining > 0) {
                                synth.triggerAttackRelease(
                                    n.name,
                                    Math.max(0.05, remaining),
                                    0,
                                    n.velocity
                                );
                            }
                        }
                    });
                }));
            }, renderDuration, numberOfChannels, sampleRate);




            // Copy Valid Slice to final buffer
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const finalData = finalBuffer.getChannelData(channel);
                const chunkRawData = chunkBuffer.getChannelData(channel);

                // We need to extract the part starting from sliceStartOffset
                const startSample = Math.floor(sliceStartOffset * sampleRate);
                const lengthSamples = Math.floor(chunkDuration * sampleRate);

                // Validation
                if (startSample < chunkRawData.length) {
                    const sliceData = chunkRawData.subarray(startSample, startSample + lengthSamples);

                    // Destination offset
                    const destOffset = Math.floor(chunkStartTime * sampleRate);

                    if (destOffset < finalData.length) {
                        const safeLength = Math.min(sliceData.length, finalData.length - destOffset);
                        finalData.set(sliceData.subarray(0, safeLength), destOffset);
                    }
                }
            }

            onProgress?.(((i + 1) / totalChunks) * 100);
            await new Promise(r => setTimeout(r, 10));
        }

        const retBuffer = new Tone.ToneAudioBuffer(finalBuffer);
        this.audioCache = { midiData, buffer: retBuffer };
        return retBuffer;
    }

    static async exportVideo(
        midiData: any,
        p5Instance: any,
        options: {
            width: number,
            height: number,
            fps: number,
            bitrate?: number,
            enableAudio?: boolean,
            transparentBackground?: boolean,
            format?: 'mp4' | 'webm' | 'hevc',
            signal?: AbortSignal
        },
        onProgress?: (progress: number, status: string) => void
    ) {
        if (!p5Instance || !midiData) throw new Error("Missing resources");

        // Detect Renderer Type early
        const isP5 = !!(p5Instance && p5Instance.canvas && typeof p5Instance.pixelDensity === 'function');
        const isThree = !!(p5Instance && p5Instance.renderer && p5Instance.manualRender);

        if (!isP5 && !isThree) throw new Error("Unknown Renderer");

        // 0. Capture Original State to restore later
        let originalWidth, originalHeight, originalDensity, originalBackground;

        if (isP5) {
            originalWidth = p5Instance.width;
            originalHeight = p5Instance.height;
            originalDensity = p5Instance.pixelDensity();
        } else {
            // Three.js
            const { renderer } = p5Instance;
            const size = new THREE.Vector2();
            renderer.getSize(size);
            originalWidth = size.x;
            originalHeight = size.y;
            // Density not usually dynamically changed in this exporter flow for Three.js, but good to know
            originalDensity = renderer.getPixelRatio();
            if (p5Instance.scene) {
                originalBackground = p5Instance.scene.background;
            }
        }

        try {
            const { width, height, fps } = options;
            // Ensure even dimensions (H.264 requirement) and minimum size (>0)
            const safeWidth = Math.max(2, Math.floor(width / 2) * 2);
            const safeHeight = Math.max(2, Math.floor(height / 2) * 2);

            const duration = midiData.duration + 2;
            const totalFrames = Math.ceil(duration * fps);
            const bitrate = options.bitrate || 5e6; // 5Mbps default

            // 1. Render Audio (if enabled)
            let audioBuffer: Tone.ToneAudioBuffer | null = null;
            if (options.enableAudio !== false) { // Default to true
                onProgress?.(0, "Initializing Audio...");

                // [NEW] Preload Remote Samples if Needed
                if (SoundFontAdapter.isRemoteMode) {
                    onProgress?.(0, "Preloading Samples from Backend...");
                    for (const track of midiData.tracks) {
                        if (!track.notes || track.notes.length === 0) continue;
                        const program = track.instrument?.number || 0;
                        const isPercussion = !!track.instrument?.percussion;
                        const bank = isPercussion ? 128 : 0;
                        const notes = track.notes.map((n: any) => n.midi);

                        try {
                            await SoundFontAdapter.preloadNotes(notes, program, bank, Tone.getContext());
                        } catch (e) {
                            console.warn("Preload failed", e);
                        }
                    }
                }

                audioBuffer = await this.renderAudio(midiData, (p) => {
                    const totalPercent = p / 5;
                    onProgress?.(totalPercent, `Rendering Audio... ${Math.round(p)}%`);
                }, options.signal);
            } else {
                onProgress?.(0, "Skipping Audio...");
            }

            // Note: OfflineRendering step is opaque.

            // 2. Setup 
            const isWebM = options.format === 'webm';
            let muxer: any; // Initialized later

            // Renderer is already detected above as isP5 / isThree

            let sourceCanvas: HTMLCanvasElement;

            if (isP5) {
                // P5 Setup
                p5Instance.setManualMode(true);
                (p5Instance as any).transparentBackground = !!options.transparentBackground;
                p5Instance.pixelDensity(1);

                if (p5Instance.width !== width || p5Instance.height !== height) {
                    p5Instance.resizeCanvas(width, height);
                    await new Promise(r => setTimeout(r, 100));
                }
                p5Instance.background(0);
                p5Instance.redraw();
                await new Promise(r => setTimeout(r, 50));

                sourceCanvas = p5Instance.canvas;
            } else {
                // Three.js Setup
                const { renderer, camera, scene } = p5Instance; // Typed as any
                sourceCanvas = renderer.domElement;

                // Save original size
                const originalSize = new THREE.Vector2();
                renderer.getSize(originalSize);

                // Resize
                renderer.setSize(width, height, false);
                if (camera.isPerspectiveCamera) {
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                } else if (camera.isOrthographicCamera) {
                    // Adjust orthographic bounds if needed
                }

                // If transparent
                if (options.transparentBackground) {
                    renderer.setClearColor(0x000000, 0); // Transparent
                    if (scene) {
                        // Temp remove background for transparency
                        scene.background = null;
                    }
                } else {
                    renderer.setClearColor(0x000000, 1); // Opaque black
                }
            }

            // 3. Configure Encoder & Muxer
            let encodingError: Error | null = null;

            const videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => {
                    console.error("VideoEncoder Error:", e);
                    encodingError = e instanceof Error ? e : new Error(String(e));
                }
            });

            let vConfig: VideoEncoderConfig; // Use any or strict type if imported
            let muxerCodec: string;

            if (isWebM) {
                const candidates = [
                    { codec: 'vp09.02.10.10', muxer: 'V_VP9', desc: 'VP9 Profile 2' },
                    { codec: 'vp09.03.10.10', muxer: 'V_VP9', desc: 'VP9 Profile 3' },
                    { codec: 'vp09.00.10.08', muxer: 'V_VP9', desc: 'VP9 Profile 0' },
                    { codec: 'vp8', muxer: 'V_VP8', desc: 'VP8' },
                    { codec: 'av01.0.04M.08', muxer: 'V_AV1', desc: 'AV1' }
                ];

                let bestMatch = null;

                for (const c of candidates) {
                    const testConfig: any = {
                        codec: c.codec,
                        width: safeWidth,
                        height: safeHeight,
                        bitrate,
                        framerate: fps,
                        alpha: options.transparentBackground ? 'keep' : 'discard',
                        hardwareAcceleration: 'prefer-software'
                    };
                    try {
                        const support = await VideoEncoder.isConfigSupported(testConfig);
                        if (support.supported && (!options.transparentBackground || support.config.alpha === 'keep')) {
                            bestMatch = c;
                            vConfig = testConfig;
                            break;
                        }
                    } catch (e) { }
                }

                if (!bestMatch) {
                    console.warn("[Export] No explicit WebM codec supported, defaulting to VP8");
                    vConfig = {
                        codec: 'vp8',
                        width: safeWidth,
                        height: safeHeight,
                        bitrate,
                        framerate: fps,
                        alpha: options.transparentBackground ? 'keep' : 'discard'
                    } as any;
                    muxerCodec = 'V_VP8';
                } else {
                    console.log(`[Export] Selected WebM codec: ${bestMatch.desc}`);
                    muxerCodec = bestMatch.muxer;
                    vConfig = {
                        codec: bestMatch.codec,
                        width: safeWidth,
                        height: safeHeight,
                        bitrate,
                        framerate: fps,
                        alpha: options.transparentBackground ? 'keep' : 'discard'
                    } as any;
                }
            } else if (options.format === 'hevc') {
                const candidates = [
                    { codec: 'hvc1.1.6.L93.B0', desc: 'HEVC Main 10' },
                    { codec: 'hvc1.2.4.L93.B0', desc: 'HEVC Main 4:4:4' },
                    { codec: 'hvc1.1.6.L93.90', desc: 'HEVC' }
                ];

                let bestMatch = null;
                for (const c of candidates) {
                    const testConfig: any = {
                        codec: c.codec,
                        width: safeWidth,
                        height: safeHeight,
                        bitrate,
                        framerate: fps,
                        alpha: options.transparentBackground ? 'keep' : 'discard',
                        hardwareAcceleration: 'prefer-hardware'
                    };
                    try {
                        const support = await VideoEncoder.isConfigSupported(testConfig);
                        if (support.supported && (!options.transparentBackground || support.config.alpha === 'keep')) {
                            bestMatch = c;
                            vConfig = testConfig;
                            break;
                        }
                    } catch (e) { }
                }

                if (!bestMatch) {
                    console.warn("[Export] HEVC fallback to H.264");
                    vConfig = {
                        codec: 'avc1.640033',
                        width: safeWidth,
                        height: safeHeight,
                        bitrate,
                        framerate: fps,
                        alpha: 'discard'
                    } as any;
                    muxerCodec = 'avc';
                } else {
                    console.log(`[Export] Selected HEVC codec: ${bestMatch.desc}`);
                    vConfig = {
                        codec: bestMatch.codec,
                        width: safeWidth,
                        height: safeHeight,
                        bitrate,
                        framerate: fps,
                        alpha: options.transparentBackground ? 'keep' : 'discard'
                    } as any;
                    muxerCodec = 'hevc';
                }
            } else {
                vConfig = {
                    codec: 'avc1.640033',
                    width: safeWidth,
                    height: safeHeight,
                    bitrate,
                    framerate: fps
                } as any;
                muxerCodec = 'avc';
            }

            // Muxer Init
            if (isWebM) {
                muxer = new WebMMuxer({
                    target: new WebMArrayBufferTarget(),
                    video: {
                        codec: muxerCodec as any,
                        width: safeWidth,
                        height: safeHeight,
                        frameRate: fps,
                        alpha: options.transparentBackground
                    },
                    audio: audioBuffer ? {
                        codec: 'A_OPUS',
                        sampleRate: audioBuffer.sampleRate,
                        numberOfChannels: audioBuffer.numberOfChannels
                    } : undefined,
                    firstTimestampBehavior: 'offset'
                });
            } else {
                muxer = new Muxer({
                    target: new Mp4ArrayBufferTarget(),
                    video: {
                        codec: muxerCodec === 'hevc' ? 'hevc' : 'avc',
                        width: safeWidth,
                        height: safeHeight,
                        frameRate: fps
                    },
                    audio: audioBuffer ? {
                        codec: 'aac',
                        sampleRate: audioBuffer.sampleRate,
                        numberOfChannels: audioBuffer.numberOfChannels
                    } : undefined,
                    firstTimestampBehavior: 'offset',
                    fastStart: 'in-memory'
                });
            }

            try {
                videoEncoder.configure(vConfig as any);
            } catch (e: any) {
                console.warn("[Export] Configure failed, retrying without alpha", e);
                if (options.transparentBackground) {
                    (vConfig as any).alpha = 'discard';
                    videoEncoder.configure(vConfig as any);
                } else {
                    throw e;
                }
            }

            // Audio Encoder Setup
            let audioEncoder: AudioEncoder | null = null;
            if (audioBuffer) {
                audioEncoder = new AudioEncoder({
                    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                    error: (e) => console.error("AudioEncoder Error", e)
                });
                audioEncoder.configure(isWebM ? {
                    codec: 'opus',
                    sampleRate: audioBuffer.sampleRate,
                    numberOfChannels: audioBuffer.numberOfChannels,
                    bitrate: 128000
                } : {
                    codec: 'mp4a.40.2',
                    sampleRate: audioBuffer.sampleRate,
                    numberOfChannels: audioBuffer.numberOfChannels,
                    bitrate: 128000
                });

                // Encode Audio Data
                const numberOfChannels = audioBuffer.numberOfChannels;
                const length = audioBuffer.length;
                const sampleRate = audioBuffer.sampleRate;
                const channelData = [];
                for (let i = 0; i < numberOfChannels; i++) channelData.push(audioBuffer.getChannelData(i));

                const chunkSize = sampleRate;
                let audioTimestamp = 0;

                for (let frame = 0; frame < length; frame += chunkSize) {
                    const size = Math.min(chunkSize, length - frame);
                    const data = new Float32Array(size * numberOfChannels);

                    // Interleave for standard AudioData? Or planar?
                    // WebCodecs AudioData usually expects planar if format is f32-planar.
                    let offset = 0;
                    for (let c = 0; c < numberOfChannels; c++) {
                        data.set(channelData[c].subarray(frame, frame + size), offset);
                        offset += size;
                    }

                    const audioData = new AudioData({
                        format: 'f32-planar',
                        sampleRate,
                        numberOfChannels,
                        numberOfFrames: size,
                        timestamp: audioTimestamp * 1000000,
                        data
                    });

                    audioEncoder.encode(audioData);
                    audioData.close();
                    audioTimestamp += size / sampleRate;
                }
            }

            // 4. Video Encoding Loop
            // Re-fetch canvas in case resize replaced it
            if (!sourceCanvas || !(sourceCanvas instanceof HTMLCanvasElement)) {
                throw new Error("Failed to access Canvas element");
            }

            // 4b. Intermediate Canvas
            let exportCanvas: HTMLCanvasElement | OffscreenCanvas;
            let exportCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

            exportCanvas = document.createElement('canvas');
            exportCanvas.width = safeWidth;
            exportCanvas.height = safeHeight;
            exportCtx = (exportCanvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true });

            if (!exportCtx) throw new Error("Failed to create export canvas context");

            if (options.transparentBackground) {
                exportCtx.clearRect(0, 0, safeWidth, safeHeight);
            } else {
                exportCtx.fillStyle = '#000000';
                exportCtx.fillRect(0, 0, safeWidth, safeHeight);
            }

            // 5. Video Loop
            for (let i = 0; i < totalFrames; i++) {
                // Backpressure
                while (videoEncoder.encodeQueueSize > 5) {
                    await new Promise(r => setTimeout(r, 10));
                }

                if (options.signal?.aborted || encodingError) {
                    if (videoEncoder.state !== 'closed') videoEncoder.close();
                    if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
                    throw encodingError || new Error("Export Aborted");
                }

                const time = i / fps;

                if (isP5) {
                    p5Instance.renderFrame(time);
                } else if (isThree) {
                    if (options.transparentBackground) {
                        const { renderer } = p5Instance;
                        renderer.setClearColor(0x000000, 0);
                        renderer.clear();
                    }
                    p5Instance.manualRender(time);
                    p5Instance.manualRender(time);
                }

                // Draw to intermediate canvas
                if (exportCtx) {
                    if (options.transparentBackground) {
                        exportCtx.clearRect(0, 0, safeWidth, safeHeight);
                    }
                    exportCtx.drawImage(sourceCanvas, 0, 0, safeWidth, safeHeight);
                }

                // Update progress
                if (i % 60 === 0) {
                    const percent = (i / totalFrames) * 100;
                    onProgress?.(percent, `Rendering Frame ${i}/${totalFrames}`);
                    await new Promise(r => setTimeout(r, 0));
                    if (options.signal?.aborted || encodingError) {
                        if (videoEncoder.state !== 'closed') videoEncoder.close();
                        if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
                        throw encodingError || new Error("Export Aborted");
                    }
                }
                // Capture Frame from INTERMEDIATE canvas
                let frame: VideoFrame | null = null;
                try {
                    frame = new VideoFrame(exportCanvas, {
                        timestamp: (i / fps) * 1000000 // microseconds
                    });
                } catch (err) {
                    console.error("Frame creation failed at index " + i, err);
                    console.error("Frame creation failed at index " + i, err);
                    // Skip not safe for sync. Abort.
                    if (videoEncoder.state !== 'closed') videoEncoder.close();
                    if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
                    throw new Error("Frame creation failed: " + err);
                }

                if (frame && videoEncoder.state === "configured") {
                    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
                    frame.close();
                }
            }

            // Finish up
            // Finish up
            if (!options.signal?.aborted && !encodingError) {
                onProgress?.(100, "Finalizing Video...");
                if (videoEncoder.state === "configured") await videoEncoder.flush();
                videoEncoder.close();

                onProgress?.(100, "Finalizing Audio...");
                if (audioEncoder && audioEncoder.state === "configured") await audioEncoder.flush();
                if (audioEncoder) audioEncoder.close();

                onProgress?.(100, "Saving File...");
                muxer.finalize();

                const buffer = muxer.target.buffer;
                downloadBlob(new Blob([buffer], { type: isWebM ? 'video/webm' : 'video/mp4' }), isWebM ? "midi_export.webm" : "midi_export.mp4");
            }

        } finally {
            // Cleanup
            if (isP5) {
                p5Instance.setManualMode(false);
                (p5Instance as any).transparentBackground = false;
            }

            // Restore original canvas state
            try {
                if (isP5) {
                    if (typeof originalDensity !== 'undefined') p5Instance.pixelDensity(originalDensity);
                    if (originalWidth && originalHeight) {
                        p5Instance.resizeCanvas(originalWidth, originalHeight);
                    }
                    // Force one redraw to reset visuals
                    p5Instance.redraw();
                } else if (isThree) {
                    const { renderer, camera } = p5Instance;
                    // Restore size
                    if (originalWidth && originalHeight) {
                        renderer.setSize(originalWidth, originalHeight, false);
                        if (camera.isPerspectiveCamera) {
                            camera.aspect = originalWidth / originalHeight;
                            camera.updateProjectionMatrix();
                        }
                        // Force render to clear any glitch
                        p5Instance.manualRender(useStore.getState().currentTime);
                    }
                    if (typeof originalBackground !== 'undefined' && p5Instance.scene) {
                        p5Instance.scene.background = originalBackground;
                    }
                }
            } catch (e) {
                console.warn("Failed to restore canvas state:", e);
            }
        }
    }

    static async exportVideoRealtime(
        midiData: any,
        p5Instance: any,
        options: {
            width: number,
            height: number,
            fps: number,
            bitrate?: number,
            signal?: AbortSignal
        },
        onProgress?: (progress: number, status: string) => void
    ) {
        // ... (Realtime export logic remains largely P5 specific for now, or needs similar refactor) ...
        // For safety, let's just guard the P5 parts or assume P5 since realtime might not be enabled for Three yet.
        // But to be safe against crashes:

        if (!p5Instance || !midiData) throw new Error("Missing resources");

        const { width, height, fps } = options;
        const duration = midiData.duration + 2;
        const bitrate = options.bitrate || 5e6;

        // Detect Renderer Type
        const isP5 = !!(p5Instance && p5Instance.canvas && typeof p5Instance.pixelDensity === 'function');
        // Realtime not yet supported for Three.js in this refactor
        if (!isP5) throw new Error("Realtime Record not supported for Three.js yet.");

        // Save original state
        const originalWidth = p5Instance.width;
        const originalHeight = p5Instance.height;
        const wasPlaying = useStore.getState().isPlaying;

        try {
            onProgress?.(0, "Preparing realtime recording...");

            // 1. Stop current playback if any
            if (wasPlaying) {
                // const { getAudioEngine } = await import('@/audio/AudioEngine');
                getAudioEngine().pause();
                useStore.getState().setIsPlaying(false);
                await new Promise(r => setTimeout(r, 200));
            }

            // 2. Prepare canvas
            p5Instance.setManualMode(false); // Use real-time mode
            if (p5Instance.width !== width || p5Instance.height !== height) {
                p5Instance.resizeCanvas(width, height);
                await new Promise(r => setTimeout(r, 100));
            }

            // 2. Capture Canvas Stream
            const canvasStream = p5Instance.canvas.captureStream(fps);

            // 3. Capture Audio Stream from Tone.js Destination
            // This will capture browser's internal audio, not external MIDI
            // External MIDI audio must be routed back via system audio routing
            const audioDestination = Tone.getContext().createMediaStreamDestination();
            Tone.getDestination().connect(audioDestination);

            // 4. Combine Streams
            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...audioDestination.stream.getAudioTracks()
            ]);

            // 5. Setup MediaRecorder
            const chunks: Blob[] = [];
            let mimeType = 'video/webm;codecs=vp8,opus';

            // Fallback mime type detection
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    throw new Error("Browser does not support video recording");
                }
            }

            const mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: bitrate
            });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            let recordingError: Error | null = null;
            mediaRecorder.onerror = (e) => {
                console.error("MediaRecorder error:", e);
                recordingError = new Error("Recording Error");
            };

            // 6. Setup playback
            onProgress?.(0, "Starting realtime recording...");

            const startTime = Date.now();
            let recordingComplete = false;

            mediaRecorder.onstop = () => {
                recordingComplete = true;
            };

            // Start recording
            mediaRecorder.start(100); // Collect data every 100ms

            // 7. Play in real-time
            // Start Tone.js Transport
            if (!useStore.getState().isPlaying) {
                useStore.getState().setIsPlaying(true);
            }

            // 8. Monitor progress
            const progressInterval = setInterval(() => {
                if (options.signal?.aborted || recordingError) {
                    clearInterval(progressInterval);
                    mediaRecorder.stop();
                    return;
                }

                const elapsed = (Date.now() - startTime) / 1000;
                const progress = Math.min(5 + (elapsed / duration) * 90, 95);
                onProgress?.(progress, `Recording... ${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s`);

                if (elapsed >= duration) {
                    clearInterval(progressInterval);
                    mediaRecorder.stop();
                }
            }, 100);

            // 8. Wait for recording to complete
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Recording Timeout"));
                }, (duration + 5) * 1000); // Extra 5 seconds buffer

                mediaRecorder.onstop = () => {
                    clearTimeout(timeout);
                    clearInterval(progressInterval);
                    recordingComplete = true;
                    resolve();
                };

                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        clearTimeout(timeout);
                        clearInterval(progressInterval);
                        mediaRecorder.stop();
                        reject(new Error("Recording Cancelled"));
                    });
                }
            });

            if (recordingError) {
                throw recordingError;
            }

            // 10. Stop playback
            // const { getAudioEngine: getEngineStop } = await import('@/audio/AudioEngine');
            getAudioEngine().pause();
            useStore.getState().setIsPlaying(false);
            Tone.getDestination().disconnect(audioDestination);

            // 11. Create final file
            onProgress?.(100, "Saving file...");

            if (chunks.length === 0) {
                throw new Error("No data captured, recording failed");
            }

            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size === 0) {
                throw new Error("Recorded file is empty (0 bytes)");
            }

            downloadBlob(blob, "midi_export_realtime.webm");

            // 12. Restore canvas
            p5Instance.setManualMode(true);
            if (originalWidth && originalHeight) {
                p5Instance.resizeCanvas(originalWidth, originalHeight);
            }

        } catch (e) {
            // Cleanup on error
            // const { getAudioEngine } = await import('@/audio/AudioEngine');
            if (useStore.getState().isPlaying) {
                getAudioEngine().pause();
                useStore.getState().setIsPlaying(false);
            }

            p5Instance.setManualMode(true);
            if (originalWidth && originalHeight) {
                p5Instance.resizeCanvas(originalWidth, originalHeight);
            }

            throw e;
        } finally {
            // Restore original playing state if needed
            if (wasPlaying) {
                // const { getAudioEngine } = await import('@/audio/AudioEngine');
                await new Promise(r => setTimeout(r, 200));
                getAudioEngine().play();
                useStore.getState().setIsPlaying(true);
            }
        }
    }

    static async exportSequence(
        midiData: any,
        p5Instance: any,
        options: {
            width: number,
            height: number,
            fps: number,
            transparentBackground?: boolean,
            signal?: AbortSignal
        },
        onProgress?: (progress: number, status: string) => void
    ) {
        if (!p5Instance || !midiData) throw new Error("Missing resources");

        const { width, height, fps } = options;
        const duration = midiData.duration + 2;
        const totalFrames = Math.ceil(duration * fps);
        const zip = new JSZip();

        // Detect Renderer Type early
        const isP5 = !!(p5Instance && p5Instance.canvas && typeof p5Instance.pixelDensity === 'function');
        const isThree = !!(p5Instance && p5Instance.renderer && p5Instance.manualRender);

        if (!isP5 && !isThree) throw new Error("Unknown Renderer");

        // 0. Capture Original State to restore later
        let originalWidth, originalHeight, originalDensity, originalBackground;

        if (isP5) {
            originalWidth = p5Instance.width;
            originalHeight = p5Instance.height;
            originalDensity = p5Instance.pixelDensity();
        } else {
            // Three.js
            const { renderer } = p5Instance;
            const size = new THREE.Vector2();
            renderer.getSize(size);
            originalWidth = size.x;
            originalHeight = size.y;
            if (p5Instance.scene) {
                originalBackground = p5Instance.scene.background;
            }
        }

        try {
            if (isP5) {
                p5Instance.setManualMode(true);
                (p5Instance as any).transparentBackground = !!options.transparentBackground;
                p5Instance.pixelDensity(1);
                p5Instance.resizeCanvas(width, height);
            } else if (isThree) {
                const { renderer, camera, scene } = p5Instance;
                renderer.setSize(width, height, false);
                if (camera.isPerspectiveCamera) {
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                }

                if (options.transparentBackground) {
                    renderer.setClearColor(0x000000, 0);
                    if (scene) scene.background = null;
                } else {
                    renderer.setClearColor(0x000000, 1);
                }
            }

            for (let i = 0; i < totalFrames; i++) {
                if (options.signal?.aborted) throw new Error("Export Aborted");

                const time = i / fps;

                if (isP5) {
                    p5Instance.renderFrame(time);
                } else if (isThree) {
                    if (options.transparentBackground) {
                        const { renderer } = p5Instance;
                        renderer.setClearColor(0x000000, 0);
                        renderer.clear();
                    }
                    p5Instance.manualRender(time);
                }

                // Update progress
                if (i % 30 === 0) {
                    const percent = (i / totalFrames) * 100;
                    onProgress?.(percent, `Saving Frame ${i}/${totalFrames}`);
                    await new Promise(r => setTimeout(r, 0));
                }

                // Capture Blob
                let blob: Blob | null = null;
                if (isP5) {
                    blob = await new Promise<Blob | null>(resolve =>
                        p5Instance.canvas.toBlob(resolve, 'image/png')
                    );
                } else if (isThree) {
                    // Three.js capture
                    const { renderer } = p5Instance;
                    blob = await new Promise<Blob | null>(resolve =>
                        renderer.domElement.toBlob(resolve, 'image/png')
                    );
                }

                if (blob) {
                    const filename = `frame_${String(i).padStart(5, '0')}.png`;
                    zip.file(filename, blob);
                }
            }

            onProgress?.(100, "Zipping...");
            const content = await zip.generateAsync({ type: "blob" });
            downloadBlob(content, "frames.zip");

        } finally {
            // Cleanup & Restore
            if (isP5) {
                p5Instance.setManualMode(false);
                (p5Instance as any).transparentBackground = false;
            }

            try {
                if (isP5) {
                    if (typeof originalDensity !== 'undefined') p5Instance.pixelDensity(originalDensity);
                    if (originalWidth && originalHeight) {
                        p5Instance.resizeCanvas(originalWidth, originalHeight);
                    }
                    p5Instance.redraw();
                } else if (isThree) {
                    const { renderer, camera } = p5Instance;
                    if (originalWidth && originalHeight) {
                        renderer.setSize(originalWidth, originalHeight, false);
                        if (camera.isPerspectiveCamera) {
                            camera.aspect = originalWidth / originalHeight;
                            camera.updateProjectionMatrix();
                        }
                        p5Instance.manualRender(useStore.getState().currentTime);
                    }
                    if (typeof originalBackground !== 'undefined' && p5Instance.scene) {
                        p5Instance.scene.background = originalBackground;
                    }
                }
            } catch (e) {
                console.warn("Failed to restore canvas state:", e);
            }
        }
    }
}
