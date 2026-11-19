import { getCast } from "../../actors/shared/cast";
import { ensureActor } from "../../actors/shared/ensure";
import type { ActorCtx } from "../../actors/shared/types";
import { warmCast } from "../../actors/shared/warm";

import { SheetActor } from "./actor";

export type { SheetDrive } from "./actor";
export { SheetActor };

/**
 * The white sheet of the out animation, one actor "sheet" in the cast pass. Built after Selena (the
 * registry steps actors in the order they were registered), so her hand is current when it reads it:
 * a section calls `ensureSelena` first.
 */
export function ensureSheet(ctx: ActorCtx): Promise<SheetActor> {
  return ensureActor(ctx.actors, "sheet", async () => {
    const cast = getCast(ctx.stage);
    const sheet = new SheetActor(cast, () => ({
      h: ctx.stage.height,
      dpr: ctx.stage.renderer.getPixelRatio(),
    }));
    // Its program is made now, so the first frame of the pull does not stall.
    await warmCast(ctx.stage, cast, sheet.object);
    return sheet;
  });
}
