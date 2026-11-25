// Drawing models for the contact sheets: a plain light ground, a sky light and one key light that
// follows the camera, the base colour lit as the room lights it (MeshLambert).
import { THREE, loadModel, textureFrom } from "./lib.js";

const DIRS = {
  front: [0, 0.12, 1],
  threeq: [0.7, 0.15, 0.7],
  side: [1, 0.1, 0],
  left: [-1, 0.1, 0],
  back: [0, 0.12, -1],
  threeqb: [-0.7, 0.15, -0.7],
  top: [0, 1, 0.0001],
  under: [0, -1, 0.0001],
};

let renderer = null;
function rendererOf(w, h) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0xf1f0ec, 1);
  }
  renderer.setSize(w, h);
  return renderer;
}

function lambert(m) {
  const out = new THREE.MeshLambertMaterial({
    map: m.map ?? null,
    color: m.map ? 0xffffff : (m.color ?? new THREE.Color(0xcccccc)),
    side: THREE.DoubleSide,
    alphaTest: m.alphaTest ?? 0,
    transparent: m.transparent ?? false,
    opacity: m.opacity ?? 1,
    depthWrite: m.depthWrite ?? true,
  });
  out.name = m.name;
  return out;
}

/**
 * Draws an object from each view. `opts`: { views, w, h, focus: { center, size }, highlight:
 * Set of meshes drawn red, axes }. Returns { urls, box }.
 */
export function drawObject(root, opts = {}) {
  const w = opts.w ?? 300,
    h = opts.h ?? 380;
  const r = rendererOf(w, h);
  const swaps = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    swaps.push([o, o.material]);
    if (opts.highlight?.has(o))
      o.material = new THREE.MeshLambertMaterial({ color: 0xff2a2a, side: THREE.DoubleSide });
    else if (opts.ghost)
      o.material = new THREE.MeshLambertMaterial({
        color: 0xbfc3c9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
    else o.material = Array.isArray(o.material) ? o.material.map(lambert) : lambert(o.material);
    o.frustumCulled = false;
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4bfd2, 1.55));
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 200);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-1.6, 2.2, 3);
  camera.add(key);
  scene.add(camera);
  const parent = root.parent;
  scene.add(root);
  if (opts.axes) scene.add(new THREE.AxesHelper(opts.axes));
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (o.isMesh && o.visible) box.expandByObject(o, true);
  });
  const center = box.getCenter(new THREE.Vector3());
  let target = center.clone();
  let radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-3);
  if (opts.focus?.match) {
    // Focus on the meshes whose name or material matches (the same part in a source and a result).
    const re = new RegExp(opts.focus.match, "i");
    const fb = new THREE.Box3();
    root.traverse((o) => {
      if (
        o.isMesh &&
        o.visible &&
        (re.test(o.name) || [o.material].flat().some((m) => re.test(m.name)))
      )
        fb.expandByObject(o, true);
    });
    target = fb.getCenter(new THREE.Vector3());
    radius = (fb.getSize(new THREE.Vector3()).length() / 2) * (opts.focus.scale ?? 1);
  } else if (opts.focus) {
    target = new THREE.Vector3(...opts.focus.center);
    radius = opts.focus.size / 2;
  }
  const urls = [];
  for (const v of opts.views ?? ["front", "threeq", "side", "back"]) {
    const d = new THREE.Vector3(...DIRS[v]).normalize();
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.02;
    camera.position.copy(target).addScaledVector(d, dist);
    camera.up.set(0, 1, 0);
    if (v === "top" || v === "under") camera.up.set(0, 0, -1);
    camera.lookAt(target);
    camera.near = dist / 100;
    camera.far = dist * 10;
    camera.updateProjectionMatrix();
    r.render(scene, camera);
    urls.push(r.domElement.toDataURL("image/png"));
  }
  scene.remove(root);
  if (parent) parent.add(root);
  for (const [o, m] of swaps) o.material = m;
  return { urls, box };
}

const fmt = (v) => v.toArray().map((x) => +x.toFixed(3));

/**
 * The room's old Angela file drawn two ways: as the old viewer did (each skinned mesh got only the
 * picture of its first material) and with every material on its own part.
 */
