// The gramophone FBX to the GLB, in Chrome, with the site's own three. The FBX has twenty-two
// meshes, every one at an identity transform with its pivot at the scene origin, the whole model
// turned 56.68 degrees about Y, and no texture links. The work, in order: the meshes are turned
// into the aligned frame (metres, the floor at y 0, the middle of the cabinet on the Y axis, the
// horn along +X), merged into six parts, the moving parts are given pivots of their own, and
// GLTFExporter writes one binary file with the three maps given by hand.
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** Which source meshes make which part. `disk` (the default record) is left out on purpose. */
export const PARTS = {
  cabinet: [
    "pCube16",
    "pCube19",
    "pCube22",
    "pCube27",
    "pCube28",
    "pCube29",
    "polySurface1",
    "pCylinder15",
    "pCube20",
    "pCube21",
    "pCube23",
    "pCube24",
    "pCube25",
  ],
  horn: ["pCylinder21", "pCylinder19"],
  crank: ["pCylinder16", "pCylinder17", "pCylinder18"],
  platter: ["disk_holder"],
  soundbox: ["pCylinder20", "pointer"],
};
export const DROPPED = ["disk"];

/**
 * Where each moving part turns, in the aligned frame, metres. Measured on the source (the build
 * checks each against its part's own box), see the README.
 */
export const PIVOTS = {
  crank: [-0.092, 0.104, -0.141],
  platter: [0, 0.148, 0],
  soundbox: [-0.081, 0.193, -0.045],
};

/** The turn axis of the soundbox's lift: along the elbow's end, as the README says. */
export const LIFT_AXIS = [0.38, 0, 0.93];

/** Anchors that ride on a moving part (their position is the rest position, kept in the part's own frame). */
export const ANCHOR_PARENT = {
  anchor_crank_handle: "crank",
  anchor_needle_tip: "soundbox",
  anchor_record_seat: "platter",
};

/** Empty nodes the page can hang things on. Place and meaning in the README. */
export const ANCHORS = {
  anchor_needle_tip: [-0.0815, 0.152, -0.0525],
  anchor_record_seat: [0, 0.1475, 0],
  anchor_crank_handle: [-0.032, 0.104, -0.199],
  anchor_bell_mouth: [0.221, 0.4, 0],
  anchor_elbow: [-0.081, 0.193, -0.045],
};

const round = (v, places = 5) => Math.round(v * 10 ** places) / 10 ** places;

/** The yaw that makes the cabinet's footprint axis aligned: the smallest rectangle in XZ. */
function footprintYaw(geometry) {
  const p = geometry.attributes.position;
  let best = null;
  for (let k = 0; k <= 9000; k++) {
    const a = (k / 9000) * (Math.PI / 2);
    const c = Math.cos(a);
    const s = Math.sin(a);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * c + p.getZ(i) * s;
      const z = -p.getX(i) * s + p.getZ(i) * c;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    const area = (x1 - x0) * (z1 - z0);
    if (!best || area < best.area) best = { area, a, x0, x1, z0, z1 };
  }
  return best;
}

function decoded(texture) {
  return new Promise((resolve) => {
    const tick = () => {
      const img = texture.image;
      if (img && (img.complete || img.width) && (img.naturalWidth ?? img.width) > 0) resolve();
      else setTimeout(tick, 5);
    };
    tick();
  });
}

async function loadTexture(url, { srgb, flipG = false }) {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  await decoded(texture);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.flipY = false;
  texture.userData.mimeType = "image/webp";
  texture.anisotropy = 8;
  return texture;
}

function withQuality(pick, work) {
  const original = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
    original.call(this, callback, type, pick(this));
  };
  return work().finally(() => {
    HTMLCanvasElement.prototype.toBlob = original;
  });
}

/**
 * The uvs as normalised 16 bit numbers (4 bytes a vertex, a valid accessor with no extension),
 * turned from the FBX's convention (v up) to glTF's (v down), so the maps stay upright as the
 * source holds them. Normals stay float: a normalised byte vector of 3 is not 4 byte aligned.
 */
function quantise(geometry) {
  const uv = geometry.attributes.uv;
  const out = new Uint16Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = 1 - uv.getY(i);
    if (u < -0.0005 || u > 1.0005 || v < -0.0005 || v > 1.0005) {
      throw new Error(`a uv leaves the picture: ${u}, ${v}`);
    }
    out[i * 2] = Math.round(THREE.MathUtils.clamp(u, 0, 1) * 65535);
    out[i * 2 + 1] = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 65535);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(out, 2, true));
}

