/**
 * Rhythm Training Game — Main Logic
 * rhythm/rhythm.js
 *
 * State-machine driven game: SETUP → PLAYING → RESULTS
 * EKG-style visual metronome with clap detection via microphone onset detection.
 */

import {
  saveScore,
  getLeaderboard,
  renderLeaderboard,
  savePreference,
  getPreference,
} from "../shared/progress.js";

/* ---------------------------------------------------------- */
/*  Constants                                                 */
/* ---------------------------------------------------------- */

const GAME_ID = "rhythm";

// Onset detection parameters (tunable)
const ONSET_THRESHOLD = 0.05;
const ONSET_COOLDOWN_MS = 200;
const LATENCY_COMPENSATION_MS = 0;

// Tolerance windows per difficulty (ms)
const TOLERANCE = {
  easy: 100,
  medium: 50,
  hard: 25,
};

// Scoring
const POINTS_PER_BEAT = 10;
const STREAK_BONUS_THRESHOLD = 5;
const STREAK_BONUS_POINTS = 5;

// Visual
const EKG_SCROLL_SPEED = 150; // pixels per second at 60 BPM base, adjusted by tempo
const EKG_NOW_LINE_RATIO = 0.75;
const BEAT_SPIKE_HEIGHT = 60;
const DOWNBEAT_SPIKE_HEIGHT = 90;
const FLASH_DURATION_MS = 200;

// Metronome audio
const CLICK_FREQ_DOWNBEAT = 1000;
const CLICK_FREQ_BEAT = 800;
const CLICK_DURATION = 0.03;
const CLICK_VOLUME = 0.3;

// Tap-in
const TAP_IN_COUNT = 4;

/* ---------------------------------------------------------- */
/*  State                                                     */
/* ---------------------------------------------------------- */

const state = {
  screen: "setup",
  mode: "practice",
  difficulty: "medium",
  playerName: "Player",

  // Tempo and time signature
  bpm: 90,
  beatsPerMeasure: 4,
  beatUnit: 4,

  // Running game state
  playing: false,
  audioCtx: null,
  micStream: null,
  analyserNode: null,
  animationFrameId: null,
  metronomeTimerId: null,

  // Beat tracking
  startTime: 0,
  beatIndex: 0,
  totalBeatsExpected: 0,
  measuresTarget: 0,
  beatTimes: [],       // expected beat timestamps (performance.now())
  clapEvents: [],      // { time, beatIndex, delta, rating }
  missedBeats: [],

  // Stats
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctCount: 0,
  totalBeatsPlayed: 0,

  // Onset detection
  lastOnsetTime: 0,
  prevRMS: 0,

  // EKG canvas
  canvas: null,
  ctx: null,
  scrollOffset: 0,

  // Beat indicator flash
  flashColor: null,
  flashTime: 0,

  // Tap-in
  tapTimes: [],
  tapBpm: null,
};

/* ---------------------------------------------------------- */
/*  DOM References                                            */
/* ---------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

const screens = {
  setup: $("screen-setup"),
  game: $("screen-game"),
  results: $("screen-results"),
};

const els = {
  playerName: $("player-name"),
  gameMode: $("game-mode"),
  difficulty: $("difficulty"),
  timeSigNum: $("time-sig-num"),
  timeSigDen: $("time-sig-den"),
  bpmSlider: $("bpm-slider"),
  bpmValue: $("bpm-value"),
  bpmInput: $("bpm-input"),
  btnTapIn: $("btn-tap-in"),
  tapFeedback: $("tap-feedback"),
  btnStart: $("btn-start"),
  setupLeaderboard: $("setup-leaderboard"),

  // Game screen
  ekgCanvas: $("ekg-canvas"),
  beatLight: $("beat-light"),
  statStreak: $("stat-streak"),
  statAccuracy: $("stat-accuracy"),
  statBeats: $("stat-beats"),
  statBpm: $("stat-bpm"),
  btnStop: $("btn-stop"),

  // Results screen
  resultScore: $("result-score"),
  resultAccuracy: $("result-accuracy"),
  resultStreak: $("result-streak"),
  resultBeats: $("result-beats"),
  resultsLeaderboard: $("results-leaderboard"),
  btnPlayAgain: $("btn-play-again"),
};

/* ---------------------------------------------------------- */
/*  Initialization                                            */
/* ---------------------------------------------------------- */

