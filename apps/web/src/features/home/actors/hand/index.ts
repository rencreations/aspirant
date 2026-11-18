import type { PerspectiveCamera } from "three";

import { getCast } from "../shared/cast";
import { ensureActor } from "../shared/ensure";
import { loadGltf } from "../shared/gltf";
import type { ActorCtx } from "../shared/types";

import { HandActor } from "./actor";
import { HAND_MODEL } from "./constants";

export { HandActor } from "./actor";
export type { HandPlacement, HandSocketName, HandStats } from "./actor";
export type { FingerName } from "./fingers";

/**
 * Selena's hand, built once and shared by every section that needs it (the hand section, the list
 * that follows it). The model comes through the media store (the loading list's `handItems()` has
 * usually fetched it already) and its programs are compiled before it is handed back.
 */
export function ensureHand(ctx: ActorCtx): Promise<HandActor> {
  return ensureActor(ctx.actors, "hand", async () => {
    const gltf = await loadGltf(HAND_MODEL);
    const cast = getCast(ctx.stage);
    const actor = new HandActor(ctx, gltf, cast);
    await actor.warm(ctx.stage.renderer, cast.pass.camera as PerspectiveCamera);
    return actor;
  });
}
