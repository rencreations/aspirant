// Where the bytes of a file go: accessors by use, pictures, buffer views.
import fs from "node:fs";
import { inspect } from "@gltf-transform/functions";
import { makeIO } from "../lib/env.mjs";
const file = process.argv[2];
const doc = await makeIO().read(file);
const report = inspect(doc);
console.log("file", fs.statSync(file).size);
for (const [k, v] of Object.entries(report)) {
  if (!v.properties) continue;
  const total = v.properties.reduce((a, p) => a + (p.size ?? 0), 0);
  console.log(k, v.properties.length, "items", total, "bytes");
  if (k === "meshes" || k === "animations" || k === "textures")
    for (const p of v.properties)
      console.log(
        "   ",
        p.name,
        p.size,
        p.count ?? "",
        p.channels ?? "",
        p.keyframes ?? "",
        p.glPrimitives ?? "",
        p.vertices ?? "",
      );
}
console.log(
  "accessors",
  doc.getRoot().listAccessors().length,
  doc
    .getRoot()
    .listAccessors()
    .reduce((a, x) => a + x.getByteLength(), 0),
);
