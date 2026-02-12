# Music Theory Games — Architecture Guide

## Overview

A browser-based music theory education platform targeting kids ages 8–12. Pure vanilla JS (ES6 modules), no build step, no frameworks. Served as static files — open `index.html` directly or use any static server.

## Directory Structure

```
music-theory-games/
├── CLAUDE.md              # This file — architecture reference
├── index.html             # Main hub page — game launcher
├── shared/                # Shared modules and design system
│   ├── styles.css         # Global design system (CSS custom properties)
│   ├── progress.js        # Leaderboard & score tracking (localStorage)
│   └── audio.js           # Web Audio API utilities, pitch detection, tone generation
├── harmony/               # Interval training game
│   ├── index.html         # Game page
│   ├── intervals.js       # Game logic — practice/test modes, difficulty, scoring
│   └── styles.css         # Game-specific styles
└── rhythm/                # Rhythm game (placeholder for future development)
    └── index.html         # Placeholder page
```

## Technology Choices

- **No frameworks.** Vanilla JS with ES6 modules (`type="module"` in script tags).
- **No build step.** Files are served as-is. Use a local static server or open directly.
- **Tone.js** (via CDN) for synthesis — reliable cross-browser audio with minimal setup.
- **Web Audio API** directly for pitch detection (autocorrelation algorithm).
- **CSS custom properties** for theming — all colors, spacing, and typography in `shared/styles.css`.
- **localStorage** for all persistence — scores, leaderboards, preferences. No backend.

## Shared Modules

### shared/styles.css

Global design system. Import in every HTML page via `<link>`. Defines:

- **CSS custom properties** on `:root` — color palette (kid-friendly, high contrast), font sizes, spacing scale, border radii, shadows.
- **Base reset** and typography (system font stack).
- **Utility classes** — `.container`, `.btn`, `.btn--primary`, `.btn--secondary`, `.card`, `.badge`, `.gauge-*` classes.
- **Responsive layout** — mobile-first, works on tablets and desktops.
- **Animations** — `@keyframes` for success/failure feedback, score popups, gauge needle movement.

### shared/progress.js

Exports an ES6 module for score tracking and leaderboards. All data in localStorage.

**Key exports:**

- `saveScore(game, playerName, score, metadata)` — Persist a score entry.
- `getLeaderboard(game, limit?)` — Retrieve top scores for a game, sorted descending.
- `clearLeaderboard(game)` — Reset a game's leaderboard.
- `getStats(game, playerName?)` — Aggregate stats (total games, average score, best streak).
- `savePreference(key, value)` / `getPreference(key, defaultValue)` — Generic prefs storage.

**Storage schema (localStorage keys):**

- `mtt_leaderboard_{game}` — JSON array of `{ playerName, score, date, metadata }`.
- `mtt_prefs` — JSON object of user preferences.

### shared/audio.js

Web Audio API utility module. Wraps Tone.js for synthesis and raw Web Audio for pitch detection.

**Key exports:**

- `initAudio()` — Create/resume AudioContext (must be called from user gesture). Returns context.
- `playNote(noteName, duration?, options?)` — Play a note using Tone.js synth. `noteName` is scientific pitch like `"C4"`, `"F#3"`.
- `playInterval(rootNote, intervalSemitones, mode)` — Play two notes as harmonic (simultaneous) or melodic (sequential).
- `startPitchDetection(callback)` — Request mic access, run autocorrelation pitch detection, call `callback(frequency, noteName, centsOff)` per frame.
- `stopPitchDetection()` — Stop mic stream and detection loop.
- `frequencyToNote(freq)` — Convert Hz to `{ noteName, octave, cents }`.
- `noteToFrequency(noteName)` — Convert scientific pitch name to Hz.
- `getIntervalName(semitones)` — Map semitone count to interval name (e.g., 7 → "Perfect 5th").
- `getSemitones(intervalName)` — Reverse lookup.

