import { ensureActor } from "../../actors/shared/ensure";
import type { ActorCtx } from "../../actors/shared/types";
import { BackdropActor, type Backdrop } from "./backdrop";
import { attachBackdrop, backdropHost } from "./host";

/** @public */
export {
  BACKDROP_KINDS,
  BACKDROP_PALETTES,
  type BackdropKind,
  type BackdropPalette,
  type BackdropTheme,
} from "./palettes";
/** @public */
export type { Backdrop, BackdropOptions, BackdropState } from "./backdrop";

/**
 * The live backdrop of the home page: a transparent canvas in the ground stack that draws one of
 * thirty shader kinds (aurora, beams, particles, silk, waves, the four elements and so on), cross-
 * fades when the kind changes, and costs nothing while no section asks for one. A section calls this
 * in `mount` and then `set(kind, options)` every frame it wants a backdrop. It resolves to a working
 * no-op when the page has no host or WebGL cannot make the second context. See
 * `docs/design/home/fx-backdrop.md`.
 *
 * @public
 */
export function ensureBackdrop(ctx: ActorCtx): Promise<Backdrop> {
  return ensureActor(ctx.actors, "backdrop", () => {
    const actor = new BackdropActor(backdropHost(ctx.stage), ctx.pointer);
    attachBackdrop(ctx.stage, actor);
    return actor;
  });
}
