# Music Theory Games — Full Repository Summary

## Directory Tree

```
music-theory-games/
├── .gitignore
├── CLAUDE.md
├── README.md
├── index.html                          # Hub page — game launcher
├── shared/
│   ├── styles.css                      # Global design system (CSS custom properties)
│   ├── progress.js                     # Leaderboard & score tracking (localStorage)
│   ├── audio.js                        # Web Audio API + Tone.js utilities
│   ├── ai.js                           # Adaptive difficulty & AI tutor feedback
│   ├── config.js                       # API key config (gitignored)
│   ├── config.example.js               # Template for config.js
│   └── skratch/
│       ├── skratch.js                  # Entry point — visual effects system
│       ├── particle.js                 # Particle class (circle/star/diamond/drop)
│       ├── effects.js                  # 6 predefined effect presets
│       ├── visual-canvas.js            # Overlay canvas + animation loop
│       └── skratch-editor.js           # Event→effect rules editor UI
├── harmony/
│   ├── index.html                      # Interval training game (inline CSS/JS)
│   ├── intervals.js                    # Legacy game logic (NOT imported)
│   ├── interval-game.js               # Legacy game controller (NOT imported)
│   └── styles.css                      # Game-specific styles
├── chords/
│   └── index.html                      # Chord identification game (inline CSS/JS)
├── melody/
│   └── index.html                      # Melody echo game (inline CSS/JS)
├── rhythm/
│   ├── index.html                      # Rhythm training game page
│   ├── rhythm.js                       # Game logic — EKG metronome, clap detection
│   └── styles.css                      # Game-specific styles
├── strumming/
│   ├── index.html                      # Guitar strumming pattern game (inline CSS/JS)
│   ├── patterns.js                     # Pattern definitions & custom pattern CRUD
│   ├── detection.js                    # Onset detection (transient/attack + lockout)
│   ├── calibration.js                  # Direction calibration (kept for future use)
│   └── DIRECTION_DETECTION_README.md   # Technical reference for disabled feature
├── detector/
│   └── index.html                      # Pattern detector tool (inline CSS/JS)
└── skratch-studio/
    ├── index.html                      # Studio page — Blockly + Canvas + Audio
    ├── studio.js                       # Main entry point, wires everything together
    ├── studio.css                      # Studio-specific dark theme styles
    ├── blocks.js                       # Custom Blockly block definitions
    ├── generators.js                   # JS code generators for custom blocks
    ├── drawing-api.js                  # p5.js-compatible Canvas 2D API
    ├── sandbox.js                      # Safe code execution via new Function()
    ├── audio-bridge.js                 # Tone.js + mic pitch detection bridge
    └── piano.js                        # Clickable piano keyboard component
```

---

## File-by-File Summary

---

### Root Files

#### `.gitignore`
Ignores `shared/config.js` (contains API key) to prevent accidental commits of secrets.

#### `README.md`
One-liner: "A music theory education platform for kids ages 6-12."

#### `CLAUDE.md`
Comprehensive architecture guide (~600 lines). Documents every module, algorithm, data schema, and convention. Serves as the authoritative reference for the project.

#### `index.html`
**Role:** Main hub page — game launcher and tools section.

Links to all 6 games/tools via card grid layout:
- Harmony Training → `harmony/index.html`
- Chord Identification → `chords/index.html`
- Melody Echo → `melody/index.html`
- Rhythm Training → `rhythm/index.html`
- Guitar Strumming → `strumming/index.html`
- Skratch Studio → `skratch-studio/index.html`
- Pattern Detector (Tools section) → `detector/index.html`

**Imports:** `shared/styles.css` only. No JS modules.

---

### `shared/` — Shared Modules

#### `shared/styles.css` (779 lines)
**Role:** Global design system. Imported by every HTML page.

**Defines:**
- CSS custom properties on `:root`: color palette (kid-friendly, high contrast), font sizes (`--font-size-xs` through `--font-size-xxl`), spacing scale, border radii, shadows, transitions
- Base reset and typography (system font stack)
- Layout: `.container`, `.mtt-header`, `.mtt-header__nav`
- Components: `.btn` (with variants `--primary`, `--secondary`, `--success`, `--danger`, `--small`, `--large`), `.card`, `.badge`, `.gauge-*`, `.score-display`, `.leaderboard`
- Animations: `@keyframes pop-in`, `shake`, `score-fly`, `pulse-glow`, `fade-in`
- Responsive breakpoints: 768px, 480px
- `prefers-reduced-motion` support

