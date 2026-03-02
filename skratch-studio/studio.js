// studio.js — Main entry point for Skratch Studio

import { registerBlocks, getToolboxXml } from './blocks.js';
import { registerGenerators } from './generators.js';
import { registerMusicBlocks, getMusicToolboxXml } from './music-blocks.js';
import { registerMusicGenerators } from './music-generators.js';
import { MusicEngine } from './music-engine.js';
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

function multiStarter(...topBlocks) {
  return { blocks: { languageVersion: 0, blocks: topBlocks } };
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
  },

  // --- Music Starters (Part C) ---

  first_beat: {
    name: 'First Beat',
    json: starter({
      type: 'music_start', x: 20, y: 20,
      inputs: {
        DO: { block: chain(
          { type: 'set_tempo', fields: { BPM: 100 } },
          { type: 'play_kick', fields: { TIME: '0:0:0' } },
          { type: 'play_hihat', fields: { TIME: '0:0:2' } },
          { type: 'play_snare', fields: { TIME: '0:1:0' } },
          { type: 'play_hihat', fields: { TIME: '0:1:2' } },
          { type: 'play_kick', fields: { TIME: '0:2:0' } },
          { type: 'play_hihat', fields: { TIME: '0:2:2' } },
          { type: 'play_snare', fields: { TIME: '0:3:0' } },
          { type: 'play_hihat', fields: { TIME: '0:3:2' } }
        ) }
      }
    })
  },

  bass_groove: {
    name: 'Bass Groove',
    json: starter({
      type: 'music_start', x: 20, y: 20,
      inputs: {
        DO: { block: chain(
          { type: 'set_tempo', fields: { BPM: 110 } },
          { type: 'drum_pattern', fields: { PATTERN: 'rock' } },
          { type: 'play_bass_note', fields: { NOTE: 'C2', DURATION: '4n', TIME: '0:0:0' } },
          { type: 'play_bass_note', fields: { NOTE: 'C2', DURATION: '8n', TIME: '0:1:0' } },
          { type: 'play_bass_note', fields: { NOTE: 'E2', DURATION: '8n', TIME: '0:1:2' } },
          { type: 'play_bass_note', fields: { NOTE: 'G2', DURATION: '4n', TIME: '0:2:0' } },
          { type: 'play_bass_note', fields: { NOTE: 'F2', DURATION: '4n', TIME: '0:3:0' } }
        ) }
      }
    })
  },

  my_first_song: {
    name: 'My First Song',
    json: starter({
      type: 'music_start', x: 20, y: 20,
      inputs: {
        DO: { block: chain(
          { type: 'set_tempo', fields: { BPM: 120 } },
          {
            type: 'section', fields: { NAME: 'verse', MEASURES: '2' },
            inputs: { DO: { block: chain(
              { type: 'drum_pattern', fields: { PATTERN: 'rock' } },
              { type: 'play_bass_note', fields: { NOTE: 'C2', DURATION: '4n', TIME: '0:0:0' } },
              { type: 'play_bass_note', fields: { NOTE: 'G2', DURATION: '4n', TIME: '0:2:0' } },
              { type: 'play_melody_note', fields: { NOTE: 'E4', DURATION: '4n', TIME: '0:0:0' } },
              { type: 'play_melody_note', fields: { NOTE: 'D4', DURATION: '4n', TIME: '0:1:0' } },
              { type: 'play_melody_note', fields: { NOTE: 'C4', DURATION: '2n', TIME: '0:2:0' } }
            ) } }
          },
          {
            type: 'section', fields: { NAME: 'chorus', MEASURES: '2' },
            inputs: { DO: { block: chain(
              { type: 'drum_pattern', fields: { PATTERN: 'four' } },
              { type: 'play_chord', fields: { ROOT: 'C', QUALITY: 'major', DURATION: '2n', TIME: '0:0:0' } },
              { type: 'play_chord', fields: { ROOT: 'G', QUALITY: 'major', DURATION: '2n', TIME: '0:2:0' } },
              { type: 'play_melody_note', fields: { NOTE: 'G4', DURATION: '4n', TIME: '0:0:0' } },
              { type: 'play_melody_note', fields: { NOTE: 'A4', DURATION: '4n', TIME: '0:1:0' } },
              { type: 'play_melody_note', fields: { NOTE: 'G4', DURATION: '2n', TIME: '0:2:0' } }
            ) } }
          }
        ) }
      }
    })
  },

  beat_painter: {
    name: 'Beat Painter',
    json: multiStarter(
      {
        type: 'music_start', x: 20, y: 20,
        inputs: {
          DO: { block: chain(
            { type: 'set_tempo', fields: { BPM: 110 } },
            { type: 'drum_pattern', fields: { PATTERN: 'hiphop' } },
            { type: 'play_bass_note', fields: { NOTE: 'C2', DURATION: '4n', TIME: '0:0:0' } },
            { type: 'play_bass_note', fields: { NOTE: 'G2', DURATION: '4n', TIME: '0:2:0' } }
          ) }
        }
      },
      {
        type: 'when_start_clicked', x: 20, y: 340,
        inputs: {
          DO: { block: chain(
            { type: 'draw_trail' },
            { type: 'save_position' },
            { type: 'move_to_center' },
            { type: 'no_fill' },
            { type: 'set_stroke', fields: { COLOR: '#a29bfe' } },
            { type: 'set_stroke_weight', fields: { WEIGHT: 2 } },
            { type: 'draw_circle', fields: { X: 0, Y: 0, SIZE: 80 } },
            { type: 'restore_position' }
          ) }
        }
      },
      {
        type: 'every_n_beats', x: 20, y: 620,
        fields: { BEATS: 1 },
        inputs: {
          DO: { block: chain(
            { type: 'save_position' },
            { type: 'set_fill', fields: { COLOR: '#ff6b6b' } },
            { type: 'draw_circle', fields: { X: 200, Y: 200, SIZE: 30 } },
            { type: 'restore_position' }
          ) }
        }
      },
      {
        type: 'every_n_beats', x: 380, y: 20,
        fields: { BEATS: 2 },
        inputs: {
          DO: { block: chain(
            { type: 'save_position' },
            { type: 'set_fill', fields: { COLOR: '#00cec9' } },
            { type: 'draw_star', fields: { X: 200, Y: 200, SIZE: 60 } },
            { type: 'restore_position' }
          ) }
        }
      }
    )
  }
};

