/**
 * Guitar Strum Onset Detection Module
 * strumming/detection.js
 *
 * Detects strum timing using transient/attack detection with a sustain gate:
 *   1. Track a smoothed RMS envelope (slow-decay EMA) that follows overall energy.
 *   2. Detect onset when ALL conditions are met:
 *      a. Instantaneous RMS exceeds envelope × TRANSIENT_RATIO (1.5×).
 *      b. Instantaneous RMS exceeds ABS_MIN_RMS (absolute floor).
 *      c. RMS at least doubled from the previous frame (ATTACK_VELOCITY_RATIO).
 *   3. Fire onset, then enter hard lockout — no onset detection during lockout.
 *   4. During lockout, audio is still read to keep the envelope up to date.
 *
 * The frame-to-frame velocity check (condition c) is the key differentiator
 * between real strum attacks and sustained string vibrations. A real attack
 * causes a near-instantaneous jump in amplitude within a single animation
 * frame (~16ms), while resonance and string ring fluctuate gradually over
 * many frames.
 *
 * Additional filtering:
 *   - After an upstrum, lockout is extended by 1.2× because upstrums cause
 *     more bass string sympathetic vibration that can mimic a downstrum.
 *
 * Also classifies strum direction (down vs up) using spectral centroid and
 * low/high energy ratio features, optionally calibrated per-user.
 */

import {
  getCalibrationData,
  computeSpectralCentroid,
  computeLowHighRatio,
} from './calibration.js';

/* ---------------------------------------------------------- */
/*  Constants (tunable)                                       */
/* ---------------------------------------------------------- */

const FFT_SIZE = 2048;
const LATENCY_COMPENSATION_MS = 0;

// Absolute minimum RMS floor — prevents silence from triggering.
const ABS_MIN_RMS = 0.05;

// Transient ratio — instantaneous RMS must exceed the smoothed envelope
// by at least this factor to count as a new strum attack.
const TRANSIENT_RATIO = 1.5;

// Envelope smoothing factor (exponential moving average).
// Small alpha = slow decay, so the envelope tracks sustained string energy
// and new strum attacks spike well above it.
const ENVELOPE_ALPHA = 0.005;

// Frame-to-frame velocity check — current RMS must be at least this multiple
// of the previous frame's RMS. Real strum attacks cause a near-instantaneous
// jump in amplitude within one animation frame (~16ms). Sustained string
// vibrations and resonance fluctuations change gradually over many frames
// and fail this check.
const ATTACK_VELOCITY_RATIO = 2.0;

// Hard lockout: after an onset, no new onsets fire for this many ms.
// Audio is still read during lockout to keep the envelope up to date.
// Dynamically scaled to Math.min(DEFAULT_LOCKOUT_MS, eighthNoteMs * 0.7).
const DEFAULT_LOCKOUT_MS = 400;

// After an upstrum, extend lockout by this factor. Upstrums cause bass
// strings to ring sympathetically, producing low-frequency energy that
// the direction classifier misreads as a downstrum.
const UPSTRUM_LOCKOUT_MULTIPLIER = 1.2;

// Direction classification defaults (used when no calibration data exists)
const LOW_HIGH_CUTOFF_HZ = 400;
const DEFAULT_CENTROID_THRESHOLD = 750;
const DEFAULT_RATIO_THRESHOLD = 2.0;
const DIRECTION_CONFIDENCE_MIN = 0.3;

/* ---------------------------------------------------------- */
/*  Detector State                                            */
/* ---------------------------------------------------------- */

let detector = null;

/* ---------------------------------------------------------- */
/*  Public API                                                */
/* ---------------------------------------------------------- */

/**
 * Start onset detection using the microphone.
 *
 * @param {AudioContext} audioCtx - Existing AudioContext to use
 * @param {function} onOnset - Callback called with (timestamp, direction, confidence)
 *                             on each detected strum. direction is 'D'|'U'|null,
 *                             confidence is 0.0-1.0.
 * @param {number} [bpm=0] - Current tempo. Used to compute lockout duration.
 *                            Pass 0 to use DEFAULT_LOCKOUT_MS.
 * @returns {Promise<boolean>} true if mic access granted, false otherwise
 */
