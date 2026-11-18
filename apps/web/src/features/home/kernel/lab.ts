/**
 * The lab: a way to see one actor on the real stage, in the real renderer, from a probe or a
 * Playwright script, with no section in charge of it. `window.__home.lab("silverbolt")` builds the
 * actor (through its own `ensure`), pins it shown (the kernel's hide-by-default skips a pinned
 * actor) and returns the actor itself, so a script can place it, pose it and look at a frame.
 * `window.__home.unpin(name)` gives it back to the sections.
 *
 * Every actor adds one line to `LABS`. The imports are lazy, so a visitor never loads the table's
 * actors for it: a section's own `mount` loads what it uses.
 */
import type { ActorCtx } from "../actors/shared/types";
import type { Actor } from "./types";

type Ensure = (ctx: ActorCtx) => Promise<Actor>;

export const LABS: Readonly<Record<string, Ensure>> = {
  logo: async (ctx) => (await import("../fx/logo")).ensureLogo(ctx),
  duo: async (ctx) => (await import("../actors/duo")).ensureDuo(ctx),
  doll: async (ctx) => (await import("../actors/doll")).ensureDoll(ctx),
  drone: async (ctx) => (await import("../actors/drone")).ensureDrone(ctx),
  silverbolt: async (ctx) => (await import("../actors/silverbolt")).ensureSilverbolt(ctx),
  tetra: async (ctx) => (await import("../actors/tetra")).ensureTetra(ctx),
  selena: async (ctx) => (await import("../actors/selena")).ensureSelena(ctx),
  hand: async (ctx) => (await import("../actors/hand")).ensureHand(ctx),
  gramophone: async (ctx) => (await import("../actors/gramophone")).ensureGramophone(ctx),
  records: async (ctx) => (await import("../actors/records")).ensureRecords(ctx),
  marks: async (ctx) => (await import("../fx/comic-marks/lab")).ensureMarksLab(ctx),
  field: async (ctx) => (await import("../fx/image-field")).ensureField(ctx),
};
