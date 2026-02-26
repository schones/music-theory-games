// blocks.js — Custom Blockly block definitions for Skratch Studio

export function registerBlocks() {

  // Resolve FieldColour: removed from Blockly core in v12, now in @blockly/field-colour plugin.
  // Plugin UMD sets globalThis.FieldColour; also check Blockly.FieldColour (v10) and field registry.
  const FieldColour = Blockly.FieldColour
    || globalThis.FieldColour
    || Blockly.fieldRegistry?.getClass?.('field_colour')
    || Blockly.FieldTextInput;

  // ===================== VISUALS (purple, hue 270) =====================

  Blockly.Blocks['draw_circle'] = {
    init() {
      this.appendDummyInput()
        .appendField('draw circle at x')
        .appendField(new Blockly.FieldNumber(200, 0, 800), 'X')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(200, 0, 800), 'Y')
        .appendField('size')
        .appendField(new Blockly.FieldNumber(100, 1, 800), 'SIZE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Draw a circle at x, y with a diameter');
    }
  };

  Blockly.Blocks['draw_rect'] = {
    init() {
      this.appendDummyInput()
        .appendField('draw rectangle at x')
        .appendField(new Blockly.FieldNumber(100, 0, 800), 'X')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(100, 0, 800), 'Y')
        .appendField('width')
        .appendField(new Blockly.FieldNumber(100, 1, 800), 'W')
        .appendField('height')
        .appendField(new Blockly.FieldNumber(80, 1, 800), 'H');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Draw a rectangle');
    }
  };

  Blockly.Blocks['draw_star'] = {
    init() {
      this.appendDummyInput()
        .appendField('draw star at x')
        .appendField(new Blockly.FieldNumber(200, 0, 800), 'X')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(200, 0, 800), 'Y')
        .appendField('size')
        .appendField(new Blockly.FieldNumber(60, 1, 400), 'SIZE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Draw a 5-pointed star');
    }
  };

  Blockly.Blocks['draw_line'] = {
    init() {
      this.appendDummyInput()
        .appendField('draw line from x')
        .appendField(new Blockly.FieldNumber(0, 0, 800), 'X1')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(0, 0, 800), 'Y1')
        .appendField('to x')
        .appendField(new Blockly.FieldNumber(400, 0, 800), 'X2')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(400, 0, 800), 'Y2');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Draw a line between two points');
    }
  };

  Blockly.Blocks['set_fill'] = {
    init() {
      this.appendDummyInput()
        .appendField('set fill color to')
        .appendField(new FieldColour('#ff6600'), 'COLOR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Set the fill color for shapes');
    }
  };

  Blockly.Blocks['set_stroke'] = {
    init() {
      this.appendDummyInput()
        .appendField('set stroke color to')
        .appendField(new FieldColour('#ffffff'), 'COLOR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Set the outline color for shapes');
    }
  };

  Blockly.Blocks['no_fill'] = {
    init() {
      this.appendDummyInput().appendField('no fill');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Disable fill — shapes will be outlines only');
    }
  };

  Blockly.Blocks['set_stroke_weight'] = {
    init() {
      this.appendDummyInput()
        .appendField('set stroke width to')
        .appendField(new Blockly.FieldNumber(2, 0, 50), 'WEIGHT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Set the thickness of outlines');
    }
  };

  Blockly.Blocks['clear_canvas'] = {
    init() {
      this.appendDummyInput().appendField('clear canvas');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Clear everything on the canvas');
    }
  };

  Blockly.Blocks['set_background'] = {
    init() {
      this.appendDummyInput()
        .appendField('set background to')
        .appendField(new FieldColour('#1e1e2e'), 'COLOR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Fill the whole canvas with a color');
    }
  };

  Blockly.Blocks['draw_trail'] = {
    init() {
      this.appendDummyInput().appendField('draw trail');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(270);
      this.setTooltip('Leave a fading trail instead of clearing the canvas');
    }
  };

  // ===================== MOTION (blue, hue 210) =====================

  Blockly.Blocks['move_to'] = {
    init() {
      this.appendDummyInput()
        .appendField('move to x')
        .appendField(new Blockly.FieldNumber(0, -800, 800), 'X')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(0, -800, 800), 'Y');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Move the drawing position');
    }
  };

  Blockly.Blocks['move_to_center'] = {
    init() {
      this.appendDummyInput().appendField('move to center');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Move to the center of the canvas');
    }
  };

  Blockly.Blocks['rotate_by'] = {
    init() {
      this.appendDummyInput()
        .appendField('rotate')
        .appendField(new Blockly.FieldNumber(45, -360, 360), 'ANGLE')
        .appendField('degrees');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Rotate the canvas by an angle in degrees');
    }
  };

  Blockly.Blocks['grow_by'] = {
    init() {
      this.appendDummyInput()
        .appendField('grow by')
        .appendField(new Blockly.FieldNumber(10, -200, 500), 'PERCENT')
        .appendField('%');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Make shapes bigger by a percentage');
    }
  };

  Blockly.Blocks['shrink_by'] = {
    init() {
      this.appendDummyInput()
        .appendField('shrink by')
        .appendField(new Blockly.FieldNumber(10, 0, 99), 'PERCENT')
        .appendField('%');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Make shapes smaller by a percentage');
    }
  };

  Blockly.Blocks['save_position'] = {
    init() {
      this.appendDummyInput().appendField('save position');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Save the current drawing position and style');
    }
  };

  Blockly.Blocks['restore_position'] = {
    init() {
      this.appendDummyInput().appendField('restore position');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Go back to the last saved position and style');
    }
  };

  // ===================== MATH (green, hue 120) =====================

  Blockly.Blocks['map_value'] = {
    init() {
      this.appendDummyInput()
        .appendField('map')
        .appendField(new Blockly.FieldNumber(50), 'VALUE')
        .appendField('from')
        .appendField(new Blockly.FieldNumber(0), 'FROM_LOW')
        .appendField('-')
        .appendField(new Blockly.FieldNumber(100), 'FROM_HIGH')
        .appendField('to')
        .appendField(new Blockly.FieldNumber(0), 'TO_LOW')
        .appendField('-')
        .appendField(new Blockly.FieldNumber(400), 'TO_HIGH');
      this.setOutput(true, 'Number');
      this.setColour(120);
      this.setTooltip('Scale a number from one range to another');
    }
  };

  Blockly.Blocks['random_number'] = {
    init() {
      this.appendDummyInput()
        .appendField('random from')
        .appendField(new Blockly.FieldNumber(0), 'MIN')
        .appendField('to')
        .appendField(new Blockly.FieldNumber(400), 'MAX');
      this.setOutput(true, 'Number');
      this.setColour(120);
      this.setTooltip('Pick a random number in a range');
    }
  };

  Blockly.Blocks['canvas_width'] = {
    init() {
      this.appendDummyInput().appendField('canvas width');
      this.setOutput(true, 'Number');
      this.setColour(120);
      this.setTooltip('The width of the canvas in pixels');
    }
  };

  Blockly.Blocks['canvas_height'] = {
    init() {
      this.appendDummyInput().appendField('canvas height');
      this.setOutput(true, 'Number');
      this.setColour(120);
      this.setTooltip('The height of the canvas in pixels');
    }
  };

  Blockly.Blocks['frame_count'] = {
    init() {
      this.appendDummyInput().appendField('frame count');
      this.setOutput(true, 'Number');
      this.setColour(120);
      this.setTooltip('How many frames have been drawn (goes up over time)');
    }
  };

  // ===================== CONTROL (orange, hue 30) =====================

  Blockly.Blocks['repeat_times'] = {
    init() {
      this.appendDummyInput()
        .appendField('repeat')
        .appendField(new Blockly.FieldNumber(10, 1, 1000, 1), 'TIMES')
        .appendField('times');
      this.appendStatementInput('DO').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(30);
      this.setTooltip('Repeat the blocks inside a number of times');
    }
  };

  Blockly.Blocks['simple_if'] = {
    init() {
      this.appendValueInput('CONDITION')
        .setCheck('Boolean')
        .appendField('if');
      this.appendStatementInput('DO').appendField('then');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(30);
      this.setTooltip('Do something only if a condition is true');
    }
  };

  Blockly.Blocks['set_variable'] = {
    init() {
      this.appendValueInput('VALUE')
        .appendField('set')
        .appendField(new Blockly.FieldTextInput('x'), 'VAR')
        .appendField('to');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(30);
      this.setTooltip('Create or change a variable');
    }
  };
}

