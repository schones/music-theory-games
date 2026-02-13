/**
 * Music Theory Games — Adaptive Difficulty & AI Tutor
 * shared/ai.js
 *
 * Tracks per-game, per-skill performance in localStorage.
 * Calculates adaptive weights to bias practice toward weak areas.
 * Optionally calls the Claude API for post-session feedback.
 * All AI features degrade gracefully if no API key is set.
 */

/* ---------------------------------------------------------- */
/*  Config — dynamic import for graceful degradation           */
/* ---------------------------------------------------------- */

let CLAUDE_API_KEY = "";
try {
  const config = await import("./config.js");
  CLAUDE_API_KEY = config.CLAUDE_API_KEY || "";
} catch {
  // config.js not found — AI features disabled
}

/* ---------------------------------------------------------- */
/*  Constants                                                  */
/* ---------------------------------------------------------- */

const STORAGE_PREFIX = "mtt_ai_";
const PERF_KEY = (game) => `${STORAGE_PREFIX}${game}`;
const MAX_SESSIONS = 50;

/* ---------------------------------------------------------- */
/*  Internal helpers                                           */
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
    console.warn(`[ai] Failed to write to localStorage key "${key}"`);
    return false;
  }
}

function emptyPerformance() {
  return { skills: {}, sessions: [] };
}

function emptySkill() {
  return {
    attempts: 0,
    hits: 0,
    totalCentsOff: 0,
    totalResponseMs: 0,
    lastAttempt: null,
    streak: 0,
    bestStreak: 0,
  };
}

/* ---------------------------------------------------------- */
/*  Performance tracking                                       */
/* ---------------------------------------------------------- */

/**
 * Get raw performance data for a game.
 *
 * @param {string} game - Game identifier (e.g. "harmony-training")
 * @returns {{ skills: Object, sessions: Array }}
 */
export function getPerformance(game) {
  return readJSON(PERF_KEY(game), emptyPerformance());
}

/**
 * Record a single practice attempt.
 *
 * @param {string} game  - Game identifier
 * @param {string} skill - Skill identifier (e.g. "Perfect 5th", "beat-timing")
 * @param {object} result - { hit: boolean, centsOff?: number, responseMs?: number }
 */
export function recordAttempt(game, skill, result) {
  const perf = getPerformance(game);

  if (!perf.skills[skill]) {
    perf.skills[skill] = emptySkill();
  }

  const s = perf.skills[skill];
  s.attempts++;

  if (result.hit) {
    s.hits++;
    s.streak++;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
  } else {
    s.streak = 0;
  }

  if (result.centsOff != null) s.totalCentsOff += Math.abs(result.centsOff);
  if (result.responseMs != null) s.totalResponseMs += result.responseMs;
  s.lastAttempt = new Date().toISOString();

  writeJSON(PERF_KEY(game), perf);
}

/**
 * Save a completed session summary.
 *
 * @param {string} game        - Game identifier
 * @param {object} sessionData - { mode, difficulty, score, accuracy, duration?,
 *                                 skills?: { [name]: { attempts, hits } } }
 */
export function recordSession(game, sessionData) {
  const perf = getPerformance(game);

  perf.sessions.push({
    date: new Date().toISOString(),
    ...sessionData,
  });

  // Cap stored sessions
  if (perf.sessions.length > MAX_SESSIONS) {
    perf.sessions = perf.sessions.slice(-MAX_SESSIONS);
  }

  writeJSON(PERF_KEY(game), perf);
}

/**
 * Clear all tracking data for a game.
 *
 * @param {string} game - Game identifier
 */
export function clearPerformance(game) {
  try {
    localStorage.removeItem(PERF_KEY(game));
  } catch {
    // Ignore
  }
}

/* ---------------------------------------------------------- */
/*  Adaptive weights                                           */
/* ---------------------------------------------------------- */

/**
 * Calculate probability weights that bias toward weak areas.
 *
 * Algorithm:
 *   - Base weight = 1 - accuracy (lower accuracy → higher weight)
 *   - Untried skills get weight 1.0 (high priority)
 *   - Skills with < 5 attempts get a 1.2× novelty bonus
 *   - Skills not practiced in 24+ hours get a 1.3× recency bonus
 *   - Weights are normalized to sum to 1
 *
 * @param {string}   game   - Game identifier
 * @param {string[]} skills - Array of skill names to weight
 * @returns {Object} Map of skill → probability (0–1), summing to 1
 */
