/**
 * The baked walk of the doll (`walk` in doll.glb: 22 rotation tracks and the hips' position, 32
 * keys at 30 fps, in place, looping). It is not played by a mixer: a mixer writes straight to the
 * bones and would fight the poses. The sampler reads the tracks at a phase and fills a `PoseData`
 * with the same layout as every pose, so a clip and a pose blend in one place and the walk can be
 * scrubbed by distance (a section's scroll) as well as run by time.
 */
import type { AnimationClip, Interpolant, KeyframeTrack } from "three";

import { at } from "../motion";

import { boneIndex, type PoseData } from "./math";

/** `createInterpolant` is on every track at run time and missing from the typings. */
function interpolantOf(track: KeyframeTrack): Interpolant {
  return (track as unknown as { createInterpolant(): Interpolant }).createInterpolant();
}

interface Lane {
  readonly bone: number;
  readonly kind: "q" | "p";
  readonly interpolant: Interpolant;
}

export class WalkSampler {
  readonly duration: number;
  private readonly lanes: Lane[] = [];

  constructor(clip: AnimationClip) {
    this.duration = clip.duration;
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf(".");
      if (dot < 0) continue;
      const prop = track.name.slice(dot + 1);
      const name = track.name.slice(0, dot);
      let bone: number;
      try {
        bone = boneIndex(name);
      } catch {
        continue;
      }
      if (prop === "quaternion") {
        this.lanes.push({ bone, kind: "q", interpolant: interpolantOf(track) });
      } else if (prop === "position" && bone === 0) {
        this.lanes.push({ bone, kind: "p", interpolant: interpolantOf(track) });
      }
    }
  }

  /** How many tracks the sampler found (22 rotations and the hips' position in the shipped file). */
  get tracks(): number {
    return this.lanes.length;
  }

  /** Fill `out` with the walk at `phase` (cycles; any real number, it wraps). Bones with no track are left alone. */
  sample(phase: number, out: PoseData): void {
    const cycle = phase - Math.floor(phase);
    const t = cycle * this.duration;
    for (const lane of this.lanes) {
      const r = lane.interpolant.evaluate(t);
      if (lane.kind === "q") {
        const k = lane.bone * 4;
        out.q[k] = at(r, 0);
        out.q[k + 1] = at(r, 1);
        out.q[k + 2] = at(r, 2);
        out.q[k + 3] = at(r, 3);
      } else {
        out.hips[0] = at(r, 0);
        out.hips[1] = at(r, 1);
        out.hips[2] = at(r, 2);
      }
    }
  }
}