export async function startDetection(audioCtx, onOnset, bpm = 0) {
  if (detector && detector.running) {
    stopDetection();
  }

  let micStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.warn("[detection] Mic access denied:", err.message);
    return false;
  }

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.3;

  const source = audioCtx.createMediaStreamSource(micStream);
  source.connect(analyser);

  const timeDomainBuffer = new Float32Array(analyser.fftSize);
  const freqBuffer = new Float32Array(analyser.frequencyBinCount);

  // Load calibration data for direction classification
  const calibration = getCalibrationData();

  detector = {
    audioCtx,
    micStream,
    analyser,
    source,
    timeDomainBuffer,
    freqBuffer,
    lastOnsetTime: 0,
    lastOnsetRMS: 0,
    lastDirection: null,
    envelope: 0,          // Smoothed RMS envelope (EMA)
    prevFrameRMS: 0,      // RMS from the immediately previous frame
    lockoutMs: computeLockout(bpm),
    running: true,
    animFrameId: 0,
    onOnset,
    calibration,
  };

  // Kick off detection loop
  detectLoop();
  return true;
}

/**
 * Stop onset detection and release the microphone.
 */
export function stopDetection() {
  if (!detector) return;

  detector.running = false;

  if (detector.animFrameId) {
    cancelAnimationFrame(detector.animFrameId);
  }

  if (detector.micStream) {
    detector.micStream.getTracks().forEach((t) => t.stop());
  }

  if (detector.source) {
    try { detector.source.disconnect(); } catch { /* ignore */ }
  }

  detector = null;
}

/**
 * Check if the detector is currently running.
 *
 * @returns {boolean}
 */
export function isDetecting() {
  return detector !== null && detector.running;
}

/**
 * Update the lockout duration for a new BPM.
 * Call this whenever the tempo changes during gameplay.
 *
 * @param {number} bpm - Current tempo in beats per minute
 */
export function setDetectionBpm(bpm) {
  if (detector) {
    detector.lockoutMs = computeLockout(bpm);
  }
}

/* ---------------------------------------------------------- */
/*  Internal Helpers                                          */
/* ---------------------------------------------------------- */

/**
 * Compute the lockout duration from a BPM value.
 * Lockout = min(DEFAULT_LOCKOUT_MS, eighthNoteMs * 0.7).
 *
 * @param {number} bpm
 * @returns {number} lockout in ms
 */
function computeLockout(bpm) {
  if (!bpm || bpm <= 0) return DEFAULT_LOCKOUT_MS;
  const eighthNoteMs = (60000 / bpm) / 2;
  return Math.min(DEFAULT_LOCKOUT_MS, eighthNoteMs * 0.7);
}

/* ---------------------------------------------------------- */
/*  Internal Detection Loop                                   */
/* ---------------------------------------------------------- */

function detectLoop() {
  if (!detector || !detector.running) return;

  const d = detector;
  const now = performance.now();

  // --- Always read audio and update the envelope ---
  // The envelope must track sustained energy continuously (even during lockout)
  // so that new strum attacks are detected as transients above the background.
  d.analyser.getFloatTimeDomainData(d.timeDomainBuffer);
  const rms = computeRMS(d.timeDomainBuffer);

  // Update envelope: slow-decay exponential moving average.
  // Follows sustained energy downward slowly, so new attacks spike above it.
  d.envelope = d.envelope * (1 - ENVELOPE_ALPHA) + rms * ENVELOPE_ALPHA;

  // --- Hard lockout ---
  // After an onset, no new onsets fire for this period.
  // Audio is still read above to keep the envelope current.
  // After upstrums, lockout is extended to suppress bass string sympathetic ring.
  const effectiveLockout = d.lastDirection === 'U'
    ? d.lockoutMs * UPSTRUM_LOCKOUT_MULTIPLIER
    : d.lockoutMs;

  if (now - d.lastOnsetTime < effectiveLockout) {
    // Reset prevFrameRMS so the first frame after lockout expires uses the
    // fallback velocity check instead of comparing against a stale value.
    d.prevFrameRMS = 0;
    d.animFrameId = requestAnimationFrame(detectLoop);
    return;
  }

  // --- Onset detection (sustain gate) ---
  // A new strum fires when ALL three conditions are met:
  //   1. RMS exceeds the smoothed envelope by TRANSIENT_RATIO (energy spike).
  //   2. RMS exceeds ABS_MIN_RMS (not silence).
  //   3. RMS at least doubled from the previous frame (attack velocity).
  // Condition 3 is the sustain gate: real strum attacks cause a near-
  // instantaneous jump within one animation frame (~16ms), while sustained
  // string ring and resonance fluctuations change gradually and fail this.
  const velocityOk = d.prevFrameRMS > 0
    ? rms > d.prevFrameRMS * ATTACK_VELOCITY_RATIO
    : rms > ABS_MIN_RMS; // first frame after lockout: fall back to floor check

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

  // Track previous frame RMS for velocity check on next iteration.
  // Reset to 0 during lockout so the first post-lockout frame uses the
  // fallback check instead of comparing against a stale value.
  d.prevFrameRMS = rms;

  d.animFrameId = requestAnimationFrame(detectLoop);
}

