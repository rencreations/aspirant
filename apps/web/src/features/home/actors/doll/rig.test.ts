import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DOLL_HEIGHT, FACE_POINTS, RIG_BONES, WALK_SECONDS, WALK_SPEED } from "./rig";
import { POSES, POSE_NAMES } from "./pose/poses";
import { boneIndex } from "./pose/math";

const REPO = path.resolve(import.meta.dirname, "../../../../../../..");

interface RigJson {
  heightMetres: number;
  bones: Record<
    string,
    {
      parent: string | null;
      localQuaternion: number[];
      localPosition: number[];
      bindWorld: number[];
    }
  >;
  walk: { speedMetresPerSecond: number; seconds: number };
  face: { mouth: { centre: number[] } };
}

interface PosesJson {
  poses: Record<string, { turns: Record<string, number[]>; hips?: number[] }>;
}

const rig = JSON.parse(
  readFileSync(path.join(REPO, "apps/web/public/models/home/doll-rig.json"), "utf8"),
) as RigJson;
const posesSource = JSON.parse(
  readFileSync(path.join(REPO, "scripts/home/models/doll/poses.json"), "utf8"),
) as PosesJson;

describe("the rig numbers are the file's", () => {
  it("the same 22 bones, in an order where a parent comes first", () => {
    expect(RIG_BONES.map((b) => b.name)).toEqual(Object.keys(rig.bones));
    const seen = new Set<string>();
    for (const b of RIG_BONES) {
      if (b.parent !== null) expect(seen.has(b.parent), b.name).toBe(true);
      seen.add(b.name);
    }
  });

  it("every rest rotation, position and bind position", () => {
    for (const b of RIG_BONES) {
      const r = rig.bones[b.name];
      expect(r, b.name).toBeDefined();
      expect(b.parent).toBe(r?.parent ?? null);
      b.q.forEach((v, i) => expect(v).toBeCloseTo(r?.localQuaternion[i] ?? Number.NaN, 5));
      b.p.forEach((v, i) => expect(v).toBeCloseTo(r?.localPosition[i] ?? Number.NaN, 5));
      b.world.forEach((v, i) => expect(v).toBeCloseTo(r?.bindWorld[i] ?? Number.NaN, 5));
    }
  });

  it("the height, the walk and the face points", () => {
    expect(DOLL_HEIGHT).toBe(rig.heightMetres);
    expect(WALK_SPEED).toBe(rig.walk.speedMetresPerSecond);
    expect(WALK_SECONDS).toBe(rig.walk.seconds);
    expect(FACE_POINTS.mouth[0]).toBeCloseTo(rig.face.mouth.centre[0] ?? Number.NaN, 5);
  });
});

describe("the poses", () => {
  it("are the owner's poses, by name", () => {
    expect([...POSE_NAMES]).toEqual(Object.keys(posesSource.poses));
    for (const name of POSE_NAMES) {
      expect(POSES[name].turns, name).toEqual(posesSource.poses[name]?.turns);
    }
  });

  it("only turn bones the rig has", () => {
    for (const name of POSE_NAMES) {
      for (const bone of Object.keys(POSES[name].turns)) {
        expect(() => boneIndex(bone), `${name}.${bone}`).not.toThrow();
      }
    }
  });

  it("the brief's poses are all there: ride, scream, fall, sit, run, held, reach, stand", () => {
    for (const name of ["ride", "scream", "fall", "sit", "run", "held", "reach", "stand"]) {
      expect(POSE_NAMES as readonly string[]).toContain(name);
    }
  });
});
