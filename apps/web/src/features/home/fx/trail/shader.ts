/**
 * The shader of the trails pass. The ribbon is a strip of triangles built on the CPU; each vertex
 * carries its place across the strip (`position.z`, -1 to 1) and its colour and opacity (`aTone`,
 * already faded along the tail). The fragment shader only softens the two edges and lifts the
 * middle a little towards white, so a ribbon reads as a flat, clean stroke with no glow around it.
 * Colours are sRGB and written as they are.
 */
export const VERTEX = /* glsl */ `
attribute vec4 aTone;
varying float vAcross;
varying vec4 vTone;

void main() {
  vAcross = position.z;
  vTone = aTone;
  gl_Position = projectionMatrix * viewMatrix * vec4(position.xy, 0.0, 1.0);
}
`;

export const FRAGMENT = /* glsl */ `
varying float vAcross;
varying vec4 vTone;

void main() {
  float d = abs(vAcross);
  float edge = 1.0 - smoothstep(0.55, 1.0, d);
  float core = 1.0 - smoothstep(0.0, 0.55, d);
  vec3 col = mix(vTone.rgb, vec3(1.0), core * 0.32);
  float a = vTone.a * edge;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}
`;
