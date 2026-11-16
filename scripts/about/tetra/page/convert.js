// Tetra's FBX to the GLB, in Chrome, with the site's own three. The work, in order: the mesh is
// split into its parts (FBXLoader gives one mesh of loose corners), the eyes are given new morph
// targets (the blink of the source is wrong, see README.md), the two pictures of the mouth are
// made one, the skeleton loses the bones nothing uses, three Mixamo clips are fitted to it, and
// GLTFExporter writes one binary file.
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const HEAD = "mixamorigHead";
const HIPS = "mixamorigHips";

/**
 * The blink. `line` is where the eye closes, as a share of the eye's height from its foot. The
 * iris is squashed onto that line and the lash rides its top edge down to it; `lashFlat` makes
 * the lash's arc a little flatter as it comes down, `lashForward` keeps it in front of the iris,
 * and `narrow` draws the iris in a little so no corner of it shows beside the lash.
 */
export const BLINK = { line: 0.3, lashFlat: 0.3, lashForward: 0.0015, narrow: 0.12 };
/** How far the eyes slide for a look, in metres, and how much of that the lash follows. */
export const LOOK = { x: 0.005, y: 0.004, lash: 0.4 };
/** The open eye for surprise: the iris grows by this much and the lash lifts by this, in metres. */
export const WIDE = { grow: 0.1, lift: 0.0025 };
/** Where a hidden part is kept: this far inside the head, behind its own place. */
const HIDE_DEPTH = 0.04;

/** The Mixamo clips that are fitted to the doll and written into the file. */
const CLIPS = ["walk", "hiphop", "rumba"];

function decoded(texture) {
  return new Promise((resolve) => {
    const tick = () => {
      const img = texture.image;
      if (img && img.complete && img.naturalWidth > 0) resolve();
      else setTimeout(tick, 5);
    };
    tick();
  });
}

/** The corners of the mesh, grouped into the pieces that hang together. */
function components(geometry) {
  const pos = geometry.attributes.position;
  const n = pos.count;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const first = new Map();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
    if (first.has(key)) union(i, first.get(key));
    else first.set(key, i);
  }
  for (let t = 0; t < n; t += 3) {
    union(t, t + 1);
    union(t, t + 2);
  }
  const out = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!out.has(root)) out.set(root, []);
    out.get(root).push(i);
  }
  return [...out.values()];
}

/** A new geometry of the given corners, with the named attributes and morph targets. */
function subset(geometry, corners, attributes, morphs = []) {
  const out = new THREE.BufferGeometry();
  const copy = (attr) => {
    const size = attr.itemSize;
    const arr = new attr.array.constructor(corners.length * size);
    corners.forEach((src, k) => {
      for (let c = 0; c < size; c++) arr[k * size + c] = attr.array[src * size + c];
    });
    return new THREE.BufferAttribute(arr, size, attr.normalized);
  };
  for (const name of attributes) out.setAttribute(name, copy(geometry.attributes[name]));
  if (morphs.length) {
    out.morphAttributes.position = morphs.map(([name, attr]) => {
      const made = copy(attr);
      made.name = name;
      return made;
    });
    out.morphTargetsRelative = true;
  }
  return out;
}

/**
 * One vertex for the corners that agree in every attribute and in every morph target, and an
 * index. (three's own `mergeVertices` does not look at the targets, so two corners that rest at
 * one place and open to different places would become one.) The targets keep their names.
 */
function weld(geometry) {
  const names = Object.keys(geometry.attributes);
  const morphs = geometry.morphAttributes.position ?? [];
  const sources = [...names.map((name) => geometry.attributes[name]), ...morphs];
  const n = geometry.attributes.position.count;
  const seen = new Map();
  const index = [];
  const order = [];
  for (let i = 0; i < n; i++) {
    let hash = "";
    for (const attr of sources) {
      for (let c = 0; c < attr.itemSize; c++) {
        hash += `${Math.round(attr.array[i * attr.itemSize + c] * 1e5)},`;
      }
    }
    let at = seen.get(hash);
    if (at === undefined) {
      at = order.length;
      seen.set(hash, at);
      order.push(i);
    }
    index.push(at);
  }
  const out = subset(
    geometry,
    order,
    names,
    morphs.map((attr) => [attr.name, attr]),
  );
  out.setIndex(index);
  return out;
}

