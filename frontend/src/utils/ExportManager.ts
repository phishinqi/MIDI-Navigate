import * as Tone from 'tone';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import JSZip from 'jszip';
import useStore from '../store/useStore';
import { SoundFontAdapter } from './SoundFontAdapter';

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
        // [Cache Check]
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
            // We render a window: [chunkStartTime - preRoll] to [chunkStartTime + chunkDuration]
            // Then we keep only the part starting from the actual chunkStartTime.

            // Effective render start time (clamped to 0)
            const renderStartTime = Math.max(0, chunkStartTime - preRoll);
            // Effective relative start time of the chunk within the render buffer
            const sliceStartOffset = chunkStartTime - renderStartTime;

            // The duration we ask Tone.Offline to render
            const renderDuration = sliceStartOffset + chunkDuration;

            const chunkBuffer = await Tone.Offline(async ({ transport }) => {
                midiData.tracks.forEach((track: any, trackIndex: number) => {
                    if (!track.notes) return;

                    const windowStart = renderStartTime;
                    const windowEnd = renderStartTime + renderDuration;

                    // Filter relevant notes
                    const relevantNotes = track.notes.filter((n: any) => {
                        const noteEnd = n.time + n.duration;
                        return noteEnd > windowStart && n.time < windowEnd;
                    });

                    if (relevantNotes.length === 0) return;

                    let synth: any = null;
                    const isSoundFontLoaded = useStore.getState().isSoundFontLoaded;
                    console.log(`[Export] Track ${trackIndex}: SF Loaded? ${isSoundFontLoaded}`);

                    if (isSoundFontLoaded) {
                        try {
                            const program = (track.instrument && track.instrument.number) || 0;
                            const isPercussion = !!track.instrument.percussion;
                            // Gather notes for this track in this chunk? 
                            // Optimization: Only load samples for notes in this chunk?
                            // Or simpler: load for all unique notes in the track (passed in relevantNotes is just the chunk's notes).
                            // Let's use relevantNotes to minimize buffer usage per chunk render!
                            const uniqueNotes = [...new Set(relevantNotes.map((n: any) => n.midi))] as number[];

                            const options = SoundFontAdapter.getSamplerOptions(program, isPercussion, Tone.getContext(), uniqueNotes);
                            if (options && options.urls && Object.keys(options.urls).length > 0) {
                                synth = new Tone.Sampler(options).toDestination();
                            }
                        } catch (e) { console.warn("Export SF2 Error", e); }
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
                            // Clamp negative start times to 0 (covered by Pre-roll slice)
                            synth.triggerAttackRelease(
                                n.name,
                                Math.max(0.05, n.duration),
                                0,
                                n.velocity
                            );
                        }
                    });
                });
            }, renderDuration, numberOfChannels, sampleRate);

            // 2b: Move Synth creation INSIDE the Offline callback or helper to ensure they bind to OfflineContext
            // Actually, `Tone.Offline` callback scope is the place where we create nodes.
            // My previous code block had synth creation inside loops? 
            // Previous code:
            /*
            const chunkBuffer = await Tone.Offline(async ({ transport }) => {
                 midiData.tracks.forEach(...) => {
                    const synth = new Tone.PolySynth...
                 }
            */
            // Yes, correct. I will fill in the synth creation logic below properly.


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
            signal?: AbortSignal
        },
        onProgress?: (progress: number, status: string) => void
    ) {
        if (!p5Instance || !midiData) throw new Error("Missing resources");

        // 0. Capture Original State to restore later (Defined outside try for scope visibility)
        const originalWidth = p5Instance.width;
        const originalHeight = p5Instance.height;
        const originalDensity = p5Instance.pixelDensity();

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
                audioBuffer = await this.renderAudio(midiData, (p) => {
                    const totalPercent = p / 5;
                    onProgress?.(totalPercent, `Rendering Audio... ${Math.round(p)}%`);
                }, options.signal);
            } else {
                onProgress?.(0, "Skipping Audio...");
            }

            // Note: The actual "OfflineRendering" (WebAudio) step is blackbox and might jump from 50% to done.

            // 2. Setup Video Muxer
            const muxer = new Muxer({
                target: new ArrayBufferTarget(),
                video: {
                    codec: 'avc', // H.264
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

            // 3. Prepare Canvas
            p5Instance.setManualMode(true);

            // Ensure 1:1 pixel mapping for export to avoid scaling artifacts and high-DPI issues
            p5Instance.pixelDensity(1);

            // Only resize if necessary to avoid context recreation flicker
            if (p5Instance.width !== width || p5Instance.height !== height) {
                p5Instance.resizeCanvas(width, height);
                // Wait for DOM update
                await new Promise(r => setTimeout(r, 100));
            }

            // Force a redraw to ensure context is active and backing store is allocated
            p5Instance.background(0); // Clear first
            p5Instance.redraw();
            await new Promise(r => setTimeout(r, 50));

            // 4. Video Encoding Loop
            // Re-fetch canvas in case resize replaced it
            const sourceCanvas = p5Instance.canvas; // p5.canvas is the HTMLCanvasElement

            // Validate Source Canvas
            if (!sourceCanvas || !(sourceCanvas instanceof HTMLCanvasElement)) {
                throw new Error("Failed to access P5 Canvas element");
            }

            // Create an intermediate canvas for stable encoding
            // This isolates us from P5's backing store / pixelDensity quirks
            let exportCanvas: HTMLCanvasElement | OffscreenCanvas;
            let exportCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

            // Force using standard HTML Canvas for stability over OffscreenCanvas
            // OffscreenCanvas can sometimes be detached or lose context in long processes or specific environments
            exportCanvas = document.createElement('canvas');
            exportCanvas.width = safeWidth;
            exportCanvas.height = safeHeight;
            exportCtx = (exportCanvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true });

            if (!exportCtx) throw new Error("Failed to create export canvas context");

            // Initialize canvas to prevent "Invalid source state" with empty/unallocated buffer
            exportCtx.fillStyle = '#000000';
            exportCtx.fillRect(0, 0, safeWidth, safeHeight);

            // Monitor errors to prevent finalizing broken files
            let encodingError: Error | null = null;


            const videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => {
                    console.error("VideoEncoder Error:", e);
                    encodingError = e instanceof Error ? e : new Error(String(e));
                }
            });

            const vConfig: VideoEncoderConfig = {
                codec: 'avc1.640033', // H.264 High Profile Level 5.1
                width: safeWidth,
                height: safeHeight,
                bitrate,
                framerate: fps,
                // Force software encoding to avoid hardware driver bugs/hangs at flush()
                hardwareAcceleration: 'prefer-software'
            };

            // Check support and fallback if necessary
            try {
                const support = await VideoEncoder.isConfigSupported(vConfig);
                if (!support.supported) {
                    console.warn("High Profile 5.1 (Software) not supported, trying default.");
                    // Remove specific constraints to let browser find best fit
                    delete vConfig.codec;
                    delete vConfig.hardwareAcceleration;
                    vConfig.codec = 'avc1.4d002a'; // Reset to Main 4.2 as backup
                }
            } catch (e) {
                console.warn("isConfigSupported check failed, proceeding with config anyway", e);
            }

            // Check if config is supported (optional but good practice, though we just rely on try/catch/error callback)
            // videoEncoder.configure(vConfig); 

            videoEncoder.configure(vConfig);

            // 5. Audio Encoding
            // Using mp4-muxer directly often isn't enough for raw audio data, 
            // usually we need AudioEncoder which is finicky in WebCodecs.
            // HOWEVER, mp4-muxer documentation says it takes EncodedAudioChunk.
            // We need an AudioEncoder.

            let audioEncoder: AudioEncoder | null = null;
            if (audioBuffer) {
                audioEncoder = new AudioEncoder({
                    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                    error: (e) => {
                        console.error("AudioEncoder Error:", e);
                        encodingError = e instanceof Error ? e : new Error(String(e));
                    }
                });
                audioEncoder.configure({
                    codec: 'mp4a.40.2', // AAC LC
                    sampleRate: audioBuffer.sampleRate,
                    numberOfChannels: audioBuffer.numberOfChannels,
                    bitrate: 128000
                });

                // Encode Audio Data
                // specific implementation to convert AudioBuffer to AudioData
                // This part deals with raw PCM to AudioData.

                // Create AudioData from buffer
                const numberOfChannels = audioBuffer.numberOfChannels;
                const length = audioBuffer.length;
                const sampleRate = audioBuffer.sampleRate;

                // ... (rest of audio encoding logic)


                // Interleave channel data? AudioData expects planar or interleaved?
                // AudioData init takes `data` which is BufferSource.
                // Format can be 'f32-planar'.

                // We need to construct AudioData chunks.
                // For simplicity, we can pass the whole buffer if small, or chunk it.
                // WebCodecs AudioData limit is usually high enough for reasonable clips, 
                // but 20MB+ might hang. Let's do it in 1 second chunks.

                const channelData = [];
                for (let i = 0; i < numberOfChannels; i++) {
                    channelData.push(audioBuffer.getChannelData(i));
                }

                // Create a single AudioData (if possible) or chunk it
                // Note: AudioData constructor is complex. 
                // Let's implement a loop.

                const chunkSize = sampleRate; // 1 second chunks
                let audioTimestamp = 0;

                for (let frame = 0; frame < length; frame += chunkSize) {
                    const size = Math.min(chunkSize, length - frame);
                    const data = new Float32Array(size * numberOfChannels);

                    // Interleave logic if needed, but 'f32-planar' means we pass planes sequentially?
                    // "The sequence of bytes... depends on format."
                    // f32-planar: all samples for channel 0, then all for channel 1...

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
                        timestamp: audioTimestamp * 1000000, // microseconds
                        data
                    });

                    audioEncoder.encode(audioData);
                    audioData.close();
                    audioTimestamp += size / sampleRate;
                }
            }

            // 6. Video Loop
            for (let i = 0; i < totalFrames; i++) {
                // Backpressure: Wait if encoder is overwhelmed (essential for software encoding)
                while (videoEncoder.encodeQueueSize > 5) {
                    await new Promise(r => setTimeout(r, 10));
                }

                if (options.signal?.aborted || encodingError) {
                    if (videoEncoder.state !== 'closed') videoEncoder.close();
                    if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
                    throw encodingError || new Error("Export Aborted");
                }
                const time = i / fps;
                p5Instance.renderFrame(time);

                // Draw to intermediate canvas
                if (exportCtx) {
                    exportCtx.drawImage(sourceCanvas, 0, 0, safeWidth, safeHeight);
                }

                // Update progress
                if (i % 60 === 0) {
                    const percent = (i / totalFrames) * 100;
                    onProgress?.(percent, `Rendering Frame ${i}/${totalFrames}`);
                    // Yield to event loop to update UI
                    await new Promise(r => setTimeout(r, 0));

                    // CRITICAL: Check abort again after yield
                    if (options.signal?.aborted || encodingError) {
                        if (videoEncoder.state !== 'closed') videoEncoder.close();
                        if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
                        throw encodingError || new Error("Export Aborted");
                    }
                }

                // Capture Frame from INTERMEDIATE canvas
                // Capture Frame from INTERMEDIATE canvas
                let frame: VideoFrame | null = null;
                try {
                    frame = new VideoFrame(exportCanvas, {
                        timestamp: (i / fps) * 1000000 // microseconds
                    });
                } catch (err) {
                    console.error("Frame creation failed at index " + i, err);
                    // Skip frame or abort? Skipping might desync. Abort is safer?
                    // But maybe it's just a one-off glitch. 
                    // Let's abort to be safe as user wants valid output.
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
                downloadBlob(new Blob([buffer], { type: 'video/mp4' }), "midi_export.mp4");
            }

        } finally {
            // Cleanup
            p5Instance.setManualMode(false);

            // Restore original canvas state
            try {
                if (typeof originalDensity !== 'undefined') p5Instance.pixelDensity(originalDensity);
                if (originalWidth && originalHeight) {
                    p5Instance.resizeCanvas(originalWidth, originalHeight);
                }
                // Force one redraw to reset visuals
                p5Instance.redraw();
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
        if (!p5Instance || !midiData) throw new Error("Missing resources");

        const { width, height, fps } = options;
        const duration = midiData.duration + 2;
        const bitrate = options.bitrate || 5e6;

        // Save original state
        const originalWidth = p5Instance.width;
        const originalHeight = p5Instance.height;
        const wasPlaying = useStore.getState().isPlaying;

        try {
            onProgress?.(0, "准备实时录制...");

            // 1. Stop current playback if any
            if (wasPlaying) {
                const { audioEngine } = await import('@/audio/AudioEngine');
                audioEngine.pause();
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
                    throw new Error("浏览器不支持视频录制");
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
                recordingError = new Error("录制出错");
            };

            // 6. Setup playback
            onProgress?.(0, "开始实时录制...");

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
                onProgress?.(progress, `实时录制中... ${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s`);

                if (elapsed >= duration) {
                    clearInterval(progressInterval);
                    mediaRecorder.stop();
                }
            }, 100);

            // 8. Wait for recording to complete
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("录制超时"));
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
                        reject(new Error("录制已取消"));
                    });
                }
            });

            if (recordingError) {
                throw recordingError;
            }

            // 10. Stop playback
            const { audioEngine: audioEngineStop } = await import('@/audio/AudioEngine');
            audioEngineStop.pause();
            useStore.getState().setIsPlaying(false);
            Tone.getDestination().disconnect(audioDestination);

            // 11. Create final file
            onProgress?.(100, "保存文件...");

            if (chunks.length === 0) {
                throw new Error("未捕获到任何数据，录制失败");
            }

            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size === 0) {
                throw new Error("录制的文件为空（0字节）");
            }

            downloadBlob(blob, "midi_export_realtime.webm");

            // 12. Restore canvas
            p5Instance.setManualMode(true);
            if (originalWidth && originalHeight) {
                p5Instance.resizeCanvas(originalWidth, originalHeight);
            }

        } catch (e) {
            // Cleanup on error
            const { audioEngine } = await import('@/audio/AudioEngine');
            if (useStore.getState().isPlaying) {
                audioEngine.pause();
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
                const { audioEngine } = await import('@/audio/AudioEngine');
                await new Promise(r => setTimeout(r, 200));
                audioEngine.play();
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
            signal?: AbortSignal
        },
        onProgress?: (progress: number, status: string) => void
    ) {
        const { width, height, fps } = options;
        const duration = midiData.duration + 2;
        const totalFrames = Math.ceil(duration * fps);
        const zip = new JSZip();

        try {
            p5Instance.setManualMode(true);
            p5Instance.resizeCanvas(width, height);

            for (let i = 0; i < totalFrames; i++) {
                if (options.signal?.aborted) throw new Error("Export Aborted");

                const time = i / fps;
                p5Instance.renderFrame(time);

                // Update progress
                if (i % 30 === 0) {
                    const percent = (i / totalFrames) * 100;
                    onProgress?.(percent, `Saving Frame ${i}/${totalFrames}`);
                    await new Promise(r => setTimeout(r, 0));
                }

                // Capture Blob
                const blob = await new Promise<Blob | null>(resolve =>
                    p5Instance.canvas.toBlob(resolve, 'image/png')
                );

                if (blob) {
                    const filename = `frame_${String(i).padStart(5, '0')}.png`;
                    zip.file(filename, blob);
                }
            }

            onProgress?.(100, "Zipping...");
            const content = await zip.generateAsync({ type: "blob" });
            downloadBlob(content, "frames.zip");

        } finally {
            p5Instance.setManualMode(false);
        }
    }
}
