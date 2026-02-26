// ============================================================
//  SkratchEditor — visual rules editor for mapping events → effects
//  shared/skratch/skratch-editor.js
// ============================================================

import { EFFECT_PRESETS } from './effects.js';

/** Human-friendly labels for effect presets. */
const EFFECT_LABELS = {
  bright_sparkles: 'Bright Sparkles',
  blue_rain: 'Blue Rain',
  fire_burst: 'Fire Burst',
  cool_mist: 'Cool Mist',
  confetti: 'Confetti',
  purple_galaxy: 'Purple Galaxy',
};

const NONE_VALUE = '__none__';

export class SkratchEditor {
  /**
   * @param {HTMLElement} container — element to render into
   * @param {Object<string, string>} rules — current rules { eventKey: effectKey }
   * @param {Function} onRulesChange — called with updated rules object
   */
  constructor(container, rules, onRulesChange) {
    this.container = container;
    this.rules = { ...rules };
    this.onRulesChange = onRulesChange;
    /** @type {{key:string, label:string, color?:string, icon?:string}[]} */
    this.eventDefinitions = [];
    /** @type {Function|null} set externally to allow preview */
    this.onPreview = null;

    this._el = document.createElement('div');
    this._el.className = 'skratch-editor card';
    container.appendChild(this._el);

    this._injectStyles();
  }

  /**
   * Set event definitions and render.
   * @param {{key:string, label:string, color?:string, icon?:string}[]} eventDefs
   */
  setEventDefinitions(eventDefs) {
    this.eventDefinitions = eventDefs;
    this._render();
  }

  /**
   * Update rules externally.
   * @param {Object<string, string>} rules
   */
  update(rules) {
    this.rules = { ...rules };
    this._render();
  }

  /** Build or rebuild the editor UI. */
  _render() {
    const el = this._el;
    el.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'skratch-editor__header';
    header.innerHTML = `<h3 class="card__title">Visual Effects</h3>
      <p class="card__description">Choose effects for game events</p>`;
    el.appendChild(header);

    // Rule rows
    const list = document.createElement('div');
    list.className = 'skratch-editor__list';

    for (const def of this.eventDefinitions) {
      const row = this._buildRow(def);
      list.appendChild(row);
    }
    el.appendChild(list);

    // Footer with Preview All button
    const footer = document.createElement('div');
    footer.className = 'skratch-editor__footer';
    const previewBtn = document.createElement('button');
    previewBtn.className = 'btn btn--secondary btn--small';
    previewBtn.textContent = 'Preview All';
    previewBtn.addEventListener('click', () => this._previewAll());
    footer.appendChild(previewBtn);
    el.appendChild(footer);
  }

  /**
   * Build a single rule row.
   * @param {{key:string, label:string, color?:string, icon?:string}} def
   * @returns {HTMLElement}
   */
  _buildRow(def) {
    const row = document.createElement('div');
    row.className = 'skratch-editor__row';

    // "WHEN" badge + event label
    const label = document.createElement('div');
    label.className = 'skratch-editor__label';
    const whenBadge = document.createElement('span');
    whenBadge.className = 'badge badge--primary';
    whenBadge.textContent = 'WHEN';
    label.appendChild(whenBadge);

    const eventText = document.createElement('span');
    eventText.className = 'skratch-editor__event';
    if (def.color) eventText.style.borderLeftColor = def.color;
    eventText.textContent = `${def.icon ? def.icon + ' ' : ''}${def.label}`;
    label.appendChild(eventText);
    row.appendChild(label);

    // Effect dropdown
    const selectWrap = document.createElement('div');
    selectWrap.className = 'form-group';
    const select = document.createElement('select');
    select.className = 'form-select skratch-editor__select';
    select.setAttribute('aria-label', `Effect for ${def.label}`);

    // "None" option
    const noneOpt = document.createElement('option');
    noneOpt.value = NONE_VALUE;
    noneOpt.textContent = '— None —';
    select.appendChild(noneOpt);

    for (const [key, lbl] of Object.entries(EFFECT_LABELS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = lbl;
      if (this.rules[def.key] === key) opt.selected = true;
      select.appendChild(opt);
    }
    if (!this.rules[def.key]) noneOpt.selected = true;

    select.addEventListener('change', () => {
      const val = select.value;
      if (val === NONE_VALUE) {
        delete this.rules[def.key];
      } else {
        this.rules[def.key] = val;
      }
      this.onRulesChange({ ...this.rules });
    });

    selectWrap.appendChild(select);
    row.appendChild(selectWrap);

    return row;
  }

  /** Fire a preview for each mapped effect. */
  _previewAll() {
    if (!this.onPreview) return;
    let delay = 0;
    for (const def of this.eventDefinitions) {
      const effect = this.rules[def.key];
      if (effect) {
        setTimeout(() => this.onPreview(effect), delay);
        delay += 300;
      }
    }
  }

  /** Inject component-scoped styles once. */
  _injectStyles() {
    if (document.getElementById('skratch-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'skratch-editor-styles';
    style.textContent = `
      .skratch-editor {
        max-width: 500px;
      }
      .skratch-editor__header {
        margin-bottom: var(--space-md);
      }
      .skratch-editor__list {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .skratch-editor__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background: var(--color-bg);
      }
      .skratch-editor__label {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        flex: 1;
        min-width: 0;
      }
      .skratch-editor__event {
        font-weight: var(--font-weight-medium);
        border-left: 3px solid var(--color-primary);
        padding-left: var(--space-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .skratch-editor__select {
        min-width: 150px;
      }
      .skratch-editor__footer {
        margin-top: var(--space-md);
        display: flex;
        justify-content: flex-end;
      }
    `;
    document.head.appendChild(style);
  }

  /** Remove the editor from the DOM. */
  destroy() {
    this._el.remove();
  }
}
