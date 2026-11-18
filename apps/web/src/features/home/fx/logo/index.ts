import { ensureActor } from "../../actors/shared/ensure";
import type { ActorCtx } from "../../actors/shared/types";
import { LogoActor } from "./actor";
import { readNavTarget, showNavLogo } from "./dom";
import { heroRect, rectFromGrabs, SOCKETS } from "./math";

export { LogoActor, LOGO_ORDER, type LogoPose } from "./actor";
/** @public */
export { logoItems } from "./preload";
export { NavTargetWatch, readNavTarget, showNavLogo } from "./dom";
export {
  ART_ASPECT,
  heroArtWidth,
  heroRect,
  isHandedOff,
  stageRectFromDom,
  type LogoRect,
  type NavTarget,
  type SocketName,
} from "./math";

/** What a probe may reach for on the home page (`window.__logoFx`): the pure helpers, no state. */
const fx = { readNavTarget, showNavLogo, heroRect, rectFromGrabs, SOCKETS };

declare global {
  interface Window {
    __logoFx?: typeof fx;
  }
}

/**
 * Build the logo actor, or find the one another section built. The lab and the sections call this.
 *
 * @public
 */
export function ensureLogo(ctx: ActorCtx): Promise<LogoActor> {
  // Probes (`window.__home` exists only on the stage) get the helpers a section would import.
  if (window.__home) window.__logoFx = fx;
  return ensureActor(ctx.actors, "logo", () => new LogoActor(ctx));
}
