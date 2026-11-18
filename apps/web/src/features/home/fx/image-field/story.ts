/**
 * The hero's whole story as one pure function of p in [0, 1], after premotio (digest, 1.7):
 *
 *   0 to 0.04   frozen, the scatter
 *   0.05 to 0.34 GATHER: each card is picked in turn (the cards highest on the screen first, the
 *                owner's order) and in the next 0.13 of p it spirals into the ring. The spiral is
 *                made in the ring's own cylindrical frame (angle, radius, height about the ring's
 *                axis), never in x, y, z: the angle sweeps to the slot while the radius shrinks to
 *                0.75 R and the height falls to 0.
 *   0.34 to 0.42 the ring stands and turns (tilted 22 degrees toward the viewer)
 *   0.42 to 0.94 LAND: the cards leave the ring one by one in angular order and each flies a
 *                quintic Hermite (it starts with the ring's own velocity and acceleration and ends
 *                at rest) to its place on the wall, turning flat and growing wide on the way.
 *
 * Nothing here reads the scroll or the DOM: the section maps its scroll to p. The wall is seen
 * through a longer lens (`storyLens`).
 */
import {
  DEG,
  TAU,
  clamp,
  hermite5,
  mix,
  qFromBasis,
  qSlerp,
  ramp,
  smootherstep,
  smoothest,
  type Q,
  type V3,
} from "./math";
import { BASE_DISTANCE, project } from "./project";
import { scatterLayout } from "./scatter";
import { makePose, type CardPose, type Vp } from "./types";
import {
  WALL_DISTANCE,
  wallFrame,
  wallGeom,
  wallSlotPose,
  type WallGeom,
  type WallOptions,
} from "./wall";

export const TIMELINE = {
  freeze: 0.04,
  pickStart: 0.05,
  pickEnd: 0.21,
  /** How long a card takes from its pick to its seat on the ring. */
  flight: 0.13,
  gatherEnd: 0.34,
  leaveStart: 0.42,
  /** The last card leaves here. */
  leaveEnd: 0.78,
  /** The share of a gather flight in which the card rides toward its slot (the rest it is on the ring). */
  latch: 0.5,
  /** Ring tilt toward the viewer, degrees. */
  tilt: 22,
  /** A card takes this many leave spacings to cross from the ring to the wall. */
  landSpacings: 8,
} as const;

/** The ring's turn in the gather: half a turn, after an ease in over the first fifth of it. */
const RAMP = 0.2 * (TIMELINE.gatherEnd - TIMELINE.freeze);
const OMEGA = Math.PI / (RAMP / 2 + (TIMELINE.gatherEnd - TIMELINE.freeze - RAMP));

/** The ring's angle at p (radians). It is 0 until the freeze ends and keeps turning after the gather. */
export function ringTurn(p: number): number {
  const s = p - TIMELINE.freeze;
  if (s <= 0) return 0;
  if (s < RAMP) return (OMEGA * s * s) / (2 * RAMP);
  return OMEGA * (RAMP / 2 + s - RAMP);
}

/** d turn / d p. */
export function ringTurnRate(p: number): number {
  const s = p - TIMELINE.freeze;
  if (s <= 0) return 0;
  if (s < RAMP) return (OMEGA * s) / RAMP;
  return OMEGA;
}

/** d2 turn / d p2. */
export function ringTurnAccel(p: number): number {
  const s = p - TIMELINE.freeze;
  return s > 0 && s < RAMP ? OMEGA / RAMP : 0;
}

export interface RingSpec {
  /** The ring's centre in the frame. */
  readonly cx: number;
  readonly cy: number;
  /**
   * The ring radius: the smaller of 0.4 W, 0.42 H and 384.6. Premotio's digest says 0.32 H, but the
   * recon frame of its ring is 1.3 times wider than that gives (620 px against 480 at 1440 by 900).
   */
  readonly radius: number;
  /** Where the slots sit: 0.75 of the radius. */
  readonly slotRadius: number;
  /** A ring card is 0.5 radius wide (4:5), so this tall. */
  readonly cardH: number;
  /** The axis, the direction toward the viewer in the ring's plane, and the side. */
  readonly axis: V3;
  readonly front: V3;
  readonly side: V3;
}

function ringSpec(vp: Vp, centreY = -0.1 * vp.h): RingSpec {
  const radius = Math.min(0.4 * vp.w, 0.42 * vp.h, BASE_DISTANCE / 2.6);
  const t = TIMELINE.tilt * DEG;
  return {
    cx: 0,
    cy: centreY,
    radius,
    slotRadius: 0.75 * radius,
    cardH: (0.5 * radius) / 0.8,
    axis: [0, Math.cos(t), Math.sin(t)],
    front: [0, -Math.sin(t), Math.cos(t)],
    side: [1, 0, 0],
  };
}

