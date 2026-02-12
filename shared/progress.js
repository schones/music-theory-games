/**
 * Music Theory Games — Progress & Leaderboard Module
 * shared/progress.js
 *
 * All persistence via localStorage. Exports pure functions for
 * score tracking, leaderboard management, and user preferences.
 */

const STORAGE_PREFIX = "mtt_";
const LEADERBOARD_KEY = (game) => `${STORAGE_PREFIX}leaderboard_${game}`;
const PREFS_KEY = `${STORAGE_PREFIX}prefs`;
const MAX_LEADERBOARD_SIZE = 100;

/* ---------------------------------------------------------- */
/*  Internal helpers                                          */
/* ---------------------------------------------------------- */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn(`[progress] Failed to write to localStorage key "${key}"`);
    return false;
  }
}

/* ---------------------------------------------------------- */
/*  Score / Leaderboard                                       */
/* ---------------------------------------------------------- */

/**
 * Save a score entry for a game.
 *
 * @param {string} game       - Game identifier (e.g. "harmony-intervals")
 * @param {string} playerName - Display name
 * @param {number} score      - Numeric score
 * @param {object} [metadata] - Optional extra data (difficulty, streak, etc.)
 * @returns {object}          - The saved entry
 */
export function saveScore(game, playerName, score, metadata = {}) {
  const entry = {
    playerName: playerName.trim().slice(0, 30),
    score,
    date: new Date().toISOString(),
    metadata,
  };

  const board = readJSON(LEADERBOARD_KEY(game), []);
  board.push(entry);

  // Keep only top entries by score (descending), cap at MAX_LEADERBOARD_SIZE
  board.sort((a, b) => b.score - a.score);
  if (board.length > MAX_LEADERBOARD_SIZE) {
    board.length = MAX_LEADERBOARD_SIZE;
  }

  writeJSON(LEADERBOARD_KEY(game), board);
  return entry;
}

/**
 * Get the leaderboard for a game.
 *
 * @param {string} game     - Game identifier
 * @param {number} [limit]  - Max entries to return (default 10)
 * @returns {Array<object>} - Sorted score entries (highest first)
 */
export function getLeaderboard(game, limit = 10) {
  const board = readJSON(LEADERBOARD_KEY(game), []);
  return board.slice(0, limit);
}

/**
 * Clear all leaderboard data for a game.
 *
 * @param {string} game - Game identifier
 */
export function clearLeaderboard(game) {
  try {
    localStorage.removeItem(LEADERBOARD_KEY(game));
  } catch {
    // Ignore
  }
}

/**
 * Get aggregate statistics for a game, optionally filtered by player.
 *
 * @param {string} game         - Game identifier
 * @param {string} [playerName] - Optional player filter
 * @returns {object}            - { totalGames, averageScore, bestScore, bestStreak }
 */
export function getStats(game, playerName) {
  let board = readJSON(LEADERBOARD_KEY(game), []);

  if (playerName) {
    const normalized = playerName.trim().toLowerCase();
    board = board.filter(
      (e) => e.playerName.toLowerCase() === normalized
    );
  }

  if (board.length === 0) {
    return { totalGames: 0, averageScore: 0, bestScore: 0, bestStreak: 0 };
  }

  const totalGames = board.length;
  const totalScore = board.reduce((sum, e) => sum + e.score, 0);
  const averageScore = Math.round(totalScore / totalGames);
  const bestScore = board[0].score;
  const bestStreak = Math.max(
    0,
    ...board.map((e) => e.metadata?.bestStreak ?? 0)
  );

  return { totalGames, averageScore, bestScore, bestStreak };
}

/* ---------------------------------------------------------- */
/*  Preferences                                               */
/* ---------------------------------------------------------- */

/**
 * Save a user preference.
 *
 * @param {string} key   - Preference key
 * @param {*}      value - Any JSON-serializable value
 */
export function savePreference(key, value) {
  const prefs = readJSON(PREFS_KEY, {});
  prefs[key] = value;
  writeJSON(PREFS_KEY, prefs);
}

/**
 * Get a user preference.
 *
 * @param {string} key          - Preference key
 * @param {*}      defaultValue - Fallback if not set
 * @returns {*}
 */
export function getPreference(key, defaultValue = null) {
  const prefs = readJSON(PREFS_KEY, {});
  return key in prefs ? prefs[key] : defaultValue;
}

/* ---------------------------------------------------------- */
/*  Leaderboard DOM rendering helper                          */
/* ---------------------------------------------------------- */

/**
 * Render a leaderboard into a container element.
 * Uses the CSS classes from shared/styles.css.
 *
 * @param {HTMLElement} container - Target element
 * @param {string}      game     - Game identifier
 * @param {number}      [limit]  - Max entries (default 10)
 */
export function renderLeaderboard(container, game, limit = 10) {
  const entries = getLeaderboard(game, limit);
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML =
      '<p class="leaderboard__empty">No scores yet. Be the first!</p>';
    return;
  }

  const list = document.createElement("div");
  list.className = "leaderboard__list";

  entries.forEach((entry, i) => {
    const row = document.createElement("div");
    row.className = "leaderboard__row";

    const rank = document.createElement("span");
    rank.className = "leaderboard__rank";
    rank.textContent = i + 1;

    const name = document.createElement("span");
    name.className = "leaderboard__name";
    name.textContent = entry.playerName;

    const score = document.createElement("span");
    score.className = "leaderboard__score";
    score.textContent = entry.score;

    const date = document.createElement("span");
    date.className = "leaderboard__date";
    date.textContent = formatDate(entry.date);

    row.append(rank, name, score, date);
    list.appendChild(row);
  });

  container.appendChild(list);
}

/**
 * Format an ISO date string to a short display format.
 */
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    const month = d.toLocaleString("default", { month: "short" });
    return `${month} ${d.getDate()}`;
  } catch {
    return "";
  }
}
