import type { PerspectiveCamera } from "three";

import { cachedFetch } from "@/lib/media-store";
import { asset } from "@/lib/asset";

import { getCast } from "../shared/cast";
import { ensureActor } from "../shared/ensure";
import { loadGltf } from "../shared/gltf";
import type { ActorCtx } from "../shared/types";

import { SelenaActor } from "./actor";
import type { CameraData } from "./camera";
import { SELENA_CAMERAS, SELENA_MODEL } from "./constants";

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
 * fills (`selenaItems()`), and her programs and pictures are compiled before she is handed back.
 */
export function ensureSelena(ctx: ActorCtx): Promise<SelenaActor> {
  return ensureActor(ctx.actors, "selena", async () => {
    const [gltf, cams] = await Promise.all([loadGltf(SELENA_MODEL), loadCameras()]);
    const actor = new SelenaActor(ctx, gltf, cams, getCast(ctx.stage));
    await actor.warm(ctx.stage.renderer, getCast(ctx.stage).pass.camera as PerspectiveCamera);
    return actor;
  });
}

async function loadCameras(): Promise<CameraData> {
  const response = await cachedFetch(asset(SELENA_CAMERAS));
  return (await response.json()) as CameraData;
}
