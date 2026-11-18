// Reading the doll's two FBX files in the page: the rig file (the mesh and the true bind pose) and
// the Mixamo walking file (only its clip is used). Everything here is plain three, no exporting.
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

export async function loadFbx(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const root = new FBXLoader().parse(buffer, "");
  root.updateMatrixWorld(true);
  let mesh = null;
  const bones = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh) mesh = o;
    if (o.isBone) bones.push(o);
  });
  return { root, mesh, bones, bytes: buffer.byteLength, animations: root.animations };
}

const r = (v, p = 5) => Math.round(v * 10 ** p) / 10 ** p;

/** The node tree with local transforms (degrees), for the notes. */
export function tree(root) {
  const out = [];
  const walk = (o, d) => {
    out.push({
      d,
      name: o.name,
      type: o.type,
      pos: o.position.toArray().map((v) => r(v, 4)),
      rot: [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => r((v * 180) / Math.PI, 2)),
      scale: o.scale.toArray().map((v) => r(v, 4)),
    });
    o.children.forEach((c) => walk(c, d + 1));
  };
  walk(root, 0);
  return out;
}

/** What the Python helpers read: the triangle soup of the mesh and the skeleton in world space (cm). */
export function dump(source) {
  const { mesh } = source;
  const g = mesh.geometry;
  mesh.updateMatrixWorld(true);
  const bones = mesh.skeleton.bones;
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  return {
    bones: bones.map((b) => b.name),
    parents: bones.map((b) => bones.indexOf(b.parent)),
    bindWorld: bones.map((b) =>
      b
        .getWorldPosition(v)
        .toArray()
        .map((x) => r(x, 4)),
    ),
    bindWorldQuat: bones.map((b) =>
      b
        .getWorldQuaternion(q)
        .toArray()
        .map((x) => r(x, 6)),
    ),
    position: Array.from(g.attributes.position.array, (x) => r(x, 4)),
    uv: Array.from(g.attributes.uv.array, (x) => r(x, 6)),
    normal: Array.from(g.attributes.normal.array, (x) => r(x, 4)),
    skinIndex: Array.from(g.attributes.skinIndex.array),
    skinWeight: Array.from(g.attributes.skinWeight.array, (x) => r(x, 5)),
    index: g.index ? Array.from(g.index.array) : null,
    meshMatrix: mesh.matrixWorld.toArray().map((x) => r(x, 6)),
    bindMatrix: mesh.bindMatrix.toArray().map((x) => r(x, 6)),
    bindMode: mesh.bindMode,
  };
}

/** A track by track list of a clip: name, times and the number of values. */
export function clipFacts(clip) {
  return {
    name: clip.name,
    duration: clip.duration,
    tracks: clip.tracks.map((t) => ({
      name: t.name,
      type: t.constructor.name,
      keys: t.times.length,
    })),
  };
}