function init() {
  loadPreferences();
  renderLeaderboard(els.setupLeaderboard, GAME_ID);
  bindEvents();
  syncBpmControls();
  showScreen("setup");
}

function loadPreferences() {
  els.playerName.value = getPreference("rhythm_playerName", "Player");
  els.difficulty.value = getPreference("rhythm_difficulty", "medium");
  els.gameMode.value = getPreference("rhythm_mode", "practice");
  els.bpmSlider.value = getPreference("rhythm_bpm", 90);
  els.bpmInput.value = els.bpmSlider.value;
  els.timeSigNum.value = getPreference("rhythm_tsNum", 4);
  els.timeSigDen.value = getPreference("rhythm_tsDen", 4);
}

function saveCurrentPreferences() {
  savePreference("rhythm_playerName", els.playerName.value);
  savePreference("rhythm_difficulty", els.difficulty.value);
  savePreference("rhythm_mode", els.gameMode.value);
  savePreference("rhythm_bpm", parseInt(els.bpmSlider.value, 10));
  savePreference("rhythm_tsNum", parseInt(els.timeSigNum.value, 10));
  savePreference("rhythm_tsDen", parseInt(els.timeSigDen.value, 10));
}

/* ---------------------------------------------------------- */
/*  Event binding                                             */
/* ---------------------------------------------------------- */

function bindEvents() {
  els.btnStart.addEventListener("click", handleStart);
  els.btnStop.addEventListener("click", handleStop);
  els.btnPlayAgain.addEventListener("click", handlePlayAgain);
  els.btnTapIn.addEventListener("click", handleTapIn);

  els.bpmSlider.addEventListener("input", () => {
    els.bpmInput.value = els.bpmSlider.value;
    els.bpmValue.textContent = els.bpmSlider.value;
  });

  els.bpmInput.addEventListener("change", () => {
    let val = parseInt(els.bpmInput.value, 10);
    if (isNaN(val)) val = 90;
    val = Math.max(40, Math.min(200, val));
    els.bpmInput.value = val;
    els.bpmSlider.value = val;
    els.bpmValue.textContent = val;
  });

  // Keyboard: space bar to clap during gameplay
  document.addEventListener("keydown", (e) => {
    if (state.screen === "game" && state.playing && (e.key === " " || e.key === "Spacebar")) {
      e.preventDefault();
      registerClap(performance.now());
    }
  });
}

function syncBpmControls() {
  els.bpmValue.textContent = els.bpmSlider.value;
}

/* ---------------------------------------------------------- */
/*  Screen management                                         */
/* ---------------------------------------------------------- */

