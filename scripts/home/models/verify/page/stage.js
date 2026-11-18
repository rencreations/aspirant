// The page the checks run in: the site's own three, GLTFLoader and the meshopt decoder, one
// canvas. The build drives it through window.stage from Node (see lib/browser.mjs).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.1);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(2, 4, 3);
scene.add(hemi, sun);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = {};

function sanitise(name) {
  return THREE.PropertyBinding.sanitizeNodeName(name);
}

window.stage = {
  THREE,
  scene,
  camera,
  renderer,
  models,
  hemi,
  sun,
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
    models[name] = {
      gltf,
      root: gltf.scene,
      mixer: new THREE.AnimationMixer(gltf.scene),
      clips: Object.fromEntries(gltf.animations.map((c) => [c.name, c])),
      bones,
      meshes,
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
      meshes: meshes.map((m) => [
        m.name,
        m.isSkinnedMesh,
        m.material.type,
        m.geometry.attributes.position.count,
      ]),
      extras: gltf.scene.userData ?? {},
    };
  },
  sanitise,
  /** Pose a model: stop everything, play `clip` at time `t` seconds. */
  pose(name, clip, t) {
    const m = models[name];
    m.mixer.stopAllAction();
    m.mixer.uncacheRoot(m.root);
    // Back to the rest transforms, then the clip (a bone the clip does not key stays at rest).
    for (const [n, b] of Object.entries(m.bones)) {
      b.position.copy(m.rest[n].p);
      b.quaternion.copy(m.rest[n].q);
      b.scale.copy(m.rest[n].s);
    }
    if (clip) {
      const action = m.mixer.clipAction(m.clips[clip]);
      // Once, held on the last key: a time equal to the duration must show the last frame, not wrap to the first.
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      m.mixer.setTime(t);
    }
    m.root.updateMatrixWorld(true);
  },
  worldOf(name, bone) {
    const o = models[name].bones[bone] ?? models[name].root.getObjectByName(bone);
    const v = new THREE.Vector3();
    o.getWorldPosition(v);
    return v.toArray();
  },
  setBackground(color) {
    scene.background = color == null ? null : new THREE.Color(color);
  },
  useEnvironment(on) {
    scene.environment = on ? environment : null;
  },
  /** Renders and returns a PNG data address. opts: width, height, pos, target, fov, up. */
  shot(opts) {
    const w = opts.width ?? 800;
    const h = opts.height ?? 600;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = opts.fov ?? 40;
    camera.near = opts.near ?? 0.02;
    camera.far = opts.far ?? 100;
    camera.up.set(...(opts.up ?? [0, 1, 0]));
    camera.position.set(...opts.pos);
    if (opts.quaternion) camera.quaternion.set(...opts.quaternion);
    else camera.lookAt(new THREE.Vector3(...opts.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);
    return canvas.toDataURL("image/png");
  },
};