/** Position of the ring's point at angle theta, radius r and height up the axis. */
export function ringPoint(spec: RingSpec, theta: number, r: number, height: number, out: V3): V3 {
  const c = Math.cos(theta) * r;
  const s = Math.sin(theta) * r;
  out[0] = spec.cx + c * spec.front[0] + s * spec.side[0] + height * spec.axis[0];
  out[1] = spec.cy + c * spec.front[1] + s * spec.side[1] + height * spec.axis[1];
  out[2] = c * spec.front[2] + s * spec.side[2] + height * spec.axis[2];
  return out;
}

const normal: V3 = [0, 0, 0];
const right: V3 = [0, 0, 0];

/** A ring card's rotation at angle theta: it faces outward from the axis, its top toward the axis. */
export function ringQuat(spec: RingSpec, theta: number, out: Q): Q {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  normal[0] = c * spec.front[0] + s * spec.side[0];
  normal[1] = c * spec.front[1] + s * spec.side[1];
  normal[2] = c * spec.front[2] + s * spec.side[2];
  const a = spec.axis;
  right[0] = a[1] * normal[2] - a[2] * normal[1];
  right[1] = a[2] * normal[0] - a[0] * normal[2];
  right[2] = a[0] * normal[1] - a[1] * normal[0];
  return qFromBasis(right, a, normal, out);
}

export interface StoryLayout {
  readonly n: number;
  readonly vp: Vp;
  readonly scatter: readonly CardPose[];
  readonly ring: RingSpec;
  readonly wall: WallGeom;
  /** When each card is picked (p). */
  readonly pick: Float64Array;
  /** The ring slot of each card. */
  readonly slot: Int32Array;
  /** When each card leaves the ring (p). */
  readonly leave: Float64Array;
  /** The wall slot each card lands on. */
  readonly wallSlot: Int32Array;
  /** The flight from the ring to the wall, in p. */
  readonly landFlight: number;
  /** The cylindrical start of each card about the ring axis. */
  readonly angle0: Float64Array;
  readonly out0: Float64Array;
  readonly up0: Float64Array;
  /** Ring position, velocity and acceleration at the leave, per p (3 numbers a card), and the ring rotation. */
  readonly p0: Float64Array;
  readonly v0: Float64Array;
  readonly a0: Float64Array;
  readonly q0: Float64Array;
}

export interface StoryOptions {
  /** Where the ring stands, in frame pixels (default a tenth of the height below the middle). */
  ringY?: number;
  wall?: Partial<WallOptions>;
  seed?: number;
  /**
   * A key for each card and each wall slot (a character's id, or null). A card lands on the slot
   * with its own key when there is one, so the same picture keeps its subject through the flight.
   */
  cardKeys?: ReadonlyArray<string | null>;
  slotKeys?: ReadonlyArray<string | null>;
}

const wrapPi = (a: number): number => a - TAU * Math.round(a / TAU);

const tmp: V3 = [0, 0, 0];
const tmp2: V3 = [0, 0, 0];
const tmp3: V3 = [0, 0, 0];

/** Where card `slot` is on the ring at p (the ring turns). */
function ringPosition(spec: RingSpec, n: number, slot: number, p: number, out: V3): V3 {
  return ringPoint(spec, (TAU * slot) / n + ringTurn(p), spec.slotRadius, 0, out);
}

function projectedY(pose: CardPose): number {
  return pose.y * (BASE_DISTANCE / (BASE_DISTANCE - pose.z));
}