**Connected to:** Every HTML page in the project.

---

#### `shared/progress.js`
**Role:** Score tracking and leaderboard persistence via localStorage.

**Exports:**
| Export | Description |
|--------|------------|
| `saveScore(game, playerName, score, metadata)` | Persist a score entry |
| `getLeaderboard(game, limit=10)` | Top scores sorted descending |
| `clearLeaderboard(game)` | Reset a game's leaderboard |
| `getStats(game, playerName?)` | Aggregate stats (total, avg, best streak) |
| `savePreference(key, value)` | Generic preference storage |
| `getPreference(key, defaultValue)` | Generic preference retrieval |
| `renderLeaderboard(container, game, limit=10)` | Render leaderboard HTML into container |

**Storage keys:** `mtt_leaderboard_{game}` (JSON array), `mtt_prefs` (JSON object).

**Connected to:** ALL games — harmony, chords, melody, rhythm, strumming, detector.

---

#### `shared/audio.js`
**Role:** Web Audio API utility module wrapping Tone.js for synthesis and raw Web Audio for pitch detection.

**Exports:**
| Export | Description |
|--------|------------|
| `initAudio()` | Create/resume AudioContext (must be called from user gesture) |
| `playNote(noteName, duration)` | Play note via Tone.js PolySynth (triangle oscillator) |
| `playInterval(rootNote, semitones, mode, duration)` | Play two notes (harmonic or melodic) |
| `startPitchDetection(callback)` | Mic access + autocorrelation pitch detection loop |
| `stopPitchDetection()` | Stop mic stream and detection |
| `frequencyToNote(freq)` | Hz → `{ noteName, octave, cents }` |
| `noteToFrequency(name)` | Scientific pitch name → Hz |
| `getIntervalName(semitones)` | Semitone count → interval name |
| `getSemitones(name)` | Interval name → semitone count |
| `getNoteRange(startOctave, endNote)` | Generate array of note names in range |
| `NOTE_NAMES` | Array of 12 note name strings |
| `NOTE_DISPLAY` | Display-friendly note name map |
| `INTERVAL_NAMES` | Array of interval name strings |

**Connected to:** harmony, chords, melody games; `skratch-studio/audio-bridge.js`.

---

#### `shared/ai.js`
**Role:** Adaptive difficulty tracking and optional AI tutor feedback. Degrades gracefully without API key.

**Exports:**
| Export | Description |
|--------|------------|
| `getPerformance(game)` | Raw performance data |
| `recordAttempt(game, skill, result)` | Track single practice attempt |
| `recordSession(game, sessionData)` | Save completed session (max 50/game) |
| `clearPerformance(game)` | Reset tracking data |
| `getAdaptiveWeights(game, skills)` | Calculate probability weights biased toward weak areas |
| `selectWeighted(game, skills)` | Pick skill using adaptive weighted random |
| `getWeakAreas(game, limit)` | Skills sorted by weakness |
| `getPerformanceSummary(game)` | Human-readable summary for AI prompts |
| `isAIAvailable()` | Check if API key is configured |
| `getSessionFeedback(game, sessionData)` | Call Claude API for post-session feedback |

**Adaptive algorithm:** `weight = 1 - accuracy`. Novelty bonus 1.2x for <5 attempts. Recency bonus 1.3x for >24h since last attempt. Normalized to probabilities summing to 1.

**AI integration:** Calls `claude-haiku-4-5-20251001` with kid-friendly tutor system prompt. Uses `anthropic-dangerous-direct-browser-access` header.

**Storage:** `mtt_ai_{game}` — JSON with `skills` map and `sessions` array.

**Depends on:** `shared/config.js` (dynamic import with fallback).
**Connected to:** chords, melody, strumming games; detector tool.

---

#### `shared/config.example.js` / `shared/config.js`
**Role:** API key configuration. `config.js` is gitignored.

**Exports:** `CLAUDE_API_KEY` (string, empty disables AI features).

