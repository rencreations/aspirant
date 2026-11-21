import { Vector3, type PerspectiveCamera } from "three";

import type { PointerState } from "../../kernel/types";
import { Spring } from "./motion";
import type { Rig } from "./rig";
import type { PoseWork } from "./skeleton";

const targets = [
  ["Bone01_Hair_B_01", 0.21],
  ["Bone01_Hair_LB_02", 0.16],
  ["Bone01_Hair_RB_02", 0.16],
  ["Bone01_shiPin_01", 0.075],
  ["Bip001_R_Hand", 0.12],
  ["Bip001_Prop1", 0.21],
  ["Bip001_Prop2", 0.21],
] as const;

/** Project the animated bones through the same lens as the picture. */
export class IdleTouch {
  private readonly projected = new Vector3();
  private readonly points;
  private readonly fingers;
  private readonly spine;
  private readonly arm;

  constructor(private readonly rig: Rig) {
    this.spine = rig.index.get("Bip001_Spine2")!;
    this.arm = rig.index.get("Bip001_R_Forearm")!;
    this.points = targets.map(([name, radius]) => ({
      node: rig.index.get(name) ?? -1,
      radius,
      spring: new Spring(13, 0.74),
      inside: false,
      turns: 0,
    }));
    this.fingers = rig.names.flatMap((name, node) => {
      const m = /^Bip001_R_Finger([0-4])([12]?)$/.exec(name);
      return m ? [{ node, thumb: m[1] === "0", bend: m[2] === "1" ? 0.24 : 0.16 }] : [];
    });
  }

  step(
    work: PoseWork,
    camera: PerspectiveCamera,
    pointer: PointerState,
    w: number,
    h: number,
    scale: number,
    live: boolean,
    weight: number,
    dt: number,
    clock: number,
  ): void {
    const nx = pointer.inside ? (pointer.x / w) * 2 - 1 : 0;
    if (this.spine >= 0) work.turnModel(this.spine, 0, 1, 0, nx * weight * 0.05);
    if (this.arm >= 0) work.turnModel(this.arm, 0, 1, 0, nx * weight * 0.035);
    for (const [i, target] of this.points.entries()) {
      if (target.node < 0) continue;
      const v = this.projected;
      this.rig.nodes[target.node]!.getWorldPosition(v);
      v.applyMatrix4(camera.matrixWorldInverse);
      const radius = Math.max(
        9,
        (target.radius * scale * h * camera.projectionMatrix.elements[5]) / (2 * Math.max(1, -v.z)),
      );
      v.applyMatrix4(camera.projectionMatrix);
      const dx = pointer.x - ((1 + v.x) * w) / 2;
      const dy = pointer.y - ((1 - v.y) * h) / 2;
      const distance = Math.hypot(dx, dy) / radius;
      const inside = live && pointer.inside && distance < 1;
      const claw = i >= 5;
      if (claw && inside && !target.inside) target.turns++;
      target.inside = inside;
      const force = inside
        ? (1 - distance) * (i === 4 ? 1 : 0.11 + (dx / radius) * 0.15 + 0.035 * Math.sin(clock * 4))
        : 0;
      const bend = target.spring.step(claw ? target.turns * Math.PI * 2 : force, dt);
      if (claw) work.turnModel(target.node, 0, 1, 0, bend);
      else if (i === 4) {
        work.turnLocal(target.node, 0, 1, 0, bend * 0.07);
        for (const finger of this.fingers)
          work.turnLocal(
            finger.node,
            0,
            finger.thumb ? -1 : 0,
            finger.thumb ? 0 : 1,
            bend * finger.bend,
          );
      } else work.turnLocal(target.node, 0, 0, 1, bend);
    }
  }
}
