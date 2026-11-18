/**
 * The whole film scene as one pure function: the state a section sets plus the orbit's drift in,
 * the pose of the trailer and of the ten previews out. The chain is the owner's story of the strip:
 *
 *   morph   the trailer leans in the rows, then stands upright as the strip
 *   expand  the strip opens to the full window
 *   pull    the previews arrive, the trailer becomes the leader of the orbit
 *   fly     all of it leaves to the bottom right
 *
 * Joints (tested): morph 1 equals expand 0, expand 1 equals pull 0, pull 1 equals fly 0, and at
 * fly 1 every plane is gone. The same state always gives the same poses.
 */
import { heroBase } from "./hero";
import { flyPose } from "./flyoff";
import { ORBIT_START, orbitPoses, trainPlace } from "./orbit";
import {
  copyPlane,
  makePlane,
  PLANE_COUNT,
  type FilmState,
  type PlanePose,
  type Vp,
} from "./types";

const base = makePlane();

export function makePoses(): PlanePose[] {
  return Array.from({ length: PLANE_COUNT }, () => makePlane());
}

/** The orbit's turn for a state: its start, the scroll's travel and the actor's own drift. */
export function orbitTurn(st: FilmState, drift: number): number {
  return ORBIT_START + st.travel + drift;
}

/**
 * Write the poses of the eleven planes (0 the trailer, 1 to 10 the previews) for a state. `bases`
 * receives the poses before the fly-off (the trails need them). Returns the lens the pass is drawn
 * through. Both arrays are made with `makePoses`.
 */
export function composeScene(
  vp: Vp,
  st: FilmState,
  drift: number,
  out: PlanePose[],
  bases: PlanePose[],
): number {
  const lens = heroBase(vp, st, base);

  if (st.pull > 0) {
    orbitPoses(vp, st.arrival, st.pull, orbitTurn(st, drift), base, bases);
  } else {
    copyPlane(base, bases[0]!);
    for (let k = 1; k < PLANE_COUNT; k++) {
      const p = bases[k]!;
      p.opacity = 0;
      p.w = p.h = 1;
    }
  }

  if (st.fly > 0) {
    for (let k = 0; k < PLANE_COUNT; k++) {
      flyPose(vp, k, trainPlace(k), bases[k]!, st.fly, out[k]!);
    }
  } else {
    for (let k = 0; k < PLANE_COUNT; k++) copyPlane(bases[k]!, out[k]!);
  }
  return lens;
}
