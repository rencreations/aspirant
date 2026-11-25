// One node of the entrance file: its rest transform, its world scale at rest, and the first key
// of each channel in the clips named. Usage: node probe-bone.mjs <node> [clip part]
import { ENTRANCE_GLB, makeIO } from "../lib/env.mjs";
const [name, clipPart] = process.argv.slice(2);
const doc = await makeIO().read(ENTRANCE_GLB);
const node = doc
  .getRoot()
  .listNodes()
  .find((n) => n.getName() === name);
const m = node.getWorldMatrix();
const col = (i) => Math.hypot(m[i * 4], m[i * 4 + 1], m[i * 4 + 2]);
console.log(
  name,
  "rest T",
  node.getTranslation(),
  "R",
  node.getRotation(),
  "S",
  node.getScale(),
  "world scale",
  [0, 1, 2].map(col),
);
for (const a of doc.getRoot().listAnimations()) {
  if (clipPart && !a.getName().includes(clipPart)) continue;
  for (const c of a.listChannels()) {
    if (c.getTargetNode() !== node) continue;
    const out = c.getSampler().getOutput();
    const n = out.getCount();
    console.log(
      a.getName().replace("selena_silverbolt_raiko_entrance_", ""),
      c.getTargetPath(),
      "first",
      out.getElement(0, []).map((x) => +x.toFixed(3)),
      "mid",
      out.getElement(n >> 1, []).map((x) => +x.toFixed(3)),
      "last",
      out.getElement(n - 1, []).map((x) => +x.toFixed(3)),
    );
  }
}
