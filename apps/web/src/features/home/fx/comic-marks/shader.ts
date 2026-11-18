/**
 * The one shader of the marks pass. Every mark is an instance of one quad; the fragment shader
 * draws the shape from distance functions, so an edge is one pixel wide at any size and on any
 * screen (nothing is a picture). The look is fixed here: a flat fill, a thick ink outline (it grows
 * with the mark, never under 2 pixels), a flat shade or a highlight where the shape wants one.
 *
 * Per instance (five vec4, `STRIDE` in `mark.ts`):
 *   iA  x, y (stage pixels), size (pixels, the height of the shape's unit), rotation
 *   iB  scale x, scale y (the pop and its squash), alpha, shape (`PRIM` in `kinds.ts`)
 *   iC  life 0 to 1, seed 0 to 1, param, aspect (the quad is `aspect` times wider than tall)
 *   iD  fill rgb, variant
 *   iE  accent rgb, outline in pixels (0 is automatic)
 *
 * The shape lives in "units": the unit circle is half the size. Colours are sRGB and written as
 * they are, so a screenshot pixel of the pink is exactly 0xff2d7a.
 */
export const VERTEX = /* glsl */ `
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
attribute vec4 iD;
attribute vec4 iE;

varying vec2 vP;
varying float vUnit;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;

const float PAD = 1.5;

void main() {
  float aspect = max(iC.w, 0.05);
  vec2 local = position.xy * vec2(aspect, 1.0) * PAD;
  float halfSize = iA.z * 0.5;
  vec2 off = local * halfSize * iB.xy;
  float c = cos(iA.w);
  float s = sin(iA.w);
  vec2 w = iA.xy + vec2(c * off.x - s * off.y, s * off.x + c * off.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 0.0, 1.0);
  vP = local;
  vUnit = max(halfSize * 0.5 * (iB.x + iB.y), 0.001);
  vB = iB;
  vC = iC;
  vD = iD;
  vE = iE;
}
`;

