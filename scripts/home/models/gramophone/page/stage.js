// What the build does with the finished file: loads it back with a plain GLTFLoader (no decoder, no
// plugin: the page of the site loads it the same way), describes it, tests the pivots on the
// loaded copy and draws the check pictures.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** The lighting recipe the check pictures use and the page should use. See the README. */
export const RECIPE = {
  environment: "RoomEnvironment through PMREMGenerator.fromScene(env, 0.04)",
  environmentIntensity: 1.0,
  toneMapping: "ACESFilmicToneMapping",
  exposure: 1.0,
  outputColorSpace: "SRGBColorSpace",
  key: { color: 0xfff0d8, intensity: 2.6, position: [-0.9, 1.6, 1.4] },
  rim: { color: 0xa8c4ff, intensity: 0.9, position: [1.2, 0.6, -1.4] },
  fill: { sky: 0xffffff, ground: 0x4a3a30, intensity: 0.25 },
  background: "#2b2c2f",
};

let renderer = null;
let model = null;
let scene = null;
let key = null;
let rim = null;
let tone = THREE.ACESFilmicToneMapping;

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
  renderer.toneMapping = tone;
  renderer.toneMappingExposure = RECIPE.exposure;
  renderer.setSize(width, height, false);
}

function makeScene(glb) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(RECIPE.background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = RECIPE.environmentIntensity;
  key = new THREE.DirectionalLight(RECIPE.key.color, RECIPE.key.intensity);
  key.position.set(...RECIPE.key.position);
  rim = new THREE.DirectionalLight(RECIPE.rim.color, RECIPE.rim.intensity);
  rim.position.set(...RECIPE.rim.position);
  scene.add(key, rim);
  scene.add(new THREE.HemisphereLight(RECIPE.fill.sky, RECIPE.fill.ground, RECIPE.fill.intensity));
  scene.add(glb);
}

function byName(name) {
  let found = null;
  model.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
}

const LIFT_AXIS = new THREE.Vector3(0.38, 0, 0.93).normalize();

/** Poses the loaded model: yaw of the whole (degrees), crank, platter, soundbox lift (degrees). */
export function pose({ yaw = 0, crank = 0, platter = 0, lift = 0 } = {}) {
  model.rotation.y = (yaw * Math.PI) / 180;
  byName("crank").rotation.z = (crank * Math.PI) / 180;
  byName("platter").rotation.y = (platter * Math.PI) / 180;
  byName("soundbox").quaternion.setFromAxisAngle(LIFT_AXIS, (lift * Math.PI) / 180);
  model.updateMatrixWorld(true);
}

function describe(glb) {
  const box = new THREE.Box3().setFromObject(glb.scene);
  const nodes = [];
  glb.scene.traverse((o) => {
    nodes.push({
      name: o.name,
      type: o.type,
      parent: o.parent?.name ?? null,
      world: o
        .getWorldPosition(new THREE.Vector3())
        .toArray()
        .map((v) => Math.round(v * 1e5) / 1e5),
      position: o.position.toArray().map((v) => Math.round(v * 1e5) / 1e5),
      children: o.children.map((c) => c.name),
    });
  });
  const meshes = [];
  glb.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const m = o.material;
    meshes.push({
      name: o.name,
      triangles: o.geometry.index.count / 3,
      vertices: o.geometry.attributes.position.count,
      material: m.type,
      materialName: m.name,
      maps: ["map", "normalMap", "metalnessMap", "roughnessMap"].filter((k) => m[k]),
      mapSize: m.map ? [m.map.image.width, m.map.image.height] : null,
      normalSize: m.normalMap ? [m.normalMap.image.width, m.normalMap.image.height] : null,
      ormSize: m.metalnessMap ? [m.metalnessMap.image.width, m.metalnessMap.image.height] : null,
    });
  });
  return { box: { min: box.min.toArray(), max: box.max.toArray() }, nodes, meshes };
}

export async function loadGlb(url) {
  const started = performance.now();
  const glb = await new GLTFLoader().loadAsync(url);
  model = glb.scene;
  ensureRenderer(800, 800);
  makeScene(model);
  const out = describe(glb);
  out.parseMs = Math.round(performance.now() - started);
  return out;
}

/** The middle of a part's own box, in the loaded model's frame. */
function partCentre(name) {
  const box = new THREE.Box3().setFromObject(byName(name));
  return box.getCenter(new THREE.Vector3());
}

