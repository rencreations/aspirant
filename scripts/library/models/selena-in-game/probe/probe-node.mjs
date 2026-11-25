// What the clips of the entrance file do to one node (and its children): the ranges of each
// channel that moves, and which meshes have vertices on that subtree.
// Usage: node probe-node.mjs <node name> [clip part]
import { ENTRANCE_GLB, makeIO } from "../lib/env.mjs";

const [name, clipPart] = process.argv.slice(2);
const doc = await makeIO().read(ENTRANCE_GLB);
const target = doc
  .getRoot()
  .listNodes()
  .find((n) => n.getName() === name);
const names = new Set([name]);
target.traverse((n) => names.add(n.getName()));
console.log("subtree", [...names].join(", "));
const skin = doc.getRoot().listSkins()[0];
const on = new Set(
  skin
    .listJoints()
    .map((j, i) => (names.has(j.getName()) ? i : -1))
    .filter((i) => i >= 0),
);
for (const mesh of doc.getRoot().listMeshes()) {
  let n = 0;
  for (const prim of mesh.listPrimitives()) {
    const j = prim.getAttribute("JOINTS_0");
    const w = prim.getAttribute("WEIGHTS_0");
    const a = [];
    const b = [];
    for (let i = 0; i < j.getCount(); i++) {
      j.getElement(i, a);
      w.getElement(i, b);
      if (a.some((x, k) => b[k] > 0 && on.has(x))) n++;
    }
  }
  if (n) console.log("  mesh", mesh.getName(), "vertices on it", n);
}
for (const a of doc.getRoot().listAnimations()) {
  if (clipPart && !a.getName().includes(clipPart)) continue;
  const rows = [];
  for (const c of a.listChannels()) {
    if (!names.has(c.getTargetNode().getName())) continue;
    const out = c.getSampler().getOutput();
    const n = out.getElementSize();
    const v = [];
    const min = Array(n).fill(Infinity);
    const max = Array(n).fill(-Infinity);
    for (let i = 0; i < out.getCount(); i++) {
      out.getElement(i, v);
      v.forEach((x, k) => {
        min[k] = Math.min(min[k], x);
        max[k] = Math.max(max[k], x);
      });
    }
    if (min.some((x, k) => Math.abs(max[k] - x) > 1e-4))
      rows.push(
        `${c.getTargetNode().getName()}.${c.getTargetPath()} [${min.map((x) => x.toFixed(2))}]..[${max.map((x) => x.toFixed(2))}]`,
      );
  }
  console.log(
    a.getName().replace("selena_silverbolt_raiko_entrance_", ""),
    rows.length ? `\n    ${rows.join("\n    ")}` : "(still)",
  );
}
