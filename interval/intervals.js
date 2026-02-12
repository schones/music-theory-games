/**
 * Interval Training Game — Main Logic
 * harmony/intervals.js
 *
 * State-machine driven game: SETUP → PLAYING → ANSWER_GIVEN → RESULTS
 */

import {
  initAudio,
  playInterval,
  playNote,
  getIntervalName,
  getNoteRange,
  noteToFrequency,
  frequencyToNote,
  startPitchDetection,
  stopPitchDetection,
  INTERVAL_NAMES,
} from "../shared/audio.js";

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

const GAME_ID = "harmony-intervals";

const DIFFICULTY_POOLS = {
  easy: [0, 3, 4, 7, 12],                         // Unison, m3, M3, P5, Octave
  medium: [0, 1, 2, 3, 4, 5, 7, 8, 9, 12],        // + m2, M2, P4, m6, M6
  hard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // All intervals
};

const POINTS_CORRECT = 100;
const POINTS_STREAK_BONUS = 50; // Extra per correct when streak >= 3

/* ---------------------------------------------------------- */
/*  State                                                     */
/* ---------------------------------------------------------- */

const state = {
  screen: "setup", // "setup" | "game" | "results"
  mode: "practice",
  difficulty: "easy",
  rootNote: "C4",
  direction: "melodic-up",
  playerName: "Player",

  // Game state
  currentQuestion: null,    // { root, semitones, intervalName }
  questionIndex: 0,
  totalQuestions: 0,         // 0 = practice (unlimited)
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctCount: 0,
  answered: false,

  // Pitch detection
  micActive: false,
  detectedNote: null,
  detectedCents: 0,

  // Audio initialized
  audioReady: false,
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
  rootNote: $("root-note"),
  direction: $("direction"),
  btnStart: $("btn-start"),

  scoreValue: $("score-value"),
  streakValue: $("streak-value"),
  questionValue: $("question-value"),
  questionCounterWrap: $("question-counter-wrap"),

  gaugeArea: $("gauge-area"),
  gaugeNeedle: $("gauge-needle"),
  gaugeNote: $("gauge-note"),
  gaugeCents: $("gauge-cents"),
  btnToggleMic: $("btn-toggle-mic"),

  btnReplay: $("btn-replay"),
  feedbackText: $("feedback-text"),
  answerGrid: $("answer-grid"),
  scoreFly: $("score-fly"),

  btnNext: $("btn-next"),
  btnQuit: $("btn-quit"),

  resultScore: $("result-score"),
  resultCorrect: $("result-correct"),
  resultStreak: $("result-streak"),
  btnPlayAgain: $("btn-play-again"),

  setupLeaderboard: $("setup-leaderboard"),
  resultsLeaderboard: $("results-leaderboard"),
};

/* ---------------------------------------------------------- */
/*  Initialization                                            */
/* ---------------------------------------------------------- */

function init() {
  populateRootNoteSelect();
  loadPreferences();
  renderLeaderboard(els.setupLeaderboard, GAME_ID);
  bindEvents();
  showScreen("setup");
}

function populateRootNoteSelect() {
  const notes = getNoteRange(3, "C5");
  els.rootNote.innerHTML = notes
    .map((n) => `<option value="${n}">${n}</option>`)
    .join("");
  els.rootNote.value = "C4";
}

function loadPreferences() {
  const name = getPreference("playerName", "Player");
  const diff = getPreference("difficulty", "easy");
  const mode = getPreference("gameMode", "practice");
  const root = getPreference("rootNote", "C4");
  const dir = getPreference("direction", "melodic-up");

  els.playerName.value = name;
  els.difficulty.value = diff;
  els.gameMode.value = mode;
  els.rootNote.value = root;
  els.direction.value = dir;
}

function saveCurrentPreferences() {
  savePreference("playerName", els.playerName.value);
  savePreference("difficulty", els.difficulty.value);
  savePreference("gameMode", els.gameMode.value);
  savePreference("rootNote", els.rootNote.value);
  savePreference("direction", els.direction.value);
}

/* ---------------------------------------------------------- */
/*  Event binding                                             */
/* ---------------------------------------------------------- */

