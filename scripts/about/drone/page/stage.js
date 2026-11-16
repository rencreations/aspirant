// Loads the built GLB back with GLTFLoader, as the page does, reports what is in it, and draws it:
// the check views, and the still picture for a browser without WebGL.
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { sourcePixels } from "./convert.js";

const INK = "#2a3342";
/** The camera stands this far from the drone's middle, in metres: a long lens, little shear. */
const CAMERA_DISTANCE = 3.2;
/** The outline: the same skin, back faces only, pushed this far along the normal (metres). */
const OUTLINE = 0.0035;

/** The atlas of the face, three cells by three. The offset is in cells, from the "normal" cell. */
export const FACE_CELLS = {
  normal: [0, 0],
  angry: [-1, 0],
  squint: [1, 0],
  happy: [-1, -1],
  dead: [0, -1],
  scan: [1, -1],
  ecg: [-1, -2],
  sleepy: [0, -2],
  alert: [1, -2],
};

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 20);

const rig = { root: null, bones: new Map(), rest: new Map(), meshes: [], hulls: [] };
const round = (n) => Math.round(n * 1e5) / 1e5;

function adopt(root) {
  if (rig.root) scene.remove(rig.root);
  rig.root = root;
  rig.bones.clear();
  rig.rest.clear();
  rig.meshes = [];
  rig.hulls = [];
  scene.add(root);
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isBone) {
      rig.bones.set(o.name, o);
      rig.rest.set(o.name, o.quaternion.clone());
    }
    if (o.isMesh) {
      o.frustumCulled = false;
      rig.meshes.push(o);
    }
  });
}

/** What the page relies on, read from the loaded scene. */
function describe(root) {
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
        scale: o.scale.toArray().map(round),
      });
    }
    if (o.isMesh) {
      const g = o.geometry;
      for (const m of [].concat(o.material)) {
        const group = Array.isArray(o.material)
          ? g.groups.find((x) => o.material[x.materialIndex] === m)
          : null;
        const corners = group ? group.count : g.index ? g.index.count : g.attributes.position.count;
        meshes.push({
          node: o.name,
          skinned: o.isSkinnedMesh === true,
          joints: o.skeleton ? o.skeleton.bones.map((b) => b.name) : [],
          material: m.name,
          materialType: m.type,
          // The FBX's pictures may not have decoded yet: only the built file's sizes are read.
          map: m.map
            ? { width: m.map.image?.width, height: m.map.image?.height, flipY: m.map.flipY }
            : null,
          triangles: corners / 3,
          vertices: g.attributes.position.count,
          attributes: Object.keys(g.attributes).sort(),
          morphTargets: Object.keys(g.morphAttributes).length,
        });
      }
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  return {
    bones,
    meshes,
    box: { min: box.min.toArray().map(round), max: box.max.toArray().map(round) },
  };
}

export async function loadGlb(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const t0 = performance.now();
  const gltf = await new Promise((resolve, reject) =>
    new GLTFLoader().parse(buffer, "", resolve, reject),
  );
  const parseMs = Math.round(performance.now() - t0);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      m.toneMapped = false;
      if (m.map) m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
  });
  adopt(gltf.scene);
  return { ...describe(gltf.scene), parseMs, animations: gltf.animations.length };
}

/** The same report for the FBX, to compare the rig bone by bone. */
export async function describeFbx(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  return describe(new FBXLoader().parse(buffer, ""));
}

/** The largest difference, 0 to 255, between a picture of the FBX and the one in the GLB. */
export async function pictureError(fbxUrl, materialName) {
  const source = await sourcePixels(fbxUrl, materialName);
  const mesh = rig.meshes.find((o) => [].concat(o.material).some((m) => m.name === materialName));
  if (!source || !mesh) return null;
  const built = [].concat(mesh.material).find((m) => m.name === materialName).map.image;
  const w = built.width;
  const h = built.height;
  const pixels = (image, flip) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    if (flip) {
      x.translate(0, h);
      x.scale(1, -1);
    }
    x.drawImage(image, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
  };
  const b = pixels(built, false);
  // The exporter writes the picture as three holds it, so it may be stored upside down: the
  // orientation that fits is the one that counts.
  let best = null;
  for (const flip of [false, true]) {
    const a = pixels(source.image, flip);
    let max = 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i] - b[i]);
      sum += d;
      if (d > max) max = d;
    }
    const result = {
      max,
      mean: round(sum / a.length),
      storedUpsideDown: flip,
      width: w,
      height: h,
    };
    if (!best || result.mean < best.mean) best = result;
  }
  return best;
}

