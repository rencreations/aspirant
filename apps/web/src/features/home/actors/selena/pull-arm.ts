/**
 * The pulling arm on her skeleton (round seven). `pull.ts` is the arithmetic; this is the plumbing:
 * where the wrist is in the world, where the screen wants it, and the turns written to the bones.
 * The actor calls `measure` after it has composed the clip's pose, and, while a section asks for a
 * pull, `apply` and a second compose. Nothing here allocates in a frame.
 */
import { Vector3, type PerspectiveCamera } from "three";

import { ANCHOR } from "./constants";
import {
  ARM,
  FINGERS,
  fingerBones,
  fingerClose,
  flexAxis,
  gripAngle,
  newArmSolve,
  solveArm,
} from "./pull";
import { qconj, qrotate } from "./quat";
import type { Rig } from "./rig";
import type { PoseWork } from "./skeleton";

export interface PullInput {
  /** The camera of this frame (its matrices are current). */
  camera: PerspectiveCamera;
  /** Where the wrist goes, as a point of the picture: normalised device coordinates, y up. */
  x: number;
  y: number;
  /** The wrist's distance from the camera, as a share of the clip's own (1 keeps it). */
  depth: number;
  /** The grip: 0 the hand as the clip has it, 1 the fingers closed on the edge. */
  close: number;
  /** How much of the move is on: 0 is the clip's arm, 1 the target. */
  weight: number;
}

export class PullArm {
  /** The wrist in the world as the clip has it (before the solve), updated every frame. */
  readonly clipHand = new Vector3();
  private readonly upper: number;
  private readonly fore: number;
  private readonly hand: number;
  private readonly fingerNode: Int32Array;
  private readonly fingerAxis: Float32Array;
  private readonly solve = newArmSolve();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly cam = new Vector3();
  private readonly fwd = new Vector3();
  private readonly t = new Float32Array(8);

  constructor(rig: Rig) {
    this.upper = rig.index.get(ARM.upper) ?? -1;
    this.fore = rig.index.get(ARM.fore) ?? -1;
    this.hand = rig.index.get(ARM.hand) ?? -1;
    this.fingerNode = new Int32Array(15).fill(-1);
    this.fingerAxis = new Float32Array(45);
    FINGERS.forEach((finger, f) => {
      const axis = flexAxis("R", finger);
      fingerBones(finger).forEach((name, j) => {
        this.fingerNode[f * 3 + j] = rig.index.get(name) ?? -1;
        this.fingerAxis.set(axis, (f * 3 + j) * 3);
      });
    });
  }

  get ok(): boolean {
    return this.upper >= 0 && this.fore >= 0 && this.hand >= 0;
  }

  /** Model space (metres) to the world, for a figure placed at `pos` with `gq` and `scale`. */
  private toWorld(
    m: Vector3,
    pos: Vector3,
    gq: Float32Array,
    scale: number,
    out: Vector3,
  ): Vector3 {
    const t = this.t;
    qrotate(
      gq,
      0,
      (m.x - ANCHOR[0]) * scale,
      (m.y - ANCHOR[1]) * scale,
      (m.z - ANCHOR[2]) * scale,
      t,
      0,
    );
    return out.set(pos.x + t[0]!, pos.y + t[1]!, pos.z + t[2]!);
  }

  /** After the clip's pose is composed: where the wrist is in the world. */
  measure(work: PoseWork, pos: Vector3, gq: Float32Array, scale: number): void {
    if (!this.ok) return;
    const mp = work.mp;
    this.a.set(mp[this.hand * 3]!, mp[this.hand * 3 + 1]!, mp[this.hand * 3 + 2]!);
    this.toWorld(this.a, pos, gq, scale, this.clipHand);
  }

  /**
   * Add the turns of the pull: the arm to the target, the fingers to the grip. The caller composes
   * again afterwards. `measure` must have run on this pose.
   */
  apply(input: PullInput, work: PoseWork, pos: Vector3, gq: Float32Array, scale: number): void {
    if (!this.ok) return;
    const w = Math.min(1, Math.max(0, input.weight));
    const cam = input.camera;
    // The picture's ray through (x, y), and the distance along the view axis the wrist keeps.
    cam.getWorldDirection(this.fwd);
    this.cam.setFromMatrixPosition(cam.matrixWorld);
    this.a.set(input.x, input.y, 0.5).unproject(cam).sub(this.cam).normalize();
    const along = this.a.dot(this.fwd);
    const depth = this.b.copy(this.clipHand).sub(this.cam).dot(this.fwd) * input.depth;
    if (along > 1e-3 && depth > 0) {
      this.a.multiplyScalar(depth / along).add(this.cam);
      // The wanted wrist, blended from where the clip has it.
      this.a.lerpVectors(this.clipHand, this.a, w);
      // World to model.
      const t = this.t;
      qconj(gq, 0, t, 4);
      qrotate(t, 4, this.a.x - pos.x, this.a.y - pos.y, this.a.z - pos.z, t, 0);
      const mx = ANCHOR[0] + t[0]! / scale;
      const my = ANCHOR[1] + t[1]! / scale;
      const mz = ANCHOR[2] + t[2]! / scale;
      const s = solveArm(
        work.mp,
        this.upper * 3,
        this.fore * 3,
        this.hand * 3,
        mx,
        my,
        mz,
        this.solve,
      );
      const u = s.upper;
      const f = s.fore;
      work.turnModel(this.upper, u.ax, u.ay, u.az, u.angle);
      work.turnModel(this.fore, f.ax, f.ay, f.az, f.angle);
    }
    // The grip, a finger at a time.
    for (let f = 0; f < 5; f += 1) {
      const finger = FINGERS[f]!;
      const c = fingerClose(finger, input.close);
      if (c <= 0) continue;
      for (let j = 0; j < 3; j += 1) {
        const node = this.fingerNode[f * 3 + j]!;
        if (node < 0) continue;
        const o = (f * 3 + j) * 3;
        work.turnLocal(
          node,
          this.fingerAxis[o]!,
          this.fingerAxis[o + 1]!,
          this.fingerAxis[o + 2]!,
          gripAngle(finger, j as 0 | 1 | 2, c),
        );
      }
    }
  }
}
