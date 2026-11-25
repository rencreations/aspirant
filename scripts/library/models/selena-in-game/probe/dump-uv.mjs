// Dumps the UVs and triangles of one primitive as JSON (for a picture of the UV layout).
// Usage: node dump-uv.mjs <glb> <mesh name> <primitive index> <out.json>
import fs from "node:fs";
import { makeIO } from "../lib/env.mjs";
const [file, meshName, primIndex, outFile] = process.argv.slice(2);
const doc = await makeIO().read(file);
const mesh = doc
  .getRoot()
  .listMeshes()
  .find((m) => m.getName() === meshName);
const prim = mesh.listPrimitives()[Number(primIndex)];
const uv = Array.from(prim.getAttribute("TEXCOORD_0").getArray());
const pos = Array.from(prim.getAttribute("POSITION").getArray());
const index = prim.getIndices() ? Array.from(prim.getIndices().getArray()) : null;
fs.writeFileSync(
  outFile,
  JSON.stringify({ uv, pos, index, material: prim.getMaterial()?.getName() }),
);
