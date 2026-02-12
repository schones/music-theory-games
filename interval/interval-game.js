/**
 * interval-game.js — Interval training game controller
 *
 * Modes: practice (infinite, no timer) and test (20 questions, timed).
 * Difficulty: easy (4 intervals), medium (8), hard (13).
 * Features: guitar-tuner gauge, pitch detection, leaderboard integration.
 */

import {
  initAudio,
  playInterval,
  playNote,
  playCorrectSound,
  playIncorrectSound,
  getIntervalName,
  getIntervalShort,
  transposeNote,
  getRootNoteOptions,
  setupMicrophone,
  detectPitch,
  noteToFrequency,
  frequencyToNote,
  INTERVALS,
} from '../shared/audio.js';

import {
  saveScore,
  getLeaderboard,
  updateStreak,
  getStreak,
} from '../shared/progress.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_ID = 'interval-training';
const TEST_QUESTION_COUNT = 20;

/** Intervals included per difficulty */
const DIFFICULTY_INTERVALS = {
  easy: [
    INTERVALS.unison,
    INTERVALS.major3rd,
    INTERVALS.perfect5th,
    INTERVALS.perfectOctave,
  ],
  medium: [
    INTERVALS.unison,
    INTERVALS.minor3rd,
    INTERVALS.major3rd,
    INTERVALS.perfect4th,
    INTERVALS.perfect5th,
    INTERVALS.minor6th,
    INTERVALS.major6th,
    INTERVALS.perfectOctave,
  ],
  hard: Array.from({ length: 13 }, (_, i) => i), // 0–12
};

/** Scoring */
const BASE_POINTS = 100;
const STREAK_MULTIPLIER = 10; // extra points per streak level
const TIME_BONUS_MAX = 50; // max bonus for fast answers
const TIME_BONUS_WINDOW = 5; // seconds within which full time bonus is awarded

// Interval quality colors for buttons
const INTERVAL_COLORS = {
  0: 'perfect',   // Unison
  5: 'perfect',   // P4
  7: 'perfect',   // P5
  12: 'perfect',  // P8
  1: 'minor',
  3: 'minor',
  8: 'minor',
  10: 'minor',
  2: 'major',
  4: 'major',
  9: 'major',
  11: 'major',
  6: 'tritone',
};

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  setup: $('#setup-screen'),
  game: $('#game-screen'),
  results: $('#results-screen'),
};

const els = {
  playerName: $('#player-name'),
  rootNote: $('#root-note'),
  enableMic: $('#enable-mic'),
  startBtn: $('#start-btn'),
  replayBtn: $('#replay-btn'),
  scoreDisplay: $('#score-display'),
  streakDisplay: $('#streak-display'),
  questionDisplay: $('#question-display'),
  questionWrapper: $('#question-counter-wrapper'),
  timerDisplay: $('#timer-display'),
  timerWrapper: $('#timer-wrapper'),
  intervalButtons: $('#interval-buttons'),
  feedback: $('#feedback'),
  feedbackContent: $('#feedback-content'),
  tunerSection: $('#tuner-section'),
  tunerNeedle: $('#tuner-needle'),
  detectedNote: $('#detected-note'),
  detectedFreq: $('#detected-freq'),
  detectedCents: $('#detected-cents'),
  finalScore: $('#final-score'),
  resultsStats: $('#results-stats'),
  leaderboardBody: $('#leaderboard-body'),
  playAgainBtn: $('#play-again-btn'),
  backToSetupBtn: $('#back-to-setup-btn'),
};

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

let state = {
  mode: 'practice',
  difficulty: 'easy',
  rootNote: 'C4',
  playerName: '',
  micEnabled: false,

  // Runtime
  currentInterval: null,
  score: 0,
  streak: 0,
  bestStreak: 0,
  questionIndex: 0,
  totalCorrect: 0,
  totalAnswered: 0,
  questionStartTime: 0,
  gameStartTime: 0,
  timerInterval: null,
  isAnswering: false,

  // Mic
  analyser: null,
  micStream: null,
  pitchAnimFrame: null,
};

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function init() {
  populateRootNoteSelect();
  bindSetupEvents();
  bindGameEvents();
  bindResultEvents();

  // Restore last-used name
  const saved = localStorage.getItem('mtg_player_name');
  if (saved) els.playerName.value = saved;
}