let workspace = null;
let sandbox = null;
let audioBridge = null;
let musicEngine = null;
let piano = null;
let _beatIndicatorTimeout = null;
let _highlightEnabled = false;
let _workspaceDirty = false;
let _isPlaying = false;

// Music blocks whose highlights should be scheduled on-beat via Tone.Transport
// rather than highlighted every frame in the visual sandbox loop
const BEAT_SYNCED_BLOCKS = new Set([
  'play_kick', 'play_snare', 'play_hihat', 'drum_pattern',
  'play_bass_note', 'bass_pattern',
  'play_melody_note', 'play_chord',
]);

export function init() {
  // Register custom blocks and generators (visual + music)
  registerBlocks();
  registerGenerators();
  registerMusicBlocks();
  registerMusicGenerators();

  // Build combined toolbox XML (visual categories + music categories)
  const combinedToolboxXml = buildCombinedToolbox();
  const toolboxContainer = document.createElement('div');
  toolboxContainer.innerHTML = combinedToolboxXml;
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

  // --- Music Engine ---
  musicEngine = new MusicEngine();

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

  // Piano keyboard — noteOn/noteOff for proper sustain support
  const pianoContainer = document.getElementById('pianoContainer');
  const sustainIndicator = document.getElementById('sustainIndicator');
  piano = new Piano(pianoContainer, {
    onNoteOn: (noteName) => audioBridge.noteOn(noteName),
    onNoteOff: (noteName) => audioBridge.noteOff(noteName),
    onSustainChange: (on) => {
      if (on) {
        audioBridge.sustainOn();
        sustainIndicator.hidden = false;
      } else {
        audioBridge.sustainOff();
        sustainIndicator.hidden = true;
      }
    },
  });

  // Sound selector
  const soundSelect = document.getElementById('soundSelect');
  soundSelect.addEventListener('change', () => {
    audioBridge.setSoundType(soundSelect.value);
  });

  // Clear Blocks button — clears only the Blockly workspace
  document.getElementById('btnClearBlocks').addEventListener('click', () => {
    if (!confirm('Are you sure? This will clear all blocks.')) return;
    workspace.clear();
    updateCodePreview();
    localStorage.removeItem(STORAGE_KEY);
  });

  // Clear Canvas button — resets canvas and stops audio/Transport
  document.getElementById('btnClearCanvas').addEventListener('click', () => {
    if (_isPlaying) handleStop();
    drawCanvasGrid(document.getElementById('skratchCanvas'));
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
        startPianoHighlight();
      } catch (e) {
        alert('Could not access microphone. Please allow mic access and try again.');
      }
    }
  });

  // BPM control — drives both sandbox beat timers and Tone.Transport
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmValue = document.getElementById('bpmValue');
  bpmSlider.addEventListener('input', () => {
    const bpm = parseInt(bpmSlider.value, 10);
    bpmValue.textContent = bpm;
    sandbox.setBpm(bpm);
    if (musicEngine._started) {
      musicEngine.setBpm(bpm);
    }
  });

  // Volume control
  const volumeSlider = document.getElementById('volumeSlider');
  if (volumeSlider) {
    const volumeValue = document.getElementById('volumeValue');
    volumeSlider.addEventListener('input', () => {
      const vol = parseInt(volumeSlider.value, 10);
      volumeValue.textContent = vol + '%';
      // Map 0-100 → -40dB to 0dB (logarithmic feel)
      const db = vol === 0 ? -Infinity : -40 + (vol / 100) * 40;
      musicEngine.setVolume(db);
    });
  }

  // Loop toggle — update Tone.Transport.loop live during playback
  document.getElementById('chkLoop').addEventListener('change', (e) => {
    if (_isPlaying && musicEngine._started) {
      const loop = e.target.checked;
      console.log('[Loop] Live toggle:', loop);
      musicEngine.setLoop(loop);
      if (loop) {
        // Wire up live editing reschedule + visual restart
        musicEngine.onLoopReschedule(() => {
          if (!_workspaceDirty) return;
          _workspaceDirty = false;
          console.log('[LiveEdit] Rescheduling — workspace changed');
          const newCode = generateCode();
          const newHasMusic = /\b(kick|snare|hihat|bass|melody|chords)\.(trigger|Tone\.Transport)/.test(newCode);
          musicEngine.clearScheduledEvents();
          if (newHasMusic) executeMusicCode(newCode);
          musicEngine.setLoop(true);
          sandbox.recompile(newCode);
        });
        musicEngine.onLoopRestart(() => {
          console.log('[Loop] Transport looped — restarting visual animation');
          sandbox.restartLoop();
        });
      } else {
        musicEngine.onLoopReschedule(null);
        musicEngine.onLoopRestart(null);
      }
    }
  });

  // Update code preview on workspace change + auto-save
  workspace.addChangeListener((e) => {
    if (e.isUiEvent) return;
    updateCodePreview();
    saveWorkspace();
    // Mark workspace dirty for live editing (changes applied at next loop)
    if (_isPlaying && document.getElementById('chkLoop').checked) {
      _workspaceDirty = true;
    }
  });

  // Load saved workspace or default starter
  if (!loadWorkspace()) {
    loadStarterProgram('circles');
  }

  // Initial code preview
  updateCodePreview();

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (musicEngine) musicEngine.destroy();
    if (audioBridge) audioBridge.destroy();
    if (piano) piano.destroy();
    if (sandbox) sandbox.destroy();
  });
}

