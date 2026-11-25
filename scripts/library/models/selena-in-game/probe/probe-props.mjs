// Which joints carry a mesh of the entrance file, their chain to the root, and what the clips do
// to them (scale and translation ranges). Usage: node probe-props.mjs <mesh name part> [clip part]
import { ENTRANCE_GLB, makeIO } from "../lib/env.mjs";
const [part, clipPart] = process.argv.slice(2);
const doc = await makeIO().read(ENTRANCE_GLB);
const mesh = doc
  .getRoot()
  .listMeshes()
  .find((m) => m.getName().includes(part));
const node = doc
  .getRoot()
  .listNodes()
  .find((n) => n.getMesh() === mesh);
const skin = node.getSkin();
const joints = skin.listJoints();
const used = new Map();
for (const prim of mesh.listPrimitives()) {
  const j = prim.getAttribute("JOINTS_0"),
    w = prim.getAttribute("WEIGHTS_0");
  const a = [],
    b = [];
  for (let i = 0; i < j.getCount(); i++) {
    j.getElement(i, a);
    w.getElement(i, b);
    for (let k = 0; k < 4; k++)
      if (b[k] > 0)
        used.set(joints[a[k]].getName(), (used.get(joints[a[k]].getName()) ?? 0) + b[k]);
  }
}
console.log(mesh.getName(), "joints", [...used].map(([n, w]) => `${n}:${w.toFixed(1)}`).join(", "));
const chain = (n) => {
  const out = [];
  for (let p = n; p; p = p.getParentNode())
    out.push(
      `${p.getName()} T${p.getTranslation().map((x) => x.toFixed(3))} S${p.getScale().map((x) => x.toFixed(3))}`,
    );
  return out;
};
for (const name of used.keys())
  console.log(
    "  chain",
    chain(
      doc
        .getRoot()
        .listNodes()
        .find((n) => n.getName() === name),
    ).join(" <- "),
  );
const names = new Set();
for (const name of used.keys())
  for (
    let p = doc
      .getRoot()
      .listNodes()
      .find((n) => n.getName() === name);
    p;
    p = p.getParentNode()
  )
    names.add(p.getName());
for (const a of doc.getRoot().listAnimations()) {
  if (clipPart && !a.getName().includes(clipPart)) continue;
  const rows = [];
  for (const c of a.listChannels()) {
    if (!names.has(c.getTargetNode().getName())) continue;
    const out = c.getSampler().getOutput();
    const n = out.getElementSize();
    const v = [];
    const min = Array(n).fill(Infinity),
      max = Array(n).fill(-Infinity);
    for (let i = 0; i < out.getCount(); i++) {
      out.getElement(i, v);
      v.forEach((x, k) => {
        min[k] = Math.min(min[k], x);
        max[k] = Math.max(max[k], x);
      });
    }
    rows.push(
      `${c.getTargetNode().getName()}.${c.getTargetPath()} [${min.map((x) => x.toFixed(2))}]..[${max.map((x) => x.toFixed(2))}]`,
    );
  }
  console.log(
    a.getName().replace("selena_silverbolt_raiko_entrance_", ""),
    "\n   ",
    rows.join("\n    "),
  );
}
