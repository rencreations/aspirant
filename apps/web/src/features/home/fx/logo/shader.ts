/**
 * The shaders of the logo quad. The vertex shader is `warpPoint` in `math.ts`, formula for formula
 * (the reel's corner weights per vertex, a travelling wave, a bend for the carry, a ripple for the
 * pointer, a reveal), and it ends in the stage's own camera, so the logo sits in the same world as
 * the drones and lines up with the pixels at z = 0.
 *
 * Colour: the textures are `NoColorSpace` and premultiplied, a `ShaderMaterial` is not colour
 * converted by the renderer, so the logo is drawn in the same sRGB values as the DOM logo.
 */
import { ART, REVEAL_DROP, REVEAL_EDGE, RIPPLE, WAVE } from "./math";

const f = (n: number): string => (Number.isInteger(n) ? `${n}.0` : String(n));

export const VERTEX = /* glsl */ `
uniform vec3  uFrom;       // x, y, k (stage px, px per logo unit)
uniform vec3  uTo;
uniform float uP;
uniform float uRoll, uTilt, uYaw;
uniform float uEnv, uPhase, uAmp, uCycles;
uniform vec4  uSag;        // depth, xL, xR, wobble
uniform float uSagY;
uniform vec2  uSnap;
uniform vec4  uRip;        // x, y (logo units), strength, time
uniform float uReveal;

varying vec2  vUv;
varying float vSlope;
varying float vEnv;
varying float vV;
varying float vMask;

const vec2  ART = vec2(${f(ART.w)}, ${f(ART.h)});
const float PI = 3.14159265358979;

float sstep(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// A held banner: the middle drops, cross sections turn with the curve, the ends go on along the tangent.
vec2 bend(vec2 l) {
  float span = uSag.z - uSag.y;
  if (uSag.x == 0.0 || span == 0.0) return l;
  float s = (l.x - uSag.y) / span;
  float sc = clamp(s, 0.0, 1.0);
  float sk = 1.0 + uSag.w * (2.0 * sc - 1.0);
  float par = 4.0 * sc * (1.0 - sc);
  float fv = par * sk;
  float fp = 4.0 * (1.0 - 2.0 * sc) * sk + par * 2.0 * uSag.w;
  float drop = uSag.x * (fv + fp * (s - sc));
  float th = atan(-(uSag.x * fp) / span);
  float r = l.y - uSagY;
  return vec2(l.x - r * sin(th), uSagY - drop + r * cos(th));
}

void main() {
  vUv = uv;
  vec2 l0 = position.xy;                                   // logo units from the art centre, y up
  vec2 a = clamp(l0 / ART + 0.5, 0.0, 1.0);                // 0..1 across the art, (0,0) bottom left

  // The pointer's ripple lifts the logo before anything else moves it.
  vec2 l = l0;
  float rd = distance(l0, uRip.xy);
  l.y += uRip.z * ${f(RIPPLE.lift)} * exp(-rd / ${f(RIPPLE.reach)}) * sin(rd / ${f(RIPPLE.length)} - ${f(RIPPLE.speed)} * uRip.w);
  l = bend(l);

  // The reel's corner stagger: the top right leads, the bottom left trails.
  float wgt = 1.0 - (pow(a.x, 1.5) + pow(a.y, 1.5)) * 0.5;
  float v = sstep(wgt * 0.3, 0.7 + wgt * 0.3, uP);
  float k = mix(uFrom.z, uTo.z, v);
  vec2  c = mix(uFrom.xy, uTo.xy, v);
  float ang = -(sstep(0.0, 1.0, v) - v) + uRoll * (1.0 - v);
  float cs = cos(ang), sn = sin(ang);
  vec2 off = k * l;
  off = vec2(off.x * cs - off.y * sn, off.x * sn + off.y * cs);
  float z = 0.0;
  float tilt = uTilt * (1.0 - v);
  float yaw = uYaw * (1.0 - v);
  z += off.y * sin(tilt); off.y *= cos(tilt);
  z -= off.x * sin(yaw);  off.x *= cos(yaw);
  float bump = k * ART.x * 0.1 * pow(sin(PI * v), 2.0);

  // The travelling wave. The trailing end whips more. The wave shrinks with the logo.
  float prof = 0.35 + 0.65 * (1.0 - a.x);
  float ph = 2.0 * PI * (uCycles * a.x - uPhase);
  float H = k * ART.y;
  float lift = uAmp * uEnv * H * prof * sin(ph);
  float side = ${f(WAVE.lateral)} * uAmp * uEnv * H * prof * cos(ph);

  // The reveal: the part the front has not reached yet waits lower and rises as it passes.
  float rs = a.x * 0.8 + (1.0 - a.y) * 0.2;
  float m = sstep(0.0, 1.0, (uReveal * (1.0 + ${f(REVEAL_EDGE)}) - rs) / ${f(REVEAL_EDGE)});
  float drop = (1.0 - m) * (1.0 - m) * ${f(REVEAL_DROP)} * H;

  vec2 p = c + off + vec2(bump + side, lift - drop) + uSnap * sstep(0.9, 1.0, uP);
  vSlope = cos(ph) * prof * uEnv;
  vEnv = uEnv;
  vV = v;
  vMask = m;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, z + 0.5 * lift, 1.0);
}
`;

export const FRAGMENT = /* glsl */ `
uniform sampler2D uTex;
uniform sampler2D uTexNav;
uniform vec2  uTexel;     // 1 / size of the hero texture
uniform vec2  uUvNav;     // the share of the nav texture the quad covers
uniform float uCA;        // texels of split per unit of slope
uniform float uOpacity;   // the whole logo's opacity

varying vec2  vUv;
varying float vSlope;
varying float vEnv;
varying float vV;
varying float vMask;

float sstep(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  // A chromatic split along the wave's slope: three taps, alpha is the largest of them so the result stays valid premultiplied.
  vec2 o = vec2(uCA * vSlope * uTexel.x, 0.0);
  vec4 cr = texture2D(uTex, vUv + o);
  vec4 cg = texture2D(uTex, vUv);
  vec4 cb = texture2D(uTex, vUv - o);
  vec4 c = vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));

  // The nav LOD: the same art rastered at the bar's pixel scale, one texel to one device pixel.
  float nb = sstep(0.6, 0.97, vV);
  vec4 cn = texture2D(uTexNav, vec2(vUv.x * uUvNav.x, 1.0 - (1.0 - vUv.y) * uUvNav.y));
  c = mix(c, cn, nb);

  c.rgb *= 1.0 + ${f(WAVE.shade)} * vEnv * vSlope;
  c *= sstep(0.15, 0.85, vMask) * uOpacity;
  gl_FragColor = c;
}
`;
