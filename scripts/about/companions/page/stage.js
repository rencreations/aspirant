// Loads the built GLB back with GLTFLoader, as the page does, reports what is in it and draws the
// check pictures: the views, every part turned about its pivot, and the faces. The face is drawn
// by the page's own shader (`/build/face.js` is the page's `companions/face.ts`, as the build
// serves it).
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import * as FACE from "/build/face.js";

const INK = "#2a3342";
/** The camera stands this far from the ball's middle, in metres: a long lens, little shear. */
const CAMERA_DISTANCE = 3.2;
/** The outline: the same parts, back faces only, pushed this far along the normal (metres). */
const OUTLINE = 0.0016;

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

const rig = {
  root: null,
  parts: new Map(),
  rest: new Map(),
  hulls: [],
  uniforms: null,
  extras: {},
};
const round = (n) => Math.round(n * 1e5) / 1e5;
const deg = THREE.MathUtils.degToRad;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

const linear = (hex) => new THREE.Color(hex).toArray();

/** The screen's material takes the page's face. */
function faceMaterial(material, screen) {
  const uniforms = FACE.makeFaceUniforms();
  uniforms.uScreen.value = [screen.y, 1 / screen.halfWidth];
  uniforms.uGold.value = linear(FACE.FACE_GOLD);
  uniforms.uRed.value = linear(FACE.FACE_RED);
  uniforms.uPink.value = linear(FACE.FACE_PINK);
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

function adopt(root) {
  if (rig.root) scene.remove(rig.root);
  rig.root = root;
  rig.parts.clear();
  rig.rest.clear();
  rig.hulls = [];
  rig.uniforms = null;
  scene.add(root);
  root.updateMatrixWorld(true);
  const model = root.getObjectByName("companion");
  rig.extras = model?.userData ?? {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    rig.parts.set(o.name, o);
    rig.rest.set(o.name, { position: o.position.clone(), quaternion: o.quaternion.clone() });
    o.material.toneMapped = false;
    if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
  const face = rig.parts.get("face");
  if (face && rig.extras.screen) rig.uniforms = faceMaterial(face.material, rig.extras.screen);
}

/** What the page relies on, read from the loaded scene. */
function describe(root) {
  const nodes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
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
      g.computeBoundingBox();
      node.mesh = {
        material: o.material.name,
        materialType: o.material.type,
        map: o.material.map
          ? { width: o.material.map.image?.width, height: o.material.map.image?.height }
          : null,
        triangles: g.index.count / 3,
        vertices: g.attributes.position.count,
        attributes: Object.keys(g.attributes).sort(),
        morphTargets: Object.keys(g.morphAttributes).length,
        skinned: o.isSkinnedMesh === true,
        box: {
          min: g.boundingBox.min.toArray().map(round),
          max: g.boundingBox.max.toArray().map(round),
        },
      };
    }
    nodes.push(node);
  });
  const box = new THREE.Box3().setFromObject(root);
  return {
    nodes,
    box: { min: box.min.toArray().map(round), max: box.max.toArray().map(round) },
    extras: root.getObjectByName("companion")?.userData ?? null,
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

/** The source as it is, for the "before" pictures: lit by nothing, the picture only. */
export async function loadFbx(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const root = new FBXLoader().parse(buffer, "");
  const waits = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const map = [].concat(o.material)[0].map;
    o.material = new THREE.MeshBasicMaterial({ map });
    o.material.toneMapped = false;
    waits.push(
      new Promise((resolve) => {
        const tick = () =>
          map.image?.complete && map.image.naturalWidth ? resolve() : setTimeout(tick, 5);
        tick();
      }),
    );
  });
  await Promise.all(waits);
  if (rig.root) scene.remove(rig.root);
  rig.root = root;
  rig.parts.clear();
  rig.hulls = [];
  rig.uniforms = null;
  scene.add(root);
}

function setOutline(on) {
  if (on && rig.hulls.length === 0) {
    for (const mesh of rig.parts.values()) {
      if (mesh.name === "face") continue;
      const material = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
      material.toneMapped = false;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uThick = { value: OUTLINE };
        shader.vertexShader =
          "uniform float uThick;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            "vec3 transformed = position + normal * uThick;",
          );
      };
      const hull = new THREE.Mesh(mesh.geometry, material);
      hull.name = `${mesh.name}_hull`;
      mesh.add(hull);
      rig.hulls.push(hull);
    }
  }
  for (const hull of rig.hulls) hull.visible = on;
}

