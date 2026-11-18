/**
 * The arithmetic of the logo actor, in plain functions. The vertex shader in `shader.ts` is the same
 * formulas in GLSL, and `warpPoint` here is the CPU copy of it: it feeds the carry sockets and the
 * tests. When one changes, the other changes with it.
 *
 * Frames. Logo units are the vector's own (`viewBox` 3018 by 897, y down in the data). Everything
 * the actor draws is in the stage's pixel frame: the origin is the middle of the viewport, x goes
 * right, y goes up, one unit is one CSS pixel at z = 0, z points at the camera. A point of the logo
 * is written `(lx, ly)` in logo units from the centre of the art, y up.
 *
 * The art does not fill the viewBox (136 units of margin on the left, 94 on the top), so every rect
 * here is the art's box: aspect `ART_ASPECT` (4.013), not the viewBox's 3.364.
 */

/** The viewBox of the vector (`LOGO.viewBox`). */
const VIEWBOX = { w: 3018, h: 897 } as const;

/** The art's box in logo units (measured by sampling the outline's Beziers), y down. */
export const ART = { x: 136, y: 94.017, w: 2708.213, h: 674.833 } as const;
export const ART_ASPECT = ART.w / ART.h;
/** The centre of the art in logo units, y down. */
export const ART_CENTRE = { x: ART.x + ART.w / 2, y: ART.y + ART.h / 2 } as const;

/** Transparent margin around the art in every texture, in logo units (so a mip never shows a rim). */
const PAD = 24;
/** The region the textures and the quad cover: the art plus its margin. */
export const REG = {
  x: ART.x - PAD,
  y: ART.y - PAD,
  w: ART.w + 2 * PAD,
  h: ART.h + 2 * PAD,
} as const;

/** Vertices of the quad: one every 14 units across, enough for a 1.15 cycle wave. */
export const SEG_X = 192;
export const SEG_Y = 56;

/** The wave of the morph, numbers from the notes (`docs/design/home-reference/logo-wave-morph.md`). */
export const WAVE = {
  /** Crest height as a fraction of the logo's current height. */
  amp: 0.36,
  /** Wavelengths across the logo. */
  cycles: 1.15,
  /** Wavelengths a crest travels over the whole morph. */
  run: 2.2,
  /** Sideways push of the wave, as a fraction of its lift. */
  lateral: 0.2,
  /** Fold shading on the slope of the wave. */
  shade: 0.14,
  /** Chromatic split along the slope, in texels per unit of slope. */
  split: 0.8 * 6,
} as const;

/** The deepest sag of a carried logo, as a fraction of the art's height (tension 0). */
const SAG_MAX = 0.5 * ART.h;
/** The hover ripple: lift in logo units, falloff, wavelength and speed. */
export const RIPPLE = { lift: 38, reach: 320, length: 46, speed: 9 } as const;
/** How far the not yet revealed part of the logo sits below its place, as a fraction of its height. */
export const REVEAL_DROP = 0.45;
/** The width of the reveal front, as a fraction of the logo's width. */
export const REVEAL_EDGE = 0.35;
/** From this progress on the actor is the nav logo, and the section hands over to the DOM one. */
export const HANDOFF_AT = 0.999;

export const clamp = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hermite smoothstep with the edges the other way round allowed (a > b is treated as a < b). */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------------------------
// Rects

/**
 * Where the art is, in the stage frame: the centre and the width (the height follows from the art's
 * aspect). `y` goes up, so a rect near the top of the screen has a positive `cy`.
 */
export interface LogoRect {
  cx: number;
  cy: number;
  width: number;
}

export const rectHeight = (r: LogoRect): number => r.width / ART_ASPECT;
/** CSS pixels per logo unit for a rect. */
export const rectScale = (r: LogoRect): number => r.width / ART.w;

/**
 * How wide the big logo is: 70 percent of the viewport width, but never more than 42 percent of its
 * height in art terms. On a phone (under 700 px) it is 86 percent, because 70 percent of a narrow
 * screen is too small to be the highlight (a call without the owner, see the notes).
 */
