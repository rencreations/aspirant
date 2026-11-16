/**
 * The face on a companion's screen. Nothing of it is in a picture: the eyes, the mouth and the
 * blush are drawn by the screen's shader from a handful of numbers, so a face can turn into any
 * other with no step, at any size, and a blink or a look is one more number. The drawings follow
 * the faces these drones wear in the game's own art and films (the list is in
 * `scripts/about/companions/README.md`).
 *
 * No three and no DOM here: the scene (the lazy chunk) and the build's check pictures both read
 * this file.
 */

/** One face, as the numbers the shader draws it from. Lengths are in halves of the screen's width. */
export interface FaceShape {
  /** The eye's plain form, a rounded box: half its width, half its height, how round (0 to 1). */
  w: number;
  h: number;
  r: number;
  /** How far each eye is from the middle, and how high the eyes are. */
  gap: number;
  eyeY: number;
  /** The upper lid (0 open, 1 shut) and its slant (above 0 the inner end is lower: a frown). */
  lid: number;
  slant: number;
  /** The lower lid, for a cheek that rises. */
  lidLow: number;
  /** How much of each other drawing the eye is: an arch, a heart, a spiral, a chevron. */
  arc: number;
  heart: number;
  spiral: number;
  chevron: number;
  /** The mouth: a dash, a cat's "w", an open mouth, a small "o". None of them: no mouth. */
  dash: number;
  cat: number;
  open: number;
  oh: number;
  /** The mouth's width (1 as drawn), its tilt in radians and its height on the screen. */
  mouthW: number;
  mouthTilt: number;
  mouthY: number;
  /** Three small strokes under each eye. */
  blush: number;
  /** 0 the screen's gold, 1 the red of the hearts. */
  tone: number;
}

const BASE: FaceShape = {
  w: 0.1,
  h: 0.19,
  r: 0.7,
  gap: 0.4,
  eyeY: 0.1,
  lid: 0,
  slant: 0,
  lidLow: 0,
  arc: 0,
  heart: 0,
  spiral: 0,
  chevron: 0,
  dash: 0,
  cat: 0,
  open: 0,
  oh: 0,
  mouthW: 1,
  mouthTilt: 0,
  mouthY: -0.3,
  blush: 0,
  tone: 0,
};

const face = (over: Partial<FaceShape>): FaceShape => ({ ...BASE, ...over });

/**
 * The faces. `bold` and `soft` are the two drones' own resting faces: slanted, sure eyes with a
 * crooked mouth for the first, tall rounded eyes over a cat's mouth for the second.
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
  /** Arches, an open mouth and a blush: the happy face of the trailer. */
  happy: face({ w: 0.15, h: 0.15, arc: 1, open: 1, blush: 1, eyeY: 0.14, mouthY: -0.16 }),
  /** Arches and a cat's mouth: pleased. */
  glad: face({ w: 0.15, h: 0.15, arc: 1, cat: 1, eyeY: 0.12 }),
  /** Big slanted eyes, no mouth: angry. */
  angry: face({ w: 0.22, h: 0.19, r: 0.5, lid: 0.42, slant: 0.75, gap: 0.42, eyeY: 0.06 }),
  /** Round and wide, with a small "o": startled. */
  wide: face({ w: 0.18, h: 0.18, r: 1, oh: 1, gap: 0.42 }),
  /** Spirals and a crooked dash: knocked silly. */
  dizzy: face({ w: 0.19, h: 0.19, spiral: 1, dash: 1, mouthW: 1.1, mouthTilt: -0.45, gap: 0.42 }),
  /** Hearts and an open mouth, in red: the face the model was painted with. */
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
} satisfies Record<string, FaceShape>;

export type FaceName = keyof typeof FACES;