function showScreen(name) {
  state.screen = name;
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

/* ---------------------------------------------------------- */
/*  Tap-in Tempo                                              */
/* ---------------------------------------------------------- */

function handleTapIn() {
  const now = performance.now();

  // Reset if more than 2 seconds since last tap
  if (state.tapTimes.length > 0 && now - state.tapTimes[state.tapTimes.length - 1] > 2000) {
    state.tapTimes = [];
  }

  state.tapTimes.push(now);

  if (state.tapTimes.length < 2) {
    els.tapFeedback.textContent = `Tap ${TAP_IN_COUNT - state.tapTimes.length} more times...`;
    return;
  }

  // Keep last TAP_IN_COUNT+1 taps to get TAP_IN_COUNT intervals
  if (state.tapTimes.length > TAP_IN_COUNT + 1) {
    state.tapTimes = state.tapTimes.slice(-TAP_IN_COUNT - 1);
  }

  // Calculate average interval
  const intervals = [];
  for (let i = 1; i < state.tapTimes.length; i++) {
    intervals.push(state.tapTimes[i] - state.tapTimes[i - 1]);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const tapBpm = Math.round(60000 / avgInterval);
  const clampedBpm = Math.max(40, Math.min(200, tapBpm));

  els.bpmSlider.value = clampedBpm;
  els.bpmInput.value = clampedBpm;
  els.bpmValue.textContent = clampedBpm;

  if (state.tapTimes.length >= TAP_IN_COUNT + 1) {
    els.tapFeedback.textContent = `Tempo set to ${clampedBpm} BPM`;
    state.tapTimes = [];
  } else {
    els.tapFeedback.textContent = `~${clampedBpm} BPM — tap ${TAP_IN_COUNT + 1 - state.tapTimes.length} more...`;
  }
}

/* ---------------------------------------------------------- */
/*  Game flow                                                 */
/* ---------------------------------------------------------- */

async function handleStart() {
  saveCurrentPreferences();

  state.playerName = els.playerName.value.trim() || "Player";
  state.difficulty = els.difficulty.value;
  state.bpm = parseInt(els.bpmSlider.value, 10);
  state.beatsPerMeasure = parseInt(els.timeSigNum.value, 10);
  state.beatUnit = parseInt(els.timeSigDen.value, 10);

  const modeVal = els.gameMode.value;
  if (modeVal === "practice") {
    state.mode = "practice";
    state.measuresTarget = 0;
  } else if (modeVal === "test-8") {
    state.mode = "test";
    state.measuresTarget = 8;
  } else {
    state.mode = "test";
    state.measuresTarget = 16;
  }

  // Reset game state
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.correctCount = 0;
  state.totalBeatsPlayed = 0;
  state.beatIndex = 0;
  state.beatTimes = [];
  state.clapEvents = [];
  state.missedBeats = [];
  state.lastOnsetTime = 0;
  state.prevRMS = 0;
  state.flashColor = null;
  state.scrollOffset = 0;
  state.totalBeatsExpected = state.measuresTarget > 0
    ? state.measuresTarget * state.beatsPerMeasure
    : 0;

  // Init canvas
  state.canvas = els.ekgCanvas;
  state.ctx = state.canvas.getContext("2d");
  resizeCanvas();

  // Init audio
  try {
    await initAudioContext();
  } catch (err) {
    alert("Could not start audio: " + err.message);
    return;
  }

  showScreen("game");
  updateGameStats();

  // Count-in: 1 measure of clicks before starting
  await countIn();

  // Start the game loop
  state.playing = true;
  state.startTime = performance.now();
  precomputeBeatTimes();
  startMetronome();
  startOnsetDetection();
  requestRender();
}

function handleStop() {
  stopGame();
  if (state.mode === "test" && state.totalBeatsPlayed > 0) {
    showResults();
  } else {
    showScreen("setup");
    renderLeaderboard(els.setupLeaderboard, GAME_ID);
  }
}

function handlePlayAgain() {
  showScreen("setup");
  renderLeaderboard(els.setupLeaderboard, GAME_ID);
}

function stopGame() {
  state.playing = false;

  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  if (state.metronomeTimerId) {
    clearTimeout(state.metronomeTimerId);
    state.metronomeTimerId = null;
  }

  stopMic();
}

function showResults() {
  const accuracy = state.totalBeatsPlayed > 0
    ? Math.round((state.correctCount / state.totalBeatsPlayed) * 100)
    : 0;

  const finalScore = state.score;

  els.resultScore.textContent = finalScore;
  els.resultAccuracy.textContent = `${accuracy}%`;
  els.resultStreak.textContent = state.bestStreak;
  els.resultBeats.textContent = `${state.correctCount}/${state.totalBeatsPlayed}`;

  if (state.mode === "test") {
    saveScore(GAME_ID, state.playerName, finalScore, {
      difficulty: state.difficulty,
      bpm: state.bpm,
      accuracy,
      correct: state.correctCount,
      total: state.totalBeatsPlayed,
      bestStreak: state.bestStreak,
      timeSignature: `${state.beatsPerMeasure}/${state.beatUnit}`,
    });
  }

  renderLeaderboard(els.resultsLeaderboard, GAME_ID);
  showScreen("results");
}

/* ---------------------------------------------------------- */
/*  Audio Context & Metronome                                 */
/* ---------------------------------------------------------- */

async function initAudioContext() {
  if (state.audioCtx && state.audioCtx.state === "running") return;

  state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  if (state.audioCtx.state === "suspended") {
    await state.audioCtx.resume();
  }
}

function playClick(isDownbeat) {
  if (!state.audioCtx) return;

  const ctx = state.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = isDownbeat ? CLICK_FREQ_DOWNBEAT : CLICK_FREQ_BEAT;

  gain.gain.setValueAtTime(CLICK_VOLUME, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + CLICK_DURATION);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + CLICK_DURATION);
}

function precomputeBeatTimes() {
  const beatInterval = 60000 / state.bpm;
  state.beatTimes = [];

  const totalBeats = state.totalBeatsExpected > 0
    ? state.totalBeatsExpected
    : 999; // Practice mode: generate a lot, extend as needed

  for (let i = 0; i < totalBeats; i++) {
    state.beatTimes.push(state.startTime + i * beatInterval);
  }
}

function startMetronome() {
  const beatInterval = 60000 / state.bpm;

  function tick() {
    if (!state.playing) return;

    const now = performance.now();
    const elapsed = now - state.startTime;
    const expectedBeatIndex = Math.floor(elapsed / beatInterval);

    // Play click for any beats we haven't played yet
    while (state.beatIndex <= expectedBeatIndex) {
      const isDownbeat = (state.beatIndex % state.beatsPerMeasure) === 0;
      playClick(isDownbeat);

      // Check for missed beat from previous beat (if applicable)
      if (state.beatIndex > 0) {
        checkMissedBeat(state.beatIndex - 1);
      }

      state.beatIndex++;
      state.totalBeatsPlayed++;

      // Update stats
      updateGameStats();

      // Check if test is complete
      if (state.mode === "test" && state.totalBeatsPlayed >= state.totalBeatsExpected) {
        // Wait a moment for the last beat's clap, then stop
        setTimeout(() => {
          const tolerance = TOLERANCE[state.difficulty];
          checkMissedBeat(state.beatIndex - 1);
          stopGame();
          showResults();
        }, TOLERANCE[state.difficulty] + 50);
        return;
      }
    }

    // Schedule next tick close to the next beat
    const nextBeatTime = state.startTime + state.beatIndex * beatInterval;
    const delay = Math.max(1, nextBeatTime - performance.now() - 5);
    state.metronomeTimerId = setTimeout(tick, delay);
  }

  tick();
}

async function countIn() {
  const beatInterval = 60000 / state.bpm;
  const countInBeats = state.beatsPerMeasure;

  for (let i = 0; i < countInBeats; i++) {
    const isDownbeat = i === 0;
    playClick(isDownbeat);

    // Flash the beat light to show the count-in
    flashBeatLight("#a29bfe");

    await sleep(beatInterval);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------------------------------------------------- */
/*  Microphone & Onset Detection                              */
/* ---------------------------------------------------------- */

async function startOnsetDetection() {
  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    // Mic access denied — allow keyboard-only play
    console.warn("Mic access denied. Use spacebar to tap along.");
    return;
  }

  const ctx = state.audioCtx;
  const source = ctx.createMediaStreamSource(state.micStream);
  state.analyserNode = ctx.createAnalyser();
  state.analyserNode.fftSize = 2048;
  source.connect(state.analyserNode);

  const bufferLength = state.analyserNode.fftSize;
  const dataArray = new Float32Array(bufferLength);

  function detectOnset() {
    if (!state.playing || !state.analyserNode) return;

    state.analyserNode.getFloatTimeDomainData(dataArray);

    // Calculate RMS
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      sumSquares += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    const now = performance.now();

    // Onset detection: crossing threshold from below
    if (rms > ONSET_THRESHOLD && state.prevRMS <= ONSET_THRESHOLD) {
      if (now - state.lastOnsetTime > ONSET_COOLDOWN_MS) {
        state.lastOnsetTime = now;
        registerClap(now - LATENCY_COMPENSATION_MS);
      }
    }

    state.prevRMS = rms;
    requestAnimationFrame(detectOnset);
  }

  requestAnimationFrame(detectOnset);
}

function stopMic() {
  if (state.micStream) {
    state.micStream.getTracks().forEach((t) => t.stop());
    state.micStream = null;
  }
  state.analyserNode = null;
}

/* ---------------------------------------------------------- */
/*  Clap Registration & Scoring                               */
/* ---------------------------------------------------------- */

function registerClap(clapTime) {
  if (!state.playing) return;

  const tolerance = TOLERANCE[state.difficulty];

  // Find the nearest beat
  let nearestIndex = -1;
  let nearestDelta = Infinity;

  for (let i = 0; i < state.beatTimes.length && i < state.beatIndex; i++) {
    const delta = Math.abs(clapTime - state.beatTimes[i]);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = i;
    }
  }

  // Also check upcoming beat
  if (state.beatIndex < state.beatTimes.length) {
    const delta = Math.abs(clapTime - state.beatTimes[state.beatIndex]);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = state.beatIndex;
    }
  }

  if (nearestIndex === -1) return;

  // Check if this beat was already matched
  const alreadyMatched = state.clapEvents.some((e) => e.beatIndex === nearestIndex);
  if (alreadyMatched) return;

  const delta = clapTime - state.beatTimes[nearestIndex];
  let rating;

  if (nearestDelta <= tolerance) {
    rating = "hit";
    state.correctCount++;
    state.streak++;
    if (state.streak > state.bestStreak) {
      state.bestStreak = state.streak;
    }

    let points = POINTS_PER_BEAT;
    if (state.streak >= STREAK_BONUS_THRESHOLD) {
      points += STREAK_BONUS_POINTS;
    }
    state.score += points;

    flashBeatLight("var(--color-success)");
  } else {
    rating = "miss";
    state.streak = 0;
    flashBeatLight("var(--color-error)");
  }

  state.clapEvents.push({
    time: clapTime,
    beatIndex: nearestIndex,
    delta,
    rating,
  });

  updateGameStats();
}