**Connected to:** `shared/ai.js` (dynamic import).

---

### `shared/skratch/` — Visual Effects System

#### `shared/skratch/skratch.js`
**Role:** Entry point for the Skratch visual effects system. Factory function that wires together the visual canvas and editor.

**Imports:** `VisualCanvas` from `visual-canvas.js`, `SkratchEditor` from `skratch-editor.js`.

**Exports:**
| Export | Description |
|--------|------------|
| `createSkratch(container, eventDefinitions, defaultRules)` | Returns `{ trigger, showEditor, hideEditor, destroy }` |

- `trigger(eventName)` fires the mapped effect preset
- Rules saved/loaded from localStorage key `skratch-rules`

**Connected to:** `chords/index.html` (currently the only game using it).

---

#### `shared/skratch/particle.js`
**Role:** Individual particle class for Canvas 2D rendering.

**Exports:** `Particle` class.

**Properties:** position (x/y), velocity (vx/vy), life, maxLife, size, color, shape (`circle`|`star`|`diamond`|`drop`), rotation, gravity, wobble, glow.

**Methods:** `update(dt)`, `draw(ctx)`, `isDead()`.

**Connected to:** `visual-canvas.js`.

---

#### `shared/skratch/effects.js`
**Role:** Predefined particle effect configurations.

**Exports:** `EFFECT_PRESETS` object with 6 presets:
- `bright_sparkles` — Yellow/white sparkles
- `blue_rain` — Blue falling drops
- `fire_burst` — Orange/red burst
- `cool_mist` — Cyan/teal mist
- `confetti` — Multi-color confetti
- `purple_galaxy` — Purple/pink galaxy

Each defines: `label`, `colors[]`, `particleConfig`, `count`, `burst` (boolean).

**Connected to:** `visual-canvas.js`, `skratch-editor.js`.

---

#### `shared/skratch/visual-canvas.js`
**Role:** Overlay canvas that renders particle effects on top of game content.

**Imports:** `Particle` from `particle.js`, `EFFECT_PRESETS` from `effects.js`.

**Exports:** `VisualCanvas` class.

**Behavior:** Creates an absolute-positioned transparent canvas over the container. Runs a continuous `requestAnimationFrame` loop. `spawnEffect(presetName)` creates particles from a preset. Uses `ResizeObserver` for responsive sizing.

**Connected to:** `skratch.js`.

---

#### `shared/skratch/skratch-editor.js`
**Role:** Visual rules editor UI — lets users map game events to effect presets via dropdown menus.

**Imports:** `EFFECT_PRESETS` from `effects.js`.

**Exports:** `SkratchEditor` class.

**Behavior:** Renders a panel with one row per event definition. Each row has a `<select>` dropdown listing available effect presets plus "none". Injects scoped CSS dynamically. Calls `onRulesChange(newRules)` callback when user changes mappings.

**Connected to:** `skratch.js`.

---

### `harmony/` — Interval Training Game

#### `harmony/index.html` (~830 lines)
**Role:** Interval training game. Single HTML file with inline `<style>` and `<script type="module">`.

**Imports:**
- `initAudio, playNote, startPitchDetection, stopPitchDetection, frequencyToNote, noteToFrequency, getIntervalName, getNoteRange, NOTE_NAMES, INTERVAL_NAMES` from `shared/audio.js`
- `saveScore, getLeaderboard, renderLeaderboard` from `shared/progress.js`

**Game ID:** `'harmony-training'`

**Features:**
- Practice/test modes, 3 difficulty levels
- Difficulty pools: Easy (5 intervals), Medium (10), Hard (all 13)
- Tolerance: +/-50/+/-30/+/-15 cents by difficulty
- Arc-style tuner gauge (SVG, 31 color-coded segments + rotating needle)
- Pitch detection via mic
- Streak/score tracking with keyboard shortcuts (1-9)

**State machine:** `SETUP -> GAME -> RESULTS` (screen toggling via `hidden` attribute).

---

#### `harmony/intervals.js`
**Role:** Legacy game logic module. **NOT imported** by `index.html` — superseded by inline JS. Retained for reference.

**Imports:** `shared/audio.js`, `shared/progress.js`.
**Game ID:** `'harmony-intervals'` (different from current game).

---

