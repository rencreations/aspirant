// What the build does with the finished file: loads it back with a plain GLTFLoader (no decoder, no
// plugin: the site loads it the same way), describes it and draws the check pictures.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** The lighting the check pictures use, and the page can start from. See the README. */
export const RECIPE = {
  environment: "RoomEnvironment through PMREMGenerator.fromScene(env, 0.04)",
  environmentIntensity: 0.45,
  toneMapping: "NoToneMapping",
  key: { color: 0xfff4e6, intensity: 1.0, position: [-1.2, 2.2, 2.4] },
  fill: { color: 0xcfe0ff, intensity: 0.35, position: [2.0, 0.8, 1.0] },
  rim: { color: 0xffffff, intensity: 0.5, position: [0.5, 1.5, -2.5] },
  hemisphere: { sky: 0xffffff, ground: 0xb9a9a9, intensity: 0.25 },
  background: "#c9ced6",
};

let renderer = null;
let scene = null;
let lights = null;
let loaded = null;
let rest = null;
let toneMapping = THREE.NoToneMapping;

function ensureRenderer(width, height) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);
  }
  renderer.toneMapping = toneMapping;
  renderer.setSize(width, height, false);
}

function makeScene(model) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(RECIPE.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = RECIPE.environmentIntensity;
  const key = new THREE.DirectionalLight(RECIPE.key.color, RECIPE.key.intensity);
  key.position.set(...RECIPE.key.position);
  const fill = new THREE.DirectionalLight(RECIPE.fill.color, RECIPE.fill.intensity);
  fill.position.set(...RECIPE.fill.position);
  const rim = new THREE.DirectionalLight(RECIPE.rim.color, RECIPE.rim.intensity);
  rim.position.set(...RECIPE.rim.position);
  const hemi = new THREE.HemisphereLight(
    RECIPE.hemisphere.sky,
    RECIPE.hemisphere.ground,
    RECIPE.hemisphere.intensity,
  );
  scene.add(key, fill, rim, hemi, model);
  lights = { key, fill, rim, hemi };
}

export function find(name) {
  let found = null;
  loaded.scene.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
}

function skinned() {
  let mesh = null;
  loaded.scene.traverse((o) => {
    if (o.isSkinnedMesh) mesh = o;
  });
  return mesh;
}

const r = (v, p = 5) => Math.round(v * 10 ** p) / 10 ** p;

/** The facts of the file as the loader gives it back. */
export async function loadGlb(url, parserJson) {
  const started = performance.now();
  loaded = await new GLTFLoader().loadAsync(url);
  const parseMs = Math.round(performance.now() - started);
  ensureRenderer(800, 800);
  makeScene(loaded.scene);
  loaded.scene.updateMatrixWorld(true);
  const mesh = skinned();
  const bones = mesh.skeleton.bones;
  rest = new Map();
  const bindQ = new Map();
  bones.forEach((b) => {
    bindQ.set(b.name, b.getWorldQuaternion(new THREE.Quaternion()));
    rest.set(b.name, { q: b.quaternion.clone(), p: b.position.clone(), s: b.scale.clone() });
  });
  window.__bindQ = bindQ;
  const geometry = mesh.geometry;
  const attributes = Object.fromEntries(
    Object.entries(geometry.attributes).map(([k, a]) => [
      k,
      {
        itemSize: a.itemSize,
        count: a.count,
        array: a.array.constructor.name,
        normalized: a.normalized,
      },
    ]),
  );
  geometry.computeBoundingBox();
  const box = new THREE.Box3().setFromObject(mesh, true);
  const mat = mesh.material;
  const nodes = [];
  loaded.scene.traverse((o) =>
    nodes.push({ name: o.name, type: o.type, parent: o.parent?.name ?? null }),
  );
  return {
    parseMs,
    nodes,
    bones: bones.map((b) => ({
      name: b.name,
      parent: b.parent?.isBone ? b.parent.name : null,
      world: b
        .getWorldPosition(new THREE.Vector3())
        .toArray()
        .map((v) => r(v)),
    })),
    attributes,
    triangles: geometry.index.count / 3,
    faceVertices: geometry.attributes._face
      ? geometry.attributes._face.array.reduce((a, v) => a + v, 0)
      : 0,
    material: {
      type: mat.type,
      name: mat.name,
      maps: ["map", "normalMap", "metalnessMap", "roughnessMap", "aoMap"].filter((k) => mat[k]),
      mapSize: [mat.map.image.width, mat.map.image.height],
      normalSize: [mat.normalMap.image.width, mat.normalMap.image.height],
      ormSize: [mat.metalnessMap.image.width, mat.metalnessMap.image.height],
      sameOrm: mat.metalnessMap === mat.roughnessMap,
    },
    animations: loaded.animations.map((a) => ({
      name: a.name,
      seconds: r(a.duration, 4),
      tracks: a.tracks.length,
    })),
    box: { min: box.min.toArray().map((v) => r(v)), max: box.max.toArray().map((v) => r(v)) },
    extras: loaded.scene.children[0]?.userData ?? {},
    sceneExtras: loaded.scene.userData,
  };
}