const ANGELA_DIR = "D:/ren/aspirant-r2/library/v1/others/3d/angela";
const ANGELA_MAPS = {
  body: "Angela_skin08_body.png",
  body_A: "Angela_skin08_body.png",
  hair: "Angela_skin08_hair.png",
  face: "Angela_skin08_face.png",
};
async function oldAngela(firstOnly) {
  const { root } = await loadModel(`${ANGELA_DIR}/hero_angela_skin08_high_add.fbx`);
  const tex = {};
  for (const [k, f] of Object.entries(ANGELA_MAPS))
    tex[k] = await textureFrom(`${ANGELA_DIR}/${f}`);
  const mat = (name) =>
    new THREE.MeshLambertMaterial({
      name,
      map: tex[name] ?? null,
      color: tex[name] ? 0xffffff : 0xcccccc,
    });
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (/Cylinder|jiqiren/.test(o.name)) return void (o.visible = false);
    const names = [o.material].flat().map((m) => m.name);
    o.material = firstOnly
      ? mat(names[0])
      : Array.isArray(o.material)
        ? names.map(mat)
        : mat(names[0]);
  });
  return root;
}
const SPECIALS = {
  "old-angela-as-drawn": () => oldAngela(true),
  "old-angela-every-material": () => oldAngela(false),
};

/** One row of a sheet: a label, the views of a model (a file, or an object already built), references. */
export async function renderRow(row) {
  const root =
    row.object ?? (row.special ? await SPECIALS[row.special]() : (await loadModel(row.file)).root);
  const hide = (row.hide ?? []).map((s) => new RegExp(s, "i"));
  const names = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [o.material].flat().map((m) => m.name);
    names.push(
      `${o.name} [${mats.join(",")}]${o.isSkinnedMesh ? " skinned" : ""}${o.morphTargetDictionary ? " morph:" + Object.keys(o.morphTargetDictionary).join("/") : ""}`,
    );
    if (hide.some((r) => r.test(o.name) || mats.some((n) => r.test(n)))) o.visible = false;
    if (row.morph && o.morphTargetDictionary && row.morph in o.morphTargetDictionary) {
      o.morphTargetInfluences.fill(0);
      o.morphTargetInfluences[o.morphTargetDictionary[row.morph]] = 1;
    }
  });
  // A test pose: turns added to bones (degrees, local XYZ), to see that the skin follows them.
  if (row.pose) {
    for (const [name, deg] of Object.entries(row.pose)) {
      const bone = root.getObjectByName(name);
      if (!bone) {
        console.warn("no bone " + name);
        continue;
      }
      bone.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...deg.map((d) => THREE.MathUtils.degToRad(d))),
        ),
      );
    }
    root.updateMatrixWorld(true);
  }
  const views = row.views ?? ["front", "threeq", "side", "back"];
  const { urls, box } = drawObject(root, {
    views,
    focus: row.focus,
    axes: row.axes,
    w: row.w,
    h: row.h,
  });
  const size = box.getSize(new THREE.Vector3());
  const el = document.createElement("div");
  el.className = "row";
  const label = document.createElement("div");
  label.className = "label";
  label.innerHTML = `${row.label}<small>${row.note ?? ""}\nsize ${fmt(size).join(" x ")}\ncentre ${fmt(box.getCenter(new THREE.Vector3())).join(", ")}\nmin y ${box.min.y.toFixed(3)}</small>`;
  el.append(label);
  views.forEach((v, i) => {
    const c = document.createElement("div");
    c.className = "cell";
    const img = new Image();
    img.src = urls[i];
    c.append(img, v);
    el.append(c);
  });
  for (const ref of row.refs ?? []) {
    const c = document.createElement("div");
    c.className = "cell";
    const img = new Image();
    img.src = "/disk/" + encodeURIComponent(ref.file ?? ref);
    img.style.height = (row.h ?? 380) + "px";
    await img.decode().catch(() => {});
    c.append(img, ref.label ?? "before");
    el.append(c);
  }
  document.getElementById("rows").append(el);
  return {
    size: fmt(size),
    center: fmt(box.getCenter(new THREE.Vector3())),
    min: fmt(box.min),
    max: fmt(box.max),
    meshes: names,
  };
}

/** A grid of small pictures with captions (the candidate parts of a source). */
export function addGrid(title, cells) {
  const h = document.createElement("h1");
  h.textContent = title;
  const el = document.createElement("div");
  el.className = "row";
  for (const { urls, caption } of cells) {
    const c = document.createElement("div");
    c.className = "cell";
    const pics = document.createElement("div");
    pics.style.display = "flex";
    for (const u of urls) {
      const img = new Image();
      img.src = u;
      pics.append(img);
    }
    c.append(pics, caption);
    el.append(c);
  }
  document.getElementById("rows").append(h, el);
}