function populateRootNoteSelect() {
  const notes = getRootNoteOptions();
  els.rootNote.innerHTML = notes
    .map((n) => `<option value="${n}"${n === 'C4' ? ' selected' : ''}>${n}</option>`)
    .join('');
}

// ---------------------------------------------------------------------------
// Screen management
// ---------------------------------------------------------------------------

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---------------------------------------------------------------------------
// Setup events
// ---------------------------------------------------------------------------

function bindSetupEvents() {
  // Mode toggle
  $$('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('[data-mode]').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      state.mode = btn.dataset.mode;
    });
  });

  // Difficulty toggle
  $$('[data-difficulty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('[data-difficulty]').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      state.difficulty = btn.dataset.difficulty;
    });
  });

  // Start
  els.startBtn.addEventListener('click', startGame);
}

// ---------------------------------------------------------------------------
// Game start
// ---------------------------------------------------------------------------

async function startGame() {
  const name = els.playerName.value.trim();
  if (!name) {
    els.playerName.focus();
    els.playerName.classList.add('anim-flash-incorrect');
    setTimeout(() => els.playerName.classList.remove('anim-flash-incorrect'), 600);
    return;
  }

  state.playerName = name;
  state.rootNote = els.rootNote.value;
  state.micEnabled = els.enableMic.checked;
  localStorage.setItem('mtg_player_name', name);

  // Init audio (needs user gesture)
  await initAudio();

  // Reset state
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.questionIndex = 0;
  state.totalCorrect = 0;
  state.totalAnswered = 0;
  state.isAnswering = false;

  // UI setup
  els.scoreDisplay.textContent = '0';
  els.streakDisplay.textContent = '0';

  if (state.mode === 'test') {
    els.questionWrapper.hidden = false;
    els.timerWrapper.hidden = false;
    els.questionDisplay.textContent = `1/${TEST_QUESTION_COUNT}`;
    state.gameStartTime = Date.now();
    startTimer();
  } else {
    els.questionWrapper.hidden = true;
    els.timerWrapper.hidden = true;
  }

  // Mic
  if (state.micEnabled) {
    try {
      const { analyser, stream } = await setupMicrophone();
      state.analyser = analyser;
      state.micStream = stream;
      els.tunerSection.hidden = false;
      startPitchDetection();
    } catch (err) {
      console.warn('Mic access denied:', err);
      state.micEnabled = false;
      els.tunerSection.hidden = true;
    }
  } else {
    els.tunerSection.hidden = true;
  }

  buildIntervalButtons();
  showScreen('game');
  nextQuestion();
}

// ---------------------------------------------------------------------------
// Timer (test mode)
// ---------------------------------------------------------------------------

