import * as Tone from 'tone';
import JZZ from 'jzz';
import useStore from '@/store/useStore';
import { SoundFontAdapter } from '../utils/SoundFontAdapter';

class AudioEngine {
  constructor() {
    this.synths = [];
    this.parts = [];
    this.ccParts = [];
    this.isLoaded = false;
    this.baseVolume = -12;
    this.midiOutPort = null;
    this.trackChannels = [];
    this.cachedInstrumentCodes = [];

    this.userMutedIndices = [];
    this.soloIndex = null;

    // Cache
    this.useInternal = true;
    useStore.subscribe((state) => {
      this.useInternal = state.useInternalAudio;
    });

    this.initJZZ();
  }

  async initJZZ() {
    try {
      const midi = await JZZ();
      const info = midi.info();
      const outputs = info.outputs || [];
      if (useStore.getState && useStore.getState().autoSelectMidiDevice) {
        const targetId = useStore.getState().autoSelectMidiDevice(outputs);
        if (targetId) this.selectMidiOutput(targetId);
      } else {
        if (useStore.getState().setMidiOutputs) {
          useStore.getState().setMidiOutputs(outputs);
        }
      }
    } catch (e) {
      console.warn("[AudioEngine] JZZ Error:", e);
    }
  }

  async selectMidiOutput(name) {
    if (this.midiOutPort) { try { this.midiOutPort.close(); } catch (e) { } }
    if (!name || name === 'none') { this.midiOutPort = null; return; }
    try {
      this.midiOutPort = await JZZ().openMidiOut(name);
      this.resendProgramChanges();
    } catch (e) { console.error(`[AudioEngine] Failed: ${name}`, e); }
  }

  resendProgramChanges() {
    if (!this.midiOutPort) return;
    this.trackChannels.forEach((channel, trackIndex) => {
      const program = this.cachedInstrumentCodes[trackIndex];
      if (program !== undefined) {
        try { this.midiOutPort.program(channel, program); } catch (e) { }
      }
    });
  }

