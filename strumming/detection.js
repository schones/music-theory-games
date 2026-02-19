/**
 * Guitar Strum Onset Detection Module
 * strumming/detection.js
 *
 * Detects strum timing from microphone input using two complementary signals:
 * 1. RMS amplitude spike detection (primary)
 * 2. Spectral flux onset detection (secondary, better for guitar transients)
 *
 * NOTE: Direction detection (down vs up) is planned for a future task.
 * Currently only detects strum timing, not direction.
 */

/* ---------------------------------------------------------- */
/*  Constants (tunable)                                       */
/* ---------------------------------------------------------- */

let rmsThreshold = 0.08;
let spectralFluxThreshold = 0.25;
const MIN_INTER_ONSET_MS = 120;
const FFT_SIZE = 2048;
const LATENCY_COMPENSATION_MS = 0;

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
 * @property {function|null}   onOnset - callback(time: number)
 */

let detector = null;

/* ---------------------------------------------------------- */
/*  Public API                                                */
/* ---------------------------------------------------------- */

/**
 * Start onset detection using the microphone.
 *
 * @param {AudioContext} audioCtx - Existing AudioContext to use
 * @param {function} onOnset - Callback called with (timestamp) on each detected strum.
 *                             Timestamp is performance.now() adjusted for latency.
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
    suppressUntil: 0,
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
 * Suppress onset detection for a duration. Call this right after playing
 * a metronome click so the click sound isn't picked up as a strum.
 *
 * @param {number} ms - Duration in milliseconds to suppress (default 50)
 */
export function suppressFor(ms = 50) {
  if (!detector) return;
  const until = performance.now() + ms;
  if (until > detector.suppressUntil) {
    detector.suppressUntil = until;
  }
}

/**
 * Set detection sensitivity (0–100). Higher = more sensitive.
 * Adjusts the RMS and spectral flux thresholds.
 *   0   → very insensitive (thresholds high, ignores most input)
 *   50  → default
 *   100 → very sensitive (thresholds low, triggers easily)
 *
 * @param {number} value - Sensitivity 0–100
 */
export function setSensitivity(value) {
  const v = Math.max(0, Math.min(100, value));
  // Map 0–100 to threshold multiplier via piecewise linear interpolation:
  //   0   → 3.0× (high threshold, insensitive)
  //   50  → 1.0× (default)
  //   100 → 0.25× (low threshold, very sensitive)
  const t = v / 100;
  const m = t <= 0.5
    ? 3.0 - t * 2 * (3.0 - 1.0)   // 3.0 → 1.0 over 0–50
    : 1.0 - (t - 0.5) * 2 * (1.0 - 0.25); // 1.0 → 0.25 over 50–100

  rmsThreshold = 0.08 * m;
  spectralFluxThreshold = 0.25 * m;
}

/* ---------------------------------------------------------- */
/*  Internal Detection Loop                                   */
/* ---------------------------------------------------------- */

function detectLoop() {
  if (!detector || !detector.running) return;

  const d = detector;
  const now = performance.now();

  // --- Check suppression gate (metronome click blanking) ---
  if (now < d.suppressUntil) {
    // During suppression window, still update prevRMS/prevFreq to avoid
    // a stale-data spike when the gate lifts
    d.analyser.getFloatTimeDomainData(d.timeDomainBuffer);
    d.prevRMS = computeRMS(d.timeDomainBuffer);
    d.analyser.getFloatFrequencyData(d.freqBuffer);
    d.prevFreqBuffer.set(d.freqBuffer);
    d.animFrameId = requestAnimationFrame(detectLoop);
    return;
  }

  // --- Signal 1: RMS amplitude ---
  d.analyser.getFloatTimeDomainData(d.timeDomainBuffer);
  const rms = computeRMS(d.timeDomainBuffer);

  let rmsOnset = false;
  if (rms > rmsThreshold && d.prevRMS <= rmsThreshold) {
    rmsOnset = true;
  }
  d.prevRMS = rms;

  // --- Signal 2: Spectral flux ---
  d.analyser.getFloatFrequencyData(d.freqBuffer);
  const flux = computeSpectralFlux(d.freqBuffer, d.prevFreqBuffer);

  // Copy current spectrum to previous for next frame
  d.prevFreqBuffer.set(d.freqBuffer);

  const fluxOnset = flux > spectralFluxThreshold;

  // --- Combined decision ---
  // Fire if either signal triggers, with cooldown
  if ((rmsOnset || fluxOnset) && (now - d.lastOnsetTime > MIN_INTER_ONSET_MS)) {
    d.lastOnsetTime = now;
    const onsetTime = now - LATENCY_COMPENSATION_MS;

    if (d.onOnset) {
      d.onOnset(onsetTime);
    }
  }

  d.animFrameId = requestAnimationFrame(detectLoop);
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
