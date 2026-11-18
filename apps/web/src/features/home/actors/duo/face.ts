/**
 * The faces of the two Guinevere drones on the home page. This is the screen shader of /about
 * (`features/about/companions/face.ts`) with the pieces an exaggerated performance needs: a lid, a
 * slant, a size, a turn and a height for each eye on its own, a brow over each eye, two more
 * drawings for the eye (a ring with a dot for a shock, a sparkle) and four more mouths (a wave, a
 * frown, bared teeth, a wide smile). Nothing is a picture: a face is about fifty numbers, any face
 * blends into any other, and a blink, a wink or a look is one more number.
 *
 * No three and no DOM here: the actor (the lazy chunk) and the unit tests read this file. Lengths
 * are in halves of the screen's width, as in the source. "Left" and "right" are the drone's two eyes
 * as the visitor sees them (left of the screen, right of the screen).
 */

/** One face, as the numbers the shader draws it from. */
export interface FaceShape {
  /** The eye's plain form, a rounded box: half its width, half its height, how round (0 to 1). */
  w: number;
  h: number;
  r: number;
  /** How far each eye is from the middle. */
  gap: number;
  /** How high each eye is on the screen. */
  eyeYL: number;
  eyeYR: number;
  /** How big each eye is (1 as drawn). */
  scaleL: number;
  scaleR: number;
  /** The upper lid of each eye (0 open, 1 shut) and its slant (above 0 the inner end is lower). */
  lidL: number;
  lidR: number;
  slantL: number;
  slantR: number;
  /** The lower lid, for a cheek that rises. */
  lidLowL: number;
  lidLowR: number;
  /** The turn of each eye, in radians (anticlockwise). */
  tiltL: number;
  tiltR: number;
  /** The brows: how far over the eye, the slant (above 0 the inner end is lower), the bow, how drawn. */
  browYL: number;
  browTiltL: number;
  browBowL: number;
  browOnL: number;
  browYR: number;
  browTiltR: number;
  browBowR: number;
  browOnR: number;
  /** How much of each other drawing the eye is: an arch, a heart, a spiral, a chevron, a ring, a sparkle. */
  arc: number;
  heart: number;
  spiral: number;
  chevron: number;
  ring: number;
  star: number;
  /** The mouth: a dash, a cat's "w", an open mouth, a small "o", a wave, a frown, teeth, a smile. */
  dash: number;
  cat: number;
  open: number;
  oh: number;
  wave: number;
  frown: number;
  grit: number;
  smile: number;
  /** The mouth's width (1 as drawn), its tilt in radians and its height on the screen. */
  mouthW: number;
  mouthTilt: number;
  mouthY: number;
  /** Three small strokes under each eye. */
  blush: number;
  /** 0 the screen's gold, 1 the red of a face that has flushed. */
  tone: number;
}

type Key = keyof FaceShape;

const BASE: FaceShape = {
  w: 0.1,
  h: 0.19,
  r: 0.7,
  gap: 0.4,
  eyeYL: 0.1,
  eyeYR: 0.1,
  scaleL: 1,
  scaleR: 1,
  lidL: 0,
  lidR: 0,
  slantL: 0,
  slantR: 0,
  lidLowL: 0,
  lidLowR: 0,
  tiltL: 0,
  tiltR: 0,
  browYL: 0.14,
  browTiltL: 0,
  browBowL: 0,
  browOnL: 0,
  browYR: 0.14,
  browTiltR: 0,
  browBowR: 0,
  browOnR: 0,
  arc: 0,
  heart: 0,
  spiral: 0,
  chevron: 0,
  ring: 0,
  star: 0,
  dash: 0,
  cat: 0,
  open: 0,
  oh: 0,
  wave: 0,
  frown: 0,
  grit: 0,
  smile: 0,
  mouthW: 1,
  mouthTilt: 0,
  mouthY: -0.3,
  blush: 0,
  tone: 0,
};