export function heroArtWidth(vw: number, vh: number): number {
  if (vw < 700) return 0.86 * vw;
  return Math.min(0.7 * vw, 0.42 * vh * ART_ASPECT);
}

/** The rest place of the big logo: centred across, a little above the middle (47 percent from the top). */
export function heroRect(vw: number, vh: number): LogoRect {
  return { cx: 0, cy: vh / 2 - 0.47 * vh, width: heroArtWidth(vw, vh) };
}

/** A DOM rect of the art (CSS pixels, y down from the top left) in the stage frame. */
export function stageRectFromDom(
  left: number,
  top: number,
  width: number,
  vw: number,
  vh: number,
): LogoRect {
  const height = width / ART_ASPECT;
  return { cx: left + width / 2 - vw / 2, cy: vh / 2 - (top + height / 2), width };
}

// ---------------------------------------------------------------------------------------------
// The nav logo as the browser draws it

/** A CSS box, fractional, from the top left of the viewport. */
export interface BoxPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where the nav's vector really lands. Chrome rounds the paint offset of an inline `svg` to whole
 * device pixels and maps the viewBox into the laid out box with `meet` (one scale, centred), so the
 * ink is not where the plain maths of the CSS box says. The rule was fitted to screenshots of a real
 * high-density Chrome (`--force-device-scale-factor`, layout in device pixels) at 1, 1.5, 2 and 3.
 * An emulated ratio (Playwright's `deviceScaleFactor`) rounds in CSS pixels instead and lands up to
 * one device pixel off: judge the hand-off in a real one. The notes have the fits.
 */
export interface NavTarget {
  /** The art in the stage frame: what `morph` aims at. */
  rect: LogoRect;
  /** The viewBox origin, CSS pixels from the top left of the viewport. */
  originX: number;
  originY: number;
  /** CSS pixels per logo unit as the browser draws it. */
  unit: number;
  /** The `devicePixelRatio` the DOM was snapped at. */
  domDpr: number;
}

export function navTargetFor(svg: BoxPx, domDpr: number, vw: number, vh: number): NavTarget {
  const dpr = domDpr > 0 ? domDpr : 1;
  // The box in device pixels, as laid out (fractional).
  const lw = Math.max(1e-6, svg.width * dpr);
  const lh = Math.max(1e-6, svg.height * dpr);
  // Paint: only the offset is rounded. The viewBox goes into the laid out box with one scale,
  // centred (meet). The fits found no stretch to the rounded size, at 1, 1.5, 2 and 3.
  const bx0 = Math.round(svg.left * dpr);
  const by0 = Math.round(svg.top * dpr);
  const s = Math.min(lw / VIEWBOX.w, lh / VIEWBOX.h);
  const ox = bx0 + (lw - VIEWBOX.w * s) / 2;
  const oy = by0 + (lh - VIEWBOX.h * s) / 2;
  const unit = s / dpr;
  const originX = ox / dpr;
  const originY = oy / dpr;
  const left = originX + ART.x * unit;
  const top = originY + ART.y * unit;
  return {
    rect: stageRectFromDom(left, top, ART.w * unit, vw, vh),
    originX,
    originY,
    unit,
    domDpr: dpr,
  };
}

/** The same value, to compare two targets without allocating. */
export function sameNavTarget(a: NavTarget | null, b: NavTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.originX === b.originX &&
    a.originY === b.originY &&
    a.unit === b.unit &&
    a.domDpr === b.domDpr &&
    a.rect.cx === b.rect.cx &&
    a.rect.cy === b.rect.cy
  );
}

/**
 * The raster of the nav logo (texture B) on the canvas's own pixel grid: the same paths at the
 * scale and the sub-pixel phase the browser draws them, one texel to one device pixel, so the quad
 * of the last frames can sit exactly over the DOM logo.
 */
