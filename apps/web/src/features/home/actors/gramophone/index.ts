import { ensureActor } from "../shared/ensure";
import type { ActorCtx } from "../shared/types";

import { GramophoneActor } from "./actor";
import { GR_NAME } from "./facts";

/**
 * The gramophone, built once for the music section. The model comes through the media store: the
 * loading list's `gramophoneItems()` has usually fetched it already. It is drawn in the shared cast
 * pass with the cast's environment (0.8 on its brass and wood).
 */
export function ensureGramophone(ctx: ActorCtx): Promise<GramophoneActor> {
  return ensureActor(ctx.actors, GR_NAME, () => GramophoneActor.create(ctx));
}