export const FRAGMENT = /* glsl */ `
varying vec2 vP;
varying float vUnit;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;

const vec3 INK = vec3(0.0431, 0.0510, 0.0706);
const float PI = 3.14159265;
const float TAU = 6.28318531;

uniform float uDpr;
float gRim;
float gPx;
float gAA;
float gOut;
vec3 gCol;
float gA;

void over(vec3 c, float k) {
  float na = k + gA * (1.0 - k);
  gCol = (c * k + gCol * gA * (1.0 - k)) / max(na, 0.00001);
  gA = na;
}

float cov(float d) {
  return clamp(0.5 - d / gAA, 0.0, 1.0);
}

/*
 * A shape is a white cut line, an ink outline and the flat fill. The cut line is what keeps a mark
 * readable on the dark ground (the ink vanishes there) and it is invisible on the light one: the
 * paper is white. A streak asks for no cut line.
 */
void shape(float d, vec3 fill) {
  over(vec3(1.0), cov(d - gOut - gRim));
  over(INK, cov(d - gOut));
  over(fill, cov(d));
}

void tint(float d, vec3 c, float amount) {
  over(c, cov(d) * amount);
}

vec2 rot(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float hash1(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float sdEll(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 0.00001);
}

float sdEgg(vec2 p, float ra, float rb) {
  const float k = 1.7320508;
  p.x = abs(p.x);
  float r = ra - rb;
  return ((p.y < 0.0) ? length(vec2(p.x, p.y)) - r
        : (k * (p.x + r) < p.y) ? length(vec2(p.x, p.y - k * r))
        : length(vec2(p.x + r, p.y)) - 2.0 * r) - rb;
}

float dot2(vec2 v) {
  return dot(v, v);
}

float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) {
    return sqrt(dot2(p - vec2(0.25, 0.75))) - 0.35355339;
  }
  return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}

float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

float sdStarN(vec2 p, float r, float n, float m) {
  float an = PI / n;
  float en = PI / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float sdArc(vec2 p, float a0, float a1, float r) {
  float a = atan(p.y, p.x);
  a = a < a0 ? a + TAU : a;
  if (a <= a1) return abs(length(p) - r);
  vec2 e0 = r * vec2(cos(a0), sin(a0));
  vec2 e1 = r * vec2(cos(a1), sin(a1));
  return min(length(p - e0), length(p - e1));
}

/* The exclamation mark and its shock rays. */
void gBang(vec2 p, vec3 fill, vec3 acc, float t) {
  float e = 1.0 - pow(1.0 - clamp(t * 6.0, 0.0, 1.0), 3.0);
  float shrink = 1.0 - smoothstep(0.55, 1.0, t);
  float grow = e * shrink;
  if (grow > 0.02) {
    float n = 8.0;
    vec2 pr = vec2(p.x * 0.72, p.y);
    float a = atan(pr.x, pr.y);
    float sector = floor(a * n / TAU + 0.5);
    vec2 q = rot(pr, sector * TAU / n);
    float r0 = 0.94 + 0.08 * e;
    float r1 = r0 + 0.34 * grow;
    float ray = sdSeg(q, vec2(0.0, r0), vec2(0.0, r1)) - 0.05;
    shape(ray, acc);
  }
  float body = sdTaper(p, vec2(0.0, 0.62), vec2(0.0, -0.2), 0.21, 0.1);
  float dotc = length(p - vec2(0.0, -0.62)) - 0.15;
  shape(min(body, dotc), fill);
  tint(sdSeg(p, vec2(-0.075, 0.56), vec2(-0.05, 0.08)) - 0.03, vec3(1.0), 0.6);
}

void gQuestion(vec2 p, vec3 fill, vec3 acc) {
  vec2 c = vec2(0.0, 0.28);
  vec2 e = c + 0.36 * vec2(cos(-1.0), sin(-1.0));
  float hook = sdArc(p - c, -1.0, 3.55, 0.36);
  float stem = sdSeg(p, e, vec2(0.0, -0.2));
  float d = min(hook, stem) - 0.125;
  float dotc = length(p - vec2(0.0, -0.62)) - 0.15;
  shape(min(d, dotc), fill);
  tint(sdArc(p - c, 1.9, 2.75, 0.36) - 0.03, vec3(1.0), 0.55);
}

void gDrop(vec2 p, vec3 fill) {
  vec2 q = p + vec2(0.0, 0.16);
  float d = sdEgg(q, 0.5, 0.05);
  shape(d, fill);
  float shadeK = min(cov(d), cov(0.5 - length(q - vec2(-0.12, 0.1))));
  over(fill * 0.8, shadeK);
  vec2 h = rot(q - vec2(-0.2, -0.1), -0.3);
  tint(sdEll(h, vec2(0.06, 0.15)), vec3(1.0), 0.85);
}

/*
 * The anger vein: a ring of four arcs, one on each side, thick in the middle and tapering to a
 * rounded point, with a gap on each diagonal (the cross the eye reads) and an empty middle.
 */
float veinD(vec2 p) {
  p = abs(p);
  if (p.y > p.x) p = p.yx;
  float a = atan(p.y, p.x);
  float a1 = 0.5;
  float ac = min(a, a1);
  float u = ac / a1;
  float th = 0.09 + 0.11 * pow(cos(u * 1.5708), 0.6);
  vec2 q = 0.7 * vec2(cos(ac), sin(ac));
  return length(p - q) - th;
}

void gVein(vec2 p, vec3 fill) {
  shape(veinD(p), fill);
}

void gStar(vec2 p, vec3 fill) {
  float d = sdStar5(p, 0.74, 0.5) - 0.07;
  shape(d, fill);
  tint(sdSeg(p, vec2(-0.14, 0.2), vec2(-0.04, 0.42)) - 0.035, vec3(1.0), 0.6);
}

void gSparkle(vec2 p, vec3 fill, vec3 acc) {
  float d = sdStarN(p, 0.86, 4.0, 3.15) - 0.03;
  shape(d, fill);
  tint(sdStarN(p, 0.34, 4.0, 3.15), acc, 0.9);
}

void gHeart(vec2 p, vec3 fill) {
  vec2 q = vec2(p.x / 1.2, (p.y + 0.66) / 1.2);
  float d = sdHeart(q) * 1.2;
  shape(d, fill);
  tint(sdSeg(q, vec2(-0.43, 0.8), vec2(-0.34, 0.93)) * 1.2 - 0.045, vec3(1.0), 0.7);
}

void gNote(vec2 p, vec3 fill, float variant) {
  float d;
  if (variant < 1.0) {
    float head = sdEll(rot(p - vec2(-0.18, -0.52), -0.45), vec2(0.29, 0.21));
    float stem = sdSeg(p, vec2(0.08, -0.47), vec2(0.08, 0.72)) - 0.065;
    float flag = min(
      sdTaper(p, vec2(0.08, 0.7), vec2(0.5, 0.3), 0.09, 0.05),
      sdTaper(p, vec2(0.5, 0.3), vec2(0.38, -0.08), 0.05, 0.035));
    d = min(min(head, stem), flag);
  } else if (variant < 2.0) {
    float h1 = sdEll(rot(p - vec2(-0.56, -0.5), -0.45), vec2(0.27, 0.2));
    float h2 = sdEll(rot(p - vec2(0.2, -0.38), -0.45), vec2(0.27, 0.2));
    float s1 = sdSeg(p, vec2(-0.32, -0.45), vec2(-0.32, 0.6)) - 0.06;
    float s2 = sdSeg(p, vec2(0.44, -0.33), vec2(0.44, 0.74)) - 0.06;
    float beam = sdTaper(p, vec2(-0.32, 0.58), vec2(0.44, 0.72), 0.12, 0.12);
    d = min(min(min(h1, h2), min(s1, s2)), beam);
  } else if (variant < 3.0) {
    float head = sdEll(rot(p - vec2(-0.1, -0.52), -0.45), vec2(0.3, 0.22));
    float stem = sdSeg(p, vec2(0.18, -0.47), vec2(0.18, 0.74)) - 0.065;
    d = min(head, stem);
  } else {
    float h1 = sdEll(rot(p - vec2(-0.56, -0.5), -0.45), vec2(0.27, 0.2));
    float h2 = sdEll(rot(p - vec2(0.2, -0.38), -0.45), vec2(0.27, 0.2));
    float s1 = sdSeg(p, vec2(-0.32, -0.45), vec2(-0.32, 0.6)) - 0.06;
    float s2 = sdSeg(p, vec2(0.44, -0.33), vec2(0.44, 0.74)) - 0.06;
    float b1 = sdTaper(p, vec2(-0.32, 0.6), vec2(0.44, 0.74), 0.1, 0.1);
    float b2 = sdTaper(p, vec2(-0.32, 0.32), vec2(0.44, 0.46), 0.1, 0.1);
    d = min(min(min(h1, h2), min(s1, s2)), min(b1, b2));
  }
  shape(d, fill);
}

void gPuff(vec2 p, vec3 fill, float lobes, float seed) {
  float d = length(p) - 0.46;
  for (int i = 0; i < 7; i++) {
    if (float(i) >= lobes) break;
    float fi = float(i);
    float a = fi / lobes * TAU + seed * TAU;
    float rr = 0.32 + 0.1 * hash1(fi + seed * 13.0);
    vec2 c = 0.44 * vec2(cos(a), sin(a) * 0.86);
    d = min(d, length(p - c) - rr);
  }
  shape(d, fill);
  float shadeK = min(cov(d), cov(0.66 - length(p - vec2(0.16, 0.24))));
  over(fill * 0.84, shadeK);
}

void gZed(vec2 p, vec3 fill) {
  float d = min(
    min(sdSeg(p, vec2(-0.42, 0.52), vec2(0.42, 0.52)), sdSeg(p, vec2(0.42, 0.52), vec2(-0.42, -0.52))),
    sdSeg(p, vec2(-0.42, -0.52), vec2(0.42, -0.52))) - 0.14;
  shape(d, fill);
}

void gStreak(vec2 p, vec3 fill, float aspect, float th) {
  float l = aspect * 0.96;
  float d = sdTaper(p, vec2(-l, 0.0), vec2(l - th, 0.0), th * 0.12, th);
  over(INK, cov(d - gOut));
  over(fill, cov(d));
}

void gFlash(vec2 p, vec3 fill, vec3 core, float jag) {
  vec2 q = rot(p, jag * TAU);
  float d = sdStarN(q, 0.92, 9.0, 2.6) - 0.02;
  shape(d, fill);
  tint(sdStarN(rot(q, 0.25), 0.55, 9.0, 2.8), core, 1.0);
}

/*
 * The cursing mark: a jagged shout bubble holding a scribbled spiral, a bolt, an asterisk and a
 * hash. Two layouts, picked by the seed, so a second one does not look like the first.
 */
void gSwear(vec2 p, vec3 fill, float seed) {
  float d = sdStarN(p, 0.96, 11.0, 2.7) - 0.07;
  shape(d, fill);
  float swap = seed < 0.5 ? 1.0 : -1.0;
  float sw = 0.04;
  vec2 sp = p - vec2(-0.3 * swap, 0.2);
  float r = length(sp);
  float f = r * 10.0 - atan(sp.y, sp.x) / TAU;
  float fr = fract(f);
  float ds = min(fr, 1.0 - fr) / 10.0 - sw * 0.6;
  tint(max(ds, r - 0.22), INK, 1.0);
  vec2 b = p - vec2(0.3 * swap, 0.2);
  float dz = min(
    min(sdSeg(b, vec2(-0.08, 0.22), vec2(0.06, 0.04)), sdSeg(b, vec2(0.06, 0.04), vec2(-0.06, 0.0))),
    sdSeg(b, vec2(-0.06, 0.0), vec2(0.08, -0.22))) - sw;
  tint(dz, INK, 1.0);
  vec2 a = p - vec2(-0.2 * swap, -0.3);
  float da = min(
    min(sdSeg(a, vec2(-0.17, 0.0), vec2(0.17, 0.0)), sdSeg(a, vec2(-0.085, 0.15), vec2(0.085, -0.15))),
    sdSeg(a, vec2(-0.085, -0.15), vec2(0.085, 0.15))) - sw;
  tint(da, INK, 1.0);
  vec2 h = rot(p - vec2(0.25 * swap, -0.3), 0.18);
  float dh = min(
    min(sdSeg(h, vec2(-0.06, -0.16), vec2(-0.06, 0.16)), sdSeg(h, vec2(0.06, -0.16), vec2(0.06, 0.16))),
    min(sdSeg(h, vec2(-0.16, -0.06), vec2(0.16, -0.06)), sdSeg(h, vec2(-0.16, 0.06), vec2(0.16, 0.06)))) - sw;
  tint(dh, vec3(1.0, 0.1765, 0.4784), 1.0);
}

void main() {
  gPx = 1.0 / vUnit;
  gAA = gPx / max(uDpr, 1.0);
  float outlinePx = vE.w > 0.0 ? vE.w : clamp(0.14 * vUnit, 2.0, 6.0);
  gOut = outlinePx * gPx;
  gRim = 1.5 * gPx;
  gCol = INK;
  gA = 0.0;
  vec3 fill = vD.rgb;
  vec3 acc = vE.rgb;
  float t = vC.x;
  float seed = vC.y;
  float param = vC.z;
  int k = int(vB.w + 0.5);
  vec2 p = vP;
  if (k == 0) gBang(p, fill, acc, t);
  else if (k == 1) gQuestion(p, fill, acc);
  else if (k == 2) gDrop(p, fill);
  else if (k == 3) gVein(p, fill);
  else if (k == 4) gStar(p, fill);
  else if (k == 5) gSparkle(p, fill, acc);
  else if (k == 6) gHeart(p, fill);
  else if (k == 7) gNote(p, fill, vD.w);
  else if (k == 8) gPuff(p, fill, max(param, 3.0), seed);
  else if (k == 9) gZed(p, fill);
  else if (k == 10) gStreak(p, fill, max(vC.w, 0.05), param);
  else if (k == 11) gFlash(p, fill, acc, seed);
  else gSwear(p, fill, seed);
  float a = gA * vB.z;
  if (a < 0.003) discard;
  gl_FragColor = vec4(gCol, a);
}
`;