function buildCombinedToolbox() {
  // Get the existing visual toolbox XML and inject music categories before closing </xml>
  const visualXml = getToolboxXml();
  const musicXml = getMusicToolboxXml();

  // Insert a separator and music categories before the closing </xml>
  return visualXml.replace(
    '</xml>',
    `  <sep gap="32"></sep>\n${musicXml}\n</xml>`
  );
}

async function handlePlay() {
  // Ensure Tone.js is started (requires user gesture)
  await musicEngine.ensureTone();

  // Clear previous note callbacks so re-play doesn't stack them
  audioBridge.clearNoteCallbacks();
  audioBridge.onNotePlayed(() => sandbox.fireNoteCallbacks());

  const code = generateCode();
  _workspaceDirty = false;
  _isPlaying = true;

  // Check if code contains music blocks (Tone.js instrument calls)
  const hasMusic = /\b(kick|snare|hihat|bass|melody|chords)\.(trigger|Tone\.Transport)/.test(code);

  // Set up block highlighting — visual blocks highlight every frame,
  // beat-synced music blocks are handled separately by executeMusicCode()
  _highlightEnabled = true;
  sandbox.setHighlightFn((id) => {
    if (!_highlightEnabled) return;
    const block = workspace.getBlockById(id);
    if (block && BEAT_SYNCED_BLOCKS.has(block.type)) return;
    workspace.highlightBlock(id);
  });

  // Always run visual sandbox (it handles visual-only code fine)
  sandbox.run(code);
  sandbox.startLoop();

  // If music code is present, schedule it via MusicEngine
  if (hasMusic) {
    musicEngine.stop(); // clear previous schedule
    const bpm = parseInt(document.getElementById('bpmSlider').value, 10);
    musicEngine.setBpm(bpm);

    // Execute the music code in a context where instrument names resolve to engine methods
    executeMusicCode(code);

    // Enable looping if the Loop checkbox is checked
    const loopEnabled = document.getElementById('chkLoop').checked;
    console.log('[Loop] Checkbox checked:', loopEnabled);
    // Always set loop boundaries so live toggling during playback works
    musicEngine.setLoop(loopEnabled);

    // Register synchronous reschedule handler — fires at the transport loop point
    // BEFORE the next iteration plays, so we can swap in updated code
    musicEngine.onLoopReschedule(() => {
      if (!_workspaceDirty) return;
      _workspaceDirty = false;
      console.log('[LiveEdit] Rescheduling — workspace changed');

      const newCode = generateCode();
      const newHasMusic = /\b(kick|snare|hihat|bass|melody|chords)\.(trigger|Tone\.Transport)/.test(newCode);

      // Clear all old scheduled music events and re-execute
      musicEngine.clearScheduledEvents();
      if (newHasMusic) {
        executeMusicCode(newCode);
      }

      // Update loop boundaries to match new code
      musicEngine.setLoop(true);

      // Hot-swap the visual sandbox code (rAF loop keeps running)
      sandbox.recompile(newCode);
    });

    // Register loop restart handler (resets visual animation on each loop)
    musicEngine.onLoopRestart(() => {
      console.log('[Loop] Transport looped — restarting visual animation');
      sandbox.restartLoop();
    });

    // Start beat indicator
    musicEngine.onBeat(() => flashBeatIndicator());
    musicEngine.startBeatLoop();

    musicEngine.start();
  }

  document.getElementById('btnPlay').disabled = true;
  document.getElementById('btnStop').disabled = false;
}

