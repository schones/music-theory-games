# Music Theory Games — Architecture Guide

## Overview

A browser-based music theory education platform targeting kids ages 8–12. Pure vanilla JS (ES6 modules), no build step, no frameworks. Served as static files — open `index.html` directly or use any static server.

## Directory Structure

```
music-theory-games/
├── CLAUDE.md              # This file — architecture reference
├── .gitignore             # Ignores shared/config.js (contains API key)
├── index.html             # Main hub page — game launcher + tools section
├── shared/                # Shared modules and design system
│   ├── styles.css         # Global design system (CSS custom properties)
│   ├── progress.js        # Leaderboard & score tracking (localStorage)
│   ├── audio.js           # Web Audio API utilities, pitch detection, tone generation
│   ├── ai.js              # Adaptive difficulty tracking & AI tutor feedback
│   ├── config.js          # API key config (gitignored, not committed)
│   └── config.example.js  # Template — copy to config.js and add your key
├── harmony/               # Interval training game
│   ├── index.html         # Game page (inline CSS/JS)
│   ├── intervals.js       # Legacy (not imported — superseded by inline JS)
│   ├── interval-game.js   # Legacy (not imported — superseded by inline JS)
│   └── styles.css         # Game-specific styles
├── chords/                # Chord identification game
│   └── index.html         # Game page (inline CSS/JS)
├── melody/                # Melody echo game
│   └── index.html         # Game page (inline CSS/JS)
├── rhythm/                # Rhythm training game
│   ├── index.html         # Game page
│   ├── rhythm.js          # Game logic — EKG metronome, clap detection, scoring
│   └── styles.css         # Game-specific styles
├── strumming/             # Guitar strumming pattern game
│   ├── index.html         # Game page (inline CSS/JS), supports ?pattern=<id> URL param
│   ├── patterns.js        # Strumming pattern definitions & custom pattern storage
│   ├── detection.js       # Onset detection (transient/attack with hard lockout)
│   ├── calibration.js     # Strum direction calibration (kept for future use, not actively imported)
│   └── DIRECTION_DETECTION_README.md  # Technical reference for disabled direction detection
├── detector/              # Strumming pattern detector tool
│   └── index.html         # Tool page (inline CSS/JS)
└── skratch-studio/        # Skratch Studio — visual coding + music creation
    ├── index.html         # Studio page — Blockly workspace, canvas, audio controls
    ├── studio.js          # Main entry — wires workspace, sandbox, audio, music engine
    ├── studio.css         # Studio-specific dark theme styles
    ├── blocks.js          # Visual Blockly block definitions (Part A)
    ├── generators.js      # Visual JS code generators (Part A)
    ├── drawing-api.js     # p5.js-compatible Canvas 2D drawing API (Part A)
    ├── sandbox.js         # Safe code execution via new Function() (Part A)
    ├── audio-bridge.js    # PolySynth keyboard + mic pitch detection bridge (Part B)
    ├── piano.js           # Two-octave keyboard G3–G5 with computer key mapping (Part B)
    ├── music-blocks.js    # Music Blockly block definitions (Part C)
    ├── music-generators.js # Music JS code generators — outputs clean Tone.js code (Part C)
    └── music-engine.js    # MusicEngine class — Tone.Transport + instrument pooling (Part C)
```

## Technology Choices

- **No frameworks.** Vanilla JS with ES6 modules (`type="module"` in script tags).
- **No build step.** Files are served as-is. Use a local static server or open directly.
- **Tone.js 14.8.49** (via Cloudflare CDN) for synthesis — reliable cross-browser audio with minimal setup.
- **Web Audio API** directly for pitch detection (autocorrelation algorithm).
- **CSS custom properties** for theming — all colors, spacing, and typography in `shared/styles.css`.
- **localStorage** for all persistence — scores, leaderboards, preferences. No backend.

## Shared Modules

### shared/styles.css

