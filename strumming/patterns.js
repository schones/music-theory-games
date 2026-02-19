/**
 * Guitar Strumming Patterns — Pattern Data Module
 * strumming/patterns.js
 *
 * Defines strumming patterns as eighth-note grids (8 slots per measure of 4/4).
 * Each slot is either 'D' (downstroke), 'U' (upstroke), or '-' (rest/skip).
 *
 * Data model supports user-created custom patterns stored in localStorage.
 * Custom pattern UI is planned for a future task.
 */

/* ---------------------------------------------------------- */
/*  Built-in Patterns                                         */
/* ---------------------------------------------------------- */

/**
 * @typedef {Object} StrumPattern
 * @property {string}   id               - Unique identifier
 * @property {string}   name             - Display name
 * @property {string}   description      - Brief description for the UI
 * @property {string[]} grid             - 8-element array: 'D', 'U', or '-'
 * @property {number[]} suggestedBpmRange - [min, max] BPM for this pattern
 * @property {string}   tips             - Playing tips for the student
 * @property {boolean}  builtIn          - true for starter patterns, false for custom
 */

export const BUILT_IN_PATTERNS = [
  {
    id: "basic-44",
    name: "Basic 4/4 Downstrokes",
    description: "Simple quarter-note downstrokes — the foundation of all strumming.",
    grid: ["D", "-", "D", "-", "D", "-", "D", "-"],
    suggestedBpmRange: [60, 100],
    tips: "Keep your wrist loose and strum evenly on each beat. Count 1-2-3-4 in your head.",
    builtIn: true,
  },
  {
    id: "eighth-notes",
    name: "Eighth Notes",
    description: "Alternating down and up strums on every eighth note.",
    grid: ["D", "U", "D", "U", "D", "U", "D", "U"],
    suggestedBpmRange: [50, 90],
    tips: "Down on the beat, up on the 'and'. Keep your arm moving like a pendulum — even swing.",
    builtIn: true,
  },
  {
    id: "universal",
    name: "Universal Strum",
    description: "The most popular strumming pattern in pop and folk music.",
    grid: ["D", "-", "D", "U", "-", "U", "D", "U"],
    suggestedBpmRange: [70, 120],
    tips: "The secret: keep your hand moving down-up the whole time, but miss the strings on the rests.",
    builtIn: true,
  },
  {
    id: "rock",
    name: "Rock Strum",
    description: "A driving rock pattern with a syncopated accent.",
    grid: ["D", "-", "D", "U", "D", "-", "D", "U"],
    suggestedBpmRange: [80, 130],
    tips: "Accent the first downstroke of each group. The upstrokes should be lighter than the downs.",
    builtIn: true,
  },
  {
    id: "reggae-offbeat",
    name: "Reggae Offbeat",
    description: "Classic reggae skank — only upstrokes on the offbeats.",
    grid: ["-", "U", "-", "U", "-", "U", "-", "U"],
    suggestedBpmRange: [60, 100],
    tips: "Mute the strings briefly between each upstroke for that choppy reggae sound.",
    builtIn: true,
  },
];

/* ---------------------------------------------------------- */
/*  Custom Pattern Storage (localStorage)                     */
/* ---------------------------------------------------------- */

const CUSTOM_PATTERNS_KEY = "mtt_strumming_custom_patterns";

/**
 * Get all custom patterns from localStorage.
 *
 * @returns {StrumPattern[]}
 */
export function getCustomPatterns() {
  try {
    const raw = localStorage.getItem(CUSTOM_PATTERNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save a custom pattern to localStorage.
 *
 * @param {StrumPattern} pattern - Pattern to save (id will be auto-generated if missing)
 * @returns {StrumPattern} The saved pattern
 */
export function saveCustomPattern(pattern) {
  const patterns = getCustomPatterns();

  const toSave = {
    ...pattern,
    id: pattern.id || `custom-${Date.now()}`,
    builtIn: false,
  };

  // Replace if exists, otherwise add
  const existingIdx = patterns.findIndex((p) => p.id === toSave.id);
  if (existingIdx >= 0) {
    patterns[existingIdx] = toSave;
  } else {
    patterns.push(toSave);
  }

  try {
    localStorage.setItem(CUSTOM_PATTERNS_KEY, JSON.stringify(patterns));
  } catch {
    console.warn("[patterns] Failed to save custom pattern");
  }

  return toSave;
}

/**
 * Delete a custom pattern by id.
 *
 * @param {string} id - Pattern id to delete
 */
export function deleteCustomPattern(id) {
  const patterns = getCustomPatterns().filter((p) => p.id !== id);
  try {
    localStorage.setItem(CUSTOM_PATTERNS_KEY, JSON.stringify(patterns));
  } catch {
    // Ignore
  }
}

/**
 * Get all available patterns (built-in + custom).
 *
 * @returns {StrumPattern[]}
 */
export function getAllPatterns() {
  return [...BUILT_IN_PATTERNS, ...getCustomPatterns()];
}

/**
 * Find a pattern by id from all available patterns.
 *
 * @param {string} id - Pattern id
 * @returns {StrumPattern|null}
 */
export function getPatternById(id) {
  return getAllPatterns().find((p) => p.id === id) || null;
}

/**
 * Get the grid display string for a pattern (e.g. "D - D U - U D U").
 *
 * @param {string[]} grid - 8-element grid array
 * @returns {string}
 */
export function gridToString(grid) {
  return grid.join(" ");
}