**Pitch detection algorithm:** Autocorrelation on raw audio buffer from `AnalyserNode.getFloatTimeDomainData()`. Finds the dominant period by locating the first significant peak in the autocorrelation function after the initial drop. Resolution is sufficient for distinguishing semitones in the C3–C5 range.

## Harmony — Interval Training Game

### Game Modes

1. **Practice Mode** — Listen to intervals, guess the name. Immediate feedback after each guess. No time pressure. Intervals can be replayed. Shows the correct answer if wrong.
2. **Test Mode** — 10 or 20 question quiz. Score tallied at end. Timed per-question (configurable). Results saved to leaderboard.

### Difficulty Levels

| Level  | Intervals Included |
|--------|-------------------|
| Easy   | Unison, m3, M3, P5, Octave (5 intervals) |
| Medium | Easy + m2, M2, P4, m6, M6 (10 intervals) |
| Hard   | All 13 intervals including tritone, m7, M7 |

### Features

- **Root note selection** — Dropdown from C3 to C5. Default C4.
- **Direction** — Ascending, descending, or harmonic (simultaneous).
- **Guitar-tuner gauge** — Visual feedback during pitch detection. Analog needle SVG showing detected pitch vs target, with cents-off display. Green zone = within ±10 cents, yellow = ±25, red = beyond.
- **Leaderboard panel** — Shows top 10 scores for current difficulty. Pulls from `shared/progress.js`.
- **Streak tracking** — Current streak and best streak displayed. Bonus points for streaks ≥ 3.
- **Keyboard shortcuts** — Number keys 1–9 for quick interval selection during gameplay.

### intervals.js Structure

The game logic is a state machine:

```
IDLE → SETUP → PLAYING → ANSWER_GIVEN → (next question or RESULTS)
```

**State management** is a plain object with a `render()` function that updates the DOM based on current state. No virtual DOM, no reactive bindings — direct DOM manipulation with `getElementById`/`querySelector`.

**Key internal functions:**

- `generateQuestion(difficulty, rootNote)` — Pick random interval from difficulty pool, return `{ root, semitones, intervalName }`.
- `checkAnswer(selectedInterval)` — Compare to current question, update score/streak, trigger feedback animation.
- `renderGauge(centsOff)` — Update SVG needle rotation and zone coloring.
- `renderLeaderboard()` — Pull and display scores from progress.js.
- `startTest(numQuestions)` — Initialize test mode state.
- `endTest()` — Calculate final score, save to leaderboard, show results.

## Rhythm Directory

Placeholder for a future rhythm game. Contains only a stub `index.html` linking back to the hub. Planned features (not yet implemented): drum pattern playback, tap-along timing, time signature identification.

## Conventions

- **File naming:** lowercase, hyphens for multi-word (`pitch-detection.js` if needed).
- **Module pattern:** Every `.js` file is an ES6 module. No global variables. Import/export only.
- **CSS scoping:** Game-specific styles in game directories. Shared styles use `.mtt-` prefix (Music Theory Trainer). Game-specific classes use game prefix (`.harmony-`, `.rhythm-`).
- **Error handling:** Audio operations wrapped in try/catch. Mic access failures show friendly messages. localStorage failures fall back gracefully (scores just don't persist).
- **Accessibility:** Semantic HTML, ARIA labels on interactive elements, keyboard navigation, sufficient color contrast (WCAG AA minimum), `prefers-reduced-motion` respected for animations.
- **No minification.** Code is readable as-is. This is an educational project.

## Running Locally

```bash
# Any static server works. Examples:
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000` in a browser.

## Testing Notes

- Audio playback requires a user gesture (click/tap) to start — browsers block autoplay.
- Pitch detection requires HTTPS or localhost (mic access is restricted on insecure origins).
- localStorage is available in all modern browsers but may be disabled in private/incognito mode.
- Tested target: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+.