Global design system imported in every HTML page. Defines CSS custom properties on `:root` (colors, spacing, typography), base reset, utility classes (`.container`, `.btn`, `.card`, `.badge`, `.gauge-*`), responsive layout, and `@keyframes` animations.

### shared/progress.js

Score tracking and leaderboards (localStorage). Key exports: `saveScore(game, playerName, score, metadata)`, `getLeaderboard(game, limit?)`, `clearLeaderboard(game)`, `getStats(game, playerName?)`, `savePreference(key, value)`, `getPreference(key, defaultValue)`. Storage keys: `mtt_leaderboard_{game}`, `mtt_prefs`.

### shared/audio.js

Web Audio API utilities. Key exports:
- `initAudio()` — Create/resume AudioContext (must be called from user gesture).
- `playNote(noteName, duration?, options?)` — Play note via Tone.js. Scientific pitch: `"C4"`, `"F#3"`.
- `playInterval(rootNote, intervalSemitones, mode)` — Harmonic (simultaneous) or melodic (sequential).
- `startPitchDetection(callback)` / `stopPitchDetection()` — Mic autocorrelation pitch detection. Callback: `(frequency, noteName, centsOff)`.
- `frequencyToNote(freq)` / `noteToFrequency(noteName)` — Hz ↔ scientific pitch conversion.
- `getIntervalName(semitones)` / `getSemitones(intervalName)` — Interval name lookup.

### shared/config.js

API key configuration (**gitignored**). Setup: `cp shared/config.example.js shared/config.js` then add key. Exports `CLAUDE_API_KEY`.

### shared/ai.js

Adaptive difficulty + optional AI tutor feedback. All features degrade gracefully without API key.

**Key exports:**
- `recordAttempt(game, skill, result)` — Track attempt. `result`: `{ hit, centsOff?, responseMs? }`.
- `recordSession(game, sessionData)` — Save session summary (capped at 50 per game).
- `getAdaptiveWeights(game, skills)` / `selectWeighted(game, skills)` — Weighted random selection biased toward weak skills.
- `getWeakAreas(game, limit?)` — Skills sorted by weakness.
- `getSessionFeedback(game, sessionData)` — Claude API call for kid-friendly feedback. Returns `null` on failure.
- `isAIAvailable()` / `clearPerformance(game)`.

**Adaptive algorithm:** Weight = `1 - accuracy`. Untried skills = 1.0. <5 attempts = 1.2× bonus. >24h since practice = 1.3× bonus. Normalized to probabilities summing to 1.

**AI tutor:** Calls `claude-haiku-4-5-20251001` with kid-friendly system prompt. Uses `anthropic-dangerous-direct-browser-access` header (acceptable for local use with gitignored key).

**Storage:** `mtt_ai_{game}` — `{ skills: { [name]: SkillData }, sessions: SessionData[] }`.

## Games

All games follow the same pattern: single HTML file with inline `<style>` and `<script type="module">`, state machine game logic, plain object state with direct DOM manipulation, leaderboard via `shared/progress.js`, adaptive difficulty via `shared/ai.js`.

### Harmony — Interval Training (game ID: `'harmony-training'`)

Listen to intervals, guess the name. Practice mode (immediate feedback, replay) and test mode (10/20 questions, leaderboard). Three difficulty levels: Easy (5 intervals), Medium (10), Hard (all 13). Features: root note selection C3–C5, ascending/descending/harmonic direction, guitar-tuner SVG gauge, streak tracking, keyboard shortcuts 1–9. Legacy files `intervals.js` and `interval-game.js` exist but are **not imported**.

### Chords — Chord Identification (game ID: `'chords'`)

Listen to chords, identify the type. Practice and test modes. Easy (Major/Minor), Medium (+Diminished), Hard (+inversions). Chord intervals: Major [0,4,7], Minor [0,3,7], Diminished [0,3,6]. Playback via PolySynth. Scoring: 100 base + streak bonus + difficulty multiplier. Keyboard shortcuts 1–3, Space replay, Enter next.

### Melody — Melody Echo (game ID: `'melody'`)