export function getAdaptiveWeights(game, skills) {
  if (!skills || skills.length === 0) return {};

  const perf = getPerformance(game);
  const raw = {};

  for (const skill of skills) {
    const data = perf.skills[skill];

    if (!data || data.attempts === 0) {
      raw[skill] = 1.0;
      continue;
    }

    const accuracy = data.hits / data.attempts;
    let weight = Math.max(0.1, 1.0 - accuracy);

    // Novelty bonus: still learning
    if (data.attempts < 5) weight *= 1.2;

    // Recency bonus: not practiced recently
    if (data.lastAttempt) {
      const hoursSince =
        (Date.now() - new Date(data.lastAttempt).getTime()) / 3_600_000;
      if (hoursSince > 24) weight *= 1.3;
    }

    raw[skill] = weight;
  }

  // Normalize
  const total = Object.values(raw).reduce((sum, w) => sum + w, 0);
  const weights = {};
  for (const skill of skills) {
    weights[skill] = total > 0 ? raw[skill] / total : 1 / skills.length;
  }

  return weights;
}

/**
 * Pick a skill using adaptive weighted random selection.
 *
 * @param {string}   game   - Game identifier
 * @param {string[]} skills - Array of skill names
 * @returns {string} The selected skill
 */
export function selectWeighted(game, skills) {
  if (!skills || skills.length === 0) return null;
  if (skills.length === 1) return skills[0];

  const weights = getAdaptiveWeights(game, skills);
  const rand = Math.random();
  let cumulative = 0;

  for (const skill of skills) {
    cumulative += weights[skill];
    if (rand <= cumulative) return skill;
  }

  return skills[skills.length - 1];
}

/**
 * Get skills sorted by weakness (lowest accuracy first).
 *
 * @param {string} game    - Game identifier
 * @param {number} [limit] - Max results (default all)
 * @returns {Array<{ skill: string, accuracy: number, attempts: number }>}
 */
export function getWeakAreas(game, limit) {
  const perf = getPerformance(game);
  const entries = Object.entries(perf.skills)
    .map(([skill, data]) => ({
      skill,
      accuracy: data.attempts > 0 ? data.hits / data.attempts : 0,
      attempts: data.attempts,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return limit ? entries.slice(0, limit) : entries;
}

/**
 * Get a human-readable summary of performance for a game.
 * Useful as context for AI feedback prompts.
 *
 * @param {string} game - Game identifier
 * @returns {object} Summary with totals, per-skill breakdown, and recent trend
 */
export function getPerformanceSummary(game) {
  const perf = getPerformance(game);
  const skillNames = Object.keys(perf.skills);

  if (skillNames.length === 0) {
    return { totalAttempts: 0, overallAccuracy: 0, skills: [], recentSessions: [] };
  }

  let totalAttempts = 0;
  let totalHits = 0;
  const skillSummaries = [];

  for (const [name, data] of Object.entries(perf.skills)) {
    totalAttempts += data.attempts;
    totalHits += data.hits;
    const accuracy = data.attempts > 0
      ? Math.round((data.hits / data.attempts) * 100)
      : 0;
    const avgCents = data.attempts > 0
      ? Math.round(data.totalCentsOff / data.attempts)
      : null;
    skillSummaries.push({
      name,
      attempts: data.attempts,
      accuracy,
      avgCentsOff: avgCents,
      bestStreak: data.bestStreak,
    });
  }

  skillSummaries.sort((a, b) => a.accuracy - b.accuracy);

  return {
    totalAttempts,
    overallAccuracy: totalAttempts > 0
      ? Math.round((totalHits / totalAttempts) * 100)
      : 0,
    skills: skillSummaries,
    recentSessions: perf.sessions.slice(-5),
  };
}

/* ---------------------------------------------------------- */
/*  AI Tutor (Claude API)                                      */
/* ---------------------------------------------------------- */

/**
 * Check if a Claude API key is configured.
 *
 * @returns {boolean}
 */
export function isAIAvailable() {
  return typeof CLAUDE_API_KEY === "string" && CLAUDE_API_KEY.length > 0;
}

/**
 * Call the Claude API for post-session feedback.
 * Returns null gracefully if no API key is set or the request fails.
 *
 * @param {string} game        - Game identifier (e.g. "harmony-training")
 * @param {object} sessionData - Session summary (score, accuracy, skills, etc.)
 * @returns {Promise<string|null>} Encouraging feedback text, or null
 */
export async function getSessionFeedback(game, sessionData) {
  if (!isAIAvailable()) return null;

  const summary = getPerformanceSummary(game);

  const userMessage = [
    `Game: ${game}`,
    `This session: ${JSON.stringify(sessionData)}`,
    `Overall progress: ${JSON.stringify(summary)}`,
    "",
    "Give me encouraging feedback on my practice session!",
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system:
          "You are a friendly, encouraging music theory tutor for kids ages 8–12. " +
          "Give brief, positive feedback on their practice session. " +
          "Mention one specific strength and one area to keep working on. " +
          "Use simple, enthusiastic language. Keep it to 2–3 short sentences.",
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}
