// Writes the bunny's GLB from what the build page computed. glTF Transform does the writing;
// this decides the layout:
//
// - Places, normals and UVs are stored as normalised integers (KHR_mesh_quantization): a place is
//   a signed 16-bit share of one metre (steps of 0.03 mm, with no node scale to undo), a normal a
//   signed byte, a UV an unsigned 16-bit share of the picture. GLTFLoader reads all of it with no
//   plugin; read a value with `getX` and friends, never from `.array`.
// - Morph targets store places only (no normals: nothing is lit), as normalised 16-bit offsets.
//   A target that moves few corners is written sparse; one that moves none has no data at all
//   (glTF reads that as zeros).
// - One picture, lossless WebP, shared by the two unlit materials.
const path = require("node:path");
const { createRequire } = require("node:module");

const REPO = path.resolve(__dirname, "../../..");
const root = createRequire(path.join(REPO, "package.json"));
const { Document, NodeIO, TextureInfo } = root("@gltf-transform/core");
const { EXTTextureWebP, KHRMaterialsUnlit, KHRMeshQuantization } = root(
  "@gltf-transform/extensions",
);
/** A rigid place and turn as a 3 by 3 turn (rows) and a shift. */
function rigid(position, q) {
  const [x, y, z, w] = q;
  const r = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
  return { r, t: [...position] };
}
/** `a` then `b` inside it: a * b. */
function times(a, b) {
  const r = [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => a.r[i].reduce((s, v, k) => s + v * b.r[k][j], 0)),
  );
  const t = [0, 1, 2].map((i) => a.r[i].reduce((s, v, k) => s + v * b.t[k], 0) + a.t[i]);
  return { r, t };
}
/** The inverse of a rigid transform, as glTF's column-major 4 by 4. */
function inverseColumns(m) {
  const rt = [0, 1, 2].map((i) => [0, 1, 2].map((j) => m.r[j][i]));
  const t = [0, 1, 2].map((i) => -rt[i].reduce((s, v, k) => s + v * m.t[k], 0));
  return [
    rt[0][0],
    rt[1][0],
    rt[2][0],
    0,
    rt[0][1],
    rt[1][1],
    rt[2][1],
    0,
    rt[0][2],
    rt[1][2],
    rt[2][2],
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}

/** Under this share of moved corners a target is stored sparse. */
const SPARSE_BELOW = 0.5;

function fail(message) {
  throw new Error(`bunny write: ${message}`);
}

const toInt = (values, scale, Type, what) => {
  const out = new Type(values.length);
  const limit = scale;
  for (let i = 0; i < values.length; i++) {
    const v = Math.round(values[i] * scale);
    if (Math.abs(v) > limit || !Number.isFinite(v)) fail(`${what} out of range: ${values[i]}`);
    out[i] = v;
  }
  return out;
};

/** Weights as bytes that add up to 255 exactly (the largest share takes the rounding). */
function weightBytes(weights) {
  const out = new Uint8Array(weights.length);
  for (let i = 0; i < weights.length; i += 4) {
    const w = weights.slice(i, i + 4);
    const sum = w.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-4) fail(`weights of vertex ${i / 4} add up to ${sum}`);
    const b = w.map((x) => Math.round(x * 255));
    const big = w.indexOf(Math.max(...w));
    b[big] += 255 - b.reduce((a, c) => a + c, 0);
    for (let k = 0; k < 4; k++) out[i + k] = b[k];
  }
  return out;
}

/**
 * `model`: { bones, extras, primitives: { body, face }, targets }, from the page.
 * `webp`: the picture's bytes. Returns the GLB's bytes and what was decided about the targets.
 */