/** A preset's own words: the keys that stand for both eyes, and a key of one side. */
type Pair = "eyeY" | "scale" | "lid" | "slant" | "lidLow" | "tilt";
type BrowPair = "browY" | "browTilt" | "browBow" | "browOn";
type Spec = Partial<FaceShape> & Partial<Record<Pair | BrowPair, number>>;

const PAIRS: ReadonlyArray<Pair | BrowPair> = [
  "eyeY",
  "scale",
  "lid",
  "slant",
  "lidLow",
  "tilt",
  "browY",
  "browTilt",
  "browBow",
  "browOn",
];

/** Build a face from the base and some words. A shared word is written to both sides first. */
function face(spec: Spec): FaceShape {
  const out: FaceShape = { ...BASE };
  for (const word of PAIRS) {
    const v = spec[word];
    if (v === undefined) continue;
    out[`${word}L` as Key] = v;
    out[`${word}R` as Key] = v;
  }
  for (const key of Object.keys(spec) as Array<keyof Spec>) {
    const v = spec[key];
    if (v === undefined || (PAIRS as readonly string[]).includes(key)) continue;
    out[key as Key] = v;
  }
  return out;
}

/**
 * The faces. The first twelve are /about's own (the two resting faces, bars, happy, glad, angry,
 * wide, dizzy, love, squeeze, flat, shy). The rest are for a performance that is allowed to
 * exaggerate: every one reads at 120 px tall and at 600 px.
 */