function boxOf(position, corners) {
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const i of corners) box.expandByPoint(p.fromBufferAttribute(position, i));
  return box;
}

/** Every corner of a geometry hangs on one bone. */
function weightTo(geometry, boneIndex) {
  const n = geometry.attributes.position.count;
  const index = new Uint16Array(n * 4);
  const weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    index[i * 4] = boneIndex;
    weight[i * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(index, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weight, 4));
}

/**
 * The eyes. In the source each eye is three pieces: the iris (a disc), the lash over it, and a
 * dark chevron (the squeezed eye of "> <") that sits behind the iris and shows at its inner
 * corner. The source's blink slides the chevron down the cheek and sinks the iris into the head.
 * Here the chevron is hidden at rest, and the targets are made again:
 * `blink_L`, `blink_R`, `squeeze` (the chevrons, in place of the eyes), `wide`, `look_x`, `look_y`.
 */
function buildEyes(geometry, parts) {
  const corners = [
    ...parts.discL,
    ...parts.lashL,
    ...parts.chevL,
    ...parts.discR,
    ...parts.lashR,
    ...parts.chevR,
  ];
  const eyes = subset(geometry, corners, ["position", "uv"]);
  const pos = eyes.attributes.position;
  const n = pos.count;
  const names = ["blink_L", "blink_R", "squeeze", "wide", "look_x", "look_y"];
  const delta = Object.fromEntries(names.map((name) => [name, new Float32Array(n * 3)]));
  let at = 0;
  for (const side of ["L", "R"]) {
    const take = (list) => {
      const range = [at, at + list.length];
      at += list.length;
      return range;
    };
    const disc = take(parts[`disc${side}`]);
    const lash = take(parts[`lash${side}`]);
    const chev = take(parts[`chev${side}`]);
    const range = ([from, to]) => Array.from({ length: to - from }, (_, k) => from + k);
    const discBox = boxOf(pos, range(disc));
    const lashBox = boxOf(pos, range(lash));
    const chevBox = boxOf(pos, range(chev));
    const mid = discBox.getCenter(new THREE.Vector3());
    const line = discBox.min.y + BLINK.line * (discBox.max.y - discBox.min.y);
    const drop = discBox.max.y - line;
    const blink = delta[`blink_${side}`];
    for (const i of range(disc)) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      blink[i * 3] = (mid.x - x) * BLINK.narrow;
      blink[i * 3 + 1] = line - y;
      delta.squeeze[i * 3 + 2] = -HIDE_DEPTH;
      delta.wide[i * 3] = (x - mid.x) * WIDE.grow;
      delta.wide[i * 3 + 1] = (y - mid.y) * WIDE.grow;
      delta.look_x[i * 3] = LOOK.x;
      delta.look_y[i * 3 + 1] = LOOK.y;
    }
    for (const i of range(lash)) {
      const y = pos.getY(i);
      // Flatter about its own top edge, then down with the top of the iris.
      blink[i * 3 + 1] = (lashBox.max.y - y) * BLINK.lashFlat - drop;
      blink[i * 3 + 2] = BLINK.lashForward;
      delta.squeeze[i * 3 + 2] = -HIDE_DEPTH;
      delta.wide[i * 3 + 1] = WIDE.lift;
      delta.look_x[i * 3] = LOOK.x * LOOK.lash;
      delta.look_y[i * 3 + 1] = LOOK.y * LOOK.lash;
    }
    // The chevron rests as one point inside the head; `squeeze` opens it where it was drawn.
    const hidden = chevBox.getCenter(new THREE.Vector3());
    hidden.z -= HIDE_DEPTH;
    for (const i of range(chev)) {
      delta.squeeze[i * 3] = pos.getX(i) - hidden.x;
      delta.squeeze[i * 3 + 1] = pos.getY(i) - hidden.y;
      delta.squeeze[i * 3 + 2] = pos.getZ(i) - hidden.z;
      pos.setXYZ(i, hidden.x, hidden.y, hidden.z);
    }
  }
  eyes.morphAttributes.position = names.map((name) => {
    const attr = new THREE.BufferAttribute(delta[name], 3);
    attr.name = name;
    return attr;
  });
  eyes.morphTargetsRelative = true;
  return eyes;
}

