import { describe, expect, it } from "vitest";

import { POSE_STRIDE } from "./sampler";
import { buildSpringDefs, springGroup } from "./springs";

describe("springGroup", () => {
  it("sorts the bones of the notes' list", () => {
    expect(springGroup("Bone01_Hair_B_01")).toBe("ponytail");
    expect(springGroup("Bone01_Hair_LB_03")).toBe("ponytail");
    expect(springGroup("Bone01_Hair_F_05")).toBe("hair");
    expect(springGroup("Bone01_Skirt_R_12")).toBe("skirt");
    expect(springGroup("Bone01_Ear_L_02")).toBe("ear");
    expect(springGroup("Bone01_shiPin_01")).toBe("jewelry");
    expect(springGroup("Bone01_Cloth_L_01")).toBe("cloth");
    expect(springGroup("Bone301")).toBe("cloth");
    expect(springGroup("Bip001_Head")).toBeNull();
    expect(springGroup("Bone01_Mouth_01")).toBeNull();
    expect(springGroup("Bone01_Eye_L_02")).toBeNull();
  });
});

describe("buildSpringDefs", () => {
  // head (0), then a ponytail root B (1) with two strands LB (2) and RB (3), and a front lock F (4)
  // that is a lone bone with a parent segment along +y.
  const names = [
    "Bip001_Head",
    "Bone01_Hair_B_01",
    "Bone01_Hair_LB_01",
    "Bone01_Hair_RB_01",
    "Bone01_Hair_F_01",
  ];
  const parent = [-1, 0, 1, 1, 0];
  const rest = new Float32Array(names.length * POSE_STRIDE);
  const set = (i: number, x: number, y: number, z: number): void => {
    rest[i * POSE_STRIDE] = x;
    rest[i * POSE_STRIDE + 1] = y;
    rest[i * POSE_STRIDE + 2] = z;
    rest[i * POSE_STRIDE + 6] = 1;
  };
  set(0, 0, 0, 0);
  set(1, 0, -0.1, 0);
  set(2, -0.2, -0.2, 0);
  set(3, 0.2, -0.2, 0);
  set(4, 0, 0.12, 0);

  it("a bone with strands aims between them", () => {
    const defs = buildSpringDefs(names, parent, rest);
    const root = defs.find((d) => d.node === 1)!;
    expect(root.tail[0]).toBeCloseTo(0, 6);
    expect(root.tail[1]).toBeCloseTo(-0.2, 6);
    expect(root.group).toBe("ponytail");
    expect(root.parent).toBe(0);
  });

  it("the last bone of a chain continues its parent's line, shorter", () => {
    const defs = buildSpringDefs(names, parent, rest);
    const lb = defs.find((d) => d.node === 2)!;
    const len = Math.hypot(...lb.tail);
    expect(len).toBeGreaterThan(0.03);
    expect(len).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(lb.tail[0]).toBeLessThan(0);
    const front = defs.find((d) => d.node === 4)!;
    expect(front.tail[1]).toBeGreaterThan(0);
    expect(front.group).toBe("hair");
  });

  it("leaves out bones that do not swing, and keeps the hierarchy order", () => {
    const defs = buildSpringDefs(names, parent, rest);
    expect(defs.some((d) => d.node === 0)).toBe(false);
    const nodes = defs.map((d) => d.node);
    expect(nodes).toEqual([...nodes].sort((a, b) => a - b));
  });
});
