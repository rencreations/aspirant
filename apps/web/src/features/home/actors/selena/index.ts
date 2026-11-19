import { cachedFetch } from "@/lib/media-store";
import { asset } from "@/lib/asset";

import { getCast } from "../shared/cast";
import { ensureActor } from "../shared/ensure";
import { loadGltf } from "../shared/gltf";
import type { ActorCtx } from "../shared/types";
import { warmCast } from "../shared/warm";

import { SelenaActor } from "./actor";
import type { CameraData } from "./camera";
import { SELENA_CAMERAS, SELENA_CAMERAS_R7, SELENA_MODEL } from "./constants";
import type { R7Data } from "./camera-r7";
import { loadSkyTexture } from "./sky";

export { SelenaActor } from "./actor";
export type {
  ClipName,
  Expression,
  FrameOptions,
  LookTarget,
  PlaceInput,
  PlayOptions,
  Rect,
  SelenaStats,
  SocketName,
} from "./actor";

/**
 * Selena, built once and shared by every section that needs her (the list's 3D frame, the room
 * after it). The model and the baked cameras come through the same saved copies the loading list
 * fills (`selenaItems()`), and her programs and pictures are compiled, and drawn once, before she is handed back.
 */
export function ensureSelena(ctx: ActorCtx): Promise<SelenaActor> {
  return ensureActor(ctx.actors, "selena", async () => {
    const [gltf, cams, r7, sky] = await Promise.all([
      loadGltf(SELENA_MODEL),
      loadCameras(),
      loadCamerasR7(),
      loadSkyTexture().catch(() => null),
    ]);
    const cast = getCast(ctx.stage);
    const actor = new SelenaActor(ctx, gltf, cams, cast, r7, sky);
    // Her materials are clipped by planes: the programs are made with clipping on, like her frames.
    await warmCast(ctx.stage, cast, actor.object, { localClipping: true });
    return actor;
  });
}

async function loadCamerasR7(): Promise<R7Data | null> {
  try {
    const response = await cachedFetch(asset(SELENA_CAMERAS_R7));
    return (await response.json()) as R7Data;
  } catch {
    return null;
  }
}

async function loadCameras(): Promise<CameraData> {
  const response = await cachedFetch(asset(SELENA_CAMERAS));
  return (await response.json()) as CameraData;
}
