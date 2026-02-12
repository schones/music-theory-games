/**
 * audio.js — Web Audio API utilities, pitch detection, tone generation,
 *            and music theory helpers.
 *
 * Tone.js is loaded globally via <script> tag (not imported here).
 * This module wraps it and provides pitch detection via autocorrelation.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
];

export const INTERVALS = {
  unison: 0,
  minor2nd: 1,
  major2nd: 2,
  minor3rd: 3,
  major3rd: 4,
  perfect4th: 5,
  tritone: 6,
  perfect5th: 7,
  minor6th: 8,
  major6th: 9,
  minor7th: 10,
  major7th: 11,
  perfectOctave: 12,
};

const INTERVAL_LABELS = {
  0: 'Unison',
  1: 'Minor 2nd',
  2: 'Major 2nd',
  3: 'Minor 3rd',
  4: 'Major 3rd',
  5: 'Perfect 4th',
  6: 'Tritone',
  7: 'Perfect 5th',
  8: 'Minor 6th',
  9: 'Major 6th',
  10: 'Minor 7th',
  11: 'Major 7th',
  12: 'Octave',
};

const INTERVAL_SHORT = {
  0: 'P1',
  1: 'm2',
  2: 'M2',
  3: 'm3',
  4: 'M3',
  5: 'P4',
  6: 'TT',
  7: 'P5',
  8: 'm6',
  9: 'M6',
  10: 'm7',
  11: 'M7',
  12: 'P8',
};

// A4 = 440 Hz reference
const A4 = 440;
const A4_MIDI = 69;

// Noise gate — ignore signals below this RMS amplitude
const NOISE_GATE = 0.01;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let audioContext = null;
let synth = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Create / resume the AudioContext and Tone.js synth.
 * Must be called from a user gesture (click / tap).
 *
 * @returns {Promise<AudioContext>}
 */
export async function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  // Start Tone.js context if available
  if (window.Tone && window.Tone.context.state !== 'running') {
    await window.Tone.start();
  }

  // Create default synth
  if (window.Tone && !synth) {
    synth = new window.Tone.PolySynth(window.Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.02,
        decay: 0.3,
        sustain: 0.4,
        release: 0.8,
      },
      volume: -8,
    }).toDestination();
  }

  return audioContext;
}

/**
 * Get the shared AudioContext (creates one if needed).
 * @returns {AudioContext}
 */
export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// ---------------------------------------------------------------------------
// Note / frequency conversion
// ---------------------------------------------------------------------------

/**
 * Convert a note name like "C4" or "F#3" to its frequency in Hz.
 *
 * @param {string} noteName — e.g. "A4", "C#3"
 * @returns {number} frequency in Hz
 */
export function noteToFrequency(noteName) {
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) throw new Error(`Invalid note name: ${noteName}`);

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const semitone = NOTE_NAMES.indexOf(note);
  if (semitone === -1) throw new Error(`Unknown note: ${note}`);

  const midi = semitone + (octave + 1) * 12;
  return A4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Convert a frequency in Hz to the nearest note name + cents offset.
 *
 * @param {number} frequency — Hz
 * @returns {{ noteName: string, frequency: number, cents: number, midi: number }}
 */
export function frequencyToNote(frequency) {
  if (frequency <= 0) return null;

  const midi = 12 * Math.log2(frequency / A4) + A4_MIDI;
  const roundedMidi = Math.round(midi);
  const cents = Math.round((midi - roundedMidi) * 100);

  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex] + octave;

  return { noteName, frequency, cents, midi: roundedMidi };
}

/**
 * Get the human-readable interval name from a semitone distance.
 *
 * @param {number} semitones — 0–12
 * @returns {string}
 */
export function getIntervalName(semitones) {
  return INTERVAL_LABELS[semitones] || `${semitones} semitones`;
}

/**
 * Get the short label (e.g. "P5", "m3") for a semitone distance.
 *
 * @param {number} semitones — 0–12
 * @returns {string}
 */
export function getIntervalShort(semitones) {
  return INTERVAL_SHORT[semitones] || `${semitones}st`;
}

/**
 * Transpose a note name by a number of semitones.
 *
 * @param {string} noteName — e.g. "C4"
 * @param {number} semitones — positive = up
 * @returns {string} new note name
 */
export function transposeNote(noteName, semitones) {
  const freq = noteToFrequency(noteName);
  const newFreq = freq * Math.pow(2, semitones / 12);
  const result = frequencyToNote(newFreq);
  return result.noteName;
}

/**
 * Build a list of root note options from C3 to C5.
 *
 * @returns {string[]} e.g. ["C3", "C#3", "D3", ..., "C5"]
 */