Listen to a melody, sing it back note by note via mic pitch detection. Practice and test modes. Difficulty controls interval range (stepwise → leaps). Progressive melody length: 3–6 notes, unlocked by consecutive perfects. Pitch stability detection (15 consecutive frames = lock). Per-note evaluation: correct/close/wrong/skipped. 6-second timeout per note. Keyboard: Space skip, Enter next, R replay.

### Rhythm — Rhythm Training (game ID: `'rhythm'`)

Clap along to a metronome. Practice and test (8/16 measures) modes. Tolerance: Easy ±100ms, Medium ±50ms, Hard ±25ms. EKG-style canvas metronome, clap detection via mic RMS onset detection (threshold 0.05, cooldown 200ms), spacebar alternative. Configurable BPM (40–200) and time signature. Count-in before scoring.

### Strumming — Guitar Strumming Patterns (game ID: `'strumming'`)

Play along to strumming patterns on guitar. Scrolling canvas timeline with target pattern. Practice (loops, no scoring) and test (4 measures, scored) modes. Tolerance: Easy ±100ms, Medium ±60ms, Hard ±30ms.

**Built-in patterns:** Basic 4/4 Downstrokes, Eighth Notes, Universal Strum, Rock Strum, Reggae Offbeat. Patterns defined as 8-element grids of `'D'`/`'U'`/`'-'`.

**patterns.js exports:** `BUILT_IN_PATTERNS`, `getAllPatterns()`, `getPatternById(id)`, `getCustomPatterns()`, `saveCustomPattern(pattern)`, `deleteCustomPattern(id)`. Storage: `mtt_strumming_custom_patterns`.

**detection.js** — Onset detection via transient detection with envelope tracking, sustain gate, and hard lockout. Key exports: `startDetection(audioCtx, onOnset, bpm?)`, `stopDetection()`, `isDetecting()`, `setDetectionBpm(bpm)`, `setLatencyCompensation(ms)`, `getLatencyCompensation()`.

**Onset algorithm:** Smoothed RMS envelope (EMA, alpha=0.005). Onset fires when: (1) RMS > envelope × TRANSIENT_RATIO, (2) RMS > ABS_MIN_RMS, (3) RMS > prevFrame × ATTACK_VELOCITY_RATIO. Audio read every frame including during lockout. Lockout = `min(DEFAULT_LOCKOUT_MS, eighthNoteMs * 0.7)`.

**Tunable constants (detection.js):**
- `ABS_MIN_RMS` (0.05) — Minimum RMS floor
- `TRANSIENT_RATIO` (1.5) — RMS must exceed envelope by this factor
- `ENVELOPE_ALPHA` (0.005) — EMA smoothing factor
- `ATTACK_VELOCITY_RATIO` (1.3) — Frame-to-frame RMS increase threshold
- `DEFAULT_LOCKOUT_MS` (400) — Maximum lockout duration
- `latencyCompensationMs` — Manual offset, persisted to `mtt_strumming_latency_ms`

**Direction detection: DISABLED.** Code exists in `detection.js` (`classifyDirection()`) and `calibration.js` but is not called. Uses spectral centroid + low/high energy ratio. Planned for re-enablement when accuracy improves.

**calibration.js** — Kept for future use. Not imported by game or detector pages. Guided calibration flow for strum direction detection. Storage: `mtt_strumming_calibration`.

### Detector — Strumming Pattern Detector (tool, not a game)

Records guitar strumming, auto-detects tempo via IOI histogram, quantizes onsets to eighth-note grid, matches against pattern library (weighted slot comparison, top 3 results). Three screens: Setup → Recording → Results. "Try This Pattern" links to `../strumming/index.html?pattern=<id>`. Reuses `strumming/detection.js` and `strumming/patterns.js`. Hub page card in "Tools" section (`.tool-card`). CSS prefix: `det-`.

## Skratch Studio — Visual Coding + Music Creation

### Overview

