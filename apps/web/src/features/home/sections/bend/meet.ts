/**
 * The drone's part of the bend section, as pure functions of the beat: where the paper it comes out
 * of stands, where the drone is while it climbs out, flies to Tetra, pats her head, hugs her and goes
 * to the rest beside her (joint J14), and where Tetra's own marks are for the actors that follow them.
 * Stage frame: the origin in the middle, y up, pixels. No three.js, no DOM, nothing allocated per call.
 */
import { T, ramp, smoother, spotsOf, type BeatState } from "./beats";
import { LENS, baseOf, makePose, paperPose, type CardPose, type Vp } from "./formations";

/** The flat drone fills this share of the paper's width, its middle sits at this height of the paper. */
const SPRITE = { cx: 0.5, cy: 0.5, hw: 0.43, hh: 0.222 } as const;

interface DroneWant {
  x: number;
  y: number;
  height: number;
  /** The drone is drawn at all (it is a flat picture until the pop). */
  visible: boolean;
  /** 0 to 1: the real drone over the flat one (the popping). */
  presence: number;
  /** The point it looks at (Tetra's head), or null for the pointer. */
  lookX: number;
  lookY: number;
  look: boolean;
}

export function newDroneWant(): DroneWant {
  return { x: 0, y: 0, height: 0, visible: false, presence: 0, lookX: 0, lookY: 0, look: false };
}

const scratch: CardPose = makePose();

/** The middle of the paper on the screen and the drone's height there (the flat drone's own height). */
export function paperDrone(
  vp: Vp,
  out: { x: number; y: number; height: number; card: number },
): void {
  paperPose(vp, scratch);
  const k = LENS / (LENS - scratch.z);
  const aspect = 0.8;
  const cardH = (scratch.size * k) / Math.sqrt(aspect);
  out.x = scratch.x * k;
  out.y = scratch.y * k + (0.5 - SPRITE.cy) * cardH;
  // The flat drone is `2 * hh` of the paper's height; the real one stands a little smaller than its drawing.
  out.height = 2 * SPRITE.hh * cardH * 0.92;
  out.card = cardH;
}

/** Tetra's head (the top of her) and her chest on the screen, for a spot of the beat. */
export function headOf(beat: BeatState, vp: Vp, out: { x: number; y: number }): void {
  out.x = beat.spot.tx * vp.w;
  out.y = (beat.spot.ty + beat.spot.th) * vp.h;
}

function chestOf(beat: BeatState, vp: Vp, out: { x: number; y: number }): void {
  out.x = beat.spot.tx * vp.w;
  out.y = (beat.spot.ty + 0.55 * beat.spot.th) * vp.h;
}

const paperScratch = { x: 0, y: 0, height: 0, card: 0 };
const headScratch = { x: 0, y: 0 };
const chestScratch = { x: 0, y: 0 };

const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

/**
 * The drone at the beat. `time` (seconds) only drives the small bob of the pat. Writes into `out`.
 *
 *   before `popFrom`  hidden (the flat picture on the paper stands in for it)
 *   popFrom to popTo  it lifts out of the paper, small and growing, the paper's drone fading under it
 *   to flyTo          it flies to above her head
 *   to patTo          it pats her head: a bob down onto it and up
 *   to hugTo          it comes beside her chest and she hugs it
 *   to goTo           they go to the rest together
 */
export function droneAt(beat: BeatState, vp: Vp, time: number, out: DroneWant): DroneWant {
  const s = beat.s;
  paperDrone(vp, paperScratch);
  headOf(beat, vp, headScratch);
  chestOf(beat, vp, chestScratch);
  const tall = beat.spot.th * vp.h;
  const hOver = 0.14 * vp.h;
  const base = baseOf(vp);

  out.visible = s >= T.popFrom;
  out.presence = ramp(s, T.popFrom, T.popTo);
  out.look = false;
  if (!out.visible) {
    out.x = paperScratch.x;
    out.y = paperScratch.y;
    out.height = paperScratch.height * 0.4;
    return out;
  }

  // Out of the paper: it grows from a small one to its full height and rises off the sheet.
  const out0 = smoother(out.presence);
  const px = paperScratch.x;
  const py = paperScratch.y + out0 * 0.07 * base;
  const ph = paperScratch.height * (0.45 + 0.55 * out0);

  // Over her head: just above the crown.
  const overX = headScratch.x + 0.02 * vp.w;
  const overY = headScratch.y + 0.5 * hOver + 0.012 * vp.h;

  if (s < T.meetFrom) {
    out.x = px;
    out.y = py;
    out.height = ph;
    return out;
  }
  // A beat of looking about before it goes: the fly starts a little after the meeting does.
  const fly = smoother(ramp(s, T.meetFrom + 0.04, T.flyTo));
  if (s < T.flyTo) {
    out.x = mix(px, overX, fly);
    out.y = mix(py, overY + 0.03 * vp.h * Math.sin(Math.PI * fly), fly);
    out.height = mix(ph, hOver, fly);
    out.look = true;
    out.lookX = headScratch.x;
    out.lookY = headScratch.y;
    return out;
  }
  if (s < T.patTo) {
    // The pat: a few bobs down onto her head and up again.
    const bob = 0.5 - 0.5 * Math.cos(time * 9);
    out.x = overX;
    out.y = overY - 0.03 * vp.h * bob;
    out.height = hOver;
    out.look = true;
    out.lookX = headScratch.x;
    out.lookY = headScratch.y;
    return out;
  }
  // The hug: beside her chest, on the side she reaches toward.
  const hugX = chestScratch.x + 0.17 * tall;
  const hugY = chestScratch.y;
  const toHug = smoother(ramp(s, T.patTo, T.patTo + 0.07));
  if (s < T.hugTo) {
    out.x = mix(overX, hugX, toHug);
    out.y = mix(overY, hugY, toHug);
    out.height = mix(hOver, 0.12 * vp.h, toHug);
    out.look = true;
    out.lookX = chestScratch.x;
    out.lookY = chestScratch.y;
    return out;
  }
  // Going to the rest together.
  const go = smoother(ramp(s, T.hugTo, T.goTo));
  const rest = spotsOf(vp).restDrone;
  out.x = mix(hugX, rest.x * vp.w, go);
  out.y = mix(hugY, rest.y * vp.h, go);
  out.height = mix(0.12 * vp.h, rest.h * vp.h, go);
  out.look = go < 0.85;
  out.lookX = chestScratch.x;
  out.lookY = chestScratch.y;
  return out;
}

/** Where the drone stands at the end of the section, for the section after (joint J14). */
export function restOf(vp: Vp): { x: number; y: number; height: number } {
  const rest = spotsOf(vp).restDrone;
  return { x: rest.x * vp.w, y: rest.y * vp.h, height: rest.h * vp.h };
}