  async ensureContext() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
      await Tone.context.resume();
    }
  }

  setMasterVolume(db) {
    if (Tone.Destination && Tone.Destination.volume) {
      Tone.Destination.volume.rampTo(Math.max(-60, Math.min(0, db)), 0.1);
    }
  }

  setMute(muted) { if (Tone.Destination) Tone.Destination.mute = muted; }

  refreshVolumes() {
    if (!this.isLoaded) return;
    this.synths.forEach((synth, i) => {
      let shouldPlay = true;
      if (this.soloIndex !== null) shouldPlay = (i === this.soloIndex);
      else shouldPlay = !this.userMutedIndices.includes(i);

      if (synth && !synth.disposed) {
        synth.volume.rampTo(shouldPlay ? this.baseVolume : -Infinity, 0.1);
      }
    });
  }

  updateTrackMuteState(mutedIndices) {
    this.userMutedIndices = mutedIndices;
    this.refreshVolumes();
  }

  soloTrack(trackIndex) {
    if (this.soloIndex === trackIndex) this.soloIndex = null;
    else this.soloIndex = trackIndex;
    this.refreshVolumes();
  }

  unmuteAll() {
    this.soloIndex = null;
    this.refreshVolumes();
  }

  async loadMidi(midiData) {
    this.stop();
    this.cleanup();
    if (!midiData) return;

    this.userMutedIndices = [];
    this.soloIndex = null;
    this.useInternal = useStore.getState().useInternalAudio;

    try {
      if (midiData.header.tempos.length > 0) Tone.Transport.bpm.value = midiData.header.tempos[0].bpm;
      else Tone.Transport.bpm.value = 120;
      if (midiData.header.timeSignatures.length > 0) Tone.Transport.timeSignature = midiData.header.timeSignatures[0].timeSignature;
    } catch (e) { }

    this.trackChannels = new Array(midiData.tracks.length).fill(0);
    this.cachedInstrumentCodes = new Array(midiData.tracks.length).fill(0);

    // Pre-allocate arrays to ensure index stability with async loading
    this.synths = new Array(midiData.tracks.length).fill(null);
    this.parts = new Array(midiData.tracks.length).fill(null);
    this.ccParts = [];

    let melodyChannelPtr = 0;

    // Loop 1: Sync cleanup and channel assignment
    midiData.tracks.forEach((track, i) => {
      this.cachedInstrumentCodes[i] = track.instrument.number;
      if (track.instrument.percussion) {
        this.trackChannels[i] = 9;
      } else {
        if (melodyChannelPtr === 9) melodyChannelPtr++;
        this.trackChannels[i] = melodyChannelPtr % 16;
        melodyChannelPtr++;
      }
    });

    this.resendProgramChanges();

    // Loop 2: Async loading of instruments
    await Promise.all(midiData.tracks.map(async (track, trackIndex) => {
      // Optimize CC Handling: Consolidate events for Tone.Part efficiency
      if (track.controlChanges) {
        const combinedCCs = [];
        Object.keys(track.controlChanges).forEach(ccKey => {
          const ccNum = parseInt(ccKey);
          const events = track.controlChanges[ccKey];
          events.forEach(e => {
            combinedCCs.push({
              time: e.time,
              cc: ccNum,
              value: e.value
            });
          });
        });

        // Sort by time is critical for Tone.Part
        combinedCCs.sort((a, b) => a.time - b.time);

        if (combinedCCs.length > 0) {
          const ccPart = new Tone.Part((time, event) => {
            const val7bit = Math.round(event.value * 127);

            // Store Update (Only for specific CCs to save CPU)
            if (event.cc === 64) useStore.getState().setPedalActive(val7bit >= 64);

            // External MIDI
            if (this.midiOutPort) {
              const channel = this.trackChannels[trackIndex];
              try { this.midiOutPort.control(channel, event.cc, val7bit); } catch (e) { }
            }
          }, combinedCCs).start(0);
          this.ccParts.push(ccPart);
        }
      }

      if (track.notes.length === 0) {
        this.synths[trackIndex] = null;
        this.parts[trackIndex] = null;
        return;
      }

      const isSoundFontLoaded = useStore.getState().isSoundFontLoaded;
      let synth = null;
      const uniqueNotes = [...new Set(track.notes.map(n => n.midi))];

      if (isSoundFontLoaded) {
        try {
          const program = (track.instrument && track.instrument.number) || 0;
          const isPercussion = !!track.instrument.percussion;
          // Updated to await async call
          const options = await SoundFontAdapter.getSamplerOptions(program, isPercussion, Tone.context, uniqueNotes);

          if (options && options.urls && Object.keys(options.urls).length > 0) {
            // We use onload to track loading state if needed, but for now we trust Tone.loaded() or error handling
            synth = new Tone.Sampler(options).toDestination();
          }
        } catch (e) {
          console.warn("SF2 Sampler failed", e);
        }
      }

      if (!synth) {
        synth = new Tone.PolySynth(Tone.Synth, {
          maxPolyphony: 32,
          options: { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 } }
        }).toDestination();
      }

      if (synth) {
        synth.volume.value = this.baseVolume;
        this.synths[trackIndex] = synth; // Assign by index
      } else {
        // Fallback safety
        this.synths[trackIndex] = null;
      }

      const notes = track.notes.map(note => ({
        time: Math.max(0, note.time),
        note: note.name,
        midi: note.midi,
        duration: Math.max(0.05, note.duration),
        velocity: note.velocity
      }));

      const part = new Tone.Part((time, value) => {
        let shouldPlay = true;
        if (this.soloIndex !== null) shouldPlay = (trackIndex === this.soloIndex);
        else shouldPlay = !this.userMutedIndices.includes(trackIndex);

        if (!shouldPlay) return;

        if (this.useInternal && synth && !synth.disposed) {
          try {
            synth.triggerAttackRelease(value.note, value.duration, time, value.velocity);
          } catch (e) {
            // Suppress buffer not loaded error to prevent crash
            if (e && e.message && e.message.includes('buffer')) return;
            console.warn("[AudioEngine] Playback Error:", e);
          }
        }

        if (this.midiOutPort) {
          const channel = this.trackChannels[trackIndex];
          try {
            this.midiOutPort.note(channel, value.midi, Math.round(value.velocity * 127), value.duration * 1000);
          } catch (e) { }
        }
      }, notes).start(0);

      this.parts[trackIndex] = part; // Assign by index
    }));

    // Optional: await Tone.loaded(); 
    // Wait for samples to start loading at least

    this.isLoaded = true;
    console.log(`[AudioEngine] Loaded (Async).`);
  }

  play() {
    if (!this.isLoaded) return;
    this.ensureContext().then(() => {
      this.resendProgramChanges();
      if (Tone.Transport.state !== 'started') Tone.Transport.start();
    });
  }

  pause() { Tone.Transport.pause(); this.allNotesOff(); }
  stop() {
    Tone.Transport.stop();
    this.synths.forEach(s => { if (s && !s.disposed) s.releaseAll(); });
    this.allNotesOff();
    useStore.getState().setPedalActive(false);
  }
  allNotesOff() { if (this.midiOutPort) { try { for (let c = 0; c < 16; c++) this.midiOutPort.allNotesOff(c); } catch (e) { } } }
  seek(seconds) { if (this.isLoaded) { Tone.Transport.seconds = Math.max(0, seconds); this.allNotesOff(); } }
  cleanup() {
    this.parts.forEach(p => { if (p) { try { p.stop(); p.dispose(); } catch (e) { } } });
    this.ccParts.forEach(p => { if (p) { try { p.stop(); p.dispose(); } catch (e) { } } });
    this.synths.forEach(s => { if (s) { try { s.dispose(); } catch (e) { } } });
    this.parts = []; this.ccParts = []; this.synths = []; this.trackChannels = [];
    this.isLoaded = false;
  }
}


let instance = null;

export const getAudioEngine = () => {
  if (!instance) {
    instance = new AudioEngine();
  }
  return instance;
};

// Singleton accessor

