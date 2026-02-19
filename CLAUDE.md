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
├── chords/                # Chord identification game
│   └── index.html         # Game page (inline CSS/JS)
├── melody/                # Melody echo game
│   └── index.html         # Game page (inline CSS/JS)
├── rhythm/                # Rhythm training game
│   ├── index.html         # Game page
│   ├── rhythm.js          # Game logic — EKG metronome, clap detection, scoring
│   └── styles.css         # Game-specific styles
└── strumming/             # Guitar strumming pattern game
    ├── index.html         # Game page (inline CSS/JS)
    ├── patterns.js        # Strumming pattern definitions & custom pattern storage
    └── detection.js       # Onset detection (RMS + spectral flux)
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

## Chords — Chord Identification Game

### Game Modes

1. **Practice Mode** — Listen to chords, pick the type. Immediate feedback. No time pressure. Replay anytime. Shows correct answer and chord notes if wrong.
2. **Test Mode** — 10 question quiz with randomized root notes. Score tallied at end. Results saved to leaderboard. Optional AI tutor feedback.

### Difficulty Levels

| Level  | Chord Types                        | Inversions |
|--------|------------------------------------|------------|
| Easy   | Major, Minor (2 choices)           | Root only  |
| Medium | Major, Minor, Diminished (3 choices) | Root only  |
| Hard   | Major, Minor, Diminished (3 choices) | Random (root, 1st, 2nd) |

### Chord Intervals

| Type       | Semitones (root position) |
|------------|--------------------------|
| Major      | 0, 4, 7                  |
| Minor      | 0, 3, 7                  |
| Diminished | 0, 3, 6                  |

### Features

- **Chord playback via PolySynth** — Three notes played simultaneously using `playNote()` from `shared/audio.js`. Tone.js PolySynth handles polyphonic playback.
- **Adaptive difficulty** — Uses `selectWeighted()` from `shared/ai.js` to bias question selection toward chord types the player identifies less accurately.
- **AI tutor feedback** — After test mode, calls `getSessionFeedback()` for encouraging post-session feedback. Shows in a styled panel. Degrades gracefully if no API key.
- **Scoring** — 100 base points per correct answer. Streak bonus: +25 at 3+, +50 at 5+. Difficulty multiplier: Easy 1×, Medium 1.5×, Hard 2×.
- **Leaderboard panel** — Shows top scores via `shared/progress.js`. Game identifier: `'chords'`.
- **Streak tracking** — Current streak and best streak displayed.
- **Keyboard shortcuts** — Number keys 1–3 for chord type selection. Space to replay chord. Enter for next question (practice mode).
- **Randomized roots in test mode** — Root notes vary per question (C3–B4 range) to prevent memorization.

### chords/index.html Structure

Single HTML file with inline `<style>` and `<script type="module">`. Game logic is a state machine:

```
SETUP → PLAYING → ANSWER_GIVEN → (next question or RESULTS)
```

**State management** is a plain object with direct DOM manipulation. No virtual DOM.

**Key internal functions:**

- `generateQuestion()` — Pick chord type (adaptive selection), apply inversion if hard, pick root.
- `playChord(root, intervals)` — Play all chord notes simultaneously via PolySynth.
- `handleAnswer(selected)` — Compare to current chord, update score/streak, record attempt with ai.js, trigger feedback.
- `applyInversion(intervals, inversion)` — Shift lower notes up an octave for 1st/2nd inversions.
- `loadNextQuestion()` — Reset UI, generate and auto-play next chord.
- `showResults()` — Calculate final score, save to leaderboard, request AI feedback.

## Melody — Melody Echo Game

### Game Modes

1. **Practice Mode** — Listen to a melody, sing it back note by note. Immediate per-note feedback with color-coded results. Replay melody anytime. No time pressure — "Next Melody" button to advance.
2. **Test Mode** — 10 melodies. Score tallied at end. Results saved to leaderboard. Optional AI tutor feedback.

### Difficulty Levels

| Level  | Interval Range | Multiplier |
|--------|---------------|------------|
| Easy   | Stepwise only (adjacent scale degrees) | 1× |
| Medium | Steps + 3rds (up to 2 scale degrees) | 1.5× |
| Hard   | Steps + 3rds + leaps (up to 3 scale degrees) | 2× |

### Progressive Melody Length

Melodies start at 3 notes and can be unlocked up to 6 notes:

- **3 notes** — Always available
- **4 notes** — Unlocked after 3 consecutive perfect melodies at 3 notes
- **5 notes** — Unlocked after 3 consecutive perfect at 4 notes
- **6 notes** — Unlocked after 3 consecutive perfect at 5 notes

Progression is saved via `shared/progress.js` preferences (`melody_max_length` key).

### Features

