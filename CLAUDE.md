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
