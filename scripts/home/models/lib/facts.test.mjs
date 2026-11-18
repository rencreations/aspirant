// Tests of the facts helpers. Run with: node --test scripts/home/models/
import assert from "node:assert/strict";
import test from "node:test";
import { seamGap, springRows } from "../selena-facts.mjs";
import { boneTable, clipTable, glbJson, morphBytes } from "./facts.mjs";

const rest = (x, y, z) => [x, y, z, 0, 0, 0, 1, 1, 1, 1];
const bake = {
  fps: 24,
  bones: ["root", "Bone01_Hair_A_01", "Bone01_Hair_A_02"],
  parent: { root: null, Bone01_Hair_A_01: "root", Bone01_Hair_A_02: "Bone01_Hair_A_01" },
  restLocal: {
    root: rest(0, 1, 0),
    Bone01_Hair_A_01: rest(0, 0.5, 0),
    Bone01_Hair_A_02: rest(0.3, 0.4, 0),
  },
  clips: {
    one: {
      frames: 25,
      tracks: {
        root: Array.from({ length: 25 }, (_, f) => [
          0,
          1,
          0,
          0,
          0,
          0,
          1,
          0.4 + f * 0.01,
          0.4 + f * 0.01,
          0.4 + f * 0.01,
        ]).flat(),
      },
      probe: {
        0: { root: [0, 1, 0], Bone01_Hair_A_01: [0, 1.5, 0], Bone01_Hair_A_02: [0.3, 1.9, 0] },
        24: { root: [0, 1, 0], Bone01_Hair_A_01: [0, 1.5, 0], Bone01_Hair_A_02: [0.3, 1.9, 0.1] },
      },
    },
    two: {
      frames: 3,
      tracks: {},
      probe: {
        0: { root: [0, 1, 0], Bone01_Hair_A_01: [0, 1.5, 0], Bone01_Hair_A_02: [0.3, 1.9, 0] },
        2: { root: [0, 1, 0], Bone01_Hair_A_01: [0, 1.5, 0], Bone01_Hair_A_02: [0.3, 1.9, 0] },
      },
    },
  },
};

test("boneTable: three's name, parent, rest head in world space", () => {
  const table = boneTable({
    ...bake,
    bones: ["Bip001 L Hand", "x"],
    parent: { "Bip001 L Hand": null, x: "Bip001 L Hand" },
    restLocal: { "Bip001 L Hand": rest(1, 2, 3), x: rest(0, 1, 0) },
  });
  assert.equal(table["Bip001 L Hand"].three, "Bip001_L_Hand");
  assert.deepEqual(table.x.restHead, [1, 3, 3]);
  assert.equal(table.x.parent, "Bip001 L Hand");
});

test("clipTable: a clip of N frames lasts (N - 1) / 24 s; the root's scale range is listed", () => {
  const table = clipTable(bake, { loops: ["two"], rootBone: "root", alias: { one: "first" } });
  assert.equal(table.one.duration, 1);
  assert.equal(table.one.alias, "first");
  assert.deepEqual(table.one.rootScale, [0.4, 0.64]);
  assert.equal(table.two.loop, true);
  assert.equal(table.two.duration, Math.round((2 / 24) * 1e6) / 1e6);
});

test("springRows: bones of a family in order, each with its parent and rest length", () => {
  const rows = springRows(bake, boneTable(bake), (n) => /Hair/.test(n));
  assert.deepEqual(
    rows.map((r) => r.bone),
    ["Bone01_Hair_A_01", "Bone01_Hair_A_02"],
  );
  assert.equal(rows[0].restLength, 0.5);
  assert.equal(rows[1].restLength, 0.5, "0.3 across and 0.4 up: 0.5 long");
});

test("seamGap: worst and mean distance between the end of one clip and the start of the next", () => {
  const gap = seamGap(bake, "one", "two");
  assert.equal(gap.worst, 0.1);
  assert.equal(gap.mean, 0.0333);
});

test("morphBytes counts sparse indices and values and meshopt sizes, once per accessor", () => {
  const json = {
    meshes: [{ primitives: [{ targets: [{ POSITION: 0 }, { POSITION: 1 }, { POSITION: 0 }] }] }],
    accessors: [
      { sparse: { indices: { bufferView: 0 }, values: { bufferView: 1 } } },
      { bufferView: 2 },
    ],
    bufferViews: [
      { byteLength: 10 },
      { byteLength: 30 },
      { byteLength: 999, extensions: { EXT_meshopt_compression: { byteLength: 7 } } },
    ],
  };
  assert.equal(morphBytes(json), 47);
});

test("glbJson reads the JSON chunk of a GLB and refuses anything else", () => {
  const body = Buffer.from(JSON.stringify({ asset: { version: "2.0" } }));
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(body.length, 12);
  assert.equal(glbJson(Buffer.concat([head, body])).asset.version, "2.0");
  assert.throws(() => glbJson(Buffer.alloc(24)), /not a GLB/);
});