function executeMusicCode(code) {
  try {
    // Track current block ID so instrument proxies can schedule on-beat highlights
    let _currentMusicBlockId = null;
    const musicHighlight = (id) => {
      _currentMusicBlockId = id;
    };

    // Build proxy instruments that forward .triggerAttackRelease() to MusicEngine scheduling
    // and schedule block highlights to fire in sync with Tone.Transport
    const instrumentsProxy = {
      kick: {
        triggerAttackRelease(note, dur, time) {
          const blockId = _currentMusicBlockId;
          musicEngine.scheduleKick(time, note);
          scheduleMusicHighlight(blockId, time);
        }
      },
      snare: {
        triggerAttackRelease(dur, time) {
          const blockId = _currentMusicBlockId;
          musicEngine.scheduleSnare(time);
          scheduleMusicHighlight(blockId, time);
        }
      },
      hihat: {
        triggerAttackRelease(note, dur, time) {
          const blockId = _currentMusicBlockId;
          musicEngine.scheduleHihat(time);
          scheduleMusicHighlight(blockId, time);
        }
      },
      bass: {
        triggerAttackRelease(note, dur, time) {
          const blockId = _currentMusicBlockId;
          musicEngine.scheduleBass(note, dur, time);
          scheduleMusicHighlight(blockId, time);
        }
      },
      melody: {
        triggerAttackRelease(note, dur, time) {
          const blockId = _currentMusicBlockId;
          musicEngine.scheduleMelody(note, dur, time);
          scheduleMusicHighlight(blockId, time);
        }
      },
      chords: {
        triggerAttackRelease(notes, dur, time) {
          const blockId = _currentMusicBlockId;
          musicEngine.scheduleChord(notes, dur, time);
          scheduleMusicHighlight(blockId, time);
        }
      },
    };

    // Tone proxy for set_tempo blocks — syncs MusicEngine + UI slider
    const ToneProxy = {
      Transport: {
        bpm: {
          set value(v) {
            musicEngine.setBpm(v);
            const slider = document.getElementById('bpmSlider');
            const display = document.getElementById('bpmValue');
            if (slider) slider.value = v;
            if (display) display.textContent = v;
          },
          get value() { return musicEngine.getBpm(); }
        }
      }
    };

    // The generated code declares `const kick = _instruments.kick;` etc.
    // so we pass the proxy object as `_instruments` and Tone for tempo.
    // Visual params are no-ops so mixed visual+music code doesn't error.
    const noop = () => {};
    const fn = new Function(
      '_instruments', 'Tone',
      'circle', 'rect', 'ellipse', 'triangle', 'line', 'star',
      'fill', 'stroke', 'noFill', 'noStroke', 'strokeWeight', 'background',
      'push', 'pop', 'translate', 'rotate', 'scale',
      'map', 'lerp', 'random', 'constrain', 'dist',
      'width', 'height', 'frameCount', 'mouseX', 'mouseY',
      'Math', 'PI',
      'currentPitch', 'currentNoteName', 'currentVolume', 'noteIsPlaying',
      'onNotePlayed', 'everyNBeats',
      'highlightBlock',
      code
    );

    fn(
      instrumentsProxy, ToneProxy,
      noop, noop, noop, noop, noop, noop,
      noop, noop, noop, noop, noop, noop,
      noop, noop, noop, noop, noop,
      noop, noop, noop, noop, noop,
      400, 400, 0, 0, 0,
      Math, Math.PI,
      0, '--', 0, false,
      noop, noop,
      musicHighlight
    );
  } catch (e) {
    // Music code errors shown in error bar
    const errorEl = document.getElementById('errorBar');
    if (errorEl) {
      errorEl.textContent = 'Music Error: ' + e.message;
      errorEl.hidden = false;
    }
  }
}

