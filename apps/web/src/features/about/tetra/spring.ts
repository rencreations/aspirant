import { Matrix4, Quaternion, Vector3, type Bone, type Object3D } from "three";

/**
 * The springs of Tetra's hair, ears and skirt: the small verlet solver of the source's viewer
 * (`spring.js` there), ported. Each spring bone keeps its parent's pose; its tail follows with
 * inertia and gravity, is pulled back to rest by its stiffness, and is kept out of the capsules of
 * the head, the body and the limbs.
 *
 * It works in the world's space and in metres, and its numbers were tuned at sixty steps a
 * second: so the model is never scaled, and the scene steps it at a fixed rate whatever the
 * display's rate is. A bone driven here is never driven by a clip or a turn as well.
 */
export interface SpringRow {
  bone: string;
  head: [number, number, number];
  tail: [number, number, number];
  stiffness: number;
  drag: number;
  gravity: number;
  hitRadius: number;
}

export interface ColliderRow {
  bone: string;
  head: [number, number, number];
  tail: [number, number, number];
  radius: number;
}

interface Joint {
  bone: Bone;
  row: SpringRow;
  rest: Quaternion;
  axis: Vector3;
  length: number;
  depth: number;
  cur: Vector3;
  prev: Vector3;
  live: boolean;
  ignore: Set<number>;
}

interface Capsule {
  bone: Bone;
  a: Vector3;
  b: Vector3;
  radius: number;
  /** The two ends in the world, this step. */
  wa: Vector3;
  wb: Vector3;
}

/** The solver's own step, in seconds. */
const STEP = 1 / 60;
/** No more than this many steps for one frame: a long frame is not caught up. */
const MAX_STEPS = 3;

const head = new Vector3();
const restTail = new Vector3();
const next = new Vector3();
const dir = new Vector3();
const ab = new Vector3();
const cp = new Vector3();
const tmp = new Vector3();
const inverse = new Matrix4();
const swing = new Quaternion();

function depthOf(o: Object3D): number {
  let depth = 0;
  for (let at: Object3D | null = o; at.parent; at = at.parent) depth += 1;
  return depth;
}

export class Springs {
  private readonly joints: Joint[] = [];
  private readonly capsules: Capsule[] = [];
  private pending = 0;

  /** `model` must be in its rest pose and unmoved when this is made. */
  constructor(
    private readonly model: Object3D,
    rows: readonly SpringRow[],
    colliders: readonly ColliderRow[],
  ) {
    model.updateMatrixWorld(true);
    const bones = new Map<string, Bone>();
    model.traverse((o) => {
      if ((o as Bone).isBone && !bones.has(o.name)) bones.set(o.name, o as Bone);
    });
    for (const row of rows) {
      const bone = bones.get(row.bone);
      if (!bone) continue;
      const headW = new Vector3(...row.head).applyMatrix4(model.matrixWorld);
      const tailW = new Vector3(...row.tail).applyMatrix4(model.matrixWorld);
      const local = tailW.clone().applyMatrix4(inverse.copy(bone.matrixWorld).invert());
      this.joints.push({
        bone,
        row,
        rest: bone.quaternion.clone(),
        axis: local.normalize(),
        length: Math.max(headW.distanceTo(tailW), 0.01),
        depth: depthOf(bone),
        cur: new Vector3(),
        prev: new Vector3(),
        live: false,
        ignore: new Set(),
      });
    }
    // Parents before children: a chain is solved from its root.
    this.joints.sort((a, b) => a.depth - b.depth);
    for (const row of colliders) {
      const bone = bones.get(row.bone);
      if (!bone) continue;
      inverse.copy(bone.matrixWorld).invert();
      this.capsules.push({
        bone,
        radius: row.radius,
        a: new Vector3(...row.head).applyMatrix4(model.matrixWorld).applyMatrix4(inverse),
        b: new Vector3(...row.tail).applyMatrix4(model.matrixWorld).applyMatrix4(inverse),
        wa: new Vector3(),
        wb: new Vector3(),
      });
    }
    // A capsule that already holds a joint's tail at rest is not minded by that joint: the hair
    // was modelled against the head.
    this.place();
    for (const joint of this.joints) {
      const tail = joint.axis
        .clone()
        .multiplyScalar(joint.length)
        .applyMatrix4(joint.bone.matrixWorld);
      this.capsules.forEach((c, i) => {
        if (this.gap(tail, c) < c.radius + joint.row.hitRadius + 0.01) joint.ignore.add(i);
      });
    }
  }

