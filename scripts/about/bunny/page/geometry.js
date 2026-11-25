// Plain geometry for the bunny's build: pieces, fits, a ray, a refinement along a direction and
// the normals the outline needs. A corner is { p: Vector3, uv: [u, v] } and a triangle is an array
// of three corners, wound as the source winds it.
import * as THREE from "three";

export const round = (n, digits = 5) => {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
};
export const vec = (v, digits = 5) => v.toArray().map((x) => round(x, digits));

const placeKey = (p) =>
  `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`;
const uvKey = (uv) => `${Math.round(uv[0] * 1e5)},${Math.round(uv[1] * 1e5)}`;

/**
 * The triangles that hang together, as lists of triangles, largest first. Two triangles hang
 * together when they share a corner's place (and its UV too, when `byUv`: then a UV seam cuts).
 */
export function pieces(tris, byUv) {
  const parent = tris.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const seen = new Map();
  tris.forEach((t, i) => {
    for (const c of t) {
      const key = byUv ? `${placeKey(c.p)}|${uvKey(c.uv)}` : placeKey(c.p);
      if (seen.has(key)) {
        const a = find(i);
        const b = find(seen.get(key));
        if (a !== b) parent[a] = b;
      } else seen.set(key, i);
    }
  });
  const out = new Map();
  tris.forEach((t, i) => {
    const r = find(i);
    if (!out.has(r)) out.set(r, []);
    out.get(r).push(t);
  });
  return [...out.values()].sort((a, b) => b.length - a.length);
}

export const corners = (tris) => tris.flatMap((t) => t.map((c) => c.p));

export function centroid(points) {
  const c = new THREE.Vector3();
  for (const p of points) c.add(p);
  return c.multiplyScalar(1 / Math.max(1, points.length));
}

export function box(points) {
  return new THREE.Box3().setFromPoints(points);
}

/** The face normal of a triangle, as long as twice its area. */
export function faceNormal(t) {
  const ab = new THREE.Vector3().subVectors(t[1].p, t[0].p);
  const ac = new THREE.Vector3().subVectors(t[2].p, t[0].p);
  return ab.cross(ac);
}

export function summedNormal(tris) {
  const s = new THREE.Vector3();
  for (const t of tris) s.add(faceNormal(t));
  return s;
}

