// Cutting triangles out of a primitive into new primitives (own vertices, own material).
import { fail } from "./env.mjs";

/** The triangles of a primitive as flat arrays. */
export function triangles(prim) {
  const index = prim.getIndices();
  if (!index) fail("a primitive without indices");
  return index.getArray();
}

/** Centre of triangle `t` in the attribute `semantic` (any size), as an array. */
export function triangleCentre(prim, semantic, t, indices = triangles(prim)) {
  const attribute = prim.getAttribute(semantic);
  const size = attribute.getElementSize();
  const sum = new Array(size).fill(0);
  const element = new Array(size);
  for (let k = 0; k < 3; k++) {
    attribute.getElement(indices[t * 3 + k], element);
    for (let c = 0; c < size; c++) sum[c] += element[c] / 3;
  }
  return sum;
}

/** The joint (index into the skin) with the largest total weight over the corners of triangle `t`. */
export function dominantJoint(prim, t, indices = triangles(prim)) {
  const joints = prim.getAttribute("JOINTS_0");
  const weights = prim.getAttribute("WEIGHTS_0");
  const total = new Map();
  const j = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  for (let k = 0; k < 3; k++) {
    joints.getElement(indices[t * 3 + k], j);
    weights.getElement(indices[t * 3 + k], w);
    for (let c = 0; c < 4; c++) total.set(j[c], (total.get(j[c]) ?? 0) + w[c]);
  }
  return [...total.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Builds a new primitive from the triangles `ids` of `prim`: its own copy of every vertex the
 * triangles use, in the order they come. `edit(attributes, count)` may change the new arrays
 * before they are written (move the vertices, change the weights). The material is `material`.
 */
export function extractPrimitive(doc, prim, ids, material, edit = () => {}) {
  const indices = triangles(prim);
  const remap = new Map();
  const order = [];
  const next = new Uint32Array(ids.length * 3);
  ids.forEach((t, n) => {
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k];
      if (!remap.has(v)) {
        remap.set(v, order.length);
        order.push(v);
      }
      next[n * 3 + k] = remap.get(v);
    }
  });
  const out = doc.createPrimitive().setMaterial(material);
  const arrays = {};
  for (const semantic of prim.listSemantics()) {
    const source = prim.getAttribute(semantic);
    const size = source.getElementSize();
    const array = new (source.getArray().constructor)(order.length * size);
    const element = new Array(size);
    order.forEach((v, i) => {
      source.getElement(v, element);
      for (let c = 0; c < size; c++) array[i * size + c] = element[c];
    });
    arrays[semantic] = { array, size, type: source.getType(), normalized: source.getNormalized() };
  }
  edit(arrays, order.length);
  for (const [semantic, a] of Object.entries(arrays)) {
    out.setAttribute(
      semantic,
      doc.createAccessor().setType(a.type).setArray(a.array).setNormalized(a.normalized),
    );
  }
  const vertices = order.length;
  out.setIndices(
    doc
      .createAccessor()
      .setType("SCALAR")
      .setArray(vertices > 65535 ? next : new Uint16Array(next)),
  );
  return out;
}

/** Keeps only the triangles not in `ids` in `prim` (its vertices stay; the size pass drops the unused ones). */
export function removeTriangles(prim, ids) {
  const drop = new Set(ids);
  const indices = triangles(prim);
  const keep = [];
  for (let t = 0; t < indices.length / 3; t++) {
    if (drop.has(t)) continue;
    keep.push(indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]);
  }
  const Array_ = indices.constructor;
  prim.getIndices().setArray(new Array_(keep));
}
