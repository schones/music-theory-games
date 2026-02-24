# Strum Direction Detection — Technical Reference

This document preserves the design, implementation details, and lessons learned from
the strum direction detection system. Direction detection is **currently disabled** —
only onset timing is used for scoring. The code is retained in `detection.js` and
`calibration.js` for future re-enablement once accuracy improves.

---

## Table of Contents

1. [Overview](#overview)
2. [How Direction Classification Works](#how-direction-classification-works)
3. [How Calibration Works](#how-calibration-works)
4. [Files Involved](#files-involved)
5. [Known Limitations](#known-limitations)
6. [Why It Was Disabled](#why-it-was-disabled)
7. [Recommended Future Approaches](#recommended-future-approaches)
8. [How to Re-Enable](#how-to-re-enable)

---

## Overview

The goal is to classify each detected guitar strum as a **downstroke** (D) or
**upstroke** (U) using audio analysis. Down strums strike the thicker bass strings
first and sweep toward the thinner treble strings; up strums do the opposite. This
produces measurably different spectral characteristics in the first few milliseconds
of each strum's attack.

The system uses two spectral features extracted from the FFT frame at the moment of
onset, optionally calibrated per-user. An optional calibration flow has the user strum
4 down and 4 up to compute personalized thresholds.

---

## How Direction Classification Works

### Source: `detection.js` → `classifyDirection(d)`

At each confirmed onset, the analyser captures a frequency-domain snapshot via
`analyser.getFloatFrequencyData()`. Two features are computed from this snapshot:

### Feature 1: Spectral Centroid

**What it is:** The weighted average frequency of the spectrum — essentially the
"center of mass" of the frequency distribution.

```
centroid = Σ(frequency_i × magnitude_i) / Σ(magnitude_i)
```

**Why it works:** Down strums excite the lower (bass) strings first, so the
instantaneous spectrum at the moment of attack has more low-frequency energy,
producing a lower centroid. Up strums excite the higher (treble) strings first,
shifting the centroid higher.

**Implementation:** `computeSpectralCentroid()` in `calibration.js`:
- Takes the `Float32Array` from `getFloatFrequencyData()` (values in dB)
- Converts each bin from dB to linear magnitude: `mag = 10^(dB/20)`
- Computes weighted sum: `Σ(binFreq × mag) / Σ(mag)`
- Returns centroid in Hz

**Typical values (uncalibrated):**
- Down strums: ~500–700 Hz centroid
- Up strums: ~800–1100 Hz centroid
- Default threshold: 750 Hz

### Feature 2: Low/High Energy Ratio

**What it is:** The ratio of total energy below a cutoff frequency (400 Hz) to
total energy above it.

```
ratio = Σ(magnitude for bins ≤ 400Hz) / Σ(magnitude for bins > 400Hz)
```

**Why it works:** Down strums produce more bass energy because the bass strings are
struck with more force at the start of the motion. Up strums emphasize the treble
strings.

**Implementation:** `computeLowHighRatio()` in `calibration.js`:
- Splits FFT bins at `cutoffHz` (400 Hz)
- Sums linear magnitudes below and above the cutoff
- Returns `lowSum / highSum`

**Typical values (uncalibrated):**
- Down strums: ratio ~2.0–4.0 (more bass)
- Up strums: ratio ~0.8–1.5 (less bass)
- Default threshold: 2.0

### Voting and Confidence

The two features vote independently:

| Feature           | Vote = D when...        | Vote = U when...        |
|-------------------|-------------------------|-------------------------|
| Spectral centroid | Below threshold         | Above threshold         |
| Low/high ratio    | Above threshold (bass)  | Below threshold         |

**Per-feature confidence** is computed as the distance from the threshold, scaled by
the spread (from calibration std or a fixed fallback):

```
confidence = min(1, |value - threshold| / (spread × 2))
```

**Combining votes:**
- **Both agree:** Combined confidence = `(centroidConf + ratioConf) / 2 + 0.15` (boosted)
- **Disagree:** Winner is the feature with higher individual confidence, at `0.6×` penalty
- **Below `DIRECTION_CONFIDENCE_MIN` (0.3):** Direction returned as `null` (unknown)

### Constants

```javascript
LOW_HIGH_CUTOFF_HZ = 400        // frequency dividing "low" from "high" bands
DEFAULT_CENTROID_THRESHOLD = 750 // Hz — fallback when no calibration
DEFAULT_RATIO_THRESHOLD = 2.0   // fallback ratio divider
DIRECTION_CONFIDENCE_MIN = 0.3  // below this, direction = null
```

---

## How Calibration Works

### Source: `calibration.js` → `runCalibration()`

Calibration is a guided interactive flow that records spectral signatures of
deliberate down and up strums to compute per-user thresholds.

### Flow

1. **Phase 1 — Down strums:**
   - UI prompts "Strum DOWN" with a visual amplitude meter
   - User strums **firmly across all strings** — downward stroke
   - 4 strums are captured (must exceed `CALIBRATION_RMS_THRESHOLD` = 0.12)
   - Each strum records: `{ centroid, lowHighRatio }`

2. **Phase 2 — Up strums:**
   - UI prompts "Strum UP"
   - Same process, 4 up strums captured

3. **Threshold computation:**
   - `centroidThreshold = (downCentroidMean + upCentroidMean) / 2`
   - `ratioThreshold = (downRatioMean + upRatioMean) / 2`
   - Thresholds are the midpoints between the two distributions

4. **Storage:**
   - Saved to `localStorage` under key `mtt_strumming_calibration`

### Onset Filtering (Calibration-Specific)

Calibration uses **stricter onset detection** than gameplay to ensure clean data:

- **Higher RMS threshold:** `CALIBRATION_RMS_THRESHOLD` (0.12) vs gameplay's 0.05.
  Requires deliberate full strums — light taps are rejected.

- **Minimum sustain check:** After onset detection, the signal must remain above
  `SUSTAIN_RMS_THRESHOLD` (0.04) for `MIN_SUSTAIN_MS` (50ms). Taps on the guitar
  body or accidental finger noise decay almost instantly and fail this check; real
  strums ring out and pass.

- **Visual amplitude meter:** Real-time RMS shown as a bar in the calibration
  overlay. Turns green when above the detection threshold. Helps users understand
  how firmly to strum.

### Stored Data Shape

```json
{
  "downCentroidMean": 620.5,
  "downCentroidStd": 45.2,
  "upCentroidMean": 890.3,
  "upCentroidStd": 52.1,
  "downLowHighRatio": 2.8,
  "upLowHighRatio": 1.2,
  "centroidThreshold": 755.4,
  "ratioThreshold": 2.0,
  "date": "2026-02-19T..."
}
```

The standard deviations (`downCentroidStd`, `upCentroidStd`) are used to scale
per-feature confidence in `classifyDirection()` — a wider spread reduces confidence
for borderline readings.

---

## Files Involved

### `strumming/detection.js`

- **`classifyDirection(d)`** — The classification function. Currently unused (not
  called from `detectLoop()`). Takes a detector state object with `freqBuffer` and
  `calibration` fields. Returns `{ direction: 'D'|'U'|null, confidence: 0.0-1.0 }`.

- **Imports from `calibration.js`:** `getCalibrationData`, `computeSpectralCentroid`,
  `computeLowHighRatio`. These imports are kept in the file for the dormant
  `classifyDirection()` function.

- **Direction constants:** `LOW_HIGH_CUTOFF_HZ`, `DEFAULT_CENTROID_THRESHOLD`,
  `DEFAULT_RATIO_THRESHOLD`, `DIRECTION_CONFIDENCE_MIN` — all present but unused.

### `strumming/calibration.js`

- **`runCalibration(audioCtx, analyser, callbacks, signal?)`** — Runs the guided
  calibration flow. Accepts callbacks for UI updates and an optional `AbortSignal`.

- **`computeSpectralCentroid(freqBuffer, sampleRate, fftSize)`** — Weighted average
  frequency. Exported for use by `classifyDirection()`.

- **`computeLowHighRatio(freqBuffer, sampleRate, fftSize, cutoffHz)`** — Low-to-high
  energy ratio. Exported for use by `classifyDirection()`.

- **`getCalibrationData()` / `hasCalibration()` / `clearCalibration()`** — localStorage
  CRUD for calibration data.

### Previously in `strumming/index.html` (removed)

- Calibration UI section (Calibrate/Clear buttons, status display)
- Calibration overlay (phase prompts, strum counter, amplitude meter)
- Direction scoring in `registerStrum()` (bonus/penalty by difficulty)
- Direction accuracy stats in practice summary and results
- `computeDirectionAccuracy()` function
- Calibration event handlers (`handleCalibrate`, `cancelCalibration`, etc.)

### Previously in `detector/index.html` (removed)

- Same calibration UI/overlay as strumming game
- Direction fields in `rawOnsets` and `quantizeToGrid()`

---

## Known Limitations

### 1. String Resonance and Sustain Contamination

Guitar strings vibrate for seconds after being struck. Sympathetic vibration between
strings causes the spectrum to evolve continuously. By the time the FFT frame is
captured (one animation frame after onset, ~16ms), the spectrum already includes
resonance from multiple strings, diluting the initial attack signature.

**Impact:** The spectral centroid shifts toward a "blended" value that may not
reflect the initial attack order. This is the #1 source of classification errors.

### 2. Bass String Ring After Upstrums

When strumming up, the pick crosses the treble strings first and the bass strings
last. The bass strings then ring freely with significant energy. Within the FFT
window (~46ms at 44.1kHz / 2048 FFT), this bass energy appears in the same frame
as the treble attack, making an upstrum look spectrally similar to a downstrum.

**Impact:** Upstrums are frequently misclassified as downstrums, especially at
slower tempos where the strings ring longer before the next strum.

**Previous mitigation (now removed):** After an upstrum was detected, the lockout
window was extended by 1.2× (`UPSTRUM_LOCKOUT_MULTIPLIER`) to suppress false
re-triggers from the bass string sympathetic vibration. This was removed when
direction detection was disabled since lockout no longer depends on direction.

### 3. Single-Frame Spectral Snapshot

The classifier uses a single FFT frame captured at the moment of onset. This is a
~46ms window (2048 samples at 44.1kHz). The spectral content during this window is
a mix of:
- Attack transient (first ~5ms) — carries the most direction information
- String excitation (5–20ms) — blends attack with resonance
- Room reflections and body resonance (throughout)

A single snapshot cannot isolate the attack transient from the sustained resonance.

### 4. Sensitivity to Playing Style

- **Strumming angle:** Players who angle their pick differently get different spectral
  profiles. Calibration helps but the distributions overlap significantly.
- **String damping:** Muted strums, palm-muted strums, and open strums all produce
  different spectral profiles even for the same direction.
- **Guitar differences:** Acoustic vs electric, nylon vs steel strings, and pickup
  configuration all shift the spectral characteristics. Calibration accounts for this
  but a single session may not capture enough variation.

### 5. Low Confidence in Practice

In testing, direction confidence was frequently below the `DIRECTION_CONFIDENCE_MIN`
threshold (0.3), resulting in `null` direction for many strums. When confidence was
above the threshold, accuracy was roughly 60–70% — better than random (50%) but not
reliable enough for scoring without frustrating users.

### 6. Microphone Quality and Placement

Built-in laptop microphones, phone microphones, and external mics produce very
different frequency responses. The calibration threshold helps, but a cheap mic with
poor bass response makes downstrums look spectrally similar to upstrums.

---

## Why It Was Disabled

The direction classifier achieved ~60–70% accuracy under favorable conditions
(external mic, quiet room, calibrated, consistent strumming style). This was:

- **Too unreliable for scoring.** Players were penalized for correct strums misclassified
  as the wrong direction. This was frustrating and undermined trust in the system.
- **Confusing for beginners.** The target audience (kids 8–12) doesn't need direction
  accuracy to learn strumming patterns. Timing is the fundamental skill.
- **Noisy feedback loop.** Incorrect direction feedback taught wrong lessons — a student
  might change their technique based on a false negative.

The decision was made to simplify to **onset-only detection** where the system is highly
reliable (95%+ accuracy for detecting one event per strum), and show D/U arrows in the
PATTERN row as visual guidance only.

---

## Recommended Future Approaches

### 1. Video-Based Hand Tracking (Most Promising)

Use the device camera and a hand-tracking model (MediaPipe Hands, TensorFlow.js
HandPose) to detect the hand's vertical motion direction:

- **Downstrum:** Hand moves downward through the frame
- **Upstrum:** Hand moves upward through the frame

**Advantages:**
- 90%+ accuracy is achievable with existing models
- Works regardless of guitar type, microphone quality, or room acoustics
- Can be synchronized with audio onset for precise timing

**Challenges:**
- Requires camera permission (additional permission prompt)
- Higher CPU/GPU usage for real-time hand tracking
- Lighting sensitivity
- Webcam latency (~100ms) must be calibrated against audio onset timing

### 2. Accelerometer / Phone on Strumming Hand

Mount a phone on the player's strumming wrist/forearm. Use the Device Motion API
to detect acceleration direction:

- **Downstrum:** Negative Y acceleration (downward)
- **Upstrum:** Positive Y acceleration (upward)

**Advantages:**
- Very high accuracy (95%+) — acceleration direction is unambiguous
- Low latency
- Works with any guitar/mic setup

**Challenges:**
- Requires a second device or a wearable
- Phone placement affects axis mapping
- Not practical for casual use by kids

### 3. Improved Audio Analysis with Machine Learning

Train a small CNN or RNN on labeled strum audio clips:

- **Input:** Short spectrogram (first ~50ms after onset), or MFCC features
- **Output:** Binary classification (D/U) with confidence
- **Training data:** Collected via the calibration flow but with more samples (20+ per direction)

**Advantages:**
- Stays audio-only — no camera or extra hardware
- Can learn complex spectral patterns that simple thresholds miss
- Could be personalized via few-shot fine-tuning during calibration

**Challenges:**
- Requires a pre-trained model or enough training data
- Model size must be small for browser inference (TensorFlow.js Lite)
- Still fundamentally limited by the single-mic spectral similarity problem

### 4. Multi-Frame Spectral Trajectory

Instead of a single FFT snapshot, analyze the spectral evolution across 3–5
consecutive frames (~50–80ms) after onset:

- **Downstrum trajectory:** Centroid starts low (bass strings) and rises as treble
  strings begin vibrating
- **Upstrum trajectory:** Centroid starts high (treble strings) and drops as bass
  strings ring in

**Advantages:**
- Uses temporal information that a single snapshot misses
- The attack-order trajectory is the most physically meaningful feature
- Could be implemented with the existing Web Audio API

**Challenges:**
- Requires buffering multiple FFT frames per onset (timing-sensitive)
- Resonance and room effects may mask the trajectory
- Needs more investigation to determine if the trajectory is consistent enough

### 5. Stereo Microphone Analysis

If the device has stereo microphones (many laptops do), the spatial difference
between low and high strings could provide directional information:

- Guitar held at an angle means bass strings are slightly closer to one mic
- Down vs up strum changes which strings are loudest first in each channel

**Advantages:**
- Uses existing hardware
- Spatial information is orthogonal to spectral information

**Challenges:**
- Highly dependent on mic placement relative to guitar
- Most phones have mono or closely-spaced stereo mics
- Room reflections can destroy spatial cues

---

## How to Re-Enable

### Step 1: Update `detection.js` — Restore Direction in Detection Loop

In `startDetection()`, add `freqBuffer` and `calibration` back to detector state:

```javascript
const freqBuffer = new Float32Array(analyser.frequencyBinCount);
const calibration = getCalibrationData();

detector = {
  // ... existing fields ...
  freqBuffer,
  calibration,
  lastDirection: null,  // track for potential lockout extension
};
```

In `detectLoop()`, after the onset fires, read frequency data and classify:

```javascript
if (rms > d.envelope * TRANSIENT_RATIO && rms > ABS_MIN_RMS && velocityOk) {
  d.lastOnsetTime = now;
  d.lastOnsetRMS = rms;
  const onsetTime = now - LATENCY_COMPENSATION_MS;

  // Read frequency data for direction classification
  d.analyser.getFloatFrequencyData(d.freqBuffer);
  const { direction, confidence } = classifyDirection(d);
  d.lastDirection = direction;

  if (d.onOnset) {
    d.onOnset(onsetTime, direction, confidence);
  }
}
```

Update the callback signature in the JSDoc:

```javascript
@param {function} onOnset - Callback: (timestamp, direction, confidence)
```

Optionally restore upstrum lockout extension:

```javascript
const UPSTRUM_LOCKOUT_MULTIPLIER = 1.2;

// In lockout check:
const effectiveLockout = d.lastDirection === 'U'
  ? d.lockoutMs * UPSTRUM_LOCKOUT_MULTIPLIER
  : d.lockoutMs;
```

### Step 2: Update `strumming/index.html` — Import Calibration and Restore Scoring

**Add calibration import:**

```javascript
import { hasCalibration, runCalibration, clearCalibration, CALIBRATION_RMS_THRESHOLD } from './calibration.js';
```

**Update `registerStrum()` signature:**

```javascript
function registerStrum(time, direction = null, confidence = 0) {
```

**Update detection callback:**

```javascript
const micOk = await startDetection(state.audioCtx, (time, direction, confidence) => {
  if (state.isPlaying) registerStrum(time, direction, confidence);
}, state.bpm);
```

**Add direction scoring back (example from previous implementation):**

```javascript
const DIRECTION_POINTS = {
  medium_bonus: 1,
  hard_correct: 1,
  hard_wrong_penalty: -1,
  hard_confidence_threshold: 0.7,
};

// In registerStrum, after computing base points:
const dirCorrect = direction !== null && direction === exp.direction;
const dirWrong = direction !== null && direction !== exp.direction;

if (state.difficulty === 'medium' && dirCorrect) {
  points += DIRECTION_POINTS.medium_bonus;
} else if (state.difficulty === 'hard') {
  if (dirCorrect && confidence >= DIRECTION_POINTS.hard_confidence_threshold) {
    points += DIRECTION_POINTS.hard_correct;
  } else if (dirWrong && confidence >= DIRECTION_POINTS.hard_confidence_threshold) {
    points += DIRECTION_POINTS.hard_wrong_penalty;
  }
}
```

**Restore calibration UI** — add the calibration card HTML to the setup form and
the calibration overlay element. See git history for the exact HTML.

**Restore direction-aware rendering** — update the YOU row in `renderFrame()` to
draw arrows instead of diamonds when direction is known, with direction-based
coloring for medium/hard difficulties.

### Step 3: Update `detector/index.html` — Similar Changes

- Import `calibration.js` and add calibration UI
- Update `onOnset` to capture direction and confidence
- Update `quantizeToGrid` to use detected direction instead of heuristic
- Remove the "directions are estimated" note when direction data is available

### Step 4: Update `CLAUDE.md`

- Remove "disabled" notes from detection.js and calibration.js sections
- Restore direction scoring table in difficulty levels
- Update callback signatures
- Move direction detection out of "Planned Future Additions"

---

## Git History

The direction detection system was active from the initial strumming game implementation
through commit `8d9f934`. It was disabled in the subsequent commit that simplified
detection to onset-only. Use `git log --all -- strumming/` and `git diff` to see the
full previous implementation including all UI code that was removed.
