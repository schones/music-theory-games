// generators.js — JavaScript code generators for custom Blockly blocks

export function registerGenerators() {
  const js = Blockly.JavaScript;
  const Order = js.ORDER_ATOMIC ? js : Blockly.JavaScript;

  // ===================== VISUALS =====================

  js.forBlock['draw_circle'] = function(block) {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const size = block.getFieldValue('SIZE');
    return `circle(${x}, ${y}, ${size});\n`;
  };

  js.forBlock['draw_rect'] = function(block) {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const w = block.getFieldValue('W');
    const h = block.getFieldValue('H');
    return `rect(${x}, ${y}, ${w}, ${h});\n`;
  };

  js.forBlock['draw_star'] = function(block) {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const size = block.getFieldValue('SIZE');
    return `star(${x}, ${y}, ${size}, 5);\n`;
  };

  js.forBlock['draw_line'] = function(block) {
    const x1 = block.getFieldValue('X1');
    const y1 = block.getFieldValue('Y1');
    const x2 = block.getFieldValue('X2');
    const y2 = block.getFieldValue('Y2');
    return `line(${x1}, ${y1}, ${x2}, ${y2});\n`;
  };

  js.forBlock['set_fill'] = function(block) {
    const color = block.getFieldValue('COLOR');
    return `fill('${color}');\n`;
  };

  js.forBlock['set_stroke'] = function(block) {
    const color = block.getFieldValue('COLOR');
    return `stroke('${color}');\n`;
  };

  js.forBlock['no_fill'] = function() {
    return 'noFill();\n';
  };

  js.forBlock['set_stroke_weight'] = function(block) {
    const w = block.getFieldValue('WEIGHT');
    return `strokeWeight(${w});\n`;
  };

  js.forBlock['clear_canvas'] = function() {
    return `background(30, 30, 40);\n`;
  };

  js.forBlock['set_background'] = function(block) {
    const color = block.getFieldValue('COLOR');
    return `background('${color}');\n`;
  };

  js.forBlock['draw_trail'] = function() {
    return `fill(30, 30, 40, 25);\nrect(0, 0, width, height);\n`;
  };

  // ===================== MOTION =====================

  js.forBlock['move_to'] = function(block) {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    return `translate(${x}, ${y});\n`;
  };

  js.forBlock['move_to_center'] = function() {
    return `translate(width / 2, height / 2);\n`;
  };

  js.forBlock['rotate_by'] = function(block) {
    const angle = block.getFieldValue('ANGLE');
    return `rotate(${angle} * Math.PI / 180);\n`;
  };

  js.forBlock['grow_by'] = function(block) {
    const pct = block.getFieldValue('PERCENT');
    return `scale(1 + ${pct} / 100);\n`;
  };

  js.forBlock['shrink_by'] = function(block) {
    const pct = block.getFieldValue('PERCENT');
    return `scale(1 - ${pct} / 100);\n`;
  };

  js.forBlock['save_position'] = function() {
    return 'push();\n';
  };

  js.forBlock['restore_position'] = function() {
    return 'pop();\n';
  };

  // ===================== MATH =====================

  js.forBlock['map_value'] = function(block) {
    const val = block.getFieldValue('VALUE');
    const fl = block.getFieldValue('FROM_LOW');
    const fh = block.getFieldValue('FROM_HIGH');
    const tl = block.getFieldValue('TO_LOW');
    const th = block.getFieldValue('TO_HIGH');
    return [`map(${val}, ${fl}, ${fh}, ${tl}, ${th})`, Order.ORDER_FUNCTION_CALL];
  };

  js.forBlock['random_number'] = function(block) {
    const min = block.getFieldValue('MIN');
    const max = block.getFieldValue('MAX');
    return [`random(${min}, ${max})`, Order.ORDER_FUNCTION_CALL];
  };

  js.forBlock['canvas_width'] = function() {
    return ['width', Order.ORDER_ATOMIC];
  };

  js.forBlock['canvas_height'] = function() {
    return ['height', Order.ORDER_ATOMIC];
  };

  js.forBlock['frame_count'] = function() {
    return ['frameCount', Order.ORDER_ATOMIC];
  };

  // ===================== CONTROL =====================

  js.forBlock['repeat_times'] = function(block) {
    const times = block.getFieldValue('TIMES');
    const body = js.statementToCode(block, 'DO');
    return `for (let i = 0; i < ${times}; i++) {\n${body}}\n`;
  };

  js.forBlock['simple_if'] = function(block) {
    const condition = js.valueToCode(block, 'CONDITION', Order.ORDER_NONE) || 'false';
    const body = js.statementToCode(block, 'DO');
    return `if (${condition}) {\n${body}}\n`;
  };

  js.forBlock['set_variable'] = function(block) {
    const varName = block.getFieldValue('VAR');
    const value = js.valueToCode(block, 'VALUE', Order.ORDER_ASSIGNMENT) || '0';
    return `var ${varName} = ${value};\n`;
  };
}
