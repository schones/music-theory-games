/**
 * Guitar Strum Onset Detection Module
 * strumming/detection.js
 *
 * Simple threshold-crossing onset detection:
 *   1. Compute RMS each frame.
 *   2. Detect onset when RMS crosses above ONSET_THRESHOLD (rising edge).
 *   3. Enter hard lockout — skip all audio reading during lockout.
 *   4. After lockout expires, skip 3 frames to establish a baseline before
 *      allowing onset detection again.
 *
 * Direction classification (down vs up) using spectral features is available
 * in classifyDirection() but currently disabled. The onset callback only
 * reports timing. Direction detection is planned for future improvement once
 * accuracy is more reliable.
 */

// Direction classification helpers — kept for future use. classifyDirection()
// below uses these but is not called during active detection.
import {
  getCalibrationData,
  computeSpectralCentroid,
  computeLowHighRatio,
} from './calibration.js';

/* ---------------------------------------------------------- */
/*  Constants (tunable)                                       */
/* ---------------------------------------------------------- */

const FFT_SIZE = 2048;

const LATENCY_STORAGE_KEY = 'mtt_strumming_latency_ms';

// One-time cleanup: clear any previously auto-detected latency values that
// included human reaction time (~350ms) and grossly over-corrected timing.
// The new approach uses a manual timing offset slider (default 0).
try {
  const old = localStorage.getItem(LATENCY_STORAGE_KEY);
  if (old !== null && parseFloat(old) > 100) {
    localStorage.removeItem(LATENCY_STORAGE_KEY);
  }
} catch { /* ignore */ }

let latencyCompensationMs = loadLatencyCompensation();

// RMS threshold for onset detection (rising-edge crossing).
const ONSET_THRESHOLD = 0.06;

// Hard lockout: after an onset, no new onsets fire for this many ms.
// During lockout, audio is NOT read — everything is skipped.
// Dynamically scaled to Math.min(DEFAULT_LOCKOUT_MS, eighthNoteMs * 0.7).
const DEFAULT_LOCKOUT_MS = 400;

// Number of frames to skip after lockout expires, to establish a baseline
// RMS before allowing onset detection again.
const SKIP_FRAMES_AFTER_LOCKOUT = 3;

// Direction classification constants (currently unused — direction detection
// is disabled but kept for future use)
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
 * @param {function} onOnset - Callback called with (timestamp) on each detected strum.
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

  detector = {
    audioCtx,
    micStream,
    analyser,
    source,
    timeDomainBuffer,
    lastOnsetTime: 0,
    prevRMS: 0,
    skipFrames: 0,
    lockoutMs: computeLockout(bpm),
    running: true,
    animFrameId: 0,
    onOnset,
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

/**
 * Set audio latency compensation and persist to localStorage.
 *
 * @param {number} ms - Latency in milliseconds to subtract from onset timestamps
 */
export function setLatencyCompensation(ms) {
  latencyCompensationMs = ms;
  try {
    localStorage.setItem(LATENCY_STORAGE_KEY, String(ms));
  } catch { /* localStorage unavailable */ }
}

/**
 * Get current latency compensation value in milliseconds.
 *
 * @returns {number}
 */
export function getLatencyCompensation() {
  return latencyCompensationMs;
}

/* ---------------------------------------------------------- */
/*  Internal Helpers                                          */
/* ---------------------------------------------------------- */

/**
 * Load latency compensation from localStorage.
 *
 * @returns {number} Saved latency in ms, or 0 if not set
 */
function loadLatencyCompensation() {
  try {
    const val = localStorage.getItem(LATENCY_STORAGE_KEY);
    if (val !== null) {
      const parsed = parseFloat(val);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  } catch { /* localStorage unavailable */ }
  return 0;
}

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

  // --- Hard lockout: skip everything (no audio read) ---
  if (now - d.lastOnsetTime < d.lockoutMs) {
    d.animFrameId = requestAnimationFrame(detectLoop);
    return;
  }

  // --- Lockout just expired: reset baseline and start skip countdown ---
  if (d.lastOnsetTime > 0 && d.skipFrames === 0 && d.prevRMS === 0) {
    d.skipFrames = SKIP_FRAMES_AFTER_LOCKOUT;
  }

  // --- Read audio and compute RMS ---
  d.analyser.getFloatTimeDomainData(d.timeDomainBuffer);
  const rms = computeRMS(d.timeDomainBuffer);

  // --- Post-lockout skip frames: establish baseline without triggering ---
  if (d.skipFrames > 0) {
    d.skipFrames--;
    d.prevRMS = rms;
    d.animFrameId = requestAnimationFrame(detectLoop);
    return;
  }

  // --- Onset detection: rising-edge threshold crossing ---
  if (rms > ONSET_THRESHOLD && d.prevRMS <= ONSET_THRESHOLD) {
    d.lastOnsetTime = now;
    d.prevRMS = 0; // signal that lockout is active (baseline needs reset)
    const onsetTime = now - latencyCompensationMs;

    console.log(
      `[detect] >>> ONSET rms=${rms.toFixed(4)} prev=${d.prevRMS.toFixed(4)} ` +
      `lockoutMs=${d.lockoutMs.toFixed(0)}`
    );

    if (d.onOnset) {
      d.onOnset(onsetTime);
    }

    d.animFrameId = requestAnimationFrame(detectLoop);
    return;
  }

  d.prevRMS = rms;
  d.animFrameId = requestAnimationFrame(detectLoop);
}

/* ---------------------------------------------------------- */
/*  Direction Classification                                   */
/* ---------------------------------------------------------- */

/**
 * Classify strum direction from the current spectral frame.
 *
 * NOTE: Currently unused — direction detection is disabled. Kept for future use.
 * To re-enable, call from detectLoop after reading frequency data with
 * analyser.getFloatFrequencyData(freqBuffer), and add freqBuffer + calibration
 * back to the detector state.
 *
 * Two features vote independently:
 *   1. Spectral centroid: below threshold → D, above → U
 *   2. Low/high energy ratio: above threshold (more low energy) → D, below → U
 *
 * When both agree, confidence is boosted. When they disagree, the feature with
 * higher individual confidence wins at reduced overall confidence.
 *
 * @param {object} d - Detector state (needs audioCtx, analyser, freqBuffer, calibration)
 * @returns {{ direction: string|null, confidence: number }}
 */
function classifyDirection(d) { // eslint-disable-line no-unused-vars
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
