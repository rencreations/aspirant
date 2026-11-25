// Loads the built GLB back with GLTFLoader, as the page does, reports what is in it and draws the
// check pictures. The face is drawn by the page's own module (`/build/face.js` is
// `apps/web/src/features/about/bunny/face.ts`, as the build serves it) and every pose goes
// through the recipe the README gives, hinge shifts included.
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import * as FACE from "/build/face.js";

const INK = "#2a3342";
/** The camera stands this far from the body's middle, in metres: a long lens, little shear. */
const CAMERA_DISTANCE = 6;
/** The outline: the same mesh, back faces only, pushed this far along the normal (metres). */
const OUTLINE = 0.004;

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
const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 40);

const rig = {
  root: null,
  model: null,
  meshes: [],
  hulls: [],
  bones: new Map(),
  rest: new Map(),
  uniforms: null,
  extras: {},
  source: null,
};
const round = (n) => Math.round(n * 1e5) / 1e5;
const deg = THREE.MathUtils.degToRad;
const linear = (hex) => new THREE.Color(hex).toArray();

/** The screen's material takes the page's face. */
function faceMaterial(material, screen) {
  const uniforms = FACE.makeFaceUniforms();
  FACE.setScreen(uniforms, screen);
  uniforms.uCyan.value = linear(FACE.FACE_CYAN);
  uniforms.uPink.value = linear(FACE.FACE_PINK);
  uniforms.uRed.value = linear(FACE.FACE_RED);
  uniforms.uBlue.value = linear(FACE.FACE_BLUE);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      FACE.FACE_VERTEX_HEAD +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n${FACE.FACE_VERTEX_BODY}`,
      );
    shader.fragmentShader =
      FACE.FACE_FRAGMENT_HEAD +
      shader.fragmentShader.replace("#include <map_fragment>", FACE.FACE_FRAGMENT_MAP);
  };
  material.needsUpdate = true;
  return uniforms;
}

function hullFor(mesh) {
  const material = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  material.toneMapped = false;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uThick = { value: OUTLINE };
    shader.vertexShader =
      "uniform float uThick;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "vec3 transformed = vec3( position ) + normal * uThick;",
      );
  };
  const hull = new THREE.SkinnedMesh(mesh.geometry, material);
  hull.name = `${mesh.name}_hull`;
  hull.frustumCulled = false;
  hull.morphTargetInfluences = mesh.morphTargetInfluences;
  hull.morphTargetDictionary = mesh.morphTargetDictionary;
  mesh.parent.add(hull);
  hull.bind(mesh.skeleton, mesh.bindMatrix);
  return hull;
}

function clear() {
  if (rig.root) scene.remove(rig.root);
  if (rig.source) scene.remove(rig.source);
  rig.root = null;
  rig.source = null;
  rig.model = null;
  rig.extras = {};
  rig.meshes = [];
  rig.hulls = [];
  rig.bones.clear();
  rig.rest.clear();
  rig.uniforms = null;
}

function adopt(root) {
  clear();
  rig.root = root;
  scene.add(root);
  root.updateMatrixWorld(true);
  rig.model = root.getObjectByName("bunny");
  rig.extras = rig.model?.userData ?? {};
  root.traverse((o) => {
    if (o.isBone) {
      rig.bones.set(o.name, o);
      rig.rest.set(o.name, { position: o.position.clone(), quaternion: o.quaternion.clone() });
    }
    if (o.isSkinnedMesh) {
      o.frustumCulled = false;
      o.material.toneMapped = false;
      if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      rig.meshes.push(o);
    }
  });
  for (const mesh of rig.meshes) {
    if (mesh.material.name === "bunny_face" && rig.extras.screen) {
      rig.uniforms = faceMaterial(mesh.material, rig.extras.screen);
    }
  }
  rig.hulls = rig.meshes.filter((m) => m.material.name === "bunny_body").map(hullFor);
}

/** What the page relies on, read from the loaded scene. */
function describe(root) {
  const nodes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    // The outline is the check pictures' own, not the file's.
    if (o.name.endsWith("_hull")) return;
    const node = {
      name: o.name,
      type: o.type,
      parent: o.parent ? o.parent.name : null,
      position: o.position.toArray().map(round),
      quaternion: o.quaternion.toArray().map(round),
      scale: o.scale.toArray().map(round),
    };
    if (o.isMesh) {
      const g = o.geometry;
      // The rest box (three's own box also takes in every target at full weight).
      const rest = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
      node.mesh = {
        material: o.material.name,
        materialType: o.material.type,
        side: o.material.side,
        map: o.material.map
          ? {
              width: o.material.map.image?.width,
              height: o.material.map.image?.height,
              flipY: o.material.map.flipY,
              colorSpace: o.material.map.colorSpace,
            }
          : null,
        triangles: g.index.count / 3,
        vertices: g.attributes.position.count,
        attributes: Object.fromEntries(
          Object.entries(g.attributes).map(([k, a]) => [
            k,
            `${a.array.constructor.name}${a.normalized ? " normalized" : ""}`,
          ]),
        ),
        targets: Object.keys(o.morphTargetDictionary ?? {}).sort(
          (a, b) => o.morphTargetDictionary[a] - o.morphTargetDictionary[b],
        ),
        // How far each target moves a corner at most, read through three (metres).
        reach: (g.morphAttributes.position ?? []).map((a) => {
          let max = 0;
          for (let i = 0; i < a.count; i++)
            max = Math.max(max, Math.hypot(a.getX(i), a.getY(i), a.getZ(i)));
          return round(max);
        }),
        skinned: o.isSkinnedMesh === true,
        bones: o.skeleton?.bones.map((b) => b.name) ?? [],
        box: { min: rest.min.toArray().map(round), max: rest.max.toArray().map(round) },
      };
    }
    nodes.push(node);
  });
  const box = new THREE.Box3();
  for (const mesh of rig.meshes) {
    box.union(new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position));
  }
  return {
    nodes,
    box: { min: box.min.toArray().map(round), max: box.max.toArray().map(round) },
    extras: rig.extras,
  };
}

export async function loadGlb(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const t0 = performance.now();
  const gltf = await new Promise((resolve, reject) =>
    new GLTFLoader().parse(buffer, "", resolve, reject),
  );
  const parseMs = Math.round(performance.now() - t0);
  adopt(gltf.scene);
  return {
    ...describe(gltf.scene),
    parseMs,
    animations: gltf.animations.length,
    faces: Object.keys(FACE.FACES),
  };
}

/**
 * The source as it is, for the "before" pictures: the picture only, lit by nothing. `which` keeps
 * the drone and its painted face (moved into the drone's frame by `origin`) or the whole file.
 */
export async function loadFbx(url, { which = "drone", origin = [0, 0, 0] } = {}) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const root = new FBXLoader().parse(buffer, "");
  const waits = [];
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (which === "drone" && !/jiqi/.test(o.name)) {
      drop.push(o);
      return;
    }
    o.frustumCulled = false;
    const map = [].concat(o.material)[0].map;
    o.material = new THREE.MeshBasicMaterial({
      map: map ?? null,
      color: map ? 0xffffff : 0x888888,
    });
    o.material.toneMapped = false;
    if (map) {
      waits.push(
        new Promise((resolve) => {
          const tick = () =>
            map.image?.complete && map.image.naturalWidth ? resolve() : setTimeout(tick, 5);
          tick();
        }),
      );
    }
  });
  for (const o of drop) o.parent.remove(o);
  await Promise.all(waits);
  clear();
  const holder = new THREE.Group();
  holder.position.set(-origin[0], -origin[1], -origin[2]);
  holder.add(root);
  rig.source = holder;
  scene.add(holder);
}

const q = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/**
 * A pose. `yaw`, `pitch`, `roll` turn the whole bunny (degrees: yaw turns the face to the
 * viewer's right, pitch puts it down, roll is counter-clockwise seen from the front). `bones`
 * maps a bone to [x, y, z] degrees about its own axes, applied as rest * Rz * Rx * Ry. `targets`
 * maps a target to its weight. `tilt` (default on) also turns the ears and the feet with the
 * shell under the body targets; `shift` (default on) moves their bones with their hinges.
 */
export function setPose(pose = {}) {
  if (!rig.model) return;
  rig.model.rotation.set(deg(pose.pitch ?? 0), deg(pose.yaw ?? 0), deg(pose.roll ?? 0), "YXZ");
  for (const [name, bone] of rig.bones) {
    const rest = rig.rest.get(name);
    bone.position.copy(rest.position);
    bone.quaternion.copy(rest.quaternion);
    const a = pose.bones?.[name];
    if (!a) continue;
    bone.quaternion.multiply(q.setFromAxisAngle(Z, deg(a[2] ?? 0)));
    bone.quaternion.multiply(q.setFromAxisAngle(X, deg(a[0] ?? 0)));
    bone.quaternion.multiply(q.setFromAxisAngle(Y, deg(a[1] ?? 0)));
  }
  const weights = pose.targets ?? {};
  for (const mesh of rig.meshes) {
    mesh.morphTargetInfluences.fill(0);
    for (const [name, w] of Object.entries(weights)) {
      const i = mesh.morphTargetDictionary[name];
      if (i === undefined) throw new Error(`no target ${name}`);
      mesh.morphTargetInfluences[i] = w;
    }
  }
  // The recipe for the bones that hang on the body (README, "Body targets and the bones").
  const hinges = rig.extras.hinges ?? {};
  const shift = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const part = new THREE.Quaternion();
  const away = new THREE.Quaternion();
  for (const name of ["ear_L_1", "ear_R_1", "foot_L", "foot_R"]) {
    const bone = rig.bones.get(name);
    const rest = rig.rest.get(name);
    shift.set(0, 0, 0);
    turn.identity();
    for (const [target, w] of Object.entries(weights)) {
      const h = hinges[target]?.[name];
      if (!h || w === 0) continue;
      shift.addScaledVector(new THREE.Vector3(...h.shift), w);
      part.identity().slerp(new THREE.Quaternion(...h.turn), w);
      turn.premultiply(part);
    }
    if (pose.tilt !== false) bone.quaternion.premultiply(turn);
    if (pose.shift === false) continue;
    // The bone turns about its hinge: move it so the hinge lands where the shell took it.
    away.copy(bone.quaternion).multiply(rest.quaternion.clone().invert());
    bone.position.add(shift).sub(shift.clone().applyQuaternion(away));
    // The ear's upper bones turn about joints the target has moved with the ear: the same, with
    // the shift seen from the first bone's rest frame.
    if (!name.startsWith("ear")) continue;
    const own = shift.clone().applyQuaternion(rest.quaternion.clone().invert());
    for (const upper of [name.replace("_1", "_2"), name.replace("_1", "_3")]) {
      const b = rig.bones.get(upper);
      const r = rig.rest.get(upper);
      away.copy(b.quaternion).multiply(r.quaternion.clone().invert());
      b.position.copy(r.position).add(own).sub(own.clone().applyQuaternion(away));
    }
  }
}

const shape = { ...FACE.FACES.neutral };
function setFace(face = "neutral", live = {}) {
  if (!rig.uniforms) return;
  if (typeof face === "string") FACE.copyFace(shape, FACE.FACES[face]);
  else if (face.from) FACE.blendFace(shape, FACE.FACES[face.from], FACE.FACES[face.to], face.t);
  else FACE.copyFace(shape, { ...FACE.FACES.neutral, ...face });
  FACE.packFace(rig.uniforms, shape, { ...FACE.LIVE_REST, ...live });
}

function setOutline(on) {
  for (const hull of rig.hulls) hull.visible = on;
}

/**
 * Draws one picture. The camera looks at `target` (the body's middle by default) from `view` and
 * the picture is `across` metres wide there.
 */
function draw({
  width,
  height,
  across,
  view = [0, 0, 1],
  target = [0, 0, 0],
  pose,
  face,
  live,
  outline = true,
}) {
  setPose(pose);
  setFace(face, live);
  setOutline(outline);
  renderer.setSize(width, height, false);
  const tall = (across * height) / width;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tall / 2 / CAMERA_DISTANCE));
  camera.aspect = width / height;
  camera.position
    .set(...view)
    .normalize()
    .multiplyScalar(CAMERA_DISTANCE)
    .add(new THREE.Vector3(...target));
  camera.up.set(0, 1, 0);
  if (Math.abs(view[1]) > 0.99 * Math.hypot(...view)) camera.up.set(0, 0, -Math.sign(view[1]));
  camera.lookAt(...target);
  camera.updateProjectionMatrix();
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
}

/** Tiles on one ground colour, each with a label, as a PNG data address. */
export function sheet(
  tiles,
  { size = 420, cols = 4, ground = "#f4f6f9", ink = "#0b2a6b", across = 0.62, labels = true } = {},
) {
  const rows = Math.ceil(tiles.length / cols);
  const out = document.createElement("canvas");
  out.width = cols * size;
  out.height = rows * size;
  const x = out.getContext("2d");
  x.fillStyle = ground;
  x.fillRect(0, 0, out.width, out.height);
  x.font = "600 13px Consolas, monospace";
  tiles.forEach((tile, i) => {
    draw({ width: size, height: size, across, ...tile });
    const left = (i % cols) * size;
    const top = Math.floor(i / cols) * size;
    x.drawImage(canvas, left, top);
    if (!labels) return;
    x.fillStyle = ink;
    String(tile.label ?? "")
      .split("\n")
      .forEach((line, k) => x.fillText(line, left + 8, top + 18 + k * 16));
  });
  return out.toDataURL("image/png");
}

/** Views kept in the page by name, for comparing the source with the build. */
const captured = new Map();

/** Draws one view and keeps its pixels under `key`. */
export function capture(key, tile, size = 640) {
  draw({ width: size, height: size, across: 0.62, ...tile });
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(canvas, 0, 0);
  captured.set(key, { canvas: c, data: x.getImageData(0, 0, size, size).data, size });
}

/** How two kept views differ: outline, colour, and (for faces) the lit cyan. */
export function compare(keyA, keyB) {
  const a = captured.get(keyA).data;
  const b = captured.get(keyB).data;
  let covered = 0;
  let onlyOne = 0;
  let differ = 0;
  let sum = 0;
  let litBoth = 0;
  let litEither = 0;
  const lit = (d, k) => d[k + 3] > 128 && d[k + 1] > 150 && d[k + 2] > 150 && d[k] < 140;
  for (let k = 0; k < a.length; k += 4) {
    const la = lit(a, k);
    const lb = lit(b, k);
    if (la && lb) litBoth++;
    if (la || lb) litEither++;
    const inA = a[k + 3] > 128;
    const inB = b[k + 3] > 128;
    if (inA !== inB) onlyOne++;
    if (!inA || !inB) continue;
    covered++;
    const d =
      (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2])) / 3;
    sum += d;
    if (d > 40) differ++;
  }
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return {
    silhouetteMismatch: r4(onlyOne / Math.max(1, covered)),
    meanDifference: Math.round((sum / Math.max(1, covered)) * 100) / 100,
    pixelsOver40: r4(differ / Math.max(1, covered)),
    litOverlap: r4(litBoth / Math.max(1, litEither)),
  };
}

/** Kept views side by side, each with a label, as a PNG data address. */
export function composite(cells, { tile = 360, cols = 4 } = {}) {
  const rows = Math.ceil(cells.length / cols);
  const out = document.createElement("canvas");
  out.width = tile * cols;
  out.height = tile * rows;
  const x = out.getContext("2d");
  x.fillStyle = "#f4f6f9";
  x.fillRect(0, 0, out.width, out.height);
  x.font = "600 13px Consolas, monospace";
  cells.forEach(([key, label], i) => {
    const left = (i % cols) * tile;
    const top = Math.floor(i / cols) * tile;
    x.drawImage(captured.get(key).canvas, left, top, tile, tile);
    x.fillStyle = "#0b2a6b";
    x.fillText(label, left + 8, top + 18);
  });
  return out.toDataURL("image/png");
}

/** Two kept faces and where their lit cyan differs (red: the first only, blue: the second only). */
export function faceDiff(keyA, keyB, labels) {
  const a = captured.get(keyA);
  const b = captured.get(keyB);
  const n = a.size;
  const out = document.createElement("canvas");
  out.width = n * 3;
  out.height = n + 30;
  const x = out.getContext("2d");
  x.fillStyle = "#f4f6f9";
  x.fillRect(0, 0, out.width, out.height);
  x.drawImage(a.canvas, 0, 30);
  x.drawImage(b.canvas, n, 30);
  const d = x.createImageData(n, n);
  const lit = (v, k) => v[k + 1] > 150 && v[k + 2] > 150 && v[k] < 140;
  for (let k = 0; k < a.data.length; k += 4) {
    const la = lit(a.data, k);
    const lb = lit(b.data, k);
    const c = la && lb ? [40, 40, 40] : la ? [255, 60, 60] : lb ? [40, 170, 255] : [235, 235, 235];
    d.data.set([...c, 255], k);
  }
  x.putImageData(d, n * 2, 30);
  x.fillStyle = "#0b2a6b";
  x.font = "600 16px Consolas, monospace";
  labels.forEach((label, i) => x.fillText(label, i * n + 10, 20));
  return out.toDataURL("image/png");
}

/** Where the skinned meshes put a point of the body frame (bind pose), for the joint checks. */
export function skinnedPlace(boneName, point) {
  scene.updateMatrixWorld(true);
  const bone = rig.bones.get(boneName);
  const mesh = rig.meshes[0];
  const index = mesh.skeleton.bones.indexOf(bone);
  const m = new THREE.Matrix4().multiplyMatrices(
    bone.matrixWorld,
    mesh.skeleton.boneInverses[index],
  );
  return new THREE.Vector3(...point).applyMatrix4(m).toArray();
}

/** Where a bone stands in the bind pose (the body's frame), from the skin. */
export function bindPlace(boneName) {
  const mesh = rig.meshes[0];
  const index = mesh.skeleton.bones.findIndex((b) => b.name === boneName);
  const m = mesh.skeleton.boneInverses[index].clone().invert();
  return new THREE.Vector3().setFromMatrixPosition(m).toArray();
}

/**
 * The vertex of the body mesh that hangs wholly on `boneName` and lies farthest from `from` (a
 * place of the body frame): the tip of an ear or of a foot.
 */
export function farVertex(boneName, from) {
  const mesh = rig.meshes.find((m) => m.material.name === "bunny_body");
  const joint = mesh.skeleton.bones.findIndex((b) => b.name === boneName);
  const P = mesh.geometry.attributes.position;
  const J = mesh.geometry.attributes.skinIndex;
  const W = mesh.geometry.attributes.skinWeight;
  const f = new THREE.Vector3(...from);
  const v = new THREE.Vector3();
  let best = -1;
  let far = -1;
  for (let i = 0; i < P.count; i++) {
    if (J.getX(i) !== joint || W.getX(i) < 0.999) continue;
    const d = v.fromBufferAttribute(P, i).distanceTo(f);
    if (d > far) {
      far = d;
      best = i;
    }
  }
  return best;
}

/** Where the targets and the bones put one vertex of the body mesh, read through three. */
export function vertexAt(vertex) {
  scene.updateMatrixWorld(true);
  const mesh = rig.meshes.find((m) => m.material.name === "bunny_body");
  const v = new THREE.Vector3();
  mesh.getVertexPosition(vertex, v);
  mesh.applyBoneTransform(vertex, v);
  return v.applyMatrix4(mesh.matrixWorld).toArray();
}