#### `harmony/interval-game.js`
**Role:** Legacy game controller. **NOT imported** — references functions that no longer exist in `shared/audio.js`. Retained for reference.

---

#### `harmony/styles.css`
**Role:** Game-specific styles (`.harmony-*` prefix). Setup grid, scorebar, gauge area, feedback panel, answer grid with correct/wrong states, keyboard hints, score flyaway animation, responsive rules.

**Connected to:** `harmony/index.html`.

---

### `chords/` — Chord Identification Game

#### `chords/index.html` (~850 lines)
**Role:** Chord identification game. Single HTML file with inline CSS/JS.

**Imports:**
- `initAudio, playNote, noteToFrequency, frequencyToNote, getNoteRange` from `shared/audio.js`
- `saveScore, getLeaderboard, renderLeaderboard` from `shared/progress.js`
- `recordAttempt, recordSession, selectWeighted, getSessionFeedback, isAIAvailable` from `shared/ai.js`
- `createSkratch` from `shared/skratch/skratch.js`

**Game ID:** `'chords'`

**Chord types:** Major `[0,4,7]`, Minor `[0,3,7]`, Diminished `[0,3,6]`.

**Difficulty levels:**
- Easy: Major/Minor (2 choices)
- Medium: +Diminished (3 choices)
- Hard: +Inversions (root, 1st, 2nd)

**Features:**
- Adaptive chord selection via `selectWeighted()`
- AI tutor feedback after test mode
- Skratch visual effects (5 event triggers: correct_answer, wrong_answer, streak_3, streak_5, perfect_score)
- Keyboard shortcuts (1-3 for chord type, Space replay, Enter next)
- Scoring: 100 base + streak bonus (25 at 3+, 50 at 5+) x difficulty multiplier (1/1.5/2)

---

### `melody/` — Melody Echo Game

#### `melody/index.html` (~1067 lines)
**Role:** Melody echo game. Single HTML file with inline CSS/JS.

**Imports:** `shared/audio.js`, `shared/progress.js`, `shared/ai.js`.

**Game ID:** `'melody'`

**Features:**
- Progressive melody length: 3->4->5->6 notes, unlocked after 3 consecutive perfects at current length
- Scale-based melody generation (major scale from selected root)
- Pitch stability detection: 15 consecutive same-note frames required for lock
- Per-note evaluation: correct (same semitone, green), close (+/-1, yellow), wrong (red), skipped
- Note timeout: 6 seconds -> auto-skip
- 400ms post-lock cooldown
- Adaptive starting note via `selectWeighted()`
- AI tutor feedback after test mode

**State machine:** `SETUP -> PLAYING -> LISTENING -> EVALUATED -> (next or RESULTS)`

**Progression stored via:** `savePreference('melody_max_length', n)`.

---

### `rhythm/` — Rhythm Training Game

#### `rhythm/index.html`
**Role:** Game page shell. Links to `shared/styles.css`, `rhythm/styles.css`, and loads `rhythm/rhythm.js` as module.

Three screens: setup, game (EKG canvas + beat light + stats), results.

---

#### `rhythm/rhythm.js` (~873 lines)
**Role:** Complete rhythm game logic.

**Imports:** `saveScore, getLeaderboard, renderLeaderboard, savePreference, getPreference` from `shared/progress.js`.

**Does NOT use `shared/audio.js`** — creates its own `AudioContext` and `OscillatorNode` for metronome clicks (1000 Hz beat 1, 800 Hz other beats).

**Game ID:** `'rhythm'`

**Onset detection:** Simple RMS threshold crossing.
- `ONSET_THRESHOLD` = 0.05
- `ONSET_COOLDOWN_MS` = 200ms
- `getFloatTimeDomainData()` -> compute RMS -> threshold crossing -> `performance.now()` timestamp

**EKG canvas:** Scrolling waveform with beat spikes (taller on beat 1), green triangles for hits, red for misses, X marks for missed beats.

**Features:**
- Practice/test modes (8 or 16 measures)
- Configurable time signature (numerator 1-12, denominator 2/4/8/16)
- BPM slider (40-200) + tap tempo (average of last 4 taps)
- Difficulty tolerance: Easy +/-100ms, Medium +/-50ms, Hard +/-25ms
- Count-in: 1 measure before scoring
- Spacebar as keyboard alternative to clapping
- Scoring: 10 pts/beat + 5 streak bonus at 5+ hits

