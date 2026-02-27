// sandbox.js — Safe execution of generated Blockly code

import { DrawingAPI } from './drawing-api.js';

export class Sandbox {
  constructor(canvas, errorEl) {
    this.canvas = canvas;
    this.errorEl = errorEl;
    this.api = new DrawingAPI(canvas);
    this._rafId = null;
    this._running = false;
    this._compiledFn = null;
    this._trailMode = false;

    // Audio integration
    this.audioState = null;
    this._noteCallbacks = [];
    this._beatTimers = [];
    this._bpm = 120;
  }

  setAudioState(audioState) {
    this.audioState = audioState;
  }

  setBpm(bpm) {
    this._bpm = bpm;
  }

  fireNoteCallbacks() {
    for (const cb of this._noteCallbacks) {
      try { cb(); } catch (e) { /* ignore sandbox callback errors */ }
    }
  }

  run(code) {
    this.stop();
    this.clearError();
    this._trailMode = false;
    this._noteCallbacks = [];
    this._beatTimers = [];

    // Check for trail mode flag in generated code
    if (code.includes('__TRAIL_MODE__')) {
      this._trailMode = true;
      code = code.replace(/\/\/\s*__TRAIL_MODE__\s*\n?/g, '');
    }

    try {
      // Build a function with drawing API locals + audio variables injected
      this._compiledFn = new Function(
        'circle', 'rect', 'ellipse', 'triangle', 'line', 'star',
        'fill', 'stroke', 'noFill', 'noStroke', 'strokeWeight', 'background',
        'push', 'pop', 'translate', 'rotate', 'scale',
        'map', 'lerp', 'random', 'constrain', 'dist',
        'width', 'height', 'frameCount', 'mouseX', 'mouseY',
        'Math', 'PI',
        // Audio variables
        'currentPitch', 'currentNoteName', 'currentVolume', 'noteIsPlaying',
        'onNotePlayed', 'everyNBeats',
        code
      );
    } catch (e) {
      this.showError(e.message);
      this._compiledFn = null;
    }
  }

  startLoop() {
    if (!this._compiledFn) return;
    this._running = true;
    this.api.frameCount = 0;

    const loop = () => {
      if (!this._running) return;
      try {
        this._executeFrame();
      } catch (e) {
        this.showError(e.message);
        this.stop();
        return;
      }
      this.api._incrementFrame();
      this._updateBeatTimers();
      this._rafId = requestAnimationFrame(loop);
    };

    loop();
  }

  _executeFrame() {
    const a = this.api;
    const audio = this.audioState || {};

    // onNotePlayed registers callbacks; everyNBeats registers beat timers
    const self = this;
    const onNotePlayed = (cb) => { self._noteCallbacks.push(cb); };
    const everyNBeats = (beats, cb) => {
      const framesPerBeat = 60 / (self._bpm / 60);
      self._beatTimers.push({ interval: Math.round(beats * framesPerBeat), cb, lastFired: 0 });
    };

    this._compiledFn(
      a.circle.bind(a), a.rect.bind(a), a.ellipse.bind(a),
      a.triangle.bind(a), a.line.bind(a), a.star.bind(a),
      a.fill.bind(a), a.stroke.bind(a), a.noFill.bind(a),
      a.noStroke.bind(a), a.strokeWeight.bind(a), a.background.bind(a),
      a.push.bind(a), a.pop.bind(a), a.translate.bind(a),
      a.rotate.bind(a), a.scale.bind(a),
      a.map.bind(a), a.lerp.bind(a), a.random.bind(a),
      a.constrain.bind(a), a.dist.bind(a),
      a.width, a.height, a.frameCount, a.mouseX, a.mouseY,
      Math, Math.PI,
      // Audio state values
      audio.currentPitch || 0,
      audio.currentNoteName || '--',
      audio.currentVolume || 0,
      audio.noteIsPlaying || false,
      onNotePlayed, everyNBeats
    );
  }

  _updateBeatTimers() {
    const frame = this.api.frameCount;
    for (const timer of this._beatTimers) {
      if (timer.interval > 0 && frame > 0 && (frame - timer.lastFired) >= timer.interval) {
        timer.lastFired = frame;
        try { timer.cb(); } catch (e) { /* ignore */ }
      }
    }
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._noteCallbacks = [];
    this._beatTimers = [];
  }

  destroy() {
    this.stop();
    this._compiledFn = null;
  }

  showError(msg) {
    if (this.errorEl) {
      this.errorEl.textContent = 'Error: ' + msg;
      this.errorEl.hidden = false;
    }
  }

  clearError() {
    if (this.errorEl) {
      this.errorEl.textContent = '';
      this.errorEl.hidden = true;
    }
  }
}
