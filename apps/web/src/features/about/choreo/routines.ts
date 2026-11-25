import { bump, clamp01, easeInOutSine, easeTurn, TAU } from "./ease";
import type { FriendId, Slot } from "./friends";
import type { FaceName } from "./path";

/**
 * What the drone and its friends do together: greetings, dances, a lap round the drone, a fist
 * bump, a peek from behind it, goodbyes. Each is a one-shot on its own clock, like the drone's
 * tricks: once started it always finishes, whatever the scroll does, and it only ever adds to the
 * places and attitudes the scroll gives, with a weight that rises from 0 and falls back to 0, so a
 * routine can neither start nor end with a jump.
 *
 * Pure arithmetic: `routineFrame` says what each one adds at a time, `stepShow` decides which one
 * plays. Lengths are in widths of the drone, angles in radians.
 */

export type RoutineKind =
  | "greet"
  | "hello"
  | "huddle"
  | "dance"
  | "orbit"
  | "bump"
  | "peek"
  | "spar"
  | "cheer"
  | "bye"
  | "farewell";

/** The moods a friend can wear; each body turns them into faces of its own. */
export type Mood =
  "happy" | "love" | "shy" | "wide" | "squint" | "dizzy" | "sad" | "glad" | "angry" | "bold";

/** The gestures of a friend's own parts (gloves, ears): each body draws them its own way. */
export type Gesture = "wave" | "bow" | "cheer" | "jab" | "punch" | "hide" | "bounce" | "flex";

/** What a routine adds to the drone this frame. `dx`, `dy` are in widths of the drone. */
interface DroneBit {
  dx: number;
  dy: number;
  yaw: number;
  pitch: number;
  roll: number;
  face: FaceName | null;
  effort: number;
  flare: number;
  /** A friend the drone looks at, or null. */
  look: FriendId | null;
}

/** What a routine makes of a friend this frame. */
export interface FriendBit {
  /** How much the routine's place counts against the friend's own (0 to 1). */
  w: number;
  /** The routine's place for it, relative to the drone, in widths of the drone. */
  x: number;
  y: number;
  /** Added up or down (a hop), in widths of the drone, at full strength whatever `w`. */
  lift: number;
  /** Its size, as a part of its own. */
  scale: number;
  /** In front of the drone. */
  front: boolean;
  yaw: number;
  pitch: number;
  roll: number;
  spin: number;
  squash: number;
  mood: Mood | null;
  gesture: Gesture | null;
  /** How far through the gesture (0 to 1). */
  at: number;
  /** -1 or 1: the side of the drone it is on when the routine began (the way to reach the drone). */
  side: number;
}

export interface RoutineFrame {
  drone: DroneBit;
  friends: Partial<Record<FriendId, FriendBit>>;
}

/** Seconds each lasts. */
export const ROUTINE_SECONDS: Record<RoutineKind, number> = {
  greet: 2.9,
  hello: 2.9,
  huddle: 3.4,
  dance: 3.6,
  orbit: 2.8,
  bump: 1.9,
  peek: 3.2,
  spar: 2.6,
  cheer: 1.7,
  bye: 2.0,
  farewell: 2.1,
};

/** Who takes part, by kind. `dance` and `cheer` take whoever is there. */
const CAST: Record<RoutineKind, readonly FriendId[] | "all"> = {
  greet: ["bunny"],
  hello: ["bold", "soft"],
  huddle: ["bunny", "bold", "soft"],
  dance: "all",
  orbit: ["bunny"],
  bump: ["bunny"],
  peek: ["soft"],
  spar: ["bold"],
  cheer: "all",
  bye: ["bunny"],
  farewell: ["bold", "soft"],
};

/** A playing routine. */
export interface ActiveRoutine {
  kind: RoutineKind;
  t: number;
  /** Who takes part, and the side of the drone each was on when it began. */
  cast: FriendId[];
  side: Partial<Record<FriendId, number>>;
}

// The curves ------------------------------------------------------------------------------------