---

#### `rhythm/styles.css`
**Role:** Game-specific styles (`.rhythm-*` prefix). EKG canvas area, beat light with flash animation, BPM slider, tap-in row, time signature controls.

---

### `strumming/` — Guitar Strumming Pattern Game

#### `strumming/index.html` (~78KB)
**Role:** Guitar strumming pattern game. Single HTML file with inline CSS/JS.

**Imports:**
- `startDetection, stopDetection, setDetectionBpm, setLatencyCompensation, getLatencyCompensation` from `detection.js`
- `getAllPatterns, getPatternById, gridToString` from `patterns.js`
- `saveScore, getLeaderboard, renderLeaderboard` from `shared/progress.js`
- `recordAttempt, recordSession, selectWeighted, getSessionFeedback, isAIAvailable` from `shared/ai.js`

**Game ID:** `'strumming'`

**Features:**
- Scrolling timeline canvas with playhead at ~35% from left
- PATTERN row (D/U arrows) + YOU row (timing diamonds colored by accuracy)
- Timing indicator bar (rolling average of last 8 strums)
- Beat light, metronome, latency compensation slider (-100 to +100ms)
- Practice (continuous loop) / test (4 measures) modes
- Difficulty: Easy +/-100ms, Medium +/-60ms, Hard +/-30ms
- Reads `?pattern=<id>` URL param for pre-selection
- Timing histogram in results screen

---

#### `strumming/patterns.js`
**Role:** Pattern data definitions and custom pattern CRUD.

**Exports:**
| Export | Description |
|--------|------------|
| `BUILT_IN_PATTERNS` | Array of 5 starter patterns |
| `getCustomPatterns()` | Custom patterns from localStorage |
| `saveCustomPattern(pattern)` | Save custom pattern |
| `deleteCustomPattern(id)` | Delete custom pattern |
| `getAllPatterns()` | Built-in + custom combined |
| `getPatternById(id)` | Find pattern by id |
| `gridToString(grid)` | Format 8-slot grid for display |

**Built-in patterns:** Basic 4/4 Downstrokes, Eighth Notes, Universal Strum, Rock Strum, Reggae Offbeat.

**Data model:** `{ id, name, description, grid[8], suggestedBpmRange, tips, builtIn }`.

**Storage:** `mtt_strumming_custom_patterns` (JSON array).

**Connected to:** `strumming/index.html`, `detector/index.html`.

---

#### `strumming/detection.js`
**Role:** Onset detection for guitar strums using Web Audio API.

**Exports:**
| Export | Description |
|--------|------------|
| `startDetection(audioCtx, onOnset, bpm?)` | Start mic, return Promise<boolean> |
| `stopDetection()` | Stop mic and cleanup |
| `isDetecting()` | Check if running |
| `setDetectionBpm(bpm)` | Update lockout for new tempo |
| `setLatencyCompensation(ms)` | Set and persist latency offset |
| `getLatencyCompensation()` | Get current latency offset |

**Algorithm:** Transient detection with envelope tracking. Three conditions for onset: (1) RMS > envelope x `TRANSIENT_RATIO` (1.5), (2) RMS > `ABS_MIN_RMS` (0.05), (3) RMS increased >=30% from previous frame (`ATTACK_VELOCITY_RATIO` = 1.3). Hard lockout = `min(400ms, eighthNoteMs x 0.7)`.

**Contains (DISABLED):** `classifyDirection()` — spectral-based direction classification using centroid and low/high energy ratio.

**Imports:** `getCalibrationData, computeSpectralCentroid, computeLowHighRatio` from `calibration.js` (for disabled function only).

**Storage:** `mtt_strumming_latency_ms`.

**Connected to:** `strumming/index.html`, `detector/index.html`.

---

#### `strumming/calibration.js`
**Role:** Strum direction calibration. **Kept for future use** — not actively imported by game pages. Only imported by `detection.js` for the disabled `classifyDirection()`.

