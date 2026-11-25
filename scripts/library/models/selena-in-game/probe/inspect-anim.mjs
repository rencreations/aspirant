import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const only = process.argv[3];
for (const a of doc.getRoot().listAnimations()) {
  if (only && !a.getName().includes(only)) continue;
  const stats = {};
  for (const c of a.listChannels()) {
    const s = c.getSampler();
    const k = `${c.getTargetPath()}:${s.getInterpolation()}:${s.getInput().getCount()}`;
    stats[k] = (stats[k] ?? 0) + 1;
  }
  const inp = a
    .listChannels()
    .map((c) => c.getSampler().getInput())
    .sort((x, y) => y.getCount() - x.getCount())[0]
    .getArray();
  console.log(
    a.getName(),
    JSON.stringify(stats),
    "dt",
    (inp[1] - inp[0]).toFixed(5),
    "n",
    inp.length,
    "last",
    inp[inp.length - 1].toFixed(4),
  );
}
