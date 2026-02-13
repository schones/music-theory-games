# Music Theory Games — Architecture Guide

## Overview

A browser-based music theory education platform targeting kids ages 8–12. Pure vanilla JS (ES6 modules), no build step, no frameworks. Served as static files — open `index.html` directly or use any static server.

## Directory Structure

```
music-theory-games/
├── CLAUDE.md              # This file — architecture reference
├── .gitignore             # Ignores shared/config.js (contains API key)
├── index.html             # Main hub page — game launcher
├── shared/                # Shared modules and design system
│   ├── styles.css         # Global design system (CSS custom properties)
│   ├── progress.js        # Leaderboard & score tracking (localStorage)
│   ├── audio.js           # Web Audio API utilities, pitch detection, tone generation
│   ├── ai.js              # Adaptive difficulty tracking & AI tutor feedback
│   ├── config.js          # API key config (gitignored, not committed)
│   └── config.example.js  # Template — copy to config.js and add your key
├── harmony/               # Interval training game
│   ├── index.html         # Game page
│   ├── intervals.js       # Game logic — practice/test modes, difficulty, scoring
│   └── styles.css         # Game-specific styles
└── rhythm/                # Rhythm training game
    ├── index.html         # Game page
    ├── rhythm.js          # Game logic — EKG metronome, clap detection, scoring
    └── styles.css         # Game-specific styles
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

### shared/config.js

API key configuration. **Not committed to git** — each developer copies `config.example.js` to `config.js` and adds their own key.

**Setup:**

```bash
cp shared/config.example.js shared/config.js
# Edit shared/config.js and add your Anthropic API key
```

**Exports:**

- `CLAUDE_API_KEY` — Anthropic API key string. Empty string disables AI features.

### shared/ai.js

Adaptive difficulty tracking and optional AI tutor feedback. All features degrade gracefully if no API key is set — games work identically without one.

**Key exports:**

- `recordAttempt(game, skill, result)` — Track a single practice attempt. `result` is `{ hit: boolean, centsOff?: number, responseMs?: number }`.
- `recordSession(game, sessionData)` — Save a completed session summary (capped at 50 per game).
- `getPerformance(game)` — Get raw performance data for a game.
- `getPerformanceSummary(game)` — Get a human-readable summary (used as context for AI prompts).
- `getAdaptiveWeights(game, skills)` — Calculate probability weights biased toward weak areas. Returns `{ [skill]: probability }` summing to 1.
- `selectWeighted(game, skills)` — Pick a skill using adaptive weighted random selection.
- `getWeakAreas(game, limit?)` — Get skills sorted by weakness (lowest accuracy first).
- `getSessionFeedback(game, sessionData)` — Call Claude API for post-session feedback. Returns `null` if no API key or on failure.
- `isAIAvailable()` — Check if a Claude API key is configured.
- `clearPerformance(game)` — Reset all tracking data for a game.

**Storage schema (localStorage keys):**

- `mtt_ai_{game}` — JSON object `{ skills: { [name]: SkillData }, sessions: SessionData[] }`.
- `SkillData`: `{ attempts, hits, totalCentsOff, totalResponseMs, lastAttempt, streak, bestStreak }`.
- `SessionData`: `{ date, mode, difficulty, score, accuracy, ... }`.

**Adaptive algorithm:** Skills with lower accuracy receive higher selection weights. Base weight = `1 - accuracy`. Untried skills get weight 1.0. Skills with fewer than 5 attempts get a 1.2× novelty bonus. Skills not practiced in 24+ hours get a 1.3× recency bonus. All weights are normalized to probabilities summing to 1.

**AI tutor integration:** Optional. When `CLAUDE_API_KEY` is set, `getSessionFeedback()` calls the Claude API (`claude-haiku-4-5-20251001`) with a kid-friendly tutor system prompt and the session performance data. Returns 2–3 sentences of encouraging feedback, or `null` on any failure. Uses `anthropic-dangerous-direct-browser-access` header for browser-side requests — acceptable for local educational use since the key lives in a gitignored config file.

**Game integration pattern:**

```javascript
import { recordAttempt, selectWeighted, getSessionFeedback } from '../shared/ai.js';

// During gameplay — record each attempt
recordAttempt('harmony-training', 'Perfect 5th', { hit: true, centsOff: -3 });