**Exports:**
| Export | Description |
|--------|------------|
| `CALIBRATION_RMS_THRESHOLD` | 0.12 |
| `getCalibrationData()` | Retrieve calibration from localStorage |
| `hasCalibration()` | Check if calibration exists |
| `clearCalibration()` | Remove calibration data |
| `runCalibration(audioCtx, analyser, callbacks, signal?)` | Guided calibration flow |
| `computeSpectralCentroid(freqBuffer, sampleRate, fftSize)` | Spectral centroid calculation |
| `computeLowHighRatio(freqBuffer, sampleRate, fftSize, cutoffHz)` | Low/high energy ratio |

**Storage:** `mtt_strumming_calibration`.

---

#### `strumming/DIRECTION_DETECTION_README.md`
**Role:** Technical reference documenting why direction detection was disabled (~60-70% accuracy was unreliable) and recommended future approaches (video hand tracking, accelerometer, ML, multi-frame spectral trajectory, stereo analysis).

---

### `detector/` — Pattern Detector Tool

#### `detector/index.html` (~50.8KB)
**Role:** Standalone tool that records guitar strumming, detects tempo, quantizes to eighth-note grid, and matches against pattern library.

**Imports:**
- `startDetection, stopDetection, setDetectionBpm` from `../strumming/detection.js`
- `getAllPatterns, saveCustomPattern, gridToString` from `../strumming/patterns.js`
- `getSessionFeedback, isAIAvailable` from `../shared/ai.js`

**CSS prefix:** `det-`

**Three screens:** Setup -> Recording -> Results.

**Algorithms:**
- **Tempo detection:** Median IOI -> histogram (20ms bins) -> dominant cluster -> check 2x/0.5x for eighth vs quarter -> BPM clamped [30, 200]
- **Quantization:** First onset = phase reference, map to nearest eighth-note slot, consensus pattern = mode per slot across measures
- **Pattern matching:** Weighted slot comparison (same type 3pts, both strums different type 1.5pts, both rest 1pt, mismatch 0pts)

**Features:** BPM adjustment slider (re-quantizes on change), top 3 matches with similarity %, custom pattern save when <70% match, "Try This Pattern" link -> `strumming/index.html?pattern=<id>`.

---

### `skratch-studio/` — Visual Coding Studio

#### `skratch-studio/index.html`
**Role:** Studio page shell. Loads Blockly (CDN), `@blockly/field-colour` plugin, Tone.js (CDN).

**Layout:** Left panel (Blockly workspace), Right panel (Canvas 400x400 + Controls + Code Preview).

**Controls:** Play/Stop buttons, starter dropdown (7 options), mic toggle, BPM slider (40-200), piano keyboard, collapsible code preview with copy button.

**Entry point:** `import { init } from './studio.js'; init();`

---

#### `skratch-studio/studio.js`
**Role:** Main entry point. Wires together all studio modules.

**Imports:**
- `registerBlocks, getToolboxXml` from `blocks.js`
- `registerGenerators` from `generators.js`
- `Sandbox` from `sandbox.js`
- `AudioBridge` from `audio-bridge.js`
- `Piano` from `piano.js`

**Exports:** `init()` function.

**Behavior:**
1. Registers custom Blockly blocks and generators
2. Creates Blockly workspace with toolbox XML
3. Creates Sandbox (canvas + error bar)
4. Creates AudioBridge (Tone.js synth + mic detection)
5. Creates Piano (clickable keyboard in `#pianoContainer`)
6. Wires workspace change -> code generation -> code preview update
7. Play button: compiles code via sandbox, starts animation loop
8. Stop button: stops sandbox + audio
9. Mic button: toggles pitch detection, highlights piano keys
10. BPM slider: updates sandbox beat timer interval
11. Starter selector: loads predefined Blockly workspace JSON

**7 starter programs:** blank, circles, rainbow, spiral, sound_circles, note_garden, bounce — all defined as Blockly JSON serialization objects.

**Workspace persistence:** localStorage key `skratch-studio-workspace`.

---

#### `skratch-studio/studio.css` (298 lines)
**Role:** Studio-specific dark theme styles.

