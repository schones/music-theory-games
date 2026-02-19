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

const RMS_THRESHOLD = 0.04;
const SPECTRAL_FLUX_THRESHOLD = 0.15;
const MIN_INTER_ONSET_MS = 80;
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