Blockly-based creative coding environment. Kids build visual art and music with drag-and-drop blocks. Generates real JavaScript — visuals use Canvas 2D (p5.js-style), music uses Tone.js. Both run simultaneously.

### Block Categories

| Category | Color | Blocks | Source |
|----------|-------|--------|--------|
| Visuals | Purple/270 | draw_circle, draw_rect, draw_star, draw_line, set_fill, set_stroke, no_fill, set_stroke_weight, clear_canvas, set_background, draw_trail | blocks.js |
| Motion | Blue/210 | move_to, move_to_center, rotate_by, grow_by, shrink_by, save_position, restore_position | blocks.js |
| Events | Gold/45 | when_start_clicked, when_note_played, when_specific_note, when_pitch_threshold, every_n_beats | blocks.js |
| Sound Data | Green/120 | current_pitch, current_note_name, volume_level, note_is_playing | blocks.js |
| Math | Green/120 | map_value, random_number, canvas_width, canvas_height, frame_count | blocks.js |
| Control | Orange/30 | repeat_times, simple_if, set_variable | blocks.js |
| Drums | Red/0 | play_kick, play_snare, play_hihat, drum_pattern | music-blocks.js |
| Bass | Deep Blue/240 | play_bass_note, bass_pattern | music-blocks.js |
| Melody | Pink/330 | play_melody_note, play_chord, rest | music-blocks.js |
| Song | Teal/170 | music_start, section, repeat_section | music-blocks.js |
| Timing | Gold/50 | set_tempo | music-blocks.js |

### MusicEngine (music-engine.js)

Wraps `Tone.Transport` for scheduling. Instruments created once and reused:

| Name | Tone.js Type | Description |
|------|-------------|-------------|
| kick | MembraneSynth | Low-frequency membrane hit |
| snare | NoiseSynth | White noise burst |
| hihat | MetalSynth | High metallic click |
| bass | MonoSynth | Sawtooth bass with lowpass filter |
| melody | Synth | Triangle wave lead |
| chords | PolySynth | Polyphonic (up to 6 voices) for triads |

All route through shared `Tone.Volume` node. Key methods: `ensureTone()`, `setBpm(bpm)`, `setVolume(db)`, `scheduleKick/Snare/Hihat/Bass/Melody/Chord(...)`, `start()`, `stop()`, `onBeat(callback)`, `startBeatLoop()`, `destroy()`.

Music generators output clean Tone.js code (e.g., `kick.triggerAttackRelease('C1', '8n', '0:0:0')`). Chord definitions: Major [0,4,7], Minor [0,3,7], Diminished [0,3,6]. Drum presets: Rock, Disco, Hip Hop, Four on Floor. Bass presets: Root Notes, Walking Bass, Octave Bounce, Funky.

### Execution Architecture

**Play:** `Tone.start()` → generated code runs in visual `Sandbox` (rAF loop) AND in separate `new Function()` context where instrument names resolve to proxy objects forwarding to `MusicEngine.schedule*()`. Visual functions are no-ops in music context. Both run simultaneously.

**Stop:** `Sandbox.stop()` + `MusicEngine.stop()`.

**Loop mode:** When Loop checkbox is checked, `Tone.Transport.loop` is enabled. Workspace changes during playback are applied at the next loop boundary (live editing). Visual animation restarts on each loop.

### AudioBridge (audio-bridge.js)

Tone.js PolySynth (8 voices) for keyboard playback + mic pitch detection via `shared/audio.js`.

**Sound presets:** Piano (triangle wave), Organ (B3-style: fatsine + distortion + tremolo), Synth (fatsawtooth + lowpass filter). Switched via `setSoundType(type)`.

**Sustain pedal:** `sustainOn()`/`sustainOff()` methods. Notes released while sustain is on are held until sustain is released. Tracks `_activeNotes` (keys held) and `_sustainedNotes` (released while sustained).

Key methods: `playNote(noteName)` (one-shot), `noteOn(noteName)`/`noteOff(noteName)` (keyboard-style), `setSoundType(type)`, `sustainOn()`/`sustainOff()`, `releaseAll()`, `startMic()`/`stopMic()`.

