// piano.js — Clickable piano keyboard component for Skratch Studio
// Range: G3–G5 (two full octaves), with computer keyboard mapping

const KEYS = [
  { note: 'G3',  white: true },
  { note: 'G#3', white: false },
  { note: 'A3',  white: true },
  { note: 'A#3', white: false },
  { note: 'B3',  white: true },
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
  { note: 'C5',  white: true },
  { note: 'C#5', white: false },
  { note: 'D5',  white: true },
  { note: 'D#5', white: false },
  { note: 'E5',  white: true },
  { note: 'F5',  white: true },
  { note: 'F#5', white: false },
  { note: 'G5',  white: true },
];

// Computer keyboard → note mapping
// Lower octave: A-row = white keys, Z-row = sharps
// Upper octave: Q-row = white keys, number row = sharps
const KEY_MAP = {
  // Lower white keys (A-row)
  'a': 'G3', 's': 'A3', 'd': 'B3', 'f': 'C4',
  'g': 'D4', 'h': 'E4', 'j': 'F4', 'k': 'G4', 'l': 'A4',
  // Lower sharps (Z-row)
  'z': 'G#3', 'x': 'A#3', 'c': 'C#4', 'v': 'D#4',
  'b': 'F#4', 'n': 'G#4', 'm': 'A#4',
  // Upper white keys (Q-row)
  'q': 'B4', 'w': 'C5', 'e': 'D5', 'r': 'E5',
  't': 'F5', 'y': 'G5',
  // Upper sharps (number row)
  '2': 'C#5', '3': 'D#5', '5': 'F#5',
};

// Reverse map: note → keyboard shortcut label
const NOTE_TO_KEY = {};
for (const [key, note] of Object.entries(KEY_MAP)) {
  NOTE_TO_KEY[note] = key.toUpperCase();
}

export class Piano {
  constructor(container, { onNoteOn, onNoteOff, onSustainChange }) {
    this.container = container;
    this.onNoteOn = onNoteOn || (() => {});
    this.onNoteOff = onNoteOff || (() => {});
    this.onSustainChange = onSustainChange || (() => {});
    this._keyEls = {};
    this._highlightedKey = null;
    this._pressedComputerKeys = new Set();
    this._mouseNote = null;

    this._injectStyles();
    this._build();
    this._bindKeyboard();
  }

