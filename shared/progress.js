/**
 * progress.js — Leaderboard & score tracking via localStorage
 *
 * Storage key pattern: mtg_leaderboard_<game>
 * Each key stores a JSON array of score entries.
 */

const STORAGE_PREFIX = 'mtg_leaderboard_';
const STREAK_PREFIX = 'mtg_streak_';

/**
 * Generate a simple unique ID.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Read the leaderboard array for a game from localStorage.
 * @param {string} game
 * @returns {Array}
 */
function readStore(game) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + game);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Write the leaderboard array for a game to localStorage.
 * @param {string} game
 * @param {Array} entries
 */
function writeStore(game, entries) {
  localStorage.setItem(STORAGE_PREFIX + game, JSON.stringify(entries));
}

/**
 * Save a score entry.
 *
 * @param {string} game        — game identifier (e.g. "interval-training")
 * @param {string} playerName  — display name
 * @param {number} score       — numeric score
 * @param {object} [metadata]  — extra data (difficulty, mode, streak, etc.)
 * @returns {object} the saved entry
 */
export function saveScore(game, playerName, score, metadata = {}) {
  const entry = {
    id: generateId(),
    game,
    playerName,
    score,
    difficulty: metadata.difficulty || null,
    mode: metadata.mode || null,
    streak: metadata.streak || 0,
    timestamp: Date.now(),
    metadata,
  };

  const entries = readStore(game);
  entries.push(entry);
  writeStore(game, entries);
  return entry;
}

/**
 * Get sorted leaderboard (highest score first) for a game.
 *
 * @param {string} game
 * @param {number} [limit=10]
 * @returns {Array}
 */
export function getLeaderboard(game, limit = 10) {
  const entries = readStore(game);
  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, limit);
}

/**
 * Clear the leaderboard for a game.
 *
 * @param {string} game
 */
export function clearLeaderboard(game) {
  localStorage.removeItem(STORAGE_PREFIX + game);
}

/**
 * Aggregate stats for a player across all games.
 *
 * Scans all mtg_leaderboard_* keys in localStorage.
 *
 * @param {string} playerName
 * @returns {{ totalGames: number, totalScore: number, bestScore: number, bestStreak: number, games: object }}
 */
export function getPlayerStats(playerName) {
  const stats = {
    totalGames: 0,
    totalScore: 0,
    bestScore: 0,
    bestStreak: 0,
    games: {},
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith(STORAGE_PREFIX)) continue;

    const game = key.slice(STORAGE_PREFIX.length);
    let entries;
    try {
      entries = JSON.parse(localStorage.getItem(key));
    } catch {
      continue;
    }

    const playerEntries = entries.filter(
      (e) => e.playerName === playerName
    );

    if (playerEntries.length === 0) continue;

    stats.games[game] = {
      played: playerEntries.length,
      bestScore: Math.max(...playerEntries.map((e) => e.score)),
    };

    stats.totalGames += playerEntries.length;
    stats.totalScore += playerEntries.reduce((sum, e) => sum + e.score, 0);
    stats.bestScore = Math.max(stats.bestScore, stats.games[game].bestScore);
    stats.bestStreak = Math.max(
      stats.bestStreak,
      ...playerEntries.map((e) => e.streak || 0)
    );
  }

  return stats;
}

/**
 * Track consecutive-correct-answer streak for a player.
 *
 * @param {string} playerName
 * @param {boolean} correct — true to increment, false to reset
 * @returns {{ current: number, best: number }}
 */
export function updateStreak(playerName, correct) {
  const key = STREAK_PREFIX + playerName;
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key)) || { current: 0, best: 0 };
  } catch {
    data = { current: 0, best: 0 };
  }

  if (correct) {
    data.current += 1;
    if (data.current > data.best) {
      data.best = data.current;
    }
  } else {
    data.current = 0;
  }

  localStorage.setItem(key, JSON.stringify(data));
  return { current: data.current, best: data.best };
}

/**
 * Get current streak info without modifying it.
 *
 * @param {string} playerName
 * @returns {{ current: number, best: number }}
 */
export function getStreak(playerName) {
  const key = STREAK_PREFIX + playerName;
  try {
    return JSON.parse(localStorage.getItem(key)) || { current: 0, best: 0 };
  } catch {
    return { current: 0, best: 0 };
  }
}
