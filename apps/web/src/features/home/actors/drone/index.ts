import { ensureActor } from "../shared/ensure";
import type { ActorCtx } from "../shared/types";

import { buildDrone, type DroneActor } from "./actor";

export type { DroneActor, DroneLayer, LookAt } from "./actor";
export type { DronePlace } from "./coords";
export type { FaceName } from "./faces";
export type { IconName } from "./marks";
export { alongPath, besidePoint } from "./path";
export type { PathPoint, Side } from "./path";
export type { PoseName } from "./pose";
export type { TrickKind } from "./tricks";

/**
 * The normal drone, built once and shared by every section and the loader. The model, the two
 * pages of faces and the icons come through the media store (the loading list's `droneItems()` has
 * usually fetched them already). The drone is not shown until a section sets `visible`.
 */
export function ensureDrone(ctx: ActorCtx): Promise<DroneActor> {
  return ensureActor(ctx.actors, "drone", () => buildDrone(ctx));
}
