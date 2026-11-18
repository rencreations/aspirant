// Draws the doll's face expressions on the real doll.glb with the shader of face.glsl, to look at
// (and to prove: seams, ghosts, small size). This is also the reference for how a page wires the chunk
// in: see `patch` below. Run it with face/preview.cjs.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

let renderer;
let scene;
let model;
let body;
let presets;
let frame;
const uniforms = {
  uFaceF: { value: new Float32Array(56) },
  uFaceFrame: { value: new THREE.Vector4() },
  uIrisL: { value: new THREE.Color(0xd9262f) },
  uIrisR: { value: new THREE.Color(0x5cbcf2) },
  uInk: { value: new THREE.Color(0x1d0f1d) },
};
const lights = {};

/** `// @section NAME` lines split the shader source into the four strings the page needs. */
function sections(text) {
  const out = {};
  let name = null;
  for (const line of text.split("\n")) {
    const m = /^\/\/ @section (\S+)/.exec(line);
    if (m) {
      name = m[1];
      out[name] = "";
    } else if (name) out[name] += `${line}\n`;
  }
  return out;
}

function patch(material, glsl) {
  const s = sections(glsl);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${s["vertex-head"]}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${s["vertex-body"]}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${s["fragment-head"]}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${s["fragment-map"]}`);
  };
  material.customProgramCacheKey = () => "doll-face";
  material.needsUpdate = true;
}

export async function open(glbUrl, glslUrl, presetsUrl) {
  const glsl = await (await fetch(glslUrl)).text();
  presets = await (await fetch(presetsUrl)).json();
  frame = presets.frame;
  const glb = await new GLTFLoader().loadAsync(glbUrl);
  model = glb.scene;
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#c9ced6");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  lights.key = new THREE.DirectionalLight(0xfff4e6, 1.0);
  lights.key.position.set(-1.2, 2.2, 2.4);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
  fill.position.set(2, 0.8, 1);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0.5, 1.5, -2.5);
  scene.add(lights.key, fill, rim, new THREE.HemisphereLight(0xffffff, 0xb9a9a9, 0.25), model);
  model.traverse((o) => {
    if (o.isSkinnedMesh) body = o;
  });
  if (!body.geometry.attributes._face) throw new Error("the loader lost the _face attribute");
  patch(body.material, glsl);
  const [a, b] = [frame.eyeLeftRed, frame.eyeRightBlue];
  uniforms.uFaceFrame.value.set(
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    0.1,
    Math.atan2(b[1] - a[1], b[0] - a[0]),
  );
  return { faceVertices: body.geometry.attributes._face.array.reduce((s, v) => s + v, 0) };
}

/** Fills the uniform array from named values (a preset, or a blend of two). */
export function setFace(values) {
  presets.names.forEach((n, i) => {
    uniforms.uFaceF.value[i] = values[n] ?? presets.defaults[n];
  });
}

function mixPresets(a, b, t) {
  const out = {};
  for (const n of presets.names)
    out[n] = presets.presets[a][n] * (1 - t) + presets.presets[b][n] * t;
  return out;
}

function camera(v, aspect) {
  const cam = new THREE.PerspectiveCamera(v.fov ?? 20, aspect, 0.01, 50);
  const yaw = ((v.cam ?? 0) * Math.PI) / 180;
  const pitch = ((v.pitch ?? 0) * Math.PI) / 180;
  const t = new THREE.Vector3(...(v.target ?? [0.01, 0.86, 0.2]));
  const d = v.dist ?? 3.2;
  cam.position.set(
    t.x + d * Math.sin(yaw) * Math.cos(pitch),
    t.y + d * Math.sin(pitch),
    t.z + d * Math.cos(yaw) * Math.cos(pitch),
  );
  cam.lookAt(t);
  return cam;
}

function draw(c, width, height) {
  renderer.setSize(width, height, false);
  const values = c.mix
    ? mixPresets(c.mix[0], c.mix[1], c.mix[2])
    : { ...presets.presets[c.preset] };
  Object.assign(values, c.set ?? {});
  setFace(values);
  scene.background = new THREE.Color(c.bg ?? "#c9ced6");
  model.updateMatrixWorld(true);
  renderer.render(scene, camera(c, width / height));
  return renderer.domElement;
}

/** `cells`: [{ label, preset | mix:[a,b,t], set:{float:value}, cam, pitch, dist, fov, target }] in a grid. */
export function sheet(cells, { size = 320, cols = 6, label = true } = {}) {
  const rows = Math.ceil(cells.length / cols);
  const out = document.createElement("canvas");
  out.width = size * cols;
  out.height = size * rows;
  const g = out.getContext("2d");
  g.fillStyle = "#111";
  g.fillRect(0, 0, out.width, out.height);
  cells.forEach((c, i) => {
    const canvas = draw(c, c.w ?? size, c.h ?? size);
    const x = (i % cols) * size;
    const y = Math.floor(i / cols) * size;
    g.drawImage(canvas, x, y);
    if (label) {
      g.font = "bold 13px sans-serif";
      g.fillStyle = "#c01";
      g.fillText(c.label ?? c.preset ?? "", x + 6, y + 15);
    }
  });
  return out.toDataURL("image/png");
}

/** One picture at any size, as a PNG address. */
export function shot(c, width, height) {
  return draw(c, width, height).toDataURL("image/png");
}

export function names() {
  return Object.keys(presets.presets);
}

window.dollFace = { open, sheet, shot, setFace, names };
window.__ready = true;