export function setTone(name) {
  toneMapping = THREE[name] ?? THREE.NoToneMapping;
}

/** Back to the rest pose, then the world-axis turns of `spec`: { Bone: [rx, ry, rz] degrees }. */
export function pose(spec = {}, { hips = null, scales = {}, clip = null, t = 0 } = {}) {
  const mesh = skinned();
  const bones = mesh.skeleton.bones;
  const by = new Map(bones.map((b) => [b.name, b]));
  for (const b of bones) {
    const q = rest.get(b.name);
    b.quaternion.copy(q.q);
    b.position.copy(q.p);
    b.scale.set(1, 1, 1);
  }
  if (clip) {
    const mixer = new THREE.AnimationMixer(loaded.scene);
    const action = mixer.clipAction(loaded.animations.find((a) => a.name === clip));
    action.play();
    mixer.setTime(t);
  }
  if (hips) by.get("Hips").position.add(new THREE.Vector3(...hips));
  for (const [name, e] of Object.entries(spec)) {
    const b = by.get(name);
    const pq = b.parent?.isBone ? window.__bindQ.get(b.parent.name) : new THREE.Quaternion();
    const R = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        (e[0] * Math.PI) / 180,
        (e[1] * Math.PI) / 180,
        (e[2] * Math.PI) / 180,
        "XYZ",
      ),
    );
    b.quaternion.copy(pq.clone().invert().multiply(R).multiply(pq).multiply(rest.get(name).q));
  }
  for (const [name, s] of Object.entries(scales)) by.get(name).scale.set(...s);
  loaded.scene.updateMatrixWorld(true);
}

function cameraFor(v, aspect) {
  const cam = new THREE.PerspectiveCamera(v.fov ?? 24, aspect, 0.01, 50);
  const yaw = ((v.cam ?? 0) * Math.PI) / 180;
  const pitch = ((v.pitch ?? 6) * Math.PI) / 180;
  const t = new THREE.Vector3(...(v.target ?? [0, 0.55, 0]));
  const d = v.dist ?? 3.2;
  cam.position.set(
    t.x + d * Math.sin(yaw) * Math.cos(pitch),
    t.y + d * Math.sin(pitch),
    t.z + d * Math.cos(yaw) * Math.cos(pitch),
  );
  cam.lookAt(t);
  return cam;
}

function draw(v, width, height) {
  ensureRenderer(width, height);
  pose(v.pose ?? {}, v);
  if (v.tone) renderer.toneMapping = THREE[v.tone] ?? THREE.NoToneMapping;
  scene.environmentIntensity = v.env ?? RECIPE.environmentIntensity;
  lights.key.intensity = v.key ?? RECIPE.key.intensity;
  if (v.bg) scene.background = new THREE.Color(v.bg);
  else scene.background = new THREE.Color(RECIPE.background);
  renderer.render(scene, cameraFor(v, width / height));
  return renderer.domElement;
}

export function shot(v, width = 800, height = 800) {
  return draw(v, width, height).toDataURL("image/png");
}

export function sheet(cells, { size = 400, cols = 4 } = {}) {
  const rows = Math.ceil(cells.length / cols);
  const out = document.createElement("canvas");
  out.width = size * cols;
  out.height = size * rows;
  const g = out.getContext("2d");
  g.fillStyle = "#111";
  g.fillRect(0, 0, out.width, out.height);
  cells.forEach((cell, i) => {
    const canvas = draw(cell, size, size);
    const x = (i % cols) * size;
    const y = Math.floor(i / cols) * size;
    g.drawImage(canvas, x, y);
    g.font = "bold 14px sans-serif";
    g.fillStyle = "#c01";
    g.fillText(cell.label ?? String(i), x + 8, y + 18);
  });
  return out.toDataURL("image/png");
}

/** World positions of every vertex of the loaded model at a clip time, for the overlay check. */
export function vertexPositions(clipName, t, sample = 1) {
  const mesh = skinned();
  pose({}, { clip: clipName, t });
  const out = [];
  const v = new THREE.Vector3();
  const n = mesh.geometry.attributes.position.count;
  for (let i = 0; i < n; i += sample) {
    mesh.getVertexPosition(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    out.push(v.x, v.y, v.z);
  }
  return out;
}

export function hasMesh() {
  return Boolean(loaded);
}
