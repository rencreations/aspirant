import { ensureActor } from "../../actors/shared/ensure";
import type { ActorCtx } from "../../actors/shared/types";
import { TrailsActor } from "./actor";

/**
 * The shared ribbon trails (the dragon's wing tips and tail tip, the drone's path). A section or an
 * actor asks for it in `mount`, makes a trail once and tracks an anchor every frame:
 *
 * ```ts
 * const trails = await ensureTrails(ctx);
 * const tail = trails.create({ colors: ["gold", "pink"], width: 18 });
 * // every frame the dragon is shown:
 * tail.track(silverbolt.socket("tailTip"));
 * ```
 *
 * See `docs/design/home/fx-marks.md`.
 */
export function ensureTrails(ctx: ActorCtx): Promise<TrailsActor> {
  return ensureActor(ctx.actors, "trails", () => new TrailsActor(ctx.stage));
}

export type { TrailsActor };