/** 0 before `a`, 1 after `b`, a soft S between. */
const rise = (t: number, a: number, b: number) => easeInOutSine(clamp01((t - a) / (b - a)));
/** 0, up to 1 in the middle of [a, b], 0 again. */
const hump = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : bump((t - a) / (b - a)));
/** The routine's weight: in over the first part of a second, out over the last. */
const envelope = (t: number, total: number) =>
  rise(t, 0, 0.32) * (1 - rise(t, total - 0.38, total));
/** Bounces: `n` hops between `a` and `b`, each 0 to 1. */
const hops = (t: number, a: number, b: number, n: number) =>
  t <= a || t >= b ? 0 : Math.abs(Math.sin(Math.PI * n * ((t - a) / (b - a))));
/** Where in a gesture the time is (0 to 1), or -1 outside it. */
const within = (t: number, a: number, b: number) => (t < a || t > b ? -1 : (t - a) / (b - a));

const droneRest = (): DroneBit => ({
  dx: 0,
  dy: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  face: null,
  effort: 0,
  flare: 0,
  look: null,
});

function friendRest(slot: Slot, side: number): FriendBit {
  return {
    w: 0,
    x: slot.x,
    y: slot.y,
    lift: 0,
    scale: 1,
    front: false,
    yaw: 0,
    pitch: 0,
    roll: 0,
    spin: 0,
    squash: 1,
    mood: null,
    gesture: null,
    at: 0,
    side,
  };
}

/** Put a gesture on a friend for the stretch [a, b] of the routine. */
function gesture(b: FriendBit, kind: Gesture, t: number, from: number, to: number): void {
  const at = within(t, from, to);
  if (at < 0) return;
  b.gesture = kind;
  b.at = at;
}