export interface NavRaster {
  /** Canvas size in device pixels. */
  w: number;
  h: number;
  /** Where the viewBox origin is inside that canvas, device pixels. */
  drawX: number;
  drawY: number;
  /** Device pixels per logo unit. */
  scale: number;
  /** The share of the canvas the quad's region covers (the `uv` scale). */
  uvX: number;
  uvY: number;
  /** The shift that puts the quad's corner on a whole device pixel, in the stage frame (CSS px). */
  snapX: number;
  snapY: number;
}

export function navRasterPlan(target: NavTarget, gridDpr: number): NavRaster {
  const g = gridDpr > 0 ? gridDpr : 1;
  const scale = target.unit * g;
  const cornerX = target.originX * g + REG.x * scale;
  const cornerY = target.originY * g + REG.y * scale;
  const x0 = Math.floor(cornerX);
  const y0 = Math.floor(cornerY);
  const w = Math.ceil(REG.w * scale) + 2;
  const h = Math.ceil(REG.h * scale) + 2;
  return {
    w,
    h,
    drawX: target.originX * g - x0,
    drawY: target.originY * g - y0,
    scale,
    uvX: (REG.w * scale) / w,
    uvY: (REG.h * scale) / h,
    snapX: (x0 - cornerX) / g,
    snapY: -(y0 - cornerY) / g,
  };
}

/**
 * Size of the hero texture (texture A) for an art that is `artCss` CSS pixels wide on a canvas of
 * pixel ratio `dpr`: one texel to a device pixel across the art when `oversample` is 1. Capped at
 * 4096, which is still more than one texel per pixel at 2560 wide.
 */
export function heroTextureSize(
  artCss: number,
  dpr: number,
  oversample: number,
  max = 4096,
): { w: number; h: number } {
  const w = Math.min(max, Math.max(64, Math.ceil(artCss * dpr * oversample * (REG.w / ART.w))));
  return { w, h: Math.round((REG.h * w) / REG.w) };
}

// ---------------------------------------------------------------------------------------------
// The morph: the reel's corner stagger, per vertex

/**
 * The reel's corner weight at a point of the art, `ax` across (0 left, 1 right) and `ay` up (0
 * bottom, 1 top): 0 at the top right (it leads), 1 at the bottom left (it trails).
 */
export function cornerWeight(ax: number, ay: number): number {
  return 1 - (Math.pow(ax, 1.5) + Math.pow(ay, 1.5)) / 2;
}

/** The progress of a vertex with weight `w` when the whole logo is at `P`: 0 to 1, eased. */
export function vertexProgress(P: number, w: number): number {
  return smoothstep(w * 0.3, 0.7 + w * 0.3, P);
}

/** The reel's turn, in radians: swings one way, then the other, and is 0 at both ends. */
export function turnAngle(v: number): number {
  return -(smoothstep(0, 1, v) - v);
}

/** The reel's lean as a fraction of the current width: 10 percent at the middle, 0 at both ends. */
export function leanOf(v: number): number {
  return 0.1 * Math.pow(Math.sin(Math.PI * v), 2);
}

/** The envelope of the travelling wave over the morph: 0 at both ends, 1 in the middle. */
export function morphEnvelope(P: number): number {
  return Math.pow(Math.max(0, Math.sin(Math.PI * clamp(P))), 1.5);
}

/**
 * The wave's strength for a frame: the morph's envelope, or a calm ripple the pose asks for at
 * rest, whichever is larger. The rest ripple lets go as the morph starts (like the sag), so a
 * section may pass it every frame and the logo is still flat when it reaches the bar.
 */
export function waveEnvelope(P: number, restWave: number): number {
  return Math.max(morphEnvelope(P), clamp(restWave) * (1 - smoothstep(0, 0.2, P)));
}

/** The wave's phase in cycles at progress `P` (a crest travels `WAVE.run` wavelengths). */
export const phaseAt = (P: number): number => P * WAVE.run;

