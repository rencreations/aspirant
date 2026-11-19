import { ensureDoll } from "../doll";
import { ensureDrone } from "../drone";
import { ensureActor } from "../shared/ensure";
import type { ActorCtx } from "../shared/types";

import { BuddyPair } from "./pair";

export { BuddyPair, DOLL_RATIO } from "./pair";
export type { PairMode, PairState, ReactName } from "./pair";
export { DANCE_NAMES, DANCE_NAMES as DANCES, danceSeconds, showBeats } from "./choreo";
export type { DanceName } from "./choreo";

/**
 * The drone that carries the Obsidia doll, built once and shared. The drone and the doll are built
 * (or found) first; the pair is registered after them, so the registry steps it last.
 */
export function ensureBuddies(ctx: ActorCtx): Promise<BuddyPair> {
  return ensureActor(ctx.actors, "buddies", async () => {
    const [drone, doll] = await Promise.all([ensureDrone(ctx), ensureDoll(ctx)]);
    return new BuddyPair(ctx, drone, doll);
  });
}