function bindEvents() {
  els.btnStart.addEventListener("click", handleStart);
  els.btnReplay.addEventListener("click", handleReplay);
  els.btnNext.addEventListener("click", handleNext);
  els.btnQuit.addEventListener("click", handleQuit);
  els.btnPlayAgain.addEventListener("click", handlePlayAgain);
  els.btnToggleMic.addEventListener("click", handleToggleMic);

  // Keyboard shortcuts during gameplay
  document.addEventListener("keydown", handleKeydown);
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
/*  Game flow                                                 */
/* ---------------------------------------------------------- */

async function handleStart() {
  // Initialize audio on first user gesture
  if (!state.audioReady) {
    try {
      await initAudio();
      state.audioReady = true;
    } catch (err) {
      alert("Could not start audio: " + err.message);
      return;
    }
  }

  saveCurrentPreferences();

  // Read settings
  state.playerName = els.playerName.value.trim() || "Player";
  state.difficulty = els.difficulty.value;
  state.direction = els.direction.value;
  state.rootNote = els.rootNote.value;

  const modeVal = els.gameMode.value;
  if (modeVal === "practice") {
    state.mode = "practice";
    state.totalQuestions = 0;
  } else if (modeVal === "test-10") {
    state.mode = "test";
    state.totalQuestions = 10;
  } else {
    state.mode = "test";
    state.totalQuestions = 20;
  }

  // Reset game state
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.correctCount = 0;
  state.questionIndex = 0;
  state.answered = false;

  // UI
  els.questionCounterWrap.hidden = state.mode === "practice";
  buildAnswerButtons();
  showScreen("game");
  nextQuestion();
}

function nextQuestion() {
  state.questionIndex++;
  state.answered = false;

  // Generate question
  state.currentQuestion = generateQuestion(state.difficulty, state.rootNote);

  // Update UI
  updateScoreDisplay();
  els.feedbackText.textContent = "";
  els.feedbackText.className = "harmony-feedback";
  els.btnNext.hidden = true;
  enableAnswerButtons(true);

  // Play the interval
  playCurrentInterval();
}

function generateQuestion(difficulty, rootNote) {
  const pool = DIFFICULTY_POOLS[difficulty];
  const semitones = pool[Math.floor(Math.random() * pool.length)];
  return {
    root: rootNote,
    semitones,
    intervalName: getIntervalName(semitones),
  };
}

function playCurrentInterval() {
  if (!state.currentQuestion) return;
  const { root, semitones } = state.currentQuestion;
  playInterval(root, semitones, state.direction, 0.8);
}

function handleReplay() {
  playCurrentInterval();
}

function checkAnswer(selectedSemitones) {
  if (state.answered) return;
  state.answered = true;

  const correct = selectedSemitones === state.currentQuestion.semitones;

  if (correct) {
    state.correctCount++;
    state.streak++;
    if (state.streak > state.bestStreak) {
      state.bestStreak = state.streak;
    }

    let points = POINTS_CORRECT;
    if (state.streak >= 3) {
      points += POINTS_STREAK_BONUS;
    }
    state.score += points;

    showFeedback(true, `Correct! ${state.currentQuestion.intervalName}`, points);
  } else {
    state.streak = 0;
    showFeedback(
      false,
      `It was ${state.currentQuestion.intervalName}`,
      0
    );
  }

  updateScoreDisplay();
  highlightAnswerButtons(state.currentQuestion.semitones, selectedSemitones);
  enableAnswerButtons(false);

  // In test mode, auto-advance or show results
  if (state.mode === "test") {
    if (state.questionIndex >= state.totalQuestions) {
      setTimeout(() => endTest(), 1500);
      return;
    }
  }

  els.btnNext.hidden = false;
}

function handleNext() {
  nextQuestion();
}

function handleQuit() {
  stopPitchDetection();
  state.micActive = false;
  els.btnToggleMic.textContent = "Enable Microphone";

  if (state.mode === "test" && state.questionIndex > 1) {
    endTest();
  } else {
    showScreen("setup");
    renderLeaderboard(els.setupLeaderboard, GAME_ID);
  }
}

function handlePlayAgain() {
  showScreen("setup");
  renderLeaderboard(els.setupLeaderboard, GAME_ID);
}

function endTest() {
  // Save score
  saveScore(GAME_ID, state.playerName, state.score, {
    difficulty: state.difficulty,
    correct: state.correctCount,
    total: state.questionIndex,
    bestStreak: state.bestStreak,
    direction: state.direction,
    rootNote: state.rootNote,
  });

  // Stop mic if running
  stopPitchDetection();
  state.micActive = false;

  // Show results
  els.resultScore.textContent = state.score;
  els.resultCorrect.textContent = `${state.correctCount}/${state.questionIndex}`;
  els.resultStreak.textContent = state.bestStreak;

  renderLeaderboard(els.resultsLeaderboard, GAME_ID);
  showScreen("results");
}

/* ---------------------------------------------------------- */
/*  Answer buttons                                            */
/* ---------------------------------------------------------- */

function buildAnswerButtons() {
  const pool = DIFFICULTY_POOLS[state.difficulty];
  els.answerGrid.innerHTML = "";

  pool.forEach((semitones, i) => {
    const btn = document.createElement("button");
    btn.className = "btn btn--secondary harmony-answer-btn";
    btn.textContent = getIntervalName(semitones);
    btn.dataset.semitones = semitones;
    btn.addEventListener("click", () => checkAnswer(semitones));

    // Keyboard hint
    if (i < 9) {
      const hint = document.createElement("span");
      hint.className = "harmony-answer-hint";
      hint.textContent = i + 1;
      btn.prepend(hint);
    }

    els.answerGrid.appendChild(btn);
  });
}

function enableAnswerButtons(enabled) {
  els.answerGrid.querySelectorAll(".harmony-answer-btn").forEach((btn) => {
    btn.disabled = !enabled;
  });
}

function highlightAnswerButtons(correctSemitones, selectedSemitones) {
  els.answerGrid.querySelectorAll(".harmony-answer-btn").forEach((btn) => {
    const st = parseInt(btn.dataset.semitones, 10);
    btn.classList.remove("harmony-answer-btn--correct", "harmony-answer-btn--wrong");
    if (st === correctSemitones) {
      btn.classList.add("harmony-answer-btn--correct");
    } else if (st === selectedSemitones) {
      btn.classList.add("harmony-answer-btn--wrong");
    }
  });
}

/* ---------------------------------------------------------- */
/*  UI updates                                                */
/* ---------------------------------------------------------- */

function updateScoreDisplay() {
  els.scoreValue.textContent = state.score;
  els.streakValue.textContent = state.streak;
  if (state.mode === "test") {
    els.questionValue.textContent = `${state.questionIndex}/${state.totalQuestions}`;
  }
}

function showFeedback(correct, message, points) {
  els.feedbackText.textContent = message;
  els.feedbackText.className = "harmony-feedback " +
    (correct ? "harmony-feedback--correct animate-pop" : "harmony-feedback--wrong animate-shake");

  if (correct && points > 0) {
    showScoreFly(`+${points}`);
  }
}

function showScoreFly(text) {
  els.scoreFly.textContent = text;
  els.scoreFly.classList.remove("animate-score-fly");
  // Force reflow to restart animation
  void els.scoreFly.offsetWidth;
  els.scoreFly.classList.add("animate-score-fly");
}

/* ---------------------------------------------------------- */
/*  Keyboard shortcuts                                        */
/* ---------------------------------------------------------- */

function handleKeydown(e) {
  if (state.screen !== "game") return;

  // Number keys 1-9 for answer selection
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 9 && !state.answered) {
    const pool = DIFFICULTY_POOLS[state.difficulty];
    if (num <= pool.length) {
      checkAnswer(pool[num - 1]);
    }
    return;
  }

  // Space to replay
  if (e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    handleReplay();
    return;
  }

  // Enter for next question
  if (e.key === "Enter" && state.answered && !els.btnNext.hidden) {
    handleNext();
    return;
  }
}

