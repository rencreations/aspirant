// Guinevere's drone, FBX to GLB, in Chrome, with the site's own three. The source is one skinned
// mesh in a tilted pose, with every corner wholly on one of five bones. This takes it apart into
// six rigid parts, stands the body upright, gives every part a pivot and a frame that mean
// something (see README.md), cleans the painted face off the screen and writes one small file.
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const round = (n, digits = 5) => {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
};
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Where the parts of the paint are on the picture (512 by 512), in pixels from the top left. */
const PAINT = {
  /** A point inside the screen's island (a heart). */
  screen: [350, 110],
  /** The red belt round the body: a strip along the top of the picture. */
  belt: { left: 2, top: 44, right: 232, bottom: 67 },
  /** The two big shells of the ball, for the sphere. */
  shell: { left: 3, top: 240, right: 365, bottom: 508 },
  /** The middle of the star on the back of the glove. */
  star: [413, 336],
  starReach: 34,
};

/** How far the fist is turned about its own axis from the shape's first guess, in degrees. */
const GLOVE_ROLL = 135;

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

/** The corners of the source, sorted by the bone that carries them. */
async function read(url) {
  const buffer = await (await fetch(url)).arrayBuffer();
  const root = new FBXLoader().parse(buffer, "");
  let mesh = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh) mesh = o;
  });
  if (!mesh) throw new Error("no skinned mesh in the source");
  const g = mesh.geometry;
  const P = g.attributes.position;
  const UV = g.attributes.uv;
  const SI = g.attributes.skinIndex;
  const SW = g.attributes.skinWeight;
  const parts = {};
  let blended = 0;
  for (let i = 0; i < P.count; i += 3) {
    const bone = mesh.skeleton.bones[SI.getX(i)].name;
    for (let k = 0; k < 3; k++) {
      if (SW.getX(i + k) < 0.999 || mesh.skeleton.bones[SI.getX(i + k)].name !== bone) blended++;
      const part = (parts[bone] ??= { p: [], uv: [] });
      part.p.push(new THREE.Vector3(P.getX(i + k), P.getY(i + k), P.getZ(i + k)));
      // The mirrored half of every part has its picture one whole tile to the right.
      part.uv.push([UV.getX(i + k), UV.getY(i + k)]);
    }
  }
  const material = [].concat(mesh.material)[0];
  await decoded(material.map);
  const bones = mesh.skeleton.bones.map((b) => ({
    name: b.name,
    parent: b.parent?.name ?? null,
    position: b.position.toArray().map((v) => round(v)),
  }));
  return { parts, image: material.map.image, bytes: buffer.byteLength, blended, bones };
}

/** The pixel a corner's UV falls on, with the mirrored tile folded back. */
const pixel = (uv, size) => [(uv[0] - Math.floor(uv[0])) * size, (1 - uv[1]) * size];
const inside = (px, box) =>
  px[0] >= box.left && px[0] <= box.right && px[1] >= box.top && px[1] <= box.bottom;

/** The corners that hang together through shared places and shared UVs, as lists of corners. */
function islands(part) {
  const n = part.p.length;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const p = part.p[i];
    const key = `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}|${Math.round(part.uv[i][0] * 1e4)},${Math.round(part.uv[i][1] * 1e4)}`;
    if (seen.has(key)) join(i, seen.get(key));
    else seen.set(key, i);
  }
  for (let i = 0; i < n; i += 3) {
    join(i, i + 1);
    join(i, i + 2);
  }
  const out = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!out.has(r)) out.set(r, []);
    out.get(r).push(i);
  }
  return [...out.values()];
}

/** Eigenvectors of a symmetric 3 by 3 matrix (Jacobi), smallest eigenvalue first. */
function eigen(m) {
  const a = m.map((row) => row.slice());
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 60; sweep++) {
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p];
        const akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k];
        const aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p];
        const vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return [0, 1, 2]
    .map((i) => ({ value: a[i][i], vector: new THREE.Vector3(v[0][i], v[1][i], v[2][i]) }))
    .sort((x, y) => x.value - y.value);
}

