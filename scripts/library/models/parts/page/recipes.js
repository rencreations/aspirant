// One recipe per view: which source, which pieces, how they are turned and placed. Each returns
// { object, report }. The README says why each view is cut the way it is.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  THREE,
  loadModel,
  pieces,
  islands,
  pick,
  boxOf,
  standard,
  principalAxes,
  basisRotation,
  shiftUvTiles,
} from "./lib.js";

/** The files the current room shows (game client OBJ files), in the R2 mirror. */
const CLIENT = "D:/ren/aspirant-r2/library/v1/others/3d";
/** The rigged conversions (Mixamo skeletons). */
const RIGGED = "D:/ren/aspirant/3d";

/** Every character view's figure (its body, face and hair) is this tall; items keep the owner's factor. */
const FIGURE_HEIGHT = 2.0;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fmt = (v) => v.toArray().map((x) => +x.toFixed(3));

/** A client OBJ as pieces, each with its islands (computed once, on demand). */
async function client(file, { scale = 1 } = {}) {
  const { root } = await loadModel(`${CLIENT}/${file}`);
  const list = pieces(root, { scale });
  for (const p of list) {
    let cached = null;
    Object.defineProperty(p, "islands", {
      get() {
        if (!cached) {
          cached = islands(p.geometry).map((tris, i) => {
            const geometry = pick(p.geometry, tris);
            const box = boxOf(geometry);
            return {
              i,
              tris: tris.length,
              geometry,
              box,
              center: box.getCenter(V(0, 0, 0)),
              size: box.getSize(V(0, 0, 0)),
            };
          });
        }
        return cached;
      },
    });
  }
  return list;
}

const has = (re) => (p) => re.test(p.object) || re.test(p.material);

/** The islands of the pieces that pass `pieceTest` and `islandTest`, as { geometry, mat, name }. */
function chosenIslands(list, pieceTest, islandTest) {
  const out = [];
  for (const p of list.filter(pieceTest)) {
    for (const isl of p.islands) {
      if (islandTest(isl, p))
        out.push({
          geometry: isl.geometry,
          mat: p.mat,
          name: `${p.object}#${isl.i}`,
          tris: isl.tris,
          center: isl.center,
        });
    }
  }
  return out;
}

/** Whole pieces as { geometry, mat, name }. */
const whole = (list, test) =>
  list.filter(test).map((p) => ({ geometry: p.geometry.clone(), mat: p.mat, name: p.object }));

/** The bounding box of parts. */
function boxOfParts(parts) {
  const b = new THREE.Box3();
  for (const p of parts) b.union(boxOf(p.geometry));
  return b;
}

const materialCache = new Map();
/** One plain material per source material (shared, so the file has one material per picture). */
function materialOf(mat) {
  if (!materialCache.has(mat)) materialCache.set(mat, standard(mat));
  return materialCache.get(mat);
}

/**
 * Builds the output group. `merge`: one mesh per material (items); otherwise one mesh per source
 * piece (characters keep their parts' names).
 */
function build(parts, { merge = false, name }) {
  const group = new THREE.Group();
  group.name = name;
  if (merge) {
    const byMat = new Map();
    for (const p of parts) {
      if (!byMat.has(p.mat)) byMat.set(p.mat, []);
      byMat.get(p.mat).push(p.geometry);
    }
    for (const [mat, geos] of byMat) {
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos);
      shiftUvTiles(geo);
      const mesh = new THREE.Mesh(geo, materialOf(mat));
      mesh.name = `${name}_${mat.name}`.replace(/[^A-Za-z0-9_.-]+/g, "_");
      group.add(mesh);
    }
  } else {
    for (const p of parts) {
      shiftUvTiles(p.geometry);
      const mesh = new THREE.Mesh(p.geometry, materialOf(p.mat));
      mesh.name = p.name.replace(/[^A-Za-z0-9_.-]+/g, "_");
      group.add(mesh);
    }
  }
  return group;
}

/** Applies a matrix to the parts' vertices (nothing is left on the nodes). */
function bake(parts, matrix) {
  for (const p of parts) {
    p.geometry.applyMatrix4(matrix);
  }
}

/**
 * The factor that makes the figure FIGURE_HEIGHT tall, and the placement of a character: the
 * figure's middle on x = 0, z = 0, the lowest point of the whole view on y = 0.
 */