/** What a routine adds at time `t`, given where each friend's own place is now. */
export function routineFrame(r: ActiveRoutine, slots: Record<FriendId, Slot>): RoutineFrame {
  const t = r.t;
  const total = ROUTINE_SECONDS[r.kind];
  const w = envelope(t, total);
  const drone = droneRest();
  const friends: Partial<Record<FriendId, FriendBit>> = {};
  for (const id of r.cast) {
    const side = r.side[id] ?? 1;
    const bit = friendRest(slots[id], side);
    bit.w = w;
    friends[id] = bit;
  }
  const f = (id: FriendId) => friends[id];

  switch (r.kind) {
    case "greet": {
      // Mr. Bunny comes up close, bows, the drone nods back, they bump, and hop for joy.
      const b = f("bunny");
      if (!b) break;
      const s = b.side;
      b.x = s * (1.12 - 0.34 * hump(t, 1.25, 1.7));
      b.y = -0.06;
      b.pitch = 0.75 * hump(t, 0.45, 1.05);
      b.roll = s * 0.24 * hump(t, 1.3, 1.7);
      b.squash = 1 - 0.18 * hump(t, 1.42, 1.62) + 0.08 * hump(t, 1.62, 1.85);
      b.lift = -0.2 * hops(t, 1.85, 2.65, 2);
      b.mood = t < 0.4 ? "wide" : t < 1.3 ? "happy" : t < 1.8 ? "squint" : "love";
      gesture(b, "wave", t, 0.05, 0.5);
      gesture(b, "bow", t, 0.45, 1.05);
      const nod = within(t, 0.8, 1.4);
      if (nod >= 0) drone.pitch = 0.34 * Math.sin(TAU * 2 * nod) * (1 - nod);
      drone.yaw = s * 0.5 * w;
      drone.dx = -s * 0.07 * hump(t, 1.42, 1.8);
      drone.roll = -s * 0.32 * hump(t, 1.42, 1.85);
      drone.dy = -0.12 * hops(t, 1.85, 2.65, 2);
      drone.face = t < 0.7 ? "alert" : t < 1.45 ? "happy" : t < 1.85 ? "squint" : "happy";
      drone.look = "bunny";
      drone.flare = 0.5 * hump(t, 1.4, 1.8);
      break;
    }
    case "hello": {
      // The bold one starts, waves and bumps fists with the drone; the soft one hides, peeks and
      // waves, then bounces with hearts.
      const a = f("bold");
      const b = f("soft");
      if (a) {
        a.x = a.side * (1.3 - 0.3 * hump(t, 1.7, 2.35));
        a.lift = -0.25 * hump(t, 0, 0.35);
        a.squash = 1 + 0.12 * hump(t, 0, 0.3);
        a.mood = t < 0.4 ? "wide" : t < 1.7 ? "glad" : t < 2.2 ? "bold" : "happy";
        gesture(a, "wave", t, 0.45, 1.6);
        gesture(a, "punch", t, 1.7, 2.35);
      }
      if (b) {
        b.mood = t < 0.6 ? "shy" : t < 1.7 ? "glad" : "love";
        gesture(b, "hide", t, 0, 0.7);
        gesture(b, "wave", t, 0.75, 1.7);
        gesture(b, "bounce", t, 1.85, 2.75);
        b.lift = -0.18 * hops(t, 1.85, 2.75, 3);
      }
      drone.look = t < 1.6 ? "bold" : t < 2.4 ? "soft" : null;
      const nod = within(t, 0.5, 1.1);
      if (nod >= 0) drone.pitch = 0.3 * Math.sin(TAU * 2 * nod) * (1 - nod);
      drone.dy = -0.1 * hump(t, 1.95, 2.25);
      drone.face = t < 0.5 ? "alert" : t < 1.95 ? "happy" : t < 2.3 ? "squint" : "happy";
      drone.flare = 0.4 * hump(t, 1.95, 2.3);
      break;
    }
    case "huddle": {
      // All four: in close, a bounce together, one big jump with a flip and a spin, and a cheer.
      const near = rise(t, 0, 0.5) * (1 - rise(t, 2.9, 3.4));
      const bob = -0.13 * hops(t, 0.5, 2.0, 3);
      const jump = -0.42 * hump(t, 2.05, 2.75);
      for (const id of r.cast) {
        const b = f(id);
        if (!b) continue;
        b.x = slots[id].x * (1 - 0.3 * near);
        b.y = slots[id].y;
        b.w = w;
        b.lift = bob + jump;
        b.spin = (id === "bold" ? -1 : 1) * TAU * easeTurn(clamp01((t - 2.1) / 0.62));
        b.squash = 1 - 0.14 * hump(t, 1.92, 2.08) + 0.1 * hump(t, 2.1, 2.4);
        b.mood = t < 2.05 ? "happy" : t < 2.8 ? "squint" : "love";
        gesture(b, "cheer", t, 2.05, 3.3);
      }
      drone.dy = bob + jump;
      drone.pitch = TAU * easeTurn(clamp01((t - 2.08) / 0.66));
      drone.face = t < 2.05 ? "happy" : t < 2.8 ? "squint" : "happy";
      drone.effort = 0.5 * hump(t, 2.0, 2.8);
      drone.flare = 0.7 * hump(t, 2.6, 3.1);
      break;
    }
    case "dance": {
      // To one beat: everybody bobs twice a sway, the friends sway against the drone, a spin each,
      // and a pose at the end.
      const u = clamp01((t - 0.2) / 2.0);
      const beat = TAU * 2.0 * Math.max(0, t - 0.2);
      const on = t > 0.2 && t < 2.2 ? 1 : 0;
      const bob = -0.1 * Math.abs(Math.sin(beat)) * on;
      drone.roll = 0.3 * Math.sin(beat / 2) * on * bump(u);
      drone.yaw = 0.22 * Math.sin(beat / 4) * on + TAU * easeTurn(clamp01((t - 2.25) / 0.75));
      drone.dy = bob;
      drone.face = t > 2.2 ? "happy" : Math.sin(beat / 2) > 0 ? "happy" : "squint";
      drone.effort = 0.35 * on;
      drone.flare = 0.6 * hump(t, 3.0, 3.6);
      for (const id of r.cast) {
        const b = f(id);
        if (!b) continue;
        b.w = 0.35 * w;
        b.lift = bob;
        b.x = slots[id].x + 0.08 * Math.sin(beat / 2) * on;
        b.roll = -0.3 * Math.sin(beat / 2) * on * bump(u);
        b.spin = (id === "soft" ? -1 : 1) * TAU * easeTurn(clamp01((t - 2.3) / 0.75));
        b.mood = t > 2.2 ? "love" : Math.sin(beat / 2) > 0 ? "happy" : "squint";
        gesture(b, "cheer", t, 3.0, 3.6);
        gesture(b, "bounce", t, 0.2, 2.2);
      }
      break;
    }
    case "orbit": {
      // Mr. Bunny takes a lap round the drone, behind it and then in front, and the drone turns
      // to watch it go.
      const b = f("bunny");
      if (!b) break;
      const s = b.side;
      const radius = Math.max(1.35, Math.abs(slots.bunny.x));
      const start = s > 0 ? 0 : Math.PI;
      const phi = start + s * TAU * easeInOutSine(clamp01((t - 0.3) / 2.2));
      b.x = radius * Math.cos(phi);
      b.y = -0.18 + 0.16 * Math.sin(phi);
      b.front = Math.sin(phi) * s < -0.05;
      b.scale = 1 + 0.12 * -Math.sin(phi) * s;
      b.yaw = -0.9 * Math.sin(phi) * s;
      b.mood = "happy";
      drone.yaw = 0.7 * Math.cos(phi) * w;
      drone.face = t < 0.4 ? "scan" : "happy";
      drone.look = "bunny";
      break;
    }
    case "bump": {
      // Up to the drone, a bump of heads, and back.
      const b = f("bunny");
      if (!b) break;
      const s = b.side;
      b.x = s * (1.3 - 0.52 * hump(t, 0.4, 1.15));
      b.y = -0.04;
      b.squash = 1 - 0.2 * hump(t, 0.7, 0.88);
      b.roll = s * 0.3 * hump(t, 0.6, 1.1);
      b.mood = t < 0.7 ? "bold" : "love";
      drone.dx = -s * 0.1 * hump(t, 0.72, 1.1);
      drone.roll = -s * 0.35 * hump(t, 0.72, 1.2);
      drone.face = t < 0.7 ? "angry" : t < 1.2 ? "squint" : "happy";
      drone.look = "bunny";
      drone.flare = 0.5 * hump(t, 0.7, 1.1);
      break;
    }
    case "peek": {
      // The soft one hides behind the drone, peeks over its head, and comes out again.
      const b = f("soft");
      if (!b) break;
      const s = b.side;
      const peek = hump(t, 1.2, 2.5);
      b.x = s * (0.2 + 0.12 * peek);
      b.y = -0.08 - 0.66 * peek;
      b.scale = 0.92;
      b.mood = t < 1.2 ? "shy" : t < 1.6 ? "wide" : t < 2.5 ? "glad" : "love";
      gesture(b, "hide", t, 0.2, 1.3);
      gesture(b, "wave", t, 1.55, 2.4);
      drone.face = t < 1.4 ? "normal" : "happy";
      drone.look = t > 1.3 && t < 2.5 ? "soft" : null;
      drone.pitch = -0.22 * peek;
      break;
    }
    case "spar": {
      // The bold one throws jabs at the drone, the drone ducks and weaves, then shows off.
      const b = f("bold");
      if (!b) break;
      const s = b.side;
      b.x = s * (1.28 - 0.12 * hump(t, 0.3, 1.5));
      b.yaw = -s * 0.5 * hump(t, 0.2, 1.6);
      b.mood = t < 1.6 ? "bold" : "happy";
      gesture(b, "jab", t, 0.3, 1.5);
      gesture(b, "flex", t, 1.7, 2.5);
      const dodge = within(t, 0.35, 1.5);
      if (dodge >= 0) {
        drone.dx = -s * 0.1 * Math.abs(Math.sin(TAU * 1.5 * dodge));
        drone.roll = 0.35 * Math.sin(TAU * 1.5 * dodge);
        drone.dy = 0.06 * Math.sin(TAU * 3 * dodge);
      }
      drone.yaw = TAU * easeTurn(clamp01((t - 1.65) / 0.7)) * (s > 0 ? -1 : 1);
      drone.face = t < 0.35 ? "alert" : t < 1.55 ? "squint" : "happy";
      drone.look = t < 1.6 ? "bold" : null;
      drone.flare = 0.5 * hump(t, 1.6, 2.4);
      break;
    }
    case "cheer": {
      // The drone was pressed: everybody hops for it.
      for (const id of r.cast) {
        const b = f(id);
        if (!b) continue;
        b.w = 0;
        b.lift = -0.22 * hops(t, 0.1, 1.4, 2);
        b.mood = id === "soft" ? "love" : "happy";
        gesture(b, "cheer", t, 0.05, 1.5);
      }
      drone.face = "happy";
      drone.dy = -0.08 * hops(t, 0.1, 1.4, 2);
      break;
    }
    case "bye": {
      // Mr. Bunny waves goodbye and the drone waves back.
      const b = f("bunny");
      if (!b) break;
      b.w = 0;
      b.yaw = -b.side * 0.4 * w;
      b.mood = t < 1.1 ? "sad" : "happy";
      gesture(b, "wave", t, 0.1, 1.7);
      const wave = within(t, 0.15, 1.8);
      if (wave >= 0) drone.roll = 0.26 * Math.sin(TAU * 2.5 * wave) * bump(wave);
      drone.face = "happy";
      drone.look = "bunny";
      break;
    }
    case "farewell": {
      // The two wave goodbye, one with a heart.
      for (const id of r.cast) {
        const b = f(id);
        if (!b) continue;
        b.w = 0;
        b.mood = id === "soft" ? (t < 1 ? "sad" : "love") : "glad";
        gesture(b, "wave", t, 0.1, 1.8);
      }
      const wave = within(t, 0.15, 1.9);
      if (wave >= 0) drone.roll = 0.26 * Math.sin(TAU * 2.5 * wave) * bump(wave);
      drone.face = "happy";
      drone.look = "soft";
      break;
    }
  }

  // The drone's part is weighted by the routine's envelope, so it eases in and out. The turns are
  // not: each starts at nothing and ends at nothing or at a whole turn, which looks the same.
  drone.dx *= w;
  drone.dy *= w;
  drone.roll *= w;
  drone.effort *= w;
  drone.flare *= w;
  if (w < 0.2) drone.face = null;
  return { drone, friends };
}

