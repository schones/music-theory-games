// audio-bridge.js — Connects Tone.js and mic pitch detection to the Skratch Studio sandbox

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
    this.synth = null;
    this._effects = [];
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
    // Dispose old synth and effects
    if (this.synth) {
      try { this.synth.releaseAll(); } catch (_) {}
      this.synth.dispose();
    }
    for (const fx of this._effects) fx.dispose();
    this._effects = [];

    const preset = SOUND_PRESETS[this._soundType] || SOUND_PRESETS.piano;

    this.synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      volume: -6,
      ...preset.options,
    });

    if (preset.buildEffects) {
      this._effects = preset.buildEffects();
      this.synth.chain(...this._effects, Tone.Destination);
    } else {
      this.synth.toDestination();
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
    this.synth.triggerAttackRelease(noteName, '8n');

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
    this.synth.triggerAttack(noteName);

    this.state.lastNotePlayed = noteName;
    this.state.noteIsPlaying = true;
    this.state.currentNoteName = noteName;
    this._fireNoteCallbacks();
  }

  noteOff(noteName) {
    if (!this._toneStarted || !this.synth) return;
    this._activeNotes.delete(noteName);

    if (this._sustain) {
      this._sustainedNotes.add(noteName);
    } else {
      this.synth.triggerRelease(noteName);
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
    if (this._sustainedNotes.size > 0 && this.synth) {
      const notes = [...this._sustainedNotes];
      this._sustainedNotes.clear();
      this.synth.triggerRelease(notes);
    }
    if (this._activeNotes.size === 0) {
      this.state.noteIsPlaying = false;
    }
  }

  releaseAll() {
    this._activeNotes.clear();
    this._sustainedNotes.clear();
    this._sustain = false;
    if (this.synth) this.synth.releaseAll();
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
    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }
    for (const fx of this._effects) fx.dispose();
    this._effects = [];
    this._toneStarted = false;
  }
}
