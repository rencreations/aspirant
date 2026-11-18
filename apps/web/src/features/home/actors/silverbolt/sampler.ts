/**
 * Plays a baked clip by writing its pose onto the bones, every time it is asked. Three's
 * `AnimationMixer` only writes a bone when its own last output changed, and the actor puts every
 * bone back to rest at the start of each frame (so its turns never pile up), so a clip held at one
 * time would leave the dragon at rest. This sampler has no such memory: `pose(name, time)` always
 * writes, `mix(name, time, w)` blends a second clip in by `w`, and nothing is allocated per call.
 */
import { type AnimationClip, type Bone, Quaternion, Vector3 } from "three";

type Kind = "position" | "quaternion" | "scale";

interface Evaluator {
  evaluate(time: number): ArrayLike<number>;
}

interface Channel {
  readonly bone: Bone;
  readonly kind: Kind;
  readonly evaluate: (time: number) => ArrayLike<number>;
}

interface Sampled {
  readonly duration: number;
  readonly channels: Channel[];
}

const qA = new Quaternion();
const vA = new Vector3();
const vB = new Vector3();

/** The time inside a clip: a loop wraps, anything else holds its first and last keys. */
export function clipTime(time: number, duration: number, loops: boolean): number {
  if (!(duration > 0)) return 0;
  if (loops) return ((time % duration) + duration) % duration;
  return Math.min(duration, Math.max(0, time));
}

export class ClipSampler {
  private readonly clips = new Map<string, Sampled>();

  /** `bones` is every bone of the model by name. Tracks of a bone it does not have are left out. */
  constructor(clips: readonly AnimationClip[], bones: ReadonlyMap<string, Bone>) {
    for (const clip of clips) {
      const channels: Channel[] = [];
      for (const track of clip.tracks) {
        const dot = track.name.lastIndexOf(".");
        const bone = bones.get(track.name.slice(0, dot));
        const kind = track.name.slice(dot + 1);
        if (!bone || (kind !== "position" && kind !== "quaternion" && kind !== "scale")) continue;
        // `createInterpolant` is on every track at runtime (the factory of its interpolation mode).
        const made = track as unknown as { createInterpolant(): Evaluator };
        const interpolant = made.createInterpolant();
        channels.push({ bone, kind, evaluate: (t) => interpolant.evaluate(t) });
      }
      this.clips.set(clip.name, { duration: clip.duration, channels });
    }
  }

  has(name: string): boolean {
    return this.clips.has(name);
  }

  /** Write the clip's pose at `time` (already wrapped or clamped, see `clipTime`) onto the bones. */
  pose(name: string, time: number): void {
    const clip = this.clips.get(name);
    if (!clip) return;
    for (const c of clip.channels) {
      const v = c.evaluate(time);
      if (c.kind === "position") c.bone.position.set(v[0]!, v[1]!, v[2]);
      else if (c.kind === "scale") c.bone.scale.set(v[0]!, v[1]!, v[2]);
      else c.bone.quaternion.set(v[0]!, v[1]!, v[2]!, v[3]!);
    }
  }

  /** Blend a second clip into what is on the bones: 0 keeps the bones, 1 is that clip's pose. */
  mix(name: string, time: number, weight: number): void {
    const clip = this.clips.get(name);
    if (!clip || !(weight > 0)) return;
    for (const c of clip.channels) {
      const v = c.evaluate(time);
      if (c.kind === "position") {
        c.bone.position.lerp(vA.set(v[0]!, v[1]!, v[2]), weight);
      } else if (c.kind === "scale") {
        c.bone.scale.lerp(vB.set(v[0]!, v[1]!, v[2]), weight);
      } else {
        c.bone.quaternion.slerp(qA.set(v[0]!, v[1]!, v[2]!, v[3]!), weight);
      }
    }
  }
}