// The show: which routine plays -------------------------------------------------------------------

export interface Show {
  active: ActiveRoutine | null;
  /** Seconds before another may start. */
  wait: number;
  /** Seconds the drone has been at rest. */
  rest: number;
  /** The place in the order of the routines played at rest. */
  count: number;
  /** Who has been greeted on this stay, and who has said goodbye. */
  met: Record<FriendId, boolean>;
  bye: Record<FriendId, boolean>;
  /** The four have had their huddle on this stay. */
  group: boolean;
}

export function createShow(): Show {
  return {
    active: null,
    wait: 0,
    rest: 0,
    count: 0,
    met: { bunny: false, bold: false, soft: false },
    bye: { bunny: false, bold: false, soft: false },
    group: false,
  };
}

export interface ShowInput {
  dt: number;
  /** How far in each friend is (0 to 1); a friend whose model has not arrived is 0. */
  present: Record<FriendId, number>;
  /** Whether each is on its way out. */
  leaving: Record<FriendId, boolean>;
  /** The drone sits at a station, not flying. */
  atRest: boolean;
  /** The visitor pressed the drone this frame. */
  pressed: boolean;
  /** The sides of the drone the friends are on now (their places' x). */
  slots: Record<FriendId, Slot>;
}

/** The order of the routines played at rest, by who is there. */
const AT_REST: readonly RoutineKind[] = [
  "dance",
  "orbit",
  "spar",
  "peek",
  "dance",
  "bump",
  "peek",
  "spar",
  "orbit",
];

