/**
 * The bones of Silverbolt as one thing to pose. Every frame the pose is built from the same three
 * steps, in this order, so nothing sticks and nothing piles up:
 *
 *  1. `reset()` puts every bone back to its rest transform (a bone the clip has no track for, such
 *     as the two eye bones that the build added, would otherwise keep last frame's blink);
 *  2. the base pose is written (a clip through the mixer, or nothing: the rest pose);
 *  3. additive turns are asked for, then `apply()` lays them on top, parents first.
 *
 * A turn is one of two kinds. `turnLocal` spins a bone about one of its own axes (the hinge axes in
 * `facts.ts` are of this kind). `turnFrame` is a rotation in the model's frame (the head faces +Z,
 * Y is up, X is the dragon's left): "yaw the head 20 degrees" does not need to know how the bone
 * is oriented. Both are applied about the bone's joint, on top of whatever the base pose says.
 */
import { type Bone, type Object3D, Quaternion, Vector3 } from "three";

const LOCAL = 1;
const FRAME = 2;
const POS = 4;
const SCALE = 8;

const qA = new Quaternion();
const qB = new Quaternion();
const qInv = new Quaternion();
const vA = new Vector3();
const identity = new Quaternion();

export class Rig {
  readonly bones: Bone[] = [];
  private readonly byName = new Map<string, number>();
  private readonly parent: number[] = [];
  private readonly restP: Vector3[] = [];
  private readonly restQ: Quaternion[] = [];
  private readonly restS: Vector3[] = [];
  private readonly qa: Quaternion[] = [];
  private readonly dLocal: Quaternion[] = [];
  private readonly dFrame: Quaternion[] = [];
  private readonly dPos: Vector3[] = [];
  private readonly dScale: Vector3[] = [];
  private readonly flags: Uint8Array;

  /** `root` is the model's scene: its bones hang on it (there is no armature node). */
  constructor(root: Object3D) {
    const at = new Map<Object3D, number>();
    root.traverse((o) => {
      const bone = o as Bone;
      if (!bone.isBone) return;
      const i = this.bones.length;
      this.bones.push(bone);
      at.set(bone, i);
      this.byName.set(bone.name, i);
    });
    for (const bone of this.bones) {
      this.parent.push(bone.parent ? (at.get(bone.parent) ?? -1) : -1);
      this.restP.push(bone.position.clone());
      this.restQ.push(bone.quaternion.clone());
      this.restS.push(bone.scale.clone());
      this.qa.push(new Quaternion());
      this.dLocal.push(new Quaternion());
      this.dFrame.push(new Quaternion());
      this.dPos.push(new Vector3());
      this.dScale.push(new Vector3(1, 1, 1));
    }
    this.flags = new Uint8Array(this.bones.length);
  }

  /** The index of a bone by its name. Throws on a name the model does not have. */
  id(name: string): number {
    const i = this.byName.get(name);
    if (i === undefined) throw new Error(`Silverbolt has no bone "${name}"`);
    return i;
  }

  bone(name: string): Bone {
    return this.bones[this.id(name)]!;
  }

  /** Every bone to its rest transform, every turn forgotten. */
  reset(): void {
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i]!;
      b.position.copy(this.restP[i]!);
      b.quaternion.copy(this.restQ[i]!);
      b.scale.copy(this.restS[i]!);
      this.dLocal[i]!.identity();
      this.dFrame[i]!.identity();
      this.dPos[i]!.set(0, 0, 0);
      this.dScale[i]!.set(1, 1, 1);
    }
    this.flags.fill(0);
  }

  /** Put one bone back to rest (the root of a pinned clip). */
  restore(name: string): void {
    const i = this.id(name);
    const b = this.bones[i]!;
    b.position.copy(this.restP[i]!);
    b.quaternion.copy(this.restQ[i]!);
    b.scale.copy(this.restS[i]!);
  }

  /** Spin a bone about one of its own axes (unit vector `(ax, ay, az)`), after what it already does. */
  turnLocal(i: number, ax: number, ay: number, az: number, angle: number): void {
    if (angle === 0) return;
    qA.setFromAxisAngle(vA.set(ax, ay, az), angle);
    this.dLocal[i]!.multiply(qA);
    this.flags[i] = this.flags[i]! | LOCAL;
  }

  /** A rotation in the model's frame, applied before what the bone already does. */
  turnFrame(i: number, q: Quaternion): void {
    this.dFrame[i]!.premultiply(q);
    this.flags[i] = this.flags[i]! | FRAME;
  }

  /** A move of the bone's joint in the model's frame, metres. */
  offsetFrame(i: number, x: number, y: number, z: number): void {
    this.dPos[i]!.add(vA.set(x, y, z));
    this.flags[i] = this.flags[i]! | POS;
  }

  /** Multiply the bone's own scale (the eyes squash in Y to blink). */
  scaleBy(i: number, x: number, y: number, z: number): void {
    const s = this.dScale[i]!;
    s.x *= x;
    s.y *= y;
    s.z *= z;
    this.flags[i] = this.flags[i]! | SCALE;
  }

  /** Lay the turns on the bones, parents first. Afterwards `frameOf` is the bone's orientation in the model's frame. */
  apply(): void {
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i]!;
      const p = this.parent[i]!;
      const qpa = p >= 0 ? this.qa[p]! : identity;
      const f = this.flags[i]!;
      const qa = this.qa[i]!;
      if (f & (LOCAL | FRAME)) {
        qB.copy(qpa).multiply(b.quaternion);
        if (f & FRAME) qB.premultiply(this.dFrame[i]!);
        if (f & LOCAL) qB.multiply(this.dLocal[i]!);
        qInv.copy(qpa).invert();
        b.quaternion.copy(qInv).multiply(qB);
        qa.copy(qB);
      } else {
        qa.copy(qpa).multiply(b.quaternion);
      }
      if (f & POS) {
        qInv.copy(qpa).invert();
        b.position.add(vA.copy(this.dPos[i]!).applyQuaternion(qInv));
      }
      if (f & SCALE) b.scale.multiply(this.dScale[i]!);
    }
  }

  /** The bone's orientation in the model's frame after the last `apply()`. */
  frameOf(i: number): Quaternion {
    return this.qa[i]!;
  }
}
