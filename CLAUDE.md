# Music Theory Games — Architecture Guide

## Overview

A browser-based music theory education platform for kids ages 8–12. No frameworks — vanilla JavaScript (ES6 modules), HTML5, and CSS custom properties. All audio uses the Web Audio API with Tone.js for synthesis and autocorrelation-based pitch detection.

Serve from any static file server. During development, use a local server that supports ES modules (e.g., `npx serve .` or `python3 -m http.server`).

## Directory Structure

```
music-theory-games/
├── CLAUDE.md                  # This file
├── index.html                 # Main hub page — game launcher
├── shared/
│   ├── styles.css             # Design system — CSS custom properties, layout utilities
│   ├── progress.js            # Leaderboard & score tracking (localStorage)
│   └── audio.js               # Web Audio API utilities, pitch detection, tone generation
├── harmony/
│   ├── index.html             # Interval training game page
│   ├── interval-game.js       # Game logic — practice/test modes, difficulty, tuner gauge
│   └── styles.css             # Game-specific styles (tuner gauge, interval buttons, etc.)
└── rhythm/
    └── index.html             # Placeholder — future rhythm training game
```

## Shared Modules

### shared/styles.css

Global design system. Every page imports this first.

- **CSS custom properties** on `:root` for colors, spacing, typography, border-radius, shadows.
- Kid-friendly palette: bright primaries, rounded corners, large touch targets (min 44px).
- `.container`, `.card`, `.btn`, `.btn--primary`, `.btn--secondary` utility classes.
- Responsive grid system using CSS Grid with `auto-fit` / `minmax`.
- Animated transitions for interactive feedback (button presses, score changes).
- Dark mode not required — light, colorful theme only.

### shared/progress.js

Exports an ES6 module for localStorage-backed score and leaderboard tracking.

Key exports:
- `saveScore(game, playerName, score, metadata)` — persist a score entry.
- `getLeaderboard(game, limit?)` — retrieve sorted top scores for a game.
- `clearLeaderboard(game)` — reset a game's leaderboard.
- `getPlayerStats(playerName)` — aggregate stats across games.
- `updateStreak(playerName, correct)` — track consecutive correct answers.

Data shape per entry:
```json
{
  "id": "<uuid>",
  "game": "interval-training",
  "playerName": "Alex",
  "score": 850,
  "difficulty": "medium",
  "mode": "test",
  "streak": 5,
  "timestamp": 1700000000000,
  "metadata": {}
}
```

Storage key pattern: `mtg_leaderboard_<game>`. All data is JSON-serialized arrays.

### shared/audio.js

Web Audio API utility module. Wraps Tone.js for synthesis and provides raw Web Audio for pitch detection.

Key exports:
- `initAudio()` — create/resume AudioContext (must be called from user gesture).
- `playNote(noteName, duration?, velocity?)` — play a note via Tone.js synth (e.g., `"C4"`, `"F#3"`).
- `playInterval(root, interval, arpeggiate?)` — play two notes simultaneously or sequentially.
- `detectPitch(analyserNode)` — autocorrelation-based pitch detection, returns `{ frequency, noteName, cents }`.
- `setupMicrophone()` — request mic access, return analyser node for pitch detection.
- `frequencyToNote(hz)` — convert frequency to nearest note name + cents offset.
- `noteToFrequency(noteName)` — convert note name (e.g., `"A4"`) to Hz.
- `INTERVALS` — constant map: `{ unison: 0, minor2nd: 1, major2nd: 2, ... perfectOctave: 12 }`.
- `NOTE_NAMES` — array of all chromatic note names.
- `getIntervalName(semitones)` — human-readable interval name from semitone count.

Pitch detection algorithm: autocorrelation (not FFT-peak). Operates on Float32Array from AnalyserNode. Returns null when signal is below a noise gate threshold.

## Harmony — Interval Training Game

### File: harmony/index.html

Single-page game shell. Loads shared styles, game-specific styles, Tone.js from CDN, and the game module.

### File: harmony/interval-game.js

ES6 module. The full game controller.

**Modes:**
- **Practice mode** — infinite rounds, no timer, shows answer after guess, tracks personal best streak.
- **Test mode** — 20 questions, timed (configurable), final score saved to leaderboard.

**Difficulty levels:**
- **Easy** — perfect unison, major 3rd, perfect 5th, perfect octave (4 intervals).
- **Medium** — all perfect + major/minor 3rds and 6ths (8 intervals).
- **Hard** — all 13 chromatic intervals (unison through octave).

**Root note selection:**
- User picks a root note from C3–C5 (dropdown or piano-key selector).
- Default: C4.

**Guitar-tuner visual gauge:**
- Animated needle/arc gauge showing pitch detection results.
- Centered when in-tune, deflects left (flat) or right (sharp).
- Displays detected note name, frequency, and cents offset.
- CSS-animated needle with `transform: rotate()`.
- Updates at ~30fps from requestAnimationFrame + analyser data.

**Scoring:**
- Base points per correct answer, multiplied by streak bonus.
- Time bonus in test mode (faster = more points).
- Streak counter displayed prominently.

**Game flow:**
1. Player selects mode, difficulty, root note, enters name.
2. Game plays an interval (root + target note via Tone.js).
3. Player either clicks the interval name button OR sings/plays the note (pitch detection).
4. Visual gauge shows pitch in real-time if mic is active.
5. Feedback: correct (green flash + chime) / incorrect (red flash + buzz).
6. In practice mode, show the correct answer and interval on the staff.
7. After test mode ends, save score and show leaderboard.

**DOM structure:**
- `#setup-screen` — mode/difficulty/root/name selection.
- `#game-screen` — active gameplay area.
- `#tuner-gauge` — SVG or CSS arc with animated needle.
- `#interval-buttons` — grid of interval name buttons (filtered by difficulty).
- `#feedback` — correct/incorrect overlay.
- `#results-screen` — final score + leaderboard table.

### File: harmony/styles.css

Game-specific styles. Imports nothing — loaded after shared/styles.css in the HTML.

- Tuner gauge: circular arc via CSS `conic-gradient` or SVG, needle via rotated pseudo-element.
- Interval button grid: responsive, color-coded by interval quality (perfect/major/minor/augmented/diminished).
- Feedback animations: green pulse for correct, red shake for incorrect.
- Screen transitions: fade or slide between setup/game/results.

## Rhythm Directory

### File: rhythm/index.html

Placeholder page. Links back to hub. Contains a "Coming Soon" message. Rhythm game will be a future addition for clapping/tapping rhythm patterns.

## Conventions

- **No build step.** Ship raw ES6 modules. Use `<script type="module">`.
- **No frameworks.** Vanilla JS, HTML, CSS only.
- **Tone.js** loaded from CDN (`<script>` tag, not import map). Version 14.x.
- **CSS custom properties** for all themeable values. No Sass/Less.
- **localStorage only** for persistence. No backend.
- **Accessible:** ARIA labels on interactive elements, keyboard navigable, sufficient color contrast.
- **Mobile-friendly:** Touch targets >= 44px, responsive layout, no hover-only interactions.

## Development

```bash
# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:8000` (or whatever port) in a browser. No build/compile step needed.

## Adding a New Game

1. Create a new directory at the project root (e.g., `scales/`).
2. Add `index.html` that loads `shared/styles.css` and `shared/progress.js`.
3. Implement game logic in a module JS file.
4. Add a card for it on the hub page (`index.html`).
5. Use `saveScore()` / `getLeaderboard()` from `shared/progress.js` for scoring.
6. Use `shared/audio.js` for any audio needs.