export function buildStory(n: number, vp: Vp, options: StoryOptions = {}): StoryLayout {
  const scatter = scatterLayout(n, vp, options.seed);
  const ring = ringSpec(vp, options.ringY);
  const wall = wallGeom(n, wallFrame(vp, "wall"), options.wall);
  const pick = new Float64Array(n);
  const slot = new Int32Array(n).fill(-1);
  const leave = new Float64Array(n);
  const wallSlot = new Int32Array(n).fill(-1);
  const angle0 = new Float64Array(n);
  const out0 = new Float64Array(n);
  const up0 = new Float64Array(n);

  // The pick order: the cards highest on the screen first.
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => projectedY(scatter[b]!) - projectedY(scatter[a]!),
  );
  const span = n > 1 ? n - 1 : 1;
  order.forEach((card, rank) => {
    pick[card] = TIMELINE.pickStart + ((TIMELINE.pickEnd - TIMELINE.pickStart) * rank) / span;
  });

  // The cylindrical coordinates of each start about the ring axis.
  for (let i = 0; i < n; i++) {
    const s = scatter[i]!;
    const dx = s.x - ring.cx;
    const dy = s.y - ring.cy;
    const dz = s.z;
    const f = dx * ring.front[0] + dy * ring.front[1] + dz * ring.front[2];
    const sd = dx * ring.side[0] + dy * ring.side[1] + dz * ring.side[2];
    angle0[i] = Math.atan2(sd, f);
    out0[i] = Math.hypot(f, sd);
    up0[i] = dx * ring.axis[0] + dy * ring.axis[1] + dz * ring.axis[2];
  }

  // Each card takes the free slot whose angle, at the card's pick, is the nearest to its own.
  const taken = new Array<boolean>(n).fill(false);
  for (const card of order) {
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < n; k++) {
      if (taken[k]) continue;
      const d = Math.abs(wrapPi((TAU * k) / n + ringTurn(pick[card]!) - angle0[card]!));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    taken[best] = true;
    slot[card] = best;
  }

  // The leave order: angular, starting with the slot that is at the front when the leaving starts.
  const k0 = ((Math.round((-ringTurn(TIMELINE.leaveStart) * n) / TAU) % n) + n) % n;
  const spacing = (TIMELINE.leaveEnd - TIMELINE.leaveStart) / span;
  const landFlight = TIMELINE.landSpacings * spacing;
  for (let i = 0; i < n; i++) {
    const rank = (((k0 - slot[i]!) % n) + n) % n;
    leave[i] = TIMELINE.leaveStart + rank * spacing;
  }

  // The wall slot: a card with a key first takes the slot with the same key, the rest the nearest free one.
  const freeSlot = new Array<boolean>(n).fill(true);
  const byLeave = Array.from({ length: n }, (_, i) => i).sort((a, b) => leave[a]! - leave[b]!);
  const { cardKeys, slotKeys } = options;
  if (cardKeys && slotKeys) {
    for (const card of byLeave) {
      const key = cardKeys[card] ?? null;
      if (key === null) continue;
      const s = slotKeys.findIndex((k, idx) => k === key && freeSlot[idx] === true && idx < n);
      if (s >= 0) {
        freeSlot[s] = false;
        wallSlot[card] = s;
      }
    }
  }
  const spot: [number, number] = [0, 0];
  const target: [number, number] = [0, 0];
  const there = makePose();
  for (const card of byLeave) {
    if (wallSlot[card]! >= 0) continue;
    ringPosition(ring, n, slot[card]!, leave[card]!, tmp);
    project(tmp[0], tmp[1], tmp[2], BASE_DISTANCE, vp, spot);
    let best = -1;
    let bestD = Infinity;
    for (let s = 0; s < n; s++) {
      if (!freeSlot[s]) continue;
      wallSlotPose(wall, s, 0, there);
      project(there.x, there.y, there.z, WALL_DISTANCE, vp, target);
      const d = Math.hypot(spot[0] - target[0], spot[1] - target[1]);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    freeSlot[best] = false;
    wallSlot[card] = best;
  }

  // The ring's own motion at each card's leave: position, velocity and acceleration per p.
  const p0 = new Float64Array(n * 3);
  const v0 = new Float64Array(n * 3);
  const a0 = new Float64Array(n * 3);
  const q0 = new Float64Array(n * 4);
  const dp = 0.001;
  const qq: Q = [0, 0, 0, 1];
  for (let i = 0; i < n; i++) {
    const k = slot[i]!;
    const t = leave[i]!;
    ringPosition(ring, n, k, t, tmp);
    ringPosition(ring, n, k, t - dp, tmp2);
    ringPosition(ring, n, k, t + dp, tmp3);
    for (let c = 0; c < 3; c++) {
      p0[i * 3 + c] = tmp[c]!;
      v0[i * 3 + c] = (tmp3[c]! - tmp2[c]!) / (2 * dp);
      a0[i * 3 + c] = (tmp3[c]! - 2 * tmp[c]! + tmp2[c]!) / (dp * dp);
    }
    ringQuat(ring, (TAU * k) / n + ringTurn(t), qq);
    for (let c = 0; c < 4; c++) q0[i * 4 + c] = qq[c]!;
  }

  return {
    n,
    vp,
    scatter,
    ring,
    wall,
    pick,
    slot,
    leave,
    wallSlot,
    landFlight,
    angle0,
    out0,
    up0,
    p0,
    v0,
    a0,
    q0,
  };
}

const qa: Q = [0, 0, 0, 1];
const qb: Q = [0, 0, 0, 1];
const point: V3 = [0, 0, 0];
const wallPose = makePose();

