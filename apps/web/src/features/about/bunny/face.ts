/**
 * The face on Mr. Bunny's screen. The model's glass is blank: the eyes, the mouth and the marks
 * around them are drawn by the glass's shader from a handful of numbers, so any face turns into
 * any other with no step, a blink or a look is one more number, and the edges stay sharp at any
 * size. The source paints its face as pixel art on a grid of 5 mm cells (two tall eyes with a
 * notch at each end and a cat's mouth), and the shader draws on that same grid: `neutral` is the
 * source's own face redrawn on it (`scripts/about/bunny/README.md` says how close).
 *
 * Lengths are in pixels of the screen: one pixel is 5 mm on the model, 0 is the middle of the
 * glass, x grows to the bunny's own left (the viewer's right when it faces you) and y grows up.
 * L and R are the bunny's own left and right everywhere, as in the rig (`ear_L`, `foot_L`).
 *
 * No three and no DOM here: the page's scene and the build's check pictures both read this file.
 */

/** One face, as the numbers the shader draws it from. */
export interface BunnyFace {
  /** The eyes' plain form: half its width, half its height, its stepped corner, how round. */
  eyeW: number;
  eyeH: number;
  cut: number;
  round: number;
  /** How far each eye's middle is from the middle of the glass, and how high the eyes are. */
  gap: number;
  eyeY: number;
  /** The upper lid of each eye: 0 open, 1 shut. */
  lidL: number;
  lidR: number;
  /** The lid's slope: above 0 the inner end is lower (cross), below 0 the outer end (sad). */
  slantL: number;
  slantR: number;
  /** The lower lid rising, both eyes: the smile of a happy eye. */
  low: number;
  /** One eye drawn as a happy arch instead: a wink. */
  winkL: number;
  winkR: number;
  /** What both eyes are drawn as, by weight: an arch, a heart, a spiral, a cross, a chevron, a ring. */
  arc: number;
  heart: number;
  spiral: number;
  cross: number;
  chevron: number;
  ring: number;
  /** The mouth, by weight: the source's cat mouth, a dash, a smile, a frown, open, an "o", a wave. */
  cat: number;
  dash: number;
  smile: number;
  frown: number;
  open: number;
  oh: number;
  wave: number;
  /** The mouth's width (1 as drawn), the height of the open shapes, its tilt (radians), its place. */
  mouthW: number;
  mouthH: number;
  mouthTilt: number;
  mouthX: number;
  mouthY: number;
  /** Marks around the face, each grown from nothing by its weight. */
  blush: number;
  tear: number;
  sweat: number;
  anger: number;
  note: number;
  zzz: number;
  /** The colour of the face: 0 the screen's own cyan, 1 pink. */
  tone: number;
}

/** The source's own face. Every other face is this with some numbers changed. */
const NEUTRAL: BunnyFace = {
  eyeW: 3.5,
  eyeH: 7,
  cut: 2,
  round: 0,
  gap: 13,
  eyeY: 4.5,
  lidL: 0,
  lidR: 0,
  slantL: 0,
  slantR: 0,
  low: 0,
  winkL: 0,
  winkR: 0,
  arc: 0,
  heart: 0,
  spiral: 0,
  cross: 0,
  chevron: 0,
  ring: 0,
  cat: 1,
  dash: 0,
  smile: 0,
  frown: 0,
  open: 0,
  oh: 0,
  wave: 0,
  mouthW: 1,
  mouthH: 1,
  mouthTilt: 0,
  mouthX: 0,
  mouthY: -4.5,
  blush: 0,
  tear: 0,
  sweat: 0,
  anger: 0,
  note: 0,
  zzz: 0,
  tone: 0,
};

/** A face made from the source's: its own mouth replaces the cat's unless it keeps it. */
const face = (over: Partial<BunnyFace>): BunnyFace => ({ ...NEUTRAL, cat: 0, ...over });

