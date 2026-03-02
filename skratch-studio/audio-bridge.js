// audio-bridge.js — Connects Tone.js and mic pitch detection to the Skratch Studio sandbox
//
// Voice architecture: Instead of Tone.PolySynth (which has voice-tracking issues
// with fat oscillator types like fatsine/fatsawtooth), we manage individual
// Tone.Synth instances per note. All voices connect to a shared output bus that
// routes through the preset's effects chain. This guarantees sustain pedal works
// for all instrument types — we simply don't call triggerRelease() while sustain
// is on, and each voice's oscillator keeps running independently.

import { startPitchDetection, stopPitchDetection, frequencyToNote } from '../shared/audio.js';

const SOUND_PRESETS = {
  piano: {
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.6 },
    },
  },
  organ: {
    options: {
      oscillator: { type: 'fatsine', spread: 20, count: 3 },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.95, release: 0.3 },
    },
    buildEffects() {
      const dist = new Tone.Distortion(0.15);
      const trem = new Tone.Tremolo(5.5, 0.35).start();
      return [dist, trem];
    },
  },
  synth: {
    options: {
      oscillator: { type: 'fatsawtooth', spread: 30, count: 3 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
    },
    buildEffects() {
      const filt = new Tone.Filter(2500, 'lowpass');
      return [filt];
    },
  },
};

export class AudioBridge {
  constructor() {
    this._outputBus = null;
    this._effects = [];
    this._voiceMap = new Map();   // noteName → Tone.Synth instance
    this._voiceOptions = {};
    this._toneStarted = false;
    this._micActive = false;
    this._rafId = null;
    this._onNoteCallbacks = [];
    this._lastDetectedNote = '--';
    this._soundType = 'piano';

    // Sustain pedal state
    this._sustain = false;
    this._activeNotes = new Set();
    this._sustainedNotes = new Set();

    // Shared audio state — read by the sandbox each frame
    this.state = {
      currentPitch: 0,
      currentNoteName: '--',
      currentVolume: 0,
      noteIsPlaying: false,
      lastNotePlayed: '--',
    };
  }

  async ensureTone() {
    if (this._toneStarted) return;
    if (typeof Tone === 'undefined') {
      throw new Error('Tone.js not loaded');
    }
    await Tone.start();
    this._buildSynth();
    this._toneStarted = true;
  }

  _buildSynth() {
    // Dispose all existing voices, effects, and output bus
    this._disposeAll();

    const preset = SOUND_PRESETS[this._soundType] || SOUND_PRESETS.piano;
    this._voiceOptions = preset.options;

    // Shared output bus — all per-note voices connect here
    this._outputBus = new Tone.Volume(-6);

    if (preset.buildEffects) {
      this._effects = preset.buildEffects();
      this._outputBus.chain(...this._effects, Tone.Destination);
    } else {
      this._outputBus.toDestination();
    }
  }

  /** Create an individual Tone.Synth voice connected to the output bus. */
  _createVoice() {
    const synth = new Tone.Synth(this._voiceOptions);
    synth.connect(this._outputBus);
    return synth;
  }

  /** Release a voice by note name and schedule its disposal after the release phase. */
  _releaseVoice(noteName) {
    const voice = this._voiceMap.get(noteName);
    if (!voice) return;
    this._voiceMap.delete(noteName);
    try { voice.triggerRelease(); } catch (_) {}
    // Dispose after the release envelope completes (with generous margin)
    const releaseMs = ((this._voiceOptions.envelope && this._voiceOptions.envelope.release) || 1) * 1000 + 500;
    setTimeout(() => {
      try { voice.disconnect(); voice.dispose(); } catch (_) {}
    }, releaseMs);
  }

  /** Dispose all voices, effects, and output bus. */
  _disposeAll() {
    if (this._voiceMap) {
      for (const [, voice] of this._voiceMap) {
        try { voice.disconnect(); voice.dispose(); } catch (_) {}
      }
      this._voiceMap.clear();
    }
    for (const fx of this._effects) {
      try { fx.dispose(); } catch (_) {}
    }
    this._effects = [];
    if (this._outputBus) {
      try { this._outputBus.dispose(); } catch (_) {}
      this._outputBus = null;
    }
  }

  setSoundType(type) {
    if (!SOUND_PRESETS[type] || type === this._soundType) return;
    this._soundType = type;
    if (this._toneStarted) {
      this.releaseAll();
      this._buildSynth();
    }
  }

