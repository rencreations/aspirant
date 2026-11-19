/**
 * The sheet's look: the daybreak paper with its dot grid (the same pattern and the same 9 percent
 * dots as the page's ground, laid in screen pixels so a screen of sheet is the ground), a soft
 * band of shade on the folds, and the thin ink along the edge. The colours are written as display
 * values (no colour space conversion), as the page's CSS has them.
 */
export const VERTEX = /* glsl */ `
attribute float aShade;
attribute float aInk;
varying float vShade;
varying float vInk;
void main() {
  vShade = aShade;
  vInk = aInk;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FRAGMENT = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uShadeCol;
uniform vec3 uInk;
uniform float uShade;
uniform vec2 uView;
varying float vShade;
varying float vInk;
void main() {
  vec3 col = uPaper;
  float band = smoothstep(0.46, 0.58, vShade) * uShade;
  col = mix(col, uShadeCol, band);
  // The page's dot grid: a 28 px tile with a dot at its middle, in CSS pixels from the top left.
  vec2 p = vec2(gl_FragCoord.x, uView.x * uView.y - gl_FragCoord.y) / uView.y;
  vec2 m = mod(p, 28.0) - 14.0;
  float dots = 0.09 * (1.0 - smoothstep(1.0, 1.4, length(m)));
  col = mix(col, vec3(11.0, 11.0, 14.0) / 255.0, dots);
  col = mix(col, uInk, vInk);
  gl_FragColor = vec4(col, 1.0);
}
`;