/** The faces. Each is a whole `BunnyFace`, so any two blend. */
export const FACES = {
  /** The source's face: tall eyes with a notch at each end, and a cat's mouth. */
  neutral: { ...NEUTRAL },
  /** Happy arches, a small open mouth and a blush. */
  happy: face({ arc: 1, eyeY: 5, open: 1, mouthW: 0.9, mouthH: 0.8, mouthY: -5, blush: 1 }),
  /** Squeezed shut, a wide open mouth and a blush: a laugh. */
  laugh: face({ chevron: 1, eyeY: 5, open: 1, mouthW: 1.2, mouthH: 1.2, mouthY: -4, blush: 1 }),
  /** Round rings and a small "o". */
  surprised: face({
    ring: 1,
    eyeW: 5,
    eyeH: 6.5,
    eyeY: 5,
    oh: 1,
    mouthW: 0.9,
    mouthH: 1.25,
    mouthY: -7,
  }),
  /** Small eyes, a wobbling mouth and a drop of sweat. */
  scared: face({
    eyeW: 2,
    eyeH: 3.5,
    cut: 1,
    slantL: -0.35,
    slantR: -0.35,
    eyeY: 4,
    wave: 1,
    mouthW: 0.9,
    mouthY: -7,
    sweat: 1,
  }),
  /** Eyes cut by slanted lids, a frown and the anger mark. */
  angry: face({
    eyeW: 4,
    eyeH: 5.5,
    eyeY: 3.5,
    cut: 1,
    lidL: 0.12,
    lidR: 0.12,
    slantL: 0.75,
    slantR: 0.75,
    frown: 1,
    mouthW: 0.7,
    mouthY: -8,
    anger: 1,
  }),
  /** Half shut and level, a small "o", and z. */
  sleepy: face({
    eyeW: 4.5,
    eyeH: 5,
    cut: 0,
    lidL: 0.75,
    lidR: 0.75,
    eyeY: 2,
    oh: 1,
    mouthW: 0.55,
    mouthH: 0.75,
    mouthY: -7,
    zzz: 1,
  }),
  /** Hearts and an open mouth, in pink, with a blush. */
  love: face({
    heart: 1,
    eyeW: 6.5,
    eyeH: 6.5,
    gap: 13.5,
    eyeY: 4,
    open: 1,
    mouthW: 0.65,
    mouthH: 0.7,
    mouthY: -6.5,
    blush: 1,
    tone: 1,
  }),
  /** The left eye shut in an arch, a smile tilted up to that side and a little blush. */
  wink: face({ winkL: 1, smile: 1, mouthW: 0.85, mouthTilt: 0.15, mouthY: -6, blush: 0.6 }),
  /** Spirals and a wobbling mouth. */
  dizzy: face({ spiral: 1, eyeW: 6, eyeH: 6, eyeY: 4, wave: 1, mouthY: -8 }),
  /** Lids half down, the lower lids up, one eye lower than the other, a crooked smile. */
  smug: face({
    eyeW: 4.5,
    cut: 1,
    lidL: 0.45,
    lidR: 0.6,
    low: 0.2,
    slantL: -0.15,
    slantR: -0.15,
    smile: 1,
    mouthW: 0.7,
    mouthTilt: 0.3,
    mouthX: 3,
    mouthY: -6.5,
  }),
  /** The outer ends of the lids down, a frown and a tear. */
  sad: face({
    eyeH: 6,
    cut: 1,
    lidL: 0.2,
    lidR: 0.2,
    slantL: -0.7,
    slantR: -0.7,
    eyeY: 3,
    frown: 1,
    mouthW: 0.7,
    mouthY: -8,
    tear: 1,
  }),
  /** Content arches, a tall open mouth and a note. */
  singing: face({ arc: 1, eyeY: 5, open: 1, mouthW: 0.55, mouthH: 1.5, mouthY: -4.5, note: 1 }),
  /** Crosses and a wobbling mouth: knocked out. */
  ko: face({ cross: 1, eyeW: 4, eyeH: 4, eyeY: 4, wave: 1, mouthW: 0.8, mouthY: -7.5 }),
} satisfies Record<string, BunnyFace>;

export type BunnyFaceName = keyof typeof FACES;

const KEYS = Object.keys(NEUTRAL) as Array<keyof BunnyFace>;

export const copyFace = (out: BunnyFace, from: BunnyFace): BunnyFace => Object.assign(out, from);

