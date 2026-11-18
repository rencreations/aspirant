import { ensureActor } from "../../actors/shared/ensure";
import type { ActorCtx } from "../../actors/shared/types";
import { MarksActor } from "./marks";

/**
 * The shared comic marks (bang, question, sweat, vein, sparks, stars, sparkle, heart, notes,
 * dust, zzz, speed lines, flash, air streaks, clouds, poof, sweat beads). Every section and every
 * actor asks for it in `mount` and then fires and forgets: `marks.emit("bang", { at, size })`.
 * See `docs/design/home/fx-marks.md`.
 */
export function ensureMarks(ctx: ActorCtx): Promise<MarksActor> {
  return ensureActor(ctx.actors, "marks", () => new MarksActor(ctx.stage));
}

export { MarksActor };
