import { loadGltf } from "../shared/gltf";
import { ensureActor } from "../shared/ensure";
import type { ActorCtx } from "../shared/types";

import { COMPANION_MODEL } from "@/features/about/companions/model";

import { DuoActor } from "./actor";

export type { DuoActor } from "./actor";

/**
 * The two Guinevere drones, built once for the whole home. The first section that needs them
 * builds them; the others find them (`ensureActor`). They draw in the shared unlit pass of the
 * stage (the perspective pass, order 20). The model is `/models/about/companion.glb`, the same file
 * as /about, read through the media store.
 */
export function ensureDuo(ctx: ActorCtx): Promise<DuoActor> {
  return ensureActor(ctx.actors, "duo", async () => {
    const gltf = await loadGltf(COMPANION_MODEL);
    const pass = ctx.stage.scenePass("perspective", "perspective", 20);
    return new DuoActor(ctx, gltf.scene, pass);
  });
}
