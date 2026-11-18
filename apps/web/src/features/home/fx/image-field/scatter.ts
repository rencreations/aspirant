/**
 * The hero's floating field, as a pure layout. The big logo sits in the middle at 70 percent of
 * the screen width, so the cards go around and behind it: some above the logo, some below, four
 * big ones at the corners and the rest in two tiers of smaller, farther ones. Sizes come from
 * perspective ("near" 0.7 to 1.2, z = 1000 - 1000 / near, after premotio) and from a per-card
 * factor. The placement is a seeded best candidate search, so it is the same on every load and
 * adapts to any viewport, portrait too.
 */
import { DEG, perspectiveScale, qFromEuler, seeded } from "./math";
import { BASE_DISTANCE } from "./project";
import { makePose, type CardPose, type Vp } from "./types";

/** The big logo is 70 percent of the viewport wide and 4.013 to 1. */
const LOGO_WIDTH = 0.7;
const LOGO_ASPECT = 4.013;

/** Half width and half height of the logo's box, in the frame's pixels. */
export function logoBox(vp: Vp): { hw: number; hh: number } {
  const hw = (vp.w * LOGO_WIDTH) / 2;
  return { hw, hh: hw / LOGO_ASPECT };
}

/** The height of a mid card at z = 0 (premotio: 325 at 900, clamped by the shorter side). */
function cardBase(vp: Vp): number {
  return Math.min(0.3 * vp.h, 0.36 * vp.w);
}

/**
 * `n` card poses scattered around the logo. The portrait cards are 4:5 (`aspect` 0.8). Poses are
 * at rest: the field adds its idle float and pointer parallax on top.
 */
export function scatterLayout(n: number, vp: Vp, seed = 11): CardPose[] {
  const rand = seeded(seed);
  const base = cardBase(vp);
  const box = logoBox(vp);
  const poses: CardPose[] = [];
  const centres: Array<{ x: number; y: number; r: number }> = [];
  const mids = Math.round((n - 4) * 0.45);

  for (let k = 0; k < n; k++) {
    const tier = k < 4 ? 0 : k < 4 + mids ? 1 : 2;
    const near =
      tier === 0 ? 1.1 + 0.1 * rand() : tier === 1 ? 0.92 + 0.14 * rand() : 0.7 + 0.16 * rand();
    const sz = 0.88 + 0.28 * rand();
    const hApp = base * sz * near;
    const rApp = hApp * 0.5;
    let sx = 0;
    let sy = 0;
    if (tier === 0) {
      // The corners: the four big cards hang partly off the screen.
      sx = (k & 1 ? 1 : -1) * (vp.w / 2 - hApp * 0.28);
      sy = (k & 2 ? 1 : -1) * (vp.h / 2 - hApp * 0.3);
    } else {
      let best = -Infinity;
      const sign = k % 2 === 0 ? 1 : -1;
      for (let tries = 0; tries < 28; tries++) {
        let cx: number;
        let cy: number;
        if (rand() < 0.82 || box.hw > vp.w * 0.45) {
          // Above or below the logo, alternating.
          cx = (rand() * 2 - 1) * vp.w * 0.54;
          cy = sign * (box.hh + rApp * 0.8 + rand() * (vp.h * 0.54 - box.hh - rApp * 0.8));
        } else {
          // Beside the logo.
          const side = rand() < 0.5 ? -1 : 1;
          cx =
            side * (box.hw + rApp * 0.3 + rand() * Math.max(10, vp.w * 0.54 - box.hw - rApp * 0.3));
          cy = (rand() * 2 - 1) * vp.h * 0.45;
        }
        // The card keeps out of the logo's box (its rim may tuck in a little).
        const clearX = Math.abs(cx) - box.hw;
        const clearY = Math.abs(cy) - box.hh;
        if (clearX < rApp * 0.35 && clearY < rApp * 0.55) continue;
        let score = Infinity;
        for (const c of centres) {
          score = Math.min(score, Math.hypot(cx - c.x, cy - c.y) / (c.r + rApp));
        }
        if (centres.length === 0) score = 10;
        if (score > best) {
          best = score;
          sx = cx;
          sy = cy;
        }
      }
      if (best === -Infinity) {
        // No free spot: fall back to the top or bottom band's edge.
        sx = (rand() * 2 - 1) * vp.w * 0.5;
        sy = sign * (box.hh + rApp);
      }
    }
    centres.push({ x: sx, y: sy, r: rApp });

    const pose = makePose();
    const z = BASE_DISTANCE - BASE_DISTANCE / near;
    const s = perspectiveScale(z, BASE_DISTANCE);
    pose.x = sx / s;
    pose.y = sy / s;
    pose.z = z;
    pose.h = base * sz;
    pose.aspect = 0.8;
    const tilt = tier === 0 ? 0.8 : 1;
    qFromEuler(
      (rand() * 2 - 1) * 26 * DEG * tilt,
      (rand() * 2 - 1) * 38 * DEG * tilt,
      (rand() * 2 - 1) * 24 * DEG,
      pose.q,
    );
    poses.push(pose);
  }
  return poses;
}