- **Scale-based melody generation** — Melodies use the major scale built from the selected key root. Notes move stepwise with occasional larger intervals based on difficulty.
- **Adaptive starting note** — Uses `selectWeighted()` from `shared/ai.js` to start melodies on the user's weakest scale degree, naturally including problem notes.
- **Pitch stability detection** — Notes are locked when the same semitone is detected for 15 consecutive frames (~250ms). Prevents flicker from noisy pitch readings.
- **Per-note evaluation** — Each sung note is compared to the target: correct (same semitone, green), close (±1 semitone, yellow), wrong (red), or skipped.
- **Note timeout** — If no stable pitch is detected within 6 seconds, the note is automatically skipped.
- **Visual note boxes** — Row of boxes showing target notes. Boxes transition through states: playing (purple glow), active (gold pulse), locked (light purple), correct/close/wrong (green/yellow/red).
- **Live pitch display** — Real-time display of detected pitch and frequency below the note boxes during singing.
- **Melody replay** — After evaluation, replay the target melody to compare. Press R or click "Replay Melody".
- **AI tutor feedback** — After test mode, calls `getSessionFeedback()` for encouraging post-session feedback.
- **Scoring** — Per note: 100 correct, 25 close, 0 wrong. Perfect melody bonus: +50 × length. Streak bonus: +50 at 3+, +100 at 5+. All multiplied by difficulty.
- **Leaderboard panel** — Shows top scores via `shared/progress.js`. Game identifier: `'melody'`.
- **Streak tracking** — Consecutive perfect melodies (all notes correct).
- **Keyboard shortcuts** — Space to skip note during listening, Enter for next melody (practice), R to replay.

### Note Segmentation Algorithm

```
1. startPitchDetection() runs continuously from game start
2. onPitch callback receives (frequency, noteInfo) per animation frame
3. Track last 15 readings in pitchBuffer
4. If all 15 are the same note → lock it in as the current note
5. 400ms post-lock cooldown before accepting next note
6. 6-second timeout per note → auto-skip if no stable pitch
7. After all notes locked/skipped → evaluate
```

### melody/index.html Structure

Single HTML file with inline `<style>` and `<script type="module">`. Game logic is a state machine:

```
SETUP → PLAYING (melody playback) → LISTENING (user sings) → EVALUATED → (next or RESULTS)
```

**State management** is a plain object with direct DOM manipulation. No virtual DOM.

**Key internal functions:**

- `buildScale(root)` — Build major scale from root note using interval formula [0,2,4,5,7,9,11,12].
- `generateMelody()` — Create melody by walking through the scale with random steps bounded by difficulty. Uses adaptive selection for starting note.
- `playMelodySequence()` — Play melody with sequential note box highlighting via async/await + delay.
- `beginListening()` — Start listening phase, activate first note box, begin timeout.
- `onPitch(freq, noteInfo)` — Pitch detection callback. Maintains stability buffer, triggers lockNote when stable.
- `lockNote(idx, pitchData)` — Record detected note, update UI, start post-lock cooldown.
- `evaluate()` — Compare all sung notes to targets, calculate score, check progression, record with ai.js.
- `checkProgression()` — Track consecutive perfects, unlock next melody length at threshold.
- `showResults()` — Calculate final score, save to leaderboard, request AI feedback.

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

## Strumming — Guitar Strumming Pattern Game

### Overview

Play along to strumming patterns on guitar. The app displays a scrolling timeline of the target pattern and uses microphone onset detection to evaluate the user's timing accuracy. Patterns are defined as eighth-note grids (8 slots per measure of 4/4 time).

### File Structure

- `strumming/index.html` — Game page with inline `<style>` and `<script type="module">`.
- `strumming/patterns.js` — Pattern data definitions and custom pattern localStorage API.
- `strumming/detection.js` — Onset detection module (RMS + spectral flux).

### Game Modes

1. **Practice Mode** — Pattern loops continuously. No scoring. Real-time feedback on every strum. "Slow Down" button drops BPM by 10. Summary after each loop. Pause/change tempo/switch patterns anytime.
2. **Test Mode** — Play for 4 measures. Scoring: perfect (±10ms) = 3 pts, within tolerance = 2 pts, miss = 0 pts. Streak tracking with bonus points at 5+. Results screen with accuracy %, timing histogram, and leaderboard.

### Difficulty Levels

| Level  | Tolerance | Lookahead        | Metronome          |
|--------|-----------|------------------|--------------------|
| Easy   | ±100ms    | 2 measures ahead | Audible + visual   |
| Medium | ±60ms     | 1 measure ahead  | Audible + visual   |
| Hard   | ±30ms     | Current beat     | Visual only (optional audible toggle) |

### Built-In Patterns

| Pattern               | Grid               | Suggested BPM |
|-----------------------|--------------------|---------------|
| Basic 4/4 Downstrokes | D - D - D - D -    | 60–100        |
| Eighth Notes          | D U D U D U D U    | 50–90         |
| Universal Strum       | D - D U - U D U    | 70–120        |
| Rock Strum            | D - D U D - D U    | 80–130        |
| Reggae Offbeat        | - U - U - U - U    | 60–100        |