  /** The names of the bones the springs drive. */
  bones(): string[] {
    return this.joints.map((joint) => joint.bone.name);
  }

  /** Forget the motion: the next step starts from rest (after a jump of the pose, or a pause). */
  reset(): void {
    this.pending = 0;
    for (const joint of this.joints) {
      joint.live = false;
      joint.bone.quaternion.copy(joint.rest);
    }
  }

  /** The capsules' ends in the world, for this step. */
  private place(): void {
    for (const c of this.capsules) {
      c.wa.copy(c.a).applyMatrix4(c.bone.matrixWorld);
      c.wb.copy(c.b).applyMatrix4(c.bone.matrixWorld);
    }
  }

  /** How far a point is from a capsule's middle line. Leaves the nearest point in `cp`. */
  private gap(point: Vector3, c: Capsule): number {
    ab.copy(c.wb).sub(c.wa);
    const t = Math.min(
      1,
      Math.max(0, tmp.copy(point).sub(c.wa).dot(ab) / Math.max(ab.lengthSq(), 1e-9)),
    );
    cp.copy(c.wa).addScaledVector(ab, t);
    return point.distanceTo(cp);
  }

  /** After the clip and the turns have posed the body, and its matrices are up to date. */
  update(dt: number): void {
    this.pending = Math.min(this.pending + dt, MAX_STEPS * STEP);
    while (this.pending >= STEP) {
      this.pending -= STEP;
      this.step();
    }
  }

  private step(): void {
    this.model.updateMatrixWorld(true);
    this.place();
    for (const joint of this.joints) {
      const { bone, row } = joint;
      bone.quaternion.copy(joint.rest);
      bone.updateMatrixWorld(true);
      head.setFromMatrixPosition(bone.matrixWorld);
      restTail.copy(joint.axis).multiplyScalar(joint.length).applyMatrix4(bone.matrixWorld);
      if (!joint.live) {
        joint.cur.copy(restTail);
        joint.prev.copy(restTail);
        joint.live = true;
      }
      const keep = 1 - Math.min(0.98, row.drag);
      dir.copy(restTail).sub(head).normalize();
      next
        .copy(joint.cur)
        .addScaledVector(tmp.copy(joint.cur).sub(joint.prev), keep)
        .addScaledVector(dir, Math.min(1, row.stiffness) * 6 * STEP);
      next.y -= row.gravity * 9.8 * STEP * STEP * 9;
      // The bone keeps its length.
      next.sub(head).normalize().multiplyScalar(joint.length).add(head);
      for (let i = 0; i < this.capsules.length; i += 1) {
        if (joint.ignore.has(i)) continue;
        const c = this.capsules[i];
        if (!c) continue;
        const d = this.gap(next, c);
        const min = c.radius + row.hitRadius;
        if (d < min && d > 1e-6) {
          tmp.copy(next).sub(cp).normalize();
          next.copy(cp).addScaledVector(tmp, min);
          next.sub(head).normalize().multiplyScalar(joint.length).add(head);
        }
      }
      joint.prev.copy(joint.cur);
      joint.cur.copy(next);
      // Turn the bone so its axis points at the tail.
      tmp.copy(next).applyMatrix4(inverse.copy(bone.matrixWorld).invert()).normalize();
      swing.setFromUnitVectors(joint.axis, tmp);
      bone.quaternion.copy(joint.rest).multiply(swing);
      bone.updateMatrixWorld(true);
    }
  }
}