const centroid = (points) => {
  const c = new THREE.Vector3();
  for (const p of points) c.add(p);
  return c.multiplyScalar(1 / Math.max(1, points.length));
};

/** The normal of the plane that fits the points best. */
function planeNormal(points) {
  const c = centroid(points);
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const d = [p.x - c.x, p.y - c.y, p.z - c.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += d[i] * d[j];
  }
  return eigen(m)[0].vector.normalize();
}

/** The sphere that fits the points best: its middle and its radius. */
function sphere(points) {
  // x2 + y2 + z2 = 2ax + 2by + 2cz + d, solved for a, b, c, d by least squares.
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0, 0]);
  for (const p of points) {
    const row = [2 * p.x, 2 * p.y, 2 * p.z, 1];
    const rhs = p.lengthSq();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j];
      A[i][4] += row[i] * rhs;
    }
  }
  for (let i = 0; i < 4; i++) {
    let best = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[best][i])) best = r;
    [A[i], A[best]] = [A[best], A[i]];
    for (let r = 0; r < 4; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let k = i; k < 5; k++) A[r][k] -= f * A[i][k];
    }
  }
  const s = [0, 1, 2, 3].map((i) => A[i][4] / A[i][i]);
  const centre = new THREE.Vector3(s[0], s[1], s[2]);
  return { centre, radius: Math.sqrt(s[3] + centre.lengthSq()) };
}

/** The face normals of a list of corners, summed (each as long as twice its triangle's area). */
function summedNormal(part, corners) {
  const sum = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const taken = new Set(corners.map((i) => i - (i % 3)));
  for (const i of taken) {
    ab.subVectors(part.p[i + 1], part.p[i]);
    ac.subVectors(part.p[i + 2], part.p[i]);
    sum.add(ab.cross(ac));
  }
  return sum;
}

/** A right-handed frame from a long axis and a facing: Y is the axis, Z the facing made square. */
function frame(axisY, facingZ) {
  const y = axisY.clone().normalize();
  const z = facingZ.clone().addScaledVector(y, -facingZ.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z);
}

/**
 * One part as an indexed geometry: equal corners are joined, and every corner carries the mean of
 * the face normals at its place, so the outline's hull has no gaps at the hard edges. `folded`
 * UVs: the mirrored tile is brought back onto the picture.
 */
function geometry(points, uvs) {
  const n = points.length;
  const placeKey = (p) =>
    `${Math.round(p.x * 2e5)},${Math.round(p.y * 2e5)},${Math.round(p.z * 2e5)}`;
  const sums = new Map();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < n; i += 3) {
    ab.subVectors(points[i + 1], points[i]);
    ac.subVectors(points[i + 2], points[i]);
    const face = new THREE.Vector3().crossVectors(ab, ac);
    volume += points[i].dot(face) / 6;
    for (let k = 0; k < 3; k++) {
      const key = placeKey(points[i + k]);
      if (!sums.has(key)) sums.set(key, new THREE.Vector3());
      sums.get(key).add(face);
    }
  }
  const index = [];
  const position = [];
  const normal = [];
  const uv = [];
  const made = new Map();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const u = uvs[i][0] - Math.floor(uvs[i][0]);
    const v = uvs[i][1];
    const key = `${placeKey(p)}|${Math.round(u * 1e4)},${Math.round(v * 1e4)}`;
    let at = made.get(key);
    if (at === undefined) {
      at = position.length / 3;
      made.set(key, at);
      position.push(p.x, p.y, p.z);
      const s = sums.get(placeKey(p)).clone().normalize();
      normal.push(s.x, s.y, s.z);
      uv.push(u, v);
    }
    index.push(at);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normal), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(index);
  return { geometry: g, triangles: n / 3, vertices: position.length / 3, volume };
}

/**
 * The picture with the painted face taken off the screen: the hearts and the mouth are filled
 * with the navy round them, so the page can draw the face itself. Everything else is untouched.
 */
