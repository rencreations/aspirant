import { readFileSync } from "node:fs";
import path from "node:path";

import {
  BELL,
  CRANK,
  GR_HEIGHT_M,
  GR_MODEL_BYTES,
  NODE,
  PLATTER,
  PRESENT_YAW,
  SOUNDBOX,
} from "./facts";

interface Rig {
  bytes: number;
  box: { size: number[]; max: number[] };
  presentation: { yawRadians: number };
  crank: { pivot: number[]; throwRadius: number };
  platter: { pivot: number[]; radius: number; recordSeatY: number; recordRadius: number };
  soundbox: { pivot: number[]; liftAxis: number[]; liftDegrees: { up: number } };
  bellMouth: { centre: number[]; across: number; axis: number[] };
  nodes: Record<string, { position: number[]; children: string[] }>;
}

const rig = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../../public/models/home/gramophone-rig.json"),
    "utf8",
  ),
) as Rig;

const near = (a: readonly number[], b: readonly number[]) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => {
    expect(v).toBeCloseTo(b[i]!, 6);
  });
};

describe("gramophone facts match the rig file", () => {
  it("has the file's size and the box's height", () => {
    expect(GR_MODEL_BYTES).toBe(rig.bytes);
    expect(GR_HEIGHT_M).toBeCloseTo(rig.box.max[1]!, 6);
  });

  it("has the presentation yaw", () => {
    expect(PRESENT_YAW).toBeCloseTo(rig.presentation.yawRadians, 6);
  });

  it("has the crank, the platter, the soundbox and the bell", () => {
    near(CRANK.pivot, rig.crank.pivot);
    expect(CRANK.throwRadius).toBeCloseTo(rig.crank.throwRadius, 6);
    near(PLATTER.pivot, rig.platter.pivot);
    expect(PLATTER.radius).toBeCloseTo(rig.platter.radius, 6);
    expect(PLATTER.recordSeatY).toBeCloseTo(rig.platter.recordSeatY, 6);
    expect(PLATTER.recordRadius).toBeCloseTo(rig.platter.recordRadius, 6);
    near(SOUNDBOX.pivot, rig.soundbox.pivot);
    near(SOUNDBOX.liftAxis, rig.soundbox.liftAxis);
    expect(SOUNDBOX.liftDegrees).toBe(rig.soundbox.liftDegrees.up);
    near(BELL.centre, rig.bellMouth.centre);
    near(BELL.axis, rig.bellMouth.axis);
    expect(BELL.across).toBeCloseTo(rig.bellMouth.across, 6);
  });

  it("names nodes the file has, and the handle sits where the throw says", () => {
    for (const name of Object.values(NODE)) expect(rig.nodes[name]).toBeDefined();
    const handle = rig.nodes[NODE.handle]!.position;
    expect(handle[0]).toBeCloseTo(CRANK.throwRadius, 6);
    expect(handle[2]).toBeCloseTo(CRANK.handleZ, 6);
  });
});