// Build the toolbox XML for the Blockly workspace
export function getToolboxXml() {
  return `
<xml id="toolbox" style="display: none">
  <category name="🎨 Visuals" colour="270">
    <block type="draw_circle"></block>
    <block type="draw_rect"></block>
    <block type="draw_star"></block>
    <block type="draw_line"></block>
    <sep gap="20"></sep>
    <block type="set_fill"></block>
    <block type="set_stroke"></block>
    <block type="no_fill"></block>
    <block type="set_stroke_weight"></block>
    <sep gap="20"></sep>
    <block type="clear_canvas"></block>
    <block type="set_background"></block>
    <block type="draw_trail"></block>
  </category>
  <category name="🚀 Motion" colour="210">
    <block type="move_to"></block>
    <block type="move_to_center"></block>
    <block type="rotate_by"></block>
    <block type="grow_by"></block>
    <block type="shrink_by"></block>
    <sep gap="20"></sep>
    <block type="save_position"></block>
    <block type="restore_position"></block>
  </category>
  <category name="🔢 Math" colour="120">
    <block type="map_value"></block>
    <block type="random_number"></block>
    <block type="canvas_width"></block>
    <block type="canvas_height"></block>
    <block type="frame_count"></block>
    <sep gap="20"></sep>
    <block type="math_number"><field name="NUM">0</field></block>
    <block type="math_arithmetic"></block>
    <block type="math_modulo"></block>
  </category>
  <category name="🔁 Control" colour="30">
    <block type="repeat_times"></block>
    <block type="simple_if"></block>
    <block type="set_variable"></block>
    <sep gap="20"></sep>
    <block type="logic_compare"></block>
    <block type="logic_operation"></block>
    <block type="logic_boolean"></block>
  </category>
</xml>`;
}