export const FACES = {
  /** Slanted eyes and a crooked dash: the face of the splash art. */
  bold: face({
    w: 0.17,
    h: 0.15,
    r: 0.55,
    lid: 0.3,
    slant: 0.5,
    dash: 1,
    mouthW: 0.8,
    mouthTilt: 0.3,
  }),
  /** Tall rounded eyes and a cat's mouth: the calm face of the films. */
  soft: face({ w: 0.105, h: 0.18, r: 1, cat: 1, mouthW: 0.9 }),
  /** Two thin bars and a dash: at attention. */
  bars: face({ w: 0.06, h: 0.2, r: 0.5, dash: 1, mouthW: 0.7 }),
  /** Arches, an open mouth and a blush: happy. */
  happy: face({ w: 0.15, h: 0.15, arc: 1, open: 1, blush: 1, eyeY: 0.14, mouthY: -0.16 }),
  /** Arches and a cat's mouth: pleased. */
  glad: face({ w: 0.15, h: 0.15, arc: 1, cat: 1, eyeY: 0.12 }),
  /** Big slanted eyes, no mouth: angry. */
  angry: face({ w: 0.22, h: 0.19, r: 0.5, lid: 0.42, slant: 0.75, gap: 0.42, eyeY: 0.06 }),
  /** Round and wide, with a small "o": startled. */
  wide: face({ w: 0.18, h: 0.18, r: 1, oh: 1, gap: 0.42 }),
  /** Spirals and a crooked dash: knocked silly. */
  dizzy: face({ w: 0.19, h: 0.19, spiral: 1, dash: 1, mouthW: 1.1, mouthTilt: -0.45, gap: 0.42 }),
  /** Hearts and an open mouth, in red. */
  love: face({
    w: 0.17,
    h: 0.17,
    heart: 1,
    open: 1,
    mouthW: 0.6,
    mouthY: -0.22,
    tone: 1,
    gap: 0.42,
  }),
  /** Squeezed shut, mouth open: an effort, or a laugh. */
  squeeze: face({ w: 0.15, h: 0.15, chevron: 1, open: 1, mouthW: 0.8, mouthY: -0.18 }),
  /** Half shut and level, with a flat dash: not impressed. */
  flat: face({ w: 0.16, h: 0.15, r: 0.5, lid: 0.5, dash: 1 }),
  /** The outer ends down, a small "o", a blush: shy, or worried. */
  shy: face({
    w: 0.12,
    h: 0.16,
    r: 0.9,
    lid: 0.22,
    slant: -0.4,
    oh: 1,
    mouthW: 0.6,
    blush: 1,
    eyeY: 0.06,
  }),

  /** One eye big and turned, the other small, one brow high and one low, a wavy mouth. */
  confused: face({
    w: 0.12,
    h: 0.17,
    r: 0.9,
    eyeYL: 0.12,
    eyeYR: 0.06,
    scaleL: 1.3,
    scaleR: 0.72,
    tiltL: 0.28,
    tiltR: -0.2,
    lidR: 0.18,
    slantR: 0.25,
    browYL: 0.16,
    browTiltL: -0.12,
    browBowL: 0.9,
    browOnL: 1,
    browYR: 0.12,
    browTiltR: 0.38,
    browOnR: 1,
    wave: 1,
    mouthW: 1.5,
    mouthTilt: 0.14,
    mouthY: -0.3,
  }),
  /** Spirals for eyes, one brow up, a wavy mouth: the confusion at its peak. */
  befuddled: face({
    w: 0.19,
    h: 0.19,
    spiral: 1,
    gap: 0.42,
    eyeYL: 0.1,
    eyeYR: 0.07,
    browYL: 0.18,
    browBowL: 1,
    browOnL: 1,
    browYR: 0.17,
    browTiltR: 0.3,
    browOnR: 1,
    wave: 1,
    mouthW: 1.05,
    mouthTilt: -0.2,
  }),
  /** `> <` with bared teeth and heavy brows: pulling with everything it has. */
  effort: face({
    w: 0.16,
    h: 0.16,
    chevron: 1,
    grit: 1,
    mouthW: 1.05,
    mouthY: -0.22,
    browY: 0.18,
    browTilt: 0.34,
    browOn: 1,
    tone: 0.25,
  }),
  /** Narrowed eyes, teeth, a flushed screen: past the limit. */
  strain: face({
    w: 0.19,
    h: 0.17,
    r: 0.5,
    lid: 0.45,
    slant: 0.7,
    gap: 0.42,
    eyeY: 0.07,
    grit: 1,
    mouthW: 1.15,
    mouthY: -0.24,
    browY: 0.14,
    browTilt: 0.5,
    browOn: 1,
    tone: 0.8,
  }),
  /** A ring with a dot for each eye, a wide "o", brows flung up: a shock. */
  surprise: face({
    w: 0.19,
    h: 0.19,
    r: 1,
    ring: 1,
    oh: 1,
    gap: 0.43,
    eyeY: 0.12,
    mouthW: 1.2,
    mouthY: -0.3,
    browY: 0.17,
    browBow: 0.8,
    browOn: 1,
  }),
  /** Half lids, one brow cocked, a crooked smile: pleased with itself. */
  smug: face({
    w: 0.16,
    h: 0.15,
    r: 0.5,
    lid: 0.46,
    eyeY: 0.08,
    smile: 1,
    mouthW: 0.8,
    mouthTilt: 0.28,
    mouthY: -0.24,
    browYL: 0.17,
    browOnL: 1,
    browYR: 0.2,
    browBowR: 0.8,
    browOnR: 1,
    browTiltR: -0.1,
  }),
  /** Flat lids, level brows pulled low, a small frown: this again. */
  annoyed: face({
    w: 0.16,
    h: 0.15,
    r: 0.5,
    lid: 0.52,
    slant: 0.14,
    eyeY: 0.07,
    frown: 1,
    mouthW: 0.8,
    mouthY: -0.26,
    browY: 0.1,
    browTilt: 0.22,
    browOn: 1,
  }),
  /** Sparkles for eyes, a big open mouth, a blush: delight (no brows: the sparkles take the room). */
  joy: face({
    w: 0.17,
    h: 0.17,
    star: 1,
    open: 1,
    blush: 1,
    gap: 0.42,
    eyeY: 0.14,
    mouthW: 1,
    mouthY: -0.17,
  }),
  /** Closed arches, a soft smile, a blush and gentle brows: thank you. */
  thanks: face({
    w: 0.15,
    h: 0.15,
    arc: 1,
    smile: 1,
    blush: 1,
    eyeY: 0.13,
    mouthW: 0.9,
    mouthY: -0.2,
    browY: 0.2,
    browBow: 0.7,
    browTilt: -0.12,
    browOn: 1,
  }),
  /** Brows up at the inner ends, wide eyes, a small frown: concern. */
  worry: face({
    w: 0.14,
    h: 0.19,
    r: 1,
    gap: 0.41,
    eyeY: 0.1,
    lidLow: 0.05,
    frown: 1,
    wave: 0.4,
    mouthW: 0.7,
    mouthY: -0.28,
    browY: 0.17,
    browTilt: -0.42,
    browBow: 0.4,
    browOn: 1,
  }),
} satisfies Record<string, FaceShape>;