/**
 * `urls`: `{ fbx, base, normal, orm }`. `quality`: `{ base, small }`, the WebP quality of the base map and of the
 * two small ones. Returns the GLB as base64 and what the build found.
 */
export async function convert(urls, { quality = { base: 0.85, small: 0.8 } } = {}) {
  const buffer = await (await fetch(urls.fbx)).arrayBuffer();
  const source = new FBXLoader().parse(buffer, "");
  source.updateMatrixWorld(true);
  const meshes = new Map();
  source.traverse((o) => {
    if (o.isMesh) meshes.set(o.name, o);
  });
  const wanted = new Set([...Object.values(PARTS).flat(), ...DROPPED]);
  for (const name of wanted)
    if (!meshes.has(name)) throw new Error(`the source has no mesh ${name}`);
  for (const name of meshes.keys()) {
    if (!wanted.has(name))
      throw new Error(`the source has a mesh the build does not place: ${name}`);
  }

  // World geometry in centimetres (the group's offset included).
  const world = new Map();
  for (const [name, mesh] of meshes) {
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    world.set(name, g);
  }

  // The aligned frame, measured on the cabinet.
  const found = footprintYaw(world.get("pCube16"));
  const yaw = found.a;
  const rot = new THREE.Matrix4().makeRotationY(yaw);
  const turned = world.get("pCube16").clone().applyMatrix4(rot);
  turned.computeBoundingBox();
  const cx = (turned.boundingBox.min.x + turned.boundingBox.max.x) / 2;
  const cz = (turned.boundingBox.min.z + turned.boundingBox.max.z) / 2;
  const floor = turned.boundingBox.min.y;
  const toMetres = new THREE.Matrix4()
    .makeScale(0.01, 0.01, 0.01)
    .multiply(new THREE.Matrix4().makeTranslation(-cx, -floor, -cz))
    .multiply(rot);

  const aligned = new Map();
  for (const [name, g] of world) {
    const a = g.clone().applyMatrix4(toMetres);
    // Welding by position, normal and uv; the loose FBX corners become shared vertices.
    aligned.set(name, a);
  }
  const bell = aligned.get("pCylinder21");
  bell.computeBoundingBox();
  const crankBox = aligned.get("pCylinder17");
  crankBox.computeBoundingBox();
  const bellCentre = bell.boundingBox.getCenter(new THREE.Vector3());
  const crankCentre = crankBox.boundingBox.getCenter(new THREE.Vector3());
  if (!(bellCentre.x > 0.03))
    throw new Error(`the horn does not point +X (bell at ${bellCentre.x})`);
  if (!(crankCentre.z < -0.1)) throw new Error(`the crank is not on -Z (at ${crankCentre.z})`);

  const check = (name, got, want, tol = 0.004) => {
    for (let k = 0; k < 3; k++) {
      if (Math.abs(got[k] - want[k]) > tol) {
        throw new Error(`pivot ${name}: measured ${got.map((v) => round(v))}, expected ${want}`);
      }
    }
  };
  // The crank's hub is a cylinder about Z: its middle in X and Y is the axis.
  const hub = aligned.get("pCylinder16");
  hub.computeBoundingBox();
  const hubMid = hub.boundingBox.getCenter(new THREE.Vector3());
  check("crank", [hubMid.x, hubMid.y, PIVOTS.crank[2]], PIVOTS.crank);
  const plate = aligned.get("disk_holder");
  plate.computeBoundingBox();
  const plateMid = plate.boundingBox.getCenter(new THREE.Vector3());
  check("platter", [plateMid.x, PIVOTS.platter[1], plateMid.z], PIVOTS.platter);

  const root = new THREE.Group();
  root.name = "gramophone";
  const material = new THREE.MeshStandardMaterial({
    name: "gramophone",
    metalness: 1,
    roughness: 1,
  });
  const partFacts = {};
  const groups = new Map();
  for (const [part, names] of Object.entries(PARTS)) {
    const list = names.map((n) => {
      const g = aligned.get(n).clone();
      // One shape for every piece: position, normal and uv only.
      for (const key of Object.keys(g.attributes)) {
        if (!["position", "normal", "uv"].includes(key)) g.deleteAttribute(key);
      }
      return g.index ? g.toNonIndexed() : g;
    });
    let merged = mergeGeometries(list, false);
    merged = mergeVertices(merged, 1e-6);
    const pivot = PIVOTS[part];
    if (pivot) merged.translate(-pivot[0], -pivot[1], -pivot[2]);
    merged.computeBoundingBox();
    quantise(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${part}_mesh`;
    if (pivot) {
      const group = new THREE.Group();
      group.name = part;
      group.position.set(...pivot);
      group.add(mesh);
      root.add(group);
      groups.set(part, group);
    } else {
      mesh.name = part;
      root.add(mesh);
    }
    partFacts[part] = {
      vertices: merged.attributes.position.count,
      triangles: merged.index.count / 3,
      from: names,
    };
  }
  // The mouth of the bell: the vertices farthest along the bell's axis, their middle and their
  // distance across. The axis is the horn's, measured (see the README).
  const axis = new THREE.Vector3(0.94, 0.33, 0).normalize();
  const bellPosition = bell.attributes.position;
  let far = -Infinity;
  for (let i = 0; i < bellPosition.count; i++) {
    far = Math.max(far, axis.dot(new THREE.Vector3().fromBufferAttribute(bellPosition, i)));
  }
  const mouth = new THREE.Vector3();
  const rim = [];
  for (let i = 0; i < bellPosition.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(bellPosition, i);
    if (axis.dot(v) > far - 0.006) rim.push(v);
  }
  rim.forEach((v) => mouth.add(v));
  mouth.multiplyScalar(1 / rim.length);
  let across = 0;
  for (const a of rim) for (const b of rim) across = Math.max(across, a.distanceTo(b));
  ANCHORS.anchor_bell_mouth = mouth.toArray().map((v) => round(v));
  // An anchor on a moving part is a child of that part, so it travels with it: the handle's point
  // turns with the crank, the needle's tip lifts with the soundbox, the record's seat spins.
  const anchorParents = {};
  for (const [name, at] of Object.entries(ANCHORS)) {
    const node = new THREE.Object3D();
    node.name = name;
    const parent = ANCHOR_PARENT[name];
    if (parent) {
      const pivot = PIVOTS[parent];
      node.position.set(at[0] - pivot[0], at[1] - pivot[1], at[2] - pivot[2]);
      groups.get(parent).add(node);
      anchorParents[name] = parent;
    } else {
      node.position.set(...at);
      root.add(node);
    }
  }

  // The maps, given by hand: the FBX had no links.
  const base = await loadTexture(urls.base, { srgb: true });
  const normal = await loadTexture(urls.normal, { srgb: false });
  const orm = await loadTexture(urls.orm, { srgb: false });
  material.map = base;
  material.normalMap = normal;
  material.metalnessMap = orm;
  material.roughnessMap = orm;
  const widths = new Map([
    [normal.image.width, quality.small],
    [orm.image.width, quality.small],
    [base.image.width, quality.base],
  ]);
  const sizes = { base: base.image.width, normal: normal.image.width, orm: orm.image.width };

  root.userData = {
    kind: "gramophone",
    frame: "metres, Y up, floor at y 0, cabinet centred on the Y axis, horn along +X, crank on -Z",
    presentationYaw: 3.84,
  };

  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  let glb;
  try {
    glb = await withQuality(
      (canvas) => widths.get(canvas.width) ?? 0.85,
      () =>
        new GLTFExporter().parseAsync(root, {
          binary: true,
          onlyVisible: false,
          embedImages: true,
        }),
    );
  } finally {
    console.warn = warn;
  }

  let binary = "";
  const bytes = new Uint8Array(glb);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return {
    base64: btoa(binary),
    report: {
      sourceBytes: buffer.byteLength,
      bytes: glb.byteLength,
      warnings,
      yawRadians: round(yaw, 7),
      yawDegrees: round((yaw * 180) / Math.PI, 4),
      offsetCm: [round(-cx, 4), round(-floor, 4), round(-cz, 4)],
      parts: partFacts,
      textures: sizes,
      bellCentre: bellCentre.toArray().map((v) => round(v)),
      anchorParents,
      bellMouth: {
        centre: ANCHORS.anchor_bell_mouth,
        across: round(across, 4),
        axis: axis.toArray().map((v) => round(v, 4)),
      },
      crankCentre: crankCentre.toArray().map((v) => round(v)),
    },
  };
}