function startTimer() {
  updateTimerDisplay();
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  els.timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Interval buttons
// ---------------------------------------------------------------------------

function buildIntervalButtons() {
  const intervals = DIFFICULTY_INTERVALS[state.difficulty];
  els.intervalButtons.innerHTML = '';

  intervals.forEach((semitones) => {
    const btn = document.createElement('button');
    btn.className = `btn interval-btn interval-btn--${INTERVAL_COLORS[semitones] || 'major'}`;
    btn.dataset.semitones = semitones;
    btn.innerHTML = `
      <span class="interval-btn__short">${getIntervalShort(semitones)}</span>
      <span class="interval-btn__name">${getIntervalName(semitones)}</span>
    `;
    btn.setAttribute('aria-label', getIntervalName(semitones));
    btn.addEventListener('click', () => handleAnswer(semitones));
    els.intervalButtons.appendChild(btn);
  });
}

// ---------------------------------------------------------------------------
// Question cycle
// ---------------------------------------------------------------------------

function nextQuestion() {
  const intervals = DIFFICULTY_INTERVALS[state.difficulty];
  state.currentInterval = intervals[Math.floor(Math.random() * intervals.length)];
  state.questionStartTime = Date.now();
  state.isAnswering = true;

  // Enable all buttons
  els.intervalButtons.querySelectorAll('.btn').forEach((b) => {
    b.disabled = false;
    b.classList.remove('interval-btn--correct', 'interval-btn--incorrect', 'interval-btn--reveal');
  });

  // Play the interval
  playCurrentInterval();
}

function playCurrentInterval() {
  playInterval(state.rootNote, state.currentInterval, true);
}

// ---------------------------------------------------------------------------
// Answer handling
// ---------------------------------------------------------------------------

function handleAnswer(chosenSemitones) {
  if (!state.isAnswering) return;
  state.isAnswering = false;
  state.totalAnswered++;

  const correct = chosenSemitones === state.currentInterval;
  const elapsed = (Date.now() - state.questionStartTime) / 1000;

  if (correct) {
    state.totalCorrect++;
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;

    // Calculate score
    let points = BASE_POINTS + state.streak * STREAK_MULTIPLIER;
    if (state.mode === 'test' && elapsed < TIME_BONUS_WINDOW) {
      points += Math.round(TIME_BONUS_MAX * (1 - elapsed / TIME_BONUS_WINDOW));
    }
    state.score += points;

    playCorrectSound();
    showFeedback(true, points);
  } else {
    state.streak = 0;
    playIncorrectSound();
    showFeedback(false, 0);
  }

  // Update streak tracking in localStorage
  updateStreak(state.playerName, correct);

  // Highlight buttons
  highlightButtons(chosenSemitones, correct);

  // Update displays
  els.scoreDisplay.textContent = state.score;
  els.streakDisplay.textContent = state.streak;
  if (state.streak > 0) {
    els.streakDisplay.classList.add('anim-pop');
    setTimeout(() => els.streakDisplay.classList.remove('anim-pop'), 300);
  }

  if (state.mode === 'test') {
    els.questionDisplay.textContent = `${state.questionIndex + 1}/${TEST_QUESTION_COUNT}`;
  }

  // Advance after delay
  setTimeout(() => {
    hideFeedback();
    state.questionIndex++;

    if (state.mode === 'test' && state.questionIndex >= TEST_QUESTION_COUNT) {
      endGame();
    } else {
      nextQuestion();
    }
  }, state.mode === 'practice' ? 1800 : 1200);
}

function highlightButtons(chosen, correct) {
  els.intervalButtons.querySelectorAll('.btn').forEach((btn) => {
    btn.disabled = true;
    const semi = parseInt(btn.dataset.semitones, 10);

    if (semi === state.currentInterval) {
      btn.classList.add('interval-btn--correct');
    }
    if (semi === chosen && !correct) {
      btn.classList.add('interval-btn--incorrect');
    }
  });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

function showFeedback(correct, points) {
  els.feedback.hidden = false;
  els.feedback.className = `feedback ${correct ? 'feedback--correct' : 'feedback--incorrect'}`;
  const intervalName = getIntervalName(state.currentInterval);
  const targetNote = transposeNote(state.rootNote, state.currentInterval);

  if (correct) {
    els.feedbackContent.innerHTML = `
      <div class="feedback__icon">&#10003;</div>
      <div class="feedback__text">Correct!</div>
      <div class="feedback__detail">${intervalName} (${state.rootNote} &rarr; ${targetNote})</div>
      <div class="feedback__points">+${points} pts</div>
    `;
  } else {
    els.feedbackContent.innerHTML = `
      <div class="feedback__icon">&#10007;</div>
      <div class="feedback__text">Not quite!</div>
      <div class="feedback__detail">It was: ${intervalName} (${state.rootNote} &rarr; ${targetNote})</div>
    `;
  }
}

function hideFeedback() {
  els.feedback.hidden = true;
}

// ---------------------------------------------------------------------------
// Pitch detection loop
// ---------------------------------------------------------------------------

function startPitchDetection() {
  function loop() {
    if (!state.analyser) return;

    const result = detectPitch(state.analyser);

    if (result) {
      els.detectedNote.textContent = result.noteName;
      els.detectedFreq.textContent = `${result.frequency} Hz`;
      els.detectedCents.textContent = `${result.cents > 0 ? '+' : ''}${result.cents} cents`;

      // Rotate needle: -50 cents = -45deg, +50 cents = +45deg
      const clampedCents = Math.max(-50, Math.min(50, result.cents));
      const angle = (clampedCents / 50) * 45;
      els.tunerNeedle.style.transform = `rotate(${angle}deg)`;

      // Color the needle based on accuracy
      const absCents = Math.abs(result.cents);
      if (absCents <= 5) {
        els.tunerNeedle.classList.add('tuner-gauge__needle--in-tune');
        els.tunerNeedle.classList.remove('tuner-gauge__needle--close', 'tuner-gauge__needle--off');
      } else if (absCents <= 15) {
        els.tunerNeedle.classList.add('tuner-gauge__needle--close');
        els.tunerNeedle.classList.remove('tuner-gauge__needle--in-tune', 'tuner-gauge__needle--off');
      } else {
        els.tunerNeedle.classList.add('tuner-gauge__needle--off');
        els.tunerNeedle.classList.remove('tuner-gauge__needle--in-tune', 'tuner-gauge__needle--close');
      }
    } else {
      els.detectedNote.textContent = '--';
      els.detectedFreq.textContent = '-- Hz';
      els.detectedCents.textContent = '-- cents';
      els.tunerNeedle.style.transform = 'rotate(0deg)';
      els.tunerNeedle.classList.remove('tuner-gauge__needle--in-tune', 'tuner-gauge__needle--close', 'tuner-gauge__needle--off');
    }

    state.pitchAnimFrame = requestAnimationFrame(loop);
  }

  loop();
}

function stopPitchDetection() {
  if (state.pitchAnimFrame) {
    cancelAnimationFrame(state.pitchAnimFrame);
    state.pitchAnimFrame = null;
  }
  if (state.micStream) {
    state.micStream.getTracks().forEach((t) => t.stop());
    state.micStream = null;
  }
  state.analyser = null;
}

// ---------------------------------------------------------------------------
// End game
// ---------------------------------------------------------------------------

function endGame() {
  stopTimer();
  stopPitchDetection();

  const streakData = getStreak(state.playerName);

  // Save score
  saveScore(GAME_ID, state.playerName, state.score, {
    difficulty: state.difficulty,
    mode: state.mode,
    streak: state.bestStreak,
    correct: state.totalCorrect,
    total: state.totalAnswered,
  });

  // Populate results
  els.finalScore.textContent = state.score;
  els.resultsStats.innerHTML = `
    <div class="stats-bar mt-lg">
      <div class="stat">
        <span class="stat__value">${state.totalCorrect}/${state.totalAnswered}</span>
        <span class="stat__label">Correct</span>
      </div>
      <div class="stat">
        <span class="stat__value">${Math.round((state.totalCorrect / state.totalAnswered) * 100)}%</span>
        <span class="stat__label">Accuracy</span>
      </div>
      <div class="stat">
        <span class="stat__value">${state.bestStreak}</span>
        <span class="stat__label">Best Streak</span>
      </div>
      <div class="stat">
        <span class="stat__value">${streakData.best}</span>
        <span class="stat__label">All-Time Streak</span>
      </div>
    </div>
  `;

  // Populate leaderboard
  const entries = getLeaderboard(GAME_ID, 10);
  els.leaderboardBody.innerHTML = entries
    .map(
      (e, i) => `
      <tr>
        <td class="leaderboard__rank">${i + 1}</td>
        <td>${escapeHtml(e.playerName)}</td>
        <td>${e.score}</td>
        <td>${e.difficulty || '—'}</td>
        <td>${e.streak || 0}</td>
      </tr>`
    )
    .join('');

  showScreen('results');
}

// ---------------------------------------------------------------------------
// Results events
// ---------------------------------------------------------------------------

function bindResultEvents() {
  els.playAgainBtn.addEventListener('click', () => {
    startGame();
  });

  els.backToSetupBtn.addEventListener('click', () => {
    stopTimer();
    stopPitchDetection();
    showScreen('setup');
  });
}

// ---------------------------------------------------------------------------
// Game events
// ---------------------------------------------------------------------------

function bindGameEvents() {
  els.replayBtn.addEventListener('click', () => {
    playCurrentInterval();
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

init();