function cleanPicture(image, body, screenCorners) {
  const size = image.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const x = canvas.getContext("2d", { willReadFrequently: true });
  x.drawImage(image, 0, 0);
  // The screen's island, drawn as a mask.
  const mask = document.createElement("canvas");
  mask.width = mask.height = size;
  const m = mask.getContext("2d", { willReadFrequently: true });
  m.fillStyle = "#fff";
  for (let k = 0; k < screenCorners.length; k += 3) {
    m.beginPath();
    for (let c = 0; c < 3; c++) {
      const px = pixel(body.uv[screenCorners[k + c]], size);
      if (c === 0) m.moveTo(px[0], px[1]);
      else m.lineTo(px[0], px[1]);
    }
    m.closePath();
    m.fill();
  }
  const on = m.getImageData(0, 0, size, size).data;
  const data = x.getImageData(0, 0, size, size);
  const d = data.data;
  // Paint is anything on the screen that is not navy: the red hearts and the yellow mouth.
  let paint = new Uint8Array(size * size);
  let count = 0;
  for (let i = 0; i < size * size; i++) {
    if (on[i * 4 + 3] < 128) continue;
    const r = d[i * 4];
    const g = d[i * 4 + 1];
    const b = d[i * 4 + 2];
    if (r > 95 && r > b * 1.05) {
      paint[i] = 1;
      count++;
    } else if (r > 110 && g > 110) {
      paint[i] = 1;
      count++;
    }
  }
  // The soft edge of the paint goes too.
  for (let pass = 0; pass < 4; pass++) {
    const grown = paint.slice();
    for (let y = 1; y < size - 1; y++) {
      for (let px = 1; px < size - 1; px++) {
        const i = y * size + px;
        if (paint[i] || on[i * 4 + 3] < 128) continue;
        if (paint[i - 1] || paint[i + 1] || paint[i - size] || paint[i + size]) grown[i] = 1;
      }
    }
    paint = grown;
  }
  // Fill: every painted pixel becomes the mean of its neighbours, again and again, until the
  // navy has flowed in from the rim.
  const value = new Float32Array(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 3; c++) value[i * 3 + c] = paint[i] ? 22 + c * 14 : d[i * 4 + c];
  }
  const cells = [];
  for (let i = 0; i < size * size; i++) if (paint[i]) cells.push(i);
  for (let pass = 0; pass < 900; pass++) {
    for (const i of cells) {
      for (let c = 0; c < 3; c++) {
        value[i * 3 + c] =
          (value[(i - 1) * 3 + c] +
            value[(i + 1) * 3 + c] +
            value[(i - size) * 3 + c] +
            value[(i + size) * 3 + c]) /
          4;
      }
    }
  }
  for (const i of cells) for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.round(value[i * 3 + c]);
  x.putImageData(data, 0, 0);
  return { canvas, painted: count, filled: cells.length };
}

/**
 * The exporter encodes the pictures with `canvas.toBlob(callback, type)` and no quality, which is
 * Chrome's default (0.8 for WebP). This passes ours. In Chrome a WebP quality of 1 is lossless.
 */
function withQuality(quality, work) {
  const original = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
    original.call(this, callback, type, quality);
  };
  return work().finally(() => {
    HTMLCanvasElement.prototype.toBlob = original;
  });
}

/** How far apart two readings of the same model are, part by part (the second file's check). */
function compare(a, b) {
  const out = {};
  for (const bone of Object.keys(a.parts)) {
    const A = a.parts[bone].p;
    const B = b.parts[bone]?.p ?? [];
    if (A.length !== B.length) {
      out[bone] = { corners: [A.length, B.length] };
      continue;
    }
    // The same shape, whatever its place: compare the distances between corners far apart.
    let worst = 0;
    let uvWorst = 0;
    const step = Math.max(1, Math.floor(A.length / 97));
    for (let i = 0; i < A.length; i++) {
      const j = (i * 7 + step * 13) % A.length;
      worst = Math.max(worst, Math.abs(A[i].distanceTo(A[j]) - B[i].distanceTo(B[j])));
      uvWorst = Math.max(
        uvWorst,
        Math.abs(a.parts[bone].uv[i][0] - b.parts[bone].uv[i][0]),
        Math.abs(a.parts[bone].uv[i][1] - b.parts[bone].uv[i][1]),
      );
    }
    out[bone] = { corners: A.length, shapeError: round(worst, 6), uvError: round(uvWorst, 6) };
  }
  return out;
}

