// Loads the built GLB back with GLTFLoader, as the page does, reports what is in it, and draws the
// check pictures: the views, the blink before (the FBX's own target) and after, the faces, and
// frames of the clips.
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PAPER = 0xf4f6f9;

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setClearColor(PAPER, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, 1, 0.05, 40);

/** The model on the stage: the built GLB, or the FBX for the "before" pictures. */
const stage = { root: null, meshes: [], mixer: null, clips: new Map(), rest: [] };
const round = (n) => Math.round(n * 1e5) / 1e5;

function adopt(root, clips = []) {
  if (stage.root) scene.remove(stage.root);
  stage.root = root;
  stage.meshes = [];
  stage.rest = [];
  scene.add(root);
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isBone) stage.rest.push([o, o.position.clone(), o.quaternion.clone()]);
    if (!o.isMesh) return;
    o.frustumCulled = false;
    stage.meshes.push(o);
    for (const m of [].concat(o.material)) {
      m.toneMapped = false;
      if (m.map) m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      // The decals lie on the face: they never write depth and are drawn after the skin.
      if (m.name === "tetra_mouth" || m.name === "tetra_eyes") {
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -2;
      }
      if (m.name === "tetra_mouth") {
        m.depthWrite = false;
        o.renderOrder = 2;
      }
    }
  });
  stage.mixer = new THREE.AnimationMixer(root);
  stage.clips = new Map(clips.map((clip) => [clip.name, clip]));
}

function describe(root, animations) {
  const bones = [];
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isBone) {
      bones.push({
        name: o.name,
        parent: o.parent ? o.parent.name : null,
        position: o.position.toArray().map(round),
        quaternion: o.quaternion.toArray().map(round),
      });
    }
    if (o.isMesh) {
      const g = o.geometry;
      meshes.push({
        node: o.name,
        skinned: o.isSkinnedMesh === true,
        joints: o.skeleton ? o.skeleton.bones.length : 0,
        materials: [].concat(o.material).map((m) => ({
          name: m.name,
          type: m.type,
          transparent: m.transparent,
          map: m.map ? [m.map.image?.width, m.map.image?.height] : null,
        })),
        triangles: (g.index ? g.index.count : g.attributes.position.count) / 3,
        vertices: g.attributes.position.count,
        attributes: Object.keys(g.attributes).sort(),
        targets: Object.keys(o.morphTargetDictionary ?? {}),
      });
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  return {
    bones,
    meshes,
    box: { min: box.min.toArray().map(round), max: box.max.toArray().map(round) },
    // The scene's extras ride on the node called "tetra" (the loader wraps it in a scene).
    extras: (root.getObjectByName("tetra") ?? root).userData,
    animations: animations.map((clip) => ({
      name: clip.name,
      seconds: round(clip.duration),
      tracks: clip.tracks.length,
    })),
  };
}

export async function loadGlb(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const t0 = performance.now();
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  const parseMs = Math.round(performance.now() - t0);
  adopt(gltf.scene, gltf.animations);
  return { ...describe(gltf.scene, gltf.animations), parseMs };
}

/** The FBX as it is, unlit, for the pictures of the blink before the fix. */
export async function loadFbx(url) {
  const root = new FBXLoader().parse(await (await fetch(url)).arrayBuffer(), "");
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = [].concat(o.material).map((m) => {
      const basic = new THREE.MeshBasicMaterial({
        map: m.map,
        alphaMap: m.alphaMap,
        transparent: m.transparent,
      });
      basic.name = m.name;
      return basic;
    });
  });
  adopt(root);
  return describe(root, []);
}

/** The lowest point of each lower leg over a clip, for the check against the ground. */
export function legTips(name, steps = 24) {
  const clip = stage.clips.get(name);
  const out = [];
  const p = new THREE.Vector3();
  for (let k = 0; k <= steps; k++) {
    pose({ clip: name, t: (clip.duration * k) / steps });
    const row = [];
    for (const side of ["Left", "Right"]) {
      // The leg's bone ends where the source's foot bone began: 0.072 along its own Y.
      const leg = stage.root.getObjectByName(`mixamorig${side}Leg`);
      row.push(round(p.set(0, 0.072, 0).applyMatrix4(leg.matrixWorld).y));
    }
    out.push(row);
  }
  return out;
}

function pose({ morph = {}, clip = null, t = 0, turn = {} }) {
  stage.mixer.stopAllAction();
  for (const [bone, position, quaternion] of stage.rest) {
    bone.position.copy(position);
    bone.quaternion.copy(quaternion);
  }
  if (clip && stage.clips.has(clip)) {
    stage.mixer.clipAction(stage.clips.get(clip)).play();
    stage.mixer.setTime(t);
  }
  // Extra turns of single bones, in degrees about their own axes, after the clip.
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [name, [x, y, z]] of Object.entries(turn)) {
    const bone = stage.root.getObjectByName(name);
    if (!bone) continue;
    const d = Math.PI / 180;
    bone.quaternion.multiply(q.setFromEuler(e.set(x * d, y * d, z * d)));
  }
  for (const mesh of stage.meshes) {
    if (!mesh.morphTargetDictionary) continue;
    mesh.morphTargetInfluences.fill(0);
    for (const [name, value] of Object.entries(morph)) {
      const i = mesh.morphTargetDictionary[name];
      if (i !== undefined) mesh.morphTargetInfluences[i] = value;
    }
  }
  stage.root.updateMatrixWorld(true);
}

function draw({ size, view = [0, 0, 1], target = [0, 0.33, 0], across = 0.8, ...rest }) {
  pose(rest);
  renderer.setSize(size, size, false);
  camera.aspect = 1;
  const distance = across / (2 * Math.tan((camera.fov * Math.PI) / 360));
  const from = new THREE.Vector3(...view).normalize().multiplyScalar(distance);
  camera.position.set(target[0] + from.x, target[1] + from.y, target[2] + from.z);
  camera.lookAt(...target);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

/**
 * A sheet of pictures. Each cell: `label`, and any of `view`, `target`, `across` (metres),
 * `morph` (name to weight), `clip` and `t`, `turn` (bone to degrees).
 */
export async function sheet(cells, { size = 360, cols = 5 } = {}) {
  const rows = Math.ceil(cells.length / cols);
  const out = document.createElement("canvas");
  out.width = cols * size;
  out.height = rows * (size + 22);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.font = "13px monospace";
  for (let i = 0; i < cells.length; i++) {
    draw({ ...cells[i], size });
    const x = (i % cols) * size;
    const y = Math.floor(i / cols) * (size + 22);
    ctx.drawImage(canvas, x, y + 22);
    ctx.fillStyle = "#000";
    ctx.fillText(cells[i].label ?? "", x + 4, y + 15);
  }
  return out.toDataURL("image/png");
}
