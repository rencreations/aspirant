// The page the checks run in: the site's own three, GLTFLoader and the meshopt decoder, one
// canvas. The pipeline drives it through window.stage from Node (see lib/browser.mjs).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e7e2);
// A plain light, close to how the room draws the base colour: mostly ambient, one soft key.
const hemi = new THREE.HemisphereLight(0xffffff, 0xb8b4ac, 2.2);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 4, 3);
scene.add(hemi, sun);
// The ground: a ring of 1 m and a grid, so a sheet shows where y = 0 and the origin are.
const grid = new THREE.GridHelper(4, 8, 0x8a8478, 0xc4beb2);
scene.add(grid);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = {};
const v = new THREE.Vector3();

function skinnedBox(root, filter) {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (filter && !filter(o)) return;
    let hidden = false;
    for (let p = o; p; p = p.parent) if (!p.visible) hidden = true;
    if (hidden) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
      v.applyMatrix4(o.matrixWorld);
      box.expandByPoint(v);
    }
  });
  return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
}

window.stage = {
  THREE,
  scene,
  camera,
  renderer,
  models,
  grid,
  async load(name, url) {
    const gltf = await loader.loadAsync(url);
    const meshes = [];
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        meshes.push(o);
      }
    });
    scene.add(gltf.scene);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    models[name] = {
      gltf,
      root: gltf.scene,
      mixer,
      clips: Object.fromEntries(gltf.animations.map((c) => [c.name, c])),
      meshes,
    };
    return {
      // The duration as three has it (not rounded): hideAt is checked against it.
      clips: gltf.animations.map((c) => [c.name, c.duration, c.tracks.length]),
      meshes: meshes.map((m) => [
        m.name,
        m.isSkinnedMesh,
        m.material.type,
        m.material.name,
        m.material.transparent,
        m.material.blending,
        !!m.material.map,
        m.geometry.attributes.position.count,
      ]),
      extras: gltf.scene.userData ?? {},
      top: gltf.scene.children.map((c) => c.name),
    };
  },
  /** Pose one model: stop everything, then play `clip` held at time `t` (no blending). */
  pose(name, clip, t) {
    const m = models[name];
    m.mixer.stopAllAction();
    if (clip) {
      const action = m.mixer.clipAction(m.clips[clip]);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset().play();
      m.mixer.setTime(Math.min(t, m.clips[clip].duration));
    }
    m.root.updateMatrixWorld(true);
  },
  /** Pose one model with a weighted mix of two clips (the room's crossfade). */
  mix(name, a, ta, b, tb, wb) {
    const m = models[name];
    m.mixer.stopAllAction();
    const A = m.mixer.clipAction(m.clips[a]);
    const B = m.mixer.clipAction(m.clips[b]);
    for (const [act, w] of [
      [A, 1 - wb],
      [B, wb],
    ]) {
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.reset().play();
      act.setEffectiveWeight(w);
    }
    A.time = Math.min(ta, m.clips[a].duration);
    B.time = Math.min(tb, m.clips[b].duration);
    m.mixer.update(0);
    m.root.updateMatrixWorld(true);
  },
  /** Shows or hides a node (by name) of a model, or the whole model. */
  show(name, node, on) {
    const m = models[name];
    const o = node ? m.root.getObjectByName(node) : m.root;
    o.visible = on;
  },
  box(name, node) {
    const m = models[name];
    return skinnedBox(node ? m.root.getObjectByName(node) : m.root);
  },
  /** World positions of nodes by name. */
  world(name, nodes) {
    const m = models[name];
    m.root.updateMatrixWorld(true);
    const out = {};
    for (const n of nodes) {
      const o = m.root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
      if (!o) continue;
      out[n] = o.getWorldPosition(new THREE.Vector3()).toArray();
    }
    return out;
  },
  /** World quaternions of nodes by name. */
  worldQuat(name, nodes) {
    const m = models[name];
    m.root.updateMatrixWorld(true);
    const out = {};
    for (const n of nodes) {
      const o = m.root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
      if (!o) continue;
      out[n] = o.getWorldQuaternion(new THREE.Quaternion()).toArray();
    }
    return out;
  },
  setBackground(color) {
    scene.background = color == null ? null : new THREE.Color(color);
  },
  /** Renders and returns a PNG data address. opts: width, height, pos, target, fov. */
  shot(opts) {
    const w = opts.width ?? 640;
    const h = opts.height ?? 640;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = opts.fov ?? 35;
    camera.near = opts.near ?? 0.02;
    camera.far = opts.far ?? 100;
    camera.position.set(...opts.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3(...opts.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);
    return canvas.toDataURL("image/png");
  },
};
window.__ready = true;
