/**
 * Strum Direction Calibration Module
 * strumming/calibration.js
 *
 * Records spectral signatures of down and up strums during a guided calibration
 * flow.  Computes thresholds used by detection.js to classify strum direction.
 *
 * Two spectral features are captured per onset:
 *   1. Spectral centroid   — weighted average frequency (Hz).
 *   2. Low/high energy ratio — sum of linear magnitudes below a cutoff vs above.
 *
 * Down strums typically have lower centroid and higher low/high ratio than up
 * strums because the pick strikes the thicker (lower-pitched) strings first.
 */

/* ---------------------------------------------------------- */
/*  Constants                                                  */
/* ---------------------------------------------------------- */

const STORAGE_KEY = 'mtt_strumming_calibration';
const STRUMS_PER_PHASE = 4;
const ONSET_COOLDOWN_MS = 300;
const LOW_HIGH_CUTOFF_HZ = 400;

// Calibration uses a higher RMS threshold than gameplay (0.04) to require
// deliberate, full strums and reject light taps on the guitar body.
export const CALIBRATION_RMS_THRESHOLD = 0.12;

// After onset detection, signal must sustain above this level for
// MIN_SUSTAIN_MS to confirm a real strum (taps decay much faster).
const SUSTAIN_RMS_THRESHOLD = 0.04;
const MIN_SUSTAIN_MS = 50;

/* ---------------------------------------------------------- */
/*  Spectral Helpers (exported — reused by detection.js)       */
/* ---------------------------------------------------------- */

/**
 * Weighted average frequency of a spectrum.
 *
 * @param {Float32Array} freqBuffer  getFloatFrequencyData output (dB values)
 * @param {number} sampleRate        AudioContext.sampleRate
 * @param {number} fftSize           analyser.fftSize
 * @returns {number} centroid in Hz
 */
export function computeSpectralCentroid(freqBuffer, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  let weightedSum = 0;
  let magSum = 0;

  for (let i = 1; i < freqBuffer.length; i++) {
    // Convert dB to linear magnitude (dB values are typically negative)
    const mag = Math.pow(10, freqBuffer[i] / 20);
    const freq = i * binHz;
    weightedSum += freq * mag;
    magSum += mag;
  }

  return magSum > 0 ? weightedSum / magSum : 0;
}

/**
 * Ratio of energy below a cutoff frequency to energy above it.
 *
 * @param {Float32Array} freqBuffer  getFloatFrequencyData output (dB values)
 * @param {number} sampleRate        AudioContext.sampleRate
 * @param {number} fftSize           analyser.fftSize
 * @param {number} cutoffHz          frequency dividing low from high (default 400)
 * @returns {number} ratio  (low / high), higher = more low-frequency energy
 */
export function computeLowHighRatio(freqBuffer, sampleRate, fftSize, cutoffHz = LOW_HIGH_CUTOFF_HZ) {
  const binHz = sampleRate / fftSize;
  const cutoffBin = Math.floor(cutoffHz / binHz);
  let lowSum = 0;
  let highSum = 0;

  for (let i = 1; i < freqBuffer.length; i++) {
    const mag = Math.pow(10, freqBuffer[i] / 20);
    if (i <= cutoffBin) {
      lowSum += mag;
    } else {
      highSum += mag;
    }
  }

  return highSum > 0 ? lowSum / highSum : 0;
}

/* ---------------------------------------------------------- */
/*  localStorage Persistence                                   */
/* ---------------------------------------------------------- */

/**
 * @typedef {Object} CalibrationData
 * @property {number} downCentroidMean
 * @property {number} downCentroidStd
 * @property {number} upCentroidMean
 * @property {number} upCentroidStd
 * @property {number} downLowHighRatio
 * @property {number} upLowHighRatio
 * @property {number} centroidThreshold
 * @property {number} ratioThreshold
 * @property {string} date
 */

/**
 * Retrieve saved calibration data from localStorage.
 * @returns {CalibrationData|null}
 */
export function getCalibrationData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Check whether calibration data exists.
 * @returns {boolean}
 */
export function hasCalibration() {
  return getCalibrationData() !== null;
}

/**
 * Remove saved calibration data.
 */
export function clearCalibration() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/* ---------------------------------------------------------- */
/*  Calibration Flow                                           */
/* ---------------------------------------------------------- */

/**
 * Run the interactive calibration flow.
 *
 * The caller provides `callbacks` to drive UI updates:
 *   - `onPhase(phase)` — called with `'down'` then `'up'`
 *   - `onStrum(phase, count)` — called after each confirmed strum
 *   - `onLevel(rms)` — called every frame with current RMS amplitude (for meter display)
 *   - `onComplete(data)` — called with the final CalibrationData
 *   - `onError(msg)` — called if something goes wrong
 *
 * Pass an optional AbortSignal to allow the user to cancel.
 *
 * @param {AudioContext} audioCtx
 * @param {AnalyserNode} analyser   — already connected to a mic source
 * @param {Object} callbacks
 * @param {AbortSignal} [signal]
 * @returns {Promise<CalibrationData|null>}  null if cancelled or failed
 */
