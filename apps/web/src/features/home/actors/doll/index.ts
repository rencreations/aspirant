import { asset } from "@/lib/asset";
import { cachedFetch } from "@/lib/media-store";

import { getCast } from "../shared/cast";
import { ensureActor } from "../shared/ensure";
import { loadGltf } from "../shared/gltf";
import type { ActorCtx } from "../shared/types";

import { DollActor } from "./actor";
import { FallClip, FALL_DATA_PATH } from "./fall";
import { DOLL_MODEL_PATH } from "./preload";

export { DollActor } from "./actor";
export type { AttachOptions, DollPlacement, DollSocketName, MarkPoint } from "./actor";
export type { RideGesture, RideOptions } from "./ride";
export type { FaceName } from "./face/presets";
export type { MoodStep } from "./face/sequence";
export type { ReactionKind } from "./interaction";
export type { PoseName } from "./pose/poses";
export { walkPhaseFor } from "./motion";
export { DOLL_SIZE, drawnHeight } from "./place";
export { LAND_SECONDS, STAND_SECONDS } from "./fall";

/** The fitted fall loop, or null when the file is gone or stale: a failed download is not a version. */
async function loadFallClip(): Promise<FallClip | null> {
  try {
    const response = await cachedFetch(asset(FALL_DATA_PATH));
    return FallClip.parse(await response.json());
  } catch {
    return null;
  }
}

/**
 * The doll, built once and shared by every section that needs her. The model comes through the
 * media store (the loading list's `dollItems()` has usually fetched it already).
 */
export function ensureDoll(ctx: ActorCtx): Promise<DollActor> {
  return ensureActor(ctx.actors, "doll", async () => {
    const [gltf, clip] = await Promise.all([loadGltf(DOLL_MODEL_PATH), loadFallClip()]);
    const doll = new DollActor(ctx, gltf, DOLL_MODEL_PATH, getCast(ctx.stage));
    doll.setFallClip(clip);
    await doll.warm();
    return doll;
  });
}
