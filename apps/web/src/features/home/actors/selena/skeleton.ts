/**
 * The bones as numbers. The animation writes a local pose (ten numbers a bone: position, rotation,
 * scale), the actor adds turns on top (the gaze, the fingers, a reaction), and this module walks the
 * hierarchy once to find where every bone ends up in the model's own space. The hair solver reads
 * that and changes the rotations of the bones it owns. Everything is flat arrays, so one frame
 * allocates nothing, and the maths does not need three.js (the tests run without a GPU).
 *
 * Scale is ignored in the chain: the rig keeps every bone at scale 1 but the eyes, whose scale does
 * not move anything else.
 */
import { POSE_STRIDE } from "./sampler";
import { qaxis, qconj, qidentity, qmul, qrotate } from "./quat";

export interface Hierarchy {
  readonly count: number;
  /** The index of each bone's parent, or -1. A parent always comes before its children. */
  readonly parent: Int32Array;
}

/** What one frame of posing works on. The arrays are allocated once. */
export class PoseWork {
  /** The final local rotation of each bone (the clip's, with the turns below applied). */
  readonly fq: Float32Array;
  /** Where each bone's head is in model space (three a bone). */
  readonly mp: Float32Array;
  /** Each bone's rotation in model space (four a bone). */
  readonly mq: Float32Array;
  /** A turn about the bone's own axes, applied after its clip rotation (fingers, the jaw). */
  readonly post: Float32Array;
  /** A turn about the model's axes, applied on top of the bone's whole rotation (gaze, a lean). */
  readonly pre: Float32Array;
  private readonly hasPost: Uint8Array;
  private readonly hasPre: Uint8Array;
  private readonly tmp = new Float32Array(8);

  constructor(readonly count: number) {
    this.fq = new Float32Array(count * 4);
    this.mp = new Float32Array(count * 3);
    this.mq = new Float32Array(count * 4);
    this.post = new Float32Array(count * 4);
    this.pre = new Float32Array(count * 4);
    this.hasPost = new Uint8Array(count);
    this.hasPre = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      qidentity(this.post, i * 4);
      qidentity(this.pre, i * 4);
    }
  }

  /** Forget every turn. Call it at the start of a frame, before the sections of the actor add theirs. */
  clearTurns(): void {
    this.hasPost.fill(0);
    this.hasPre.fill(0);
  }

  /** Add a turn about a unit axis in the bone's own frame (after what is already added). */
  turnLocal(node: number, ax: number, ay: number, az: number, angle: number): void {
    if (angle === 0) return;
    const t = this.tmp;
    qaxis(ax, ay, az, angle, t, 0);
    if (this.hasPost[node]) {
      qmul(this.post, node * 4, t, 0, this.post, node * 4);
    } else {
      this.post[node * 4] = t[0]!;
      this.post[node * 4 + 1] = t[1]!;
      this.post[node * 4 + 2] = t[2]!;
      this.post[node * 4 + 3] = t[3]!;
      this.hasPost[node] = 1;
    }
  }

  /** Add a turn about a unit axis of the model's space, about the bone's own head. */
  turnModel(node: number, ax: number, ay: number, az: number, angle: number): void {
    if (angle === 0) return;
    const t = this.tmp;
    qaxis(ax, ay, az, angle, t, 0);
    if (this.hasPre[node]) {
      qmul(t, 0, this.pre, node * 4, this.pre, node * 4);
    } else {
      this.pre[node * 4] = t[0]!;
      this.pre[node * 4 + 1] = t[1]!;
      this.pre[node * 4 + 2] = t[2]!;
      this.pre[node * 4 + 3] = t[3]!;
      this.hasPre[node] = 1;
    }
  }

  /** Walk the hierarchy: fill `fq`, `mq` and `mp` from the local pose and the turns. */
  compose(h: Hierarchy, pose: Float32Array): void {
    const { fq, mp, mq, post, pre, hasPost, hasPre, tmp } = this;
    for (let i = 0; i < h.count; i += 1) {
      const o = i * POSE_STRIDE;
      // The clip's rotation, then the bone's own turns after it.
      fq[i * 4] = pose[o + 3]!;
      fq[i * 4 + 1] = pose[o + 4]!;
      fq[i * 4 + 2] = pose[o + 5]!;
      fq[i * 4 + 3] = pose[o + 6]!;
      if (hasPost[i]) qmul(fq, i * 4, post, i * 4, fq, i * 4);
      const p = h.parent[i]!;
      if (p < 0) {
        mp[i * 3] = pose[o]!;
        mp[i * 3 + 1] = pose[o + 1]!;
        mp[i * 3 + 2] = pose[o + 2]!;
        mq[i * 4] = fq[i * 4]!;
        mq[i * 4 + 1] = fq[i * 4 + 1]!;
        mq[i * 4 + 2] = fq[i * 4 + 2]!;
        mq[i * 4 + 3] = fq[i * 4 + 3]!;
        if (hasPre[i]) qmul(pre, i * 4, mq, i * 4, mq, i * 4);
        continue;
      }
      qrotate(mq, p * 4, pose[o]!, pose[o + 1]!, pose[o + 2]!, tmp, 0);
      mp[i * 3] = mp[p * 3]! + tmp[0]!;
      mp[i * 3 + 1] = mp[p * 3 + 1]! + tmp[1]!;
      mp[i * 3 + 2] = mp[p * 3 + 2]! + tmp[2]!;
      qmul(mq, p * 4, fq, i * 4, mq, i * 4);
      if (hasPre[i]) {
        // A turn in model space: the bone's model rotation becomes pre * model, and the local
        // rotation that gives it is the parent's inverse times that.
        qmul(pre, i * 4, mq, i * 4, mq, i * 4);
        qconj(mq, p * 4, tmp, 4);
        qmul(tmp, 4, mq, i * 4, fq, i * 4);
      }
    }
  }
}
