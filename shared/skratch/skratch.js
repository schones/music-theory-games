// ============================================================
//  Skratch — main entry point wiring visual canvas + editor
//  shared/skratch/skratch.js
// ============================================================

import { VisualCanvas } from './visual-canvas.js';
import { SkratchEditor } from './skratch-editor.js';

const STORAGE_KEY = 'skratch-rules';

/**
 * Load rules from localStorage, falling back to defaults.
 * @param {Object<string, string>} defaultRules
 * @returns {Object<string, string>}
 */
function loadRules(defaultRules) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { ...defaultRules };
}

/**
 * Persist rules to localStorage.
 * @param {Object<string, string>} rules
 */
function saveRules(rules) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch { /* ignore */ }
}

/**
 * Create a Skratch visual effects instance.
 *
 * @param {HTMLElement} container — element to overlay with particle canvas
 * @param {{key:string, label:string, color?:string, icon?:string}[]} eventDefinitions
 * @param {Object<string, string>} defaultRules — fallback { eventKey: effectPresetKey }
 * @returns {{ trigger, showEditor, hideEditor, destroy }}
 */
export function createSkratch(container, eventDefinitions, defaultRules = {}) {
  const canvas = new VisualCanvas(container);
  let rules = loadRules(defaultRules);
  /** @type {SkratchEditor|null} */
  let editor = null;

  function onRulesChange(newRules) {
    rules = newRules;
    saveRules(rules);
    if (editor) editor.update(rules);
  }

  return {
    /**
     * Fire the effect mapped to the given event name.
     * @param {string} eventName — event key from eventDefinitions
     * @param {number} [x] — spawn x (defaults to center)
     * @param {number} [y] — spawn y (defaults to center)
     */
    trigger(eventName, x, y) {
      const effectKey = rules[eventName];
      if (!effectKey) return;
      const cx = x ?? canvas.width / 2;
      const cy = y ?? canvas.height / 2;
      canvas.spawnEffect(effectKey, cx, cy);
    },

    /**
     * Render the rules editor into the given element.
     * @param {HTMLElement} editorContainer
     */
    showEditor(editorContainer) {
      if (editor) editor.destroy();
      editor = new SkratchEditor(editorContainer, rules, onRulesChange);
      editor.setEventDefinitions(eventDefinitions);
      // Wire up preview to fire effects on the canvas
      editor.onPreview = (effectKey) => {
        canvas.spawnEffect(effectKey, canvas.width / 2, canvas.height / 2);
      };
    },

    /** Remove the editor (canvas stays active). */
    hideEditor() {
      if (editor) {
        editor.destroy();
        editor = null;
      }
    },

    /** Tear down everything. */
    destroy() {
      if (editor) editor.destroy();
      canvas.destroy();
      editor = null;
    },
  };
}
