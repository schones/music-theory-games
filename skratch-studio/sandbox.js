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
  }

  run(code) {
    this.stop();
    this.clearError();
    this._trailMode = false;

    // Check for trail mode flag in generated code
    if (code.includes('__TRAIL_MODE__')) {
      this._trailMode = true;
      code = code.replace(/\/\/\s*__TRAIL_MODE__\s*\n?/g, '');
    }

    try {
      // Build a function with drawing API locals injected
      // Explicitly do NOT expose window, document, fetch, eval, etc.
      this._compiledFn = new Function(
        'circle', 'rect', 'ellipse', 'triangle', 'line', 'star',
        'fill', 'stroke', 'noFill', 'noStroke', 'strokeWeight', 'background',
        'push', 'pop', 'translate', 'rotate', 'scale',
        'map', 'lerp', 'random', 'constrain', 'dist',
        'width', 'height', 'frameCount', 'mouseX', 'mouseY',
        'Math', 'PI',
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
      this._rafId = requestAnimationFrame(loop);
    };

    loop();
  }

  _executeFrame() {
    const a = this.api;
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
      Math, Math.PI
    );
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
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