/** `out` becomes the face `t` of the way from `a` to `b`. */
export function blendFace(out: BunnyFace, a: BunnyFace, b: BunnyFace, t: number): BunnyFace {
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

/** What changes every frame, beside the shape. */
export interface BunnyLive {
  /** 0 open, 1 shut, for the bunny's own left eye and right eye. */
  blinkL: number;
  blinkR: number;
  /** Where the eyes look, in pixels (the mouth follows by half). */
  lookX: number;
  lookY: number;
  /** How far the mouth opens for a word or a note: 0 to 1, on top of the face's own mouth. */
  talk: number;
  /** 0 a dark screen, 1 the face lit. */
  on: number;
  /** The turn of the spirals, in radians. */
  spin: number;
  /** A soft light round what is lit, as an LED screen has: 0 none. */
  glow: number;
  /** 1 drawn in the screen's pixels, 0 drawn smooth. Small on the page, it is drawn smooth anyway. */
  pixel: number;
}

/** The live numbers at rest. */
export const LIVE_REST: BunnyLive = {
  blinkL: 0,
  blinkR: 0,
  lookX: 0,
  lookY: 0,
  talk: 0,
  on: 1,
  spin: 0,
  glow: 0,
  pixel: 1,
};

type Vec = { value: number[] };

/** The uniforms of the screen. Arrays, so this file needs no three: the renderer reads them as vectors. */
export interface BunnyFaceUniforms {
  uEye: Vec;
  uEyeAt: Vec;
  uLidL: Vec;
  uLidR: Vec;
  uGlyph: Vec;
  uGlyph2: Vec;
  uMouthA: Vec;
  uMouthB: Vec;
  uMouthP: Vec;
  uMarkA: Vec;
  uMarkB: Vec;
  uLive: Vec;
  uLive2: Vec;
  /** The middle of the glass (metres, the body's frame) and one over a pixel's size. */
  uScreen: Vec;
  /** The glass's own right and up, in the body's frame. */
  uScreenRight: Vec;
  uScreenUp: Vec;
  /** Linear colours: the screen's cyan, pink, the red of the anger mark, the blue of a tear. */
  uCyan: Vec;
  uPink: Vec;
  uRed: Vec;
  uBlue: Vec;
}

export function makeFaceUniforms(): BunnyFaceUniforms {
  return {
    uEye: { value: [0, 0, 0, 0] },
    uEyeAt: { value: [0, 0, 0, 0] },
    uLidL: { value: [0, 0, 0, 0] },
    uLidR: { value: [0, 0, 0, 0] },
    uGlyph: { value: [0, 0, 0, 0] },
    uGlyph2: { value: [0, 0, 0, 0] },
    uMouthA: { value: [0, 0, 0, 0] },
    uMouthB: { value: [0, 0, 0, 0] },
    uMouthP: { value: [1, 0, 0, 0] },
    uMarkA: { value: [0, 0, 0, 0] },
    uMarkB: { value: [0, 0, 0, 0] },
    uLive: { value: [0, 0, 1, 1] },
    uLive2: { value: [0, 0, 0, 0] },
    uScreen: { value: [0, 0, 0, 200] },
    uScreenRight: { value: [1, 0, 0] },
    uScreenUp: { value: [0, 1, 0] },
    uCyan: { value: [0, 1, 1] },
    uPink: { value: [1, 0.3, 0.5] },
    uRed: { value: [1, 0.05, 0.05] },
    uBlue: { value: [0.4, 0.75, 1] },
  };
}

/** What the model says about its screen (the root's extras, `screen`). */
export interface BunnyScreen {
  centre: readonly [number, number, number];
  right: readonly [number, number, number];
  up: readonly [number, number, number];
  pixel: number;
}

/** Write the screen's place into its uniforms, once, from the model's extras. */
export function setScreen(u: BunnyFaceUniforms, screen: BunnyScreen): void {
  u.uScreen.value = [screen.centre[0], screen.centre[1], screen.centre[2], 1 / screen.pixel];
  u.uScreenRight.value = [...screen.right];
  u.uScreenUp.value = [...screen.up];
}

/** Write a face and its live numbers into the uniforms. */
export function packFace(u: BunnyFaceUniforms, s: BunnyFace, live: BunnyLive): void {
  const set = (target: number[], a: number, b: number, c: number, d: number) => {
    target[0] = a;
    target[1] = b;
    target[2] = c;
    target[3] = d;
  };
  set(u.uEye.value, s.eyeW, s.eyeH, s.cut, s.round);
  set(u.uEyeAt.value, s.gap, s.eyeY, s.low, 0);
  set(u.uLidL.value, s.lidL, s.slantL, s.winkL, live.blinkL);
  set(u.uLidR.value, s.lidR, s.slantR, s.winkR, live.blinkR);
  // The six drawings share the eye between them: together they are never more than all of it.
  const sum = Math.max(1, s.arc + s.heart + s.spiral + s.cross + s.chevron + s.ring);
  set(u.uGlyph.value, s.arc / sum, s.heart / sum, s.spiral / sum, s.cross / sum);
  set(u.uGlyph2.value, s.chevron / sum, s.ring / sum, live.spin, 0);
  set(u.uMouthA.value, s.cat, s.dash, s.smile, s.frown);
  set(u.uMouthB.value, s.open + live.talk, s.oh, s.wave, s.mouthH * (1 + 0.6 * live.talk));
  set(u.uMouthP.value, s.mouthW, s.mouthTilt, s.mouthX, s.mouthY);
  set(u.uMarkA.value, s.blush, s.tear, s.sweat, s.anger);
  set(u.uMarkB.value, s.note, s.zzz, s.tone, 0);
  set(u.uLive.value, live.lookX, live.lookY, live.on, live.pixel);
  set(u.uLive2.value, live.talk, live.glow, 0, 0);
}

/** The colours of the face, as the page's CSS would write them (sRGB). The cyan is the source's. */
export const FACE_CYAN = 0x16fdf5;
export const FACE_PINK = 0xff6fa8;
export const FACE_RED = 0xff3b3b;
export const FACE_BLUE = 0x8fd8ff;

/** Added to the head of the glass's vertex shader. */
export const FACE_VERTEX_HEAD = /* glsl */ `
uniform vec4 uScreen;
uniform vec3 uScreenRight;
uniform vec3 uScreenUp;
varying vec2 vFace;
`;

/**
 * Added after the vertex shader's `begin_vertex`. It reads the rest place (`position`), so the
 * face rides the morph targets and the skin with the glass.
 */
export const FACE_VERTEX_BODY = /* glsl */ `
vec3 bRel = vec3( position ) - uScreen.xyz;
vFace = vec2( dot( bRel, uScreenRight ), dot( bRel, uScreenUp ) ) * uScreen.w;
`;

/** Added to the head of the glass's fragment shader. */
export const FACE_FRAGMENT_HEAD = /* glsl */ `
uniform vec4 uEye;
uniform vec4 uEyeAt;
uniform vec4 uLidL;
uniform vec4 uLidR;
uniform vec4 uGlyph;
uniform vec4 uGlyph2;
uniform vec4 uMouthA;
uniform vec4 uMouthB;
uniform vec4 uMouthP;
uniform vec4 uMarkA;
uniform vec4 uMarkB;
uniform vec4 uLive;
uniform vec4 uLive2;
uniform vec3 uCyan;
uniform vec3 uPink;
uniform vec3 uRed;
uniform vec3 uBlue;
varying vec2 vFace;

float bDot2(vec2 v) { return dot(v, v); }

float bBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float bSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// An arc about the +y axis, opened by the angle whose sine and cosine are sc.
float bArc(vec2 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}

float bHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(bDot2(p - vec2(0.25, 0.75))) - 0.35355;
  return sqrt(min(bDot2(p - vec2(0.0, 1.0)), bDot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}

float bSpiral(vec2 p, float reach, float turn) {
  float r = length(p);
  float a = atan(p.y, p.x) + turn;
  float b = reach / 2.2;
  float d = abs(mod(r - b * a / 6.2831853, b) - b * 0.5) - b * 0.25;
  return max(d, r - reach);
}

// One eye. q.x grows toward the outer end; lid is (lid, slant, wink, blink).
float bEye(vec2 q, vec4 lid) {
  float w = uEye.x;
  float h = uEye.y;
  float m = min(w, h);
  float blink = lid.w;
  // A blink squashes the drawing toward its middle line.
  vec2 s = vec2(q.x, q.y / max(1.0 - blink, 0.08));
  float r = uEye.w * m;
  float c = min(uEye.z, m * 0.6);
  float box = min(bBox(s, vec2(w, h - c), r), bBox(s, vec2(w - c, h), r));
  float top = s.y - (h * (1.0 - 2.0 * lid.x) + lid.y * s.x);
  float low = -h * (1.0 - 2.0 * uEyeAt.z) - s.y;
  box = max(box, max(top, low));
  float wink = lid.z;
  vec4 g = uGlyph * (1.0 - wink);
  vec2 g2 = uGlyph2.xy * (1.0 - wink);
  g.x += wink;
  float plain = max(0.0, 1.0 - g.x - g.y - g.z - g.w - g2.x - g2.y);
  float big = max(w, h);
  float d = box * plain;
  if (g.x > 0.001) {
    float ra = max(w, 3.0) * 1.1;
    d += g.x * bArc(q - vec2(0.0, -ra * 0.45), vec2(0.866, 0.5), ra, 1.0);
  }
  if (g.y > 0.001) {
    float k = big * 1.25;
    d += g.y * bHeart(s / k + vec2(0.0, 0.5)) * k;
  }
  if (g.z > 0.001) d += g.z * bSpiral(s, big * 1.05, uGlyph2.z);
  if (g.w > 0.001) {
    float a = m * 0.95;
    d += g.w * (min(bSeg(s, vec2(-a), vec2(a)), bSeg(s, vec2(-a, a), vec2(a, -a))) - 1.0);
  }
  if (g2.x > 0.001) {
    float a = big * 0.6;
    float v = min(bSeg(s, vec2(a, a * 0.8), vec2(-a * 0.6, 0.0)), bSeg(s, vec2(-a * 0.6, 0.0), vec2(a, -a * 0.8)));
    d += g2.x * (v - 1.0);
  }
  if (g2.y > 0.001) d += g2.y * (abs(bBox(s, vec2(w, h), m * 0.95)) - 1.0);
  // Shut, every eye is the same short line.
  float line = bBox(q, vec2(max(w, 3.0), 1.0), 0.0);
  return mix(d, line, smoothstep(0.6, 1.0, blink));
}

// The source's cat mouth, as it is painted: two cups joined by a long row, a bump between them
// and an arm rising at each end. Boxes on the screen's cells (their middles are whole numbers);
// W stretches it sideways.
float bCat(vec2 m, float W) {
  vec2 p = vec2(abs(m.x) / max(W, 0.2), m.y);
  float d = bBox(p - vec2(4.5, 2.5), vec2(1.0, 1.5), 0.0);
  d = min(d, bBox(p - vec2(6.0, 0.5), vec2(1.5, 0.5), 0.0));
  d = min(d, bBox(p - vec2(0.0, -0.5), vec2(7.5, 0.5), 0.0));
  d = min(d, bBox(p - vec2(4.5, -1.5), vec2(3.0, 0.5), 0.0));
  d = min(d, bBox(p - vec2(3.5, -3.0), vec2(2.0, 1.0), 0.0));
  d = min(d, bBox(p - vec2(0.0, 1.0), vec2(1.5, 1.0), 0.0));
  return d * min(W, 1.0);
}

float bMouthShape(vec2 m) {
  float c = cos(uMouthP.y);
  float s = sin(uMouthP.y);
  m = vec2(c * m.x + s * m.y, -s * m.x + c * m.y);
  float W = uMouthP.x;
  float H = uMouthB.w;
  float sum = uMouthA.x + uMouthA.y + uMouthA.z + uMouthA.w + uMouthB.x + uMouthB.y + uMouthB.z;
  float d = 0.0;
  if (uMouthA.x > 0.001) d += uMouthA.x * bCat(m, W);
  if (uMouthA.y > 0.001) d += uMouthA.y * bBox(m, vec2(4.0 * W, 1.0), 0.0);
  if (uMouthA.z > 0.001) {
    float r = 5.0 * W;
    d += uMouthA.z * bArc(vec2(m.x, r - 1.0 - m.y), vec2(0.866, 0.5), r, 1.0);
  }
  if (uMouthA.w > 0.001) {
    float r = 5.0 * W;
    d += uMouthA.w * bArc(vec2(m.x, m.y + r - 1.0), vec2(0.866, 0.5), r, 1.0);
  }
  if (uMouthB.x > 0.001) {
    float r = 5.5 * W;
    vec2 o = vec2(m.x, (m.y - 1.0) / max(H, 0.2));
    d += uMouthB.x * max(length(o) - r, o.y) * min(H, 1.0);
  }
  if (uMouthB.y > 0.001) {
    vec2 o = vec2(m.x, m.y / max(H, 0.2));
    d += uMouthB.y * (abs(length(o) - 2.6 * W) - 1.0);
  }
  if (uMouthB.z > 0.001) {
    float k = 1.4 / max(W, 0.3);
    float y = 1.1 * sin(m.x * k);
    float g = 1.1 * k * cos(m.x * k);
    float v = abs(m.y - y) / sqrt(1.0 + g * g) - 1.0;
    d += uMouthB.z * max(v, abs(m.x) - 5.5 * W);
  }
  float lips = clamp(sum, 0.0, 1.0);
  if (lips < 0.001) return 1e3;
  return d / max(sum, 0.001) + (1.0 - lips) * 3.0;
}

// The marks, each grown from nothing by its weight.
float bGrow(float w) { return smoothstep(0.0, 1.0, w); }

float bBlush(vec2 q) {
  float g = bGrow(uMarkA.x);
  if (g < 0.001) return 1e3;
  vec2 b = (q - vec2(0.5, -uEye.y - 2.5)) / g;
  float d = 1e3;
  for (int k = -1; k <= 1; k++) {
    vec2 at = vec2(float(k) * 2.8, 0.0);
    d = min(d, bSeg(b, at + vec2(-0.8, -1.2), at + vec2(0.8, 1.2)));
  }
  return (d - 0.55) * g;
}

// A drop: round below, a point above.
float bDrop(vec2 p) {
  float tip = bSeg(p, vec2(0.0), vec2(0.0, 3.4)) - (2.0 - 0.6 * clamp(p.y / 3.4, 0.0, 1.0));
  return min(length(p) - 2.0, tip);
}

float bTear(vec2 q) {
  float g = bGrow(uMarkA.y);
  if (g < 0.001) return 1e3;
  return bDrop((q - vec2(uEye.x * 0.4, -uEye.y - 3.0 - 3.0 * g)) / g) * g;
}

// The marks sit high on the glass, clear of the eyes and of the crest's point.
float bSweat(vec2 f) {
  float g = bGrow(uMarkA.z);
  if (g < 0.001) return 1e3;
  return bDrop((f - vec2(19.5, 11.0)) / g) * g;
}

float bAnger(vec2 f) {
  float g = bGrow(uMarkA.w);
  if (g < 0.001) return 1e3;
  // Four corners round an empty middle: the cross-shaped vein of an angry face.
  vec2 p = abs((f - vec2(-18.0, 13.0)) / g);
  float d = min(bSeg(p, vec2(1.3, 3.1), vec2(1.3, 1.3)), bSeg(p, vec2(1.3, 1.3), vec2(3.1, 1.3)));
  return (d - 0.55) * g;
}

float bNote(vec2 f) {
  float g = bGrow(uMarkB.x);
  if (g < 0.001) return 1e3;
  vec2 p = (f - vec2(20.0, 12.0)) / g;
  float head = (length(vec2((p.x + 1.3) / 1.9, (p.y + 2.6) / 1.4)) - 1.0) * 1.4;
  float stem = bBox(p - vec2(0.1, 0.8), vec2(0.55, 3.4), 0.0);
  float flag = bSeg(p, vec2(0.4, 4.0), vec2(2.7, 1.6)) - 0.7;
  return min(head, min(stem, flag)) * g;
}

float bZzz(vec2 f) {
  float g = bGrow(uMarkB.y);
  if (g < 0.001) return 1e3;
  vec2 p = (f - vec2(20.0, 13.0)) / g;
  float d = min(bSeg(p, vec2(-2.0, 2.0), vec2(2.0, 2.0)), bSeg(p, vec2(2.0, 2.0), vec2(-2.0, -2.0)));
  d = min(d, bSeg(p, vec2(-2.0, -2.0), vec2(2.0, -2.0)));
  vec2 p2 = (p - vec2(-4.5, -4.0)) * 1.5;
  float d2 = min(bSeg(p2, vec2(-2.0, 2.0), vec2(2.0, 2.0)), bSeg(p2, vec2(2.0, 2.0), vec2(-2.0, -2.0)));
  d2 = min(d2, bSeg(p2, vec2(-2.0, -2.0), vec2(2.0, -2.0))) / 1.5;
  return (min(d, d2) - 0.6) * g;
}

// The four layers at one place of the glass, as distances (pixels, below 0 inside): the face's
// colour, the blush, the anger mark and the water (tears and sweat).
vec4 bLayers(vec2 f) {
  vec2 look = uLive.xy;
  vec2 e = f - look - vec2(0.0, uEyeAt.y);
  // The bunny's own left eye is on +x; q.x grows outward on both.
  vec2 qL = vec2(e.x - uEyeAt.x, e.y);
  vec2 qR = vec2(-(e.x + uEyeAt.x), e.y);
  float eyes = min(bEye(qL, uLidL), bEye(qR, uLidR));
  float mouth = bMouthShape(f - vec2(uMouthP.z + look.x * 0.5, uMouthP.w + look.y * 0.5));
  float ink = min(eyes, min(mouth, min(bNote(f), bZzz(f))));
  float blush = min(bBlush(qL), bBlush(qR));
  float water = min(min(bTear(qL), bTear(qR)), bSweat(f));
  return vec4(ink, blush, bAnger(f), water);
}

vec4 bLit(vec2 cell) { return vec4(1.0) - step(vec4(0.0), bLayers(cell)); }

vec3 bFace(vec3 glass, vec2 f) {
  vec2 w = max(fwidth(f), vec2(1e-4));
  float px = max(w.x, w.y);
  vec4 d = bLayers(f);
  vec4 cover = vec4(1.0) - smoothstep(vec4(-0.7 * px), vec4(0.7 * px), d);
  // On the screen's grid (a cell's middle is a whole number): the four cells round this point,
  // each lit or not, with a sharp but smooth step at the cell's edge. Under about two screen
  // pixels a cell, the grid would shimmer, so the drawing goes smooth.
  float grid = uLive.w * (1.0 - smoothstep(0.4, 0.6, px));
  if (grid > 0.001) {
    vec2 i = floor(f);
    vec2 k = clamp((f - i - 0.5) / w + 0.5, 0.0, 1.0);
    vec4 a = bLit(i);
    vec4 b = bLit(i + vec2(1.0, 0.0));
    vec4 c = bLit(i + vec2(0.0, 1.0));
    vec4 e = bLit(i + vec2(1.0, 1.0));
    cover = mix(cover, mix(mix(a, b, k.x), mix(c, e, k.x), k.y), grid);
  }
  float on = uLive.z;
  vec3 tone = mix(uCyan, uPink, uMarkB.z);
  vec3 color = glass + tone * exp(-max(d.x, 0.0) * 0.7) * 0.35 * uLive2.y * on;
  color = mix(color, uPink, cover.y * on);
  color = mix(color, tone, cover.x * on);
  color = mix(color, uRed, cover.z * on);
  color = mix(color, uBlue, cover.w * on);
  return color;
}
`;

/** Replaces the picture's own step in the glass's fragment shader: the glass, then the face on it. */
export const FACE_FRAGMENT_MAP = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  diffuseColor *= sampledDiffuseColor;
#endif
diffuseColor.rgb = bFace(diffuseColor.rgb, vFace);
`;
