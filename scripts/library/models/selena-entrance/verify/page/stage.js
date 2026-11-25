// The page the checks run in: the site's own three, GLTFLoader and the meshopt decoder, one
// canvas. Node drives it through window.stage (lib/browser.mjs).
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
const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 200);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = {};
const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

window.stage = {
  THREE,
  scene,
  camera,
  renderer,
  models,
  async load(name, url) {
    const gltf = await loader.loadAsync(url);
    const bones = {};
    const meshes = [];
    gltf.scene.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false;
        meshes.push(o);
      }
    });
    scene.add(gltf.scene);
    const lit = new Map(meshes.map((m) => [m, m.material]));
    const unlit = new Map(
      meshes.map((m) => {
        const s = m.material;
        const basic = new THREE.MeshBasicMaterial({
          map: s.map,
          color: s.color,
          transparent: s.transparent,
          alphaTest: s.alphaTest,
          depthWrite: s.depthWrite,
          side: THREE.DoubleSide,
        });
        return [m, basic];
      }),
    );
    models[name] = {
      gltf,
      root: gltf.scene,
      mixer: new THREE.AnimationMixer(gltf.scene),
      clips: Object.fromEntries(gltf.animations.map((c) => [c.name, c])),
      bones,
      meshes,
      lit,
      unlit,
      rest: Object.fromEntries(
        Object.entries(bones).map(([n, b]) => [
          n,
          { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() },
        ]),
      ),
    };
    return {
      clips: gltf.animations.map((c) => [c.name, c.duration, c.tracks.length]),
      bones: Object.keys(bones).length,
      boneNames: Object.keys(bones),
      meshes: meshes.map((m) => [
        m.name,
        m.isSkinnedMesh,
        m.material.type,
        m.material.transparent,
        m.material.alphaTest,
        m.geometry.attributes.position.count,
      ]),
      extras: gltf.scene.userData ?? {},
    };
  },
  /** Materials: "lit" (as loaded), "unlit" (base colour only) or "mask" (flat white). */
  look(name, kind) {
    const m = models[name];
    for (const mesh of m.meshes) {
      mesh.material =
        kind === "mask" ? white : kind === "unlit" ? m.unlit.get(mesh) : m.lit.get(mesh);
    }
  },
  visible(name, filter) {
    for (const mesh of models[name].meshes)
      mesh.visible = filter ? filter.includes(mesh.name) : true;
  },
  show(name, on) {
    models[name].root.visible = on;
  },
  /** Pose a model: stop everything, play `clip` at time `t` seconds (held on the last key). */
  pose(name, clip, t) {
    const m = models[name];
    m.mixer.stopAllAction();
    m.mixer.uncacheRoot(m.root);
    for (const [n, b] of Object.entries(m.bones)) {
      b.position.copy(m.rest[n].p);
      b.quaternion.copy(m.rest[n].q);
      b.scale.copy(m.rest[n].s);
    }
    if (clip) {
      const action = m.mixer.clipAction(m.clips[clip]);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      m.mixer.setTime(t);
    }
    m.root.updateMatrixWorld(true);
  },
  /** World position of every bone (name -> [x, y, z]). */
  boneWorld(name) {
    const out = {};
    const v = new THREE.Vector3();
    for (const [n, b] of Object.entries(models[name].bones)) {
      b.getWorldPosition(v);
      out[n] = v.toArray();
    }
    return out;
  },
  /** Skinned positions of every `step`-th vertex of the visible meshes, world space. */
  skinned(name, step = 1, only = null) {
    const out = [];
    const v = new THREE.Vector3();
    for (const mesh of models[name].meshes) {
      if (only && !only.includes(mesh.name)) continue;
      const g = mesh.geometry;
      for (let i = 0; i < g.attributes.position.count; i += step) {
        v.fromBufferAttribute(g.attributes.position, i);
        if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v);
        v.applyMatrix4(mesh.matrixWorld);
        out.push(v.x, v.y, v.z);
      }
    }
    return out;
  },
  setBackground(color) {
    scene.background = color == null ? null : new THREE.Color(color);
  },
  /**
   * Renders and returns a PNG data address. opts: width, height, pos, quaternion or target,
   * vfov (vertical, degrees, over the frame `width / height`), near, far.
   */
  shot(opts) {
    const w = opts.width ?? 960;
    const h = opts.height ?? 432;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = opts.vfov ?? 60;
    camera.near = opts.near ?? 0.02;
    camera.far = opts.far ?? 200;
    camera.up.set(...(opts.up ?? [0, 1, 0]));
    camera.position.set(...opts.pos);
    if (opts.quaternion) camera.quaternion.set(...opts.quaternion);
    else camera.lookAt(new THREE.Vector3(...opts.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    for (const disc of Object.values(discs)) disc.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    return canvas.toDataURL("image/png");
  },
  /** Normalised device coordinates of world points through the last shot's camera. */
  project(points) {
    const v = new THREE.Vector3();
    return points.map((p) => {
      v.set(...p).project(camera);
      return [v.x, v.y, v.z];
    });
  },
};

/**
 * The world position under every pixel of the last shot (same camera, same size), as base64 of
 * Float32 x, y, z, w per pixel (w 1 where a surface is drawn, 0 elsewhere), rows from the top.
 * Cut-outs keep their holes (a texel under half alpha draws nothing).
 */
const positionMaterials = new Map();
function positionMaterial(mesh) {
  if (positionMaterials.has(mesh)) return positionMaterials.get(mesh);
  const source = models.m?.lit.get(mesh) ?? mesh.material;
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: source.map ?? null }, hasMap: { value: source.map ? 1 : 0 } },
    side: THREE.DoubleSide,
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vWorld;
      varying vec2 vUv0;
      void main() {
        vUv0 = uv;
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 w = modelMatrix * vec4(transformed, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform float hasMap;
      varying vec3 vWorld;
      varying vec2 vUv0;
      void main() {
        if (hasMap > 0.5 && texture2D(map, vUv0).a < 0.5) discard;
        gl_FragColor = vec4(vWorld, 1.0);
      }`,
  });
  positionMaterials.set(mesh, material);
  return material;
}
window.stage.positions = (name) => {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
  });
  const saved = new Map();
  for (const mesh of models[name].meshes) {
    saved.set(mesh, mesh.material);
    mesh.material = positionMaterial(mesh);
  }
  const background = scene.background;
  scene.background = null;
  const discsShown = Object.values(discs).map((d) => [d, d.visible]);
  for (const [d] of discsShown) d.visible = false;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  const data = new Float32Array(size.x * size.y * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size.x, size.y, data);
  renderer.setRenderTarget(null);
  target.dispose();
  scene.background = background;
  for (const [d, v] of discsShown) d.visible = v;
  for (const [mesh, material] of saved) mesh.material = material;
  // flip rows: WebGL reads from the bottom
  const rows = new Float32Array(data.length);
  const stride = size.x * 4;
  for (let y = 0; y < size.y; y++)
    rows.set(data.subarray(y * stride, (y + 1) * stride), (size.y - 1 - y) * stride);
  const bytes = new Uint8Array(rows.buffer);
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { width: size.x, height: size.y, data: btoa(text) };
};

/** The first surface under a point of the last shot (normalised device coordinates), on the meshes named. */
window.stage.pick = (name, ndc, only = null) => {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndc[0], ndc[1]), camera);
  const meshes = models[name].meshes.filter((m) => m.visible && (!only || only.includes(m.name)));
  for (const m of meshes) m.updateMatrixWorld(true);
  const hits = ray.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const h = hits[0];
  return { point: h.point.toArray(), mesh: h.object.name, distance: h.distance };
};

/** A disc that faces the camera, drawn over a model (the sticker check). */
const discs = {};
window.stage.disc = (id, color, radius, position, opacity = 0.7) => {
  if (!discs[id]) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    scene.add(mesh);
    discs[id] = mesh;
  }
  const mesh = discs[id];
  mesh.material.opacity = opacity;
  mesh.scale.setScalar(radius);
  mesh.visible = position !== null;
  if (position) {
    mesh.position.set(...position);
    mesh.quaternion.copy(camera.quaternion);
  }
};

/** Small flat spheres drawn over everything, to mark a point. */
const markers = {};
window.stage.marker = (id, color, radius, position) => {
  if (!markers[id]) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    mesh.renderOrder = 999;
    mesh.frustumCulled = false;
    scene.add(mesh);
    markers[id] = mesh;
  }
  markers[id].scale.setScalar(radius);
  if (position) markers[id].position.set(...position);
  markers[id].visible = position !== null;
};
window.__ready = true;
