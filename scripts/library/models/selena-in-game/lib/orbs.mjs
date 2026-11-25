// The small crystal orbs of the abyssal form. Their UV islands point at a patch of pbs_02_d that
// is painted plain black: the game draws them with its crystal sphere matcap (matcap1.png, in the
// same folder) over that black. A web file has no matcap, so the orbs get their own material with
// that picture and UVs that lay it on each orb as a sphere seen from the front (+Z) in the idle.
import fs from "node:fs";
import { skinnedPositions } from "./rig.mjs";

/** The black patch of pbs_02_d that only the orbs use (u, v box). */
export const ORB_UV = { u: [0.205, 0.265], v: [0.88, 0.99] };

function clusters(points, radius) {
  const groups = [];
  points.forEach((p, i) => {
    const g = groups.find((x) => Math.hypot(...x.c.map((c, k) => c - p[k])) < radius);
    if (g) {
      g.items.push(i);
      g.c = g.c.map((c, k) => c + (p[k] - c) / g.items.length);
    } else groups.push({ c: [...p], items: [i] });
  });
  return groups;
}

/**
 * Splits the orb triangles of `prim` into a primitive of their own with `pictureFile` as its
 * base colour. The nodes must hold the pose the UVs are laid in (the idle's first key).
 */
export function splitOrbs(doc, mesh, prim, skin, pictureFile) {
  const uv = prim.getAttribute("TEXCOORD_0");
  const count = uv.getCount();
  const t = [];
  const isOrb = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    uv.getElement(i, t);
    if (t[0] > ORB_UV.u[0] && t[0] < ORB_UV.u[1] && t[1] > ORB_UV.v[0] && t[1] < ORB_UV.v[1])
      isOrb[i] = 1;
  }
  const index = prim.getIndices().getArray();
  const keep = [];
  const orbTris = [];
  for (let i = 0; i < index.length; i += 3) {
    const n = isOrb[index[i]] + isOrb[index[i + 1]] + isOrb[index[i + 2]];
    if (n === 3) orbTris.push(index[i], index[i + 1], index[i + 2]);
    else if (n === 0) keep.push(index[i], index[i + 1], index[i + 2]);
    else throw new Error("a triangle half on the orb patch");
  }
  const used = [...new Set(orbTris)].sort((a, b) => a - b);
  const remap = new Map(used.map((v, i) => [v, i]));

  // Each orb's middle and the direction of each of its vertices from it, in the idle pose.
  const world = skinnedPositions(prim, skin);
  const groups = clusters(
    used.map((v) => world[v]),
    0.15,
  );
  const newUv = new Float32Array(used.length * 2);
  for (const g of groups) {
    for (const k of g.items) {
      const p = world[used[k]];
      const d = p.map((x, c) => x - g.c[c]);
      const len = Math.hypot(...d) || 1;
      newUv[k * 2] = 0.5 + 0.47 * (d[0] / len);
      newUv[k * 2 + 1] = 0.5 - 0.47 * (d[1] / len);
    }
  }

  const buffer = doc.getRoot().listBuffers()[0];
  const subset = (semantic) => {
    const a = prim.getAttribute(semantic);
    const size = a.getElementSize();
    const src = a.getArray();
    const dst = new src.constructor(used.length * size);
    used.forEach((v, i) => {
      for (let c = 0; c < size; c++) dst[i * size + c] = src[v * size + c];
    });
    return doc
      .createAccessor()
      .setType(a.getType())
      .setArray(dst)
      .setNormalized(a.getNormalized())
      .setBuffer(buffer);
  };
  const orb = doc.createPrimitive();
  for (const semantic of ["POSITION", "NORMAL", "JOINTS_0", "WEIGHTS_0"])
    orb.setAttribute(semantic, subset(semantic));
  orb.setAttribute(
    "TEXCOORD_0",
    doc.createAccessor().setType("VEC2").setArray(newUv).setBuffer(buffer),
  );
  const IndexArray = used.length > 65535 ? Uint32Array : Uint16Array;
  orb.setIndices(
    doc
      .createAccessor()
      .setType("SCALAR")
      .setArray(new IndexArray(orbTris.map((v) => remap.get(v))))
      .setBuffer(buffer),
  );
  const picture = doc
    .createTexture("matcap1")
    .setImage(new Uint8Array(fs.readFileSync(pictureFile)))
    .setMimeType("image/png");
  const material = doc
    .createMaterial("abyssal_orb")
    .setBaseColorTexture(picture)
    .setDoubleSided(true)
    .setMetallicFactor(0)
    .setRoughnessFactor(1);
  orb.setMaterial(material);
  mesh.addPrimitive(orb);

  const OldIndex = prim.getIndices().getArray().constructor;
  prim.getIndices().setArray(new OldIndex(keep));
  return {
    orbs: groups.length,
    vertices: used.length,
    triangles: orbTris.length / 3,
    centres: groups.map((g) => g.c.map((x) => +x.toFixed(3))),
  };
}
