import { getCast } from "../shared/cast";
import { ensureActor } from "../shared/ensure";
import { loadGltf } from "../shared/gltf";
import type { ActorCtx } from "../shared/types";

import { DollActor } from "./actor";
import { DOLL_MODEL_PATH } from "./preload";

export { DollActor } from "./actor";
export type { AttachOptions, DollPlacement, DollSocketName, MarkPoint } from "./actor";
export type { FaceName } from "./face/presets";
export type { MoodStep } from "./face/sequence";
export type { ReactionKind } from "./interaction";
export type { PoseName } from "./pose/poses";
export { walkPhaseFor } from "./motion";
export { DOLL_SIZE, drawnHeight } from "./place";

/**
 * The doll, built once and shared by every section that needs her. The model comes through the
 * media store (the loading list's `dollItems()` has usually fetched it already).
 */
export function ensureDoll(ctx: ActorCtx): Promise<DollActor> {
  return ensureActor(ctx.actors, "doll", async () => {
    const gltf = await loadGltf(DOLL_MODEL_PATH);
    const doll = new DollActor(ctx, gltf, DOLL_MODEL_PATH, getCast(ctx.stage));
    await doll.warm();
    return doll;
  });
}
