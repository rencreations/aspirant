import { ensureActor } from "../shared/ensure";
import type { ActorCtx } from "../shared/types";

import { SilverboltActor } from "./actor";
import { SB_NAME } from "./facts";

export type { SilverboltActor } from "./actor";

/**
 * Silverbolt, built once and shared by every section that needs it (the bolt, the fall, the
 * selena, the funny and the chase sections). The model comes through the media store: the loading
 * list's `silverboltItems()` has usually fetched it already.
 */
export function ensureSilverbolt(ctx: ActorCtx): Promise<SilverboltActor> {
  return ensureActor(ctx.actors, SB_NAME, () => SilverboltActor.create(ctx));
}
