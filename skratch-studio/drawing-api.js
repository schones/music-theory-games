// drawing-api.js — p5.js-compatible Canvas 2D drawing API

export class DrawingAPI {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.frameCount = 0;
    this.mouseX = 0;
    this.mouseY = 0;

    this._fillEnabled = true;
    this._strokeEnabled = true;
    this._stateStack = [];

    // Track mouse position
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;
    });

    // Defaults
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
  }

  // --- Shapes ---

  circle(x, y, diameter) {
    const r = diameter / 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2);
    if (this._fillEnabled) this.ctx.fill();
    if (this._strokeEnabled) this.ctx.stroke();
  }

  rect(x, y, w, h) {
    if (this._fillEnabled) this.ctx.fillRect(x, y, w, h);
    if (this._strokeEnabled) this.ctx.strokeRect(x, y, w, h);
  }

  ellipse(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    if (this._fillEnabled) this.ctx.fill();
    if (this._strokeEnabled) this.ctx.stroke();
  }

  triangle(x1, y1, x2, y2, x3, y3) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    if (this._fillEnabled) this.ctx.fill();
    if (this._strokeEnabled) this.ctx.stroke();
  }

  line(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  star(x, y, radius, points) {
    points = points || 5;
    const inner = radius * 0.4;
    this.ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : inner;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    if (this._fillEnabled) this.ctx.fill();
    if (this._strokeEnabled) this.ctx.stroke();
  }

  // --- Color / Style ---

  fill(...args) {
    this._fillEnabled = true;
    this.ctx.fillStyle = this._parseColor(args);
  }

  stroke(...args) {
    this._strokeEnabled = true;
    this.ctx.strokeStyle = this._parseColor(args);
  }

  noFill() {
    this._fillEnabled = false;
  }

  noStroke() {
    this._strokeEnabled = false;
  }

  strokeWeight(w) {
    this.ctx.lineWidth = w;
  }

  background(...args) {
    const prev = this.ctx.fillStyle;
    this.ctx.fillStyle = this._parseColor(args);
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = prev;
  }

  // --- Transform ---

  push() {
    this.ctx.save();
    this._stateStack.push({
      fillEnabled: this._fillEnabled,
      strokeEnabled: this._strokeEnabled
    });
  }

  pop() {
    this.ctx.restore();
    const state = this._stateStack.pop();
    if (state) {
      this._fillEnabled = state.fillEnabled;
      this._strokeEnabled = state.strokeEnabled;
    }
  }

  translate(x, y) {
    this.ctx.translate(x, y);
  }

  rotate(angle) {
    this.ctx.rotate(angle);
  }

  scale(s) {
    this.ctx.scale(s, s);
  }

  // --- Utilities ---

  map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }

  lerp(start, stop, amt) {
    return start + (stop - start) * amt;
  }

  random(min, max) {
    if (max === undefined) { max = min; min = 0; }
    return min + Math.random() * (max - min);
  }

  constrain(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // --- Internal ---

  _parseColor(args) {
    if (args.length === 1 && typeof args[0] === 'string') return args[0];
    if (args.length === 1) return `rgb(${args[0]}, ${args[0]}, ${args[0]})`;
    if (args.length === 3) return `rgb(${args[0]}, ${args[1]}, ${args[2]})`;
    if (args.length === 4) return `rgba(${args[0]}, ${args[1]}, ${args[2]}, ${args[3] / 255})`;
    return '#ffffff';
  }

  _incrementFrame() {
    this.frameCount++;
  }
}
