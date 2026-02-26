// ============================================================
//  Effect Presets — predefined particle effect configurations
//  shared/skratch/effects.js
// ============================================================

/**
 * Each preset defines:
 *   colors   — array of CSS color strings (randomly picked per particle)
 *   config   — base particle config merged with spawn-time overrides
 *   count    — number of particles to emit
 *   burst    — true = burst from (x, y); false = spawn across container width
 */
export const EFFECT_PRESETS = {

  bright_sparkles: {
    colors: ['#FFD700', '#FFA500', '#FFEC8B', '#FFD700', '#FF8C00'],
    config: {
      shape: 'star',
      size: [4, 9],
      life: [0.6, 1.2],
      speed: [80, 200],
      gravity: 30,
      rotationSpeed: [-4, 4],
      glowSize: 12,
      wobbleAmp: 0,
      wobbleFreq: 0,
    },
    count: 28,
    burst: true,
  },

  blue_rain: {
    colors: ['#74b9ff', '#0984e3', '#a29bfe', '#81ecec', '#00cec9'],
    config: {
      shape: 'drop',
      size: [3, 7],
      life: [1.0, 2.0],
      speed: [40, 100],
      gravity: 60,
      rotationSpeed: 0,
      glowSize: 8,
      wobbleAmp: 20,
      wobbleFreq: 2,
    },
    count: 32,
    burst: false,
  },

  fire_burst: {
    colors: ['#d63031', '#e17055', '#fdcb6e', '#FF4500', '#FF6347'],
    config: {
      shape: 'circle',
      size: [3, 8],
      life: [0.3, 0.7],
      speed: [120, 280],
      gravity: 40,
      rotationSpeed: 0,
      glowSize: 14,
      wobbleAmp: 0,
      wobbleFreq: 0,
    },
    count: 36,
    burst: true,
  },

  cool_mist: {
    colors: ['#81ecec', '#00cec9', '#74b9ff', '#a29bfe', '#55efc4'],
    config: {
      shape: 'circle',
      size: [4, 10],
      life: [1.5, 3.0],
      speed: [20, 60],
      gravity: -20,
      rotationSpeed: 0,
      glowSize: 16,
      wobbleAmp: 30,
      wobbleFreq: 1.5,
    },
    count: 24,
    burst: false,
  },

  confetti: {
    colors: ['#6c5ce7', '#00b894', '#fdcb6e', '#d63031', '#0984e3', '#e17055'],
    config: {
      shape: 'diamond',
      size: [4, 8],
      life: [0.8, 1.6],
      speed: [100, 220],
      gravity: 120,
      rotationSpeed: [-6, 6],
      glowSize: 4,
      wobbleAmp: 15,
      wobbleFreq: 3,
    },
    count: 40,
    burst: true,
  },

  purple_galaxy: {
    colors: ['#6c5ce7', '#a29bfe', '#dfe6e9', '#ffffff', '#fd79a8'],
    config: {
      shape: 'star',
      size: [3, 7],
      life: [1.5, 3.0],
      speed: [10, 40],
      gravity: 0,
      rotationSpeed: [-2, 2],
      glowSize: 10,
      wobbleAmp: 10,
      wobbleFreq: 0.8,
    },
    count: 30,
    burst: false,
  },
};
