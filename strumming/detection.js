/**
 * Guitar Strum Onset Detection Module
 * strumming/detection.js
 *
 * Detects strum timing from microphone input using two complementary signals:
 * 1. RMS amplitude spike detection (primary)
 * 2. Spectral flux onset detection (secondary, better for guitar transients)
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

const RMS_THRESHOLD = 0.04;
const NOISE_FLOOR_RMS = 0.01;
const SPECTRAL_FLUX_THRESHOLD = 0.5;
const MIN_INTER_ONSET_MS = 80;
const FFT_SIZE = 2048;
const LATENCY_COMPENSATION_MS = 0;

// Direction classification defaults (used when no calibration data exists)
const LOW_HIGH_CUTOFF_HZ = 400;
const DEFAULT_CENTROID_THRESHOLD = 750;
const DEFAULT_RATIO_THRESHOLD = 2.0;
const DIRECTION_CONFIDENCE_MIN = 0.3;

/* ---------------------------------------------------------- */
/*  Detector State                                            */
/* ---------------------------------------------------------- */

/**
 * @typedef {Object} DetectorState
 * @property {AudioContext}    audioCtx
 * @property {MediaStream}     micStream
 * @property {AnalyserNode}    analyser
 * @property {Float32Array}    timeDomainBuffer
 * @property {Float32Array}    freqBuffer
 * @property {Float32Array}    prevFreqBuffer
 * @property {number}          lastOnsetTime
 * @property {number}          prevRMS
 * @property {boolean}         running
 * @property {number}          animFrameId
 * @property {function|null}   onOnset - callback(time, direction, confidence)
 * @property {Object|null}     calibration - CalibrationData from calibration.js
 */

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
 * @returns {Promise<boolean>} true if mic access granted, false otherwise
 */
export async function startDetection(audioCtx, onOnset) {
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
  const freqBinCount = analyser.frequencyBinCount;
  const freqBuffer = new Float32Array(freqBinCount);
  const prevFreqBuffer = new Float32Array(freqBinCount);

  // Load calibration data for direction classification
  const calibration = getCalibrationData();

  detector = {
    audioCtx,
    micStream,
    analyser,
    source,
    timeDomainBuffer,
    freqBuffer,
    prevFreqBuffer,
    lastOnsetTime: 0,
    prevRMS: 0,
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

/* ---------------------------------------------------------- */
/*  Internal Detection Loop                                   */
/* ---------------------------------------------------------- */

function detectLoop() {
  if (!detector || !detector.running) return;

  const d = detector;
  const now = performance.now();

  // --- Signal 1: RMS amplitude ---
  d.analyser.getFloatTimeDomainData(d.timeDomainBuffer);
  const rms = computeRMS(d.timeDomainBuffer);

  let rmsOnset = false;
  if (rms > RMS_THRESHOLD && d.prevRMS <= RMS_THRESHOLD) {
    rmsOnset = true;
  }
  d.prevRMS = rms;

  // --- Signal 2: Spectral flux ---
  d.analyser.getFloatFrequencyData(d.freqBuffer);
  const flux = computeSpectralFlux(d.freqBuffer, d.prevFreqBuffer);

  // Copy current spectrum to previous for next frame
  d.prevFreqBuffer.set(d.freqBuffer);

  const fluxOnset = flux > SPECTRAL_FLUX_THRESHOLD;

  // --- Combined decision ---
  // RMS onset alone is sufficient. Spectral flux only counts when there is
  // actual audio energy (rms > NOISE_FLOOR_RMS) to avoid false positives from
  // dB noise-floor fluctuations in a silent room.
  const onset = rmsOnset || (fluxOnset && rms > NOISE_FLOOR_RMS);

  if (onset && (now - d.lastOnsetTime > MIN_INTER_ONSET_MS)) {
    d.lastOnsetTime = now;
    const onsetTime = now - LATENCY_COMPENSATION_MS;

    // Classify direction from the current spectral frame
    const { direction, confidence } = classifyDirection(d);

    console.log(`[detection] onset — RMS: ${rms.toFixed(4)}, flux: ${flux.toFixed(4)}, trigger: ${rmsOnset ? 'rms' : 'flux'}, dir: ${direction}, conf: ${confidence.toFixed(2)}`);

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

/**
 * Compute spectral flux — the sum of positive frequency bin changes.
 * Only counts increases (half-wave rectified) to detect onsets, not offsets.
 *
 * @param {Float32Array} current  - Current frame's frequency data (dB)
 * @param {Float32Array} previous - Previous frame's frequency data (dB)
 * @returns {number}
 */
function computeSpectralFlux(current, previous) {
  let flux = 0;
  for (let i = 0; i < current.length; i++) {
    const diff = current[i] - previous[i];
    if (diff > 0) {
      flux += diff;
    }
  }
  // Normalize by bin count to keep threshold scale-independent
  return flux / current.length;
}