### patterns.js

Exports pattern data and custom pattern CRUD.

**Data model** (`StrumPattern`):
- `id` — Unique identifier string.
- `name` — Display name.
- `description` — Brief UI description.
- `grid` — 8-element array of `'D'`, `'U'`, or `'-'`.
- `suggestedBpmRange` — `[min, max]` BPM range.
- `tips` — Playing tips string.
- `builtIn` — `true` for starter patterns, `false` for custom.

**Key exports:**
- `BUILT_IN_PATTERNS` — Array of 5 starter patterns.
- `getAllPatterns()` — Built-in + custom patterns.
- `getPatternById(id)` — Find pattern by id.
- `getCustomPatterns()` / `saveCustomPattern(pattern)` / `deleteCustomPattern(id)` — Custom pattern localStorage CRUD.
- `gridToString(grid)` — Format grid for display.

**Storage:** `mtt_strumming_custom_patterns` — JSON array in localStorage.

### detection.js

Onset detection for guitar strums using Web Audio API.

**Algorithm:** Two complementary signals combined:
1. **RMS amplitude spike** — Monitors `getFloatTimeDomainData()`, detects threshold crossing from below.
2. **Spectral flux** — Computes half-wave rectified difference of frequency bins between frames via `getFloatFrequencyData()`. Good for guitar transients where amplitude alone may be ambiguous.

Either signal can trigger an onset, subject to minimum inter-onset interval (~80ms).

**Key exports:**
- `startDetection(audioCtx, onOnset)` — Start mic, return `Promise<boolean>` (true if mic granted).
- `stopDetection()` — Stop mic and cleanup.
- `isDetecting()` — Check if running.

**Constants (tunable):**
- `RMS_THRESHOLD` (0.04) — Amplitude level for detection.
- `SPECTRAL_FLUX_THRESHOLD` (0.15) — Spectral change level for detection.
- `MIN_INTER_ONSET_MS` (80) — Minimum time between detected onsets.
- `LATENCY_COMPENSATION_MS` (0) — Audio input latency offset.

**NOTE:** Direction detection (down vs up strum) is planned for a future task. Currently only timing is detected.

### strumming/index.html Structure

Single HTML file with inline `<style>` and `<script type="module">`. Game logic is a state machine:

```
SETUP → COUNT_IN → PLAYING → (loops in practice / RESULTS in test)
```

**State management** is a plain object with direct DOM manipulation. No virtual DOM.

**Visual display:**
- **Scrolling timeline** (canvas) — Playhead fixed at ~35% from left. Target pattern arrows scroll right-to-left. User's detected strums appear on a second row aligned to actual timing.
- **Color coding** — Green (within tolerance), orange/yellow (slightly off), red (miss/extra), ghost/faded (expected strum missed).
- **Timing indicator bar** — Horizontal bar below the timeline. Rolling average of last 8 strums. Dot drifts left = early, right = late, center = on beat. Color changes: green (accurate), yellow (slightly off), red (way off).
- **Beat light** — Flashes on downbeats/beats.
- **Connecting lines** — Dashed lines between matched target↔detected pairs.

**Key internal functions:**
- `buildExpectedStrums()` — Generate expected strum times from pattern grid and BPM.
- `registerStrum(time)` — Match detected strum to nearest expected, score it.
- `checkMissedStrums()` — Mark unmatched expected strums as missed.
- `renderFrame()` — Canvas render loop: grid lines, arrows, strum markers, connecting lines.
- `drawArrow(ctx, x, y, direction, color, isMiss)` — Draw D/U arrow with styling.
- `drawHistogram()` — Post-game timing distribution histogram.
- `startMetronome()` — Scheduled click playback via Web Audio API oscillator.
- `startCountIn()` — 4-beat count-in before game starts.

### Integration

- **Game ID:** `'strumming'`
- **Leaderboard:** `shared/progress.js` — `saveScore()` / `renderLeaderboard()`.
- **Adaptive difficulty:** `shared/ai.js` — `recordAttempt()` per strum with pattern name as skill. `selectWeighted()` suggests pattern on setup. `recordSession()` + `getSessionFeedback()` for post-session AI tutor.
- **Hub:** Card added to main `index.html`.

### Planned Future Additions

- **Direction detection** — Detect down vs up strum direction from spectral/temporal analysis. Score both timing and direction.
- **Audio latency calibration** — Calibration routine to measure and compensate for mic input latency.
- **Custom pattern builder UI** — Let users create, edit, and share custom strumming patterns. Data model already supports this via `patterns.js`.
- **Detector tuning tool** — Debug/calibration view showing raw RMS, spectral flux, and onset triggers in real-time.

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