/** The mouth's colour and its mask, as one picture with an alpha channel. */
function mouthPicture(material) {
  const map = material.map.image;
  const mask = material.alphaMap.image;
  const canvas = document.createElement("canvas");
  canvas.width = map.naturalWidth;
  canvas.height = map.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  const alpha = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(map, 0, 0);
  const picture = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // three reads an alpha map's green channel.
  for (let i = 0; i < alpha.length; i += 4) picture.data[i + 3] = alpha[i + 1];
  ctx.putImageData(picture, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = material.map.flipY;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A Mixamo clip for this skeleton: the rotations of the bones that are kept, and the hips'
 * position in the model's metres. A walk also travels: the steady part of that travel is taken
 * out and returned as a speed, so the page moves the whole doll at exactly that speed and the
 * feet stay where they are put down. A dance is centred on its own middle.
 */
function fitClip(source, name, kept, hipsScale) {
  const tracks = [];
  let speed = 0;
  for (const track of source.tracks) {
    const dot = track.name.lastIndexOf(".");
    const node = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    // The hands are mittens: a clip that moves the fingers of one hand only is not wanted.
    if (!kept.has(node) || /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(node)) continue;
    if (prop === "quaternion") {
      tracks.push(new THREE.QuaternionKeyframeTrack(track.name, track.times, track.values));
      continue;
    }
    if (prop !== "position" || node !== HIPS) continue;
    const values = Float32Array.from(track.values, (v) => v * hipsScale);
    const times = track.times;
    const last = values.length - 3;
    const span = times[times.length - 1] - times[0];
    if (name === "walk") {
      const vx = (values[last] - values[0]) / span;
      const vz = (values[last + 2] - values[2]) / span;
      speed = Math.hypot(vx, vz);
      for (let k = 0; k < times.length; k++) {
        values[k * 3] -= vx * (times[k] - times[0]);
        values[k * 3 + 2] -= vz * (times[k] - times[0]);
      }
    } else {
      let mx = 0;
      let mz = 0;
      for (let k = 0; k < times.length; k++) {
        mx += values[k * 3] / times.length;
        mz += values[k * 3 + 2] / times.length;
      }
      for (let k = 0; k < times.length; k++) {
        values[k * 3] -= mx;
        values[k * 3 + 2] -= mz;
      }
    }
    tracks.push(new THREE.VectorKeyframeTrack(track.name, times, values));
  }
  return { clip: new THREE.AnimationClip(name, source.duration, tracks), speed };
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

const round = (v, places = 5) => Math.round(v * 10 ** places) / 10 ** places;

/**
 * `urls`: `{ fbx, rig, clips: { walk, hiphop, rumba } }`. `quality` is the WebP quality of the two
 * painted pictures (1 is lossless); the mouth's small flat picture is always lossless.
 */
export async function convert(urls, { quality = 1 } = {}) {
  const loader = new FBXLoader();
  const buffer = await (await fetch(urls.fbx)).arrayBuffer();
  const rig = await (await fetch(urls.rig)).json();
  const source = loader.parse(buffer, "");
  source.updateMatrixWorld(true);

  let mesh = null;
  source.traverse((o) => {
    if (o.isSkinnedMesh) mesh = o;
  });
  if (!mesh) throw new Error("no skinned mesh in the FBX");
  const g = mesh.geometry;
  const materials = [].concat(mesh.material);
  for (const m of materials) {
    if (m.map) await decoded(m.map);
    if (m.alphaMap) await decoded(m.alphaMap);
  }
  const oldBones = mesh.skeleton.bones;

  // 1. The parts, by the bone a piece hangs on and by its material.
  const materialOf = new Int16Array(g.attributes.position.count);
  for (const group of g.groups) {
    for (let i = group.start; i < group.start + group.count; i++) {
      materialOf[i] = group.materialIndex;
    }
  }
  const mouthIndex = materials.findIndex((m) => m.name === "tetra_mouth");
  const dominant = (corners) => {
    const sum = new Map();
    for (const i of corners) {
      for (let k = 0; k < 4; k++) {
        const w = g.attributes.skinWeight.getComponent(i, k);
        if (w <= 0) continue;
        const name = oldBones[g.attributes.skinIndex.getComponent(i, k)].name;
        sum.set(name, (sum.get(name) ?? 0) + w);
      }
    }
    return [...sum.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  const parts = {
    body: [],
    discL: [],
    discR: [],
    lashL: [],
    lashR: [],
    chevL: [],
    chevR: [],
    mouth: [],
  };
  const dropped = [];
  for (const piece of components(g)) {
    const bone = dominant(piece);
    const triangles = piece.length / 3;
    if (materialOf[piece[0]] === mouthIndex) {
      // The mouth is 8 drawings of 15 triangles. A second, stray piece of 8 triangles hangs
      // partly on a hair bone and is thrown to the back of the head by every mouth target.
      if (triangles === 120) parts.mouth.push(...piece);
      else dropped.push({ triangles, bone });
    } else if (bone === "eye_L" || bone === "eye_R") {
      const side = bone.endsWith("L") ? "L" : "R";
      parts[`${triangles === 28 ? "disc" : "lash"}${side}`].push(...piece);
    } else if (bone === "eyelid_L" || bone === "eyelid_R") {
      parts[`chev${bone.endsWith("L") ? "L" : "R"}`].push(...piece);
    } else {
      parts.body.push(...piece);
    }
  }
  const expected = { discL: 84, discR: 84, lashL: 51, lashR: 51, chevL: 240, chevR: 240 };
  for (const [name, count] of Object.entries(expected)) {
    if (parts[name].length !== count) {
      throw new Error(`${name}: ${parts[name].length} corners, expected ${count}`);
    }
  }
  if (parts.mouth.length !== 360) throw new Error(`the mouth has ${parts.mouth.length} corners`);

  // 2. The body and the hair: two materials, one index. No normals: nothing is lit, and the page
  // works out the smooth ones its outline needs.
  parts.body.sort((a, b) => materialOf[a] - materialOf[b] || a - b);
  const bodyLoose = subset(g, parts.body, ["position", "uv", "skinIndex", "skinWeight"]);
  const body = weld(bodyLoose);
  const bodyMaterials = [...new Set(parts.body.map((i) => materialOf[i]))];
  let start = 0;
  for (const index of bodyMaterials) {
    const count = parts.body.filter((i) => materialOf[i] === index).length;
    body.addGroup(start, count, bodyMaterials.indexOf(index));
    start += count;
  }

  // 3. The eyes and the mouth: small meshes of their own, so their targets cost little.
  const eyes = weld(buildEyes(g, parts));
  const mouthNames = Object.keys(mesh.morphTargetDictionary).filter((name) =>
    /^(mouth_|smile_mouth|grin|frown_mouth)/.test(name),
  );
  const mouth = weld(
    subset(
      g,
      parts.mouth,
      ["position", "uv"],
      mouthNames.map((name) => [
        name,
        g.morphAttributes.position[mesh.morphTargetDictionary[name]],
      ]),
    ),
  );

  // 4. The skeleton, without the bones nothing hangs on and nothing needs.
  const used = new Set([HEAD]);
  for (let i = 0; i < body.attributes.position.count; i++) {
    for (let k = 0; k < 4; k++) {
      if (body.attributes.skinWeight.getComponent(i, k) > 0) {
        used.add(oldBones[body.attributes.skinIndex.getComponent(i, k)].name);
      }
    }
  }
  const keep = new Set();
  for (const bone of oldBones) {
    if (!used.has(bone.name)) continue;
    for (let at = bone; at && at.isBone; at = at.parent) keep.add(at);
  }
  const bones = [];
  source.traverse((o) => {
    if (o.isBone && keep.has(o)) bones.push(o);
  });
  for (const bone of oldBones) if (!keep.has(bone)) bone.removeFromParent();
  const newIndex = new Map(bones.map((b, i) => [b.name, i]));
  const skinIndex = body.attributes.skinIndex;
  const remapped = new Uint16Array(skinIndex.count * 4);
  for (let i = 0; i < skinIndex.count; i++) {
    for (let k = 0; k < 4; k++) {
      const weight = body.attributes.skinWeight.getComponent(i, k);
      remapped[i * 4 + k] =
        weight > 0 ? newIndex.get(oldBones[skinIndex.getComponent(i, k)].name) : 0;
    }
  }
  body.setAttribute("skinIndex", new THREE.BufferAttribute(remapped, 4));
  weightTo(eyes, newIndex.get(HEAD));
  weightTo(mouth, newIndex.get(HEAD));

  // 5. Unlit materials: the paint already carries the shading.
  const basic = (name, map, extra = {}) => {
    const made = new THREE.MeshBasicMaterial({ map, ...extra });
    made.name = name;
    return made;
  };
  const find = (name) => materials.find((m) => m.name === name);
  const bodyMap = find("tetra_body").map;
  const hairMap = find("tetra_hair").map;
  const mouthMap = mouthPicture(find("tetra_mouth"));
  bodyMap.name = "tetra_body_base";
  hairMap.name = "tetra_hair_base";
  mouthMap.name = "tetra_mouth_base";
  for (const map of [bodyMap, hairMap, mouthMap]) map.userData = { mimeType: "image/webp" };

  const root = new THREE.Group();
  root.name = "tetra";
  const armature = source.getObjectByName("tetra_armature");
  armature.userData = {};
  armature.traverse((o) => {
    o.userData = {};
  });
  root.add(armature);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const skinned = (name, geometry, material) => {
    const made = new THREE.SkinnedMesh(geometry, material);
    made.name = name;
    made.bind(skeleton, new THREE.Matrix4());
    made.updateMorphTargets();
    root.add(made);
    return made;
  };
  skinned("tetra_body", body, [basic("tetra_body", bodyMap), basic("tetra_hair", hairMap)]);
  skinned("tetra_eyes", eyes, basic("tetra_eyes", hairMap));
  skinned("tetra_mouth", mouth, basic("tetra_mouth", mouthMap, { transparent: true }));

  // 6. The clips.
  const kept = new Set(bones.map((b) => b.name));
  const clips = [];
  const clipFacts = {};
  for (const name of CLIPS) {
    const loaded = loader.parse(await (await fetch(urls.clips[name])).arrayBuffer(), "");
    const fitted = fitClip(loaded.animations[0], name, kept, rig.skeleton.hipsPositionScale);
    clips.push(fitted.clip);
    clipFacts[name] = {
      seconds: round(fitted.clip.duration, 4),
      tracks: fitted.clip.tracks.length,
      ...(name === "walk" ? { speed: round(fitted.speed, 5) } : {}),
    };
  }

  // 7. What a GLB has no place for: the springs of the hair, the ears and the skirt, the
  // capsules they must not enter, and the facts of the clips. They ride in the scene's extras.
  const point = (v) => v.map((x) => round(x));
  root.userData = {
    springs: rig.springBones
      .filter((row) => kept.has(THREE.PropertyBinding.sanitizeNodeName(row.bone)))
      .map((row) => ({
        bone: row.bone,
        group: row.group,
        head: point(row.head),
        tail: point(row.tail),
        stiffness: row.stiffness,
        drag: row.drag,
        gravity: row.gravity,
        hitRadius: row.hitRadius,
      })),
    colliders: rig.colliders
      .filter((row) => kept.has(THREE.PropertyBinding.sanitizeNodeName(row.bone)))
      .map((row) => ({
        bone: THREE.PropertyBinding.sanitizeNodeName(row.bone),
        head: point(row.head),
        tail: point(row.tail),
        radius: row.radius,
      })),
    clips: clipFacts,
  };

  const report = {
    sourceBytes: buffer.byteLength,
    quality,
    dropped,
    bones: bones.length,
    bonesBefore: oldBones.length,
    meshes: {
      body: { corners: parts.body.length, vertices: body.attributes.position.count },
      eyes: {
        corners: eyes.index.count,
        vertices: eyes.attributes.position.count,
        targets: eyes.morphAttributes.position.map((a) => a.name),
      },
      mouth: {
        corners: mouth.index.count,
        vertices: mouth.attributes.position.count,
        targets: mouthNames,
      },
    },
    clips: clipFacts,
  };

  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  let glb;
  try {
    glb = await withQuality(
      // The mouth is flat colour on a mask: lossless, whatever the others are.
      (canvas) => (canvas.width === mouthMap.image.width ? 1 : quality),
      () =>
        new GLTFExporter().parseAsync(root, {
          binary: true,
          onlyVisible: false,
          embedImages: true,
          animations: clips,
        }),
    );
  } finally {
    console.warn = warn;
  }
  report.warnings = warnings;
  report.bytes = glb.byteLength;

  let binary = "";
  const bytes = new Uint8Array(glb);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return { report, base64: btoa(binary) };
}
