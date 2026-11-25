// Prints the range of the vertex colour attributes of every primitive of a file.
import { makeIO } from "../lib/env.mjs";
const doc = await makeIO().read(process.argv[2]);
for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives())
    for (const sem of prim
      .listSemantics()
      .filter((s) => s.startsWith("COLOR") || s.startsWith("TEXCOORD"))) {
      const a = prim.getAttribute(sem);
      const n = a.getElementSize();
      const min = Array(n).fill(Infinity),
        max = Array(n).fill(-Infinity),
        sum = Array(n).fill(0);
      const el = [];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, el);
        el.forEach((x, k) => {
          min[k] = Math.min(min[k], x);
          max[k] = Math.max(max[k], x);
          sum[k] += x;
        });
      }
      console.log(
        mesh.getName(),
        prim.getMaterial()?.getName(),
        sem,
        a.getComponentType(),
        a.getNormalized(),
        "min",
        min.map((x) => +x.toFixed(3)),
        "max",
        max.map((x) => +x.toFixed(3)),
        "mean",
        sum.map((x) => +(x / a.getCount()).toFixed(3)),
      );
    }
