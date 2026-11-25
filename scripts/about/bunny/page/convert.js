// Mr. Bunny, Chang'e's drone, out of the source FBX, in Chrome, with the site's own three. The
// source holds Chang'e, her moon weapon and the drone as separate meshes; the drone is the mesh
// named "jiqiren" (robot) and its painted face is "jiqibiaoqing" (robot face). This keeps the
// drone only, stands it in its own frame, cuts it into the parts that move, rigs them, writes the
// morph targets and crops the picture. Node writes the file from what this returns (build.cjs).
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import {
  box,
  centroid,
  cornerNormals,
  corners,
  pieces,
  rayHit,
  refine,
  round,
  spread,
  summedNormal,
  vec,
} from "./geometry.js";
import { BLANK, cropPaint, sample } from "./paint.js";
import { BODY_TARGETS, TARGETS, makeFields } from "./targets.js";

/** What the build expects of the source. Anything else stops it. */
export const SOURCE = {
  robot: /jiqiren/,
  face: /jiqibiaoqing/,
  robotTriangles: 2080,
  faceTriangles: 88,
  /** The drone's pieces (joined by shared places) and their triangles. */
  pieces: { body: 1196, ear: 136, bracket: 12, blade: 240, screw: 54 },
  glassTriangles: 100,
};

/** The joints, in the skin's order. */
export const BONES = [
  "body",
  "ear_L_1",
  "ear_L_2",
  "ear_L_3",
  "ear_R_1",
  "ear_R_2",
  "ear_R_3",
  "foot_L",
  "foot_R",
];

/** The ears are cut until no edge runs farther than this along the ear (m), so they can bend. */
export const EAR_STEP = 0.016;
/** Where the ear's three bones start, as shares of its length from the hinge. */
const EAR_JOINTS = [0, 1 / 3, 2 / 3];
/** Half the width of the blend at each joint of the ear, as a share of its length. */
const EAR_BLEND = 0.09;
/** One pixel of the screen (m): the source's face is drawn on this grid. */
export const PIXEL = 0.005;

const flip = (v) => new THREE.Vector3(-v.x, v.y, v.z);

/** A right-handed frame from a long axis and a facing: Y is the axis, Z the facing made square. */
function frame(axisY, facingZ) {
  const y = axisY.clone().normalize();
  const z = facingZ.clone().addScaledVector(y, -facingZ.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z);
}
const column = (m, k) => new THREE.Vector3().setFromMatrixColumn(m, k);

/** FBXLoader gives the embedded pictures as blob addresses: wait until each has decoded. */
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

/** The source's meshes, as triangles in the file's world (metres, Y up). */
export async function readSource(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const root = new FBXLoader().parse(buffer, "");
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const triangles = (mesh) => {
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const P = g.attributes.position;
    const UV = g.attributes.uv;
    const index = g.index;
    const at = (i) => (index ? index.getX(i) : i);
    const count = index ? index.count : P.count;
    const out = [];
    for (let i = 0; i < count; i += 3) {
      out.push(
        [0, 1, 2].map((k) => {
          const j = at(i + k);
          return {
            p: new THREE.Vector3(P.getX(j), P.getY(j), P.getZ(j)),
            uv: [UV.getX(j), UV.getY(j)],
          };
        }),
      );
    }
    return out;
  };
  const robots = meshes.filter((m) => SOURCE.robot.test(m.name));
  const faces = meshes.filter((m) => SOURCE.face.test(m.name));
  if (robots.length !== 1) throw new Error(`${robots.length} meshes named jiqiren, expected 1`);
  const robot = triangles(robots[0]);
  const face = faces.flatMap(triangles);
  const material = [].concat(robots[0].material)[0];
  await decoded(material.map);
  return {
    bytes: buffer.byteLength,
    robot,
    face,
    image: material.map.image,
    material: material.name,
    faceMaterials: faces.map((m) => [].concat(m.material)[0].name),
    others: meshes.filter((m) => !robots.includes(m) && !faces.includes(m)).map((m) => m.name),
  };
}