export type FaceName = keyof typeof FACES;

const KEYS = Object.keys(BASE) as Key[];

/** Every face, by name, for a test or a probe to walk through. */
export const FACE_NAMES = Object.keys(FACES) as FaceName[];

export const copyFace = (out: FaceShape, from: FaceShape): FaceShape => Object.assign(out, from);

/** `out` becomes the face `t` of the way from `a` to `b`. */
export function blendFace(out: FaceShape, a: FaceShape, b: FaceShape, t: number): FaceShape {
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

/** How unlike two faces are: above about 0.5 they are different drawings, not two sizes of one. */
export function faceDistance(a: FaceShape, b: FaceShape): number {
  return (
    Math.abs(a.arc - b.arc) +
    Math.abs(a.heart - b.heart) +
    Math.abs(a.spiral - b.spiral) +
    Math.abs(a.chevron - b.chevron) +
    Math.abs(a.ring - b.ring) +
    Math.abs(a.star - b.star)
  );
}

/** Whether the eyes of a face are shut or drawn as a symbol, so that a blink would not be seen. */
export function eyesAreSymbols(s: FaceShape): boolean {
  return s.arc + s.chevron + s.spiral + s.star > 0.5;
}

/** What changes every frame, beside the shape. */
export interface FaceLive {
  /** 0 open, 1 shut, for the eye on the left of the screen and the one on the right. */
  blinkL: number;
  blinkR: number;
  /** Where the eyes look, in halves of the screen's width. */
  lookX: number;
  lookY: number;
  /** 0 a dark screen, 1 the face lit. */
  on: number;
  /** The turn of the spirals, in radians. */
  spin: number;
}

/** The uniforms of one screen. Arrays, so this file needs no three: the renderer reads them as vectors. */
export interface FaceUniforms {
  uEye: { value: number[] };
  uLay: { value: number[] };
  uLidL: { value: number[] };
  uLidR: { value: number[] };
  uBrowL: { value: number[] };
  uBrowR: { value: number[] };
  uGlyph: { value: number[] };
  uGlyph2: { value: number[] };
  uMouth: { value: number[] };
  uMouth2: { value: number[] };
  uMouthP: { value: number[] };
  uLive: { value: number[] };
  uTone: { value: number[] };
  /** The screen's middle height in the mesh's own metres, and one over half its width. */
  uScreen: { value: number[] };
  /** Linear colours: the gold of the eyes, the red of a flushed face, the blush. */
  uGold: { value: number[] };
  uRed: { value: number[] };
  uPink: { value: number[] };
}

export function makeFaceUniforms(): FaceUniforms {
  const four = () => ({ value: [0, 0, 0, 0] });
  return {
    uEye: { value: [0.1, 0.19, 0.7, 0.4] },
    uLay: { value: [0.1, 0.1, 1, 1] },
    uLidL: four(),
    uLidR: four(),
    uBrowL: four(),
    uBrowR: four(),
    uGlyph: four(),
    uGlyph2: four(),
    uMouth: four(),
    uMouth2: four(),
    uMouthP: { value: [1, 0, -0.3, 0] },
    uLive: four(),
    uTone: { value: [0, 1, 0, 0] },
    uScreen: { value: [0, 1] },
    uGold: { value: [1, 0.65, 0.05] },
    uRed: { value: [1, 0.08, 0.1] },
    uPink: { value: [1, 0.3, 0.4] },
  };
}

const set4 = (t: number[], a: number, b: number, c: number, d: number): void => {
  t[0] = a;
  t[1] = b;
  t[2] = c;
  t[3] = d;
};

/** Write a face into its uniforms. Allocates nothing. */
export function packFace(u: FaceUniforms, s: FaceShape, live: FaceLive): void {
  set4(u.uEye.value, s.w, s.h, s.r, s.gap);
  set4(u.uLay.value, s.eyeYL, s.eyeYR, s.scaleL, s.scaleR);
  set4(u.uLidL.value, s.lidL, s.slantL, s.lidLowL, s.tiltL);
  set4(u.uLidR.value, s.lidR, s.slantR, s.lidLowR, s.tiltR);
  set4(u.uBrowL.value, s.browYL, s.browTiltL, s.browBowL, s.browOnL);
  set4(u.uBrowR.value, s.browYR, s.browTiltR, s.browBowR, s.browOnR);
  // The drawings share the eye between them: together they are never more than all of it.
  const sum = Math.max(1, s.arc + s.heart + s.spiral + s.chevron + s.ring + s.star);
  set4(u.uGlyph.value, s.arc / sum, s.heart / sum, s.spiral / sum, s.chevron / sum);
  set4(u.uGlyph2.value, s.ring / sum, s.star / sum, 0, 0);
  set4(u.uMouth.value, s.dash, s.cat, s.open, s.oh);
  set4(u.uMouth2.value, s.wave, s.frown, s.grit, s.smile);
  set4(u.uMouthP.value, s.mouthW, s.mouthTilt, s.mouthY, s.blush);
  set4(u.uLive.value, live.blinkL, live.blinkR, live.lookX, live.lookY);
  set4(u.uTone.value, s.tone, live.on, live.spin, 0);
}

/** The colours of the face, as the page's CSS would write them (sRGB). */
export const FACE_GOLD = 0xffd53e;
export const FACE_RED = 0xff4a55;
export const FACE_PINK = 0xff8fa6;

/** Added to the head of the screen's vertex shader. */
export const FACE_VERTEX_HEAD = /* glsl */ `
uniform vec2 uScreen;
varying vec2 vFace;
`;

/** Added after the vertex shader has its `transformed` (the place in the mesh's own frame). */
export const FACE_VERTEX_BODY = /* glsl */ `
vFace = vec2(position.x, position.y - uScreen.x) * uScreen.y;
`;

/** Added to the head of the screen's fragment shader. */
export const FACE_FRAGMENT_HEAD = /* glsl */ `
uniform vec4 uEye;
uniform vec4 uLay;
uniform vec4 uLidL;
uniform vec4 uLidR;
uniform vec4 uBrowL;
uniform vec4 uBrowR;
uniform vec4 uGlyph;
uniform vec4 uGlyph2;
uniform vec4 uMouth;
uniform vec4 uMouth2;
uniform vec4 uMouthP;
uniform vec4 uLive;
uniform vec4 uTone;
uniform vec3 uGold;
uniform vec3 uRed;
uniform vec3 uPink;
varying vec2 vFace;

float cDot2(vec2 v) { return dot(v, v); }

float cBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float cSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// An arc about the +y axis, opened by the angle whose sine and cosine are sc.
float cArc(vec2 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}

float cHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(cDot2(p - vec2(0.25, 0.75))) - 0.35355;
  return sqrt(min(cDot2(p - vec2(0.0, 1.0)), cDot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}

float cSpiral(vec2 p, float reach, float turn) {
  float r = length(p);
  float a = atan(p.y, p.x) + turn;
  float b = reach / 2.3;
  float d = abs(mod(r - b * a / 6.2831853, b) - b * 0.5) - b * 0.23;
  return max(d, r - reach);
}

vec2 cRot(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// One eye. q.x grows toward the outer end of the eye. lid is (lid, slant, lidLow, tilt).
float cEye(vec2 q, float blink, vec4 lid, float size) {
  q = cRot(q, -lid.w) / size;
  float w = uEye.x;
  float h = uEye.y;
  float big = max(w, h);
  // A blink squashes the drawing toward its middle line.
  vec2 s = vec2(q.x, q.y / max(1.0 - blink, 0.08));
  float box = cBox(s, vec2(w, h), uEye.z * min(w, h));
  float top = s.y - (h * (1.0 - 2.0 * lid.x) + lid.y * s.x);
  float low = -h * (1.0 - 2.0 * lid.z) - s.y;
  box = max(box, max(top, low));
  float plain = 1.0 - uGlyph.x - uGlyph.y - uGlyph.z - uGlyph.w - uGlyph2.x - uGlyph2.y;
  float d = box * plain;
  if (uGlyph.x > 0.001) {
    d += uGlyph.x * cArc(s + vec2(0.0, big * 0.42), vec2(0.9490, 0.3153), big * 0.95, 0.034);
  }
  if (uGlyph.y > 0.001) {
    float k = big * 2.25;
    d += uGlyph.y * cHeart(s / k + vec2(0.0, 0.56)) * k;
  }
  if (uGlyph.z > 0.001) {
    d += uGlyph.z * cSpiral(s, big * 1.08, uTone.z);
  }
  if (uGlyph.w > 0.001) {
    float a = big * 0.92;
    float v = min(cSeg(s, vec2(a, a * 0.82), vec2(-a * 0.55, 0.0)), cSeg(s, vec2(-a * 0.55, 0.0), vec2(a, -a * 0.82)));
    d += uGlyph.w * (v - 0.036);
  }
  if (uGlyph2.x > 0.001) {
    // A ring with a small dot in it: wide open eyes.
    float ring = abs(cBox(s, vec2(w, h) * 1.1, big * 0.9) + 0.012) - 0.017;
    float pupil = length(s) - 0.036;
    d += uGlyph2.x * min(ring, pupil);
  }
  if (uGlyph2.y > 0.001) {
    // A four pointed sparkle: two thin lenses across each other, each a true distance.
    float a = big * 1.7;
    float t = big * 0.42;
    float lh = max(abs(s.y) - t * (1.0 - abs(s.x) / a), abs(s.x) - a);
    float lv = max(abs(s.x) - t * (1.0 - abs(s.y) / a), abs(s.y) - a);
    d += uGlyph2.y * min(lh, lv);
  }
  // Shut, every eye is the same short line.
  float line = cBox(q, vec2(max(w, 0.11) * 1.05, 0.022), 0.022);
  return mix(d, line, smoothstep(0.6, 1.0, blink)) * size;
}

// A brow over an eye, in the eye's frame (q.x grows outward). b is (height, slant, bow, drawn).
float cBrow(vec2 q, vec4 b) {
  if (b.w < 0.001) return 1.0;
  float reach = max(uEye.x, 0.1) * 1.25;
  float cy = uEye.y + b.x;
  float c = cos(b.y);
  float s = sin(b.y);
  // The inner end is the low end for a slant above 0.
  // The glass ends a little over the eye: a brow is kept on it, the slant flattens at the top.
  float top = 0.37;
  vec2 pin = vec2(-reach * c, min(cy - reach * s, top));
  vec2 pout = vec2(reach * c, min(cy + reach * s, top));
  vec2 pmid = vec2(0.0, min(cy + b.z * 0.045, top));
  float d = min(cSeg(q, pin, pmid), cSeg(q, pmid, pout)) - 0.021;
  return mix(1.0, d, b.w);
}

float cWave(vec2 m, float W) {
  float x = clamp(m.x, -0.075 * W, 0.075 * W);
  float y = 0.03 * sin(x * (46.0 / W));
  return length(vec2(m.x - x, m.y - y)) - 0.017;
}

float cMouthShape(vec2 m) {
  float c = cos(uMouthP.y);
  float s = sin(uMouthP.y);
  m = vec2(c * m.x + s * m.y, -s * m.x + c * m.y);
  float W = uMouthP.x;
  float sum = uMouth.x + uMouth.y + uMouth.z + uMouth.w + uMouth2.x + uMouth2.y + uMouth2.z + uMouth2.w;
  float d = 0.0;
  if (uMouth.x > 0.001) d += uMouth.x * cBox(m, vec2(0.085 * W, 0.022), 0.022);
  if (uMouth.y > 0.001) {
    d += uMouth.y * cArc(vec2(abs(m.x) - 0.058 * W, 0.03 - m.y), vec2(0.9636, 0.2675), 0.058 * W, 0.02);
  }
  if (uMouth.z > 0.001) {
    float open = max(length(m - vec2(0.0, 0.05)) - 0.16 * W, m.y - 0.05);
    d += uMouth.z * (open - 0.012);
  }
  if (uMouth.w > 0.001) d += uMouth.w * (abs(length(m) - 0.05 * W) - 0.02);
  if (uMouth2.x > 0.001) d += uMouth2.x * cWave(m, W);
  if (uMouth2.y > 0.001) {
    d += uMouth2.y * cArc(vec2(m.x, -(-m.y - 0.07)), vec2(0.8, 0.6), 0.085 * W, 0.019);
  }
  if (uMouth2.z > 0.001) {
    // Bared teeth: a box, a line across and two between.
    vec2 b = vec2(0.105 * W, 0.05);
    float outline = abs(cBox(m, b, 0.026)) - 0.012;
    float teeth = min(abs(m.x) - 0.002, abs(abs(m.x) - 0.05 * W) - 0.002);
    float bars = max(teeth, abs(m.y) - b.y);
    float mid = max(abs(m.y) - 0.002, abs(m.x) - b.x);
    d += uMouth2.z * min(outline, min(bars, mid));
  }
  if (uMouth2.w > 0.001) {
    d += uMouth2.w * cArc(vec2(m.x, 0.05 - m.y), vec2(0.8, 0.6), 0.09 * W, 0.02);
  }
  return d / max(sum, 0.001);
}

float cBlush(vec2 q) {
  vec2 b = q - vec2(0.03, -uEye.y - 0.12);
  float d = 1.0;
  for (int k = -1; k <= 1; k++) {
    vec2 at = vec2(float(k) * 0.065, 0.0);
    d = min(d, cSeg(b, at + vec2(-0.012, -0.028), at + vec2(0.012, 0.028)));
  }
  return d - 0.011;
}

float cInk(float d) {
  float e = max(fwidth(d), 0.0001);
  return 1.0 - smoothstep(-e, e, d);
}

vec3 cFace(vec3 glass, vec2 f) {
  vec3 tone = mix(uGold, uRed, uTone.x);
  vec2 look = uLive.zw;
  vec2 left = vec2(-(f.x - look.x + uEye.w), f.y - look.y - uLay.x);
  vec2 right = vec2(f.x - look.x - uEye.w, f.y - look.y - uLay.y);
  float dl = cEye(left, uLive.x, uLidL, uLay.z);
  float dr = cEye(right, uLive.y, uLidR, uLay.w);
  float bl = cBrow(left, uBrowL);
  float br = cBrow(right, uBrowR);
  float eyes = min(min(dl, dr), min(bl, br));
  float lips = clamp(uMouth.x + uMouth.y + uMouth.z + uMouth.w + uMouth2.x + uMouth2.y + uMouth2.z + uMouth2.w, 0.0, 1.0);
  float dm = cMouthShape(f - vec2(look.x * 0.5, uMouthP.z + look.y * 0.5));
  // A soft light round what is lit, as a screen has.
  float halo = exp(-max(eyes, 0.0) * 13.0) * 0.2 + exp(-max(dm, 0.0) * 16.0) * 0.1 * lips;
  vec3 color = glass + tone * halo * uTone.y;
  float blush = max(cInk(cBlush(left)), cInk(cBlush(right))) * uMouthP.w;
  color = mix(color, uPink, blush * 0.9 * uTone.y);
  color = mix(color, tone, cInk(eyes) * uTone.y);
  color = mix(color, tone, cInk(dm) * lips * uTone.y);
  return color;
}
`;

/** Replaces the picture's own step in the fragment shader: the glass, then the face on it. */
export const FACE_FRAGMENT_MAP = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  diffuseColor *= sampledDiffuseColor;
#endif
diffuseColor.rgb = cFace(diffuseColor.rgb, vFace);
`;