function scheduleMusicHighlight(blockId, time) {
  if (!blockId) return;
  const id = Tone.Transport.schedule((t) => {
    Tone.Draw.schedule(() => {
      if (_highlightEnabled) {
        workspace.highlightBlock(blockId);
      }
    }, t);
  }, time);
  // Track so clearScheduledEvents() also clears stale highlights
  musicEngine._scheduledIds.push(id);
}

function handleStop() {
  _highlightEnabled = false;
  _isPlaying = false;
  _workspaceDirty = false;
  sandbox.stop();
  musicEngine.stop();

  // Clear all block highlights
  workspace.highlightBlock(null);

  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnStop').disabled = true;

  // Clear beat indicator
  const indicator = document.getElementById('beatIndicator');
  if (indicator) indicator.classList.remove('flash');

  // Redraw grid background
  drawCanvasGrid(document.getElementById('skratchCanvas'));
}

function flashBeatIndicator() {
  const indicator = document.getElementById('beatIndicator');
  if (!indicator) return;
  indicator.classList.remove('flash');
  // Force reflow to restart animation
  void indicator.offsetWidth;
  indicator.classList.add('flash');
}

function generateCode() {
  const code = Blockly.JavaScript.workspaceToCode(workspace);
  return code;
}

function updateCodePreview() {
  let code = generateCode();
  // Strip highlightBlock() calls from preview so generated code stays clean
  code = code.replace(/highlightBlock\('[^']*'\);\n/g, '');
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
  const s = STARTERS[key];
  if (!s) return;
  workspace.clear();
  Blockly.serialization.workspaces.load(s.json, workspace);
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