const q = new THREE.Quaternion();

/**
 * A pose, in degrees. The whole drone: `yaw` turns the face to the right of the screen, `pitch`
 * puts it down, `roll` is counter-clockwise seen from the front. `body` turns the ball alone.
 * An ear: `splay` leans it outward, `fold` tips it forward, `twist` turns its panel outward. A
 * glove: `at` is its place in radii of the ball from the ball's middle (null: its rest), `turn`
 * is [x, y, z] about its own axes.
 */
function setPose(pose = {}) {
  if (rig.parts.size === 0) return;
  const model = rig.root.getObjectByName("companion");
  model.rotation.set(deg(pose.pitch ?? 0), deg(pose.yaw ?? 0), deg(pose.roll ?? 0), "YXZ");
  const body = rig.parts.get("body");
  const b = pose.body ?? [0, 0, 0];
  body.rotation.set(deg(b[0]), deg(b[1]), deg(b[2]), "YXZ");
  for (const [name, side] of [
    ["ear_L", -1],
    ["ear_R", 1],
  ]) {
    const ear = rig.parts.get(name);
    const p = pose[name] ?? {};
    ear.quaternion.copy(rig.rest.get(name).quaternion);
    ear.quaternion.multiply(q.setFromAxisAngle(Z, deg(side * (p.splay ?? 0))));
    ear.quaternion.multiply(q.setFromAxisAngle(X, deg(p.fold ?? 0)));
    ear.quaternion.multiply(q.setFromAxisAngle(Y, deg(side * (p.twist ?? 0))));
  }
  const r = rig.extras.radius ?? 0.075;
  for (const name of ["glove_L", "glove_R"]) {
    const glove = rig.parts.get(name);
    const p = pose[name] ?? {};
    if (p.at) glove.position.set(p.at[0] * r, p.at[1] * r, p.at[2] * r);
    else glove.position.copy(rig.rest.get(name).position);
    const t = p.turn ?? [0, 0, 0];
    glove.rotation.set(deg(t[0]), deg(t[1]), deg(t[2]), "YXZ");
    glove.scale.setScalar(p.scale ?? 1);
  }
}

const shape = { ...FACE.FACES.soft };
function setFace(face = "soft", live = {}) {
  if (!rig.uniforms) return;
  if (typeof face === "string") FACE.copyFace(shape, FACE.FACES[face]);
  else if (face.from) FACE.blendFace(shape, FACE.FACES[face.from], FACE.FACES[face.to], face.t);
  else FACE.copyFace(shape, { ...FACE.FACES.soft, ...face });
  FACE.packFace(rig.uniforms, shape, {
    blinkL: 0,
    blinkR: 0,
    lookX: 0,
    lookY: 0,
    on: 1,
    spin: 0,
    ...live,
  });
}

/**
 * Draws one picture. The camera looks at `target` (the ball's middle by default) from `view` and
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
  if (rig.parts.size > 0) setOutline(outline);
  renderer.setSize(width, height, false);
  const tall = (across * height) / width;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tall / 2 / CAMERA_DISTANCE));
  camera.aspect = width / height;
  camera.position
    .set(...view)
    .normalize()
    .multiplyScalar(CAMERA_DISTANCE)
    .add(new THREE.Vector3(...target));
  camera.lookAt(...target);
  camera.updateProjectionMatrix();
  rig.root.updateMatrixWorld(true);
  renderer.render(scene, camera);
}

/** Tiles on one ground colour, each with a label, as a PNG data address. */
export function sheet(
  tiles,
  { size = 420, cols = 4, ground = "#f4f6f9", ink = "#0b2a6b", across = 0.46 } = {},
) {
  const rows = Math.ceil(tiles.length / cols);
  const out = document.createElement("canvas");
  out.width = cols * size;
  out.height = rows * size;
  const x = out.getContext("2d");
  x.fillStyle = ground;
  x.fillRect(0, 0, out.width, out.height);
  x.font = "600 14px Consolas, monospace";
  tiles.forEach((tile, i) => {
    draw({ width: size, height: size, across, ...tile });
    const left = (i % cols) * size;
    const top = Math.floor(i / cols) * size;
    x.drawImage(canvas, left, top);
    x.fillStyle = ink;
    String(tile.label ?? "")
      .split("\n")
      .forEach((line, k) => x.fillText(line, left + 10, top + 20 + k * 17));
  });
  return out.toDataURL("image/png");
}