/** Where along the art (0 left, 1 right, with a slant) the reveal front is at a vertex. */
export function revealCoord(ax: number, ay: number): number {
  return ax * 0.8 + (1 - ay) * 0.2;
}

/** The reveal mask at a coordinate: 0 before the front, 1 behind it. 0 at `R = 0` and 1 at `R = 1`. */
export function revealMask(s: number, R: number): number {
  return smoothstep(0, 1, (R * (1 + REVEAL_EDGE) - s) / REVEAL_EDGE);
}

// ---------------------------------------------------------------------------------------------
// The carry: sockets and the sag

/**
 * Named points of the logo where something holds it, in logo units from the art centre, y up.
 * `left` and `right` are on the slanted ends at one height (a drone's hand each, the sag hangs
 * between them); `bl` and `tr` are the two corners the drones pull to grow it.
 */
export type SocketName = "left" | "right" | "bl" | "tr";

function socketAt(x: number, y: number): { x: number; y: number } {
  return { x: x - ART_CENTRE.x, y: ART_CENTRE.y - y };
}

export const SOCKETS: Readonly<Record<SocketName, { x: number; y: number }>> = {
  left: socketAt(233, 462),
  right: socketAt(2818, 462),
  bl: socketAt(158, 660),
  tr: socketAt(2800, 352),
};

/** The sag as the shader takes it. */
interface Sag {
  /** Drop of the middle, in logo units (0 is taut). */
  depth: number;
  /** The two holds along x (logo units), and the height of the chord between them. */
  xL: number;
  xR: number;
  y: number;
  /** -1 to 1: where the heaviest part hangs (negative left, positive right). */
  wobble: number;
}

/** The sag of a logo held at its two ends: depth for a tension (0 hangs loose, 1 is taut). */
export const sagDepthFor = (sag01: number): number => SAG_MAX * clamp(sag01);

/**
 * The bend of a held banner: the middle drops, the cross sections turn with the curve, and the ends
 * beyond the holds carry on along the end tangent (no kink). Returns the moved point.
 */
export function bendPoint(lx: number, ly: number, sag: Sag, out: { x: number; y: number }): void {
  const span = sag.xR - sag.xL;
  if (sag.depth === 0 || span === 0) {
    out.x = lx;
    out.y = ly;
    return;
  }
  const s = (lx - sag.xL) / span;
  const sc = clamp(s);
  const w = sag.wobble;
  const sk = 1 + w * (2 * sc - 1);
  const par = 4 * sc * (1 - sc);
  const f = par * sk;
  const fp = 4 * (1 - 2 * sc) * sk + par * 2 * w;
  const drop = sag.depth * (f + fp * (s - sc));
  const th = Math.atan(-(sag.depth * fp) / span);
  const r = ly - sag.y;
  out.x = lx - r * Math.sin(th);
  out.y = sag.y - drop + r * Math.cos(th);
}

// ---------------------------------------------------------------------------------------------
// The whole warp, CPU side

/** Everything the vertex shader reads, as plain numbers. The actor owns one and writes the uniforms from it. */
export interface Warp {
  /** Morph progress 0 to 1. */
  P: number;
  /** The rest rect and the rect it travels to (stage frame): centre and px per unit. */
  fromX: number;
  fromY: number;
  fromK: number;
  toX: number;
  toY: number;
  toK: number;
  /** Pose of the rest rect: in-plane turn, tip about the horizontal axis, turn about the vertical. */
  roll: number;
  tilt: number;
  yaw: number;
  /** The wave: envelope 0 to 1 (already the larger of the morph's and the rest wave), phase in cycles. */
  env: number;
  phase: number;
  amp: number;
  cycles: number;
  sag: Sag;
  /** The device pixel snap of the last frames, CSS px, stage frame. */
  snapX: number;
  snapY: number;
  /** The hover ripple: centre in logo units (y up), strength 0 to 1, time. */
  ripX: number;
  ripY: number;
  rip: number;
  ripT: number;
  /** 0 hidden, 1 drawn. */
  reveal: number;
  /** The whole logo's opacity, 0 to 1 (the hand-off's fade). */
  opacity: number;
}

