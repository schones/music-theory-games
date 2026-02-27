// audio-bridge.js — Connects Tone.js and mic pitch detection to the Skratch Studio sandbox

import { startPitchDetection, stopPitchDetection, frequencyToNote } from '../shared/audio.js';

export class AudioBridge {
  constructor() {
    this.synth = null;
    this._toneStarted = false;
    this._micActive = false;
    this._rafId = null;
    this._onNoteCallbacks = [];
    this._lastDetectedNote = '--';

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
    this.synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.6 },
      volume: -6,
    }).toDestination();
    this._toneStarted = true;
  }

  async playNote(noteName) {
    await this.ensureTone();
    this.synth.triggerAttackRelease(noteName, '8n');

    this.state.lastNotePlayed = noteName;
    this.state.noteIsPlaying = true;
    this.state.currentNoteName = noteName;

    // Fire note callbacks
    this._fireNoteCallbacks();

    // Clear noteIsPlaying after the note duration
    clearTimeout(this._noteTimeout);
    this._noteTimeout = setTimeout(() => {
      this.state.noteIsPlaying = false;
    }, 300);
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

        // Estimate volume from pitch confidence (simple: use freq > 0 as "playing")
        // Real volume requires analyser — approximate with a fixed value when pitch detected
        this.state.currentVolume = 70;

        // Fire callbacks on note change
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
    clearTimeout(this._noteTimeout);
    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }
    this._toneStarted = false;
  }
}
