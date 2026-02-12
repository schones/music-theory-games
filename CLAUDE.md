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

# Music Theory Games

## Planned: Rhythm Training Game

### Overview
A browser-based rhythm training game that helps musicians develop their sense of timing and rhythm recognition. Players listen to rhythmic patterns and must tap, click, or use keyboard inputs to reproduce them accurately.

### Core Mechanics
- **Listen Phase**: A rhythmic pattern is played using audio samples (metronome clicks, drum hits, or other percussion sounds).
- **Reproduce Phase**: The player attempts to replicate the pattern by tapping in time.
- **Scoring**: Accuracy is measured by comparing the player's input timing against the target pattern, with tolerance windows for "perfect," "good," and "miss" ratings.

### Difficulty Progression
1. **Level 1 - Quarter Notes**: Simple patterns using only quarter notes in 4/4 time.
2. **Level 2 - Eighth Notes**: Introduces eighth notes and simple syncopation.
3. **Level 3 - Rests**: Patterns include rests, requiring the player to maintain internal timing.
4. **Level 4 - Dotted Rhythms**: Dotted quarter and eighth note combinations.
5. **Level 5 - Triplets**: Introduces triplet subdivisions.
6. **Level 6 - Sixteenth Notes**: Fast subdivisions and complex patterns.
7. **Level 7 - Mixed Meter**: Patterns in 3/4, 6/8, 5/4, and 7/8 time signatures.

### Features
- **Adjustable Tempo**: BPM slider (40-200 BPM) so players can practice at comfortable speeds.
- **Visual Metronome**: An on-screen metronome with beat indicators to help players stay in time.
- **Rhythm Notation Display**: Show standard music notation for the target rhythm so players learn to read rhythms.
- **Practice Mode**: Unlimited attempts with immediate feedback and no scoring pressure.
- **Challenge Mode**: Progressively harder patterns with a scoring system and streak tracking.
- **Audio Feedback**: Distinct sounds for perfect hits, good hits, and misses.

### Technical Requirements
- Web Audio API for precise audio timing and low-latency playback.
- High-resolution input timing (use `performance.now()` for sub-millisecond accuracy).
- Tolerance windows: Perfect (+/- 30ms), Good (+/- 75ms), Miss (> 75ms).
- Responsive design supporting desktop (keyboard input) and mobile (touch input).
- No external audio library dependencies — use the Web Audio API directly.

### UI/UX
- Clean, distraction-free interface during gameplay.
- A scrolling or static timeline showing upcoming beats.
- Color-coded feedback on each tap (green = perfect, yellow = good, red = miss).
- Post-round summary showing accuracy percentage, hit breakdown, and tempo.
- Dark mode support.

### Data Model
- **Pattern**: A sequence of note events, each with a relative time offset and note type (hit or rest).
- **Attempt**: A recorded sequence of player input timestamps for comparison against the pattern.
- **Score**: Calculated from the accuracy of each input compared to the target pattern.
- **Progress**: Tracks which levels and patterns the player has completed and their best scores.

### Future Considerations
- Polyrhythm training (two independent rhythm lines).
- Custom pattern creation and sharing.
- MIDI input support for drum pads and other controllers.
- Multiplayer rhythm battles.
- Integration with other music theory games in this project.

