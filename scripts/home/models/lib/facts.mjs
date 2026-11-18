// Facts files: the numbers an actor needs, written once by the build and also embedded in the
// GLB (scene extras, `gltf.scene.userData.home` after loading) so one request gets everything.
import fs from "node:fs";
import path from "node:path";
import { REPO, writeWhole } from "./env.mjs";
import { restWorld } from "./rig.mjs";

/** The loader setup every home model needs. Written into each facts file. */
export const LOADER = {
  three: "r186",
  loader: "GLTFLoader",
  decoders:
    "setMeshoptDecoder(MeshoptDecoder) from three/examples/jsm/libs/meshopt_decoder.module.js",
  extensions:
    "EXT_meshopt_compression and KHR_mesh_quantization (both required), EXT_texture_webp (read by GLTFLoader with no plugin)",
  notNeeded: "no DRACOLoader, no KTX2Loader",
  materials:
    "MeshStandardMaterial; the build removes every KHR_materials_* extension so no MeshPhysicalMaterial appears",
};

const round = (v, d = 5) => Math.round(v * 10 ** d) / 10 ** d;

/** One row per bone: parent, node-local rest transform, rest head in world space, the name three uses. */
export function boneTable(bake) {
  const world = restWorld(bake);
  const table = {};
  for (const name of bake.bones) {
    const w = world.get(name).elements;
    table[name] = {
      three: name.replace(/\s/g, "_").replace(/[[\].:/]/g, ""),
      parent: bake.parent[name],
      restLocal: bake.restLocal[name].map((v) => round(v, 6)),
      restHead: [round(w[12]), round(w[13]), round(w[14])],
    };
  }
  return table;
}

/** Clip rows: frames, duration (N-1 frames at 24 per second), loop flag, the root's scale range. */
export function clipTable(bake, { alias = {}, loops = [], names = (c) => c, rootBone = null }) {
  const out = {};
  for (const [clip, data] of Object.entries(bake.clips)) {
    const frames = data.frames;
    const row = {
      alias: alias[clip] ?? clip,
      frames,
      fps: bake.fps,
      duration: round((frames - 1) / bake.fps, 6),
      loop: loops.includes(clip),
    };
    if (rootBone && data.tracks[rootBone]) {
      const t = data.tracks[rootBone];
      let lo = Infinity;
      let hi = -Infinity;
      for (let f = 0; f < frames; f++) {
        lo = Math.min(lo, t[f * 10 + 7]);
        hi = Math.max(hi, t[f * 10 + 7]);
      }
      row.rootScale = [round(lo, 4), round(hi, 4)];
    }
    out[names(clip)] = row;
  }
  return out;
}

let prettier;
/** The repository's own formatter, so a written file passes `pnpm format:check` as it is. */
export async function pretty(text, parser = "json") {
  prettier ??= await import("prettier");
  const config = (await prettier.resolveConfig(path.join(REPO, "x.json"))) ?? {};
  return prettier.format(text, { ...config, parser });
}

export async function writeFacts(file, facts) {
  writeWhole(file, await pretty(JSON.stringify(facts)));
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** The JSON part of a GLB. */
export function glbJson(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
}

/** Bytes the morph targets take in the file: the target accessors, sparse indices and values included. */
export function morphBytes(json) {
  const accessors = new Set();
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives) {
      for (const target of prim.targets ?? [])
        for (const a of Object.values(target)) accessors.add(a);
    }
  }
  const size = (view) => {
    const v = json.bufferViews[view];
    return v.extensions?.EXT_meshopt_compression?.byteLength ?? v.byteLength;
  };
  let bytes = 0;
  for (const index of accessors) {
    const a = json.accessors[index];
    if (a.sparse) bytes += size(a.sparse.indices.bufferView) + size(a.sparse.values.bufferView);
    else if (a.bufferView !== undefined) bytes += size(a.bufferView);
  }
  return bytes;
}
