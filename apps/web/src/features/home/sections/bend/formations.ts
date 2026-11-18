/**
 * Where every picture of the bend section is, as a pure function of the beat. Four formations and the
 * flights between them: the wall (garuda2026.offwg.com's hero: posters at different tilts around a
 * subject, near ones big and out of focus, mid ones sharp, far ones small and soft), the ring (a 3D
 * circle of standing cards round Tetra), the spiral (a helix of splash cards that passes in front of
 * and behind her) and the paper of the drone. No three.js, no DOM, nothing allocated per call.
 *
 * Frame: the stage's pixel frame. The origin is the middle of the screen, x goes right, y up, one unit
 * is one CSS pixel at z = 0, z grows toward the camera, and the lens is `LENS` away (a card at depth z
 * looks `LENS / (LENS - z)` times its size). A card's `size` is the square root of its area in the
 * frame, so a wide picture and a tall one weigh the same. Angles are radians, Euler order YXZ (yaw,
 * then pitch, then roll).
 */
import { SPIRAL_CARDS, T, ramp, smoother, STAGE } from "./beats";

export const LENS = 1000;
/** The wall has this many cards on a wide screen, and the ring this many (one for each fan picture). */
export const WALL_CARDS = 22;
export const RING_CARDS = 15;

export interface Vp {
  readonly w: number;
  readonly h: number;
}

/** One card's pose. */
export interface CardPose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  size: number;
  opacity: number;
  /** 0 sharp to 1 out of focus. */
  blur: number;
  /** 0 to 1: how much of the live motion (idle drift, pointer parallax) still applies. */
  live: number;
  /** A multiplier on the colour: cards that turn away from the light are dimmer. */
  shade: number;
}

export function makePose(): CardPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    size: 100,
    opacity: 1,
    blur: 0,
    live: 1,
    shade: 1,
  };
}

export function copyPose(a: CardPose, o: CardPose): CardPose {
  o.x = a.x;
  o.y = a.y;
  o.z = a.z;
  o.rx = a.rx;
  o.ry = a.ry;
  o.rz = a.rz;
  o.size = a.size;
  o.opacity = a.opacity;
  o.blur = a.blur;
  o.live = a.live;
  o.shade = a.shade;
  return o;
}

const TAU = Math.PI * 2;

/** The way from angle `a` to `b` the short way round. */
function angleMix(a: number, b: number, k: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return a + d * k;
}

/**
 * The size on the screen that cards are drawn relative to: the height of a wide screen, and a little
 * more than the width on a tall one (so a phone's cards are not specks).
 */
export function baseOf(vp: Vp): number {
  return vp.w >= vp.h ? vp.h : Math.min(vp.h, vp.w * 1.25);
}

/** The wall is laid out for a screen at least as wide as 0.85 of its height; below that the tall layout is used. */
export function isTall(vp: Vp): boolean {
  return vp.w < vp.h * 0.85;
}

/** Put a point at a screen position (the pixel frame at z = 0) when it stands at depth `z`. */
function onScreen(sx: number, sy: number, z: number, out: CardPose): void {
  const k = (LENS - z) / LENS;
  out.x = sx * k;
  out.y = sy * k;
  out.z = z;
}

/** How out of focus a card at depth z is. The focus plane is a little behind the screen plane. */
const FOCUS_Z = -60;
const smoothstep = (a: number, b: number, v: number): number => smoother(ramp(v, a, b));
export function blurAt(z: number): number {
  if (z > FOCUS_Z) return 0.82 * smoothstep(120, 360, z - FOCUS_Z);
  return 0.62 * smoothstep(260, 700, FOCUS_Z - z);
}

// ------------------------------------------------------------------------------------------ the wall

/**
 * One poster of the wall. `nx` and `ny` are the screen position of its middle as fractions of half the
 * width and half the height, `z` its depth, `size` its screen size as a fraction of the base, then the
 * tilts in degrees. `wave` is the stance that throws it in (0 earth, 1 air, 2 water, 3 fire).
 */
interface Slot {
  nx: number;
  ny: number;
  z: number;
  size: number;
  rx: number;
  ry: number;
  rz: number;
  wave: number;
}

const s = (
  nx: number,
  ny: number,
  z: number,
  size: number,
  rx: number,
  ry: number,
  rz: number,
  wave: number,
): Slot => ({ nx, ny, z, size, rx, ry, rz, wave });