# Rhythm Training Game — Design Spec
## Overview
A rhythm training game where users clap along to a visual metronome. The game detects clap timing via microphone and provides real-time feedback on whether each clap is on-beat or off-beat.
## Target Audience
Kids ages 8-12 (same as harmony trainer)
## Architecture
- Lives in `rhythm/` directory
- Uses shared design system: `<link rel="stylesheet" href="../shared/styles.css">`
- Uses shared progress/leaderboard: `<script src="../shared/progress.js"></script>`
- Standalone `rhythm/index.html` + `rhythm/rhythm.js`
- Add a card to the main hub `index.html` (replace the "coming soon" placeholder)
## Core Gameplay Loop
1. User sets time signature and tempo (or uses tap-in)
2. User presses "Start"
3. Visual metronome begins — scrolling EKG-style waveform with beat markers
4. Audio metronome click plays on each beat (accent on beat 1)
5. User claps on each beat
6. Game detects clap onset via microphone amplitude spike
7. Game compares clap timing to expected beat timing
8. Green light = on-beat, Red light = off-beat (displayed in real-time)
9. Session stats tracked (accuracy %, streak, total beats)
## Controls / Settings
### Time Signature
- Numerator: dropdown or number input, range 1–12
- Denominator: dropdown with options 2, 4, 8, 16
- Default: 4/4
### Tempo
- Slider: 40–200 BPM
- Number input for precise entry
- Default: 90 BPM
- **Tap-in mode**: Button the user taps repeatedly; calculate BPM from average interval between taps (use last 4 taps). Display calculated BPM and let user confirm or adjust.
### Difficulty
- **Easy**: ±100ms tolerance window
- **Medium**: ±50ms tolerance window
- **Hard**: ±25ms tolerance window
- NOTE: These values will likely need tuning after testing. Audio input latency varies by device (typically 10-20ms). Add these as configurable constants at the top of the file.
### Game Modes
- **Practice Mode**: No scoring, just visual feedback (green/red). User can stop anytime. Show current streak and accuracy % but don't save.
- **Test Mode**: Runs for a set number of measures (e.g., 8 measures). Tracks accuracy, streak, and score. High scores qualify for leaderboard (shared with harmony game via ProgressManager). Score formula: `(correctBeats / totalBeats) * 100`, bonus for streaks.
## Visual Design
### EKG Waveform (Primary Visual)
- Canvas element, full width of the game area
- Scrolls continuously right-to-left
- Beat markers: vertical spikes at each beat position
  - Beat 1 (downbeat): taller spike, accent color (use `--color-primary` from shared styles)
  - Other beats: shorter spikes, secondary color
- Horizontal baseline connecting the spikes
- "Now" line: vertical line on the right side (~75% across) where the current beat arrives
- User's clap timing overlaid as markers on the waveform:
  - Green dot/tick if within tolerance
  - Red dot/tick if outside tolerance
  - Position shows exactly where in time the clap landed relative to the beat
- Smooth scrolling animation synced to tempo
### Beat Indicator Light
- Large circle above or below the waveform
- Flashes green on successful on-beat clap
- Flashes red on off-beat clap or missed beat
- Brief flash animation (~200ms)
### Metronome Audio
- Use Web Audio API (OscillatorNode or AudioBuffer) for click sounds
- Beat 1: higher pitch click (e.g., 1000 Hz, short envelope)
- Other beats: lower pitch click (e.g., 800 Hz, short envelope)
- Keep it subtle — shouldn't be jarring for kids
### Stats Display
- Current streak (consecutive on-beat claps)
- Accuracy percentage (on-beat / total expected beats)
- Beats completed / total (in test mode)
- BPM display
## Clap Detection Algorithm
### Onset Detection (Amplitude-Based)
```
1. Get audio input via getUserMedia + AnalyserNode
2. Monitor RMS (root mean square) amplitude in real-time
3. When RMS crosses a threshold AND previous frame was below threshold → onset detected
4. Record timestamp of onset
5. Compare onset timestamp to nearest expected beat timestamp
6. If |onset_time - beat_time| <= tolerance → on-beat
7. Apply cooldown (~200ms) after each detected onset to prevent double-triggers
```
### Key Parameters (make configurable)
- `ONSET_THRESHOLD`: RMS level to trigger detection (start with 0.05, will need tuning)
- `ONSET_COOLDOWN_MS`: Minimum time between detected onsets (200ms)
- `TOLERANCE_MS`: Per difficulty level (100/50/25)
- `LATENCY_COMPENSATION_MS`: Subtract from detected onset time to account for audio input latency (start with 0, let user calibrate later)
### Edge Cases
- Missed beat: if no clap detected within the tolerance window of a beat → count as miss, break streak
- Extra clap: clap detected but not near any beat → ignore (don't penalize in MVP)
- Background noise: threshold should be high enough to ignore ambient noise but low enough to catch a clap. May need a "calibrate" step where user claps once to set threshold.
## Leaderboard Integration
- Use existing `LeaderboardManager` from `shared/progress.js`
- Game identifier: `'rhythm'`
- Score: accuracy percentage (0-100)
- Same name-entry modal as harmony game
## Future Enhancements (NOT in MVP — just architecture notes)
- Specific strumming pattern training (D-DU-UDU, etc.)
- Subdivisions (eighth notes, sixteenth notes, triplets)
- Syncopation exercises
- Visual staff notation of rhythm patterns
- Latency calibration wizard
- Record and playback user's rhythm
