/**
 * Where her hands go, pure (round six). The rider solves both arms by two bone IK to two sockets
 * (`gripL`, `gripR`); the pair moves the sockets. This turns the poses of a `PairCue` (both up, a wave,
 * a clap, a pat, a hug) into the two targets in the SEAT's frame, in pixels. The table is in her drawn
 * heights (`u`), so it does not depend on her size; her arm reaches about 0.31 u from the shoulder.
 *
 * Axes of the seat: x toward her left (the viewer's right while she faces us), y up, z forward. The
 * seat is the top of the drone's helmet; her hips sit a few hundredths of `u` above it.
 */
import type { PairCue } from "./choreo";

interface Hand {
  x: number;
  y: number;
  z: number;
}

export interface Hands {
  l: Hand;
  r: Hand;
  /** The weight of each hand on its target, 0 to 1. */
  wl: number;
  wr: number;
}

export function createHands(): Hands {
  return { l: { x: 0, y: 0, z: 0 }, r: { x: 0, y: 0, z: 0 }, wl: 1, wr: 1 };
}

/** The poses, in `u` from the seat's origin: `[x, y, z]` for her left hand (the right is mirrored in x). */
const REST: readonly [number, number, number] = [0.2, 0.03, 0.12];
const UP: readonly [number, number, number] = [0.27, 0.44, 0.0];
const WAVE: readonly [number, number, number] = [0.3, 0.42, 0.05];
const CLAP: readonly [number, number, number] = [0.04, 0.2, 0.2];
const PAT: readonly [number, number, number] = [0.05, 0.0, 0.3];
const HUG: readonly [number, number, number] = [0.27, -0.04, 0.2];

const TAU = Math.PI * 2;

/** One frame: the targets from the cue's pose weights. `perMetre` and `drawn` size the table; `lean` leans the reach. */
export function stepHands(
  out: Hands,
  c: PairCue,
  dt: number,
  time: number,
  drawn: number,
  perMetre: number,
  lean: number,
): Hands {
  void dt;
  void perMetre;
  const u = drawn;
  // Start from rest and add the pose weights (each a move from rest toward its pose).
  let lx = REST[0];
  let ly = REST[1];
  let lz = REST[2];
  let rx = REST[0];
  let ry = REST[1];
  let rz = REST[2];
  const toward = (
    w: number,
    p: readonly [number, number, number],
    side: "l" | "r" | "both",
  ): void => {
    if (w <= 0) return;
    if (side !== "r") {
      lx += (p[0] - REST[0]) * w;
      ly += (p[1] - REST[1]) * w;
      lz += (p[2] - REST[2]) * w;
    }
    if (side !== "l") {
      rx += (p[0] - REST[0]) * w;
      ry += (p[1] - REST[1]) * w;
      rz += (p[2] - REST[2]) * w;
    }
  };
  const beat = time * 2.2;
  toward(c.armsUp, UP, "both");
  // The wave: the hand over the head swings from side to side.
  if (c.waveR > 0) {
    const sway = Math.sin(beat * TAU * 0.9) * 0.07;
    rx += (WAVE[0] - REST[0]) * c.waveR + sway * c.waveR;
    ry += (WAVE[1] - REST[1]) * c.waveR + Math.abs(Math.sin(beat * TAU * 0.9)) * 0.03 * c.waveR;
    rz += (WAVE[2] - REST[2]) * c.waveR;
  }
  if (c.waveL > 0) {
    const sway = Math.sin(beat * TAU * 0.9) * 0.07;
    lx += (WAVE[0] - REST[0]) * c.waveL + sway * c.waveL;
    ly += (WAVE[1] - REST[1]) * c.waveL;
    lz += (WAVE[2] - REST[2]) * c.waveL;
  }
  // The clap: the hands come together in front of her chest on every beat.
  if (c.clap > 0) {
    const hit = Math.max(0, Math.cos(c.beat * TAU)) ** 2;
    const apart = 0.07 * (1 - hit);
    lx += (CLAP[0] + apart - REST[0]) * c.clap;
    ly += (CLAP[1] - REST[1]) * c.clap;
    lz += (CLAP[2] - REST[2]) * c.clap;
    rx += (CLAP[0] + apart - REST[0]) * c.clap;
    ry += (CLAP[1] - REST[1]) * c.clap;
    rz += (CLAP[2] - REST[2]) * c.clap;
  }
  // The pat: the right hand goes to the front of the dome and pats three times.
  if (c.pat > 0) {
    const pat = Math.abs(Math.sin(time * TAU * 1.3)) * 0.06;
    rx += (PAT[0] - REST[0]) * c.pat;
    ry += (PAT[1] + pat - REST[1]) * c.pat;
    rz += (PAT[2] - REST[2]) * c.pat;
  }
  toward(c.hug, HUG, "both");

  out.l.x = lx * u;
  out.l.y = ly * u;
  out.l.z = lz * u;
  // Her right hand is the mirror: -x.
  out.r.x = -rx * u;
  out.r.y = ry * u;
  out.r.z = rz * u;
  // A lean toward the cursor leans the reach.
  out.l.x += lean * 0.03 * u;
  out.r.x += lean * 0.03 * u;
  out.wl = 1;
  out.wr = 1;
  return out;
}