### Piano (piano.js)

Two-octave clickable keyboard (G3–G5, 15 white + 10 black keys). Supports mouse/touch and computer keyboard input.

**Keyboard mapping:**
- A-row (white): A=G3, S=A3, D=B3, F=C4, G=D4, H=E4, J=F4, K=G4, L=A4
- Z-row (sharps): Z=G#3, X=A#3, C=C#4, V=D#4, B=F#4, N=G#4, M=A#4
- Q-row (white): Q=B4, W=C5, E=D5, R=E5, T=F5, Y=G5
- Number row (sharps): 2=C#5, 3=D#5, 5=F#5
- Spacebar: sustain pedal (hold to sustain)

Constructor: `new Piano(container, { onNoteOn, onNoteOff, onSustainChange })`. Keyboard events ignore inputs, textareas, and Blockly (`#blocklyDiv`).

### UI Controls

Play/Stop, Loop toggle, BPM slider (60–180), Volume slider (0–100%), Beat indicator, Mic toggle, Sound selector (Piano/Organ/Synth), Piano keyboard with sustain indicator, Code preview (collapsible), Starter dropdown (Visual/Music), Clear All button (with confirm dialog).

### Starter Programs

| Name | Category | Description |
|------|----------|-------------|
| Circles | Visual | Concentric circles with grow effect |
| Rainbow Grid | Visual | Nested loop grid pattern |
| Spiral | Visual | Rotating circle spiral |
| Sound Circles | Visual | Circles appear when notes are detected |
| Note Garden | Visual | Different shapes for each note (C–B) |
| Bounce | Visual | Trail effect with note-triggered rings |
| First Beat | Music | Basic rock beat |
| Bass Groove | Music | Rock drums + bass line |
| My First Song | Music | Drums + bass + melody + sections |
| Beat Painter | Music+Visual | Hip-hop drums + beat-triggered visuals |
| Blank Canvas | — | Empty workspace |

### Workspace Persistence

Saved to `localStorage` key `skratch-studio-workspace` on every non-UI change. Falls back to "Circles" starter if no saved state. Clear All button removes saved state.

## Conventions

- **File naming:** lowercase, hyphens for multi-word.
- **Module pattern:** Every `.js` file is an ES6 module. No global variables. Import/export only.
- **CSS scoping:** Shared styles use `.mtt-` prefix. Game-specific classes use game prefix (`.harmony-`, `.rhythm-`). Skratch Studio uses `.sk-` prefix for piano component.
- **Error handling:** Audio operations wrapped in try/catch. Mic failures show friendly messages. localStorage failures degrade gracefully.
- **Accessibility:** Semantic HTML, ARIA labels, keyboard navigation, WCAG AA color contrast, `prefers-reduced-motion` respected.
- **No minification.** Code is readable as-is. Educational project.
- **State machines:** All games use plain-object state machines with direct DOM manipulation. No virtual DOM.

## Running Locally

```bash
# Any static server works:
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000` in a browser.

## Testing Notes

- Audio playback requires a user gesture (click/tap) — browsers block autoplay.
- Pitch detection requires HTTPS or localhost (mic access restricted on insecure origins).
- localStorage may be disabled in private/incognito mode.
- Tested target: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+.

## Skratch — Visual Effects Module (Planned)

**Status: Not yet implemented.** The `feature/skratch-effects` branch exists but `shared/skratch/` has not been created. Plan: Canvas 2D particle system for visual feedback (sparks, bursts, trails) on game events across all games.

## TODO

- Experiment with themes — different color palettes, dark/light mode toggle, kid-friendly themes.
- Implement Skratch visual effects module (`shared/skratch/`) — Canvas 2D particle system for game feedback.
- Skratch Studio enhancements: more drum/bass presets, record and export audio.
- Strumming: re-enable direction detection, custom pattern builder UI, detector tuning tool.