// When generating next question — use adaptive selection
const nextInterval = selectWeighted('harmony-training', availableIntervals);

// After session ends — get optional AI feedback
const feedback = await getSessionFeedback('harmony-training', sessionSummary);
if (feedback) showFeedbackToUser(feedback);
```

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

## Rhythm — Rhythm Training Game

### Game Modes

1. **Practice Mode** — Clap along to the metronome with visual feedback. No scoring pressure. Current streak and accuracy displayed but not saved. Stop anytime.
2. **Test Mode** — Run for 8 or 16 measures. Tracks accuracy, streak, and score. Results saved to leaderboard.

### Difficulty Levels

| Level  | Tolerance Window |
|--------|-----------------|
| Easy   | ±100ms          |
| Medium | ±50ms           |
| Hard   | ±25ms           |

### Features

- **EKG-style visual metronome** — Canvas-based scrolling waveform with beat spikes. Downbeats (beat 1) are taller and use the primary accent color. A "NOW" line shows where the current moment is. Clap markers (green triangles for hits, red for misses) are overlaid in real-time.
- **Beat indicator light** — Large circle that flashes green on successful on-beat claps and red on off-beat claps or missed beats.
- **Clap detection via microphone** — Uses Web Audio API `AnalyserNode` for RMS-based onset detection. Monitors amplitude, triggers on threshold crossing with cooldown to prevent double-triggers.
- **Keyboard input** — Spacebar acts as an alternative to clapping (for environments without mic access).
- **Tap-in tempo setting** — "Tap Tempo" button calculates BPM from the average interval of the last 4 taps.
- **Configurable time signature** — Numerator (1–12) and denominator (2, 4, 8, 16).
- **BPM control** — Slider (40–200 BPM) with number input for precise entry.
- **Count-in** — One measure of metronome clicks before scoring begins.
- **Metronome audio** — Web Audio API `OscillatorNode`. Beat 1 at 1000 Hz, other beats at 800 Hz. Short sine wave envelope.
- **Leaderboard panel** — Shows top scores via `shared/progress.js`. Game identifier: `'rhythm'`.
- **Streak tracking** — Current streak and best streak. Bonus points for streaks ≥ 5.

### rhythm.js Structure

The game logic is a state machine:

```
SETUP → COUNT_IN → PLAYING → (RESULTS if test mode)
```

**State management** is a plain object with direct DOM manipulation via `getElementById`. No virtual DOM.

**Key internal functions:**

- `handleStart()` — Initialize audio, read settings, count-in, then start game loop.
- `startMetronome()` — Scheduled click playback using `setTimeout`, synchronized to `performance.now()`.
- `precomputeBeatTimes()` — Generate array of expected beat timestamps from start time and BPM.
- `startOnsetDetection()` — Request mic, run RMS amplitude monitoring via `requestAnimationFrame`.
- `registerClap(time)` — Compare clap timestamp to nearest expected beat. Score hit or miss.
- `checkMissedBeat(beatIdx)` — Mark beats with no matching clap as missed, break streak.
- `drawEKG()` — Canvas render: scrolling baseline, beat spikes, clap markers, missed-beat markers.
- `handleTapIn()` — Calculate BPM from tap intervals, update tempo controls.
- `showResults()` — Calculate final score/accuracy, save to leaderboard, show results screen.

### Onset Detection Algorithm

```
1. getUserMedia → MediaStreamSource → AnalyserNode (fftSize 2048)
2. Each animation frame: getFloatTimeDomainData → compute RMS
3. When RMS crosses ONSET_THRESHOLD from below AND cooldown elapsed → onset
4. Record performance.now() - LATENCY_COMPENSATION_MS
5. Find nearest expected beat timestamp
6. If |onset - beat| ≤ tolerance → hit, else miss
```

**Configurable constants** (top of rhythm.js):
- `ONSET_THRESHOLD` (0.05) — RMS level for clap detection
- `ONSET_COOLDOWN_MS` (200) — Minimum ms between detected onsets
- `TOLERANCE` — Per difficulty: easy 100ms, medium 50ms, hard 25ms
- `LATENCY_COMPENSATION_MS` (0) — Audio input latency offset

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

## TODO

- Experiment with themes — try different color palettes, dark/light mode toggle, kid-friendly themes.
