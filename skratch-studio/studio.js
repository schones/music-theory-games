// studio.js — Main entry point for Skratch Studio

import { registerBlocks, getToolboxXml } from './blocks.js';
import { registerGenerators } from './generators.js';
import { Sandbox } from './sandbox.js';
import { AudioBridge } from './audio-bridge.js';
import { Piano } from './piano.js';

const STORAGE_KEY = 'skratch-studio-workspace';

// --- Helper: build a chain of next-linked blocks for JSON serialization ---
function chain(...blocks) {
  if (blocks.length === 0) return undefined;
  const result = { ...blocks[0] };
  let current = result;
  for (let i = 1; i < blocks.length; i++) {
    current.next = { block: { ...blocks[i] } };
    current = current.next.block;
  }
  return result;
}

function starter(topBlock) {
  return { blocks: { languageVersion: 0, blocks: topBlock ? [topBlock] : [] } };
}

// --- Starter Programs (Blockly JSON serialization) ---
const STARTERS = {
  blank: {
    name: 'Blank Canvas',
    json: starter(null)
  },

  circles: {
    name: 'Circles',
    json: starter(chain(
      { type: 'set_background', x: 20, y: 20, fields: { COLOR: '#1e1e2e' } },
      { type: 'save_position' },
      { type: 'move_to_center' },
      { type: 'no_fill' },
      { type: 'set_stroke', fields: { COLOR: '#a29bfe' } },
      { type: 'set_stroke_weight', fields: { WEIGHT: 2 } },
      {
        type: 'repeat_times', fields: { TIMES: 6 },
        inputs: { DO: { block: chain(
          { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 50 } },
          { type: 'grow_by', fields: { PERCENT: 30 } }
        ) } }
      },
      { type: 'restore_position' }
    ))
  },

  rainbow: {
    name: 'Rainbow Grid',
    json: starter(chain(
      { type: 'set_background', x: 20, y: 20, fields: { COLOR: '#1e1e2e' } },
      { type: 'save_position' },
      { type: 'no_fill' },
      { type: 'set_stroke', fields: { COLOR: '#ff6600' } },
      { type: 'set_stroke_weight', fields: { WEIGHT: 2 } },
      {
        type: 'repeat_times', fields: { TIMES: 8 },
        inputs: { DO: { block: chain(
          { type: 'save_position' },
          {
            type: 'repeat_times', fields: { TIMES: 8 },
            inputs: { DO: { block: chain(
              { type: 'draw_rect', fields: { X: 0, Y: 0, W: 40, H: 40 } },
              { type: 'move_to', fields: { X: 50, Y: 0 } }
            ) } }
          },
          { type: 'restore_position' },
          { type: 'move_to', fields: { X: 0, Y: 50 } }
        ) } }
      },
      { type: 'restore_position' }
    ))
  },

  spiral: {
    name: 'Spiral',
    json: starter(chain(
      { type: 'set_background', x: 20, y: 20, fields: { COLOR: '#1e1e2e' } },
      { type: 'save_position' },
      { type: 'move_to_center' },
      { type: 'set_stroke', fields: { COLOR: '#00cec9' } },
      { type: 'no_fill' },
      { type: 'set_stroke_weight', fields: { WEIGHT: 2 } },
      {
        type: 'repeat_times', fields: { TIMES: 36 },
        inputs: { DO: { block: chain(
          { type: 'draw_circle', fields: { X: 60, Y: 0, SIZE: 30 } },
          { type: 'rotate_by', fields: { ANGLE: 10 } },
          { type: 'grow_by', fields: { PERCENT: 3 } }
        ) } }
      },
      { type: 'restore_position' }
    ))
  },

  sound_circles: {
    name: 'Sound Circles',
    json: starter(chain(
      { type: 'set_background', x: 20, y: 20, fields: { COLOR: '#1e1e2e' } },
      { type: 'save_position' },
      { type: 'move_to_center' },
      { type: 'no_fill' },
      { type: 'set_stroke', fields: { COLOR: '#a29bfe' } },
      { type: 'set_stroke_weight', fields: { WEIGHT: 2 } },
      {
        type: 'simple_if',
        inputs: {
          CONDITION: { block: { type: 'note_is_playing' } },
          DO: { block: chain(
            { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 150 } },
            { type: 'set_stroke', fields: { COLOR: '#00cec9' } },
            { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 100 } },
            { type: 'set_stroke', fields: { COLOR: '#ff6600' } },
            { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 50 } }
          ) }
        }
      },
      { type: 'restore_position' }
    ))
  },

  note_garden: {
    name: 'Note Garden',
    json: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'when_start_clicked', x: 20, y: 20,
            inputs: {
              DO: { block: { type: 'draw_trail' } }
            }
          },
          {
            type: 'when_specific_note', x: 20, y: 140,
            fields: { NOTE: 'C' },
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to', fields: { X: 80, Y: 100 } },
                { type: 'set_fill', fields: { COLOR: '#ff6b6b' } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 50 } },
                { type: 'restore_position' }
              ) }
            }
          },
          {
            type: 'when_specific_note', x: 20, y: 340,
            fields: { NOTE: 'D' },
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to', fields: { X: 280, Y: 70 } },
                { type: 'set_fill', fields: { COLOR: '#ffa502' } },
                { type: 'draw_star', fields: { X: 0, Y: 0, SIZE: 25 } },
                { type: 'restore_position' }
              ) }
            }
          },
          {
            type: 'when_specific_note', x: 20, y: 540,
            fields: { NOTE: 'E' },
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to', fields: { X: 180, Y: 200 } },
                { type: 'set_fill', fields: { COLOR: '#ffd93d' } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 40 } },
                { type: 'restore_position' }
              ) }
            }
          },
          {
            type: 'when_specific_note', x: 20, y: 740,
            fields: { NOTE: 'F' },
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to', fields: { X: 60, Y: 280 } },
                { type: 'set_fill', fields: { COLOR: '#2ed573' } },
                { type: 'draw_star', fields: { X: 0, Y: 0, SIZE: 30 } },
                { type: 'restore_position' }
              ) }
            }
          },
          {
            type: 'when_specific_note', x: 380, y: 20,
            fields: { NOTE: 'G' },
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to', fields: { X: 320, Y: 220 } },
                { type: 'set_fill', fields: { COLOR: '#00cec9' } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 45 } },
                { type: 'restore_position' }
              ) }
            }
          },
          {
            type: 'when_specific_note', x: 380, y: 220,
            fields: { NOTE: 'A' },
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to', fields: { X: 140, Y: 340 } },
                { type: 'set_fill', fields: { COLOR: '#a29bfe' } },
                { type: 'draw_star', fields: { X: 0, Y: 0, SIZE: 25 } },
                { type: 'restore_position' }
              ) }
            }
          },
          {
            type: 'when_specific_note', x: 380, y: 420,
            fields: { NOTE: 'B' },
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to', fields: { X: 300, Y: 340 } },
                { type: 'set_fill', fields: { COLOR: '#fd79a8' } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 35 } },
                { type: 'restore_position' }
              ) }
            }
          }
        ]
      }
    }
  },

  bounce: {
    name: 'Bounce',
    json: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'when_start_clicked', x: 20, y: 20,
            inputs: {
              DO: { block: chain(
                { type: 'draw_trail' },
                { type: 'save_position' },
                { type: 'move_to_center' },
                { type: 'set_fill', fields: { COLOR: '#a29bfe' } },
                {
                  type: 'simple_if',
                  inputs: {
                    CONDITION: { block: { type: 'note_is_playing' } },
                    DO: { block: { type: 'set_fill', fields: { COLOR: '#ff6b6b' } } }
                  }
                },
                { type: 'set_stroke', fields: { COLOR: '#ffffff' } },
                { type: 'set_stroke_weight', fields: { WEIGHT: 2 } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 60 } },
                { type: 'restore_position' }
              ) }
            }
          },
          {
            type: 'when_note_played', x: 20, y: 420,
            inputs: {
              DO: { block: chain(
                { type: 'save_position' },
                { type: 'move_to_center' },
                { type: 'no_fill' },
                { type: 'set_stroke', fields: { COLOR: '#ff6b6b' } },
                { type: 'set_stroke_weight', fields: { WEIGHT: 3 } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 120 } },
                { type: 'set_stroke', fields: { COLOR: '#ffd93d' } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 180 } },
                { type: 'set_stroke', fields: { COLOR: '#00cec9' } },
                { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 240 } },
                { type: 'restore_position' }
              ) }
            }
          }
        ]
      }
    }
  }
};