**Key styles:**
- `.studio-layout` — Flex layout, 60/40 split (`.studio-left` flex:6, `.studio-right` flex:4)
- `.blockly-container` — Full-height with dark background (#1e1e2e)
- `.canvas-panel` — Canvas with dot grid background, 1:1 aspect ratio, max 500px
- `.studio-controls` — Play (green), Stop (red), starter dropdown
- `.code-preview` — Collapsible panel with monospace code display
- `.audio-controls` — Mic button, BPM slider, piano container
- Responsive: column layout below 900px

---

#### `skratch-studio/blocks.js`
**Role:** Custom Blockly block definitions and toolbox XML generation.

**Exports:**
| Export | Description |
|--------|------------|
| `registerBlocks()` | Register all custom blocks with Blockly |
| `getToolboxXml()` | Return toolbox XML string for workspace |

**Block categories:**
| Category | Color | Blocks |
|----------|-------|--------|
| Visuals | Purple/270 | draw_circle, draw_rect, draw_star, draw_line, set_fill, set_stroke, no_fill, set_stroke_weight, clear_canvas, set_background, draw_trail |
| Motion | Blue/210 | move_to, move_to_center, rotate_by, grow_by, shrink_by, save_position, restore_position |
| Math | Green/120 | map_value, random_number, canvas_width, canvas_height, frame_count |
| Events | Gold/45 | when_start_clicked, when_note_played, when_specific_note, when_pitch_threshold, every_n_beats |
| Sound Data | Green/120 | current_pitch, current_note_name, volume_level, note_is_playing |
| Control | Orange/30 | repeat_times, simple_if, set_variable |

Handles `FieldColour` plugin compatibility (removed from Blockly core in v12).

---

#### `skratch-studio/generators.js`
**Role:** JavaScript code generators for all custom Blockly blocks.

**Exports:** `registerGenerators()`.

**Generates p5.js-style calls:** `circle()`, `rect()`, `fill()`, `stroke()`, `push()`, `pop()`, `translate()`, `rotate()`, `scale()`, `background()`, `map()`, `random()`, `constrain()`, `dist()`, `star()`, `line()`, `strokeWeight()`, `noFill()`, `noStroke()`.

**Event blocks generate:** `onNotePlayed(function() {...})` and `everyNBeats(n, function() {...})`.

**Connected to:** `studio.js` (called during workspace init).

---

#### `skratch-studio/drawing-api.js`
**Role:** p5.js-compatible Canvas 2D drawing API.

**Exports:** `DrawingAPI` class.

**Methods:**
| Category | Methods |
|----------|---------|
| Shapes | `circle(x,y,d)`, `rect(x,y,w,h)`, `ellipse(x,y,w,h)`, `triangle(x1,y1,x2,y2,x3,y3)`, `line(x1,y1,x2,y2)`, `star(x,y,r1,r2,n)` |
| Color/Style | `fill(r,g,b,a)`, `stroke(r,g,b,a)`, `noFill()`, `noStroke()`, `strokeWeight(w)`, `background(r,g,b)` |
| Transform | `push()`, `pop()`, `translate(x,y)`, `rotate(angle)`, `scale(sx,sy)` |
| Utilities | `map(v,a,b,c,d)`, `lerp(a,b,t)`, `random(min,max)`, `constrain(v,lo,hi)`, `dist(x1,y1,x2,y2)` |

**State:** `frameCount`, `mouseX`, `mouseY`, `width`, `height`.

**Connected to:** `sandbox.js` (instantiated there, methods injected into compiled code).

---

#### `skratch-studio/sandbox.js`
**Role:** Safe execution environment for generated Blockly code.

**Imports:** `DrawingAPI` from `drawing-api.js`.

**Exports:** `Sandbox` class.

**Behavior:**
- `run(code)` — Compiles code via `new Function()` with all DrawingAPI methods + audio variables injected as named parameters
- `startLoop()` — `requestAnimationFrame` loop calling `_executeFrame()` each frame
- `_executeFrame()` — Invokes compiled function with bound API methods and current audio state values
- `_updateBeatTimers()` — Fires registered `everyNBeats` callbacks at BPM-derived intervals
- `fireNoteCallbacks()` — Called externally when a note is played to fire `onNotePlayed` callbacks
- Supports trail mode (flag in generated code skips canvas clear)
- Error display via `showError(msg)` / `clearError()`

**Connected to:** `studio.js` (orchestration), `drawing-api.js` (rendering), `audio-bridge.js` (audio state).

---

#### `skratch-studio/audio-bridge.js`
**Role:** Connects Tone.js synthesis and mic pitch detection to the sandbox execution environment.

**Imports:** `startPitchDetection, stopPitchDetection, frequencyToNote` from `shared/audio.js`.

**Exports:** `AudioBridge` class.

**Shared state object:** `{ currentPitch, currentNoteName, currentVolume, noteIsPlaying, lastNotePlayed }` — read by sandbox each frame.

**Features:**
- `playNote(noteName)` — Plays via `Tone.Synth`, updates state, triggers sandbox note callbacks
- `startMic(onPitch)` — Starts pitch detection via `shared/audio.js`, updates state each frame
- `stopMic()` — Stops pitch detection
- `destroy()` — Cleanup

**Connected to:** `studio.js`, `sandbox.js` (via shared state), `shared/audio.js`.

---

#### `skratch-studio/piano.js`
**Role:** Clickable one-octave piano keyboard component (C4-B4).

**Exports:** `Piano` class.

**Constructor:** `new Piano(container, onNotePlay)` — builds DOM, attaches to container.

**Features:**
- 7 white keys + 5 black keys with proper sizing/overlap
- Mouse and touch event support
- `highlightNote(noteName)` — Shows mic-detected pitch with `.detected` class (teal glow)
- `.active` class for clicked keys (purple glow)
- Injects scoped CSS dynamically (`#skratch-piano-styles`)

**Connected to:** `studio.js` (created there, `onNotePlay` wired to `AudioBridge.playNote()`).

---

## Module Dependency Graph

```
index.html (hub)
+-- shared/styles.css

harmony/index.html
+-- shared/styles.css
+-- harmony/styles.css
+-- shared/audio.js
+-- shared/progress.js

chords/index.html
+-- shared/styles.css
+-- shared/audio.js
+-- shared/progress.js
+-- shared/ai.js --> shared/config.js
+-- shared/skratch/skratch.js
    +-- shared/skratch/visual-canvas.js
    |   +-- shared/skratch/particle.js
    |   +-- shared/skratch/effects.js
    +-- shared/skratch/skratch-editor.js
        +-- shared/skratch/effects.js

melody/index.html
+-- shared/styles.css
+-- shared/audio.js
+-- shared/progress.js
+-- shared/ai.js --> shared/config.js

rhythm/index.html
+-- shared/styles.css
+-- rhythm/styles.css
+-- rhythm/rhythm.js
    +-- shared/progress.js

strumming/index.html
+-- shared/styles.css
+-- strumming/detection.js
|   +-- strumming/calibration.js (disabled classifyDirection only)
+-- strumming/patterns.js
+-- shared/progress.js
+-- shared/ai.js --> shared/config.js

detector/index.html
+-- shared/styles.css
+-- strumming/detection.js
+-- strumming/patterns.js
+-- shared/ai.js --> shared/config.js

skratch-studio/index.html
+-- shared/styles.css
+-- skratch-studio/studio.css
+-- skratch-studio/studio.js
    +-- skratch-studio/blocks.js
    +-- skratch-studio/generators.js
    +-- skratch-studio/sandbox.js
    |   +-- skratch-studio/drawing-api.js
    +-- skratch-studio/audio-bridge.js
    |   +-- shared/audio.js
    +-- skratch-studio/piano.js
```

---

## localStorage Keys Summary

| Key | Used By | Description |
|-----|---------|-------------|
| `mtt_leaderboard_{game}` | All games via `progress.js` | Score arrays |
| `mtt_prefs` | All games via `progress.js` | User preferences (incl. `melody_max_length`) |
| `mtt_ai_{game}` | chords, melody, strumming via `ai.js` | Adaptive difficulty tracking |
| `mtt_strumming_custom_patterns` | strumming, detector via `patterns.js` | Custom pattern definitions |
| `mtt_strumming_latency_ms` | strumming via `detection.js` | Audio latency compensation |
| `mtt_strumming_calibration` | detection.js via `calibration.js` | Direction calibration data |
| `skratch-rules` | chords via `skratch.js` | Event-to-effect mapping rules |
| `skratch-studio-workspace` | skratch-studio via `studio.js` | Blockly workspace state |