export function getRootNoteOptions() {
  const notes = [];
  for (let octave = 3; octave <= 5; octave++) {
    for (const note of NOTE_NAMES) {
      notes.push(note + octave);
      if (note === 'C' && octave === 5) break; // stop at C5
    }
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Tone generation (Tone.js wrappers)
// ---------------------------------------------------------------------------

/**
 * Play a single note.
 *
 * @param {string} noteName — e.g. "C4"
 * @param {string|number} [duration="4n"] — Tone.js duration
 * @param {number} [velocity=0.8] — 0–1
 */
export function playNote(noteName, duration = '4n', velocity = 0.8) {
  if (!synth) {
    console.warn('Audio not initialized. Call initAudio() first.');
    return;
  }
  synth.triggerAttackRelease(noteName, duration, undefined, velocity);
}

/**
 * Play an interval — two notes either simultaneously or arpeggiated.
 *
 * @param {string} root — root note name, e.g. "C4"
 * @param {number} intervalSemitones — semitone distance
 * @param {boolean} [arpeggiate=true] — play sequentially if true
 * @param {string|number} [duration="4n"]
 */
export function playInterval(root, intervalSemitones, arpeggiate = true, duration = '4n') {
  if (!synth) {
    console.warn('Audio not initialized. Call initAudio() first.');
    return;
  }

  const target = transposeNote(root, intervalSemitones);
  const now = window.Tone.now();

  if (arpeggiate) {
    const durationSeconds = window.Tone.Time(duration).toSeconds();
    synth.triggerAttackRelease(root, duration, now, 0.8);
    synth.triggerAttackRelease(target, duration, now + durationSeconds + 0.1, 0.8);
  } else {
    synth.triggerAttackRelease([root, target], duration, now, 0.8);
  }
}

/**
 * Play a short "correct" chime.
 */
export function playCorrectSound() {
  if (!synth) return;
  const now = window.Tone.now();
  synth.triggerAttackRelease('E5', '16n', now, 0.5);
  synth.triggerAttackRelease('G5', '16n', now + 0.1, 0.5);
  synth.triggerAttackRelease('C6', '8n', now + 0.2, 0.6);
}

/**
 * Play a short "incorrect" buzz.
 */
export function playIncorrectSound() {
  if (!synth) return;
  const now = window.Tone.now();
  synth.triggerAttackRelease('E3', '8n', now, 0.4);
  synth.triggerAttackRelease('D#3', '8n', now + 0.15, 0.4);
}

// ---------------------------------------------------------------------------
// Pitch detection (autocorrelation)
// ---------------------------------------------------------------------------

/**
 * Request microphone access and return an AnalyserNode connected to it.
 *
 * @returns {Promise<{ analyser: AnalyserNode, stream: MediaStream }>}
 */
export async function setupMicrophone() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  return { analyser, stream };
}

/**
 * Detect the fundamental frequency using autocorrelation.
 *
 * @param {AnalyserNode} analyser
 * @returns {{ frequency: number, noteName: string, cents: number } | null}
 *          null if signal is below noise gate
 */
export function detectPitch(analyser) {
  const bufferLength = analyser.fftSize;
  const buffer = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(buffer);

  // Noise gate — compute RMS
  let rms = 0;
  for (let i = 0; i < bufferLength; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / bufferLength);

  if (rms < NOISE_GATE) return null;

  // Autocorrelation
  const sampleRate = analyser.context.sampleRate;
  const correlations = new Float32Array(bufferLength);

  for (let lag = 0; lag < bufferLength; lag++) {
    let sum = 0;
    for (let i = 0; i < bufferLength - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum;
  }

  // Find the first peak after the initial drop
  // Skip lag 0 (which is the maximum by definition)
  // Find where autocorrelation first dips below a threshold, then find the next peak
  let foundDip = false;
  let bestLag = -1;
  let bestCorr = 0;

  // Minimum lag corresponds to ~2000 Hz (well above guitar/voice range)
  const minLag = Math.floor(sampleRate / 2000);
  // Maximum lag corresponds to ~50 Hz (well below most musical notes)
  const maxLag = Math.floor(sampleRate / 50);

  for (let lag = minLag; lag < maxLag && lag < bufferLength; lag++) {
    if (!foundDip && correlations[lag] < correlations[0] * 0.5) {
      foundDip = true;
    }
    if (foundDip && correlations[lag] > bestCorr) {
      bestCorr = correlations[lag];
      bestLag = lag;
    }
    // Once we find a clear peak and start declining, stop
    if (foundDip && bestLag > 0 && correlations[lag] < bestCorr * 0.9) {
      break;
    }
  }

  if (bestLag === -1) return null;

  // Parabolic interpolation for sub-sample accuracy
  const prev = correlations[bestLag - 1] || 0;
  const curr = correlations[bestLag];
  const next = correlations[bestLag + 1] || 0;
  const shift = (prev - next) / (2 * (prev - 2 * curr + next)) || 0;
  const refinedLag = bestLag + shift;

  const frequency = sampleRate / refinedLag;

  // Sanity check — musical range roughly 50–2000 Hz
  if (frequency < 50 || frequency > 2000) return null;

  const note = frequencyToNote(frequency);
  if (!note) return null;

  return {
    frequency: Math.round(frequency * 10) / 10,
    noteName: note.noteName,
    cents: note.cents,
  };
}
