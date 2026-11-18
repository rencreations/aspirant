// Tests of the primitive cutting. Run with: node --test scripts/home/models/
import assert from "node:assert/strict";
import test from "node:test";
import { Document } from "@gltf-transform/core";
import {
  dominantJoint,
  extractPrimitive,
  removeTriangles,
  triangleCentre,
  triangles,
} from "./split.mjs";

/** Four vertices in a strip, two triangles (0 1 2) and (1 3 2); vertices 0 and 1 on joint 0, 2 and 3 on joint 1. */
function strip() {
  const doc = new Document();
  const mat = doc.createMaterial("m");
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array);
  const prim = doc
    .createPrimitive()
    .setMaterial(mat)
    .setIndices(accessor("SCALAR", new Uint16Array([0, 1, 2, 1, 3, 2])))
    .setAttribute(
      "POSITION",
      accessor("VEC3", new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0])),
    )
    .setAttribute("TEXCOORD_0", accessor("VEC2", new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])))
    .setAttribute(
      "JOINTS_0",
      accessor("VEC4", new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])),
    )
    .setAttribute(
      "WEIGHTS_0",
      accessor("VEC4", new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])),
    );
  return { doc, prim, mat };
}

test("triangles and triangleCentre read the index buffer", () => {
  const { prim } = strip();
  assert.equal(triangles(prim).length / 3, 2);
  const c = triangleCentre(prim, "POSITION", 1);
  assert.ok(Math.abs(c[0] - 2 / 3) < 1e-9 && Math.abs(c[1] - 2 / 3) < 1e-9);
});

test("dominantJoint: the joint with the largest weight over the corners", () => {
  const { prim } = strip();
  assert.equal(dominantJoint(prim, 0), 0, "corners 0 and 1 on joint 0, corner 2 on joint 1");
  assert.equal(dominantJoint(prim, 1), 1, "corners 2 and 3 on joint 1, corner 1 on joint 0");
});

test("extractPrimitive: its own vertices, compact indices, the edit applies to the copy only", () => {
  const { doc, prim, mat } = strip();
  const out = extractPrimitive(doc, prim, [1], mat, (a) => {
    a.POSITION.array[0] += 10;
  });
  assert.equal(out.getAttribute("POSITION").getCount(), 3);
  assert.deepEqual(Array.from(out.getIndices().getArray()), [0, 1, 2]);
  assert.equal(
    out.getAttribute("POSITION").getArray()[0],
    11,
    "vertex 1 of the source, moved by the edit",
  );
  assert.equal(prim.getAttribute("POSITION").getArray()[3], 1, "the source is untouched");
  assert.equal(out.getMaterial(), mat);
});

test("removeTriangles keeps the others", () => {
  const { prim } = strip();
  removeTriangles(prim, [1]);
  assert.deepEqual(Array.from(prim.getIndices().getArray()), [0, 1, 2]);
});
