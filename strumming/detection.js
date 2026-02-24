/**
 * Guitar Strum Onset Detection Module
 * strumming/detection.js
 *
 * Detects strum timing using a simple attack-only approach:
 *   1. Listen for RMS above threshold (attack transient).
 *   2. Fire onset, then enter hard lockout — NO audio analysis at all.
 *   3. When lockout expires, resume fresh listening.
 *
 * The lockout ensures sustained string ring can never retrigger because
 * no audio is read during the dead zone. By the time listening resumes,
 * the previous strum has decayed below threshold.
 *
 * Additional filtering:
 *   - After an upstrum, lockout is extended by 1.2× because upstrums cause
 *     more bass string sympathetic vibration that can mimic a downstrum.
 *   - When lockout expires, if the new onset RMS is significantly weaker than
 *     the previous onset (< 40%), it is suppressed as residual vibration.
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

// Minimum RMS for a guitar attack transient to trigger an onset.
const RMS_THRESHOLD = 0.07;

// Hard lockout: after an onset, ALL audio analysis stops for this many ms.
// No getFloatTimeDomainData, no getFloatFrequencyData — complete silence.
// When lockout expires, prevRMS resets to 0 so the first audio frame with
// any signal above RMS_THRESHOLD will fire immediately (fresh attack).
// Dynamically scaled to Math.min(DEFAULT_LOCKOUT_MS, eighthNoteMs * 0.7).
const DEFAULT_LOCKOUT_MS = 350;

// After an upstrum, extend lockout by this factor. Upstrums cause bass
// strings to ring sympathetically, producing low-frequency energy that
// the direction classifier misreads as a downstrum.
const UPSTRUM_LOCKOUT_MULTIPLIER = 1.2;

// If a new onset's RMS is below this fraction of the previous onset's peak,
// suppress it — it's likely residual vibration, not a fresh attack.
const PEAK_SUPPRESSION_RATIO = 0.4;

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

  // --- Hard lockout ---
  // After an onset, do NO audio analysis at all — complete dead zone.
  // Guitar string sustain/decay cannot trigger anything during this period.
  // After upstrums, lockout is extended to suppress bass string sympathetic ring.
  const effectiveLockout = d.lastDirection === 'U'
    ? d.lockoutMs * UPSTRUM_LOCKOUT_MULTIPLIER
    : d.lockoutMs;

  if (now - d.lastOnsetTime < effectiveLockout) {
    d.animFrameId = requestAnimationFrame(detectLoop);
    return;
  }

  // --- Read RMS ---
  d.analyser.getFloatTimeDomainData(d.timeDomainBuffer);
  const rms = computeRMS(d.timeDomainBuffer);

  // --- Onset detection ---
  // Simple threshold check. After lockout expires this is the first audio
  // read, so any attack transient above the threshold fires immediately.
  // Sustained ring from a previous strum will have decayed during lockout.
  if (rms > RMS_THRESHOLD) {
    // --- Peak suppression ---
    // If the new onset is much weaker than the previous one, it's likely
    // residual vibration (e.g., bass strings ringing after an upstrum),
    // not a genuine new attack. Suppress it and extend lockout.
    if (d.lastOnsetRMS > 0 && rms < d.lastOnsetRMS * PEAK_SUPPRESSION_RATIO) {
      console.log(`[detection] suppressed — rms: ${rms.toFixed(4)}, prev: ${d.lastOnsetRMS.toFixed(4)}, ratio: ${(rms / d.lastOnsetRMS).toFixed(2)}`);
      d.lastOnsetTime = now;
      d.animFrameId = requestAnimationFrame(detectLoop);
      return;
    }

    d.lastOnsetTime = now;
    d.lastOnsetRMS = rms;
    const onsetTime = now - LATENCY_COMPENSATION_MS;

    // Read frequency data for direction classification
    d.analyser.getFloatFrequencyData(d.freqBuffer);
    const { direction, confidence } = classifyDirection(d);
    d.lastDirection = direction;

    console.log(`[detection] onset — rms: ${rms.toFixed(4)}, dir: ${direction}, conf: ${confidence.toFixed(2)}`);

    if (d.onOnset) {
      d.onOnset(onsetTime, direction, confidence);
    }
  }

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
