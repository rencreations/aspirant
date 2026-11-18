import { ensureActor } from "../shared/ensure";
import type { ActorCtx } from "../shared/types";

import { RecordsActor } from "./actor";
import { RECORDS_NAME } from "./facts";

/**
 * The record crate and its disc, built once for the music section. Both are made in code: the
 * covers come from the music room's data (`useMusic`), the rest is geometry and a shader.
 */
export function ensureRecords(ctx: ActorCtx): Promise<RecordsActor> {
  return ensureActor(ctx.actors, RECORDS_NAME, () => RecordsActor.create(ctx));
}