/**
 * The wide wall: four big near posters in the corners (out of focus, in front of Tetra), eight sharp
 * ones around her, ten small far ones behind her. The middle column (|nx| under 0.17) and the top
 * centre (|nx| under 0.42, ny over 0.6) are kept clear of near and mid posters: she is there, and the
 * title is there.
 */
const WIDE: readonly Slot[] = [
  // near
  s(-0.93, 0.6, 290, 0.34, 8, 24, -8, 3),
  s(0.94, 0.54, 280, 0.32, -8, -26, 9, 3),
  s(-0.9, -0.6, 300, 0.36, 10, 22, 8, 3),
  s(0.92, -0.64, 290, 0.34, -9, -24, -9, 3),
  // mid
  s(-0.6, 0.12, -60, 0.3, 5, 28, -7, 0),
  s(-0.5, 0.46, -80, 0.24, -7, 20, 6, 1),
  s(-0.54, -0.42, -70, 0.27, 9, -22, 6, 0),
  s(-0.31, -0.18, -110, 0.19, -6, 16, -6, 2),
  s(0.6, 0.1, -60, 0.3, -5, -28, 7, 0),
  s(0.5, 0.44, -80, 0.24, 7, -20, -6, 1),
  s(0.54, -0.4, -70, 0.27, -9, 22, -6, 0),
  s(0.31, -0.2, -110, 0.19, 6, -16, 6, 2),
  // far
  s(-0.8, 0.02, -520, 0.2, 0, 14, -10, 2),
  s(-0.72, 0.5, -560, 0.19, 0, 18, 8, 2),
  s(-0.74, -0.5, -540, 0.2, 0, -14, 10, 2),
  s(0.8, 0.0, -520, 0.2, 0, -14, 10, 2),
  s(0.72, 0.5, -560, 0.19, 0, -18, -8, 2),
  s(0.74, -0.48, -540, 0.2, 0, 14, -10, 2),
  s(-0.14, 0.3, -640, 0.17, 0, 8, -12, 1),
  s(0.15, 0.22, -660, 0.17, 0, -8, 12, 1),
  s(-0.2, -0.4, -600, 0.17, 0, 10, -8, 0),
  s(0.2, -0.46, -620, 0.17, 0, -10, 8, 0),
];

/** The tall wall (a phone): fewer posters, so the middle stays Tetra's. */
const TALL: readonly Slot[] = [
  s(-0.86, 0.5, 280, 0.3, 8, 24, -8, 3),
  s(0.88, 0.4, 270, 0.28, -8, -26, 9, 3),
  s(-0.84, -0.62, 290, 0.3, 10, 22, 8, 3),
  s(0.86, -0.7, 280, 0.28, -9, -24, -9, 3),
  s(-0.62, 0.14, -60, 0.26, 5, 26, -7, 0),
  s(-0.5, 0.5, -80, 0.2, -7, 20, 6, 1),
  s(-0.6, -0.36, -70, 0.24, 9, -22, 6, 0),
  s(0.64, 0.1, -60, 0.26, -5, -26, 7, 0),
  s(0.52, 0.5, -80, 0.2, 7, -20, -6, 1),
  s(0.6, -0.38, -70, 0.24, -9, 22, -6, 0),
  s(-0.2, 0.4, -560, 0.16, 0, 8, -12, 1),
  s(0.22, 0.32, -580, 0.16, 0, -8, 12, 1),
  s(-0.74, -0.1, -520, 0.17, 0, 14, -10, 2),
  s(0.76, -0.12, -520, 0.17, 0, -14, 10, 2),
  s(0.0, -0.5, -600, 0.15, 0, 0, 8, 0),
];

function slotsOf(vp: Vp): readonly Slot[] {
  return isTall(vp) ? TALL : WIDE;
}

