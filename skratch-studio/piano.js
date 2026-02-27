// piano.js — Clickable piano keyboard component for Skratch Studio

const KEYS = [
  { note: 'C4',  white: true },
  { note: 'C#4', white: false },
  { note: 'D4',  white: true },
  { note: 'D#4', white: false },
  { note: 'E4',  white: true },
  { note: 'F4',  white: true },
  { note: 'F#4', white: false },
  { note: 'G4',  white: true },
  { note: 'G#4', white: false },
  { note: 'A4',  white: true },
  { note: 'A#4', white: false },
  { note: 'B4',  white: true },
];

export class Piano {
  constructor(container, onNotePlay) {
    this.container = container;
    this.onNotePlay = onNotePlay;
    this._keyEls = {};
    this._highlightedKey = null;
    this._activeKey = null;

    this._injectStyles();
    this._build();
  }

  _injectStyles() {
    if (document.getElementById('skratch-piano-styles')) return;
    const style = document.createElement('style');
    style.id = 'skratch-piano-styles';
    style.textContent = `
      .sk-piano {
        display: flex;
        position: relative;
        height: 80px;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      .sk-piano__key {
        position: relative;
        border: 1px solid #2a2a3e;
        border-radius: 0 0 4px 4px;
        cursor: pointer;
        transition: background 0.08s, box-shadow 0.08s;
      }
      .sk-piano__key--white {
        background: #d8d8e0;
        width: 32px;
        height: 80px;
        z-index: 1;
      }
      .sk-piano__key--white:hover {
        background: #e8e8f0;
      }
      .sk-piano__key--white.active {
        background: var(--color-primary, #6c5ce7);
        box-shadow: 0 0 12px var(--color-primary, #6c5ce7);
      }
      .sk-piano__key--white.detected {
        background: var(--color-secondary, #00cec9);
        box-shadow: 0 0 10px var(--color-secondary, #00cec9);
      }
      .sk-piano__key--black {
        background: #111118;
        width: 22px;
        height: 50px;
        margin-left: -11px;
        margin-right: -11px;
        z-index: 2;
        border: 1px solid #000;
      }
      .sk-piano__key--black:hover {
        background: #2a2a3e;
      }
      .sk-piano__key--black.active {
        background: var(--color-primary, #6c5ce7);
        box-shadow: 0 0 12px var(--color-primary, #6c5ce7);
      }
      .sk-piano__key--black.detected {
        background: var(--color-secondary, #00cec9);
        box-shadow: 0 0 10px var(--color-secondary, #00cec9);
      }
      .sk-piano__label {
        position: absolute;
        bottom: 4px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        color: #666;
        pointer-events: none;
      }
      .sk-piano__key--black .sk-piano__label {
        color: #888;
      }
      .sk-piano__key.active .sk-piano__label,
      .sk-piano__key.detected .sk-piano__label {
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'sk-piano';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Piano keyboard');

    for (const key of KEYS) {
      const el = document.createElement('div');
      el.className = `sk-piano__key sk-piano__key--${key.white ? 'white' : 'black'}`;
      el.dataset.note = key.note;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', key.note);

      if (key.white) {
        const label = document.createElement('span');
        label.className = 'sk-piano__label';
        label.textContent = key.note.replace('4', '');
        el.appendChild(label);
      }

      // Mouse events
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._triggerKey(key.note, el);
      });
      el.addEventListener('mouseup', () => this._releaseKey(el));
      el.addEventListener('mouseleave', () => this._releaseKey(el));

      // Touch events
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._triggerKey(key.note, el);
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        this._releaseKey(el);
      });

      this._keyEls[key.note] = el;
      this.el.appendChild(el);
    }

    this.container.appendChild(this.el);
  }

  _triggerKey(note, el) {
    this._activeKey = el;
    el.classList.add('active');
    if (this.onNotePlay) this.onNotePlay(note);
  }

  _releaseKey(el) {
    if (el === this._activeKey) this._activeKey = null;
    el.classList.remove('active');
  }

  highlightNote(noteName) {
    // Clear previous highlight
    if (this._highlightedKey) {
      this._highlightedKey.classList.remove('detected');
      this._highlightedKey = null;
    }
    if (!noteName || noteName === '--') return;

    // Match note name regardless of octave — show on octave 4
    const baseNote = noteName.replace(/\d+$/, '');
    const key4 = baseNote + '4';
    const el = this._keyEls[key4];
    if (el) {
      el.classList.add('detected');
      this._highlightedKey = el;
    }
  }

  destroy() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this._keyEls = {};
  }
}
