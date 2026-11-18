import { ensureActor } from "../shared/ensure";
import type { ActorCtx } from "../shared/types";

import { buildTetra, type TetraActor } from "./actor";
import { TETRA_NAME } from "./model";

export type { TetraActor } from "./actor";

/**
 * Tetra, built once and shared by every section that needs her (the funny, the chase and the bend
 * sections). The model comes through the media store: the loading list's `tetraItems()` has usually
 * fetched it already. She is not shown until a section sets `visible`.
 */
export function ensureTetra(ctx: ActorCtx): Promise<TetraActor> {
  return ensureActor(ctx.actors, TETRA_NAME, () => buildTetra(ctx));
}
