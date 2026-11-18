import { describe, expect, it } from "vitest";

import { PART, boneParts, splitParts, trianglePart, vertexPart, type PartInput } from "./parts";
import { BONE_NAMES } from "./pose/math";

const kinds = boneParts(BONE_NAMES);
const bone = (name: string): number => BONE_NAMES.indexOf(name);

/** A vertex list where vertex i is fully weighted to `names[i]` (and face[i] says the face shell). */
function mesh(names: string[], face: number[], index: number[] | null): PartInput {
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  for (const n of names) {
    skinIndex.push(bone(n), 0, 0, 0);
    skinWeight.push(255, 0, 0, 0);
  }
  return { index, vertexCount: names.length, skinIndex, skinWeight, face, boneKind: kinds };
}

describe("boneParts", () => {
  it("makes the head hair, the arms and the neck skin, the rest cloth", () => {
    expect(kinds[bone("Head")]).toBe(PART.hair);
    expect(kinds[bone("LeftHand")]).toBe(PART.skin);
    expect(kinds[bone("RightArm")]).toBe(PART.skin);
    expect(kinds[bone("neck")]).toBe(PART.skin);
    expect(kinds[bone("Spine01")]).toBe(PART.cloth);
    expect(kinds[bone("LeftUpLeg")]).toBe(PART.cloth);
    expect(kinds[bone("Hips")]).toBe(PART.cloth);
  });
});

describe("vertexPart", () => {
  it("takes the face shell as skin even on the head bone", () => {
    const m = mesh(["Head", "Head"], [1, 0], null);
    expect(vertexPart(m, 0)).toBe(PART.skin);
    expect(vertexPart(m, 1)).toBe(PART.hair);
  });

  it("goes by the larger share of weight", () => {
    const m: PartInput = {
      index: null,
      vertexCount: 1,
      skinIndex: [bone("Head"), bone("LeftHand"), 0, 0],
      skinWeight: [100, 155, 0, 0],
      face: [0],
      boneKind: kinds,
    };
    expect(vertexPart(m, 0)).toBe(PART.skin);
    m.skinWeight = [200, 55, 0, 0];
    expect(vertexPart(m, 0)).toBe(PART.hair);
  });

  it("ties go to cloth, then skin", () => {
    const m: PartInput = {
      index: null,
      vertexCount: 1,
      skinIndex: [bone("Spine01"), bone("LeftHand"), 0, 0],
      skinWeight: [100, 100, 0, 0],
      face: [0],
      boneKind: kinds,
    };
    expect(vertexPart(m, 0)).toBe(PART.cloth);
  });
});

describe("trianglePart", () => {
  it("is the majority, or the first corner when all three differ", () => {
    expect(trianglePart(1, 1, 2)).toBe(1);
    expect(trianglePart(2, 0, 2)).toBe(2);
    expect(trianglePart(0, 2, 2)).toBe(2);
    expect(trianglePart(2, 1, 0)).toBe(2);
  });
});

describe("splitParts", () => {
  // Six vertices: two hair, two skin, two cloth. Triangles: hair, cloth, skin, hair.
  const m = mesh(
    ["Head", "Head", "LeftHand", "LeftHand", "Spine01", "Spine01"],
    [0, 0, 0, 0, 0, 0],
    [0, 1, 0, 4, 5, 4, 2, 3, 2, 1, 0, 1],
  );

  it("sorts the triangles by part and keeps each triangle whole", () => {
    const s = splitParts(m);
    expect(s.triangles).toEqual([1, 1, 2]);
    expect(Array.from(s.index)).toEqual([4, 5, 4, 2, 3, 2, 0, 1, 0, 1, 0, 1]);
  });

  it("gives one group a part, in order, that covers the whole list once", () => {
    const s = splitParts(m);
    expect(s.groups).toEqual([
      { start: 0, count: 3, part: PART.cloth },
      { start: 3, count: 3, part: PART.skin },
      { start: 6, count: 6, part: PART.hair },
    ]);
    expect(s.groups.reduce((n, g) => n + g.count, 0)).toBe(s.index.length);
  });

  it("leaves out a part that has no triangles", () => {
    const only = mesh(["Head", "Head", "Head"], [0, 0, 0], [0, 1, 2]);
    expect(splitParts(only).groups).toEqual([{ start: 0, count: 3, part: PART.hair }]);
  });

  it("reads a mesh that is not indexed", () => {
    const flat = mesh(
      ["Head", "Head", "Head", "Spine01", "Spine01", "Spine01"],
      [0, 0, 0, 0, 0, 0],
      null,
    );
    const s = splitParts(flat);
    expect(s.triangles).toEqual([1, 0, 1]);
    expect(Array.from(s.index)).toEqual([3, 4, 5, 0, 1, 2]);
  });
});