/** How many posters the wall has on this screen. */
export function wallCount(vp: Vp): number {
  return slotsOf(vp).length;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** The pose of poster `i` once it has arrived (before the idle drift, the pointer and the hover). */
export function wallPose(i: number, vp: Vp, out: CardPose): CardPose {
  const slot = slotsOf(vp)[i];
  if (!slot) {
    out.opacity = 0;
    return out;
  }
  const base = baseOf(vp);
  onScreen(slot.nx * vp.w * 0.5, slot.ny * vp.h * 0.5, slot.z, out);
  out.size = slot.size * base * ((LENS - slot.z) / LENS);
  out.rx = rad(slot.rx);
  out.ry = rad(slot.ry);
  out.rz = rad(slot.rz);
  out.opacity = 1;
  out.blur = blurAt(slot.z);
  out.live = 1;
  out.shade = 1;
  return out;
}

/** The stance that throws poster `i` in. */
export function waveOf(i: number, vp: Vp): number {
  return slotsOf(vp)[i]?.wave ?? 0;
}

/** The place of poster `i` among the ones of its wave (0 first), so a wave arrives one after another. */
export function orderInWave(i: number, vp: Vp): number {
  const slots = slotsOf(vp);
  const wave = slots[i]?.wave ?? 0;
  let n = 0;
  for (let j = 0; j < i; j += 1) if (slots[j]?.wave === wave) n += 1;
  return n;
}

/** The screen rows from the top: the poster that is highest leaves the wall first (rank 0). */
export function rankFromTop(i: number, vp: Vp): number {
  const slots = slotsOf(vp);
  const y = slots[i]?.ny ?? 0;
  let rank = 0;
  for (let j = 0; j < slots.length; j += 1) {
    const other = slots[j]?.ny ?? 0;
    if (other > y || (other === y && j < i)) rank += 1;
  }
  return rank;
}

/** How long one poster's flight takes, in screens. */
export const FLIGHT = 0.55;

/** The screen at which poster `i` leaves for its wall slot. */
export function arriveAt(i: number, vp: Vp): number {
  return T.bendFrom + waveOf(i, vp) * T.wave + orderInWave(i, vp) * 0.045;
}

/**
 * Where poster `i` flies in from: off the screen on the side its stance belongs to. Earth throws from
 * the ground, air from the sky, water from the sides, fire from the corners. A point beyond the screen
 * edge by its own size, far from the camera, turned over.
 */
export function arrivalStart(i: number, vp: Vp, out: CardPose): CardPose {
  wallPose(i, vp, out);
  const wave = waveOf(i, vp);
  const slotZ = out.z;
  const screenSize = (out.size * LENS) / (LENS - slotZ);
  const reach = Math.max(vp.w, vp.h) * 0.5 + screenSize * 1.4;
  const side = out.x < 0 ? -1 : 1;
  let sx = (out.x * LENS) / (LENS - slotZ);
  let sy = (out.y * LENS) / (LENS - slotZ);
  if (wave === 0) {
    sy = -(vp.h * 0.5 + screenSize * 1.2);
  } else if (wave === 1) {
    sy = vp.h * 0.5 + screenSize * 1.2;
  } else if (wave === 2) {
    sx = side * (vp.w * 0.5 + screenSize * 1.2);
  } else {
    sx = side * reach;
    sy = (sy < 0 ? -1 : 1) * reach * 0.7;
  }
  const z = slotZ - 380;
  onScreen(sx, sy, z, out);
  out.size = (screenSize * (LENS - z)) / LENS;
  out.rz += side * (wave === 3 ? 1.8 : 1.1);
  out.ry += side * (wave === 2 ? 1.3 : 0.7);
  out.rx += wave === 0 ? 0.9 : wave === 1 ? -0.9 : 0.2;
  out.opacity = 1;
  out.blur = Math.max(out.blur, 0.55);
  out.live = 0;
  return out;
}

// ------------------------------------------------------------------------------------------- the ring

/**
 * The stage's camera is a pixel one: a lens of `LENS` pixels whatever the screen, so the same depth
 * magnifies a tall screen more than a short one. The depth of the ring and the spiral is scaled so a
 * near card is as big, compared with the screen, on a 1080 high display as on a 900 high one.
 */
function depthK(vp: Vp): number {
  return Math.min(1, 900 / baseOf(vp));
}

/** The ring's tilt: the front stands lower than the back, as a circle seen a little from above. */
const RING_TILT = 0.42;
/** The ring stands a little above her chest, so its near cards clear the foot of the screen (the takedown link). */
const RING_LIFT = 0.025;

/** The middle of the ring: Tetra's chest on the stage, in the stage frame. */
function ringMiddle(vp: Vp): number {
  return (STAGE.ty + 0.5 * STAGE.th) * vp.h;
}

export function ringRadius(vp: Vp): number {
  // The smaller of a quarter of the width and 0.4 of the height: the near cards must stay on a wide, low screen.
  return isTall(vp) ? vp.w * 0.4 : Math.min(vp.w * 0.25, vp.h * 0.4);
}

function ringSize(vp: Vp): number {
  return baseOf(vp) * (isTall(vp) ? 0.17 : 0.2);
}

/** The pose of ring card `k` of `n` when the ring has turned by `turn`. */
export function ringPose(k: number, n: number, turn: number, vp: Vp, out: CardPose): CardPose {
  const a = turn + (TAU * k) / n;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const r = ringRadius(vp);
  const pz = r * ca;
  out.x = r * sa;
  out.y = ringMiddle(vp) + RING_LIFT * vp.h - pz * Math.sin(RING_TILT) * 0.9;
  out.z = pz * Math.cos(RING_TILT) * depthK(vp);
  // The back half is seen from the inside: the card turns to show its picture to the viewer.
  out.ry = ca >= 0 ? a : a + Math.PI;
  out.rx = 0;
  out.rz = 0.05 * Math.sin(2 * a + 1);
  out.size = ringSize(vp);
  out.opacity = 1;
  out.blur = 0;
  out.live = 0;
  out.shade = 0.8 + 0.2 * (0.5 + 0.5 * ca);
  return out;
}

/** The ring's turn at `s` screens from the start of the section: a turn of the page, no idle (the runtime adds it). */
export function ringTurn(s: number): number {
  return 0.9 * (s - T.gatherFrom) + 1.2 * ramp(s, T.outFrom - 0.2, T.outTo);
}

/** The screen at which ring card `k` leaves the wall for the ring: the highest poster first. */
export function gatherAt(i: number, vp: Vp): number {
  return T.gatherFrom + (rankFromTop(i, vp) / Math.max(1, wallCount(vp))) * 0.32;
}

/** The screen at which ring card `k` is thrown off the screen. */
export function outAt(k: number): number {
  return T.outFrom + (k / RING_CARDS) * 0.12;
}

/** Where a ring card goes when it is thrown off: out along the way it faces, up, and past the camera. */
export function ringExit(from: CardPose, vp: Vp, out: CardPose): CardPose {
  copyPose(from, out);
  const reach = vp.w * 1.1 + out.size * 2;
  const dir = out.x < 0 ? -1 : 1;
  out.x = from.x + dir * reach;
  out.y = from.y + (from.y > ringMiddle(vp) ? 1 : -1) * vp.h * 0.7;
  out.z = from.z + 200;
  out.rz = from.rz + dir * 1.4;
  out.opacity = 0;
  out.blur = 0.7;
  out.live = 0;
  return out;
}

/** Where a wall poster that does not go into the ring goes when the ring forms: away and gone. */
export function wallDrop(from: CardPose, vp: Vp, out: CardPose): CardPose {
  copyPose(from, out);
  const dir = from.x < 0 ? -1 : 1;
  out.x = from.x + dir * vp.w * 0.35;
  out.y = from.y + vp.h * 0.2;
  out.z = from.z - 400;
  out.size = from.size * 0.55;
  out.rz = from.rz + dir * 0.8;
  out.opacity = 0;
  out.live = 0;
  return out;
}

// ----------------------------------------------------------------------------------------- the spiral

/** The angle between two cards of the spiral and the height one card sits lower than the one before it. */
const PITCH = 0.5;
const RISE = 0.03;
/** The spiral is seen from a little less above than the ring, and sits a little higher: its near cards stay on the screen. */
const SPIRAL_TILT = 0.26;
const SPIRAL_LIFT = 0.035;
/** The front card is not in front of her but a little to her left. */
const FRONT_AT = -0.75;
/** How many cards ahead of the front one (and behind it) can be seen. */
const AHEAD = 6.2;
const BEHIND = 2.4;

function spiralRadius(vp: Vp): number {
  return ringRadius(vp);
}

function spiralSize(vp: Vp): number {
  return baseOf(vp) * (isTall(vp) ? 0.18 : 0.2);
}

/** The pose of splash card `k` when the card `adv` is at the front. */
export function spiralPose(k: number, adv: number, vp: Vp, out: CardPose): CardPose {
  const j = k - adv;
  const a = FRONT_AT + j * PITCH;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const r = spiralRadius(vp);
  const pz = r * ca;
  out.x = r * sa;
  out.y = ringMiddle(vp) + SPIRAL_LIFT * vp.h - pz * Math.sin(SPIRAL_TILT) * 0.9 - j * RISE * vp.h;
  out.z = pz * Math.cos(SPIRAL_TILT) * depthK(vp);
  out.ry = ca >= 0 ? a : a + Math.PI;
  out.rx = 0;
  out.rz = 0.04 * Math.sin(1.7 * j + 0.5);
  out.size = spiralSize(vp);
  // The ones far ahead come out of the back, the ones that are past go up and away.
  out.opacity = smoother(ramp(AHEAD - j, 0, 1.4)) * smoother(ramp(j + BEHIND, 0, 1.2));
  out.blur = 0;
  out.live = 0;
  out.shade = 0.78 + 0.22 * (0.5 + 0.5 * ca);
  return out;
}

/** The screen at which spiral card `k` flies in. */
export function spiralInAt(k: number): number {
  return T.spiralFrom + (k / (SPIRAL_CARDS - 1)) * 0.28;
}

/** Where a spiral card flies in from: above the screen (the even ones) or below it (the odd ones). */
export function spiralStart(k: number, vp: Vp, out: CardPose): CardPose {
  spiralPose(k, 0, vp, out);
  const up = k % 2 === 0 ? 1 : -1;
  out.x *= 1.5;
  out.z -= 360;
  // Off the screen by one and a half cards, as it is seen from the camera (the depth shrinks the world y).
  out.y = up * (vp.h * 0.5 + out.size * 1.6) * ((LENS - out.z) / LENS);
  out.rx = up * 0.8;
  out.rz += up * 0.9;
  out.opacity = 1;
  out.blur = 0.6;
  return out;
}

/** Where a spiral card goes as the drone's picture takes the stage: up and off to the left. */
export function spiralExit(from: CardPose, vp: Vp, out: CardPose): CardPose {
  copyPose(from, out);
  out.x = from.x - vp.w * 0.5;
  out.y = from.y + vp.h * 0.45;
  out.z = from.z - 200;
  out.rz = from.rz - 0.8;
  out.opacity = 0;
  out.blur = 0.6;
  return out;
}

// ----------------------------------------------------------------------------------------- the paper

/** The paper of the drone, standing to the right of Tetra, facing us, before the drone comes out. */
export function paperPose(vp: Vp, out: CardPose): CardPose {
  const base = baseOf(vp);
  const z = 120;
  const sx = isTall(vp) ? vp.w * 0.22 : vp.w * 0.23;
  const sy = vp.h * (isTall(vp) ? 0.08 : 0.05);
  onScreen(sx, sy, z, out);
  out.size = base * (isTall(vp) ? 0.34 : 0.38) * ((LENS - z) / LENS);
  out.rx = 0;
  out.ry = -0.12;
  out.rz = -0.05;
  out.opacity = 1;
  out.blur = 0;
  out.live = 0;
  out.shade = 1;
  return out;
}

// --------------------------------------------------------------------------------------------- flights

/**
 * A card that flies from `a` to `b`: the position and the size run along a curve that is a straight
 * line bent by a swirl about the vertical axis through the ring's middle (so the pictures arc round
 * Tetra, as garuda's do round the trophy), the angles go the short way, and the card is out of focus
 * while it moves.
 */
export function fly(a: CardPose, b: CardPose, e: number, swirl: number, out: CardPose): CardPose {
  const k = e < 0 ? 0 : e > 1 ? 1 : e;
  const x = a.x + (b.x - a.x) * k;
  const z = a.z + (b.z - a.z) * k;
  const turn = swirl * Math.sin(Math.PI * k);
  const cs = Math.cos(turn);
  const sn = Math.sin(turn);
  out.x = x * cs + z * sn;
  out.z = z * cs - x * sn;
  out.y = a.y + (b.y - a.y) * k;
  out.rx = angleMix(a.rx, b.rx, k);
  out.ry = angleMix(a.ry, b.ry, k) + turn;
  out.rz = angleMix(a.rz, b.rz, k);
  out.size = a.size + (b.size - a.size) * k;
  out.opacity = a.opacity + (b.opacity - a.opacity) * k;
  const move = Math.sin(Math.PI * k);
  out.blur = Math.min(1, a.blur + (b.blur - a.blur) * k + 0.25 * move);
  out.live = a.live + (b.live - a.live) * k;
  out.shade = a.shade + (b.shade - a.shade) * k;
  return out;
}

/** Ease-out with a small overshoot: a poster that is thrown in settles. */
export function throwEase(u: number): number {
  const k = u < 0 ? 0 : u > 1 ? 1 : u;
  const c1 = 1.1;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

/** A flight that begins at `from` (screens) and lasts `len`: 0 before, 1 after. */
export function flightAt(sNow: number, from: number, len: number): number {
  return ramp(sNow, from, from + len);
}
