/** The drone flies the last orbit, pats Tetra, then hovers beside her at the goodbye. */
import { DRONE_CARD, T, ramp, smoother, spotsOf, type BeatState } from "./beats";
import { spiralPose, makePose, type CardPose, type Vp } from "./formations";

interface DroneWant {
  x: number;
  y: number;
  height: number;
  /** Whether the last orbit is on screen. */
  visible: boolean;
  /** Arrival along the last orbit, from 0 to 1. */
  presence: number;
  z: number;
  yaw: number;
  roll: number;
  /** The point it looks at (Tetra's head), or null for the pointer. */
  lookX: number;
  lookY: number;
  look: boolean;
}

export function newDroneWant(): DroneWant {
  return {
    z: 0,
    yaw: 0,
    roll: 0,
    x: 0,
    y: 0,
    height: 0,
    visible: false,
    presence: 0,
    lookX: 0,
    lookY: 0,
    look: false,
  };
}

const scratch: CardPose = makePose();

/** Tetra's head (the top of her) and her chest on the screen, for a spot of the beat. */
export function headOf(beat: BeatState, vp: Vp, out: { x: number; y: number }): void {
  out.x = beat.spot.tx * vp.w;
  out.y = (beat.spot.ty + beat.spot.th) * vp.h;
}

function chestOf(beat: BeatState, vp: Vp, out: { x: number; y: number }): void {
  out.x = beat.spot.tx * vp.w;
  out.y = (beat.spot.ty + 0.55 * beat.spot.th) * vp.h;
}

const headScratch = { x: 0, y: 0 };
const chestScratch = { x: 0, y: 0 };

const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

/** The last place in the same world-space spiral as the art belongs to the flying drone. */
export function droneAt(beat: BeatState, vp: Vp, time: number, out: DroneWant): DroneWant {
  const s = beat.s;
  spiralPose(DRONE_CARD, beat.adv, vp, scratch);
  const h = 0.14 * vp.h;
  const arrival = smoother(ramp(beat.adv, 0.55, 2.1));
  const greet = smoother(ramp(s, T.glideFrom, T.flyTo));
  const cuddle = smoother(ramp(s, T.patTo, T.patTo + 0.13));
  const release = smoother(ramp(s, T.hugTo, T.goTo));
  const rest = spotsOf(vp).restDrone;
  headOf(beat, vp, headScratch);
  chestOf(beat, vp, chestScratch);
  const float = Math.sin(time * 3.6);
  const pat = 0.5 - 0.5 * Math.cos(time * 8);
  const flyX = scratch.x;
  const flyY = scratch.y - (1 - arrival) * vp.h * 1.3 + float * h * 0.037;
  const overX = headScratch.x + 0.035 * vp.w;
  const overY = headScratch.y + h * (0.53 - 0.13 * pat);
  const hugX = chestScratch.x + 0.18 * beat.spot.th * vp.h;
  out.visible = arrival > 0;
  out.presence = arrival;
  out.x = mix(mix(mix(flyX, overX, greet), hugX, cuddle), rest.x * vp.w, release);
  out.y = mix(
    mix(mix(flyY, overY, greet) + Math.sin(greet * Math.PI) * 0.13 * vp.h, chestScratch.y, cuddle),
    rest.y * vp.h,
    release,
  );
  out.z = mix(scratch.z, 0, greet);
  out.height = h;
  out.yaw = (1 - greet) * Math.sin(beat.adv * 0.5) * 0.55;
  out.roll = (1 - greet) * (Math.sin(beat.adv * 0.5 - 0.4) * 0.19 + float * 0.045);
  out.look = greet > 0.05;
  out.lookX = headScratch.x;
  out.lookY = headScratch.y;
  return out;
}

/** Where the drone stands at the end of the section, for the section after (joint J14). */
export function restOf(vp: Vp): { x: number; y: number; height: number } {
  const rest = spotsOf(vp).restDrone;
  return { x: rest.x * vp.w, y: rest.y * vp.h, height: rest.h * vp.h };
}