/** The pose of card `i` at story time `p`. `slide` is the wall's slide (the field's own). */
export function storyAt(
  L: StoryLayout,
  p: number,
  i: number,
  slide: number,
  out: CardPose,
): CardPose {
  const start = L.scatter[i]!;
  const n = L.n;
  const u = L.pick[i]!;
  const leave = L.leave[i]!;
  const k = L.slot[i]!;

  if (p >= leave) {
    // LAND: the cartesian quintic Hermite from the ring to the wall.
    const tau = clamp((p - leave) / L.landFlight);
    wallSlotPose(L.wall, L.wallSlot[i]!, slide, wallPose);
    if (tau >= 1) return copyInto(wallPose, out);
    const scaleV = L.landFlight;
    const scaleA = L.landFlight * L.landFlight;
    out.x = hermite5(
      L.p0[i * 3]!,
      L.v0[i * 3]! * scaleV,
      L.a0[i * 3]! * scaleA,
      wallPose.x,
      0,
      0,
      tau,
    );
    out.y = hermite5(
      L.p0[i * 3 + 1]!,
      L.v0[i * 3 + 1]! * scaleV,
      L.a0[i * 3 + 1]! * scaleA,
      wallPose.y,
      0,
      0,
      tau,
    );
    out.z = hermite5(
      L.p0[i * 3 + 2]!,
      L.v0[i * 3 + 2]! * scaleV,
      L.a0[i * 3 + 2]! * scaleA,
      wallPose.z,
      0,
      0,
      tau,
    );
    for (let c = 0; c < 4; c++) qa[c] = L.q0[i * 4 + c]!;
    qSlerp(qa, wallPose.q, smootherstep(tau / 0.55), out.q);
    out.h = mix(L.ring.cardH, wallPose.h, smootherstep(tau));
    const shape = smootherstep(tau / 0.8);
    out.shape = shape;
    out.aspect = mix(0.8, wallPose.aspect, shape);
    out.opacity = 1;
    out.live = 0;
    return out;
  }

  // GATHER and RING: the cylindrical spiral about the ring's axis.
  const o = clamp((p - u) / TIMELINE.flight);
  if (o <= 0) {
    out.x = start.x;
    out.y = start.y;
    out.z = start.z;
    out.q[0] = start.q[0];
    out.q[1] = start.q[1];
    out.q[2] = start.q[2];
    out.q[3] = start.q[3];
    out.h = start.h;
    out.aspect = start.aspect;
    out.shape = 0;
    out.opacity = 1;
    out.live = 1;
    return out;
  }
  const l = TIMELINE.latch;
  const slotAngle = (s: number): number => (TAU * k) / n + ringTurn(s);
  let theta: number;
  if (o < l) {
    const i1 = o / l;
    const i3 = i1 * i1 * i1;
    const i4 = i3 * i1;
    const i5 = i4 * i1;
    const endTime = u + TIMELINE.flight * l;
    const wrap = Math.round((slotAngle(u) - L.angle0[i]!) / TAU);
    const h = L.angle0[i]! + TAU * wrap;
    const pace = ringTurnRate(endTime) * TIMELINE.flight * l;
    const accel = ringTurnAccel(endTime) * (TIMELINE.flight * l) ** 2;
    theta =
      h +
      (slotAngle(endTime) - h) * (10 * i3 - 15 * i4 + 6 * i5) +
      pace * (-4 * i3 + 7 * i4 - 3 * i5) +
      accel * (0.5 * i3 - i4 + 0.5 * i5);
  } else {
    theta = slotAngle(p);
  }
  const e = smoothest(o);
  const r = mix(L.out0[i]!, L.ring.slotRadius, e);
  const height = mix(L.up0[i]!, 0, e);
  ringPoint(L.ring, theta, r, height, point);
  out.x = point[0];
  out.y = point[1];
  out.z = point[2];
  ringQuat(L.ring, theta, qb);
  qSlerp(start.q, qb, smoothest(o / l), out.q);
  out.h = mix(start.h, L.ring.cardH, e);
  out.aspect = 0.8;
  out.shape = 0;
  out.opacity = 1;
  out.live = 1 - e;
  return out;
}

function copyInto(a: CardPose, out: CardPose): CardPose {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  out.q[0] = a.q[0];
  out.q[1] = a.q[1];
  out.q[2] = a.q[2];
  out.q[3] = a.q[3];
  out.h = a.h;
  out.aspect = a.aspect;
  out.shape = a.shape;
  out.opacity = a.opacity;
  out.live = a.live;
  return out;
}

/** The camera distance at story time p: the pixel lens until the cards leave the ring, a long lens on the wall. */
export function storyLens(p: number): number {
  return mix(BASE_DISTANCE, WALL_DISTANCE, smootherstep(ramp(p, TIMELINE.leaveStart, 0.94)));
}