  async playNote(noteName) {
    await this.ensureTone();
    const voice = this._createVoice();
    voice.triggerAttackRelease(noteName, '8n');
    // Auto-dispose after note finishes
    setTimeout(() => {
      try { voice.disconnect(); voice.dispose(); } catch (_) {}
    }, 2000);

    this.state.lastNotePlayed = noteName;
    this.state.noteIsPlaying = true;
    this.state.currentNoteName = noteName;

    this._fireNoteCallbacks();

    clearTimeout(this._noteTimeout);
    this._noteTimeout = setTimeout(() => {
      this.state.noteIsPlaying = false;
    }, 300);
  }

  async noteOn(noteName) {
    await this.ensureTone();
    if (this._activeNotes.has(noteName)) return;

    this._activeNotes.add(noteName);
    this._sustainedNotes.delete(noteName);

    // If a voice already exists for this note (e.g., sustained), release it first
    if (this._voiceMap.has(noteName)) {
      const old = this._voiceMap.get(noteName);
      this._voiceMap.delete(noteName);
      try { old.triggerRelease(); } catch (_) {}
      setTimeout(() => { try { old.disconnect(); old.dispose(); } catch (_) {} }, 1000);
    }

    // Create a dedicated voice for this note
    const voice = this._createVoice();
    this._voiceMap.set(noteName, voice);
    voice.triggerAttack(noteName);

    this.state.lastNotePlayed = noteName;
    this.state.noteIsPlaying = true;
    this.state.currentNoteName = noteName;
    this._fireNoteCallbacks();
  }

  noteOff(noteName) {
    if (!this._toneStarted || !this._outputBus) return;
    this._activeNotes.delete(noteName);

    if (this._sustain) {
      // Note's voice stays alive — just track it as sustained
      this._sustainedNotes.add(noteName);
    } else {
      this._releaseVoice(noteName);
    }

    if (this._activeNotes.size === 0 && this._sustainedNotes.size === 0) {
      this.state.noteIsPlaying = false;
    }
  }

  sustainOn() {
    this._sustain = true;
  }

  sustainOff() {
    this._sustain = false;
    if (this._sustainedNotes.size > 0) {
      for (const note of this._sustainedNotes) {
        this._releaseVoice(note);
      }
      this._sustainedNotes.clear();
    }
    if (this._activeNotes.size === 0) {
      this.state.noteIsPlaying = false;
    }
  }

  releaseAll() {
    this._activeNotes.clear();
    this._sustainedNotes.clear();
    this._sustain = false;
    if (this._voiceMap && this._voiceMap.size > 0) {
      // Snapshot keys to avoid mutation during iteration
      const notes = [...this._voiceMap.keys()];
      for (const note of notes) {
        this._releaseVoice(note);
      }
    }
    this.state.noteIsPlaying = false;
  }

  async startMic() {
    if (this._micActive) return;
    await this.ensureTone();
    this._micActive = true;

    // Use shared/audio.js pitch detection
    await startPitchDetection((freq, noteInfo) => {
      if (!this._micActive) return;

      if (freq > 0 && noteInfo) {
        const noteName = noteInfo.fullName;
        this.state.currentPitch = Math.round(freq);
        this.state.currentNoteName = noteName;
        this.state.noteIsPlaying = true;
        this.state.currentVolume = 70;

        if (noteName !== this._lastDetectedNote) {
          this._lastDetectedNote = noteName;
          this.state.lastNotePlayed = noteName;
          this._fireNoteCallbacks();
        }
      } else {
        this.state.currentPitch = 0;
        this.state.currentNoteName = '--';
        this.state.noteIsPlaying = false;
        this.state.currentVolume = 0;
        this._lastDetectedNote = '--';
      }
    });
  }

  stopMic() {
    this._micActive = false;
    stopPitchDetection();
    this.state.currentPitch = 0;
    this.state.currentNoteName = '--';
    this.state.noteIsPlaying = false;
    this.state.currentVolume = 0;
    this._lastDetectedNote = '--';
  }

  onNotePlayed(callback) {
    this._onNoteCallbacks.push(callback);
  }

  clearNoteCallbacks() {
    this._onNoteCallbacks = [];
  }

  _fireNoteCallbacks() {
    for (const cb of this._onNoteCallbacks) {
      try { cb(); } catch (e) { /* sandbox error — ignore */ }
    }
  }

  destroy() {
    this.stopMic();
    this.clearNoteCallbacks();
    this.releaseAll();
    clearTimeout(this._noteTimeout);
    this._disposeAll();
    this._toneStarted = false;
  }
}