/** Tests on the loaded copy: the pivots really turn the parts about their axes. */
export function pivotTests() {
  const out = {};
  pose({});
  const at = (name) => byName(name).getWorldPosition(new THREE.Vector3());
  const handle = (name) => {
    // The crank's handle is the far end of the crank mesh from the hub: its box's farthest corner.
    const box = new THREE.Box3().setFromObject(byName(name));
    return box.getCenter(new THREE.Vector3());
  };
  const crankPivot = at("crank");
  const radii = [];
  for (const a of [0, 90, 180, 270]) {
    pose({ crank: a });
    const c = handle("crank");
    // The centre of the whole crank's box moves on a circle about the pivot (in the XY plane).
    radii.push(Math.hypot(c.x - crankPivot.x, c.y - crankPivot.y));
  }
  out.crankRadii = radii.map((v) => Math.round(v * 1e5) / 1e5);
  out.crankConstant = Math.max(...radii) - Math.min(...radii) < 0.02;
  pose({});
  {
    const mesh = byName("platter_mesh");
    const p = mesh.geometry.attributes.position;
    let inner = -Infinity;
    let rim = -Infinity;
    let radius = 0;
    const w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      w.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      const r = Math.hypot(w.x, w.z);
      radius = Math.max(radius, r);
      if (r < 0.1) inner = Math.max(inner, w.y);
      if (r > 0.135) rim = Math.max(rim, w.y);
    }
    out.platter = { innerTopY: inner, rimTopY: rim, radius };
  }
  const platterBefore = partCentre("platter");
  pose({ platter: 137 });
  const platterAfter = partCentre("platter");
  out.platterMoves = platterBefore.distanceTo(platterAfter);
  pose({});
  // The needle's tip: the lowest vertex of the soundbox at rest, followed through the lift.
  const mesh = byName("soundbox_mesh");
  const position = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  let tipIndex = 0;
  let lowest = Infinity;
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (v.y < lowest) {
      lowest = v.y;
      tipIndex = i;
    }
  }
  const tipAt = (degrees) => {
    pose({ lift: degrees });
    return v.fromBufferAttribute(position, tipIndex).applyMatrix4(mesh.matrixWorld).toArray();
  };
  out.needleTip = {};
  for (const a of [-60, -45, -35, -20, 0, 20, 35, 45, 60]) {
    out.needleTip[a] = tipAt(a).map((x) => Math.round(x * 1e4) / 1e4);
  }
  const tip = byName("anchor_needle_tip");
  // The anchors travel with their parts: the handle's point on a circle about the crank's pivot, the
  // needle's point on the tip's trace at every lift, the record's seat in place when the platter turns.
  const handleAnchor = byName("anchor_crank_handle");
  const worldOf = (o) => o.getWorldPosition(new THREE.Vector3());
  out.handleRadii = [];
  for (const a of [0, 90, 180, 270]) {
    pose({ crank: a });
    const w = worldOf(handleAnchor);
    out.handleRadii.push(
      Math.round(Math.hypot(w.x - crankPivot.x, w.y - crankPivot.y) * 1e5) / 1e5,
    );
  }
  out.handleAt90 = (() => {
    pose({ crank: 90 });
    return worldOf(handleAnchor)
      .toArray()
      .map((v) => Math.round(v * 1e4) / 1e4);
  })();
  out.needleAnchorError = {};
  for (const a of [0, 20, 35, 45, 60]) {
    pose({ lift: a });
    const w = worldOf(tip);
    const t = out.needleTip[a];
    out.needleAnchorError[a] =
      Math.round(Math.hypot(w.x - t[0], w.y - t[1], w.z - t[2]) * 1e4) / 1e4;
  }
  pose({ platter: 137 });
  const seat = worldOf(byName("anchor_record_seat"));
  out.recordSeatAfterTurn = seat.toArray().map((v) => Math.round(v * 1e5) / 1e5);
  out.needleAnchor = tip.position.toArray();
  pose({});
  return out;
}

export function setTone(name) {
  tone = THREE[name] ?? THREE.NoToneMapping;
}

/** Orbit camera: `yaw` and `pitch` in degrees about the target, `dist` in metres. */
function camera(v, aspect) {
  const cam = new THREE.PerspectiveCamera(v.fov ?? 26, aspect, 0.02, 20);
  const yaw = ((v.cam ?? 0) * Math.PI) / 180;
  const pitch = ((v.pitch ?? 18) * Math.PI) / 180;
  const t = new THREE.Vector3(...(v.target ?? [0, 0.27, 0]));
  const d = v.dist ?? 2.1;
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
  pose(v);
  if (v.tone) tone = THREE[v.tone] ?? THREE.NoToneMapping;
  renderer.toneMapping = tone;
  scene.environmentIntensity = v.env ?? RECIPE.environmentIntensity;
  key.intensity = v.key ?? RECIPE.key.intensity;
  key.position.set(...(v.keyPos ?? RECIPE.key.position));
  rim.intensity = v.rim ?? RECIPE.rim.intensity;
  if (v.flipG !== undefined) {
    model.traverse((o) => {
      if (o.isMesh) {
        o.material.normalScale.set(1, v.flipG ? -1 : 1);
        o.material.needsUpdate = true;
      }
    });
  }
  renderer.render(scene, camera(v, width / height));
  return renderer.domElement;
}

/** One picture at any size, as a PNG data address. */
export function shot(v, width = 1440, height = 900) {
  const canvas = draw(v, width, height);
  return canvas.toDataURL("image/png");
}

/** Cells in a grid with labels. */
export function sheet(cells, { size = 480, cols = 4 } = {}) {
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
    g.font = "bold 15px sans-serif";
    g.fillStyle = "#ffe14a";
    g.fillText(cell.label ?? String(i), x + 8, y + 20);
  });
  return out.toDataURL("image/png");
}