function checkMissedBeat(beatIdx) {
  const alreadyHit = state.clapEvents.some((e) => e.beatIndex === beatIdx);
  if (!alreadyHit && !state.missedBeats.includes(beatIdx)) {
    state.missedBeats.push(beatIdx);
    state.streak = 0;
    flashBeatLight("var(--color-error)");
    updateGameStats();
  }
}

function flashBeatLight(color) {
  state.flashColor = color;
  state.flashTime = performance.now();

  // Use inline style for CSS variable colors
  const light = els.beatLight;
  if (color.startsWith("var(")) {
    // Extract the CSS variable
    const varName = color.replace("var(", "").replace(")", "");
    light.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  } else {
    light.style.backgroundColor = color;
  }
  light.classList.add("rhythm-beat-light--flash");
  setTimeout(() => {
    light.classList.remove("rhythm-beat-light--flash");
    light.style.backgroundColor = "";
  }, FLASH_DURATION_MS);
}

/* ---------------------------------------------------------- */
/*  Stats Display                                             */
/* ---------------------------------------------------------- */

function updateGameStats() {
  els.statStreak.textContent = state.streak;
  const accuracy = state.totalBeatsPlayed > 0
    ? Math.round((state.correctCount / state.totalBeatsPlayed) * 100)
    : 100;
  els.statAccuracy.textContent = `${accuracy}%`;

  if (state.mode === "test" && state.totalBeatsExpected > 0) {
    els.statBeats.textContent = `${state.totalBeatsPlayed}/${state.totalBeatsExpected}`;
  } else {
    els.statBeats.textContent = state.totalBeatsPlayed;
  }

  els.statBpm.textContent = state.bpm;
}