/* ---------------------------------------------------------- */
/*  Direction Classification                                   */
/* ---------------------------------------------------------- */

/**
 * Classify strum direction from the current spectral frame.
 *
 * Two features vote independently:
 *   1. Spectral centroid: below threshold → D, above → U
 *   2. Low/high energy ratio: above threshold (more low energy) → D, below → U
 *
 * When both agree, confidence is boosted. When they disagree, the feature with
 * higher individual confidence wins at reduced overall confidence.
 *
 * @param {DetectorState} d
 * @returns {{ direction: string|null, confidence: number }}
 */
function classifyDirection(d) {
  const sampleRate = d.audioCtx.sampleRate;
  const fftSize = d.analyser.fftSize;

  const centroid = computeSpectralCentroid(d.freqBuffer, sampleRate, fftSize);
  const ratio = computeLowHighRatio(d.freqBuffer, sampleRate, fftSize, LOW_HIGH_CUTOFF_HZ);

  // Determine thresholds and spread from calibration or defaults
  const cal = d.calibration;
  const centroidThreshold = cal ? cal.centroidThreshold : DEFAULT_CENTROID_THRESHOLD;
  const ratioThreshold = cal ? cal.ratioThreshold : DEFAULT_RATIO_THRESHOLD;

  // Per-feature confidence: how far is the value from the threshold,
  // scaled by the spread (calibration std or a fixed fallback).
  const centroidSpread = cal
    ? Math.max(1, (cal.downCentroidStd + cal.upCentroidStd) / 2)
    : 100; // fallback spread in Hz

  const centroidDist = centroid - centroidThreshold;
  const centroidVote = centroidDist < 0 ? 'D' : 'U';
  const centroidConf = Math.min(1, Math.abs(centroidDist) / (centroidSpread * 2));

  const ratioSpread = cal
    ? Math.max(0.01, Math.abs(cal.downLowHighRatio - cal.upLowHighRatio) / 2)
    : 0.5; // fallback

  const ratioDist = ratio - ratioThreshold;
  const ratioVote = ratioDist > 0 ? 'D' : 'U'; // higher ratio = more bass = down
  const ratioConf = Math.min(1, Math.abs(ratioDist) / (ratioSpread * 2));

  let direction;
  let confidence;

  if (centroidVote === ratioVote) {
    // Features agree — boost confidence
    direction = centroidVote;
    confidence = Math.min(1, (centroidConf + ratioConf) / 2 + 0.15);
  } else {
    // Features disagree — use the one with higher confidence at a penalty
    if (centroidConf >= ratioConf) {
      direction = centroidVote;
      confidence = centroidConf * 0.6;
    } else {
      direction = ratioVote;
      confidence = ratioConf * 0.6;
    }
  }

  // Below minimum threshold → direction unknown
  if (confidence < DIRECTION_CONFIDENCE_MIN) {
    return { direction: null, confidence };
  }

  return { direction, confidence };
}

/* ---------------------------------------------------------- */
/*  Signal Processing Helpers                                 */
/* ---------------------------------------------------------- */

/**
 * Compute RMS (root mean square) amplitude of a time-domain buffer.
 *
 * @param {Float32Array} buffer
 * @returns {number}
 */
function computeRMS(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}