/** Eigenvectors of a symmetric 3 by 3 matrix (Jacobi), smallest eigenvalue first. */
export function eigen(m) {
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

/** The spread of points about their middle: the three axes, smallest spread first. */
export function spread(points) {
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
  return { centre: c, axes: eigen(m).map((e) => e.vector.normalize()) };
}

/** The direction most face normals of the triangles lie along (either sign), by area. */
export function normalAxis(tris) {
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const t of tris) {
    const n = faceNormal(t);
    const area = n.length();
    if (area === 0) continue;
    n.divideScalar(area);
    const d = [n.x, n.y, n.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += area * d[i] * d[j];
  }
  return eigen(m)[2].vector.normalize();
}

/** The nearest hit of a ray on the triangles (Moller and Trumbore), or null. */
export function rayHit(origin, dir, tris) {
  let best = null;
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const tv = new THREE.Vector3();
  const qv = new THREE.Vector3();
  for (const t of tris) {
    e1.subVectors(t[1].p, t[0].p);
    e2.subVectors(t[2].p, t[0].p);
    pv.crossVectors(dir, e2);
    const det = e1.dot(pv);
    if (Math.abs(det) < 1e-12) continue;
    tv.subVectors(origin, t[0].p);
    const u = tv.dot(pv) / det;
    if (u < 0 || u > 1) continue;
    qv.crossVectors(tv, e1);
    const v = dir.dot(qv) / det;
    if (v < 0 || u + v > 1) continue;
    const d = e2.dot(qv) / det;
    if (d > 1e-6 && (best === null || d < best)) best = d;
  }
  return best;
}

const mid = (a, b) => ({
  p: new THREE.Vector3().addVectors(a.p, b.p).multiplyScalar(0.5),
  uv: [(a.uv[0] + b.uv[0]) / 2, (a.uv[1] + b.uv[1]) / 2],
});

/**
 * Splits triangles until no edge runs more than `step` along `axis`. An edge is split at its
 * middle in every triangle that has it (the edge is known by its two places), so the pieces stay
 * joined: no crack opens. Nothing moves: the new corners lie on the old triangles, with their UVs.
 */
export function refine(tris, axis, step) {
  let list = tris;
  for (let pass = 0; pass < 12; pass++) {
    const marked = new Set();
    const edge = (a, b) => {
      const ka = placeKey(a.p);
      const kb = placeKey(b.p);
      return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    };
    for (const t of list) {
      for (let k = 0; k < 3; k++) {
        const a = t[k];
        const b = t[(k + 1) % 3];
        if (Math.abs(new THREE.Vector3().subVectors(b.p, a.p).dot(axis)) > step) {
          marked.add(edge(a, b));
        }
      }
    }
    if (marked.size === 0) return list;
    const next = [];
    for (const t of list) {
      const cut = [0, 1, 2].map((k) => marked.has(edge(t[k], t[(k + 1) % 3])));
      const count = cut.filter(Boolean).length;
      if (count === 0) {
        next.push(t);
        continue;
      }
      // Turn the triangle (keeping its winding) so the cut edges come first.
      let r = 0;
      if (count === 1) r = cut.indexOf(true);
      if (count === 2) r = cut.indexOf(false) === 0 ? 1 : cut.indexOf(false) === 1 ? 2 : 0;
      const [a, b, c] = [t[r], t[(r + 1) % 3], t[(r + 2) % 3]];
      if (count === 1) {
        const m = mid(a, b);
        next.push([a, m, c], [m, b, c]);
      } else if (count === 2) {
        // The edges a-b and b-c are cut.
        const m1 = mid(a, b);
        const m2 = mid(b, c);
        next.push([m1, b, m2], [a, m1, m2], [a, m2, c]);
      } else {
        const m1 = mid(a, b);
        const m2 = mid(b, c);
        const m3 = mid(c, a);
        next.push([a, m1, m3], [m1, b, m2], [m3, m2, c], [m1, m2, m3]);
      }
    }
    list = next;
  }
  throw new Error("refine: the edges did not get short enough in twelve passes");
}

/**
 * The normal each corner carries: the mean of the face normals at its place that do not face the
 * other way. Faces that meet at an edge (a box's corner) are averaged, so the page's outline (the
 * part again, pushed out along the normal) stays closed there; the two sides of a thin plate (the
 * same place, facing away from each other) keep a normal each instead of cancelling to nothing.
 */
export function cornerNormals(tris, partOf) {
  const byPlace = new Map();
  const faces = tris.map((t) => faceNormal(t));
  tris.forEach((t, i) => {
    for (const c of t) {
      const key = `${partOf(t)}|${placeKey(c.p)}`;
      if (!byPlace.has(key)) byPlace.set(key, []);
      byPlace.get(key).push(i);
    }
  });
  const out = new Map();
  let zero = 0;
  tris.forEach((t, i) => {
    const own = faces[i].clone().normalize();
    t.forEach((c, k) => {
      const sum = new THREE.Vector3();
      for (const j of byPlace.get(`${partOf(t)}|${placeKey(c.p)}`)) {
        const n = faces[j];
        const len = n.length();
        if (len === 0) continue;
        if (n.dot(own) / len > -0.5) sum.add(n);
      }
      if (sum.lengthSq() < 1e-20) {
        zero++;
        sum.copy(own);
      }
      out.set(`${i}:${k}`, sum.normalize());
    });
  });
  return { normalOf: (i, k) => out.get(`${i}:${k}`), zero };
}
