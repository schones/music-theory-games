// ============================================================
//  Particle — Canvas-based particle for visual effects
//  shared/skratch/particle.js
// ============================================================

const TWO_PI = Math.PI * 2;

/**
 * Draw a 5-pointed star path centered at (0, 0).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} outerR
 */
function starPath(ctx, outerR) {
  const innerR = outerR * 0.4;
  const spikes = 5;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draw a diamond (rotated square) path centered at (0, 0).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} r — half-diagonal
 */
function diamondPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.6, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.6, 0);
  ctx.closePath();
}

/**
 * Draw a raindrop / teardrop path centered at (0, 0).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} r
 */
function dropPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.6, -r * 0.3, r * 0.5, r * 0.4, 0, r);
  ctx.bezierCurveTo(-r * 0.5, r * 0.4, -r * 0.6, -r * 0.3, 0, -r);
  ctx.closePath();
}

/** Shape draw functions keyed by name. */
const SHAPE_DRAW = {
  circle(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
  },
  star: starPath,
  diamond: diamondPath,
  drop: dropPath,
};

export class Particle {
  /**
   * @param {object} opts
   * @param {number} opts.x — initial x
   * @param {number} opts.y — initial y
   * @param {number} opts.vx — velocity x (px/s)
   * @param {number} opts.vy — velocity y (px/s)
   * @param {number} opts.life — lifetime in seconds
   * @param {number} opts.size — radius in px
   * @param {string} opts.color — CSS color string
   * @param {'circle'|'star'|'diamond'|'drop'} [opts.shape='circle']
   * @param {number} [opts.rotation=0] — initial rotation (radians)
   * @param {number} [opts.rotationSpeed=0] — rad/s
   * @param {number} [opts.gravity=0] — px/s^2 (positive = down)
   * @param {number} [opts.wobbleAmp=0] — horizontal wobble amplitude (px)
   * @param {number} [opts.wobbleFreq=0] — wobble frequency (Hz)
   * @param {number} [opts.glowSize=0] — shadowBlur radius for glow
   */
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.life = opts.life ?? 1;
    this.maxLife = this.life;
    this.size = opts.size ?? 4;
    this.color = opts.color ?? '#ffffff';
    this.shape = opts.shape ?? 'circle';
    this.rotation = opts.rotation ?? 0;
    this.rotationSpeed = opts.rotationSpeed ?? 0;
    this.gravity = opts.gravity ?? 0;
    this.wobbleAmp = opts.wobbleAmp ?? 0;
    this.wobbleFreq = opts.wobbleFreq ?? 0;
    this.glowSize = opts.glowSize ?? 0;
    this.age = 0;
    this.alive = true;
  }

  /** Advance by dt seconds. */
  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age >= this.maxLife) {
      this.alive = false;
      return;
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.wobbleAmp) {
      this.x += Math.sin(this.age * this.wobbleFreq * TWO_PI) * this.wobbleAmp * dt;
    }
    this.rotation += this.rotationSpeed * dt;
  }

  /**
   * Draw the particle onto the given context.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.alive) return;

    const t = this.age / this.maxLife; // 0→1 progress
    const alpha = 1 - t; // linear fade-out
    const scale = 1 - t * 0.3; // slight shrink
    const r = this.size * scale;
    if (r < 0.5) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = alpha;

    // Glow
    if (this.glowSize > 0) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.glowSize * alpha;
    }

    ctx.fillStyle = this.color;
    const drawFn = SHAPE_DRAW[this.shape] || SHAPE_DRAW.circle;
    drawFn(ctx, r);
    ctx.fill();

    ctx.restore();
  }
}
