import { ensureActor } from "../../actors/shared/ensure";
import type { ActorCtx } from "../../actors/shared/types";
import { FieldActor } from "./actor";
import type { FieldSetName } from "./sets";

export { FieldActor, FIELD_ORDER, FIELD_ORDER_FRONT } from "./actor";
export type { CardPress, FormationRef } from "./actor";
export { RING_P, type FormationName, type RankBy } from "./formations";
export type { PoseFn, Rect } from "./types";
/** @public */
export { fieldItems } from "./preload";

/**
 * Build the picture field, or find the one another section built. The sections and the lab call
 * this. It resolves when every picture of the set is a texture (the loading list has put the
 * bitmaps in the store, so this is quick; if the list did not run, they are fetched now).
 *
 * @public
 */
export function ensureField(ctx: ActorCtx, set: FieldSetName = "hero"): Promise<FieldActor> {
  return ensureActor(ctx.actors, "field", async () => {
    const field = new FieldActor(ctx, set);
    await field.ready;
    return field;
  });
}
