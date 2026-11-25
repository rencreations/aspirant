// Loading the sources, cutting them into pieces and writing a GLB, with the site's own three.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export const disk = (file) => "/disk/" + encodeURIComponent(file.replace(/\\/g, "/"));
const dirOf = (file) => file.replace(/\\/g, "/").replace(/\/[^/]*$/, "");

/** The .mtl of a game client OBJ, read by hand: its picture names are quoted, which MTLLoader keeps. */
async function readMtl(file) {
  const text = await (await fetch(disk(file))).text();
  const out = {};
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("newmtl ")) out[(cur = t.slice(7).trim())] = {};
    else if (cur && t.startsWith("map_Kd ")) out[cur].map = t.slice(7).trim().replace(/^"|"$/g, "");
    else if (cur && /^d\s/.test(t)) out[cur].d = parseFloat(t.slice(2));
  }
  return out;
}

const textureCache = new Map();
/** A texture from a picture on disk, decoded before it is returned. */
export async function textureFrom(file) {
  if (textureCache.has(file)) return textureCache.get(file);
  const promise = (async () => {
    const t = await new THREE.TextureLoader().loadAsync(disk(file));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.name = file.replace(/^.*\//, "").replace(/\.[a-z]+$/i, "");
    return t;
  })();
  textureCache.set(file, promise);
  promise.catch(() => console.warn("missing picture " + file));
  return promise;
}

/** Waits until every picture the loaders asked for has arrived. */
export async function waitTextures(root) {
  const pending = () => {
    let n = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) {
        const img = m.map?.image;
        if (m.map && (!img || (img instanceof HTMLImageElement && !img.complete))) n++;
      }
    });
    return n;
  };
  for (let t = 0; t < 200 && pending() > 0; t++) await new Promise((r) => setTimeout(r, 50));
  if (pending() > 0) console.warn("pictures still missing");
}

/**
 * Loads a source or a finished file. OBJ files get one plain material per .mtl entry, with its
 * picture and its opacity (`d`), as the room drew them (MeshLambert, the picture repeating).
 */
export async function loadModel(file, { obj = {} } = {}) {
  const lower = file.toLowerCase();
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(disk(file));
    return { root: gltf.scene, clips: gltf.animations, extras: gltf.scene.userData };
  }
  if (lower.endsWith(".fbx")) {
    const root = await new FBXLoader()
      .setResourcePath(disk(dirOf(file) + "/"))
      .loadAsync(disk(file));
    await waitTextures(root);
    return { root, clips: root.animations, extras: {} };
  }
  const mtl = await readMtl(file.replace(/\.obj$/i, ".mtl"));
  const made = new Map();
  const materialFor = async (name) => {
    if (made.has(name)) return made.get(name);
    const spec = mtl[name] ?? {};
    // A picture the .mtl names but the folder does not have (Vexana's trail) leaves the part plain.
    const map = spec.map ? await textureFrom(dirOf(file) + "/" + spec.map).catch(() => null) : null;
    const m = new THREE.MeshLambertMaterial({
      map,
      color: map ? 0xffffff : 0xcccccc,
      side: THREE.DoubleSide,
    });
    const opacity =
      obj.opacity?.[name] ?? (spec.d !== undefined && spec.d < 1 ? spec.d : undefined);
    if (opacity !== undefined) Object.assign(m, { transparent: true, opacity, depthWrite: false });
    m.name = name;
    made.set(name, m);
    return m;
  };
  const root = await new OBJLoader().loadAsync(disk(file));
  const meshes = [];
  root.traverse((o) => o.isMesh && meshes.push(o));
  for (const o of meshes) {
    o.material = Array.isArray(o.material)
      ? await Promise.all(o.material.map((m) => materialFor(m.name)))
      : await materialFor(o.material.name);
  }
  return { root, clips: [], extras: {} };
}

/**
 * A static (not skinned) source as a flat list of pieces: one per object and material, in world
 * space, scaled by `scale`. `{ object, material, mat, geometry }`; the geometry is not indexed and
 * keeps its normals (made if the source has none) and UVs.
 */
export function pieces(root, { scale = 1 } = {}) {
  root.updateMatrixWorld(true);
  const out = [];
  const s = new THREE.Matrix4().makeScale(scale, scale, scale);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(s, o.matrixWorld));
    const mats = [o.material].flat();
    const groups = geo.groups.length
      ? geo.groups
      : [
          {
            start: 0,
            count: geo.index ? geo.index.count : geo.attributes.position.count,
            materialIndex: 0,
          },
        ];
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0];
      const sub = subRange(geo, g.start, g.count);
      if (!sub.attributes.normal) sub.computeVertexNormals();
      out.push({ object: o.name, material: mat.name, mat, geometry: sub });
    }
  });
  return out;
}

/** The triangles from `start` (in index or vertex order) for `count` corners, as a new non-indexed geometry. */
function subRange(geo, start, count) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const off = geo.index ? start : start;
  const sub = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    if (!["position", "normal", "uv"].includes(name)) continue;
    const a = attr.array.slice(off * attr.itemSize, (off + count) * attr.itemSize);
    sub.setAttribute(name, new THREE.BufferAttribute(a, attr.itemSize));
  }
  return sub;
}

/**
 * The connected parts of a non-indexed geometry: triangles that share a corner position (to 1e-5)
 * belong to one island. Returns arrays of triangle numbers, largest first.
 */