/** The air between two routines, and how long the drone must rest before one starts by itself. */
const SPACING = 0.7;
const REST_BEFORE = 1.0;
const HERE = 0.9;
const GONE = 0.02;

function castOf(kind: RoutineKind, here: (id: FriendId) => boolean): FriendId[] | null {
  const cast = CAST[kind];
  if (cast === "all") {
    const all = (["bunny", "bold", "soft"] as const).filter(here);
    return all.length > 0 ? all : null;
  }
  return cast.every(here) ? [...cast] : null;
}

/** Start a routine (the probes and the show). Refused while another plays. */
export function startRoutine(
  show: Show,
  kind: RoutineKind,
  cast: FriendId[],
  slots: Record<FriendId, Slot>,
): boolean {
  if (show.active) return false;
  const side: Partial<Record<FriendId, number>> = {};
  for (const id of cast) side[id] = slots[id].x < 0 ? -1 : 1;
  show.active = { kind, t: 0, cast, side };
  return true;
}

/** One step of the show. Returns the routine that plays now, or null. */
export function stepShow(show: Show, input: ShowInput): ActiveRoutine | null {
  const here = (id: FriendId) => input.present[id] >= HERE;
  for (const id of ["bunny", "bold", "soft"] as const) {
    // Gone from the page: the next stay starts with a greeting and ends with a goodbye again.
    if (input.present[id] <= GONE) {
      show.met[id] = false;
      show.bye[id] = false;
    }
  }
  if (input.present.bunny <= GONE || input.present.bold <= GONE || input.present.soft <= GONE) {
    show.group = false;
  }
  show.rest = input.atRest ? show.rest + input.dt : 0;

  if (show.active) {
    show.active.t += input.dt;
    if (show.active.t >= ROUTINE_SECONDS[show.active.kind]) {
      show.active = null;
      show.wait = SPACING;
    }
    return show.active;
  }
  show.wait = Math.max(0, show.wait - input.dt);
  if (show.wait > 0) return null;

  const start = (kind: RoutineKind, cast: FriendId[] | null): boolean =>
    cast !== null && startRoutine(show, kind, cast, input.slots);

  // The four together, once a stay: it is also everybody's greeting.
  if (!show.group && here("bunny") && here("bold") && here("soft") && !input.leaving.bunny) {
    show.group = true;
    show.met.bold = true;
    show.met.soft = true;
    if (start("huddle", ["bunny", "bold", "soft"])) return show.active;
  }
  if (!show.met.bunny && here("bunny") && !input.leaving.bunny) {
    show.met.bunny = true;
    if (start("greet", ["bunny"])) return show.active;
  }
  if (!show.met.bold && here("bold") && here("soft") && !input.leaving.bold) {
    show.met.bold = true;
    show.met.soft = true;
    if (start("hello", ["bold", "soft"])) return show.active;
  }
  if (!show.bye.bunny && input.leaving.bunny && input.present.bunny > 0.3) {
    show.bye.bunny = true;
    if (start("bye", ["bunny"])) return show.active;
  }
  if (!show.bye.bold && input.leaving.bold && input.present.bold > 0.3) {
    show.bye.bold = true;
    show.bye.soft = true;
    if (
      start(
        "farewell",
        castOf("farewell", (id) => input.present[id] > 0.3),
      )
    ) {
      return show.active;
    }
  }
  if (input.pressed && start("cheer", castOf("cheer", here))) return show.active;
  if (show.rest >= REST_BEFORE) {
    // The next of the order that the friends who are here can play.
    for (let k = 0; k < AT_REST.length; k += 1) {
      const kind = AT_REST[(show.count + k) % AT_REST.length] ?? "dance";
      const cast = castOf(kind, here);
      if (!cast || (input.leaving.bunny && cast.includes("bunny"))) continue;
      show.count += k + 1;
      if (start(kind, cast)) return show.active;
    }
  }
  return null;
}