async function writeGlb(model, webp) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const unlit = doc.createExtension(KHRMaterialsUnlit);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);

  const texture = doc
    .createTexture("bunny_paint")
    .setImage(new Uint8Array(webp))
    .setMimeType("image/webp");
  const material = (name) => {
    const m = doc
      .createMaterial(name)
      .setBaseColorTexture(texture)
      .setMetallicFactor(0)
      .setRoughnessFactor(1)
      .setExtension("KHR_materials_unlit", unlit.createUnlit());
    m.getBaseColorTextureInfo()
      .setWrapS(TextureInfo.WrapMode.CLAMP_TO_EDGE)
      .setWrapT(TextureInfo.WrapMode.CLAMP_TO_EDGE)
      .setMagFilter(TextureInfo.MagFilter.LINEAR)
      .setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR);
    return m;
  };
  const materials = { body: material("bunny_body"), face: material("bunny_face") };

  // The tree: the root carries the extras; the bones hang under it; the skinned mesh beside them.
  const top = doc.createNode("bunny").setExtras(model.extras);
  const nodes = {};
  const world = {};
  for (const bone of model.bones) {
    const node = doc.createNode(bone.name).setTranslation(bone.position).setRotation(bone.rotation);
    nodes[bone.name] = node;
    (bone.parent ? nodes[bone.parent] : top).addChild(node);
    const local = rigid(bone.position, bone.rotation);
    world[bone.name] = bone.parent ? times(world[bone.parent], local) : local;
  }
  const inverse = new Float32Array(model.bones.length * 16);
  model.bones.forEach((bone, i) => {
    inverse.set(inverseColumns(world[bone.name]), i * 16);
  });
  const skin = doc
    .createSkin("bunny_skin")
    .setSkeleton(nodes.body)
    .setInverseBindMatrices(
      doc.createAccessor("bunny_bind").setType("MAT4").setArray(inverse).setBuffer(buffer),
    );
  for (const bone of model.bones) skin.addJoint(nodes[bone.name]);

  const mesh = doc
    .createMesh("bunny_parts")
    .setWeights(model.targets.map(() => 0))
    .setExtras({ targetNames: model.targets });
  const decided = {};
  for (const key of ["body", "face"]) {
    const p = model.primitives[key];
    const count = p.position.length / 3;
    const accessor = (name, type, array, normalized) =>
      doc
        .createAccessor(`${key}_${name}`)
        .setType(type)
        .setArray(array)
        .setNormalized(normalized)
        .setBuffer(buffer);
    for (const v of p.uv) if (v < 0 || v > 1) fail(`a UV of ${key} is outside the picture: ${v}`);
    const primitive = doc
      .createPrimitive()
      .setMaterial(materials[key])
      .setAttribute(
        "POSITION",
        accessor("position", "VEC3", toInt(p.position, 32767, Int16Array, "a place"), true),
      )
      .setAttribute(
        "NORMAL",
        accessor("normal", "VEC3", toInt(p.normal, 127, Int8Array, "a normal"), true),
      )
      .setAttribute(
        "TEXCOORD_0",
        accessor("uv", "VEC2", toInt(p.uv, 65535, Uint16Array, "a UV"), true),
      )
      .setAttribute("JOINTS_0", accessor("joints", "VEC4", Uint8Array.from(p.joints), false))
      .setAttribute("WEIGHTS_0", accessor("weights", "VEC4", weightBytes(p.weights), true))
      .setIndices(
        doc
          .createAccessor(`${key}_index`)
          .setType("SCALAR")
          .setArray(count > 65535 ? Uint32Array.from(p.index) : Uint16Array.from(p.index))
          .setBuffer(buffer),
      );
    decided[key] = {};
    model.targets.forEach((name, t) => {
      const values = toInt(p.targets[t], 32767, Int16Array, `target ${name}`);
      let moved = 0;
      for (let i = 0; i < count; i++) {
        if (values[i * 3] || values[i * 3 + 1] || values[i * 3 + 2]) moved++;
      }
      const sparse = moved < count * SPARSE_BELOW;
      // Handed over as plain integers and marked normalised afterwards (see `normalise`).
      const target = doc
        .createPrimitiveTarget(name)
        .setAttribute(
          "POSITION",
          accessor(`target_${name}`, "VEC3", values, false).setSparse(sparse),
        );
      primitive.addTarget(target);
      decided[key][name] = { moved, of: count, sparse };
    });
    mesh.addPrimitive(primitive);
  }
  const holder = doc.createNode("bunny_mesh").setMesh(mesh).setSkin(skin);
  top.addChild(holder);
  const scene = doc.createScene("bunny_scene").addChild(top);
  doc.getRoot().setDefaultScene(scene);

  const io = new NodeIO().registerExtensions([
    KHRMaterialsUnlit,
    KHRMeshQuantization,
    EXTTextureWebP,
  ]);
  const glb = normalise(Buffer.from(await io.writeBinary(doc)), /_target_/);
  return { glb, targets: decided };
}

/**
 * Marks the accessors whose names match as normalised, in the GLB's JSON; the binary part is left
 * as it is. glTF Transform (4.5.1) writes a sparse accessor's values by reading them back through
 * `getElement`, which decodes a normalised integer to a float, and then stores that float in an
 * integer array: every offset below one metre would become 0. So the targets go in as plain
 * integers (their bytes are the same) and are marked normalised here. The build checks every
 * target after GLTFLoader has read the file.
 */
function normalise(glb, pattern) {
  const jsonLength = glb.readUInt32LE(12);
  if (glb.readUInt32LE(16) !== 0x4e4f534a) fail("the GLB does not start with its JSON");
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  let marked = 0;
  for (const accessor of json.accessors) {
    if (!pattern.test(accessor.name ?? "")) continue;
    if (accessor.componentType !== 5122) fail(`${accessor.name} is not 16-bit`);
    accessor.normalized = true;
    marked++;
  }
  if (marked === 0) fail("no target to mark");
  let text = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const rest = glb.subarray(20 + jsonLength);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, text, rest]);
}

module.exports = { writeGlb };
