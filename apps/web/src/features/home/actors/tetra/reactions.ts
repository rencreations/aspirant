import { bump, clamp01, ramp } from "./ease";
import { type Channels } from "./channels";
import type { FaceName } from "./face";

/**
 * Her small moves with a clock of their own, and how she answers a press. A section sets the pose
 * every frame; these are laid over it, always finish, and never move her mark. Pure arithmetic.
 */
export type ShotName = "hop" | "rise" | "startle" | "nod";

export const SHOT_SECONDS: Readonly<Record<ShotName, number>> = {
  hop: 0.9,
  rise: 1.05,
  startle: 0.65,
  nod: 0.8,
};

export interface Shot {
  name: ShotName | null;
  t: number;
}

export function createShot(): Shot {
  return { name: null, t: 0 };
}

/** Start a move. A move that is playing is let finish first: the latest one asked for waits. */
export function startShot(s: Shot, name: ShotName): boolean {
  if (s.name) return false;
  s.name = name;
  s.t = 0;
  return true;
}

/** Step the clock. Returns true while a move plays. */
export function stepShot(s: Shot, dt: number): boolean {
  if (!s.name) return false;
  s.t += dt;
  if (s.t >= SHOT_SECONDS[s.name]) {
    s.name = null;
    s.t = 0;
    return false;
  }
  return true;
}

/** Add the move to the channels. */
export function applyShot(s: Shot, c: Channels): void {
  if (!s.name) return;
  const u = clamp01(s.t / SHOT_SECONDS[s.name]);
  if (s.name === "hop") {
    // Down, up, down: a crouch before she goes and a squash as she lands.
    const crouch = ramp(0, 0.18, u) * (1 - ramp(0.18, 0.26, u));
    const air = u > 0.2 && u < 0.78 ? (u - 0.2) / 0.58 : 0;
    c.y += 0.075 * 4 * air * (1 - air);
    c.squash +=
      -0.1 * crouch + 0.08 * bump(air) - 0.09 * ramp(0.78, 0.84, u) * (1 - ramp(0.84, 1, u));
    c.armL.z += 0.5 * bump(air);
    c.armR.z -= 0.5 * bump(air);
  } else if (s.name === "rise") {
    // Off the ground with both legs tucked, then down on her feet: the jump up out of a seat.
    const air = ramp(0.05, 0.4, u) * (1 - ramp(0.4, 0.85, u));
    c.y += 0.11 * air;
    c.squash +=
      -0.06 * ramp(0, 0.1, u) * (1 - ramp(0.1, 0.2, u)) -
      0.08 * ramp(0.84, 0.9, u) * (1 - ramp(0.9, 1, u));
    c.armL.z += 0.7 * air;
    c.armR.z -= 0.7 * air;
  } else if (s.name === "startle") {
    const pop = bump(Math.min(1, u * 1.6));
    c.squash += 0.12 * pop * (1 - u);
    c.armL.z += 0.55 * pop * (1 - u);
    c.armR.z -= 0.55 * pop * (1 - u);
    c.spine.x += -0.1 * pop * (1 - u);
  } else {
    c.head.x += 0.35 * bump(u);
    c.spine.x += 0.06 * bump(u);
  }
}

/** What a press answers: the move, the face and for how long. */
export interface Answer {
  shot: ShotName;
  face: FaceName;
  seconds: number;
}

export interface Presses {
  /** The time of the last press, and how many came in a row. */
  last: number;
  run: number;
}

export function createPresses(): Presses {
  return { last: -10, run: 0 };
}

/** The presses within this many seconds of each other are one run. */
const WINDOW = 2.2;
const ANNOYED_AT = 4;

/**
 * The answer to a press at `time`: a hop and a laugh, a hop and a smile, a start, and from the
 * fourth press in a row, annoyed. A pause makes the run start again.
 */
export function pressAnswer(p: Presses, time: number): Answer {
  p.run = time - p.last <= WINDOW ? p.run + 1 : 1;
  p.last = time;
  if (p.run >= ANNOYED_AT) return { shot: "startle", face: "annoyed", seconds: 1.8 };
  if (p.run === 3) return { shot: "startle", face: "surprised", seconds: 1 };
  if (p.run === 2) return { shot: "hop", face: "laugh", seconds: 1.1 };
  return { shot: "hop", face: "happy", seconds: 1.2 };
}
