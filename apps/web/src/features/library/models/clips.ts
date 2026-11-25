import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Quaternion,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from "three";

import { mergeKeyTimes, nearestKey } from "./logic";

/** What the timeline needs of a clip. */
export interface ClipFacts {
  id: string;
  duration: number;
  /** Every time the clip has a key, sorted. */
  keys: number[];
}

/** Blend between two clips the visitor picks, in seconds. */
export const PICK_FADE = 0.3;
/** Blend over the seam of a loop whose last pose is not its first. */
const SEAM_FADE = 0.28;
/** A loop whose ends are this close is seamless as it is (radians, metres). */
const SEAM_TURN = (2.5 * Math.PI) / 180;
const SEAM_MOVE = 0.01;

const qa = new Quaternion();
const qb = new Quaternion();

/** True when the clip ends on the pose it starts with (to the eye). */
function closes(clip: AnimationClip): boolean {
  for (const track of clip.tracks) {
    const v = track.values;
    const size = track.getValueSize();
    const n = track.times.length;
    if (n < 2) continue;
    const last = (n - 1) * size;
    if (track.name.endsWith(".quaternion")) {
      qa.fromArray(v, 0);
      qb.fromArray(v, last);
      if (qa.angleTo(qb) > SEAM_TURN) return false;
    } else if (track.name.endsWith(".position")) {
      const d = Math.hypot(
        (v[last] ?? 0) - (v[0] ?? 0),
        (v[last + 1] ?? 0) - (v[1] ?? 0),
        (v[last + 2] ?? 0) - (v[2] ?? 0),
      );
      if (d > SEAM_MOVE) return false;
    } else if (track.name.endsWith(".scale")) {
      for (let k = 0; k < size; k += 1) {
        if (Math.abs((v[last + k] ?? 0) - (v[k] ?? 0)) > 0.02) return false;
      }
    }
  }
  return true;
}

/**
 * The clips of one model on one mixer. One clip plays at a time; a new pick blends from the one
 * before. Every pick loops: a clip that ends where it starts loops as it is, one that does not
 * blends over its seam into a fresh start (a twin action of the same clip), so nothing jumps.
 *
 * Paused, the pose holds and the visitor can drag the playhead or step by keys.
 */
