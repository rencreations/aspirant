/**
 * A two-bone solve in pure arithmetic: given the shoulder, the point the hand should reach, a hint
 * for which way the elbow bends and the two bone lengths, where the elbow goes. The scene then
 * swings the upper arm at the elbow and the forearm at the point. No three here: any `{ x, y, z }`
 * will do, so the rule is tested without a model.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Elbow extends Vec3 {
  /** 1 when the point is within reach, below 1 by how much shorter the arm is than the distance. */
  reached: number;
}

const EPS = 1e-6;

/**
 * Write the elbow's place into `out`. A point out of reach puts the elbow on the straight line to
 * it (the arm stretched as far as it goes); a point nearer than the bones' difference puts the
 * elbow where the arm is folded as tight as it can be.
 */
export function solveTwoBone(
  shoulder: Vec3,
  goal: Vec3,
  pole: Vec3,
  a: number,
  b: number,
  out: Elbow,
): Elbow {
  const dx = goal.x - shoulder.x;
  const dy = goal.y - shoulder.y;
  const dz = goal.z - shoulder.z;
  const far = Math.hypot(dx, dy, dz);
  const max = a + b - EPS;
  const min = Math.abs(a - b) + EPS;
  const dist = Math.min(max, Math.max(min, far));
  out.reached = far > EPS ? Math.min(1, max / far) : 1;
  let ux = 0;
  let uy = 1;
  let uz = 0;
  if (far > EPS) {
    ux = dx / far;
    uy = dy / far;
    uz = dz / far;
  }
  // The elbow sits `along` the line from the shoulder and `lift` off it, toward the pole.
  const along = (a * a - b * b + dist * dist) / (2 * dist);
  const lift = Math.sqrt(Math.max(0, a * a - along * along));
  let px = pole.x - (pole.x * ux + pole.y * uy + pole.z * uz) * ux;
  let py = pole.y - (pole.x * ux + pole.y * uy + pole.z * uz) * uy;
  let pz = pole.z - (pole.x * ux + pole.y * uy + pole.z * uz) * uz;
  let pl = Math.hypot(px, py, pz);
  if (pl < EPS) {
    // The hint lies along the line: take any direction across it.
    px = uy;
    py = -ux;
    pz = 0;
    pl = Math.hypot(px, py, pz);
    if (pl < EPS) {
      px = 1;
      py = 0;
      pz = 0;
      pl = 1;
    }
  }
  out.x = shoulder.x + ux * along + (px / pl) * lift;
  out.y = shoulder.y + uy * along + (py / pl) * lift;
  out.z = shoulder.z + uz * along + (pz / pl) * lift;
  return out;
}
