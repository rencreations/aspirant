import { ensureActor } from "../../actors/shared/ensure";
import type { ActorCtx } from "../../actors/shared/types";
import { FilmActor } from "./actor";

export { FilmActor, FILM_ORDER } from "./actor";
export type { PreviewPress } from "./actor";
export { HOVER_MODES, type HoverMode, type HoverWeights } from "./hover";
export { PREVIEWS, TRAILER_FILM, previewAspect, type PreviewFilm } from "./data";
export type { StreamStatus } from "./stream";
export {
  expandBox,
  orbitStage,
  orbitCardWidth,
  sceneBox,
  stripBox,
  windowBox,
  toFrame,
  type Box,
} from "./layout";
export { composeScene, makePoses } from "./scene";
export { DEFAULT_STATE, type FilmState, type PlanePose } from "./types";
/** @public */
export { filmItems } from "./preload";

/**
 * Build the film plane, or find the one another section built. The sections and the lab call this.
 * It resolves at once: the videos load behind it (the loading list has put them in the media store,
 * so this is quick), and a plane shows its colour until its picture is in.
 *
 * @public
 */
export function ensureFilm(ctx: ActorCtx): Promise<FilmActor> {
  return ensureActor(ctx.actors, "film", () => new FilmActor(ctx));
}