  _injectStyles() {
    if (document.getElementById('skratch-piano-styles')) return;
    const style = document.createElement('style');
    style.id = 'skratch-piano-styles';
    style.textContent = `
      .sk-piano {
        display: flex;
        position: relative;
        height: 72px;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      .sk-piano__key {
        position: relative;
        border: 1px solid #2a2a3e;
        border-radius: 0 0 3px 3px;
        cursor: pointer;
        transition: background 0.08s, box-shadow 0.08s;
        box-sizing: border-box;
      }
      .sk-piano__key--white {
        background: #d8d8e0;
        width: 22px;
        height: 72px;
        z-index: 1;
      }
      .sk-piano__key--white:hover {
        background: #e8e8f0;
      }
      .sk-piano__key--white.active {
        background: var(--color-primary, #6c5ce7);
        box-shadow: 0 0 10px var(--color-primary, #6c5ce7);
      }
      .sk-piano__key--white.detected {
        background: var(--color-secondary, #00cec9);
        box-shadow: 0 0 8px var(--color-secondary, #00cec9);
      }
      .sk-piano__key--black {
        background: #111118;
        width: 14px;
        height: 44px;
        margin-left: -7px;
        margin-right: -7px;
        z-index: 2;
        border: 1px solid #000;
      }
      .sk-piano__key--black:hover {
        background: #2a2a3e;
      }
      .sk-piano__key--black.active {
        background: var(--color-primary, #6c5ce7);
        box-shadow: 0 0 10px var(--color-primary, #6c5ce7);
      }
      .sk-piano__key--black.detected {
        background: var(--color-secondary, #00cec9);
        box-shadow: 0 0 8px var(--color-secondary, #00cec9);
      }
      .sk-piano__label {
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 7px;
        color: #888;
        pointer-events: none;
        line-height: 1;
      }
      .sk-piano__key--black .sk-piano__label {
        color: #777;
        font-size: 7px;
        bottom: 2px;
      }
      .sk-piano__key.active .sk-piano__label,
      .sk-piano__key.detected .sk-piano__label {
        color: #fff;
      }
      .sk-piano__octave-mark {
        position: absolute;
        top: 2px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 6px;
        color: #999;
        pointer-events: none;
      }
      .sk-piano__key.active .sk-piano__octave-mark {
        color: rgba(255,255,255,0.7);
      }
    `;
    document.head.appendChild(style);
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'sk-piano';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Piano keyboard — G3 to G5');

    for (const key of KEYS) {
      const el = document.createElement('div');
      el.className = `sk-piano__key sk-piano__key--${key.white ? 'white' : 'black'}`;
      el.dataset.note = key.note;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', key.note);

      // Keyboard shortcut label
      const shortcut = NOTE_TO_KEY[key.note];
      if (shortcut) {
        const label = document.createElement('span');
        label.className = 'sk-piano__label';
        label.textContent = shortcut;
        el.appendChild(label);
      }

      // Octave reference marks on C keys
      if (key.note === 'C4' || key.note === 'C5') {
        const mark = document.createElement('span');
        mark.className = 'sk-piano__octave-mark';
        mark.textContent = key.note;
        el.appendChild(mark);
      }

      // Mouse events
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._mouseDown(key.note, el);
      });
      el.addEventListener('mouseup', () => this._mouseUp(key.note, el));
      el.addEventListener('mouseleave', () => this._mouseUp(key.note, el));

      // Touch events
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._mouseDown(key.note, el);
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        this._mouseUp(key.note, el);
      });

      this._keyEls[key.note] = el;
      this.el.appendChild(el);
    }

    this.container.appendChild(this.el);
  }

  _mouseDown(note, el) {
    this._mouseNote = note;
    el.classList.add('active');
    this.onNoteOn(note);
  }

  _mouseUp(note, el) {
    if (this._mouseNote === note) {
      this._mouseNote = null;
      el.classList.remove('active');
      this.onNoteOff(note);
    }
  }

  _bindKeyboard() {
    this._onKeyDown = (e) => {
      // Don't capture when typing in inputs or in Blockly
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
          e.target.isContentEditable || e.target.closest('#blocklyDiv')) {
        return;
      }

      // Sustain pedal (spacebar)
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          this.onSustainChange(true);
        }
        return;
      }

      // Ignore key repeats
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      const note = KEY_MAP[key];
      if (!note) return;

      e.preventDefault();
      this._pressedComputerKeys.add(key);

      const el = this._keyEls[note];
      if (el) el.classList.add('active');
      this.onNoteOn(note);
    };

    this._onKeyUp = (e) => {
      // Sustain pedal release
      if (e.code === 'Space') {
        this.onSustainChange(false);
        return;
      }

      const key = e.key.toLowerCase();
      const note = KEY_MAP[key];
      if (!note) return;

      this._pressedComputerKeys.delete(key);

      const el = this._keyEls[note];
      if (el) el.classList.remove('active');
      this.onNoteOff(note);
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  highlightNote(noteName) {
    // Clear previous highlight
    if (this._highlightedKey) {
      this._highlightedKey.classList.remove('detected');
      this._highlightedKey = null;
    }
    if (!noteName || noteName === '--') return;

    // Try exact match first, then match by note name on octave 4
    let el = this._keyEls[noteName];
    if (!el) {
      const baseNote = noteName.replace(/\d+$/, '');
      el = this._keyEls[baseNote + '4'] || this._keyEls[baseNote + '3'] || this._keyEls[baseNote + '5'];
    }
    if (el) {
      el.classList.add('detected');
      this._highlightedKey = el;
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this._keyEls = {};
    this._pressedComputerKeys.clear();
  }
}
