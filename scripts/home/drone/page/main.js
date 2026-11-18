// Draws cells of a face atlas on the real drone's screen, with the shader of the About page's
// scene (apps/web/src/features/about/drone/drone-scene.ts, the face's `onBeforeCompile`).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let renderer;
let scene;
let camera;
let face;
let original;
const uniforms = {
  uBlink: { value: 0 },
  uLook: { value: new THREE.Vector2() },
  uCell: { value: new THREE.Vector2() },
};

async function textureOf(url) {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

async function load(glbUrl) {
  const glb = await new GLTFLoader().loadAsync(glbUrl);
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#e9e6e1");
  scene.add(glb.scene);
  glb.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const m = o.material;
    if (m.name === "drone_face") face = o;
    m.toneMapped = false;
  });
  original = face.material.map;
  original.wrapS = THREE.RepeatWrapping;
  original.wrapT = THREE.RepeatWrapping;
  face.material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader =
      "uniform float uBlink;\nuniform vec2 uLook;\nuniform vec2 uCell;\n" +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        [
          "vec2 fuv = vMapUv;",
          "vec2 cell = floor(fuv * 3.0 + vec2(0.0, 0.02)) / 3.0;",
          "vec2 local = (fuv - cell) * 3.0 - uLook;",
          "local.y = 0.585 + (local.y - 0.585) / max(1.0 - uBlink, 0.06);",
          "local = clamp(local, 0.03, 0.97);",
          "vec4 sampledDiffuseColor = texture2D(map, cell + (uCell + local) / 3.0);",
          "diffuseColor *= sampledDiffuseColor;",
        ].join("\n"),
      );
  };
  face.material.needsUpdate = true;
  glb.scene.updateMatrixWorld(true);
  // The two meshes share one set of vertices: the screen is the ones its own index uses.
  const box = new THREE.Box3();
  const position = face.geometry.attributes.position;
  const index = face.geometry.index;
  const v = new THREE.Vector3();
  for (let i = 0; i < index.count; i++)
    box.expandByPoint(v.fromBufferAttribute(position, index.getX(i)));
  camera = new THREE.PerspectiveCamera(20, 1, 0.05, 10);
  return {
    centre: box.getCenter(new THREE.Vector3()).toArray(),
    size: box.getSize(new THREE.Vector3()).toArray(),
  };
}

function frame(centre, across) {
  const c = new THREE.Vector3(...centre);
  const distance = across / 2 / Math.tan((10 * Math.PI) / 180);
  camera.position.set(c.x, c.y, c.z + distance);
  camera.lookAt(c);
  camera.updateProjectionMatrix();
}

function draw(cell, size, options) {
  uniforms.uCell.value.set(cell[0], cell[1]);
  uniforms.uBlink.value = options.blink ?? 0;
  uniforms.uLook.value.set(options.look?.[0] ?? 0, options.look?.[1] ?? 0);
  if (options.map) face.material.map = options.map;
  renderer.setSize(size, size, false);
  renderer.render(scene, camera);
  return renderer.domElement;
}

/** `cells`: [{ label, atlas ("original" or a url), uCell, blink, look }]; one labelled sheet. */
async function sheet(glbUrl, cells, { size = 300, cols = 6, across = 0.4 } = {}) {
  if (!renderer) window.__faceFound = await load(glbUrl);
  frame(window.__faceFound.centre, across);
  const maps = new Map([["original", original]]);
  const out = document.createElement("canvas");
  const rows = Math.ceil(cells.length / cols);
  out.width = size * cols;
  out.height = size * rows;
  const g = out.getContext("2d");
  g.fillStyle = "#222";
  g.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!maps.has(c.atlas)) maps.set(c.atlas, await textureOf(c.atlas));
    const canvas = draw(c.uCell, size, { ...c, map: maps.get(c.atlas) });
    const x = (i % cols) * size;
    const y = Math.floor(i / cols) * size;
    g.drawImage(canvas, x, y);
    g.font = "bold 14px sans-serif";
    g.fillStyle = "#c01";
    g.fillText(c.label, x + 8, y + 18);
  }
  return out.toDataURL("image/png");
}

async function found(glbUrl) {
  if (!renderer) window.__faceFound = await load(glbUrl);
  return window.__faceFound;
}

window.droneFaces = { sheet, found };
window.__ready = true;
