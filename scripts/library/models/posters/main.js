// Draws the poster of one view with the site's three: the model in the pose it opens with, under the
// room's light, from the room's opening angle, on a clear ground. `window.poster(view)` returns a PNG
// data address.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

function light(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const swap = (m) => {
      if (!m.isMeshStandardMaterial) return m;
      return new THREE.MeshLambertMaterial({
        color: m.color,
        map: m.map,
        emissive: m.emissive,
        emissiveMap: m.emissiveMap,
        alphaMap: m.alphaMap,
        transparent: m.transparent,
        opacity: m.opacity,
        alphaTest: m.alphaTest,
        side: THREE.DoubleSide,
      });
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}

function bounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let local;
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      local = o.boundingBox;
    } else {
      o.geometry.computeBoundingBox();
      local = o.geometry.boundingBox;
    }
    let parent = o;
    let shown = true;
    while (parent) {
      if (!parent.visible) shown = false;
      parent = parent.parent;
    }
    if (shown) box.union(local.clone().applyMatrix4(o.matrixWorld));
  });
  return box;
}

window.poster = async ({ file, mode, clip, home, w, h }) => {
  const gltf = await loader.loadAsync(file);
  const root = gltf.scene;
  const extras = root.userData ?? {};
  // A view with two forms shows the normal one.
  if (extras.forms) {
    const abyssal = root.getObjectByName(extras.forms.roots?.abyssal ?? "abyssal");
    if (abyssal) abyssal.visible = false;
  }
  if (gltf.animations.length) {
    const named =
      gltf.animations.find((c) => c.name === clip) ??
      gltf.animations.find((c) => c.name.endsWith("idle")) ??
      gltf.animations[0];
    const target = extras.forms
      ? (root.getObjectByName(extras.forms.roots?.normal ?? "normal") ?? root)
      : root;
    const mixer = new THREE.AnimationMixer(target);
    mixer.clipAction(named).play();
    mixer.update(0);
  }
  light(root);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4bfd2, 1.55));
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 200);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-1.6, 2.2, 3);
  camera.add(key);
  scene.add(camera);
  const pivot = new THREE.Group();
  pivot.add(root);
  scene.add(pivot);
  const box = bounds(root);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  if (mode === "item") {
    root.position.sub(c);
    const [yaw0, tilt0] = home ?? [-0.45, 0.18];
    pivot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw0);
    pivot.quaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt0),
    );
    c.set(0, 0, 0);
  }
  const t = Math.tan((30 * Math.PI) / 360);
  const radius = size.length() / 2;
  const yaw = mode === "item" ? 0 : 0.42;
  const pitch = mode === "item" ? 0 : 0.1;
  const fill = 0.86;
  const dist =
    mode === "character"
      ? Math.max((size.y * 0.5) / (t * fill), (radius * 0.75) / (t * (w / h) * fill))
      : radius / Math.sin(Math.atan(Math.min(t, t * (w / h)) * fill));
  camera.position.set(
    c.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    c.y + Math.sin(pitch) * dist,
    c.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(c);
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.render(scene, camera);
  const data = renderer.domElement.toDataURL("image/png");
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      for (const m of [o.material].flat()) m.dispose();
    }
  });
  return data;
};

window.__ready = true;
