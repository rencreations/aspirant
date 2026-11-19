/**
 * Silverbolt beside Selena, in her picture (round seven). The dragon stands in her own space, where
 * its clip puts it (the game's composition: behind her in the pose, below her in the idle), drawn
 * through the same fitted lens as she is, cut by the same window, in front of the sky. It plays the
 * clip that matches hers at her time, so the two move as one scene, and its head stays still (no
 * follow, no touch). The list's tenth frame and the room after it both call `showDragon` every frame
 * they show her, so the dragon never changes between the two.
 */
import { Quaternion, Vector3 } from "three";

import type { SelenaActor } from "../../actors/selena";
import { ANCHOR } from "../../actors/selena/constants";
import type { SilverboltActor } from "../../actors/silverbolt";

const POSE = "city_interaction_R_loop";
const IDLE = "city_idle";
/** How long her two transitions run (seconds): the dragon's weight between its two loops follows. */
const POSE_IN_SECONDS = 3.2917;
const POSE_OUT_SECONDS = 3.2083;

const film = new Vector3();
const filmQ = new Quaternion();
const at = { x: 0, y: 0, z: 0 };

const smooth = (x: number): number => {
  const v = Math.max(0, Math.min(1, x));
  return v * v * (3 - 2 * v);
};

/**
 * Show the dragon for this frame. `fallbackTime` is the clock the idle runs on while she plays a clip
 * the dragon has no twin of (the out clip): the room's own frame time, as before.
 */
export function showDragon(sl: SelenaActor, sb: SilverboltActor, fallbackTime: number): void {
  const o = sl.object;
  const s = o.scale.x;
  filmQ.copy(o.quaternion);
  film
    .set(-ANCHOR[0] * s, -ANCHOR[1] * s, -ANCHOR[2] * s)
    .applyQuaternion(filmQ)
    .add(o.position);
  at.x = film.x;
  at.y = film.y;
  at.z = film.z;
  sb.visible = true;
  // It is part of her picture: drawn through the same fitted lens, in front of the sky.
  sl.frameWith(sb.object);
  sb.placeWorld(at, s, filmQ);
  const c = sl.clipState();
  const keep = { root: "keep" } as const;
  switch (c.clip) {
    case "city_interaction_R_loop":
      sb.clip(POSE, c.time, keep);
      break;
    case "city_interaction_R":
      // Idle to pose: its idle loop gives way to its pose loop as she moves.
      sb.clip(IDLE, c.time, {
        ...keep,
        blend: { name: POSE, time: c.time, weight: smooth(c.time / POSE_IN_SECONDS) },
      });
      break;
    case "city_interaction_back_R":
      sb.clip(POSE, c.time, {
        ...keep,
        blend: { name: IDLE, time: c.time, weight: smooth(c.time / POSE_OUT_SECONDS) },
      });
      break;
    case "city_idle":
      sb.clip(IDLE, c.time, keep);
      break;
    default:
      sb.clip(IDLE, fallbackTime, keep);
  }
  // Silverbolt only plays its clip: its head stays still.
  sb.follow(0);
  sb.interactive(false);
}
