// The FBX to the GLB, in Chrome, with the site's own three: FBXLoader reads it, the materials are
// replaced by unlit ones, the eight hidden copies of the face are dropped, the vertices are merged
// and GLTFExporter writes one binary file with the pictures inside.
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** FBXLoader gives the embedded pictures as blob addresses: wait until each has decoded. */
function decoded(texture) {
  return new Promise((resolve) => {
    const tick = () => {
      const img = texture.image;
      if (img && img.complete && img.naturalWidth > 0) resolve();
      else setTimeout(tick, 5);
    };
    tick();
  });
}

/**
 * The face is nine copies of the screen: one is shown, with the UVs of the "normal" cell, and
 * eight are collapsed inside the head until a morph target opens them. The page picks the cell by
 * a UV offset in the shader instead, so the eight copies and their targets are dropped here. A
 * triangle is kept when no target moves any of its corners.
 */
function dropHiddenFaces(mesh) {
  const g = mesh.geometry;
  const n = g.attributes.position.count;
  const moved = new Uint8Array(n);
  const d = new THREE.Vector3();
  for (const target of g.morphAttributes.position ?? []) {
    for (let i = 0; i < n; i++) {
      d.fromBufferAttribute(target, i);
      if (d.lengthSq() > 1e-12) moved[i] = 1;
    }
  }
  const keep = [];
  for (let i = 0; i < n; i += 3) {
    if (!moved[i] && !moved[i + 1] && !moved[i + 2]) keep.push(i, i + 1, i + 2);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const size = attr.itemSize;
    const arr = new attr.array.constructor(keep.length * size);
    keep.forEach((src, k) => {
      for (let c = 0; c < size; c++) arr[k * size + c] = attr.array[src * size + c];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, size, attr.normalized));
  }
  let start = 0;
  for (const group of g.groups) {
    const count = keep.filter((i) => i >= group.start && i < group.start + group.count).length;
    out.addGroup(start, count, group.materialIndex);
    start += count;
  }
  mesh.geometry = out;
  delete mesh.morphTargetDictionary;
  delete mesh.morphTargetInfluences;
  mesh.updateMorphTargets();
  return keep.length / 3;
}

/**
 * The exporter encodes the pictures with `canvas.toBlob(callback, type)` and no quality, which is
 * Chrome's default (0.8 for WebP). This passes ours. In Chrome a WebP quality of 1 is the lossless
 * encoder, so "webp at 1" keeps every pixel.
 */
function withQuality(quality, work) {
  const original = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
    original.call(this, callback, type, quality);
  };
  return work().finally(() => {
    HTMLCanvasElement.prototype.toBlob = original;
  });
}

/**
 * `image` is "image/webp" or "image/png"; `quality` is the WebP quality, 0 to 1 (1 is lossless).
 * Returns the file as base64 with a short report.
 */
export async function convert(url, { image = "image/webp", quality = 1 } = {}) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const root = new FBXLoader().parse(buffer, "");
  root.name = "drone";
  const meshes = [];
  root.traverse((o) => {
    // FBXLoader leaves its own notes here (the unit scale and such): nothing the page needs.
    o.userData = {};
    if (o.isMesh) meshes.push(o);
  });
  const report = { image, quality, sourceBytes: buffer.byteLength, meshes: [] };
  for (const mesh of meshes) {
    const before = mesh.geometry.attributes.position.count;
    const materials = [].concat(mesh.material);
    for (const m of materials) if (m.map) await decoded(m.map);
    // Unlit, the picture only: the paint already carries the shading, and the emission masks are
    // not needed when nothing is lit.
    const made = materials.map((m) => {
      const basic = new THREE.MeshBasicMaterial({ map: m.map });
      basic.name = m.name;
      if (basic.map) {
        basic.map.name = `${m.name}_base`;
        basic.map.userData = { mimeType: image };
      }
      return basic;
    });
    mesh.material = made.length > 1 ? made : made[0];
    const keptTriangles = dropHiddenFaces(mesh);
    // FBXLoader gives three loose corners per triangle. Merging the equal ones makes an index and
    // a file a quarter of the size. The material groups are put back, they survive by position.
    const groups = mesh.geometry.groups.map((x) => ({ ...x }));
    const merged = mergeVertices(mesh.geometry, 1e-5);
    merged.clearGroups();
    for (const group of groups) merged.addGroup(group.start, group.count, group.materialIndex);
    mesh.geometry = merged;
    report.meshes.push({
      name: mesh.name,
      cornersBefore: before,
      trianglesBefore: before / 3,
      triangles: keptTriangles,
      vertices: merged.attributes.position.count,
    });
  }

  const warnings = [];
  const warn = console.warn;
  console.warn = (...parts) => warnings.push(parts.join(" "));
  let glb;
  try {
    glb = await withQuality(quality, () =>
      new GLTFExporter().parseAsync(root, {
        binary: true,
        onlyVisible: false,
        embedImages: true,
        animations: [],
      }),
    );
  } finally {
    console.warn = warn;
  }
  report.warnings = warnings;
  report.bytes = glb.byteLength;

  let binary = "";
  const bytes = new Uint8Array(glb);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return { report, base64: btoa(binary) };
}

/** The pixels of a picture of the FBX, as the exporter will see them (for the exactness check). */
export async function sourcePixels(url, materialName) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const root = new FBXLoader().parse(buffer, "");
  let texture = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) if (m.name === materialName && m.map) texture = m.map;
  });
  if (!texture) return null;
  await decoded(texture);
  return { image: texture.image, flipY: texture.flipY };
}