export class ClipPlayer {
  readonly mixer: AnimationMixer;
  private readonly root: Object3D;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly twins = new Map<string, AnimationClip>();
  private readonly seamless = new Map<string, boolean>();
  private readonly facts = new Map<string, ClipFacts>();
  private active: AnimationAction | null = null;
  private activeId = "";
  /** While a seam blends, the action that is going. */
  private leaving: AnimationAction | null = null;
  private looping = true;
  playing = true;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.root = root;
    this.mixer = new AnimationMixer(root);
    for (const clip of clips) {
      this.clips.set(clip.name, clip);
      this.seamless.set(clip.name, closes(clip));
      this.facts.set(clip.name, {
        id: clip.name,
        duration: clip.duration,
        keys: mergeKeyTimes(
          clip.tracks.map((t) => t.times),
          clip.duration,
        ),
      });
    }
  }

  has(id: string): boolean {
    return this.clips.has(id);
  }

  factsOf(id: string): ClipFacts | null {
    return this.facts.get(id) ?? null;
  }

  get current(): string {
    return this.activeId;
  }

  /** The time of the clip on show. */
  get time(): number {
    return this.active?.time ?? 0;
  }

  get duration(): number {
    return this.active?.getClip().duration ?? 0;
  }

  /** The weight of the clip `id` at this moment (both actions of a seam counted), 0 to 1. */
  weightOf(id: string): number {
    let w = 0;
    for (const a of [this.active, this.leaving]) {
      if (!a) continue;
      const name = a.getClip().name;
      if (name === id || name === `${id}#twin`) w += a.getEffectiveWeight();
    }
    return Math.min(1, w);
  }

  /**
   * Play `id` from `from` seconds, blending from what played over `fade` seconds. With
   * `loop: false` the clip plays once and holds its last pose (the form change).
   */
  play(id: string, options: { fade?: number; from?: number; loop?: boolean } = {}): boolean {
    const clip = this.clips.get(id);
    if (!clip) return false;
    const fade = options.fade ?? PICK_FADE;
    const loop = options.loop ?? true;
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.time = Math.max(0, Math.min(clip.duration, options.from ?? 0));
    const seamed = loop && !(this.seamless.get(id) ?? true);
    action.setLoop(seamed || !loop ? LoopOnce : LoopRepeat, Infinity);
    action.clampWhenFinished = true;
    const before = this.active;
    this.stopLeaving();
    if (before && before !== action && fade > 0) {
      action.play();
      action.crossFadeFrom(before, fade, false);
      this.leaving = before;
    } else {
      if (before && before !== action) before.stop();
      action.play();
    }
    this.active = action;
    this.activeId = id;
    this.looping = loop;
    this.mixer.update(0);
    return true;
  }

  /** Move the clip on show by `dt` seconds (nothing while paused). */
  update(dt: number): void {
    const a = this.active;
    if (!a) return;
    if (!this.playing) {
      this.mixer.update(0);
      return;
    }
    const clip = a.getClip();
    const seamed = this.looping && !(this.seamless.get(this.activeId) ?? true);
    if (seamed && a.time + dt >= clip.duration - SEAM_FADE && this.leaving === null) {
      // The seam: a fresh start of the same clip blends in while this one finishes.
      const twin = this.twinOf(this.activeId, a);
      if (twin) {
        twin.reset();
        twin.enabled = true;
        twin.setLoop(LoopOnce, Infinity);
        twin.clampWhenFinished = true;
        twin.time = 0;
        twin.setEffectiveWeight(1);
        twin.play();
        twin.crossFadeFrom(a, SEAM_FADE, false);
        this.leaving = a;
        this.active = twin;
      }
    }
    this.mixer.update(dt);
    // A leaving action whose blend is over is stopped, so it costs nothing.
    if (this.leaving && this.leaving.getEffectiveWeight() <= 0.001) this.stopLeaving();
  }

  /** The twin of a clip: the other action a seam blends into (the first action is used again after). */
  private twinOf(id: string, from: AnimationAction): AnimationAction | null {
    const clip = this.clips.get(id);
    if (!clip) return null;
    const first = this.mixer.clipAction(clip);
    if (from !== first) return first;
    let twin = this.twins.get(id);
    if (!twin) {
      twin = clip.clone();
      twin.name = `${id}#twin`;
      this.twins.set(id, twin);
    }
    return this.mixer.clipAction(twin);
  }

  private stopLeaving(): void {
    if (this.leaving && this.leaving !== this.active) this.leaving.stop();
    this.leaving = null;
  }

  /** Put the clip on show at `t` seconds. Any blend stops: the pose is the clip's alone. */
  seek(t: number): void {
    const a = this.active;
    if (!a) return;
    this.stopLeaving();
    const d = a.getClip().duration;
    a.enabled = true;
    a.paused = false;
    a.setEffectiveWeight(1);
    a.time = Math.max(0, Math.min(d, t));
    // A seek past the end of a seam loop must not hold the end: it plays on from there.
    if (!a.isRunning()) a.play();
    this.mixer.update(0);
  }

  /** Step to the key before or after the playhead (pauses). */
  step(direction: 1 | -1): void {
    const facts = this.facts.get(this.activeId);
    if (!facts || facts.keys.length === 0) return;
    this.playing = false;
    const at = nearestKey(facts.keys, this.time);
    const keys = facts.keys;
    const next = Math.max(0, Math.min(keys.length - 1, at + direction));
    this.seek(keys[next] ?? 0);
  }

  /** True when a play-once clip has reached its end. */
  get finished(): boolean {
    const a = this.active;
    if (!a) return false;
    return !this.looping && a.time >= a.getClip().duration - 1e-4;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
