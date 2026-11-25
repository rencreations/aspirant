import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
const file = process.argv[2];
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(file);
const root = doc.getRoot();
console.log(
  "extensionsUsed",
  root.listExtensionsUsed().map((e) => e.extensionName),
);
console.log(
  "scenes",
  root.listScenes().map((s) => s.getName() + ":" + s.listChildren().map((c) => c.getName())),
);
function walk(n, d = 0) {
  const t = n.getTranslation(),
    r = n.getRotation(),
    s = n.getScale();
  const m = n.getMesh();
  const sk = n.getSkin();
  if (d < 4 || m)
    console.log(
      "  ".repeat(d) + n.getName(),
      "T",
      t.map((x) => +x.toFixed(3)),
      "R",
      r.map((x) => +x.toFixed(3)),
      "S",
      s.map((x) => +x.toFixed(3)),
      m ? "MESH:" + m.getName() : "",
      sk ? "SKIN:" + sk.getName() + "(" + sk.listJoints().length + ")" : "",
    );
  for (const c of n.listChildren()) walk(c, d + 1);
}
for (const s of root.listScenes()) for (const c of s.listChildren()) walk(c);
console.log("meshes");
for (const m of root.listMeshes()) {
  for (const p of m.listPrimitives()) {
    const pos = p.getAttribute("POSITION");
    console.log(
      " ",
      m.getName(),
      "prim mat=",
      p.getMaterial()?.getName(),
      "verts",
      pos.getCount(),
      "attrs",
      p.listSemantics().join(","),
      "targets",
      p.listTargets().length,
      "min",
      pos.getMin([]).map((x) => +x.toFixed(3)),
      "max",
      pos.getMax([]).map((x) => +x.toFixed(3)),
    );
  }
}
console.log("materials");
for (const m of root.listMaterials()) {
  const bc = m.getBaseColorTexture();
  console.log(
    " ",
    m.getName(),
    "alpha",
    m.getAlphaMode(),
    m.getAlphaCutoff(),
    "dbl",
    m.getDoubleSided(),
    "bcf",
    m.getBaseColorFactor().map((x) => +x.toFixed(3)),
    "bct",
    bc ? bc.getName() + "|" + bc.getURI() + "|" + bc.getMimeType() + "|" + bc.getSize() : null,
    "emis",
    m.getEmissiveTexture()?.getName(),
    m.getEmissiveFactor(),
    "ext",
    m.listExtensions().map((e) => e.extensionName),
    "metal",
    m.getMetallicFactor(),
    "rough",
    m.getRoughnessFactor(),
    "normal",
    m.getNormalTexture()?.getName(),
    "mr",
    m.getMetallicRoughnessTexture()?.getName(),
  );
}
console.log("textures");
for (const t of root.listTextures())
  console.log(" ", t.getName(), t.getURI(), t.getMimeType(), t.getSize(), t.getImage()?.byteLength);
console.log("animations", root.listAnimations().length);
for (const a of root.listAnimations()) {
  let max = 0,
    min = 1e9,
    nodes = new Set();
  for (const c of a.listChannels()) {
    const s = c.getSampler();
    const inp = s.getInput();
    const arr = inp.getArray();
    min = Math.min(min, arr[0]);
    max = Math.max(max, arr[arr.length - 1]);
    nodes.add(c.getTargetNode()?.getName());
  }
  console.log(
    " ",
    a.getName(),
    "ch",
    a.listChannels().length,
    "nodes",
    nodes.size,
    "t",
    min.toFixed(3),
    max.toFixed(3),
    "keys",
    a.listChannels()[0]?.getSampler().getInput().getCount(),
    a.listChannels()[0]?.getSampler().getInterpolation(),
  );
}
console.log(
  "skins",
  root
    .listSkins()
    .map((s) => s.getName() + ":" + s.listJoints().length + " skel=" + s.getSkeleton()?.getName()),
);
console.log("scene extras", JSON.stringify(root.listScenes()[0].getExtras()).slice(0, 300));