/* ---------------------------------------------------------- */
/*  Pitch Detection / Gauge                                   */
/* ---------------------------------------------------------- */

async function handleToggleMic() {
  if (state.micActive) {
    stopPitchDetection();
    state.micActive = false;
    els.btnToggleMic.textContent = "Enable Microphone";
    els.gaugeNote.textContent = "--";
    els.gaugeCents.textContent = "0 cents";
    resetGaugeNeedle();
    return;
  }

  try {
    if (!state.audioReady) {
      await initAudio();
      state.audioReady = true;
    }

    await startPitchDetection((freq, noteInfo) => {
      if (!noteInfo) {
        els.gaugeNote.textContent = "--";
        els.gaugeCents.textContent = "listening...";
        resetGaugeNeedle();
        return;
      }

      state.detectedNote = noteInfo.fullName;
      state.detectedCents = noteInfo.cents;

      els.gaugeNote.textContent = noteInfo.fullName;
      els.gaugeCents.textContent = `${noteInfo.cents > 0 ? "+" : ""}${noteInfo.cents} cents`;
      updateGaugeNeedle(noteInfo.cents);
    });

    state.micActive = true;
    els.btnToggleMic.textContent = "Disable Microphone";
    els.gaugeArea.hidden = false;
  } catch (err) {
    alert(err.message);
  }
}

function updateGaugeNeedle(cents) {
  // Map cents (-50 to +50) to rotation (-80deg to +80deg)
  const clamped = Math.max(-50, Math.min(50, cents));
  const angle = (clamped / 50) * 80;
  els.gaugeNeedle.setAttribute(
    "transform",
    `rotate(${angle}, 110, 110)`
  );
}

function resetGaugeNeedle() {
  els.gaugeNeedle.setAttribute("transform", "rotate(0, 110, 110)");
}

/* ---------------------------------------------------------- */
/*  Boot                                                      */
/* ---------------------------------------------------------- */

init();