export async function runCalibration(audioCtx, analyser, callbacks, signal) {
  const sampleRate = audioCtx.sampleRate;
  const fftSize = analyser.fftSize;
  const freqBuffer = new Float32Array(analyser.frequencyBinCount);
  const timeDomainBuffer = new Float32Array(analyser.fftSize);

  const downSamples = [];
  const upSamples = [];

  // Helper: wait for N strums and capture spectral snapshots.
  // Uses a higher RMS threshold than gameplay and verifies that the signal
  // sustains for MIN_SUSTAIN_MS — this rejects light taps on the guitar body
  // that decay almost instantly while accepting real strums that ring out.
  function collectStrums(phase, count) {
    return new Promise((resolve, reject) => {
      let collected = 0;
      let prevRMS = 0;
      let lastOnsetTime = 0;
      let rafId = 0;
      let pendingOnset = null; // { time, centroid, ratio } — awaiting sustain check

      function onAbort() {
        cancelAnimationFrame(rafId);
        reject(new DOMException('Calibration cancelled', 'AbortError'));
      }

      if (signal) {
        if (signal.aborted) { reject(new DOMException('Calibration cancelled', 'AbortError')); return; }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      function loop() {
        if (signal && signal.aborted) return;

        analyser.getFloatTimeDomainData(timeDomainBuffer);
        const rms = computeRMSLocal(timeDomainBuffer);
        const now = performance.now();

        // Report amplitude level for visual feedback
        if (callbacks.onLevel) callbacks.onLevel(rms);

        // Check pending onset sustain (minimum duration check)
        if (pendingOnset) {
          if (now - pendingOnset.time >= MIN_SUSTAIN_MS) {
            if (rms >= SUSTAIN_RMS_THRESHOLD) {
              // Signal still present after sustain period — confirmed strum
              const samples = phase === 'down' ? downSamples : upSamples;
              samples.push({ centroid: pendingOnset.centroid, ratio: pendingOnset.ratio });
              collected++;
              pendingOnset = null;

              if (callbacks.onStrum) callbacks.onStrum(phase, collected);

              if (collected >= count) {
                if (signal) signal.removeEventListener('abort', onAbort);
                resolve();
                return;
              }
            } else {
              // Signal decayed too fast — likely a tap, not a strum
              pendingOnset = null;
            }
          }
          // Still within sustain window — keep waiting
          prevRMS = rms;
          rafId = requestAnimationFrame(loop);
          return;
        }

        // Detect new onset using higher calibration threshold
        if (rms > CALIBRATION_RMS_THRESHOLD && prevRMS <= CALIBRATION_RMS_THRESHOLD && (now - lastOnsetTime > ONSET_COOLDOWN_MS)) {
          lastOnsetTime = now;

          // Capture spectral snapshot
          analyser.getFloatFrequencyData(freqBuffer);
          const centroid = computeSpectralCentroid(freqBuffer, sampleRate, fftSize);
          const ratio = computeLowHighRatio(freqBuffer, sampleRate, fftSize);

          // Start sustain verification
          pendingOnset = { time: now, centroid, ratio };
        }

        prevRMS = rms;
        rafId = requestAnimationFrame(loop);
      }

      rafId = requestAnimationFrame(loop);
    });
  }

  try {
    // Phase 1: Down strums
    if (callbacks.onPhase) callbacks.onPhase('down');
    await collectStrums('down', STRUMS_PER_PHASE);

    // Phase 2: Up strums
    if (callbacks.onPhase) callbacks.onPhase('up');
    await collectStrums('up', STRUMS_PER_PHASE);

    // Compute statistics
    const downCentroids = downSamples.map((s) => s.centroid);
    const upCentroids = upSamples.map((s) => s.centroid);
    const downRatios = downSamples.map((s) => s.ratio);
    const upRatios = upSamples.map((s) => s.ratio);

    const downCentroidMean = mean(downCentroids);
    const downCentroidStd = std(downCentroids);
    const upCentroidMean = mean(upCentroids);
    const upCentroidStd = std(upCentroids);
    const downLowHighRatio = mean(downRatios);
    const upLowHighRatio = mean(upRatios);

    const centroidThreshold = (downCentroidMean + upCentroidMean) / 2;
    const ratioThreshold = (downLowHighRatio + upLowHighRatio) / 2;

    /** @type {CalibrationData} */
    const data = {
      downCentroidMean,
      downCentroidStd,
      upCentroidMean,
      upCentroidStd,
      downLowHighRatio,
      upLowHighRatio,
      centroidThreshold,
      ratioThreshold,
      date: new Date().toISOString(),
    };

    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      console.warn('[calibration] Failed to save calibration data');
    }

    if (callbacks.onComplete) callbacks.onComplete(data);
    return data;

  } catch (err) {
    if (err.name === 'AbortError') {
      return null;
    }
    if (callbacks.onError) callbacks.onError(err.message);
    return null;
  }
}

/* ---------------------------------------------------------- */
/*  Internal Helpers                                           */
/* ---------------------------------------------------------- */

function computeRMSLocal(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) * (v - m), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}
