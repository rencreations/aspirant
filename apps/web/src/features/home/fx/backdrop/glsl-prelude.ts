/**
 * The shared parts of every backdrop shader: one fullscreen triangle, a prelude of helpers (hash,
 * value noise, fbm, the four-stop palette) and a `main` that frames a kind.
 *
 * A kind is only `vec4 bg(vec2 uv, vec2 p, vec2 pt, float t)`:
 *   uv  0..1 across the canvas, y up
 *   p   centred, y from -0.5 to 0.5, x from -aspect/2 to aspect/2, divided by the scale and turned by
 *       the angle (so a kind is written for scale 1 and angle 0)
 *   pt  the pointer in the same space
 *   t   the layer's own time (it integrates its speed, so a change of speed never jumps)
 * and returns straight colour and coverage. `main` clamps, premultiplies, applies the amount and the
 * cross-fade weight, and adds a hair of dither (a soft shader upscaled from half size bands without it).
 *
 * Crisp kinds (hairlines, dots) work in CSS pixels from `uCss` and `uPointer.xy * uCss` instead.
 * Colour is raw sRGB end to end; the canvas is transparent, so the grounds under it show through.
 */

export const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const PRELUDE = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uCss;
uniform float uAsp;
uniform float uPx;
uniform vec3 uPointer;
uniform float uS;
uniform float uVel;
uniform float uAmount;
uniform float uIntensity;
uniform float uScale;
uniform float uAngle;
uniform float uSeed;
uniform float uWeight;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uInk;

#define PI 3.14159265
#define TAU 6.2831853

// One CSS pixel in the units of p.
float CPX;

vec3 pal(float t) {
  float x = clamp(t, 0.0, 1.0) * 3.0;
  return x < 1.0 ? mix(uC0, uC1, x) : x < 2.0 ? mix(uC1, uC2, x - 1.0) : mix(uC2, uC3, x - 2.0);
}

float h11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 h22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    s += a * vn(p);
    p = m * p * 2.03;
    a *= 0.5;
  }
  return s / 0.9375;
}
mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}
// Source-over of one more layer in premultiplied colour: pc is rgb * alpha, pa is alpha.
void over(inout vec3 pc, inout float pa, vec3 c, float a) {
  pc = pc * (1.0 - a) + c * a;
  pa = pa * (1.0 - a) + a;
}
`;

const MAIN = /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p0 = (uv - 0.5) * vec2(uAsp, 1.0);
  vec2 q0 = (uPointer.xy - 0.5) * vec2(uAsp, 1.0);
  mat2 R = rot(uAngle);
  vec2 p = R * p0 / uScale;
  vec2 pt = R * q0 / uScale;
  CPX = uPx / (uRes.y * uScale);
  vec4 c = bg(uv, p, pt, uTime);
  float a = clamp(c.a * uAmount, 0.0, 1.0);
  vec3 rgb = clamp(c.rgb, 0.0, 1.0);
  rgb += (h21(gl_FragCoord.xy + fract(uTime) * 17.0) - 0.5) / 160.0;
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0) * a, a) * uWeight;
}
`;

/** The full fragment source of a kind. */
export function fragmentFor(kindSource: string): string {
  return `${PRELUDE}\n${kindSource}\n${MAIN}`;
}
