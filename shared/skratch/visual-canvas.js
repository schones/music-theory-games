// ============================================================
//  VisualCanvas — overlay canvas for rendering particle effects
//  shared/skratch/visual-canvas.js
// ============================================================

import { Particle } from './particle.js';
import { EFFECT_PRESETS } from './effects.js';

/**
 * Pick a random value. If `v` is an array [min, max], returns a
 * uniform random in that range. Otherwise returns `v` as-is.
 */
function rand(v) {
  if (Array.isArray(v)) return v[0] + Math.random() * (v[1] - v[0]);
  return v;
}

/** Pick a random element from an array. */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class VisualCanvas {
  /**
   * @param {HTMLElement} container — the element to overlay
   */
  constructor(container) {
    this.container = container;
    this.particles = [];
    this._raf = null;
    this._lastTime = 0;
    this._destroyed = false;

    // Ensure the container can serve as a positioning anchor
    const pos = getComputedStyle(container).position;
    if (pos === 'static') container.style.position = 'relative';

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);

    // Size to container
    this._resize = this._handleResize.bind(this);
    this._ro = new ResizeObserver(this._resize);
    this._ro.observe(container);
    this._syncSize();

    // Start render loop
    this._tick = this._tick.bind(this);
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  /** Sync canvas pixel size to container dimensions. */
  _syncSize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }

  _handleResize() {
    if (!this._destroyed) this._syncSize();
  }

  /**
   * Spawn particles for a named effect preset.
   * @param {string} effectKey — key from EFFECT_PRESETS
   * @param {number} x — spawn x (px, relative to container)
   * @param {number} y — spawn y (px, relative to container)
   */
  spawnEffect(effectKey, x, y) {
    const preset = EFFECT_PRESETS[effectKey];
    if (!preset) return;

    const { colors, config, count, burst } = preset;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(config.speed);

      let px, py, vx, vy;
      if (burst) {
        px = x;
        py = y;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      } else {
        // Spawn across container width, start above or at y
        px = Math.random() * this.width;
        py = y !== undefined ? y : 0;
        // Mostly downward for rain-type, or upward for negative gravity
        vx = (Math.random() - 0.5) * speed * 0.5;
        vy = config.gravity < 0 ? -Math.abs(speed) * 0.5 : speed * 0.3 + Math.random() * speed * 0.4;
      }

      this.particles.push(new Particle({
        x: px,
        y: py,
        vx,
        vy,
        life: rand(config.life),
        size: rand(config.size),
        color: pick(colors),
        shape: config.shape,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: rand(config.rotationSpeed),
        gravity: config.gravity,
        wobbleAmp: config.wobbleAmp,
        wobbleFreq: config.wobbleFreq,
        glowSize: config.glowSize,
      }));
    }
  }

  /** Animation loop. */
  _tick(now) {
    if (this._destroyed) return;
    const dt = Math.min((now - this._lastTime) / 1000, 0.1); // cap at 100ms
    this._lastTime = now;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Update and draw
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (!p.alive) {
        this.particles.splice(i, 1);
      } else {
        p.draw(ctx);
      }
    }

    this._raf = requestAnimationFrame(this._tick);
  }

  /** Tear down: stop animation, remove canvas, disconnect observer. */
  destroy() {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this.canvas.remove();
    this.particles.length = 0;
  }
}
