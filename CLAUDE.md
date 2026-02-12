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