let workspace = null;
let sandbox = null;
let audioBridge = null;
let piano = null;

export function init() {
  // Register custom blocks and generators
  registerBlocks();
  registerGenerators();

  // Inject toolbox XML into document
  const toolboxContainer = document.createElement('div');
  toolboxContainer.innerHTML = getToolboxXml();
  document.body.appendChild(toolboxContainer);

  // Create Blockly workspace with dark theme
  const darkTheme = Blockly.Theme.defineTheme('skratchDark', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#1e1e2e',
      toolboxBackgroundColour: '#181825',
      toolboxForegroundColour: '#cdd6f4',
      flyoutBackgroundColour: '#1e1e2e',
      flyoutForegroundColour: '#cdd6f4',
      flyoutOpacity: 0.95,
      scrollbarColour: '#45475a',
      insertionMarkerColour: '#cdd6f4',
      insertionMarkerOpacity: 0.3,
      scrollbarOpacity: 0.5,
      cursorColour: '#f5e0dc'
    },
    fontStyle: {
      family: 'system-ui, -apple-system, sans-serif',
      size: 12
    }
  });

  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    theme: darkTheme,
    grid: {
      spacing: 25,
      length: 3,
      colour: '#313244',
      snap: true
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.9,
      maxScale: 2,
      minScale: 0.3,
      scaleSpeed: 1.1
    },
    trashcan: true,
    sounds: false,
    renderer: 'zelos'
  });

  // Set up canvas and sandbox
  const canvas = document.getElementById('skratchCanvas');
  canvas.width = 400;
  canvas.height = 400;
  const errorEl = document.getElementById('errorBar');
  sandbox = new Sandbox(canvas, errorEl);

  // Draw initial grid background
  drawCanvasGrid(canvas);

  // --- Event Bindings ---
  document.getElementById('btnPlay').addEventListener('click', handlePlay);
  document.getElementById('btnStop').addEventListener('click', handleStop);

  // Code preview toggle
  const previewHeader = document.getElementById('codePreviewHeader');
  previewHeader.addEventListener('click', toggleCodePreview);

  // Copy button
  document.getElementById('btnCopy').addEventListener('click', handleCopy);

  // Starter program dropdown
  const starterSelect = document.getElementById('starterSelect');
  starterSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (key && STARTERS[key]) {
      loadStarterProgram(key);
      e.target.value = '';
    }
  });

  // --- Audio Integration ---
  audioBridge = new AudioBridge();

  // Connect audio state to sandbox so generated code can read pitch/volume
  sandbox.setAudioState(audioBridge.state);

  // When AudioBridge fires note callbacks, forward to sandbox's registered callbacks
  audioBridge.onNotePlayed(() => sandbox.fireNoteCallbacks());

  // Piano keyboard — clicking a key plays a note through the bridge
  const pianoContainer = document.getElementById('pianoContainer');
  piano = new Piano(pianoContainer, (noteName) => {
    audioBridge.playNote(noteName);
  });

  // Mic toggle
  const btnMic = document.getElementById('btnMic');
  btnMic.addEventListener('click', async () => {
    if (audioBridge._micActive) {
      audioBridge.stopMic();
      btnMic.textContent = '\u{1F3A4} Mic Off';
      btnMic.classList.remove('active');
    } else {
      try {
        await audioBridge.startMic();
        btnMic.textContent = '\u{1F3A4} Mic On';
        btnMic.classList.add('active');
        // Highlight piano keys from mic detection
        startPianoHighlight();
      } catch (e) {
        alert('Could not access microphone. Please allow mic access and try again.');
      }
    }
  });

  // BPM control
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmValue = document.getElementById('bpmValue');
  bpmSlider.addEventListener('input', () => {
    const bpm = parseInt(bpmSlider.value, 10);
    bpmValue.textContent = bpm;
    sandbox.setBpm(bpm);
  });

  // Update code preview on workspace change + auto-save
  workspace.addChangeListener((e) => {
    if (e.isUiEvent) return;
    updateCodePreview();
    saveWorkspace();
  });

  // Load saved workspace or default starter
  if (!loadWorkspace()) {
    loadStarterProgram('circles');
  }

  // Initial code preview
  updateCodePreview();

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (audioBridge) audioBridge.destroy();
    if (piano) piano.destroy();
    if (sandbox) sandbox.destroy();
  });
}