/**
 * The skin with one normal per place. The model has hard edges, where a corner carries one normal
 * per face: pushed along those, the faces of the hull part and the outline opens at every edge.
 * Here every corner at one position gets the mean of the normals found there, so the hull stays
 * closed. The skin weights are untouched and the hull follows the bones as the model does.
 */
function hullGeometry(geometry) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const sums = new Map();
  const keys = [];
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)]
      .map((v) => Math.round(v * 1e5))
      .join(",");
    keys.push(key);
    const sum = sums.get(key) ?? sums.set(key, new THREE.Vector3()).get(key);
    sum.x += normal.getX(i);
    sum.y += normal.getY(i);
    sum.z += normal.getZ(i);
  }
  const smooth = new Float32Array(position.count * 3);
  keys.forEach((key, i) =>
    sums
      .get(key)
      .clone()
      .normalize()
      .toArray(smooth, i * 3),
  );
  const out = geometry.clone();
  out.setAttribute("normal", new THREE.BufferAttribute(smooth, 3));
  return out;
}

function setOutline(on) {
  if (on && rig.hulls.length === 0) {
    for (const mesh of rig.meshes) {
      const material = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
      material.toneMapped = false;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uThick = { value: OUTLINE };
        shader.vertexShader =
          "uniform float uThick;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\n transformed += normalize(objectNormal) * uThick;",
          );
      };
      const hull = new THREE.SkinnedMesh(hullGeometry(mesh.geometry), material);
      hull.bind(mesh.skeleton, mesh.bindMatrix);
      hull.frustumCulled = false;
      mesh.parent.add(hull);
      rig.hulls.push(hull);
    }
  }
  for (const hull of rig.hulls) hull.visible = on;
}

function setFace(name) {
  const [du, dv] = FACE_CELLS[name];
  for (const mesh of rig.meshes) {
    for (const m of [].concat(mesh.material)) {
      if (m.name !== "drone_face" || !m.map) continue;
      m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
      m.map.offset.set(du / 3, dv / 3);
    }
  }
}

const deg = THREE.MathUtils.degToRad;
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * A pose, in degrees. `yaw` turns the face to the right of the screen, `pitch` puts the nose down,
 * `roll` is counter-clockwise seen from the front. `spread` opens the wings outward and `raise`
 * lifts their tips: a wing is its rest rotation, then the spread about its local Z (opposite
 * signs on the two sides), then the raise about its local X (the same sign).
 */
function setPose({ yaw = 0, pitch = 0, roll = 0, spread = 0, raise = 0, fins = 0 } = {}) {
  rig.root.rotation.set(deg(pitch), deg(yaw), deg(roll), "YXZ");
  const q = new THREE.Quaternion();
  for (const [name, sign] of [
    ["wing_L", -1],
    ["wing_R", 1],
  ]) {
    const bone = rig.bones.get(name);
    bone.quaternion.copy(rig.rest.get(name));
    bone.quaternion.multiply(q.setFromAxisAngle(AXIS_Z, deg(sign * spread)));
    bone.quaternion.multiply(q.setFromAxisAngle(AXIS_X, deg(raise)));
  }
  for (const name of ["fin_L", "fin_R"]) {
    const bone = rig.bones.get(name);
    bone.quaternion.copy(rig.rest.get(name));
    bone.quaternion.multiply(q.setFromAxisAngle(AXIS_X, deg(fins)));
  }
  rig.root.updateMatrixWorld(true);
}

/**
 * Draws one picture. The camera looks at the drone's middle from `view` (a direction; the default
 * is straight in front) and the picture is `across` metres wide at the drone's depth.
 */