function placeCharacter(parts, figure) {
  const fb = boxOfParts(figure);
  const factor = FIGURE_HEIGHT / (fb.max.y - fb.min.y);
  bake(parts, new THREE.Matrix4().makeScale(factor, factor, factor));
  const f2 = boxOfParts(figure);
  const all = boxOfParts(parts);
  const c = f2.getCenter(V(0, 0, 0));
  bake(parts, new THREE.Matrix4().makeTranslation(-c.x, -all.min.y, -c.z));
  placements.set(parts, { factor, offset: [-c.x, -all.min.y, -c.z] });
  return factor;
}
/** How each character was placed (a source point p lands at p * factor + offset), for the report. */
const placements = new WeakMap();

/** An item: scaled by its owner's factor, turned by `rotation`, its box's middle on the origin. */
function placeItem(parts, factor, rotation) {
  bake(parts, new THREE.Matrix4().makeScale(factor, factor, factor));
  if (rotation) bake(parts, rotation);
  const c = boxOfParts(parts).getCenter(V(0, 0, 0));
  bake(parts, new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
}

/**
 * The turn that stands a long item up: its length (major axis) on +Y with the end nearest `tip`
 * (a direction in the source) at the top, its width (middle axis) on X and its thin side toward Z,
 * the face nearest `front` toward +Z.
 */
function standUp(parts, { tip, front }) {
  const { axes } = principalAxes(parts.map((p) => p.geometry));
  const [major, middle, minor] = axes;
  if (major.dot(tip) < 0) major.negate();
  if (front && minor.dot(front) < 0) minor.negate();
  const mid = new THREE.Vector3().crossVectors(major, minor); // right-handed: x = y cross z
  return basisRotation([mid, major], [V(1, 0, 0), V(0, 1, 0)]);
}

/** The turn that lays a long item level: its length on +X with the end nearest `muzzle` at +X, `up` on +Y. */
function layLevel(parts, { muzzle, up }) {
  const { axes } = principalAxes(parts.map((p) => p.geometry));
  const [major, middle] = axes;
  if (major.dot(muzzle) < 0) major.negate();
  const upAxis = middle.clone();
  if (upAxis.dot(up) < 0) upAxis.negate();
  return basisRotation([major, upAxis], [V(1, 0, 0), V(0, 1, 0)]);
}

function report(parts, extra = {}) {
  const b = boxOfParts(parts);
  const place = placements.get(parts);
  return {
    size: fmt(b.getSize(V(0, 0, 0))),
    min: fmt(b.min),
    max: fmt(b.max),
    parts: parts.map((p) => p.name),
    ...(place
      ? {
          place: {
            factor: +place.factor.toFixed(5),
            offset: place.offset.map((x) => +x.toFixed(4)),
          },
        }
      : {}),
    ...extra,
  };
}

// ------------------------------------------------------------------------------------------ Fanny
// Client file: drone (jiqiren007_0 and _1), two weapon sets (fanni_wuqi_0, one blade and one
// thruster each, the first set at x < 1.7), body, hair, eyes and face.
async function fanny() {
  const list = await client("fanny/hero_fanny_skin09_high_add.obj");
  const figure = whole(list, (p) => !/jiqiren|wuqi/.test(p.object));
  const factor = placeCharacter(figure, figure);
  return { list, figure, factor };
}
const FANNY_BLADE = (isl) => isl.tris > 1000 && isl.size.x > 1.4 && isl.center.x < 1.7;
const FANNY_THRUSTER = (isl) => !FANNY_BLADE(isl) && isl.size.x < 1.4 && isl.center.x < 1.7;

// ------------------------------------------------------------------------------------------ Layla
// Client file: drone, the Malefic Gun (leila_2, every island), body, hair and face.
async function layla() {
  const list = await client("layla/hero_shooter_skin08_high_add.obj");
  const figure = whole(list, (p) => !/jiqiren|leila_2/.test(p.object));
  const factor = placeCharacter(figure, figure);
  return { list, figure, factor };
}

// ----------------------------------------------------------------------------------------- Lesley
// Client file: body, faces, head ornament (toushi), hair, the sniper (weapon) and the shoulder
// mecha (NPC01). The main view is the whole file, as the room drew it.
async function lesley() {
  const list = await client("lesley/lesley.obj");
  const parts = whole(list, () => true);
  const figure = parts.filter((p) => !/weapon|NPC01/.test(p.name));
  const factor = placeCharacter(parts, figure);
  return { list, parts, factor };
}

// ---------------------------------------------------------------------------------------- Chang'e
// Client file: body, faces, eyes, glasses (a see-through effect, opacity 0.758 as in the room), hair,
// the crescent moon (weapon), Mr. Bunny (jiqiren) and his face (jiqibiaoqing), and three empty
// face meshes (material None) the room hid.
async function change() {
  const list = await client("change/change.obj");
  const parts = whole(list, (p) => !/jiqi/.test(p.object) && p.material !== "None");
  const figure = parts.filter((p) => /_body_|_face_|_hair_/.test(p.name));
  const factor = placeCharacter(parts, figure);
  return { list, parts, factor };
}

// -------------------------------------------------------------------------------------- Guinevere
// Client file (a hundredth of the size of the others, scaled up before the islands are found): the
// two drones (weapon01 and weapon01.001), hair, eyes, face, body02, a one-triangle alpha stub
// (body01_alpha), and body01, whose island in her right palm is a small charm.
const GUIN_SCALE = 100;
const GUIN_CHARM = (isl, p) =>
  /0000_Guinevere_skin10_high_body01/.test(p.object) &&
  isl.tris > 100 &&
  isl.tris < 220 &&
  isl.center.x < -0.2 &&
  isl.center.y > 1.15 &&
  isl.center.y < 1.25 &&
  isl.center.z > 0.15;
async function guinevere() {
  const list = await client("guinevere/guinevere.obj", { scale: GUIN_SCALE });
  const keep = list.filter((p) => !/weapon01|body01_alpha/.test(p.object));
  const parts = [];
  for (const p of keep) {
    if (/0000_Guinevere_skin10_high_body01/.test(p.object)) {
      // body01 without the charm: every island but that one.
      const rest = p.islands.filter((isl) => !GUIN_CHARM(isl, p));
      parts.push({
        geometry: mergeGeometries(rest.map((i) => i.geometry)),
        mat: p.mat,
        name: p.object,
      });
    } else parts.push({ geometry: p.geometry.clone(), mat: p.mat, name: p.object });
  }
  const factor = placeCharacter(parts, parts);
  return { list, parts, factor };
}

// ----------------------------------------------------------------------------------------- Vexana
// Client file: body01, body02 (the staff is its largest island, the white cap of the staff head
// is island 9), hair, face, eyes, the see-through cape (Material.009, opacity 0.76 as in the room)
// and a sphere with a missing picture (Material.010) that the room hid.
async function vexana() {
  const list = await client("vexana/vexana.obj");
  const parts = whole(list, (p) => p.material !== "Material.010");
  const figure = parts.filter((p) => !/body02\.000/.test(p.name));
  const factor = placeCharacter(parts, figure);
  return { list, parts, factor };
}
const VEX_STAFF = (isl, p) =>
  /high_body02_mat$/.test(p.material) &&
  ((isl.tris > 1500 && isl.center.x < -0.3) ||
    (isl.tris === 150 && isl.center.x < -0.6 && isl.center.y > 1.5));

// --------------------------------------------------------------------------------- Eternal Guard
// Client file: body03, hair03 and weapon02: the sword (its largest island), four gold and four black
// stars, and four purple crystals.
async function eternalGuard() {
  const list = await client("vexana-eternal-guard/vexana-eternal-guard.obj");
  const parts = whole(list, () => true);
  const figure = parts.filter((p) => !/weapon02/.test(p.name));
  const factor = placeCharacter(parts, figure);
  return { list, parts, factor };
}
const EG_SWORD = (isl, p) => /weapon02/.test(p.object) && isl.tris > 1000;

// ---------------------------------------------------------------------------------------- rigged
/**
 * A rigged conversion as three loads it (the bone frames are kept exactly), with plain materials.
 *
 * FBXLoader gives every skinned mesh of a file its own copy of a shared bone, nested inside the
 * first one with no offset of its own. Written out as they are, the copies would get new names
 * (mixamorigSpine1_1, _2...) and a turn of `mixamorigSpine1` would move one mesh only. So every
 * mesh is bound to the outermost copy (which has the same place in the bind pose), and the inner
 * copies are removed: the file has one skeleton with the source's names.
 *
 * The generated mouth patches (a `*_mouth` material over the mouth painted on the face) are left
 * out: the face shows the game's own painted mouth.
 */
async function rigged(file) {
  const { root } = await loadModel(`${RIGGED}/${file}`);
  root.updateMatrixWorld(true);
  const outer = (bone) => {
    let b = bone;
    while (b.parent?.isBone && b.parent.name === b.name) b = b.parent;
    return b;
  };
  const meshes = [];
  root.traverse((o) => o.isSkinnedMesh && meshes.push(o));
  let worst = 0;
  for (const mesh of meshes) {
    const bones = mesh.skeleton.bones.map((b) => {
      const o = outer(b);
      const d = o.matrixWorld.elements.reduce(
        (m, v, i) => Math.max(m, Math.abs(v - b.matrixWorld.elements[i])),
        0,
      );
      worst = Math.max(worst, d);
      return o;
    });
    mesh.bind(
      new THREE.Skeleton(
        bones,
        mesh.skeleton.boneInverses.map((m) => m.clone()),
      ),
      mesh.bindMatrix.clone(),
    );
  }
  if (worst > 1e-5)
    throw new Error(`${file}: a bone copy is not where its outer bone is (${worst})`);
  const inner = [];
  root.traverse((o) => o.isBone && o.parent?.isBone && o.parent.name === o.name && inner.push(o));
  for (const b of inner) {
    if (b.children.some((c) => c.name !== b.name))
      throw new Error(`${file}: bone copy ${b.name} has children of its own`);
    b.removeFromParent();
  }
  root.traverse((o) => {
    if (!o.isMesh) return;
    // Vertex colours would turn colour multiplication on in the viewer; the sources have none that matter.
    o.geometry.deleteAttribute("color");
    const mats = [o.material].flat();
    if (o.geometry.groups.length) {
      o.geometry.groups = o.geometry.groups.filter(
        (g) => !/_mouth$/.test(mats[g.materialIndex ?? 0].name),
      );
    }
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => materialOf(m))
      : materialOf(o.material);
    o.geometry.name = o.name;
    o.frustumCulled = false;
  });
  root.animations = [];
  const names = [];
  root.traverse((o) => o.isBone && names.push(o.name));
  if (new Set(names).size !== names.length) throw new Error(`${file}: bone names are not unique`);
  return root;
}