function handlePlay() {
  // Clear previous note callbacks so re-play doesn't stack them
  audioBridge.clearNoteCallbacks();
  audioBridge.onNotePlayed(() => sandbox.fireNoteCallbacks());

  const code = generateCode();
  sandbox.run(code);
  sandbox.startLoop();

  document.getElementById('btnPlay').disabled = true;
  document.getElementById('btnStop').disabled = false;
}

function handleStop() {
  sandbox.stop();
  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnStop').disabled = true;

  // Redraw grid background
  drawCanvasGrid(document.getElementById('skratchCanvas'));
}

function generateCode() {
  const code = Blockly.JavaScript.workspaceToCode(workspace);
  return code;
}

function updateCodePreview() {
  const code = generateCode();
  document.getElementById('codePreviewContent').textContent = code || '// Drag blocks to start coding!';
}

function toggleCodePreview() {
  const body = document.getElementById('codePreviewBody');
  const toggle = document.getElementById('codePreviewToggle');
  body.classList.toggle('collapsed');
  toggle.classList.toggle('open');
}

function handleCopy() {
  const code = document.getElementById('codePreviewContent').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('btnCopy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}

function loadStarterProgram(key) {
  const starter = STARTERS[key];
  if (!starter) return;
  workspace.clear();
  Blockly.serialization.workspaces.load(starter.json, workspace);
  workspace.scrollCenter();
  updateCodePreview();
}

function saveWorkspace() {
  try {
    const state = Blockly.serialization.workspaces.save(workspace);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage might be unavailable
  }
}

function loadWorkspace() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const state = JSON.parse(saved);
    if (!state || typeof state !== 'object') return false;
    workspace.clear();
    Blockly.serialization.workspaces.load(state, workspace);
    return true;
  } catch (e) {
    // Clear invalid saved data (e.g. old XML format)
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

let _pianoHighlightId = null;

function startPianoHighlight() {
  // Already running
  if (_pianoHighlightId) return;

  const tick = () => {
    if (!audioBridge._micActive) {
      _pianoHighlightId = null;
      piano.highlightNote(null);
      return;
    }
    piano.highlightNote(audioBridge.state.currentNoteName);
    _pianoHighlightId = requestAnimationFrame(tick);
  };
  _pianoHighlightId = requestAnimationFrame(tick);
}

function drawCanvasGrid(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2a2a3e';
  for (let x = 0; x < canvas.width; x += 20) {
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