function draw({ width, height, across, view = [0, 0, 1], pose, face = "normal", outline = true }) {
  setPose(pose);
  setFace(face);
  setOutline(outline);
  renderer.setSize(width, height, false);
  const tall = (across * height) / width;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tall / 2 / CAMERA_DISTANCE));
  camera.aspect = width / height;
  camera.position
    .set(...view)
    .normalize()
    .multiplyScalar(CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

/** Tiles on one ground colour, each with a label, as a PNG data address. */
export function sheet(tiles, { size = 480, cols = 4, ground = "#f4f6f9", ink = "#0b2a6b" } = {}) {
  const rows = Math.ceil(tiles.length / cols);
  const out = document.createElement("canvas");
  out.width = cols * size;
  out.height = rows * size;
  const x = out.getContext("2d");
  x.fillStyle = ground;
  x.fillRect(0, 0, out.width, out.height);
  x.font = "600 15px Consolas, monospace";
  tiles.forEach((tile, i) => {
    draw({ width: size, height: size, across: 1.05, ...tile });
    const left = (i % cols) * size;
    const top = Math.floor(i / cols) * size;
    x.drawImage(canvas, left, top);
    x.fillStyle = ink;
    String(tile.label ?? "")
      .split("\n")
      .forEach((line, k) => x.fillText(line, left + 10, top + 22 + k * 19));
  });
  return out.toDataURL("image/png");
}

/** One picture at a given size on a ground colour (for comparing pictures at the hero's size). */
export function picture({ width, height, across, ground, ...tile }) {
  draw({ width, height, across, ...tile });
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const x = out.getContext("2d");
  x.fillStyle = ground ?? "#f4f6f9";
  x.fillRect(0, 0, width, height);
  x.drawImage(canvas, 0, 0);
  return out.toDataURL("image/png");
}

/**
 * The still. The drone's own origin (the point it turns about) is the exact middle of the
 * picture, so the page can lay the picture over the place the live drone would have. The frame is
 * as tight as that allows: the pose is drawn once in a wide frame, the painted pixels are found,
 * and the frame is set to the farthest of them on each axis plus a small margin.
 */
export async function still({ width, pose, quality = 0.9, margin = 0.02 }) {
  const probe = 1024;
  const wide = 1.6;
  draw({ width: probe, height: probe, across: wide, pose });
  const c = document.createElement("canvas");
  c.width = c.height = probe;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(canvas, 0, 0);
  const data = x.getImageData(0, 0, probe, probe).data;
  let reachX = 0;
  let reachY = 0;
  const box = { left: probe, right: 0, top: probe, bottom: 0 };
  for (let py = 0; py < probe; py++) {
    for (let px = 0; px < probe; px++) {
      if (data[(py * probe + px) * 4 + 3] < 8) continue;
      reachX = Math.max(reachX, Math.abs(px + 0.5 - probe / 2));
      reachY = Math.max(reachY, Math.abs(py + 0.5 - probe / 2));
      box.left = Math.min(box.left, px);
      box.right = Math.max(box.right, px + 1);
      box.top = Math.min(box.top, py);
      box.bottom = Math.max(box.bottom, py + 1);
    }
  }
  const metres = wide / probe;
  const across = 2 * reachX * metres * (1 + margin);
  const tall = 2 * reachY * metres * (1 + margin);
  const height = Math.round((width * tall) / across);

  // Drawn at twice the size and scaled down, for edges cleaner than the canvas's own smoothing.
  draw({ width: width * 2, height: height * 2, across, pose });
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const o = out.getContext("2d");
  o.imageSmoothingQuality = "high";
  o.drawImage(canvas, 0, 0, width, height);
  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/webp", quality));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return {
    base64: btoa(binary),
    width,
    height,
    // How much of the model the picture shows, so the page can size it against the live drone.
    metresAcross: round(across),
    metresTall: round((across * height) / width),
    cameraDistance: CAMERA_DISTANCE,
    // Where the paint is inside the picture, as fractions of its width and height.
    painted: {
      left: round(0.5 + ((box.left - probe / 2) * metres) / across),
      right: round(0.5 + ((box.right - probe / 2) * metres) / across),
      top: round(0.5 + ((box.top - probe / 2) * metres) / tall),
      bottom: round(0.5 + ((box.bottom - probe / 2) * metres) / tall),
    },
  };
}

/** A WebP data address over two grounds, side by side, to look for a fringe at the edges. */
export async function onGrounds(base64, grounds) {
  const blob = await (await fetch(`data:image/webp;base64,${base64}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const out = document.createElement("canvas");
  out.width = bitmap.width * grounds.length;
  out.height = bitmap.height;
  const x = out.getContext("2d");
  grounds.forEach((ground, i) => {
    x.fillStyle = ground;
    x.fillRect(i * bitmap.width, 0, bitmap.width, bitmap.height);
    x.drawImage(bitmap, i * bitmap.width, 0);
  });
  return out.toDataURL("image/png");
}