/** The scythe file: upright already (shaft on Y, blade at the top in the XY plane, origin on the shaft). */
async function scytheMesh() {
  const root = await rigged("ruby/scythe.fbx");
  let mesh = null;
  root.traverse((o) => o.isMesh && (mesh = o));
  return mesh;
}

/** Ruby's hold: the bend of each finger joint (degrees, base to tip), the thumb's turns, the shaft's offset. */
const RUBY_GRIP = {
  elbow: -50,
  twist: 1,
  curl: [60, 70, 45],
  thumb: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  offset: [0, 0.075, 0.03],
};

// --------------------------------------------------------------------------------------- recipes
export const RECIPES = {
  async fanny() {
    const { figure } = await fanny();
    return { object: build(figure, { name: "fanny" }), report: report(figure) };
  },
  async "fanny-blade"() {
    const { list, factor } = await fanny();
    const parts = chosenIslands(list, has(/wuqi/), FANNY_BLADE);
    // The blade lies along +X with its tip at +X: a quarter turn about Z stands it up, tip on top,
    // its flat toward the front.
    placeItem(parts, factor, new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    return {
      object: build(parts, { merge: true, name: "fanny_blade" }),
      report: report(parts, { factor }),
    };
  },
  async "fanny-thruster"() {
    const { list, factor } = await fanny();
    const parts = chosenIslands(list, has(/wuqi/), FANNY_THRUSTER);
    // Level as it sits under the blade, nose toward +X, its side toward the front.
    placeItem(parts, factor, null);
    return {
      object: build(parts, { merge: true, name: "fanny_thruster" }),
      report: report(parts, { factor }),
    };
  },
  async layla() {
    const { figure } = await layla();
    return { object: build(figure, { name: "layla" }), report: report(figure) };
  },
  async "layla-gun"() {
    const { list, factor } = await layla();
    const parts = whole(list, (p) => /leila_2/.test(p.object));
    // The gun lies along X with its muzzle at -X: half a turn about Y.
    placeItem(parts, factor, new THREE.Matrix4().makeRotationY(Math.PI));
    return {
      object: build(parts, { merge: true, name: "layla_gun" }),
      report: report(parts, { factor }),
    };
  },
  async lesley() {
    const { parts } = await lesley();
    return { object: build(parts, { name: "lesley" }), report: report(parts) };
  },
  async "lesley-sniper"() {
    const { list, factor } = await lesley();
    const parts = whole(list, (p) => /0007_Lesley_skin10_high_weapon/.test(p.object));
    // She holds it barrel up: the top end is the muzzle.
    placeItem(parts, factor, layLevel(parts, { muzzle: V(0, 1, 0), up: V(0, 0, -1) }));
    return {
      object: build(parts, { merge: true, name: "lesley_sniper" }),
      report: report(parts, { factor }),
    };
  },
  async "lesley-mecha"() {
    const { list, factor } = await lesley();
    const parts = whole(list, (p) => /NPC01/.test(p.object));
    // Both wings, as they sit on her shoulders (their front is her front, +Z).
    placeItem(parts, factor, null);
    return {
      object: build(parts, { merge: true, name: "lesley_mecha" }),
      report: report(parts, { factor }),
    };
  },
  async change() {
    const { parts } = await change();
    return { object: build(parts, { name: "change" }), report: report(parts) };
  },
  async "change-moon"() {
    const { list, factor } = await change();
    const parts = whole(list, (p) => /0010_change_skin09_high_weapon/.test(p.object));
    // The crescent's plane is its thinnest direction: turned (the least turn) so it faces +Z.
    const { axes } = principalAxes(parts.map((p) => p.geometry));
    const n = axes[2].clone();
    if (n.z < 0) n.negate();
    const q = new THREE.Quaternion().setFromUnitVectors(n, V(0, 0, 1));
    placeItem(parts, factor, new THREE.Matrix4().makeRotationFromQuaternion(q));
    return {
      object: build(parts, { merge: true, name: "change_moon" }),
      report: report(parts, { factor, normal: fmt(n) }),
    };
  },
  async guinevere() {
    const { parts } = await guinevere();
    return { object: build(parts, { name: "guinevere" }), report: report(parts) };
  },
  async "guinevere-weapon"() {
    const { list, factor } = await guinevere();
    const parts = chosenIslands(list, has(/0000_Guinevere_skin10_high_body01/), GUIN_CHARM);
    // A flat charm: its face (thinnest direction) toward +Z, its long side up.
    const { axes } = principalAxes(parts.map((p) => p.geometry));
    const [major, , minor] = axes;
    if (minor.z < 0) minor.negate();
    if (major.y < 0) major.negate();
    const rot = basisRotation([major, minor], [V(0, 1, 0), V(0, 0, 1)]);
    placeItem(parts, factor, rot);
    return {
      object: build(parts, { merge: true, name: "guinevere_weapon" }),
      report: report(parts, { factor, tris: parts.map((p) => p.tris) }),
    };
  },
  async vexana() {
    const { parts } = await vexana();
    return { object: build(parts, { name: "vexana" }), report: report(parts) };
  },
  async "vexana-staff"() {
    const { list, factor } = await vexana();
    const parts = chosenIslands(list, () => true, VEX_STAFF);
    // The head is at the upper end (-X, +Y in the source).
    placeItem(parts, factor, standUp(parts, { tip: V(-1, 1.5, 0), front: V(0, 0, 1) }));
    return {
      object: build(parts, { merge: true, name: "vexana_staff" }),
      report: report(parts, { factor, tris: parts.map((p) => p.tris) }),
    };
  },
  async "eternal-guard"() {
    const { parts } = await eternalGuard();
    return { object: build(parts, { name: "eternal_guard" }), report: report(parts) };
  },
  async "eternal-guard-sword"() {
    const { list, factor } = await eternalGuard();
    const parts = chosenIslands(list, () => true, EG_SWORD);
    // He holds it blade down: the blade's tip is at -X, -Y in the source.
    placeItem(parts, factor, standUp(parts, { tip: V(-1, -0.7, 0), front: V(0, 0, 1) }));
    return {
      object: build(parts, { merge: true, name: "eternal_guard_sword" }),
      report: report(parts, { factor, tris: parts.map((p) => p.tris) }),
    };
  },
  async ruby() {
    const root = await rigged("ruby/ruby.fbx");
    const scythe = await scytheMesh();
    const socket = root.getObjectByName("weapon_R");
    const forearm = root.getObjectByName("mixamorigRightForeArm");
    const hand = root.getObjectByName("mixamorigRightHand");
    const axisOf = (bone, v) =>
      v.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion())).normalize();
    // The hand closes round the shaft only if the shaft runs across the palm (along the hand's own
    // X, from the little finger to the index). In the resting pose that axis points forward, so the
    // elbow bends and the forearm and the wrist each turn half of the twist (about their own
    // length, Y) that brings it nearest to upright. The resting pose of these bones is all that
    // changes; names and axes stay.
    // First the elbow bends (about the forearm's own Z), so the hand comes forward of the skirt.
    forearm.quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        V(0, 0, 1),
        THREE.MathUtils.degToRad(RUBY_GRIP.elbow),
      ),
    );
    root.updateMatrixWorld(true);
    const f0 = forearm.quaternion.clone(),
      h0 = hand.quaternion.clone();
    const twist = (deg) => {
      const half = new THREE.Quaternion().setFromAxisAngle(
        V(0, 1, 0),
        THREE.MathUtils.degToRad(deg / 2),
      );
      forearm.quaternion.copy(f0).multiply(half);
      hand.quaternion.copy(h0).multiply(half);
      root.updateMatrixWorld(true);
    };
    let best = 0,
      bestUp = -2;
    for (let deg = -180; deg <= 180; deg += 1) {
      twist(deg);
      const up = axisOf(hand, V(1, 0, 0)).y;
      if (up > bestUp) ((bestUp = up), (best = deg));
    }
    twist(best * RUBY_GRIP.twist);
    for (const finger of ["Index", "Middle", "Ring", "Pinky"]) {
      RUBY_GRIP.curl.forEach((deg, k) => {
        const bone = root.getObjectByName(`mixamorigRightHand${finger}${k + 1}`);
        bone.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), THREE.MathUtils.degToRad(deg)),
        );
      });
    }
    RUBY_GRIP.thumb.forEach((deg, k) => {
      const bone = root.getObjectByName(`mixamorigRightHandThumb${k + 1}`);
      bone.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...deg.map((d) => THREE.MathUtils.degToRad(d))),
        ),
      );
    });
    root.updateMatrixWorld(true);
    // The shaft (the scythe's own Y, its origin on the shaft) along the hand's X, through the palm
    // (RUBY_GRIP.offset in the hand's axes); the blade's broad side toward the front, its edge away
    // from her.
    const hx = axisOf(hand, V(1, 0, 0)),
      hy = axisOf(hand, V(0, 1, 0)),
      hz = axisOf(hand, V(0, 0, 1));
    const at = hand
      .getWorldPosition(V(0, 0, 0))
      .addScaledVector(hx, RUBY_GRIP.offset[0])
      .addScaledVector(hy, RUBY_GRIP.offset[1])
      .addScaledVector(hz, RUBY_GRIP.offset[2]);
    const shaft = hx.clone();
    let face = V(0, 0, 1).addScaledVector(shaft, -shaft.z).normalize();
    let blade = new THREE.Vector3().crossVectors(shaft, face);
    if (blade.x > 0) ((face = face.negate()), (blade = blade.negate()));
    const turn = new THREE.Matrix4().makeBasis(blade, shaft, face);
    const world = new THREE.Matrix4().compose(
      at,
      new THREE.Quaternion().setFromRotationMatrix(turn),
      V(1, 1, 1),
    );
    const local = socket.matrixWorld.clone().invert().multiply(world);
    local.decompose(scythe.position, scythe.quaternion, scythe.scale);
    scythe.name = "ruby_scythe";
    socket.add(scythe);
    root.name = "ruby";
    return {
      object: root,
      report: { socket: "weapon_R", twist: best * RUBY_GRIP.twist, shaft: fmt(shaft) },
    };
  },
  async "ruby-scythe"() {
    const scythe = await scytheMesh();
    scythe.updateMatrixWorld(true);
    const geo = scythe.geometry.clone();
    geo.applyMatrix4(scythe.matrixWorld);
    const parts = [{ geometry: geo, mat: scythe.material, name: "ruby_scythe" }];
    placeItem(parts, 1, null);
    const group = new THREE.Group();
    group.name = "ruby_scythe";
    const mesh = new THREE.Mesh(geo, scythe.material);
    mesh.name = "ruby_scythe";
    group.add(mesh);
    return { object: group, report: report(parts) };
  },
  async angela() {
    const root = await rigged("angela/angela.fbx");
    root.name = "angela";
    return { object: root, report: {} };
  },
  async "aspirant-drone"() {
    const root = await rigged("angela/drone.fbx");
    root.name = "aspirant_drone";
    return { object: root, report: {} };
  },
};