export function islands(geo) {
  const pos = geo.attributes.position.array;
  const tris = pos.length / 9;
  const parent = new Int32Array(tris).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const seen = new Map();
  for (let t = 0; t < tris; t++) {
    for (let c = 0; c < 3; c++) {
      const k = (t * 3 + c) * 3;
      const key = `${Math.round(pos[k] * 1e5)},${Math.round(pos[k + 1] * 1e5)},${Math.round(pos[k + 2] * 1e5)}`;
      const other = seen.get(key);
      if (other === undefined) seen.set(key, t);
      else {
        const a = find(t),
          b = find(other);
        if (a !== b) parent[a] = b;
      }
    }
  }
  const groups = new Map();
  for (let t = 0; t < tris; t++) {
    const r = find(t);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(t);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/** The given triangles of a non-indexed geometry, as a new geometry. */
export function pick(geo, triList) {
  const sub = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const n = attr.itemSize * 3;
    const a = new attr.array.constructor(triList.length * n);
    triList.forEach((t, i) => a.set(attr.array.subarray(t * n, t * n + n), i * n));
    sub.setAttribute(name, new THREE.BufferAttribute(a, attr.itemSize));
  }
  return sub;
}

export function boxOf(geo) {
  geo.computeBoundingBox();
  return geo.boundingBox.clone();
}

/**
 * The principal axes of a set of geometries (the vertices' covariance): `{ center, axes: [major,
 * middle, minor], values }`. For long items (a sword, a staff) the major axis is the length.
 */
export function principalAxes(geos) {
  const c = new THREE.Vector3();
  let n = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3)
      ((c.x += p[i]), (c.y += p[i + 1]), (c.z += p[i + 2]), n++);
  }
  c.divideScalar(n);
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const g of geos) {
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const d = [p[i] - c.x, p[i + 1] - c.y, p[i + 2] - c.z];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) m[a][b] += (d[a] * d[b]) / n;
    }
  }
  // Jacobi rotations on the symmetric 3x3 matrix.
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(m[p][q]) < 1e-15) continue;
      const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const cs = 1 / Math.sqrt(t * t + 1),
        sn = t * cs;
      for (let k = 0; k < 3; k++) {
        const mkp = m[k][p],
          mkq = m[k][q];
        m[k][p] = cs * mkp - sn * mkq;
        m[k][q] = sn * mkp + cs * mkq;
      }
      for (let k = 0; k < 3; k++) {
        const mpk = m[p][k],
          mqk = m[q][k];
        m[p][k] = cs * mpk - sn * mqk;
        m[q][k] = sn * mpk + cs * mqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p],
          vkq = v[k][q];
        v[k][p] = cs * vkp - sn * vkq;
        v[k][q] = sn * vkp + cs * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((a, b) => m[b][b] - m[a][a]);
  return {
    center: c,
    values: order.map((i) => m[i][i]),
    axes: order.map((i) => new THREE.Vector3(v[0][i], v[1][i], v[2][i]).normalize()),
  };
}

/**
 * The rotation that takes three orthogonal directions of the source to three target directions
 * (`from[i]` goes to `to[i]`). The third is recomputed so the result is a pure rotation.
 */
export function basisRotation(from, to) {
  const a = from[0].clone().normalize();
  const b = from[1]
    .clone()
    .sub(a.clone().multiplyScalar(from[1].dot(a)))
    .normalize();
  const c = new THREE.Vector3().crossVectors(a, b);
  const x = to[0].clone().normalize();
  const y = to[1].clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  const src = new THREE.Matrix4().makeBasis(a, b, c);
  const dst = new THREE.Matrix4().makeBasis(x, y, z);
  return dst.multiply(src.transpose());
}

/**
 * Moves the UVs of every triangle by whole tiles so that the triangle starts in the first tile. The
 * pictures repeat, so nothing changes on screen; values near 0 to 1 can be stored in 12 bits.
 */
export function shiftUvTiles(geo) {
  const uv = geo.attributes.uv;
  if (!uv) return;
  const a = uv.array;
  for (let t = 0; t < a.length; t += 6) {
    const du = Math.floor(Math.min(a[t], a[t + 2], a[t + 4]) + 1e-6);
    const dv = Math.floor(Math.min(a[t + 1], a[t + 3], a[t + 5]) + 1e-6);
    for (let k = 0; k < 6; k += 2) ((a[t + k] -= du), (a[t + k + 1] -= dv));
  }
  uv.needsUpdate = true;
}

/** The material written to the file: metallic-roughness, the picture as base colour, nothing else. */
export function standard(m, { side = THREE.DoubleSide, alphaTest, opacity } = {}) {
  const out = new THREE.MeshStandardMaterial({
    name: m.name,
    map: m.map ?? null,
    color: m.map ? 0xffffff : (m.color?.clone() ?? new THREE.Color(0xcccccc)),
    metalness: 0,
    roughness: 1,
    side,
  });
  const o = opacity ?? (m.transparent && m.opacity < 1 ? m.opacity : undefined);
  if (o !== undefined) Object.assign(out, { transparent: true, opacity: o, depthWrite: false });
  if (alphaTest) out.alphaTest = alphaTest;
  // Where the picture came from: node puts the original file's pixels back after the export (the
  // exporter draws pictures through a canvas, which loses the colour under a clear alpha).
  if (out.map?.image?.src) out.userData.src = out.map.image.src;
  return out;
}

/** A GLB of the object, as base64 (handed to node, which writes it). */
export async function exportGlb(object, { extras } = {}) {
  const scene = new THREE.Scene();
  scene.name = "Scene";
  scene.add(object);
  if (extras) scene.userData = extras;
  const exporter = new GLTFExporter();
  const buffer = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    maxTextureSize: 4096,
  });
  scene.remove(object);
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export { THREE };