export async function convert(url) {
  const source = await readSource(url);
  const report = {
    sourceBytes: source.bytes,
    meshesLeftOut: source.others,
    material: source.material,
    faceMaterials: source.faceMaterials,
  };
  if (source.robot.length !== SOURCE.robotTriangles) {
    throw new Error(
      `jiqiren has ${source.robot.length} triangles, expected ${SOURCE.robotTriangles}`,
    );
  }
  if (source.face.length !== SOURCE.faceTriangles) {
    throw new Error(
      `the face has ${source.face.length} triangles, expected ${SOURCE.faceTriangles}`,
    );
  }
  const size = source.image.naturalWidth;

  // 1. The mirror. The drone is its own mirror image across a plane of constant x: every corner
  // has a twin there, except on the round pieces of the back (a disc triangulated at a turn),
  // which are checked by their box below.
  const all = corners(source.robot);
  const whole = box(all);
  const mirrorX = (whole.min.x + whole.max.x) / 2;
  const grid = new Map();
  const cell = (p) => `${Math.round(p.x * 1e3)},${Math.round(p.y * 1e3)},${Math.round(p.z * 1e3)}`;
  for (const p of all) {
    const k = cell(p);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  const twinMiss = new Map();
  for (const p of all) {
    const m = new THREE.Vector3(2 * mirrorX - p.x, p.y, p.z);
    let best = Infinity;
    const [cx, cy, cz] = cell(m).split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const q of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? [])
            best = Math.min(best, q.distanceTo(m));
    twinMiss.set(p, best);
  }

  // 2. The pieces, by shared places: the shell, two ears, two brackets, two blades, two screws.
  const found = pieces(source.robot, false);
  const kinds = { body: [], ear: [], bracket: [], blade: [], screw: [] };
  for (const piece of found) {
    const kind = Object.entries(SOURCE.pieces).find(([, n]) => n === piece.length)?.[0];
    if (!kind) {
      throw new Error(
        `a piece of ${piece.length} triangles, expected ${JSON.stringify(SOURCE.pieces)}`,
      );
    }
    kinds[kind].push(piece);
  }
  for (const [kind, list] of Object.entries(kinds)) {
    if (list.length !== (kind === "body" ? 1 : 2)) {
      throw new Error(`${list.length} pieces of kind ${kind}`);
    }
  }
  const sideOf = (tris) => (centroid(corners(tris)).x > mirrorX ? "L" : "R");
  const bySide = (list) => {
    const out = {};
    for (const tris of list) out[sideOf(tris)] = tris;
    if (!out.L || !out.R) throw new Error("a pair is not one on each side");
    return out;
  };
  const ears = bySide(kinds.ear);
  const brackets = bySide(kinds.bracket);
  const blades = bySide(kinds.blade);
  const screws = bySide(kinds.screw);
  const shell = kinds.body[0];

  // 3. The body's own frame. The source stands upright and faces +Z already (checked below): the
  // frame is the file's, moved so that the origin is the middle of the body's box (the shell and
  // the two brackets; the ears and the feet left out).
  const bodyBox = box(corners([...shell, ...brackets.L, ...brackets.R]));
  const origin = bodyBox.getCenter(new THREE.Vector3());
  origin.x = mirrorX;
  const move = (tris) => {
    for (const t of tris) for (const c of t) c.p.sub(origin);
  };
  for (const list of [source.robot, source.face]) move(list);
  const half = bodyBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);

  // 4. The glass: the piece of the shell (cut at UV seams) that faces forward and is largest.
  const shellPieces = pieces(shell, true);
  // (The mirror, finished: a corner with no twin must be on a round piece of the back, and those
  // pieces must sit on the mirror.)
  const round_ = shellPieces.filter((t) => summedNormal(t).normalize().z < -0.9);
  // By place: the shell's corners on the rim of the round pieces share their layout.
  const placeOf = (p) =>
    `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`;
  const onRound = new Set(corners(round_.flat()).map(placeOf));
  let mirrorError = 0;
  let untwinned = 0;
  for (const [p, miss] of twinMiss) {
    if (onRound.has(placeOf(p))) {
      if (miss > 3e-4) untwinned++;
      continue;
    }
    mirrorError = Math.max(mirrorError, miss);
  }
  if (mirrorError > 3e-4) throw new Error(`the drone is not its own mirror (${mirrorError} m)`);
  let roundOff = 0;
  for (const t of round_)
    roundOff = Math.max(roundOff, Math.abs(box(corners(t)).getCenter(new THREE.Vector3()).x));
  if (roundOff > 5e-4)
    throw new Error(`a round piece of the back is off the mirror (${roundOff} m)`);
  const forward = shellPieces
    .map((tris) => {
      const n = summedNormal(tris);
      return { tris, area: n.length() / 2, z: n.z / n.length() };
    })
    .filter((p) => p.z > 0.9)
    .sort((a, b) => b.area - a.area);
  const glass = forward[0].tris;
  if (glass.length !== SOURCE.glassTriangles) {
    throw new Error(`the glass has ${glass.length} triangles, expected ${SOURCE.glassTriangles}`);
  }
  const glassSet = new Set(glass);
  const glassColour = sample(source.image, [
    glass.reduce((s, t) => s + t[0].uv[0], 0) / glass.length,
    glass.reduce((s, t) => s + t[0].uv[1], 0) / glass.length,
  ]);
  if (glassColour.some((c) => c > 60)) {
    throw new Error(`the glass is not dark: ${glassColour}`);
  }
  const normal = summedNormal(glass).normalize();
  if (Math.abs(normal.x) > 1e-3) throw new Error(`the glass faces sideways (${normal.x})`);
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  const glassPoints = corners(glass);
  const extent = (axis) => {
    const v = glassPoints.map((p) => p.dot(axis));
    return [Math.min(...v), Math.max(...v)];
  };
  const [r0, r1] = extent(right);
  const [u0, u1] = extent(up);
  const n0 = Math.max(...glassPoints.map((p) => p.dot(normal)));
  const screenCentre = new THREE.Vector3()
    .addScaledVector(right, (r0 + r1) / 2)
    .addScaledVector(up, (u0 + u1) / 2)
    .addScaledVector(normal, n0);
  const crest = shellPieces
    .map((tris) => ({ tris, n: summedNormal(tris) }))
    .sort((a, b) => b.n.y - a.n.y)[0];
  const crestUp = crest.n.clone().normalize();

  // The tip of the crest over the screen: the highest place of the glass on its middle line.
  const browTip = glassPoints
    .filter((p) => Math.abs(p.x) < 0.004)
    .reduce((best, p) => (p.y > best.y ? p : best), new THREE.Vector3(0, -1, 0));

  // 5. The ears. The long axis and the facing come from the ear's own spread (it is a flat
  // blade); the hinge is where that axis meets the shell. The two are made exact mirrors.
  const earFrame = (tris) => {
    const s = spread(corners(tris));
    const along = s.axes[2].clone();
    if (along.y < 0) along.negate();
    const facing = s.axes[0].clone();
    if (facing.z < 0) facing.negate();
    return { centre: s.centre, along, facing };
  };
  const eL = earFrame(ears.L);
  const eR = earFrame(ears.R);
  const along = eL.along.clone().add(flip(eR.along)).normalize();
  const facing = eL.facing.clone().add(flip(eR.facing)).normalize();
  const hit = (centre, dir) => {
    const d = rayHit(centre, dir.clone().negate(), shell);
    if (d === null) throw new Error("an ear's axis does not meet the shell");
    return centre.clone().addScaledVector(dir, -d);
  };
  const hingeLeft = hit(eL.centre, along);
  const hingeRight = hit(eR.centre, flip(along));
  const hinge = hingeLeft.clone().add(flip(hingeRight)).multiplyScalar(0.5);
  const earLength = Math.max(...corners(ears.L).map((p) => p.clone().sub(hinge).dot(along)));
  const earBasis = { L: frame(along, facing), R: frame(flip(along), flip(facing)) };
  const earHinge = { L: hinge, R: flip(hinge) };

  // 6. The feet. Each blade turns on a pin through the knuckle at its root: the pin runs along
  // the blade's face and across its length, so the frame comes from the blade itself (Y from the
  // pivot to the far end, Z out of the blade's face, X = Y x Z is the pin). The pin's discs (the
  // small pieces there that face along X) say where it is: the pivot is the middle of their box.
  const footFrame = (blade, screw) => {
    const parts = pieces([...blade, ...screw], true)
      .map((t) => ({ t, n: summedNormal(t) }))
      .sort((a, b) => b.n.length() - a.n.length());
    const points = corners([...parts[0].t, ...parts[1].t]);
    const small = parts.slice(2);
    const face = spread(points).axes[0].clone();
    if (face.z < 0) face.negate();
    let pivot = box(corners(small.flatMap((p) => p.t))).getCenter(new THREE.Vector3());
    let tip = null;
    let discs = [];
    let basis = null;
    for (let pass = 0; pass < 3; pass++) {
      tip = points.reduce((best, p) => (p.distanceTo(pivot) > best.distanceTo(pivot) ? p : best));
      basis = frame(tip.clone().sub(pivot), face);
      const x = column(basis, 0);
      discs = small.filter((p) => Math.abs(p.n.clone().normalize().dot(x)) > 0.95);
      const inverse = new THREE.Matrix4().copy(basis).invert();
      const local = box(
        corners(discs.flatMap((p) => p.t)).map((p) => p.clone().applyMatrix4(inverse)),
      );
      pivot = local.getCenter(new THREE.Vector3()).applyMatrix4(basis);
    }
    const x = column(basis, 0);
    const along = corners(discs.flatMap((p) => p.t)).map((p) => p.clone().sub(pivot).dot(x));
    return {
      pivot,
      tip,
      face,
      discs: discs.length,
      facingOut: discs.filter((p) => p.n.dot(x) > 0).length,
      pinLength: Math.max(...along) - Math.min(...along),
    };
  };
  const fL = footFrame(blades.L, screws.L);
  const fR = footFrame(blades.R, screws.R);
  const pivot = fL.pivot.clone().add(flip(fR.pivot)).multiplyScalar(0.5);
  const tip = fL.tip.clone().add(flip(fR.tip)).multiplyScalar(0.5);
  const footFace = fL.face.clone().add(flip(fR.face)).normalize();
  const footAlong = tip.clone().sub(pivot).normalize();
  const footBasisL = frame(footAlong, footFace);
  for (const f of [fL, fR]) {
    if (f.discs < 4 || f.facingOut < 1 || f.facingOut === f.discs || f.pinLength < 0.015) {
      throw new Error(`a blade has no pin across it: ${JSON.stringify(f)}`);
    }
  }
  const footBasis = { L: footBasisL, R: frame(flip(footAlong), flip(footFace)) };
  const footPivot = { L: pivot, R: flip(pivot) };
  const footLength = tip.distanceTo(pivot);

  // 7. The ears are cut finer along their length, so a bend has corners to bend at.
  // The right ear is the left one's mirror, corner for corner and UV for UV (checked here), so it
  // is made as that mirror: the two ears then have the same cuts, weights and targets.
  const cellOf = (p) => [Math.round(p.x * 2e3), Math.round(p.y * 2e3), Math.round(p.z * 2e3)];
  const leftByPlace = new Map();
  for (const t of ears.L) {
    for (const c of t) {
      const key = cellOf(c.p).join();
      if (!leftByPlace.has(key)) leftByPlace.set(key, []);
      leftByPlace.get(key).push(c);
    }
  }
  let earTwinMiss = 0;
  let earUvMiss = 0;
  for (const t of ears.R) {
    for (const c of t) {
      const m = flip(c.p);
      const [cx, cy, cz] = cellOf(m);
      let place = Infinity;
      let uv = Infinity;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (const q of leftByPlace.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
              const d = q.p.distanceTo(m);
              if (d > 3e-4) continue;
              place = Math.min(place, d);
              uv = Math.min(uv, Math.max(Math.abs(q.uv[0] - c.uv[0]), Math.abs(q.uv[1] - c.uv[1])));
            }
      earTwinMiss = Math.max(earTwinMiss, place);
      earUvMiss = Math.max(earUvMiss, uv);
    }
  }
  if (earTwinMiss > 3e-4 || earUvMiss > 1e-3) {
    throw new Error(`the ears are not mirrors (${earTwinMiss} m, uv ${earUvMiss})`);
  }
  const refinedL = refine(ears.L, along, EAR_STEP);
  // Mirrored, so wound the other way round to keep facing out.
  const refinedR = refinedL.map((t) =>
    [t[0], t[2], t[1]].map((c) => ({ p: flip(c.p), uv: [...c.uv] })),
  );

  // 8. The parts. Every triangle knows its part; the glass is drawn with its own material.
  const parts = [
    ["body", shell.filter((t) => !glassSet.has(t))],
    ["body", brackets.L],
    ["body", brackets.R],
    ["glass", glass],
    ["ear_L", refinedL],
    ["ear_R", refinedR],
    ["foot_L", [...blades.L, ...screws.L]],
    ["foot_R", [...blades.R, ...screws.R]],
  ];
  const tris = [];
  const partOfTri = new Map();
  for (const [part, list] of parts) {
    for (const t of list) {
      tris.push(t);
      partOfTri.set(t, part);
    }
  }
  const partOf = (t) => partOfTri.get(t);

  // 9. The pose of every bone at rest, in the body's frame.
  const rig = {
    half,
    brow: browTip,
    pod: null,
    lens: null,
    ears: {},
    feet: {},
  };
  for (const side of ["L", "R"]) {
    rig.ears[side] = {
      hinge: earHinge[side],
      basis: earBasis[side],
      axis: column(earBasis[side], 1),
      length: earLength,
    };
    rig.feet[side] = {
      hinge: footPivot[side],
      basis: footBasis[side],
      axis: column(footBasis[side], 1),
      length: footLength,
    };
  }
  // The side discs and the back lens, for their targets: the side disc is the shell piece that
  // faces most to the side, the lens the one that faces most to the back.
  const facingMost = (dir) =>
    shellPieces
      .map((t) => ({ t, n: summedNormal(t) }))
      .filter((p) => p.n.length() > 0)
      .sort((a, b) => b.n.dot(dir) / b.n.length() - a.n.dot(dir) / a.n.length())[0].t;
  const podTris = facingMost(new THREE.Vector3(1, 0, 0));
  const podBox = box(corners(podTris));
  rig.pod = {
    centre: podBox.getCenter(new THREE.Vector3()),
    radius: Math.max(podBox.max.y - podBox.min.y, podBox.max.z - podBox.min.z) / 2,
  };
  // The back plate, the lens's ring and the lens all face back from behind the middle; the lens
  // is the narrowest of them.
  const lensPiece = shellPieces
    .filter((t) => summedNormal(t).normalize().z < -0.9)
    .map((t) => ({ t, b: box(corners(t)) }))
    .filter((p) => p.b.getCenter(new THREE.Vector3()).z < 0)
    .sort((a, b) => a.b.max.x - a.b.min.x - (b.b.max.x - b.b.min.x))[0].t;
  rig.lens = {
    centre: box(corners(lensPiece)).getCenter(new THREE.Vector3()),
    normal: summedNormal(lensPiece).normalize(),
  };
  const fields = makeFields(rig);

  // 10. Bones, as the file stores them: a place and a turn in the parent's frame.
  const quat = (m) => new THREE.Quaternion().setFromRotationMatrix(m);
  const step = earLength * (EAR_JOINTS[1] - EAR_JOINTS[0]);
  const bones = [{ name: "body", parent: null, position: [0, 0, 0], rotation: [0, 0, 0, 1] }];
  for (const side of ["L", "R"]) {
    bones.push(
      {
        name: `ear_${side}_1`,
        parent: "body",
        position: earHinge[side].toArray(),
        rotation: quat(earBasis[side]).toArray(),
      },
      {
        name: `ear_${side}_2`,
        parent: `ear_${side}_1`,
        position: [0, step, 0],
        rotation: [0, 0, 0, 1],
      },
      {
        name: `ear_${side}_3`,
        parent: `ear_${side}_2`,
        position: [0, step, 0],
        rotation: [0, 0, 0, 1],
      },
    );
  }
  for (const side of ["L", "R"]) {
    bones.push({
      name: `foot_${side}`,
      parent: "body",
      position: footPivot[side].toArray(),
      rotation: quat(footBasis[side]).toArray(),
    });
  }
  bones.sort((a, b) => BONES.indexOf(a.name) - BONES.indexOf(b.name));

  // 11. Skin weights: one bone a corner, except along the ears, where each joint blends over a
  // short stretch so the ear bends as a curve.
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const skin = (part, p) => {
    if (part === "body" || part === "glass") return [[0, 1]];
    if (part.startsWith("foot")) return [[BONES.indexOf(part), 1]];
    const side = part.slice(-1);
    const q = p
      .clone()
      .sub(earHinge[side])
      .applyMatrix4(new THREE.Matrix4().copy(earBasis[side]).invert());
    const t = q.y / earLength;
    const a = smooth(EAR_JOINTS[1] - EAR_BLEND, EAR_JOINTS[1] + EAR_BLEND, t);
    const c = smooth(EAR_JOINTS[2] - EAR_BLEND, EAR_JOINTS[2] + EAR_BLEND, t);
    const first = BONES.indexOf(`ear_${side}_1`);
    return [
      [first, 1 - a],
      [first + 1, a - c],
      [first + 2, c],
    ].filter(([, w]) => w > 1e-4);
  };

  // 12. The normals the outline needs, and the picture.
  const normals = cornerNormals(tris, partOf);
  if (normals.zero > 0) throw new Error(`${normals.zero} corners have no normal`);
  const paint = cropPaint(
    source.image,
    tris.map((t) => t.map((c) => c.uv)),
  );
  if (paint.report.changedUsedTexels !== 0) throw new Error("the crop changed a used texel");

  // 13. The two primitives: welded corners, their attributes and their targets.
  const build = (keep) => {
    const index = [];
    const made = new Map();
    const position = [];
    const normal = [];
    const uv = [];
    const joints = [];
    const weights = [];
    const targets = TARGETS.map(() => []);
    tris.forEach((t, i) => {
      if (!keep(partOf(t))) return;
      t.forEach((c, k) => {
        const n = normals.normalOf(i, k);
        const u = paint.remap(c.uv);
        const key = `${partOf(t)}|${c.p.x.toFixed(6)},${c.p.y.toFixed(6)},${c.p.z.toFixed(6)}|${u[0].toFixed(6)},${u[1].toFixed(6)}|${n.x.toFixed(3)},${n.y.toFixed(3)},${n.z.toFixed(3)}`;
        let at = made.get(key);
        if (at === undefined) {
          at = position.length / 3;
          made.set(key, at);
          position.push(c.p.x, c.p.y, c.p.z);
          normal.push(n.x, n.y, n.z);
          uv.push(u[0], u[1]);
          const s = skin(partOf(t), c.p);
          for (let j = 0; j < 4; j++) {
            joints.push(s[j]?.[0] ?? 0);
            weights.push(s[j]?.[1] ?? 0);
          }
          TARGETS.forEach((name, ti) => {
            const d = fields.delta(name, partOf(t), c.p);
            targets[ti].push(d.x, d.y, d.z);
          });
        }
        index.push(at);
      });
    });
    return { position, normal, uv, joints, weights, index, targets };
  };
  const bodyPrimitive = build((part) => part !== "glass");
  const facePrimitive = build((part) => part === "glass");

  // 14. What the face is drawn from: the screen's own plane, and the source's painted face on
  // it, in pixels, for the check that the page's face matches it.
  const toScreen = (p) => {
    const d = p.clone().sub(screenCentre);
    return [d.dot(right) / PIXEL, d.dot(up) / PIXEL];
  };
  const faceGlyphs = source.face.map((t) => t.map((c) => toScreen(c.p)));
  const glassPx = glass.map((t) => t.map((c) => toScreen(c.p)));
  const cyan = sample(source.image, source.face[0][0].uv);

  // 15. What the file says about itself (the root's extras).
  const { shifts, localAtHinges } = fields.hinges();
  for (const [name, worst] of Object.entries(localAtHinges)) {
    if (worst > 5e-4) throw new Error(`${name} moves a hinge by ${worst} m`);
  }
  const all3 = (v) => vec(v, 6);
  const extras = {
    /** The body's box (the shell and its brackets) in this frame: its middle is the origin. */
    body: {
      min: all3(bodyBox.min.clone().sub(origin)),
      max: all3(bodyBox.max.clone().sub(origin)),
    },
    /** The screen: its middle, its own axes and one pixel of the face, in metres. */
    screen: {
      centre: all3(screenCentre),
      right: all3(right),
      up: all3(up),
      normal: all3(normal),
      pixel: PIXEL,
      halfWidth: round((r1 - r0) / 2 / PIXEL, 3),
      halfHeight: round((u1 - u0) / 2 / PIXEL, 3),
    },
    ears: { length: round(earLength, 6), joints: EAR_JOINTS.map((j) => round(j * earLength, 6)) },
    feet: { length: round(footLength, 6) },
    /**
     * What each body target does, at 1, to the bones that hang on the body: `shift` is how far
     * their hinge moves (the page adds it to the bone's place, see the README), `turn` how the
     * shell turns there (a quaternion the page may apply to the bone so the piece tilts along).
     */
    hinges: Object.fromEntries(
      Object.entries(shifts).map(([target, bonesOf]) => [
        target,
        Object.fromEntries(
          Object.entries(bonesOf).map(([bone, v]) => [
            bone,
            { shift: all3(v.shift), turn: v.turn.toArray().map((x) => round(x, 6)) },
          ]),
        ),
      ]),
    ),
    targets: TARGETS,
    bodyTargets: BODY_TARGETS,
  };

  Object.assign(report, {
    mirror: {
      x: round(mirrorX, 6),
      error: round(mirrorError, 7),
      roundBackPieces: round_.map((t) => t.length),
      roundBackCornersWithoutTwin: untwinned,
      roundBackOffMirror: round(roundOff, 7),
    },
    originInSource: vec(origin, 6),
    bodyHalfSize: vec(half, 5),
    pieces: Object.fromEntries(Object.entries(kinds).map(([k, l]) => [k, l.map((t) => t.length)])),
    shellPieces: shellPieces.length,
    glass: {
      triangles: glass.length,
      colour: glassColour,
      normal: vec(normal, 5),
      tiltDownDegrees: round(THREE.MathUtils.radToDeg(Math.asin(-normal.y)), 2),
      widthPx: round((r1 - r0) / PIXEL, 2),
      heightPx: round((u1 - u0) / PIXEL, 2),
    },
    crestUp: vec(crestUp, 5),
    brow: vec(browTip, 5),
    pod: { centre: vec(rig.pod.centre, 5), radius: round(rig.pod.radius, 5) },
    lens: { centre: vec(rig.lens.centre, 5), normal: vec(rig.lens.normal, 4) },
    ears: {
      along: vec(along, 5),
      facing: vec(facing, 5),
      hinge: vec(hinge, 5),
      hingeMirrorError: round(hingeLeft.distanceTo(flip(hingeRight)), 7),
      axisMirrorDegrees: round(THREE.MathUtils.radToDeg(eL.along.angleTo(flip(eR.along))), 4),
      length: round(earLength, 5),
      trianglesBefore: ears.L.length,
      trianglesAfter: refinedL.length,
    },
    feet: {
      pivot: vec(pivot, 5),
      along: vec(footAlong, 5),
      face: vec(footFace, 5),
      pinDiscs: fL.discs,
      pinLength: round(fL.pinLength, 5),
      pivotMirrorError: round(fL.pivot.distanceTo(flip(fR.pivot)), 7),
      length: round(footLength, 5),
    },
    normals: { zero: normals.zero },
    picture: { ...paint.report, blank: BLANK, cyan },
    vertices: {
      body: bodyPrimitive.position.length / 3,
      face: facePrimitive.position.length / 3,
    },
    triangles: { body: bodyPrimitive.index.length / 3, face: facePrimitive.index.length / 3 },
  });

  return {
    report,
    bones,
    extras,
    primitives: { body: bodyPrimitive, face: facePrimitive },
    targets: TARGETS,
    picture: paint.canvas.toDataURL("image/png"),
    faceGlyphs,
    glassPx,
  };
}
