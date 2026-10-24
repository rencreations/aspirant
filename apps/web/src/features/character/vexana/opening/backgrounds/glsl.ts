/**
 * The shared part of every background shader. A background is one GLSL function,
 * `vec3 background(vec2 uv, vec2 p, float tone)`: `uv` is 0 to 1 over the screen, `p` is centred
 * and as tall as 1, and `tone` is 0 for the daybreak page and 1 for the ink one. The scene adds
 * the uniforms, the noise and a `main` that draws it.
 */
export const PRELUDE = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uTone;
uniform float uMix;
uniform int uOct;
uniform vec3 uGlow;
varying vec2 vUv;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    if (i >= uOct) break;
    s += a * vn(p);
    p = m * p;
    a *= 0.5;
  }
  return s;
}
`;

export const MAIN = /* glsl */ `
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  vec3 c = background(vUv, p, uTone);
  // The Ender form lights the page around the head while it shows.
  vec2 gp = (uGlow.xy - 0.5) * vec2(aspect, 1.0);
  float gd = length(p - gp);
  c += vec3(0.55, 0.25, 0.85) * uGlow.z * exp(-gd * gd * 5.0) * mix(0.16, 0.34, uTone);
  gl_FragColor = vec4(c, uMix);
}
`;