const KEYS = Object.keys(BASE) as Array<keyof FaceShape>;

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
    Math.abs(a.chevron - b.chevron)
  );
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
  uLid: { value: number[] };
  uGlyph: { value: number[] };
  uMouth: { value: number[] };
  uMouthP: { value: number[] };
  uLive: { value: number[] };
  uTone: { value: number[] };
  /** The screen's middle height in the mesh's own metres, and one over half its width. */
  uScreen: { value: number[] };
  /** Linear colours: the gold of the eyes, the red of the hearts, the blush. */
  uGold: { value: number[] };
  uRed: { value: number[] };
  uPink: { value: number[] };
}

export function makeFaceUniforms(): FaceUniforms {
  return {
    uEye: { value: [0.1, 0.19, 0.7, 0.4] },
    uLid: { value: [0, 0, 0, 0.1] },
    uGlyph: { value: [0, 0, 0, 0] },
    uMouth: { value: [0, 0, 0, 0] },
    uMouthP: { value: [1, 0, -0.3, 0] },
    uLive: { value: [0, 0, 0, 0] },
    uTone: { value: [0, 1, 0, 0] },
    uScreen: { value: [0, 1] },
    uGold: { value: [1, 0.65, 0.05] },
    uRed: { value: [1, 0.08, 0.1] },
    uPink: { value: [1, 0.3, 0.4] },
  };
}

/** Write a face into its uniforms. */
export function packFace(u: FaceUniforms, s: FaceShape, live: FaceLive): void {
  const set = (target: number[], a: number, b: number, c: number, d: number) => {
    target[0] = a;
    target[1] = b;
    target[2] = c;
    target[3] = d;
  };
  set(u.uEye.value, s.w, s.h, s.r, s.gap);
  set(u.uLid.value, s.lid, s.slant, s.lidLow, s.eyeY);
  // The four drawings share the eye between them: together they are never more than all of it.
  const sum = Math.max(1, s.arc + s.heart + s.spiral + s.chevron);
  set(u.uGlyph.value, s.arc / sum, s.heart / sum, s.spiral / sum, s.chevron / sum);
  set(u.uMouth.value, s.dash, s.cat, s.open, s.oh);
  set(u.uMouthP.value, s.mouthW, s.mouthTilt, s.mouthY, s.blush);
  set(u.uLive.value, live.blinkL, live.blinkR, live.lookX, live.lookY);
  set(u.uTone.value, s.tone, live.on, live.spin, 0);
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
uniform vec4 uLid;
uniform vec4 uGlyph;
uniform vec4 uMouth;
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

// One eye. q.x grows toward the outer end of the eye.
float cEye(vec2 q, float blink) {
  float w = uEye.x;
  float h = uEye.y;
  float big = max(w, h);
  // A blink squashes the drawing toward its middle line.
  vec2 s = vec2(q.x, q.y / max(1.0 - blink, 0.08));
  float box = cBox(s, vec2(w, h), uEye.z * min(w, h));
  float top = s.y - (h * (1.0 - 2.0 * uLid.x) + uLid.y * s.x);
  float low = -h * (1.0 - 2.0 * uLid.z) - s.y;
  box = max(box, max(top, low));
  float d = box * (1.0 - uGlyph.x - uGlyph.y - uGlyph.z - uGlyph.w);
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
  // Shut, every eye is the same short line.
  float line = cBox(q, vec2(max(w, 0.11) * 1.05, 0.022), 0.022);
  return mix(d, line, smoothstep(0.6, 1.0, blink));
}

float cMouthShape(vec2 m) {
  float c = cos(uMouthP.y);
  float s = sin(uMouthP.y);
  m = vec2(c * m.x + s * m.y, -s * m.x + c * m.y);
  float W = uMouthP.x;
  float sum = uMouth.x + uMouth.y + uMouth.z + uMouth.w;
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
  vec2 left = vec2(-(f.x - look.x + uEye.w), f.y - look.y - uLid.w);
  vec2 right = vec2(f.x - look.x - uEye.w, f.y - look.y - uLid.w);
  float dl = cEye(left, uLive.x);
  float dr = cEye(right, uLive.y);
  float eyes = min(dl, dr);
  float lips = clamp(uMouth.x + uMouth.y + uMouth.z + uMouth.w, 0.0, 1.0);
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
