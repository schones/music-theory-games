// music-engine.js — MusicEngine wrapping Tone.Transport with instrument pooling

export class MusicEngine {
  constructor() {
    this._started = false;
    this._instruments = {};
    this._volume = null;
    this._scheduledIds = [];
    this._onBeatCallback = null;
    this._beatLoopId = null;
  }

  async ensureTone() {
    if (this._started) return;
    await Tone.start();
    this._volume = new Tone.Volume(0).toDestination();
    this._createInstruments();
    this._started = true;
  }

  _createInstruments() {
    // Drums — short percussive synths
    this._instruments.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      volume: -4,
    }).connect(this._volume);

    this._instruments.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
      volume: -8,
    }).connect(this._volume);

    this._instruments.hihat = new Tone.MetalSynth({
      frequency: 400,
      envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -16,
    }).connect(this._volume);

    // Bass — monophonic deep synth
    this._instruments.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
      filterEnvelope: {
        attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3,
        baseFrequency: 80, octaves: 2.5,
      },
      volume: -6,
    }).connect(this._volume);

    // Melody — bright synth
    this._instruments.melody = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5 },
      volume: -8,
    }).connect(this._volume);

    // Chords — polyphonic for playing triads
    this._instruments.chords = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.8 },
      volume: -10,
    }).connect(this._volume);
  }

  // --- Transport controls ---

  setBpm(bpm) {
    Tone.Transport.bpm.value = bpm;
  }

  getBpm() {
    return Tone.Transport.bpm.value;
  }

  setVolume(db) {
    if (this._volume) this._volume.volume.value = db;
  }

  start() {
    Tone.Transport.start();
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this._scheduledIds = [];
    this._stopBeatLoop();
  }

  // --- Scheduling API (called by compiled music code) ---

  scheduleKick(time, note) {
    note = note || 'C1';
    const id = Tone.Transport.schedule((t) => {
      this._instruments.kick.triggerAttackRelease(note, '8n', t);
    }, time);
    this._scheduledIds.push(id);
  }

  scheduleSnare(time) {
    const id = Tone.Transport.schedule((t) => {
      this._instruments.snare.triggerAttackRelease('8n', t);
    }, time);
    this._scheduledIds.push(id);
  }

  scheduleHihat(time) {
    const id = Tone.Transport.schedule((t) => {
      this._instruments.hihat.triggerAttackRelease('C4', '32n', t);
    }, time);
    this._scheduledIds.push(id);
  }

  scheduleBass(note, duration, time) {
    const id = Tone.Transport.schedule((t) => {
      this._instruments.bass.triggerAttackRelease(note, duration, t);
    }, time);
    this._scheduledIds.push(id);
  }

  scheduleMelody(note, duration, time) {
    const id = Tone.Transport.schedule((t) => {
      this._instruments.melody.triggerAttackRelease(note, duration, t);
    }, time);
    this._scheduledIds.push(id);
  }

  scheduleChord(notes, duration, time) {
    const id = Tone.Transport.schedule((t) => {
      this._instruments.chords.triggerAttackRelease(notes, duration, t);
    }, time);
    this._scheduledIds.push(id);
  }

  // --- Loop scheduling (repeating patterns) ---

  scheduleLoop(callback, interval) {
    const id = Tone.Transport.scheduleRepeat((t) => {
      callback(t);
    }, interval);
    this._scheduledIds.push(id);
    return id;
  }

  // --- Beat indicator callback ---

  onBeat(callback) {
    this._onBeatCallback = callback;
  }

  startBeatLoop() {
    this._stopBeatLoop();
    this._beatLoopId = Tone.Transport.scheduleRepeat((time) => {
      Tone.Draw.schedule(() => {
        if (this._onBeatCallback) this._onBeatCallback();
      }, time);
    }, '4n');
  }

  _stopBeatLoop() {
    if (this._beatLoopId !== null) {
      Tone.Transport.clear(this._beatLoopId);
      this._beatLoopId = null;
    }
  }

  // --- Cleanup ---

  destroy() {
    this.stop();
    for (const key in this._instruments) {
      try { this._instruments[key].dispose(); } catch (e) { /* ignore */ }
    }
    this._instruments = {};
    try { this._volume.dispose(); } catch (e) { /* ignore */ }
    this._started = false;
  }
}
