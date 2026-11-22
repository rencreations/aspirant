import { Quaternion, Vector3 } from "three";

import type { SelenaActor } from "../../actors/selena";
import { ANCHOR } from "../../actors/selena/constants";
import type { SilverboltActor } from "../../actors/silverbolt";

const film = new Vector3();
const filmQ = new Quaternion();
const at = { x: 0, y: 0, z: 0 };

/** Place both rigs in the same camera space and sample the matching take. */
export function showDragon(sl: SelenaActor, sb: SilverboltActor, offset?: Vector3): void {
  const o = sl.object;
  const s = o.scale.x;
  filmQ.copy(o.quaternion);
  film.set(-ANCHOR[0], -ANCHOR[1], -ANCHOR[2]);
  if (offset) film.add(offset);
  film.multiplyScalar(s).applyQuaternion(filmQ).add(o.position);
  at.x = film.x;
  at.y = film.y;
  at.z = film.z;
  sb.visible = true;
  // It is part of her picture: drawn through the same fitted lens, in front of the sky.
  sl.frameWith(sb.object);
  sb.placeWorld(at, s, filmQ);
  const c = sl.clipState();
  if (c.clip !== "city_intercation02") sb.clip(c.clip, c.time, { root: "keep" });
  sb.follow(sl.state() === "idle" ? 0.16 : 0);
  sb.interactive(false);
}