/** Helpers that measure a loaded model's skinned vertices and bones (used by the checks). */
function measureFor(name) {
  const S = window.stage;
  const T = THREE;
  const M = models[name];
  const skinned = M.meshes.filter((m) => m.isSkinnedMesh);
  const reset = () => S.pose(name, null, 0);
  /** Vertices whose weight on `bone` is at least `min`, skinned, in world space. */
  const pointsOf = (bone, min = 0.5, meshFilter = null) => {
    const out = [];
    const v = new T.Vector3();
    for (const mesh of skinned) {
      if (meshFilter && !meshFilter(mesh)) continue;
      const g = mesh.geometry;
      const index = mesh.skeleton.bones.findIndex((b) => b.name === bone);
      if (index < 0) continue;
      const ji = g.attributes.skinIndex;
      const wi = g.attributes.skinWeight;
      for (let i = 0; i < g.attributes.position.count; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (ji.getComponent(i, k) === index) w += wi.getComponent(i, k);
        if (w < min) continue;
        v.fromBufferAttribute(g.attributes.position, i);
        mesh.applyBoneTransform(i, v);
        out.push(v.clone());
      }
    }
    return out;
  };
  const centroid = (pts) =>
    pts.reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(1 / Math.max(1, pts.length));
  const headOf = (bone) => new T.Vector3().setFromMatrixPosition(M.bones[bone].matrixWorld);
  const worldQuat = (bone) => M.bones[bone].getWorldQuaternion(new T.Quaternion());
  /** The axis, in the bone's own frame, that turns the bone about the world axis `w` (unit). */
  const localAxis = (bone, w) =>
    new T.Vector3(...w).applyQuaternion(worldQuat(bone).invert()).normalize();
  const turn = (bone, axisLocal, angle) => {
    M.bones[bone].rotateOnAxis(axisLocal, angle);
    M.root.updateMatrixWorld(true);
  };
  const round = (a, d = 4) => a.map((x) => +x.toFixed(d));
  return { reset, pointsOf, centroid, headOf, worldQuat, localAxis, turn, round, T, S, M };
}
window.stage.measureFor = measureFor;

/**
 * The material recipe the build recommends for the toon-painted characters: three light steps,
 * a thin cool rim, an ink outline (the mesh again, back faces, pushed along its normals), and for
 * the alpha hair depthWrite on with a small alpha test. Switched on and off for the comparison
 * pictures; the actors write their own version of this.
 */
const recipe = {
  saved: new Map(),
  outlines: [],
  on() {
    const gradient = new THREE.DataTexture(new Uint8Array([105, 190, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
    recipe.env = scene.environment;
    scene.environment = null;
    hemi.intensity = 1.3;
    sun.intensity = 1.6;
    for (const name of Object.keys(models)) {
      for (const mesh of models[name].meshes) {
        if (!mesh.isSkinnedMesh) continue;
        const old = mesh.material;
        recipe.saved.set(mesh, old);
        const alpha = old.transparent;
        const toon = new THREE.MeshToonMaterial({
          map: old.map,
          color: old.color,
          gradientMap: gradient,
          side: THREE.DoubleSide,
          transparent: alpha,
          alphaTest: alpha ? 0.02 : 0,
          depthWrite: true,
        });
        toon.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            [
              "outgoingLight += vec3(0.55, 0.65, 1.0) * pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0) * 0.22;",
              "#include <opaque_fragment>",
            ].join("\n"),
          );
        };
        mesh.material = toon;
        if (alpha) continue;
        const ink = new THREE.MeshBasicMaterial({ color: 0x1b1424, side: THREE.BackSide });
        ink.onBeforeCompile = (shader) => {
          shader.uniforms.uOutline = { value: 0.0032 };
          shader.vertexShader = ["uniform float uOutline;", shader.vertexShader]
            .join("\n")
            .replace(
              "#include <skinning_vertex>",
              [
                "#include <skinning_vertex>",
                "transformed += normalize(objectNormal) * uOutline;",
              ].join("\n"),
            );
        };
        const outline = new THREE.SkinnedMesh(mesh.geometry, ink);
        outline.bind(mesh.skeleton, mesh.bindMatrix);
        outline.frustumCulled = false;
        mesh.parent.add(outline);
        recipe.outlines.push(outline);
      }
    }
  },
  off() {
    for (const [mesh, material] of recipe.saved) mesh.material = material;
    recipe.saved.clear();
    for (const o of recipe.outlines) o.removeFromParent();
    recipe.outlines.length = 0;
    scene.environment = recipe.env ?? environment;
    hemi.intensity = 1.1;
    sun.intensity = 2.2;
  },
};
window.stage.recipe = recipe;

/** Small flat-coloured spheres drawn over everything, to mark a point in a comparison picture. */
const markers = {};
window.stage.marker = (id, color, radius, position) => {
  if (!markers[id]) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 }),
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