export function makeWarp(): Warp {
  return {
    P: 0,
    fromX: 0,
    fromY: 0,
    fromK: 1,
    toX: 0,
    toY: 0,
    toK: 1,
    roll: 0,
    tilt: 0,
    yaw: 0,
    env: 0,
    phase: 0,
    amp: WAVE.amp,
    cycles: WAVE.cycles,
    sag: { depth: 0, xL: 0, xR: 0, y: 0, wobble: 0 },
    snapX: 0,
    snapY: 0,
    ripX: 0,
    ripY: 0,
    rip: 0,
    ripT: 0,
    reveal: 1,
    opacity: 1,
  };
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

const scratch = { x: 0, y: 0 };

/**
 * The CPU copy of the vertex shader: where the point `(lx, ly)` of the logo (logo units from the art
 * centre, y up) is drawn, in the stage frame. The ripple and the reveal are left out on purpose (they
 * are looks, not places: the sockets and the hand-off do not depend on them).
 */
export function warpPoint(lx: number, ly: number, w: Warp, out: Point3): void {
  const ax = clamp(lx / ART.w + 0.5);
  const ay = clamp(ly / ART.h + 0.5);
  const v = vertexProgress(w.P, cornerWeight(ax, ay));
  const k = mix(w.fromK, w.toK, v);
  const cx = mix(w.fromX, w.toX, v);
  const cy = mix(w.fromY, w.toY, v);

  bendPoint(lx, ly, w.sag, scratch);
  const ang = turnAngle(v) + w.roll * (1 - v);
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const ox = k * scratch.x;
  const oy = k * scratch.y;
  let x = ox * cs - oy * sn;
  let y = ox * sn + oy * cs;
  let z = 0;
  const tilt = w.tilt * (1 - v);
  const yaw = w.yaw * (1 - v);
  if (tilt !== 0) {
    z += y * Math.sin(tilt);
    y *= Math.cos(tilt);
  }
  if (yaw !== 0) {
    z -= x * Math.sin(yaw);
    x *= Math.cos(yaw);
  }

  const bump = k * ART.w * leanOf(v);
  const prof = 0.35 + 0.65 * (1 - ax);
  const ph = 2 * Math.PI * (w.cycles * ax - w.phase);
  const height = k * ART.h;
  const lift = w.amp * w.env * height * prof * Math.sin(ph);
  const side = WAVE.lateral * w.amp * w.env * height * prof * Math.cos(ph);
  const snap = smoothstep(0.9, 1, w.P);

  out.x = cx + x + bump + side + w.snapX * snap;
  out.y = cy + y + lift + w.snapY * snap;
  out.z = z + 0.5 * lift;
}

/**
 * The rect, the turn and the scale that put two sockets of the logo on two points of the screen:
 * the way to carry it between two things. Pure: `warpPoint` at `P = 0` with the result puts the
 * sockets on the points (the sag leaves the two holds where they are).
 */
export function rectFromGrabs(
  a: { x: number; y: number },
  b: { x: number; y: number },
  pa: { x: number; y: number },
  pb: { x: number; y: number },
): { rect: LogoRect; roll: number } {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const reach = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const k = chord > 0 ? reach / chord : 1;
  const roll = Math.atan2(pb.y - pa.y, pb.x - pa.x) - Math.atan2(b.y - a.y, b.x - a.x);
  const cs = Math.cos(roll);
  const sn = Math.sin(roll);
  return {
    rect: {
      cx: pa.x - k * (a.x * cs - a.y * sn),
      cy: pa.y - k * (a.x * sn + a.y * cs),
      width: k * ART.w,
    },
    roll,
  };
}

/** Is the logo the nav's logo already (the section may show the DOM one and hide the actor)? */
export const isHandedOff = (P: number): boolean => P >= HANDOFF_AT;
