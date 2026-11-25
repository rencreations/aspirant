// The bunny's morph targets, as fields of the body's own frame (metres; Y up, the screen to +Z,
// the bunny's left is +X). A field is a function of place only, so corners that share a place (a
// UV seam, the rim of the glass on the shell) move together and nothing opens.
//
// Body targets reshape the shell; the ears and the feet ride on it as rigid pieces, carried by
// where their hinge goes and turned as the shell turns there. Local targets move one region of the
// shell. Ear targets bend one ear and are written for the left one; the right ear's is its mirror.
import * as THREE from "three";

/** The order of the targets in the file. */
export const TARGETS = [
  "squash",
  "stretch",
  "puff",
  "lean_L",
  "lean_R",
  "brow_down",
  "brow_up",
  "pods_out",
  "lens_out",
  "ear_L_droop",
  "ear_R_droop",
  "ear_L_fold",
  "ear_R_fold",
  "ear_L_perk",
  "ear_R_perk",
  "ear_L_curl",
  "ear_R_curl",
];

/** Targets that reshape the whole body and so carry the ears and the feet. */
export const BODY_TARGETS = ["squash", "stretch", "puff", "lean_L", "lean_R"];

/** How far each target goes at 1 (metres, degrees, fractions). */
export const AMOUNT = {
  squash: { drop: 0.2, bulge: 0.15 },
  stretch: { rise: 0.2, thin: 0.09 },
  puff: { side: 0.12, up: 0.05, front: 0.1 },
  lean: { degrees: 16 },
  brow: { reach: 0.06, down: [0, -0.026, -0.007], up: [0, 0.02, 0.005] },
  pods: { out: 0.024, inner: 0.85, fade: 0.04 },
  lens: { out: 0.012, inner: 0.045, fade: 0.035 },
  ear: { droop: 70, fold: 95, curl: 110, perkTurn: 0.6, perkGrow: 0.1 },
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const flip = (v) => new THREE.Vector3(-v.x, v.y, v.z);

/**
 * `rig` holds what the fields are measured from: `half` (the body box's half size), `brow` (the
 * tip of the crest over the screen), `pod` (the left side disc's middle and radius), `lens` (the
 * back lens's middle and its outward normal), `ears.L` and `feet.L` (hinge, basis, length).
 */
export function makeFields(rig) {
  const { half } = rig;
  const barrel = (y, k = 1) => Math.max(0, 1 - k * (y / half.y) ** 2);

  /** The whole body: the displacement of a place on the shell. */
  const body = {
    squash: (p) => {
      const w = barrel(p.y);
      const { drop, bulge } = AMOUNT.squash;
      return new THREE.Vector3(p.x * bulge * w, -p.y * drop, p.z * bulge * 0.8 * w);
    },
    stretch: (p) => {
      const w = barrel(p.y);
      const { rise, thin } = AMOUNT.stretch;
      return new THREE.Vector3(-p.x * thin * w, p.y * rise, -p.z * thin * 0.8 * w);
    },
    puff: (p) => {
      const w = barrel(p.y, 0.6);
      const { side, up, front } = AMOUNT.puff;
      return new THREE.Vector3(p.x * side * w, p.y * up, p.z * front * w);
    },
  };
  // A lean bends the body from its foot: each height turns about the bottom by a share of the
  // whole angle that grows with the height.
  const lean = (sign) => (p) => {
    const t = Math.min(1, Math.max(0, (p.y + half.y) / (2 * half.y)));
    const a = -sign * THREE.MathUtils.degToRad(AMOUNT.lean.degrees) * t;
    const x = p.x;
    const y = p.y + half.y;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return new THREE.Vector3(c * x - s * y - x, s * x + c * y - y, 0);
  };
  body.lean_L = lean(1);
  body.lean_R = lean(-1);

  /** One region of the shell. */
  const browAt = rig.brow;
  const brow = (dir) => (p) => {
    const w = Math.exp(-p.distanceToSquared(browAt) / AMOUNT.brow.reach ** 2);
    return new THREE.Vector3(...dir).multiplyScalar(w);
  };
  const pod = (p) => {
    const side = Math.sign(p.x);
    const c = side > 0 ? rig.pod.centre : flip(rig.pod.centre);
    const rho = Math.hypot(p.y - c.y, p.z - c.z);
    const inner = rig.pod.radius * AMOUNT.pods.inner;
    const w =
      (1 - smooth(inner, inner + AMOUNT.pods.fade, rho)) *
      smooth(rig.pod.centre.x * 0.55, rig.pod.centre.x * 0.85, side * p.x);
    return new THREE.Vector3(side * AMOUNT.pods.out * w, 0, 0);
  };
  const lens = (p) => {
    const d = new THREE.Vector3().subVectors(p, rig.lens.centre);
    const along = d.dot(rig.lens.normal);
    const rho = d.clone().addScaledVector(rig.lens.normal, -along).length();
    const w =
      (1 - smooth(AMOUNT.lens.inner, AMOUNT.lens.inner + AMOUNT.lens.fade, rho)) *
      smooth(-0.05, -0.02, along);
    return rig.lens.normal.clone().multiplyScalar(AMOUNT.lens.out * w);
  };
  const local = {
    brow_down: brow(AMOUNT.brow.down),
    brow_up: brow(AMOUNT.brow.up),
    pods_out: pod,
    lens_out: lens,
  };

  /**
   * The turn of the shell at a hinge `h` under a body field: the rotation part of the field's
   * Jacobian there (its polar decomposition), so a stretch or a squash does not turn anything and
   * a lean turns both sides alike. The target does not turn the piece (a turn there would move the
   * ear's upper joints out from under their bones); the page applies it to the bone if it wants
   * the piece to tilt with the shell.
   */
  const turnAt = (field, h) => {
    const e = 1e-4;
    const at = (q) => q.clone().add(field(q));
    const cols = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ].map((axis) =>
      new THREE.Vector3()
        .subVectors(at(h.clone().addScaledVector(axis, e)), at(h.clone().addScaledVector(axis, -e)))
        .divideScalar(2 * e),
    );
    const r = new THREE.Matrix3().set(
      cols[0].x,
      cols[1].x,
      cols[2].x,
      cols[0].y,
      cols[1].y,
      cols[2].y,
      cols[0].z,
      cols[1].z,
      cols[2].z,
    );
    for (let i = 0; i < 30; i++) {
      const it = r.clone().invert().transpose();
      for (let k = 0; k < 9; k++) r.elements[k] = (r.elements[k] + it.elements[k]) / 2;
    }
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().setFromMatrix3(r));
  };

  /** The ear's bends, in the left ear's own frame (x across and out, y along, z out of its face). */
  const ear = rig.ears.L;
  const toEar = new THREE.Matrix4().copy(ear.basis).invert();
  const fromEar = ear.basis;
  // A bend along the ear: the angle grows with the height up the ear by `angle(s)`, in the plane
  // of y and the axis `k` (0 bends toward x, 2 toward z). The middle line is integrated, so the
  // ear keeps its length at full weight; a point off the line keeps its distance from it.
  const bend = (angle, k) => {
    const N = 600;
    const top = ear.length * 1.08;
    const ds = top / N;
    const line = [{ a: 0, b: 0, t: 0 }];
    for (let i = 1; i <= N; i++) {
      const t0 = angle((i - 1) * ds);
      const t1 = angle(i * ds);
      const prev = line[i - 1];
      line.push({
        a: prev.a + ((Math.cos(t0) + Math.cos(t1)) / 2) * ds,
        b: prev.b + ((Math.sin(t0) + Math.sin(t1)) / 2) * ds,
        t: t1,
      });
    }
    return (q) => {
      if (q.y <= 0) return q.clone();
      const f = Math.min(N, q.y / ds);
      const i = Math.floor(f);
      const j = Math.min(N, i + 1);
      const u = f - i;
      const at = {
        a: line[i].a + (line[j].a - line[i].a) * u,
        b: line[i].b + (line[j].b - line[i].b) * u,
        t: line[i].t + (line[j].t - line[i].t) * u,
      };
      const off = k === 0 ? q.x : q.z;
      const out = q.clone();
      out.y = at.a - off * Math.sin(at.t);
      const across = at.b + off * Math.cos(at.t);
      if (k === 0) out.x = across;
      else out.z = across;
      return out;
    };
  };
  const L = ear.length;
  const base = 0.15 * L;
  const ramp = (s) => Math.min(1, Math.max(0, (s - base) / (L - base)));
  const rad = THREE.MathUtils.degToRad;
  const droop = bend((s) => rad(AMOUNT.ear.droop) * ramp(s), 0);
  const fold = bend((s) => rad(AMOUNT.ear.fold) * smooth(0.44 * L, 0.62 * L, s), 2);
  const curl = bend((s) => -rad(AMOUNT.ear.curl) * ramp(s) ** 2, 2);
  // Perk: the ear stands toward straight up and grows a little.
  const axis = new THREE.Vector3().setFromMatrixColumn(ear.basis, 1);
  const upright = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 1, 0));
  const perkTurn = new THREE.Quaternion().slerp(upright, AMOUNT.ear.perkTurn);
  const perk = (q) => {
    const grown = q.clone();
    if (grown.y > 0) grown.y *= 1 + AMOUNT.ear.perkGrow * smooth(0, base, grown.y);
    // Into the body's axes, turned about the hinge, and back into the ear's.
    return grown.applyMatrix4(fromEar).applyQuaternion(perkTurn).applyMatrix4(toEar);
  };
  const earBends = { droop, fold, curl, perk };

  /** The displacement of a left ear corner under one of its bends, in the body frame. */
  const earLeft = (name, p) => {
    const q = p.clone().sub(ear.hinge).applyMatrix4(toEar);
    return earBends[name](q).applyMatrix4(fromEar).add(ear.hinge).sub(p);
  };

  /**
   * The displacement of one corner under one target. `part` is body, glass, ear_L, ear_R, foot_L
   * or foot_R.
   */
  function delta(target, part, p) {
    const side = part.endsWith("_L") ? "L" : part.endsWith("_R") ? "R" : null;
    const onShell = part === "body" || part === "glass";
    if (target in body) {
      if (onShell) return body[target](p);
      // An ear or a foot goes where its hinge goes, whole.
      const piece = part.startsWith("ear") ? rig.ears[side] : rig.feet[side];
      return body[target](piece.hinge);
    }
    if (target in local) return onShell ? local[target](p) : new THREE.Vector3();
    const m = /^ear_([LR])_(\w+)$/.exec(target);
    if (!m || part !== `ear_${m[1]}`) return new THREE.Vector3();
    if (m[1] === "L") return earLeft(m[2], p);
    return flip(earLeft(m[2], flip(p)));
  }

  /**
   * What each body target does to the hinge of each piece that hangs on the body: the shift (in
   * the body's frame) that the page adds to the bone's place, as the README explains.
   */
  function hinges() {
    const out = {};
    for (const target of BODY_TARGETS) {
      out[target] = {};
      for (const side of ["L", "R"]) {
        for (const [bone, piece] of [
          [`ear_${side}_1`, rig.ears[side]],
          [`foot_${side}`, rig.feet[side]],
        ]) {
          out[target][bone] = {
            shift: body[target](piece.hinge),
            turn: turnAt(body[target], piece.hinge),
          };
        }
      }
    }
    // The local targets must leave every hinge where it is.
    const still = {};
    for (const [name, field] of Object.entries(local)) {
      let worst = 0;
      for (const side of ["L", "R"]) {
        worst = Math.max(worst, field(rig.ears[side].hinge).length());
        worst = Math.max(worst, field(rig.feet[side].hinge).length());
      }
      still[name] = worst;
    }
    return { shifts: out, localAtHinges: still };
  }

  return { delta, hinges };
}