/* ---------------------------------------------------------- */
/*  EKG Canvas Rendering                                      */
/* ---------------------------------------------------------- */

function resizeCanvas() {
  const canvas = state.canvas;
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = 180;
}

function requestRender() {
  function render() {
    if (!state.playing) return;
    drawEKG();
    state.animationFrameId = requestAnimationFrame(render);
  }
  state.animationFrameId = requestAnimationFrame(render);
}

function drawEKG() {
  const canvas = state.canvas;
  const ctx = state.ctx;
  const w = canvas.width;
  const h = canvas.height;
  const now = performance.now();

  ctx.clearRect(0, 0, w, h);

  const beatInterval = 60000 / state.bpm;
  const pixelsPerMs = (w * 0.6) / (beatInterval * state.beatsPerMeasure);
  const nowLineX = w * EKG_NOW_LINE_RATIO;

  // Background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-bg-card").trim() || "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const baselineY = h * 0.55;

  // Draw "now" line
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-primary-light").trim() || "#a29bfe";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(nowLineX, 0);
  ctx.lineTo(nowLineX, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw label for now line
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-primary-light").trim() || "#a29bfe";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NOW", nowLineX, 14);

  // Draw baseline
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-border").trim() || "#dfe6e9";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(w, baselineY);
  ctx.stroke();

  // Draw beat spikes
  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#6c5ce7";
  const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue("--color-secondary").trim() || "#00cec9";
  const successColor = getComputedStyle(document.documentElement).getPropertyValue("--color-success").trim() || "#00b894";
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue("--color-error").trim() || "#d63031";

  const visibleWindow = w / pixelsPerMs;
  const startTime = now - nowLineX / pixelsPerMs;
  const endTime = now + (w - nowLineX) / pixelsPerMs;

  // Draw beat spikes
  for (let i = 0; i < state.beatTimes.length; i++) {
    const bt = state.beatTimes[i];
    if (bt < startTime - beatInterval || bt > endTime + beatInterval) continue;

    const x = nowLineX + (bt - now) * pixelsPerMs;
    const isDownbeat = (i % state.beatsPerMeasure) === 0;
    const spikeH = isDownbeat ? DOWNBEAT_SPIKE_HEIGHT : BEAT_SPIKE_HEIGHT;

    // EKG-style spike shape
    ctx.strokeStyle = isDownbeat ? primaryColor : secondaryColor;
    ctx.lineWidth = isDownbeat ? 2.5 : 1.8;

    ctx.beginPath();
    // Lead-in
    const leadIn = 8;
    const leadOut = 8;
    ctx.moveTo(x - leadIn * 2, baselineY);
    ctx.lineTo(x - leadIn, baselineY);
    // Small dip
    ctx.lineTo(x - leadIn * 0.5, baselineY + 5);
    // Big spike up
    ctx.lineTo(x, baselineY - spikeH);
    // Sharp down
    ctx.lineTo(x + leadOut * 0.3, baselineY + spikeH * 0.3);
    // Recovery
    ctx.lineTo(x + leadOut, baselineY);
    ctx.lineTo(x + leadOut * 2, baselineY);
    ctx.stroke();

    // Beat number
    const beatNum = (i % state.beatsPerMeasure) + 1;
    ctx.fillStyle = isDownbeat ? primaryColor : secondaryColor;
    ctx.font = isDownbeat ? "bold 13px system-ui, sans-serif" : "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(beatNum.toString(), x, h - 8);
  }

  // Draw clap markers
  for (const clap of state.clapEvents) {
    const x = nowLineX + (clap.time - now) * pixelsPerMs;
    if (x < -20 || x > w + 20) continue;

    const color = clap.rating === "hit" ? successColor : errorColor;
    const markerY = baselineY - 10;

    // Clap marker: small triangle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, markerY - 8);
    ctx.lineTo(x - 5, markerY + 4);
    ctx.lineTo(x + 5, markerY + 4);
    ctx.closePath();
    ctx.fill();

    // Small dot
    ctx.beginPath();
    ctx.arc(x, markerY + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw missed beat markers
  for (const missedIdx of state.missedBeats) {
    if (missedIdx >= state.beatTimes.length) continue;
    const bt = state.beatTimes[missedIdx];
    const x = nowLineX + (bt - now) * pixelsPerMs;
    if (x < -20 || x > w + 20) continue;

    // X mark for missed beat
    ctx.strokeStyle = errorColor;
    ctx.lineWidth = 2;
    const my = baselineY + 20;
    ctx.beginPath();
    ctx.moveTo(x - 5, my - 5);
    ctx.lineTo(x + 5, my + 5);
    ctx.moveTo(x + 5, my - 5);
    ctx.lineTo(x - 5, my + 5);
    ctx.stroke();
  }
}

/* ---------------------------------------------------------- */
/*  Resize handling                                           */
/* ---------------------------------------------------------- */

window.addEventListener("resize", () => {
  if (state.canvas) {
    resizeCanvas();
  }
});

/* ---------------------------------------------------------- */
/*  Boot                                                      */
/* ---------------------------------------------------------- */

init();