/**
 * `urls.model` is the source that is built. `urls.other` is the second source: it is only
 * compared with the first (the two files hold the same model in two attitudes).
 */
export async function convert(urls, { quality = 1 } = {}) {
  const source = await read(urls.model);
  const report = {
    sourceBytes: source.bytes,
    blendedCorners: source.blended,
    sourceBones: source.bones,
  };
  if (urls.other) {
    const other = await read(urls.other);
    report.otherFile = compare(source, other);
    // Their pictures, pixel by pixel.
    const pixels = (image) => {
      const c = document.createElement("canvas");
      c.width = image.naturalWidth;
      c.height = image.naturalHeight;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(image, 0, 0);
      return x.getImageData(0, 0, c.width, c.height).data;
    };
    const pa = pixels(source.image);
    const pb = pixels(other.image);
    let differ = pa.length === pb.length ? 0 : -1;
    if (differ === 0) for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) differ++;
    report.otherFile.pictureDifference = differ;
    // The turn that takes this file's attitude to the other's, from the body's mirror normal.
  }
  const size = source.image.naturalWidth;
  const body = source.parts.body;
  const need = (name) =>
    source.parts[name] ??
    (() => {
      throw new Error(`no part ${name}`);
    })();
  const earL = need("ear_L_01");
  const earR = need("ear_R_01");
  const gloveL = need("pom_L_01");
  const gloveR = need("pom_R_01");

  // 1. The body's own frame. The body is two mirrored halves: the second half's UVs are the
  // first's, one tile to the right. Every such pair of corners gives the mirror's normal.
  const first = new Map();
  for (let i = 0; i < body.p.length; i++) {
    if (body.uv[i][0] >= 1) continue;
    first.set(`${Math.round(body.uv[i][0] * 1e4)},${Math.round(body.uv[i][1] * 1e4)}`, body.p[i]);
  }
  const across = new THREE.Vector3();
  const mids = [];
  let pairs = 0;
  for (let i = 0; i < body.p.length; i++) {
    if (body.uv[i][0] < 1) continue;
    const twin = first.get(
      `${Math.round((body.uv[i][0] - 1) * 1e4)},${Math.round(body.uv[i][1] * 1e4)}`,
    );
    if (!twin) continue;
    const d = new THREE.Vector3().subVectors(twin, body.p[i]);
    if (d.length() < 0.004) continue;
    across.add(d.clone().normalize());
    mids.push(new THREE.Vector3().addVectors(twin, body.p[i]).multiplyScalar(0.5));
    pairs++;
  }
  if (pairs < 200) throw new Error(`only ${pairs} mirrored pairs on the body`);
  const left = across.normalize();
  const onMirror = centroid(mids);
  let mirrorSpread = 0;
  for (const m of mids)
    mirrorSpread = Math.max(mirrorSpread, Math.abs(m.clone().sub(onMirror).dot(left)));

  // Up is the normal of the belt, made square to the mirror's normal, toward the ears.
  const belt = body.p.filter((_, i) => inside(pixel(body.uv[i], size), PAINT.belt));
  if (belt.length < 150) throw new Error(`only ${belt.length} corners on the belt`);
  const up = planeNormal(belt);
  up.addScaledVector(left, -up.dot(left)).normalize();
  const ears = centroid([...earL.p, ...earR.p]);
  const shell = body.p.filter((_, i) => inside(pixel(body.uv[i], size), PAINT.shell));
  const ball = sphere(shell);
  // The middle of the ball, on the mirror.
  const centre = ball.centre
    .clone()
    .addScaledVector(left, -ball.centre.clone().sub(onMirror).dot(left));
  if (ears.clone().sub(centre).dot(up) < 0) up.negate();
  const front = new THREE.Vector3().crossVectors(left, up);
  const basis = new THREE.Matrix4().makeBasis(left, up, front);
  const toBody = new THREE.Matrix4()
    .copy(basis)
    .invert()
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z));
  for (const part of Object.values(source.parts)) for (const p of part.p) p.applyMatrix4(toBody);
  const sourceAttitude = new THREE.Euler().setFromRotationMatrix(basis, "YXZ");

  // 2. The screen: the island of the body that holds the painted face.
  const bodyIslands = islands(body);
  const screenAt = PAINT.screen;
  const screen = bodyIslands.find((corners) => {
    for (let k = 0; k < corners.length; k += 1) {
      const i = corners[k];
      if (i % 3 !== 0) continue;
      const a = pixel(body.uv[i], size);
      const b = pixel(body.uv[i + 1], size);
      const c = pixel(body.uv[i + 2], size);
      const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
      const d1 = s(screenAt, a, b);
      const d2 = s(screenAt, b, c);
      const d3 = s(screenAt, c, a);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
    }
    return false;
  });
  if (!screen || screen.length !== 126 * 3) {
    throw new Error(
      `the screen's island has ${screen ? screen.length / 3 : 0} triangles, expected 126`,
    );
  }
  const onScreen = new Set(screen);
  const screenBox = new THREE.Box3().setFromPoints(screen.map((i) => body.p[i]));
  const screenFacing = summedNormal(body, screen).normalize();
  if (screenBox.getCenter(new THREE.Vector3()).z < 0)
    throw new Error("the screen is behind the ball");

  // 3. The ears. The hinge is the yellow bracket at the foot of each (two small islands); the
  // long axis runs from it through the ear, the facing is the dark panel with the ring.
  const earFrame = (ear) => {
    const parts = islands(ear).sort((a, b) => b.length - a.length);
    if (parts.length !== 4) throw new Error(`an ear has ${parts.length} islands, expected 4`);
    const [panel, , hingeA, hingeB] = parts;
    const hinge = centroid([...hingeA, ...hingeB].map((i) => ear.p[i]));
    const axis = centroid(ear.p).sub(hinge);
    const facing = summedNormal(ear, panel);
    return { hinge, basis: frame(axis, facing) };
  };
  const fl = earFrame(earL);
  const fr = earFrame(earR);
  // The two are made exact mirrors of each other: the mean of the left and the mirrored right.
  const flip = (v) => new THREE.Vector3(-v.x, v.y, v.z);
  const axisOf = (m, k) => new THREE.Vector3().setFromMatrixColumn(m, k);
  const hingeL = fl.hinge.clone().add(flip(fr.hinge)).multiplyScalar(0.5);
  const earY = axisOf(fl.basis, 1)
    .add(flip(axisOf(fr.basis, 1)))
    .normalize();
  const earZ = axisOf(fl.basis, 2)
    .add(flip(axisOf(fr.basis, 2)))
    .normalize();
  const earBasisL = frame(earY, earZ);
  const earBasisR = frame(flip(earY), flip(earZ));
  const earError = {
    hinge: round(fl.hinge.distanceTo(flip(fr.hinge)), 6),
    axis: round(
      THREE.MathUtils.radToDeg(axisOf(fl.basis, 1).angleTo(flip(axisOf(fr.basis, 1)))),
      4,
    ),
  };

  // 4. The gloves. Z runs from the cuff's cap out through the star on the front of the fist (the
  // way a punch goes), Y is up with the thumb at the top on the inner side, the pivot is the
  // glove's middle.
  const gloveFrame = (glove, side) => {
    const parts = islands(glove).sort((a, b) => b.length - a.length);
    if (parts.length !== 2) throw new Error(`a glove has ${parts.length} islands, expected 2`);
    const [hand, cap] = parts;
    const middle = centroid(hand.map((i) => glove.p[i]));
    const capMiddle = centroid(cap.map((i) => glove.p[i]));
    const axis = planeNormal(cap.map((i) => glove.p[i]));
    if (axis.dot(middle.clone().sub(capMiddle)) < 0) axis.negate();
    const star = hand.filter((i) => {
      const px = pixel(glove.uv[i], size);
      return Math.hypot(px[0] - PAINT.star[0], px[1] - PAINT.star[1]) < PAINT.starReach;
    });
    if (star.length < 12) throw new Error(`only ${star.length} corners on a glove's star`);
    const facing = summedNormal(glove, star).normalize();
    // The star is on the front of the fist, straight across from the cuff.
    if (facing.dot(axis) < 0.8) throw new Error("a glove's star does not face away from its cuff");
    // A first up from the shape itself (what stands farthest out from the axis: the thumb's side
    // of the fist), the same on both gloves as mirrors. GLOVE_ROLL then turns the fist about its
    // axis until the star stands upright and the thumb is at the top, toward the ball.
    const thumb = new THREE.Vector3();
    for (const i of hand) {
      const out = glove.p[i].clone().sub(middle);
      out.addScaledVector(axis, -out.dot(axis));
      thumb.addScaledVector(out, out.lengthSq() ** 2);
    }
    // `frame` keeps its first axis: here that is the punch, and the thumb is made square to it.
    const turned = frame(axis, thumb);
    const up = new THREE.Vector3()
      .setFromMatrixColumn(turned, 2)
      .applyAxisAngle(axis, THREE.MathUtils.degToRad(side * GLOVE_ROLL));
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3().crossVectors(up, axis).normalize(),
      up,
      axis.clone(),
    );
    // The pivot: the middle of the hand's box along its three axes.
    const inv = new THREE.Matrix4().copy(basis).invert();
    const box = new THREE.Box3().setFromPoints(glove.p.map((p) => p.clone().applyMatrix4(inv)));
    const pivot = box.getCenter(new THREE.Vector3()).applyMatrix4(basis);
    return { basis, pivot, size: box.getSize(new THREE.Vector3()), asModelled: middle };
  };
  const gl = gloveFrame(gloveL, 1);
  const gr = gloveFrame(gloveR, -1);

  // 5. Into each part's own frame.
  const local = (part, corners, basis, pivot) => {
    const inv = new THREE.Matrix4()
      .copy(basis)
      .invert()
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    const list = corners ?? part.p.map((_, i) => i);
    return {
      points: list.map((i) => part.p[i].clone().applyMatrix4(inv)),
      uvs: list.map((i) => part.uv[i]),
    };
  };
  const origin = new THREE.Vector3();
  const identity = new THREE.Matrix4();
  const shellCorners = body.p.map((_, i) => i).filter((i) => !onScreen.has(i));
  const made = {
    body: local(body, shellCorners, identity, origin),
    face: local(body, screen, identity, origin),
    ear_L: local(earL, null, earBasisL, hingeL),
    ear_R: local(earR, null, earBasisR, flip(hingeL)),
    glove_L: local(gloveL, null, gl.basis, gl.pivot),
    glove_R: local(gloveR, null, gr.basis, gr.pivot),
  };

  // 6. The picture and the two materials.
  const cleaned = cleanPicture(source.image, body, screen);
  const map = new THREE.CanvasTexture(cleaned.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.name = "companion_base";
  map.userData = { mimeType: "image/webp" };
  const paint = new THREE.MeshBasicMaterial({ map });
  paint.name = "companion_body";
  const glass = new THREE.MeshBasicMaterial({ map });
  glass.name = "companion_face";

  // 7. The tree. The gloves hang on the root, not on the body: they float beside it, and the
  // body can roll like a ball without taking them round.
  const radius = ball.radius;
  const root = new THREE.Group();
  root.name = "companion";
  const meshes = {};
  report.parts = {};
  for (const [name, part] of Object.entries(made)) {
    const g = geometry(part.points, part.uvs);
    const mesh = new THREE.Mesh(g.geometry, name === "face" ? glass : paint);
    mesh.name = name;
    meshes[name] = mesh;
    g.geometry.computeBoundingBox();
    report.parts[name] = {
      triangles: g.triangles,
      vertices: g.vertices,
      volume: round(g.volume, 7),
      box: {
        min: g.geometry.boundingBox.min.toArray().map((v) => round(v)),
        max: g.geometry.boundingBox.max.toArray().map((v) => round(v)),
      },
    };
  }
  root.add(meshes.body);
  meshes.body.add(meshes.face);
  for (const [name, basis, hinge] of [
    ["ear_L", earBasisL, hingeL],
    ["ear_R", earBasisR, flip(hingeL)],
  ]) {
    meshes[name].position.copy(hinge);
    meshes[name].quaternion.setFromRotationMatrix(basis);
    meshes.body.add(meshes[name]);
  }
  // The gloves rest beside the ball and a little in front, as mirrors, with the star to the
  // front and the knuckles up: no rotation, so the page's turns are about plain axes.
  const REST = { x: 1.85, y: -0.5, z: 0.3 };
  meshes.glove_L.position.set(REST.x * radius, REST.y * radius, REST.z * radius);
  meshes.glove_R.position.set(-REST.x * radius, REST.y * radius, REST.z * radius);
  root.add(meshes.glove_L, meshes.glove_R);

  const quat = (m) =>
    new THREE.Quaternion()
      .setFromRotationMatrix(m)
      .toArray()
      .map((v) => round(v));
  const screenCentre = screenBox.getCenter(new THREE.Vector3());
  const screenSize = screenBox.getSize(new THREE.Vector3());
  root.userData = {
    /** The ball: its radius in metres. The origin is its middle. */
    radius: round(radius),
    /** The screen, in the body's frame: the middle of its box, half its width and its height. */
    screen: {
      x: round(screenCentre.x),
      y: round(screenCentre.y),
      z: round(screenBox.max.z),
      halfWidth: round(screenSize.x / 2),
      halfHeight: round(screenSize.y / 2),
      facing: screenFacing.toArray().map((v) => round(v)),
    },
    /** Where the gloves were modelled, in the body's frame (they rest elsewhere in this file). */
    asModelled: {
      glove_L: { position: gl.pivot.toArray().map((v) => round(v)), quaternion: quat(gl.basis) },
      glove_R: { position: gr.pivot.toArray().map((v) => round(v)), quaternion: quat(gr.basis) },
    },
  };
  report.frame = {
    mirroredPairs: pairs,
    mirrorSpread: round(mirrorSpread, 6),
    radius: round(radius),
    centreInSource: centre.toArray().map((v) => round(v)),
    attitudeInSourceDegrees: [sourceAttitude.x, sourceAttitude.y, sourceAttitude.z].map((v) =>
      round(THREE.MathUtils.radToDeg(v), 2),
    ),
    screenFacing: screenFacing.toArray().map((v) => round(v, 4)),
    earMirrorError: earError,
    hinge: hingeL.toArray().map((v) => round(v)),
    gloveSize: {
      L: gl.size.toArray().map((v) => round(v, 4)),
      R: gr.size.toArray().map((v) => round(v, 4)),
    },
  };
  report.picture = { size, paintedPixels: cleaned.painted, filledPixels: cleaned.filled };

  const warnings = [];
  const warn = console.warn;
  console.warn = (...parts) => warnings.push(parts.join(" "));
  let glb;
  try {
    glb = await withQuality(quality, () =>
      new GLTFExporter().parseAsync(root, {
        binary: true,
        onlyVisible: false,
        embedImages: true,
        animations: [],
      }),
    );
  } finally {
    console.warn = warn;
  }
  report.warnings = warnings;
  report.bytes = glb.byteLength;
  report.quality = quality;

  let binary = "";
  const bytes = new Uint8Array(glb);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return { report, base64: btoa(binary), cleaned: cleaned.canvas.toDataURL("image/png") };
}
